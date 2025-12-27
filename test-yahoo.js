const symbol = 'NESN.SW';
// Test v6 endpoint
const url = `https://query1.finance.yahoo.com/v6/finance/quote?symbols=${symbol}`;

console.log('Fetching Chart URL:', url);

fetch(url)
    .then(res => res.json())
    .then(data => {
        // Check for quoteResponse (v6/v7 format)
        if (data.quoteResponse && data.quoteResponse.result) {
            const result = data.quoteResponse.result[0];
            console.log('Quote Found via v6!');
            console.log('Price:', result.regularMarketPrice);
            console.log('Trailing PE:', result.trailingPE);
            console.log('Forward PE:', result.forwardPE);
            console.log('Div Yield:', result.dividendYield);
        } else if (data.chart && data.chart.result) {
            const result = data.chart.result[0];
            console.log('Meta Keys:', Object.keys(result.meta));
            console.log('RegularMarketPrice:', result.meta.regularMarketPrice);
            console.log('Trailing PE:', result.meta.trailingPE); // Check if exists
            console.log('Forward PE:', result.meta.forwardPE);
            console.log('Dividend Yield:', result.meta.dividendYield);
            console.log('Instrument Type:', result.meta.instrumentType);
            // Print full meta to be sure
            console.log('Full Meta:', JSON.stringify(result.meta, null, 2));
        } else {
            console.error('No result found. Data:', JSON.stringify(data).slice(0, 200));
        }
    })
    .catch(err => console.error('Error:', err));
