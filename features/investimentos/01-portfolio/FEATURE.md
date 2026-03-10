# Feature 01 — Portfolio de Investimentos

## Resumo
Sistema de rastreamento de investimentos com dados de mercado em tempo real. Usuarios registram ativos (Bitcoin, CDB, Tesouro Direto, acoes, cripto, renda fixa, custom) e acompanham profit/loss. Dados de mercado via CoinGecko (cripto), brapi.dev (acoes) e BCB (SELIC/CDI).

## Arquitetura

```
Frontend (InvestmentsView + InvestmentSearchModal)
    ↓ useInvestments() hook
    ↓ Supabase PostgREST → investments table (CRUD)
    ↓ Market data polling (5 min):
    │   ├─ CoinGecko API (Bitcoin BRL)
    │   ├─ BCB API serie 432 (SELIC)
    │   └─ BCB API serie 12 (CDI)
    ↓
    ↓ Edge Function: fetch-market-data
    │   ├─ action=search → Lista hardcoded de ativos populares
    │   ├─ action=quote&type=crypto → CoinGecko
    │   ├─ action=quote&type=stock → brapi.dev (free tier)
    │   └─ action=quote&type=fixed → BCB (SELIC) + calculos
    ↓
    ↓ Calculos:
    │   ├─ totalInvested = SUM(amount_invested)
    │   ├─ totalCurrentValue = SUM(current_value)
    │   ├─ totalProfitLoss = currentValue - invested
    │   └─ profitPercentage = (profitLoss / invested) * 100
    ↓
    ↓ UI: Cards, graficos (bar + pie), lista de ativos
```

## Schema: `investments`

| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | UUID PK | gen_random_uuid() |
| user_id | UUID NOT NULL | FK auth.users(id) ON DELETE CASCADE |
| investment_type | TEXT NOT NULL | 'bitcoin', 'cdb', 'tesouro_direto', 'stock', 'crypto', 'fixed', 'custom' |
| name | TEXT NOT NULL | Nome do ativo |
| amount_invested | DECIMAL(10,2) NOT NULL DEFAULT 0 | Valor investido |
| current_value | DECIMAL(10,2) NOT NULL DEFAULT 0 | Valor atual |
| profit_loss | DECIMAL(10,2) GENERATED | current_value - amount_invested (STORED) |
| investment_date | TIMESTAMP WITH TIME ZONE | Data do investimento |
| notes | TEXT | Notas opcionais |
| created_at | TIMESTAMP | Criacao |
| updated_at | TIMESTAMP | Ultima atualizacao |

**COLUNA FALTANTE:** `market_symbol TEXT` — frontend envia mas banco nao tem. Campo e STRIPPED antes do save.

### RLS Policies
```sql
-- SELECT/INSERT/UPDATE/DELETE: auth.uid() = user_id
```

### Indexes
- `idx_investments_user_id` (user_id)
- `idx_investments_type` (investment_type)

### Triggers
- `update_investments_updated_at` — Atualiza updated_at no UPDATE

## Edge Function: fetch-market-data

### Action: search
Retorna listas HARDCODED de ativos populares:
- **Acoes:** 20 acoes brasileiras (PETR4, VALE3, ITUB4, etc.)
- **Cripto:** 8 criptomoedas (BTC, ETH, SOL, etc.)
- **Renda Fixa:** 6 produtos (CDB, LCI, LCA, Tesouro Selic, IPCA+, Prefixado)

Busca filtra por query string. Retorna max 11 resultados (5+3+3).

### Action: quote

**Crypto:**
- API: CoinGecko `/api/v3/simple/price?ids={coinId}&vs_currencies=brl&include_24hr_change=true`
- Retorna: symbol, name, price (BRL), change24h

**Stock:**
- API: brapi.dev `/api/quote/{symbol}` (free tier, sem API key)
- Retorna: price, previousClose, change24h, marketCap, volume, high, low

**Fixed Income:**
- API: BCB serie 432 (SELIC)
- Calculos derivados:
  - CDB: 100% CDI (~SELIC)
  - LCI/LCA: ~85% CDI (isento IR)
  - Tesouro Selic: SELIC + 0.10%
  - Tesouro IPCA+: **6.50% HARDCODED** (nao busca do BCB)
  - Tesouro Prefixado: **14.50% HARDCODED** (nao busca do BCB)

## Frontend

### Hook: useInvestments()
- CRUD via Supabase
- Market data polling a cada 5 min
- Visibility-aware: para polling quando tab inativa
- Timeout de 5s por request
- Fallback hardcoded: SELIC=11.25%, CDI=11.15%

### Componentes

**InvestmentsView:**
- Card resumo: valor total, profit/loss, %
- Grafico de barras: historico 6 meses (SIMPLIFICADO — nao usa snapshots reais)
- Grafico pizza: alocacao por tipo (Fixed, Stocks, Crypto, Other)
- Lista de ativos com profit/loss individual
- Market quotes card (Bitcoin, CDB, Tesouro Selic)

**InvestmentSearchModal (2 etapas):**
1. Busca de ativos (edge function search)
2. Formulario: nome, valor investido, valor atual, data

## Acesso
- **Requer:** Plano Standard ou Premium (`hasFinancialToolsAccess`)
- **Rota:** `/investimentos` → ProtectedRoute → ProfileGuard → InvestmentsView

## Erros Conhecidos / Riscos CRITICOS

1. **market_symbol NAO existe no banco:** Frontend envia, backend ignora. Impossivel linkar investimento a ticker real.
2. **Taxas do Tesouro HARDCODED:** IPCA+ (6.5%) e Prefixado (14.5%) sao chutes, nao dados reais. Podem estar completamente errados.
3. **Fallback silencioso:** Quando API falha, exibe valores hardcoded sem avisar o usuario que dados sao stale.
4. **Sem validacao de input:** Valores negativos, datas futuras, strings vazias — tudo aceito.
5. **Sem quantidade/cotas:** Nao rastreia quantidade de acoes/cotas compradas, apenas valor total.
6. **Historico de portfolio FALSO:** Grafico de 6 meses redistribui valores atuais para tras — nao reflete crescimento real.
7. **Sem audit trail:** Edicoes e delecoes sem historico.
8. **investment_type TEXT sem constraint:** Permite qualquer string, sem enum.
9. **CDI fallback fragil:** `CDI = SELIC - 0.10%` quando API falha — pode nao refletir realidade.
10. **brapi.dev sem status check:** Resposta HTTP 404/500 nao verificada, pode crashar.
11. **Precisao DECIMAL(10,2):** Maximo R$ 99.999.999,99 — pode limitar portfolios grandes. Cripto perde precisao decimal.
12. **Sem detecao de duplicatas:** Pode criar multiplos investimentos identicos.
