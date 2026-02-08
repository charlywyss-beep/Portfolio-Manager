import { useMemo, useState, useEffect } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine, Dot } from 'recharts';
import { useCurrencyFormatter } from '../utils/currency';
import { Ruler, X } from 'lucide-react';
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
    purchasePrice?: number;
    sellLimit?: number;
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
    isMarketOpen = true,
    purchasePrice,
    sellLimit
}: PriceHistoryChartProps) {
    const [hasMounted, setHasMounted] = useState(false);
    const [isMeasureMode, setIsMeasureMode] = useState(false);
    const [measurePoints, setMeasurePoints] = useState<{ date: string; value: number }[]>([]);

    useEffect(() => {
        setHasMounted(true);
    }, []);

    // Reset measure points when mode is toggled or range changes
    useEffect(() => {
        setMeasurePoints([]);
    }, [isMeasureMode, selectedRange]);
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

    // For BUY, use the actual purchase price for accurate performance (vs Portfolio)
    if (selectedRange === 'BUY' && purchasePrice && purchasePrice > 0) {
        startPrice = purchasePrice;
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

    // Calculate Domain
    let calcMin = minPrice;
    let calcMax = maxPrice;

    // Smart Scaling for 'Seit Kauf':
    // Only expand to show purchasePrice if it doesn't compress the data too much.
    // If the data range becomes < 15% of the total range (due to a far-away purchase price),
    // we prioritize showing the curve details over the purchase line.
    if (selectedRange === 'BUY' && purchasePrice && purchasePrice > 0) {
        const potentialMin = Math.min(calcMin, purchasePrice);
        const potentialMax = Math.max(calcMax, purchasePrice);

        const dataRange = calcMax - calcMin;
        const potentialRange = potentialMax - potentialMin;

        // If dataRange is 0 (flat line), we expand anyway to show something.
        // Otherwise, checking compression ratio.
        if (dataRange === 0 || (dataRange / potentialRange) > 0.15) {
            calcMin = potentialMin;
            calcMax = potentialMax;
        }
    }

    const range = calcMax - calcMin;
    const padding = range === 0 ? calcMax * 0.05 : range * 0.05;
    const domainMin = Math.max(0, calcMin - padding);
    const domainMax = calcMax + padding;

    // SMA calculation logic
    const sma200Data = useMemo(() => {
        // Use historyData if available (source of truth), else generated 'data'
        const sourceData = historyData && historyData.length > 0 ? historyData : data;

        // Need at least 200 points + 1 to show a line
        if (sourceData.length < 200) return null;

        const smaPoints: { date: string; value: number | null }[] = [];

        // Calculate SMA for every point possible
        for (let i = 0; i < sourceData.length; i++) {
            if (i < 199) {
                // Not enough history for this point
                smaPoints.push({ date: sourceData[i].date, value: null });
                continue;
            }
            // Average of last 200 points (including current)
            const slice = sourceData.slice(i - 199, i + 1);
            const sum = slice.reduce((acc, curr) => acc + curr.value, 0);
            smaPoints.push({ date: sourceData[i].date, value: sum / 200 });
        }
        return smaPoints;
    }, [historyData, data]);

    // Filter display data based on selectedRange (Client-Side Slicing)
    const displayData = useMemo(() => {
        let displayPoints = [...data];

        // If '1Y' is selected but we fed 2Y data, slice it to last ~1Y
        // Assuming ~252 trading days per year
        if (selectedRange === '1Y' && displayPoints.length > 300) {
            displayPoints = displayPoints.slice(displayPoints.length - 255);
        }
        else if (selectedRange === '6M' && displayPoints.length > 180) {
            displayPoints = displayPoints.slice(displayPoints.length - 130);
        }
        else if (selectedRange === '3M' && displayPoints.length > 90) {
            displayPoints = displayPoints.slice(displayPoints.length - 65);
        }
        else if (selectedRange === '1M' && displayPoints.length > 30) {
            displayPoints = displayPoints.slice(displayPoints.length - 23);
        }

        // Merge SMA
        if (sma200Data) {
            return displayPoints.map(p => {
                const sma = sma200Data.find(s => s.date === p.date);
                return { ...p, sma200: sma ? sma.value : null };
            });
        }
        return displayPoints;
    }, [data, selectedRange, sma200Data]);

    const handleChartClick = (nextData: any) => {
        if (!isMeasureMode || !nextData || !nextData.activePayload) return;

        const point = {
            date: nextData.activePayload[0].payload.date,
            value: nextData.activePayload[0].payload.value
        };

        setMeasurePoints(prev => {
            if (prev.length >= 2) return [point];
            return [...prev, point];
        });
    };

    const measurement = useMemo(() => {
        if (measurePoints.length !== 2) return null;
        const [p1, p2] = [...measurePoints].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        const diff = p2.value - p1.value;
        const percent = (diff / p1.value) * 100;
        return { p1, p2, diff, percent };
    }, [measurePoints]);

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
                </div>
                {selectedRange === '1D' && historyData && historyData.length > 0 && (
                    <div className="mt-2 text-xs">
                        {(() => {
                            const displayDate = quoteDate || (data.length > 0 ? new Date(data[data.length - 1].date) : null);
                            if (!displayDate) return null;
                            const today = new Date();
                            const isToday = displayDate.toDateString() === today.toDateString();
                            const isDelayed = isToday && isMarketOpen && (today.getTime() - displayDate.getTime() > 15 * 60 * 1000);

                            let label = 'Schlusskurs';
                            if (isToday && isMarketOpen) {
                                label = isDelayed ? 'Verzögerte Daten' : 'Aktuelle Daten';
                            } else if (isToday && !isMarketOpen) {
                                label = 'Schlusskurs';
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
                                            ? <polyline points="20 6 9 17 4 12"></polyline>
                                            : (isDelayed
                                                ? <circle cx="12" cy="12" r="10"></circle>
                                                : <circle cx="12" cy="12" r="10"></circle>
                                            )
                                        }
                                        {isDelayed && <path d="M12 6v6l4 2"></path>}
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

            <div className="flex bg-muted/50 p-0.5 rounded-lg mb-4 items-center overflow-x-auto scroller-none">
                <div className="flex flex-1">
                    {(['1D', '1W', '1M', '3M', '6M', '1Y', '5Y', 'BUY'] as TimeRange[]).map((range) => (
                        <button
                            key={range}
                            onClick={() => handleRangeChange(range)}
                            className={cn(
                                "px-2 sm:px-3 py-1 text-xs font-medium rounded-md transition-all whitespace-nowrap",
                                selectedRange === range
                                    ? "bg-background shadow-sm text-foreground"
                                    : "text-muted-foreground hover:text-foreground hover:bg-background/50"
                            )}
                        >
                            {range === 'BUY' ? <><span className="sm:hidden">SK</span><span className="hidden sm:inline">Seit Kauf</span></> : range}
                        </button>
                    ))}
                </div>
                <div className="flex items-center gap-1 ml-2 border-l border-border/50 pl-2">
                    <button
                        onClick={() => setIsMeasureMode(!isMeasureMode)}
                        className={cn(
                            "p-1.5 rounded-md transition-all flex items-center gap-1.5",
                            isMeasureMode
                                ? "bg-primary text-primary-foreground shadow-sm"
                                : "text-muted-foreground hover:text-foreground hover:bg-muted"
                        )}
                        title="Messmodus: Zwei Punkte im Chart klicken für %-Vergleich"
                    >
                        <Ruler className="size-3.5" />
                        <span className="text-[10px] font-bold hidden sm:inline">Messen</span>
                    </button>
                </div>
            </div>

            {isMeasureMode && measurePoints.length > 0 && (
                <div className="absolute top-24 left-1/2 -translate-x-1/2 z-[100] animate-in fade-in slide-in-from-top-2">
                    <div className="bg-primary/90 backdrop-blur-md text-primary-foreground px-4 py-2 rounded-full shadow-xl border border-primary/20 flex items-center gap-3">
                        <div className="flex flex-col items-center leading-none">
                            {measurement ? (
                                <>
                                    <span className="text-sm font-black whitespace-nowrap">
                                        {measurement.percent > 0 ? '+' : ''}{measurement.percent.toFixed(2)}%
                                    </span>
                                    <span className="text-[10px] opacity-80 mt-0.5">
                                        {formatCurrency(measurement.diff, currency, true)}
                                    </span>
                                </>
                            ) : (
                                <span className="text-xs font-bold animate-pulse">
                                    {measurePoints.length === 1 ? 'Endpunkt wählen...' : 'Punkte wählen...'}
                                </span>
                            )}
                        </div>
                        <button
                            onClick={() => setMeasurePoints([])}
                            className="bg-white/20 hover:bg-white/30 p-1 rounded-full transition-colors"
                        >
                            <X className="size-3" />
                        </button>
                    </div>
                </div>
            )}

            <div className="h-[300px] w-full min-h-[300px] min-w-0">
                {hasMounted && (
                    <ResponsiveContainer width="100%" height="100%" debounce={100} minWidth={1} minHeight={1}>
                        <AreaChart
                            data={displayData}
                            margin={{ top: 5, right: 5, left: 0, bottom: 5 }}
                            onClick={handleChartClick}
                            style={{ cursor: isMeasureMode ? 'crosshair' : 'default' }}
                        >
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
                                tick={{ fontSize: 10, fill: '#e2e8f0' }}
                                tickLine={false}
                                axisLine={false}
                                padding={{ left: 16, right: 16 }} // Fix label clipping (e.g. 05.01 -> .01)
                                // X-Axis Tick Formatter
                                tickFormatter={(str) => {
                                    const date = new Date(str);
                                    if (selectedRange === '1D') {
                                        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                                    } else if (selectedRange === '1W') {
                                        // 1W View: Format as "dd.MM" (No trailing dot, user request)
                                        // e.g. "05.01"
                                        return `${date.getDate().toString().padStart(2, '0')}.${(date.getMonth() + 1).toString().padStart(2, '0')}`;
                                    } else if (selectedRange === '1Y' || selectedRange === '5Y') {
                                        return date.toLocaleDateString([], { month: '2-digit', year: '2-digit' });
                                    }
                                    return date.toLocaleDateString([], { day: '2-digit', month: '2-digit' });
                                }}
                                // STRICT DAILY TICKS (v3.12.111)
                                // Filter ticks to ensure EXACTLY one label per day for 1W view.
                                ticks={selectedRange === '1W' && data.length > 0 ? (() => {
                                    const ticks: string[] = [];
                                    const seenDays = new Set<string>();
                                    // Iterate normally (forward)
                                    for (const point of data) {
                                        const date = new Date(point.date);
                                        // Use ISO string (YYYY-MM-DD) for strict day uniqueness, independent of locale/time
                                        const dayKey = date.toISOString().slice(0, 10);
                                        if (!seenDays.has(dayKey)) {
                                            seenDays.add(dayKey);
                                            ticks.push(point.date);
                                        }
                                    }
                                    return ticks;
                                })() : undefined}
                                minTickGap={selectedRange === '1W' ? 0 : 30} // 0 because we handle ticks manually
                                interval={selectedRange === '1W' ? 0 : 'preserveStartEnd'} // Force ALL ticks for 1W to ensure Friday shows up
                            />
                            <YAxis
                                domain={[domainMin, domainMax]}
                                hide={false}
                                orientation="right"
                                tick={{ fontSize: 10, fill: '#e2e8f0' }}
                                tickFormatter={(val) => {
                                    return new Intl.NumberFormat('de-CH', {
                                        minimumFractionDigits: 2,
                                        maximumFractionDigits: 2,
                                    }).format(val);
                                }}
                                axisLine={false}
                                tickLine={false}
                                width={40}
                                mirror={false}
                            />
                            {purchasePrice && (
                                <ReferenceLine
                                    y={purchasePrice}
                                    stroke="#3b82f6"
                                    strokeDasharray="3 3"
                                    label={{
                                        position: 'right',
                                        value: 'Kauf',
                                        fill: '#3b82f6',
                                        fontSize: 10
                                    }}
                                />
                            )}
                            {sellLimit && (
                                <ReferenceLine
                                    y={sellLimit}
                                    stroke="#dc2626"
                                    strokeDasharray="3 3"
                                    label={{
                                        position: 'right',
                                        value: 'Stop',
                                        fill: '#dc2626',
                                        fontSize: 10
                                    }}
                                />
                            )}

                            {/* Measurement Reference Lines */}
                            {measurePoints.map((p, i) => (
                                <ReferenceLine
                                    key={`measure-${i}`}
                                    x={p.date}
                                    stroke="#ffffff"
                                    strokeWidth={2}
                                />
                            ))}
                            {measurement && (
                                <ReferenceLine
                                    y={measurement.p1.value}
                                    stroke="#ffffff"
                                    strokeDasharray="3 3"
                                    opacity={0.3}
                                />
                            )}
                            {measurement && (
                                <ReferenceLine
                                    y={measurement.p2.value}
                                    stroke="#ffffff"
                                    strokeDasharray="3 3"
                                    opacity={0.3}
                                />
                            )}
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
                                                    {payload[0].payload.sma200 && (
                                                        <div className="flex items-center gap-2 justify-between">
                                                            <span className="text-amber-400 text-xs font-medium">SMA 200:</span>
                                                            <span className="font-bold text-foreground">
                                                                {formatCurrency(payload[0].payload.sma200, currency)}
                                                            </span>
                                                        </div>
                                                    )}
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
                            {/* SMA 200 Line */}
                            <Area
                                type="monotone"
                                dataKey="sma200"
                                stroke="#fbbf24" // Amber-400
                                strokeWidth={2}
                                strokeDasharray="5 5"
                                fill="none"
                                connectNulls
                                isAnimationActive={false}
                                activeDot={{ r: 4, fill: '#fbbf24' }}
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
