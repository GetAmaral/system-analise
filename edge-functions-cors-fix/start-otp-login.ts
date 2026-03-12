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

    const { email, password } = await req.json();

    if (!email || !password) {
      throw new Error('Email e senha são obrigatórios');
    }

    // Input validation
    if (typeof email !== 'string' || typeof password !== 'string') {
      throw new Error('Dados inválidos');
    }

    const trimmedEmail = email.trim().toLowerCase();
    const trimmedPassword = password.trim();

    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      throw new Error('Email inválido');
    }

    // Get IP for rate limiting
    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
                     req.headers.get('x-real-ip') || 
                     'unknown';
    const ipHash = await hashIdentifier(clientIp);
    const emailHash = await hashIdentifier(trimmedEmail);

    // Rate limiting check - by IP
    const { data: ipRateLimit } = await supabaseAdmin.rpc('check_rate_limit', {
      p_identifier: ipHash,
      p_action_type: 'login',
      p_max_attempts: 10,
      p_window_minutes: 15,
      p_block_minutes: 30
    });

    if (ipRateLimit && !ipRateLimit.allowed) {
      console.warn('[start-otp-login] Rate limit exceeded for IP:', ipHash.substring(0, 8));
      throw new Error(ipRateLimit.message || 'Muitas tentativas. Tente novamente mais tarde.');
    }

    // Rate limiting check - by email
    const { data: emailRateLimit } = await supabaseAdmin.rpc('check_rate_limit', {
      p_identifier: emailHash,
      p_action_type: 'login',
      p_max_attempts: 5,
      p_window_minutes: 15,
      p_block_minutes: 60
    });

    if (emailRateLimit && !emailRateLimit.allowed) {
      console.warn('[start-otp-login] Rate limit exceeded for email');
      throw new Error(emailRateLimit.message || 'Muitas tentativas para este email. Tente novamente mais tarde.');
    }

    // Validate credentials using Supabase auth
    const { data: loginData, error: loginError } = await authClient.auth.signInWithPassword({
      email: trimmedEmail,
      password: trimmedPassword
    });

    if (loginError || !loginData.user) {
      // Log failed attempt (without exposing email in logs)
      console.warn('[start-otp-login] Invalid credentials for hash:', emailHash.substring(0, 8));
      throw new Error('Credenciais inválidas');
    }

    // Generate a secure session token
    const randomBytes = new Uint8Array(32);
    crypto.getRandomValues(randomBytes);
    const sessionToken = Array.from(randomBytes).map(b => b.toString(16).padStart(2, '0')).join('');
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Store the session in the database
    const { error: sessionError } = await supabaseAdmin
      .from('two_factor_sessions')
      .insert({
        email: trimmedEmail,
        session_token: sessionToken,
        expires_at: expiresAt.toISOString(),
        ip_address: ipHash // Store hash, not raw IP
      });

    if (sessionError) {
      console.error('[start-otp-login] Failed to create session');
      throw new Error('Erro ao criar sessão segura');
    }

    // Send OTP code via email
    const projectUrl = Deno.env.get('PROJECT_URL') || 'https://totalassistente.com.br';
    const { error: otpError } = await authClient.auth.signInWithOtp({
      email: trimmedEmail,
      options: {
        shouldCreateUser: false,
        emailRedirectTo: projectUrl + '/login-sucesso'
      }
    });

    if (otpError) {
      console.error('[start-otp-login] OTP send error');
      throw new Error('Não foi possível enviar o código agora. Aguarde alguns segundos e tente novamente.');
    }

    // Log successful OTP send to audit log
    await supabaseAdmin.rpc('log_audit_event', {
      p_user_id: loginData.user.id,
      p_action: 'otp_sent',
      p_resource_type: 'auth',
      p_ip_hash: ipHash
    });

    return new Response(
      JSON.stringify({
        success: true,
        sessionToken,
        email: trimmedEmail
      }),
      {
        headers: { ...cors, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error: any) {
    // Don't log sensitive error details
    console.error('[start-otp-login] Error occurred');
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Erro ao processar login'
      }),
      {
        headers: { ...cors, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
