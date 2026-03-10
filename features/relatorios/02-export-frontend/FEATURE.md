# Feature 02 — Export Frontend (PDF + Excel)

## Resumo
Exportacao client-side de transacoes financeiras em PDF (jsPDF) e Excel (xlsx). Geracao 100% no navegador, sem dependencia de API externa.

## Arquitetura

```
Frontend (TransactionsDataGrid)
    ↓ Botao "Exportar"
    ↓ exportUtils.ts
    ├─ exportTransactionsToPDF() → jsPDF + AutoTable
    ├─ exportTransactionsToExcel() → xlsx (2 sheets)
    └─ exportCategoryAnalysisToExcel() → xlsx (categorias)
    ↓ File download no navegador
```

## Funcoes

### exportTransactionsToPDF()
**Dependencias:** jsPDF 4.2.0, jspdf-autotable 5.0.7

- **Orientacao:** Landscape A4
- **Header:** "Relatorio de Transacoes — Total Assistente"
- **Colunas:** Data, Descricao, Categoria, Tipo, Valor (R$)
- **Footer:** Total transacoes, receitas, despesas, saldo
- **Cores:** Verde para entradas, vermelho para saidas
- **Filename:** `transacoes_YYYY-MM-DD_HH-mm.pdf`

### exportTransactionsToExcel()
**Dependencia:** xlsx 0.18.5

- **Sheet 1:** "Transacoes" — Todas transacoes com colunas
- **Sheet 2:** "Resumo" — Contagem, receitas, despesas, saldo
- **Filename:** `transacoes_YYYY-MM-DD_HH-mm.xlsx`

### exportCategoryAnalysisToExcel()
- Agrupa despesas por categoria
- Calcula percentual e contagem
- **Filename:** `analise-categorias_YYYY-MM-DD_HH-mm.xlsx`

## Erros Conhecidos / Riscos

1. **Client-side only:** Para datasets grandes (>5000 transacoes), pode travar o navegador
2. **Sem filtro aplicado:** Exporta TODAS transacoes, nao apenas as filtradas na view
3. **Sem formatacao de moeda consistente:** Depende de locale do navegador
4. **Sem protecao do PDF:** Sem senha ou watermark
5. **jsPDF nao suporta UTF-8 completo:** Caracteres especiais podem quebrar
