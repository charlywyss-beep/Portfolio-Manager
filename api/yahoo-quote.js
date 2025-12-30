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
        const result = await yahooFinance.quoteSummary(symbol, {
            modules: ['price', 'summaryDetail', 'defaultKeyStatistics', 'summaryProfile']
        });

        const quote = {
            symbol: symbol,
            regularMarketPrice: result.price?.regularMarketPrice,
            regularMarketOpen: result.price?.regularMarketOpen || result.summaryDetail?.open,
            regularMarketPreviousClose: result.price?.regularMarketPreviousClose || result.summaryDetail?.previousClose,
            currency: result.price?.currency,
            regularMarketTime: result.price?.regularMarketTime ? new Date(result.price.regularMarketTime).getTime() / 1000 : null,
            trailingPE: result.summaryDetail?.trailingPE,
            forwardPE: result.summaryDetail?.forwardPE || result.defaultKeyStatistics?.forwardPE,
            epsTrailingTwelveMonths: result.defaultKeyStatistics?.trailingEps,
            dividendYield: result.summaryDetail?.dividendYield ? result.summaryDetail.dividendYield * 100 : null,
            country: result.summaryProfile?.country
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
