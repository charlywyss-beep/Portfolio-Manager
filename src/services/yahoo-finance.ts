
import { FALLBACK_ALLOCATIONS } from '../data/fallbackAllocations';

// Basic type for a chart data point
export interface ChartDataPoint {
    date: string;
    value: number;
}

export type TimeRange = '1D' | '1W' | '1M' | '3M' | '6M' | '1Y' | '5Y' | 'BUY';

// Helper to get period and interval for Yahoo Finance
const getYahooParams = (range: TimeRange): { period: string; interval: string } => {
    switch (range) {
        case '1D': return { period: '1d', interval: '5m' };
        case '1W': return { period: '5d', interval: '15m' };
        case '1M': return { period: '1mo', interval: '15m' };
        case '3M': return { period: '3mo', interval: '60m' };
        case '6M': return { period: '6mo', interval: '60m' };
        case '1Y': return { period: '1y', interval: '1d' };
        case '5Y': return { period: '5y', interval: '1wk' };
        case 'BUY': return { period: '5y', interval: '1wk' };
    }
};

/**
 * Normalizes prices from Yahoo Finance.
 */
export function normalizeYahooPrice(price: number, currency: string | null, symbol: string): number {
    if (!price) return price;

    const cur = currency?.toUpperCase();
    const isPence = cur === 'GBP' || cur === 'GBX';
    const isLSE = symbol.toUpperCase().endsWith('.L');

    const isLikelyPence = isLSE && price > 50 && cur !== 'USD' && cur !== 'EUR' && cur !== 'CHF';
    const isSmallNumber = price < 25;

    if (isLSE && price < 0.5) return price * 100;
    if ((isPence && !isSmallNumber) || isLikelyPence) return price / 100;

    return price;
}

export async function fetchStockHistory(
    symbol: string,
    range: TimeRange,
    _apiKey?: string
): Promise<{ data: ChartDataPoint[] | null, currency?: string, error?: string, previousClose?: number }> {
    try {
        const { period, interval } = getYahooParams(range);
        const url = `/api/yahoo-finance?symbol=${symbol}&period=${period}&interval=${interval}&_=${Date.now()}`;

        console.log('[Yahoo Finance Proxy] Fetching:', symbol, 'Period:', period, 'Interval:', interval);
        const response = await fetch(url);

        if (!response.ok) return { data: null, error: `API Fehler: ${response.status}` };

        const data = await response.json();
        if (data.chart?.error) return { data: null, error: `Yahoo Finance: ${data.chart.error.description}` };

        const result = data.chart?.result?.[0];
        if (!result || !result.timestamp || !result.indicators?.quote?.[0]?.close) {
            return { data: null, error: 'Keine Daten verfügbar' };
        }

        const timestamps = result.timestamp;
        const closes = result.indicators.quote[0].close;
        const resultCurrency = result.meta?.currency || null;

        const points: ChartDataPoint[] = timestamps
            .map((timestamp: number, index: number) => {
                const close = closes[index];
                if (close === null || close === undefined) return null;
                return {
                    date: new Date(timestamp * 1000).toISOString(),
                    value: normalizeYahooPrice(close, resultCurrency, symbol)
                };
            })
            .filter((p: ChartDataPoint | null): p is ChartDataPoint => p !== null);

        const rawPrevClose = result.meta?.regularMarketPreviousClose || result.meta?.chartPreviousClose || result.meta?.previousClose;
        let normalizedPrevClose = rawPrevClose ? normalizeYahooPrice(rawPrevClose, resultCurrency, symbol) : undefined;

        // Smart Baseline Validation
        if (range === '1D' && points.length > 0 && normalizedPrevClose) {
            const firstPoint = points[0].value;
            const deviation = Math.abs((normalizedPrevClose - firstPoint) / firstPoint);
            if (deviation > 0.03) normalizedPrevClose = firstPoint;
        }

        // Unit Mismatch Correction
        if (normalizedPrevClose && points.length > 0) {
            const lastPrice = points[points.length - 1].value;
            const ratio = lastPrice / normalizedPrevClose;
            if (ratio > 90 && ratio < 120) normalizedPrevClose = normalizedPrevClose * 100;
            else if (ratio > 0.008 && ratio < 0.012) normalizedPrevClose = normalizedPrevClose / 100;
        }

        return { data: points.length > 0 ? points : null, currency: resultCurrency, previousClose: normalizedPrevClose };

    } catch (error) {
        console.error("Yahoo Finance Proxy Error:", error);
        return { data: null, error: 'Netzwerkfehler oder API nicht erreichbar.' };
    }
}

