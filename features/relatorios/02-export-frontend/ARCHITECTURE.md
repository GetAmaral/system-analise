# Critica Arquitetural — Export Frontend

## Problemas

### 1. Geracao 100% client-side
Para datasets grandes, bloqueia a UI thread. Deveria usar Web Worker ou server-side generation.

### 2. Sem filtros no export
Exporta todas transacoes independente dos filtros aplicados no dashboard. Confuso para usuario.

**Recomendacao:** Exportar apenas transacoes visiveis (filtradas).

### 3. Duplicacao com relatorio N8N
Frontend gera PDF local, N8N gera PDF via PDFco. Dois sistemas de relatorio paralelos com formatos diferentes.

**Recomendacao:** Unificar: ou tudo client-side (mais rapido, offline) ou tudo server-side (mais consistente).

## Escalabilidade

| Aspecto | Limite | Gargalo |
|---------|--------|---------|
| Transacoes | ~5000 antes de lag | Memoria do navegador |
| PDF pages | Sem limite teorico | jsPDF performance |
