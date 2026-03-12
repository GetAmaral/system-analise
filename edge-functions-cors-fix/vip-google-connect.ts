import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

const GOOGLE_CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID');
const GOOGLE_CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

serve(async (req) => {
  const cors = getCorsHeaders(req);
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: cors });
  }

  const url = new URL(req.url);
  const pathSegments = url.pathname.split('/').filter(Boolean);
  const action = pathSegments[pathSegments.length - 1];

  console.log('[VIP-Google] Request:', { action, method: req.method, pathname: url.pathname });

  try {
    // ACTION: Gerar link OAuth para o VIP
    // GET /vip-google-connect?action=auth&phone=5543999999999
    if (url.searchParams.get('action') === 'auth' || action === 'auth') {
      const phone = url.searchParams.get('phone');
      
      if (!phone) {
        return new Response(JSON.stringify({ error: 'Telefone obrigatório' }), {
          status: 400,
          headers: { ...cors, 'Content-Type': 'application/json' },
        });
      }

      // Normaliza telefone (remove caracteres não numéricos)
      const normalizedPhone = phone.replace(/\D/g, '');
      
      const redirectUri = `${SUPABASE_URL}/functions/v1/vip-google-connect?action=callback`;
      const state = encodeURIComponent(normalizedPhone);
      
      const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
        `client_id=${GOOGLE_CLIENT_ID}` +
        `&redirect_uri=${encodeURIComponent(redirectUri)}` +
        `&response_type=code` +
        `&scope=${encodeURIComponent('https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/calendar.events openid email profile')}` +
        `&access_type=offline` +
        `&prompt=consent` +
        `&state=${state}`;
      
      console.log('[VIP-Google] Auth URL gerada para telefone:', normalizedPhone);
      
      // Retorna o link diretamente (para n8n enviar via WhatsApp)
      return new Response(JSON.stringify({ 
        success: true,
        auth_url: authUrl,
        phone: normalizedPhone 
      }), {
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    // ACTION: Callback do OAuth Google
    if (url.searchParams.get('action') === 'callback' || action === 'callback') {
      const code = url.searchParams.get('code');
      const state = url.searchParams.get('state'); // telefone
      const error = url.searchParams.get('error');

      if (error) {
        console.error('[VIP-Google] OAuth error:', error);
        return new Response(renderErrorPage('Erro na autorização: ' + error), {
          headers: { 'Content-Type': 'text/html; charset=utf-8' },
        });
      }

      if (!code || !state) {
        return new Response(renderErrorPage('Parâmetros inválidos'), {
          headers: { 'Content-Type': 'text/html; charset=utf-8' },
        });
      }

      const phone = decodeURIComponent(state);
      console.log('[VIP-Google] Callback recebido para telefone:', phone);

      // Troca código por tokens
      const redirectUri = `${SUPABASE_URL}/functions/v1/vip-google-connect?action=callback`;
      
      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: GOOGLE_CLIENT_ID!,
          client_secret: GOOGLE_CLIENT_SECRET!,
          code,
          grant_type: 'authorization_code',
          redirect_uri: redirectUri,
        }),
      });

      const tokenData = await tokenResponse.json();

      if (!tokenResponse.ok) {
        console.error('[VIP-Google] Token exchange error:', tokenData);
        return new Response(renderErrorPage('Erro ao obter tokens: ' + JSON.stringify(tokenData)), {
          headers: { 'Content-Type': 'text/html; charset=utf-8' },
        });
      }

      console.log('[VIP-Google] Tokens obtidos com sucesso');

      // Pega email do usuário
      let connectedEmail = null;
      try {
        const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
          headers: { Authorization: `Bearer ${tokenData.access_token}` },
        });
        const userInfo = await userInfoResponse.json();
        connectedEmail = userInfo.email;
        console.log('[VIP-Google] Email conectado:', connectedEmail);
      } catch (e) {
        console.warn('[VIP-Google] Erro ao obter email:', e);
      }

      // Salva na tabela VIP
      const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
      
      const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000).toISOString();
      
      const { error: dbError } = await supabase.rpc('store_vip_google_connection', {
        p_phone: phone,
        p_access_token: tokenData.access_token,
        p_refresh_token: tokenData.refresh_token,
        p_expires_at: expiresAt,
        p_connected_email: connectedEmail,
      });

      if (dbError) {
        console.error('[VIP-Google] Erro ao salvar conexão:', dbError);
        return new Response(renderErrorPage('Erro ao salvar conexão: ' + dbError.message), {
          headers: { 'Content-Type': 'text/html; charset=utf-8' },
        });
      }

      console.log('[VIP-Google] Conexão salva com sucesso para telefone:', phone);

      // Redireciona diretamente para o WhatsApp da IA (número fixo)
      const AI_WHATSAPP_NUMBER = '554396435261';
      const whatsappUrl = `https://wa.me/${AI_WHATSAPP_NUMBER}?text=${encodeURIComponent('✅ Google Calendar conectado com sucesso!')}`;
      
      return Response.redirect(whatsappUrl, 302);
    }

    // ACTION: Verificar status da conexão
    // GET /vip-google-connect?action=status&phone=5543999999999
    if (url.searchParams.get('action') === 'status') {
      const phone = url.searchParams.get('phone');
      
      if (!phone) {
        return new Response(JSON.stringify({ error: 'Telefone obrigatório' }), {
          status: 400,
          headers: { ...cors, 'Content-Type': 'application/json' },
        });
      }

      const normalizedPhone = phone.replace(/\D/g, '');
      const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
      
      const { data, error } = await supabase.rpc('get_vip_connection_status', {
        p_phone: normalizedPhone,
      });

      if (error) {
        console.error('[VIP-Google] Erro ao verificar status:', error);
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...cors, 'Content-Type': 'application/json' },
        });
      }

      const connection = data?.[0];
      
      return new Response(JSON.stringify({
        success: true,
        is_connected: connection?.is_connected ?? false,
        connected_email: connection?.connected_email ?? null,
        connected_at: connection?.connected_at ?? null,
        last_sync_at: connection?.last_sync_at ?? null,
      }), {
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    // ACTION: Desconectar
    // POST /vip-google-connect?action=disconnect&phone=5543999999999
    if (url.searchParams.get('action') === 'disconnect') {
      const phone = url.searchParams.get('phone');
      
      if (!phone) {
        return new Response(JSON.stringify({ error: 'Telefone obrigatório' }), {
          status: 400,
          headers: { ...cors, 'Content-Type': 'application/json' },
        });
      }

      const normalizedPhone = phone.replace(/\D/g, '');
      const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
      
      const { error } = await supabase
        .from('vip_google_connections')
        .update({ 
          is_connected: false,
          encrypted_access_token: null,
          encrypted_refresh_token: null,
          updated_at: new Date().toISOString(),
        })
        .eq('phone', normalizedPhone);

      if (error) {
        console.error('[VIP-Google] Erro ao desconectar:', error);
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...cors, 'Content-Type': 'application/json' },
        });
      }

      console.log('[VIP-Google] Desconectado:', normalizedPhone);

      return new Response(JSON.stringify({ 
        success: true,
        message: 'Google Calendar desconectado' 
      }), {
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ 
      error: 'Ação inválida',
      available_actions: ['auth', 'callback', 'status', 'disconnect'],
      usage: {
        auth: 'GET ?action=auth&phone=5543999999999 - Retorna URL de autorização',
        status: 'GET ?action=status&phone=5543999999999 - Verifica se está conectado',
        disconnect: 'GET ?action=disconnect&phone=5543999999999 - Desconecta',
      }
    }), {
      status: 400,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[VIP-Google] Erro:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }
});

