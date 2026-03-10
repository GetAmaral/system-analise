# Testes — Sincronizacao Google Calendar

## T01 — Conectar Google Calendar (frontend)
**Tipo:** Integracao
**Passos:**
1. Login como premium
2. Clicar "Conectar Google Calendar" no sidebar
3. Autorizar no Google
4. Verificar redirect de sucesso

**Esperado:**
- [x] Popup/redirect para Google OAuth
- [x] Apos autorizacao: success=true no callback
- [x] google_calendar_connections: is_connected=true, encrypted_refresh_token preenchido
- [x] Sync inicial comeca em background

**Validar:**
```sql
SELECT is_connected, connected_email, last_sync_at, webhook_id
FROM google_calendar_connections
WHERE user_id = '<user_id>';
```

---

## T02 — Sync inicial importa eventos
**Tipo:** Integracao
**Pre-req:** Google Calendar com eventos
**Passos:** Conectar Google Calendar

**Esperado:**
- [x] Eventos do Google aparecem no calendario do Total
- [x] session_event_id_google preenchido em cada evento importado
- [x] connect_google = true
- [x] Eventos all-day NAO importados

**Validar:**
```sql
SELECT count(*) FROM calendar
WHERE user_id = '<user_id>' AND session_event_id_google IS NOT NULL;
```

---

## T03 — Sync manual (botao Sincronizar)
**Tipo:** Funcional
**Passos:** Clicar "Sincronizar"
**Esperado:**
- [x] Toast loading "Sincronizando..."
- [x] Novos eventos do Google aparecem
- [x] last_sync_at atualizado

---

## T04 — Rate limit no sync manual (5 min)
**Tipo:** Funcional
**Passos:** Clicar "Sincronizar" duas vezes em < 5 min
**Esperado:**
- [x] Segunda tentativa: 429 com retryAfter
- [x] Toast de aviso

---

## T05 — Criar evento no Total → aparece no Google
**Tipo:** Integracao bidirecional
**Passos:**
1. Criar evento no frontend com Google conectado
2. Verificar Google Calendar

**Esperado:**
- [x] Evento aparece no Google Calendar
- [x] extendedProperties.private.supabase_user_id preenchido

---

## T06 — Criar evento no Google → aparece no Total
**Tipo:** Integracao bidirecional
**Passos:**
1. Criar evento diretamente no Google Calendar
2. Aguardar webhook push OU fazer sync manual

**Esperado:**
- [x] Evento aparece no calendario do Total
- [x] session_event_id_google = ID do Google

---

## T07 — Editar evento no Google → atualiza no Total
**Tipo:** Integracao
**Passos:** Editar nome de evento no Google Calendar
**Esperado:**
- [x] Nome atualizado no Total apos sync

---

## T08 — Deletar evento no Google → remove do Total
**Tipo:** Integracao
**Passos:** Deletar evento no Google Calendar
**Esperado:**
- [x] Evento removido do Total apos sync

---

## T09 — Desconectar Google Calendar
**Tipo:** Funcional
**Passos:** Clicar "Desconectar"
**Esperado:**
- [x] is_connected = false
- [x] Tokens limpos do banco
- [x] Eventos Google-only removidos (via remove_google_calendar_events RPC)
- [x] Webhook cancelado no Google

**Validar:**
```sql
SELECT is_connected, encrypted_refresh_token, webhook_id
FROM google_calendar_connections WHERE user_id = '<user_id>';
-- is_connected = false, tokens = null, webhook = null
```

---

## T10 — Webhook push funciona
**Tipo:** Integracao
**Passos:**
1. Verificar webhook_id e resource_id no banco
2. Criar/editar evento no Google
3. Observar logs da Edge Function google-calendar-webhook

**Esperado:**
- [x] Edge Function recebe notificacao com x-goog-channel-id
- [x] performIncrementalSync executa
- [x] Evento atualizado no Total

**PRECISO DE:** Acesso a logs da Edge Function (Supabase Dashboard ou CLI).

---

## T11 — Cron sync funciona (30 min)
**Tipo:** Integracao
**Passos:** Verificar execucao do cron

**Esperado:**
- [x] pg_cron job `google-calendar-sync-every-30m` executa
- [x] Usuarios com conexao ativa sao sincronizados
- [x] Webhooks proximo de expirar sao renovados

**Validar:**
```sql
SELECT * FROM cron.job WHERE jobname = 'google-calendar-sync-every-30m';
```

---

## T12 — Token expirado e refreshado
**Tipo:** Integracao
**Passos:** Esperar access_token expirar (1h) → triggerar sync

**Esperado:**
- [x] Edge Function detecta token expirado
- [x] POST oauth2.googleapis.com/token com refresh_token
- [x] Novo access_token armazenado
- [x] Sync continua normalmente

---

## T13 — Webhook handler com token expirado (BUG KNOWN)
**Tipo:** Bug/Regressao
**Passos:** Esperar access_token expirar → Google envia webhook push
**Esperado (ATUAL):**
- [x] google-calendar-webhook NAO refresha token
- [x] Google API retorna 401
- [x] Sync falha silenciosamente
**Esperado (IDEAL):**
- [ ] Token e refreshado antes da sync

---

## T14 — Seguranca: chamar cron sem auth
**Tipo:** Seguranca
```bash
curl https://<supabase_url>/functions/v1/google-calendar-sync-cron
```
**Esperado (ATUAL):**
- [x] Funcao executa sem auth (VULNERAVEL)
**Esperado (IDEAL):**
- [ ] 401 sem token valido

---

## T15 — Seguranca: forjar webhook
**Tipo:** Seguranca
```bash
curl -X POST https://<supabase_url>/functions/v1/google-calendar-webhook \
  -H "x-goog-channel-id: <known_id>" \
  -H "x-goog-resource-id: <known_id>" \
  -H "x-goog-resource-state: exists"
```
**Esperado (ATUAL):**
- [x] Sync dispara sem verificacao (VULNERAVEL)
**Esperado (IDEAL):**
- [ ] Verificacao de X-Goog-Channel-Token
