# Critica Arquitetural — Despesas e Receitas

## Problemas

### 1. Tabela unica para entrada e saida
`spent` armazena AMBOS receitas e despesas com `transaction_type` TEXT. Problema:
- Nome da tabela ("spent") implica apenas gastos — semanticamente confuso
- Nao ha CHECK constraint no banco para `transaction_type IN ('entrada', 'saida')` — apenas validacao frontend
- Filtragem depende de string comparison em vez de boolean ou enum

**Recomendacao:** Renomear para `transactions` ou criar enum type no PostgreSQL. Adicionar CHECK constraint.

### 2. Sem soft delete
DELETE permanente. Problemas:
- Sem possibilidade de undo
- Sem audit trail para compliance
- `deleteMultiple` pode deletar dezenas de registros sem confirmacao granular

**Recomendacao:** Adicionar `deleted_at TIMESTAMP` e filtrar por `WHERE deleted_at IS NULL`.

### 3. Timezone inconsistente
Frontend calcula `startOfMonth`/`endOfMonth` no timezone local do navegador. Banco armazena UTC. Resultado: transacao criada as 23:00 BRT (02:00 UTC) pode aparecer no mes errado.

**Recomendacao:** Normalizar todas datas para UTC no frontend antes de queries, ou usar `AT TIME ZONE` no SQL.

### 4. Sem transacoes recorrentes
Usuarios com despesas fixas (aluguel, salario, assinaturas) precisam re-inserir manualmente todo mes.

**Recomendacao:** Tabela `recurring_transactions` com RRULE (ja existe infra para isso no calendario).

### 5. N8N field mapping fragil
O workflow depende de nomes de campo exatos no payload (`nome_gasto`, `valor_gasto`, etc.). Sem validacao de schema no webhook — payload malformado causa insert com NULL.

**Recomendacao:** Adicionar validacao de schema no N8N antes do insert.

### 6. Sem conciliacao
Nao ha mecanismo para importar extratos bancarios ou comparar com dados inseridos manualmente.

## Escalabilidade

| Aspecto | Limite | Gargalo |
|---------|--------|---------|
| Transacoes por usuario | Sem limite | Paginacao frontend (10/pagina) |
| Busca | Filtro client-side | Deveria ser server-side para >1000 registros |
| Export XLSX | Client-side | Memoria do navegador para datasets grandes |
| Real-time | 1 channel por usuario | Supabase connection limits |
