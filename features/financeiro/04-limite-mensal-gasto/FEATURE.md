# Feature 04 — Limite Mensal de Gasto

## Resumo
Limite global mensal de gastos armazenado em `profiles.value_limit`. Default: R$ 1.000. Sistema calcula gasto total do mes e exibe alertas quando proximo ou acima do limite.

## Arquitetura

```
Frontend (Dashboard)
    ↓ useSpendingLimit() hook
    ↓ profiles.value_limit
    ↓ spent table (SUM de saidas do mes)
    ↓ Calculo: percentual = (gasto / limite) * 100
    ↓ Alertas visuais
```

## Schema (coluna em `profiles`)

| Coluna | Tipo | Descricao |
|--------|------|-----------|
| value_limit | NUMERIC DEFAULT 1000.0 | Limite mensal global de gastos |

## Hook: useSpendingLimit()

### Metodos
- `updateLimit(newLimit)` — Atualiza value_limit em profiles
- `checkLimitExceeded(totalExpenses)` — Retorna boolean
- `getLimitPercentage(totalExpenses)` — 0-100%
- `getRemainingAmount()` — max(0, limit - currentSpending)

### Calculo
1. Busca todos registros `saida` do 1o ao ultimo dia do mes
2. Soma value_spent
3. Compara com value_limit

### Warning Threshold
- **80%:** Banner de aviso exibido no dashboard

## Erros Conhecidos / Riscos

1. **Default 1000 arbitrario:** Pode nao fazer sentido para muitos usuarios
2. **Nao bloqueia inserts:** Apenas visual, permite gastar acima
3. **Timezone:** Mesmo problema das despesas — mes calculado no client
4. **Sem notificacao proativa:** Se usuario nao abre app, nao ve o alerta
5. **Threshold 80% hardcoded:** Nao configuravel
