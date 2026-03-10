# Testes — Lembretes Recorrentes

## T01 — Criar lembrete unico via N8N
**Tipo:** Integracao
```bash
curl -X POST https://totalassistente.com.br/webhook/criar-lembrete-total \
  -u "<avelum_user>:<avelum_pass>" \
  -H "Content-Type: application/json" \
  -d '{
    "nome_lembrete": "Tomar remedio",
    "inicio_lembrete": "2026-03-11T08:00:00-03:00",
    "fim_lembrete": "2026-03-11T08:15:00-03:00",
    "user_id": "<user_uuid>"
  }'
```
**Esperado:**
- [x] Registro criado com reminder=TRUE, remembered=FALSE
- [x] due_at = start_event (trigger calendar_set_due_at)
- [x] Se Google: evento criado no Google Calendar

**PRECISO DE:** Credenciais Avelum.

---

## T02 — Criar lembrete recorrente (diario)
```bash
curl -X POST https://totalassistente.com.br/webhook/criar-lembrete-recorrente-total \
  -u "<avelum_user>:<avelum_pass>" \
  -H "Content-Type: application/json" \
  -d '{
    "nome_lembrete": "Standup",
    "rrule": "FREQ=DAILY",
    "dtstart": "2026-03-11T09:00:00-03:00",
    "until": "2026-03-18T09:00:00-03:00",
    "user_id": "<user_uuid>"
  }'
```
**Esperado:**
- [x] is_recurring=TRUE, rrule contem FREQ=DAILY;UNTIL=...
- [x] end_event = start + 15 min
- [x] Se Google: evento recorrente criado

---

## T03 — Scheduler dispara lembrete no horario
**Tipo:** Integracao (requer aguardar o momento)
**Passos:**
1. Criar lembrete para daqui 2 minutos
2. Aguardar execucao do scheduler

**Esperado:**
- [x] WhatsApp recebido com template lembrar_usuario_lembretes
- [x] remembered = TRUE no banco
- [x] Redis tem key=phone com texto

---

## T04 — Scheduler dispara evento em 30 min
**Tipo:** Integracao
**Passos:** Criar evento (reminder=false) para daqui 20 min
**Esperado:**
- [x] WhatsApp recebido com template eventos_em_breve
- [x] remembered = TRUE

---

## T05 — Lembrete com plano expirado NAO dispara
**Tipo:** Seguranca
**Cenario:** Lembrete due NOW, mas plan_status = false
**Esperado:**
- [x] Scheduler pula o item (If plan_status check)
- [x] WhatsApp NAO enviado

---

## T06 — Reset de recorrentes funciona
**Tipo:** Unitario (banco)
```sql
-- Simular lembrete recorrente ja disparado
UPDATE calendar SET remembered = true, last_fired_at = now()
WHERE id = '<recorrente_id>';

-- Executar reset
SELECT reset_recurring_reminders_fn();

-- Verificar
SELECT remembered, due_at, next_fire_at FROM calendar WHERE id = '<recorrente_id>';
-- Esperado: remembered=false, due_at e next_fire_at = proxima ocorrencia
```

---

## T07 — next_occurrence calcula corretamente (DAILY)
**Tipo:** Unitario (banco)
```sql
SELECT next_occurrence('FREQ=DAILY', '2026-03-10 09:00:00-03', 'America/Sao_Paulo');
-- Esperado: 2026-03-11 09:00:00-03
```

---

## T08 — next_occurrence calcula corretamente (WEEKLY BYDAY)
```sql
SELECT next_occurrence('FREQ=WEEKLY;BYDAY=MO,WE,FR', '2026-03-10 09:00:00-03', 'America/Sao_Paulo');
-- 2026-03-10 e terça. Esperado: 2026-03-11 (quarta) 09:00
```

---

## T09 — next_occurrence calcula corretamente (MONTHLY)
```sql
SELECT next_occurrence('FREQ=MONTHLY;BYMONTHDAY=15', '2026-03-10 09:00:00-03', 'America/Sao_Paulo');
-- Esperado: 2026-03-15 09:00:00-03
```

---

## T10 — Recorrente com UNTIL atinge limite
**Tipo:** Unitario
```sql
-- Lembrete com UNTIL = ontem
-- Executar reset
-- Esperado: active = false
```

---

## T11 — Lembrete ja disparado nao re-dispara
**Tipo:** Funcional
**Cenario:** remembered=TRUE, scheduler roda
**Esperado:** Item filtrado pela query (remembered=FALSE)

---

## T12 — Performance: 1000 lembretes ativos
**Tipo:** Performance
**Passos:** Criar 1000 lembretes com due_at proximo
**Esperado:**
- [x] Scheduler processa em < 30s
- [x] Sem timeout no N8N

---

## T13 — WhatsApp template invalido
**Tipo:** Edge case
**Cenario:** Template `lembrar_usuario_lembretes` desaprovado pela Meta
**Esperado:**
- [x] HTTP 400 do Graph API
- [x] remembered NAO deveria ser setado como TRUE (comportamento ATUAL: e setado ANTES do envio — BUG)
