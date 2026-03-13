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

// --- CORRECAO A2: Comparacao constant-time para evitar timing attacks ---
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  const encoder = new TextEncoder();
  const bufA = encoder.encode(a);
  const bufB = encoder.encode(b);
  let result = 0;
  for (let i = 0; i < bufA.byteLength; i++) {
    result |= bufA[i] ^ bufB[i];
  }
  return result === 0;
}

serve(async (req) => {
  const cors = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: cors });
  }

  try {
    // Verificar chave secreta
    const authHeader = req.headers.get('authorization') || '';
    const adminSecret = Deno.env.get('ADMIN_API_SECRET');

    // CORRECAO A2: usar comparacao constant-time
    if (!adminSecret || !timingSafeEqual(authHeader, `Bearer ${adminSecret}`)) {
      return new Response(
        JSON.stringify({ error: "Nao autorizado" }),
        { status: 401, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    const { email, password, name, phone } = await req.json();

    if (!email || !password) {
      return new Response(
        JSON.stringify({ error: "Email e senha sao obrigatorios" }),
        { status: 400, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    // CORRECAO M9: Validacao de forca de senha
    if (password.length < 8) {
      return new Response(
        JSON.stringify({ error: "Senha deve ter no minimo 8 caracteres" }),
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

    // Criar usuario via Admin API
    const { data: userData, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: email.toLowerCase().trim(),
      password,
      email_confirm: true,
      user_metadata: {
        name: name || null,
        phone: phone || null,
      },
    });

    if (createError) {
      console.error("Erro ao criar usuario:", createError);
      // CORRECAO A8: nao vazar mensagem interna de erro
      return new Response(
        JSON.stringify({ error: "Erro ao criar usuario" }),
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

      // Vincular subscription existente ao usuario
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
        message: "Usuario criado com sucesso!"
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
