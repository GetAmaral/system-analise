import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const ALLOWED_ORIGINS = [
  'https://totalassistente.com.br',
  'https://www.totalassistente.com.br',
];

function getCorsHeaders(req: Request) {
  const origin = req.headers.get('Origin') || '';
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };
}

// Popular Brazilian stocks for quick search
const POPULAR_STOCKS = [
  { symbol: 'PETR4', name: 'Petrobras PN', sector: 'Petroleo e Gas' },
  { symbol: 'VALE3', name: 'Vale ON', sector: 'Mineracao' },
  { symbol: 'ITUB4', name: 'Itau Unibanco PN', sector: 'Bancos' },
  { symbol: 'BBDC4', name: 'Bradesco PN', sector: 'Bancos' },
  { symbol: 'ABEV3', name: 'Ambev ON', sector: 'Bebidas' },
  { symbol: 'MGLU3', name: 'Magazine Luiza ON', sector: 'Varejo' },
  { symbol: 'WEGE3', name: 'WEG ON', sector: 'Maquinas' },
  { symbol: 'BBAS3', name: 'Banco do Brasil ON', sector: 'Bancos' },
  { symbol: 'RENT3', name: 'Localiza ON', sector: 'Aluguel de Carros' },
  { symbol: 'SUZB3', name: 'Suzano ON', sector: 'Papel e Celulose' },
  { symbol: 'GGBR4', name: 'Gerdau PN', sector: 'Siderurgia' },
  { symbol: 'CSNA3', name: 'CSN ON', sector: 'Siderurgia' },
  { symbol: 'EMBR3', name: 'Embraer ON', sector: 'Aviacao' },
  { symbol: 'RAIL3', name: 'Rumo ON', sector: 'Logistica' },
  { symbol: 'CSAN3', name: 'Cosan ON', sector: 'Energia' },
  { symbol: 'JBSS3', name: 'JBS ON', sector: 'Alimentos' },
  { symbol: 'BPAC11', name: 'BTG Pactual Units', sector: 'Bancos' },
  { symbol: 'VIVT3', name: 'Telefonica Brasil ON', sector: 'Telecomunicacoes' },
  { symbol: 'PRIO3', name: 'PRIO ON', sector: 'Petroleo e Gas' },
  { symbol: 'RADL3', name: 'Raia Drogasil ON', sector: 'Farmacias' },
];

// Popular cryptos
const POPULAR_CRYPTOS = [
  { symbol: 'BTC', name: 'Bitcoin', coinId: 'bitcoin' },
  { symbol: 'ETH', name: 'Ethereum', coinId: 'ethereum' },
  { symbol: 'SOL', name: 'Solana', coinId: 'solana' },
  { symbol: 'XRP', name: 'Ripple', coinId: 'ripple' },
  { symbol: 'ADA', name: 'Cardano', coinId: 'cardano' },
  { symbol: 'DOGE', name: 'Dogecoin', coinId: 'dogecoin' },
  { symbol: 'BNB', name: 'BNB', coinId: 'binancecoin' },
  { symbol: 'AVAX', name: 'Avalanche', coinId: 'avalanche-2' },
];

// Fixed income options
const FIXED_INCOME = [
  { symbol: 'CDB', name: 'CDB (100% CDI)', type: 'cdb' },
  { symbol: 'LCI', name: 'LCI (Isento IR)', type: 'lci' },
  { symbol: 'LCA', name: 'LCA (Isento IR)', type: 'lca' },
  { symbol: 'TESOURO_SELIC', name: 'Tesouro Selic', type: 'tesouro' },
  { symbol: 'TESOURO_IPCA', name: 'Tesouro IPCA+', type: 'tesouro' },
  { symbol: 'TESOURO_PREFIXADO', name: 'Tesouro Prefixado', type: 'tesouro' },
];

// CORRECAO M3: Validar formato de ticker para prevenir SSRF
function isValidTicker(symbol: string): boolean {
  return /^[A-Z0-9]{1,10}$/.test(symbol.toUpperCase());
}

