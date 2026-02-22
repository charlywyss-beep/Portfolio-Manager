
const symbol = 'NESN.SW';
const period = '10y';
const interval = '1d';

async function testProxyDividends() {
    try {
        const url = `http://localhost:3000/api/yahoo-finance?symbol=${symbol}&period=${period}&interval=${interval}&events=div`;
        console.log("Testing Proxy: " + url);
        const res = await fetch(url);

        if (!res.ok) {
            console.log("Proxy error: " + res.status);
            return;
        }

        const data = await res.json();
        const result = data.chart?.result?.[0];

        if (!result) {
            console.log("No data returned via proxy");
            return;
        }

        if (result.events?.dividends) {
            console.log("SUCCESS: Proxy returned " + Object.keys(result.events.dividends).length + " dividends.");
        } else {
            console.log("FAILURE: Proxy returned no dividend events.");
            console.log("Raw result keys: " + Object.keys(result));
            if (result.events) console.log("Events keys: " + Object.keys(result.events));
        }
    } catch (e) {
        console.error("Test failed: ", e.message);
    }
}

testProxyDividends();
