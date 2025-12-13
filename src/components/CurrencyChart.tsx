import { useState, useEffect, useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { RefreshCcw } from 'lucide-react';
import { cn } from '../utils';

interface RateHistory {
    date: string;
    rate: number;
}

type Currency = 'EUR' | 'USD' | 'GBP';

// Helper to get date string YYYY-MM-DD
const formatDate = (date: Date) => date.toISOString().split('T')[0];

interface Props {
    inverse?: boolean;
}

export function CurrencyChart({ inverse = false }: Props) {
    const [selectedCurrency, setSelectedCurrency] = useState<Currency>('EUR');
    const [historyData, setHistoryData] = useState<RateHistory[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [currRate, setCurrRate] = useState<number | null>(null);
    const [baseAmount, setBaseAmount] = useState<string>('1');
    const [convertedAmount, setConvertedAmount] = useState<string>('');

    // Derived values based on mode
    const baseCurrency = inverse ? selectedCurrency : 'CHF';
    const targetCurrency = inverse ? 'CHF' : selectedCurrency;



    useEffect(() => {
        const fetchHistory = async () => {
            setIsLoading(true);
            try {
                // Get start date (1 year ago)
                const startDate = new Date();
                startDate.setFullYear(startDate.getFullYear() - 1);

                const startStr = formatDate(startDate);
                // frankfurter.app API
                // Standard: from=CHF&to=EUR -> Returns rates relative to 1 CHF
                // Inverse: from=EUR&to=CHF -> Returns rates relative to 1 EUR
                const response = await fetch(`https://api.frankfurter.app/${startStr}..?from=${baseCurrency}&to=${targetCurrency}`);
                const data = await response.json();

                // Transform data
                if (data.rates) {
                    const transformed = Object.entries(data.rates).map(([date, rates]: [string, any]) => ({
                        date,
                        rate: rates[targetCurrency] // Always get the rate of the target
                    }));
                    setHistoryData(transformed);
                    // Set current rate (last entry)
                    if (transformed.length > 0) {
                        setCurrRate(transformed[transformed.length - 1].rate);
                    }
                }
            } catch (error) {
                console.error("Failed to fetch currency history:", error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchHistory();
    }, [selectedCurrency, inverse]);

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
                            onClick={() => setSelectedCurrency(cur)}
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
                        <div className="flex items-baseline gap-3 mb-4">
                            <h4 className="text-2xl font-bold tracking-tight">
                                {currRate.toFixed(4)} <span className="text-sm text-muted-foreground font-medium">{targetCurrency}</span>
                            </h4>
                            <span className={cn(
                                "text-xs font-medium px-2 py-0.5 rounded-full flex items-center",
                                percentageChange >= 0
                                    ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                                    : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                            )}>
                                {percentageChange >= 0 ? '+' : ''}{percentageChange.toFixed(2)}% (1J)
                            </span>
                        </div>

                        {/* Currency Converter */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-950/30 dark:to-purple-950/30 rounded-xl p-6 border border-indigo-200 dark:border-indigo-800">
                                <label className="text-sm font-medium text-indigo-900 dark:text-indigo-100 mb-2 block">{baseCurrency}</label>
                                <input
                                    type="number"
                                    value={baseAmount}
                                    onChange={(e) => handleBaseAmountChange(e.target.value)}
                                    onFocus={(e) => e.target.select()}
                                    className="w-full px-4 py-3 text-2xl font-bold rounded-lg bg-white dark:bg-background text-gray-900 dark:text-white border-0 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    placeholder="0.00"
                                />
                            </div>
                            <div className="bg-gradient-to-br from-cyan-50 to-blue-50 dark:from-cyan-950/30 dark:to-blue-950/30 rounded-xl p-6 border border-cyan-200 dark:border-cyan-800">
                                <label className="text-sm font-medium text-cyan-900 dark:text-cyan-100 mb-2 block">{targetCurrency}</label>
                                <input
                                    type="number"
                                    value={convertedAmount}
                                    onChange={(e) => handleConvertedAmountChange(e.target.value)}
                                    onFocus={(e) => e.target.select()}
                                    className="w-full px-4 py-3 text-2xl font-bold rounded-lg bg-white dark:bg-background text-gray-900 dark:text-white border-0 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                                    placeholder="0.00"
                                />
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
                    <ResponsiveContainer width="100%" height={300}>
                        <AreaChart data={historyData} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
                            <defs>
                                <linearGradient id="colorRate" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.2} />
                                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" opacity={0.5} />
                            <XAxis
                                dataKey="date"
                                tickFormatter={(date) => {
                                    const d = new Date(date);
                                    return d.toLocaleDateString('de-DE', { month: 'short', year: '2-digit' });
                                }}
                                tick={{ fontSize: 11, fill: 'currentColor', opacity: 0.5 }}
                                minTickGap={30}
                                tickLine={false}
                                axisLine={false}
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
                                labelFormatter={(date) => new Date(date).toLocaleDateString('de-DE')}
                                formatter={(value: number) => [value.toFixed(4), targetCurrency]}
                            />
                            <Area
                                type="monotone"
                                dataKey="rate"
                                stroke="hsl(var(--primary))"
                                strokeWidth={2}
                                fillOpacity={1}
                                fill="url(#colorRate)"
                                animationDuration={1000}
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                )}
            </div>
        </div>
    );
}
