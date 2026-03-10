# Feature 02 — Checkout e Planos

## Resumo
Edge function que retorna URLs de checkout do Hotmart baseado no tipo de plano. Frontend abre URL em nova janela. Precos e offer codes hardcoded.

## Arquitetura

```
Frontend (SubscriptionManager / PricingSection)
    ↓ handleCheckout(planType)
    ↓ supabase.functions.invoke('create-checkout', { body: { planType } })
    ↓ Edge Function retorna checkoutUrl
    ↓ window.open(checkoutUrl)
    ↓ Hotmart checkout page
    ↓ Pagamento processado → Hotmart Webhook
```

## Edge Function: create-checkout
**Arquivo:** `supabase/functions/create-checkout/index.ts`

### URLs Hardcoded
```
standard-mensal: https://pay.hotmart.com/J104038086X?off=nkwi7l8y&checkoutMode=6
standard-anual:  https://pay.hotmart.com/J104038086X?off=e862ejff&checkoutMode=6
premium-mensal:  https://pay.hotmart.com/J104038086X?off=vtb5ogds&checkoutMode=6
premium-anual:   https://pay.hotmart.com/J104038086X?off=xbjmsoxu&checkoutMode=6
upgrade-anual:   https://pay.hotmart.com/J104038086X?off=b50m5zk4&checkoutMode=6
upgrade-mensal:  https://pay.hotmart.com/J104038086X?off=b50m5zk4 (mesmo que anual!)
```

### Auth
- JWT opcional (loga userId se disponivel, senao 'anonymous')

## Frontend

### Precos Exibidos (INCONSISTENTES!)

**SubscriptionManager:**
- Standard: R$ 97/ano
- Premium: R$ 197/ano

**PricingSection:**
- Premium: R$ 37,90/mes × 12 = R$ 454,80/ano (51% desconto)

**Problema:** Precos contraditorios em componentes diferentes!

### SubscriptionManager
- Exibe plano atual, periodo, datas
- Botoes de renovar e upgrade
- Historico de pagamentos (ultimos 5)
- **Cancelamento: "Em desenvolvimento"** (Toast, nao implementado)

### SubscriptionReceipt
- Gera HTML (NAO PDF) como recibo
- Download como .html
- Menciona Kiwify (sistema usa Hotmart)

## Erros Conhecidos / Riscos

1. **Precos inconsistentes:** R$ 97 vs R$ 37,90 — confuso para usuario
2. **URLs hardcoded:** Offer codes embutidos no codigo
3. **upgrade-mensal = upgrade-anual:** Mesmo offer code para ambos
4. **Cancelamento nao implementado:** Botao existe, funcao nao
5. **Recibo menciona Kiwify:** Mas sistema usa Hotmart
6. **Sem pre-fill de dados:** URL nao inclui email/phone do usuario para pre-fill
