# PROGRESSO TIER 0 — Historia da Correcao de Seguranca

**Data:** 2026-03-12
**Sistema:** Total Assistente
**Executor:** GetAmaral + Sherlock (AI)
**Status geral:** ~70% concluido — CORS e criptografia feitos, faltam passos 3, 4 e limpeza

---

## O QUE FOI FEITO

### PASSO 1 — CORS (CONCLUIDO + DEPLOY)

Todas as 14 edge functions foram atualizadas:

| Function | Template | Status |
|----------|----------|--------|
| check-email-exists | Padrao | FEITO + DEPLOY |
| create-checkout | Padrao | FEITO + DEPLOY |
| create-user-admin | Padrao | FEITO + DEPLOY |
| delete-account | Padrao (+Content-Type) | FEITO + DEPLOY |
| fetch-market-data | Padrao | FEITO + DEPLOY |
| google-calendar | Padrao | FEITO + DEPLOY |
| google-calendar-sync-cron | Padrao | FEITO + DEPLOY |
| google-calendar-webhook | Google (x-goog-*) | FEITO + DEPLOY |
| hotmart-webhook | Hotmart (x-hotmart-hottok) | FEITO + DEPLOY |
| start-otp-login | Padrao | FEITO + DEPLOY |
| sync-profile-to-auth | Padrao | FEITO + DEPLOY |
| unlink-phone | Padrao | FEITO + DEPLOY |
| verify-otp-secure | Padrao | FEITO + DEPLOY |
| vip-google-connect | Padrao | FEITO + DEPLOY |

**Problema encontrado durante implementacao:**
- `google-calendar.ts` tem funcoes helper (handleAuth, handleCallback, etc.) definidas FORA do serve() handler. A variavel `cors` era local dentro do handler e nao era acessivel por essas funcoes. Corrigido passando `cors` como primeiro parametro para as 8 funcoes helper.

**Arquivos no GitHub:** `edge-functions-cors-fix/` contem todas as versoes corrigidas.

---

### PASSO 2 — create-user-admin (CONCLUIDO + DEPLOY)

**Decisao:** NAO deletar a funcao. O usuario precisa dela para criar contas via sistema externo.

**Solucao aplicada:** Adicionada verificacao de `ADMIN_API_SECRET` via header Authorization Bearer.

- Sem chave → 401 "Nao autorizado"
- Com chave correta → funciona normal

**Pendencia:** O usuario precisa:
1. Criar o secret no Supabase: `ADMIN_API_SECRET`
2. Atualizar o sistema externo para enviar `Authorization: Bearer <chave>`

---

### PASSO 5 — Rotacao de Chave de Criptografia (CONCLUIDO COM DIFICULDADES)

Este foi o passo mais complexo. Resumo cronologico dos problemas e solucoes:

#### Problema 1: ALTER DATABASE nao funciona no Supabase managed
- `ALTER DATABASE postgres SET app.encryption_key = '...'` → ERRO: permission denied
- **Solucao:** Usamos o Vault do Supabase (`vault.create_secret`)

#### Problema 2: Subquery no DEFAULT de funcao SQL
- `key_text text DEFAULT (SELECT ... FROM vault.decrypted_secrets ...)` → ERRO: cannot use subquery in DEFAULT
- **Solucao:** Usamos `DEFAULT NULL` + `COALESCE` dentro do body da funcao

#### Problema 3: Parametro com nome diferente
- `CREATE OR REPLACE FUNCTION encrypt_token(token text, ...)` → ERRO: cannot change name of input parameter "plain"
- **Solucao:** `DROP FUNCTION` antes de recriar

#### Problema 4: pgcrypto no schema extensions
- `digest(actual_key, 'sha256')` → ERRO: function digest(text, unknown) does not exist
- **Solucao:** Usar `extensions.digest(actual_key::bytea, 'sha256')` e `SET search_path = public, extensions`

#### Problema 5: Tokens em texto puro (nao criptografados)
- Descoberta: os tokens no banco estavam como `ya29.a0ATko...` (texto puro do Google), NAO criptografados
- O encrypt nunca tinha sido aplicado nos dados reais
- **Solucao:** Criptografar direto (sem decrypt da chave antiga)

#### Problema 6: Base64 com quebras de linha
- PostgreSQL `encode(..., 'base64')` adiciona `\n` a cada 76 caracteres
- N8N enviava tokens com `\n` no meio → decrypt falhava
- **Solucao:** `REPLACE(encode(..., 'base64'), chr(10), '')` na funcao encrypt_token + UPDATE nos tokens existentes

#### Problema 7: Tokens corrompidos por multiplas tentativas
- Tokens foram criptografados 2x por causa de UPDATEs repetidos
- Backup foi essencial para restaurar
- **Solucao:** Restaurar do backup + refazer com cuidado

#### Problema 8: Vault inacessivel via REST API (N8N)
- `decrypt_token_json` funcionava no SQL Editor mas nao via RPC do N8N
- O role usado pelo N8N nao conseguia ler `vault.decrypted_secrets`
- **Solucao:** Criamos tabela `app_config` com a chave + RLS habilitado (sem policies = inacessivel via API REST, so via SECURITY DEFINER)

#### Problema 9: User novo conectou durante a migracao
- 1 user conectou Google Calendar durante o processo → token criptografado com chave antiga
- Backup nao o continha (foi criado depois)
- **Solucao:** `decrypt_token(token, 'google_calendar_secret_key_2024')` + re-encrypt com chave nova

