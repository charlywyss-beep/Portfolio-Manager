import YahooFinance from 'yahoo-finance2';

const yahooFinance = new YahooFinance();

export default async function handler(req, res) {
    // Enable CORS for your frontend
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Handle preflight
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const { symbol } = req.query;

    if (!symbol) {
        return res.status(400).json({ error: 'Missing symbol parameter' });
    }

    try {
        console.log('[Vercel Quote Proxy] Fetching quote for:', symbol);

        // Fetch robust data using yahoo-finance2
        // We fetch BOTH quote() (simple, robust) and quoteSummary() (rich details) to ensure we get data
        // SINGLE REQUEST: Use quoteSummary() for rich details
        // ALSO fetch quote() for basic data fallback (e.g. price, name)
        const [quoteSummary, quoteBasic] = await Promise.all([
            yahooFinance.quoteSummary(symbol, {
                modules: ['price', 'summaryDetail', 'defaultKeyStatistics', 'summaryProfile', 'topHoldings', 'fundProfile', 'assetProfile']
            }).catch(() => null),
            yahooFinance.quote(symbol).catch(() => null)
        ]);

        // HELPER: Scraper Fallback for UCITS ETFs (VWRA.L etc.)
        const fetchEtfHoldingsScraper = async (symbol) => {
            try {
                console.log(`[Vercel Scraper] Attempting HTML fallback for ${symbol}...`);
                const url = `https://finance.yahoo.com/quote/${symbol}/holdings`;
                const response = await fetch(url, {
                    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' }
                });
                if (!response.ok) return null;
                const html = await response.text();

                // Find the JSON data blob in the HTML
                const jsonMatch = html.match(/root\.App\.main\s*=\s*({.*?});/s) || html.match(/context\s*=\s*({.*?});/s);
                if (!jsonMatch) return null;

                const data = JSON.parse(jsonMatch[1]);
                const store = data.context?.dispatcher?.stores?.QuoteSummaryStore;
                if (!store || !store.topHoldings) return null;

                console.log(`[Vercel Scraper] Success! Extracted topHoldings from HTML for ${symbol}`);
                return store.topHoldings;
            } catch (e) {
                console.warn(`[Vercel Scraper] Failed for ${symbol}:`, e.message);
                return null;
            }
        };

        // FALLBACK: If API returns no holdings, try scraper
        if (quoteSummary && (!quoteSummary.topHoldings || (!quoteSummary.topHoldings.sectorWeightings && !quoteSummary.topHoldings.regionalExposure))) {
            const scrapedHoldings = await fetchEtfHoldingsScraper(symbol);
            if (scrapedHoldings) {
                quoteSummary.topHoldings = scrapedHoldings;
            }
        }

        if (!quoteSummary && !quoteBasic) {
            throw new Error('No data found');
        }

        // Helper to get value from either source
        const getVal = (path, subPath) => {
            if (quoteBasic && quoteBasic[path] !== undefined && quoteBasic[path] !== null) return quoteBasic[path];
            if (quoteSummary) {
                // Handle nested paths for quoteSummary modules
                if (subPath && quoteSummary[path] && quoteSummary[path][subPath] !== undefined) return quoteSummary[path][subPath];
                if (!subPath && quoteSummary[path] !== undefined) return quoteSummary[path];
            }
            return null;
        };

        // Prioritize quoteBasic for price data as it's often more reliable for international stocks
        const quote = {
            symbol: symbol,
            longName: quoteBasic?.longName || quoteSummary?.price?.longName,
            shortName: quoteBasic?.shortName || quoteSummary?.price?.shortName,
            displayName: quoteBasic?.displayName || quoteBasic?.longName,
            regularMarketPrice: quoteBasic?.regularMarketPrice || quoteSummary?.price?.regularMarketPrice,
            // Try ALL sources for Open
            regularMarketOpen: quoteBasic?.regularMarketOpen || quoteSummary?.price?.regularMarketOpen || quoteSummary?.summaryDetail?.open,
            // Try ALL sources for Prev Close
            regularMarketPreviousClose: quoteBasic?.regularMarketPreviousClose || quoteSummary?.price?.regularMarketPreviousClose || quoteSummary?.summaryDetail?.previousClose,
            currency: quoteBasic?.currency || quoteSummary?.price?.currency,

            regularMarketTime: (quoteBasic?.regularMarketTime || quoteSummary?.price?.regularMarketTime) ?
                new Date((quoteBasic?.regularMarketTime || quoteSummary?.price?.regularMarketTime)).getTime() / 1000 : null,

            trailingPE: quoteBasic?.trailingPE || quoteSummary?.summaryDetail?.trailingPE,
            forwardPE: quoteBasic?.forwardPE || quoteSummary?.summaryDetail?.forwardPE || quoteSummary?.defaultKeyStatistics?.forwardPE,
            epsTrailingTwelveMonths: quoteBasic?.epsTrailingTwelveMonths || quoteSummary?.defaultKeyStatistics?.trailingEps,
            dividendYield: (quoteSummary?.summaryDetail?.dividendYield) ? quoteSummary.summaryDetail.dividendYield * 100 : (quoteBasic?.dividendYield || null),
            country: quoteSummary?.summaryProfile?.country || null,
            // ETF Allocation Data (NEW)
            sectorWeights: (() => {
                const sw = quoteSummary?.topHoldings?.sectorWeightings || quoteSummary?.topHoldings?.equityHoldings?.sectorWeightings;
                if (!sw) return null;
                const acc = {};
                if (Array.isArray(sw)) {
                    sw.forEach(item => {
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
                const re = quoteSummary?.topHoldings?.regionalExposure || quoteSummary?.topHoldings?.equityHoldings?.regionalExposure;
                if (!re) return null;
                const acc = {};
                if (Array.isArray(re)) {
                    re.forEach(item => {
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
        };

        const responseData = {
            quoteResponse: {
                result: [quote],
                error: null
            }
        };

        console.log('[Vercel Quote Proxy] Success');
        return res.status(200).json(responseData);
    } catch (error) {
        console.error('[Vercel Quote Proxy] Error:', error.message || error);
        // Fallback or error response
        return res.status(200).json({
            quoteResponse: {
                result: [],
                error: error.message || 'Failed to fetch data'
            }
        });
    }
}
