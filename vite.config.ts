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

          // HELPER: Normalize Price (Keep existing logic)
          const normalizeYahooPrice = (price: any, currency: string | null, symbol: string) => {
            if (price === undefined || price === null) return null;
            if (currency === 'GBp' || (symbol.endsWith('.L') && price > 500)) {
              return price / 100;
            }
            return price;
          };

          // DYNAMIC IMPORT for yahoo-finance2 to avoid build-time issues if possible, 
          // but top-level import is better if it works. 
          // Based on test script, we need explicit instantiation.
          const { default: YahooFinance } = await import('yahoo-finance2');
          const yahooFinance = new YahooFinance();
          // yahooFinance.suppressLogger(); // helper removed or different in this version

          // HELPER: Process Single Symbol
          const processSymbol = async (sym: string) => {
            try {
              // Fetch modules needed for full details
              const result = await yahooFinance.quoteSummary(sym, {
                modules: ['price', 'summaryDetail', 'defaultKeyStatistics', 'summaryProfile']
              });

              if (!result) return { symbol: sym, error: 'No data' };

              // Map to existing structure
              // Cast to any to avoid TS strictness on partial returns
              const price: any = result.price || {};
              const summaryDetail: any = result.summaryDetail || {};
              const defaultKeyStatistics: any = result.defaultKeyStatistics || {};
              const summaryProfile: any = result.summaryProfile || {};

              const currency = price.currency;
              const rawPrice = price.regularMarketPrice;

              return {
                symbol: sym,
                longName: price.longName,
                shortName: price.shortName,
                displayName: price.longName,

                price: normalizeYahooPrice(rawPrice, currency, sym),
                currency: currency,

                marketTime: price.regularMarketTime || new Date(),
                marketState: price.marketState || null,

                trailingPE: summaryDetail.trailingPE || defaultKeyStatistics.trailingPE || null,
                forwardPE: summaryDetail.forwardPE || defaultKeyStatistics.forwardPE || null,
                eps: defaultKeyStatistics.trailingEps || null,
                dividendYield: (summaryDetail.dividendYield) ? summaryDetail.dividendYield * 100 : null,

                open: summaryDetail.open || null,
                previousClose: summaryDetail.previousClose || price.regularMarketPreviousClose || null,

                country: summaryProfile.country || null,
                sectorWeights: null,
                countryWeights: null
              };

            } catch (e: any) {
              console.log(`[Yahoo Middleware] Failed to fetch ${sym}: ${e.message}`);
              return { symbol: sym, error: e.message };
            }
          };

          const symbols = symbolParam.split(',');
          // console.log(`[Yahoo Middleware] Processing ${symbols.length} symbols: ${symbols.join(', ')}`);

          const results = await Promise.all(symbols.map(s => processSymbol(s.trim())));

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

      // Search Middleware using yahoo-finance2
      server.middlewares.use('/api/yahoo-search', async (req, res, _next) => {
        try {
          const url = new URL(req.url!, `http://${req.headers.host}`);
          const query = url.searchParams.get('query');
          if (!query) { res.statusCode = 400; res.end(JSON.stringify({ error: 'Query required' })); return; }

          const { default: YahooFinance } = await import('yahoo-finance2');
          const yahooFinance = new YahooFinance();
          // yahooFinance.suppressLogger();

          const result = await yahooFinance.search(query);

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
