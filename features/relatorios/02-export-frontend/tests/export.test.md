# Testes — Export Frontend

## T01 — Export PDF funcional
**Tipo:** Funcional
**Passos:** Clicar "Exportar PDF" com transacoes no dashboard

**Esperado:**
- [ ] Arquivo .pdf baixado
- [ ] Contem tabela com transacoes
- [ ] Totais corretos no footer

---

## T02 — Export Excel funcional
**Tipo:** Funcional

**Esperado:**
- [ ] Arquivo .xlsx baixado
- [ ] Sheet "Transacoes" com dados
- [ ] Sheet "Resumo" com totais

---

## T03 — Export com 0 transacoes
**Tipo:** Edge case

**Esperado:**
- [ ] PDF/Excel gerado com tabela vazia ou mensagem

---

## T04 — Export com 1000+ transacoes
**Tipo:** Performance

**Esperado:**
- [ ] PDF gerado sem travar navegador
- [ ] Tempo < 5 segundos

---

## T05 — Caracteres especiais (acentos)
**Tipo:** Encoding
**Passos:** Transacao com nome "Recepcao — cafe & cha"

**Esperado:**
- [ ] Caracteres renderizados corretamente no PDF

---

## T06 — Export de analise por categoria
**Tipo:** Funcional

**Esperado:**
- [ ] Excel com categorias agrupadas
- [ ] Percentuais somam ~100%
