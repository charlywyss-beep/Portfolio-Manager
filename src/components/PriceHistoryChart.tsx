
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
    isRealtime?: boolean;
    quoteDate?: Date | null;
    previousClose?: number;
    isMarketOpen?: boolean;
}

export function PriceHistoryChart({
    currentPrice,
    currency,
    volatility = 0.02,
    trend = 'up',
    historyData,
    selectedRange = '1Y',
    onRangeChange,
    quoteDate,
    previousClose,
    isMarketOpen = true
}: PriceHistoryChartProps) {
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
        if (historyData && historyData.length > 0) {
            return historyData;
        }

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

        for (let i = 0; i < iterations; i++) {
            const date = new Date(now);
            date.setTime(date.getTime() - (i * intervalHours * 60 * 60 * 1000));

            // Skip weekends for daily data if interval is >= 24h
            if (intervalHours >= 24) {
                if (date.getDay() === 0 || date.getDay() === 6) continue;
            }

            // Random walk
            const change = 1 + (Math.random() * volatility * 2 - volatility);

            let bias = 0;
            if (trend === 'up') bias = -0.0005;
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
    let startPrice = data[0]?.value || 0;

    // For 1D, force startPrice to be Previous Close if available, to match "Daily Change" logic
    if (selectedRange === '1D' && previousClose && previousClose > 0) {
        startPrice = previousClose;
    }

    let endPrice = data[data.length - 1]?.value || 0;
    // For 1D, force endPrice to be currentPrice to match the List/Quote (avoid chart data lag)
    if (selectedRange === '1D' && currentPrice > 0) {
        endPrice = currentPrice;
    }

    const performance = startPrice !== 0 ? ((endPrice - startPrice) / startPrice) * 100 : 0;
    const isPositive = performance >= 0;

    // Calculate Difference (Native)
    const diffNative = endPrice - startPrice;

    // Format native difference
    const diffNativeFormatted = (diffNative > 0 ? '+' : '') + formatCurrency(diffNative, currency, false);

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
                                <span className="ml-2 opacity-80 text-lg">{diffNativeFormatted}</span>
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
                    {/* Date Indicator for 1D Chart - Only show for REAL data */}
                    {selectedRange === '1D' && historyData && historyData.length > 0 && (
                        <div className="mt-2 text-xs">
                            {(() => {
                                // Priority 1: Use Quote Date if available (Realtime)
                                const displayDate = quoteDate || (data.length > 0 ? new Date(data[data.length - 1].date) : null);

                                if (!displayDate) return null; // Don't show anything if no date

                                const today = new Date();
                                const isToday = displayDate.toDateString() === today.toDateString();

                                // User Rule:
                                // Green = ONLY if date is strictly TODAY (Tagesaktuell) AND Market Open
                                // Red = Closing price (Schlusskurs) of previous days OR if market is explicitly closed
                                // Yellow = Delayed



                                // Check for delay (greater than 15 minutes) - Only relevant if market is open
                                const isDelayed = isToday && isMarketOpen && (today.getTime() - displayDate.getTime() > 15 * 60 * 1000);

                                let label = 'Schlusskurs';
                                if (isToday && isMarketOpen) {
                                    label = isDelayed ? 'Verzögerte Daten' : 'Aktuelle Daten';
                                } else if (isToday && !isMarketOpen) {
                                    label = 'Schlusskurs'; // Today but closed (e.g. early close)
                                }

                                return (
                                    <div className={cn(
                                        "inline-flex items-center gap-1.5 px-2 py-1 rounded-md font-medium",
                                        (isToday && isMarketOpen)
                                            ? (isDelayed ? "bg-yellow-100 dark:bg-yellow-500/20 text-yellow-950 dark:text-yellow-200" : "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400")
                                            : "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400"
                                    )}>
                                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            {(isToday && isMarketOpen && !isDelayed)
                                                ? <polyline points="20 6 9 17 4 12"></polyline> // Checkmark for Realtime Open
                                                : (isDelayed
                                                    ? <circle cx="12" cy="12" r="10"></circle>  // Circle for Delayed
                                                    : <circle cx="12" cy="12" r="10"></circle>  // Circle for Closed
                                                )
                                            }
                                            {isDelayed && <path d="M12 6v6l4 2"></path>} {/* Clock icon for delay */}
                                        </svg>
                                        <span>
                                            {label} {displayDate.toLocaleDateString('de-DE', {
                                                day: '2-digit',
                                                month: '2-digit',
                                                year: 'numeric',
                                                hour: '2-digit',
                                                minute: '2-digit'
                                            })} Uhr
                                        </span>
                                    </div>
                                );
                            })()}
                        </div>
                    )}
                </div>

                <div className="flex bg-muted/50 p-0.5 rounded-lg">
                    {(['1D', '1W', '1M', '3M', '6M', '1Y', '5Y', 'BUY'] as TimeRange[]).map((range) => (
                        <button
                            key={range}
                            onClick={() => handleRangeChange(range)}
                            className={cn(
                                "px-2 sm:px-3 py-1 text-xs font-medium rounded-md transition-all",
                                selectedRange === range
                                    ? "bg-background shadow-sm text-foreground"
                                    : "text-muted-foreground hover:text-foreground hover:bg-background/50"
                            )}
                        >
                            {range === 'BUY' ? <><span className="sm:hidden">SK</span><span className="hidden sm:inline">Seit Kauf</span></> : range}
                        </button>
                    ))}
                </div>
            </div>

            <div className="h-[300px] w-full min-h-[300px] min-w-0">
                {hasMounted && (
                    <ResponsiveContainer width="100%" height="100%" debounce={100} minWidth={1} minHeight={1}>
                        <AreaChart data={data} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
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
                                tick={{ fontSize: 10, fill: '#888', dx: 5 }}
                                tickFormatter={(val) => formatCurrency(val, currency, false)}
                                axisLine={false}
                                tickLine={false}
                                width={85}
                                tickMargin={5}
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

        </div >
    );
}

