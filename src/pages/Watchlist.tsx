import { useState } from 'react';
import { usePortfolio } from '../context/PortfolioContext';

import { useCurrencyFormatter } from '../utils/currency';
import { Eye, Plus, Trash2, Edit, AlertCircle } from 'lucide-react';

import { AddWatchlistStockModal } from '../components/AddWatchlistStockModal';
import { AddDividendModal } from '../components/AddDividendModal';

export function Watchlist() {
    const { stocks, watchlist, removeFromWatchlist, addToWatchlist } = usePortfolio();
    const { formatCurrency } = useCurrencyFormatter();
    const [isAddStockOpen, setIsAddStockOpen] = useState(false);
    const [editingStock, setEditingStock] = useState<any>(null);

    // Filter stocks that are in the watchlist
    const watchlistStocks = stocks.filter(s => watchlist.includes(s.id));

    return (
        <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
            {/* Header */}
            <div className="border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80 sticky top-0 z-10">
                <div className="container mx-auto px-4 py-6">
                    <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                            <div className="p-3 rounded-xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20 text-blue-600 dark:text-blue-400">
                                <Eye className="size-6" />
                            </div>
                            <div>
                                <h1 className="text-3xl font-bold tracking-tight">Watchlist</h1>
                                <p className="text-muted-foreground">Aktien beobachten und Dividenden prüfen</p>
                            </div>
                        </div>

                        <button
                            onClick={() => {
                                setEditingStock(null);
                                setIsAddStockOpen(true);
                            }}
                            className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors font-medium shadow-sm"
                        >
                            <Plus className="size-4" />
                            <span>Aktie hinzufügen</span>
                        </button>
                    </div>
                </div>
            </div>

            <div className="container mx-auto px-4 py-6">
                <div className="bg-card rounded-xl border shadow-sm overflow-hidden">
                    <div className="flex items-center justify-between p-4 border-b bg-muted/30">
                        <h2 className="text-lg font-semibold">Beobachtete Aktien</h2>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-border">
                                    <th className="text-left py-3 px-4 font-semibold">Aktie</th>
                                    <th className="text-right py-3 px-4 font-semibold">Aktueller Kurs</th>
                                    <th className="text-right py-3 px-4 font-semibold">Rendite %</th>
                                    <th className="text-right py-3 px-4 font-semibold">Dividende</th>
                                    <th className="text-right py-3 px-4 font-semibold">Frequenz</th>
                                    <th className="text-right py-3 px-4 font-semibold">Ex-Datum</th>
                                    <th className="text-right py-3 px-4 font-semibold">Pay-Datum</th>
                                    <th className="text-right py-3 px-4 w-24">Aktionen</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {watchlistStocks.length === 0 ? (
                                    <tr>
                                        <td colSpan={8} className="text-center py-12 text-muted-foreground">
                                            <div className="flex flex-col items-center gap-2">
                                                <div className="p-3 bg-muted rounded-full">
                                                    <Eye className="size-6 opacity-50" />
                                                </div>
                                                <p className="font-medium">Noch keine Aktien auf der Watchlist.</p>
                                                <button
                                                    onClick={() => setIsAddStockOpen(true)}
                                                    className="text-primary hover:underline text-sm"
                                                >
                                                    Jetzt hinzufügen
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    watchlistStocks.map((stock) => {
                                        const daysToEx = stock.dividendExDate ? Math.ceil((new Date(stock.dividendExDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)) : null;
                                        const isExSoon = daysToEx !== null && daysToEx >= 0 && daysToEx <= 14;

                                        return (
                                            <tr key={stock.id} className="hover:bg-muted/50 transition-colors group">
                                                <td className="py-3 px-4">
                                                    <div className="flex items-center gap-3">
                                                        {stock.logoUrl ? (
                                                            <img src={stock.logoUrl} alt={stock.symbol} className="size-8 rounded-full bg-white object-contain p-1 border border-border" />
                                                        ) : (
                                                            <div className="size-8 rounded-full bg-muted flex items-center justify-center">
                                                                <span className="font-bold text-xs">{stock.symbol.slice(0, 2)}</span>
                                                            </div>
                                                        )}
                                                        <div>
                                                            <div className="font-semibold">{stock.name}</div>
                                                            <div className="text-xs text-muted-foreground">{stock.symbol}</div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="text-right py-3 px-4 font-medium">
                                                    {formatCurrency(stock.currentPrice, stock.currency)}
                                                </td>
                                                <td className="text-right py-3 px-4 text-green-600 dark:text-green-400 font-medium">
                                                    {stock.dividendYield ? `${stock.dividendYield.toFixed(2)}%` : '-'}
                                                </td>
                                                <td className="text-right py-3 px-4">
                                                    {stock.dividendAmount ? formatCurrency(stock.dividendAmount, stock.dividendCurrency || stock.currency) : '-'}
                                                </td>
                                                <td className="text-right py-3 px-4 text-muted-foreground">
                                                    {stock.dividendFrequency === 'quarterly' ? 'Quarterly'
                                                        : stock.dividendFrequency === 'semi-annually' ? 'Semi-Annually'
                                                            : stock.dividendFrequency === 'monthly' ? 'Monthly'
                                                                : 'Annually'}
                                                </td>
                                                <td className="text-right py-3 px-4 text-muted-foreground">
                                                    <div className="flex flex-col items-end gap-1">
                                                        {stock.dividendDates && stock.dividendDates.length > 0 ? (
                                                            <div className="flex flex-wrap justify-end gap-2">
                                                                {stock.dividendDates
                                                                    .filter(d => d.exDate)
                                                                    .sort((a, b) => new Date(a.exDate).getTime() - new Date(b.exDate).getTime())
                                                                    .map((d, idx) => {
                                                                        const dateObj = new Date(d.exDate);
                                                                        const dDays = Math.ceil((dateObj.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
                                                                        const dIsSoon = dDays >= 0 && dDays <= 14;
                                                                        const quarter = Math.floor(dateObj.getMonth() / 3) + 1;

                                                                        return (
                                                                            <div key={idx} className="flex items-center gap-1">
                                                                                <span className="text-xs text-muted-foreground font-medium">Q{quarter}</span>
                                                                                <span className="text-xs whitespace-nowrap">{dateObj.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' })}</span>
                                                                                {dIsSoon && <AlertCircle className="size-3 text-yellow-500" />}
                                                                            </div>
                                                                        );
                                                                    })}
                                                            </div>
                                                        ) : (
                                                            <div className="flex items-center justify-end gap-2">
                                                                {stock.dividendExDate ? new Date(stock.dividendExDate).toLocaleDateString('de-DE') : '-'}
                                                                {isExSoon && (
                                                                    <span title={`Ex-Datum in ${daysToEx} Tagen`} className="text-yellow-600 dark:text-yellow-400">
                                                                        <AlertCircle className="size-4" />
                                                                    </span>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="text-right py-3 px-4 text-muted-foreground">
                                                    {stock.dividendPayDate ? new Date(stock.dividendPayDate).toLocaleDateString('de-DE') : '-'}
                                                </td>
                                                <td className="text-right py-3 px-4">
                                                    <div className="flex items-center justify-end gap-1 opacity-100 transition-opacity">
                                                        <button
                                                            onClick={() => {
                                                                setEditingStock(stock);
                                                                setIsAddStockOpen(true);
                                                            }}
                                                            className="p-2 hover:bg-primary/10 text-primary rounded-lg transition-colors"
                                                            title="Bearbeiten"
                                                        >
                                                            <Edit className="size-4" />
                                                        </button>
                                                        <button
                                                            onClick={() => {
                                                                if (confirm(`${stock.name} von der Watchlist entfernen?`)) {
                                                                    removeFromWatchlist(stock.id);
                                                                }
                                                            }}
                                                            className="p-2 hover:bg-red-500/10 text-red-500 rounded-lg transition-colors"
                                                            title="Entfernen"
                                                        >
                                                            <Trash2 className="size-4" />
                                                        </button>
                                                    </div>
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

            <AddWatchlistStockModal
                isOpen={isAddStockOpen}
                onClose={() => setIsAddStockOpen(false)}
                onAdd={(stockId) => {
                    addToWatchlist(stockId);
                    setIsAddStockOpen(false);
                }}
            />

            {editingStock && (
                <AddDividendModal
                    editingStock={editingStock}
                    isOpen={!!editingStock}
                    onClose={() => setEditingStock(null)}
                />
            )}
        </div>
    );
}




