---
task: Gerar Relatorio Priorizado Geral
responsavel: "@inspector"
responsavel_type: agent
atomic_layer: task
elicit: false
Entrada: |
  - feature_reports: array (required) - Lista de relatorios individuais de features
  - scope: string (optional) - Escopo: "all" | "block:{nome}" (default: all)
Saida: |
  - priority_report: .md file em output/feature-reports/
  - summary: object - Resumo geral (total testado, pass, fail, partial)
  - critical_issues: array - Problemas criticos que precisam atencao imediata
  - priority_ranking: array - Features ordenadas por prioridade de correcao
Checklist:
  - "[ ] Coletar todos os relatorios individuais de features"
  - "[ ] Compilar estatisticas gerais (pass/fail/partial/error)"
  - "[ ] Identificar problemas criticos"
  - "[ ] Ordenar features por prioridade de correcao"
  - "[ ] Agrupar problemas por bloco (agenda, financeiro, etc)"
  - "[ ] Calcular metricas gerais (cobertura, taxa de sucesso, UX medio)"
  - "[ ] Carregar template: templates/priority-report-tmpl.md"
  - "[ ] Preencher com dados consolidados"
  - "[ ] Salvar em output/feature-reports/"
  - "[ ] Apresentar resumo executivo ao usuario"
---

# *report-all

Gera relatorio priorizado consolidando os resultados de todas as 29 features testadas.

## Uso

```
@inspector

*report-all
# -> Gera relatorio geral de todas as features

*report-all --scope block:agenda
# -> Gera relatorio apenas do bloco Agenda
```

## Fluxo de Geracao

```
1. COLETA
   ├── Listar todos os relatorios em output/feature-reports/
   ├── Listar todos os resultados em output/test-results/
   └── Compilar dados de cada feature

2. CONSOLIDACAO
   ├── Contar: total testado, PASS, FAIL, PARTIAL, ERROR
   ├── Calcular taxa de sucesso por bloco
   ├── Calcular UX score medio por bloco
   └── Identificar top 10 problemas mais criticos

3. PRIORIZACAO
   ├── Ordenar por: criticidade × impacto × frequencia
   ├── Prioridade CRITICA: Feature principal quebrada
   ├── Prioridade ALTA: Feature funciona parcialmente
   ├── Prioridade MEDIA: Problemas de UX significativos
   └── Prioridade BAIXA: Melhorias cosmeticas

4. GERACAO
   ├── Carregar template: templates/priority-report-tmpl.md
   ├── Preencher dashboard de metricas
   ├── Listar ranking de prioridades
   ├── Incluir recomendacoes gerais
   └── Salvar em: output/feature-reports/YYYY-MM-DD_priority-report.md

5. APRESENTACAO
   ├── Resumo executivo (1 paragrafo)
   ├── Metricas chave (3-5 numeros)
   └── Top 5 acoes prioritarias
```

## Metricas do Relatorio

| Metrica | Descricao |
|---------|-----------|
| Taxa de Sucesso | % de features PASS |
| Cobertura | % de features testadas do total de 29 |
| UX Score Medio | Media dos scores UX (0-10) |
| Problemas Criticos | Quantidade de issues CRITICAS |
| Tempo Medio de Resposta | Media de response time das features |

## Metadata

```yaml
version: 1.0.0
dependencies:
  - priority-report-tmpl.md
  - Relatorios individuais de features
tags:
  - report
  - priority
  - consolidated
  - qa
```
