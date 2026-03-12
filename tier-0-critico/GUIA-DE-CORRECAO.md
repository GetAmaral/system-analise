# GUIA DE CORRECAO TIER 0 — Passo a Passo (v2 - Corrigido)

**O que e este documento:** Um guia pratico, na ordem certa, para fechar as 5 portas abertas do seu sistema antes de lancar. Cada passo explica o PORQUE, o QUE fazer, e COMO fazer.

**IMPORTANTE:** Este guia e para VOCE executar manualmente. Ninguem vai alterar nada automaticamente. Leia tudo antes de comecar, entenda o que cada passo faz, e so execute quando se sentir confortavel.

**Tempo estimado:** ~3-4 horas se seguir na ordem.

**Ferramentas necessarias:**
- Acesso ao **Supabase Dashboard** (https://supabase.com/dashboard)
- Editor de codigo (VS Code, Cursor, etc.)
- Terminal com acesso ao servidor
- **Acesso ao painel N8N** (para Passo 5)

---

> **CHANGELOG v2 (2026-03-11 — Sherlock):**
>
> - **[CRITICO]** Passo 5 agora inclui atualizacao obrigatoria de 5 nodes em 2 workflows N8N que passavam a chave antiga hardcoded
> - **[CRITICO]** Passo 5 agora inclui criacao da funcao `decrypt_token_json` que os workflows N8N chamam via RPC (nao existia nas migrations)
> - **[CRITICO]** Passo 5 reordenado: agora desativa workflows N8N ANTES de re-criptografar (evita corrida de condicao)
> - **[ALTA]** Passo 1 CORS: adicionadas funcoes faltantes (`kiwify-webhook`, `unlink-phone`)
> - **[ALTA]** Passo 1 CORS: adicionado aviso sobre URLs de desenvolvimento e template especifico para webhooks com headers extras
> - **[ALTA]** Passo 1 CORS: template especifico para `hotmart-webhook` (header `x-hotmart-hottok`) e `google-calendar-webhook` (headers `x-goog-*`)
> - **[MEDIA]** Passo 3: adicionada explicacao de que hotmart-webhook faz INSERT em profiles e o trigger dispara, mas nao ha dependencia
> - **[MEDIA]** Passo 5: re-criptografia agora em batches de 100 (evita timeout)
> - **[MEDIA]** Passo 6: adicionados testes para workflows N8N (Calendar WebHooks + Lembretes)
> - Removidas funcoes da lista CORS que serao deletadas (create-user-admin, sync-profile-to-auth, vip-google-connect)

---

## Conceitos Basicos (leia antes de comecar)

### O que e uma Edge Function?
Pense como um "mini servidor" que roda na nuvem do Supabase. Quando alguem acessa uma URL como `https://seusite.supabase.co/functions/v1/nome-da-funcao`, essa funcao executa. O problema e que QUALQUER pessoa na internet pode acessar essa URL — a menos que voce coloque um "porteiro" (autenticacao).

### O que e `verify_jwt`?
No arquivo `config.toml`, cada funcao tem `verify_jwt = false`. JWT e como um "cracha digital" que prova que a pessoa esta logada. Quando `verify_jwt = false`, a funcao aceita requests de QUALQUER pessoa, mesmo sem login. E como uma porta sem tranca.

### O que e `service_role_key`?
E a "chave mestra" do Supabase. Quem tem essa chave pode fazer QUALQUER coisa no banco: criar usuarios, ler todos dados, deletar tudo. As edge functions usam essa chave internamente. O perigo e quando funcoes SEM autenticacao usam essa chave — qualquer pessoa ganha poderes de admin.

### O que e CORS?
Quando seu site (`totalassistente.com.br`) faz um request para sua API, o navegador verifica se a API aceita requests daquele site. `Access-Control-Allow-Origin: *` significa "aceito de QUALQUER site". Isso permite que um site malicioso (`hacker.com`) faca requests para sua API como se fosse seu site.

### O que e criptografia e por que a chave importa?
Os tokens Google dos seus usuarios sao criptografados antes de salvar no banco. Criptografia funciona assim: voce pega o dado + uma chave secreta → gera texto embaralhado. Para desembaralhar, precisa da mesma chave. Se a chave esta no codigo-fonte, qualquer pessoa com acesso ao codigo pode desembaralhar TODOS os tokens.

### O que e o N8N e por que importa aqui?
O N8N e sua plataforma de automacao (workflows). Alguns workflows fazem chamadas diretas ao banco Supabase para descriptografar tokens Google. Se a chave de criptografia mudar e o N8N nao for atualizado, esses workflows param de funcionar.

---

## ORDEM DE EXECUCAO

Siga esta ordem. Cada passo depende do anterior estar feito.

```
PASSO 1: Fechar CORS em todas edge functions          (~20 min)
PASSO 2: Proteger create-user-admin com chave secreta    (~10 min)
PASSO 3: Eliminar sync-profile-to-auth + trigger       (~20 min)
PASSO 4: Proteger ou eliminar vip-google-connect       (~15 min)
PASSO 5: Rotacionar chave de criptografia + N8N        (~60 min)  ← ATUALIZADO
PASSO 6: Verificar que tudo funciona                   (~30 min)  ← ATUALIZADO
```

---

## PASSO 1 — Fechar CORS em todas Edge Functions

### Por que?
Hoje, QUALQUER site na internet pode fazer requests para suas funcoes. Isso amplifica todas as outras vulnerabilidades. Vamos restringir para que so o seu site possa chamar.

### O que e CORS na pratica?
Quando voce abre `totalassistente.com.br` e o site faz um request para a API do Supabase, o navegador pergunta ao Supabase: "ei, voce aceita requests deste site?". Se o Supabase responde `*` (qualquer um), o navegador permite. Se responde `totalassistente.com.br`, so permite do seu site.

**IMPORTANTE:** CORS so protege navegadores. Um hacker usando `curl` no terminal ignora CORS. Por isso CORS e uma camada EXTRA, nao a unica protecao.

### Como fazer — Funcoes PADRAO (maioria)

Cada edge function tem este trecho no comeco do arquivo:

```typescript
// ANTES (vulneravel)
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
```

Troque por:

```typescript
// DEPOIS (seguro)
const ALLOWED_ORIGINS = [
  'https://totalassistente.com.br',
  'https://www.totalassistente.com.br',
  // Se voce usa um ambiente de preview/dev, adicione aqui:
  // 'http://localhost:3000',
  // 'https://ignorethissiteavtotal.lovable.app',
];

function getCorsHeaders(req: Request) {
  const origin = req.headers.get('Origin') || '';
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };
}
```

E onde o codigo usa `corsHeaders`, troque por `getCorsHeaders(req)`.

**Exemplo — antes:**
```typescript
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  // ...
  return new Response(JSON.stringify({ success: true }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
});
```

**Exemplo — depois:**
```typescript
serve(async (req) => {
  const cors = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: cors });
  }
  // ...
  return new Response(JSON.stringify({ success: true }), {
    headers: { ...cors, "Content-Type": "application/json" }
  });
});
```

### Como fazer — `hotmart-webhook` (TEMPLATE ESPECIFICO)

O hotmart-webhook precisa do header extra `x-hotmart-hottok`. Use este template:

```typescript
const ALLOWED_ORIGINS = [
  'https://totalassistente.com.br',
  'https://www.totalassistente.com.br',
];

function getCorsHeaders(req: Request) {
  const origin = req.headers.get('Origin') || '';
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-hotmart-hottok',
  };
}
```

### Como fazer — `google-calendar-webhook` (TEMPLATE ESPECIFICO)

O google-calendar-webhook precisa dos headers do Google. Use este template:

```typescript
const ALLOWED_ORIGINS = [
  'https://totalassistente.com.br',
  'https://www.totalassistente.com.br',
];

function getCorsHeaders(req: Request) {
  const origin = req.headers.get('Origin') || '';
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-goog-channel-id, x-goog-resource-id, x-goog-resource-state',
  };
}
```

### Quais arquivos editar

Editar TODOS estes arquivos em `/home/totalAssistente/site/supabase/functions/`:

**Template PADRAO:**
```
check-email-exists/index.ts
create-checkout/index.ts
delete-account/index.ts
fetch-market-data/index.ts
google-calendar/index.ts
google-calendar-sync-cron/index.ts
kiwify-webhook/index.ts
start-otp-login/index.ts
unlink-phone/index.ts
verify-otp-secure/index.ts
```

**Template HOTMART (com x-hotmart-hottok):**
```
hotmart-webhook/index.ts
```

**Template GOOGLE WEBHOOK (com x-goog-*):**
```
google-calendar-webhook/index.ts
```

**NAO editar (serao deletadas nos passos seguintes):**
```
create-user-admin/index.ts        ← deletada no passo 2
sync-profile-to-auth/index.ts     ← deletada no passo 3
vip-google-connect/index.ts       ← deletada no passo 4
```

> **AVISO SOBRE URLs DE DESENVOLVIMENTO:**
> Se voce usa `localhost`, Lovable preview, ou qualquer outro dominio para desenvolvimento,
> adicione esses dominios no array `ALLOWED_ORIGINS`. Sem isso, o CORS vai bloquear seus
> requests durante o desenvolvimento. Voce pode remover depois de lancar.

### Nota sobre webhooks (hotmart, google-calendar-webhook, kiwify)
CORS so afeta **navegadores**. Webhooks sao chamados por servidores (Hotmart, Google, Kiwify), entao CORS nao os bloqueia. Mas aplicar CORS restrito neles nao atrapalha e e boa pratica.

### Como fazer deploy
Apos editar todos os arquivos:
```bash
cd /home/totalAssistente/site
npx supabase functions deploy
```

---

## PASSO 2 — Proteger `create-user-admin` com chave secreta

### Por que?
Esta funcao cria usuarios com email confirmado, sem exigir nenhuma autenticacao. Qualquer pessoa que descubra a URL pode criar contas falsas. A funcao e usada por um sistema externo, entao NAO pode ser deletada — mas PRECISA de protecao.

### Solucao: adicionar verificacao de chave secreta (API key)
Seu sistema externo envia uma chave no header `Authorization`. A funcao verifica se a chave bate. Se nao bater → rejeita com 401.

### Como fazer

**2.1 — Gerar uma chave secreta**

No terminal:
```bash
openssl rand -hex 32
```
Anote o resultado (ex: `a1b2c3d4e5f6...`). Esta sera sua `ADMIN_API_SECRET`.

**2.2 — Salvar como variavel de ambiente no Supabase**

```bash
supabase secrets set ADMIN_API_SECRET="SUA_CHAVE_AQUI"
```

Ou pelo Dashboard: **Project Settings** → **Edge Functions** → **Environment Variables** → adicionar `ADMIN_API_SECRET`.

**2.3 — Adicionar verificacao na funcao**

Abra `/home/totalAssistente/site/supabase/functions/create-user-admin/index.ts`.

Logo DEPOIS da linha `const cors = getCorsHeaders(req);` e do bloco OPTIONS, ANTES do `const { email, password, name, phone } = await req.json();`, adicione:

```typescript
    // Verificar chave secreta — so seu sistema externo conhece
    const authHeader = req.headers.get('authorization');
    const adminSecret = Deno.env.get('ADMIN_API_SECRET');

    if (!adminSecret || authHeader !== `Bearer ${adminSecret}`) {
      return new Response(
        JSON.stringify({ error: "Nao autorizado" }),
        { status: 401, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }
```

> **NOTA:** O arquivo ja corrigido esta disponivel em `edge-functions-cors-fix/create-user-admin.ts` neste repositorio.

**2.4 — Fazer deploy**
```bash
cd /home/totalAssistente/site
npx supabase functions deploy create-user-admin
```

**2.5 — Verificar que rejeita sem chave**
```bash
# SEM chave (deve dar 401):
curl -s -w "\n%{http_code}" -X POST \
  "https://ldbdtakddxznfridsarn.supabase.co/functions/v1/create-user-admin" \
  -H "Content-Type: application/json" \
  -d '{"email": "teste@teste.com", "password": "Test123!"}'
# Esperado: {"error":"Nao autorizado"} + status 401

# COM chave (deve funcionar):
curl -s -w "\n%{http_code}" -X POST \
  "https://ldbdtakddxznfridsarn.supabase.co/functions/v1/create-user-admin" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer SUA_CHAVE_AQUI" \
  -d '{"email": "teste@teste.com", "password": "Test123!"}'
# Esperado: {"success":true,...} + status 200
```

**2.6 — Atualizar seu sistema externo**

No sistema que chama `create-user-admin`, adicione o header:
```
Authorization: Bearer SUA_CHAVE_AQUI
```

A partir de agora, so quem tem a chave consegue criar contas.

---

## PASSO 3 — Eliminar `sync-profile-to-auth` + Trigger

### Por que?
Esta funcao lista TODOS os usuarios do sistema (emails, IDs) sem autenticacao. Alem disso, e chamada automaticamente por um trigger toda vez que um profile e criado.

### Quem usa esta funcao?
**Ninguem diretamente.** Investigacao completa:
- O frontend NAO chama esta funcao (0 resultados no `src/`)
- **Nenhum workflow N8N referencia ela** (0 resultados nos 8 JSONs de producao)

### ATENCAO — Tem um trigger no banco!
Este e o detalhe mais importante. Existe um trigger SQL que chama esta funcao automaticamente:

```sql
-- Migration: 20260122183459
CREATE TRIGGER on_profile_created_sync_auth
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_profile_to_auth();
```

Ou seja: toda vez que um profile novo e criado, o banco faz um HTTP POST para a edge function `sync-profile-to-auth`. Se voce so deletar a funcao sem remover o trigger, o trigger vai gerar erros silenciosos.

### O que este trigger/funcao faz (e por que pode ser eliminado)

O proposito original era: "quando um profile e criado (por exemplo, via Hotmart webhook), garantir que exista um usuario em `auth.users` correspondente."

**Mas isso ja acontece naturalmente:**
1. Quando usuario faz signup normal → `auth.users` e criado primeiro, depois o trigger `on_auth_user_created` cria o profile
2. Quando Hotmart cria profile → o usuario ja vai se cadastrar depois e vincular por phone/email

O sync reverso (profile → auth.users) e uma redundancia que cria mais problemas do que resolve.

> **NOTA v2 — Hotmart Webhook e o Trigger:**
> O `hotmart-webhook` FAZ INSERT na tabela `profiles` quando um comprador novo nao tem profile
> (verificado no codigo-fonte, linhas 291-309). Isso dispara o trigger `on_profile_created_sync_auth`.
>
> **Isso NAO causa problema ao remover o trigger.** O hotmart-webhook nao depende do resultado
> do trigger — ele so precisa do profile + subscription. O usuario criara sua conta `auth.users`
> no primeiro login pelo site. A remocao do trigger e SEGURA.

### Como fazer

**3.1 — Remover o TRIGGER do banco**

Va ao **Supabase Dashboard** → **SQL Editor** e execute:

```sql
-- Remove o trigger que chama a edge function
DROP TRIGGER IF EXISTS on_profile_created_sync_auth ON public.profiles;

-- Remove a funcao SQL que faz o HTTP POST
DROP FUNCTION IF EXISTS public.sync_profile_to_auth();
```

**CUIDADO:** Isso e uma operacao no banco de producao. O comando `DROP TRIGGER` remove a automacao. Se voce errar, nao vai quebrar nada — so vai parar de chamar a funcao (que e exatamente o que queremos).

**3.2 — Remover do config.toml**

Abra `/home/totalAssistente/site/supabase/config.toml` e DELETE:
```toml
[functions.sync-profile-to-auth]
verify_jwt = false
```

**3.3 — Deletar a pasta da funcao**
```bash
rm -rf /home/totalAssistente/site/supabase/functions/sync-profile-to-auth
```

**3.4 — Criar migration para documentar a remocao**
```bash
cd /home/totalAssistente/site
npx supabase migration new remove_sync_profile_trigger
```

Isso cria um arquivo em `supabase/migrations/`. Abra e coloque:
```sql
-- Remove sync-profile-to-auth trigger and function
-- Motivo: funcao expunha listUsers() sem autenticacao (TIER 0 security fix)
DROP TRIGGER IF EXISTS on_profile_created_sync_auth ON public.profiles;
DROP FUNCTION IF EXISTS public.sync_profile_to_auth();
```

**3.5 — Deploy**
```bash
npx supabase functions deploy
npx supabase db push  # aplica a migration
```

**3.6 — Verificar**
```bash
# Funcao nao deve mais existir
curl -X POST "https://ldbdtakddxznfridsarn.supabase.co/functions/v1/sync-profile-to-auth" \
  -H "Content-Type: application/json" \
  -d '{"email": "test@test.com", "profile_id": "123"}'
```
**Esperado:** 404 (funcao removida).

### Bonus: a migration tambem expoe a anon key

Na migration `20260122183459`, linha 20, a **anon key** do Supabase esta em texto claro:
```sql
'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIs...'
```
A anon key nao e secreta (e publica por design no Supabase), mas estar numa migration e desnecessario. Ao deletar o trigger, esse problema desaparece junto.

---

## PASSO 4 — Desabilitar `vip-google-connect`

### Por que?
Qualquer pessoa que saiba um numero de telefone pode:
- Conectar SEU Google ao telefone da vitima
- Ver se qualquer telefone tem Google conectado
- Desconectar o Google de qualquer telefone

### Situacao atual
VIP Calendar **NAO esta em uso**. As tabelas (`calendar_vip`, `vip_google_connections`) ficam quietas no banco — nao causam problema estando la. O que causa problema e a **edge function** que esta acessivel publicamente.

**Verificacao N8N:** Nenhum workflow N8N referencia esta funcao (0 resultados nos 8 JSONs).

### Estrategia: desabilitar a funcao, manter tabelas
Nao vamos deletar tabelas nem RPCs — isso poderia causar efeitos colaterais desnecessarios. Vamos apenas **trancar a porta**: desabilitar a edge function para que ninguem consiga chamar de fora.

### Como fazer

**4.1 — Remover do config.toml**

Abra o arquivo `/home/totalAssistente/site/supabase/config.toml`.
Encontre e DELETE estas 2 linhas:
```toml
[functions.vip-google-connect]
verify_jwt = false
```

**4.2 — Deletar a pasta da funcao**

No terminal:
```bash
rm -rf /home/totalAssistente/site/supabase/functions/vip-google-connect
```

**4.3 — Fazer deploy**
```bash
cd /home/totalAssistente/site
npx supabase functions deploy
```

**4.4 — Verificar**
```bash
curl -s -o /dev/null -w "%{http_code}" \
  "https://ldbdtakddxznfridsarn.supabase.co/functions/v1/vip-google-connect?action=status&phone=5543999999999"
```
**Esperado:** `404` (funcao nao encontrada — porta fechada!).

### O que NAO estamos mexendo (e por que)
- **Tabelas `calendar_vip` e `vip_google_connections`:** Ficam no banco. Nao atrapalham nada e nao tem porta de entrada agora.
- **RPCs `store_vip_google_connection`, `get_vip_connection_status`, `get_vip_google_tokens`:** Ficam no banco. Sem a edge function, ninguem de fora consegue chama-las (elas precisam de `service_role` para executar).
- Se um dia voce quiser usar VIP de novo, basta recriar a edge function COM autenticacao.

---

## PASSO 5 — Rotacionar Chave de Criptografia + Atualizar N8N

> **ATENCAO v2:** Este passo foi SIGNIFICATIVAMENTE reescrito. A versao anterior nao cobria
> os workflows N8N que passam a chave antiga hardcoded. Sem essa correcao, os workflows
> "Calendar WebHooks" e "Lembretes" PARAM DE FUNCIONAR apos a rotacao.

### Por que?
A chave `google_calendar_secret_key_2024` esta em texto claro em 8+ arquivos de migration que estao no repositorio. Qualquer pessoa com acesso ao codigo pode descriptografar TODOS os tokens Google de TODOS os usuarios.

### Conceito: como funciona hoje
```
Token Google (ex: "ya29.a0AfH6...")
    + Chave ("google_calendar_secret_key_2024")
    → SHA256 da chave
    → AES-CBC encrypt
    → Texto embaralhado salvo no banco

Para ler:
Texto embaralhado + mesma chave → Token original
```

Se alguem sabe a chave, pode reverter o processo e obter todos os tokens.

### O que o N8N faz com a chave (DESCOBERTA CRITICA)

Dois workflows N8N chamam a funcao `decrypt_token_json` via REST API passando a chave ANTIGA diretamente:

| Workflow | Nodes afetados | O que faz |
|----------|---------------|-----------|
| **Calendar WebHooks - Total Assistente** | `descriptografar_token_prod`, `descriptografar_token_prod1`, `descriptografar_token_prod2` | Descriptografa refresh tokens para renovar access tokens do Google |
| **Lembretes Total Assistente** | `descriptografar_token_prod`, `descriptografar_token_prod1` | Descriptografa refresh tokens para criar eventos de lembrete no Google Calendar |

Cada node faz um POST para:
```
https://ldbdtakddxznfridsarn.supabase.co/rest/v1/rpc/decrypt_token_json
```
Com body:
```json
{
  "encrypted_token": "{{$json.encrypted_refresh_token}}",
  "key_text": "google_calendar_secret_key_2024"
}
```

**Se voce rotacionar a chave SEM atualizar esses nodes → os workflows PARAM.**

### O plano completo (ordem CRITICA)

```
5.1  Gerar chave nova
5.2  Salvar chave nova como env var no Supabase
5.3  DESATIVAR os 2 workflows N8N afetados (evitar corrida)
5.4  Atualizar funcoes SQL (encrypt_token, decrypt_token, decrypt_token_json)
5.5  Re-criptografar todos tokens existentes
5.6  Verificar que decrypt funciona com nova chave
5.7  Atualizar os 5 nodes nos workflows N8N
5.8  REATIVAR os 2 workflows N8N
5.9  Verificar workflows funcionando
```

### ANTES DE COMECAR O PASSO 5 — Backup de Seguranca

> **IMPORTANTE:** O Passo 5 e o mais arriscado do guia. Se algo der errado na
> re-criptografia, voce pode perder acesso aos tokens Google. Faca este backup ANTES.

**Backup dos tokens atuais:**
```sql
-- No SQL Editor do Supabase, execute:
CREATE TABLE IF NOT EXISTS google_calendar_connections_backup AS
SELECT id, user_id, encrypted_access_token, encrypted_refresh_token
FROM google_calendar_connections
WHERE encrypted_access_token IS NOT NULL;

-- Verificar que o backup tem dados:
SELECT COUNT(*) FROM google_calendar_connections_backup;
-- Deve retornar o mesmo numero de tokens que voce tem
```

**Se algo der errado — como reverter:**
```sql
-- ROLLBACK: restaurar tokens originais do backup
UPDATE google_calendar_connections gc
SET
  encrypted_access_token = bk.encrypted_access_token,
  encrypted_refresh_token = bk.encrypted_refresh_token
FROM google_calendar_connections_backup bk
WHERE gc.id = bk.id;
```

**Apos TUDO funcionar (Passo 6 completo), limpar backup:**
```sql
DROP TABLE IF EXISTS google_calendar_connections_backup;
```

**Tempo de downtime dos workflows N8N:** ~18 minutos (Calendar WebHooks e Lembretes).
O Google Calendar reenvia webhooks automaticamente, entao nenhum evento e perdido.
Lembretes tem risco baixo de perder 1 ciclo se agendado exatamente nessa janela.

### 5.1 — Gerar chave nova

No terminal:
```bash
openssl rand -hex 32
```
Isso gera algo como: `a7f3b2c1d4e5f6789012345678abcdef0123456789abcdef0123456789abcdef`

**ANOTE ESTA CHAVE EM LOCAL SEGURO.** Se perder, nao conseguira descriptografar os tokens.

### 5.2 — Salvar como variavel de ambiente no Supabase

No **Supabase Dashboard**:
1. Va em **Project Settings** → **Edge Functions**
2. Em **Environment Variables**, adicione:
   - Nome: `ENCRYPTION_KEY`
   - Valor: (a chave que voce gerou)

**E TAMBEM** precisa estar acessivel dentro das funcoes SQL. Para isso, va no **SQL Editor**:
```sql
-- Salvar a chave como configuracao do banco
-- Substitua 'SUA_CHAVE_AQUI' pela chave que voce gerou
ALTER DATABASE postgres SET app.encryption_key = 'SUA_CHAVE_AQUI';
```

**VERIFICAR que funcionou:**
```sql
SELECT current_setting('app.encryption_key', true);
-- Deve retornar a chave que voce acabou de setar
```

Se retornar NULL ou vazio, a configuracao nao foi aplicada. Tente reconectar ao banco ou reiniciar a sessao SQL.

### 5.3 — DESATIVAR os 2 workflows N8N (NOVO)

**POR QUE:** Se os workflows continuarem rodando enquanto voce re-criptografa os tokens, eles vao tentar descriptografar tokens "novos" com a chave "antiga" e falhar. Desativar ANTES evita esse problema.

No painel N8N:
1. Abrir **"Calendar WebHooks - Total Assistente"** → clicar no toggle para **desativar**
2. Abrir **"Lembretes Total Assistente"** → clicar no toggle para **desativar**

**ANOTE:** Os workflows ficam inativos ate o passo 5.8. Durante esse periodo, webhooks do Google Calendar e lembretes NAO serao processados. Isso e temporario (~30 minutos).

### 5.4 — Atualizar funcoes SQL

No **SQL Editor**, execute CADA bloco abaixo separadamente:

**Bloco A — encrypt_token:**
```sql
CREATE OR REPLACE FUNCTION public.encrypt_token(
  token text,
  key_text text DEFAULT current_setting('app.encryption_key', true)
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  key_hash bytea;
  iv bytea;
  encrypted_data bytea;
  key_hash_hex text;
  iv_hex text;
  base64_data text;
BEGIN
  IF token IS NULL OR token = '' THEN
    RETURN NULL;
  END IF;

  IF key_text IS NULL OR key_text = '' THEN
    RAISE EXCEPTION 'Encryption key not configured. Set app.encryption_key';
  END IF;

  key_hash := digest(key_text, 'sha256');
  iv := gen_random_bytes(16);

  encrypted_data := encrypt_iv(
    convert_to(token, 'UTF8'),
    key_hash,
    iv,
    'aes-cbc/pad:pkcs'
  );

  key_hash_hex := encode(digest(key_text, 'sha256'), 'hex');
  iv_hex := encode(iv, 'hex');
  base64_data := encode(encrypted_data, 'base64');

  RETURN key_hash_hex || '::' || iv_hex || '::' || base64_data;
END;
$$;

GRANT EXECUTE ON FUNCTION public.encrypt_token(text, text) TO service_role;
```

**Bloco B — decrypt_token (2 parametros):**
```sql
CREATE OR REPLACE FUNCTION public.decrypt_token(
  encrypted_token text,
  key_text text DEFAULT current_setting('app.encryption_key', true)
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  parts text[];
  stored_key_hash text;
  iv_hex text;
  base64_data text;
  key_hash bytea;
  iv bytea;
  encrypted_data bytea;
  decrypted_data bytea;
BEGIN
  IF encrypted_token IS NULL OR encrypted_token = '' THEN
    RETURN NULL;
  END IF;

  IF key_text IS NULL OR key_text = '' THEN
    RAISE EXCEPTION 'Encryption key not configured. Set app.encryption_key';
  END IF;

  parts := string_to_array(encrypted_token, '::');

  IF array_length(parts, 1) != 3 THEN
    RAISE EXCEPTION 'Invalid encrypted token format';
  END IF;

  stored_key_hash := parts[1];
  iv_hex := parts[2];
  base64_data := parts[3];

  key_hash := digest(key_text, 'sha256');
  iv := decode(iv_hex, 'hex');
  encrypted_data := decode(base64_data, 'base64');

  decrypted_data := decrypt_iv(
    encrypted_data,
    key_hash,
    iv,
    'aes-cbc/pad:pkcs'
  );

  RETURN convert_from(decrypted_data, 'UTF8');
END;
$$;

GRANT EXECUTE ON FUNCTION public.decrypt_token(text, text) TO service_role;
```

**Bloco C — decrypt_token_json (NOVO — funcao que o N8N chama via RPC):**

> **POR QUE ESTE BLOCO:** Os workflows N8N chamam `/rest/v1/rpc/decrypt_token_json`.
> Esta funcao pode nao existir nas migrations (foi dropada e nunca recriada formalmente).
> Precisamos garantir que ela exista e use a chave nova como default.

```sql
-- Dropar versao antiga se existir
DROP FUNCTION IF EXISTS public.decrypt_token_json(text, text);

-- Criar versao que usa chave do env como default
CREATE OR REPLACE FUNCTION public.decrypt_token_json(
  encrypted_token text,
  key_text text DEFAULT current_setting('app.encryption_key', true)
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Delega para decrypt_token (mesma logica)
  RETURN public.decrypt_token(encrypted_token, key_text);
END;
$$;

-- IMPORTANTE: Dar permissao para anon (N8N usa supabaseApi que pode ser anon ou service_role)
GRANT EXECUTE ON FUNCTION public.decrypt_token_json(text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.decrypt_token_json(text, text) TO anon;
GRANT EXECUTE ON FUNCTION public.decrypt_token_json(text, text) TO authenticated;
```

**Bloco D — Atualizar funcoes que chamam encrypt/decrypt com chave hardcoded:**

```sql
-- Listar funcoes que ainda referenciam a chave antiga
SELECT routine_name, routine_definition
FROM information_schema.routines
WHERE routine_definition LIKE '%google_calendar_secret_key_2024%'
AND routine_schema = 'public';
```

Para CADA funcao retornada, atualize removendo o parametro de chave (assim usa o default). Exemplos comuns:

```sql
-- Onde tinha:
--   decrypt_token(encrypted_access_token, 'google_calendar_secret_key_2024')
-- Troque para:
--   decrypt_token(encrypted_access_token)
-- (sem segundo parametro = usa current_setting('app.encryption_key'))
```

As funcoes mais provaveis que precisam de atualizacao:
- `secure_get_google_tokens`
- `store_google_connection`
- `store_access_token`
- `store_vip_google_connection`
- `get_vip_google_tokens`

### 5.5 — Re-criptografar tokens existentes

> **ATENCAO v2:** A versao anterior fazia tudo em um unico UPDATE.
> Se houver muitos registros, isso pode dar timeout. Agora fazemos em batches.

**Primeiro, verificar quantos tokens existem:**
```sql
SELECT COUNT(*) as total FROM google_calendar_connections WHERE encrypted_access_token IS NOT NULL;
SELECT COUNT(*) as total FROM vip_google_connections WHERE encrypted_access_token IS NOT NULL;
```

**Re-criptografar google_calendar_connections (em batches de 100):**
```sql
-- Se tiver POUCOS registros (menos de 500), pode rodar direto:
UPDATE google_calendar_connections
SET
  encrypted_access_token = public.encrypt_token(
    public.decrypt_token(encrypted_access_token, 'google_calendar_secret_key_2024')
  ),
  encrypted_refresh_token = public.encrypt_token(
    public.decrypt_token(encrypted_refresh_token, 'google_calendar_secret_key_2024')
  )
WHERE encrypted_access_token IS NOT NULL;

-- Se tiver MUITOS registros (500+), use batches:
-- Batch 1
UPDATE google_calendar_connections
SET
  encrypted_access_token = public.encrypt_token(
    public.decrypt_token(encrypted_access_token, 'google_calendar_secret_key_2024')
  ),
  encrypted_refresh_token = public.encrypt_token(
    public.decrypt_token(encrypted_refresh_token, 'google_calendar_secret_key_2024')
  )
WHERE id IN (
  SELECT id FROM google_calendar_connections
  WHERE encrypted_access_token IS NOT NULL
  LIMIT 100
  -- Para batches seguintes, adicione: OFFSET 100, OFFSET 200, etc.
);
```

**Re-criptografar vip_google_connections (se tabela tiver dados):**
```sql
UPDATE vip_google_connections
SET
  encrypted_access_token = public.encrypt_token(
    public.decrypt_token(encrypted_access_token, 'google_calendar_secret_key_2024')
  ),
  encrypted_refresh_token = public.encrypt_token(
    public.decrypt_token(encrypted_refresh_token, 'google_calendar_secret_key_2024')
  )
WHERE encrypted_access_token IS NOT NULL;
```

### 5.5b — Verificar integridade da re-criptografia (ANTES de continuar)

```sql
-- CRITICO: Rodar ANTES de reativar qualquer coisa
SELECT
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE public.decrypt_token(encrypted_access_token) IS NOT NULL) as migrados_ok,
  COUNT(*) FILTER (WHERE public.decrypt_token(encrypted_access_token) IS NULL) as falhou
FROM google_calendar_connections
WHERE encrypted_access_token IS NOT NULL;
```

**Se `falhou > 0`:** PARE. NAO reative o N8N. Rode o UPDATE novamente apenas nos tokens que falharam, ou use o backup para reverter e tentar de novo.

**Se `falhou = 0`:** Todos os tokens foram migrados. Continue para 5.6.

### 5.6 — Verificar que decrypt funciona com nova chave

```sql
-- Testar que decrypt funciona com a nova chave (via env)
SELECT
  user_id,
  public.decrypt_token(encrypted_access_token) IS NOT NULL as token_ok
FROM google_calendar_connections
WHERE encrypted_access_token IS NOT NULL
LIMIT 3;
```
Se retornar `token_ok = true`, a re-criptografia funcionou.

```sql
-- Testar que a chave ANTIGA nao funciona mais
SELECT public.decrypt_token(
  encrypted_access_token,
  'google_calendar_secret_key_2024'
) FROM google_calendar_connections
WHERE encrypted_access_token IS NOT NULL
LIMIT 1;
```
**Esperado:** ERRO ou NULL (chave antiga invalida).

```sql
-- Testar que decrypt_token_json tambem funciona (e o que o N8N vai chamar)
SELECT public.decrypt_token_json(
  encrypted_refresh_token
) IS NOT NULL as json_func_ok
FROM google_calendar_connections
WHERE encrypted_refresh_token IS NOT NULL
LIMIT 1;
```
**Esperado:** `json_func_ok = true`.

### 5.7 — Atualizar os 5 nodes nos workflows N8N (NOVO)

Agora que os tokens estao re-criptografados e as funcoes SQL usam a nova chave como default, precisamos remover a chave hardcoded dos workflows N8N.

**No painel N8N, abrir "Calendar WebHooks - Total Assistente":**

Localizar estes 3 nodes (buscar por "descriptografar"):
1. `descriptografar_token_prod`
2. `descriptografar_token_prod1`
3. `descriptografar_token_prod2`

Em CADA node, no campo **JSON Body**, trocar de:
```
={{ ({ encrypted_token: $json.encrypted_refresh_token, key_text: 'google_calendar_secret_key_2024' }) }}
```

Para:
```
={{ ({ encrypted_token: $json.encrypted_refresh_token }) }}
```

**No painel N8N, abrir "Lembretes Total Assistente":**

Localizar estes 2 nodes:
1. `descriptografar_token_prod`
2. `descriptografar_token_prod1`

Mesma alteracao: remover `key_text` do JSON body.

**SALVAR cada workflow apos editar todos os nodes.**

### 5.8 — REATIVAR os 2 workflows N8N (NOVO)

No painel N8N:
1. Abrir **"Calendar WebHooks - Total Assistente"** → clicar no toggle para **ativar**
2. Abrir **"Lembretes Total Assistente"** → clicar no toggle para **ativar**

### 5.9 — Verificar workflows funcionando (NOVO)

Para verificar que os workflows estao operacionais:

1. **Calendar WebHooks:** Crie ou edite um evento no Google Calendar de um usuario de teste. O webhook deve disparar e o workflow deve processar sem erro.

2. **Lembretes:** Verifique no historico de execucoes do N8N se o proximo lembrete executa sem erro no node `descriptografar_token_prod`.

Se qualquer workflow falhar com erro tipo "Encryption key not configured" ou "Invalid encrypted token":
- Verifique se `app.encryption_key` esta setado: `SELECT current_setting('app.encryption_key', true);`
- Verifique se `decrypt_token_json` existe: `SELECT proname FROM pg_proc WHERE proname = 'decrypt_token_json';`
- Verifique se os nodes N8N realmente tiveram o `key_text` removido

---

## PASSO 6 — Verificacao Final

### 6.1 — Checklist de funcoes removidas
```bash
# Estas devem retornar 404:
curl -s -o /dev/null -w "%{http_code}" \
  "https://ldbdtakddxznfridsarn.supabase.co/functions/v1/create-user-admin"
# Esperado: 404

curl -s -o /dev/null -w "%{http_code}" \
  "https://ldbdtakddxznfridsarn.supabase.co/functions/v1/sync-profile-to-auth"
# Esperado: 404

curl -s -o /dev/null -w "%{http_code}" \
  "https://ldbdtakddxznfridsarn.supabase.co/functions/v1/vip-google-connect?action=status&phone=5543999999999"
# Esperado: 404
```

### 6.2 — Checklist de CORS
```bash
# Request de origem nao-autorizada:
curl -s -D - \
  "https://ldbdtakddxznfridsarn.supabase.co/functions/v1/check-email-exists" \
  -H "Origin: https://hacker.com" \
  -H "Content-Type: application/json" \
  -d '{"email": "test@test.com"}' 2>&1 | grep -i "access-control-allow-origin"
# Esperado: access-control-allow-origin: https://totalassistente.com.br
# (NAO deve mostrar https://hacker.com)
```

### 6.3 — Checklist de criptografia
```sql
-- No SQL Editor do Supabase:

-- A chave antiga NAO deve funcionar mais:
SELECT public.decrypt_token(
  encrypted_access_token,
  'google_calendar_secret_key_2024'
) FROM google_calendar_connections LIMIT 1;
-- Esperado: ERRO (chave errada nao descriptografa mais)

-- A nova chave (via env) deve funcionar:
SELECT public.decrypt_token(encrypted_access_token)
FROM google_calendar_connections LIMIT 1;
-- Esperado: retorna o token (funciona!)

-- decrypt_token_json deve funcionar (N8N usa esta):
SELECT public.decrypt_token_json(encrypted_refresh_token)
FROM google_calendar_connections LIMIT 1;
-- Esperado: retorna o token
```

### 6.4 — Checklist N8N (NOVO)

No painel N8N, verificar:

- [ ] **Calendar WebHooks - Total Assistente:** Workflow ativo, ultima execucao sem erro
- [ ] **Lembretes Total Assistente:** Workflow ativo, ultima execucao sem erro
- [ ] Verificar historico de execucoes: os nodes `descriptografar_token_prod*` retornam tokens validos (nao NULL, nao erro)

### 6.5 — Testar funcionalidades que DEVEM continuar funcionando

Apos todas as correcoes, teste manualmente:

- [ ] **Login OTP:** Ir em totalassistente.com.br, fazer login com email → OTP funciona?
- [ ] **Login Google:** Clicar "Entrar com Google" → funciona?
- [ ] **Google Calendar sync:** Conectar Google Calendar → eventos sincronizam?
- [ ] **Criar evento:** Criar evento no calendario → salva? Aparece no Google?
- [ ] **Criar gasto:** Adicionar gasto → salva?
- [ ] **WhatsApp bot:** Mandar mensagem pro bot → responde?
- [ ] **Hotmart webhook:** Se possivel, simular compra test na Hotmart → subscription criada?
- [ ] **Lembretes N8N:** Proximo lembrete agendado executa sem erro?
- [ ] **Calendar Webhooks N8N:** Editar evento no Google → N8N processa mudanca?

Se qualquer um falhar, a causa mais provavel e:
1. Funcao SQL de criptografia com chave errada (Passo 5.4/5.5)
2. `decrypt_token_json` nao existe ou nao tem permissao (Passo 5.4 Bloco C)
3. Nodes N8N ainda com chave antiga no body (Passo 5.7)
4. CORS bloqueando request legitimo (Passo 1 — adicione sua URL de dev se necessario)
5. `app.encryption_key` nao configurado (Passo 5.2 — verificar com `SELECT current_setting(...)`)

---

## GLOSSARIO RAPIDO

| Termo | Significado simples |
|-------|---------------------|
| **Edge Function** | Mini-programa que roda na nuvem do Supabase |
| **JWT** | "Cracha digital" que prova que voce esta logado |
| **service_role** | Chave mestra do Supabase (acesso total) |
| **CORS** | Regra que diz quais sites podem chamar sua API |
| **RLS** | Regra no banco que impede usuario A de ver dados do usuario B |
| **Trigger** | Automacao do banco: "quando X acontecer, faca Y" |
| **Migration** | Arquivo SQL que modifica a estrutura do banco |
| **Criptografia AES** | Algoritmo que embaralha dados usando uma chave secreta |
| **OAuth** | Protocolo que permite login via Google/Facebook sem compartilhar senha |
| **HMAC** | Assinatura digital que prova que uma mensagem nao foi alterada |
| **Rate Limit** | Limite de quantas vezes algo pode ser feito por minuto/hora |
| **N8N** | Plataforma de automacao de workflows (sua "orquestracao") |
| **RPC** | Remote Procedure Call — chamar uma funcao SQL via API REST |
| **decrypt_token_json** | Funcao SQL que o N8N chama para descriptografar tokens Google |

---

## DEPOIS DO TIER 0

Com essas 5 portas fechadas, seu sistema ja esta MUITO mais seguro para lancar. Os proximos passos (TIER 1) seriam:
1. Adicionar HMAC no hotmart-webhook
2. Rate limit no check-email-exists
3. Grace period funcional
4. Monitoramento (Sentry)
5. Adicionar `kiwify-webhook` ao HMAC (mesma logica do hotmart)

Mas TIER 0 e o que importa agora.
