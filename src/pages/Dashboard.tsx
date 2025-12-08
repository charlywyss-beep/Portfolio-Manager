import { usePortfolioData } from '../hooks/usePortfolioData';
import { ArrowUpRight, ArrowDownRight, DollarSign, Calendar, TrendingUp, BarChart3 } from 'lucide-react';
import { cn } from '../utils';
import { useCurrencyFormatter } from '../utils/currency';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

// Helper to translate frequency to German
const translateFrequency = (freq?: string) => {
    switch (freq) {
        case 'quarterly': return 'Quartalsweise';
        case 'semi-annually': return 'Halbjährlich';
        case 'annually': return 'Jährlich';
        case 'monthly': return 'Monatlich';
        default: return 'Jährlich';
    }
};

export function Dashboard() {
    const { totals, upcomingDividends, positions } = usePortfolioData();
    const { formatCurrency, convertToCHF } = useCurrencyFormatter();

    // Prepare chart data: Top 5 Performers
    const chartData = positions
        .sort((a, b) => b.gainLossPercent - a.gainLossPercent)
        .slice(0, 5)
        .map(p => ({
            name: p.stock.symbol,
            gain: p.gainLossPercent,
            fullName: p.stock.name,
            valueCHF: convertToCHF(p.gainLoss, p.stock.currency)
        }));

    const CustomTooltip = ({ active, payload }: any) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-popover border border-border p-3 rounded-lg shadow-lg">
                    <p className="font-bold text-lg text-popover-foreground mb-1">{payload[0].payload.fullName}</p>
                    <p className={cn("text-base font-bold", payload[0].value >= 0 ? "text-green-500" : "text-red-500")}>
                        {payload[0].value >= 0 ? '+' : ''}{payload[0].value.toFixed(2)}%
                    </p>
                    <p className="text-sm text-muted-foreground">
                        {payload[0].payload.valueCHF.toLocaleString('de-CH', { style: 'currency', currency: 'CHF' })}
                    </p>
                </div>
            );
        }
        return null;
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Top Cards: Key Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Total Value */}
                <div className="p-6 rounded-xl bg-card border border-border shadow-sm">
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-2 rounded-lg bg-primary/10 text-primary">
                            <DollarSign className="size-6" />
                        </div>
                        <span className={cn(
                            "flex items-center text-sm font-medium px-2 py-1 rounded-full",
                            totals.gainLoss >= 0 ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                        )}>
                            {totals.gainLoss >= 0 ? <ArrowUpRight className="size-4 mr-1" /> : <ArrowDownRight className="size-4 mr-1" />}
                            {totals.gainLossPercent.toFixed(2)}%
                        </span>
                    </div>
                    <div>
                        <p className="text-sm text-muted-foreground font-medium">Gesamtwert</p>
                        <h3 className="text-3xl font-bold mt-1 tracking-tight">
                            {totals.totalValue.toLocaleString('de-CH', { style: 'currency', currency: 'CHF' })}
                        </h3>
                        <p className={cn("text-sm mt-2 font-medium",
                            totals.gainLoss >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
                        )}>
                            {totals.gainLoss >= 0 ? '+' : ''}{totals.gainLoss.toLocaleString('de-CH', { style: 'currency', currency: 'CHF' })} Gewinn/Verlust
                        </p>

                        <div className="mt-4 pt-4 border-t border-border flex items-center justify-between">
                            <span className="text-sm text-muted-foreground font-medium">Investiertes Kapital</span>
                            <span className="font-bold text-base tracking-tight">
                                {totals.totalCost.toLocaleString('de-CH', { style: 'currency', currency: 'CHF' })}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Projected Dividends */}
                <div className="p-6 rounded-xl bg-card border border-border shadow-sm">
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-2 rounded-lg bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
                            <TrendingUp className="size-6" />
                        </div>
                    </div>
                    <div>
                        <p className="text-sm text-muted-foreground font-medium">Erwartete Dividende (Jahr)</p>
                        <h3 className="text-3xl font-bold mt-1 tracking-tight">
                            {totals.projectedYearlyDividends.toLocaleString('de-CH', { style: 'currency', currency: 'CHF' })}
                        </h3>
                        <p className="text-sm text-muted-foreground mt-2">
                            Ø {(totals.projectedYearlyDividends / 12).toLocaleString('de-CH', { style: 'currency', currency: 'CHF' })} / Monat
                        </p>
                    </div>
                </div>

                {/* Top Performer (Stats) */}
                <div className="p-6 rounded-xl bg-card border border-border shadow-sm">
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-2 rounded-lg bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400">
                            <TrendingUp className="size-6" />
                        </div>
                    </div>
                    <div>
                        <p className="text-sm text-muted-foreground font-medium">Top Performer</p>
                        {positions.length > 0 ? (
                            <>
                                <h3 className="text-xl font-bold mt-1 tracking-tight truncate">
                                    {positions.sort((a, b) => b.gainLossPercent - a.gainLossPercent)[0]?.stock.name}
                                </h3>
                                <p className="text-sm text-green-600 dark:text-green-400 mt-2 font-medium">
                                    +{positions.sort((a, b) => b.gainLossPercent - a.gainLossPercent)[0]?.gainLossPercent.toFixed(2)}% ({convertToCHF(positions.sort((a, b) => b.gainLossPercent - a.gainLossPercent)[0]?.gainLoss, positions.sort((a, b) => b.gainLossPercent - a.gainLossPercent)[0]?.stock.currency).toLocaleString('de-CH', { style: 'currency', currency: 'CHF' })})
                                </p>
                            </>
                        ) : (
                            <span className="text-sm text-muted-foreground">Keine Daten</span>
                        )}
                    </div>
                </div>
            </div>

            {/* Bottom Section: Dividends & Chart */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                {/* Upcoming Dividends List */}
                <div className="p-6 rounded-xl bg-card border border-border shadow-sm">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="text-lg font-bold">Nächste Dividenden</h3>
                        <Calendar className="size-5 text-muted-foreground" />
                    </div>
                    <div className="space-y-4">
                        {upcomingDividends.map((div, idx) => (
                            <div key={idx} className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors">
                                <div className="flex items-center gap-3">
                                    {div.stock?.logoUrl && (
                                        <img src={div.stock.logoUrl} alt={div.stock.name} className="size-8 rounded-full bg-white object-contain p-1 border border-border" />
                                    )}
                                    <div>
                                        <p className="font-bold text-lg">{div.stock.symbol}</p>
                                        <p className="text-base text-muted-foreground">{new Date(div.payDate).toLocaleDateString('de-DE')}</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="font-bold text-xl text-green-600 dark:text-green-400">
                                        +{formatCurrency(div.amount, div.currency)}
                                    </p>
                                    <p className="text-sm font-medium text-muted-foreground">{translateFrequency(div.stock.dividendFrequency)}</p>
                                </div>
                            </div>
                        ))}
                        {upcomingDividends.length === 0 && <p className="text-sm text-muted-foreground">Keine anstehenden Dividenden.</p>}
                    </div>
                </div>

                {/* Top 5 Performance Chart */}
                <div className="p-6 rounded-xl bg-card border border-border shadow-sm flex flex-col">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="text-lg font-bold">Top 5 Performance</h3>
                        <BarChart3 className="size-5 text-muted-foreground" />
                    </div>
                    <div className="flex-1 w-full min-h-[200px]">
                        {chartData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={chartData} margin={{ top: 5, right: 20, left: -20, bottom: 5 }}>
                                    <XAxis
                                        dataKey="name"
                                        tick={{ fill: 'currentColor', fontSize: 13, opacity: 0.7 }}
                                        tickLine={false}
                                        axisLine={false}
                                    />
                                    <YAxis
                                        tick={{ fill: 'currentColor', fontSize: 13, opacity: 0.7 }}
                                        tickLine={false}
                                        axisLine={false}
                                        tickFormatter={(value) => `${value}%`}
                                    />
                                    <Tooltip content={<CustomTooltip />} cursor={{ fill: 'transparent', opacity: 0.1 }} />
                                    <Bar dataKey="gain" radius={[4, 4, 0, 0]}>
                                        {chartData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.gain >= 0 ? '#22c55e' : '#ef4444'} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
                                Keine Performance-Daten verfügbar
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
