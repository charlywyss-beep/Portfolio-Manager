
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
        case '1M': return { period: '1mo', interval: '1d' };
        case '3M': return { period: '3mo', interval: '1d' };
        case '6M': return { period: '6mo', interval: '1d' };
        case '1Y': return { period: '1y', interval: '1d' };
        case '5Y': return { period: '5y', interval: '1wk' };
        case 'BUY': return { period: '5y', interval: '1wk' }; // Fallback for API call if leaked
    }
};

export async function fetchStockHistory(
    symbol: string,
    range: TimeRange,
    _apiKey?: string // Not used for Yahoo Finance
): Promise<{ data: ChartDataPoint[] | null, currency?: string, error?: string, previousClose?: number }> {
    try {
        const { period, interval } = getYahooParams(range);

        // Use Vercel API proxy to bypass CORS
        const url = `/api/yahoo-finance?symbol=${symbol}&period=${period}&interval=${interval}`;

        console.log('[Yahoo Finance Proxy] Fetching:', symbol, 'Period:', period, 'Interval:', interval);

        const response = await fetch(url);
        console.log('[Yahoo Finance Proxy] Response status:', response.status);

        if (!response.ok) {
            return { data: null, error: `API Fehler: ${response.status}` };
        }

        const data = await response.json();
        console.log('[Yahoo Finance Proxy] Response data:', data);

        if (data.chart?.error) {
            return { data: null, error: `Yahoo Finance: ${data.chart.error.description}` };
        }

        const result = data.chart?.result?.[0];
        if (!result || !result.timestamp || !result.indicators?.quote?.[0]?.close) {
            return { data: null, error: 'Keine Daten verfügbar' };
        }

        const timestamps = result.timestamp;
        const closes = result.indicators.quote[0].close;

        const points: ChartDataPoint[] = timestamps
            .map((timestamp: number, index: number) => {
                const close = closes[index];
                if (close === null || close === undefined) return null;
                return {
                    date: new Date(timestamp * 1000).toISOString(),
                    value: close
                };
            })
            .filter((p: ChartDataPoint | null): p is ChartDataPoint => p !== null);

        console.log('[Yahoo Finance Proxy] Returning', points.length, 'data points');
        return {
            data: points.length > 0 ? points : null,
            currency: result.meta?.currency,
            previousClose: result.meta?.chartPreviousClose || result.meta?.previousClose
        };

    } catch (error) {
        console.error("Yahoo Finance Proxy Error:", error);
        return { data: null, error: 'Netzwerkfehler oder API nicht erreichbar.' };
    }
}

// Helper to find logo via Clearbit Autocomplete
export async function fetchCompanyLogo(query: string): Promise<string | null> {
    try {
        const response = await fetch(`https://autocomplete.clearbit.com/v1/companies/suggest?query=${encodeURIComponent(query)}`);
        if (!response.ok) return null;
        const data = await response.json();
        if (data && data.length > 0) {
            return data[0].logo;
        }
        return null;
    } catch (e) {
        console.warn("Logo fetch failed", e);
        return null;
    }
}

// Manual Country Overrides for ETFs/Stocks where Yahoo API is missing/wrong
const MANUAL_COUNTRY_OVERRIDES: Record<string, string> = {
    'VWRA.L': 'Welt', // Vanguard FTSE All-World
    'VWRD.L': 'Welt', // Vanguard FTSE All-World (Dist)
    'SWDA.L': 'Welt', // iShares Core MSCI World
    'IWDA.L': 'Welt', // iShares Core MSCI World
    'EUNL.DE': 'Welt',
    'CSSPX.SW': 'USA', // iShares Core S&P 500
    'CSPX.L': 'USA',
    'VUAA.L': 'USA',
    'VUSA.L': 'USA',
    'CHSPI.SW': 'Schweiz', // iShares Core SPI
};

// Fetch latest quote (realtime-ish)
export async function fetchStockQuote(symbol: string): Promise<{
    price: number | null,
    currency: string | null,
    marketTime: Date | null,
    trailingPE: number | null,
    forwardPE: number | null,
    eps: number | null,
    dividendYield: number | null,
    country: string | null,
    marketState?: string | null,
    error?: string
}> {
    try {
        const url = `/api/yahoo-quote?symbol=${symbol}`;
        const response = await fetch(url);

        if (!response.ok) {
            return { price: null, currency: null, marketTime: null, trailingPE: null, forwardPE: null, eps: null, dividendYield: null, country: null, error: `API Error: ${response.status}` };
        }

        const data = await response.json();
        const result = data.quoteResponse?.result?.[0];

        if (!result) {
            return { price: null, currency: null, marketTime: null, trailingPE: null, forwardPE: null, eps: null, dividendYield: null, country: null, error: 'Keine Daten' };
        }

        // Check Override
        let country = result.country || null;
        if (MANUAL_COUNTRY_OVERRIDES[symbol]) {
            country = MANUAL_COUNTRY_OVERRIDES[symbol];
        }

        return {
            price: result.regularMarketPrice,
            currency: result.currency,
            marketTime: result.regularMarketTime ? new Date(result.regularMarketTime * 1000) : null,
            trailingPE: result.trailingPE || null,
            forwardPE: result.forwardPE || null,
            eps: result.epsTrailingTwelveMonths || null,
            dividendYield: result.dividendYield || null,
            country: country,
            marketState: result.marketState || null
        };
    } catch (error) {
        console.error("Yahoo Quote Error:", error);
        return {
            price: null, currency: null, marketTime: null, trailingPE: null, forwardPE: null, eps: null, dividendYield: null, country: null, error: 'Netzwerkfehler'
        };
    }
}

// Fetch multiple quotes at once
export async function fetchStockQuotes(symbols: string[]): Promise<Record<string, { price: number, marketTime?: Date, marketState?: string | null }>> {
    if (symbols.length === 0) return {};

    try {
        const symbolStr = symbols.join(',');
        const url = `/api/yahoo-quote?symbol=${symbolStr}`;
        const response = await fetch(url);

        if (!response.ok) {
            console.error(`API Error: ${response.status}`);
            return {};
        }

        const data = await response.json();
        const results = data.quoteResponse?.result || [];

        const updateMap: Record<string, { price: number, marketTime?: Date, marketState?: string | null }> = {};

        results.forEach((res: any) => {
            if (res.symbol && res.regularMarketPrice) {
                // Heuristic: Detect Pence (similar to single fetch)
                let price = res.regularMarketPrice;
                if (res.currency === 'GBp' || (res.symbol.endsWith('.L') && price > 50)) {
                    price = price / 100;
                }

                updateMap[res.symbol] = {
                    price,
                    marketTime: res.regularMarketTime ? new Date(res.regularMarketTime * 1000) : undefined,
                    marketState: res.marketState || null
                };
            }
        });

        return updateMap;
    } catch (error) {
        console.error("Batch Quote Error:", error);
        return {};
    }
}
// Search for stocks/ISIN
export async function searchStocks(query: string): Promise<any[]> {
    try {
        const url = `/api/yahoo-search?query=${encodeURIComponent(query)}`;
        const response = await fetch(url);

        if (!response.ok) {
            console.error(`Search API Error: ${response.status}`);
            return [];
        }

        const data = await response.json();
        return data.quotes || [];
    } catch (error) {
        console.error("Search API Error:", error);
        return [];
    }
}
