
// Basic type for a chart data point
export interface ChartDataPoint {
    date: string;
    value: number;
}

export type TimeRange = '1D' | '1W' | '1M' | '3M' | '6M' | '1Y' | '5Y';

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
    }
};

export async function fetchStockHistory(
    symbol: string,
    range: TimeRange,
    _apiKey?: string // Not used for Yahoo Finance
): Promise<{ data: ChartDataPoint[] | null, currency?: string, error?: string }> {
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

        // Transform to our format
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
            currency: result.meta?.currency
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
