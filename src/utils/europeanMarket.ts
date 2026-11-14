import { useState, useEffect } from 'react';
/**
 * European Market & Tradegate Ticker Mapping & Helpers
 * Allows European investors (CET timezone) to monitor US stocks
 * from 08:00 CET on Tradegate/Xetra in EUR, before US Pre-Market (10:00 CET)
 * and US Regular Open (15:30 CET).
 */

export interface EuropeanTickerInfo {
    symbol: string; // e.g. 'MSF.DE'
    exchange: string; // e.g. 'Tradegate / Xetra'
    name: string;
}

export const US_TO_EUROPE_TICKER_MAP: Record<string, EuropeanTickerInfo> = {
    'MSFT': { symbol: 'MSF.DE', exchange: 'Tradegate / Xetra', name: 'Microsoft' },
    'AAPL': { symbol: 'APC.DE', exchange: 'Tradegate / Xetra', name: 'Apple' },
    'GOOGL': { symbol: 'ABEA.DE', exchange: 'Tradegate / Xetra', name: 'Alphabet A' },
    'GOOG': { symbol: 'ABEC.DE', exchange: 'Tradegate / Xetra', name: 'Alphabet C' },
    'AMZN': { symbol: 'AMZ.DE', exchange: 'Tradegate / Xetra', name: 'Amazon' },
    'NVDA': { symbol: 'NVD.DE', exchange: 'Tradegate / Xetra', name: 'Nvidia' },
    'META': { symbol: 'FB2A.DE', exchange: 'Tradegate / Xetra', name: 'Meta Platforms' },
    'TSLA': { symbol: 'TL0.DE', exchange: 'Tradegate / Xetra', name: 'Tesla' },
    'BRK.B': { symbol: 'BRH.DE', exchange: 'Tradegate / Xetra', name: 'Berkshire Hathaway' },
    'BRK-B': { symbol: 'BRH.DE', exchange: 'Tradegate / Xetra', name: 'Berkshire Hathaway' },
    'JNJ': { symbol: 'JNJ.DE', exchange: 'Tradegate / Xetra', name: 'Johnson & Johnson' },
    'V': { symbol: '3V64.DE', exchange: 'Tradegate / Xetra', name: 'Visa' },
    'MA': { symbol: 'M4I.DE', exchange: 'Tradegate / Xetra', name: 'Mastercard' },
    'PG': { symbol: 'PRG.DE', exchange: 'Tradegate / Xetra', name: 'Procter & Gamble' },
    'KO': { symbol: 'CCC3.DE', exchange: 'Tradegate / Xetra', name: 'Coca-Cola' },
    'PEP': { symbol: 'PEP.DE', exchange: 'Tradegate / Xetra', name: 'PepsiCo' },
    'LLY': { symbol: 'LLY.DE', exchange: 'Tradegate / Xetra', name: 'Eli Lilly' },
    'AVGO': { symbol: '1YD.DE', exchange: 'Tradegate / Xetra', name: 'Broadcom' },
    'AMD': { symbol: 'AMD.DE', exchange: 'Tradegate / Xetra', name: 'AMD' },
    'QCOM': { symbol: 'QCI.DE', exchange: 'Tradegate / Xetra', name: 'Qualcomm' },
    'NFLX': { symbol: 'NFC.DE', exchange: 'Tradegate / Xetra', name: 'Netflix' },
    'INTC': { symbol: 'INL.DE', exchange: 'Tradegate / Xetra', name: 'Intel' },
    'CRM': { symbol: 'FOO.DE', exchange: 'Tradegate / Xetra', name: 'Salesforce' },
    'ORCL': { symbol: 'ORC.DE', exchange: 'Tradegate / Xetra', name: 'Oracle' },
    'CSCO': { symbol: 'CIS.DE', exchange: 'Tradegate / Xetra', name: 'Cisco' },
    'ADBE': { symbol: 'ADB.DE', exchange: 'Tradegate / Xetra', name: 'Adobe' },
    'WMT': { symbol: 'WMT.DE', exchange: 'Tradegate / Xetra', name: 'Walmart' },
    'MCD': { symbol: 'MDO.DE', exchange: 'Tradegate / Xetra', name: "McDonald's" },
    'DIS': { symbol: 'WDP.DE', exchange: 'Tradegate / Xetra', name: 'Walt Disney' },
    'NKE': { symbol: 'NKE.DE', exchange: 'Tradegate / Xetra', name: 'Nike' },
    'IBM': { symbol: 'IBM.DE', exchange: 'Tradegate / Xetra', name: 'IBM' },
    'TXN': { symbol: 'TII.DE', exchange: 'Tradegate / Xetra', name: 'Texas Instruments' },
    'UNH': { symbol: 'UNH.DE', exchange: 'Tradegate / Xetra', name: 'UnitedHealth' },
    'PFE': { symbol: 'PFE.DE', exchange: 'Tradegate / Xetra', name: 'Pfizer' },
    'ABBV': { symbol: '4AB.DE', exchange: 'Tradegate / Xetra', name: 'AbbVie' },
    'MRK': { symbol: '6MR.DE', exchange: 'Tradegate / Xetra', name: 'Merck & Co.' },
    'T': { symbol: 'SOBA.DE', exchange: 'Tradegate / Xetra', name: 'AT&T' },
    'VZ': { symbol: 'BAC.DE', exchange: 'Tradegate / Xetra', name: 'Verizon' },
    'BAC': { symbol: 'NCB.DE', exchange: 'Tradegate / Xetra', name: 'Bank of America' },
    'JPM': { symbol: 'CMC.DE', exchange: 'Tradegate / Xetra', name: 'JPMorgan Chase' },
    'GS': { symbol: 'GOS.DE', exchange: 'Tradegate / Xetra', name: 'Goldman Sachs' },
    'MS': { symbol: 'DWD.DE', exchange: 'Tradegate / Xetra', name: 'Morgan Stanley' },
    'BLK': { symbol: 'BLH.DE', exchange: 'Tradegate / Xetra', name: 'BlackRock' },
    'CVX': { symbol: 'CHV.DE', exchange: 'Tradegate / Xetra', name: 'Chevron' },
    'XOM': { symbol: 'XONA.DE', exchange: 'Tradegate / Xetra', name: 'ExxonMobil' },
    'LIN': { symbol: 'LIN.DE', exchange: 'Tradegate / Xetra', name: 'Linde' },
    'PM': { symbol: '4I1.DE', exchange: 'Tradegate / Xetra', name: 'Philip Morris' },
    'MO': { symbol: 'PHM7.DE', exchange: 'Tradegate / Xetra', name: 'Altria' },
    'COST': { symbol: 'CTO.DE', exchange: 'Tradegate / Xetra', name: 'Costco' },
    'HD': { symbol: 'HDI.DE', exchange: 'Tradegate / Xetra', name: 'Home Depot' },
    'AMAT': { symbol: 'ATA.DE', exchange: 'Tradegate / Xetra', name: 'Applied Materials' },
    'NOW': { symbol: '22N.DE', exchange: 'Tradegate / Xetra', name: 'ServiceNow' },
    'ISRG': { symbol: 'IUI1.DE', exchange: 'Tradegate / Xetra', name: 'Intuitive Surgical' },
    'PLTR': { symbol: '17C.DE', exchange: 'Tradegate / Xetra', name: 'Palantir' },
    'UBER': { symbol: 'UT8.DE', exchange: 'Tradegate / Xetra', name: 'Uber' },
    'ABNB': { symbol: '0Z3.DE', exchange: 'Tradegate / Xetra', name: 'Airbnb' },
    'PANW': { symbol: '5PN.DE', exchange: 'Tradegate / Xetra', name: 'Palo Alto Networks' },
    'GIS': { symbol: 'GRM.DE', exchange: 'Tradegate / Xetra', name: 'General Mills' },
    'KHC': { symbol: 'KHNZ.DE', exchange: 'Tradegate / Xetra', name: 'Kraft Heinz' },
    'BTI': { symbol: 'BMT.DE', exchange: 'Tradegate / Xetra', name: 'British American Tobacco' },
};

