
import YahooFinance from 'yahoo-finance2';
const yahooFinance = new YahooFinance();

async function testEtf() {
    const symbol = 'VWRL.L';
    try {
        console.log(`Fetching data for ${symbol}...`);
        const summary = await yahooFinance.quoteSummary(symbol, {
            modules: ['topHoldings']
        });

        if (summary.topHoldings) {
            console.log('--- topHoldings Keys ---');
            console.log(Object.keys(summary.topHoldings));

            if (summary.topHoldings.sectorWeightings) {
                console.log('\n--- Sector Weightings ---');
                console.log(summary.topHoldings.sectorWeightings);
            }

            if (summary.topHoldings.countryWeightings) {
                console.log('\n--- Country Weightings ---');
                console.log(summary.topHoldings.countryWeightings);
            }
        } else {
            console.log('No topHoldings found.');
        }

    } catch (e) {
        console.error('Error:', e);
    }
}

testEtf();
