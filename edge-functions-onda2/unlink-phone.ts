import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

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

Deno.serve(async (req) => {
  const cors = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: cors });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Nao autorizado" }),
        { status: 401, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    // Verify user with anon client
    const supabaseAnon = createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabaseAnon.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Usuario nao autenticado" }),
        { status: 401, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    const { phone } = await req.json();
    if (!phone) {
      return new Response(
        JSON.stringify({ error: "Telefone nao informado" }),
        { status: 400, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    const cleanedPhone = phone.replace(/\D/g, "");

    // Use service role to delete from phones_whatsapp
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // CORRECAO A3: Filtrar por user_id — usuario so pode desvincular SEU telefone
    const { error: deleteError } = await supabaseAdmin
      .from("phones_whatsapp")
      .delete()
      .eq("phone", cleanedPhone)
      .eq("user_id", user.id);

    if (deleteError) {
      console.error("Erro ao deletar telefone:", deleteError);
      return new Response(
        JSON.stringify({ error: "Erro ao remover telefone" }),
        { status: 500, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...cors, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Erro:", error);
    return new Response(
      JSON.stringify({ error: "Erro interno" }),
      { status: 500, headers: { ...cors, "Content-Type": "application/json" } }
    );
  }
});
