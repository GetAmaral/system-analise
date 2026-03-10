# Testes — Criacao de Eventos

## Pre-requisitos
- Usuario premium/standard autenticado
- Supabase rodando (local ou producao)
- Google Calendar conectado (para testes de sync)

---

## T01 — Criar evento simples (frontend)
**Tipo:** Funcional
**Passos:**
1. Acessar /dashboard?tab=agenda
2. Clicar em slot vazio no calendario
3. Preencher: nome="Reuniao Teste", inicio=amanha 10:00, fim=amanha 11:00
4. Clicar Salvar

**Esperado:**
- [x] Evento aparece imediatamente no calendario (optimistic update)
- [x] Toast "Evento criado com sucesso"
- [x] Registro no Supabase: `SELECT * FROM calendar WHERE event_name = 'Reuniao Teste'`
- [x] `event_name` em INITCAP: "Reuniao Teste"
- [x] `reminder = true`, `remembered = false`
- [x] `due_at = start_event` (porque reminder=true)
- [x] `timezone = 'America/Sao_Paulo'`

**Validar no banco:**
```sql
SELECT id, event_name, start_event, end_event, due_at, reminder, remembered,
       connect_google, session_event_id_google, timezone
FROM calendar
WHERE user_id = '<user_id>'
ORDER BY created_at DESC
LIMIT 1;
```

---

## T02 — Criar evento com Google Calendar conectado
**Tipo:** Integracao
**Pre-req:** Google Calendar conectado (is_connected=true em google_calendar_connections)

**Passos:**
1. Criar evento pelo frontend (mesmo T01)
2. Verificar Google Calendar

**Esperado:**
- [x] Evento aparece no Google Calendar do usuario
- [x] `session_event_id_google` preenchido no Supabase
- [x] `connect_google = true`
- [x] Evento no Google tem timezone America/Sao_Paulo
- [x] extendedProperties.private.supabase_user_id preenchido

**Validar:**
```sql
SELECT session_event_id_google, connect_google
FROM calendar WHERE event_name = 'Reuniao Teste'
ORDER BY created_at DESC LIMIT 1;
```

---

## T03 — Criar evento recorrente (diario)
**Tipo:** Funcional

**Passos:**
1. Criar evento com toggle "Recorrente" ativado
2. Selecionar "Diario", repeats_until = 7 dias a frente

**Esperado:**
- [x] `is_recurring = true`
- [x] `rrule` contem `FREQ=DAILY;UNTIL=<data>`
- [x] FullCalendar mostra multiplas instancias no periodo
- [x] Titulo prefixado com icone de recorrencia

**Validar:**
```sql
SELECT is_recurring, rrule, repeats_until
FROM calendar WHERE event_name ILIKE '%teste recorrente%'
ORDER BY created_at DESC LIMIT 1;
```

---

## T04 — Criar evento recorrente (semanal)
**Tipo:** Funcional
**Mesmos passos de T03 com tipo "Semanal"**
**Esperado:** `rrule` contem `FREQ=WEEKLY`

---

## T05 — Criar evento recorrente (mensal)
**Tipo:** Funcional
**Esperado:** `rrule` contem `FREQ=MONTHLY`

---

## T06 — Validacao: nome vazio
**Tipo:** Validacao negativa
**Passos:** Tentar salvar evento sem nome
**Esperado:**
- [x] Toast de erro "Nome obrigatorio"
- [x] Evento NAO criado no banco

---

## T07 — Validacao: data fim antes de data inicio
**Tipo:** Validacao negativa
**Passos:** Definir end < start
**Esperado:**
- [x] Toast "A data de fim deve ser posterior ao inicio"
- [x] Evento NAO criado

---

## T08 — Validacao: nome > 200 caracteres
**Tipo:** Validacao negativa
**Passos:** Inserir nome com 201+ caracteres
**Esperado:**
- [x] Toast "Nome muito longo"
- [x] Evento NAO criado

---

## T09 — Criar evento via N8N webhook
**Tipo:** Integracao
**Passos:**
```bash
curl -X POST https://totalassistente.com.br/webhook/5e0f5e77-aea5-4784-8a85-58e8eaf49c30 \
  -u "<avelum_user>:<avelum_pass>" \
  -H "Content-Type: application/json" \
  -d '{
    "nome_evento": "Teste N8N",
    "descricao_evento": "Criado via webhook",
    "data_inicio_evento": "2026-03-11T14:00:00-03:00",
    "data_fim_evento": "2026-03-11T15:00:00-03:00",
    "id_user": "<user_uuid>"
  }'
```

**Esperado:**
- [x] Response contem "sucesso"
- [x] Registro no Supabase com event_name = "Teste N8n" (INITCAP)
- [x] Se Google conectado: session_event_id_google preenchido

**PRECISO DE:** Credenciais Basic Auth do Avelum Credential para executar este teste.

---

## T10 — Criar evento como usuario free
**Tipo:** Seguranca
**Passos:** Tentar INSERT direto no Supabase com token de usuario free

**Esperado:**
- [x] RLS bloqueia: "new row violates row-level security policy"
- [x] Frontend mostra PlanBlocker

**Validar:**
```sql
-- Com token de usuario free:
INSERT INTO calendar (user_id, event_name, start_event, end_event)
VALUES ('<free_user_id>', 'Hack', now(), now() + interval '1 hour');
-- Deve falhar com RLS violation
```

---

## T11 — Criar evento sem autenticacao
**Tipo:** Seguranca
**Passos:** Chamar Supabase REST API sem token

**Esperado:**
- [x] 401 Unauthorized

---

## T12 — Trigger due_at calcula corretamente
**Tipo:** Unitario (banco)
**Passos:**
```sql
-- Evento com reminder=true
INSERT INTO calendar (user_id, event_name, start_event, end_event, reminder)
VALUES ('<premium_user>', 'Due Test 1', '2026-03-15 10:00:00-03', '2026-03-15 11:00:00-03', true);

SELECT due_at FROM calendar WHERE event_name = 'Due Test 1';
-- Esperado: due_at = start_event (2026-03-15 10:00:00-03)

-- Evento com reminder=false
INSERT INTO calendar (user_id, event_name, start_event, end_event, reminder)
VALUES ('<premium_user>', 'Due Test 2', '2026-03-15 10:00:00-03', '2026-03-15 11:00:00-03', false);

SELECT due_at FROM calendar WHERE event_name = 'Due Test 2';
-- Esperado: due_at = start_event - 30min (2026-03-15 09:30:00-03)
```

---

## T13 — Trigger capitalize funciona
**Tipo:** Unitario (banco)
```sql
INSERT INTO calendar (user_id, event_name, start_event, end_event)
VALUES ('<premium_user>', 'teste minusculo', now(), now() + interval '1h');

SELECT event_name FROM calendar WHERE event_name = 'Teste Minusculo';
-- Esperado: INITCAP aplicado
```

---

## T14 — Performance: tempo de criacao
**Tipo:** Performance
**Passos:** Medir tempo entre clique em Salvar e aparicao no calendario
**Esperado:**
- [x] < 500ms para optimistic update
- [x] < 3s para confirmacao do banco
- [x] < 5s para sync com Google (se conectado)

---

## T15 — Concorrencia: criar dois eventos simultaneos
**Tipo:** Stress
**Passos:** Abrir duas abas, criar evento em cada uma ao mesmo tempo
**Esperado:**
- [x] Ambos eventos criados corretamente
- [x] Sem duplicatas
- [x] Real-time listener atualiza ambas abas
