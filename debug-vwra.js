import yahooFinance from 'yahoo-finance2';
import fs from 'fs';

async function debugEtf() {
    const symbol = 'VWRA.L';
    try {
        console.log(`Fetching quoteSummary for ${symbol}...`);
        const result = await yahooFinance.quoteSummary(symbol, {
            modules: ['price', 'summaryDetail', 'defaultKeyStatistics', 'summaryProfile', 'topHoldings', 'fundProfile', 'assetProfile']
        });

        fs.writeFileSync('vwra_debug.json', JSON.stringify(result, null, 2));
        console.log('Result saved to vwra_debug.json');

        console.log('Top Holdings structure:', Object.keys(result.topHoldings || {}));
        if (result.topHoldings) {
            console.log('sectorWeightings:', result.topHoldings.sectorWeightings ? (Array.isArray(result.topHoldings.sectorWeightings) ? `Array[${result.topHoldings.sectorWeightings.length}]` : 'Object') : 'null');
            console.log('regionalExposure:', result.topHoldings.regionalExposure ? (Array.isArray(result.topHoldings.regionalExposure) ? `Array[${result.topHoldings.regionalExposure.length}]` : 'Object') : 'null');
            console.log('equityHoldings:', result.topHoldings.equityHoldings ? 'present' : 'null');
        }
    } catch (error) {
        console.error('Error fetching ETF data:', error);
    }
}

debugEtf();
