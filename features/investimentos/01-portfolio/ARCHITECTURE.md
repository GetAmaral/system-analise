# Critica Arquitetural — Portfolio de Investimentos

## Problemas CRITICOS

### 1. Coluna market_symbol inexistente
Frontend define `market_symbol?: string` na interface mas a migration NAO cria a coluna. O hook remove o campo antes do save. Resultado: impossivel rastrear qual ticker esta vinculado ao investimento.

**Recomendacao URGENTE:** `ALTER TABLE investments ADD COLUMN market_symbol TEXT;`

### 2. Taxas do Tesouro hardcoded
IPCA+ e Prefixado retornam valores fixos (6.5% e 14.5%) que NAO vem de API nenhuma. Usuarios tomam decisoes baseados em dados potencialmente errados.

**Recomendacao:** Buscar taxas do Tesouro Direto via API do BCB ou scraping de tesouro.fazenda.gov.br.

### 3. Historico de portfolio inexistente
O grafico de crescimento de 6 meses e FALSO — redistribui valores atuais linearmente. Nao existe tabela de snapshots.

**Recomendacao:** Criar tabela `portfolio_snapshots` com cron diario/semanal que registra valores.

### 4. Sem quantidade de ativos
Tabela so tem `amount_invested` e `current_value`. Nao registra:
- Quantidade de cotas/acoes
- Preco medio de compra
- Multiplas compras do mesmo ativo

**Recomendacao:** Adicionar `quantity DECIMAL(18,8)`, `avg_price DECIMAL(10,4)`.

### 5. APIs externas sem resiliencia
- Sem retry com backoff
- Sem cache server-side
- Timeout agressivo de 5s
- Fallback silencioso para valores stale

**Recomendacao:** Cache em tabela `market_cache` com TTL. Retry com exponential backoff. Indicador visual de "dados atualizados ha X min".

### 6. Busca de ativos hardcoded
Lista de acoes/criptos populares e estatica no codigo. Nao acompanha IPOs, delistings, ou novas criptos.

**Recomendacao:** API de busca real (brapi.dev search endpoint, CoinGecko search).

## Escalabilidade

| Aspecto | Limite | Gargalo |
|---------|--------|---------|
| Ativos por usuario | Sem limite | Sem paginacao na listagem |
| Market data | 5 min polling | CoinGecko rate limit (free tier) |
| Tipos de ativo | 7 (TEXT sem enum) | Inconsistencia de dados |
| Precisao | DECIMAL(10,2) | Portfolios >R$100M e micro-cripto |
| Historico | Nenhum | Impossivel rastrear performance real |
