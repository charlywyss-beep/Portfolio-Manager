
const symbol = 'NESN.SW';
const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${symbol}`;

console.log('Fetching:', url);

fetch(url)
    .then(res => res.json())
    .then(data => {
        const result = data.quoteResponse?.result?.[0];
        if (result) {
            console.log('Price:', result.regularMarketPrice);
            console.log('Trailing PE:', result.trailingPE);
            console.log('Forward PE:', result.forwardPE);
            console.log('Div Yield:', result.dividendYield);
            console.log('Full Result Keys:', Object.keys(result));
        } else {
            console.error('No result found');
        }
    })
    .catch(err => console.error('Error:', err));
