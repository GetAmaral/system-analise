# Testes — Fluxo Premium

## T01 — Texto: criar gasto via WhatsApp
**Tipo:** Integracao
**Passos:** Enviar "Gastei 50 reais no mercado hoje"

**Esperado:**
- [ ] AI classifica como criar_gasto
- [ ] Tool registrar_gasto chamada
- [ ] Registro criado em spent com category_spent='Mercado', value_spent=50
- [ ] Resposta confirmando criacao

---

## T02 — Texto: buscar gastos
**Tipo:** Integracao
**Passos:** Enviar "Quanto gastei esse mes?"

**Esperado:**
- [ ] AI classifica como buscar
- [ ] Tool buscar_financeiro chamada
- [ ] Resposta com resumo de gastos

---

## T03 — Texto: criar evento
**Tipo:** Integracao
**Passos:** Enviar "Agendar reuniao amanha as 14h"

**Esperado:**
- [ ] Tool criar_evento_agenda chamada
- [ ] Evento criado no calendar
- [ ] Resposta confirmando

---

## T04 — Texto: criar limite
**Tipo:** Integracao
**Passos:** Enviar "Quero gastar no maximo 500 em alimentacao"

**Esperado:**
- [ ] Tool criar_limite chamada
- [ ] Limite criado em category_limits

---

## T05 — Texto: relatorio mensal
**Tipo:** Integracao
**Passos:** Enviar "Me manda o relatorio do mes"

**Esperado:**
- [ ] Classifica como relatorio_mensal
- [ ] Trigger do workflow de relatorios
- [ ] PDF enviado via WhatsApp

---

## T06 — Contexto mantido (Redis memory)
**Tipo:** Funcional
**Passos:**
1. Enviar "Gastei 30 no uber"
2. Enviar "Na verdade foi 35"

**Esperado:**
- [ ] Segundo mensaje entende contexto da primeira
- [ ] Gasto editado para 35

---

## T07 — Sessao expirada (1h TTL)
**Tipo:** Funcional
**Passos:**
1. Enviar mensagem
2. Aguardar 65 minutos
3. Enviar "O que falamos antes?"

**Esperado:**
- [ ] Sem contexto da conversa anterior
- [ ] Resposta generica

---

## T08 — Resposta via Evolution API
**Tipo:** Integracao
**Passos:** Enviar qualquer mensagem

**Esperado:**
- [ ] Resposta enviada via Evolution API (POST /message/sendText/mordomo)
- [ ] Formatacao com emojis corretos

---

## T09 — Think tool (reasoning)
**Tipo:** Funcional
**Passos:** Enviar pergunta complexa que requer raciocinio

**Esperado:**
- [ ] AI usa Think tool internamente
- [ ] Resposta final coerente

---

## T10 — Webhook auth: Avelum credential
**Tipo:** Seguranca
**Passos:** Chamar webhook de tool sem Basic Auth

**Esperado:**
- [ ] 401 Unauthorized
