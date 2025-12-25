import { useState, useMemo, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { usePortfolio } from '../context/PortfolioContext';
import { useCurrencyFormatter } from '../utils/currency';
import { cn } from '../utils';

type TimeRange = '1W' | '1M' | '6M' | '1Y' | '5Y';

export function HistoryChart() {
    const { history } = usePortfolio();
    const { formatCurrency } = useCurrencyFormatter();
    const [timeRange, setTimeRange] = useState<TimeRange>('1Y');
    const [hasMounted, setHasMounted] = useState(false);

    useEffect(() => {
        setHasMounted(true);
    }, []);

    // Dynamic Data Filling: Ensure continuous timeline with empty days
    const chartData = useMemo(() => {
        if (!history || history.length === 0) return [];

        const sortedHistory = [...history].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        const lastEntry = sortedHistory[sortedHistory.length - 1];
        const lastDate = new Date(lastEntry.date);

        // Determine start date based on range
        let startDate = new Date(lastDate);

        if (timeRange === '1W') startDate.setDate(lastDate.getDate() - 7);
        else if (timeRange === '1M') startDate.setMonth(lastDate.getMonth() - 1);
        else if (timeRange === '6M') startDate.setMonth(lastDate.getMonth() - 6);
        else if (timeRange === '1Y') startDate.setFullYear(lastDate.getFullYear() - 1);
        else if (timeRange === '5Y') startDate.setFullYear(lastDate.getFullYear() - 5);

        // Generate all dates from startDate to lastDate
        const filledData = [];
        const currentDate = new Date(startDate);

        // Map history for quick lookup O(N)
        const historyMap = new Map();
        sortedHistory.forEach(h => {
            historyMap.set(new Date(h.date).toDateString(), h);
        });

        // Use last known values for gaps? OR just empty?
        // User asked "why bars so far apart". Empty gaps implies 0 or missing.
        // For a portfolio, usually "holding" value persists. 
        // BUT this is a "History" Log. It shows snapshots.
        // If we want "Time Stream", we should show nothing in between.
        // Let's stick to Sparse (empty values) for now to visually separate the bars properly.

        while (currentDate <= lastDate) {
            const dateKey = currentDate.toDateString();
            const entry = historyMap.get(dateKey);

            if (entry) {
                filledData.push({ ...entry, isReal: true });
            } else {
                // Determine if we are out of range for strict filters? 
                // The loop ensures we are in range.
                filledData.push({
                    date: currentDate.toISOString(),
                    stockValue: 0,
                    etfValue: 0,
                    cashValue: 0,
                    totalValue: 0,
                    isReal: false // Flag to maybe hide tooltip or style differently
                });
            }
            currentDate.setDate(currentDate.getDate() + 1);
        }

        return filledData;

    }, [history, timeRange]);

    // Dynamic X-Axis Formatter
    const formatXAxis = (dateStr: string) => {
        const date = new Date(dateStr);
        // Show full date if data points are sparse or range is short
        if (timeRange === '1W' || timeRange === '1M' || timeRange === '6M' || timeRange === '1Y') {
            return date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
        }
        return date.getFullYear().toString();
    };



    const CustomTooltip = ({ active, payload, label }: any) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-card border border-border p-3 rounded-lg shadow-xl text-sm">
                    <p className="font-bold mb-2">{new Date(label).toLocaleDateString('de-DE')}</p>
                    {payload.map((entry: any, index: number) => {
                        // Skip if value is 0/undefined to keep tooltip clean
                        if (!entry.value) return null;
                        return (
                            <div key={index} className="flex items-center gap-2 mb-1">
                                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
                                <span className="text-muted-foreground min-w-[80px]">{entry.name}:</span>
                                <span className="font-mono font-medium">
                                    {formatCurrency(entry.value, 'CHF')}
                                </span>
                            </div>
                        );
                    })}
                    <div className="mt-2 pt-2 border-t border-border flex justify-between items-center">
                        <span className="font-bold">Gesamt:</span>
                        <span className="font-mono font-bold">{formatCurrency((payload[0]?.payload?.totalValue || 0), 'CHF')}</span>
                    </div>
                </div>
            );
        }
        return null;
    };

    return (
        <div className="w-full flex flex-col h-full">
            <div className="flex justify-end mb-4">
                <div className="flex bg-muted/50 p-1 rounded-lg">
                    {(['1W', '1M', '6M', '1Y', '5Y'] as const).map((range) => (
                        <button
                            key={range}
                            onClick={() => setTimeRange(range)}
                            className={cn(
                                "px-3 py-1 text-xs font-medium rounded-md transition-all",
                                timeRange === range
                                    ? "bg-background shadow-sm text-foreground"
                                    : "text-muted-foreground hover:text-foreground hover:bg-background/50"
                            )}
                        >
                            {range}
                        </button>
                    ))}
                </div>
            </div>

            <div className="h-[300px] w-full">
                {history.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-muted-foreground border border-dashed border-border rounded-xl bg-card/50">
                        <div className="text-center">
                            <p>Keine historischen Daten verfügbar.</p>
                            <p className="text-sm">Fügen Sie Einträge hinzu, um die Entwicklung zu sehen.</p>
                        </div>
                    </div>
                ) : hasMounted && chartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%" debounce={100} minWidth={1} minHeight={1}>
                        <BarChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                            <XAxis
                                dataKey="date"
                                tickFormatter={formatXAxis}
                                stroke="hsl(var(--muted-foreground))"
                                fontSize={13}
                                tickLine={false}
                                axisLine={false}
                                minTickGap={30}
                            />
                            <YAxis
                                stroke="hsl(var(--muted-foreground))"
                                fontSize={13}
                                tickLine={false}
                                axisLine={false}
                                tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
                                domain={['auto', 'auto']}
                            />
                            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'hsl(var(--muted)/0.2)' }} />
                            <Legend
                                content={({ payload }) => {
                                    if (!payload) return null;
                                    const customOrder = [
                                        { id: 'stockValue', label: 'Aktien', color: '#2563eb' },
                                        { id: 'etfValue', label: 'ETFs', color: '#7c3aed' },
                                        { id: 'cashValue', label: 'Bank', color: '#22c55e' }
                                    ];

                                    return (
                                        <div className="flex justify-center gap-6 mt-2">
                                            {customOrder.map((item) => (
                                                <div key={item.id} className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                                                    <div className="w-3 h-3 rounded-[2px]" style={{ backgroundColor: item.color }} />
                                                    <span>{item.label}</span>
                                                </div>
                                            ))}
                                        </div>
                                    );
                                }}
                            />
                            <Bar
                                dataKey="stockValue"
                                name="Aktien"
                                stackId="a"
                                fill="#2563eb"
                                radius={[0, 0, 4, 4]}
                                maxBarSize={50}
                            />
                            <Bar
                                dataKey="etfValue"
                                name="ETFs"
                                stackId="a"
                                fill="#7c3aed"
                                maxBarSize={50}
                            />
                            <Bar
                                dataKey="cashValue"
                                name="Bank"
                                stackId="a"
                                fill="#22c55e"
                                radius={[4, 4, 0, 0]}
                                maxBarSize={50}
                            />
                        </BarChart>
                    </ResponsiveContainer>
                ) : (
                    <div className="h-full flex items-center justify-center text-muted-foreground">
                        Keine Daten im gewählten Zeitraum.
                    </div>
                )}
            </div>
        </div>
    );
}
