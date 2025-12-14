
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
): Promise<{ data: ChartDataPoint[] | null, error?: string }> {
    try {
        const { period, interval } = getYahooParams(range);

        // Using Yahoo Finance API v8 (no auth required)
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?range=${period}&interval=${interval}`;

        console.log('[Yahoo Finance] Fetching:', symbol, 'Period:', period, 'Interval:', interval);

        const response = await fetch(url);
        console.log('[Yahoo Finance] Response status:', response.status);

        if (!response.ok) {
            return { data: null, error: `API Fehler: ${response.status}` };
        }

        const data = await response.json();
        console.log('[Yahoo Finance] Response data:', data);

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

        console.log('[Yahoo Finance] Returning', points.length, 'data points');
        return { data: points.length > 0 ? points : null };

    } catch (error) {
        console.error("Yahoo Finance Fetch Error:", error);
        return { data: null, error: 'Netzwerkfehler oder API nicht erreichbar.' };
    }
}
