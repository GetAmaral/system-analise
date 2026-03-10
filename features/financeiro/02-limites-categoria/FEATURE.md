# Feature 02 — Limites por Categoria

## Resumo
Permite usuarios Premium definirem limites mensais de gasto por categoria. O sistema calcula o gasto atual do mes e exibe progresso visual com alertas de cor.

## Arquitetura

```
Frontend (CategoryLimitsCard)
    ↓ useCategoryLimits() hook
    ↓ Supabase PostgREST
    ↓ category_limits table (CRUD)
    ↓ spent table (query gastos do mes)
    ↓ Calculo: (gasto_atual / limite) * 100
    ↓ UI: progress bar com cores
```

## Schema: `category_limits`

| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | UUID PK | gen_random_uuid() |
| user_id | UUID NOT NULL | FK auth.users(id) ON DELETE CASCADE |
| category | TEXT NOT NULL | Categoria com limite |
| limit_amount | DECIMAL(10,2) NOT NULL | Limite mensal em BRL |
| created_at | TIMESTAMP | Criacao |
| updated_at | TIMESTAMP | Ultima atualizacao |

**Constraint:** UNIQUE(user_id, category) — Um limite por categoria por usuario

### RLS Policies
```sql
-- SELECT/INSERT/UPDATE/DELETE: auth.uid() = user_id
```

### Index
- `idx_category_limits_user_id` (user_id)

## Hook: useCategoryLimits()

### Metodos
- `setLimit(category, amount)` — Cria ou atualiza limite (upsert pela constraint UNIQUE)
- `deleteLimit(category)` — Remove limite
- `getLimitsWithSpending()` — Retorna limites com gasto atual calculado

### Calculo do Gasto Atual
1. Busca todas transacoes `saida` do mes atual
2. Agrupa por category_spent
3. Compara soma contra limit_amount
4. Retorna percentual

### Alertas Visuais
- **Verde (0-79%):** Dentro do limite
- **Amarelo (80-99%):** Proximo do limite
- **Vermelho (100%+):** Limite excedido

## Componente: CategoryLimitsCard
- Lista todos limites do usuario
- Progress bar com cor dinamica
- Add limit via modal (filtra categorias ja com limite)
- Edit/delete inline
- Badge "Premium" com link de upgrade para Free

## Acesso
- **Requer:** Plano Premium

## Erros Conhecidos / Riscos

1. **Limite NAO e enforced no insert:** UI apenas alerta, backend permite inserir gasto acima do limite
2. **Sem notificacao push/WhatsApp:** Usuario so ve o alerta se abrir o dashboard
3. **Calculo client-side:** Para muitas transacoes (>1000), performance degrada
4. **Sem historico:** Nao rastreia limites de meses anteriores
