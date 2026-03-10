# Feature 03 — Gestao de Assinatura

## Resumo
Sistema de ciclo de vida da assinatura: ativacao, renovacao, expiacao, grace period, auto-linking por telefone. Distribuido entre subscriptions, payments, e profiles.

## Ciclo de Vida

```
1. COMPRA (anonima ou autenticada)
   ↓ Hotmart webhook cria subscription + payment
   ↓ phone e/ou email armazenados
   ↓ user_id = NULL se pre-signup

2. SIGNUP (se pre-signup)
   ↓ Usuario cria conta com mesmo phone
   ↓ Trigger link_subscriptions_to_user() vincula
   ↓ subscription.user_id = user.id
   ↓ Plano ativo imediatamente

3. PERIODO ATIVO
   ↓ end_date no futuro
   ↓ RLS permite acesso a features pagas
   ↓ user_has_premium()/user_has_standard() retorna TRUE

4. EXPIRACAO
   ↓ end_date < now()
   ↓ Frontend detecta via usePlanAccess
   ↓ Features bloqueadas (RLS nega)
   ↓ Hotmart envia PURCHASE_EXPIRED (opcional)
   ↓ status → 'expired', plan_type → 'free'

5. GRACE PERIOD (parcialmente implementado)
   ↓ grace_period_end = end_date + 30 dias
   ↓ MAS: RLS NAO verifica grace_period_end
   ↓ Notificacao no frontend (15 dias antes, 7 dias grace)
   ↓ getDaysInGracePeriod() sempre retorna null (BUG)

6. RENOVACAO
   ↓ Usuario clica "Renovar"
   ↓ Abre checkout Hotmart
   ↓ Novo webhook PURCHASE_COMPLETE
   ↓ Atualiza subscription existente
```

## Funcoes SQL Chave

### find_profile_by_phone(phone_input)
- Normaliza phone via normalize_phone()
- Gera variacoes via phone_variations()
- Retorna profile matching

### find_subscription_by_phone(phone_input)
- Mesma normalizacao
- Retorna subscriptions ativas/pagas
- Ordena: premium > standard

### get_active_plan(user_id, phone)
- Busca por user_id OU phone
- Retorna: plan_type, start_date, end_date, can_cancel
- can_cancel = start_date + 7 dias >= now()

### link_subscriptions_to_user() (TRIGGER)
- Fires no INSERT em profiles
- UPDATE subscriptions SET user_id WHERE phone match AND user_id IS NULL

### link_payments_to_user() (TRIGGER)
- Mesmo pattern para payments

## Hook: useSubscription()
- Busca payments e subscription ativa
- Calcula getDaysUntilExpiration()
- Metodo canCancel() (7 dias)
- Retorna estado completo da assinatura

## Hook: usePlanAccess()
- Deriva isPremium, isStandard, isPaid
- Verifica plan_end_date ativo
- Feature gates: hasCalendarAccess, hasFinancialToolsAccess, etc.

## Erros Conhecidos / Riscos

1. **Grace period nao funcional:** Calculado mas ignorado no controle de acesso
2. **getDaysInGracePeriod() retorna null:** Funcao quebrada no hook
3. **Estado em 3 tabelas:** profiles, subscriptions, payments podem desincronizar
4. **Cancelamento nao implementado:** UI existe, backend nao
5. **Sem downgrade:** Premium → standard nao suportado
6. **Sem pause/suspend:** Usuario nao pode pausar sem cancelar
7. **Sem retry de pagamento:** Pagamento falho nao tem retry automatico
8. **Kiwify table existe mas nao integrada:** Tabela kiwify criada em migrations mas sem edge function