serve(async (req) => {
  const cors = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: cors });
  }

  try {
    const body = await req.json();
    const { action, symbol, type, query } = body;

    // Search action - returns list of matching assets
    if (action === 'search') {
      const searchQuery = (query || '').toUpperCase();
      const results: any[] = [];

      const matchingStocks = POPULAR_STOCKS.filter(
        s => s.symbol.includes(searchQuery) || s.name.toUpperCase().includes(searchQuery)
      ).slice(0, 5).map(s => ({ ...s, type: 'stock', category: 'Acao' }));

      const matchingCryptos = POPULAR_CRYPTOS.filter(
        c => c.symbol.includes(searchQuery) || c.name.toUpperCase().includes(searchQuery)
      ).slice(0, 3).map(c => ({ ...c, type: 'crypto', category: 'Criptomoeda' }));

      const matchingFixed = FIXED_INCOME.filter(
        f => f.symbol.includes(searchQuery) || f.name.toUpperCase().includes(searchQuery)
      ).slice(0, 3).map(f => ({ ...f, type: 'fixed', category: 'Renda Fixa' }));

      results.push(...matchingStocks, ...matchingCryptos, ...matchingFixed);

      if (!searchQuery) {
        return new Response(
          JSON.stringify({
            popular: {
              stocks: POPULAR_STOCKS.slice(0, 6).map(s => ({ ...s, type: 'stock', category: 'Acao' })),
              cryptos: POPULAR_CRYPTOS.slice(0, 4).map(c => ({ ...c, type: 'crypto', category: 'Criptomoeda' })),
              fixed: FIXED_INCOME.map(f => ({ ...f, type: 'fixed', category: 'Renda Fixa' })),
            }
          }),
          { headers: { ...cors, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ results }),
        { headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    // Quote action - get current price for a specific asset
    if (action === 'quote') {
      // CORRECAO M3: Validar ticker
      if (symbol && !isValidTicker(symbol)) {
        return new Response(
          JSON.stringify({ error: "Ticker invalido" }),
          { status: 400, headers: { ...cors, "Content-Type": "application/json" } }
        );
      }

      let data = null;

      if (type === 'crypto') {
        const crypto = POPULAR_CRYPTOS.find(c => c.symbol === symbol.toUpperCase());
        const coinId = crypto?.coinId || symbol.toLowerCase();

        // Validar que coinId so tem caracteres seguros
        if (!/^[a-z0-9-]+$/.test(coinId)) {
          return new Response(
            JSON.stringify({ error: "Crypto ID invalido" }),
            { status: 400, headers: { ...cors, "Content-Type": "application/json" } }
          );
        }

        const response = await fetch(
          `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(coinId)}&vs_currencies=brl&include_24hr_change=true`
        );

        const result = await response.json();

        if (result[coinId]) {
          data = {
            symbol: symbol.toUpperCase(),
            name: crypto?.name || symbol,
            price: result[coinId].brl,
            change24h: result[coinId].brl_24h_change || 0,
            type: 'crypto',
          };
        }
      } else if (type === 'stock') {
        const response = await fetch(
          `https://brapi.dev/api/quote/${encodeURIComponent(symbol)}?range=1d&interval=1d&fundamental=true`
        );

        const result = await response.json();

        if (result.results && result.results.length > 0) {
          const stock = result.results[0];
          data = {
            symbol: stock.symbol,
            name: stock.longName || stock.shortName,
            price: stock.regularMarketPrice,
            previousClose: stock.regularMarketPreviousClose,
            change24h: stock.regularMarketChangePercent || 0,
            marketCap: stock.marketCap,
            volume: stock.regularMarketVolume,
            high: stock.regularMarketDayHigh,
            low: stock.regularMarketDayLow,
            type: 'stock',
            sector: POPULAR_STOCKS.find(s => s.symbol === stock.symbol)?.sector || 'N/A',
          };
        }
      } else if (type === 'fixed') {
        const selicResponse = await fetch(
          'https://api.bcb.gov.br/dados/serie/bcdata.sgs.432/dados/ultimos/1?formato=json'
        );

        const selicData = await selicResponse.json();
        const selicRate = parseFloat(selicData[0]?.valor) || 11.25;

        const fixedOption = FIXED_INCOME.find(f => f.symbol === symbol);

        if (fixedOption) {
          let rate = selicRate;
          let description = '';

          if (symbol === 'CDB') {
            rate = selicRate;
            description = '100% do CDI';
          } else if (symbol === 'LCI' || symbol === 'LCA') {
            rate = selicRate * 0.85;
            description = '~85% do CDI (Isento IR)';
          } else if (symbol === 'TESOURO_SELIC') {
            rate = selicRate + 0.1;
            description = 'SELIC + 0,10%';
          } else if (symbol === 'TESOURO_IPCA') {
            rate = 6.5;
            description = 'IPCA + 6,50% a.a.';
          } else if (symbol === 'TESOURO_PREFIXADO') {
            rate = 14.5;
            description = '14,50% a.a.';
          }

          data = {
            symbol: symbol,
            name: fixedOption.name,
            price: rate,
            description,
            selicRate,
            type: 'fixed',
            unit: '% a.a.',
          };
        }
      }

      if (!data) {
        return new Response(
          JSON.stringify({ error: "Ativo nao encontrado" }),
          {
            headers: { ...cors, "Content-Type": "application/json" },
            status: 404,
          }
        );
      }

      return new Response(
        JSON.stringify(data),
        { headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    // CORRECAO B5: Removido bloco legacy que chamava serve() recursivamente (bug)

    return new Response(
      JSON.stringify({ error: "Invalid action" }),
      {
        headers: { ...cors, "Content-Type": "application/json" },
        status: 400,
      }
    );
  } catch (error) {
    console.error("Error fetching market data:", error);
    // CORRECAO A8: nao vazar mensagem de erro interna
    return new Response(
      JSON.stringify({ error: "Erro ao buscar dados de mercado" }),
      {
        headers: { ...cors, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