/**
 * Returns the European ticker for a given US stock symbol (or user custom override).
 */
export function getEuropeanTicker(symbol: string, customSymbol?: string): EuropeanTickerInfo | null {
    if (customSymbol && customSymbol.trim()) {
        return {
            symbol: customSymbol.trim().toUpperCase(),
            exchange: 'Europäische Notierung',
            name: symbol
        };
    }
    const cleanSym = symbol ? symbol.toUpperCase().trim() : '';
    return US_TO_EUROPE_TICKER_MAP[cleanSym] || null;
}

export interface EuropeanIndicationQuote {
    symbol: string;
    priceEUR: number;
    previousCloseEUR: number;
    changePercent: number;
    changeAmount: number;
    time?: number;
    timeText?: string;
    impliedTargetPrice?: number;
    impliedTargetCurrency?: string;
    impliedDeltaPercent?: number;
}

/**
 * Bulk fetches European (Tradegate / Xetra) quotes for multiple US/international stocks.
 */
export async function fetchEuropeanQuotesBulk(
    items: Array<{ symbol: string; customEuSymbol?: string; currency?: string; currentPrice?: number }>,
    rates?: Record<string, number>
): Promise<Record<string, EuropeanIndicationQuote>> {
    const symbolsToFetch: string[] = [];
    const symMap: Record<string, { originalSymbol: string; currency: string; currentPrice: number }> = {};

    for (const item of items) {
        if (!item?.symbol) continue;
        const info = getEuropeanTicker(item.symbol, item.customEuSymbol);
        if (info?.symbol) {
            symbolsToFetch.push(info.symbol);
            symMap[info.symbol] = {
                originalSymbol: item.symbol,
                currency: item.currency || 'USD',
                currentPrice: item.currentPrice || 0
            };
        }
    }

    if (symbolsToFetch.length === 0) return {};

    const quotes: Record<string, EuropeanIndicationQuote> = {};
    try {
        const uniqueSymbols = Array.from(new Set(symbolsToFetch));
        const url = `/api/yahoo-quote?symbol=${encodeURIComponent(uniqueSymbols.join(','))}&_=${Date.now()}`;
        const res = await fetch(url);
        if (!res.ok) return {};
        const json = await res.json();
        const results = json.quoteResponse?.result || [];

        const eurRate = rates?.['EUR'] || 1.06;

        for (const r of results) {
            if (!r || !r.symbol || r.regularMarketPrice === undefined) continue;
            const meta = symMap[r.symbol];
            if (!meta) continue;

            const priceEUR = r.regularMarketPrice;
            const prevCloseEUR = r.regularMarketPreviousClose || priceEUR;
            const changeAmount = priceEUR - prevCloseEUR;
            const changePercent = prevCloseEUR > 0 ? (changeAmount / prevCloseEUR) * 100 : (r.regularMarketChangePercent || 0);
            const time = r.regularMarketTime;

            const timeText = time ? (() => {
                const d = new Date(time * 1000);
                const hm = d.toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit' });
                return d.toDateString() === new Date().toDateString()
                    ? hm
                    : `${d.toLocaleDateString('de-CH', { day: '2-digit', month: '2-digit' })} ${hm}`;
            })() : undefined;

            let impliedTargetPrice: number | undefined;
            let impliedDeltaPercent: number | undefined;

            const targetRate = rates?.[meta.currency] || 1.12;
            if (eurRate > 0 && targetRate > 0) {
                const eurToTarget = targetRate / eurRate;
                impliedTargetPrice = priceEUR * eurToTarget;
                if (meta.currentPrice > 0) {
                    impliedDeltaPercent = ((impliedTargetPrice - meta.currentPrice) / meta.currentPrice) * 100;
                }
            }

            const quoteObj: EuropeanIndicationQuote = {
                symbol: r.symbol,
                priceEUR,
                previousCloseEUR: prevCloseEUR,
                changePercent,
                changeAmount,
                time,
                timeText,
                impliedTargetPrice,
                impliedTargetCurrency: meta.currency,
                impliedDeltaPercent
            };

            quotes[r.symbol] = quoteObj;
            quotes[meta.originalSymbol] = quoteObj;
        }
    } catch (e) {
        console.warn('[EuropeanMarket] Bulk fetch error:', e);
    }
    return quotes;
}

