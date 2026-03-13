---
task: Testar Feature via Webhook DEV
responsavel: "@inspector"
responsavel_type: agent
atomic_layer: task
elicit: true
Entrada: |
  - feature_id: string (required) - ID da feature conforme features-catalog.yaml
  - scenario_type: string (optional) - Tipo de cenario: happy_path, edge_case, error (default: todos)
  - custom_payload: object (optional) - Payload customizado para teste especifico
Saida: |
  - test_result: .md file em output/test-results/
  - status: PASS | FAIL | PARTIAL | ERROR
  - response_time: number (ms)
  - issues_found: array - Problemas encontrados
  - ux_score: number (0-10) - Avaliacao de UX
Checklist:
  - "[ ] Carregar feature do catalogo (data/features-catalog.yaml)"
  - "[ ] Carregar cenarios de teste (data/test-scenarios.yaml)"
  - "[ ] VERIFICAR que URL e /webhook-test/ (DEV) e NAO /webhook/ (PROD)"
  - "[ ] Montar payload com dados ficticios (prefixo TEST_)"
  - "[ ] Enviar HTTP POST para webhook-test DEV"
  - "[ ] Capturar response (status code, body, tempo)"
  - "[ ] Verificar resultado no Supabase (SELECT-only)"
  - "[ ] Verificar Google Calendar se aplicavel"
  - "[ ] Avaliar qualidade UX (checklist ux-checklist.md)"
  - "[ ] Classificar resultado: PASS / FAIL / PARTIAL / ERROR"
  - "[ ] Documentar evidencias (payload, response, queries)"
  - "[ ] Salvar resultado em output/test-results/"
---

# *test {feature}

Testa uma feature especifica do Total Assistente enviando mensagem simulada via webhook DEV do N8N.

## Uso

```
@inspector

*test agenda
# -> Testa a feature de agenda (happy path + edge cases + errors)

*test agenda --scenario happy_path
# -> Testa apenas o happy path da agenda

*test financeiro-registrar-despesa
# -> Testa o registro de despesa
```

## DEV WEBHOOK GATE (OBRIGATORIO)

Antes de QUALQUER HTTP request:
1. Verificar que a URL contem `/webhook-test/` e NAO `/webhook/`
2. Verificar que o payload usa dados ficticios com prefixo `TEST_`
3. Se QUALQUER duvida sobre ser DEV ou PROD: HALT e perguntar ao usuario

## Elicitacao

```
? Qual feature deseja testar?
  > [feature_id ou nome da feature]

? Quais cenarios executar?
  1. Todos (happy path + edge cases + erros)
  2. Apenas happy path
  3. Apenas edge cases
  4. Apenas cenarios de erro
  5. Cenario customizado (fornecer payload)
  > [selecao]
```

## Fluxo de Teste

```
1. PREPARACAO
   ├── Carregar feature de data/features-catalog.yaml
   ├── Carregar cenarios de data/test-scenarios.yaml
   ├── Identificar webhook endpoint (webhook-test/)
   ├── Identificar tabelas Supabase envolvidas
   └── Montar payloads de teste com prefixo TEST_

2. PRE-VERIFICACAO
   ├── CONFIRMAR: URL contem /webhook-test/ (DEV)
   ├── CONFIRMAR: Payload usa dados ficticios (TEST_)
   ├── Snapshot do estado atual no Supabase (SELECT)
   └── Snapshot do Google Calendar (se aplicavel)

3. EXECUCAO DO TESTE
   ├── HTTP POST payload para webhook-test DEV
   ├── Capturar: status code, response body, tempo de resposta
   ├── Registrar timestamp de inicio e fim
   └── Se erro HTTP: documentar e classificar

4. VERIFICACAO POS-TESTE
   ├── Aguardar processamento (2-5 segundos para async)
   ├── SELECT no Supabase: verificar dados criados/alterados
   ├── Verificar Google Calendar (se feature envolve agenda)
   ├── Comparar resultado vs expected_behavior
   └── Comparar resultado vs expected_output do cenario

5. AVALIACAO UX
   ├── Carregar checklists/ux-checklist.md
   ├── Avaliar tempo de resposta
   ├── Avaliar clareza da mensagem de resposta
   ├── Avaliar formatacao e linguagem natural
   ├── Avaliar tratamento de erros
   └── Atribuir score UX (0-10)

6. CLASSIFICACAO DO RESULTADO
   ├── PASS: Comportamento = esperado em todos os criterios
   ├── PARTIAL: Funciona mas com problemas menores
   ├── FAIL: Comportamento diverge significativamente do esperado
   └── ERROR: Feature nao responde ou gera erro

7. DOCUMENTACAO
   ├── Carregar template: templates/feature-test-report-tmpl.md
   ├── Preencher com todos os dados coletados
   ├── Incluir evidencias (payloads, responses, queries)
   └── Salvar em: output/test-results/YYYY-MM-DD_{feature_id}.md
```

## Tratamento de Erros

| Erro | Causa | Resolucao |
|------|-------|-----------|
| `WEBHOOK_TIMEOUT` | N8N nao respondeu | Verificar se workflow esta ativo via logs |
| `HTTP_4XX` | Payload invalido | Revisar formato do payload no catalogo |
| `HTTP_5XX` | Erro interno N8N | Verificar docker logs do n8n |
| `URL_BLOCKED` | Tentando usar /webhook/ (prod) | HALT - Corrigir para /webhook-test/ |
| `DB_NO_RESULT` | Dados nao encontrados apos teste | Pode ser processamento async - aguardar mais |

## Performance

```yaml
duration_expected: 1-3 min por feature
token_usage: ~3,000-10,000 tokens
```

## Metadata

```yaml
version: 1.0.0
dependencies:
  - N8N webhook-test ativo
  - Supabase anon key
  - features-catalog.yaml
  - test-scenarios.yaml
tags:
  - test
  - feature
  - webhook-dev
  - qa
```
