# Correcao Final - Google Calendar Sync Bidirecional

## Bugs Encontrados

### BUG 1 (CRITICO): Trigger fire-and-forget — Google Event ID nunca volta pro banco
- Quando voce cria evento no app, o trigger chama a edge function via `http_post`
- A edge function cria o evento no Google e recebe o `googleEventId`
- Mas **ninguem grava** esse ID de volta na coluna `session_event_id_google`
- Resultado: duplicatas no Google, impossivel atualizar/deletar eventos
- **Existia ANTES das mudancas de seguranca**

### BUG 2: Cron job usa anon key em vez de service_role_key
- O `pg_cron` envia a anon key no header Authorization
- A edge function `google-calendar-sync-cron` rejeita tudo que nao for service_role_key
- Resultado: sync periodico NUNCA funciona, webhooks nunca renovam (morrem em 7 dias)
- **Existia ANTES das mudancas de seguranca**

### BUG 3: Webhook nao fazia refresh de token expirado
- O `google-calendar-webhook` pegava o access_token direto sem verificar expiracao
- Token expira em 1 hora, webhook falhava com 401 do Google
- **Corrigido na Onda 2, incluido aqui tambem**

### BUG 4: Tokens com invalid_grant
- 17 de 18 users tem access_token expirado
- Alguns refresh_tokens podem ter sido revogados pelo Google
- **Solucao: users afetados reconectam (1 clique no app)**

---

## Ordem de Execucao

### PASSO 1 — SQL: Corrigir o trigger (write-back do Google Event ID)
1. Abra o SQL Editor no Supabase Dashboard
2. Cole o conteudo de `01-fix-trigger-writeback.sql`
3. Execute
4. Verifique: deve retornar "CREATE FUNCTION" e "CREATE TRIGGER"

### PASSO 2 — SQL: Corrigir o cron job (service_role_key)
1. Abra o SQL Editor
2. Cole o conteudo de `02-fix-cron-key.sql`
3. Execute
4. Verifique: deve retornar "schedule" com um ID

### PASSO 3 — Edge Function: google-calendar (write-back)
1. Abra o Supabase Dashboard > Edge Functions > google-calendar
2. Substitua TODO o conteudo pelo arquivo `03-google-calendar.ts`
3. Salve/Deploy

### PASSO 4 — Edge Function: google-calendar-webhook (token refresh)
1. Abra Edge Functions > google-calendar-webhook
2. Substitua TODO o conteudo pelo arquivo `04-google-calendar-webhook.ts`
3. Salve/Deploy

### PASSO 5 — Edge Function: google-calendar-sync-cron (sem mudanca, mas incluso)
1. Abra Edge Functions > google-calendar-sync-cron
2. Verifique se o conteudo bate com `05-google-calendar-sync-cron.ts`
3. Se diferente, substitua e deploy

### PASSO 6 — SQL: Identificar users que precisam reconectar
1. Abra o SQL Editor
2. Cole o conteudo de `06-check-users-status.sql`
3. Execute
4. Users com `needs_reconnect = true` precisam reconectar o Google Calendar

### PASSO 7 — Testar
1. Crie um evento no app Total Assistente
2. Verifique se aparece no Google Calendar (aguarde ~5 segundos)
3. Crie um evento no Google Calendar
4. Verifique se aparece no app (aguarde webhook ou proximo sync)
5. Edite um evento no app e veja se atualiza no Google
6. Delete um evento no app e veja se some do Google

### PASSO 8 — Verificar logs
```
-- No SQL Editor, verificar respostas do http_post:
SELECT status_code, LEFT(content, 200), created
FROM net._http_response
ORDER BY created DESC
LIMIT 10;
```
- Status 200 = sucesso
- Status 401 = problema de autenticacao
- Status 500 = erro na edge function
