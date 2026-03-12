# DIAGNOSTICO COMPLETO DE SEGURANCA — Total Assistente

**Data:** 2026-03-12
**Executor:** GetAmaral + Claude (AI)
**Escopo:** Edge Functions, Migrations SQL, Frontend, Config, Infraestrutura

---

## RESUMO EXECUTIVO

| Severidade | Quantidade |
|-----------|-----------|
| CRITICO   | 6         |
| ALTO      | 12        |
| MEDIO     | 11        |
| BAIXO     | 5         |
| **Total** | **34**    |

---

## CRITICO (6)

### C1. delete-account sem autenticacao — qualquer pessoa pode deletar contas

**Arquivo:** `supabase/functions/delete-account/index.ts`
**Problema:** A funcao aceita `user_id` e `created_at` no body sem JWT. A unica "protecao" e verificar se `created_at` bate dentro de 5 minutos — facilmente adivinhavel.
**Impacto:** Um atacante pode deletar contas de usuarios recem-criados sabendo apenas o UUID.

**Solucao:**
```typescript
// Adicionar depois do check de OPTIONS:
const authHeader = req.headers.get('Authorization');
if (!authHeader) return json(401, { error: 'Unauthorized' });

const token = authHeader.replace('Bearer ', '');
const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
if (authError || !user) return json(401, { error: 'Invalid token' });

// Depois, validar que user.id === user_id do body
if (user_id !== user.id) return json(403, { error: 'Forbidden' });
```

---

### C2. check-email-exists sem autenticacao — enumeracao de usuarios + vazamento de subscription

**Arquivo:** `supabase/functions/check-email-exists/index.ts`
**Problema:** Sem autenticacao, sem rate limiting. Retorna `{ exists: true, hasSubscription: true }` — revela quem paga.
**Impacto:** Atacante enumera todos os emails e descobre quem tem assinatura ativa (phishing direcionado, venda de listas).

**Solucao:**
```typescript
// 1. Adicionar rate limiting (igual ao start-otp-login)
// 2. REMOVER hasSubscription da resposta:
// Linha ~93 — substituir:
return new Response(
  JSON.stringify({ exists: true, hasSubscription: true }),
  ...
);
// Por:
return new Response(
  JSON.stringify({ exists: true }),
  ...
);
```

---

### C3. google-calendar-sync-cron sem autenticacao — qualquer pessoa pode disparar sync global

**Arquivo:** `supabase/functions/google-calendar-sync-cron/index.ts`
**Problema:** Cron job que sincroniza TODOS os usuarios. Sem nenhuma autenticacao. Qualquer pessoa pode chamar a URL repetidamente.
**Impacto:** DoS — sobrecarga no Google API, banco de dados, e consumo de cota de funcoes.

**Solucao:**
```typescript
// Adicionar no inicio do handler, depois do CORS:
const authHeader = req.headers.get('authorization');
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
if (!authHeader || authHeader !== `Bearer ${serviceKey}`) {
  return new Response(JSON.stringify({ error: 'Unauthorized' }), {
    status: 401,
    headers: { ...cors, 'Content-Type': 'application/json' }
  });
}
```

---

### C4. JWT anon key hardcoded em migrations SQL

**Arquivos:**
- `migrations/20260219130000_schedule_google_calendar_cron.sql` (linha 21)
- `migrations/20260122183459_e8d0b711-...sql` (linha 20)

**Problema:** O token JWT anon key esta escrito em texto puro no SQL. Visivel no repositorio, nos backups, e na tabela `cron.job`.

