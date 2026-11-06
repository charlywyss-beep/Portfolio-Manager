import { useState, useEffect, useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { RefreshCcw } from 'lucide-react';
import { cn } from '../utils';

interface RateHistory {
    date: string;
    rate: number;
}

type Currency = 'EUR' | 'USD' | 'GBP';
type ChartTimeRange = '1W' | '1M' | '3M' | '6M' | '1Y' | '3Y' | '5Y';

import { fetchStockHistory } from '../services/yahoo-finance';

// Helper to get date string YYYY-MM-DD


interface Props {
    inverse?: boolean;
}

export function CurrencyChart({ inverse = false }: Props) {
    const storageKeyPrefix = inverse ? 'currency_chart_inverse' : 'currency_chart_direct';

    const [selectedCurrency, setSelectedCurrency] = useState<Currency>(() => {
        try {
            const saved = localStorage.getItem(`${storageKeyPrefix}_currency`);
            if (saved === 'EUR' || saved === 'USD' || saved === 'GBP') return saved as Currency;
        } catch {}
        return inverse ? 'GBP' : 'EUR';
    });

    const [historyData, setHistoryData] = useState<RateHistory[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [hasMounted, setHasMounted] = useState(false);

    useEffect(() => {
        setHasMounted(true);
    }, []);
    const [currRate, setCurrRate] = useState<number | null>(null);
    const [baseAmount, setBaseAmount] = useState<string>('1');
    const [convertedAmount, setConvertedAmount] = useState<string>('');

    // Derived values based on mode
    const baseCurrency = inverse ? selectedCurrency : 'CHF';
    const targetCurrency = inverse ? 'CHF' : selectedCurrency;

    const [timeRange, setTimeRange] = useState<ChartTimeRange>(() => {
        try {
            const saved = localStorage.getItem(`${storageKeyPrefix}_range`);
            if (saved && ['1W', '1M', '3M', '6M', '1Y', '5Y'].includes(saved)) {
                return saved as ChartTimeRange;
            }
        } catch {}
        return '1Y';
    });

    const handleSelectCurrency = (cur: Currency) => {
        setSelectedCurrency(cur);
        try {
            localStorage.setItem(`${storageKeyPrefix}_currency`, cur);
        } catch {}
    };

    const handleSelectTimeRange = (range: ChartTimeRange) => {
        setTimeRange(range);
        try {
            localStorage.setItem(`${storageKeyPrefix}_range`, range);
        } catch {}
    };

    useEffect(() => {
        const fetchHistory = async () => {
            setIsLoading(true);
            try {
                // Use our existing Yahoo Finance integration that handles proxying/CORS properly
                const symbol = `${baseCurrency}${targetCurrency}=X`;
                const { data } = await fetchStockHistory(symbol, timeRange as any);
                
                if (data && data.length > 0) {
                    const transformed = data.map((p: any) => {
                        // Extract just the YYYY-MM-DD from ISO string
                        const dateOnly = p.date.split('T')[0];
                        return {
                            date: dateOnly,
                            rate: p.value
                        };
                    });
                    
                    // Filter out duplicates: keep the latest rate of each day (closing/current rate)
                    const mapByDate = new Map<string, number>();
                    transformed.forEach((t: any) => {
                        mapByDate.set(t.date, t.rate);
                    });
                    const filtered = Array.from(mapByDate.entries()).map(([date, rate]) => ({ date, rate }));

                    setHistoryData(filtered);

                    if (filtered.length > 0) {
                        setCurrRate(filtered[filtered.length - 1].rate);
                    }
                } else {
                    setHistoryData([]);
                }
            } catch (error) {
                console.error("Failed to fetch currency history from Yahoo Finance:", error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchHistory();
    }, [selectedCurrency, inverse, timeRange]);

    // Calculate min/max for Y-Axis domain to make chart look dynamic
    const domain = useMemo(() => {
        if (historyData.length === 0) return [0, 1];
        const rates = historyData.map(d => d.rate);
        const min = Math.min(...rates) * 0.99; // 1% buffer
        const max = Math.max(...rates) * 1.01;
        return [min, max];
    }, [historyData]);

    const percentageChange = useMemo(() => {
        if (historyData.length < 2) return 0;
        const first = historyData[0].rate;
        const last = historyData[historyData.length - 1].rate;
        return ((last - first) / first) * 100;
    }, [historyData]);

    // Update converted amount when rate or base amount changes
    useEffect(() => {
        if (currRate && baseAmount) {
            const base = parseFloat(baseAmount) || 0;
            const converted = base * currRate;
            setConvertedAmount(converted.toFixed(2));
        }
    }, [currRate, baseAmount]);

    const handleBaseAmountChange = (value: string) => {
        setBaseAmount(value);
        if (currRate && value) {
            const base = parseFloat(value) || 0;
            const converted = base * currRate;
            setConvertedAmount(converted.toFixed(2));
        }
    };

    const handleConvertedAmountChange = (value: string) => {
        setConvertedAmount(value);
        if (currRate && value) {
            const converted = parseFloat(value) || 0;
            const base = converted / currRate;
            setBaseAmount(base.toFixed(2));
        }
    };

    const formatXAxisDate = (date: string) => {
        if (!date) return '';
        const d = new Date(date.includes('T') ? date : date + 'T12:00:00');
        if (isNaN(d.getTime())) return date;
        if (timeRange === '1W') {
            const days = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
            const w = days[d.getDay()];
            const dd = String(d.getDate()).padStart(2, '0');
            const mm = String(d.getMonth() + 1).padStart(2, '0');
            const yy = String(d.getFullYear()).slice(-2);
            return `${w} ${dd}.${mm}.${yy}`;
        }
        if (timeRange === '1M' || timeRange === '3M') {
            return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
        }
        return d.toLocaleDateString('de-DE', { month: 'short', year: '2-digit' });
    };

    return (
        <div className="p-6 rounded-xl bg-card border border-border shadow-sm h-full flex flex-col">
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4 md:gap-0">
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400 shrink-0">
                        <RefreshCcw className="size-6" />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold">{inverse ? 'Kurs in CHF' : 'Wechselkurse'}</h3>
                        <div className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-primary/10 text-primary mt-1 whitespace-nowrap">
                            Basis: 1 {baseCurrency}
                        </div>
                    </div>
                </div>

                {/* Currency Tabs */}
                <div className="flex bg-muted/50 rounded-lg p-1 self-start md:self-auto">
                    {(['EUR', 'USD', 'GBP'] as Currency[]).map((cur) => (
                        <button
                            key={cur}
                            onClick={() => handleSelectCurrency(cur)}
                            className={cn(
                                "px-3 py-1 text-xs font-medium rounded-md transition-all",
                                selectedCurrency === cur
                                    ? "bg-background text-foreground shadow-sm"
                                    : "text-muted-foreground hover:text-foreground"
                            )}
                        >
                            {cur}
                        </button>
                    ))}
                </div>
            </div>

            <div className="mb-4">
                {currRate ? (
                    <>
                        {/* Currency Converter */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                            <div className="bg-muted/30 rounded-xl p-6 border border-border/50">
                                <label className="text-sm font-medium text-muted-foreground mb-2 block">{baseCurrency}</label>
                                <input
                                    type="number"
                                    value={baseAmount}
                                    onChange={(e) => handleBaseAmountChange(e.target.value)}
                                    onFocus={(e) => e.target.select()}
                                    className="w-full px-4 py-3 text-2xl font-bold rounded-lg bg-background text-foreground border border-input focus:outline-none focus:ring-2 focus:ring-primary/20"
                                    placeholder="0.00"
                                />
                            </div>
                            <div className="bg-muted/30 rounded-xl p-6 border border-border/50">
                                <label className="text-sm font-medium text-muted-foreground mb-2 block">{targetCurrency}</label>
                                <input
                                    type="number"
                                    value={convertedAmount}
                                    onChange={(e) => handleConvertedAmountChange(e.target.value)}
                                    onFocus={(e) => e.target.select()}
                                    className="w-full px-4 py-3 text-2xl font-bold rounded-lg bg-background text-foreground border border-input focus:outline-none focus:ring-2 focus:ring-primary/20"
                                    placeholder="0.00"
                                />
                            </div>
                        </div>

                        {/* Chart Header & Info */}
                        <div className="flex flex-col md:flex-row md:items-end justify-between mb-4 gap-4">
                            <div>
                                <h4 className="text-2xl font-bold tracking-tight mb-1">
                                    {currRate.toFixed(4)} <span className="text-sm text-muted-foreground font-medium">{targetCurrency}</span>
                                </h4>
                                <div className={cn(
                                    "inline-flex items-center text-sm font-bold",
                                    percentageChange >= 0
                                        ? "text-green-600 dark:text-green-400"
                                        : "text-red-600 dark:text-red-400"
                                )}>
                                    {percentageChange >= 0 ? '+' : ''}{percentageChange.toFixed(2)}% <span className="text-muted-foreground ml-1 font-normal">({timeRange.replace('Y', 'J')})</span>
                                </div>
                            </div>

                            {/* Timeframe Selector */}
                            <div className="flex bg-muted/50 p-1 rounded-lg">
                                {(['1W', '1M', '3M', '6M', '1Y', '3Y', '5Y'] as const).map((range) => (
                                    <button
                                        key={range}
                                        onClick={() => handleSelectTimeRange(range)}
                                        className={cn(
                                            "px-3 py-1 text-xs font-medium rounded-md transition-all",
                                            timeRange === range
                                                ? "bg-background shadow-sm text-foreground"
                                                : "text-muted-foreground hover:text-foreground hover:bg-background/50"
                                        )}
                                    >
                                        {range.replace('Y', 'J')}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="h-10 animate-pulse bg-muted rounded-md w-32" />
                )}
            </div>

            <div className="w-full h-[300px]">
                {isLoading ? (
                    <div className="w-full h-full flex items-center justify-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                    </div>
                ) : (
                    hasMounted && (
                        <ResponsiveContainer width="100%" height="100%" debounce={100} minWidth={1} minHeight={1}>
                            <AreaChart data={historyData} margin={{ top: 10, right: 6, left: -20, bottom: 0 }}>
                                <defs>
                                    <linearGradient id={inverse ? "colorRateInverse" : "colorRateDirect"} x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.2} />
                                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" opacity={0.5} />
                                <XAxis
                                    dataKey="date"
                                    interval={timeRange === '1W' ? 0 : 'preserveEnd'}
                                    minTickGap={timeRange === '1W' ? 0 : 30}
                                    tickLine={false}
                                    axisLine={false}
                                    tick={(props: any) => {
                                        const { x, y, payload, index } = props;
                                        const isFirst = index === 0;
                                        const isLast = index === (historyData.length - 1);
                                        const anchor = isLast ? 'end' : isFirst ? 'start' : 'middle';
                                        return (
                                            <text
                                                x={x}
                                                y={y + 12}
                                                textAnchor={anchor}
                                                fill="currentColor"
                                                opacity={0.6}
                                                fontSize={timeRange === '1W' ? 10 : 11}
                                            >
                                                {formatXAxisDate(payload.value)}
                                            </text>
                                        );
                                    }}
                                />
                                <YAxis
                                    domain={domain}
                                    tick={{ fontSize: 11, fill: 'currentColor', opacity: 0.5 }}
                                    tickFormatter={(val) => val.toFixed(2)}
                                    tickLine={false}
                                    axisLine={false}
                                />
                                <Tooltip
                                    contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }}
                                    itemStyle={{ color: 'hsl(var(--foreground))' }}
                                    labelFormatter={(date) => {
                                        if (!date) return '';
                                        const d = new Date(date.includes('T') ? date : date + 'T12:00:00');
                                        if (isNaN(d.getTime())) return date;
                                        const days = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
                                        const w = days[d.getDay()];
                                        return `${w}, ${d.toLocaleDateString('de-DE')}`;
                                    }}
                                    formatter={(value: number) => [value.toFixed(4), targetCurrency]}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="rate"
                                    stroke="hsl(var(--primary))"
                                    strokeWidth={2}
                                    fillOpacity={1}
                                    fill={`url(#${inverse ? "colorRateInverse" : "colorRateDirect"})`}
                                    animationDuration={500}
                                    activeDot={{ r: 4, strokeWidth: 2, fill: 'hsl(var(--background))' }}
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    )
                )}
            </div>
        </div>
    );
}
