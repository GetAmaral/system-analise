# Feature 06 — Lembretes Recorrentes

## Resumo
Sistema de lembretes com suporte a recorrencia (RRULE) e notificacao via WhatsApp. Inclui: criacao de lembrete unico, criacao de lembrete recorrente, scheduler de dispatch (50s poll), e notificacao de eventos proximos (30 min).

## Fluxos

### A. Criar lembrete unico (N8N)
```
POST /webhook/criar-lembrete-total (Basic Auth)
  Body: { nome_lembrete, inicio_lembrete, fim_lembrete, user_id }

  1. Map fields: summary, start, end, user_id
  2. Check Google connection
  3. Se Google: decrypt → refresh → POST Google Calendar API
  4. INSERT calendar:
     - reminder = TRUE
     - remembered = FALSE
     - connect_google = true/false
```

### B. Criar lembrete recorrente (N8N)
```
POST /webhook/criar-lembrete-recorrente-total (Basic Auth)
  Body: { nome_lembrete, rrule, dtstart, timezone, until, exdates, description, user_id }

  1. Valida campos obrigatorios (rrule, dtstart, user_id)
  2. Calcula end = dtstart + 15 min
  3. Injeta UNTIL no RRULE
  4. Monta recurrence array: ["RRULE:...", "EXDATE;TZID=...:..."]
  5. Se Google: POST Google Calendar API com recurrence
  6. INSERT calendar: is_recurring=TRUE, rrule, timezone, reminder=TRUE
```

### C. Scheduler — dispatch de lembretes (N8N)
```
Schedule Trigger: cada 50 segundos

  1. Supabase GetAll: calendar WHERE
     reminder = TRUE AND remembered = FALSE AND
     due_at >= now()-1min AND due_at <= now()+1min

  2. Loop por item:
     a. Fetch profiles (name, phone)
     b. Check plan_status = true
     c. Monta mensagem (lembrete vs evento)
     d. Verifica remembered != true (double check)
     e. Envia WhatsApp via Graph API (template lembrar_usuario_lembretes)
     f. UPDATE calendar SET remembered = TRUE
     g. Redis SET key=phone, value=texto, TTL=3600
```

### D. Notificacao de eventos proximos (30 min)
```
Schedule Trigger: cada 1 minuto

  1. Supabase GetAll: calendar WHERE
     reminder = FALSE AND remembered = FALSE AND
     start_event > now() AND start_event < now()+30min

  2. Mesmo fluxo de dispatch (template eventos_em_breve)
```

### E. Reset de recorrentes (SQL Procedure)
```sql
CALL reset_recurring_reminders()
-- Executada via pg_cron ou manualmente
-- Para cada evento recorrente ativo com remembered=true:
--   Calcula next_occurrence baseado no RRULE
--   Se next < UNTIL (ou sem UNTIL): SET remembered=false, due_at=next, next_fire_at=next
--   Se next >= UNTIL: SET active=false
-- Opera em AMBAS tabelas: calendar e calendar_vip
```

## Funcoes SQL Envolvidas

| Funcao | Descricao |
|--------|-----------|
| `next_occurrence(rrule, last_fired, tz)` | Calcula proxima data baseada em FREQ, BYDAY, BYMONTHDAY, BYSETPOS |
| `byday_to_dow_array(byday)` | Converte "MO,WE,FR" → array de DOW integers |
| `last_day_of_month(date)` | Ultimo dia do mes |
| `rrule_get_component(rrule, key)` | Extrai componente do RRULE string |
| `reset_recurring_reminders()` | PROCEDURE que reseta lembretes recorrentes |
| `reset_recurring_reminders_fn()` | Wrapper FUNCTION para pg_cron |
| `calendar_set_due_at()` | Trigger: calcula due_at |

## Triggers

| Trigger | Tabela | Descricao |
|---------|--------|-----------|
| `calendar_set_due_at` | calendar | Se reminder=true: due_at=start_event. Se false: due_at=start_event-30min |
| `calendar_vip_set_due_at` | calendar_vip | Mesma logica |

## Templates WhatsApp

| Template | Uso |
|----------|-----|
| `lembrar_usuario_lembretes` | Lembrete due NOW |
| `eventos_em_breve` | Evento em 30 min |

## Valores Hardcoded

| Valor | Local | Impacto |
|-------|-------|---------|
| Poll 50s | N8N Schedule Trigger | Trade-off precisao vs carga |
| Poll 1min | N8N Schedule Trigger (eventos) | OK |
| due_at window +-1min | N8N Supabase filter | Pode perder lembretes se poll atrasa |
| 30 min antecedencia | N8N eventos proximos | Nao configuravel pelo usuario |
| end = start + 15min | N8N lembrete recorrente | Duracao fixa |
| Redis TTL 3600s | N8N | Cache de 1h por telefone |
| WhatsApp Phone ID 744582292082931 | N8N | Hardcoded |

## Erros Conhecidos / Riscos

1. **Janela de +-1 min:** Se o N8N scheduler atrasa > 1 min, o lembrete e perdido. Nao ha retry.
2. **Sem deduplicacao de notificacao:** Se o scheduler rodar duas vezes no mesmo minuto, pode enviar duplicado (Redis ajuda mas nao e checado antes do envio).
3. **plan_status check:** Se o plano expirar entre a criacao e o dispatch, a notificacao nao e enviada. O usuario criou o lembrete mas nao recebera.
4. **WhatsApp template deve estar aprovado:** Se Meta desaprovar o template, todas notificacoes falham.
5. **Legacy: Google Calendar hardcoded (MarcioAuth):** Referencia a calendario pessoal de desenvolvedor ainda existe no workflow (desconectada do fluxo principal, mas presente).
