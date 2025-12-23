import { useState, useMemo, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { usePortfolio } from '../context/PortfolioContext';
import { useCurrencyFormatter } from '../utils/currency';
import { cn } from '../utils';

type TimeRange = '1W' | '1M' | '6M' | '1Y' | '5Y' | '10Y' | 'MAX';

export function HistoryChart() {
    const { history } = usePortfolio();
    const { formatCurrency } = useCurrencyFormatter();
    const [timeRange, setTimeRange] = useState<TimeRange>('MAX');
    const [hasMounted, setHasMounted] = useState(false);

    useEffect(() => {
        setHasMounted(true);
    }, []);

    // Filter data based on range
    const filteredData = useMemo(() => {
        if (!history || history.length === 0) return [];

        const sortedData = [...history].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        if (timeRange === 'MAX') return sortedData;

        const now = new Date();
        let cutoff = new Date();

        if (timeRange === '1W') cutoff.setDate(now.getDate() - 7);
        else if (timeRange === '1M') cutoff.setMonth(now.getMonth() - 1);
        else if (timeRange === '6M') cutoff.setMonth(now.getMonth() - 6);
        else if (timeRange === '1Y') cutoff.setFullYear(now.getFullYear() - 1);

        return sortedData.filter(d => new Date(d.date) >= cutoff);
    }, [history, timeRange]);

    // Dynamic X-Axis Formatter
    const formatXAxis = (dateStr: string) => {
        const date = new Date(dateStr);
        // Show full date if data points are sparse or range is short
        if (filteredData.length <= 15 || ['1W', '1M', '6M', '1Y'].includes(timeRange)) {
            return date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' });
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
                    {(['1W', '1M', '6M', '1Y', '5Y', '10Y', 'MAX'] as const).map((range) => (
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
                ) : hasMounted && filteredData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%" debounce={100} minWidth={1} minHeight={1}>
                        <BarChart data={filteredData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                            <XAxis
                                dataKey="date"
                                tickFormatter={formatXAxis}
                                stroke="hsl(var(--muted-foreground))"
                                fontSize={12}
                                tickLine={false}
                                axisLine={false}
                                minTickGap={30}
                            />
                            <YAxis
                                stroke="hsl(var(--muted-foreground))"
                                fontSize={12}
                                tickLine={false}
                                axisLine={false}
                                tickFormatter={(value) => `CHF ${(value / 1000).toFixed(0)}k`}
                            />
                            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'hsl(var(--muted)/0.2)' }} />
                            <Legend
                                content={({ payload }) => {
                                    if (!payload) return null;
                                    // Enforce order: Aktien (Blue), ETFs (Violet), Bank (Green)
                                    // Use the payload values but verify strictly
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
                                fill="#2563eb" // Blue-600
                                radius={[0, 0, 4, 4]} // Bottom radius
                                maxBarSize={50}
                            />
                            <Bar
                                dataKey="etfValue"
                                name="ETFs"
                                stackId="a"
                                fill="#7c3aed" // Violet-600
                                maxBarSize={50}
                            />
                            <Bar
                                dataKey="cashValue"
                                name="Bank"
                                stackId="a"
                                fill="#22c55e" // Green-500
                                radius={[4, 4, 0, 0]} // Top radius
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
