import YahooFinance from 'yahoo-finance2';
const yahooFinance = new YahooFinance();

async function test() {
    try {
        const symbol = 'SHEL'; // US primary ticker
        console.log('Testing', symbol);
        
        const quoteBasic = await yahooFinance.quote(symbol).catch(e => {
            console.error('quote err', e.message);
            return null;
        });
        if (quoteBasic) {
             console.log('\n--- quoteBasic fields ---');
             console.log(Object.keys(quoteBasic));
             console.log('marketCap:', quoteBasic.marketCap);
             console.log('operatingCashflow?', quoteBasic.operatingCashflow);
        }
        
        // Done.
    } catch (e) {
        console.error('fatal', e);
    }
}
test();
