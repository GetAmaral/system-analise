# ONDA 1 — METODO DE CORRECAO CRITICOS

**Tempo estimado:** 2-3 horas
**Pre-requisitos:** Acesso ao Supabase Dashboard (SQL Editor) + editor de codigo + CLI para deploy

---

## INDICE

| Passo | O que corrige | Onde | Tempo |
|-------|--------------|------|-------|
| 1 | delete-account sem autenticacao | Edge Function + config.toml | 20 min |
| 2 | check-email-exists exposto + hasSubscription | Edge Function | 20 min |
| 3 | google-calendar-sync-cron sem autenticacao | Edge Function | 15 min |
| 4 | Funcoes de token OAuth acessiveis por `authenticated` | SQL Editor | 10 min |
| 5 | JWT hardcoded no cron job do banco | SQL Editor | 15 min |
| 6 | DROP trigger sync_profile_to_auth | SQL Editor | 5 min |
| 7 | Deploy + Teste | CLI + Browser | 30 min |

---

## PASSO 1 — Proteger delete-account com JWT

### 1.1 Atualizar config.toml

Abrir `supabase/config.toml` e trocar:

```toml
[functions.delete-account]
verify_jwt = false
```

Por:

```toml
[functions.delete-account]
verify_jwt = true
```

### 1.2 Substituir o arquivo `supabase/functions/delete-account/index.ts`

Copie e cole o codigo abaixo **inteiro** no lugar do arquivo atual:

```typescript
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

  // --- NOVO: Verificar JWT do usuario ---
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
  // --- FIM NOVO ---

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

  // --- NOVO: Usuario so pode deletar a si mesmo ---
  if (user_id !== authUser.id) {
    return json(403, { error: 'Voce so pode deletar sua propria conta' });
  }
  // --- FIM NOVO ---

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
```

### 1.3 Verificar o frontend

O frontend ja envia JWT automaticamente via `supabase.functions.invoke()`. Se o `delete-account` e chamado assim, nao precisa mudar nada no frontend. Se e chamado via `fetch()` manual, garanta que envia `Authorization: Bearer <token>`.

Para confirmar, busque no codigo do frontend por `delete-account`:

```bash
grep -r "delete-account" src/
```

---

## PASSO 2 — Proteger check-email-exists (rate limit + remover hasSubscription)

### 2.1 Substituir o arquivo `supabase/functions/check-email-exists/index.ts`

Copie e cole **inteiro**:

```typescript
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

// --- NOVO: Rate limiting por IP ---
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_MAX = 10;        // maximo 10 requests
const RATE_LIMIT_WINDOW = 60_000; // por minuto

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
    return true; // permitido
  }

  if (entry.count >= RATE_LIMIT_MAX) {
    return false; // bloqueado
  }

  entry.count++;
  return true; // permitido
}

// Limpar entradas velhas a cada 5 minutos (evitar memory leak)
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of rateLimitMap) {
    if (now > val.resetAt) rateLimitMap.delete(key);
  }
}, 300_000);
// --- FIM NOVO ---

serve(async (req) => {
  const cors = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: cors });
  }

  try {
    // --- NOVO: Verificar rate limit ---
    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || req.headers.get('x-real-ip')
      || 'unknown';

    if (!checkRateLimit(clientIp)) {
      return new Response(
        JSON.stringify({ error: "Muitas tentativas. Aguarde 1 minuto.", exists: false }),
        { status: 429, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }
    // --- FIM NOVO ---

    const { email } = await req.json();

    if (!email || typeof email !== 'string') {
      return new Response(
        JSON.stringify({ error: "Email is required", exists: false }),
        { status: 400, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalizedEmail)) {
      return new Response(
        JSON.stringify({ error: "Invalid email format", exists: false }),
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

    // 1. Check profiles table
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

    // 2. Check auth.users
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
    // CORRIGIDO: removido hasSubscription da resposta (vazava info de pagamento)
    const { data: subscription } = await supabaseAdmin
      .from('subscriptions')
      .select('id')
      .ilike('email', normalizedEmail)
      .maybeSingle();

    if (subscription) {
      return new Response(
        JSON.stringify({ exists: true }),
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
```

