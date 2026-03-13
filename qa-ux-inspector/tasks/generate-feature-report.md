---
task: Gerar Relatorio de Feature
responsavel: "@inspector"
responsavel_type: agent
atomic_layer: task
elicit: false
Entrada: |
  - feature_id: string (required) - ID da feature
  - test_results: object (required) - Resultados dos testes executados
  - audit_results: object (optional) - Resultados da auditoria docs vs realidade
  - db_verification: object (optional) - Resultados da verificacao de banco
  - gcal_verification: object (optional) - Resultados da verificacao de calendario
Saida: |
  - report: .md file em output/feature-reports/
  - overall_status: PASS | FAIL | PARTIAL | ERROR
  - issues_count: number - Total de problemas encontrados
  - ux_score: number (0-10)
  - priority: CRITICA | ALTA | MEDIA | BAIXA
Checklist:
  - "[ ] Coletar todos os resultados (teste, auditoria, verificacoes)"
  - "[ ] Carregar template: templates/feature-test-report-tmpl.md"
  - "[ ] Classificar status geral da feature"
  - "[ ] Listar todos os problemas encontrados com evidencias"
  - "[ ] Avaliar UX score final"
  - "[ ] Definir prioridade de correcao"
  - "[ ] Sugerir correcoes especificas"
  - "[ ] Salvar em output/feature-reports/"
  - "[ ] Apresentar resumo ao usuario"
---

# *report {feature}

Gera relatorio detalhado de uma feature combinando resultados de teste, auditoria e verificacoes.

## Uso

```
@inspector

*report agenda
# -> Gera relatorio completo da feature agenda

*report financeiro-registrar-despesa
# -> Gera relatorio da feature de registro de despesa
```

## Fluxo de Geracao

```
1. COLETA DE DADOS
   ├── Buscar resultados de teste em output/test-results/
   ├── Buscar auditoria em output/feature-reports/ (se existir)
   ├── Consolidar verificacoes de banco e calendario
   └── Compilar lista completa de evidencias

2. ANALISE
   ├── Classificar cada problema por severidade
   ├── Calcular UX score (media ponderada dos criterios)
   ├── Determinar status geral (PASS/FAIL/PARTIAL/ERROR)
   └── Definir prioridade de correcao

3. GERACAO DO RELATORIO
   ├── Carregar template: templates/feature-test-report-tmpl.md
   ├── Preencher todas as secoes
   ├── Incluir evidencias concretas
   ├── Incluir sugestoes de correcao
   └── Salvar em: output/feature-reports/YYYY-MM-DD_{feature_id}-report.md

4. APRESENTACAO
   ├── Mostrar resumo ao usuario
   ├── Destacar problemas criticos
   └── Indicar proximos passos
```

## Metadata

```yaml
version: 1.0.0
dependencies:
  - feature-test-report-tmpl.md
  - test-feature.md (pre-requisito)
tags:
  - report
  - feature
  - qa
```
