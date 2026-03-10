# Critica Arquitetural — Sync Google Calendar

## Pontos Positivos
- Sync bidirecional completa: Google → Total e Total → Google
- Tokens criptografados no banco (nao plaintext)
- Rate limiting no acesso a tokens (50 req/hr)
- Webhook push para real-time (sem polling constante)
- syncToken para sync incremental (eficiente)
- Cron como fallback se webhook falha
- Loop prevention no trigger

## Problemas Criticos

### 1. OAuth sem PKCE ou state assinado
O state parameter e `btoa(JSON.stringify({userId, origin}))`. Qualquer atacante pode:
- Gerar um state com o userId da vitima
- Iniciar OAuth flow
- Associar seus proprios tokens ao userId da vitima

**Recomendacao:** Assinar state com HMAC ou usar PKCE (code_verifier/code_challenge).

### 2. Webhook sem verificacao de assinatura
Google recomenda usar `X-Goog-Channel-Token` para validar webhooks. O sistema aceita qualquer request que tenha channel_id e resource_id validos.

**Recomendacao:** Gerar token secreto no setup e verificar no webhook handler.

### 3. Codigo duplicado entre Edge Functions
`processEventChange` e `performIncrementalSync` existem em DUAS Edge Functions com diferencas sutis:
- google-calendar: refresha tokens
- google-calendar-webhook: NAO refresha tokens (bug)

**Recomendacao:** Extrair para modulo compartilhado ou ter o webhook chamar a Edge Function principal.

### 4. Recursao sem limite no 410
Se o Google API persistir retornando 410, o codigo entra em recursao infinita.

**Recomendacao:** Adicionar maxRetries (ex: 3).

### 5. Trigger HTTP call sincrono
O trigger `sync_calendar_event_to_google` faz HTTP call para Edge Function dentro de uma transacao SQL. Se a Edge Function demorar, a transacao fica bloqueada.

**Recomendacao:** Usar queue/fila asssincrona em vez de HTTP call sincrono no trigger.

### 6. Duas chaves de criptografia
- Edge Functions usam service_role_key derivada
- N8N usa `google_calendar_secret_key_2024` hardcoded

Dois mecanismos de criptografia para os mesmos dados.

**Recomendacao:** Unificar. Usar apenas RPCs para acesso a tokens.

## Escalabilidade

| Aspecto | Limite | Gargalo |
|---------|--------|---------|
| Usuarios Google conectados | Sem limite | Cron batch de 10 |
| Sync inicial | 500 eventos max | Google API quota |
| Webhook latencia | ~1-5s (Google → Edge Function) | Supabase cold start |
| Webhooks simultaneos | ~100 (Supabase Edge Functions) | Concurrency limit |
| Token refresh | 50 req/hr por usuario | Rate limit no RPC |
