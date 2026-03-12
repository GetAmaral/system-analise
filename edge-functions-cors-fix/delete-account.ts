// Edge Function: delete-account
// Securely deletes an unconfirmed (pending) user and related public data
// POST { user_id: string, created_at: string }

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

  console.log('delete-account function called:', req.method);

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: cors });
  }

  if (req.method !== 'POST') {
    console.log('Invalid method:', req.method);
    return json(405, { error: 'Method not allowed' });
  }

  let body: { user_id?: string; created_at?: string } = {};
  try {
    body = await req.json();
    console.log('Request body received:', body);
  } catch (e) {
    console.error('Invalid JSON body:', e);
    return json(400, { error: 'Invalid JSON body' });
  }

  const { user_id, created_at } = body;
  if (!user_id || !created_at) {
    console.log('Missing required fields:', { user_id: !!user_id, created_at: !!created_at });
    return json(400, { error: 'Missing required fields: user_id, created_at' });
  }

  try {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      console.error('delete-account: missing environment variables');
      return json(500, { error: 'Server configuration error' });
    }

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Verify user exists and is UNCONFIRMED
    const { data: userRes, error: getUserError } = await admin.auth.admin.getUserById(user_id);
    if (getUserError || !userRes?.user) {
      console.warn('delete-account: user not found', { user_id });
      return json(404, { error: 'User not found' });
    }

    const usr: any = userRes.user;
    if (usr?.email_confirmed_at) {
      console.warn('delete-account: user already confirmed', { user_id });
      return json(400, { error: 'Cannot delete a confirmed user' });
    }

    // Basic created_at verification (within 5 minutes window)
    const reqTs = Date.parse(created_at);
    const userTs = Date.parse(usr.created_at);
    if (!Number.isFinite(reqTs) || !Number.isFinite(userTs) || Math.abs(reqTs - userTs) > 5 * 60 * 1000) {
      console.warn('delete-account: created_at validation failed', { user_id, created_at_req: created_at, created_at_user: usr.created_at });
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