### 2.2 Verificar o frontend

Busque no frontend por `hasSubscription`:

```bash
grep -r "hasSubscription" src/
```

Se o frontend usa `hasSubscription`, ajuste para nao depender mais desse campo. A logica de subscription deve ser verificada DEPOIS do login, nao antes.

---

## PASSO 3 — Proteger google-calendar-sync-cron com autenticacao

### 3.1 Substituir o arquivo `supabase/functions/google-calendar-sync-cron/index.ts`

Copie e cole **inteiro**:

```typescript
import "https://deno.land/x/xhr@0.1.0/mod.ts";
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

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

serve(async (req) => {
  const cors = getCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: cors });
  }

  // --- NOVO: Verificar autorizacao ---
  // Aceita service_role_key como Bearer token (usado pelo pg_cron)
  const authHeader = req.headers.get('authorization');
  if (!authHeader || authHeader !== `Bearer ${supabaseServiceRoleKey}`) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...cors, 'Content-Type': 'application/json' }
    });
  }
  // --- FIM NOVO ---

  try {
    console.log('Starting scheduled sync for all users...');

    // Buscar todas as conexoes ativas
    const { data: connections, error } = await supabase
      .from('google_calendar_connections')
      .select('user_id, last_sync_at, webhook_expiration')
      .eq('is_connected', true);

    if (error) {
      throw new Error(`Failed to fetch connections: ${error.message}`);
    }

    if (!connections || connections.length === 0) {
      console.log('No active connections to sync');
      return new Response(JSON.stringify({ message: 'No active connections' }), {
        status: 200,
        headers: { ...cors, 'Content-Type': 'application/json' }
      });
    }

    console.log(`Found ${connections.length} active connections`);

    // Limpar webhooks expirados
    await supabase.rpc('cleanup_expired_google_webhooks');

    let synced = 0;
    let errors = 0;

    // Sincronizar cada usuario em paralelo (maximo 10 por vez)
    const batchSize = 10;
    for (let i = 0; i < connections.length; i += batchSize) {
      const batch = connections.slice(i, i + batchSize);

      await Promise.all(
        batch.map(async (conn) => {
          try {
            // Pular se sincronizou ha menos de 10 minutos
            if (conn.last_sync_at) {
              const lastSync = new Date(conn.last_sync_at);
              const now = new Date();
              const diffMinutes = (now.getTime() - lastSync.getTime()) / 1000 / 60;

              if (diffMinutes < 10) {
                return;
              }
            }

            // Verificar se webhook esta perto de expirar (menos de 24h)
            let needsWebhookRenewal = false;
            if (conn.webhook_expiration) {
              const expiration = new Date(conn.webhook_expiration);
              const now = new Date();
              const hoursUntilExpiration = (expiration.getTime() - now.getTime()) / 1000 / 60 / 60;
              needsWebhookRenewal = hoursUntilExpiration < 24;
            }

            // Invocar sincronizacao via edge function
            const { error: syncError } = await supabase.functions.invoke('google-calendar', {
              body: {
                action: 'cron-sync',
                userId: conn.user_id,
                renewWebhook: needsWebhookRenewal
              },
              headers: {
                'Authorization': `Bearer ${supabaseServiceRoleKey}`
              }
            });

            if (syncError) {
              console.error(`Sync error for user ${conn.user_id}:`, syncError);
              errors++;
            } else {
              synced++;
            }

          } catch (err) {
            console.error(`Error syncing user ${conn.user_id}:`, err);
            errors++;
          }
        })
      );
    }

    console.log(`Cron sync completed: ${synced} synced, ${errors} errors`);

    return new Response(
      JSON.stringify({
        success: true,
        synced,
        errors,
        total: connections.length
      }),
      {
        status: 200,
        headers: { ...cors, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Cron sync error:', error);
    // CORRIGIDO: nao vazar erro interno
    return new Response(JSON.stringify({ error: 'Internal sync error' }), {
      status: 500,
      headers: { ...cors, 'Content-Type': 'application/json' }
    });
  }
});
```

