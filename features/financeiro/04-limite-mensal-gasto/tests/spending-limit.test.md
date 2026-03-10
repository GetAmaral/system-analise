# Testes — Limite Mensal de Gasto

## T01 — Default 1000 aplicado
**Tipo:** Funcional
**Passos:** Novo usuario sem value_limit configurado

**Esperado:**
- [ ] profiles.value_limit = 1000.0

---

## T02 — Atualizar limite
**Tipo:** Funcional
**Passos:** Alterar value_limit para R$ 3.000

**Esperado:**
- [ ] profiles.value_limit = 3000.0
- [ ] Percentual recalculado

---

## T03 — Warning 80%
**Tipo:** Visual
**Pre-req:** Limite = R$ 1.000, gastos = R$ 850

**Esperado:**
- [ ] Banner amarelo de aviso exibido (85%)

---

## T04 — Limite excedido
**Tipo:** Visual
**Pre-req:** Limite = R$ 1.000, gastos = R$ 1.200

**Esperado:**
- [ ] Indicacao visual de limite excedido (120%)
- [ ] Remaining amount = R$ 0

---

## T05 — Nao bloqueia insert (BUG KNOWN)
**Tipo:** Bug
**Passos:** Com limite excedido, criar nova despesa

**Esperado (ATUAL):**
- [ ] Despesa criada normalmente
**Esperado (IDEAL):**
- [ ] Warning com confirmacao antes de salvar

---

## T06 — RLS: nao alterar limite de outro usuario
**Tipo:** Seguranca

**Esperado:**
- [ ] profiles.value_limit protegido por auth.uid() = id
