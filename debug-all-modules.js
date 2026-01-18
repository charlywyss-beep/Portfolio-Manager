import { YahooFinance } from 'yahoo-finance2';
const yahoo = new YahooFinance();

async function extremeDebug() {
    const symbol = 'VWRA.L';
    try {
        // Try all possible modules
        const result = await yahoo.quoteSummary(symbol, {
            modules: [
                'price', 'summaryDetail', 'defaultKeyStatistics', 'summaryProfile',
                'topHoldings', 'fundProfile', 'assetProfile', 'fundPerformance',
                'majorHoldersBreakdown', 'institutionOwnership', 'fundOwnership'
            ]
        });
        console.log('Available Modules:', Object.keys(result));

        if (result.topHoldings) {
            console.log('topHoldings keys:', Object.keys(result.topHoldings));
        }
    } catch (e) {
        console.log('Error:', e.message);
    }
}

extremeDebug();
