# Feature 03 — Metas Financeiras

## Resumo
Usuarios definem duas metas: renda mensal estimada e saldo objetivo. O sistema compara com dados reais e exibe progresso com alertas contextuais.

## Arquitetura

```
Frontend (FinancialGoalsCard)
    ↓ useFinancialGoals() hook
    ↓ profiles table (estimated_monthly_income, balance_goal)
    ↓ useExpenses() para calcular receita/saldo atual
    ↓ Comparacao: atual vs meta
    ↓ Progress bars + alertas
```

## Schema (colunas em `profiles`)

| Coluna | Tipo | Descricao |
|--------|------|-----------|
| estimated_monthly_income | DECIMAL(10,2) | Meta de renda mensal |
| balance_goal | DECIMAL(10,2) | Meta de saldo |

## Hook: useFinancialGoals()
- Busca valores de `profiles` para o usuario logado
- `updateGoals(partial)` — atualiza um ou ambos campos

## Logica de Alertas

### Meta de Renda
- Compara soma de `transaction_type='entrada'` do mes com `estimated_monthly_income`
- **Alerta dia 25+:** Se renda atual < 75% da meta, exibe aviso
- Progress bar mostra % atingido

### Meta de Saldo
- Compara balance (receitas - despesas) com `balance_goal`
- **"Meta Atingida!"** quando balance >= goal
- Cor verde quando meta alcancada

## Componente: FinancialGoalsCard
- Modal de edicao para ambas metas
- Renderizacao condicional (esconde se ambas = 0)
- Cards independentes para cada meta

## Acesso
- **Requer:** Plano Premium

## Erros Conhecidos / Riscos

1. **Threshold hardcoded:** Dia 25 e 75% sao fixos, nao configuraveis
2. **Sem historico:** Meta alterada no meio do mes perde valor anterior
3. **Sem notificacao:** Alerta so aparece no dashboard, sem push/email
4. **Timezone:** Verificacao do dia 25 usa timezone local do cliente
5. **Sem meta de economia:** Nao ha meta de "gastar menos que X"
