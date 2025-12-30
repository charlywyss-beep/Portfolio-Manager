
import http from 'http';

function checkProxy() {
    const url = 'http://localhost:5173/api/yahoo-quote?symbol=R6C0.DE';
    console.log(`Fetching from ${url}...`);

    http.get(url, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
            try {
                console.log('Status:', res.statusCode);
                const json = JSON.parse(data);
                const result = json.quoteResponse?.result?.[0];
                if (result) {
                    console.log('Proxy Result:');
                    console.log('regularMarketOpen:', result.regularMarketOpen);
                    console.log('regularMarketPreviousClose:', result.regularMarketPreviousClose);
                } else {
                    console.log('No result in response:', data);
                }
            } catch (e) {
                console.error('Parse Error:', e.message);
                console.log('Raw Data:', data);
            }
        });
    }).on('error', (err) => {
        console.error('Request Error:', err.message);
    });
}

checkProxy();
