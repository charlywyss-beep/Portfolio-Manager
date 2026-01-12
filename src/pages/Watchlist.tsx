import { useState, useEffect } from 'react';
import { usePortfolio } from '../context/PortfolioContext';
import { useNavigate } from 'react-router-dom';

import { useCurrencyFormatter } from '../utils/currency';

import { getCurrentDividendPeriod, translateFrequency } from '../utils/dividend';
import { Eye, Plus, Trash2, Edit, ShoppingBag, RefreshCw } from 'lucide-react';
import { Logo } from '../components/Logo';
import { cn } from '../utils';
import { estimateMarketState } from '../utils/market';

import { AddPositionModal } from '../components/AddPositionModal'; // Import AddPositionModal
import type { Stock } from '../types';

export function Watchlist() {
    const navigate = useNavigate();
    const { stocks, watchlist, removeFromWatchlist, addPosition, lastGlobalRefresh, isGlobalRefreshing, refreshAllPrices, refreshTick } = usePortfolio(); // Get refresh + tick
    const { formatCurrency } = useCurrencyFormatter();
    const [buyStock, setBuyStock] = useState<Stock | null>(null); // State for buying stock

    // Sorting
    const [sortConfig, setSortConfig] = useState<{ key: 'name' | 'yield' | 'gap' | 'sellGap', direction: 'asc' | 'desc' }>({ key: 'name', direction: 'asc' });

    // Filter stocks that are in the watchlist
    const watchlistStocks = stocks
        .filter(s => watchlist.includes(s.id))
        .sort((a, b) => {
            if (sortConfig.key === 'name') {
                return a.name.localeCompare(b.name);
            }
            if (sortConfig.key === 'yield') {
                const yieldA = a.dividendYield || 0;
                const yieldB = b.dividendYield || 0;
                return yieldB - yieldA; // Descending
            }
            if (sortConfig.key === 'gap') {
                // Sort by how close to target price (gap percent)
                // Smallest gap first? Or largest potential? Let's say: Undervalued (Gap > 0) first.
                // Or simply: Current / Target ratio?
                // Gap % = (Current - Target) / Target
                // If Target undefined, use Infinity
                const targetA = a.targetPrice || 0;
                const targetB = b.targetPrice || 0;
                if (!targetA) return 1;
                if (!targetB) return -1;

                // Gap: (Current - Target) / Target. Negative is good (Undervalued)
                const gapA = (a.currentPrice - targetA) / targetA;
                const gapB = (b.currentPrice - targetB) / targetB;

                return gapA - gapB; // Ascending (Most undervalued first)
            }
            if (sortConfig.key === 'sellGap') {
                const sellA = a.sellLimit || 0;
                const sellB = b.sellLimit || 0;
                if (!sellA) return 1;
                if (!sellB) return -1;

                // Gap: (SellLimit - Current) / SellLimit. Positive means not reached yet.
                const gapA = (sellA - a.currentPrice) / sellA;
                const gapB = (sellB - b.currentPrice) / sellB;
                return gapA - gapB; // Smallest gap first (closest to sell)
            }
            return 0;
        });

    // Unified Timer Tracking (v3.12.70): Replaced local interval with dependency on global refreshTick
    useEffect(() => {
        // Auto-refresh if last refresh was more than 5 minutes ago
        if (lastGlobalRefresh) {
            const minutesSinceRefresh = Math.floor((new Date().getTime() - lastGlobalRefresh.getTime()) / 60000);
            if (minutesSinceRefresh >= 5 && !isGlobalRefreshing) {
                console.log('[Watchlist] Triggering auto-refresh based on global tick...');
                refreshAllPrices();
            }
        }
    }, [refreshTick, lastGlobalRefresh, isGlobalRefreshing, refreshAllPrices]);

    // iOS Safari: Check on visibility change (when tab becomes visible again)
    useEffect(() => {
        const handleVisibilityChange = () => {
            if (!document.hidden && lastGlobalRefresh) {
                const minutesSinceRefresh = Math.floor((new Date().getTime() - lastGlobalRefresh.getTime()) / 60000);
                if (minutesSinceRefresh >= 5 && !isGlobalRefreshing) {
                    refreshAllPrices();
                }
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [lastGlobalRefresh, isGlobalRefreshing, refreshAllPrices]);

    return (
        <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
            {/* Header */}
            <div className="border-b bg-card sticky top-0 z-[100]">
                <div className="w-full px-4 py-4 md:px-4">
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
                                navigate('/calculator?mode=new&from=watchlist');
                            }}
                            className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors font-medium shadow-sm ml-auto"
                        >
                            <Plus className="size-4" />
                            <span>Aktie hinzufügen</span>
                        </button>
                    </div>
                </div>
            </div>

            <div className="w-full px-2 py-4 md:px-4">
                <div className="bg-card rounded-xl border shadow-sm overflow-hidden w-full">
                    <div className="flex flex-col md:flex-row md:items-center justify-between p-4 border-b bg-muted/30 gap-2">
                        <h2 className="text-lg font-semibold">Beobachtete Aktien</h2>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[10px] md:text-xs font-medium text-muted-foreground bg-background/50 px-3 py-1.5 rounded-lg border border-border/50">
                            <span className="hidden sm:inline">Legende:</span>
                            <div className="flex items-center gap-1.5">
                                <div className="flex items-center gap-1 text-green-600 dark:text-green-400">
                                    <div className="size-2 rounded-full bg-green-500 animate-pulse" />
                                    <span className="font-bold">KAUFEN</span>
                                </div>
                                <span>(Kurs &lt; Limit)</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <div className="flex items-center gap-1 text-green-600 dark:text-green-400">
                                    <div className="size-2 rounded-full bg-green-500 animate-pulse" />
                                    <span className="font-bold">VERKAUFEN</span>
                                </div>
                                <span>(Kurs &gt; Limit)</span>
                            </div>
                            <div className="w-px h-3 bg-border hidden sm:block" />
                            <div className="flex items-center gap-1.5">
                                <div className="flex items-center gap-1 text-red-500">
                                    <div className="size-2 rounded-full bg-red-500" />
                                    <span className="font-bold">KEINE INFO</span>
                                </div>
                                <span>(Limit fehlt)</span>
                            </div>
                        </div>
                    </div>

                    <div className="overflow-x-auto w-full overscroll-x-none rounded-xl overflow-hidden overflow-clip bg-card border border-border">
                        <table className="w-full text-left border-collapse min-w-[1000px] md:min-w-0">
                            <thead>
                                <tr className="border-b bg-muted/20">
                                    <th className="p-4 font-semibold text-muted-foreground text-xs uppercase tracking-wider w-auto whitespace-nowrap sticky -left-px z-20 bg-card shadow-[5px_0_5px_-5px_rgba(0,0,0,0.1)]">Aktie</th>
                                    <th
                                        className="p-4 font-semibold text-muted-foreground text-xs uppercase tracking-wider text-right cursor-pointer hover:text-primary transition-colors"
                                        onClick={() => {
                                            setSortConfig({
                                                key: 'yield',
                                                direction: sortConfig.key === 'yield' && sortConfig.direction === 'desc' ? 'asc' : 'desc'
                                            });
                                        }}
                                    >
                                        Div. Rendite {sortConfig.key === 'yield' && (sortConfig.direction === 'desc' ? '↓' : '↑')}
                                    </th>
                                    <th className="p-4 font-semibold text-muted-foreground text-xs uppercase tracking-wider text-right">Aktueller Kurs</th>
                                    <th
                                        className="p-4 font-semibold text-muted-foreground text-xs uppercase tracking-wider text-right cursor-pointer hover:text-primary transition-colors"
                                        onClick={() => {
                                            setSortConfig({
                                                key: 'gap',
                                                direction: sortConfig.key === 'gap' && sortConfig.direction === 'asc' ? 'desc' : 'asc'
                                            });
                                        }}
                                    >
                                        Kauflimit {sortConfig.key === 'gap' && (sortConfig.direction === 'asc' ? '↓' : '↑')}
                                    </th>
                                    <th
                                        className="p-4 font-semibold text-muted-foreground text-xs uppercase tracking-wider text-right cursor-pointer hover:text-primary transition-colors"
                                        onClick={() => {
                                            setSortConfig({
                                                key: 'sellGap',
                                                direction: sortConfig.key === 'sellGap' && sortConfig.direction === 'asc' ? 'desc' : 'asc'
                                            });
                                        }}
                                    >
                                        Verkaufslimit {sortConfig.key === 'sellGap' && (sortConfig.direction === 'asc' ? '↓' : '↑')}
                                    </th>
                                    <th className="p-4 font-semibold text-muted-foreground text-xs uppercase tracking-wider text-right">Nächste Div.</th>
                                    <th className="p-4 font-semibold text-muted-foreground text-xs uppercase tracking-wider text-center w-[100px] sticky -right-px z-20 bg-card shadow-[-5px_0_5px_-5px_rgba(0,0,0,0.1)]">Aktionen</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {watchlistStocks.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="p-12 text-center text-muted-foreground">
                                            <div className="flex flex-col items-center gap-2">
                                                <ShoppingBag className="size-12 opacity-20" />
                                                <p>Deine Watchlist ist noch leer.</p>
                                                <button
                                                    onClick={() => navigate('/calculator?mode=new&from=watchlist')}
                                                    className="text-primary hover:underline font-medium mt-2"
                                                >
                                                    Füge deine erste Aktie hinzu
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    watchlistStocks.map((stock) => {
                                        const period = getCurrentDividendPeriod(stock);
                                        const nextDiv = (period && (period.payDate || period.exDate)) ? {
                                            date: (period.payDate || period.exDate)!,
                                            amount: stock.dividendAmount || 0
                                        } : null;

                                        const isUnderTarget = stock.targetPrice && stock.currentPrice <= stock.targetPrice;
                                        const isOverSell = stock.sellLimit && stock.currentPrice >= stock.sellLimit;

                                        const stockChange = ((stock.currentPrice - stock.previousClose) / stock.previousClose) * 100;

                                        // Market State Logic
                                        const calcState = estimateMarketState(stock.symbol, stock.currency);
                                        const isMarketOpen = calcState === 'REGULAR';

                                        return (
                                            <tr key={stock.id} className="hover:bg-muted/30 transition-colors group">
                                                <td className="p-4 sticky -left-px z-10 group-hover:bg-muted/30 transition-colors shadow-[5px_0_5px_-5px_rgba(0,0,0,0.1)]">
                                                    <div className="absolute inset-0 bg-card -z-10" />
                                                    <div className="flex items-center gap-3 relative">
                                                        <Logo
                                                            url={stock.logoUrl}
                                                            alt={stock.name}
                                                            fallback={stock.symbol.slice(0, 2)}
                                                            size="size-10"
                                                        />
                                                        <div className="flex flex-col min-w-0">
                                                            <div className="flex items-center gap-2">
                                                                <span
                                                                    className="font-bold text-sm whitespace-pre leading-snug group-hover:text-primary transition-colors cursor-pointer"
                                                                    onClick={() => navigate(`/stock/${stock.id}?from=watchlist`)}
                                                                >
                                                                    {stock.name}
                                                                </span>
                                                                {isMarketOpen ? (
                                                                    <div className="size-2 rounded-full bg-green-500 animate-pulse shrink-0 shadow-[0_0_8px_rgba(34,197,94,0.5)] border border-background" title={`Markt geöffnet (${calcState})`} />
                                                                ) : (
                                                                    <div className="size-2 rounded-full bg-red-500 shrink-0 border border-background" title={`Markt geschlossen (${calcState})`} />
                                                                )}
                                                            </div>
                                                            <span className="text-xs text-muted-foreground uppercase">{stock.symbol}</span>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="p-4 text-right">
                                                    <div className="flex flex-col items-end">
                                                        <span className="font-bold text-sm text-green-600 dark:text-green-400">
                                                            {stock.dividendYield ? `${stock.dividendYield.toFixed(2)}%` : '-'}
                                                        </span>
                                                        <span className="text-[10px] text-muted-foreground uppercase tracking-tight">
                                                            {translateFrequency(stock.dividendFrequency)}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="p-4 text-right">
                                                    <div className="flex flex-col items-end">
                                                        <span className="font-bold text-sm">
                                                            {formatCurrency(stock.currentPrice, stock.currency)}
                                                        </span>
                                                        {stock.previousClose !== undefined && (
                                                            <span className={cn(
                                                                "text-[10px] font-bold px-1.5 py-0.5 rounded",
                                                                stockChange >= 0
                                                                    ? "bg-green-500/10 text-green-600"
                                                                    : "bg-red-500/10 text-red-600"
                                                            )}>
                                                                {stockChange >= 0 ? '+' : ''}{stockChange.toFixed(2)}%
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="p-4 text-right">
                                                    <div className="flex flex-col items-end gap-1">
                                                        <div className="flex items-center gap-2">
                                                            {isUnderTarget && (
                                                                <div className="size-2 rounded-full bg-green-500 animate-pulse shrink-0" title="Limit erreicht!" />
                                                            )}
                                                            <span className={cn(
                                                                "font-bold text-sm",
                                                                isUnderTarget ? "text-green-600 dark:text-green-400" : "text-muted-foreground"
                                                            )}>
                                                                {stock.targetPrice ? formatCurrency(stock.targetPrice, stock.currency) : '-'}
                                                            </span>
                                                        </div>
                                                        {stock.targetPrice && (
                                                            <span className="text-[10px] font-medium text-muted-foreground">
                                                                Gap: {((stock.currentPrice - stock.targetPrice) / stock.targetPrice * 100).toFixed(1)}%
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="p-4 text-right">
                                                    <div className="flex flex-col items-end gap-1">
                                                        <div className="flex items-center gap-2">
                                                            {isOverSell && (
                                                                <div className="size-2 rounded-full bg-green-500 animate-pulse shrink-0" title="Verkaufslimit erreicht!" />
                                                            )}
                                                            <span className={cn(
                                                                "font-bold text-sm",
                                                                isOverSell ? "text-green-600 dark:text-green-400" : "text-muted-foreground"
                                                            )}>
                                                                {stock.sellLimit ? formatCurrency(stock.sellLimit, stock.currency) : '-'}
                                                            </span>
                                                        </div>
                                                        {stock.sellLimit && (
                                                            <span className="text-[10px] font-medium text-muted-foreground">
                                                                Gap: {((stock.sellLimit - stock.currentPrice) / stock.sellLimit * 100).toFixed(1)}%
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="p-4 text-right">
                                                    {nextDiv ? (
                                                        <div className="flex flex-col items-end">
                                                            <span className="font-bold text-sm">
                                                                {new Date(nextDiv.date).toLocaleDateString('de-CH', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                                                            </span>
                                                            <span className="text-[10px] text-muted-foreground">
                                                                {formatCurrency(nextDiv.amount, stock.currency)}
                                                            </span>
                                                        </div>
                                                    ) : (
                                                        <span className="text-muted-foreground text-sm">-</span>
                                                    )}
                                                </td>
                                                <td className="p-4 sticky -right-px z-10 group-hover:bg-muted/30 transition-colors shadow-[-5px_0_5px_-5px_rgba(0,0,0,0.1)]">
                                                    <div className="absolute inset-0 bg-card -z-10" />
                                                    <div className="flex items-center justify-center gap-2 relative">
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setBuyStock(stock);
                                                            }}
                                                            className="p-2 text-green-600 bg-green-500/10 hover:bg-green-500/20 rounded-lg transition-colors"
                                                            title="Kaufen"
                                                        >
                                                            <ShoppingBag className="size-4" />
                                                        </button>
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                navigate(`/calculator?mode=edit&id=${stock.id}&from=watchlist`);
                                                            }}
                                                            className="p-2 text-blue-600 bg-blue-500/10 hover:bg-blue-500/20 rounded-lg transition-colors"
                                                            title="Bearbeiten"
                                                        >
                                                            <Edit className="size-4" />
                                                        </button>
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                removeFromWatchlist(stock.id);
                                                            }}
                                                            className="p-2 text-red-500 bg-red-500/10 hover:bg-red-500/20 rounded-lg transition-colors"
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

                    <div className="p-4 border-t bg-muted/10 flex items-center justify-between">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <RefreshCw className={cn("size-3", isGlobalRefreshing && "animate-spin")} />
                            <span>
                                {isGlobalRefreshing
                                    ? 'Aktualisiere Preise...'
                                    : lastGlobalRefresh
                                        ? `Zuletzt aktualisiert: Vor ${Math.floor((new Date().getTime() - lastGlobalRefresh.getTime()) / 60000)} Min`
                                        : 'Preise noch nicht aktualisiert'}
                            </span>
                        </div>
                        <button
                            onClick={() => refreshAllPrices(true)}
                            disabled={isGlobalRefreshing}
                            className="text-xs font-semibold text-primary hover:underline flex items-center gap-1.5"
                        >
                            <span>Jetzt aktualisieren</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Floating Buy Button for Mobile
            <button 
                onClick={() => navigate('/calculator?mode=new&from=watchlist')}
                className="fixed bottom-6 right-6 p-4 rounded-full bg-primary text-primary-foreground shadow-lg hover:scale-110 active:scale-95 transition-all z-50 md:hidden"
            >
                <Plus className="size-6" />
            </button> */}

            {/* AddPositionModal for buying from watchlist */}
            {buyStock && (
                <AddPositionModal
                    isOpen={!!buyStock}
                    onClose={() => setBuyStock(null)}
                    stocks={stocks}
                    onAdd={(pos) => {
                        addPosition(pos);
                        setBuyStock(null);
                    }}
                    preSelectedStock={buyStock}
                />
            )}
        </div>
    );
}
