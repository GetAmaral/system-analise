# TIER 0 — VULNERABILIDADES CRITICAS (PORTAS ABERTAS)

**Status:** EXPLORAVEIS AGORA. Nao lancar sem resolver TODAS.
**Data:** 2026-03-10
**Agente:** Sherlock (analisador)

---

## Indice

| # | Vulnerabilidade | Arquivo | Impacto |
|---|----------------|---------|---------|
| V1 | [create-user-admin sem auth](#v1) | `supabase/functions/create-user-admin/index.ts` | Criacao massiva de contas falsas |
| V2 | [sync-profile-to-auth lista todos usuarios](#v2) | `supabase/functions/sync-profile-to-auth/index.ts` | Enumeracao de todos emails do sistema |
| V3 | [vip-google-connect telefone = auth](#v3) | `supabase/functions/vip-google-connect/index.ts` | Acesso ao Google Calendar de qualquer VIP |
| V4 | [Google Client Secret em endpoint publico](#v4) | `supabase/functions/vip-google-connect/index.ts` | Abuso da app Google OAuth |
| V5 | [Chave de criptografia hardcoded](#v5) | 8+ migrations SQL | Descriptografia de TODOS tokens Google |

---

<a id="v1"></a>
## V1 — create-user-admin: endpoint publico sem autenticacao

### Onde
```
/home/totalAssistente/site/supabase/functions/create-user-admin/index.ts
```

### Codigo Vulneravel
```typescript
// Linhas 9-12 — NENHUMA verificacao de auth
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  try {
    const { email, password, name, phone } = await req.json();
```

```typescript
// Linhas 15-22 — Valida campos, NAO valida quem esta chamando
if (!email || !password) {
  return new Response(
    JSON.stringify({ error: "Email e senha são obrigatórios" }),
    { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}
```

```typescript
// Linhas 24-25 — Usa service_role (privilegio total)
const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);
```

```typescript
// Linhas 69-76 — Auto-vincula subscriptions
const { error: linkError } = await supabaseAdmin
  .from('subscriptions')
  .update({ user_id: user.id })
  .ilike('email', email)
  .is('user_id', null);
```

### Como Explorar
```bash
curl -X POST "https://<SUPABASE_URL>/functions/v1/create-user-admin" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "atacante@evil.com",
    "password": "Senha123!",
    "name": "Conta Falsa",
    "phone": "5511999999999"
  }'
```
**Resultado:** Usuario criado com email confirmado, profile vinculado, subscriptions vinculadas por email.

### Impacto
- Criacao massiva de contas falsas
- Se atacante souber email de um usuario premium, pode criar conta com o mesmo email e tentar vincular subscription
- Bot pode criar milhares de contas em minutos
- Sem rate limit

### Fix Proposto
```typescript
// ADICIONAR no inicio da funcao (apos OPTIONS check):
const authHeader = req.headers.get('Authorization');
if (!authHeader?.startsWith('Bearer ')) {
  return new Response(JSON.stringify({ error: 'Unauthorized' }), {
    status: 401,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

// Verificar se e service_role OU admin
const supabaseAuth = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_ANON_KEY')!
);
const { data: { user }, error } = await supabaseAuth.auth.getUser(
  authHeader.replace('Bearer ', '')
);
if (error || !user) {
  return new Response(JSON.stringify({ error: 'Unauthorized' }), {
    status: 401,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

// Verificar role admin
const { data: roles } = await supabaseAdmin
  .from('user_roles')
  .select('role')
  .eq('user_id', user.id)
  .eq('role', 'admin')
  .single();

if (!roles) {
  return new Response(JSON.stringify({ error: 'Forbidden' }), {
    status: 403,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}
```

### Alternativa Radical
Se esta funcao so e chamada pelo hotmart-webhook (que ja roda com service_role), **deletar a edge function** e mover a logica para dentro do hotmart-webhook.

---

<a id="v2"></a>
## V2 — sync-profile-to-auth: lista TODOS os usuarios publicamente

### Onde
```
/home/totalAssistente/site/supabase/functions/sync-profile-to-auth/index.ts
```

### Codigo Vulneravel
```typescript
// Linhas 9-39 — Nenhum check de auth, apenas validacao de input
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  // ... validacao de campos, NAO de identidade
```

```typescript
// Linha 42 — CRITICO: lista TODOS usuarios do sistema
const { data: existingUsers, error: listError } =
  await supabaseAdmin.auth.admin.listUsers();
```

```typescript
// Linhas 49-51 — Itera sobre TODOS usuarios
const existingUser = existingUsers?.users?.find(
  (u: any) => u.email?.toLowerCase() === email.toLowerCase()
);
```

### Como Explorar
```bash
# Basta chamar a funcao — sem auth necessario
curl -X POST "https://<SUPABASE_URL>/functions/v1/sync-profile-to-auth" \
  -H "Content-Type: application/json" \
  -d '{"email": "qualquer@email.com", "name": "Test"}'
```

**Resultado:**
- Funcao carrega TODOS usuarios na memoria (timing: quanto mais usuarios, mais lento — timing attack para estimar qtd)
- Se email nao existe em auth.users, CRIA usuario com UUID random como senha
- Atualiza profile.id para match com auth user
- Vincula subscriptions

### Impacto
- **Enumeracao de emails:** Medir tempo de resposta revela se email existe
- **OOM com escala:** 50k+ usuarios = listUsers() carrega tudo na memoria = crash
- **Criacao de usuarios arbitrarios:** Se email nao existe, e CRIADO automaticamente
- **Account takeover:** Atacante pode sincronizar profile com auth user que controla

### Fix Proposto
**OPCAO A — Proteger com auth admin:**
```typescript
// Mesmo pattern do V1: exigir JWT de admin
```

**OPCAO B — Eliminar a funcao (RECOMENDADO)**
Se esta funcao so foi usada uma vez para migrar dados, **deletar completamente**. Nenhum fluxo ativo depende dela.

Para verificar se algo depende:
```bash
grep -r "sync-profile-to-auth" /home/totalAssistente/site/src/
# Se 0 resultados → deletar com seguranca
```

---

<a id="v3"></a>
## V3 — vip-google-connect: telefone como unica credencial

### Onde
```
/home/totalAssistente/site/supabase/functions/vip-google-connect/index.ts
```

### Codigo Vulneravel

**Acao AUTH (iniciar OAuth):**
```typescript
// Linha 30 — Phone extraido da URL sem validacao de ownership
if (url.searchParams.get('action') === 'auth' || action === 'auth') {
  const phone = url.searchParams.get('phone');

// Linha 43 — Phone usado como OAuth state (plain text!)
  const state = encodeURIComponent(normalizedPhone);
```

**Acao CALLBACK (receber tokens):**
```typescript
// Linha 85 — Phone recuperado do state
const phone = decodeURIComponent(state);

// Linhas 132-138 — Tokens Google armazenados para QUALQUER phone
const { error: dbError } = await supabase.rpc('store_vip_google_connection', {
  p_phone: phone,
  p_access_token: tokenData.access_token,
  p_refresh_token: tokenData.refresh_token,
  p_expires_at: expiresAt,
  p_connected_email: connectedEmail,
});
```

**Acao STATUS (verificar conexao):**
```typescript
// Linhas 159-173 — Qualquer pessoa consulta status de qualquer phone
if (url.searchParams.get('action') === 'status') {
  const phone = url.searchParams.get('phone');
  // ... ZERO auth check ...
  const { data, error } = await supabase.rpc('get_vip_connection_status', {
    p_phone: normalizedPhone,
  });
```

**Acao DISCONNECT:**
```typescript
// Linhas 198-237 — Qualquer pessoa desconecta qualquer phone
if (url.searchParams.get('action') === 'disconnect') {
  const phone = url.searchParams.get('phone');
  // ... ZERO auth check ...
```

### Como Explorar
```bash
# 1. Verificar se um phone tem Google conectado
curl "https://<SUPABASE_URL>/functions/v1/vip-google-connect?action=status&phone=5543999999999"

# 2. Iniciar OAuth para o phone da VITIMA (conectar SUA conta Google ao phone da vitima)
curl "https://<SUPABASE_URL>/functions/v1/vip-google-connect?action=auth&phone=5543999999999"
# → Retorna URL do Google OAuth. Atacante autentica com SEU Google.
# → Tokens do atacante sao armazenados sob o phone da vitima.

# 3. Desconectar a conexao Google legitima de qualquer phone
curl "https://<SUPABASE_URL>/functions/v1/vip-google-connect?action=disconnect&phone=5543999999999"
```

### Impacto
- **Hijack de calendario VIP:** Atacante conecta seu Google ao phone da vitima
- **Enumeracao:** Verificar quais phones tem Google conectado
- **Sabotagem:** Desconectar qualquer VIP do Google Calendar
- **Sem rastro:** Nenhum audit log

### Fix Proposto

**OPCAO A — Adicionar verificacao por token temporario:**
```typescript
// 1. Bot WhatsApp envia link com token unico de 15 min:
//    https://...?action=auth&phone=5543...&token=abc123def456
// 2. Edge function valida token antes de prosseguir
// 3. Token armazenado em tabela com TTL

const { data: session } = await supabase
  .from('vip_auth_sessions')
  .select('*')
  .eq('phone', phone)
  .eq('token', token)
  .gt('expires_at', new Date().toISOString())
  .single();

if (!session) {
  return new Response('Unauthorized', { status: 401 });
}
```

**OPCAO B — Eliminar feature VIP (RECOMENDADO se nao esta em uso)**
VIP Calendar e uma arquitetura paralela completa (calendar_vip, vip_google_connections) que duplica tudo do calendario regular. Se nao tem VIPs ativos, remover.

---

<a id="v4"></a>
## V4 — Google Client Secret em endpoint publico

### Onde
```
/home/totalAssistente/site/supabase/functions/vip-google-connect/index.ts
```

### Codigo Vulneravel
```typescript
// Linha 10 — Secret carregado do env (OK em si)
const GOOGLE_CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET');

// Linhas 95-96 — Secret usado em endpoint SEM AUTENTICACAO
body: new URLSearchParams({
  client_id: GOOGLE_CLIENT_ID!,
  client_secret: GOOGLE_CLIENT_SECRET!,  // ← exposto em funcao publica
  code,
  grant_type: 'authorization_code',
  redirect_uri: redirectUri,
}),
```

### Contexto
O `GOOGLE_CLIENT_SECRET` em si esta em env var (correto). O problema e que ele e usado dentro de `vip-google-connect` que NAO tem autenticacao (V3). Isso significa que:

1. Atacante inicia OAuth com phone qualquer (V3)
2. Google retorna authorization code
3. Atacante pode trocar o code por tokens usando as credenciais da SUA app Google
4. A funcao executa a troca `code → tokens` sem verificar quem chamou

### Complemento: google-calendar/index.ts
```typescript
// Linha 13 — Mesmo secret, mas neste caso a funcao TEM auth (JWT)
const googleClientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET')!;
```
Este uso e correto porque `google-calendar` exige JWT.

### Impacto
- Atacante pode obter tokens OAuth Google usando sua app como proxy
- Combinado com V3, permite hijack completo de calendarios VIP
- Se o Client Secret for revogado/rotacionado, TODAS conexoes Google quebram (regular + VIP)

### Fix
Este problema se resolve junto com V3. Se `vip-google-connect` tiver autenticacao, o Client Secret nao e mais acessivel publicamente.

**Adicionalmente:**
- Criar GOOGLE_CLIENT_SECRET separado para VIP (se VIP continuar existindo)
- Ou unificar VIP dentro do fluxo regular com auth JWT

---

<a id="v5"></a>
## V5 — Chave de criptografia hardcoded: `google_calendar_secret_key_2024`

### Onde (8+ arquivos)

**Definicao das funcoes (raiz do problema):**
```
/home/totalAssistente/site/supabase/migrations/20250911192627_*.sql  (linhas 9, 35)
/home/totalAssistente/site/supabase/migrations/20250911192705_*.sql  (linhas 9, 37)
/home/totalAssistente/site/supabase/migrations/20250911192746_*.sql
/home/totalAssistente/site/supabase/migrations/20250911192936_*.sql
```

**Uso da chave (chamadas com default):**
```
/home/totalAssistente/site/supabase/migrations/20251210034757_*.sql  (linhas 63-64, 73-74, 118-119)
/home/totalAssistente/site/supabase/migrations/20250912210505_*.sql
/home/totalAssistente/site/supabase/migrations/20250928031805_*.sql
```

### Codigo Vulneravel

**Definicao com DEFAULT hardcoded:**
```sql
-- Migration 20250911192627, Linha 9
CREATE OR REPLACE FUNCTION public.encrypt_token(
  token text,
  key_text text DEFAULT 'google_calendar_secret_key_2024'::text
)

-- Migration 20250911192627, Linha 35
CREATE OR REPLACE FUNCTION public.decrypt_token(
  encrypted_token text,
  key_text text DEFAULT 'google_calendar_secret_key_2024'::text
)
```

**Algoritmo de criptografia:**
```sql
-- Linhas 19-31
key_hash := digest(key_text, 'sha256');              -- SHA256 da string fixa
iv := gen_random_bytes(16);                           -- IV aleatorio (bom)
encrypted_data := encrypt(token::bytea, key_hash, 'aes-cbc');  -- AES-CBC
RETURN encode(key_hash_hex || '::' || iv_hex || '::' || base64_data);
```

**Chamadas que usam o default (sem passar chave):**
```sql
-- Migration 20251210034757, Linhas 63-64
public.encrypt_token(p_access_token, 'google_calendar_secret_key_2024'),
public.encrypt_token(p_refresh_token, 'google_calendar_secret_key_2024'),

-- Mesma migration, Linhas 118-119
public.encrypt_token(p_access_token, 'google_calendar_secret_key_2024'),
public.encrypt_token(p_refresh_token, 'google_calendar_secret_key_2024'),
```

### Como Explorar
Se atacante obtiver acesso ao banco (leak, backup, SQL injection via funcao SECURITY DEFINER com bug):

```sql
-- Descriptografar TODOS tokens Google de TODOS usuarios
SELECT
  user_id,
  decrypt_token(encrypted_access_token, 'google_calendar_secret_key_2024') as access_token,
  decrypt_token(encrypted_refresh_token, 'google_calendar_secret_key_2024') as refresh_token
FROM google_calendar_connections
WHERE is_connected = true;

-- Mesma coisa para VIP
SELECT
  phone,
  decrypt_token(encrypted_access_token, 'google_calendar_secret_key_2024') as access_token
FROM vip_google_connections;
```

Com os tokens:
```bash
# Acessar calendario de QUALQUER usuario
curl "https://www.googleapis.com/calendar/v3/calendars/primary/events" \
  -H "Authorization: Bearer <token_roubado>"

# Criar eventos no calendario da vitima
curl -X POST "https://www.googleapis.com/calendar/v3/calendars/primary/events" \
  -H "Authorization: Bearer <token_roubado>" \
  -H "Content-Type: application/json" \
  -d '{"summary": "Hackeado", "start": {"dateTime": "2026-03-11T10:00:00"}, "end": {"dateTime": "2026-03-11T11:00:00"}}'
```

### Impacto
- **TODOS os tokens Google de TODOS os usuarios** descriptografaveis com uma string que esta no codigo-fonte
- Acesso a leitura/escrita do Google Calendar de cada usuario conectado
- Refresh tokens permitem acesso indefinido (mesmo se access token expirar)
- Chave esta em 8+ migrations commited no repo — qualquer pessoa com acesso ao repo tem a chave

### Fix Proposto

**Fase 1 — Mover chave para env var (URGENTE):**
```sql
-- Alterar funcoes para buscar de vault ou env:
CREATE OR REPLACE FUNCTION public.encrypt_token(
  token text,
  key_text text DEFAULT current_setting('app.encryption_key')
)
```

```bash
# No Supabase Dashboard → Settings → Database → Custom Configuration:
app.encryption_key = '<chave_aleatoria_256_bits>'
```

**Fase 2 — Re-encriptar todos tokens com nova chave:**
```sql
-- Script de migracao (executar UMA vez, com cuidado):
UPDATE google_calendar_connections
SET
  encrypted_access_token = encrypt_token(
    decrypt_token(encrypted_access_token, 'google_calendar_secret_key_2024'),
    current_setting('app.encryption_key')
  ),
  encrypted_refresh_token = encrypt_token(
    decrypt_token(encrypted_refresh_token, 'google_calendar_secret_key_2024'),
    current_setting('app.encryption_key')
  )
WHERE encrypted_access_token IS NOT NULL;
```

**Fase 3 — Remover chave antiga de TODOS os arquivos:**
```bash
# Verificar que nenhum codigo referencia a chave antiga
grep -r "google_calendar_secret_key_2024" /home/totalAssistente/
```

---

## CHECKLIST DE RESOLUCAO

```
TIER 0 — Resolver ANTES do lancamento
==========================================

[ ] V1 — create-user-admin
    [ ] Adicionar auth admin OU deletar edge function
    [ ] Testar: curl sem auth → 401

[ ] V2 — sync-profile-to-auth
    [ ] Verificar se algo depende (grep no frontend)
    [ ] Deletar se nao usado OU proteger com auth admin
    [ ] Testar: curl sem auth → 401

[ ] V3 — vip-google-connect
    [ ] Decidir: feature VIP continua ou nao?
    [ ] Se sim: adicionar token temporario via WhatsApp
    [ ] Se nao: deletar edge function + tabelas calendar_vip, vip_google_connections
    [ ] Testar: curl com phone qualquer → 401

[ ] V4 — Google Client Secret em endpoint publico
    [ ] Se resolve junto com V3 (endpoint protegido = secret protegido)
    [ ] Verificar se google-calendar (o regular) esta protegido → SIM, tem JWT

[ ] V5 — Chave de criptografia hardcoded
    [ ] Criar chave nova (256 bits random) e setar como env var
    [ ] Alterar encrypt_token/decrypt_token para ler de env
    [ ] Re-encriptar todos tokens com nova chave
    [ ] Grep para garantir que 'google_calendar_secret_key_2024' nao aparece mais
    [ ] Testar: decrypt com chave antiga → falha
    [ ] Testar: decrypt com chave nova → sucesso
```

---

## NOTA SOBRE CORS

Todas as edge functions usam:
```typescript
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',  // ← QUALQUER site pode chamar
  'Access-Control-Allow-Headers': '...',
};
```

Isso amplifica TODAS as vulnerabilidades acima. Qualquer site malicioso pode fazer requests diretos.

**Fix complementar (aplicar em TODAS edge functions):**
```typescript
const ALLOWED_ORIGINS = [
  'https://totalassistente.com.br',
  'https://www.totalassistente.com.br',
];
const origin = req.headers.get('Origin') || '';
const corsHeaders = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
```
