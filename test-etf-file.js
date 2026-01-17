
import YahooFinance from 'yahoo-finance2';
import fs from 'fs';
const yahooFinance = new YahooFinance();

async function testEtf() {
    const symbol = 'VWRL.L';
    try {
        const summary = await yahooFinance.quoteSummary(symbol, {
            modules: ['topHoldings', 'assetProfile', 'summaryDetail', 'fundProfile']
        });

        fs.writeFileSync('etf-data.json', JSON.stringify(summary, null, 2));
        console.log('ETF data written to etf-data.json');

    } catch (e) {
        fs.writeFileSync('etf-error.json', JSON.stringify({ error: e.message, stack: e.stack }, null, 2));
        console.error('Error:', e);
    }
}

testEtf();
