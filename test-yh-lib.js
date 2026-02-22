
import yahooFinance from 'yahoo-finance2';

async function testLib() {
    try {
        const symbol = 'NESN.SW';
        console.log("Testing yahoo-finance2 for " + symbol);

        // Try the dividends method if it exists
        if (typeof yahooFinance.dividends === 'function') {
            console.log("Method .dividends() exists. Testing...");
            const dividends = await yahooFinance.dividends(symbol, {
                period1: '2020-01-01',
                period2: new Date().toISOString().split('T')[0]
            });
            console.log("Result length: " + (dividends ? dividends.length : "null"));
            if (dividends && dividends.length > 0) {
                console.log("Sample: ", dividends[0]);
            }
        } else {
            console.log("Method .dividends() DOES NOT exist in this version.");
            console.log("Available modules: ", Object.keys(yahooFinance).filter(k => typeof yahooFinance[k] === 'function' || typeof yahooFinance[k] === 'object'));
        }

        // Try the chart method as fallback
        console.log("\nTesting .chart() with events: 'div'...");
        const chart = await yahooFinance.chart(symbol, {
            period1: '2023-01-01',
            interval: '1d',
            events: 'div'
        });

        if (chart.events?.dividends) {
            const divs = Object.values(chart.events.dividends);
            console.log("Chart method dividends count: " + divs.length);
            console.log("Sample: ", divs[0]);
        } else {
            console.log("Chart method returned no dividends.");
        }

    } catch (e) {
        console.error("Error: ", e.message);
    }
}

testLib();
