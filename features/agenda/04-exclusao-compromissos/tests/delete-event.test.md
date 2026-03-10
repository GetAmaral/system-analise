# Testes — Exclusao de Compromissos

## T01 — Excluir evento simples (frontend)
**Passos:** Clicar evento → Delete → Confirmar
**Esperado:**
- [x] Evento desaparece imediatamente (optimistic)
- [x] `SELECT FROM calendar WHERE id = X` retorna 0 rows
- [x] Se Google: evento removido do Google Calendar

---

## T02 — Excluir evento com Google sync
**Tipo:** Integracao
**Passos:** Excluir evento que tem session_event_id_google
**Esperado:**
- [x] DELETE enviado para Google Calendar API
- [x] Registro removido do Supabase

**Validar:**
```sql
SELECT count(*) FROM calendar WHERE id = '<event_id>';
-- Esperado: 0
```

---

## T03 — Excluir todas ocorrencias de recorrente
**Passos:** Clicar ocorrencia → "Excluir todas as ocorrencias"
**Esperado:**
- [x] Registro master deletado
- [x] TODAS ocorrencias desaparecem do calendario
- [x] Google event deletado se conectado

---

## T04 — Excluir ocorrencia unica de recorrente
**Passos:** Clicar uma ocorrencia → "Excluir apenas esta ocorrencia"
**Esperado:**
- [x] Registro master PERMANECE
- [x] exdates contem a data da ocorrencia excluida
- [x] Ocorrencia nao aparece mais no calendario
- [x] Outras ocorrencias permanecem

**Validar:**
```sql
SELECT exdates FROM calendar WHERE id = '<event_id>';
-- Esperado: array contem a data excluida
```

---

## T05 — Excluir via N8N webhook
**Tipo:** Integracao
```bash
curl -X POST https://totalassistente.com.br/webhook/excluir-evento-total \
  -u "<avelum_user>:<avelum_pass>" \
  -H "Content-Type: application/json" \
  -d '{ "event_id": "<uuid>", "user_id": "<user_uuid>" }'
```

**Esperado:**
- [x] Response com sucesso
- [x] Evento removido do Supabase e Google

**PRECISO DE:** Credenciais Avelum.

---

## T06 — Excluir evento de outro usuario
**Tipo:** Seguranca
**Passos:** Chamar DELETE com event_id de outro usuario
**Esperado:**
- [x] RLS bloqueia: 0 rows affected
- [x] Evento original intacto

---

## T07 — Excluir evento inexistente
**Tipo:** Edge case
**Passos:** Chamar delete com UUID aleatorio
**Esperado:**
- [x] Sem erro (0 rows deleted)
- [x] Toast de erro no frontend

---

## T08 — Exclusao de ocorrencia com mesmo dia, horarios diferentes
**Tipo:** Bug known
**Cenario:** Evento recorre 2x no dia (08:00 e 14:00). Excluir ocorrencia das 08:00.
**Esperado (comportamento ATUAL):**
- [x] toDateString() match exclui AMBAS ocorrencias do mesmo dia
**Esperado (comportamento IDEAL):**
- [ ] Apenas a ocorrencia das 08:00 e excluida

---

## T09 — Double-click no botao excluir
**Tipo:** Stress
**Passos:** Clicar Delete rapidamente duas vezes
**Esperado:**
- [x] isDeleting state previne segunda chamada
- [x] Sem duplicacao de delete requests

---

## T10 — Excluir ultimo evento do usuario
**Tipo:** Edge case
**Passos:** Excluir o unico evento existente
**Esperado:**
- [x] Calendario mostra estado vazio
- [x] Sem erro