// Helper to find logo
export async function fetchCompanyLogo(query: string): Promise<string | null> {
    try {
        const response = await fetch(`https://autocomplete.clearbit.com/v1/companies/suggest?query=${encodeURIComponent(query)}`);
        if (!response.ok) return null;
        const data = await response.json();
        if (data && data.length > 0) return data[0].logo;
        return null;
    } catch (e) {
        return null;
    }
}

// Manual Country Overrides
const MANUAL_COUNTRY_OVERRIDES: Record<string, string> = {
    'VWRA.L': 'Welt', 'VWRD.L': 'Welt', 'SWDA.L': 'Welt', 'IWDA.L': 'Welt', 'EUNL.DE': 'Welt',
    'CSSPX.SW': 'USA', 'CSPX.L': 'USA', 'VUAA.L': 'USA', 'VUSA.L': 'USA',
    'WINC.L': 'Welt', 'WINC.AS': 'Welt', 'CHSPI.SW': 'Schweiz',
};

// Precise Price Fetch (Chart API)
export async function fetchStockPricePrecise(symbol: string): Promise<{
    price: number | null,
    previousClose: number | null,
    marketTime: Date | null,
    currency: string | null,
    error?: string
}> {
    try {
        const history = await fetchStockHistory(symbol, '1D');
        if (history.error) return { price: null, previousClose: null, marketTime: null, currency: null, error: history.error };

        if (history.data && history.data.length > 0) {
            const lastPoint = history.data[history.data.length - 1];
            return {
                price: lastPoint.value,
                previousClose: history.previousClose || null,
                marketTime: new Date(lastPoint.date),
                currency: history.currency || null
            };
        }
        return { price: null, previousClose: null, marketTime: null, currency: null, error: 'No chart data' };
    } catch (e) {
        return { price: null, previousClose: null, marketTime: null, currency: null, error: 'Network error' };
    }
}

// Fallback executor
async function executeFallback(symbol: string) {
    try {
        // Fallback uses the SAME PROXY PATH as Watchlist (fetchStockHistory/fetchStockPricePrecise)
        console.log(`[YahooService] Attempting Fallback to Chart Proxy for ${symbol}`);
        const precise = await fetchStockPricePrecise(symbol);

        if (precise.price !== null) {
            return {
                price: precise.price,
                currency: precise.currency,
                marketTime: precise.marketTime,
                trailingPE: null,
                forwardPE: null,
                eps: null,
                dividendYield: null,
                country: null,
                error: undefined
            };
        }
    } catch (fallbackError) {
        console.error("Fallback failed:", fallbackError);
    }
    return null;
}

