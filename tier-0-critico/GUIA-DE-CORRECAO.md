# GUIA DE CORRECAO TIER 0 — Passo a Passo para Iniciantes

**O que e este documento:** Um guia pratico, na ordem certa, para fechar as 5 portas abertas do seu sistema antes de lancar. Cada passo explica o PORQUE, o QUE fazer, e COMO fazer.

**Tempo estimado:** ~2-3 horas se seguir na ordem.

**Ferramentas necessarias:**
- Acesso ao **Supabase Dashboard** (https://supabase.com/dashboard)
- Editor de codigo (VS Code, Cursor, etc.)
- Terminal com acesso ao servidor

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

---

## ORDEM DE EXECUCAO

Siga esta ordem. Cada passo depende do anterior estar feito.

```
PASSO 1: Fechar CORS em todas edge functions          (~15 min)
PASSO 2: Eliminar create-user-admin                    (~10 min)
PASSO 3: Eliminar sync-profile-to-auth + trigger       (~20 min)
PASSO 4: Proteger ou eliminar vip-google-connect       (~15 min)
PASSO 5: Rotacionar chave de criptografia              (~30 min)
PASSO 6: Verificar que tudo funciona                   (~30 min)
```

---

## PASSO 1 — Fechar CORS em todas Edge Functions

### Por que?
Hoje, QUALQUER site na internet pode fazer requests para suas funcoes. Isso amplifica todas as outras vulnerabilidades. Vamos restringir para que so o seu site possa chamar.

### O que e CORS na pratica?
Quando voce abre `totalassistente.com.br` e o site faz um request para a API do Supabase, o navegador pergunta ao Supabase: "ei, voce aceita requests deste site?". Se o Supabase responde `*` (qualquer um), o navegador permite. Se responde `totalassistente.com.br`, so permite do seu site.

**IMPORTANTE:** CORS so protege navegadores. Um hacker usando `curl` no terminal ignora CORS. Por isso CORS e uma camada EXTRA, nao a unica protecao.

### Como fazer

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

### Quais arquivos editar

Editar TODOS estes arquivos em `/home/totalAssistente/site/supabase/functions/`:

```
check-email-exists/index.ts
create-checkout/index.ts
create-user-admin/index.ts         ← sera deletado no passo 2, mas edite por seguranca
delete-account/index.ts
fetch-market-data/index.ts
google-calendar/index.ts
google-calendar-sync-cron/index.ts
google-calendar-webhook/index.ts
hotmart-webhook/index.ts
start-otp-login/index.ts
sync-profile-to-auth/index.ts      ← sera deletado no passo 3, mas edite por seguranca
verify-otp-secure/index.ts
vip-google-connect/index.ts
```

### Excecoes (NAO restringir CORS nestes)

- **`hotmart-webhook`**: A Hotmart chama de servidores dela, nao de um navegador. CORS nao se aplica, mas nao atrapalha ter. Mantenha o CORS restrito mesmo assim.
- **`google-calendar-webhook`**: O Google chama de servidores dele. Mesmo caso.

### Como fazer deploy
Apos editar todos os arquivos:
```bash
cd /home/totalAssistente/site
npx supabase functions deploy check-email-exists
npx supabase functions deploy create-checkout
# ... repetir para cada funcao editada
```

Ou deploy de todas de uma vez:
```bash
npx supabase functions deploy
```

---

## PASSO 2 — Eliminar `create-user-admin`

### Por que?
Esta funcao cria usuarios com email confirmado, sem exigir nenhuma autenticacao. Qualquer pessoa pode criar contas falsas.

### Quem usa esta funcao?
**Ninguem diretamente.** Investiguei:
- O frontend NAO chama esta funcao (0 resultados no `src/`)
- O hotmart-webhook NAO chama esta funcao (0 resultados)
- Nenhum workflow N8N referencia ela

A funcao e um resquicio de desenvolvimento. Pode ser removida com seguranca.

### Como fazer

**2.1 — Remover do config.toml**

Abra `/home/totalAssistente/site/supabase/config.toml` e DELETE estas linhas:
```toml
[functions.create-user-admin]
verify_jwt = false
```

**2.2 — Deletar a pasta da funcao**
```bash
rm -rf /home/totalAssistente/site/supabase/functions/create-user-admin
```

**2.3 — Fazer deploy (isso remove a funcao do Supabase)**
```bash
cd /home/totalAssistente/site
npx supabase functions deploy
```

**2.4 — Verificar que foi removida**
```bash
curl -X POST "https://ldbdtakddxznfridsarn.supabase.co/functions/v1/create-user-admin" \
  -H "Content-Type: application/json" \
  -d '{"email": "teste@teste.com", "password": "Test123!"}'
```
**Resultado esperado:** Erro 404 (funcao nao encontrada).

### Se der medo de deletar
Alternativa: em vez de deletar, adicione este bloco no INICIO da funcao:
```typescript
// BLOQUEAR COMPLETAMENTE
return new Response(JSON.stringify({ error: 'Function disabled' }), {
  status: 403,
  headers: { ...corsHeaders, 'Content-Type': 'application/json' }
});
```
Mas deletar e melhor. Codigo morto e divida tecnica.

---

## PASSO 3 — Eliminar `sync-profile-to-auth` + Trigger

### Por que?
Esta funcao lista TODOS os usuarios do sistema (emails, IDs) sem autenticacao. Alem disso, e chamada automaticamente por um trigger toda vez que um profile e criado.

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

## PASSO 4 — Proteger `vip-google-connect`

### Por que?
Qualquer pessoa que saiba um numero de telefone pode:
- Conectar SEU Google ao telefone da vitima
- Ver se qualquer telefone tem Google conectado
- Desconectar o Google de qualquer telefone

### Decisao necessaria: VIP Calendar ainda e usado?

**Se NAO (recomendado se nao tem VIPs ativos):**
- Deletar tudo: funcao, tabelas, RPCs
- Caminho mais simples e seguro

**Se SIM:**
- Adicionar autenticacao via token temporario (mais complexo)

### OPCAO A — Remover VIP (recomendado)

**4A.1 — Remover config**
Delete de `config.toml`:
```toml
[functions.vip-google-connect]
verify_jwt = false
```

**4A.2 — Deletar funcao**
```bash
rm -rf /home/totalAssistente/site/supabase/functions/vip-google-connect
```

**4A.3 — Limpar banco (SQL Editor do Supabase)**
```sql
-- Remove RPCs
DROP FUNCTION IF EXISTS public.store_vip_google_connection(text, text, text, timestamptz, text);
DROP FUNCTION IF EXISTS public.get_vip_connection_status(text);
DROP FUNCTION IF EXISTS public.get_vip_google_tokens(text);

-- Remove tabelas (CUIDADO: perda de dados de VIPs existentes)
-- So execute se tem certeza que nao ha VIPs ativos
-- Verifique primeiro:
SELECT COUNT(*) FROM vip_google_connections WHERE is_connected = true;
SELECT COUNT(*) FROM calendar_vip;

-- Se ambos retornam 0, pode dropar:
DROP TABLE IF EXISTS vip_google_connections CASCADE;
DROP TABLE IF EXISTS calendar_vip CASCADE;
```

**4A.4 — Criar migration documentando**
```bash
npx supabase migration new remove_vip_calendar
```
Conteudo:
```sql
-- Remove VIP Calendar (TIER 0 security fix: zero authentication)
DROP FUNCTION IF EXISTS public.store_vip_google_connection(text, text, text, timestamptz, text);
DROP FUNCTION IF EXISTS public.get_vip_connection_status(text);
DROP FUNCTION IF EXISTS public.get_vip_google_tokens(text);
DROP TABLE IF EXISTS vip_google_connections CASCADE;
DROP TABLE IF EXISTS calendar_vip CASCADE;
```

### OPCAO B — Proteger com token (se VIP continuar)

Se voce precisar manter VIP, o conceito e:

1. Bot WhatsApp envia link com token unico: `?phone=5543...&token=abc123`
2. Edge function valida que o token existe e nao expirou
3. Token armazenado em tabela `vip_auth_tokens` com TTL de 15 minutos

**4B.1 — Criar tabela de tokens (SQL Editor):**
```sql
CREATE TABLE public.vip_auth_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '15 minutes'),
  used BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Apenas service_role pode acessar
ALTER TABLE vip_auth_tokens ENABLE ROW LEVEL SECURITY;
-- Sem policies publicas = so service_role acessa
```

**4B.2 — Adicionar validacao no inicio de CADA action da edge function:**
```typescript
// Validar token em todas as acoes (auth, status, disconnect)
const token = url.searchParams.get('token');
if (!token) {
  return new Response(JSON.stringify({ error: 'Token obrigatório' }), {
    status: 401,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// Verificar token no banco
const { data: tokenData, error: tokenError } = await supabase
  .from('vip_auth_tokens')
  .select('*')
  .eq('token', token)
  .eq('phone', normalizedPhone)
  .eq('used', false)
  .gt('expires_at', new Date().toISOString())
  .single();

if (tokenError || !tokenData) {
  return new Response(JSON.stringify({ error: 'Token inválido ou expirado' }), {
    status: 401,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// Marcar token como usado (single-use)
await supabase
  .from('vip_auth_tokens')
  .update({ used: true })
  .eq('id', tokenData.id);
```

**4B.3 — No workflow N8N do bot, quando usuario VIP pede para conectar Google:**
O bot deve criar um token na tabela e enviar o link com o token incluso.

---

## PASSO 5 — Rotacionar Chave de Criptografia

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

### O plano
1. Gerar chave nova (aleatoria, impossivel de adivinhar)
2. Salvar como variavel de ambiente no Supabase (nao no codigo)
3. Re-criptografar todos tokens existentes com a nova chave
4. Atualizar as funcoes SQL para usar a nova chave
5. Nunca mais colocar chave no codigo

### Como fazer

**5.1 — Gerar chave nova**

No terminal:
```bash
openssl rand -hex 32
```
Isso gera algo como: `a7f3b2c1d4e5f6789012345678abcdef0123456789abcdef0123456789abcdef`

**ANOTE ESTA CHAVE EM LOCAL SEGURO.** Se perder, nao conseguira descriptografar os tokens.

**5.2 — Salvar como variavel de ambiente no Supabase**

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

**5.3 — Atualizar as funcoes encrypt_token e decrypt_token**

No **SQL Editor**, execute:

```sql
-- FUNCAO ENCRYPT: agora le chave do env, NAO tem default hardcoded
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

-- FUNCAO DECRYPT: mesma mudanca
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

-- Permissoes
GRANT EXECUTE ON FUNCTION public.encrypt_token(text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.decrypt_token(text, text) TO service_role;
```

**5.4 — Re-criptografar tokens existentes**

Este e o passo mais delicado. Vamos:
1. Descriptografar com a chave ANTIGA
2. Re-criptografar com a chave NOVA

```sql
-- PASSO 1: Verificar quantos tokens existem
SELECT COUNT(*) FROM google_calendar_connections WHERE encrypted_access_token IS NOT NULL;
SELECT COUNT(*) FROM vip_google_connections WHERE encrypted_access_token IS NOT NULL;

-- PASSO 2: Re-criptografar google_calendar_connections
-- (usa chave antiga para descriptografar, nova para criptografar)
UPDATE google_calendar_connections
SET
  encrypted_access_token = public.encrypt_token(
    public.decrypt_token(encrypted_access_token, 'google_calendar_secret_key_2024'),
    current_setting('app.encryption_key')
  ),
  encrypted_refresh_token = public.encrypt_token(
    public.decrypt_token(encrypted_refresh_token, 'google_calendar_secret_key_2024'),
    current_setting('app.encryption_key')
  )
WHERE encrypted_access_token IS NOT NULL;

-- PASSO 3: Re-criptografar vip_google_connections (se tabela ainda existir)
UPDATE vip_google_connections
SET
  encrypted_access_token = public.encrypt_token(
    public.decrypt_token(encrypted_access_token, 'google_calendar_secret_key_2024'),
    current_setting('app.encryption_key')
  ),
  encrypted_refresh_token = public.encrypt_token(
    public.decrypt_token(encrypted_refresh_token, 'google_calendar_secret_key_2024'),
    current_setting('app.encryption_key')
  )
WHERE encrypted_access_token IS NOT NULL;
```

**5.5 — Atualizar funcoes que chamam encrypt/decrypt com chave hardcoded**

As funcoes SQL `store_google_connection`, `secure_get_google_tokens`, `store_vip_google_connection`, e `get_vip_google_tokens` chamam encrypt/decrypt com a chave hardcoded. Precisam ser atualizadas para usar o default (que agora le do env).

No **SQL Editor**, para cada funcao que tinha `'google_calendar_secret_key_2024'` explicito, atualize removendo o parametro de chave (assim usa o default):

```sql
-- Exemplo: secure_get_google_tokens (atualizar para usar default)
-- Procure linhas como:
--   decrypt_token(encrypted_access_token, 'google_calendar_secret_key_2024')
-- E troque para:
--   decrypt_token(encrypted_access_token)
-- (sem segundo parametro = usa current_setting('app.encryption_key'))
```

Para ver todas as funcoes que precisam de atualizacao:
```sql
-- Lista funcoes que ainda referenciam a chave antiga
SELECT routine_name, routine_definition
FROM information_schema.routines
WHERE routine_definition LIKE '%google_calendar_secret_key_2024%'
AND routine_schema = 'public';
```

**5.6 — Verificar que funciona**
```sql
-- Testar que decrypt funciona com a nova chave
SELECT
  user_id,
  public.decrypt_token(encrypted_access_token) IS NOT NULL as token_ok
FROM google_calendar_connections
WHERE encrypted_access_token IS NOT NULL
LIMIT 3;
```
Se retornar `token_ok = true`, a re-criptografia funcionou.

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
```

### 6.2 — Checklist de VIP (se removido)
```bash
curl -s -o /dev/null -w "%{http_code}" \
  "https://ldbdtakddxznfridsarn.supabase.co/functions/v1/vip-google-connect?action=status&phone=5543999999999"
# Esperado: 404
```

### 6.3 — Checklist de CORS
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

### 6.4 — Checklist de criptografia
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
```

### 6.5 — Testar funcionalidades que DEVEM continuar funcionando

Apos todas as correcoes, teste manualmente:

- [ ] **Login OTP:** Ir em totalassistente.com.br, fazer login com email → OTP funciona?
- [ ] **Login Google:** Clicar "Entrar com Google" → funciona?
- [ ] **Google Calendar sync:** Conectar Google Calendar → eventos sincronizam?
- [ ] **Criar evento:** Criar evento no calendario → salva? Aparece no Google?
- [ ] **Criar gasto:** Adicionar gasto → salva?
- [ ] **WhatsApp bot:** Mandar mensagem pro bot → responde?
- [ ] **Hotmart webhook:** Se possivel, simular compra test na Hotmart → subscription criada?

Se qualquer um falhar, a causa mais provavel e:
1. Funcao SQL de criptografia com chave errada (Passo 5)
2. CORS bloqueando request legitimo (Passo 1 — adicione sua URL de dev se necessario)

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

---

## DEPOIS DO TIER 0

Com essas 5 portas fechadas, seu sistema ja esta MUITO mais seguro para lancar. Os proximos passos (TIER 1) seriam:
1. Adicionar HMAC no hotmart-webhook
2. Rate limit no check-email-exists
3. Grace period funcional
4. Monitoramento (Sentry)

Mas TIER 0 e o que importa agora.
