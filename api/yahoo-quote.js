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
                modules: ['price', 'summaryDetail', 'defaultKeyStatistics', 'summaryProfile']
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
            country: quoteSummary?.summaryProfile?.country || null
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