// Fetch multiple quotes at once (Batch)
// THIS IS THE WORKING FUNCTION (Watchlist uses this)
export async function fetchStockQuotes(symbols: string[]): Promise<Record<string, {
    price: number,
    previousClose?: number,
    marketTime?: Date,
    marketState?: string | null,
    trailingPE?: number | null,
    forwardPE?: number | null,
    eps?: number | null,
    dividendYield?: number,
    longName?: string | null,
    shortName?: string | null,
    displayName?: string | null,
    isin?: string | null
}>> {
    if (symbols.length === 0) return {};

    try {
        const symbolStr = symbols.join(',');
        const url = `/api/yahoo-quote?symbol=${symbolStr}&_=${Date.now()}`;
        const response = await fetch(url);

        if (!response.ok) {
            console.error(`API Error: ${response.status}`);
            return {};
        }

        const data = await response.json();
        const results = data.quoteResponse?.result || [];

        const updateMap: Record<string, {
            price: number,
            previousClose?: number,
            marketTime?: Date,
            marketState?: string | null,
            trailingPE?: number | null,
            forwardPE?: number | null,
            eps?: number | null,
            dividendYield?: number,
            longName?: string | null,
            shortName?: string | null,
            displayName?: string | null,
            isin?: string | null
        }> = {};

        results.forEach((res: any) => {
            if (res.symbol && res.regularMarketPrice) {
                const price = normalizeYahooPrice(res.regularMarketPrice, res.currency, res.symbol);
                const previousClose = res.regularMarketPreviousClose ? normalizeYahooPrice(res.regularMarketPreviousClose, res.currency, res.symbol) : undefined;

                // Extraction helper for potential Yahoo objects {raw, fmt}
                const extractValue = (val: any) => (val && typeof val === 'object' && 'raw' in val) ? val.raw : val;

                const eps = extractValue(res.eps) || extractValue(res.epsTrailingTwelveMonths);
                let trailingPE = extractValue(res.trailingPE);
                const forwardPE = extractValue(res.forwardPE);

                // Service-level fallback for PE calculation
                if (!trailingPE && price && eps) {
                    trailingPE = price / eps;
                }

                updateMap[res.symbol] = {
                    price,
                    previousClose,
                    marketTime: res.regularMarketTime ? new Date(res.regularMarketTime * 1000) : undefined,
                    marketState: res.marketState || null,
                    trailingPE,
                    forwardPE,
                    eps,
                    dividendYield: extractValue(res.dividendYield) || undefined,
                    longName: res.longName || null,
                    shortName: res.shortName || null,
                    displayName: res.displayName || null,
                    isin: res.isin || null
                };
            }
        });

        return updateMap;
    } catch (error) {
        console.error("Batch Quote Error:", error);
        return {};
    }
}

// Fetch latest quote (Wrapper calling Batch!)
// STRATEGY CHANGE: Route Single request via Batch Path to ensure consistent behavior with Watchlist.
export async function fetchStockQuote(symbol: string, initialName?: string): Promise<{
    price: number | null,
    currency: string | null,
    marketTime: Date | null,
    trailingPE: number | null,
    forwardPE: number | null,
    eps: number | null,
    dividendYield: number | null,
    country: string | null,
    marketState?: string | null,
    open?: number | null,
    previousClose?: number | null,
    sectorWeights?: { [key: string]: number } | null,
    countryWeights?: { [key: string]: number } | null,
    name?: string | null,
    isin?: string | null,
    error?: string
}> {
    try {
        console.log(`[YahooService] Fetching Single Quote for ${symbol} using Batch Wrapper...`);

        // 1. Try Batch Path (Proven working for Watchlist)
        const batchMap = await fetchStockQuotes([symbol]);
        const batchResult = batchMap[symbol];

        if (batchResult && batchResult.price) {
            let country = MANUAL_COUNTRY_OVERRIDES[symbol] || null;

            // Try to reuse allocation fallback logic
            let sectorWeights = null;
            let countryWeights = null;
            if (FALLBACK_ALLOCATIONS[symbol]) {
                sectorWeights = FALLBACK_ALLOCATIONS[symbol].sectorWeights;
                countryWeights = FALLBACK_ALLOCATIONS[symbol].countryWeights;
            }

            return {
                price: batchResult.price,
                currency: (batchResult as any).currency || null,
                marketTime: batchResult.marketTime || new Date(),
                trailingPE: batchResult.trailingPE || null,
                forwardPE: batchResult.forwardPE || null,
                eps: batchResult.eps || null,
                dividendYield: (batchResult as any).dividendYield || null,
                country: country,
                marketState: batchResult.marketState || null,
                open: (batchResult as any).open || null,
                previousClose: batchResult.previousClose || null,
                sectorWeights: sectorWeights,
                countryWeights: countryWeights,
                name: batchResult.longName || batchResult.shortName || batchResult.displayName || initialName || symbol,
                isin: batchResult.isin || null,
                error: undefined
            };
        }

        // 2. If Batch failed (empty), try explicit Fallback logic (Chart Proxy)
        console.warn("[YahooService] Batch Wrapper returned no data. Triggering Fallback.");
        const fb = await executeFallback(symbol);
        if (fb) return fb;

        return {
            price: null, currency: null, marketTime: null, trailingPE: null, forwardPE: null, eps: null, dividendYield: null, country: null, error: 'Keine Daten', open: null, previousClose: null
        };

    } catch (error) {
        console.error("Yahoo Quote Wrapper Error:", error);

        const fb = await executeFallback(symbol);
        if (fb) return fb;

        return {
            price: null, currency: null, marketTime: null, trailingPE: null, forwardPE: null, eps: null, dividendYield: null, country: null, error: 'Netzwerkfehler'
        };
    }
}

