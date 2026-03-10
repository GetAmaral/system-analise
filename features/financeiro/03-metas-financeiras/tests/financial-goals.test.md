# Testes — Metas Financeiras

## T01 — Definir meta de renda
**Tipo:** Funcional
**Passos:** Editar estimated_monthly_income = R$ 5.000

**Esperado:**
- [ ] profiles.estimated_monthly_income = 5000.00
- [ ] Card de meta de renda exibido

---

## T02 — Definir meta de saldo
**Tipo:** Funcional
**Passos:** Editar balance_goal = R$ 10.000

**Esperado:**
- [ ] profiles.balance_goal = 10000.00
- [ ] Card de meta de saldo exibido

---

## T03 — Progresso de renda calculado
**Tipo:** Funcional
**Pre-req:** Meta renda = R$ 5.000, receitas do mes = R$ 3.500

**Esperado:**
- [ ] Progress bar = 70%

---

## T04 — Alerta dia 25 com renda baixa
**Tipo:** Funcional
**Pre-req:** Meta renda = R$ 5.000, receitas = R$ 3.000, dia >= 25

**Esperado:**
- [ ] Alerta visual exibido (3000 < 75% de 5000 = 3750)

---

## T05 — Sem alerta antes do dia 25
**Tipo:** Funcional
**Pre-req:** Mesmos valores, dia < 25

**Esperado:**
- [ ] Sem alerta (ainda ha tempo)

---

## T06 — Meta de saldo atingida
**Tipo:** Funcional
**Pre-req:** Meta saldo = R$ 10.000, balance = R$ 12.000

**Esperado:**
- [ ] Mensagem "Meta Atingida!"
- [ ] Cor verde

---

## T07 — Ambas metas = 0 esconde cards
**Tipo:** Visual
**Passos:** Definir ambas metas como 0

**Esperado:**
- [ ] FinancialGoalsCard nao renderiza

---

## T08 — RLS: nao acessar metas de outro usuario
**Tipo:** Seguranca

**Esperado:**
- [ ] profiles filtrado por auth.uid() = id

---

## T09 — Plano Free bloqueado
**Tipo:** Acesso

**Esperado:**
- [ ] PlanBlocker exibido
