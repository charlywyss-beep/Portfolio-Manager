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

    const { symbol, ...params } = req.query;
    if (params.period) {
        params.range = params.period;
        delete params.period;
    }

    if (!symbol || !params.range || !params.interval) {
        return res.status(400).json({ error: 'Missing required parameters' });
    }

    try {
        const queryParams = new URLSearchParams(params).toString();
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?${queryParams}`;

        console.log('[Vercel Proxy] Fetching:', url);

        let response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'application/json'
            }
        });

        if (!response.ok) {
            const url2 = `https://query2.finance.yahoo.com/v8/finance/chart/${symbol}?${queryParams}`;
            response = await fetch(url2, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept': 'application/json'
                }
            });
        }

        const data = await response.json();

        console.log('[Vercel Proxy] Success');

        return res.status(200).json(data);
    } catch (error) {
        console.error('[Vercel Proxy] Error:', error);
        return res.status(500).json({ error: 'Failed to fetch stock data' });
    }
}
