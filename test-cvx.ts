
async function testStart() {
    try {
        console.log("Fetching CVX from Yahoo Directly...");
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/CVX?range=1d&interval=5m`;
        console.log("URL:", url);

        const response = await fetch(url);
        if (!response.ok) {
            console.error("HTTP Error:", response.status, response.statusText);
            return;
        }

        const result = await response.json();
        // console.log("Result:", JSON.stringify(result, null, 2));

        if (result.chart && result.chart.result && result.chart.result.length > 0) {
            const data = result.chart.result[0];
            const meta = data.meta;
            const indicators = data.indicators.quote[0];

            const prices = indicators.close;
            const latestPrice = prices.filter(p => p !== null).pop();
            const prevClose = meta.chartPreviousClose;

            console.log("Symbol:", meta.symbol);
            console.log("Currency:", meta.currency);
            console.log("Latest Price:", latestPrice);
            console.log("Previous Close:", prevClose);

            const diff = latestPrice - prevClose;
            const pct = (diff / prevClose) * 100;
            console.log("% Change:", pct.toFixed(2));

            // Check Date
            const timestamps = data.timestamp;
            const lastTime = timestamps[timestamps.length - 1];
            console.log("Last Timestamp:", new Date(lastTime * 1000).toISOString());

        } else {
            console.log("No chart data found structure.");
            console.log(result);
        }

    } catch (e) {
        console.error(e);
    }
}

testStart();
