import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.0";

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

serve(async (req) => {
  const cors = getCorsHeaders(req);
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: cors });
  }

  try {
    const { email } = await req.json();

    if (!email || typeof email !== 'string') {
      return new Response(
        JSON.stringify({ error: "Email is required", exists: false }),
        { status: 400, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalizedEmail)) {
      return new Response(
        JSON.stringify({ error: "Invalid email format", exists: false }),
        { status: 400, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    // Create Supabase admin client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // 1. Check profiles table (most efficient)
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .ilike('email', normalizedEmail)
      .maybeSingle();

    if (profile) {
      return new Response(
        JSON.stringify({ exists: true }),
        { status: 200, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    // 2. Check auth.users via admin API directly by email
    try {
      const { data: { user }, error: authError } = await supabaseAdmin.auth.admin.getUserByEmail(normalizedEmail);

      if (!authError && user) {
        return new Response(
          JSON.stringify({ exists: true }),
          { status: 200, headers: { ...cors, "Content-Type": "application/json" } }
        );
      }
    } catch (err) {
      console.error("Auth check error:", err);
    }

    // 3. Check subscriptions table
    const { data: subscription } = await supabaseAdmin
      .from('subscriptions')
      .select('id')
      .ilike('email', normalizedEmail)
      .maybeSingle();

    if (subscription) {
      return new Response(
        JSON.stringify({ exists: true, hasSubscription: true }),
        { status: 200, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ exists: false }),
      { status: 200, headers: { ...cors, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error checking email:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error", exists: false }),
      { status: 500, headers: { ...cors, "Content-Type": "application/json" } }
    );
  }
});
