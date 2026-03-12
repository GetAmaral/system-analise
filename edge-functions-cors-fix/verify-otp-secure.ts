import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.0';

const ALLOWED_ORIGINS = [
  'https://totalassistente.com.br',
  'https://www.totalassistente.com.br',
];

function getCorsHeaders(req: Request) {
  const origin = req.headers.get('Origin') || '';
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };
}

const MAX_ATTEMPTS = 5;

// Helper to hash IP for rate limiting (privacy-preserving)
async function hashIdentifier(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input + '_salt_2024');
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 32);
}

serve(async (req) => {
  const cors = getCorsHeaders(req);
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: cors });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseAdmin = createClient(supabaseUrl, serviceKey);
    const authClient = createClient(supabaseUrl, anonKey);

    const { email, code, sessionToken } = await req.json();

    if (!email || !code || !sessionToken) {
      throw new Error('Dados incompletos');
    }

    // Validate input formats
    if (typeof email !== 'string' || typeof code !== 'string' || typeof sessionToken !== 'string') {
      throw new Error('Dados inválidos');
    }

    // Validate code format (6 digits only)
    if (!/^\d{6}$/.test(code)) {
      throw new Error('Código deve ter 6 dígitos');
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim().toLowerCase())) {
      throw new Error('Email inválido');
    }

    // Validate session token format (64 hex chars)
    if (!/^[a-f0-9]{64}$/.test(sessionToken)) {
      throw new Error('Sessão inválida');
    }

    // Get IP for rate limiting
    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
                     req.headers.get('x-real-ip') || 
                     'unknown';
    const ipHash = await hashIdentifier(clientIp);

    // Rate limiting check for OTP verification
    const { data: rateLimit } = await supabaseAdmin.rpc('check_rate_limit', {
      p_identifier: ipHash,
      p_action_type: 'otp_verify',
      p_max_attempts: 15,
      p_window_minutes: 15,
      p_block_minutes: 60
    });

    if (rateLimit && !rateLimit.allowed) {
      console.warn('[verify-otp-secure] Rate limit exceeded for IP');
      throw new Error(rateLimit.message || 'Muitas tentativas. Tente novamente mais tarde.');
    }

    // Verify the session token is valid and matches the email
    const { data: sessionData, error: verifyError } = await supabaseAdmin
      .from('two_factor_sessions')
      .select('*')
      .eq('email', email.trim().toLowerCase())
      .eq('session_token', sessionToken)
      .gt('expires_at', new Date().toISOString())
      .eq('is_verified', false)
      .single();

    if (verifyError || !sessionData) {
      throw new Error('Sessão inválida ou expirada. Faça login novamente.');
    }

    // Check rate limiting - block if max attempts reached
    if (sessionData.attempts >= MAX_ATTEMPTS) {
      console.warn('[verify-otp-secure] Max attempts reached for session');
      
      // Mark session as verified to prevent further attempts
      await supabaseAdmin
        .from('two_factor_sessions')
        .update({ is_verified: true })
        .eq('session_token', sessionToken);
      
      throw new Error('Limite de tentativas excedido. Faça login novamente.');
    }

    // Verify the OTP code
    const { data: otpData, error: otpError } = await authClient.auth.verifyOtp({
      email: email.trim().toLowerCase(),
      token: code,
      type: 'email'
    });

    if (otpError) {
      // Increment attempts counter on failure
      const newAttempts = (sessionData.attempts || 0) + 1;
      await supabaseAdmin
        .from('two_factor_sessions')
        .update({ attempts: newAttempts })
        .eq('session_token', sessionToken);
      
      const remainingAttempts = MAX_ATTEMPTS - newAttempts;
      
      if (remainingAttempts <= 0) {
        throw new Error('Código inválido. Limite de tentativas excedido. Faça login novamente.');
      }
      
      throw new Error(`Código inválido ou expirado. ${remainingAttempts} tentativa${remainingAttempts > 1 ? 's' : ''} restante${remainingAttempts > 1 ? 's' : ''}.`);
    }

    // Complete and cleanup the 2FA session
    await supabaseAdmin
      .from('two_factor_sessions')
      .update({ is_verified: true })
      .eq('session_token', sessionToken);

    // Log successful login to audit log
    if (otpData.user) {
      await supabaseAdmin.rpc('log_audit_event', {
        p_user_id: otpData.user.id,
        p_action: 'login_success',
        p_resource_type: 'auth',
        p_ip_hash: ipHash
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        session: otpData.session,
        user: otpData.user
      }),
      {
        headers: { ...cors, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error: any) {
    // Don't log sensitive error details
    console.error('[verify-otp-secure] Verification failed');
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Erro ao verificar código'
      }),
      {
        headers: { ...cors, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
