
import YahooFinance from 'yahoo-finance2';

const yf = new YahooFinance();
const symbol = 'NESN.SW';

console.log(`Fetching ${symbol} with explicit instantiation...`);

async function run() {
    try {
        const result = await yf.quoteSummary(symbol, {
            modules: ['price', 'summaryDetail', 'defaultKeyStatistics']
        });

        console.log('--- Success ---');
        console.log('Price:', result.price?.regularMarketPrice);
        console.log('Trailing PE:', result.summaryDetail?.trailingPE);
        console.log('Forward PE:', result.summaryDetail?.forwardPE);
        console.log('EPS:', result.defaultKeyStatistics?.trailingEps);

    } catch (e) {
        console.error('ERROR:', e.message);
        console.error('FULL ERROR:', JSON.stringify(e, null, 2));
    }
}

run();
