
import YahooFinance from 'yahoo-finance2';

const yahooFinance = new YahooFinance();
const symbol = 'NESN.SW';

console.log(`Fetching ${symbol}...`);

async function run() {
    try {
        const result = await yahooFinance.quoteSummary(symbol, {
            modules: ['summaryProfile', 'price']
        });

        console.log('--- Summary Profile ---');
        console.log('Country:', result.summaryProfile?.country);
        console.log('City:', result.summaryProfile?.city);
        console.log('Sector:', result.summaryProfile?.sector);

        console.log('--- Price ---');
        console.log('Currency:', result.price?.currency);
        console.log('Exchange:', result.price?.exchangeName);

    } catch (e) {
        console.error('ERROR:', e.message);
    }
}

run();