// Search for stocks (Using Library Proxy with Crumbs)
export const searchStocks = async (query: string): Promise<any[]> => {
    try {
        if (!query || query.length < 1) return [];
        const response = await fetch(`/api/yahoo-search?query=${encodeURIComponent(query)}`);
        const data = await response.json();
        const quotes = data.quotes || [];
        if (!Array.isArray(quotes)) return [];
        return quotes.map((quote: any) => ({
            symbol: quote.symbol,
            name: quote.shortname || quote.longname || quote.displayName || quote.symbol,
            shortname: quote.shortname,
            longname: quote.longname,
            type: quote.quoteType,
            exch: quote.exchange,
            isin: quote.isin || (quote.symbol.length === 12 && !quote.symbol.includes('.') ? quote.symbol : null)
        }));
    } catch (error) {
        console.error("Search Error:", error);
        return [];
    }
};

// Helper to fetch advanced Analysis (Growth estimates, Valuation)
export async function fetchStockAnalysis(symbol: string): Promise<{
    growthRate: number | null,
    peHistory: number | null,
    forwardPE: number | null,
    pegRatio: number | null,
    eps: number | null,
    price: number | null,
    currency: string | null
}> {
    // FALLBACK: Fetch Robust Price (Chart API) in parallel!
    // This ensures that even if QuoteSummary is blocked (returning nulls), we have a valid Price.
    // This allows the FairValueCalculator fallback logic to trigger (because a.price > 0).
    let robustPriceData = null;
    try {
        robustPriceData = await fetchStockPricePrecise(symbol);
    } catch (e) {
        console.warn("[Yahoo Analysis] Robust Price Fetch Failed:", e);
    }

    try {
        const url = `/api/yahoo-quote-summary?symbol=${symbol}&modules=earningsTrend,defaultKeyStatistics,financialData`;
        console.log('[Yahoo Finance] Fetching Analysis for:', symbol);

        const response = await fetch(url);

        // If Summary fails, but we have Robust Price, return that!
        if (!response.ok) {
            return {
                growthRate: null, peHistory: null, forwardPE: null, pegRatio: null,
                eps: null,
                price: robustPriceData?.price || null,
                currency: robustPriceData?.currency || null
            };
        }

        const data = await response.json();
        const result = data.quoteSummary?.result?.[0];

        if (!result) {
            return {
                growthRate: null, peHistory: null, forwardPE: null, pegRatio: null,
                eps: null,
                price: robustPriceData?.price || null,
                currency: robustPriceData?.currency || null
            };
        }

        let growthRate: number | null = null;
        const trends = result.earningsTrend?.trend || [];
        const fiveYearTrend = trends.find((t: any) => t.period === '5y');

        if (fiveYearTrend && fiveYearTrend.growth && fiveYearTrend.growth.raw) {
            growthRate = fiveYearTrend.growth.raw;
        }

        const forwardPE = result.defaultKeyStatistics?.forwardPE?.raw || result.financialData?.forwardPE?.raw || null;
        const pegRatio = result.defaultKeyStatistics?.pegRatio?.raw || null;
        const peHistory = null;
        const eps = result.defaultKeyStatistics?.trailingEps?.raw || null;

        // Prefer Summary Price, but fallback to Robust Price if missing
        const price = result.financialData?.currentPrice?.raw || robustPriceData?.price || null;
        const currency = result.financialData?.financialCurrency || robustPriceData?.currency || null;

        return {
            growthRate,
            peHistory,
            forwardPE,
            pegRatio,
            eps,
            price,
            currency
        };
    } catch (e) {
        console.warn("[Yahoo Analysis] Failed:", e);
        // Return Robust Price on error
        return {
            growthRate: null, peHistory: null, forwardPE: null, pegRatio: null,
            eps: null,
            price: robustPriceData?.price || null,
            currency: robustPriceData?.currency || null
        };
    }
}