### 3.2 Atualizar o cron job no banco para enviar a service_role_key

O cron job atual envia a anon key hardcoded. Precisa ser atualizado para enviar a service_role_key do vault.

**Rodar no SQL Editor do Supabase:**

```sql
-- Primeiro, garantir que a service_role_key esta no vault
-- (se ja estiver, esse INSERT vai dar erro — ignore)
SELECT vault.create_secret(
  'service_role_key',
  '<SUA_SERVICE_ROLE_KEY_AQUI>'
);
```

> **IMPORTANTE:** Substitua `<SUA_SERVICE_ROLE_KEY_AQUI>` pela sua service role key real.
> Voce encontra no Supabase Dashboard > Settings > API > service_role key.

Depois, atualizar o cron job:

```sql
-- Remover o cron job antigo (com JWT hardcoded)
SELECT cron.unschedule('google-calendar-sync-every-30m');

-- Criar novo cron job que busca a key do vault
SELECT cron.schedule(
  'google-calendar-sync-every-30m',
  '*/30 * * * *',
  $$
  SELECT
    net.http_post(
      url := 'https://ldbdtakddxznfridsarn.supabase.co/functions/v1/google-calendar-sync-cron',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (
          SELECT decrypted_secret FROM vault.decrypted_secrets
          WHERE name = 'service_role_key' LIMIT 1
        )
      ),
      body := '{}'::jsonb
    );
  $$
);
```

### 3.3 Verificar se o cron job foi criado

```sql
SELECT jobname, schedule, command FROM cron.job
WHERE jobname = 'google-calendar-sync-every-30m';
```

**Esperado:** 1 row com o novo comando que usa `vault.decrypted_secrets`.

---

## PASSO 4 — Revogar acesso `authenticated` nas funcoes de token OAuth

### 4.1 Rodar no SQL Editor do Supabase

Copie e cole **tudo de uma vez**:

```sql
-- =============================================
-- REVOGAR ACESSO AUTHENTICATED NAS FUNCOES DE TOKEN
-- Essas funcoes so devem ser chamadas pelo service_role
-- =============================================

-- Verificar quais funcoes existem antes de revogar
DO $$
BEGIN
  -- get_refresh_token
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'get_refresh_token') THEN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.get_refresh_token(uuid) FROM authenticated';
    RAISE NOTICE 'REVOKED: get_refresh_token';
  END IF;

  -- get_access_token
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'get_access_token') THEN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.get_access_token(uuid) FROM authenticated';
    RAISE NOTICE 'REVOKED: get_access_token';
  END IF;

  -- get_google_tokens
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'get_google_tokens') THEN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.get_google_tokens(uuid) FROM authenticated';
    RAISE NOTICE 'REVOKED: get_google_tokens';
  END IF;

  -- store_refresh_token
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'store_refresh_token') THEN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.store_refresh_token(uuid, text) FROM authenticated';
    RAISE NOTICE 'REVOKED: store_refresh_token';
  END IF;

  -- store_access_token
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'store_access_token') THEN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.store_access_token(uuid, text, timestamptz) FROM authenticated';
    RAISE NOTICE 'REVOKED: store_access_token';
  END IF;

  -- store_google_connection (pode ter assinatura diferente)
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'store_google_connection') THEN
    -- Revogar de todas as overloads
    FOR r IN SELECT oid::regprocedure::text as sig FROM pg_proc
              WHERE proname = 'store_google_connection' AND pronamespace = 'public'::regnamespace
    LOOP
      EXECUTE 'REVOKE EXECUTE ON FUNCTION ' || r.sig || ' FROM authenticated';
      RAISE NOTICE 'REVOKED: %', r.sig;
    END LOOP;
  END IF;
END $$;
```

