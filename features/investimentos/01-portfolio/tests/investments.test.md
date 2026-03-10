# Testes — Portfolio de Investimentos

## T01 — Adicionar investimento via search modal
**Tipo:** Funcional
**Passos:**
1. Login como Standard+
2. Abrir InvestmentSearchModal
3. Buscar "Bitcoin"
4. Selecionar, definir amount_invested=1000, current_value=1200
5. Salvar

**Esperado:**
- [ ] Registro em investments com investment_type='bitcoin'
- [ ] profit_loss = 200 (calculated column)
- [ ] Aparece na lista de ativos

---

## T02 — Adicionar investimento custom
**Tipo:** Funcional
**Passos:** Tipo custom, nome "Poupanca", valor 5000

**Esperado:**
- [ ] investment_type='custom'
- [ ] name='Poupanca'

---

## T03 — Editar investimento
**Tipo:** Funcional
**Passos:** Alterar current_value de 1200 para 1500

**Esperado:**
- [ ] current_value atualizado
- [ ] profit_loss recalculado = 500
- [ ] updated_at atualizado

---

## T04 — Deletar investimento
**Tipo:** Funcional

**Esperado:**
- [ ] Registro removido
- [ ] Totais recalculados

---

## T05 — Totais calculados corretamente
**Tipo:** Funcional
**Pre-req:** 3 investimentos: (1000, 1200), (2000, 1800), (500, 600)

**Esperado:**
- [ ] totalInvested = 3500
- [ ] totalCurrentValue = 3600
- [ ] totalProfitLoss = 100
- [ ] profitPercentage = 2.86%

---

## T06 — Market data: Bitcoin real-time
**Tipo:** Integracao
**Passos:** Verificar card de cotacoes

**Esperado:**
- [ ] Preco Bitcoin em BRL exibido
- [ ] Valor muda entre refreshes (mercado ativo)

---

## T07 — Market data: SELIC/CDI
**Tipo:** Integracao

**Esperado:**
- [ ] Taxa SELIC exibida (busca BCB serie 432)
- [ ] Taxa CDI exibida (busca BCB serie 12)

---

## T08 — Market data: API failure graceful
**Tipo:** Resiliencia
**Passos:** Simular falha de rede (desconectar)

**Esperado (ATUAL):**
- [ ] Valores fallback hardcoded exibidos SEM indicacao de stale (BUG)
**Esperado (IDEAL):**
- [ ] Indicador visual "dados indisponiveis" ou "ultima atualizacao: X"

---

## T09 — Edge function: search ativos
**Tipo:** Integracao
```bash
curl -X POST "https://<supabase_url>/functions/v1/fetch-market-data" \
  -H "Authorization: Bearer <anon_key>" \
  -H "Content-Type: application/json" \
  -d '{"action": "search", "query": "PETR"}'
```

**Esperado:**
- [ ] Retorna PETR4 na lista de resultados
- [ ] Formato: { symbol, name, sector, type }

---

## T10 — Edge function: quote acao
**Tipo:** Integracao
```bash
curl -X POST "https://<supabase_url>/functions/v1/fetch-market-data" \
  -H "Authorization: Bearer <anon_key>" \
  -H "Content-Type: application/json" \
  -d '{"action": "quote", "symbol": "PETR4", "type": "stock"}'
```

**Esperado:**
- [ ] Retorna price, change24h, marketCap
- [ ] Dados sao do brapi.dev

---

## T11 — Edge function: quote fixed income
**Tipo:** Integracao
```bash
curl -X POST "https://<supabase_url>/functions/v1/fetch-market-data" \
  -H "Authorization: Bearer <anon_key>" \
  -H "Content-Type: application/json" \
  -d '{"action": "quote", "symbol": "CDB", "type": "fixed"}'
```

**Esperado:**
- [ ] rate retornado (baseado em SELIC)
**Bug Conhecido:**
- [ ] Tesouro IPCA+ retorna 6.5% hardcoded (NAO busca API)
- [ ] Tesouro Prefixado retorna 14.5% hardcoded

---

## T12 — RLS: usuario A nao ve investimentos de B
**Tipo:** Seguranca
```sql
SELECT * FROM investments WHERE user_id = '<uuid_B>';
-- Com token de usuario A
```

**Esperado:**
- [ ] 0 registros

---

## T13 — Grafico de historico (BUG KNOWN)
**Tipo:** Bug
**Passos:** Verificar grafico de barras de 6 meses

**Esperado (ATUAL):**
- [ ] Valores redistribuidos linearmente (NAO reflete historico real)
**Esperado (IDEAL):**
- [ ] Snapshots reais de valor do portfolio por mes

---

## T14 — Grafico pizza: alocacao por tipo
**Tipo:** Funcional
**Pre-req:** Mix de tipos: bitcoin, cdb, stock

**Esperado:**
- [ ] Categorias: Crypto, Fixed Income, Stocks
- [ ] Percentuais somam 100%

---

## T15 — Validacao: valor negativo (BUG KNOWN)
**Tipo:** Bug
**Passos:** Inserir amount_invested = -500

**Esperado (ATUAL):**
- [ ] Aceito sem validacao
**Esperado (IDEAL):**
- [ ] Rejeitado com mensagem de erro

---

## T16 — Visibility-aware polling
**Tipo:** Performance
**Passos:**
1. Abrir dashboard de investimentos
2. Mudar para outra aba por 10 minutos
3. Voltar

**Esperado:**
- [ ] Polling parou enquanto tab inativa
- [ ] Polling reinicia ao voltar
- [ ] Dados atualizados imediatamente

---

## T17 — Plano Free bloqueado
**Tipo:** Acesso
**Passos:** Login como Free, navegar para /investimentos

**Esperado:**
- [ ] PlanBlocker exibido
- [ ] Nenhum dado de investimentos acessivel
