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
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: cors });
  }

  try {
    const { email, password, name, phone } = await req.json();

    if (!email || !password) {
      return new Response(
        JSON.stringify({ error: "Email e senha são obrigatórios" }),
        { status: 400, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Criar usuário via Admin API
    const { data: userData, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: email.toLowerCase().trim(),
      password,
      email_confirm: true, // Já confirma o email automaticamente
      user_metadata: {
        name: name || null,
        phone: phone || null,
      },
    });

    if (createError) {
      console.error("Erro ao criar usuário:", createError);
      return new Response(
        JSON.stringify({ error: createError.message }),
        { status: 400, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    // Atualizar o profile com os dados
    if (userData.user) {
      const { error: profileError } = await supabaseAdmin
        .from('profiles')
        .upsert({
          id: userData.user.id,
          name: name || null,
          phone: phone || null,
          email: email.toLowerCase().trim(),
        });

      if (profileError) {
        console.error("Erro ao criar profile:", profileError);
      }

      // Vincular subscription existente ao usuário
      const { error: subError } = await supabaseAdmin
        .from('subscriptions')
        .update({ user_id: userData.user.id })
        .ilike('email', email.trim());

      if (subError) {
        console.error("Erro ao vincular subscription:", subError);
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        user: userData.user,
        message: "Usuário criado com sucesso!" 
      }),
      { status: 200, headers: { ...cors, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Erro:", error);
    return new Response(
      JSON.stringify({ error: "Erro interno do servidor" }),
      { status: 500, headers: { ...cors, "Content-Type": "application/json" } }
    );
  }
});
