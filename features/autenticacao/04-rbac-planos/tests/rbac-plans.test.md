# Testes — RBAC e Planos

## T01 — Premium ativo acessa calendario
**Tipo:** Acesso
**Passos:** Login como premium com plan_end_date futuro

**Esperado:**
- [ ] Calendario acessivel
- [ ] RLS permite SELECT/INSERT/UPDATE/DELETE em calendar

---

## T02 — Premium expirado bloqueado
**Tipo:** Acesso
**Passos:** Login com plan_end_date no passado

**Esperado:**
- [ ] Calendario inacessivel
- [ ] RLS retorna 0 rows

---

## T03 — Free nao acessa calendario
**Tipo:** Acesso
**Passos:** Login como free

**Esperado:**
- [ ] PlanBlocker exibido
- [ ] RLS bloqueia acesso

---

## T04 — Standard acessa despesas
**Tipo:** Acesso
**Passos:** Login como standard

**Esperado:**
- [ ] CRUD de despesas funcional
- [ ] Limites de categoria NAO acessiveis (premium only)

---

## T05 — plan_end_date NULL = lifetime
**Tipo:** Funcional
```sql
SELECT user_has_premium('<uuid>') FROM profiles WHERE plan_type = 'premium' AND plan_end_date IS NULL;
```

**Esperado:**
- [ ] Retorna TRUE (acesso vitalicio)

---

## T06 — has_role admin
**Tipo:** Seguranca
```sql
SELECT has_role('<admin_uuid>', 'admin');
```

**Esperado:**
- [ ] TRUE se user_roles tem registro

---

## T07 — has_role para user normal
**Tipo:** Seguranca
```sql
SELECT has_role('<normal_uuid>', 'admin');
```

**Esperado:**
- [ ] FALSE

---

## T08 — user_plan_view isolamento
**Tipo:** Seguranca
```sql
-- Com token de usuario A:
SELECT * FROM user_plan_view;
```

**Esperado:**
- [ ] Apenas dados do usuario A (WHERE p.id = auth.uid())

---

## T09 — plan_type inconsistente
**Tipo:** Data integrity
```sql
SELECT DISTINCT plan_type FROM profiles;
```

**Esperado (IDEAL):**
- [ ] Apenas: 'free', 'standard', 'premium'
**Possivel problema:**
- [ ] Variantes como 'premium-mensal', 'Premium', etc.

---

## T10 — can_user_cancel_plan (7 dias)
**Tipo:** Funcional
```sql
-- Usuario com subscription criada ha 5 dias:
SELECT can_user_cancel_plan('<uuid>');
```

**Esperado:**
- [ ] TRUE (dentro da janela de 7 dias)

---

## T11 — Premium features gate: limites
**Tipo:** Acesso
**Passos:** Login como Standard, tentar acessar CategoryLimitsCard

**Esperado:**
- [ ] PlanBlocker para feature premium-only
