import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
import YahooFinance from 'yahoo-finance2';

const yahooFinance = new YahooFinance();

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

          console.log(`[Yahoo Middleware] Fetching quote for ${symbolParam}`);

          let results = [];

          if (symbolParam.includes(',')) {
            // BATCH REQUEST: Use quote() which supports multiple symbols
            const symbols = symbolParam.split(',');
            const quoteResults = await yahooFinance.quote(symbols);

            // Map flat quote objects to our schema
            results = quoteResults.map((q: any) => ({
              symbol: q.symbol,
              regularMarketPrice: q.regularMarketPrice,
              regularMarketOpen: q.regularMarketOpen,
              regularMarketPreviousClose: q.regularMarketPreviousClose,
              currency: q.currency,
              regularMarketTime: q.regularMarketTime ? new Date(q.regularMarketTime).getTime() / 1000 : null,
              marketState: q.marketState,
              trailingPE: q.trailingPE,
              forwardPE: q.forwardPE,
              epsTrailingTwelveMonths: q.epsTrailingTwelveMonths,
              dividendYield: q.dividendYield, // usually percentage in quote()
              country: null // quote() often lacks country, but acceptable for batch view
            }));

          } else {
            // SINGLE REQUEST: Use quoteSummary() for rich details
            const result: any = await yahooFinance.quoteSummary(symbolParam, {
              modules: ['price', 'summaryDetail', 'defaultKeyStatistics', 'summaryProfile', 'topHoldings']
            });

            if (result.topHoldings) {
              console.log(`[Yahoo Middleware] ETF Top Holdings found for ${symbolParam}`);
            }

            // Map structured result to our schema
            results = [{
              symbol: symbolParam,
              regularMarketPrice: result.price?.regularMarketPrice,
              regularMarketOpen: result.price?.regularMarketOpen || result.summaryDetail?.open,
              regularMarketPreviousClose: result.price?.regularMarketPreviousClose || result.summaryDetail?.previousClose,
              currency: result.price?.currency,
              regularMarketTime: result.price?.regularMarketTime ? new Date(result.price.regularMarketTime).getTime() / 1000 : null,
              marketState: result.price?.marketState,
              // KGV / Yield Data
              trailingPE: result.summaryDetail?.trailingPE,
              forwardPE: result.summaryDetail?.forwardPE || result.defaultKeyStatistics?.forwardPE,
              epsTrailingTwelveMonths: result.defaultKeyStatistics?.trailingEps,
              // quoteSummary dividendYield is decimal, need * 100
              dividendYield: result.summaryDetail?.dividendYield ? result.summaryDetail.dividendYield * 100 : null,
              // Country Data
              country: result.summaryProfile?.country,
              // ETF Allocation Data (NEW)
              sectorWeights: result.topHoldings?.sectorWeightings?.reduce((acc: any, sw: any) => {
                const name = Object.keys(sw)[0];
                const value = Object.values(sw)[0];
                if (name && typeof value === 'number') acc[name] = value * 100; // Convert to %
                return acc;
              }, {}) || null,
              countryWeights: result.topHoldings?.regionalExposure?.reduce((acc: any, re: any) => {
                const name = Object.keys(re)[0];
                const value = Object.values(re)[0];
                if (name && typeof value === 'number') acc[name] = value * 100; // Convert to %
                return acc;
              }, {}) || null
            }];
          }

          const responseData = {
            quoteResponse: {
              result: results,
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

      // Search Middleware
      server.middlewares.use('/api/yahoo-search', async (req, res, _next) => {
        try {
          const url = new URL(req.url!, `http://${req.headers.host}`);
          const query = url.searchParams.get('query');

          if (!query) {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: 'Query required' }));
            return;
          }

          console.log(`[Yahoo Middleware] Searching for ${query}`);
          const result = await yahooFinance.search(query);

          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(result));
        } catch (error: any) {
          console.error('[Yahoo Middleware] Search Error:', error.message);
          res.statusCode = 200;
          res.end(JSON.stringify({ quotes: [], error: error.message }));
        }
      });
    }
  }],
  base: './',
  build: {
    outDir: 'docs',
  },
  server: {
    proxy: {
      '/api/yahoo-finance': {
        target: 'https://query1.finance.yahoo.com',
        changeOrigin: true,
        rewrite: (path) => {
          // Extract query params from /api/yahoo-finance?symbol=X&period=Y&interval=Z
          const url = new URL(path, 'http://localhost');
          const symbol = url.searchParams.get('symbol');
          const period = url.searchParams.get('period');
          const interval = url.searchParams.get('interval');
          return `/v8/finance/chart/${symbol}?range=${period}&interval=${interval}`;
        },
      }
    },
  },
})
