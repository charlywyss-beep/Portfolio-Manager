const symbol = "AAPL";
fetch(`https://query2.finance.yahoo.com/v10/finance/quoteSummary/${symbol}?modules=financialData,defaultKeyStatistics,summaryDetail`, {
    headers: {
        'User-Agent': 'Mozilla/5.0'
    }
})
  .then(r => r.json())
  .then(d => {
      const ObjectkeysCheck = d?.quoteSummary?.result?.[0];
      if (!ObjectkeysCheck) { console.log(d); return; }
      const res = ObjectkeysCheck;
      const keys = [];
      if (res.financialData) keys.push(...Object.keys(res.financialData));
      if (res.defaultKeyStatistics) keys.push(...Object.keys(res.defaultKeyStatistics));
      if (res.summaryDetail) keys.push(...Object.keys(res.summaryDetail));
      console.log("Available keys:", [...new Set(keys)].filter(k => k.toLowerCase().includes('cash') || k.toLowerCase().includes('price') || k.toLowerCase().includes('flow') || k.toLowerCase().includes('oper')));
      
      console.log("operatingCashflow:", res.financialData?.operatingCashflow);
      console.log("freeCashflow:", res.financialData?.freeCashflow);
      console.log("priceToBook:", res.defaultKeyStatistics?.priceToBook);
  });
