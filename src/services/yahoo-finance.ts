
import { FALLBACK_ALLOCATIONS } from '../data/fallbackAllocations';
import { resolveStockCountry, resolveStockSector } from '../utils/stockMetadata';
import { translateSector } from '../utils/sectorTranslation';

// Basic type for a chart data point
export interface ChartDataPoint {
    date: string;
    value: number;
    session?: 'pre' | 'regular' | 'post';
    sma200?: number | null;
}

export type TimeRange = '1D' | '1W' | '1M' | '3M' | '6M' | '1Y' | '3Y' | '5Y' | 'BUY';

// Helper to get period and interval for Yahoo Finance
// For longer ranges (6M, 1Y, 3Y, 5Y), fetch extended history so the 200-day moving average (SMA 200)
// can be calculated across the entire visible chart window.
const getYahooParams = (range: TimeRange): { period: string; interval: string } => {
    switch (range) {
        case '1D': return { period: '1d', interval: '5m' };
        case '1W': return { period: '5d', interval: '15m' };
        case '1M': return { period: '1mo', interval: '15m' };
        case '3M': return { period: '2y', interval: '1d' };
        case '6M': return { period: '2y', interval: '1d' };
        case '1Y': return { period: '2y', interval: '1d' };
        case '3Y': return { period: '5y', interval: '1d' };
        case '5Y': return { period: '10y', interval: '1wk' };
        case 'BUY': return { period: '10y', interval: '1wk' };
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
    _apiKey?: string,
    options?: { includePrePost?: boolean }
): Promise<{ data: ChartDataPoint[] | null, currency?: string, error?: string, previousClose?: number, open?: number, regularMarketPrice?: number, regularMarketTime?: Date }> {
    try {
        const { period, interval } = getYahooParams(range);
        const includePrePostParam = (range === '1D' && options?.includePrePost) ? '&includePrePost=true' : '';
        const url = `/api/yahoo-finance?symbol=${symbol}&period=${period}&interval=${interval}${includePrePostParam}&_=${Date.now()}`;

        console.log('[Yahoo Finance Proxy] Fetching:', symbol, 'Period:', period, 'Interval:', interval);
        let data: any = null;

        try {
            const response = await fetch(url);
            if (response.ok) {
                data = await response.json();
            }
        } catch {
            // Local proxy unavailable (e.g. GitHub Pages)
        }

        // Fallback for GitHub Pages / static hosting:
        if (!data || !data.chart?.result?.[0]) {
            try {
                const targetUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${period}&interval=${interval}${includePrePostParam}&_=${Date.now()}`;
                const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}`;
                const fallbackRes = await fetch(proxyUrl);
                if (fallbackRes.ok) {
                    data = await fallbackRes.json();
                }
            } catch (fbErr) {
                console.warn('[Yahoo Finance Fallback Proxy Error]:', fbErr);
            }
        }

        if (!data) return { data: null, error: `Keine Daten verfügbar` };
        if (data.chart?.error) return { data: null, error: `Yahoo Finance: ${data.chart.error.description}` };

        let result = data.chart?.result?.[0];

        // For German Xetra (.DE) listings of international stocks (e.g. ABEA.DE):
        // If 1D Xetra has no intraday candles for today yet while Börse Frankfurt (.F, trading from 08:00 CET) already has today's candles,
        // seamlessly fall back to the .F intraday chart while preserving the .DE previousClose baseline.
        if (range === '1D' && symbol.toUpperCase().endsWith('.DE')) {
            const todayStr = new Date().toDateString();
            const tsArr: number[] = result?.timestamp || [];
            const lastTs = tsArr.length > 0 ? tsArr[tsArr.length - 1] : 0;
            const hasTodayPoints = lastTs > 0 && new Date(lastTs * 1000).toDateString() === todayStr;

            if (!hasTodayPoints) {
                const frankfurtSymbol = symbol.replace(/\.DE$/i, '.F');
                try {
                    const fUrl = `/api/yahoo-finance?symbol=${frankfurtSymbol}&period=${period}&interval=${interval}${includePrePostParam}&_=${Date.now()}`;
                    const fRes = await fetch(fUrl);
                    if (fRes.ok) {
                        const fData = await fRes.json();
                        const fResult = fData?.chart?.result?.[0];
                        const fTs: number[] = fResult?.timestamp || [];
                        const fLastTs = fTs.length > 0 ? fTs[fTs.length - 1] : 0;
                        if (fLastTs > 0 && new Date(fLastTs * 1000).toDateString() === todayStr) {
                            const xetraPrevClose = result?.meta?.regularMarketPreviousClose || result?.meta?.chartPreviousClose || result?.meta?.previousClose;
                            result = {
                                ...fResult,
                                meta: {
                                    ...fResult.meta,
                                    ...(xetraPrevClose ? { regularMarketPreviousClose: xetraPrevClose, chartPreviousClose: xetraPrevClose } : {})
                                }
                            };
                        }
                    }
                } catch {
                    // Ignore Frankfurt fallback errors
                }
            }
        }

        if (!result || !result.timestamp || !result.indicators?.quote?.[0]?.close) {
            return { data: null, error: 'Keine Daten verfügbar' };
        }

        const timestamps: number[] = result.timestamp;
        const closes = result.indicators.quote[0].close;
        const opens = result.indicators.quote[0].open || [];
        const resultCurrency = result.meta?.currency || null;
        const tp = result.meta?.currentTradingPeriod;
        const refPer = tp?.pre || tp?.regular;
        const dayShift = (refPer && timestamps.length > 0)
            ? Math.max(0, Math.round((refPer.start - timestamps[0]) / 86400)) * 86400
            : 0;

        const points: ChartDataPoint[] = timestamps
            .map((timestamp: number, index: number) => {
                const close = closes[index];
                if (close === null || close === undefined) return null;
                let session: 'pre' | 'regular' | 'post' | undefined;
                if (range === '1D' && options?.includePrePost && tp?.regular) {
                    const regStart = tp.regular.start - dayShift;
                    const regEnd = tp.regular.end - dayShift;
                    session = timestamp < regStart ? 'pre' : timestamp >= regEnd ? 'post' : 'regular';
                }
                return {
                    date: new Date(timestamp * 1000).toISOString(),
                    value: normalizeYahooPrice(close, resultCurrency, symbol),
                    ...(session ? { session } : {})
                };
            })
            .filter((p: ChartDataPoint | null): p is ChartDataPoint => p !== null);

        const rawPrevClose = result.meta?.regularMarketPreviousClose || result.meta?.chartPreviousClose || result.meta?.previousClose;
        let normalizedPrevClose = rawPrevClose ? normalizeYahooPrice(rawPrevClose, resultCurrency, symbol) : undefined;

        const firstRegularPoint = points.find(p => !p.session || p.session === 'regular') || points[0];
        const firstValidOpen = opens.find((o: number | null | undefined) => o !== null && o !== undefined && o > 0);
        const rawOpen = result.meta?.regularMarketOpen || firstValidOpen;
        let normalizedOpen = rawOpen ? normalizeYahooPrice(rawOpen, resultCurrency, symbol) : (firstRegularPoint ? firstRegularPoint.value : undefined);

        // Unit Mismatch Correction
        if (normalizedPrevClose && points.length > 0) {
            const lastPrice = points[points.length - 1].value;
            const ratio = lastPrice / normalizedPrevClose;
            if (ratio > 90 && ratio < 120) normalizedPrevClose = normalizedPrevClose * 100;
            else if (ratio > 0.008 && ratio < 0.012) normalizedPrevClose = normalizedPrevClose / 100;
        }

        const rawRegPrice = result.meta?.regularMarketPrice;
        const normalizedRegPrice = (typeof rawRegPrice === "number" && rawRegPrice > 0)
            ? normalizeYahooPrice(rawRegPrice, resultCurrency, symbol)
            : undefined;
        const regTimeSec = result.meta?.regularMarketTime;
        const normalizedRegTime = (typeof regTimeSec === "number" && regTimeSec > 0)
            ? new Date(regTimeSec * 1000)
            : undefined;

        // If regularMarketTime is from today and newer than the last 5m candle, append the live point
        if (range === '1D' && normalizedRegPrice && normalizedRegTime && points.length > 0) {
            const lastPointTime = new Date(points[points.length - 1].date).getTime();
            const isSameDay = new Date(points[points.length - 1].date).toDateString() === normalizedRegTime.toDateString();
            if (isSameDay && normalizedRegTime.getTime() > lastPointTime + 60 * 1000) {
                points.push({
                    date: normalizedRegTime.toISOString(),
                    value: normalizedRegPrice,
                    session: 'regular'
                });
            }
        }

        // Precompute accurate 200-day moving average (SMA 200) for daily and weekly ranges
        const isWeekly = interval === '1wk';
        const isDaily = interval === '1d';
        if (isDaily || isWeekly) {
            const smaWindow = isWeekly ? 40 : 200; // 40 weeks = 200 trading days
            for (let i = 0; i < points.length; i++) {
                if (i >= smaWindow - 1) {
                    let sum = 0;
                    for (let k = i - smaWindow + 1; k <= i; k++) {
                        sum += points[k].value;
                    }
                    points[i].sma200 = sum / smaWindow;
                } else {
                    points[i].sma200 = null;
                }
            }
            // Backfill any initial points (i < smaWindow - 1) with the first valid calculated SMA
            // so if a dataset has fewer than 200 prior days, the SMA line still starts from day 1!
            const firstValidIdx = points.findIndex(p => p.sma200 !== null && p.sma200 !== undefined);
            if (firstValidIdx > 0) {
                const fillVal = points[firstValidIdx].sma200;
                for (let i = 0; i < firstValidIdx; i++) {
                    points[i].sma200 = fillVal;
                }
            }
        }

        // Slice points to the exact requested range window (discarding the extra pre-history used for SMA 200)
        let finalPoints = points;
        if (points.length > 0 && ['3M', '6M', '1Y', '3Y', '5Y'].includes(range)) {
            const lastTime = new Date(points[points.length - 1].date).getTime();
            let cutoffTime = 0;
            if (range === '3M') {
                cutoffTime = lastTime - 92 * 24 * 3600 * 1000;
            } else if (range === '6M') {
                cutoffTime = lastTime - 183 * 24 * 3600 * 1000;
            } else if (range === '1Y') {
                cutoffTime = lastTime - 365.25 * 24 * 3600 * 1000;
            } else if (range === '3Y') {
                cutoffTime = lastTime - 3 * 365.25 * 24 * 3600 * 1000;
            } else if (range === '5Y') {
                cutoffTime = lastTime - 5 * 365.25 * 24 * 3600 * 1000;
            }
            if (cutoffTime > 0) {
                const filtered = points.filter(p => new Date(p.date).getTime() >= cutoffTime);
                if (filtered.length > 0) {
                    finalPoints = filtered;
                }
            }
        }

        // Final guarantee: Ensure every point in finalPoints has a non-null sma200 if any point has it
        // so the 200-day line spans 100% of the visible chart from day 1 to the end without gaps
        const firstSma = finalPoints.find(p => p.sma200 !== null && p.sma200 !== undefined)?.sma200;
        if (firstSma !== undefined && firstSma !== null) {
            for (let i = 0; i < finalPoints.length; i++) {
                if (finalPoints[i].sma200 === null || finalPoints[i].sma200 === undefined) {
                    finalPoints[i].sma200 = firstSma;
                }
            }
        }

        return { data: finalPoints.length > 0 ? finalPoints : null, currency: resultCurrency, previousClose: normalizedPrevClose, open: normalizedOpen, regularMarketPrice: normalizedRegPrice, regularMarketTime: normalizedRegTime };

    } catch (error) {
        console.error("Yahoo Finance Proxy Error:", error);
        return { data: null, error: 'Netzwerkfehler oder API nicht erreichbar.' };
    }
}

export interface HistoricalCloseData {
    symbol: string;
    close: number;
    startDate: string;
    currency?: string | null;
}

const historicalCloseCache = new Map<string, { data: HistoricalCloseData; timestamp: number }>();
const HISTORICAL_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export function clearHistoricalCloseCache(): void {
    historicalCloseCache.clear();
}

export type HistoricalRange = '1W' | '1M' | '3M' | '6M' | '1Y' | '3Y' | '5Y';

export async function fetchHistoricalClose(
    symbol: string,
    range: HistoricalRange
): Promise<HistoricalCloseData | null> {
    if (!symbol) return null;

    const cacheKey = `${symbol.toUpperCase()}_${range}`;
    const cached = historicalCloseCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp < HISTORICAL_CACHE_TTL_MS)) {
        return cached.data;
    }

    const rangeParamMap: Record<HistoricalRange, { period: string; interval: string }> = {
        '1W': { period: '5d', interval: '1d' },
        '1M': { period: '1mo', interval: '1d' },
        '3M': { period: '3mo', interval: '1d' },
        '6M': { period: '6mo', interval: '1d' },
        '1Y': { period: '1y', interval: '1d' },
        '3Y': { period: '3y', interval: '1d' },
        '5Y': { period: '5y', interval: '1wk' }
    };

    const { period, interval } = rangeParamMap[range] || { period: '5d', interval: '1d' };

    try {
        const url = `/api/yahoo-finance?symbol=${encodeURIComponent(symbol)}&period=${period}&interval=${interval}&_=${Date.now()}`;
        let data: any = null;

        try {
            const response = await fetch(url);
            if (response.ok) {
                data = await response.json();
            }
        } catch {
            // Local proxy unavailable
        }

        // Fallback proxy (e.g. for GitHub Pages / CORS):
        if (!data || !data.chart?.result?.[0]) {
            try {
                const targetUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?period=${period}&interval=${interval}&_=${Date.now()}`;
                const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}`;
                const fallbackRes = await fetch(proxyUrl);
                if (fallbackRes.ok) {
                    data = await fallbackRes.json();
                }
            } catch (fbErr) {
                console.warn('[fetchHistoricalClose Fallback Error]:', fbErr);
            }
        }

        const result = data?.chart?.result?.[0];
        if (!result || !result.timestamp || !result.indicators?.quote?.[0]?.close) {
            return null;
        }

        const timestamps: number[] = result.timestamp;
        const closes: (number | null)[] = result.indicators.quote[0].close;
        const currency: string | null = result.meta?.currency || null;

        let firstValidIndex = -1;
        for (let i = 0; i < closes.length; i++) {
            if (closes[i] !== null && closes[i] !== undefined && (closes[i] as number) > 0) {
                firstValidIndex = i;
                break;
            }
        }

        if (firstValidIndex === -1) return null;

        const rawClose = closes[firstValidIndex] as number;
        const normalizedClose = normalizeYahooPrice(rawClose, currency, symbol);
        const startDate = new Date(timestamps[firstValidIndex] * 1000).toISOString();

        const closeData: HistoricalCloseData = {
            symbol,
            close: normalizedClose,
            startDate,
            currency
        };

        historicalCloseCache.set(cacheKey, { data: closeData, timestamp: Date.now() });
        return closeData;
    } catch (e) {
        console.warn(`[fetchHistoricalClose] Failed to fetch for ${symbol} (${range}):`, e);
        return null;
    }
}

