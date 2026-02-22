
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
        console.log(`[Vercel Dividends] Fetching for: ${symbol}, Period: ${period}`);

        // Direct Yahoo Chart API call (Daily interval for events)
        const yahooUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?range=${period}&interval=1d&events=div`;

        const response = await fetch(yahooUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });

        if (!response.ok) {
            throw new Error(`Yahoo API error: ${response.status}`);
        }

        const data = await response.json();
        const result = data.chart?.result?.[0];

        if (!result) {
            throw new Error('No result returned from Yahoo');
        }

        const rawDividends = result.events?.dividends || {};
        const dividends = Object.values(rawDividends).map(d => ({
            date: new Date(d.date * 1000).toISOString(),
            amount: d.amount
        }));

        console.log(`[Vercel Dividends] Success: ${dividends.length} events found for ${symbol}.`);

        return res.status(200).json({ dividends });
    } catch (error) {
        console.error('[Vercel Dividends] Error:', error.message || error);
        return res.status(500).json({ error: error.message || 'Failed to fetch dividends' });
    }
}
