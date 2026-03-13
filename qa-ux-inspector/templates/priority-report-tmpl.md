# Relatorio Priorizado Geral — Total Assistente

**Data:** {{DATE}}
**Inspector:** @inspector
**Escopo:** {{SCOPE}}
**Total de Features:** 29
**Features Testadas:** {{FEATURES_TESTED}}

---

## Resumo Executivo

{{EXECUTIVE_SUMMARY}}

---

## Dashboard de Metricas

| Metrica | Valor |
|---------|-------|
| Features Testadas | {{FEATURES_TESTED}}/29 |
| Taxa de Sucesso (PASS) | {{PASS_RATE}}% |
| Features PASS | {{PASS_COUNT}} |
| Features PARTIAL | {{PARTIAL_COUNT}} |
| Features FAIL | {{FAIL_COUNT}} |
| Features ERROR | {{ERROR_COUNT}} |
| Problemas Criticos | {{CRITICAL_ISSUES}} |
| Problemas Altos | {{HIGH_ISSUES}} |
| Problemas Medios | {{MEDIUM_ISSUES}} |
| Problemas Baixos | {{LOW_ISSUES}} |
| UX Score Medio | {{AVG_UX_SCORE}}/10 |
| Tempo Medio de Resposta | {{AVG_RESPONSE_TIME}}ms |

---

## Resultados por Bloco

### Bloco Agenda

| Feature | Status | UX Score | Problemas | Prioridade |
|---------|--------|----------|-----------|------------|
{{BLOCK_AGENDA_RESULTS}}

### Bloco Financeiro

| Feature | Status | UX Score | Problemas | Prioridade |
|---------|--------|----------|-----------|------------|
{{BLOCK_FINANCEIRO_RESULTS}}

### Bloco Relatorios

| Feature | Status | UX Score | Problemas | Prioridade |
|---------|--------|----------|-----------|------------|
{{BLOCK_RELATORIOS_RESULTS}}

### Bloco Premium

| Feature | Status | UX Score | Problemas | Prioridade |
|---------|--------|----------|-----------|------------|
{{BLOCK_PREMIUM_RESULTS}}

### Bloco Sistema

| Feature | Status | UX Score | Problemas | Prioridade |
|---------|--------|----------|-----------|------------|
{{BLOCK_SISTEMA_RESULTS}}

---

## Top 10 Problemas Criticos

{{#TOP_ISSUES}}
### {{RANK}}. [{{SEVERITY}}] {{ISSUE_TITLE}}

**Feature:** {{FEATURE_ID}}
**Impacto:** {{IMPACT}}
**Descricao:** {{DESCRIPTION}}
**Correcao:** {{SUGGESTED_FIX}}

---
{{/TOP_ISSUES}}

## Ranking de Prioridade de Correcao

| # | Feature | Status | Criticidade | Esforco | Sprint Sugerido |
|---|---------|--------|-------------|---------|-----------------|
{{PRIORITY_RANKING}}

---

## Analise de UX por Bloco

| Bloco | UX Score | Pior Criterio | Melhor Criterio |
|-------|----------|---------------|-----------------|
{{UX_BY_BLOCK}}

---

## Recomendacoes Gerais

### Acoes Imediatas (Sprint Atual)

{{IMMEDIATE_ACTIONS}}

### Melhorias de Curto Prazo (Proximo Sprint)

{{SHORT_TERM_IMPROVEMENTS}}

### Melhorias de Longo Prazo (Backlog)

{{LONG_TERM_IMPROVEMENTS}}

---

## Tendencias e Padroes

{{TRENDS_AND_PATTERNS}}

---

## Proximos Passos

- [ ] {{NEXT_STEPS}}

---

*Relatorio gerado por @inspector (QA & UX Auditor) - modo READ + TEST*
*Testes executados via webhook DEV (/webhook-test/). NENHUMA alteracao foi feita em producao.*
*Para implementar as correcoes, encaminhe este relatorio para @dev.*
