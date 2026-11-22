// Vercel Serverless Function - DivvyDiary API Proxy
// Forwards the user's own X-API-Key to api.divvydiary.com/symbols/{ISIN}

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-API-Key');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const isin = (req.query.isin || '').toString().trim().toUpperCase();
    const apiKey = (req.headers['x-api-key'] || '').toString().trim();

    if (!isin) {
        return res.status(400).json({ error: 'ISIN required' });
    }
    if (!apiKey) {
        return res.status(401).json({ error: 'X-API-Key header required' });
    }

    try {
        const targetUrl = `https://api.divvydiary.com/symbols/${encodeURIComponent(isin)}`;
        const upstream = await fetch(targetUrl, {
            headers: {
                'X-API-Key': apiKey,
                'Accept': 'application/json',
                'User-Agent': 'PortfolioManager/1.0'
            }
        });

        const text = await upstream.text();
        res.setHeader('Content-Type', 'application/json');
        return res.status(upstream.status).send(text);
    } catch (error) {
        console.error('[DivvyDiary Proxy] Error:', error);
        return res.status(500).json({ error: 'DivvyDiary request failed' });
    }
}
