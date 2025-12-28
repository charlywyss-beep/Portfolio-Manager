import YahooFinance from 'yahoo-finance2';

const yahooFinance = new YahooFinance();

export default async function handler(req, res) {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Handle preflight
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const { query } = req.query;

    if (!query) {
        return res.status(400).json({ error: 'Missing query parameter' });
    }

    try {
        console.log('[Vercel Search Proxy] Searching for:', query);

        const result = await yahooFinance.search(query);

        console.log('[Vercel Search Proxy] Found', result.quotes?.length, 'results');
        return res.status(200).json(result);
    } catch (error) {
        console.error('[Vercel Search Proxy] Error:', error.message || error);
        return res.status(200).json({
            quotes: [],
            error: error.message || 'Failed to search'
        });
    }
}
