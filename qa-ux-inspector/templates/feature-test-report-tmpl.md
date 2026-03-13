# Relatorio de Teste: {{FEATURE_NAME}}

**Data:** {{DATE}}
**Inspector:** @inspector
**Feature ID:** {{FEATURE_ID}}
**Bloco:** {{BLOCK}}
**Status Geral:** {{STATUS}}
**UX Score:** {{UX_SCORE}}/10
**Prioridade de Correcao:** {{PRIORITY}}

---

## Resumo Executivo

{{EXECUTIVE_SUMMARY}}

---

## Informacoes da Feature

**Nome:** {{FEATURE_NAME}}
**Descricao:** {{FEATURE_DESCRIPTION}}
**Webhook Endpoint:** {{WEBHOOK_ENDPOINT}}
**Tabelas Supabase:** {{SUPABASE_TABLES}}
**Envolve Google Calendar:** {{INVOLVES_GCAL}}

---

## Resultados dos Testes

### Happy Path

| Cenario | Payload | Response | Tempo | Status |
|---------|---------|----------|-------|--------|
{{HAPPY_PATH_RESULTS}}

### Edge Cases

| Cenario | Payload | Response | Tempo | Status |
|---------|---------|----------|-------|--------|
{{EDGE_CASE_RESULTS}}

### Cenarios de Erro

| Cenario | Payload | Response | Tempo | Status |
|---------|---------|----------|-------|--------|
{{ERROR_SCENARIO_RESULTS}}

---

## Verificacao de Banco de Dados

**Tabela(s) verificada(s):** {{VERIFIED_TABLES}}

| Campo | Esperado | Encontrado | Match |
|-------|----------|------------|-------|
{{DB_VERIFICATION_RESULTS}}

---

## Verificacao de Google Calendar

{{GCAL_VERIFICATION_RESULTS}}
<!-- Se nao aplicavel: "N/A - Feature nao envolve Google Calendar" -->

---

## Auditoria: Documentacao vs Realidade

**Cobertura da Documentacao:** {{DOC_COVERAGE}}%
**Precisao da Documentacao:** {{DOC_ACCURACY}}%

| Aspecto | Documentado | Real | Status |
|---------|------------|------|--------|
{{DOC_AUDIT_RESULTS}}

### Divergencias Encontradas

{{DISCREPANCIES}}

### Lacunas na Documentacao

{{DOC_GAPS}}

---

## Avaliacao UX

| Criterio | Score (0-10) | Observacoes |
|----------|-------------|-------------|
| Tempo de resposta | {{UX_RESPONSE_TIME_SCORE}} | {{UX_RESPONSE_TIME_NOTES}} |
| Clareza da mensagem | {{UX_CLARITY_SCORE}} | {{UX_CLARITY_NOTES}} |
| Tratamento de erros | {{UX_ERROR_HANDLING_SCORE}} | {{UX_ERROR_HANDLING_NOTES}} |
| Formatacao | {{UX_FORMATTING_SCORE}} | {{UX_FORMATTING_NOTES}} |
| Linguagem natural | {{UX_LANGUAGE_SCORE}} | {{UX_LANGUAGE_NOTES}} |
| Completude da resposta | {{UX_COMPLETENESS_SCORE}} | {{UX_COMPLETENESS_NOTES}} |
| **Media** | **{{UX_SCORE}}** | |

---

## Problemas Encontrados

{{#ISSUES}}
### {{ISSUE_NUMBER}}. [{{ISSUE_SEVERITY}}] {{ISSUE_TITLE}}

**Tipo:** {{ISSUE_TYPE}}
**Impacto:** {{ISSUE_IMPACT}}

**Descricao:**
{{ISSUE_DESCRIPTION}}

**Evidencia:**
{{ISSUE_EVIDENCE}}

**Correcao Sugerida:**
{{ISSUE_SUGGESTED_FIX}}

---
{{/ISSUES}}

## Sugestoes de Melhoria

{{IMPROVEMENT_SUGGESTIONS}}

---

## Proximos Passos

- [ ] {{NEXT_STEPS}}

---

*Relatorio gerado por @inspector (QA & UX Auditor) - modo READ + TEST*
*Testes executados via webhook DEV (/webhook-test/). NENHUMA alteracao foi feita em producao.*
*Para implementar as correcoes, encaminhe este relatorio para @dev.*
