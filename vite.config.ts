import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/

export default defineConfig({
  plugins: [react(), {
    name: 'yahoo-finance-proxy',
    configureServer(server) {
      server.middlewares.use('/api/yahoo-quote', async (req, res, _next) => {
        try {
          const url = new URL(req.url!, `http://${req.headers.host}`);
          const symbolParam = url.searchParams.get('symbol');

          if (!symbolParam) {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: 'Symbol required' }));
            return;
          }

          // HELPER: Normalize Price
          const normalizeYahooPrice = (price: any, currency: string | null, symbol: string) => {
            if (price === undefined || price === null) return null;
            if (currency === 'GBp' || (symbol.endsWith('.L') && price > 500)) {
              return price / 100;
            }
            return price;
          };

          // HELPER: Fetch with Host Rotation
          // Try query1, then query2 if failed
          const fetchWithRotation = async (path: string) => {
            const hosts = ['query1.finance.yahoo.com', 'query2.finance.yahoo.com'];
            for (const host of hosts) {
              const fullUrl = `https://${host}${path}`;
              try {
                const r = await fetch(fullUrl, {
                  headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept': 'application/json',
                    'Origin': 'https://finance.yahoo.com',
                    'Referer': 'https://finance.yahoo.com/'
                  }
                });
                if (r.ok) return await r.json();
                console.log(`[Yahoo Proxy] Failed ${r.status} on ${host}`);
              } catch (e: any) {
                console.log(`[Yahoo Proxy] Error on ${host}: ${e.message}`);
              }
            }
            return null; // All failed
          };

          // HELPER: Process Single Symbol
          const processSymbol = async (sym: string) => {
            // 1. Chart API (v8) - Primary for Price
            const chartPath = `/v8/finance/chart/${sym}?range=1d&interval=1d`;

            // 2. Summary API (v10) - Secondary for Details
            const modules = 'price,summaryDetail,defaultKeyStatistics,summaryProfile,topHoldings,fundProfile,assetProfile';
            const summaryPath = `/v10/finance/quoteSummary/${sym}?modules=${modules}`;

            const [chartData, summaryData] = await Promise.all([
              fetchWithRotation(chartPath),
              fetchWithRotation(summaryPath)
            ]);

            const chartResult = chartData?.chart?.result?.[0];
            const quoteSummaryResult = summaryData?.quoteSummary?.result?.[0];

            if (!chartResult && !quoteSummaryResult) {
              // If both fail, return error object for this symbol
              // We don't throw here to avoid killing the whole batch
              return { symbol: sym, error: 'No data' };
            }

            const meta = chartResult?.meta || {};
            const result: any = quoteSummaryResult || {};

            // Construct Quote Object
            return {
              symbol: sym,
              longName: result.price?.longName,
              shortName: result.price?.shortName,
              displayName: result.price?.longName,

              price: normalizeYahooPrice(result.price?.regularMarketPrice || meta.regularMarketPrice, result.price?.currency || meta.currency, sym),
              currency: result.price?.currency || meta.currency,

              marketTime: (result.price?.regularMarketTime || meta.regularMarketTime) ?
                new Date((result.price?.regularMarketTime || meta.regularMarketTime) * 1000) : new Date(),

              marketState: result.price?.marketState || null,

              trailingPE: result.summaryDetail?.trailingPE || result.defaultKeyStatistics?.trailingPE || null,
              forwardPE: result.summaryDetail?.forwardPE || result.defaultKeyStatistics?.forwardPE || null,
              eps: result.defaultKeyStatistics?.trailingEps || null,
              dividendYield: (result.summaryDetail?.dividendYield) ? result.summaryDetail.dividendYield * 100 : null,

              open: result.summaryDetail?.open || null,
              previousClose: result.summaryDetail?.previousClose || meta.chartPreviousClose || null,

              country: result.summaryProfile?.country || null,
              // Sector/Country Weights (Optional - Keep logic if possible or stub if complex)
              // Simplified mapping for brevity/reliability in this fix
              sectorWeights: null,
              countryWeights: null
            };
          };

          let results: any[] = [];
          const symbols = symbolParam.split(',');

          console.log(`[Yahoo Middleware] Processing ${symbols.length} symbols: ${symbols.join(', ')}`);

          results = await Promise.all(symbols.map(s => processSymbol(s.trim())));

          // Filter out failed? Or keep error structure?
          // Existing frontend expects array of objects. failed ones might miss fields.
          // We return whatever we got.

          const responseData = {
            quoteResponse: {
              result: results.filter(r => !r.error),
              error: null
            }
          };

          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(responseData));
        } catch (error: any) {
          console.error('[Yahoo Middleware] Error:', error.message);
          res.statusCode = 200;
          res.end(JSON.stringify({ quoteResponse: { result: [], error: error.message } }));
        }
      });

      // Search Middleware (Keep as is)
      server.middlewares.use('/api/yahoo-search', async (req, res, _next) => {
        // ... Same as before ...
        try {
          const url = new URL(req.url!, `http://${req.headers.host}`);
          const query = url.searchParams.get('query');
          if (!query) { res.statusCode = 400; res.end(JSON.stringify({ error: 'Query required' })); return; }

          // Use Rotation for Search too? NO, search v1 usually robust. Keep simple.
          const searchUrl = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(query)}&quotesCount=6&newsCount=0&enableFuzzyQuery=false&quotesQueryId=tss_match_phrase_query`;
          const response = await fetch(searchUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36', 'Accept': 'application/json' }
          });
          const result = await response.json();
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(result));
        } catch (error: any) {
          res.statusCode = 200;
          res.end(JSON.stringify({ quotes: [], error: error.message }));
        }
      });
    }
  }],
  base: './',
  build: { outDir: 'docs' },
  server: {
    proxy: {
      '/api/yahoo-finance': {
        target: 'https://query1.finance.yahoo.com',
        changeOrigin: true,
        rewrite: (path) => {
          const url = new URL(path, 'http://localhost');
          const symbol = url.searchParams.get('symbol');
          const period = url.searchParams.get('period');
          const interval = url.searchParams.get('interval');
          return `/v8/finance/chart/${symbol}?range=${period}&interval=${interval}`;
        },
        // Error handling for proxy?
        configure: (proxy, _options) => {
          proxy.on('error', (err, _req, _res) => {
            console.log('proxy error', err);
          });
        }
      },
      // ... Keep other proxies if needed, but Middleware handles Quote/Search now.
      '/api/yahoo-quote-summary': {
        target: 'https://query1.finance.yahoo.com',
        changeOrigin: true,
        rewrite: (path) => {
          const url = new URL(path, 'http://localhost');
          const s = url.searchParams.get('symbol');
          const m = url.searchParams.get('modules');
          return `/v10/finance/quoteSummary/${s}?modules=${m}`;
        }
      }
    },
  },
})
