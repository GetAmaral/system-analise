# Critica Arquitetural — Gestao de Assinatura

## Problemas CRITICOS

### 1. Estado distribuido sem sincronizacao
Plan state em `profiles.plan_type`, `subscriptions.current_plan`, e `subscriptions.status`. O webhook tenta sincronizar mas qualquer falha parcial deixa estado inconsistente.

**Recomendacao:** Single source of truth: `subscriptions` como autoridade. `profiles.plan_type` como materialized cache via trigger.

### 2. Grace period morto
Infraestrutura existe (campo, calculo, notificacao) mas nao funciona:
- `grace_period_end` calculado no webhook
- `user_has_premium()` ignora grace period
- `getDaysInGracePeriod()` retorna null
- Frontend mostra notificacao mas features ja estao bloqueadas

**Recomendacao:** Alterar `user_has_premium()`:
```sql
RETURN (end_date > now()) OR (grace_period_end IS NOT NULL AND grace_period_end > now());
```

### 3. Kiwify abandonado
Tabela `kiwify` existe nas migrations mas nenhuma edge function ou frontend a usa. Dead infrastructure.

**Recomendacao:** Dropar tabela ou implementar integracao completa.

### 4. Auto-linking por phone fragil
Se usuario muda de numero entre compra e signup, link nao acontece. Nao ha fallback por email no trigger.

**Recomendacao:** Trigger deveria tentar por phone E email.

## Escalabilidade

| Aspecto | Limite | Gargalo |
|---------|--------|---------|
| Subscriptions | 1 per user (UNIQUE) | Correto |
| Phone linking | phone_variations() | Multiplas queries |
| Grace period | Nao funcional | Dead code |
