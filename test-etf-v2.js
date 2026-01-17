
import YahooFinance from 'yahoo-finance2';
const yahooFinance = new YahooFinance();

async function testEtf() {
    const symbol = 'VWRL.L';
    console.log(`Testing ${symbol}...`);
    try {
        const summary = await yahooFinance.quoteSummary(symbol, {
            modules: ['topHoldings', 'assetProfile']
        });

        console.log('--- Summary Modules Received ---');
        console.log(Object.keys(summary));

        if (summary.topHoldings) {
            console.log('\n--- Sector Weightings ---');
            if (summary.topHoldings.sectorWeightings) {
                summary.topHoldings.sectorWeightings.forEach(sw => {
                    console.log(`${Object.keys(sw)[0]}: ${Object.values(sw)[0]}`);
                });
            } else {
                console.log('No sectorWeightings found in topHoldings.');
            }

            console.log('\n--- Real Time Holdings? ---');
            console.log('Holdings count:', summary.topHoldings.holdings?.length);
        } else {
            console.log('No topHoldings module in response.');
        }

    } catch (e) {
        console.error('CRITICAL ERROR:', e);
    }
}

testEtf().then(() => console.log('Test finished.'));