### 4.2 Verificar se funcionou

```sql
-- Deve retornar ZERO linhas para essas funcoes com grantee = 'authenticated'
SELECT
  routine_name,
  grantee,
  privilege_type
FROM information_schema.routine_privileges
WHERE routine_schema = 'public'
  AND routine_name IN (
    'get_refresh_token',
    'get_access_token',
    'get_google_tokens',
    'store_refresh_token',
    'store_access_token',
    'store_google_connection'
  )
  AND grantee = 'authenticated';
```

**Esperado:** 0 rows (nenhum acesso de `authenticated`).

---

## PASSO 5 — Remover JWT hardcoded do cron job

> **Nota:** Se voce ja fez o Passo 3.2 (atualizar o cron job), esse passo ja esta feito. Confirme abaixo.

### 5.1 Verificar que o cron job nao tem mais JWT hardcoded

```sql
SELECT jobname, command FROM cron.job
WHERE command LIKE '%eyJ%';
```

**Esperado:** 0 rows. Se retornar algum, o cron job antigo ainda existe. Remova com:

```sql
SELECT cron.unschedule('nome_do_job_aqui');
```

### 5.2 Verificar se existem OUTROS cron jobs com tokens hardcoded

```sql
SELECT jobname, command FROM cron.job;
```

Inspecione cada um. Se algum tiver `eyJ...` no comando, atualize para usar o vault.

---

## PASSO 6 — DROP trigger sync_profile_to_auth

### 6.1 Rodar no SQL Editor do Supabase

```sql
-- Remover trigger e funcao que nao sao mais necessarios
DROP TRIGGER IF EXISTS on_profile_created_sync_auth ON public.profiles;
DROP FUNCTION IF EXISTS public.sync_profile_to_auth();
```

### 6.2 Verificar

```sql
-- Deve retornar 0 rows
SELECT trigger_name FROM information_schema.triggers
WHERE event_object_table = 'profiles'
  AND trigger_name = 'on_profile_created_sync_auth';
```

**Esperado:** 0 rows.

---

## PASSO 7 — Deploy e Teste

### 7.1 Deploy das edge functions

```bash
cd supabase

# Deploy cada funcao alterada
supabase functions deploy delete-account --project-ref ldbdtakddxznfridsarn
supabase functions deploy check-email-exists --project-ref ldbdtakddxznfridsarn
supabase functions deploy google-calendar-sync-cron --project-ref ldbdtakddxznfridsarn
```

### 7.2 Testes de verificacao

**Teste 1 — delete-account rejeita sem JWT:**

```bash
curl -X POST \
  'https://ldbdtakddxznfridsarn.supabase.co/functions/v1/delete-account' \
  -H 'Content-Type: application/json' \
  -d '{"user_id": "test", "created_at": "2026-01-01"}'
```

**Esperado:** `401` com `"Token de autenticacao ausente"`.

---

**Teste 2 — check-email-exists tem rate limit:**

```bash
# Rodar 11 vezes seguidas:
for i in $(seq 1 11); do
  echo "Request $i:"
  curl -s -X POST \
    'https://ldbdtakddxznfridsarn.supabase.co/functions/v1/check-email-exists' \
    -H 'Content-Type: application/json' \
    -d '{"email": "teste@teste.com"}' | head -1
  echo ""
done
```

**Esperado:** As primeiras 10 retornam `200`, a 11a retorna `429`.

---

**Teste 3 — check-email-exists NAO retorna hasSubscription:**

```bash
curl -s -X POST \
  'https://ldbdtakddxznfridsarn.supabase.co/functions/v1/check-email-exists' \
  -H 'Content-Type: application/json' \
  -d '{"email": "email_de_assinante@real.com"}'
```

