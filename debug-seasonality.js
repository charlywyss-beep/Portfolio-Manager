
const symbol = 'NESN.SW';
const years = 1;

async function debugSeasonality() {
    try {
        const url = `http://localhost:3000/api/yahoo-finance?symbol=${symbol}&period=${years}y&interval=1mo`;
        const response = await fetch(url);
        const raw = await response.json();

        const result = raw.chart?.result?.[0];
        if (!result) {
            console.log("No result data");
            return;
        }

        const timestamps = result.timestamp;
        const closes = result.indicators?.adjclose?.[0]?.adjclose || result.indicators?.quote?.[0]?.close;

        console.log("Monthly Bars for " + symbol + ":");
        for (let i = 0; i < timestamps.length; i++) {
            const date = new Date(timestamps[i] * 1000);
            console.log(`${date.toISOString()} : ${closes[i]}`);
        }

        const liveUrl = `http://localhost:3000/api/yahoo-quote?symbol=${symbol}`;
        const liveRes = await fetch(liveUrl);
        const liveData = await liveRes.json();
        const livePrice = liveData.quoteResponse?.result?.[0]?.regularMarketPrice;
        const liveTime = liveData.quoteResponse?.result?.[0]?.regularMarketTime;

        if (livePrice) {
            console.log("\nLive Price:");
            console.log(`${new Date(liveTime * 1000).toISOString()} : ${livePrice}`);
        }

    } catch (e) {
        console.error("Debug failed", e);
    }
}

debugSeasonality();