/**
 * Reusable React Hook for subscribing to European quotes for a list of positions.
 */
export function useEuropeanQuotes(
    items: Array<{ stock?: { symbol: string; currency?: string; currentPrice?: number; europeanSymbol?: string } }>,
    rates?: Record<string, number>
) {
    const [quotes, setQuotes] = useState<Record<string, EuropeanIndicationQuote>>({});
    const [isLoading, setIsLoading] = useState(false);

    const symbolsKey = items.map(i => i?.stock?.symbol).filter(Boolean).join(',');

    useEffect(() => {
        let isCancelled = false;
        const load = async () => {
            const list = items
                .filter(i => Boolean(i?.stock?.symbol))
                .map(i => ({
                    symbol: i.stock!.symbol,
                    customEuSymbol: i.stock!.europeanSymbol,
                    currency: i.stock!.currency,
                    currentPrice: i.stock!.currentPrice
                }));

            if (list.length === 0) return;

            setIsLoading(true);
            const res = await fetchEuropeanQuotesBulk(list, rates);
            if (!isCancelled) {
                setQuotes(res);
                setIsLoading(false);
            }
        };

        load();
        return () => { isCancelled = true; };
    }, [symbolsKey, rates ? Object.keys(rates).length : 0]);

    return { quotes, isLoading };
}
