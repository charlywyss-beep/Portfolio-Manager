import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { usePortfolio } from '../context/PortfolioContext';
import { useCurrencyFormatter } from '../utils/currency';

export function HistoryChart() {
    const { history } = usePortfolio();
    const { formatCurrency } = useCurrencyFormatter();

    // Sort by date ascending for the chart
    const data = [...history].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    if (data.length === 0) {
        return (
            <div className="h-[300px] flex items-center justify-center text-muted-foreground border border-dashed border-border rounded-xl bg-card/50">
                <div className="text-center">
                    <p>Keine historischen Daten verfügbar.</p>
                    <p className="text-sm">Fügen Sie Einträge hinzu, um die Entwicklung zu sehen.</p>
                </div>
            </div>
        );
    }

    const CustomTooltip = ({ active, payload, label }: any) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-card border border-border p-3 rounded-lg shadow-xl text-sm">
                    <p className="font-bold mb-2">{label}</p>
                    {payload.map((entry: any, index: number) => (
                        <div key={index} className="flex items-center gap-2 mb-1">
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
                            <span className="text-muted-foreground">{entry.name}:</span>
                            <span className="font-mono font-medium">
                                {formatCurrency(entry.value, 'CHF')}
                            </span>
                        </div>
                    ))}
                </div>
            );
        }
        return null;
    };

    return (
        <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis
                        dataKey="date"
                        tickFormatter={(value) => new Date(value).getFullYear().toString()}
                        stroke="hsl(var(--muted-foreground))"
                        fontSize={12}
                        tickLine={false}
                        axisLine={false}
                    />
                    <YAxis
                        stroke="hsl(var(--muted-foreground))"
                        fontSize={12}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(value) => `CHF ${(value / 1000).toFixed(0)}k`}
                    />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: 'hsl(var(--muted)/0.2)' }} />
                    <Legend />
                    <Bar
                        dataKey="investedCapital"
                        name="Investiertes Kapital"
                        fill="hsl(var(--muted))"
                        radius={[4, 4, 0, 0]}
                        maxBarSize={50}
                    />
                    <Bar
                        dataKey="totalValue"
                        name="Gesamtwert"
                        fill="hsl(var(--primary))"
                        radius={[4, 4, 0, 0]}
                        maxBarSize={50}
                    />
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
}
