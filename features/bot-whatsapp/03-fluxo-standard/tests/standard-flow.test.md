# Testes — Fluxo Standard

## T01 — Standard tem acesso a criar gasto (BUG)
**Tipo:** Seguranca/Billing
**Passos:** Usuario standard envia "Gastei 50 no mercado"

**Esperado (ATUAL):**
- [ ] Gasto criado normalmente (BYPASS de billing)
**Esperado (IDEAL):**
- [ ] Gasto criado (standard tem acesso a despesas)

---

## T02 — Standard tem acesso a criar limite (BUG)
**Tipo:** Seguranca/Billing
**Passos:** Usuario standard envia "Quero limite de 500 em alimentacao"

**Esperado (ATUAL):**
- [ ] Limite criado (BYPASS — limites sao premium-only no frontend)
**Esperado (IDEAL):**
- [ ] Resposta: "Feature disponivel apenas no plano Premium"

---

## T03 — Free tem acesso a criar evento (BUG)
**Tipo:** Seguranca/Billing
**Passos:** Usuario free envia "Agendar reuniao amanha"

**Esperado (ATUAL):**
- [ ] Evento criado (BYPASS — calendario e pago no frontend)
**Esperado (IDEAL):**
- [ ] Resposta: "Faca upgrade para acessar o calendario"

---

## T04 — Standard tem acesso a OCR (BUG)
**Tipo:** Seguranca/Billing
**Passos:** Usuario standard envia foto de nota fiscal

**Esperado (ATUAL):**
- [ ] OCR processado normalmente
**Esperado (IDEAL):**
- [ ] Feature premium-only bloqueada

---

## T05 — Standard tem acesso a relatorio (BUG)
**Tipo:** Seguranca/Billing
**Passos:** Usuario standard envia "Manda meu relatorio do mes"

**Esperado (ATUAL):**
- [ ] Relatorio gerado e enviado
**Esperado (IDEAL):**
- [ ] Feature premium-only bloqueada

---

## T06 — Verificar diferencas reais entre workflows
**Tipo:** Arquitetura
**Passos:** Comparar nodes dos workflows Premium e Standard

**Esperado (IDEAL):**
- [ ] Standard com menos tools
- [ ] Free com tools basicas apenas
