
import YahooFinance from 'yahoo-finance2';
const yahooFinance = new YahooFinance();

async function test() {
    try {
        const symbol = 'NESN.SW';
        console.log(`Fetching ${symbol}...`);

        // Try simple quote first
        const quote = await yahooFinance.quote(symbol);
        console.log('Quote Result:');
        console.log('regularMarketOpen:', quote.regularMarketOpen);
        console.log('regularMarketPreviousClose:', quote.regularMarketPreviousClose);

        console.log('----------------');

        // Try quoteSummary
        const summary = await yahooFinance.quoteSummary(symbol, { modules: ['price'] });
        console.log('Summary Price Open:', summary.price?.regularMarketOpen);

    } catch (e) {
        console.error('Error:', e.message);
        if (e.errors) console.error('Details:', JSON.stringify(e.errors, null, 2));
    }
}

test();
