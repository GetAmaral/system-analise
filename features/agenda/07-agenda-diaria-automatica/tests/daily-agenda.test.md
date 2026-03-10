# Testes — Agenda Diaria Automatica

## T01 — Premium recebe agenda as 7h
**Tipo:** Integracao (requer aguardar 7h ou trigger manual)
**Passos:**
1. Usuario premium com eventos para o dia
2. Aguardar 7h (ou executar workflow manualmente)

**Esperado:**
- [x] WhatsApp recebido com lista de eventos do dia
- [x] Formato: "Bom dia, <nome>! Sua agenda para hoje: ..."

---

## T02 — Premium sem eventos recebe mensagem
**Passos:** Usuario premium sem eventos para o dia
**Esperado:**
- [x] Mensagem "Sua agenda esta livre hoje!" ou similar

---

## T03 — Standard NAO recebe agenda
**Tipo:** Seguranca de plano
**Passos:** Usuario standard com eventos para o dia
**Esperado:**
- [x] NAO recebe WhatsApp (filtro current_plan LIKE 'premium%')

---

## T04 — Premium expirado < 7 dias recebe
**Tipo:** Grace period
**Passos:** Premium com end_date = 3 dias atras
**Esperado:**
- [x] Ainda recebe (grace period de 7 dias)

---

## T05 — Premium expirado > 7 dias NAO recebe
**Passos:** Premium com end_date = 10 dias atras
**Esperado:**
- [x] Filtrado pela query, NAO recebe

---

## T06 — Evento recorrente aparece na agenda (BUG KNOWN)
**Tipo:** Bug/Regressao
**Cenario:** Evento diario criado segunda, hoje e quarta
**Esperado (ATUAL):**
- [x] Evento NAO aparece (query pega start_event do master, nao ocorrencias expandidas)
**Esperado (IDEAL):**
- [ ] Evento aparece como ocorrencia do dia

---

## T07 — Performance: 500 usuarios premium
**Tipo:** Performance
**Passos:** Simular 500 usuarios premium com eventos
**Esperado:**
- [x] Todos recebem dentro de 15 minutos
- [x] Sem timeout no N8N
