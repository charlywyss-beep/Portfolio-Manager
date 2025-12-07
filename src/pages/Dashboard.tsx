import { usePortfolioData } from '../hooks/usePortfolioData';
import { ArrowUpRight, ArrowDownRight, DollarSign, Calendar, TrendingUp } from 'lucide-react';
import { cn } from '../utils';

export function Dashboard() {
    const { totals, upcomingDividends, positions } = usePortfolioData();

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
                            {totals.totalValue.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
                        </h3>
                        <p className={cn("text-sm mt-2",
                            totals.gainLoss >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
                        )}>
                            {totals.gainLoss >= 0 ? '+' : ''}{totals.gainLoss.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })} Gewinn/Verlust
                        </p>
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
                            {totals.projectedYearlyDividends.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
                        </h3>
                        <p className="text-sm text-muted-foreground mt-2">
                            Ø {(totals.projectedYearlyDividends / 12).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })} / Monat
                        </p>
                    </div>
                </div>

                {/* Top Performer (Mock for now) */}
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
                                    +{positions[0].gainLossPercent.toFixed(2)}%
                                </p>
                            </>
                        ) : (
                            <span className="text-sm text-muted-foreground">Keine Daten</span>
                        )}
                    </div>
                </div>
            </div>

            {/* Recent Dividends / Calendar Teaser */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="p-6 rounded-xl bg-card border border-border shadow-sm">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="text-lg font-bold">Nächste Dividenden</h3>
                        <Calendar className="size-5 text-muted-foreground" />
                    </div>
                    <div className="space-y-4">
                        {upcomingDividends.map(div => (
                            <div key={div.id} className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors">
                                <div className="flex items-center gap-3">
                                    {div.stock?.logoUrl && (
                                        <img src={div.stock.logoUrl} alt={div.stock.name} className="size-8 rounded-full bg-white object-contain p-1 border border-border" />
                                    )}
                                    <div>
                                        <p className="font-semibold text-sm">{div.stock?.symbol}</p>
                                        <p className="text-xs text-muted-foreground">{new Date(div.payDate).toLocaleDateString('de-DE')}</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="font-medium text-green-600 dark:text-green-400">
                                        +{(div.amount * (positions.find(p => p.stockId === div.stockId)?.shares || 0)).toLocaleString('de-DE', { style: 'currency', currency: div.currency })}
                                    </p>
                                    <p className="text-xs text-muted-foreground">{div.frequency}</p>
                                </div>
                            </div>
                        ))}
                        {upcomingDividends.length === 0 && <p className="text-sm text-muted-foreground">Keine anstehenden Dividenden.</p>}
                    </div>
                </div>

                <div className="p-6 rounded-xl bg-card border border-border shadow-sm flex items-center justify-center bg-gradient-to-br from-primary/5 to-transparent">
                    <div className="text-center">
                        <p className="text-muted-foreground mb-4">Performance Chart (Placeholder)</p>
                        {/* Placeholder for Recharts driven chart */}
                        <div className="h-40 w-64 bg-muted/30 rounded-lg border border-dashed border-border flex items-center justify-center">
                            Chart Area
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
