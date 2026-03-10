# Critica Arquitetural — Hotmart Webhook

## Problemas CRITICOS

### 1. Autenticacao fraca
Simples comparacao de string do token. Hotmart oferece assinatura HMAC-SHA256 do payload — nao implementada.

**Recomendacao URGENTE:** Implementar verificacao de assinatura: `HMAC(payload, secret) === X-HOTMART-HMAC-SHA256`.

### 2. Mapeamento de plano por nome de produto
"Standard Plan" mapeia para premium por logica de string matching. Qualquer mudanca de nome no Hotmart quebra o mapeamento.

**Recomendacao:** Usar product_id ou offer_code em vez de nome do produto.

### 3. Sem reconciliacao financeira
O webhook aceita qualquer amount sem verificar se condiz com o preco do plano. Atacante com token poderia registrar pagamento de R$ 0.01 para premium.

**Recomendacao:** Tabela de precos esperados. Validar amount >= preco_minimo[plan_type].

### 4. Grace period nao funcional
`grace_period_end` e calculado mas as funcoes `user_has_premium()` e `user_has_standard()` verificam apenas `end_date`, ignorando grace period.

**Recomendacao:** Alterar funcoes para considerar: `end_date > now() OR grace_period_end > now()`.

### 5. Estado distribuido entre 3 tabelas
Plano do usuario esta em: `profiles.plan_type`, `subscriptions.current_plan`, e `subscriptions.status`. Dessincronizacao possivel.

**Recomendacao:** Single source of truth em subscriptions. profiles.plan_type como cache derivado.

## Escalabilidade

| Aspecto | Limite | Gargalo |
|---------|--------|---------|
| Webhooks/minuto | Sem limite | Sem rate limiting |
| Phone lookup | phone_variations gera multiplas queries | Indexado |
| Idempotencia | transaction_id UNIQUE | Correto |
