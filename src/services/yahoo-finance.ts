
import { FALLBACK_ALLOCATIONS } from '../data/fallbackAllocations';
import { resolveStockCountry, resolveStockSector } from '../utils/stockMetadata';
import { translateSector } from '../utils/sectorTranslation';
import { fetchDivvyDiaryDividends, getDivvyDiaryApiKey } from './divvydiary';

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

        const fetchChartJson = async (sym: string, reqPeriod: string, reqInterval: string, prePostParam: string): Promise<any> => {
            const encodedSym = encodeURIComponent(sym);
            const url = `/api/yahoo-finance?symbol=${encodedSym}&period=${reqPeriod}&interval=${reqInterval}${prePostParam}&_=${Date.now()}`;
            let json: any = null;

            try {
                const response = await fetch(url);
                if (response.ok) {
                    json = await response.json();
                }
            } catch {
                // Local proxy unavailable (e.g. GitHub Pages)
            }

            // Fallback for GitHub Pages / static hosting:
            if (!json || !json.chart?.result?.[0]) {
                try {
                    const targetUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodedSym}?range=${reqPeriod}&interval=${reqInterval}${prePostParam}&_=${Date.now()}`;
                    const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}`;
                    const fallbackRes = await fetch(proxyUrl);
                    if (fallbackRes.ok) {
                        json = await fallbackRes.json();
                    }
                } catch (fbErr) {
                    console.warn('[Yahoo Finance Fallback Proxy Error]:', fbErr);
                }
            }

            return json;
        };

        const countValidCandles = (res: any): number => {
            const ts: number[] | undefined = res?.timestamp;
            const cls: (number | null | undefined)[] | undefined = res?.indicators?.quote?.[0]?.close;
            if (!ts || !cls || ts.length === 0) return 0;
            let count = 0;
            for (let i = 0; i < ts.length; i++) {
                if (cls[i] !== null && cls[i] !== undefined && Number.isFinite(cls[i])) {
                    count++;
                }
            }
            return count;
        };

        console.log('[Yahoo Finance Proxy] Fetching:', symbol, 'Period:', period, 'Interval:', interval);
        let data: any = await fetchChartJson(symbol, period, interval, includePrePostParam);

        if (!data) return { data: null, error: `Keine Daten verfügbar` };
        if (data.chart?.error) return { data: null, error: `Yahoo Finance: ${data.chart.error.description}` };

        let result = data.chart?.result?.[0];
        let slicedFromMultiDay = false;

        // Weekend / between-session fallback for 1D (especially CME futures like ES=F, NQ=F):
        // Yahoo often returns empty timestamps on range=1d over weekends. Fetch 5d intraday and slice the last trading day.
        if (range === '1D' && countValidCandles(result) < 2) {
            const fallback5d = await fetchChartJson(symbol, '5d', '5m', includePrePostParam);
            let fbResult = fallback5d?.chart?.result?.[0];
            if (countValidCandles(fbResult) < 2) {
                const fallback5d15m = await fetchChartJson(symbol, '5d', '15m', includePrePostParam);
                fbResult = fallback5d15m?.chart?.result?.[0];
            }
            if (countValidCandles(fbResult) >= 2) {
                // Preserve 1d meta previousClose if available, otherwise keep 5d meta
                const prevClose1d = result?.meta?.regularMarketPreviousClose || result?.meta?.chartPreviousClose || result?.meta?.previousClose;
                result = {
                    ...fbResult,
                    meta: {
                        ...fbResult.meta,
                        ...(prevClose1d ? { regularMarketPreviousClose: prevClose1d, chartPreviousClose: prevClose1d } : {})
                    }
                };
                slicedFromMultiDay = true;
            }
        }

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
                    const fData = await fetchChartJson(frankfurtSymbol, period, interval, includePrePostParam);
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
                        slicedFromMultiDay = false;
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

        let points: ChartDataPoint[] = timestamps
            .map((timestamp: number, index: number) => {
                const close = closes[index];
                if (close === null || close === undefined) return null;
                let session: 'pre' | 'regular' | 'post' | undefined;
                if (range === '1D' && options?.includePrePost && tp?.regular && !slicedFromMultiDay) {
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

        // If 1D fell back to 5d intraday (e.g. ES=F / NQ=F on weekends), keep only the last trading day's session
        if (slicedFromMultiDay && points.length > 0) {
            const lastDateObj = new Date(points[points.length - 1].date);
            const lastDayStr = lastDateObj.toDateString();
            const sameDayPoints = points.filter(p => new Date(p.date).toDateString() === lastDayStr);
            if (sameDayPoints.length >= 6) {
                points = sameDayPoints;
            } else {
                const cutoffMs = lastDateObj.getTime() - 24 * 60 * 60 * 1000;
                points = points.filter(p => new Date(p.date).getTime() >= cutoffMs);
            }
        }

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

        // If regularMarketTime is from today and slightly newer (1–30 min) than the last 5m candle, append the live point.
        // Cap at 30 min so late off-book settlement prints (e.g. LSE 19:05 after 17:30 close) never create a fake 90-min gap!
        if (range === '1D' && normalizedRegPrice && normalizedRegTime && points.length > 0) {
            const lastPointTime = new Date(points[points.length - 1].date).getTime();
            const isSameDay = new Date(points[points.length - 1].date).toDateString() === normalizedRegTime.toDateString();
            const deltaMs = normalizedRegTime.getTime() - lastPointTime;
            if (isSameDay && deltaMs > 60 * 1000 && deltaMs <= 30 * 60 * 1000) {
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
        '1W': { period: '5d', interval: '15m' },
        '1M': { period: '1mo', interval: '15m' },
        '3M': { period: '3mo', interval: '1d' },
        '6M': { period: '6mo', interval: '1d' },
        '1Y': { period: '1y', interval: '1d' },
        '3Y': { period: '3y', interval: '1d' },
        '5Y': { period: '5y', interval: '1wk' }
    };

    const { period, interval } = rangeParamMap[range] || { period: '5d', interval: '15m' };

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
                const targetUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${period}&interval=${interval}&_=${Date.now()}`;
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
    exDividendDate?: number | null,
    dividendPayDate?: number | null,
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
            exDividendDate?: number | null,
            dividendPayDate?: number | null,
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
                    exDividendDate: res.exDividendDate ?? null,
                    dividendPayDate: res.dividendPayDate ?? null,
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
    dividendPayDate?: Date | null,
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
                dividendPayDate: (batchResult as any).dividendPayDate ? new Date((batchResult as any).dividendPayDate * 1000) : null,
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

export type DividendScheduleFrequency = 'annually' | 'semi-annually' | 'quarterly' | 'monthly';
export type DividendSlotSource = 'official' | 'history' | 'projected' | 'paid';

export interface SmartDividendSlot {
    exDate: string;
    payDate: string;
    extraPayDates?: string[];
    source: DividendSlotSource;
    amount?: number;
}

export interface SmartDividendHistoryItem {
    exDate: string;
    amount: number;
    isLikelySpecial?: boolean;
}

export interface SmartDividendScheduleResult {
    symbol: string;
    provider: 'divvydiary' | 'yahoo';
    resolvedIsin?: string | null;
    divvyDiaryHint?: string;
    frequency: DividendScheduleFrequency;
    slots: SmartDividendSlot[];
    recentHistory: SmartDividendHistoryItem[];
    currency?: string | null;
    hasSpecialDividendHint: boolean;
    officialCount: number;
    projectedCount: number;
    historyCount: number;
    payOffsetDays: number;
    payOffsetSource: 'official' | 'learned' | 'market';
    error?: string;
}

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function parseIsoUtcMs(iso: string): number | null {
    if (!ISO_DATE_RE.test(iso)) return null;
    const [y, m, d] = iso.split('-').map(Number);
    if (!y || !m || !d) return null;
    return Date.UTC(y, m - 1, d);
}

function formatUtcMsToIso(ms: number): string {
    const dt = new Date(ms);
    const y = dt.getUTCFullYear();
    const m = String(dt.getUTCMonth() + 1).padStart(2, '0');
    const d = String(dt.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function getTodayIsoLocal(): string {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function diffCalendarDaysIso(startIso: string, endIso: string): number | null {
    const a = parseIsoUtcMs(startIso);
    const b = parseIsoUtcMs(endIso);
    if (a === null || b === null) return null;
    return Math.round((b - a) / 86400000);
}

function snapUtcMsToWeekday(ms: number): number {
    const day = new Date(ms).getUTCDay();
    if (day === 6) return ms + 2 * 86400000; // Saturday -> Monday
    if (day === 0) return ms + 1 * 86400000; // Sunday -> Monday
    return ms;
}

function addCalendarDaysWeekdayIso(iso: string, days: number): string {
    const base = parseIsoUtcMs(iso);
    if (base === null) return iso;
    return formatUtcMsToIso(snapUtcMsToWeekday(base + days * 86400000));
}

function addTradingDaysIso(iso: string, tradingDays: number): string {
    const base = parseIsoUtcMs(iso);
    if (base === null) return iso;
    let cur = base;
    let added = 0;
    while (added < tradingDays) {
        cur += 86400000;
        const dow = new Date(cur).getUTCDay();
        if (dow !== 0 && dow !== 6) {
            added++;
        }
    }
    return formatUtcMsToIso(cur);
}

function shiftDateMonthsWeekdayIso(iso: string, monthsDelta: number): string {
    const base = parseIsoUtcMs(iso);
    if (base === null) return iso;
    const dt = new Date(base);
    const origDay = dt.getUTCDate();
    const targetMonthIndex = dt.getUTCMonth() + monthsDelta;
    const targetYear = dt.getUTCFullYear() + Math.floor(targetMonthIndex / 12);
    const normalizedMonth = ((targetMonthIndex % 12) + 12) % 12;
    const lastDayOfTargetMonth = new Date(Date.UTC(targetYear, normalizedMonth + 1, 0)).getUTCDate();
    const clampedDay = Math.min(origDay, lastDayOfTargetMonth);
    const targetMs = Date.UTC(targetYear, normalizedMonth, clampedDay);
    return formatUtcMsToIso(snapUtcMsToWeekday(targetMs));
}

function calendarPositionKey(iso: string): number {
    const ms = parseIsoUtcMs(iso);
    if (ms === null) return 9999;
    const dt = new Date(ms);
    return (dt.getUTCMonth() + 1) * 31 + dt.getUTCDate();
}

function dayOfYearUtc(iso: string): number | null {
    const ms = parseIsoUtcMs(iso);
    if (ms === null) return null;
    const dt = new Date(ms);
    const startOfYear = Date.UTC(dt.getUTCFullYear(), 0, 1);
    return Math.floor((ms - startOfYear) / 86400000) + 1;
}

function circularDayOfYearDistance(isoA: string, isoB: string): number {
    const a = dayOfYearUtc(isoA);
    const b = dayOfYearUtc(isoB);
    if (a === null || b === null) return 999;
    const raw = Math.abs(a - b);
    return Math.min(raw, 365 - raw);
}

/**
 * 3-Stufen-Automatik für Dividenden-Termine:
 * 1) Offizielle Yahoo-Termine (calendarEvents: exDividendDate & dividendPayDate)
 * 2) 2-Jahres-Dividendenhistorie (events=div) + automatische Frequenz- & Zahltag-Offset-Logik
 * 3) Intelligente Fortschreibung vergangener Termine aufs nächste Jahr / den nächsten Monat (Mo–Fr)
 */
// Curated Symbol -> ISIN map for instant DivvyDiary resolution when Yahoo omits ISIN (common for US/UK tickers)
const KNOWN_SYMBOL_ISINS: Record<string, string> = {
    // US Dividend & Value Stocks
    'MO': 'US02209S1033',
    'PM': 'US7181721090',
    'PEP': 'US7134481081',
    'KO': 'US1912161007',
    'GIS': 'US3703341046',
    'PG': 'US7427181091',
    'JNJ': 'US4781601046',
    'ABBV': 'US00287Y1091',
    'MCD': 'US5801351017',
    'WMT': 'US9311421039',
    'O': 'US7561091049',
    'MAIN': 'US56035L1044',
    'VICI': 'US9256521090',
    'CVX': 'US1667641005',
    'XOM': 'US30231G1022',
    'COP': 'US20825C1045',
    'PBR': 'US71654V4086',
    'PBR-A': 'US71654V1017',
    'BRK-B': 'US0846707026',
    'JPM': 'US46625H1005',
    'BAC': 'US0605051046',
    'V': 'US92826C8394',
    'MA': 'US57636Q1040',
    'HD': 'US4370761029',
    'UNH': 'US91324P1021',
    'MRK': 'US58933Y1055',
    'PFE': 'US7170811035',
    'T': 'US00206R1023',
    'VZ': 'US92343V1044',
    'IBM': 'US4592001014',
    'CSCO': 'US17275R1023',
    'TXN': 'US8825081040',
    'AVGO': 'US11135F1012',
    // US Tech / Magnificent 7
    'NVDA': 'US67066G1040',
    'AAPL': 'US0378331005',
    'MSFT': 'US5949181045',
    'GOOG': 'US02079K1079',
    'GOOGL': 'US02079K3059',
    'AMZN': 'US0231351067',
    'META': 'US30303M1027',
    'TSLA': 'US88160R1014',
    'AMD': 'US0079031078',
    'NFLX': 'US64110L1061',
    'ORCL': 'US68389X1054',
    'COST': 'US22160K1051',
    // Switzerland (.SW)
    'NESN.SW': 'CH0038863350',
    'NOVN.SW': 'CH0012005267',
    'ROG.SW': 'CH0012032048',
    'ZURN.SW': 'CH0011075394',
    'SREN.SW': 'CH0126881561',
    'UBSG.SW': 'CH0244767585',
    'ABBN.SW': 'CH0012221716',
    'HOLN.SW': 'CH0012214059',
    'SIKA.SW': 'CH0418792922',
    'GIVN.SW': 'CH0010645932',
    'LONN.SW': 'CH0013841017',
    'SCMN.SW': 'CH0008742519',
    'SLHN.SW': 'CH0014852781',
    'HELN.SW': 'CH0466642201',
    'PGHN.SW': 'CH0024608827',
    'GEBN.SW': 'CH0030170408',
    // UK & Europe
    'BATS.L': 'GB0002875804',
    'BTI': 'US1104481072',
    'RIO.L': 'GB0007188757',
    'RIO': 'US7672041008',
    'BP.L': 'GB0007980591',
    'SHEL': 'GB00BP6MXD84',
    'SHEL.L': 'GB00BP6MXD84',
    'R6C0.DE': 'GB00BP6MXD84',
    'TTE.PA': 'FR0000120271',
    'ABEA.DE': 'US02079K3059',
    'ALV.DE': 'DE0008404005',
    'MUV2.DE': 'DE0008430026',
    'SIE.DE': 'DE0007236101',
    'SAP.DE': 'DE0007164600',
    'BAS.DE': 'DE000BASF111',
    'DTE.DE': 'DE0005557508',
    // Popular UCITS ETFs
    'VHYL.SW': 'IE00B8GKDB10',
    'VHYL.AS': 'IE00B8GKDB10',
    'VHYL.L': 'IE00B8GKDB10',
    'VWRA.L': 'IE00BK5BQT80',
    'VWRA.SW': 'IE00BK5BQT80',
    'VWCE.DE': 'IE00BK5BQT80',
    'VWRL.SW': 'IE00B3RBWM25',
    'CSNDX.SW': 'IE00B53SZB19',
    'SXRV.DE': 'IE00B53SZB19',
    'EQQQ.SW': 'IE0032077012',
    'EQQQ.DE': 'IE0032077012',
    'SWDA.SW': 'IE00B4L5Y983',
    'VUSA.SW': 'IE00B3XXRP09',
    'TDIV.SW': 'NL0011683594',
    'FUSD.SW': 'IE00BYXVGX24',
    'WINC.AS': 'IE000KJPDY61',
};

export function resolveKnownIsin(symbol?: string | null): string | null {
    const clean = (symbol || '').trim().toUpperCase();
    if (!clean) return null;
    return KNOWN_SYMBOL_ISINS[clean] || null;
}

export async function fetchSmartDividendSchedule(
    symbol: string,
    options?: {
        isin?: string;
        isEtf?: boolean;
        currentFrequency?: string;
        forceFrequency?: DividendScheduleFrequency;
        existingDates?: { exDate?: string; payDate?: string }[];
    }
): Promise<SmartDividendScheduleResult> {
    const cleanSym = (symbol || '').trim();
    const initialIsin = (options?.isin || '').trim().toUpperCase() || resolveKnownIsin(cleanSym) || '';
    const fallbackFreq: DividendScheduleFrequency =
        options?.currentFrequency === 'monthly' ||
        options?.currentFrequency === 'quarterly' ||
        options?.currentFrequency === 'semi-annually' ||
        options?.currentFrequency === 'annually'
            ? options.currentFrequency
            : 'quarterly';

    if (!cleanSym && !initialIsin) {
        return {
            symbol: cleanSym,
            provider: 'yahoo',
            resolvedIsin: null,
            frequency: fallbackFreq,
            slots: [],
            recentHistory: [],
            currency: null,
            hasSpecialDividendHint: false,
            officialCount: 0,
            projectedCount: 0,
            historyCount: 0,
            payOffsetDays: 21,
            payOffsetSource: 'market',
            error: 'Kein Symbol oder ISIN angegeben'
        };
    }

    const todayIso = getTodayIsoLocal();
    const todayMs = parseIsoUtcMs(todayIso) ?? Date.now();
    const currentYear = Number(todayIso.slice(0, 4));

    const isSlotStillActive = (payIso: string): boolean => {
        const payMs = parseIsoUtcMs(payIso);
        if (payMs === null) return false;
        return (payMs + 7 * 86400000) > todayMs;
    };

    // Helper: Build schedule directly from DivvyDiary data (exact Ex-Date + exact Pay-Date + forecast flag)
    const buildFromDivvyDiary = (
        dd: NonNullable<Awaited<ReturnType<typeof fetchDivvyDiaryDividends>>>
    ): SmartDividendScheduleResult | null => {
        if (!dd || dd.error || dd.dividends.length === 0) return null;

        // Cluster split tranches sharing the same Ex-Date (<= 5 days apart, e.g. Petrobras 2 half-tranches)
        const clustered: { exDate: string; payDate: string; payDates: string[]; amount: number; forecast: boolean }[] = [];
        for (const item of dd.dividends) {
            const last = clustered[clustered.length - 1];
            const itemPay = item.payDate || item.exDate;
            if (last) {
                const diff = diffCalendarDaysIso(last.exDate, item.exDate);
                if (diff !== null && Math.abs(diff) <= 5) {
                    last.amount += item.amount;
                    if (itemPay && !last.payDates.includes(itemPay)) {
                        last.payDates.push(itemPay);
                        last.payDates.sort();
                        last.payDate = last.payDates[0];
                    }
                    last.forecast = last.forecast && item.forecast;
                    continue;
                }
            }
            clustered.push({
                exDate: item.exDate,
                payDate: itemPay,
                payDates: itemPay ? [itemPay] : [],
                amount: item.amount,
                forecast: item.forecast
            });
        }

        // Keep window of last 3.5 years + upcoming 15 months
        const minMs = todayMs - 1280 * 86400000;
        const maxMs = todayMs + 460 * 86400000;
        const windowed = clustered.filter(ev => {
            const ms = parseIsoUtcMs(ev.exDate);
            return ms !== null && ms >= minMs && ms <= maxMs;
        });
        if (windowed.length === 0) return null;

        // Frequency: forced -> DivvyDiary field -> trailing 12m count
        let freq: DividendScheduleFrequency = options?.forceFrequency || fallbackFreq;
        if (!options?.forceFrequency) {
            if (
                dd.dividendFrequency === 'monthly' ||
                dd.dividendFrequency === 'quarterly' ||
                dd.dividendFrequency === 'semi-annually' ||
                dd.dividendFrequency === 'annually'
            ) {
                freq = dd.dividendFrequency;
            } else {
                const oneYearAgo = todayMs - 375 * 86400000;
                const realRecent = windowed.filter(e => {
                    const ms = parseIsoUtcMs(e.exDate);
                    return ms !== null && ms >= oneYearAgo && ms <= todayMs + 30 * 86400000;
                });
                const c = realRecent.length;
                if (c >= 9) freq = 'monthly';
                else if (c >= 3) freq = 'quarterly';
                else if (c === 2) freq = 'semi-annually';
                else if (c === 1) freq = 'annually';
            }
        }

        // Real history for transparent info chips & special-dividend detection
        const pastOrConfirmed = windowed.filter(e => !e.forecast || (parseIsoUtcMs(e.exDate) ?? 0) <= todayMs);
        const posAmounts = pastOrConfirmed.map(e => e.amount).filter(a => a > 0).sort((a, b) => a - b);
        const med = posAmounts.length > 0 ? posAmounts[Math.floor(posAmounts.length / 2)] : 0;
        const distYears = new Set(pastOrConfirmed.map(e => e.exDate.slice(0, 4))).size;

        const isRecurringDd = (ev: { exDate: string }) => {
            if (distYears < 2) return true;
            const y = ev.exDate.slice(0, 4);
            return pastOrConfirmed.some(o => o.exDate.slice(0, 4) !== y && circularDayOfYearDistance(ev.exDate, o.exDate) <= 28);
        };

        const recentHistory: SmartDividendHistoryItem[] = [...pastOrConfirmed]
            .reverse()
            .slice(0, 6)
            .map(ev => ({
                exDate: ev.exDate,
                amount: ev.amount,
                isLikelySpecial: (posAmounts.length >= 4 && med > 0 && ev.amount >= med * 2.0) || (distYears >= 2 && !isRecurringDd(ev))
            }));
        const hasSpecialDividendHint = recentHistory.some(h => h.isLikelySpecial);

        const toSlot = (ev: { exDate: string; payDate: string; payDates: string[]; amount: number; forecast: boolean }): SmartDividendSlot => {
            let source: DividendSlotSource;
            const latestPay = ev.payDates.length > 0 ? ev.payDates[ev.payDates.length - 1] : ev.payDate;
            if (!isSlotStillActive(latestPay)) source = 'paid';
            else if (!ev.forecast) source = 'official';
            else source = 'projected';
            const extraPayDates = ev.payDates.length > 1 ? ev.payDates.slice(1) : undefined;
            return { exDate: ev.exDate, payDate: ev.payDate, extraPayDates, source, amount: ev.amount };
        };

        const ddSlots: SmartDividendSlot[] = [];

        if (freq === 'annually' || freq === 'monthly') {
            const active = windowed.find(ev => isSlotStillActive(ev.payDate));
            if (active) {
                ddSlots.push(toSlot(active));
            } else {
                const latest = windowed[windowed.length - 1];
                if (latest) {
                    const step = freq === 'monthly' ? 1 : 12;
                    let ex = latest.exDate;
                    let pay = latest.payDate;
                    const diff = diffCalendarDaysIso(ex, pay) ?? 21;
                    let safety = 0;
                    while (!isSlotStillActive(pay) && safety < 24) {
                        ex = shiftDateMonthsWeekdayIso(ex, step);
                        pay = addCalendarDaysWeekdayIso(ex, Math.max(1, diff));
                        safety++;
                    }
                    ddSlots.push({ exDate: ex, payDate: pay, source: 'projected', amount: latest.amount });
                }
            }
        } else {
            const targetCount = freq === 'quarterly' ? 4 : 2;
            const minGap = freq === 'quarterly' ? 28 : 90;

            const collectForYear = (year: number): SmartDividendSlot[] => {
                const yearEvents = windowed.filter(e => Number(e.exDate.slice(0, 4)) === year);
                const picked: SmartDividendSlot[] = [];
                // Prefer non-forecast first, then forecast
                const ordered = [...yearEvents].sort((a, b) => {
                    if (a.forecast !== b.forecast) return a.forecast ? 1 : -1;
                    return a.exDate.localeCompare(b.exDate);
                });
                for (const ev of ordered) {
                    if (picked.length >= targetCount) break;
                    if (picked.some(p => circularDayOfYearDistance(p.exDate, ev.exDate) < minGap)) continue;
                    picked.push(toSlot(ev));
                }
                // If DivvyDiary doesn't have all slots for `year` yet, fill missing calendar slots from adjacent year
                if (picked.length < targetCount) {
                    const prevEvents = [...windowed]
                        .filter(e => Number(e.exDate.slice(0, 4)) < year)
                        .reverse();
                    for (const ev of prevEvents) {
                        if (picked.length >= targetCount) break;
                        if (picked.some(p => circularDayOfYearDistance(p.exDate, ev.exDate) < minGap)) continue;
                        const yearDiff = year - Number(ev.exDate.slice(0, 4));
                        const shiftedEx = shiftDateMonthsWeekdayIso(ev.exDate, yearDiff * 12);
                        const origDiff = diffCalendarDaysIso(ev.exDate, ev.payDate);
                        const shiftedPay = origDiff !== null && origDiff >= 0 && origDiff <= 150
                            ? addCalendarDaysWeekdayIso(shiftedEx, origDiff)
                            : shiftDateMonthsWeekdayIso(ev.payDate, yearDiff * 12);
                        picked.push({
                            exDate: shiftedEx,
                            payDate: shiftedPay,
                            source: isSlotStillActive(shiftedPay) ? 'projected' : 'paid',
                            amount: ev.amount
                        });
                    }
                }
                picked.sort((a, b) => calendarPositionKey(a.exDate) - calendarPositionKey(b.exDate));
                return picked;
            };

            const thisYearSlots = collectForYear(currentYear);
            const hasActiveThisYear = thisYearSlots.some(s => s.source !== 'paid');
            const chosen = hasActiveThisYear ? thisYearSlots : collectForYear(currentYear + 1);
            ddSlots.push(...chosen);
        }

        if (ddSlots.length === 0) return null;

        // Calculate representative pay-date offset from DivvyDiary slots
        const sampleSlot = ddSlots.find(s => s.source === 'official') || ddSlots[ddSlots.length - 1];
        const sampleOffset = Math.max(0, diffCalendarDaysIso(sampleSlot.exDate, sampleSlot.payDate) ?? 21);

        return {
            symbol: cleanSym || dd.symbol || dd.isin,
            provider: 'divvydiary',
            resolvedIsin: dd.isin,
            frequency: freq,
            slots: ddSlots,
            recentHistory,
            currency: dd.currency || null,
            hasSpecialDividendHint,
            officialCount: ddSlots.filter(s => s.source === 'official').length,
            projectedCount: ddSlots.filter(s => s.source === 'projected').length,
            historyCount: ddSlots.filter(s => s.source === 'history').length,
            payOffsetDays: sampleOffset,
            payOffsetSource: 'official'
        };
    };

    // Stage 0: Try DivvyDiary first if user configured an API key and we already have an ISIN
    let divvyDiaryHint: string | undefined;
    const hasDivvyKey = Boolean(getDivvyDiaryApiKey());
    if (hasDivvyKey && initialIsin) {
        const ddRes = await fetchDivvyDiaryDividends(initialIsin).catch(() => null);
        if (ddRes && !ddRes.error && ddRes.dividends.length > 0) {
            const built = buildFromDivvyDiary(ddRes);
            if (built) return built;
        } else if (ddRes?.error) {
            divvyDiaryHint = ddRes.error;
        }
    }

    // Fetch Stage 1 (quoteSummary with calendarEvents) and Stage 2 (3y dividend history) in parallel
    const fetchDivHistory = async (): Promise<{ events: { exDate: string; amount: number }[]; currency: string | null }> => {
        const encodedSym = encodeURIComponent(cleanSym);
        let json: any = null;
        try {
            const res = await fetch(`/api/yahoo-finance?symbol=${encodedSym}&period=3y&interval=1d&events=div&_=${Date.now()}`);
            if (res.ok) json = await res.json();
        } catch {
            // Static hosting fallback below
        }

        if (!json || !json.chart?.result?.[0]) {
            try {
                const targetUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodedSym}?range=3y&interval=1d&events=div&_=${Date.now()}`;
                const proxyRes = await fetch(`https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}`);
                if (proxyRes.ok) json = await proxyRes.json();
            } catch {
                // Ignore
            }
        }

        const chartResult = json?.chart?.result?.[0];
        const chartCurrency: string | null = chartResult?.meta?.currency || null;
        const rawDivs = chartResult?.events?.dividends;
        if (!rawDivs || typeof rawDivs !== 'object') return { events: [], currency: chartCurrency };

        const rawList = Object.values(rawDivs)
            .map((d: any) => {
                const sec = typeof d?.date === 'number' ? d.date : Number(d?.date);
                const amount = typeof d?.amount === 'number' ? d.amount : Number(d?.amount) || 0;
                if (!Number.isFinite(sec) || sec <= 0) return null;
                return { exDate: formatUtcMsToIso(sec * 1000), amount };
            })
            .filter((x): x is { exDate: string; amount: number } => Boolean(x))
            .sort((a, b) => a.exDate.localeCompare(b.exDate));

        // Cluster nearby events (<= 12 days apart, e.g. Petrobras JCP + regular dividend on same Ex-Date)
        const clustered: { exDate: string; amount: number }[] = [];
        for (const ev of rawList) {
            const last = clustered[clustered.length - 1];
            if (last) {
                const diff = diffCalendarDaysIso(last.exDate, ev.exDate);
                if (diff !== null && Math.abs(diff) <= 12) {
                    last.amount += ev.amount;
                    continue;
                }
            }
            clustered.push({ ...ev });
        }
        return { events: clustered, currency: chartCurrency };
    };

    const [quoteRes, divHistoryRes] = await Promise.all([
        fetchStockQuote(cleanSym).catch(() => null),
        fetchDivHistory().catch(() => ({ events: [], currency: null }))
    ]);
    const historyEvents = divHistoryRes.events;
    const resolvedCurrency = quoteRes?.currency || divHistoryRes.currency || null;
    const resolvedIsin = initialIsin || (quoteRes?.isin ? quoteRes.isin.trim().toUpperCase() : null);

    // If ISIN was resolved via Yahoo and user has a DivvyDiary key, try DivvyDiary now!
    if (hasDivvyKey && !initialIsin && resolvedIsin) {
        const ddRes = await fetchDivvyDiaryDividends(resolvedIsin).catch(() => null);
        if (ddRes && !ddRes.error && ddRes.dividends.length > 0) {
            const built = buildFromDivvyDiary(ddRes);
            if (built) return built;
        } else if (ddRes?.error) {
            divvyDiaryHint = ddRes.error;
        }
    }

    // Extract Stage 1 official dates (ignore stale dates older than 420 days)
    let officialExIso: string | null = null;
    let officialPayIso: string | null = null;

    if (quoteRes?.exDividendDate instanceof Date && !isNaN(quoteRes.exDividendDate.getTime())) {
        const iso = formatUtcMsToIso(quoteRes.exDividendDate.getTime());
        const ageDays = diffCalendarDaysIso(iso, todayIso);
        if (ageDays !== null && ageDays <= 420 && ageDays >= -400) {
            officialExIso = iso;
        }
    }
    if (quoteRes?.dividendPayDate instanceof Date && !isNaN(quoteRes.dividendPayDate.getTime())) {
        const iso = formatUtcMsToIso(quoteRes.dividendPayDate.getTime());
        const ageDays = diffCalendarDaysIso(iso, todayIso);
        if (ageDays !== null && ageDays <= 420 && ageDays >= -420) {
            officialPayIso = iso;
        }
    }

    if (!officialExIso && historyEvents.length === 0) {
        return {
            symbol: cleanSym,
            provider: 'yahoo',
            resolvedIsin,
            divvyDiaryHint,
            frequency: fallbackFreq,
            slots: [],
            recentHistory: [],
            currency: resolvedCurrency,
            hasSpecialDividendHint: false,
            officialCount: 0,
            projectedCount: 0,
            historyCount: 0,
            payOffsetDays: 21,
            payOffsetSource: 'market',
            error: 'Keine Dividenden-Termine bei Yahoo Finance gefunden'
        };
    }

    // Analyze historical recurrence & potential special dividends (Sonderdividenden)
    const distinctHistoryYears = new Set(historyEvents.map(e => e.exDate.slice(0, 4))).size;
    const positiveAmounts = historyEvents.map(e => e.amount).filter(a => a > 0).sort((a, b) => a - b);
    const medianAmount = positiveAmounts.length > 0 ? positiveAmounts[Math.floor(positiveAmounts.length / 2)] : 0;

    const isRecurringCalendarWindow = (ev: { exDate: string }): boolean => {
        if (distinctHistoryYears < 2) return true;
        const evYear = ev.exDate.slice(0, 4);
        return historyEvents.some(other =>
            other.exDate.slice(0, 4) !== evYear &&
            circularDayOfYearDistance(ev.exDate, other.exDate) <= 28
        );
    };

    const annotatedHistory: SmartDividendHistoryItem[] = historyEvents.map(ev => {
        const highAmount = positiveAmounts.length >= 4 && medianAmount > 0 && ev.amount >= medianAmount * 2.0;
        const oneOffMonth = distinctHistoryYears >= 2 && !isRecurringCalendarWindow(ev);
        return {
            exDate: ev.exDate,
            amount: ev.amount,
            isLikelySpecial: highAmount || oneOffMonth
        };
    });

    const recentHistory: SmartDividendHistoryItem[] = [...annotatedHistory].reverse().slice(0, 6);
    const hasSpecialDividendHint = recentHistory.some(item => item.isLikelySpecial);

    // Determine Pay-Date Offset (Priority: 1. Official pair, 2. Learned from user's existing dates, 3. Market default)
    const upperSym = cleanSym.toUpperCase();
    let payOffsetDays = 21;
    let payOffsetSource: 'official' | 'learned' | 'market' = 'market';
    let useTradingDaysMode: number | null = null;

    const officialDiff = (officialExIso && officialPayIso) ? diffCalendarDaysIso(officialExIso, officialPayIso) : null;
    if (officialDiff !== null && officialDiff >= 1 && officialDiff <= 90) {
        payOffsetDays = officialDiff;
        payOffsetSource = 'official';
    } else {
        const learnedDiffs: number[] = [];
        for (const pair of options?.existingDates || []) {
            if (pair.exDate && pair.payDate) {
                const d = diffCalendarDaysIso(pair.exDate, pair.payDate);
                if (d !== null && d >= 1 && d <= 90) learnedDiffs.push(d);
            }
        }
        if (learnedDiffs.length > 0) {
            learnedDiffs.sort((a, b) => a - b);
            payOffsetDays = learnedDiffs[Math.floor(learnedDiffs.length / 2)];
            payOffsetSource = 'learned';
        } else if (options?.isEtf) {
            payOffsetDays = 13;
            payOffsetSource = 'market';
        } else if (upperSym.endsWith('.SW')) {
            payOffsetDays = 2;
            useTradingDaysMode = 2;
            payOffsetSource = 'market';
        } else if (upperSym.endsWith('.DE') || upperSym.endsWith('.F') || upperSym.endsWith('.MU') || upperSym.endsWith('.BE')) {
            payOffsetDays = 3;
            useTradingDaysMode = 3;
            payOffsetSource = 'market';
        } else if (upperSym.endsWith('.L')) {
            payOffsetDays = 30;
            payOffsetSource = 'market';
        } else {
            payOffsetDays = 21;
            payOffsetSource = 'market';
        }
    }

    const computePayDate = (exIso: string): string => {
        if (officialExIso && officialPayIso && exIso === officialExIso) {
            return officialPayIso;
        }
        if (useTradingDaysMode !== null) {
            return addTradingDaysIso(exIso, useTradingDaysMode);
        }
        return addCalendarDaysWeekdayIso(exIso, payOffsetDays);
    };

    // Detect Frequency from trailing 375 days of unique historical events (unless caller locks frequency)
    let detectedFrequency: DividendScheduleFrequency = options?.forceFrequency || fallbackFreq;
    if (!options?.forceFrequency && historyEvents.length > 0) {
        const latestHistMs = parseIsoUtcMs(historyEvents[historyEvents.length - 1].exDate) ?? todayMs;
        const anchorMs = Math.max(todayMs, latestHistMs);
        const oneYearAgoMs = anchorMs - 375 * 86400000;
        const trailingEvents = historyEvents.filter(e => {
            const ms = parseIsoUtcMs(e.exDate);
            return ms !== null && ms >= oneYearAgoMs;
        });

        const count = trailingEvents.length > 0
            ? trailingEvents.length
            : Math.round(historyEvents.length / Math.max(1, distinctHistoryYears));
        if (count >= 9) {
            detectedFrequency = 'monthly';
        } else if (count >= 3) {
            detectedFrequency = 'quarterly';
        } else if (count === 2) {
            detectedFrequency = 'semi-annually';
        } else if (count === 1) {
            detectedFrequency = 'annually';
        }
    } else if (officialExIso && !options?.currentFrequency) {
        detectedFrequency = 'annually';
    }

    const slots: SmartDividendSlot[] = [];

    if (detectedFrequency === 'annually') {
        // Prefer most recent recurring annual event (avoids picking a one-off special dividend)
        const reversed = [...historyEvents].reverse();
        const recurringLatest = reversed.find(ev => isRecurringCalendarWindow(ev));
        const baseEx = officialExIso || recurringLatest?.exDate || historyEvents[historyEvents.length - 1]?.exDate;
        if (baseEx) {
            let ex = baseEx;
            let pay = computePayDate(ex);
            let source: DividendSlotSource = (officialExIso && ex === officialExIso) ? 'official' : 'history';
            let safety = 0;
            while (!isSlotStillActive(pay) && safety < 3) {
                ex = shiftDateMonthsWeekdayIso(ex, 12);
                pay = computePayDate(ex);
                source = 'projected';
                safety++;
            }
            slots.push({ exDate: ex, payDate: pay, source });
        }
    } else if (detectedFrequency === 'monthly') {
        const baseEx = officialExIso || historyEvents[historyEvents.length - 1]?.exDate;
        if (baseEx) {
            let ex = baseEx;
            let pay = computePayDate(ex);
            let source: DividendSlotSource = (officialExIso && ex === officialExIso) ? 'official' : 'history';
            let safety = 0;
            while (!isSlotStillActive(pay) && safety < 24) {
                ex = shiftDateMonthsWeekdayIso(ex, 1);
                pay = computePayDate(ex);
                source = 'projected';
                safety++;
            }
            slots.push({ exDate: ex, payDate: pay, source });
        }
    } else {
        // Quarterly (4 slots) or Semi-Annually (2 slots)
        const targetCount = detectedFrequency === 'quarterly' ? 4 : 2;
        const stepMonths = detectedFrequency === 'quarterly' ? 3 : 6;
        // Minimum circular day-of-year distance between two distinct annual payouts
        // (28 days deduplicates e.g. 2025-06-03 & 2026-06-04 while preserving Apr 24 & Jun 04 = 41d)
        const minCycleGapDays = detectedFrequency === 'quarterly' ? 28 : 90;

        const working: SmartDividendSlot[] = [];

        // Stage 1: seed with official date first if present
        if (officialExIso) {
            working.push({
                exDate: officialExIso,
                payDate: officialPayIso || computePayDate(officialExIso),
                source: 'official'
            });
        }

        const isDuplicateCycle = (candidateIso: string): boolean =>
            working.some(existing => circularDayOfYearDistance(existing.exDate, candidateIso) < minCycleGapDays);

        const reversedHist = [...historyEvents].reverse();

        // Pass 1: newest non-duplicate slots from recurring calendar windows (filters out one-off Sonderdividenden)
        for (const ev of reversedHist) {
            if (working.length >= targetCount) break;
            if (!isRecurringCalendarWindow(ev)) continue;
            if (isDuplicateCycle(ev.exDate)) continue;
            working.push({
                exDate: ev.exDate,
                payDate: computePayDate(ev.exDate),
                source: 'history',
                amount: ev.amount
            });
        }

        // Pass 2: if still short (e.g. young ETF with < 2y history), accept remaining non-duplicate events
        if (working.length < targetCount) {
            for (const ev of reversedHist) {
                if (working.length >= targetCount) break;
                if (isDuplicateCycle(ev.exDate)) continue;
                working.push({
                    exDate: ev.exDate,
                    payDate: computePayDate(ev.exDate),
                    source: 'history',
                    amount: ev.amount
                });
            }
        }

        // Sort chronologically before any fallback projection
        working.sort((a, b) => a.exDate.localeCompare(b.exDate));

        // If fewer than targetCount slots exist (e.g., young ETF), project missing slots at stepMonths intervals
        let fillSafety = 0;
        while (working.length > 0 && working.length < targetCount && fillSafety < 8) {
            const last = working[working.length - 1];
            const nextEx = shiftDateMonthsWeekdayIso(last.exDate, stepMonths);
            fillSafety++;
            if (isDuplicateCycle(nextEx)) continue;
            working.push({
                exDate: nextEx,
                payDate: computePayDate(nextEx),
                source: 'projected'
            });
        }

        // Build calendar-year schedule:
        // Keep real dates of the current year (marked 'paid' if already past) as long as at least
        // one payout of the current year is still upcoming/active. Only once ALL payouts of the
        // current year are finished, advance the full schedule to next year.
        const alignSlotToYear = (slot: SmartDividendSlot, targetYear: number): SmartDividendSlot => {
            const slotYear = Number(slot.exDate.slice(0, 4));
            let ex = slot.exDate;
            let pay = slot.payDate;
            let source: DividendSlotSource = slot.source;

            if (slotYear !== targetYear) {
                const yearDiff = targetYear - slotYear;
                ex = shiftDateMonthsWeekdayIso(ex, yearDiff * 12);
                pay = computePayDate(ex);
                source = 'projected';
            }

            if (!isSlotStillActive(pay)) {
                source = 'paid';
            }
            return { exDate: ex, payDate: pay, source, amount: slot.amount };
        };

        const currentYearSlots = working.map(slot => alignSlotToYear(slot, currentYear));
        const hasUpcomingInCurrentYear = currentYearSlots.some(s => s.source !== 'paid');

        const chosenSlots = hasUpcomingInCurrentYear
            ? currentYearSlots
            : working.map(slot => alignSlotToYear(slot, currentYear + 1));

        for (const s of chosenSlots) {
            slots.push(s);
        }

        // Sort slots by calendar position Jan -> Dec so Q1..Q4 / H1..H2 align cleanly with calendar order
        slots.sort((a, b) => calendarPositionKey(a.exDate) - calendarPositionKey(b.exDate));
    }

    const officialCount = slots.filter(s => s.source === 'official').length;
    const historyCount = slots.filter(s => s.source === 'history').length;
    const projectedCount = slots.filter(s => s.source === 'projected').length;

    return {
        symbol: cleanSym,
        provider: 'yahoo',
        resolvedIsin,
        divvyDiaryHint,
        frequency: detectedFrequency,
        slots,
        recentHistory,
        currency: resolvedCurrency,
        hasSpecialDividendHint,
        officialCount,
        projectedCount,
        historyCount,
        payOffsetDays,
        payOffsetSource
    };
}
