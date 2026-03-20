async function testScrape() {
    try {
        const symbol = 'SHEL.L';
        const url = `https://finance.yahoo.com/quote/${symbol}`;
        const res = await fetch(url, {
             headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        const html = await res.text();
        const match = html.match(/root\.App\.main\s*=\s*({.*?});/s) || html.match(/context\s*=\s*({.*?});/s);
        if (match) {
            const data = JSON.parse(match[1]);
            const store = data.context?.dispatcher?.stores?.QuoteSummaryStore;
            if (store) {
                 console.log('Stores available:', Object.keys(store));
                 if (store.defaultKeyStatistics) {
                     console.log('KS:', Object.keys(store.defaultKeyStatistics));
                 }
                 if (store.financialData) {
                     console.log('FD:', Object.keys(store.financialData));
                 }
            }
        }
    } catch (e) {
        console.error(e);
    }
}
testScrape();
