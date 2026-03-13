# Guia de Correcoes — Total Assistente

**Data:** {{DATE}}
**Inspector:** @inspector
**Total de Correcoes:** {{TOTAL_CORRECTIONS}}
**Esforco Estimado Total:** {{TOTAL_EFFORT}}

---

## Resumo Executivo

{{EXECUTIVE_SUMMARY}}

---

## Visao Geral por Criticidade

| Criticidade | Quantidade | Esforco Estimado |
|-------------|-----------|-----------------|
| CRITICA | {{CRITICAL_COUNT}} | {{CRITICAL_EFFORT}} |
| ALTA | {{HIGH_COUNT}} | {{HIGH_EFFORT}} |
| MEDIA | {{MEDIUM_COUNT}} | {{MEDIUM_EFFORT}} |
| BAIXA | {{LOW_COUNT}} | {{LOW_EFFORT}} |

## Visao Geral por Componente

| Componente | Quantidade | Esforco Estimado |
|-----------|-----------|-----------------|
| Workflow N8N | {{N8N_COUNT}} | {{N8N_EFFORT}} |
| Edge Function | {{EDGE_COUNT}} | {{EDGE_EFFORT}} |
| Prompt AI | {{PROMPT_COUNT}} | {{PROMPT_EFFORT}} |
| Banco de Dados | {{DB_COUNT}} | {{DB_EFFORT}} |
| Frontend | {{FRONTEND_COUNT}} | {{FRONTEND_EFFORT}} |

---

## Sprint 1 — Correcoes CRITICAS

{{#CRITICAL_CORRECTIONS}}
### CRITICA-{{INDEX}}: {{TITLE}}

**Feature:** {{FEATURE_ID}} ({{FEATURE_NAME}})
**Componente:** {{COMPONENT}}
**Localizacao:** {{LOCATION}}
**Esforco:** {{EFFORT}}

**Problema:**
{{PROBLEM_DESCRIPTION}}

**Evidencia:**
```
{{EVIDENCE}}
```

**Correcao Sugerida:**
{{CORRECTION_STEPS}}

**Verificacao:**
{{VERIFICATION_STEPS}}

---
{{/CRITICAL_CORRECTIONS}}

## Sprint 2 — Correcoes ALTAS

{{#HIGH_CORRECTIONS}}
### ALTA-{{INDEX}}: {{TITLE}}

**Feature:** {{FEATURE_ID}} ({{FEATURE_NAME}})
**Componente:** {{COMPONENT}}
**Localizacao:** {{LOCATION}}
**Esforco:** {{EFFORT}}

**Problema:**
{{PROBLEM_DESCRIPTION}}

**Evidencia:**
```
{{EVIDENCE}}
```

**Correcao Sugerida:**
{{CORRECTION_STEPS}}

**Verificacao:**
{{VERIFICATION_STEPS}}

---
{{/HIGH_CORRECTIONS}}

## Sprint 3 — Correcoes MEDIAS

{{#MEDIUM_CORRECTIONS}}
### MEDIA-{{INDEX}}: {{TITLE}}

**Feature:** {{FEATURE_ID}} ({{FEATURE_NAME}})
**Componente:** {{COMPONENT}}
**Localizacao:** {{LOCATION}}
**Esforco:** {{EFFORT}}

**Problema:**
{{PROBLEM_DESCRIPTION}}

**Correcao Sugerida:**
{{CORRECTION_STEPS}}

---
{{/MEDIUM_CORRECTIONS}}

## Backlog — Correcoes BAIXAS

{{#LOW_CORRECTIONS}}
### BAIXA-{{INDEX}}: {{TITLE}}

**Feature:** {{FEATURE_ID}}
**Componente:** {{COMPONENT}}
**Esforco:** {{EFFORT}}
**Descricao:** {{PROBLEM_DESCRIPTION}}
**Sugestao:** {{CORRECTION_STEPS}}

---
{{/LOW_CORRECTIONS}}

## Dependencias Entre Correcoes

{{DEPENDENCY_MAP}}

---

## Ordem de Execucao Recomendada

{{EXECUTION_ORDER}}

---

## Notas para o Time de Desenvolvimento

{{DEV_NOTES}}

---

*Guia gerado por @inspector (QA & UX Auditor) - modo READ + TEST*
*Este guia e apenas uma recomendacao. Correcoes devem ser implementadas por @dev e deployadas por @devops.*
*Apos implementar correcoes, re-executar `*test-all` para validar.*
