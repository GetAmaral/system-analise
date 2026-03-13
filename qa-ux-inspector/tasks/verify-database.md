---
task: Verificar Dados no Supabase
responsavel: "@inspector"
responsavel_type: agent
atomic_layer: task
elicit: false
Entrada: |
  - table: string (required) - Nome da tabela no Supabase
  - query_params: object (optional) - Filtros para a query (column, operator, value)
  - feature_id: string (optional) - Feature que gerou os dados
  - expected_data: object (optional) - Dados esperados para comparacao
Saida: |
  - query_result: object - Resultado da query SELECT
  - match: boolean - Se os dados encontrados correspondem ao esperado
  - discrepancies: array - Divergencias entre esperado e encontrado
  - evidence: string - Query executada e resultado para documentacao
Checklist:
  - "[ ] CONFIRMAR que a operacao e SELECT-only (NUNCA INSERT/UPDATE/DELETE)"
  - "[ ] Montar query REST com filtros apropriados"
  - "[ ] Filtrar por dados de teste (prefixo TEST_) quando possivel"
  - "[ ] Executar GET no Supabase REST API"
  - "[ ] Comparar resultado vs dados esperados"
  - "[ ] Documentar evidencia (query + resultado)"
  - "[ ] Retornar resultado para o caller"
---

# *verify-db {table} {query}

Verifica dados no Supabase apos um teste, usando SOMENTE operacoes SELECT via REST API.

## Uso

```
@inspector

*verify-db calendar_events "user_id=eq.TEST_user_123"
# -> SELECT em calendar_events filtrando por user_id de teste

*verify-db expenses "description=like.TEST_*"
# -> Buscar despesas de teste

*verify-db profiles "phone=eq.5511999999999"
# -> Verificar perfil por telefone
```

## READ-ONLY GATE (OBRIGATORIO)

1. CONFIRMAR que a operacao e SELECT (GET request)
2. NUNCA usar metodos POST, PUT, PATCH, DELETE no Supabase
3. URL deve ser: `GET https://{project_ref}.supabase.co/rest/v1/{table}?{filters}`
4. Headers: `apikey: {SUPABASE_ANON_KEY}`, `Authorization: Bearer {SUPABASE_ANON_KEY}`

## Fluxo de Verificacao

```
1. PREPARACAO
   ├── Identificar tabela e filtros necessarios
   ├── Montar URL REST: GET /rest/v1/{table}?{query_params}
   └── Preparar headers de autenticacao (anon key)

2. EXECUCAO
   ├── Enviar GET request para Supabase REST API
   ├── Capturar response (status, body, tempo)
   └── Parsear resultado JSON

3. COMPARACAO (se expected_data fornecido)
   ├── Comparar campos esperados vs recebidos
   ├── Identificar divergencias
   └── Classificar: MATCH / MISMATCH / NOT_FOUND

4. DOCUMENTACAO
   ├── Registrar query executada
   ├── Registrar resultado obtido
   └── Registrar comparacao (se aplicavel)
```

## Tabelas Conhecidas

| Tabela | Descricao | Features Relacionadas |
|--------|-----------|----------------------|
| `profiles` | Dados do usuario | Todas |
| `phones` | Verificacao WhatsApp | Autenticacao |
| `calendar_events` | Eventos de calendario | Agenda |
| `bot_events` | Rate limiting | Todas |
| `expenses` | Despesas | Financeiro |
| `investments` | Investimentos | Financeiro |
| `subscriptions` | Planos | Premium/Standard |
| `financial_goals` | Metas financeiras | Financeiro |
| `log_users_messages` | Logs de mensagens | Todas |

## Metadata

```yaml
version: 1.0.0
dependencies:
  - Supabase anon key
tags:
  - verify
  - database
  - supabase
  - read-only
```
