# Testes — Gestao de Assinatura

## T01 — Plano ativo com end_date futuro
**Tipo:** Funcional
```sql
SELECT user_has_premium('<uuid>');
-- Com subscription.end_date = now() + 30 dias
```

**Esperado:**
- [ ] TRUE

---

## T02 — Plano expirado
**Tipo:** Funcional
```sql
SELECT user_has_premium('<uuid>');
-- Com subscription.end_date = now() - 1 dia
```

**Esperado:**
- [ ] FALSE

---

## T03 — Auto-linking por phone
**Tipo:** Integracao
**Passos:**
1. Criar subscription com phone='5543999999999', user_id=NULL
2. Criar profile com phone='5543999999999'

**Esperado:**
- [ ] subscription.user_id automaticamente preenchido

---

## T04 — Auto-linking por phone com variacao
**Tipo:** Integracao
**Passos:**
1. Subscription com phone='43999999999' (sem DDI)
2. Profile com phone='5543999999999' (com DDI)

**Esperado:**
- [ ] phone_variations() gera match
- [ ] Auto-linking funciona

---

## T05 — Grace period nao enforced (BUG)
**Tipo:** Bug
```sql
-- Subscription com end_date passado mas grace_period_end futuro:
UPDATE subscriptions SET
  end_date = now() - interval '1 day',
  grace_period_end = now() + interval '6 days'
WHERE user_id = '<uuid>';

SELECT user_has_premium('<uuid>');
```

**Esperado (ATUAL):**
- [ ] FALSE (ignora grace period)
**Esperado (IDEAL):**
- [ ] TRUE durante grace period

---

## T06 — can_user_cancel_plan (janela 7 dias)
**Tipo:** Funcional
```sql
-- Subscription criada ha 5 dias:
SELECT can_user_cancel_plan('<uuid>');
```

**Esperado:**
- [ ] TRUE (dentro dos 7 dias)

---

## T07 — can_user_cancel_plan (apos 7 dias)
**Tipo:** Funcional
```sql
-- Subscription criada ha 10 dias:
SELECT can_user_cancel_plan('<uuid>');
```

**Esperado:**
- [ ] FALSE

---

## T08 — RLS: usuario A nao ve subscription de B
**Tipo:** Seguranca

**Esperado:**
- [ ] 0 rows retornados

---

## T09 — getDaysInGracePeriod retorna null (BUG)
**Tipo:** Bug
**Passos:** Verificar hook useSubscription com subscription em grace period

**Esperado (ATUAL):**
- [ ] null (funcao quebrada)
**Esperado (IDEAL):**
- [ ] Numero de dias restantes

---

## T10 — Kiwify table existe mas nao integrada
**Tipo:** Dead code
```sql
SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'kiwify';
```

**Esperado:**
- [ ] Tabela existe mas vazia/sem integracao
