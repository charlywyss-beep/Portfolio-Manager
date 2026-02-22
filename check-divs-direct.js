
const symbol = 'NESN.SW';
const range = '10y';
const interval = '1d';

async function checkYahooDirect() {
    try {
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?range=${range}&interval=${interval}&events=div`;
        console.log("Fetching: " + url);
        const res = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });
        const data = await res.json();
        const result = data.chart?.result?.[0];

        if (!result) {
            console.log("No result");
            return;
        }

        console.log("\nMetadata:");
        console.log("Currency: " + result.meta?.currency);

        if (result.events?.dividends) {
            console.log("\nDividends:");
            const divs = Object.values(result.events.dividends);
            divs.sort((a, b) => b.date - a.date);
            console.log("Total: " + divs.length);
            divs.slice(0, 5).forEach(d => {
                console.log(`${new Date(d.date * 1000).toISOString().split('T')[0]} : ${d.amount}`);
            });
        } else {
            console.log("\nNo dividend events found.");
        }
    } catch (e) {
        console.error("Error: ", e);
    }
}

checkYahooDirect();
