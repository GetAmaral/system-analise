---
task: Auditar Documentacao vs Implementacao
responsavel: "@inspector"
responsavel_type: agent
atomic_layer: task
elicit: true
Entrada: |
  - feature_id: string (required) - ID da feature conforme features-catalog.yaml
  - doc_sources: array (optional) - Fontes de documentacao para comparar
Saida: |
  - audit_report: .md file em output/feature-reports/
  - discrepancies: array - Divergencias encontradas entre docs e realidade
  - doc_coverage: number (0-100) - Percentual da feature coberta pela documentacao
  - accuracy: number (0-100) - Precisao da documentacao vs comportamento real
Checklist:
  - "[ ] Carregar expected behaviors de data/expected-behaviors.yaml"
  - "[ ] Ler documentacao existente do projeto (README, docs)"
  - "[ ] Executar teste da feature via webhook DEV"
  - "[ ] Comparar resposta real vs documentacao"
  - "[ ] Identificar divergencias (funciona diferente do documentado)"
  - "[ ] Identificar lacunas (nao documentado mas existe)"
  - "[ ] Identificar obsolescencias (documentado mas nao existe mais)"
  - "[ ] Classificar cada divergencia por severidade"
  - "[ ] Gerar relatorio de auditoria"
  - "[ ] Salvar em output/feature-reports/"
---

# *audit {feature}

Compara a documentacao de uma feature com seu comportamento real, identificando divergencias, lacunas e obsolescencias.

## Uso

```
@inspector

*audit agenda
# -> Audita a feature de agenda comparando docs vs realidade

*audit-all
# -> Audita todas as 29 features
```

## Fluxo de Auditoria

```
1. COLETA DE DOCUMENTACAO
   ├── Ler data/expected-behaviors.yaml para a feature
   ├── Ler documentacao do projeto (README, docs especificos)
   ├── Ler JSON do workflow N8N correspondente
   └── Compilar lista de comportamentos documentados

2. TESTE DA FEATURE
   ├── Executar task test-feature.md para a feature
   ├── Coletar comportamento real (responses, dados no banco)
   └── Documentar comportamento observado

3. COMPARACAO
   ├── Para cada comportamento documentado:
   │   ├── Existe na implementacao? (SIM/NAO)
   │   ├── Funciona como descrito? (SIM/NAO/PARCIAL)
   │   └── Classificar: CONFORME / DIVERGENTE / OBSOLETO
   ├── Para cada comportamento observado:
   │   └── Esta documentado? (SIM/NAO → LACUNA)
   └── Calcular metricas: cobertura e precisao

4. CLASSIFICACAO DE DIVERGENCIAS
   ├── CRITICA: Feature principal funciona diferente do documentado
   ├── ALTA: Comportamento secundario diverge significativamente
   ├── MEDIA: Detalhes de formatacao ou mensagem diferem
   └── BAIXA: Divergencias cosmeticas ou de nomenclatura

5. GERACAO DE RELATORIO
   ├── Listar todas as divergencias com evidencias
   ├── Sugerir correcoes (na doc ou na implementacao)
   └── Salvar em output/feature-reports/
```

## Tratamento de Erros

| Erro | Causa | Resolucao |
|------|-------|-----------|
| `NO_DOCS_FOUND` | Feature sem documentacao | Registrar como lacuna total |
| `FEATURE_NOT_FOUND` | Feature nao existe no catalogo | Verificar features-catalog.yaml |
| `TEST_FAILED` | Teste da feature falhou | Registrar como FAIL e documentar erro |

## Metadata

```yaml
version: 1.0.0
dependencies:
  - expected-behaviors.yaml
  - features-catalog.yaml
  - test-feature.md (sub-task)
tags:
  - audit
  - documentation
  - comparison
  - qa
```
