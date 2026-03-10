# Testes — Modificacao de Compromissos

## T01 — Editar nome do evento (frontend)
**Passos:** Clicar evento → alterar nome → Salvar
**Esperado:**
- [x] Nome atualizado no calendario (optimistic)
- [x] INITCAP aplicado pelo trigger
- [x] Se Google conectado: nome atualizado no Google Calendar

---

## T02 — Editar horario do evento
**Passos:** Clicar evento → alterar start/end → Salvar
**Esperado:**
- [x] Horario atualizado
- [x] due_at recalculado pelo trigger

---

## T03 — Drag & Drop evento simples
**Passos:** Arrastar evento para outro horario
**Esperado:**
- [x] start_event e end_event atualizados
- [x] Duracao mantida
- [x] Google sync se conectado

---

## T04 — Resize evento
**Passos:** Arrastar borda inferior do evento para estender
**Esperado:**
- [x] end_event atualizado
- [x] start_event inalterado

---

## T05 — Editar evento recorrente (todos)
**Passos:** Clicar evento recorrente → alterar nome → Salvar
**Esperado:**
- [x] TODAS as ocorrencias atualizadas
- [x] RRULE mantido

---

## T06 — Drag & Drop evento recorrente
**Tipo:** Regressao / Known issue
**Passos:** Arrastar uma ocorrencia de evento recorrente
**Esperado (comportamento ATUAL):**
- [x] Evento MASTER e modificado (todas ocorrencias mudam)
**Esperado (comportamento IDEAL):**
- [ ] Apenas a ocorrencia arrastada muda (excecao criada)

---

## T07 — Validacao: data fim antes de inicio
**Passos:** Editar e colocar end < start
**Esperado:**
- [x] Toast "A data de fim deve ser posterior..."
- [x] Update NAO salvo

---

## T08 — Editar via N8N webhook
**Tipo:** Integracao
```bash
curl -X POST https://totalassistente.com.br/webhook/editar-eventos \
  -u "<avelum_user>:<avelum_pass>" \
  -H "Content-Type: application/json" \
  -d '{
    "nome_evento": "Reuniao Teste",
    "user_id": "<user_uuid>",
    "novo_nome_evento": "Reuniao Atualizada",
    "novo_inicio_evento": "2026-03-12T14:00:00-03:00",
    "novo_fim_evento": "2026-03-12T15:30:00-03:00"
  }'
```

**Esperado:**
- [x] AI encontra o evento com score >= 0.90
- [x] Evento atualizado no Supabase e Google

**PRECISO DE:** Credenciais Avelum.

---

## T09 — N8N: ambiguidade (multiplos matches)
**Passos:** Buscar com criterio generico que matcha 2+ eventos
**Esperado:**
- [x] Response retorna lista dos matches para escolha
- [x] Nenhum evento modificado

---

## T10 — Editar evento de outro usuario
**Tipo:** Seguranca
**Passos:** Tentar UPDATE com user_id de outro usuario via Supabase
**Esperado:**
- [x] RLS bloqueia: 0 rows updated

---

## T11 — Concorrencia: edits simultaneos
**Tipo:** Stress
**Passos:** Duas abas editam o mesmo evento ao mesmo tempo
**Esperado (atual):**
- [x] Ultimo a salvar vence (last-write-wins)
- [x] Sem erro, mas dados podem ser inconsistentes
