import YahooFinance from 'yahoo-finance2';

const yahooFinance = new YahooFinance();

async function testTickers() {
    const tickers = ['COP', 'COP.SW', 'COP.BN', 'US20825C1045.SW', 'US20825C1045.SG'];
    console.log("Testing tickers for ConocoPhillips...\n");

    for (const ticker of tickers) {
        try {
            const quote = await yahooFinance.quote(ticker);
            console.log(`✅ [${ticker}] Found:`);
            console.log(`   Name: ${quote.longName || quote.shortName} (${quote.symbol})`);
            console.log(`   Price: ${quote.regularMarketPrice} ${quote.currency}`);
            console.log(`   Exchange: ${quote.exchange}`);
        } catch (e) {
            console.log(`❌ [${ticker}] Failed: ${e.message}`);
        }
        console.log("---");
    }

    console.log("\nSearching for 'ConocoPhillips'...");
    try {
        const search = await yahooFinance.search('ConocoPhillips');
        search.quotes.forEach(q => {
            console.log(`🔎 [${q.symbol}] ${q.shortname || q.longname} (${q.exchange}) - ${q.quoteType}`);
        });
    } catch (e) {
        console.log("Search failed:", e.message);
    }
}

testTickers();
