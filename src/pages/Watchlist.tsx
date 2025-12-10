import { useState } from 'react';
import { usePortfolio } from '../context/PortfolioContext';

import { useCurrencyFormatter } from '../utils/currency';
import { Eye, Plus, Trash2, Edit, AlertCircle } from 'lucide-react';
import { EditStockDialog } from '../components/EditStockDialog';
import { AddWatchlistStockModal } from '../components/AddWatchlistStockModal';

export function Watchlist() {
    const { stocks, watchlist, removeFromWatchlist, addToWatchlist } = usePortfolio();
    const { formatCurrency } = useCurrencyFormatter();
    const [isAddStockOpen, setIsAddStockOpen] = useState(false);
    const [editingStock, setEditingStock] = useState<any>(null);

    // Filter stocks that are in the watchlist
    const watchlistStocks = stocks.filter(s => watchlist.includes(s.id));

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Watchlist</h1>
                    <p className="text-muted-foreground mt-1">
                        Beobachten Sie interessante Aktien und deren Dividenden.
                    </p>
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

            <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-muted/50 text-muted-foreground font-medium border-b border-border">
                            <tr>
                                <th className="px-4 py-3">Name</th>
                                <th className="px-4 py-3 text-right">Kurs</th>
                                <th className="px-4 py-3 text-right">Rendite</th>
                                <th className="px-4 py-3 text-right">Dividende</th>
                                <th className="px-4 py-3">Ex-Datum</th>
                                <th className="px-4 py-3 text-center">Aktion</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {watchlistStocks.map((stock) => {
                                const daysToEx = stock.dividendExDate ? Math.ceil((new Date(stock.dividendExDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)) : null;
                                const isExSoon = daysToEx !== null && daysToEx >= 0 && daysToEx <= 14;

                                return (
                                    <tr key={stock.id} className="hover:bg-muted/30 transition-colors group">
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-3">
                                                {stock.logoUrl ? (
                                                    <img src={stock.logoUrl} alt={stock.symbol} className="size-8 rounded-full bg-white object-contain p-1 border border-border" />
                                                ) : (
                                                    <div className="size-8 rounded-full bg-muted flex items-center justify-center">
                                                        <span className="font-bold text-xs">{stock.symbol.slice(0, 2)}</span>
                                                    </div>
                                                )}
                                                <div>
                                                    <p className="font-medium text-foreground">{stock.name}</p>
                                                    <p className="text-xs text-muted-foreground">{stock.symbol}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-right font-medium">
                                            {formatCurrency(stock.currentPrice, stock.currency)}
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            {stock.dividendYield ? (
                                                <span className="inline-flex items-center px-2 py-0.5 rounded bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 font-medium text-xs">
                                                    {stock.dividendYield.toFixed(2)}%
                                                </span>
                                            ) : '-'}
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            {stock.dividendAmount ? formatCurrency(stock.dividendAmount, stock.dividendCurrency || stock.currency) : '-'}
                                            <span className="text-xs text-muted-foreground block">
                                                {stock.dividendFrequency === 'quarterly' ? 'pro Quartal' : 'pro Jahr'}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3">
                                            {stock.dividendExDate ? (
                                                <div className="flex items-center gap-2">
                                                    <span>{new Date(stock.dividendExDate).toLocaleDateString('de-DE')}</span>
                                                    {isExSoon && (
                                                        <span title={`Ex-Datum in ${daysToEx} Tagen`} className="text-yellow-600 dark:text-yellow-400">
                                                            <AlertCircle className="size-4" />
                                                        </span>
                                                    )}
                                                </div>
                                            ) : '-'}
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <div className="flex items-center justify-center gap-1 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
                                                <button
                                                    onClick={() => {
                                                        setEditingStock(stock);
                                                        setIsAddStockOpen(true);
                                                    }}
                                                    className="p-1.5 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded transition-colors"
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
                                                    className="p-1.5 text-muted-foreground hover:text-red-500 hover:bg-red-500/10 rounded transition-colors"
                                                    title="Entfernen"
                                                >
                                                    <Trash2 className="size-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                            {watchlistStocks.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">
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
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Reuse EditStockDialog mostly, but need to handle "Saving" correctly. 
                EditStockDialog updates stock in context.
                We just need to make sure we ADD it to watchlist if it's new.
            */}
            {/* 
               Actually, EditStockDialog takes an existing stock. 
               If we are adding a NEW stock, we need a way to create it first.
               Usually AddStock logic is slightly different.
               Can we use a "AddStockModal" or reuse EditStockDialog?
               EditStockDialog expects `stock` prop.
               
               If we want to ADD, we might need a "StockSearch" or "NewStockForm".
               For now, let's assume we use a specialized "AddWatchlistStockModal" or 
               just a simple form if EditStockDialog is too coupled to existing stocks.
               
               However, I see `AddDividendModal` handles adding new dividends?
               Let's reuse `AddDividendModal`? No, that edits dividends.
               
               Let's creaate a simple AddToWatchlistModal component?
               Or just reuse `AddPositionModal` logic without the "Shares" part?
               
               Let's stub the modal logic nicely.
               I will create a temporary `AddWatchlistStockModal` inside the page file or separate?
               Project structure suggests separate components.
               
               Let's use a "StockSelector" modal.
               If stock exists, add to watchlist.
               If not, create new stock then add.
               
               For MVP, I'll just use a simple mock-Add modal if needed, or better:
               I'll import `EditStockDialog` but I need to pass a "dummy" stock object if it's new?
               No, `EditStockDialog` edits an EXISTING stock.
               
               I'll create `AddWatchlistStockModal.tsx` next.
               For now, I'll comment out the Modal usage and just put a placeholder.
            */}
            <AddWatchlistStockModal
                isOpen={isAddStockOpen}
                onClose={() => setIsAddStockOpen(false)}
                onAdd={(stockId) => {
                    addToWatchlist(stockId);
                    setIsAddStockOpen(false);
                }}
            />

            {editingStock && (
                <EditStockDialog
                    stock={editingStock}
                    isOpen={!!editingStock}
                    onClose={() => setEditingStock(null)}
                />
            )}
        </div>
    );
}




