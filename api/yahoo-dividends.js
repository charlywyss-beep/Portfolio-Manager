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

    const { symbol, period = '10y' } = req.query;

    if (!symbol) {
        return res.status(400).json({ error: 'Missing symbol parameter' });
    }

    try {
        console.log('[Vercel Dividends] Fetching dividends for:', symbol, 'Period:', period);

        // Convert period (e.g. 10y) to dates
        const now = new Date();
        const yearsMatch = period.match(/^(\d+)y$/);
        const years = yearsMatch ? parseInt(yearsMatch[1]) : 10;

        const period1 = new Date();
        period1.setFullYear(now.getFullYear() - years);

        // Fetch dividends using yahoo-finance2
        const dividends = await yahooFinance.dividends(symbol, {
            period1: period1,
            period2: now
        });

        console.log(`[Vercel Dividends] Success: ${dividends.length} events found.`);

        return res.status(200).json({ dividends });
    } catch (error) {
        console.error('[Vercel Dividends] Error:', error.message || error);
        return res.status(500).json({ error: error.message || 'Failed to fetch dividends' });
    }
}
