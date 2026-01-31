
import YahooFinance from 'yahoo-finance2';

async function test() {
    console.log('Attempting instantiation...');
    try {
        const yahooFinance = new YahooFinance();
        console.log('Instance created.');

        const symbol = 'NESN.SW';
        console.log(`Fetching quote for ${symbol}...`);

        // Suppress console/logger if needed
        // yahooFinance.suppressLogger();

        const result = await yahooFinance.quote(symbol);
        console.log('Quote Result:', JSON.stringify(result, null, 2));

    } catch (e) {
        console.error('Error:', e);
    }
}

test();
