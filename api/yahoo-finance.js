// Vercel Serverless Function - Yahoo Finance Proxy
// This bypasses CORS by making the API call from the server side

export default async function handler(req, res) {
    // Enable CORS for your frontend
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Handle preflight
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const { symbol, period, interval } = req.query;

    if (!symbol || !period || !interval) {
        return res.status(400).json({ error: 'Missing required parameters' });
    }

    try {
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?range=${period}&interval=${interval}`;

        console.log('[Vercel Proxy] Fetching:', url);

        const response = await fetch(url);
        const data = await response.json();

        console.log('[Vercel Proxy] Success');

        return res.status(200).json(data);
    } catch (error) {
        console.error('[Vercel Proxy] Error:', error);
        return res.status(500).json({ error: 'Failed to fetch stock data' });
    }
}