**Esperado:** `{"exists": true}` sem campo `hasSubscription`.

---

**Teste 4 — google-calendar-sync-cron rejeita sem auth:**

```bash
curl -X POST \
  'https://ldbdtakddxznfridsarn.supabase.co/functions/v1/google-calendar-sync-cron' \
  -H 'Content-Type: application/json' \
  -d '{}'
```

**Esperado:** `401` com `"Unauthorized"`.

---

**Teste 5 — Funcoes de token nao acessiveis:**

Rodar no SQL Editor:

```sql
-- Simular chamada como usuario autenticado
SET ROLE authenticated;
SELECT public.get_google_tokens('00000000-0000-0000-0000-000000000000'::uuid);
```

**Esperado:** `ERROR: permission denied for function get_google_tokens`.

Depois:

```sql
-- Voltar ao role normal
RESET ROLE;
```

---

**Teste 6 — Trigger sync_profile_to_auth removido:**

```sql
SELECT trigger_name FROM information_schema.triggers
WHERE trigger_name = 'on_profile_created_sync_auth';
```

**Esperado:** 0 rows.

---

**Teste 7 — Cron job sem JWT hardcoded:**

```sql
SELECT jobname, command FROM cron.job WHERE command LIKE '%eyJ%';
```

**Esperado:** 0 rows.

---

**Teste 8 — Cron job funciona com vault:**

Aguarde a proxima execucao do cron (a cada 30 min) ou force manualmente:

```bash
curl -X POST \
  'https://ldbdtakddxznfridsarn.supabase.co/functions/v1/google-calendar-sync-cron' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer <SUA_SERVICE_ROLE_KEY>' \
  -d '{}'
```

**Esperado:** `200` com `{"success": true, ...}`.

---

## CHECKLIST FINAL

| # | Item | Status |
|---|------|--------|
| 1 | delete-account exige JWT | [ ] |
| 2 | delete-account so permite deletar propria conta | [ ] |
| 3 | check-email-exists tem rate limit (10/min) | [ ] |
| 4 | check-email-exists NAO retorna hasSubscription | [ ] |
| 5 | google-calendar-sync-cron exige auth | [ ] |
| 6 | Funcoes de token revogadas para `authenticated` | [ ] |
| 7 | Cron job sem JWT hardcoded | [ ] |
| 8 | service_role_key no vault | [ ] |
| 9 | Trigger sync_profile_to_auth removido | [ ] |
| 10 | Funcao sync_profile_to_auth removida | [ ] |
| 11 | Todos os 3 deploys feitos | [ ] |
| 12 | Todos os 8 testes passaram | [ ] |

---

## TROUBLESHOOTING

### "Error: function get_google_tokens(uuid) does not exist"
A funcao pode ter assinatura diferente. Rode:
```sql
SELECT proname, proargtypes::regtype[] FROM pg_proc WHERE proname = 'get_google_tokens';
```
E ajuste o REVOKE com a assinatura correta.

### "Cron job nao consegue ler vault.decrypted_secrets"
O pg_cron roda como superuser, entao deveria ter acesso. Se nao funcionar:
```sql
GRANT SELECT ON vault.decrypted_secrets TO postgres;
```

### "delete-account retorna 401 mesmo com JWT"
Verifique se o frontend esta enviando `Authorization: Bearer <token>`. Se usa `supabase.functions.invoke()`, o JWT e enviado automaticamente quando `verify_jwt = true` no config.toml.

### "check-email-exists: rate limit nao funciona"
O rate limiting e in-memory na edge function. Cada cold start reseta o contador. Em producao, o Supabase pode ter multiplas instancias. Para rate limiting persistente, use a tabela no banco (como `start-otp-login` faz com RPC `check_rate_limit`).

### "Frontend quebrou depois do deploy"
Se algo parar de funcionar, reverta temporariamente:
```toml
[functions.delete-account]
verify_jwt = false
```
E faca redeploy. Investigue o problema com calma.
