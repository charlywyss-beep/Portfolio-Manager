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
        const [quoteBasic, quoteSummary] = await Promise.all([
            yahooFinance.quote(symbol).catch(() => null),
            yahooFinance.quoteSummary(symbol, {
                modules: ['price', 'summaryDetail', 'defaultKeyStatistics', 'summaryProfile', 'topHoldings']
            }).catch(() => null)
        ]);

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
