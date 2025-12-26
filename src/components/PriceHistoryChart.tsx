
import { useMemo, useState, useEffect } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { useCurrencyFormatter } from '../utils/currency';
import { cn } from '../utils';

import { type TimeRange } from '../services/yahoo-finance';

interface PriceHistoryChartProps {
    currentPrice: number;
    currency: string;
    volatility?: number;
    trend?: 'up' | 'down' | 'neutral';
    historyData?: { date: string; value: number }[] | null;
    selectedRange?: TimeRange;
    onRangeChange?: (range: TimeRange) => void;
}

export function PriceHistoryChart({ currentPrice, currency, volatility = 0.02, trend = 'up', historyData, selectedRange = '1Y', onRangeChange }: PriceHistoryChartProps) {
    const [hasMounted, setHasMounted] = useState(false);

    useEffect(() => {
        setHasMounted(true);
    }, []);
    const { formatCurrency } = useCurrencyFormatter();

    const handleRangeChange = (range: TimeRange) => {
        if (onRangeChange) onRangeChange(range);
    };

    // Use simulated data if no historyData is provided
    const data = useMemo(() => {
        // If we have real data, we expect the parent to filter/fetch it based on range.
        // For simplicity, if historyData is filtered by parent, just use it.
        // If historyData contains ALL points, we might need to filter.
        // But for this implementation, let's assume parent handles fetching for the range.
        if (historyData && historyData.length > 0) {
            return historyData;
        }

        // ... (mock generation) ...



        const points = [];
        const now = new Date();
        let days = 30; // default for loops
        let intervalHours = 24; // default for loops

        switch (selectedRange) {
            case '1D': days = 1; intervalHours = 0.5; break; // 30 min intervals
            case '1W': days = 7; intervalHours = 4; break; // 4h intervals simulates week well roughly
            case '1M': days = 30; intervalHours = 24; break;
            case '3M': days = 90; intervalHours = 24; break;
            case '6M': days = 180; intervalHours = 24; break;
            case '1Y': days = 365; intervalHours = 24; break;
            case '5Y': days = 365 * 5; intervalHours = 24 * 7; break; // Weekly
        }

        // Generate mock data backwards from today
        let price = currentPrice;

        // Count iterations based on days and interval
        const hoursTotal = days * 24;
        const iterations = Math.ceil(hoursTotal / intervalHours);

        // Adjust starting price target based on trend to ensure end price is close to currentPrice
        // This is a naive simulation: we walk backwards
        for (let i = 0; i < iterations; i++) {
            const date = new Date(now);
            date.setTime(date.getTime() - (i * intervalHours * 60 * 60 * 1000));

            // Skip weekends for daily data if interval is >= 24h
            if (intervalHours >= 24) {
                if (date.getDay() === 0 || date.getDay() === 6) continue;
            }

            // Random walk
            const change = 1 + (Math.random() * volatility * 2 - volatility);

            // Apply slight trend bias backwards (if trend is up, historically it was lower, so we divide?)
            // Actually simpler: just random walk and then reverse the array, 
            // but ensuring the LAST point matches currentPrice is tricky with random walk from start.
            // So we walk backwards from currentPrice.

            // If trend is 'up', historical prices should generally be lower → price * (1 - bias)
            // If trend is 'down', historical prices should be higher → price * (1 + bias)
            let bias = 0;
            if (trend === 'up') bias = -0.0005; // small daily drift up means backwards it goes down
            if (trend === 'down') bias = 0.0005;

            price = price * (change + bias);

            points.push({
                date: date.toISOString(),
                value: price,
            });
        }

        return points.reverse();
    }, [currentPrice, selectedRange, volatility, trend, historyData]);

    // Calculate performance for the selected range
    const startPrice = data[0]?.value || 0;
    const endPrice = data[data.length - 1]?.value || 0;
    const performance = startPrice !== 0 ? ((endPrice - startPrice) / startPrice) * 100 : 0;
    const isPositive = performance >= 0;

    // Calculate CHF Difference
    const { convertToCHF } = useCurrencyFormatter();
    const diffNative = endPrice - startPrice;
    const diffCHF = currency !== 'CHF' ? convertToCHF(diffNative, currency) : diffNative;
    const diffCHFFormatted = (diffCHF > 0 ? '+' : '') + diffCHF.toLocaleString('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' CHF';

    // Calculate Min/Max for the current range
    const prices = data.map(d => d.value);
    const minPrice = prices.length > 0 ? Math.min(...prices) : 0;
    const maxPrice = prices.length > 0 ? Math.max(...prices) : 0;

    return (
        <div className="w-full h-full flex flex-col relative">
            <div className="flex flex-wrap items-center justify-between mb-4 gap-2">
                <div className="flex flex-col gap-1">
                    <div>
                        <p className="text-sm text-muted-foreground">Performance ({selectedRange})</p>
                        <div className={cn("font-bold flex items-center gap-1", isPositive ? "text-green-600 dark:text-green-400" : "text-red-500")}>
                            <span className="text-xl">
                                {performance > 0 ? '+' : ''}{performance.toFixed(2)}%
                                {currency !== 'CHF' && <span className="ml-1 opacity-80 text-lg">({diffCHFFormatted})</span>}
                            </span>
                        </div>
                    </div>
                    {/* High/Low Indicators */}
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                        <div className="flex items-center gap-1">
                            <span className="font-medium text-foreground">H:</span>
                            <span>{formatCurrency(maxPrice, currency)}</span>
                        </div>
                        <div className="flex items-center gap-1">
                            <span className="font-medium text-foreground">T:</span>
                            <span>{formatCurrency(minPrice, currency)}</span>
                        </div>
                    </div>
                    {/* Date Indicator for 1D Chart */}
                    {selectedRange === '1D' && data.length > 0 && (
                        <div className="mt-2 text-xs">
                            {(() => {
                                // Check the LAST data point to see if we have today's data
                                const lastDataPoint = data[data.length - 1];
                                const chartDate = new Date(lastDataPoint.date);
                                const today = new Date();
                                const isToday = chartDate.toDateString() === today.toDateString();

                                return (
                                    <div className={cn(
                                        "inline-flex items-center gap-1.5 px-2 py-1 rounded-md font-medium",
                                        isToday
                                            ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"
                                            : "bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400"
                                    )}>
                                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                                            <line x1="16" y1="2" x2="16" y2="6"></line>
                                            <line x1="8" y1="2" x2="8" y2="6"></line>
                                            <line x1="3" y1="10" x2="21" y2="10"></line>
                                        </svg>
                                        <span>
                                            {chartDate.toLocaleDateString('de-DE', {
                                                weekday: 'short',
                                                day: '2-digit',
                                                month: '2-digit',
                                                year: 'numeric'
                                            })}
                                            {!isToday && <span className="ml-1">(Letzter Handelstag)</span>}
                                        </span>
                                    </div>
                                );
                            })()}
                        </div>
                    )}
                </div>

                <div className="flex bg-muted/50 p-1 rounded-lg">
                    {(['1D', '1W', '1M', '3M', '6M', '1Y', '5Y', 'BUY'] as TimeRange[]).map((range) => (
                        <button
                            key={range}
                            onClick={() => handleRangeChange(range)}
                            className={cn(
                                "px-3 py-1 text-xs font-medium rounded-md transition-all",
                                selectedRange === range
                                    ? "bg-background shadow-sm text-foreground"
                                    : "text-muted-foreground hover:text-foreground hover:bg-background/50"
                            )}
                        >
                            {range === 'BUY' ? 'Seit Kauf' : range}
                        </button>
                    ))}
                </div>
            </div>

            <div className="h-[300px] w-full -ml-2 min-h-[300px] min-w-0">
                {hasMounted && (
                    <ResponsiveContainer width="100%" height="100%" debounce={100} minWidth={1} minHeight={1}>
                        <AreaChart data={data}>
                            <defs>
                                <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor={isPositive ? "#22c55e" : "#ef4444"} stopOpacity={0.1} />
                                    <stop offset="95%" stopColor={isPositive ? "#22c55e" : "#ef4444"} stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.1} />
                            <XAxis
                                dataKey="date"
                                hide={false}
                                tick={{ fontSize: 10, fill: '#888' }}
                                tickLine={false}
                                axisLine={false}
                                minTickGap={30}
                                tickFormatter={(value) => {
                                    const date = new Date(value);
                                    if (selectedRange === '1D') {
                                        return date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
                                    } else if (selectedRange === '5Y') {
                                        return date.getFullYear().toString();
                                    }
                                    return date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
                                }}
                            />
                            <YAxis
                                domain={['auto', 'auto']}
                                hide={false}
                                orientation="right"
                                tick={{ fontSize: 10, fill: '#888' }}
                                tickFormatter={(val) => formatCurrency(val, currency)}
                                axisLine={false}
                                tickLine={false}
                                width={95}
                            />
                            <Tooltip
                                content={({ active, payload }) => {
                                    if (active && payload && payload.length) {
                                        const date = new Date(payload[0].payload.date);
                                        const isToday = new Date().toDateString() === date.toDateString();

                                        return (
                                            <div className="bg-popover border border-border p-3 rounded-lg shadow-lg text-sm">
                                                <p className="text-muted-foreground mb-1">
                                                    {selectedRange === '1D' ? (
                                                        <>
                                                            {date.toLocaleDateString('de-DE', {
                                                                weekday: 'short',
                                                                day: '2-digit',
                                                                month: '2-digit',
                                                                year: 'numeric'
                                                            })}
                                                            {!isToday && <span className="ml-1 text-orange-500 font-medium">(Letzter Handelstag)</span>}
                                                            <br />
                                                            <span className="text-xs">
                                                                {date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr
                                                            </span>
                                                        </>
                                                    ) : (
                                                        date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
                                                    )}
                                                </p>
                                                <div className="space-y-1">
                                                    <div className="flex items-center gap-2 justify-between">
                                                        <span className="text-muted-foreground text-xs">Kurs:</span>
                                                        <span className="font-bold text-foreground">
                                                            {formatCurrency(payload[0].value as number, currency)}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    }
                                    return null;
                                }}
                            />
                            <Area
                                type="monotone"
                                dataKey="value"
                                stroke={isPositive ? "#22c55e" : "#ef4444"}
                                strokeWidth={2}
                                fillOpacity={1}
                                fill="url(#colorValue)"
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                )}
            </div>
            <p className="text-[10px] text-muted-foreground text-center mt-2 italic">
                {historyData && historyData.length > 0 ? '* Reale Marktdaten von Yahoo Finance' : '* Simulierter Chartverlauf (Demo-Modus)'}
            </p>
        </div>
    );
}
