# Testes — Relatorio PDF via WhatsApp

## T01 — Relatorio mensal gerado e enviado
**Tipo:** Integracao
**PRECISO DE: Credenciais Avelum (Basic Auth)**
**Passos:** Triggerar webhook relatorio-mensal com user_id valido

**Esperado:**
- [ ] PDF gerado via PDFco
- [ ] PDF enviado via WhatsApp
- [ ] Conteudo inclui transacoes do mes

---

## T02 — Relatorio semanal gerado e enviado
**Tipo:** Integracao
**Passos:** Triggerar webhook relatorio-semanal

**Esperado:**
- [ ] PDF com transacoes da semana
- [ ] Enviado via WhatsApp

---

## T03 — Usuario sem transacoes no periodo
**Tipo:** Edge case
**Passos:** Triggerar relatorio para usuario sem gastos no mes

**Esperado:**
- [ ] PDF gerado com tabela vazia ou mensagem "Sem transacoes"

---

## T04 — PDF com muitas transacoes (>100)
**Tipo:** Performance
**Passos:** Usuario com 200 transacoes no mes

**Esperado:**
- [ ] PDF gerado sem timeout
- [ ] Todas transacoes incluidas
**Possivel problema:**
- [ ] PDFco timeout ou PDF muito grande para WhatsApp upload

---

## T05 — Falha no PDFco
**Tipo:** Resiliencia
**Passos:** Simular falha na API PDFco

**Esperado (ATUAL):**
- [ ] Falha silenciosa, usuario nao recebe nada
**Esperado (IDEAL):**
- [ ] Notificacao de erro ao admin, retry automatico

---

## T06 — Falha no upload WhatsApp
**Tipo:** Resiliencia

**Esperado (ATUAL):**
- [ ] Falha silenciosa
**Esperado (IDEAL):**
- [ ] Fallback para envio por email ou link de download

---

## T07 — Totais calculados corretamente
**Tipo:** Funcional
**Passos:** Verificar PDF gerado contra query manual

```sql
SELECT
  SUM(CASE WHEN transaction_type = 'saida' THEN value_spent ELSE 0 END) as despesas,
  SUM(CASE WHEN transaction_type = 'entrada' THEN value_spent ELSE 0 END) as receitas
FROM spent
WHERE fk_user = '<uuid>'
AND date_spent BETWEEN '<start>' AND '<end>';
```

**Esperado:**
- [ ] Totais no PDF coincidem com query

---

## T08 — Date range correto para semana 5
**Tipo:** Edge case
**Passos:** Relatorio da semana 5 de um mes com 31 dias

**Esperado:**
- [ ] Range: dias 29-31 (nao 29-35)

---

## T09 — generate-monthly-report edge function (FALTANTE)
**Tipo:** Bug
**Passos:** Frontend chama supabase.functions.invoke('generate-monthly-report')

**Esperado (ATUAL):**
- [ ] Erro: funcao nao existe
**Esperado (IDEAL):**
- [ ] Funcao implementada e funcional
