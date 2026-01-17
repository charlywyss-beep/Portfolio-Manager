
const symbol = 'VWRL.L';
const url = `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${symbol}?modules=topHoldings,assetProfile`;

console.log(`Fetching ${url}...`);

fetch(url)
    .then(res => res.json())
    .then(data => {
        const result = data.quoteSummary?.result?.[0];
        if (result) {
            console.log('--- Result Keys ---');
            console.log(Object.keys(result));

            if (result.topHoldings) {
                console.log('\n--- topHoldings ---');
                // Log simplified structure to avoid truncation
                const { sectorWeightings, equityHoldings, holdings } = result.topHoldings;
                console.log('Sectors:', sectorWeightings?.length);
                console.log('Holdings:', holdings?.length);
                console.log('Full topHoldings Keys:', Object.keys(result.topHoldings));

                if (sectorWeightings) {
                    console.log('First Sector:', JSON.stringify(sectorWeightings[0]));
                }
            }
        } else {
            console.log('No result found. Data:', JSON.stringify(data));
        }
    })
    .catch(err => console.error('Error:', err));
