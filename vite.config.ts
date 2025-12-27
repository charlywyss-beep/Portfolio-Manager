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
          const symbol = url.searchParams.get('symbol');

          if (!symbol) {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: 'Symbol required' }));
            return;
          }

          console.log(`[Yahoo Middleware] Fetching quote for ${symbol}`);

          // Fetch robust data using yahoo-finance2 (handles crumbs/cookies)
          const result: any = await yahooFinance.quoteSummary(symbol, {
            modules: ['price', 'summaryDetail', 'defaultKeyStatistics', 'summaryProfile']
          });

          // Map to format expected by frontend (mimic v7 quoteResponse)
          const quote = {
            symbol: symbol,
            regularMarketPrice: result.price?.regularMarketPrice,
            currency: result.price?.currency,
            regularMarketTime: result.price?.regularMarketTime ? new Date(result.price.regularMarketTime).getTime() / 1000 : null,
            // KGV / Yield Data
            trailingPE: result.summaryDetail?.trailingPE,
            forwardPE: result.summaryDetail?.forwardPE || result.defaultKeyStatistics?.forwardPE,
            epsTrailingTwelveMonths: result.defaultKeyStatistics?.trailingEps,
            // Convert decimal yield (0.034) to percentage (3.4) for UI consistency if needed, 
            // OR frontend expects decimal? 
            // Previous code: `stock.dividendYield.toFixed(2)%`. If value is 3.4, it shows "3.40%". 
            // If value is 0.034, it shows "0.03%". 
            // Yahoo v7 returns e.g. 3.45. yahoo-finance2 returns 0.0345.
            // So we MUST multiply by 100.
            dividendYield: result.summaryDetail?.dividendYield ? result.summaryDetail.dividendYield * 100 : null,
            // Country Data
            country: result.summaryProfile?.country
          };

          const responseData = {
            quoteResponse: {
              result: [quote],
              error: null
            }
          };

          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(responseData));
        } catch (error: any) {
          console.error('[Yahoo Middleware] Error:', error.message);
          // Fallback to empty if not found, to avoid breaking UI
          res.statusCode = 200;
          res.end(JSON.stringify({ quoteResponse: { result: [], error: error.message } }));
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
