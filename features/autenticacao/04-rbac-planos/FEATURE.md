# Feature 04 — RBAC e Controle de Planos

## Resumo
Sistema de controle de acesso baseado em roles (admin, moderator, user) e planos de assinatura (free, standard, premium). RLS policies usam funcoes SECURITY DEFINER para verificar plano do usuario antes de permitir acesso a features.

## Arquitetura

```
Request
    ↓ Supabase Auth (JWT com user.id)
    ↓ RLS Policy:
    │   ├─ auth.uid() = user_id (isolamento)
    │   └─ user_has_premium(auth.uid()) OR user_has_standard(auth.uid())
    ↓ Funcoes SECURITY DEFINER:
    │   ├─ user_has_premium(user_id) → BOOLEAN
    │   ├─ user_has_standard(user_id) → BOOLEAN
    │   ├─ user_has_paid_plan(user_id) → BOOLEAN
    │   └─ has_role(user_id, role) → BOOLEAN
    ↓ Acesso permitido ou negado
```

## RBAC

### Enum: app_role
```sql
CREATE TYPE app_role AS ENUM ('admin', 'moderator', 'user');
```

### Tabela: user_roles
| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | BIGINT PK | Auto-generated |
| user_id | UUID | FK auth.users(id) |
| role | app_role | Role do usuario |

### Funcao: has_role(user_id, role)
```sql
SECURITY DEFINER, SET search_path = public
SELECT EXISTS (
  SELECT 1 FROM user_roles WHERE user_id = $1 AND role = $2
)
```

### Uso
- audit_log: SELECT apenas para admins (`has_role(auth.uid(), 'admin')`)
- Potencial para dashboard admin (nao implementado no frontend)

## Planos de Assinatura

### Colunas em `profiles`
| Coluna | Tipo | Descricao |
|--------|------|-----------|
| plan_type | TEXT | 'free', 'standard', 'premium' (ou variantes como 'premium-mensal') |
| plan_end_date | TIMESTAMP | NULL = lifetime, futuro = ativo, passado = expirado |
| plan_period | TEXT | 'monthly', 'yearly', etc. |
| current_plan | TEXT | Plano atual normalizado |

### Funcoes de Verificacao

**user_has_premium(user_id)**
```sql
CASE WHEN plan_type = 'premium' THEN
  CASE WHEN plan_end_date IS NULL THEN true    -- lifetime
       ELSE plan_end_date > now()               -- ativo
  END
ELSE false
END
```

**user_has_standard(user_id)** — Mesma logica para standard

**user_has_paid_plan(user_id)** — Premium OR Standard

**can_user_cancel_plan(user_id)** — Verifica janela de 7 dias para reembolso

### Frontend: usePlanAccess()
```typescript
const isPaid = ['premium', 'standard'].some(p =>
  plan_type?.toLowerCase().includes(p)
) && (plan_end_date === null || new Date(plan_end_date) > new Date());

return {
  hasCalendarAccess: isPaid,
  hasFinancialToolsAccess: isPaid,
  hasReportAccess: isPremium,
  canManageExpenses: isPaid,
  // etc.
}
```

### View: user_plan_view
```sql
CREATE VIEW user_plan_view WITH (security_invoker = true) AS
SELECT p.id, p.name, p.email, p.plan_type, p.plan_end_date, ...
FROM profiles p
WHERE p.id = auth.uid();  -- filtro extra de seguranca
```
- `security_invoker = true` — respeita RLS da tabela base

### Features por Plano

| Feature | Free | Standard | Premium |
|---------|------|----------|---------|
| Dashboard basico | ✓ | ✓ | ✓ |
| Calendario/Agenda | ✗ | ✓ | ✓ |
| Despesas/Receitas | Read-only | CRUD | CRUD |
| Limites categoria | ✗ | ✗ | ✓ |
| Metas financeiras | ✗ | ✗ | ✓ |
| Investimentos | ✗ | ✓ | ✓ |
| Relatorios PDF | ✗ | ✗ | ✓ |
| Google Calendar sync | ✗ | ✓ | ✓ |
| Agenda diaria WhatsApp | ✗ | ✗ | ✓ |

## Erros Conhecidos / Riscos

1. **plan_type TEXT sem enum:** Permite qualquer string. Variantes como 'premium-mensal' requerem `.includes('premium')` — fragil
2. **Sem grace period consistente:** Agenda diaria tem grace period de 7 dias, mas RLS nao tem
3. **RBAC subutilizado:** Enum admin/moderator/user existe mas frontend nao tem painel admin
4. **Verificacao client-side duplica server-side:** usePlanAccess repete logica das funcoes SQL — pode desincronizar
5. **plan_end_date NULL = lifetime:** Qualquer bug que sete NULL acidentalmente da acesso vitalicio
6. **89+ funcoes SECURITY DEFINER:** Grande superficie de ataque se qualquer uma tiver bug
