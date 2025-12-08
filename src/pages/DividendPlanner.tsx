import { useState } from 'react';
import { usePortfolio } from '../context/PortfolioContext';
import { Calendar, TrendingUp, Plus, Edit } from 'lucide-react';
import { AddDividendModal } from '../components/AddDividendModal';
import { useCurrencyFormatter } from '../utils/currency';
import type { Stock } from '../types';

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

export function DividendPlanner() {
    const { stocks, positions } = usePortfolio();
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [editingStock, setEditingStock] = useState<Stock | null>(null);
    const { formatCurrency } = useCurrencyFormatter();

    // Calculate projected dividends from yield
    const projectedDividends = positions
        .map((pos) => {
            const stock = stocks.find((s) => s.id === pos.stockId);
            if (!stock || !stock.dividendYield) return null;

            const currentValue = pos.shares * stock.currentPrice;
            const annualDividend = currentValue * (stock.dividendYield / 100);
            const quarterlyDividend = annualDividend / 4;

            return {
                position: pos,
                stock,
                annualDividend,
                quarterlyDividend,
            };
        })
        .filter(Boolean);

    const totalAnnual = projectedDividends.reduce((sum, d) => sum + d!.annualDividend, 0);
    const totalMonthly = totalAnnual / 12;

    return (
        <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
            {/* Header */}
            <div className="border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80 sticky top-0 z-10">
                <div className="container mx-auto px-4 py-6">
                    <div className="flex items-center gap-3">
                        <div className="p-3 rounded-xl bg-gradient-to-br from-green-500/20 to-emerald-500/20 text-green-600 dark:text-green-400">
                            <Calendar className="size-6" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-bold tracking-tight">Dividenden Planer</h1>
                            <p className="text-muted-foreground">Erwartete Dividendenausschüttungen</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="container mx-auto px-4 py-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 rounded-xl p-6 border border-green-200 dark:border-green-800">
                        <div className="flex items-center gap-3 mb-2">
                            <TrendingUp className="size-5 text-green-600 dark:text-green-400" />
                            <span className="text-sm font-medium text-green-900 dark:text-green-100">Jährliche Gesamtdividende</span>
                        </div>
                        <div className="text-3xl font-bold text-green-600 dark:text-green-400">
                            CHF {totalAnnual.toFixed(2)}
                        </div>
                    </div>

                    <div className="bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-950/30 dark:to-cyan-950/30 rounded-xl p-6 border border-blue-200 dark:border-blue-800">
                        <div className="flex items-center gap-3 mb-2">
                            <Calendar className="size-5 text-blue-600 dark:text-blue-400" />
                            <span className="text-sm font-medium text-blue-900 dark:text-blue-100">Monatlicher Durchschnitt</span>
                        </div>
                        <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                            CHF {totalMonthly.toFixed(2)}
                        </div>
                    </div>
                </div>

                {/* Table */}
                <div className="bg-card rounded-xl border shadow-sm overflow-hidden">
                    <div className="flex items-center justify-between p-4 border-b bg-muted/30">
                        <h2 className="text-lg font-semibold">Erwartete Dividenden</h2>
                        <button
                            onClick={() => setIsAddModalOpen(true)}
                            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 font-medium transition-colors"
                        >
                            <Plus className="size-4" />
                            Dividende hinzufügen
                        </button>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-border">
                                    <th className="text-left py-3 px-4 font-semibold">Aktie</th>
                                    <th className="text-right py-3 px-4 font-semibold">Anteile</th>
                                    <th className="text-right py-3 px-4 font-semibold">Rendite %</th>
                                    <th className="text-right py-3 px-4 font-semibold">Jährlich</th>
                                    <th className="text-right py-3 px-4 font-semibold">Quartalsweise</th>
                                    <th className="text-right py-3 px-4 font-semibold">Frequenz</th>
                                    <th className="text-right py-3 px-4 font-semibold">Ex-Date</th>
                                    <th className="text-right py-3 px-4 font-semibold">Pay-Date</th>
                                    <th className="text-right py-3 px-4 w-24">Aktionen</th>
                                </tr>
                            </thead>
                            <tbody>
                                {projectedDividends.length === 0 ? (
                                    <tr>
                                        <td colSpan={9} className="text-center py-8 text-muted-foreground">
                                            Keine Dividenden-Aktien im Portfolio
                                        </td>
                                    </tr>
                                ) : (
                                    projectedDividends.map((data) => {
                                        const { position, stock, annualDividend, quarterlyDividend } = data!;

                                        // Format currency with dual display if needed
                                        let annualDisplay = `CHF ${annualDividend.toFixed(2)}`;
                                        if (stock.dividendCurrency && stock.dividendCurrency !== 'CHF') {
                                            const factor = stock.dividendFrequency === 'quarterly' ? 4
                                                : stock.dividendFrequency === 'semi-annually' ? 2
                                                    : stock.dividendFrequency === 'monthly' ? 12
                                                        : 1;

                                            // Annual Amount = Payment Amount * Shares * Frequency
                                            const originalAnnualAmount = stock.dividendAmount
                                                ? stock.dividendAmount * position.shares * factor
                                                : annualDividend;

                                            annualDisplay = formatCurrency(originalAnnualAmount, stock.dividendCurrency);
                                        }

                                        return (
                                            <tr key={position.id} className="border-b border-border last:border-0 hover:bg-muted/50 transition-colors">
                                                <td className="py-3 px-4">
                                                    <div className="font-semibold">{stock.name}</div>
                                                    <div className="text-xs text-muted-foreground">{stock.symbol}</div>
                                                </td>
                                                <td className="text-right py-3 px-4">{position.shares}</td>
                                                <td className="text-right py-3 px-4 text-green-600 dark:text-green-400 font-medium">
                                                    {stock.dividendYield?.toFixed(2)}%
                                                </td>
                                                <td className="text-right py-3 px-4 font-semibold text-primary">
                                                    {annualDisplay}
                                                </td>
                                                <td className="text-right py-3 px-4 text-muted-foreground">
                                                    CHF {quarterlyDividend.toFixed(2)}
                                                </td>
                                                <td className="text-right py-3 px-4 text-muted-foreground">
                                                    {translateFrequency(stock.dividendFrequency)}
                                                </td>
                                                <td className="text-right py-3 px-4 text-muted-foreground">
                                                    {stock.dividendExDate
                                                        ? new Date(stock.dividendExDate).toLocaleDateString('de-DE')
                                                        : '-'}
                                                </td>
                                                <td className="text-right py-3 px-4 text-muted-foreground">
                                                    {stock.dividendPayDate
                                                        ? new Date(stock.dividendPayDate).toLocaleDateString('de-DE')
                                                        : '-'}
                                                </td>
                                                <td className="text-right py-3 px-4">
                                                    <button
                                                        onClick={() => setEditingStock(stock)}
                                                        className="p-2 hover:bg-primary/10 text-primary rounded-lg transition-colors"
                                                        title="Bearbeiten"
                                                    >
                                                        <Edit className="size-4" />
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <AddDividendModal
                isOpen={isAddModalOpen || !!editingStock}
                onClose={() => {
                    setIsAddModalOpen(false);
                    setEditingStock(null);
                }}
                editingStock={editingStock}
            />
        </div>
    );
}