/**
 * Batch fetch historical baseline close data for a list of symbols
 */
export async function fetchMultipleHistoricalCloses(
    symbols: string[],
    range: HistoricalRange
): Promise<Record<string, HistoricalCloseData>> {
    if (!symbols || symbols.length === 0) return {};
    const uniqueSymbols = Array.from(new Set(symbols.filter(Boolean)));
    const entries = await Promise.all(
        uniqueSymbols.map(async (sym) => {
            const data = await fetchHistoricalClose(sym, range);
            return [sym.toUpperCase(), data] as const;
        })
    );
    const result: Record<string, HistoricalCloseData> = {};
    for (const [sym, data] of entries) {
        if (data) result[sym] = data;
    }
    return result;
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
    open?: number | null,
    marketTime: Date | null,
    currency: string | null,
    error?: string
}> {
    try {
        let history = await fetchStockHistory(symbol, '1D');
        // Robust Fallback (Same as StockDetail): If 1D has no points (weekend, market closed, holiday), fall back to 1W
        if (history.error || !history.data || history.data.length === 0) {
            history = await fetchStockHistory(symbol, '1W');
        }

        if (history.error) return { price: null, previousClose: null, open: null, marketTime: null, currency: null, error: history.error };

        if (history.data && history.data.length > 0) {
            const lastPoint = history.data[history.data.length - 1];
            return {
                price: history.regularMarketPrice ?? lastPoint.value,
                previousClose: history.previousClose || null,
                open: history.open || history.data[0].value || null,
                marketTime: history.regularMarketTime ?? new Date(lastPoint.date),
                currency: history.currency || null
            };
        }
        return { price: null, previousClose: null, open: null, marketTime: null, currency: null, error: 'No chart data' };
    } catch (e) {
        return { price: null, previousClose: null, open: null, marketTime: null, currency: null, error: 'Network error' };
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
                open: precise.open || null,
                previousClose: precise.previousClose || null,
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
    currency?: string | null,
    open?: number,
    previousClose?: number,
    marketTime?: Date,
    marketState?: string | null,
    preMarketPrice?: number | null,
    preMarketChangePercent?: number | null,
    postMarketPrice?: number | null,
    postMarketChangePercent?: number | null,
    preMarketTime?: number | null,
    postMarketTime?: number | null,
    trailingPE?: number | null,
    forwardPE?: number | null,
    eps?: number | null,
    dividendYield?: number,
    longName?: string | null,
    shortName?: string | null,
    displayName?: string | null,
    isin?: string | null,
    kcv?: number | null,
    fiftyDayAverage?: number | null,
    twoHundredDayAverage?: number | null,
    fiftyTwoWeekHigh?: number | null,
    fiftyTwoWeekLow?: number | null,
    sector?: string | null
}>> {
    if (symbols.length === 0) return {};

    try {
        const symbolStr = symbols.join(',');
        const url = `/api/yahoo-quote?symbol=${symbolStr}&_=${Date.now()}`;
        let data: any = null;

        try {
            const response = await fetch(url);
            if (response.ok) {
                data = await response.json();
            }
        } catch {
            // Local proxy unavailable
        }

        // GitHub Pages / Static Hosting CORS fallback:
        if (!data || !data.quoteResponse?.result) {
            try {
                const targetUrl = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symbolStr)}&_=${Date.now()}`;
                const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}`;
                const fallbackRes = await fetch(proxyUrl);
                if (fallbackRes.ok) {
                    data = await fallbackRes.json();
                }
            } catch (fbErr) {
                console.warn('[Batch Quote Fallback Error]:', fbErr);
            }
        }

        const results = data?.quoteResponse?.result || [];

        const updateMap: Record<string, {
            price: number,
            currency?: string | null,
            open?: number,
            previousClose?: number,
            marketTime?: Date,
            marketState?: string | null,
    preMarketPrice?: number | null,
    preMarketChangePercent?: number | null,
    postMarketPrice?: number | null,
    postMarketChangePercent?: number | null,
    preMarketTime?: number | null,
    postMarketTime?: number | null,
            trailingPE?: number | null,
            forwardPE?: number | null,
            eps?: number | null,
            forwardEps?: number | null,
            epsSource?: string | null,
            growthRate?: number | null,
            dividendYield?: number,
            longName?: string | null,
            shortName?: string | null,
            displayName?: string | null,
            isin?: string | null,
            kcv?: number | null,
            fiftyDayAverage?: number | null,
            twoHundredDayAverage?: number | null,
            fiftyTwoWeekHigh?: number | null,
            fiftyTwoWeekLow?: number | null,
            sector?: string | null
        }> = {};

        results.forEach((res: any) => {
            if (res.symbol && res.regularMarketPrice) {
                const price = normalizeYahooPrice(res.regularMarketPrice, res.currency, res.symbol);
                const open = res.regularMarketOpen ? normalizeYahooPrice(res.regularMarketOpen, res.currency, res.symbol) : undefined;
                const previousClose = res.regularMarketPreviousClose ? normalizeYahooPrice(res.regularMarketPreviousClose, res.currency, res.symbol) : undefined;
                const extPrice = (v: any) => (typeof v === 'number' && v > 0) ? normalizeYahooPrice(v, res.currency, res.symbol) : null;
                const extPct = (p: any, ext: number | null) => (typeof p === 'number') ? p : ((ext && price) ? (ext / price - 1) * 100 : null);
                const preMarketPrice = extPrice(res.preMarketPrice);
                const postMarketPrice = extPrice(res.postMarketPrice);
                const extTime = (v: any): number | null => { if (typeof v === 'number') return v > 1e12 ? Math.floor(v / 1000) : v; if (typeof v === 'string') { const ms = Date.parse(v); return isNaN(ms) ? null : Math.floor(ms / 1000); } return null; };

                // Extraction helper for potential Yahoo objects {raw, fmt}
                const extractValue = (val: any) => (val && typeof val === 'object' && 'raw' in val) ? val.raw : val;

                let trailingPE = extractValue(res.trailingPE);
                const forwardPE = extractValue(res.forwardPE);
                let eps = extractValue(res.eps) ?? extractValue(res.epsTrailingTwelveMonths);
                const forwardEps = extractValue(res.forwardEps) ?? (price && forwardPE && forwardPE > 0 ? price / forwardPE : null);
                let epsSource: string | null = res.epsSource || 'TTM';

                // Smart EPS fallback if trailing EPS is missing, <= 0, or heavily distorted by one-time write-offs
                if (!eps || eps <= 0 || (forwardEps && forwardEps > 0 && eps < forwardEps * 0.4)) {
                    if (forwardEps && forwardEps > 0) {
                        eps = forwardEps;
                        epsSource = 'Forward / Bereinigt';
                    } else if (price && res.kcv && res.kcv > 0) {
                        eps = (price / res.kcv) * 0.75;
                        epsSource = 'Cashflow-Schätzung';
                    }
                }

                // Service-level fallback for PE calculation
                if (!trailingPE && price && eps && eps > 0) {
                    trailingPE = price / eps;
                }

                updateMap[res.symbol] = {
                    price,
                    currency: res.currency || null,
                    open,
                    previousClose,
                    marketTime: (() => {
                        const rt = res.regularMarketTime;
                        if (!rt) return undefined;
                        if (typeof rt === 'number') return new Date(rt > 1e12 ? rt : rt * 1000);
                        if (typeof rt === 'string') {
                            const d = new Date(rt);
                            return !isNaN(d.getTime()) ? d : undefined;
                        }
                        return undefined;
                    })(),
                    marketState: res.marketState || null,
                    preMarketPrice,
                    preMarketChangePercent: preMarketPrice ? extPct(res.preMarketChangePercent, preMarketPrice) : null,
                    postMarketPrice,
                    postMarketChangePercent: postMarketPrice ? extPct(res.postMarketChangePercent, postMarketPrice) : null,
                    preMarketTime: preMarketPrice ? extTime(res.preMarketTime) : null,
                    postMarketTime: postMarketPrice ? extTime(res.postMarketTime) : null,
                    trailingPE,
                    forwardPE,
                    eps,
                    forwardEps,
                    epsSource,
                    growthRate: extractValue(res.growthRate) ?? null,
                    dividendYield: (() => {
                        let dy = extractValue(res.dividendYield);
                        if (dy === undefined || dy === null || dy === 0) {
                            const ty = extractValue(res.trailingAnnualDividendYield);
                            const tr = extractValue(res.trailingAnnualDividendRate) ?? extractValue(res.dividendRate);
                            if (ty && ty > 0) {
                                dy = ty < 0.25 ? ty * 100 : ty;
                            } else if (tr && tr > 0 && price > 0) {
                                dy = (tr / price) * 100;
                            }
                        } else if (dy > 0 && dy < 0.1) {
                            dy = dy * 100;
                        }
                        return dy ? parseFloat(Number(dy).toFixed(2)) : undefined;
                    })(),
                    longName: res.longName || null,
                    shortName: res.shortName || null,
                    displayName: res.displayName || null,
                    isin: res.isin || null,
                    kcv: res.kcv || null,
                    fiftyDayAverage: res.fiftyDayAverage ? normalizeYahooPrice(extractValue(res.fiftyDayAverage), res.currency, res.symbol) : null,
                    twoHundredDayAverage: res.twoHundredDayAverage ? normalizeYahooPrice(extractValue(res.twoHundredDayAverage), res.currency, res.symbol) : null,
                    fiftyTwoWeekHigh: res.fiftyTwoWeekHigh ? normalizeYahooPrice(extractValue(res.fiftyTwoWeekHigh), res.currency, res.symbol) : null,
                    fiftyTwoWeekLow: res.fiftyTwoWeekLow ? normalizeYahooPrice(extractValue(res.fiftyTwoWeekLow), res.currency, res.symbol) : null,
                    sector: translateSector(res.sector, res.industry) || null
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
    forwardEps?: number | null,
    epsSource?: string | null,
    growthRate?: number | null,
    dividendYield: number | null,
    country: string | null,
    marketState?: string | null,
    preMarketPrice?: number | null,
    preMarketChangePercent?: number | null,
    postMarketPrice?: number | null,
    postMarketChangePercent?: number | null,
    preMarketTime?: number | null,
    postMarketTime?: number | null,
    open?: number | null,
    previousClose?: number | null,
    sectorWeights?: { [key: string]: number } | null,
    countryWeights?: { [key: string]: number } | null,
    sector?: string | null,
    name?: string | null,
    isin?: string | null,
    exDividendDate?: Date | null,
    kcv?: number | null,
    fiftyDayAverage?: number | null,
    twoHundredDayAverage?: number | null,
    fiftyTwoWeekHigh?: number | null,
    fiftyTwoWeekLow?: number | null,
    error?: string
}> {
    try {
        console.log(`[YahooService] Fetching Single Quote for ${symbol} using Batch Wrapper...`);

        // 1. Try Batch Path (Proven working for Watchlist)
        const batchMap = await fetchStockQuotes([symbol]);
        const batchResult = batchMap[symbol];

        if (batchResult && batchResult.price) {
            let country = MANUAL_COUNTRY_OVERRIDES[symbol] || resolveStockCountry({
                symbol,
                isin: batchResult.isin || undefined,
                currency: (batchResult as any).currency || undefined,
                name: (batchResult.longName || batchResult.shortName) || undefined
            }) || null;

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
                forwardEps: (batchResult as any).forwardEps || null,
                epsSource: (batchResult as any).epsSource || null,
                growthRate: (batchResult as any).growthRate ?? null,
                dividendYield: (batchResult as any).dividendYield || null,
                country: country,
                marketState: batchResult.marketState || null,
                preMarketPrice: batchResult.preMarketPrice ?? null,
                preMarketChangePercent: batchResult.preMarketChangePercent ?? null,
                postMarketPrice: batchResult.postMarketPrice ?? null,
                postMarketChangePercent: batchResult.postMarketChangePercent ?? null,
                preMarketTime: batchResult.preMarketTime ?? null,
                postMarketTime: batchResult.postMarketTime ?? null,
                open: (batchResult as any).open || null,
                previousClose: batchResult.previousClose || null,
                sectorWeights: sectorWeights,
                countryWeights: countryWeights,
                sector: (batchResult as any).sector || resolveStockSector({
                    symbol,
                    name: (batchResult.longName || batchResult.shortName) || undefined
                }) || null,
                name: batchResult.longName || batchResult.shortName || batchResult.displayName || initialName || symbol,
                isin: batchResult.isin || null,
                exDividendDate: (batchResult as any).exDividendDate ? new Date((batchResult as any).exDividendDate * 1000) : null,
                kcv: batchResult.kcv || null,
                fiftyDayAverage: (batchResult as any).fiftyDayAverage || null,
                twoHundredDayAverage: (batchResult as any).twoHundredDayAverage || null,
                fiftyTwoWeekHigh: (batchResult as any).fiftyTwoWeekHigh || null,
                fiftyTwoWeekLow: (batchResult as any).fiftyTwoWeekLow || null,
                error: undefined
            };
        }

        // 2. If Batch failed (empty), try explicit Fallback logic (Chart Proxy)
        console.warn("[YahooService] Batch Wrapper returned no data. Triggering Fallback.");
        const fb = await executeFallback(symbol);
        if (fb) return fb;

        return {
            price: null, currency: null, marketTime: null, trailingPE: null, forwardPE: null, eps: null, dividendYield: null, country: null, error: 'Keine Daten', open: null, previousClose: null, kcv: null
        };

    } catch (error) {
        console.error("Yahoo Quote Wrapper Error:", error);

        const fb = await executeFallback(symbol);
        if (fb) return fb;

        return {
            price: null, currency: null, marketTime: null, trailingPE: null, forwardPE: null, eps: null, dividendYield: null, country: null, error: 'Netzwerkfehler', kcv: null
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
export interface DivEvent {
    date: string;
    amount: number;
}

export interface MonthlySeasonality {
    month: number;         // 0 = Jan, 11 = Dec
    avgReturn: number;     // Average monthly return in %
    medianReturn: number;  // Median monthly return in %
    positiveRate: number;  // How often was this month positive (0-1)
    count: number;         // Number of data points
    returns: number[];     // All individual monthly returns
    divEvents: DivEvent[]; // Historical dividends in this month
}

/**
 * Fetch and compute seasonality data for a stock symbol.
 * Uses daily chart data fetched via the existing Yahoo Finance proxy.
 */
export async function fetchSeasonalityData(
    symbol: string,
    years: number = 10,
    specificYear?: number
): Promise<{ data: MonthlySeasonality[] | null; startYear?: number; endYear?: number; error?: string }> {
    try {
        const now = new Date();
        const currentYear = now.getUTCFullYear();

        // If specificYear is set, we need to fetch enough data to cover it
        let period = `${years}y`;
        if (specificYear) {
            const yDiff = currentYear - specificYear;
            // Fetch at least 20 years or enough to cover the specific year + some buffer
            const neededYears = Math.max(20, yDiff + 2);
            period = `${neededYears}y`;
        }

        const url = `/api/yahoo-finance?symbol=${symbol}&period=${period}&interval=1mo&events=div&_=${Date.now()}`;
        const divUrl = `/api/yahoo-dividends?symbol=${symbol}&period=${period}&_=${Date.now()}`;

        const [response, divResponse] = await Promise.all([
            fetch(url),
            fetch(divUrl).catch(() => null)
        ]);

        if (!response.ok) return { data: null, error: `API Fehler: ${response.status}` };

        const [raw, divRaw] = await Promise.all([
            response.json(),
            divResponse && divResponse.ok ? divResponse.json().catch(() => null) : null
        ]);

        if (raw.chart?.error) return { data: null, error: `Yahoo Finance: ${raw.chart.error.description}` };

        const result = raw.chart?.result?.[0];
        const dividendsFromApi = Array.isArray(divRaw?.dividends) ? divRaw.dividends : [];
        const fallbackDividends = result.events?.dividends ? Object.values(result.events.dividends) : [];

        console.log(`[Seasonality] API Divs: ${dividendsFromApi.length}, Fallback Divs: ${fallbackDividends.length}`);

        const combinedDividends = dividendsFromApi.length > 0 ? dividendsFromApi : fallbackDividends;

        if (!result?.timestamp || !result?.indicators?.adjclose?.[0]?.adjclose) {
            // Try regular close as fallback
            if (!result?.timestamp || !result?.indicators?.quote?.[0]?.close) {
                return { data: null, error: 'Keine historischen Daten verfügbar' };
            }
        }

        const timestamps: number[] = [...result.timestamp];
        const closes: (number | null)[] = [
            ...(result.indicators?.adjclose?.[0]?.adjclose || result.indicators?.quote?.[0]?.close)
        ];

        const currency: string | null = result.meta?.currency || null;

        // Helper to safely get the calendar year and month of a monthly bar:
        // Yahoo Finance monthly bars are keyed to the 1st of each month at local exchange midnight.
        // In timezones east of UTC (e.g. UK in BST: UTC+1, Central Europe in CEST: UTC+2),
        // local midnight is 22:00 or 23:00 on the last day of the previous month in UTC.
        // Adding 12 hours (43200 seconds) safely shifts any UTC offset (-12h to +14h)
        // right onto the 1st day of the intended month in UTC!
        const getMonthlyBarDate = (timestampSec: number) => {
            const d = new Date((timestampSec + 43200) * 1000);
            return {
                year: d.getUTCFullYear(),
                month: d.getUTCMonth() // 0 = Jan .. 11 = Dec
            };
        };

        // Group raw bars by calendar month to eliminate duplicate intra-month bars
        // (Yahoo often returns both the 1st-of-month bar and a live/latest bar for the current month)
        const monthlyBarMap = new Map<string, { year: number; month: number; timestamp: number; close: number }>();

        for (let i = 0; i < timestamps.length; i++) {
            const rawClose = closes[i];
            if (rawClose == null || rawClose === 0) continue;

            const { year, month } = getMonthlyBarDate(timestamps[i]);
            const key = `${year}-${String(month).padStart(2, '0')}`;
            const normalizedClose = normalizeYahooPrice(rawClose, currency, symbol);

            // Latest timestamp in that month wins
            monthlyBarMap.set(key, {
                year,
                month,
                timestamp: timestamps[i],
                close: normalizedClose
            });
        }

        // Fetch precise live price to update the running current month if available
        try {
            const live = await fetchStockPricePrecise(symbol);
            if (live.price && live.marketTime) {
                const liveTs = Math.floor(live.marketTime.getTime() / 1000);
                const { year, month } = getMonthlyBarDate(liveTs);
                const key = `${year}-${String(month).padStart(2, '0')}`;
                const normalizedLive = normalizeYahooPrice(live.price, currency, symbol);
                monthlyBarMap.set(key, {
                    year,
                    month,
                    timestamp: liveTs,
                    close: normalizedLive
                });
            }
        } catch (e) {
            console.warn("[Seasonality] Live price fetch failed, proceeding with history only.");
        }

        // Sort chronologically
        const sortedBars = Array.from(monthlyBarMap.values()).sort(
            (a, b) => (a.year * 12 + a.month) - (b.year * 12 + b.month)
        );

        // Build month → returns map
        const monthlyReturns: Map<number, number[]> = new Map();
        const monthlyDividends: Map<number, DivEvent[]> = new Map();
        for (let m = 0; m < 12; m++) {
            monthlyReturns.set(m, []);
            monthlyDividends.set(m, []);
        }

        const startYearFilter = specificYear || (currentYear - (years - 1));

        // Parse Dividends (from dedicated dividends endpoint or fallback)
        if (Array.isArray(combinedDividends)) {
            combinedDividends.forEach((div: any) => {
                if (!div.date) return;

                // Robust date parsing (handle number/seconds, number/ms, or ISO string)
                let tsSec: number;
                if (typeof div.date === 'number') {
                    tsSec = div.date > 2100000000 ? Math.floor(div.date / 1000) : div.date;
                } else {
                    tsSec = Math.floor(new Date(div.date).getTime() / 1000);
                }

                if (isNaN(tsSec)) return;

                const { year, month } = getMonthlyBarDate(tsSec);

                // Filter dividends by year
                if (specificYear && year !== specificYear) return;
                if (!specificYear && year < startYearFilter) return;

                const divDate = new Date((tsSec + 43200) * 1000);
                monthlyDividends.get(month)!.push({
                    date: divDate.toISOString(),
                    amount: div.amount || div.dividends || 0
                });
            });
        }

        console.log(`[Seasonality] Parsed Dividends: ${[...monthlyDividends.values()].flat().length} events across 12 months.`);

        // 2. Supplement with Upcoming Dividend if current year
        if (specificYear === currentYear || !specificYear) {
            try {
                const quote = await fetchStockQuote(symbol);
                if (quote.exDividendDate) {
                    const tsSec = Math.floor(quote.exDividendDate.getTime() / 1000);
                    const { year, month } = getMonthlyBarDate(tsSec);

                    if (year === currentYear) {
                        const hasThisMonth = monthlyDividends.get(month)?.some(d => {
                            const dDate = new Date(d.date);
                            const { year: dYear } = getMonthlyBarDate(Math.floor(dDate.getTime() / 1000));
                            return dYear === year;
                        });

                        if (!hasThisMonth) {
                            monthlyDividends.get(month)?.push({
                                date: quote.exDividendDate.toISOString(),
                                amount: 0
                            });
                        }
                    }
                }
            } catch (e) {
                console.warn("[Seasonality] Quote ex-div fetch failed");
            }
        }

        let minYearFound = Infinity;
        let maxYearFound = -Infinity;

        // Compute consecutive month-over-month return
        for (let i = 1; i < sortedBars.length; i++) {
            const prev = sortedBars[i - 1];
            const curr = sortedBars[i];

            // Verify they are consecutive months (diff in months === 1)
            const monthDiff = (curr.year * 12 + curr.month) - (prev.year * 12 + prev.month);
            if (monthDiff !== 1) continue;

            const year = curr.year;
            const month = curr.month; // 0 = Jan .. 11 = Dec

            // Filter logic
            if (specificYear) {
                if (year !== specificYear) continue;
            } else {
                if (year < startYearFilter) continue;
            }

            const monthReturn = ((curr.close - prev.close) / prev.close) * 100;
            monthlyReturns.get(month)!.push(monthReturn);

            if (year < minYearFound) minYearFound = year;
            if (year > maxYearFound) maxYearFound = year;
        }

        // Compute stats per month
        const data: MonthlySeasonality[] = Array.from({ length: 12 }, (_, m) => {
            const returns = monthlyReturns.get(m) || [];
            const divEvents = monthlyDividends.get(m) || [];
            if (returns.length === 0) {
                return { month: m, avgReturn: 0, medianReturn: 0, positiveRate: 0, count: 0, returns: [], divEvents };
            }

            const sorted = [...returns].sort((a, b) => a - b);
            const avg = returns.reduce((s, v) => s + v, 0) / returns.length;
            const median = sorted.length % 2 === 0
                ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
                : sorted[Math.floor(sorted.length / 2)];
            const positiveRate = returns.filter(r => r > 0).length / returns.length;

            return { month: m, avgReturn: avg, medianReturn: median, positiveRate, count: returns.length, returns, divEvents };
        });

        return {
            data,
            startYear: minYearFound === Infinity ? undefined : minYearFound,
            endYear: maxYearFound === -Infinity ? undefined : maxYearFound
        };
    } catch (e) {
        console.error('[Seasonality] Error:', e);
        return { data: null, error: 'Netzwerkfehler beim Laden der Saisonalitätsdaten.' };
    }
}

// Helper to fetch advanced Analysis (Growth estimates, Valuation)
export async function fetchStockAnalysis(symbol: string): Promise<{
    growthRate: number | null,
    peHistory: number | null,
    forwardPE: number | null,
    pegRatio: number | null,
    eps: number | null,
    price: number | null,
    currency: string | null,
    kcv: number | null
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
        const url = `/api/yahoo-quote-summary?symbol=${symbol}&modules=earningsTrend,defaultKeyStatistics,financialData,summaryDetail`;
        console.log('[Yahoo Finance] Fetching Analysis for:', symbol);

        const response = await fetch(url);

        // If Summary fails, but we have Robust Price, return that!
        if (!response.ok) {
            return {
                growthRate: null, peHistory: null, forwardPE: null, pegRatio: null,
                eps: null,
                price: robustPriceData?.price || null,
                currency: robustPriceData?.currency || null,
                kcv: null
            };
        }

        const data = await response.json();
        const result = data.quoteSummary?.result?.[0];

        if (!result) {
            return {
                growthRate: null, peHistory: null, forwardPE: null, pegRatio: null,
                eps: null,
                price: robustPriceData?.price || null,
                currency: robustPriceData?.currency || null,
                kcv: null
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

        // Calculate KCV
        let kcv: number | null = null;
        const operatingCashflow = result.financialData?.operatingCashflow?.raw;
        const marketCap = result.summaryDetail?.marketCap?.raw;
        if (operatingCashflow && marketCap && operatingCashflow > 0) {
            kcv = marketCap / operatingCashflow;
        }

        return {
            growthRate,
            peHistory,
            forwardPE,
            pegRatio,
            eps,
            price,
            currency,
            kcv
        };
    } catch (e) {
        console.warn("[Yahoo Analysis] Failed:", e);
        // Return Robust Price on error
        return {
            growthRate: null, peHistory: null, forwardPE: null, pegRatio: null,
            eps: null,
            price: robustPriceData?.price || null,
            currency: robustPriceData?.currency || null,
            kcv: null
        };
    }
}
