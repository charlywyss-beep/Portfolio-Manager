async function testScrape() {
    try {
        const symbol = 'SHEL.L';
        const url = `https://finance.yahoo.com/quote/${symbol}`;
        const res = await fetch(url, {
             headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        const html = await res.text();
        const symbol2 = 'VWRA.L';
        const url2 = `https://finance.yahoo.com/quote/${symbol2}/holdings`;
        const res2 = await fetch(url2, {
             headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        const html2 = await res2.text();
    } catch (e) {
        console.error(e);
    }
}
testScrape();
