import { YahooFinance } from 'yahoo-finance2';
const yahoo = new YahooFinance();

async function checkVOO() {
    try {
        const res = await yahoo.quoteSummary('VOO', { modules: ['topHoldings'] });
        console.log('VOO Top Holdings:', !!res.topHoldings);
        if (res.topHoldings) {
            console.log('Sectors:', res.topHoldings.sectorWeightings?.length);
            console.log('Countries:', res.topHoldings.regionalExposure?.length);
        }
    } catch (e) { console.log('Error:', e.message); }
}
checkVOO();
