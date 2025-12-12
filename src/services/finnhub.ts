
// Basic type for a chart data point
export interface ChartDataPoint {
    date: string;
    value: number;
}

export type TimeRange = '1M' | '3M' | '6M' | '1Y' | '5Y';

// Helper to get UNIX timestamp for range start
const getStartTime = (range: TimeRange): number => {
    const now = new Date();
    switch (range) {
        case '1M': now.setMonth(now.getMonth() - 1); break;
        case '3M': now.setMonth(now.getMonth() - 3); break;
        case '6M': now.setMonth(now.getMonth() - 6); break;
        case '1Y': now.setFullYear(now.getFullYear() - 1); break;
        case '5Y': now.setFullYear(now.getFullYear() - 5); break;
    }
    return Math.floor(now.getTime() / 1000);
};

export async function fetchStockHistory(
    symbol: string,
    range: TimeRange,
    apiKey: string
): Promise<ChartDataPoint[] | null> {
    if (!apiKey) return null; // Fallback to mock

    try {
        const from = getStartTime(range);
        const to = Math.floor(Date.now() / 1000);
        // Resolution: Finnhub supports 1, 5, 15, 30, 60, D, W, M
        // For 1M/3M use 'D' (Daily), for 1Y+ maybe 'W' (Weekly) to save data points
        let resolution = 'D';
        if (range === '5Y') resolution = 'W';

        const url = `https://finnhub.io/api/v1/stock/candle?symbol=${symbol}&resolution=${resolution}&from=${from}&to=${to}&token=${apiKey}`;

        const response = await fetch(url);
        if (!response.ok) throw new Error(`API Error: ${response.status}`);

        const data = await response.json();

        if (data.s === 'no_data') {
            return null; // Handle no data
        }

        if (data.s === 'ok' && data.c && data.t) {
            // Transform { c: [close_prices], t: [timestamps], ... } to [{date, value}]
            return data.t.map((timestamp: number, index: number) => ({
                date: new Date(timestamp * 1000).toISOString(),
                value: data.c[index]
            }));
        }

        return null;

    } catch (error) {
        console.error("Finnhub Fetch Error:", error);
        return null; // Fallback to mock on error
    }
}