function renderSuccessRedirect(whatsappUrl: string, email: string | null) {
  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Conectado!</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .container {
      background: white;
      border-radius: 20px;
      padding: 40px;
      text-align: center;
      max-width: 400px;
      box-shadow: 0 20px 40px rgba(0,0,0,0.2);
    }
    .icon {
      width: 80px;
      height: 80px;
      background: #22c55e;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 20px;
    }
    .icon svg { width: 40px; height: 40px; fill: white; }
    h1 { color: #22c55e; font-size: 24px; margin-bottom: 10px; }
    p { color: #666; font-size: 16px; margin-bottom: 5px; }
    .email { color: #333; font-weight: 600; margin-bottom: 20px; display: block; }
    .redirect { color: #999; font-size: 14px; margin-top: 20px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="icon">
      <svg viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
    </div>
    <h1>Conectado com sucesso!</h1>
    <p>Google Calendar vinculado:</p>
    <span class="email">${email || 'Email não disponível'}</span>
    <p class="redirect">Redirecionando para WhatsApp...</p>
  </div>
  <script>
    setTimeout(() => {
      window.location.href = '${whatsappUrl}';
    }, 2000);
  </script>
</body>
</html>
  `;
}

function renderErrorPage(message: string) {
  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Erro</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .container {
      background: white;
      border-radius: 20px;
      padding: 40px;
      text-align: center;
      max-width: 400px;
      box-shadow: 0 20px 40px rgba(0,0,0,0.2);
    }
    .icon {
      width: 80px;
      height: 80px;
      background: #ef4444;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 20px;
    }
    .icon svg { width: 40px; height: 40px; fill: white; }
    h1 { color: #ef4444; font-size: 24px; margin-bottom: 10px; }
    p { color: #666; font-size: 14px; word-break: break-word; }
  </style>
</head>
<body>
  <div class="container">
    <div class="icon">
      <svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
    </div>
    <h1>Erro na conexão</h1>
    <p>${message}</p>
  </div>
</body>
</html>
  `;
}