#### Estado final da criptografia:
- **17 tokens** migrados com sucesso (16 do backup + 1 novo user)
- **Chave nova** armazenada em: `vault.secrets` + `app_config`
- **Funcoes SQL:** `encrypt_token`, `decrypt_token`, `decrypt_token_json` — todas leem da `app_config`
- **N8N:** nodes enviam `key_text` explicitamente no body (necessario porque RPC nao le app_config pelo role do N8N)
- **decrypt_token_json** retorna JSON: `{"token": "1//0h..."}`

---

## O QUE FALTA FAZER

### PASSO 3 — Eliminar sync-profile-to-auth + Trigger (NAO FEITO)

A pasta `/supabase/functions/sync-profile-to-auth/` ainda existe.
O `config.toml` ainda tem `[functions.sync-profile-to-auth] verify_jwt = false`.

**Acao necessaria:**
1. Rodar no SQL Editor:
   ```sql
   DROP TRIGGER IF EXISTS on_profile_created_sync_auth ON public.profiles;
   DROP FUNCTION IF EXISTS public.sync_profile_to_auth();
   ```
2. Remover do config.toml
3. Deletar a pasta da funcao
4. Deploy

### PASSO 4 — Desabilitar vip-google-connect (NAO FEITO)

A pasta `/supabase/functions/vip-google-connect/` ainda existe.
O `config.toml` ainda tem `[functions.vip-google-connect] verify_jwt = false`.

**Acao necessaria:**
1. Remover do config.toml
2. Deletar a pasta da funcao
3. Deploy

### PASSO 5.4 Bloco D — CRITICO: Funcoes SQL com chave antiga hardcoded (NAO FEITO)

As funcoes SQL que ESCREVEM tokens (quando usuario conecta Google Calendar) ainda usam `google_calendar_secret_key_2024` hardcoded. Isso significa que:
- **Usuarios EXISTENTES:** tokens ja migrados → OK
- **Usuarios NOVOS que conectarem agora:** tokens serao criptografados com chave ANTIGA → N8N nao vai conseguir descriptografar

**Funcoes que precisam ser atualizadas:**
```sql
SELECT routine_name, routine_definition
FROM information_schema.routines
WHERE routine_definition LIKE '%google_calendar_secret_key_2024%'
AND routine_schema = 'public';
```

Cada funcao que retornar precisa ter o parametro de chave removido (para usar o default da `app_config`).

Funcoes provaveis:
- `store_google_connection`
- `store_access_token`
- `secure_get_google_tokens`
- `store_vip_google_connection`
- `get_vip_google_tokens`

### PASSO 6 — Verificacao Final (NAO FEITO)

Checklist completo no GUIA-DE-CORRECAO.md.

---

## DECISOES TOMADAS

1. **create-user-admin:** Proteger com API key em vez de deletar (usuario precisa para sistema externo)
2. **Vault vs app_config:** Vault nao funciona via REST API do N8N. Usamos tabela app_config com RLS como alternativa
3. **N8N key_text:** Nodes enviam chave explicitamente no body. Nao e ideal mas funciona — N8N e servidor privado
4. **decrypt_token_json retorna JSON:** Mudamos de `RETURNS text` para `RETURNS json` com `json_build_object('token', decrypted)` para compatibilidade com N8N

---

## RISCOS ATIVOS

### RISCO ALTO: Funcoes SQL com chave antiga
Qualquer usuario que conectar Google Calendar AGORA tera tokens criptografados com a chave antiga. O N8N (que usa chave nova) nao vai conseguir descriptografar.
**Mitigacao:** Atualizar as funcoes SQL do Bloco D o mais rapido possivel.

### RISCO MEDIO: sync-profile-to-auth exposta
A funcao ainda esta acessivel e lista todos os usuarios sem autenticacao.
**Mitigacao:** Executar Passo 3.

### RISCO BAIXO: vip-google-connect exposta
A funcao ainda esta acessivel mas VIP nao esta em uso.
**Mitigacao:** Executar Passo 4.

---

## ARQUIVOS DE REFERENCIA

| Arquivo | Descricao |
|---------|-----------|
| `tier-0-critico/GUIA-DE-CORRECAO.md` | Guia passo a passo completo (v2) |
| `tier-0-critico/FALHAS-ENCONTRADAS-GUIA-v1.md` | 12 falhas encontradas no guia original |
| `tier-0-critico/VULNERABILIDADES-TIER-0.md` | Documento original de vulnerabilidades |
| `tier-0-critico/PROGRESSO-TIER0.md` | Este documento |
| `edge-functions-cors-fix/` | Todas as 14 edge functions corrigidas |
| `visao-geral-sistema/ARQUITETURA-COMPLETA.md` | Arquitetura do sistema para onboarding |

---

## PROXIMA SESSAO — PRIORIDADES

1. **[URGENTE]** Atualizar funcoes SQL que ainda usam `google_calendar_secret_key_2024` (Bloco D)
2. **[ALTO]** Executar Passo 3 (remover sync-profile-to-auth)
3. **[ALTO]** Executar Passo 4 (remover vip-google-connect)
4. **[MEDIO]** Executar Passo 6 (verificacao final completa)
5. **[MEDIO]** Atualizar config.toml removendo entradas de funcoes deletadas
6. **[BAIXO]** Iniciar TIER 1 (HMAC hotmart, rate limit, etc.)
