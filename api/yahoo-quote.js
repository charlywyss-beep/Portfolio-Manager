// Vercel Serverless Function - Yahoo Finance Quote Proxy
// Fetches the latest quote (realtime-ish) instead of historical chart data

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
        const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${symbol}`;

        console.log('[Vercel Quote Proxy] Fetching:', url);

        const response = await fetch(url);
        const data = await response.json();

        console.log('[Vercel Quote Proxy] Success');

        return res.status(200).json(data);
    } catch (error) {
        console.error('[Vercel Quote Proxy] Error:', error);
        return res.status(500).json({ error: 'Failed to fetch quote data' });
    }
}