**Token exposto:**
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIs
InJlZiI6ImxkYmR0YWtkZHh6bmZyaWRzYXJuIiwicm9sZSI6ImFub24iLC...
```

**Solucao:** Criar nova migration que busca do Vault:
```sql
-- Atualizar o cron job para buscar a key do vault
SELECT cron.schedule(
  'google-calendar-sync-every-30m',
  '*/30 * * * *',
  $$
  SELECT extensions.http_post(
    url := 'https://ldbdtakddxznfridsarn.supabase.co/functions/v1/google-calendar-sync-cron',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (
        SELECT decrypted_secret FROM vault.decrypted_secrets
        WHERE name = 'service_role_key' LIMIT 1
      )
    ),
    body := '{}'::jsonb
  )
  $$
);
```

---

### C5. Funcoes de token OAuth acessiveis pelo role `authenticated`

**Arquivo:** `migrations/20250912210505_e9900323-...sql` (linhas 135-140)
**Problema:** `get_refresh_token`, `get_access_token`, `get_google_tokens`, `store_refresh_token`, `store_access_token`, `store_google_connection` tem `GRANT EXECUTE TO authenticated`. Qualquer usuario autenticado pode chamar passando o UUID de OUTRO usuario e obter/modificar tokens OAuth alheios.
**Impacto:** Roubo de tokens Google de qualquer usuario do sistema.

**Solucao:**
```sql
-- Revogar acesso do role authenticated
REVOKE EXECUTE ON FUNCTION public.get_refresh_token(uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.get_access_token(uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.get_google_tokens(uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.store_refresh_token(uuid, text) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.store_access_token(uuid, text, timestamptz) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.store_google_connection(uuid, text, text, timestamptz, text, text) FROM authenticated;

-- OU adicionar verificacao dentro de cada funcao:
-- IF auth.uid() != p_user_id THEN
--   RAISE EXCEPTION 'Unauthorized';
-- END IF;
```

---

### C6. Chave de criptografia `google_calendar_secret_key_2024` hardcoded em 8+ migrations

**Arquivos afetados:**
- `20250911192705_...sql`, `20250911192936_...sql`, `20250911192435_...sql`
- `20250911192627_...sql`, `20250911192746_...sql`, `20250912210505_...sql`
- `20251210034757_...sql`, `20250928031805_...sql`

**Problema:** A chave de criptografia dos tokens Google esta em texto puro nos arquivos de migration. Quem tiver acesso ao repo pode descriptografar todos os tokens.
**Nota:** As funcoes em producao ja foram atualizadas para ler da `app_config` (feito no TIER 0). Porem a chave antiga permanece visivel no historico Git.

**Solucao:**
1. Confirmar que NENHUMA funcao ativa ainda usa esta chave (Bloco D ja foi feito)
2. Considerar rotacionar a chave novamente se o repositorio for publico ou tiver muitos colaboradores
3. As migrations em si nao podem ser alteradas (historico), mas garanta que nenhum codigo ativo referencia a chave

---

## ALTO (12)

### A1. Service role key usada como Bearer token entre funcoes

**Arquivo:** `supabase/functions/google-calendar-sync-cron/index.ts` (linhas 94-96)
**Arquivo:** `supabase/functions/google-calendar/index.ts` (linha 138)
**Problema:** O cron envia `Authorization: Bearer ${serviceRoleKey}` e o google-calendar aceita com `if (token === supabaseServiceRoleKey)`. A service role key trafega como header HTTP.
**Impacto:** Se logs registrarem headers, a chave mais poderosa do sistema fica exposta.

**Solucao:** Criar um `CRON_SECRET` dedicado no Supabase e usa-lo no lugar da service role key para comunicacao entre funcoes.

---

### A2. Comparacao de tokens nao e constant-time (timing attack)

**Arquivos afetados:**
- `hotmart-webhook/index.ts` linha 36: `hottok === secret`
- `create-user-admin/index.ts` linha 28: `authHeader !== \`Bearer ${adminSecret}\``
- `google-calendar/index.ts` linha 138: `token === supabaseServiceRoleKey`

**Problema:** Comparacao padrao de string retorna em tempo variavel. Atacante pode descobrir o token byte a byte medindo tempos.
**Impacto:** Extracao de HOTMART_HOTTOK, ADMIN_API_SECRET, ou service role key.

**Solucao para cada um:**
```typescript
// Funcao utilitaria para comparacao constant-time:
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

// Usar em cada comparacao:
// hotmart: timingSafeEqual(hottok, secret)
// create-user-admin: timingSafeEqual(authHeader, `Bearer ${adminSecret}`)
// google-calendar: timingSafeEqual(token, cronSecret)
```

---

### A3. unlink-phone — deleta telefone de qualquer usuario

**Arquivo:** `supabase/functions/unlink-phone/index.ts` (linhas 62-65)
**Problema:** O delete filtra apenas por `phone`, sem verificar `user_id`. Usuario A pode desvincular o WhatsApp do usuario B.

**Solucao:**
```typescript
// Substituir:
const { error: deleteError } = await supabaseAdmin
  .from("phones_whatsapp")
  .delete()
  .eq("phone", cleanedPhone);
// Por:
const { error: deleteError } = await supabaseAdmin
  .from("phones_whatsapp")
  .delete()
  .eq("phone", cleanedPhone)
  .eq("user_id", user.id);
```

---

### A4. RLS policy USING(true) sem restricao de role — webhook_events_log

**Arquivo:** `migrations/20251026023823_...sql` (linhas 43-47)
**Problema:** Policy com `USING(true)` e `WITH CHECK(true)` sem `TO service_role`. Qualquer role (incluindo `anon`) pode ler/escrever logs de webhook com dados de pagamento.

**Solucao:**
```sql
DROP POLICY IF EXISTS "Only service role can access webhook logs" ON public.webhook_events_log;
CREATE POLICY "Block public access to webhook logs" ON public.webhook_events_log
  FOR ALL TO public USING (false) WITH CHECK (false);
-- service_role bypassa RLS automaticamente
```

---

### A5. RLS policy USING(true) — calendar_vip

**Arquivo:** `migrations/20251210142413_...sql` (linhas 37-41)
**Problema:** Tabela `calendar_vip` com `USING(true)` sem restricao de role.

**Solucao:**
```sql
DROP POLICY IF EXISTS "Service role full access on calendar_vip" ON public.calendar_vip;
CREATE POLICY "Block all public access to calendar_vip" ON public.calendar_vip
  FOR ALL TO public USING (false) WITH CHECK (false);
```

---

### A6. SECURITY DEFINER sem SET search_path (2 funcoes ativas)

**Arquivos:**
- `migrations/20250927221613_...sql` linha 117: `sync_subscription_with_profile()`
- `migrations/20251031211834_...sql` linha 32: `cleanup_expired_2fa_sessions()`

**Problema:** Funcoes SECURITY DEFINER sem `SET search_path` sao vulneraveis a search_path hijacking.

**Solucao:**
```sql
-- Para sync_subscription_with_profile:
CREATE OR REPLACE FUNCTION public.sync_subscription_with_profile()
RETURNS TRIGGER LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$ ... $$;

-- Para cleanup_expired_2fa_sessions:
CREATE OR REPLACE FUNCTION public.cleanup_expired_2fa_sessions()
RETURNS void LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$ ... $$;
```

---

### A7. sync_profile_to_auth — versao insegura sobrescreve versao segura

**Arquivo:** `migrations/20260122183459_...sql` substitui a versao com Vault (`20260122183153_...sql`) por uma com JWT hardcoded.
**Problema:** A migration mais recente usa anon key (insuficiente para auth.users) e `net.http_post` (nao existe, deveria ser `extensions.http_post`).
**Nota:** Este trigger ja deveria ter sido removido (Passo 3 do TIER 0). Rodar:

```sql
DROP TRIGGER IF EXISTS on_profile_created_sync_auth ON public.profiles;
DROP FUNCTION IF EXISTS public.sync_profile_to_auth();
```

---

### A8. Vazamento de erros internos em 6+ funcoes

**Funcoes afetadas:**
- `google-calendar/index.ts` (linhas 194, 269, 384, 425, 462, 533, 545, 874)
- `google-calendar-webhook/index.ts` (linha 84)
- `google-calendar-sync-cron/index.ts` (linha 131)
- `fetch-market-data/index.ts` (linhas 245-248)

**Problema:** `(error as Error).message` retornado ao cliente. Vaza nomes de tabelas, mensagens do Google API, paths internos.

**Solucao:** Substituir por mensagens genericas:
```typescript
// Substituir em cada funcao:
return new Response(JSON.stringify({ error: (error as Error).message }), ...);
// Por:
return new Response(JSON.stringify({ error: 'Erro interno' }), ...);
```

---

### A9. Funcoes ausentes no config.toml

**Arquivo:** `supabase/config.toml`
**Problema:** `check-email-exists` e `unlink-phone` nao estao listadas no config.toml. O Supabase pode aplicar configuracao padrao imprevisivel.

**Solucao:** Adicionar ao config.toml:
```toml
[functions.check-email-exists]
verify_jwt = false

[functions.unlink-phone]
verify_jwt = true
```

---

### A10. verify_jwt = false em funcoes que atendem usuarios autenticados

**Arquivo:** `supabase/config.toml`
**Problema:** `delete-account`, `google-calendar`, `create-checkout`, `fetch-market-data` deveriam exigir JWT.

**Solucao:**
```toml
[functions.google-calendar]
verify_jwt = true

[functions.delete-account]
verify_jwt = true

[functions.create-checkout]
verify_jwt = true
```
**Nota:** `fetch-market-data` pode ficar sem JWT se for endpoint publico intencional. `start-otp-login` e `verify-otp-secure` precisam de `verify_jwt = false` (pre-autenticacao).

---

### A11. Ausencia de .dockerignore

**Arquivo:** Dockerfile (linha 14: `COPY . .`)
**Problema:** Sem `.dockerignore`, o `.env.local` e copiado para a imagem Docker de build. Embora o multi-stage so copie `dist/`, o `.env.local` fica na camada intermediaria.

**Solucao:** Criar `/home/totalAssistente/site/.dockerignore`:
```
.env*
.git
node_modules
supabase
```

---

### A12. Webhook Google Calendar sem verificacao criptografica

**Arquivo:** `supabase/functions/google-calendar-webhook/index.ts` (linhas 41-63)
**Problema:** Valida webhook apenas por headers `x-goog-channel-id` e `x-goog-resource-id` contra o banco. Sem token secreto.

**Solucao:** Adicionar `token` no setup do webhook e verificar no handler:
```typescript
// No setup (google-calendar/index.ts):
// Adicionar ao body do watch: token: Deno.env.get('GOOGLE_WEBHOOK_SECRET')

// No handler (google-calendar-webhook/index.ts):
const webhookToken = req.headers.get('x-goog-channel-token');
const expected = Deno.env.get('GOOGLE_WEBHOOK_SECRET');
if (!expected || webhookToken !== expected) {
  return new Response('Forbidden', { status: 403, headers: cors });
}
```

---

## MEDIO (11)

### M1. OAuth state sem CSRF token no Google Calendar

**Arquivo:** `supabase/functions/google-calendar/index.ts` (linhas 30-47)
**Problema:** O `state` do OAuth contem apenas `userId` + `origin` em base64. Sem nonce. Atacante pode criar link OAuth com `userId` de outra pessoa.
**Solucao:** Adicionar `nonce: crypto.randomUUID()` ao state e validar no callback contra o banco.

---

### M2. Log de dados pessoais no hotmart-webhook (LGPD)

**Arquivo:** `supabase/functions/hotmart-webhook/index.ts` (linhas 193-201)
**Problema:** Loga payload cru (nome, email, telefone, CPF do comprador).
**Solucao:** Remover email e phone dos logs. Manter apenas event, transactionId, product, timestamp.

---

### M3. SSRF potencial via parametro symbol no fetch-market-data

**Arquivo:** `supabase/functions/fetch-market-data/index.ts` (linhas 140-141)
**Problema:** `symbol` inserido diretamente na URL `brapi.dev/api/quote/${symbol}` sem validacao.
**Solucao:**
```typescript
if (!/^[A-Z]{3,6}\d{1,2}$/.test(symbol.toUpperCase())) {
  return new Response(JSON.stringify({ error: "Ticker inválido" }), { status: 400, ... });
}
```

---

### M4. Salt estatico `_salt_2024` no hash de IP

**Arquivos:** `start-otp-login/index.ts` (linha 20), `verify-otp-secure/index.ts` (linha 20)
**Problema:** Salt hardcoded no codigo.
**Solucao:** `Deno.env.get('HASH_SALT') || '_fallback_salt'`

---

### M5. CSP com `unsafe-inline` e `unsafe-eval`

**Arquivo:** `nginx.conf` (linha 183)
**Problema:** Permite execucao de scripts inline e `eval()`, enfraquecendo protecao XSS.
**Solucao:** Testar sem `unsafe-eval`. Migrar para nonces para scripts inline.

---

### M6. Falta `Access-Control-Allow-Methods` nos headers CORS

**Arquivos:** Todas as edge functions.
**Problema:** Nao restringe metodos HTTP permitidos.
**Solucao:** Adicionar `'Access-Control-Allow-Methods': 'POST, OPTIONS'` no `getCorsHeaders()`.

---

### M7. Trigger sync_calendar_event_to_google sem fallback se vault vazio

**Arquivo:** `migrations/20260210000000_google_calendar_bidirectional_sync.sql` (linha 97)
**Problema:** Se `v_service_role_key` for NULL, envia request com Bearer vazio.
**Solucao:**
```sql
IF v_service_role_key IS NULL THEN
  RAISE WARNING 'service_role_key not found in vault';
  RETURN COALESCE(NEW, OLD);
END IF;
```

---

### M8. URLs do Supabase inconsistentes entre migrations

**Problema:** Duas instancias referenciadas: `fybwkixrpbguvlxcgnoc` e `ldbdtakddxznfridsarn`.
**Solucao:** Verificar qual e producao e padronizar. Idealmente armazenar URL no vault.

---

### M9. Validacao de forca de senha ausente no create-user-admin

**Arquivo:** `supabase/functions/create-user-admin/index.ts` (linhas 37-42)
**Problema:** Aceita senhas de 1 caractere.
**Solucao:**
```typescript
if (password.length < 8) {
  return new Response(
    JSON.stringify({ error: "Senha deve ter no mínimo 8 caracteres" }),
    { status: 400, headers: { ...cors, "Content-Type": "application/json" } }
  );
}
```

---

### M10. dangerouslySetInnerHTML em 2 componentes React

**Arquivos:** `src/components/ui/chart.tsx` (linha 79), `src/components/AnimatedChatMessages.tsx` (linha 93)
**Problema:** Injeta CSS via `dangerouslySetInnerHTML`. Atualmente seguro (dados internos), mas risco futuro.
**Solucao:** Documentar que conteudo e confiavel, ou migrar para CSS-in-JS.

---

### M11. Service role key no module scope do create-checkout

**Arquivo:** `supabase/functions/create-checkout/index.ts` (linhas 17-20)
**Problema:** Client Supabase criado com `SUPABASE_SERVICE_ROLE_KEY` no escopo do modulo. Se reutilizado para outra operacao, tem privilegios totais.
**Solucao:** Usar `SUPABASE_ANON_KEY` para verificar o JWT do usuario, e criar client com service role apenas quando necessario.

---

## BAIXO (5)

### B1. CORS fallback retorna origin valida para requests sem Origin

**Problema:** Quando `Origin` ausente, retorna `ALLOWED_ORIGINS[0]`. Requests de curl/ferramentas recebem CORS valido.
**Solucao:** Retornar string vazia se origin nao bater.

---

### B2. Arquivo temporario do Vite no repositorio

**Arquivo:** `vite.config.ts.timestamp-1770749673341-...mjs`
**Solucao:** Adicionar `*.timestamp-*` ao `.gitignore`.

---

### B3. Tabela/funcoes VIP possivelmente orfas

**Problema:** `vip_google_connections`, `store_vip_google_connection`, `get_vip_google_tokens` ainda existem no banco com chave antiga.
**Solucao (se VIP nao esta em uso):**
```sql
DROP FUNCTION IF EXISTS public.store_vip_google_connection(text, text, text, timestamptz, text);
DROP FUNCTION IF EXISTS public.get_vip_connection_status(text);
DROP FUNCTION IF EXISTS public.get_vip_google_tokens(text);
DROP TABLE IF EXISTS public.vip_google_connections;
```

---

### B4. Erros retornados com status 400 para rate limit (deveria ser 429)

**Arquivo:** `start-otp-login/index.ts` (linhas 162-174)
**Solucao:** Retornar status 429 (Too Many Requests) quando rate limit e atingido.

---

### B5. Bug no legacy support do fetch-market-data

**Arquivo:** `supabase/functions/fetch-market-data/index.ts` (linhas 224-232)
**Problema:** Bloco legacy tenta chamar `serve()` recursivamente, que e a funcao de inicializacao do servidor, nao o handler.
**Solucao:** Remover ou reimplementar o bloco legacy.

---

## O QUE ESTA BEM FEITO

| Item | Status |
|------|--------|
| CORS restritivo com whitelist de origins | OK |
| `.gitignore` cobre `.env.local` | OK |
| Service role key apenas no server-side | OK |
| Logger com sanitizacao de dados sensiveis | OK |
| DOMPurify para sanitizacao de inputs | OK |
| Rate limiting no login OTP (IP + email) | OK |
| Nginx com security headers (HSTS, X-Frame-Options, etc.) | OK |
| Hotmart webhook com verificacao de token | OK |
| Nenhum secret hardcoded no frontend | OK |
| Dependencies legitimas no package.json | OK |
| create-user-admin protegido com ADMIN_API_SECRET | OK |
| Tokens criptografados com chave nova no app_config | OK |

---

## PLANO DE ACAO POR PRIORIDADE

### Onda 1 — Imediato (CRITICO)

| # | Acao | Onde |
|---|------|------|
| 1 | Adicionar autenticacao JWT ao `delete-account` | Edge Function |
| 2 | Adicionar rate limiting ao `check-email-exists` + remover `hasSubscription` | Edge Function |
| 3 | Adicionar autenticacao ao `google-calendar-sync-cron` | Edge Function |
| 4 | Revogar `EXECUTE` de `authenticated` nas funcoes de token OAuth | SQL Editor |
| 5 | Mover JWT do cron job para Vault | SQL Editor |
| 6 | Rodar `DROP TRIGGER/FUNCTION sync_profile_to_auth` se ainda nao feito | SQL Editor |

### Onda 2 — Urgente (ALTO)

| # | Acao | Onde |
|---|------|------|
| 7 | Implementar comparacao constant-time nos 3 pontos | Edge Functions |
| 8 | Parar de usar service role key como Bearer token | Edge Functions |
| 9 | Corrigir `unlink-phone` para filtrar por `user_id` | Edge Function |
| 10 | Corrigir RLS de `webhook_events_log` e `calendar_vip` | SQL Editor |
| 11 | Adicionar `SET search_path` nas 2 funcoes SECURITY DEFINER | SQL Editor |
| 12 | Sanitizar mensagens de erro em 6+ funcoes | Edge Functions |
| 13 | Criar `.dockerignore` | Arquivo |
| 14 | Habilitar `verify_jwt = true` para funcoes autenticadas | config.toml |
| 15 | Adicionar funcoes ausentes ao config.toml | config.toml |
| 16 | Adicionar token secreto ao webhook do Google Calendar | Edge Function |

### Onda 3 — Medio prazo

| # | Acao | Onde |
|---|------|------|
| 17 | CSRF token no fluxo OAuth | Edge Function |
| 18 | Remover dados pessoais dos logs do hotmart | Edge Function |
| 19 | Validar formato de ticker (SSRF) | Edge Function |
| 20 | Mover salt para env var | Edge Functions |
| 21 | Remover `unsafe-eval` da CSP | nginx.conf |
| 22 | Adicionar `Access-Control-Allow-Methods` | Edge Functions |
| 23 | Fallback de vault no trigger de sync | SQL |
| 24 | Padronizar URLs do Supabase | SQL |
| 25 | Validacao de forca de senha | Edge Function |

### Onda 4 — Limpeza

| # | Acao | Onde |
|---|------|------|
| 26 | CORS sem fallback para origin invalido | Edge Functions |
| 27 | Remover arquivo temporario do Vite | .gitignore |
| 28 | Limpar tabelas/funcoes VIP se nao usadas | SQL |
| 29 | Corrigir status 429 no rate limit | Edge Function |
| 30 | Remover/corrigir legacy support no fetch-market-data | Edge Function |

---

## REFERENCIA CRUZADA COM TIER 0

| Item TIER 0 | Status |
|-------------|--------|
| Passo 1 — CORS | CONCLUIDO |
| Passo 2 — create-user-admin | CONCLUIDO |
| Passo 3 — sync-profile-to-auth (edge function removida, **trigger pendente no SQL**) | PARCIAL |
| Passo 4 — vip-google-connect (edge function removida, **tabela/funcoes VIP no banco**) | PARCIAL |
| Passo 5 — Rotacao de chave | CONCLUIDO |
| Passo 5.4 Bloco D — Funcoes SQL com chave antiga | CONCLUIDO |
| Passo 6 — Verificacao final | ESTE DOCUMENTO |
