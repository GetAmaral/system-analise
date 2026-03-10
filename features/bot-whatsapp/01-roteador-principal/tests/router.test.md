# Testes — Roteador Principal

## T01 — Mensagem texto roteia para Premium
**Tipo:** Integracao
**Pre-req:** Usuario premium com phone cadastrado
**Passos:** Enviar "Ola" via WhatsApp

**Esperado:**
- [ ] Mensagem processada pelo workflow Premium
- [ ] Resposta recebida via WhatsApp

---

## T02 — Mensagem texto roteia para Standard
**Tipo:** Integracao
**Pre-req:** Usuario standard/free

**Esperado:**
- [ ] Roteia para workflow Standard

---

## T03 — Delivery receipt filtrado
**Tipo:** Bot guard
**Passos:** Simular payload com status="delivered"

**Esperado:**
- [ ] Mensagem ignorada (nao processada)

---

## T04 — Mensagem encaminhada filtrada
**Tipo:** Bot guard
**Passos:** Encaminhar mensagem para o bot

**Esperado:**
- [ ] Mensagem ignorada (forwarded=true)

---

## T05 — Debounce: mensagens rapidas
**Tipo:** Bot guard
**Passos:** Enviar 3 mensagens em 1 segundo

**Esperado:**
- [ ] Apenas 1 processada (debounce Redis)
- [ ] 2 ignoradas

---

## T06 — Novo contato: onboarding
**Tipo:** Funcional
**Passos:** Primeiro contato de numero desconhecido

**Esperado:**
- [ ] Registro criado em phones_whatsapp com stg=1
- [ ] Mensagem de boas-vindas enviada

---

## T07 — 7AM schedule: agenda diaria
**Tipo:** Integracao
**Passos:** Verificar execucao as 7h BRT

**Esperado:**
- [ ] Usuarios premium com eventos recebem agenda
- [ ] Standard/free nao recebem

---

## T08 — Bot nao responde a si mesmo
**Tipo:** Bot guard
**Passos:** Verificar filtro de recipient_id

**Esperado:**
- [ ] Mensagens do proprio bot ignoradas
