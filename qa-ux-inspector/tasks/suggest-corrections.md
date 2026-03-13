---
task: Sugerir Correcoes por Criticidade
responsavel: "@inspector"
responsavel_type: agent
atomic_layer: task
elicit: false
Entrada: |
  - priority_report: object (required) - Relatorio priorizado geral
  - feature_reports: array (required) - Relatorios individuais de features
  - scope: string (optional) - Escopo: "all" | "critical-only" | "block:{nome}" (default: all)
Saida: |
  - correction_guide: .md file em output/corrections/
  - total_corrections: number - Total de correcoes sugeridas
  - by_criticality: object - Correcoes agrupadas por criticidade
  - estimated_effort: string - Estimativa de esforco total
Checklist:
  - "[ ] Coletar todos os problemas dos relatorios de features"
  - "[ ] Classificar cada problema por criticidade (CRITICA/ALTA/MEDIA/BAIXA)"
  - "[ ] Para cada problema, sugerir correcao especifica e acionavel"
  - "[ ] Identificar onde corrigir (workflow N8N, edge function, prompt, banco)"
  - "[ ] Estimar esforco de cada correcao (rapida/media/complexa)"
  - "[ ] Agrupar correcoes por sprint/prioridade"
  - "[ ] Carregar template: templates/correction-guide-tmpl.md"
  - "[ ] Preencher com correcoes priorizadas"
  - "[ ] Salvar em output/corrections/"
  - "[ ] Apresentar resumo ao usuario"
---

# *corrections

Gera guia de correcoes priorizadas por criticidade, agrupando todos os problemas encontrados com sugestoes acionaveis.

## Uso

```
@inspector

*corrections
# -> Guia completo de correcoes para todos os problemas encontrados

*corrections --scope critical-only
# -> Apenas correcoes para problemas criticos

*corrections --scope block:financeiro
# -> Correcoes apenas do bloco financeiro
```

## Fluxo de Geracao

```
1. COLETA DE PROBLEMAS
   ├── Extrair issues de todos os relatorios de features
   ├── Extrair divergencias de todas as auditorias
   └── Compilar lista unica de problemas

2. CLASSIFICACAO
   ├── CRITICA: Sistema quebrado, dados incorretos, feature inacessivel
   ├── ALTA: Feature funciona parcialmente, dados incompletos
   ├── MEDIA: UX ruim, mensagens confusas, formatacao errada
   └── BAIXA: Melhorias cosmeticas, otimizacoes

3. SUGESTAO DE CORRECAO
   Para cada problema:
   ├── Descricao clara do problema
   ├── Evidencia (payload, response, query)
   ├── Localizacao (qual workflow, nodo, funcao, tabela)
   ├── Correcao sugerida (passo a passo)
   ├── Componente responsavel (N8N / Edge Function / Prompt / DB / Frontend)
   └── Esforco estimado (rapida: <1h | media: 1-4h | complexa: >4h)

4. AGRUPAMENTO
   ├── Por criticidade (CRITICA primeiro)
   ├── Por componente (agrupa correcoes no mesmo workflow)
   └── Por sprint sugerido (Sprint 1: criticas, Sprint 2: altas, etc)

5. GERACAO
   ├── Carregar template: templates/correction-guide-tmpl.md
   ├── Preencher com correcoes priorizadas
   └── Salvar em: output/corrections/YYYY-MM-DD_correction-guide.md
```

## Formato de Correcao

```
### [CRITICIDADE] Problema: {descricao curta}

**Feature:** {feature_id}
**Componente:** {workflow/edge-function/prompt/db}
**Localizacao:** {caminho especifico}
**Esforco:** {rapida/media/complexa}

**Problema:**
{descricao detalhada com evidencia}

**Correcao Sugerida:**
1. {passo 1}
2. {passo 2}
3. {passo 3}

**Verificacao:**
- {como verificar que a correcao funcionou}
```

## Metadata

```yaml
version: 1.0.0
dependencies:
  - correction-guide-tmpl.md
  - Relatorios de features (pre-requisito)
tags:
  - corrections
  - priority
  - guide
  - qa
```
