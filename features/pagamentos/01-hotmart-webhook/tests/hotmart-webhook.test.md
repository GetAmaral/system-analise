# Testes — Hotmart Webhook

## T01 — PURCHASE_COMPLETE: compra nova
**Tipo:** Integracao
```bash
curl -X POST "https://<supabase_url>/functions/v1/hotmart-webhook" \
  -H "X-HOTMART-HOTTOK: <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "event": "PURCHASE_COMPLETE",
    "data": {
      "buyer": {"email": "test@test.com", "phone": "5543999999999"},
      "purchase": {"transaction": "TXN123", "price": {"value": 197}},
      "product": {"name": "Premium Anual"},
      "subscription": {"plan": {"name": "premium-anual"}}
    }
  }'
```

**Esperado:**
- [ ] Subscription criada com current_plan='premium', status='active'
- [ ] Payment criado com amount=197, status='paid'
- [ ] profiles.plan_type='premium', plan_status=true

---

## T02 — Idempotencia: mesma transaction_id
**Tipo:** Seguranca
**Passos:** Enviar mesmo webhook 2 vezes com mesmo transaction_id

**Esperado:**
- [ ] Segunda request: 200 "Already processed"
- [ ] Nenhum registro duplicado

---

## T03 — Token invalido
**Tipo:** Seguranca
```bash
curl -X POST "https://<supabase_url>/functions/v1/hotmart-webhook" \
  -H "X-HOTMART-HOTTOK: token-errado" \
  -H "Content-Type: application/json" \
  -d '{"event": "PURCHASE_COMPLETE", "data": {}}'
```

**Esperado:**
- [ ] 401 Unauthorized

---

## T04 — SUBSCRIPTION_CANCELLATION
**Tipo:** Funcional
**Pre-req:** Subscription ativa

**Esperado:**
- [ ] subscription.status = 'canceled'
- [ ] profiles.plan_type = 'free'
- [ ] profiles.plan_status = false

---

## T05 — PURCHASE_REFUNDED
**Tipo:** Funcional

**Esperado:**
- [ ] payment.status = 'refunded'
- [ ] payment.refunded_at preenchido
- [ ] Subscription cancelada

---

## T06 — PURCHASE_OVERDUE (grace period)
**Tipo:** Funcional

**Esperado:**
- [ ] subscription.status = 'overdue'
- [ ] grace_period_end = now() + 7 dias
- [ ] profiles.plan_status = false

---

## T07 — SUBSCRIPTION_PLAN_CHANGE (upgrade)
**Tipo:** Funcional
**Pre-req:** Standard ativo

**Esperado:**
- [ ] subscription.current_plan = 'premium'
- [ ] end_date recalculado
- [ ] profiles.plan_type = 'premium'

---

## T08 — "Standard Plan" mapeia para premium (BUG)
**Tipo:** Bug
**Passos:** Webhook com product.name = "Standard Plan"

**Esperado (ATUAL):**
- [ ] Mapeia para premium (CONFUSO)
**Esperado (IDEAL):**
- [ ] Mapeia para standard

---

## T09 — Auto-linking por phone no signup
**Tipo:** Integracao
**Passos:**
1. Webhook cria subscription com phone, user_id=NULL
2. Usuario faz signup com mesmo phone

**Esperado:**
- [ ] Trigger link_subscriptions_to_user() vincula automaticamente
- [ ] subscription.user_id = novo user.id

---

## T10 — Refund nao revoga acesso imediato (BUG)
**Tipo:** Bug/Seguranca
**Passos:**
1. Subscription ativa com end_date futuro
2. Webhook PURCHASE_REFUNDED

**Esperado (ATUAL):**
- [ ] Payment status='refunded' mas subscription ainda ativa ate end_date
**Esperado (IDEAL):**
- [ ] Acesso revogado imediatamente

---

## T11 — Sem rate limit no webhook
**Tipo:** Seguranca
**Passos:** Enviar 100 requests em sequencia

**Esperado (ATUAL):**
- [ ] Todos processados (sem rate limit)
**Esperado (IDEAL):**
- [ ] 429 apos threshold

---

## T12 — Grace period nao enforced nas RLS
**Tipo:** Bug
```sql
-- Usuario com subscription.status='overdue', grace_period_end futuro:
SELECT user_has_premium('<uuid>');
```

**Esperado (ATUAL):**
- [ ] FALSE (funcao ignora grace_period_end)
**Esperado (IDEAL):**
- [ ] TRUE durante grace period
