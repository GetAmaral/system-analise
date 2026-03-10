# Feature 01 — Despesas e Receitas (CRUD Financeiro)

## Resumo
Sistema completo de gestao de transacoes financeiras (entradas e saidas). Usuarios registram gastos e receitas via frontend ou via WhatsApp (N8N). Dados armazenados na tabela `spent` com RLS por usuario.

## Arquitetura

```
Frontend (AddExpenseModal / EditExpenseModal)
    ↓ Zod validation (expenseSchema)
    ↓ useExpenses() hook
    ↓ Supabase PostgREST
    ↓ RLS: auth.uid() = fk_user
    ↓ spent table
    ↓ Trigger: INITCAP em category_spent
    ↓ Real-time channel ('spent-realtime')
    ↓ React Query cache invalidation

WhatsApp → N8N (Financeiro - Total)
    ↓ POST /registrar-gasto (Basic Auth Avelum)
    ↓ Field mapping + AI processing
    ↓ Supabase insert (service_role)
    ↓ spent table
```

## Schema: `spent`

| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id_spent | UUID PK | gen_random_uuid() |
| fk_user | UUID NOT NULL | FK auth.users(id) ON DELETE CASCADE |
| name_spent | TEXT | Descricao da transacao |
| category_spent | TEXT | Categoria (11 predefinidas) |
| value_spent | NUMERIC | Valor da transacao |
| type_spent | TEXT | Natureza: Fixo, Variavel, Eventuais, Emergenciais, Outros |
| transaction_type | TEXT | "entrada" (receita) ou "saida" (despesa) |
| date_spent | TIMESTAMP | Data da transacao |
| created_at | TIMESTAMP | Criacao do registro |

### Categorias Predefinidas
Alimentacao, Mercado, Moradia, Transporte, Saude, Educacao, Vestuario, Investimentos, Lazer, Tecnologia, Outros

### Tipos de Despesa
Fixo, Variavel, Eventuais, Emergenciais, Outros

### RLS Policies
```sql
-- SELECT: auth.uid() = fk_user
-- INSERT: auth.uid() = fk_user
-- UPDATE: auth.uid() = fk_user
-- DELETE: auth.uid() = fk_user
```

### Indexes
- `idx_spent_user_id` (fk_user)
- `idx_spent_date` (date_spent)
- `idx_spent_user_date` (fk_user, date_spent)
- `idx_spent_category` (category_spent)
- `idx_spent_type` (type_spent)
- `idx_spent_user_category_date` (fk_user, category_spent, date_spent)

### Triggers
- `INITCAP` em category_spent no INSERT/UPDATE (capitaliza automaticamente)

## Frontend

### Hook: useExpenses()
**Arquivo:** `src/hooks/useExpenses.ts`

- **Query:** Busca registros do usuario ordenados por date_spent DESC
- **Mutations:** add, update, delete, deleteMultiple
- **Calculados:** getTotals() (income, expense, balance), getExpensesByCategory()
- **Real-time:** Supabase channel subscription com cache invalidation
- **Optimistic updates:** UI atualiza imediatamente, rollback em caso de erro

### Validacao (Zod)
```typescript
expenseSchema = {
  name_spent: string (1-100 chars),
  value_spent: positive number (max 999,999,999),
  category_spent: enum (11 categorias),
  type_spent: enum (5 tipos),
  date_spent: ISO datetime,
  transaction_type: "entrada" | "saida"
}
```

### Componentes
- **AddExpenseModal** — Full-screen mobile, modal desktop. Seletor entrada/saida, currency input formatado
- **EditExpenseModal** — Pre-populado, mesmos campos
- **TransactionsDataGrid** — Tabela paginada (10/pagina), busca global, sort, export XLSX
- **KPICards** — MTD Revenue, MTD Expenses, Net Income, Runway Days

### Acesso por Plano
- **Free:** Visualizacao apenas (read-only)
- **Standard:** CRUD completo
- **Premium:** CRUD + limites + metas + investimentos + relatorios avancados

## N8N Workflow: Financeiro - Total

### Webhook
- **Endpoint:** POST `/registrar-gasto`
- **Auth:** Basic Auth (Avelum Credential)

### Payload Esperado
```json
{
  "nome_gasto": "string",
  "valor_gasto": "number",
  "categoria_gasto": "string",
  "tipo_gasto": "string",
  "entra_sai_gasto": "entrada|saida",
  "data_gasto": "string (ISO)",
  "id_user": "UUID"
}
```

### Fluxo
1. Webhook recebe POST
2. `setar_campos` extrai campos do body
3. AI/LLM processa linguagem natural ou formata dados
4. Timestamp humanizado
5. Field mapping para colunas do banco
6. Insert via Supabase (service_role)

## Erros Conhecidos / Riscos

1. **Loose ID comparison:** Dashboard usa `String(e.id_spent) === String(id)` — deveria usar validacao UUID
2. **Timezone mismatch:** `startOfMonth`/`endOfMonth` usam timezone local do cliente, banco armazena UTC — pode causar off-by-one-day
3. **Sem soft delete:** Transacoes deletadas sao removidas permanentemente, sem arquivo
4. **Sem audit trail:** Nao ha historico de edicoes
5. **Sem transacoes recorrentes:** Nao ha automacao para despesas fixas mensais (aluguel, etc.)
6. **Precisao numerica:** JavaScript `number` perde precisao para valores grandes — deveria usar string parsing
7. **Cache de 5 minutos:** staleTime do React Query pode ser longo demais para usuarios ativos
8. **Sem suporte offline:** Todas operacoes requerem rede
9. **Real-time + optimistic updates:** Pode causar "flash" visual quando ambos atualizam simultaneamente
