import { useState, useEffect, useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { RefreshCcw, ArrowLeftRight, X, ArrowDown } from 'lucide-react';
import { cn } from '../utils';
import { fetchStockHistory } from '../services/yahoo-finance';
import { useExchangeRates } from '../context/ExchangeRateContext';

interface RateHistory {
    date: string;
    rate: number;
}

export type CurrencyCode = 'CHF' | 'EUR' | 'USD' | 'GBP';
type ChartTimeRange = '1W' | '1M' | '3M' | '6M' | '1Y' | '3Y' | '5Y';

const CURRENCIES: CurrencyCode[] = ['CHF', 'EUR', 'USD', 'GBP'];
const VALID_RANGES: ChartTimeRange[] = ['1W', '1M', '3M', '6M', '1Y', '3Y', '5Y'];

function isCurrencyCode(val: string | null): val is CurrencyCode {
    return val === 'CHF' || val === 'EUR' || val === 'USD' || val === 'GBP';
}

interface Props {
    inverse?: boolean;
    onTransferToShareCalc?: (amount: string, currency: CurrencyCode) => void;
}

export function CurrencyChart({ inverse = false, onTransferToShareCalc }: Props) {
    const storageKeyPrefix = inverse ? 'currency_chart_inverse' : 'currency_chart_direct';
    const { rates } = useExchangeRates();

    const [baseCurrency, setBaseCurrency] = useState<CurrencyCode>(() => {
        try {
            const savedBase = localStorage.getItem(`${storageKeyPrefix}_base`);
            if (isCurrencyCode(savedBase)) return savedBase;
            const legacyCur = localStorage.getItem(`${storageKeyPrefix}_currency`);
            if (inverse && isCurrencyCode(legacyCur) && legacyCur !== 'CHF') return legacyCur;
        } catch {}
        return inverse ? 'GBP' : 'CHF';
    });

    const [targetCurrency, setTargetCurrency] = useState<CurrencyCode>(() => {
        try {
            const savedTarget = localStorage.getItem(`${storageKeyPrefix}_target`);
            if (isCurrencyCode(savedTarget)) return savedTarget;
            const legacyCur = localStorage.getItem(`${storageKeyPrefix}_currency`);
            if (!inverse && isCurrencyCode(legacyCur) && legacyCur !== 'CHF') return legacyCur;
        } catch {}
        return inverse ? 'CHF' : 'USD';
    });

    const [historyData, setHistoryData] = useState<RateHistory[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [hasMounted, setHasMounted] = useState(false);

    useEffect(() => {
        setHasMounted(true);
    }, []);

    const [currRate, setCurrRate] = useState<number | null>(null);
    const [baseAmount, setBaseAmount] = useState<string>(() => {
        try {
            const saved = localStorage.getItem(`${storageKeyPrefix}_amount`);
            if (saved !== null) return saved;
        } catch {}
        return '1';
    });
    const [convertedAmount, setConvertedAmount] = useState<string>('');
    const [lastEdited, setLastEdited] = useState<'base' | 'target'>('base');

    useEffect(() => {
        try {
            localStorage.setItem(`${storageKeyPrefix}_amount`, baseAmount);
        } catch {}
    }, [storageKeyPrefix, baseAmount]);

    const [timeRange, setTimeRange] = useState<ChartTimeRange>(() => {
        try {
            const saved = localStorage.getItem(`${storageKeyPrefix}_range`);
            if (saved && VALID_RANGES.includes(saved as ChartTimeRange)) {
                return saved as ChartTimeRange;
            }
        } catch {}
        return '1Y';
    });

    // Cross-rate from ExchangeRateContext (used as instant fallback & for the other 2 currencies strip)
    const getCrossRate = (from: CurrencyCode, to: CurrencyCode): number | null => {
        if (from === to) return 1;
        const rFrom = rates[from];
        const rTo = rates[to];
        if (!rFrom || !rTo || rFrom <= 0) return null;
        return rTo / rFrom;
    };

    const persistPair = (nextBase: CurrencyCode, nextTarget: CurrencyCode) => {
        try {
            localStorage.setItem(`${storageKeyPrefix}_base`, nextBase);
            localStorage.setItem(`${storageKeyPrefix}_target`, nextTarget);
        } catch {}
    };

    const handleSelectBase = (cur: CurrencyCode) => {
        if (cur === baseCurrency) return;
        const nextTarget = cur === targetCurrency ? baseCurrency : targetCurrency;
        setBaseCurrency(cur);
        setTargetCurrency(nextTarget);
        setLastEdited('base');
        persistPair(cur, nextTarget);
    };

    const handleSelectTarget = (cur: CurrencyCode) => {
        if (cur === targetCurrency) return;
        const nextBase = cur === baseCurrency ? targetCurrency : baseCurrency;
        setBaseCurrency(nextBase);
        setTargetCurrency(cur);
        setLastEdited('base');
        persistPair(nextBase, cur);
    };

    const handleSwapCurrencies = () => {
        const nextBase = targetCurrency;
        const nextTarget = baseCurrency;
        setBaseCurrency(nextBase);
        setTargetCurrency(nextTarget);
        setLastEdited('base');
        persistPair(nextBase, nextTarget);
    };

    const handleSelectTimeRange = (range: ChartTimeRange) => {
        setTimeRange(range);
        try {
            localStorage.setItem(`${storageKeyPrefix}_range`, range);
        } catch {}
    };

    useEffect(() => {
        let isCancelled = false;

        const fetchHistory = async () => {
            setIsLoading(true);
            try {
                const symbol = `${baseCurrency}${targetCurrency}=X`;
                let { data } = await fetchStockHistory(symbol, timeRange as any);
                let inverted = false;

                // Automatic inverse fallback if direct Yahoo FX pair returns empty
                if (!data || data.length === 0) {
                    const invSymbol = `${targetCurrency}${baseCurrency}=X`;
                    const invRes = await fetchStockHistory(invSymbol, timeRange as any);
                    if (invRes.data && invRes.data.length > 0) {
                        data = invRes.data;
                        inverted = true;
                    }
                }

                if (isCancelled) return;

                if (data && data.length > 0) {
                    const mapByDate = new Map<string, number>();
                    data.forEach((p: any) => {
                        const dateOnly = p.date.split('T')[0];
                        const val = inverted ? (p.value > 0 ? 1 / p.value : 0) : p.value;
                        if (val > 0 && isFinite(val)) {
                            mapByDate.set(dateOnly, val);
                        }
                    });
                    const filtered = Array.from(mapByDate.entries()).map(([date, rate]) => ({ date, rate }));
                    setHistoryData(filtered);
                    if (filtered.length > 0) {
                        setCurrRate(filtered[filtered.length - 1].rate);
                    }
                } else {
                    setHistoryData([]);
                    const fallbackRate = getCrossRate(baseCurrency, targetCurrency);
                    if (fallbackRate) setCurrRate(fallbackRate);
                }
            } catch (error) {
                console.error("Failed to fetch currency history from Yahoo Finance:", error);
                if (!isCancelled) {
                    const fallbackRate = getCrossRate(baseCurrency, targetCurrency);
                    if (fallbackRate) setCurrRate(fallbackRate);
                }
            } finally {
                if (!isCancelled) {
                    setIsLoading(false);
                }
            }
        };

        fetchHistory();

        return () => {
            isCancelled = true;
        };
    }, [baseCurrency, targetCurrency, timeRange]);

    const effectiveRate = currRate ?? getCrossRate(baseCurrency, targetCurrency);

    // Calculate min/max for Y-Axis domain to make chart look dynamic
    const domain = useMemo(() => {
        if (historyData.length === 0) return [0, 1];
        const rateVals = historyData.map(d => d.rate);
        const min = Math.min(...rateVals) * 0.99;
        const max = Math.max(...rateVals) * 1.01;
        return [min, max];
    }, [historyData]);

    const percentageChange = useMemo(() => {
        if (historyData.length < 2) return 0;
        const first = historyData[0].rate;
        const last = historyData[historyData.length - 1].rate;
        return first > 0 ? ((last - first) / first) * 100 : 0;
    }, [historyData]);

    // Sync converted amount when rate changes
    useEffect(() => {
        if (!effectiveRate) return;
        if (lastEdited === 'base') {
            if (baseAmount === '') {
                setConvertedAmount('');
            } else {
                const base = parseFloat(baseAmount) || 0;
                setConvertedAmount((base * effectiveRate).toFixed(2));
            }
        } else {
            if (convertedAmount === '') {
                setBaseAmount('');
            } else {
                const conv = parseFloat(convertedAmount) || 0;
                setBaseAmount((conv / effectiveRate).toFixed(2));
            }
        }
    }, [effectiveRate]);

    const handleBaseAmountChange = (value: string) => {
        setLastEdited('base');
        setBaseAmount(value);
        if (value === '') {
            setConvertedAmount('');
            return;
        }
        if (effectiveRate) {
            const base = parseFloat(value) || 0;
            setConvertedAmount((base * effectiveRate).toFixed(2));
        }
    };

    const handleConvertedAmountChange = (value: string) => {
        setLastEdited('target');
        setConvertedAmount(value);
        if (value === '') {
            setBaseAmount('');
            return;
        }
        if (effectiveRate) {
            const converted = parseFloat(value) || 0;
            setBaseAmount((converted / effectiveRate).toFixed(2));
        }
    };

    // Quick conversions for the remaining 2 currencies
    const otherCurrencies = useMemo(() => {
        const amount = parseFloat(baseAmount);
        const numericBase = isFinite(amount) ? amount : 0;
        return CURRENCIES.filter(c => c !== baseCurrency && c !== targetCurrency)
            .map(cur => {
                const cross = getCrossRate(baseCurrency, cur);
                return {
                    currency: cur,
                    rate: cross,
                    value: cross !== null ? numericBase * cross : null
                };
            });
    }, [baseAmount, baseCurrency, targetCurrency, rates]);

    const numericConverted = parseFloat(convertedAmount);
    const canTransferBudget = Boolean(onTransferToShareCalc) && Number.isFinite(numericConverted) && numericConverted > 0;

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
        <div className="p-5 sm:p-6 rounded-xl bg-card border border-border shadow-sm h-full flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
                <div className="flex items-center gap-3 min-w-0">
                    <div className="p-2 rounded-lg bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400 shrink-0">
                        <RefreshCcw className="size-5" />
                    </div>
                    <div className="min-w-0">
                        <h3 className="text-base sm:text-lg font-bold leading-tight truncate">
                            Wechselkurs {baseCurrency} / {targetCurrency}
                        </h3>
                        <div className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-primary/10 text-primary mt-1 whitespace-nowrap font-mono tabular-nums">
                            {effectiveRate ? `1 ${baseCurrency} = ${effectiveRate.toFixed(4)} ${targetCurrency}` : `Basis 1 ${baseCurrency}`}
                        </div>
                    </div>
                </div>
            </div>

            <div className="mb-4">
                {effectiveRate ? (
                    <>
                        {/* Bidirectional Free-Choice Currency Converter */}
                        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-2.5 sm:gap-3 items-center mb-3">
                            {/* Base (Von) */}
                            <div className="bg-muted/30 rounded-xl p-3.5 sm:p-4 border border-border/60 space-y-2.5">
                                <div className="flex items-center justify-between gap-2">
                                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Von</span>
                                    <div className="inline-flex items-center bg-muted/70 rounded-lg p-0.5 gap-0.5">
                                        {CURRENCIES.map((cur) => (
                                            <button
                                                key={cur}
                                                type="button"
                                                onClick={() => handleSelectBase(cur)}
                                                className={cn(
                                                    "h-7 inline-flex items-center justify-center leading-none px-2 py-0 text-xs font-bold rounded-md transition-all cursor-pointer whitespace-nowrap",
                                                    baseCurrency === cur
                                                        ? "bg-background text-foreground shadow-sm border border-border/70"
                                                        : "text-muted-foreground hover:text-foreground border border-transparent"
                                                )}
                                            >
                                                {cur}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <div className="relative">
                                    <input
                                        type="number"
                                        inputMode="decimal"
                                        value={baseAmount}
                                        onChange={(e) => handleBaseAmountChange(e.target.value)}
                                        onKeyDown={(e) => { if (e.key === 'ArrowUp' || e.key === 'ArrowDown') e.preventDefault(); }}
                                        onFocus={(e) => e.target.select()}
                                        className="w-full h-11 pl-3.5 pr-20 py-2 text-lg sm:text-xl font-bold font-mono tabular-nums rounded-lg bg-background text-foreground border border-input focus:outline-none focus:ring-2 focus:ring-primary/25 no-spinner"
                                        placeholder="0.00"
                                    />
                                    <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                                        {baseAmount !== '' && (
                                            <button
                                                type="button"
                                                onClick={() => handleBaseAmountChange('')}
                                                className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                                                title="Betrag leeren"
                                                aria-label="Betrag leeren"
                                            >
                                                <X className="size-3.5" />
                                            </button>
                                        )}
                                        <span className="text-xs font-bold text-muted-foreground pointer-events-none">
                                            {baseCurrency}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Swap Button */}
                            <div className="flex justify-center">
                                <button
                                    type="button"
                                    onClick={handleSwapCurrencies}
                                    className="size-9 inline-flex items-center justify-center rounded-xl border border-border bg-card hover:bg-primary/10 hover:text-primary hover:border-primary/40 text-muted-foreground shadow-xs transition-all active:scale-95 cursor-pointer"
                                    title={`${baseCurrency} und ${targetCurrency} tauschen`}
                                    aria-label="Währungen tauschen"
                                >
                                    <ArrowLeftRight className="size-4" />
                                </button>
                            </div>

                            {/* Target (Nach) */}
                            <div className="bg-muted/30 rounded-xl p-3.5 sm:p-4 border border-border/60 space-y-2.5">
                                <div className="flex items-center justify-between gap-2">
                                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Nach</span>
                                    <div className="inline-flex items-center bg-muted/70 rounded-lg p-0.5 gap-0.5">
                                        {CURRENCIES.map((cur) => (
                                            <button
                                                key={cur}
                                                type="button"
                                                onClick={() => handleSelectTarget(cur)}
                                                className={cn(
                                                    "h-7 inline-flex items-center justify-center leading-none px-2 py-0 text-xs font-bold rounded-md transition-all cursor-pointer whitespace-nowrap",
                                                    targetCurrency === cur
                                                        ? "bg-background text-foreground shadow-sm border border-border/70"
                                                        : "text-muted-foreground hover:text-foreground border border-transparent"
                                                )}
                                            >
                                                {cur}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <div className="relative">
                                    <input
                                        type="number"
                                        inputMode="decimal"
                                        value={convertedAmount}
                                        onChange={(e) => handleConvertedAmountChange(e.target.value)}
                                        onKeyDown={(e) => { if (e.key === 'ArrowUp' || e.key === 'ArrowDown') e.preventDefault(); }}
                                        onFocus={(e) => e.target.select()}
                                        className="w-full h-11 pl-3.5 pr-20 py-2 text-lg sm:text-xl font-bold font-mono tabular-nums rounded-lg bg-background text-foreground border border-input focus:outline-none focus:ring-2 focus:ring-primary/25 no-spinner"
                                        placeholder="0.00"
                                    />
                                    <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                                        {convertedAmount !== '' && (
                                            <button
                                                type="button"
                                                onClick={() => handleConvertedAmountChange('')}
                                                className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                                                title="Betrag leeren"
                                                aria-label="Betrag leeren"
                                            >
                                                <X className="size-3.5" />
                                            </button>
                                        )}
                                        <span className="text-xs font-bold text-muted-foreground pointer-events-none">
                                            {targetCurrency}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Quick All-4-Currencies Preview Strip + Transfer to ShareCalculator */}
                        {(otherCurrencies.some(o => o.value !== null) || Boolean(onTransferToShareCalc)) && (
                            <div className="flex flex-wrap items-center justify-between gap-2 mb-5 px-1 text-xs">
                                <div className="flex flex-wrap items-center gap-2">
                                    {otherCurrencies.some(o => o.value !== null) && (
                                        <>
                                            <span className="text-muted-foreground font-medium">
                                                Entspricht auch:
                                            </span>
                                            {otherCurrencies.map(item => (
                                                item.value !== null && (
                                                    <button
                                                        key={item.currency}
                                                        type="button"
                                                        onClick={() => handleSelectTarget(item.currency)}
                                                        className="h-7 inline-flex items-center justify-center leading-none gap-1.5 px-2.5 py-0 rounded-lg border border-border/80 bg-muted/35 hover:bg-primary/10 hover:border-primary/40 text-foreground font-mono tabular-nums font-semibold transition-colors cursor-pointer whitespace-nowrap"
                                                        title={`Klick wechselt Zielwährung auf ${item.currency}${item.rate ? ` · 1 ${baseCurrency} = ${item.rate.toFixed(4)} ${item.currency}` : ''}`}
                                                    >
                                                        <span>{item.value.toLocaleString('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                                        <span className="text-muted-foreground font-sans font-bold">{item.currency}</span>
                                                    </button>
                                                )
                                            ))}
                                        </>
                                    )}
                                </div>
                                {onTransferToShareCalc && (
                                    <button
                                        type="button"
                                        disabled={!canTransferBudget}
                                        onClick={() => {
                                            if (!canTransferBudget) return;
                                            onTransferToShareCalc(numericConverted.toFixed(2), targetCurrency);
                                        }}
                                        title={canTransferBudget
                                            ? `${numericConverted.toLocaleString('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${targetCurrency} als Budget in den Aktien-Kauf Rechner übernehmen`
                                            : 'Betrag eingeben, um ihn als Kaufbudget zu übernehmen'}
                                        className={cn(
                                            "h-7 inline-flex items-center justify-center leading-none gap-1.5 px-2.5 py-0 rounded-lg border text-xs font-semibold transition-all whitespace-nowrap",
                                            canTransferBudget
                                                ? "border-emerald-500/40 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 cursor-pointer active:scale-95"
                                                : "border-border/50 bg-muted/20 text-muted-foreground/50 cursor-not-allowed"
                                        )}
                                    >
                                        <span>Als Kaufbudget</span>
                                        <ArrowDown className="size-3.5" />
                                    </button>
                                )}
                            </div>
                        )}

                        {/* Chart Header & Info */}
                        <div className="flex flex-col md:flex-row md:items-end justify-between mb-4 gap-3">
                            <div>
                                <h4 className="text-2xl font-bold tracking-tight font-mono tabular-nums mb-0.5">
                                    {effectiveRate.toFixed(4)} <span className="text-sm text-muted-foreground font-sans font-medium">{targetCurrency}</span>
                                </h4>
                                <div className={cn(
                                    "inline-flex items-center gap-1.5 text-sm font-bold font-mono tabular-nums",
                                    percentageChange >= 0
                                        ? "text-green-600 dark:text-green-400"
                                        : "text-red-600 dark:text-red-400"
                                )}>
                                    <span>{percentageChange >= 0 ? '+' : ''}{percentageChange.toFixed(2)}%</span>
                                    <span className="text-muted-foreground font-sans font-medium text-xs">{timeRange.replace('Y', 'J')}</span>
                                </div>
                            </div>

                            {/* Timeframe Selector */}
                            <div className="inline-flex items-center bg-muted/50 p-0.5 rounded-lg gap-0.5 self-start md:self-auto">
                                {VALID_RANGES.map((range) => (
                                    <button
                                        key={range}
                                        type="button"
                                        onClick={() => handleSelectTimeRange(range)}
                                        className={cn(
                                            "h-7 inline-flex items-center justify-center leading-none px-2.5 py-0 text-xs font-semibold rounded-md transition-all cursor-pointer whitespace-nowrap",
                                            timeRange === range
                                                ? "bg-background shadow-sm text-foreground border border-border/70"
                                                : "text-muted-foreground hover:text-foreground hover:bg-background/50 border border-transparent"
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
                                                fontSize={12}
                                            >
                                                {formatXAxisDate(payload.value)}
                                            </text>
                                        );
                                    }}
                                />
                                <YAxis
                                    domain={domain}
                                    tick={{ fontSize: 12, fill: 'currentColor', opacity: 0.5 }}
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
