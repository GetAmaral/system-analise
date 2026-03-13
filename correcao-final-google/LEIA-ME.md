# Correcao Final - Google Calendar Sync Bidirecional

## Bugs Corrigidos

| Bug | Descricao | Impacto |
|-----|-----------|---------|
| BUG 1 | Trigger fire-and-forget: Google Event ID nunca voltava pro banco | Duplicatas, impossivel editar/deletar |
| BUG 2 | Cron usava anon key em vez de service_role_key | Sync periodico nunca funcionou |
| BUG 3 | Webhook nao fazia refresh de token expirado | 401 do Google apos 1 hora |
| BUG 4 | performInitialSync nao paginava (buscava 500 de milhares) | sync_token nunca salvo, full sync infinito |

## Ordem de Execucao

### PASSO 1 — Edge Function: google-calendar (PRIMEIRO!)
> Precisa estar no ar antes do trigger, senao o trigger chama a versao antiga

1. Supabase Dashboard > Edge Functions > **google-calendar**
2. Substitua TODO o conteudo pelo arquivo **`03-google-calendar.ts`**
3. Salve/Deploy
4. **Mudancas**: write-back do Google Event ID + performInitialSync com paginacao

### PASSO 2 — Edge Function: google-calendar-webhook
1. Edge Functions > **google-calendar-webhook**
2. Substitua TODO o conteudo pelo arquivo **`04-google-calendar-webhook.ts`**
3. Salve/Deploy
4. **Mudanca**: token refresh automatico

### PASSO 3 — SQL: Corrigir o trigger
1. SQL Editor > cole o conteudo de **`01-fix-trigger-writeback.sql`**
2. Execute
3. Deve retornar: CREATE FUNCTION + CREATE TRIGGER
4. **Mudanca**: trigger envia `localEventId` para a edge function fazer write-back

### PASSO 4 — SQL: Corrigir o cron job
1. SQL Editor > cole o conteudo de **`02-fix-cron-key.sql`**
2. Execute
3. Deve retornar: unschedule + schedule
4. **Mudanca**: cron usa service_role_key do vault

### PASSO 5 — Verificar
1. SQL Editor > cole o conteudo de **`06-check-users-status.sql`**
2. Execute
3. Veja o status de cada user

### PASSO 6 — Testar
1. Crie um evento no app Total > veja se aparece no Google Calendar (~5s)
2. Crie um evento no Google Calendar > veja se aparece no app (~10s)
3. Edite um evento no app > veja se atualiza no Google
4. Delete um evento no app > veja se some do Google

### PASSO 7 — Limpar
1. Delete a edge function **fix-all-users-sync** (temporaria, ja usada)
2. Remova do config.toml: `[functions.fix-all-users-sync]`

## Arquivos

| Arquivo | Onde aplicar | Tipo |
|---------|-------------|------|
| `01-fix-trigger-writeback.sql` | SQL Editor | SQL |
| `02-fix-cron-key.sql` | SQL Editor | SQL |
| `03-google-calendar.ts` | Edge Functions > google-calendar | Edge Function |
| `04-google-calendar-webhook.ts` | Edge Functions > google-calendar-webhook | Edge Function |
| `05-google-calendar-sync-cron.ts` | Edge Functions > google-calendar-sync-cron (referencia) | Edge Function |
| `06-check-users-status.sql` | SQL Editor (diagnostico) | SQL |
| `07-fix-all-users-sync.ts` | Ja foi usada, pode deletar | Temporaria |

## Users que precisam reconectar (1 clique no app)
- `6d647cd8` — refresh_token revogado pelo Google (invalid_grant)
- `d51eea91` — Google retornou 403 (possivel revogacao de acesso)
