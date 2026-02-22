
import yahooFinance from 'yahoo-finance2';

async function testHistorical() {
    try {
        const symbol = 'NESN.SW';
        console.log("Testing .historical() for " + symbol);
        const results = await yahooFinance.historical(symbol, {
            period1: '2024-01-01',
            period2: '2025-01-01',
            events: 'dividends'
        });

        console.log("Count: " + (results ? results.length : "null"));
        if (results && results.length > 0) {
            console.log("Full sample object:", JSON.stringify(results[0]));
            console.log("Sample keys:", Object.keys(results[0]));
        } else {
            console.log("No dividends found for 2024.");
        }
    } catch (e) {
        console.error("Error: ", e.message);
    }
}

testHistorical();
