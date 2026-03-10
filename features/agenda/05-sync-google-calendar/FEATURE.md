# Feature 05 — Sincronizacao Bidirecional Google Calendar

## Resumo
Sincronizacao completa entre a agenda do Total e Google Calendar. Suporta: conexao OAuth, sync inicial, sync incremental (via syncToken), webhooks push (real-time do Google), sync bidirecional via trigger SQL, e cron job de 30 min.

## Arquitetura da Sync

```
                    ┌──────────────┐
                    │ Google       │
                    │ Calendar API │
                    └──────┬───────┘
                           │
          ┌────────────────┼────────────────┐
          │                │                │
    Webhook push     API calls        Token refresh
    (real-time)      (CRUD)          (OAuth2)
          │                │                │
          ▼                ▼                ▼
┌─────────────────┐ ┌──────────────┐ ┌──────────────┐
│google-calendar- │ │google-       │ │oauth2.google │
│webhook          │ │calendar      │ │apis.com/token│
│(Edge Function)  │ │(Edge Function│ │              │
└────────┬────────┘ └──────┬───────┘ └──────────────┘
         │                 │
         └────────┬────────┘
                  │
         ┌────────▼────────┐
         │   Supabase      │
         │   calendar      │
         │   table         │
         └────────┬────────┘
                  │ AFTER INSERT/UPDATE/DELETE
         ┌────────▼────────┐
         │ Trigger:        │
         │ sync_calendar_  │
         │ event_to_google │
         └────────┬────────┘
                  │ http_post → Edge Function
                  │ (loop prevention via
                  │  session_event_id_google)
                  ▼
         Google Calendar API
```

## Fluxo OAuth (Conexao)

### Via Frontend
```
1. Usuario clica "Conectar" → GoogleCalendarConnection.tsx
2. Hook abre popup/redirect para:
   GET {SUPABASE_URL}/functions/v1/google-calendar?userId={uuid}
3. Edge Function redireciona para:
   accounts.google.com/o/oauth2/v2/auth
   (scope: calendar, access_type: offline, prompt: consent)
4. Google retorna code → callback na Edge Function
5. Edge Function:
   a. POST oauth2.googleapis.com/token (code exchange)
   b. RPC store_google_connection (tokens criptografados)
   c. Background: performInitialSync + setupGoogleWebhook
6. Redirect para /auth/google-calendar?success=true
7. GoogleCalendarCallback.tsx: postMessage para janela pai
```

### State parameter
- Encoding: `btoa(JSON.stringify({ userId, origin }))`
- **NAO assinado, NAO criptografado** — atacante pode forjar

## Tipos de Sync

### 1. Sync Inicial (primeira conexao)
- Busca eventos: passado 1 mes a futuro 6 meses
- Max 500 eventos por pagina
- Batch insert de 100 em 100
- Pula eventos all-day (sem dateTime)
- Salva syncToken para incrementais futuras

### 2. Sync Incremental (mudancas)
- Usa syncToken do Google
- Retorna apenas eventos alterados desde ultimo sync
- Max 250 por pagina
- Se 410 (token expirado): limpa sync_token, retenta (sem limite de profundidade!)
- processEventChange: cancelled → DELETE, existente → UPDATE se mudou, novo → INSERT

### 3. Webhook Push (real-time do Google)
- Edge Function google-calendar-webhook recebe notificacoes do Google
- Headers: x-goog-channel-id, x-goog-resource-id, x-goog-resource-state
- state='sync': confirmacao de setup (200 OK)
- state='exists': mudancas disponiveis → performIncrementalSync em background
- **BUG:** Webhook handler NAO faz refresh de token expirado

### 4. Trigger Bidirecional (Total → Google)
```sql
-- Trigger AFTER INSERT/UPDATE/DELETE on calendar
CREATE TRIGGER tr_sync_calendar_to_google
  → sync_calendar_event_to_google()
    → extensions.http_post(edge_function_url, payload)
    → Loop prevention: skips se session_event_id_google changed
```

### 5. Cron Job (fallback)
- pg_cron executa a cada 30 minutos
- Chama Edge Function google-calendar-sync-cron
- Processa em batches de 10 usuarios
- Pula usuarios sincronizados < 10 min atras
- Renova webhooks se < 24h para expirar

## Token Management

| Operacao | RPC | Detalhes |
|----------|-----|---------|
| Armazenar | `store_google_connection` | Criptografa access+refresh tokens via encrypt_token() |
| Ler | `secure_get_google_tokens` | Decriptografa, rate-limited (50 req/hr) |
| Refresh | `store_access_token` | Atualiza access_token apos refresh |
| Audit | `log_failed_token_access` | Loga tentativas falhas |
| Reset | `reset_failed_token_access` | Reseta contador apos sucesso |

### Criptografia
- Algoritmo: XOR com SHA-256 do key
- Formato armazenado: `key_hash::iv::base64_token`
- Key: derivada de `SUPABASE_SERVICE_ROLE_KEY` (em RPCs) ou `google_calendar_secret_key_2024` (em N8N)

## Webhook Setup
```
POST googleapis.com/calendar/v3/calendars/primary/events/watch
Body: {
  id: crypto.randomUUID(),
  type: 'web_hook',
  address: '{SUPABASE_URL}/functions/v1/google-calendar-webhook',
  expiration: Date.now() + 7 days
}
→ Salva webhook_id, webhook_resource_id, webhook_expiration em google_calendar_connections
```

## Erros Conhecidos / Riscos

1. **OAuth state nao assinado:** Atacante pode criar state com userId arbitrario
2. **Webhook sem HMAC:** Qualquer um que saiba channel_id + resource_id pode triggerar sync
3. **Webhook handler nao refresha token:** Se access_token expirou, sync falha silenciosamente
4. **Retry 410 sem limite:** Recursao infinita se API persistir com 410
5. **CORS *** em todos endpoints: Permite chamadas de qualquer origem
6. **Sync cron sem auth:** Endpoint publico que triggera sync de todos usuarios
7. **Rate limit 5min no sync manual:** Pode frustrar usuario em emergencia
8. **Eventos all-day ignorados:** Google all-day events nao sincronizam
9. **Duas implementacoes de processEventChange:** google-calendar e google-calendar-webhook tem duplicacao com diferencas sutis
