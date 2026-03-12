// Edge Function: delete-account
// Securely deletes an unconfirmed (pending) user and related public data
// POST { user_id: string, created_at: string }
// REQUER: JWT valido (verify_jwt = true no config.toml)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing required environment variables');
}

const ALLOWED_ORIGINS = [
  'https://totalassistente.com.br',
  'https://www.totalassistente.com.br',
];

function getCorsHeaders(req: Request) {
  const origin = req.headers.get('Origin') || '';
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Content-Type': 'application/json',
  };
}

Deno.serve(async (req) => {
  const cors = getCorsHeaders(req);
  const json = (status: number, data: Record<string, unknown>) =>
    new Response(JSON.stringify(data), { status, headers: cors });

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: cors });
  }

  if (req.method !== 'POST') {
    return json(405, { error: 'Method not allowed' });
  }

  // Verificar JWT do usuario
  const authHeader = req.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return json(401, { error: 'Token de autenticacao ausente' });
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return json(500, { error: 'Server configuration error' });
  }

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Validar o token JWT e extrair o usuario
  const token = authHeader.replace('Bearer ', '');
  const { data: { user: authUser }, error: authError } = await admin.auth.getUser(token);

  if (authError || !authUser) {
    return json(401, { error: 'Token invalido ou expirado' });
  }

  let body: { user_id?: string; created_at?: string } = {};
  try {
    body = await req.json();
  } catch (e) {
    return json(400, { error: 'Invalid JSON body' });
  }

  const { user_id, created_at } = body;
  if (!user_id || !created_at) {
    return json(400, { error: 'Missing required fields: user_id, created_at' });
  }

  // Usuario so pode deletar a si mesmo
  if (user_id !== authUser.id) {
    return json(403, { error: 'Voce so pode deletar sua propria conta' });
  }

  try {
    // Verify user exists and is UNCONFIRMED
    const { data: userRes, error: getUserError } = await admin.auth.admin.getUserById(user_id);
    if (getUserError || !userRes?.user) {
      return json(404, { error: 'User not found' });
    }

    const usr: any = userRes.user;
    if (usr?.email_confirmed_at) {
      return json(400, { error: 'Cannot delete a confirmed user' });
    }

    // Basic created_at verification (within 5 minutes window)
    const reqTs = Date.parse(created_at);
    const userTs = Date.parse(usr.created_at);
    if (!Number.isFinite(reqTs) || !Number.isFinite(userTs) || Math.abs(reqTs - userTs) > 5 * 60 * 1000) {
      return json(400, { error: 'created_at validation failed' });
    }

    // Clean up public data (service role bypasses RLS)
    try { await admin.from('google_calendar_connections').delete().eq('user_id', user_id); } catch {}
    try { await admin.from('profiles').delete().eq('id', user_id); } catch {}

    // Finally, delete the auth user
    const { error: delErr } = await admin.auth.admin.deleteUser(user_id);
    if (delErr) {
      console.error('delete-account: failed to delete user', delErr);
      return json(500, { error: 'Failed to delete user' });
    }

    return json(200, { success: true });
  } catch (e) {
    console.error('delete-account error', e);
    return json(500, { error: 'Internal error' });
  }
});
