import YahooFinanceClass from 'yahoo-finance2';

const yahooFinance = new YahooFinanceClass();

async function test() {
    const symbols = ['VOO', 'VWRA.L'];
    for (const symbol of symbols) {
        try {
            console.log(`\n--- Testing ${symbol} ---`);
            const result = await yahooFinance.quoteSummary(symbol, {
                modules: ['price', 'topHoldings', 'fundProfile', 'assetProfile', 'summaryDetail']
            });

            console.log(`Success!`);
            console.log(`Modules found:`, Object.keys(result));

            if (result.topHoldings) {
                console.log('topHoldings keys:', Object.keys(result.topHoldings));
                if (result.topHoldings.sectorWeightings) console.log(`sectorWeightings[${result.topHoldings.sectorWeightings.length}]`);
                if (result.topHoldings.regionalExposure) console.log(`regionalExposure[${result.topHoldings.regionalExposure.length}]`);
                if (result.topHoldings.equityHoldings) console.log(`equityHoldings: found`);
            } else {
                console.log('topHoldings: NOT FOUND');
            }

            if (result.fundProfile) {
                console.log('fundProfile keys:', Object.keys(result.fundProfile));
            }
        } catch (err) {
            console.error(`FAILED for ${symbol}:`, err.message);
        }
        // Sleep a bit
        await new Promise(r => setTimeout(r, 2000));
    }
}

test();
