# Feature 08 — VIP Calendar (Phone-Based)

## Resumo
Sistema de agenda paralelo para usuarios "VIP" que interagem exclusivamente via WhatsApp, sem conta no Total Assistente. Identificados por numero de telefone (nao por auth.users). Armazenado em tabelas separadas (`calendar_vip`, `vip_google_connections`).

## Arquitetura

```
WhatsApp → N8N → Supabase calendar_vip (phone-based)
                        ↕
              vip_google_connections (OAuth por phone)
                        ↕
              Google Calendar API (opcional)
```

### Tabelas dedicadas
- `calendar_vip`: Mesma estrutura de `calendar` mas com `phone` em vez de `user_id`
- `vip_google_connections`: Mesma estrutura de `google_calendar_connections` mas com `phone` UNIQUE

### Edge Function: vip-google-connect
Gerencia OAuth do Google para VIP (sem auth):
- `auth`: Gera URL OAuth (state = phone number)
- `callback`: Troca code por tokens, armazena via RPC `store_vip_google_connection`
- `status`: Verifica conexao por phone
- `disconnect`: Limpa tokens por phone

## Schema `calendar_vip`

| Coluna | Tipo | Descricao |
|--------|------|-----------|
| phone | TEXT NOT NULL | Identificador do VIP |
| event_name, desc_event, start/end_event | Mesmos de calendar | - |
| due_at, reminder, remembered, next_fire_at, last_fired_at | Mesmos | - |
| is_recurring, rrule, exdates, repeats_until | Mesmos | - |
| channel | TEXT | Canal de comunicacao |
| payload | JSONB DEFAULT '{}' | Dados extras |
| active | BOOLEAN DEFAULT true | - |

### RLS
```sql
-- Bloqueia acesso publico TOTAL
CREATE POLICY "Block all public access to calendar_vip"
ON calendar_vip FOR ALL TO public USING (false) WITH CHECK (false);
-- Apenas service_role (N8N/backend) acessa
```

### Indexes
- `idx_calendar_vip_phone` (phone)
- `idx_calendar_vip_phone_active` (phone, active)
- `idx_calendar_vip_next_fire` (next_fire_at) WHERE active=true AND reminder=true

## Edge Function: vip-google-connect — Detalhes

### Action: auth
- Input: `?action=auth&phone=5543999999999`
- Normaliza phone (strip non-digits)
- State: `encodeURIComponent(phone)` (INSEGURO — phone e o state)
- Retorna JSON com `auth_url` (nao redireciona — N8N envia URL via WhatsApp)
- Scopes: calendar, calendar.events, openid, email, profile (MAIS AMPLO que google-calendar)

### Action: callback
- Troca code por tokens
- Busca email via userinfo endpoint
- RPC `store_vip_google_connection(phone, access_token, refresh_token, expires_at, email)`
- Redirect para WhatsApp: `https://wa.me/554396435261?text=...`

### Action: status
- RPC `get_vip_connection_status(phone)`
- Retorna: is_connected, connected_email, connected_at, last_sync_at

### Action: disconnect
- UPDATE vip_google_connections SET is_connected=false, tokens=null WHERE phone

## Erros Conhecidos / Riscos CRITICOS

1. **ZERO autenticacao:** Qualquer pessoa que saiba um telefone pode:
   - Gerar link OAuth (`auth`)
   - Ver status de conexao (`status`)
   - Desconectar Google Calendar (`disconnect`)
2. **Phone como OAuth state:** Sem assinatura, sem criptografia. Atacante pode associar tokens Google a qualquer telefone.
3. **XSS no HTML de callback:** `renderErrorPage(message)` injeta mensagem sem escape no HTML.
4. **Sem revocacao de token no disconnect:** Ao contrario de `google-calendar`, nao revoga o token no Google.
5. **Dead code:** Funcao `renderSuccessRedirect` definida mas nunca chamada.
6. **WhatsApp number hardcoded:** `554396435261`
7. **Scopes excessivos:** Pede `openid email profile` alem de calendar — desnecessario.
