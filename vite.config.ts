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

          // HELPER: Fetch KCV & Normalized EPS from Timeseries (No Crumb Needed)
          const fetchCashflowTimeseries = async (sym: string) => {
            try {
              const tsUrl = `https://query2.finance.yahoo.com/ws/fundamentals-timeseries/v1/finance/timeseries/${sym}?period1=1492524108&period2=1912524108&type=trailingOperatingCashFlow,annualOperatingCashFlow,trailingMarketCap,trailingNormalizedDilutedEPS,annualNormalizedDilutedEPS,trailingDilutedEPS,annualDilutedEPS`;
              const response = await fetch(tsUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
              if (!response.ok) return { flow: null, cap: null, normalizedEps: null, dilutedEps: null };
              const data: any = await response.json();
              const tsResults = data?.timeseries?.result || [];
              
              let flow = null;
              let cap = null;
              let normalizedEps = null;
              let dilutedEps = null;

              const mcItem = tsResults.find((r: any) => r.meta?.type?.[0] === 'trailingMarketCap');
              if (mcItem && mcItem.trailingMarketCap?.length > 0) {
                 cap = mcItem.trailingMarketCap[mcItem.trailingMarketCap.length - 1]?.reportedValue?.raw || null;
              }

              const cfItem = tsResults.find((r: any) => r.meta?.type?.[0] === 'trailingOperatingCashFlow' || r.meta?.type?.[0] === 'annualOperatingCashFlow');
              if (cfItem) {
                 const flowArr = cfItem.trailingOperatingCashFlow || cfItem.annualOperatingCashFlow;
                 if (flowArr && flowArr.length > 0) {
                    flow = flowArr[flowArr.length - 1]?.reportedValue?.raw || null;
                 }
              }

              const normEpsItem = tsResults.find((r: any) => r.meta?.type?.[0] === 'trailingNormalizedDilutedEPS' || r.meta?.type?.[0] === 'annualNormalizedDilutedEPS');
              if (normEpsItem) {
                 const arr = normEpsItem.trailingNormalizedDilutedEPS || normEpsItem.annualNormalizedDilutedEPS;
                 if (arr && arr.length > 0) {
                    normalizedEps = arr[arr.length - 1]?.reportedValue?.raw || null;
                 }
              }

              const dilEpsItem = tsResults.find((r: any) => r.meta?.type?.[0] === 'trailingDilutedEPS' || r.meta?.type?.[0] === 'annualDilutedEPS');
              if (dilEpsItem) {
                 const arr = dilEpsItem.trailingDilutedEPS || dilEpsItem.annualDilutedEPS;
                 if (arr && arr.length > 0) {
                    dilutedEps = arr[arr.length - 1]?.reportedValue?.raw || null;
                 }
              }

              return { flow, cap, normalizedEps, dilutedEps };
            } catch (e) {
              return { flow: null, cap: null, normalizedEps: null, dilutedEps: null };
            }
          };

          // HELPER: Process Single Symbol
          const processSymbol = async (sym: string) => {
            try {
              const fundamentalSymbol = PRIMARY_TICKER_MAP[sym] || sym;

              // Always fetch quoteSummary on the actual symbol `sym` so EPS/PE/Dividend match local share currency & ratio!
              const [result, quoteBasic, quoteFundamental] = await Promise.all([
                 yahooFinance.quoteSummary(sym, {
                    modules: ['price', 'summaryDetail', 'defaultKeyStatistics', 'summaryProfile', 'financialData', 'earningsTrend']
                 }).catch(() => null),
                 yahooFinance.quote(sym).catch(() => null),
                 (fundamentalSymbol !== sym) ? yahooFinance.quote(fundamentalSymbol).catch(() => null) : null
              ]);
              
              const tsLocal = await fetchCashflowTimeseries(sym);
              const tsFallback = (fundamentalSymbol !== sym && (!tsLocal.flow || !tsLocal.cap))
                  ? await fetchCashflowTimeseries(fundamentalSymbol)
                  : tsLocal;

              if (!result && !quoteBasic) {
                   // BULLETPROOF FALLBACK for totally crumb-blocked IPs
                   try {
                       const chartUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${sym}?interval=1d&range=1d`;
                       const chartRes = await fetch(chartUrl, { headers: { 'User-Agent': 'Mozilla/5.0' }});
                       if (!chartRes.ok) return { symbol: sym, error: 'Completely blocked' };
                       const chartData: any = await chartRes.json();
                       const chartMeta = chartData.chart?.result?.[0]?.meta;
                       
                       if (!chartMeta) return { symbol: sym, error: 'No chart data' };
                       
                       let kcvValue = null;
                       if (tsFallback.cap && tsFallback.flow && tsFallback.flow > 0) {
                           kcvValue = tsFallback.cap / tsFallback.flow;
                       }
                       const fallbackEps = (tsLocal.normalizedEps && tsLocal.normalizedEps > 0)
                           ? tsLocal.normalizedEps
                           : (tsLocal.dilutedEps && tsLocal.dilutedEps > 0 ? tsLocal.dilutedEps : null);
                       
                       return {
                           symbol: sym,
                           longName: chartMeta.longName || sym,
                           shortName: chartMeta.shortName || sym,
                           displayName: chartMeta.longName || sym,
                           regularMarketPrice: chartMeta.regularMarketPrice,
                           currency: chartMeta.currency,
                           regularMarketTime: chartMeta.regularMarketTime,
                           marketState: null,
                           trailingPE: (chartMeta.regularMarketPrice && fallbackEps) ? (chartMeta.regularMarketPrice / fallbackEps) : null,
                           forwardPE: null,
                           eps: fallbackEps,
                           forwardEps: tsLocal.normalizedEps || null,
                           dividendYield: null,
                           kcv: kcvValue,
                           regularMarketOpen: chartMeta.chartPreviousClose,
                           regularMarketPreviousClose: chartMeta.chartPreviousClose,
                           country: null,
                           sectorWeights: null,
                           countryWeights: null
                       };
                   } catch (e) {
                       return { symbol: sym, error: 'Completely blocked' };
                   }
              }

              // Map to existing structure
              // Cast to any to avoid TS strictness on partial returns
              const price: any = result?.price || {};
              const summaryDetail: any = result?.summaryDetail || {};
              const defaultKeyStatistics: any = result?.defaultKeyStatistics || {};
              const summaryProfile: any = result?.summaryProfile || {};
              const financialData: any = result?.financialData || {};
              const earningsTrend: any = result?.earningsTrend || {};

              const currency = price.currency || quoteBasic?.currency;
              const rawPrice = price.regularMarketPrice || quoteBasic?.regularMarketPrice;

              // Helper to get raw value safely
              const getRawVal = (obj: any) => typeof obj === 'object' && obj !== null && 'raw' in obj ? obj.raw : obj;

              let kcvValue = null;
              let operatingCashflow = getRawVal(financialData.operatingCashflow) || tsFallback.flow;
              const marketCap = getRawVal(summaryDetail.marketCap) || getRawVal(quoteFundamental?.marketCap) || tsFallback.cap || getRawVal(quoteBasic?.marketCap);
              
              if (operatingCashflow && marketCap && operatingCashflow > 0) {
                  kcvValue = marketCap / operatingCashflow;
              }

              // Use quoteBasic for price if available (more reliable for intl)
              const activePrice = quoteBasic || price;
              const finalMarketPrice = activePrice.regularMarketPrice || rawPrice;

              const trailingPEVal = getRawVal(quoteBasic?.trailingPE) || getRawVal(summaryDetail.trailingPE) || getRawVal(defaultKeyStatistics.trailingPE) || null;
              const forwardPEVal = getRawVal(quoteBasic?.forwardPE) || getRawVal(summaryDetail.forwardPE) || getRawVal(defaultKeyStatistics.forwardPE) || getRawVal(financialData.forwardPE) || null;

              const rawTrailingEps = getRawVal(quoteBasic?.epsTrailingTwelveMonths) ?? getRawVal(defaultKeyStatistics.trailingEps) ?? tsLocal.dilutedEps ?? null;
              const rawForwardEps = getRawVal(quoteBasic?.epsForward)
                  || getRawVal(defaultKeyStatistics.forwardEps)
                  || getRawVal((quoteBasic as any)?.epsCurrentYear)
                  || tsLocal.normalizedEps
                  || (finalMarketPrice && forwardPEVal && forwardPEVal > 0 ? finalMarketPrice / forwardPEVal : null);

              // Smart EPS selection: if trailing EPS is missing, <= 0, or depressed by > 12% vs forward/normalized EPS (e.g. one-time restructuring/write-offs like Nestlé or Kraft Heinz), use forward/normalized EPS
              let bestEps = rawTrailingEps;
              let epsSource = 'TTM';
              if (!bestEps || bestEps <= 0 || (rawForwardEps && rawForwardEps > 0 && bestEps < rawForwardEps * 0.88)) {
                  if (rawForwardEps && rawForwardEps > 0) {
                      bestEps = rawForwardEps;
                      epsSource = 'Forward / Bereinigt';
                  } else if (tsLocal.normalizedEps && tsLocal.normalizedEps > 0) {
                      bestEps = tsLocal.normalizedEps;
                      epsSource = 'Bereinigt (Norm.)';
                  } else if (finalMarketPrice && kcvValue && kcvValue > 0) {
                      bestEps = (finalMarketPrice / kcvValue) * 0.75;
                      epsSource = 'Cashflow-Schätzung';
                  }
              }

              // Extract 5Y Growth Rate if available
              let growthRate5Y: number | null = null;
              const trends = earningsTrend?.trend || [];
              const fiveYearTrend = trends.find((t: any) => t.period === '+5y' || t.period === '5y');
              if (fiveYearTrend?.growth) {
                  growthRate5Y = getRawVal(fiveYearTrend.growth);
              }
              if (growthRate5Y === null || growthRate5Y === undefined) {
                  const nextYearTrend = trends.find((t: any) => t.period === '+1y');
                  const earningsGrowth = getRawVal(financialData.earningsGrowth);
                  const revenueGrowth = getRawVal(financialData.revenueGrowth);
                  if (nextYearTrend?.growth && getRawVal(nextYearTrend.growth)) {
                      growthRate5Y = getRawVal(nextYearTrend.growth);
                  } else if (earningsGrowth && earningsGrowth > -0.2 && earningsGrowth < 0.5) {
                      growthRate5Y = earningsGrowth;
                  } else if (revenueGrowth && revenueGrowth > -0.1 && revenueGrowth < 0.4) {
                      growthRate5Y = revenueGrowth;
                  }
              }

              return {
                symbol: sym,
                longName: activePrice.longName || price.longName,
                shortName: activePrice.shortName || price.shortName,
                displayName: activePrice.displayName || activePrice.longName || price.longName,

                regularMarketPrice: finalMarketPrice,
                currency: activePrice.currency || currency,

                regularMarketTime: activePrice.regularMarketTime || price.regularMarketTime || (Math.floor(Date.now() / 1000)),
                marketState: activePrice.marketState || price.marketState || null,

                trailingPE: trailingPEVal,
                forwardPE: forwardPEVal,
                eps: bestEps,
                rawTrailingEps,
                forwardEps: rawForwardEps,
                epsSource,
                growthRate: growthRate5Y,
                dividendYield: getRawVal(summaryDetail.dividendYield) ? getRawVal(summaryDetail.dividendYield) * 100 : (getRawVal(quoteBasic?.dividendYield) || null),
                kcv: kcvValue,

                regularMarketOpen: getRawVal(quoteBasic?.regularMarketOpen) || getRawVal(summaryDetail.open) || null,
                regularMarketPreviousClose: getRawVal(quoteBasic?.regularMarketPreviousClose) || getRawVal(summaryDetail.previousClose) || getRawVal(price.regularMarketPreviousClose) || null,

                country: summaryProfile.country || null,
                sector: summaryProfile.sector || null,
                industry: summaryProfile.industry || null,
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

      // Finance / Chart Middleware for Seasonality & History
      server.middlewares.use('/api/yahoo-finance', async (req, res, _next) => {
        try {
          const url = new URL(req.url!, `http://${req.headers.host}`);
          const symbol = url.searchParams.get('symbol');
          const range = url.searchParams.get('range') || url.searchParams.get('period') || '10y';
          const interval = url.searchParams.get('interval') || '1mo';
          const events = url.searchParams.get('events') || 'div';

          if (!symbol) {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: 'Symbol required' }));
            return;
          }

          const yahooUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?range=${range}&interval=${interval}&events=${events}`;
          let response = await fetch(yahooUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
              'Accept': 'application/json'
            }
          });

          if (!response.ok) {
            const yahooUrl2 = `https://query2.finance.yahoo.com/v8/finance/chart/${symbol}?range=${range}&interval=${interval}&events=${events}`;
            response = await fetch(yahooUrl2, {
              headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'application/json'
              }
            });
          }

          if (!response.ok) {
            res.statusCode = response.status;
            res.end(JSON.stringify({ error: `Yahoo API error: ${response.status}` }));
            return;
          }

          const data = await response.json();
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(data));
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
      },
      // Frankfurter Exchange Rate API Proxy (CORS bypass)
      '/api/frankfurter': {
        target: 'https://api.frankfurter.app',
        changeOrigin: true,
        rewrite: (path) => path.replace('/api/frankfurter', ''),
      }
    },
  },
})
