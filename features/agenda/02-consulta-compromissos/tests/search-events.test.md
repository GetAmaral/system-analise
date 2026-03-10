# Testes — Consulta de Compromissos

## T01 — Visualizar eventos no calendario (frontend)
**Tipo:** Funcional
**Passos:**
1. Login como premium
2. Acessar /dashboard?tab=agenda
3. Ter pelo menos 3 eventos criados previamente

**Esperado:**
- [x] Todos eventos do usuario aparecem no FullCalendar
- [x] Eventos nao-recorrentes: bloco verde
- [x] Lembretes: bloco magenta (#FF00FF)
- [x] Recorrentes: prefixo de seta circular no titulo

---

## T02 — Filtrar por tipo (eventos vs lembretes)
**Tipo:** Funcional
**Passos:**
1. Selecionar filtro "Eventos" no dropdown
2. Verificar que apenas eventos com reminder=false aparecem
3. Selecionar "Lembretes"
4. Verificar que apenas reminder=true aparecem

**Esperado:**
- [x] Filtragem instantanea (client-side)
- [x] Contagem no UI corresponde ao filtro

---

## T03 — Buscar por nome (frontend)
**Tipo:** Funcional
**Passos:**
1. Digitar parte do nome de um evento no campo de busca
2. Verificar sugestoes e filtragem

**Esperado:**
- [x] Ate 5 sugestoes aparecem
- [x] Eventos filtrados no calendario
- [x] Case-insensitive

---

## T04 — Navegar entre views (dia/semana/mes)
**Tipo:** Funcional
**Passos:** Alternar entre Dia, Semana, Mes

**Esperado:**
- [x] Eventos reposicionados corretamente
- [x] Em mobile: default e Dia
- [x] Em desktop: default e Semana

---

## T05 — Swipe no mobile
**Tipo:** Funcional (mobile)
**Passos:** Em tela < 768px, fazer swipe left/right

**Esperado:**
- [x] Navega para proximo/anterior periodo
- [x] Titulo atualizado

---

## T06 — Buscar via N8N webhook
**Tipo:** Integracao
```bash
curl -X POST https://totalassistente.com.br/webhook/busca-total-evento \
  -u "<avelum_user>:<avelum_pass>" \
  -H "Content-Type: application/json" \
  -d '{
    "nome_evento": "reuniao",
    "data_inicio_evento": "2026-03-01T00:00:00-03:00",
    "data_fim_evento": "2026-03-31T23:59:59-03:00",
    "user_id": "<user_uuid>"
  }'
```

**Esperado:**
- [x] Response contem array de eventos com score >= 0.90
- [x] Cada item tem: uuid, nome, descricao, inicio_evento, fim_evento, pontuacao

**PRECISO DE:** Credenciais Basic Auth do Avelum para executar.

---

## T07 — Buscar sem criterios (retorna todos)
**Tipo:** Integracao
```bash
curl -X POST https://totalassistente.com.br/webhook/busca-total-evento \
  -u "<avelum_user>:<avelum_pass>" \
  -H "Content-Type: application/json" \
  -d '{ "user_id": "<user_uuid>" }'
```

**Esperado:**
- [x] Retorna todos eventos do usuario com score 1.0

---

## T08 — Buscar sem user_id
**Tipo:** Validacao negativa
**Esperado:**
- [x] Response: `{ "erro": "nao conseguimos buscar." }`

---

## T09 — Real-time: outro dispositivo cria evento
**Tipo:** Integracao
**Passos:**
1. Abrir Calendar em aba A
2. Em aba B, criar novo evento
3. Observar aba A

**Esperado:**
- [x] Evento aparece em aba A sem refresh manual
- [x] Delay < 2s

---

## T10 — Evento recorrente expande corretamente
**Tipo:** Funcional
**Passos:**
1. Criar evento diario por 7 dias
2. Verificar calendario na view Semana

**Esperado:**
- [x] 7 instancias visiveis
- [x] Cada uma clicavel e editavel
- [x] RRULE nao duplica prefixo ("RRULE:RRULE:...")

---

## T11 — Evento recorrente com exdate
**Tipo:** Funcional
**Passos:**
1. Criar evento diario por 7 dias
2. Excluir uma unica ocorrencia (quarta-feira)
3. Verificar calendario

**Esperado:**
- [x] 6 instancias visiveis (quarta ausente)
- [x] exdates contem a data excluida

---

## T12 — Performance: usuario com 500+ eventos
**Tipo:** Performance
**Passos:** Medir tempo de carregamento do calendario

**Esperado:**
- [x] Render inicial < 3s
- [x] Navegacao entre periodos < 500ms
- [x] Sem travamento em scroll

---

## T13 — Usuario free tenta acessar agenda
**Tipo:** Seguranca
**Passos:** Login como free, acessar /dashboard?tab=agenda

**Esperado:**
- [x] PlanBlocker exibido
- [x] Nenhum dado de calendario carregado (RLS bloqueia SELECT)
