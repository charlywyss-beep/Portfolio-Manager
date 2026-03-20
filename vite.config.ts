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

          // MAP: European tickers often lack deep fundamentals on Yahoo Finance.
          const PRIMARY_TICKER_MAP: Record<string, string> = {
            'R6C0.DE': 'SHEL',
            'SHEL.L': 'SHEL',
            'SHEL.AS': 'SHEL',
            'NOVOB.CO': 'NVO',
            'NESN.SW': 'NSRGY',
            'ROG.SW': 'RHHBY',
            'NOVN.SW': 'NVS',
            'ASML.AS': 'ASML',
            'SAP.DE': 'SAP',
            'SIE.DE': 'SIEGY',
            'ALV.DE': 'ALV',
            'MUV2.DE': 'MURGY'
          };

          // HELPER: Fetch KCV from Timeseries (No Crumb Needed)
          const fetchCashflowTimeseries = async (sym: string) => {
            try {
              const tsUrl = `https://query2.finance.yahoo.com/ws/fundamentals-timeseries/v1/finance/timeseries/${sym}?period1=1492524108&period2=1912524108&type=trailingOperatingCashFlow,annualOperatingCashFlow`;
              const response = await fetch(tsUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
              if (!response.ok) return null;
              const data: any = await response.json();
              const result = data?.timeseries?.result?.[0];
              if (!result) return null;
              let flowArray = result.trailingOperatingCashFlow || result.annualOperatingCashFlow;
              if (flowArray && flowArray.length > 0) {
                return flowArray[flowArray.length - 1]?.reportedValue?.raw || null;
              }
              return null;
            } catch (e) {
              return null;
            }
          };

          // HELPER: Process Single Symbol
          const processSymbol = async (sym: string) => {
            try {
              const fundamentalSymbol = PRIMARY_TICKER_MAP[sym] || sym;

              // We also fetch basic quote to ensure we have marketCap
              const [result, quoteBasic, quoteFundamental] = await Promise.all([
                 yahooFinance.quoteSummary(fundamentalSymbol, {
                    modules: ['price', 'summaryDetail', 'defaultKeyStatistics', 'summaryProfile', 'financialData']
                 }).catch(() => null),
                 yahooFinance.quote(sym).catch(() => null),
                 (fundamentalSymbol !== sym) ? yahooFinance.quote(fundamentalSymbol).catch(() => null) : null
              ]);

              if (!result && !quoteBasic) return { symbol: sym, error: 'No data' };

              // Map to existing structure
              // Cast to any to avoid TS strictness on partial returns
              const price: any = result?.price || {};
              const summaryDetail: any = result?.summaryDetail || {};
              const defaultKeyStatistics: any = result?.defaultKeyStatistics || {};
              const summaryProfile: any = result?.summaryProfile || {};

              const currency = price.currency || quoteBasic?.currency;
              const rawPrice = price.regularMarketPrice || quoteBasic?.regularMarketPrice;

              // Helper to get raw value safely
              const getRawVal = (obj: any) => typeof obj === 'object' && obj !== null && 'raw' in obj ? obj.raw : obj;

              let kcvValue = null;
              let operatingCashflow = null;
              
              if (result?.financialData?.operatingCashflow) {
                  operatingCashflow = getRawVal(result.financialData.operatingCashflow);
              } else {
                  operatingCashflow = await fetchCashflowTimeseries(fundamentalSymbol);
              }
              
              const marketCap = getRawVal(summaryDetail.marketCap) || getRawVal(quoteFundamental?.marketCap) || getRawVal(quoteBasic?.marketCap);
              
              if (operatingCashflow && marketCap && operatingCashflow > 0) {
                  kcvValue = marketCap / operatingCashflow;
              }

              // Use quoteBasic for price if available (more reliable for intl)
              const activePrice = quoteBasic || price;

              return {
                symbol: sym,
                longName: activePrice.longName || price.longName,
                shortName: activePrice.shortName || price.shortName,
                displayName: activePrice.displayName || activePrice.longName || price.longName,

                price: normalizeYahooPrice(activePrice.regularMarketPrice || rawPrice, currency, sym),
                currency: activePrice.currency || currency,

                marketTime: activePrice.regularMarketTime || price.regularMarketTime || new Date(),
                marketState: activePrice.marketState || price.marketState || null,

                trailingPE: getRawVal(quoteBasic?.trailingPE) || getRawVal(summaryDetail.trailingPE) || getRawVal(defaultKeyStatistics.trailingPE) || null,
                forwardPE: getRawVal(quoteBasic?.forwardPE) || getRawVal(summaryDetail.forwardPE) || getRawVal(defaultKeyStatistics.forwardPE) || null,
                eps: getRawVal(quoteBasic?.epsTrailingTwelveMonths) || getRawVal(defaultKeyStatistics.trailingEps) || null,
                dividendYield: getRawVal(summaryDetail.dividendYield) ? getRawVal(summaryDetail.dividendYield) * 100 : (getRawVal(quoteBasic?.dividendYield) || null),
                kcv: kcvValue,

                open: getRawVal(quoteBasic?.regularMarketOpen) || getRawVal(summaryDetail.open) || null,
                previousClose: getRawVal(quoteBasic?.regularMarketPreviousClose) || getRawVal(summaryDetail.previousClose) || getRawVal(price.regularMarketPreviousClose) || null,

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

      // Dividends Middleware (Mirroring Vercel Function behavior)
      server.middlewares.use('/api/yahoo-dividends', async (req, res, _next) => {
        try {
          const url = new URL(req.url!, `http://${req.headers.host}`);
          const symbol = url.searchParams.get('symbol');
          const period = url.searchParams.get('period') || '10y';

          if (!symbol) {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: 'Symbol required' }));
            return;
          }

          // Direct Yahoo API fetch via Node's global fetch
          const yahooUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?range=${period}&interval=1d&events=div`;
          const response = await fetch(yahooUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
          });

          if (!response.ok) {
            res.statusCode = response.status;
            res.end(JSON.stringify({ error: `Yahoo API error: ${response.status}` }));
            return;
          }

          const data: any = await response.json();
          const result = data.chart?.result?.[0];
          const rawDividends = result?.events?.dividends || {};
          const dividends = Object.values(rawDividends).map((d: any) => ({
            date: new Date(d.date * 1000).toISOString(),
            amount: d.amount
          }));

          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ dividends }));
        } catch (error: any) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: error.message }));
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
