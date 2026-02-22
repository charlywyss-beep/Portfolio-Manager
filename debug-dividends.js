
const symbol = 'NESN.SW';
const period = '10y';
const interval = '1mo';

async function debugDividends() {
    try {
        const url = `http://localhost:3000/api/yahoo-finance?symbol=${symbol}&period=${period}&interval=${interval}&events=div`;
        console.log("Fetching: " + url);
        const response = await fetch(url);
        const raw = await response.json();

        const result = raw.chart?.result?.[0];
        if (!result) {
            console.log("No result data");
            return;
        }

        if (result.events?.dividends) {
            console.log("\nDividends found:");
            const divs = Object.values(result.events.dividends);
            console.log("Total dividends: " + divs.length);
            for (let i = 0; i < Math.min(5, divs.length); i++) {
                const d = divs[i];
                console.log(`${new Date(d.date * 1000).toISOString()} : ${d.amount}`);
            }
        } else {
            console.log("\nNo dividends found in result.events.dividends");
            console.log("Events object keys: " + Object.keys(result.events || {}).join(", "));
        }

    } catch (e) {
        console.error("Debug failed", e);
    }
}

debugDividends();
