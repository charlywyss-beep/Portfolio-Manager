import { useState } from 'react';
import { usePortfolio } from '../context/PortfolioContext';
import { Calendar, Trash2, TrendingUp, Plus } from 'lucide-react';
import { AddDividendModal } from '../components/AddDividendModal';

export function DividendPlanner() {
    const { stocks, positions, dividends, deleteDividend } = usePortfolio();
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);

    // Calculate projected dividends from yield
    const projectedDividends = positions.map(pos => {
        const stock = stocks.find(s => s.id === pos.stockId);
        if (!stock || !stock.dividendYield) return null;

        const currentValue = pos.shares * stock.currentPrice;
        const yearlyDividend = currentValue * (stock.dividendYield / 100);

        return {
            stock,
            position: pos,
            yearlyDividend,
            quarterlyDividend: yearlyDividend / 4
        };
    }).filter(Boolean);

    const totalYearlyDividends = projectedDividends.reduce((sum, d) => sum + (d?.yearlyDividend || 0), 0);
    const totalMonthlyAvg = totalYearlyDividends / 12;

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="p-6 rounded-xl bg-card border border-border shadow-sm">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 rounded-lg bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400">
                            <TrendingUp className="size-6" />
                        </div>
                        <h3 className="text-lg font-bold">Jährliche Gesamtdividende</h3>
                    </div>
                    <p className="text-3xl font-bold tracking-tight">
                        {totalYearlyDividends.toLocaleString('de-CH', { style: 'currency', currency: 'CHF' })}
                    </p>
                </div>

                <div className="p-6 rounded-xl bg-card border border-border shadow-sm">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 rounded-lg bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
                            <Calendar className="size-6" />
                        </div>
                        <h3 className="text-lg font-bold">Monatlicher Durchschnitt</h3>
                    </div>
                    <p className="text-3xl font-bold tracking-tight">
                        {totalMonthlyAvg.toLocaleString('de-CH', { style: 'currency', currency: 'CHF' })}
                    </p>
                </div>
            </div>

            {/* Projected Dividends Table */}
            <div className="p-6 rounded-xl bg-card border border-border shadow-sm">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-bold">Erwartete Dividenden</h3>
                    <button
                        onClick={() => setIsAddModalOpen(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors font-medium text-sm"
                    >
                        <Plus className="size-4" />
                        Dividende hinzufügen
                    </button>
                </div>

                {projectedDividends.length > 0 ? (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-border">
                                    <th className="text-left py-3 px-4 font-semibold">Aktie</th>
                                    <th className="text-right py-3 px-4 font-semibold">Anteile</th>
                                    <th className="text-right py-3 px-4 font-semibold">Rendite %</th>
                                    <th className="text-right py-3 px-4 font-semibold">Jährlich</th>
                                    <th className="text-right py-3 px-4 font-semibold">Quartalsweise</th>
                                </tr>
                            </thead>
                            <tbody>
                                {projectedDividends.map((item, idx) => item && (
                                    <tr key={idx} className="border-b border-border hover:bg-muted/50 transition-colors">
                                        <td className="py-3 px-4">
                                            <div>
                                                <p className="font-semibold">{item.stock.name}</p>
                                                <p className="text-sm text-muted-foreground">{item.stock.symbol}</p>
                                            </div>
                                        </td>
                                        <td className="text-right py-3 px-4">{item.position.shares}</td>
                                        <td className="text-right py-3 px-4">{item.stock.dividendYield?.toFixed(2)}%</td>
                                        <td className="text-right py-3 px-4 font-medium text-green-600 dark:text-green-400">
                                            {item.yearlyDividend.toLocaleString('de-CH', { style: 'currency', currency: 'CHF' })}
                                        </td>
                                        <td className="text-right py-3 px-4 text-muted-foreground">
                                            {item.quarterlyDividend.toLocaleString('de-CH', { style: 'currency', currency: 'CHF' })}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="text-center py-12">
                        <Calendar className="size-12 mx-auto text-muted-foreground mb-4" />
                        <p className="text-muted-foreground">Keine Dividenden projected. Fügen Sie Dividendenrenditen zu Ihren Stocks hinzu.</p>
                    </div>
                )}
            </div>

            {/* Manual Dividends table */}
            {dividends.length > 0 && (
                <div className="p-6 rounded-xl bg-card border border-border shadow-sm">
                    <h3 className="text-lg font-bold mb-6">Manuelle Dividenden</h3>
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-border">
                                    <th className="text-left py-3 px-4 font-semibold">Aktie</th>
                                    <th className="text-right py-3 px-4 font-semibold">Betrag</th>
                                    <th className="text-right py-3 px-4 font-semibold">Datum</th>
                                    <th className="text-right py-3 px-4 font-semibold">Häufigkeit</th>
                                    <th className="text-right py-3 px-4"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {dividends.map(div => {
                                    const stock = stocks.find(s => s.id === div.stockId);
                                    return (
                                        <tr key={div.id} className="border-b border-border hover:bg-muted/50 transition-colors">
                                            <td className="py-3 px-4">
                                                <div>
                                                    <p className="font-semibold">{stock?.name || 'Unbekannt'}</p>
                                                    <p className="text-sm text-muted-foreground">{stock?.symbol}</p>
                                                </div>
                                            </td>
                                            <td className="text-right py-3 px-4 font-medium">
                                                {div.amount.toLocaleString('de-CH', { style: 'currency', currency: div.currency })}
                                            </td>
                                            <td className="text-right py-3 px-4">{new Date(div.payDate).toLocaleDateString('de-DE')}</td>
                                            <td className="text-right py-3 px-4 text-muted-foreground capitalize">{div.frequency}</td>
                                            <td className="text-right py-3 px-4">
                                                <button
                                                    onClick={() => deleteDividend(div.id)}
                                                    className="p-2 hover:bg-red-100 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg transition-colors"
                                                >
                                                    <Trash2 className="size-4" />
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            <AddDividendModal
                isOpen={isAddModalOpen}
                onClose={() => setIsAddModalOpen(false)}
            />
        </div>
    );
}
