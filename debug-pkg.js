
import { YahooFinance } from 'yahoo-finance2';

const yahooFinance = new YahooFinance();

const symbol = 'NESN.SW';

console.log(`Fetching ${symbol}...`);

async function run() {
    try {
        const result = await yahooFinance.quoteSummary(symbol, {
            modules: ['price', 'summaryDetail', 'defaultKeyStatistics']
        });

        console.log('--- Price ---');
        console.log(JSON.stringify(result.price, null, 2));

        console.log('--- Summary Detail (PE / Yield) ---');
        console.log('trailingPE:', result.summaryDetail?.trailingPE);
        console.log('forwardPE:', result.summaryDetail?.forwardPE);
        console.log('dividendYield:', result.summaryDetail?.dividendYield);

        console.log('--- Key Stats (EPS / Forward PE) ---');
        console.log('trailingEps:', result.defaultKeyStatistics?.trailingEps);
        console.log('forwardPE (KeyStats):', result.defaultKeyStatistics?.forwardPE);

    } catch (e) {
        console.error('ERROR MESSAGE:', e.message);
        console.error('ERROR NAME:', e.name);
        if (e.errors) {
            console.error('VALIDATION ERRORS:', JSON.stringify(e.errors, null, 2));
        }
    }
}

run();
