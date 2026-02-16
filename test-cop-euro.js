import YahooFinance from 'yahoo-finance2';

const yahooFinance = new YahooFinance();

async function checkTickers() {
    const tickers = ['COP.SW', 'COP.DE'];
    console.log("Checking European tickers for ConocoPhillips...\n");

    for (const ticker of tickers) {
        try {
            const quote = await yahooFinance.quote(ticker);
            const marketTime = quote.regularMarketTime ? new Date(quote.regularMarketTime).toISOString() : 'N/A';

            console.log(`✅ [${ticker}] Found:`);
            console.log(`   Price: ${quote.regularMarketPrice} ${quote.currency}`);
            console.log(`   Exchange: ${quote.exchange}`);
            console.log(`   Last Trade: ${marketTime}`);
            console.log(`   Volume: ${quote.regularMarketVolume}`);
        } catch (e) {
            console.log(`❌ [${ticker}] Failed: ${e.message}`);
        }
        console.log("---");
    }
}

checkTickers();
