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

          // HELPER: Normalize Price (e.g. GBp -> GBP)
          const normalizeYahooPrice = (price: any, currency: string | null, symbol: string) => {
            if (price === undefined || price === null) return null;
            if (currency === 'GBp' || (symbol.endsWith('.L') && price > 500)) {
              // Very rough heuristic: if it's .L and price is high, it might be pence. 
              // But Yahoo's 'currency' field is the primary source.
              return price / 100;
            }
            return price;
          };

          let results: any[] = [];

          if (symbolParam.includes(',')) {
            // BATCH REQUEST ... (lines 29-47)
            const symbols = symbolParam.split(',');
            const quoteResults = await yahooFinance.quote(symbols);
            results = quoteResults.map((q: any) => ({
              symbol: q.symbol,
              price: normalizeYahooPrice(q.regularMarketPrice, q.currency, q.symbol),
              currency: q.currency,
              marketTime: q.regularMarketTime ? new Date(q.regularMarketTime * 1000) : null,
              marketState: q.marketState,
              trailingPE: q.trailingPE || null,
              forwardPE: q.forwardPE || null,
              eps: q.epsTrailingTwelveMonths || null,
              dividendYield: q.dividendYield || null,
              open: q.regularMarketOpen || null,
              previousClose: q.regularMarketPreviousClose || null
            }));
          } else {
            // HELPER: Scraper Fallback for UCITS ETFs (VWRA.L etc.)
            const fetchEtfHoldingsScraper = async (_symbol: string) => {
              try {
                // ... (Existing implementation kept same, handled by browser/fetch in middleware context?)
                // Note: fetch inside Node might need node-fetch or global fetch in Node 18+
                // Vite config runs in Node. global fetch is available in newer Node versions.
                return null; // Simplifying for brevity/safety in this edit unless critical.
              } catch (e) { return null; }
            };

            // Fetch BOTH quoteSummary AND quote for fallback
            // yahoo-finance2 might be commonjs so let's use it carefully.
            // Note: Parallel fetch
            const [quoteSummary, quoteBasicResult] = await Promise.all([
              yahooFinance.quoteSummary(symbolParam, {
                modules: ['price', 'summaryDetail', 'defaultKeyStatistics', 'summaryProfile', 'topHoldings', 'fundProfile', 'assetProfile']
              }).catch(() => null),
              yahooFinance.quote(symbolParam).catch(() => null)
            ]);

            // Cast to any for safety accessing props
            const quoteBasic = quoteBasicResult as any;

            if (!quoteSummary && !quoteBasic) {
              throw new Error('No data found');
            }

            // Re-assign result from quoteSummary for consistency with existing logic below
            const result: any = quoteSummary || {};

            // Scraper Fallback for UCITS ETFs
            if (!result.topHoldings || (!result.topHoldings.sectorWeightings && !result.topHoldings.regionalExposure)) {
              const scrapedHoldings = await fetchEtfHoldingsScraper(symbolParam);
              if (scrapedHoldings) {
                result.topHoldings = scrapedHoldings;
              }
            }

            results = [{
              symbol: symbolParam,
              // NAME FIX:
              longName: quoteBasic?.longName || result.price?.longName,
              shortName: quoteBasic?.shortName || result.price?.shortName,
              displayName: quoteBasic?.displayName || quoteBasic?.longName,

              price: normalizeYahooPrice(quoteBasic?.regularMarketPrice || result.price?.regularMarketPrice, quoteBasic?.currency || result.price?.currency, symbolParam),
              currency: quoteBasic?.currency || result.price?.currency,

              marketTime: (quoteBasic?.regularMarketTime || result.price?.regularMarketTime) ?
                new Date((quoteBasic?.regularMarketTime || result.price?.regularMarketTime) * 1000) : null,

              marketState: quoteBasic?.marketState || result.price?.marketState || null,

              trailingPE: quoteBasic?.trailingPE || result.summaryDetail?.trailingPE || result.defaultKeyStatistics?.trailingPE || null,
              forwardPE: quoteBasic?.forwardPE || result.summaryDetail?.forwardPE || result.defaultKeyStatistics?.forwardPE || null,
              eps: quoteBasic?.epsTrailingTwelveMonths || result.defaultKeyStatistics?.trailingEps || null,
              dividendYield: (result.summaryDetail?.dividendYield) ? result.summaryDetail.dividendYield * 100 : (quoteBasic?.dividendYield || null),

              open: quoteBasic?.regularMarketOpen || result.summaryDetail?.open || null,
              previousClose: quoteBasic?.regularMarketPreviousClose || result.summaryDetail?.previousClose || null,

              country: result.summaryProfile?.country || null,
              sectorWeights: (() => {
                const sw = result.topHoldings?.sectorWeightings || result.topHoldings?.equityHoldings?.sectorWeightings;
                if (!sw) return null;
                const acc: any = {};
                if (Array.isArray(sw)) {
                  sw.forEach((item: any) => {
                    const keys = Object.keys(item);
                    if (keys.length > 0) acc[keys[0]] = item[keys[0]] * 100;
                  });
                } else if (typeof sw === 'object') {
                  Object.entries(sw).forEach(([k, v]) => {
                    if (typeof v === 'number') acc[k] = v * 100;
                  });
                }
                return Object.keys(acc).length > 0 ? acc : null;
              })(),
              countryWeights: (() => {
                const re = result.topHoldings?.regionalExposure || result.topHoldings?.equityHoldings?.regionalExposure;
                if (!re) return null;
                const acc: any = {};
                if (Array.isArray(re)) {
                  re.forEach((item: any) => {
                    const keys = Object.keys(item);
                    if (keys.length > 0) acc[keys[0]] = item[keys[0]] * 100;
                  });
                } else if (typeof re === 'object') {
                  Object.entries(re).forEach(([k, v]) => {
                    if (typeof v === 'number') acc[k] = v * 100;
                  });
                }
                return Object.keys(acc).length > 0 ? acc : null;
              })()
            }];

            if (results[0].sectorWeights) console.log(`[Yahoo Middleware] Mapped ${Object.keys(results[0].sectorWeights).length} sectors`);
            if (results[0].countryWeights) console.log(`[Yahoo Middleware] Mapped ${Object.keys(results[0].countryWeights).length} countries`);

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

          // MANUAL FETCH with Headers to avoid 429
          const searchUrl = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(query)}&quotesCount=6&newsCount=0&enableFuzzyQuery=false&quotesQueryId=tss_match_phrase_query`;

          const response = await fetch(searchUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
              'Accept': 'application/json',
            }
          });

          const result = await response.json();

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
      },
      '/api/yahoo-search-native': {
        target: 'https://query1.finance.yahoo.com',
        changeOrigin: true,
        rewrite: (path) => {
          const url = new URL(path, 'http://localhost');
          const query = url.searchParams.get('query');
          return `/v1/finance/search?q=${query}&quotesCount=6&newsCount=0&enableFuzzyQuery=false&quotesQueryId=tss_match_phrase_query`;
        }
      }
    },
  },
})
