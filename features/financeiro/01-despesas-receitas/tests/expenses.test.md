# Testes — Despesas e Receitas

## T01 — Criar despesa (saida) via frontend
**Tipo:** Funcional
**Passos:**
1. Login como usuario Standard+
2. Abrir AddExpenseModal
3. Selecionar "saida", preencher nome, valor 150.50, categoria Alimentacao, tipo Fixo, data hoje
4. Submeter

**Esperado:**
- [ ] Registro criado em `spent` com transaction_type='saida'
- [ ] value_spent = 150.50
- [ ] category_spent = 'Alimentacao' (INITCAP)
- [ ] Toast de sucesso exibido
- [ ] Lista atualiza em real-time

---

## T02 — Criar receita (entrada)
**Tipo:** Funcional
**Passos:** Mesmo T01 mas selecionar "entrada"

**Esperado:**
- [ ] transaction_type='entrada'
- [ ] Aparece como receita nos KPIs

---

## T03 — Editar transacao existente
**Tipo:** Funcional
**Passos:**
1. Clicar em transacao existente
2. Alterar valor de 150.50 para 200.00
3. Submeter

**Esperado:**
- [ ] value_spent atualizado para 200.00
- [ ] updated_at atualizado (se existir)
- [ ] KPIs recalculados

---

## T04 — Deletar transacao
**Tipo:** Funcional
**Passos:** Clicar delete em transacao existente

**Esperado:**
- [ ] Registro removido permanentemente
- [ ] KPIs recalculados
- [ ] Toast de confirmacao

---

## T05 — Deletar multiplas transacoes
**Tipo:** Funcional
**Passos:** Selecionar 3 transacoes e deletar em batch

**Esperado:**
- [ ] Todas 3 removidas
- [ ] Contagem atualizada

---

## T06 — Validacao: nome vazio
**Tipo:** Validacao
**Passos:** Submeter formulario com name_spent vazio

**Esperado:**
- [ ] Erro de validacao Zod exibido
- [ ] Nao submete ao banco

---

## T07 — Validacao: valor negativo
**Tipo:** Validacao
**Passos:** Inserir value_spent = -50

**Esperado:**
- [ ] Rejeitado pela validacao (positive number required)

---

## T08 — Validacao: valor > 999,999,999
**Tipo:** Validacao
**Passos:** Inserir value_spent = 1,000,000,000

**Esperado:**
- [ ] Rejeitado pela validacao (max exceeded)

---

## T09 — RLS: usuario A nao ve transacoes de usuario B
**Tipo:** Seguranca
```sql
-- Com token do usuario A:
SELECT * FROM spent WHERE fk_user = '<uuid_usuario_B>';
-- Esperado: 0 rows
```

**Esperado:**
- [ ] 0 registros retornados (RLS bloqueia)

---

## T10 — RLS: insert com fk_user de outro usuario
**Tipo:** Seguranca
```sql
-- Com token do usuario A:
INSERT INTO spent (fk_user, name_spent, value_spent, transaction_type, date_spent)
VALUES ('<uuid_usuario_B>', 'hack', 100, 'saida', now());
```

**Esperado:**
- [ ] Rejeitado por RLS (WITH CHECK falha)

---

## T11 — N8N: criar despesa via webhook
**Tipo:** Integracao
**PRECISO DE: Credenciais Avelum (Basic Auth)**
```bash
curl -X POST "http://188.245.190.178:5678/webhook/registrar-gasto" \
  -u "user:pass" \
  -H "Content-Type: application/json" \
  -d '{
    "nome_gasto": "Teste N8N",
    "valor_gasto": 50.00,
    "categoria_gasto": "Tecnologia",
    "tipo_gasto": "Variavel",
    "entra_sai_gasto": "saida",
    "data_gasto": "2026-03-10T12:00:00Z",
    "id_user": "<uuid>"
  }'
```

**Esperado:**
- [ ] Registro criado em `spent`
- [ ] Campos mapeados corretamente

---

## T12 — N8N: payload incompleto
**Tipo:** Seguranca
```bash
curl -X POST "http://188.245.190.178:5678/webhook/registrar-gasto" \
  -u "user:pass" \
  -H "Content-Type: application/json" \
  -d '{"nome_gasto": "Incompleto"}'
```

**Esperado (ATUAL):**
- [ ] Insert com campos NULL (VULNERAVEL — sem validacao de schema)
**Esperado (IDEAL):**
- [ ] 400 com mensagem de erro listando campos obrigatorios

---

## T13 — Timezone: transacao meia-noite BRT
**Tipo:** Bug potencial
**Passos:**
1. Criar transacao com date_spent = "2026-03-31T23:30:00-03:00" (31 marco BRT)
2. Verificar em qual mes aparece no dashboard

**Esperado (IDEAL):**
- [ ] Aparece em marco
**Possivel Bug:**
- [ ] Aparece em abril (banco armazena 2026-04-01T02:30:00Z)

---

## T14 — Export XLSX
**Tipo:** Funcional
**Passos:** Clicar exportar no TransactionsDataGrid

**Esperado:**
- [ ] Arquivo XLSX baixado com todas transacoes visiveis
- [ ] Colunas: Data, Descricao, Categoria, Tipo, Valor

---

## T15 — Plano Free: apenas leitura
**Tipo:** Acesso
**Passos:** Login como usuario Free, tentar adicionar transacao

**Esperado:**
- [ ] Botao de adicionar desabilitado ou bloqueado
- [ ] Mensagem de upgrade exibida

---

## T16 — Real-time sync entre abas
**Tipo:** Funcional
**Passos:**
1. Abrir dashboard em 2 abas
2. Criar transacao na aba 1

**Esperado:**
- [ ] Aba 2 atualiza automaticamente via Supabase real-time

---

## T17 — KPIs calculados corretamente
**Tipo:** Funcional
**Validar:**
```sql
-- Receitas do mes:
SELECT COALESCE(SUM(value_spent), 0) FROM spent
WHERE fk_user = '<uuid>' AND transaction_type = 'entrada'
AND date_spent >= date_trunc('month', CURRENT_DATE)
AND date_spent < date_trunc('month', CURRENT_DATE) + interval '1 month';

-- Despesas do mes:
SELECT COALESCE(SUM(value_spent), 0) FROM spent
WHERE fk_user = '<uuid>' AND transaction_type = 'saida'
AND date_spent >= date_trunc('month', CURRENT_DATE)
AND date_spent < date_trunc('month', CURRENT_DATE) + interval '1 month';
```

**Esperado:**
- [ ] MTD Revenue = soma entradas
- [ ] MTD Expenses = soma saidas
- [ ] Net Income = Revenue - Expenses
- [ ] Runway Days = balance / (avg monthly expense)
