# Testes — Limites por Categoria

## T01 — Criar limite para categoria
**Tipo:** Funcional
**Passos:**
1. Login como Premium
2. Abrir CategoryLimitsCard
3. Adicionar limite: Alimentacao = R$ 500,00

**Esperado:**
- [ ] Registro em category_limits com category='Alimentacao', limit_amount=500.00
- [ ] Card exibe progress bar

---

## T02 — Progresso calculado corretamente
**Tipo:** Funcional
**Pre-req:** Limite Alimentacao = R$ 500,00
**Passos:** Criar 3 gastos de Alimentacao totalizando R$ 350,00

**Esperado:**
- [ ] Progress bar = 70% (verde)
- [ ] Texto "R$ 350,00 / R$ 500,00"

---

## T03 — Alerta amarelo (80%+)
**Tipo:** Visual
**Pre-req:** Limite = R$ 500,00, gastos = R$ 420,00

**Esperado:**
- [ ] Progress bar amarela (84%)

---

## T04 — Alerta vermelho (100%+)
**Tipo:** Visual
**Pre-req:** Limite = R$ 500,00, gastos = R$ 550,00

**Esperado:**
- [ ] Progress bar vermelha (110%)
- [ ] Valor excedido indicado

---

## T05 — Editar limite existente
**Tipo:** Funcional
**Passos:** Alterar limite de R$ 500 para R$ 800

**Esperado:**
- [ ] limit_amount atualizado
- [ ] Percentual recalculado

---

## T06 — Deletar limite
**Tipo:** Funcional

**Esperado:**
- [ ] Registro removido de category_limits
- [ ] Card desaparece

---

## T07 — Constraint UNIQUE: duplicata
**Tipo:** Seguranca
```sql
-- Com service_role:
INSERT INTO category_limits (user_id, category, limit_amount)
VALUES ('<uuid>', 'Alimentacao', 300);
INSERT INTO category_limits (user_id, category, limit_amount)
VALUES ('<uuid>', 'Alimentacao', 500);
```

**Esperado:**
- [ ] Segundo INSERT falha com UNIQUE violation

---

## T08 — RLS: usuario A nao ve limites de B
**Tipo:** Seguranca

**Esperado:**
- [ ] 0 registros retornados

---

## T09 — Plano Free bloqueado
**Tipo:** Acesso
**Passos:** Login como Free, verificar CategoryLimitsCard

**Esperado:**
- [ ] PlanBlocker exibido com link de upgrade

---

## T10 — Limite nao bloqueia insert (BUG KNOWN)
**Tipo:** Bug
**Passos:**
1. Definir limite Alimentacao = R$ 100
2. Ja ter R$ 100 em gastos
3. Criar novo gasto de R$ 50 em Alimentacao

**Esperado (ATUAL):**
- [ ] Gasto criado normalmente (limite apenas visual)
**Esperado (IDEAL):**
- [ ] Warning antes de confirmar, ou bloqueio
