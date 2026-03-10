# Feature 01 — Hotmart Webhook

## Resumo
Webhook que recebe notificacoes da Hotmart sobre compras, cancelamentos, reembolsos e mudancas de plano. Processa eventos e sincroniza estado de assinatura e perfil do usuario.

## Arquitetura

```
Hotmart → POST /hotmart-webhook
    ↓ Valida X-HOTMART-HOTTOK
    ↓ Verifica idempotencia (transaction_id)
    ↓ Identifica evento:
    │   ├─ PURCHASE_COMPLETE/APPROVED → Cria subscription + payment
    │   ├─ SUBSCRIPTION_CANCELLATION/PURCHASE_CANCELED → Cancela
    │   ├─ PURCHASE_REFUNDED/CHARGEBACK → Reembolsa
    │   ├─ PURCHASE_DELAYED/OVERDUE → Grace period
    │   ├─ SUBSCRIPTION_PLAN_CHANGE → Upgrade/downgrade
    │   └─ PURCHASE_EXPIRED → Expira
    ↓ Busca/cria profile por phone OU email
    ↓ Cria/atualiza subscription
    ↓ Registra payment
    ↓ Sincroniza profiles.plan_type + plan_status
```

## Edge Function: hotmart-webhook
**Arquivo:** `supabase/functions/hotmart-webhook/index.ts`

### Autenticacao
- Header: `X-HOTMART-HOTTOK`
- Comparacao simples com env `HOTMART_HOTTOK`
- **SEM verificacao HMAC de assinatura do payload**

### Idempotencia
- Verifica `transaction_id` unico antes de processar
- Retorna 200 "Already processed" se duplicado
- Previne double-charging em retries

### Eventos Processados

| Evento | Acao |
|--------|------|
| PURCHASE_COMPLETE/APPROVED | Cria subscription + payment, sync profile → plano ativo |
| SUBSCRIPTION_CANCELLATION | Status → 'canceled', profile → plan_type='free' |
| PURCHASE_CANCELED | Mesmo que cancellation |
| PURCHASE_REFUNDED | Payment status → 'refunded', refund_at registrado |
| PURCHASE_CHARGEBACK | Mesmo que refunded + cancela subscription |
| PURCHASE_DELAYED/OVERDUE | Status → 'overdue', grace_period_end = +7 dias |
| SUBSCRIPTION_PLAN_CHANGE | Atualiza current_plan, recalcula end_date |
| PURCHASE_EXPIRED | Status → 'expired', profile → 'free' |

### Deteccao de Plano (do nome do produto Hotmart)
```
"Standard Plan" → premium (CONFUSO — nome "standard" mapeia para premium!)
"upgrade" keyword → premium
"premium" keyword → premium
"standard" keyword → standard
Default → free
```

### Calculo de Periodo
```
"mensal" → end_date = start + 30 dias
"anual" (default) → end_date = start + 365 dias
```

### Busca de Usuario
1. Tenta por phone (normalize_phone + phone_variations)
2. Fallback por email (ilike)
3. Se nao encontra: cria profile via create-user-admin edge function

## Tabelas

### subscriptions
| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | UUID PK | gen_random_uuid() |
| user_id | UUID NULLABLE | FK profiles(id), NULL se pre-signup |
| phone | TEXT NULLABLE | Para linking antes do signup |
| email | TEXT NULLABLE | Email do comprador |
| current_plan | TEXT | 'free', 'standard', 'premium' |
| plan_period | TEXT | 'mensal', 'anual' |
| status | TEXT | 'active', 'canceled', 'expired', 'free', 'pending_upgrade', 'overdue', 'paid' |
| start_date | TIMESTAMP | Inicio do plano |
| end_date | TIMESTAMP | Expiracao |
| grace_period_end | TIMESTAMP | end_date + 30 dias |
| payment_method | TEXT | 'credit_card', 'pix', 'boleto' |
| card_last4 | TEXT | Ultimos 4 digitos |
| card_brand | TEXT | visa, mastercard, etc. |
| installments | INTEGER | Parcelas |
| transaction_id | TEXT UNIQUE | ID Hotmart (idempotencia) |

**Constraint:** UNIQUE(user_id) — mas pode ser NULL para pre-signup
**RLS:** auth.uid() = user_id

### payments
| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | UUID PK | gen_random_uuid() |
| user_id | UUID NULLABLE | FK profiles(id) |
| phone | TEXT | Phone do comprador |
| email | TEXT | Email do comprador |
| plan_type | TEXT | 'standard', 'premium' |
| plan_period | TEXT | 'mensal', 'anual' |
| amount | DECIMAL(10,2) | Valor pago |
| currency | TEXT DEFAULT 'BRL' | Moeda |
| status | TEXT | 'paid', 'pending', 'refunded', 'expired' |
| transaction_id | TEXT UNIQUE | ID Hotmart |
| refunded_at | TIMESTAMP | Data do reembolso |

**Indexes:** idx_payments_user_id, idx_payments_phone, idx_payments_transaction_id

### Triggers de Auto-Linking
- `link_subscriptions_to_user()` — No INSERT em profiles, vincula subscriptions com phone match
- `link_payments_to_user()` — No INSERT em profiles, vincula payments com phone match

## Erros Conhecidos / Riscos CRITICOS

1. **Sem verificacao HMAC:** Apenas string match de token. Se token vazar, qualquer request pode simular compra
2. **"Standard Plan" → premium:** Mapeamento confuso de nome de produto para plano
3. **Sem validacao de valor:** Aceita qualquer amount no webhook, nao verifica se condiz com preco real
4. **Sem audit logging:** Webhook nao loga em audit_log
5. **Sem rate limit:** Endpoint pode ser spammado
6. **Refund nao revoga acesso imediato:** Subscription permanece ativa ate end_date mesmo apos refund
7. **Grace period nao enforced:** grace_period_end calculado mas nunca verificado nas RLS policies
8. **CORS wildcard:** Aceita requests de qualquer origem
9. **Phone/email fallback:** Pode criar registros orfaos se ambos falharem na busca
