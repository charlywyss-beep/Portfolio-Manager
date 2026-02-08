import { useMemo, useState, useEffect } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine } from 'recharts';
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
    stockName?: string;
    stockSymbol?: string;
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
    sellLimit,
    stockName,
    stockSymbol
}: PriceHistoryChartProps) {
    const [hasMounted, setHasMounted] = useState(false);
    const [isMeasureMode, setIsMeasureMode] = useState(false);
    const [isMaximized, setIsMaximized] = useState(false);
    const [measurePoints, setMeasurePoints] = useState<{ date: string; value: number }[]>([]);
    const [hoveredData, setHoveredData] = useState<{ date: string; value: number; sma200?: number | null } | null>(null);

    useEffect(() => {
        setHasMounted(true);
    }, []);

    // Reset measure points when mode is toggled or range changes
    useEffect(() => {
        setMeasurePoints([]);
        if (isMeasureMode) {
            setIsMaximized(true);
        } else {
            setIsMaximized(false);
        }
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

        // The API already provides the correct range based on selectedRange
        // No need to slice - just merge SMA data

        // Merge SMA
        if (sma200Data) {
            return displayPoints.map(p => {
                const sma = sma200Data.find(s => s.date === p.date);
                return { ...p, sma200: sma ? sma.value : null };
            });
        }
        return displayPoints;
    }, [data, selectedRange, sma200Data]);

    const measurement = useMemo(() => {
        if (measurePoints.length !== 2) return null;
        const [p1, p2] = [...measurePoints].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        const diff = p2.value - p1.value;
        const percent = (diff / p1.value) * 100;
        return { p1, p2, diff, percent };
    }, [measurePoints]);

    const chartContent = (
        <div className={cn(
            "w-full flex flex-col relative transition-all duration-300",
            isMaximized ? "h-full" : "h-[450px]"
        )}>
            <div className="flex flex-wrap items-center justify-between mb-4 gap-2">
                <div className="flex flex-col gap-1">
                    <div>
                        {stockName && (
                            <div className="flex items-baseline gap-2 mb-1">
                                <h4 className="text-xl md:text-2xl font-black tracking-tighter text-foreground drop-shadow-sm">
                                    {stockName}
                                </h4>
                                {stockSymbol && (
                                    <span className="text-xs font-bold text-muted-foreground/60 uppercase tracking-widest">
                                        {stockSymbol}
                                    </span>
                                )}
                            </div>
                        )}
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

            <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                <div className="flex bg-muted/50 p-0.5 rounded-lg items-center overflow-x-auto scroller-none max-w-full sm:max-w-fit">
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
                                "px-2 py-1 sm:px-3 sm:py-1.5 rounded-lg transition-all flex items-center gap-1.5 border font-medium text-[10px] sm:text-xs shadow-sm",
                                isMeasureMode
                                    ? "bg-blue-600 text-white border-blue-700 shadow-md"
                                    : "bg-blue-50 dark:bg-blue-900/10 text-blue-600 dark:text-blue-400 border-blue-100 dark:border-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/20"
                            )}
                            title="Messmodus: Zwei Punkte im Chart klicken für %-Vergleich"
                        >
                            <Ruler className="size-3.5" />
                            <span className="text-[10px] font-bold hidden sm:inline">Messen</span>
                        </button>
                    </div>

                </div>

                {/* Dynamic Header Info (Replaces Tooltip) - MOVED OUTSIDE SCROLL CONTAINER */}
                {hoveredData && (
                    <div className="flex justify-end items-center gap-4 text-[10px] sm:text-xs animate-in fade-in duration-200 z-[60] bg-background/80 backdrop-blur-sm p-1 rounded-lg border border-border/50 shadow-sm absolute right-0 top-[52px] sm:static sm:bg-transparent sm:border-0 sm:shadow-none sm:p-0">
                        <div className="flex flex-col items-end leading-tight">
                            <span className="font-medium text-foreground">
                                {(() => {
                                    const d = new Date(hoveredData.date);
                                    const weekday = d.toLocaleDateString('de-DE', { weekday: 'short' });
                                    const dateStr = d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' });
                                    return `${weekday} ${dateStr}`;
                                })()}
                            </span>
                            <span className="text-muted-foreground opacity-80">
                                {new Date(hoveredData.date).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                        </div>
                        <div className="h-6 w-px bg-border" />
                        <div className="flex flex-col items-end leading-tight">
                            <span className="font-bold tabular-nums">
                                {formatCurrency(hoveredData.value, currency)}
                            </span>
                            <span className="text-[10px] text-muted-foreground">Kurs</span>
                        </div>
                        {hoveredData.sma200 && (
                            <>
                                <div className="h-6 w-px bg-border" />
                                <div className="flex flex-col items-end leading-tight">
                                    <div className="flex items-center gap-1.5">
                                        <span className="font-bold tabular-nums text-foreground">
                                            {formatCurrency(hoveredData.sma200, currency)}
                                        </span>
                                        {(() => {
                                            const diff = ((hoveredData.value - hoveredData.sma200) / hoveredData.sma200) * 100;
                                            return (
                                                <span className={cn(
                                                    "font-bold tabular-nums",
                                                    diff >= 0 ? "text-green-500" : "text-red-500"
                                                )}>
                                                    {diff > 0 ? '+' : ''}{diff.toFixed(2)}%
                                                </span>
                                            );
                                        })()}
                                    </div>
                                    <span className="text-[10px] text-amber-500 font-medium">SMA 200</span>
                                </div>
                            </>
                        )}
                    </div>
                )}
            </div>

            {isMeasureMode && measurePoints.length > 0 && (
                <div className="absolute top-2 right-2 z-[100] animate-in fade-in slide-in-from-right-2">
                    <div className="bg-blue-600 dark:bg-blue-500 text-white px-4 py-3 rounded-xl shadow-2xl border border-blue-400/30 flex items-center gap-4">
                        <div className="flex flex-col items-center leading-tight">
                            {measurement ? (
                                <div className="flex items-center gap-4">
                                    <div className="flex flex-col items-center">
                                        <span className="text-xl font-black whitespace-nowrap">
                                            {measurement.percent > 0 ? '+' : ''}{measurement.percent.toFixed(2)}%
                                        </span>
                                        <span className="text-xs font-bold opacity-90">
                                            {formatCurrency(measurement.diff, currency, true)}
                                        </span>
                                    </div>
                                    <div className="h-8 w-px bg-white/20" />
                                    <div className="flex flex-col text-[10px] opacity-90 font-medium">
                                        <div className="flex justify-between gap-4">
                                            <span className="opacity-70">Von:</span>
                                            <span>
                                                {formatCurrency(measurement.p1.value, currency, false)}
                                                <span className="opacity-60 ml-1 text-[9px]">
                                                    ({new Date(measurement.p1.date).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })} {new Date(measurement.p1.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})
                                                </span>
                                            </span>
                                        </div>
                                        <div className="flex justify-between gap-4">
                                            <span className="opacity-70">Bis:</span>
                                            <span>
                                                {formatCurrency(measurement.p2.value, currency, false)}
                                                <span className="opacity-60 ml-1 text-[9px]">
                                                    ({new Date(measurement.p2.date).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })} {new Date(measurement.p2.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})
                                                </span>
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center">
                                    <span className="text-xs font-bold whitespace-nowrap">
                                        {measurePoints.length === 1 ? 'Endpunkt wählen...' : 'Punkte wählen...'}
                                    </span>
                                    <span className="text-[10px] opacity-70">Chart anklicken</span>
                                </div>
                            )}
                        </div>
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                setMeasurePoints([]);
                            }}
                            className="bg-white/20 hover:bg-white/40 p-1.5 rounded-full transition-colors"
                        >
                            <X className="size-4" />
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
                            onMouseMove={(data: any) => {
                                if (data?.activePayload?.[0]?.payload) {
                                    setHoveredData(data.activePayload[0].payload);
                                } else if (data?.activeLabel) {
                                    // Fallback if activePayload is missing but we have a label (date)
                                    // This can happen when moving fast
                                    const point = displayData.find(d => d.date === data.activeLabel);
                                    if (point) setHoveredData(point);
                                }
                            }}
                            onMouseLeave={() => setHoveredData(null)}
                            onClick={(data: any) => {
                                if (isMeasureMode && data?.activePayload?.[0]?.payload) {
                                    const clickedPoint = data.activePayload[0].payload;
                                    setMeasurePoints(prev => {
                                        if (prev.length >= 2) return [clickedPoint];
                                        return [...prev, clickedPoint];
                                    });
                                }
                            }}
                            style={{ cursor: isMeasureMode ? 'crosshair' : 'default' }}
                        >
                            <defs>
                                <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor={isPositive ? "#22c55e" : "#ef4444"} stopOpacity={0.1} />
                                    <stop offset="95%" stopColor={isPositive ? "#22c55e" : "#ef4444"} stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={true} opacity={0.1} />
                            <XAxis
                                dataKey="date"
                                hide={false}
                                tick={{ fontSize: 10, fill: '#e2e8f0' }}
                                tickLine={{ stroke: '#475569', strokeWidth: 1 }}
                                axisLine={{ stroke: '#475569', strokeWidth: 1 }}
                                padding={{ left: 16, right: 16 }}
                                tickFormatter={(str) => {
                                    const date = new Date(str);
                                    const weekdayShort = date.toLocaleDateString('de-DE', { weekday: 'short' });

                                    if (selectedRange === '1D') {
                                        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                                    } else if (selectedRange === '1W' || selectedRange === '1M' || selectedRange === '3M' || selectedRange === '6M') {
                                        // Show weekday + date (e.g. "Fr 06.02")
                                        const dayMonth = `${date.getDate().toString().padStart(2, '0')}.${(date.getMonth() + 1).toString().padStart(2, '0')}`;
                                        return `${weekdayShort} ${dayMonth}`;
                                    } else if (selectedRange === '1Y' || selectedRange === '5Y' || selectedRange === 'BUY') {
                                        // For yearly views, just show month/year (e.g. "02.25") - no weekday
                                        return `${(date.getMonth() + 1).toString().padStart(2, '0')}.${date.getFullYear().toString().slice(-2)}`;
                                    }
                                    return date.toLocaleDateString([], { day: '2-digit', month: '2-digit' });
                                }}
                                ticks={(() => {
                                    if (displayData.length === 0) return undefined;

                                    // 1W: One tick per day
                                    if (selectedRange === '1W') {
                                        const ticks: string[] = [];
                                        const seenDays = new Set<string>();
                                        for (const point of displayData) {
                                            const date = new Date(point.date);
                                            const dayKey = date.toISOString().slice(0, 10);
                                            if (!seenDays.has(dayKey)) {
                                                seenDays.add(dayKey);
                                                ticks.push(point.date);
                                            }
                                        }
                                        return ticks;
                                    }

                                    // 1M: Every Friday (5) - one tick per day
                                    if (selectedRange === '1M') {
                                        const ticks: string[] = [];
                                        const seenDays = new Set<string>();
                                        for (const point of displayData) {
                                            const date = new Date(point.date);
                                            const dayKey = date.toISOString().slice(0, 10);
                                            const dayOfWeek = date.getDay();

                                            if (dayOfWeek === 5 && !seenDays.has(dayKey)) {
                                                seenDays.add(dayKey);
                                                ticks.push(point.date);
                                            }
                                        }
                                        return ticks;
                                    }

                                    // 3M: Every Friday (5) - one tick per day
                                    if (selectedRange === '3M') {
                                        const ticks: string[] = [];
                                        const seenDays = new Set<string>();
                                        for (const point of displayData) {
                                            const date = new Date(point.date);
                                            const dayKey = date.toISOString().slice(0, 10);

                                            if (date.getDay() === 5 && !seenDays.has(dayKey)) {
                                                seenDays.add(dayKey);
                                                ticks.push(point.date);
                                            }
                                        }
                                        return ticks;
                                    }

                                    // 6M: Bi-weekly Fridays (every 2nd Friday)
                                    if (selectedRange === '6M') {
                                        const ticks: string[] = [];
                                        const seenDays = new Set<string>();
                                        let fridayCount = 0;

                                        // Go through data in REVERSE (newest first)
                                        for (let i = displayData.length - 1; i >= 0; i--) {
                                            const point = displayData[i];
                                            const date = new Date(point.date);
                                            const dayKey = date.toISOString().slice(0, 10);

                                            if (date.getDay() === 5 && !seenDays.has(dayKey)) {
                                                seenDays.add(dayKey);
                                                // Only take every 2nd Friday
                                                if (fridayCount % 2 === 0) {
                                                    ticks.unshift(point.date); // Add to front to keep order
                                                }
                                                fridayCount++;
                                            }
                                        }
                                        return ticks;
                                    }

                                    // 1Y / 5Y / BUY: Monthly first-trading-day points
                                    if (['1Y', '5Y', 'BUY'].includes(selectedRange)) {
                                        const monthlyFirstPoints: string[] = [];
                                        let currentMonth = -1;
                                        for (const point of displayData) {
                                            const d = new Date(point.date);
                                            const m = d.getMonth();
                                            if (m !== currentMonth) {
                                                monthlyFirstPoints.push(point.date);
                                                currentMonth = m;
                                            }
                                        }

                                        if (selectedRange === '1Y') return monthlyFirstPoints;

                                        // For 5Y/BUY: Every 3rd month, backtracking from the end
                                        const result: string[] = [];
                                        const gap = 3;
                                        for (let i = monthlyFirstPoints.length - 1; i >= 0; i -= gap) {
                                            result.unshift(monthlyFirstPoints[i]);
                                        }
                                        return result;
                                    }

                                    return undefined;
                                })()}
                                minTickGap={['1W', '1M', '3M', '6M', '1Y', '5Y', 'BUY'].includes(selectedRange) ? 0 : 30}
                                interval={['1W', '1M', '3M', '6M', '1Y', '5Y', 'BUY'].includes(selectedRange) ? 0 : 'preserveStartEnd'}
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
                                    stroke="#3b82f6"
                                    strokeWidth={3}
                                    strokeOpacity={1}
                                />
                            ))}
                            {measurement && (
                                <ReferenceLine
                                    y={measurement.p1.value}
                                    stroke="#3b82f6"
                                    strokeDasharray="4 4"
                                    strokeOpacity={0.6}
                                />
                            )}
                            {measurement && (
                                <ReferenceLine
                                    y={measurement.p2.value}
                                    stroke="#3b82f6"
                                    strokeDasharray="4 4"
                                    strokeOpacity={0.6}
                                />
                            )}
                            <Tooltip
                                content={() => null}
                                cursor={{ stroke: 'var(--primary)', strokeWidth: 1, strokeDasharray: '4 4' }}
                                isAnimationActive={false}
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
        </div>
    );

    if (isMaximized) {
        return (
            <div className="fixed inset-0 z-[2000] bg-background/95 backdrop-blur-sm p-4 md:p-8 animate-in zoom-in-95 duration-200 flex flex-col">
                <button
                    onClick={() => setIsMeasureMode(false)}
                    className="absolute top-6 right-6 z-[2010] p-2 bg-muted/50 hover:bg-red-500 hover:text-white rounded-full transition-all"
                >
                    <X className="size-6" />
                </button>
                <div className="flex-1 bg-card rounded-xl border border-border shadow-2xl overflow-hidden p-6">
                    {chartContent}
                </div>
            </div>
        );
    }

    return chartContent;
}
