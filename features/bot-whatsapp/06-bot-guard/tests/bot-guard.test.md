# Testes — Bot Guard

## T01 — Delivery receipt ignorado
**Tipo:** Funcional
**Passos:** Simular payload com status="delivered"

**Esperado:**
- [ ] Nao processa como mensagem
- [ ] Nenhuma resposta enviada

---

## T02 — Read receipt ignorado
**Tipo:** Funcional
**Passos:** Simular payload com status="read"

**Esperado:**
- [ ] Ignorado

---

## T03 — Mensagem encaminhada bloqueada
**Tipo:** Funcional
**Passos:** Encaminhar mensagem para o bot

**Esperado:**
- [ ] Mensagem ignorada

---

## T04 — Self-message bloqueada
**Tipo:** Funcional
**Passos:** Bot recebe mensagem do proprio numero

**Esperado:**
- [ ] Ignorada (recipient_id filter)

---

## T05 — Debounce: 2 mensagens em 500ms
**Tipo:** Anti-spam
**Passos:** Enviar "Oi" e "Tudo bem?" com 500ms de intervalo

**Esperado:**
- [ ] Apenas primeira processada
- [ ] Segunda ignorada pelo debounce

---

## T06 — Debounce: 2 mensagens com 5s intervalo
**Tipo:** Anti-spam
**Passos:** Enviar 2 mensagens com 5 segundos de intervalo

**Esperado:**
- [ ] Ambas processadas (debounce expirou)

---

## T07 — Sem rate limit horario (VULNERAVEL)
**Tipo:** Seguranca
**Passos:** Enviar 50 mensagens em 10 minutos (espaçadas o suficiente para passar debounce)

**Esperado (ATUAL):**
- [ ] Todas 50 processadas (sem rate limit)
**Esperado (IDEAL):**
- [ ] Bloqueado apos ~30 mensagens/hora

---

## T08 — Sem blacklist
**Tipo:** Seguranca
**Passos:** Verificar se existe mecanismo de bloqueio de numero

**Esperado (ATUAL):**
- [ ] Nao existe
**Esperado (IDEAL):**
- [ ] Tabela blocked_phones consultada no guard
