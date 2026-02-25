import { X, TrendingUp, RefreshCw, ShoppingBag } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import { useCurrencyFormatter } from '../utils/currency';
import { cn } from '../utils';
import { Logo } from './Logo';
import { estimateMarketState } from '../utils/market';
import { usePortfolio } from '../context/PortfolioContext';

interface WatchlistPerformanceModalProps {
    isOpen: boolean;
    onClose: () => void;
    activeWatchlistId?: string;
}

export function WatchlistPerformanceModal({ isOpen, onClose, activeWatchlistId }: WatchlistPerformanceModalProps) {
    const { convertToCHF, formatCurrency } = useCurrencyFormatter();
    const { stocks, watchlists, positions, refreshAllPrices, isGlobalRefreshing, lastGlobalRefresh } = usePortfolio();
    const navigate = useNavigate();

    // Prevent body scroll when modal is open
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, [isOpen]);

    if (!isOpen) return null;

    // Get stock IDs based on the active watchlist
    const activeWatchlist = activeWatchlistId && activeWatchlistId !== 'owned'
        ? watchlists.find(w => w.id === activeWatchlistId)
        : null;

    let watchlistStockIds: string[];
    if (activeWatchlistId === 'owned' || !activeWatchlistId) {
        // "Bestand" mode or no specific tab: show all stocks that have positions
        watchlistStockIds = stocks
            .filter(s => positions.some(p => String(p.stockId) === String(s.id)))
            .map(s => s.id);
    } else if (activeWatchlist) {
        watchlistStockIds = activeWatchlist.stockIds || [];
    } else {
        // Fallback to default watchlist
        const defaultWatchlist = watchlists.find(w => w.isDefault) || watchlists[0];
        watchlistStockIds = defaultWatchlist?.stockIds || [];
    }

    // Determine active tab name for the subtitle
    const activeTabName = activeWatchlistId === 'owned'
        ? 'Bestand'
        : activeWatchlist?.name || 'Alle Aktien';

    // Get watchlist stocks and enrich them
    const watchlistData = stocks
        .filter(s => watchlistStockIds.includes(s.id))
        .map(stock => {
            const pos = positions.find(p => String(p.stockId) === String(stock.id));
            const dailyChange = stock.currentPrice - (stock.previousClose || stock.currentPrice);
            const dailyGainPercent = stock.previousClose ? (dailyChange / stock.previousClose) * 100 : 0;

            // If owned, dailyGain in CHF
            const dailyGainCHF = pos ? dailyChange * pos.shares : 0;

            // Total Performance if owned
            let totalGainPercent = 0;
            let totalGainCHF = 0;
            if (pos) {
                const currentValue = pos.shares * stock.currentPrice;
                const purchaseValue = (pos.purchases || []).reduce((sum: number, purchase: any) =>
                    sum + (purchase.shares * purchase.price), 0);
                totalGainCHF = currentValue - purchaseValue;
                totalGainPercent = purchaseValue > 0 ? (totalGainCHF / purchaseValue) * 100 : 0;
            }

            return {
                stock,
                pos,
                dailyChange,
                dailyGainPercent,
                dailyGainCHF,
                totalGainPercent,
                totalGainCHF,
                isOwned: !!pos
            };
        })
        .sort((a, b) => a.stock.name.localeCompare(b.stock.name));

    const ownedData = watchlistData.filter(d => d.isOwned);
    const potentialData = watchlistData.filter(d => !d.isOwned);

    const handleRowClick = (stockId: string) => {
        navigate(`/stock/${stockId}?from=watchlist-performance`);
        onClose();
    };

    const renderRow = ({ stock, dailyGainPercent, dailyGainCHF, totalGainPercent, totalGainCHF, isOwned }: any) => {
        const calcState = estimateMarketState(stock.symbol, stock.currency);
        const isMarketOpen = calcState === 'REGULAR';
        const isDailyPositive = dailyGainPercent >= 0;

        const targetPrice = stock.targetPrice;
        const buyGap = targetPrice ? ((stock.currentPrice - targetPrice) / targetPrice * 100) : null;
        const isLimitReached = buyGap !== null && buyGap <= 0;

        return (
            <tr
                key={stock.id}
                onClick={() => handleRowClick(stock.id)}
                className="hover:bg-muted/30 transition-colors cursor-pointer group"
            >
                <td className="py-4 px-4">
                    <div className="flex items-center gap-3">
                        <Logo
                            url={stock.logoUrl}
                            alt={stock.name}
                            fallback={stock.symbol.slice(0, 2)}
                            size="size-10"
                        />
                        <div className="flex flex-col min-w-0">
                            <div className="flex items-center gap-1.5">
                                <span className="font-bold text-sm truncate group-hover:text-primary transition-colors leading-tight">{stock.name}</span>
                                {isMarketOpen ? (
                                    <div className="size-2 rounded-full bg-green-500 animate-pulse shrink-0 border border-background shadow-[0_0_8px_rgba(34,197,94,0.4)]" />
                                ) : (
                                    <div className="size-2 rounded-full bg-red-500 shrink-0 border border-background" />
                                )}
                            </div>
                            <span className="text-[10px] text-muted-foreground uppercase font-mono">{stock.symbol}</span>
                        </div>
                    </div>
                </td>
                <td className="py-4 px-2 text-right font-bold font-mono whitespace-nowrap">
                    {formatCurrency(stock.currentPrice, stock.currency)}
                </td>
                <td className={cn("py-4 px-2 text-right font-bold font-mono whitespace-nowrap", isDailyPositive ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400")}>
                    {isDailyPositive ? '+' : ''}{dailyGainPercent.toFixed(2)}%
                </td>
                <td className={cn("py-4 px-2 text-right font-semibold font-mono whitespace-nowrap opacity-80", isDailyPositive ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400")}>
                    {isOwned ? (
                        <>{isDailyPositive ? '+' : ''}{formatCurrency(convertToCHF(dailyGainCHF, stock.currency), 'CHF').replace('CHF', '').trim()}</>
                    ) : (
                        <span className="text-muted-foreground/30">-</span>
                    )}
                </td>
                <td className="py-4 px-2 text-right font-medium text-muted-foreground border-l border-border/50 whitespace-nowrap">
                    {targetPrice ? formatCurrency(targetPrice, stock.currency) : '-'}
                </td>
                <td className={cn("py-4 px-2 text-right font-bold font-mono border-r border-border/50 whitespace-nowrap", isLimitReached ? "text-green-600 dark:text-green-400" : "text-muted-foreground/60")}>
                    {buyGap !== null ? (
                        <>{buyGap > 0 ? '+' : ''}{buyGap.toFixed(1)}%</>
                    ) : '-'}
                    {isLimitReached && <ShoppingBag className="size-3 inline-block ml-1 mb-0.5 animate-bounce" />}
                </td>
                <td className="py-4 px-4 bg-muted/10">
                    {isOwned ? (
                        <div className="flex flex-col items-end">
                            <div className={cn("font-bold text-sm", totalGainPercent >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400")}>
                                {totalGainPercent >= 0 ? '+' : ''}{totalGainPercent.toFixed(2)}%
                            </div>
                            <div className={cn("text-[10px] font-medium opacity-70", totalGainPercent >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400")}>
                                {totalGainPercent >= 0 ? '+' : ''}{formatCurrency(convertToCHF(totalGainCHF, stock.currency), 'CHF')}
                            </div>
                        </div>
                    ) : (
                        <div className="text-center text-[10px] text-muted-foreground/40 italic uppercase tracking-tighter">Kein Bestand</div>
                    )}
                </td>
            </tr>
        );
    };

    return (
        <div className="fixed inset-0 flex items-center justify-center z-[110] p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose}></div>
            <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-[95vw] md:max-w-6xl max-h-[90vh] flex flex-col animate-in fade-in zoom-in-95 duration-200 relative z-10">
                <div className="flex items-center justify-between p-4 border-b border-border">
                    <div className="flex flex-col">
                        <h2 className="text-lg font-bold flex items-center gap-2">
                            <TrendingUp className="size-5 text-blue-500" />
                            Watchlist Performance
                        </h2>
                        <p className="text-xs text-muted-foreground">Detailansicht deiner beobachteten Aktien — <span className="font-semibold text-foreground">{activeTabName}</span></p>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => refreshAllPrices(true)}
                            disabled={isGlobalRefreshing}
                            className={cn(
                                "flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all shadow-sm",
                                "bg-blue-600 text-white border-blue-700 hover:bg-blue-700 hover:border-blue-800",
                                "active:scale-95",
                                isGlobalRefreshing && "opacity-50 cursor-not-allowed"
                            )}
                        >
                            <RefreshCw className={cn("size-3.5", isGlobalRefreshing && "animate-spin")} />
                            <span>
                                {isGlobalRefreshing
                                    ? '...'
                                    : lastGlobalRefresh
                                        ? `vor ${Math.floor((new Date().getTime() - lastGlobalRefresh.getTime()) / 60000)}m`
                                        : 'Update'}
                            </span>
                        </button>
                        <button onClick={onClose} className="p-2 hover:bg-secondary rounded-full transition-colors ml-2">
                            <X className="size-5" />
                        </button>
                    </div>
                </div>

                <div className="overflow-auto p-0 flex-1">
                    <table className="w-full text-xs md:text-sm border-collapse">
                        <thead className="bg-muted/30 sticky top-0 z-10">
                            <tr className="border-b border-border">
                                <th className="text-left py-3 px-4 font-semibold text-muted-foreground uppercase tracking-wider">Aktie</th>
                                <th className="text-right py-3 px-2 font-semibold text-muted-foreground uppercase tracking-wider">Kurs</th>
                                <th className="text-right py-3 px-2 font-semibold text-muted-foreground uppercase tracking-wider">Tag %</th>
                                <th className="text-right py-3 px-2 font-semibold text-muted-foreground uppercase tracking-wider">Tag CHF</th>
                                <th className="text-right py-3 px-2 font-semibold text-muted-foreground uppercase tracking-wider border-l border-border/50">Kauflimit</th>
                                <th className="text-right py-3 px-2 font-semibold text-muted-foreground uppercase tracking-wider border-r border-border/50">Gap %</th>
                                <th className="text-right py-3 px-4 font-semibold text-muted-foreground uppercase tracking-wider bg-blue-500/5">Status Portfolio</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border/50">
                            {/* BESTAND */}
                            {ownedData.length > 0 && (
                                <tr className="bg-green-500/5">
                                    <td colSpan={7} className="py-2 px-4 border-b border-green-500/10">
                                        <div className="flex items-center gap-2 text-green-600 dark:text-green-400 font-bold uppercase tracking-wider text-[10px]">
                                            <ShoppingBag className="size-3" />
                                            Aktien im Bestand
                                        </div>
                                    </td>
                                </tr>
                            )}
                            {ownedData.map(renderRow)}

                            {/* POTENZIALE */}
                            {potentialData.length > 0 && (
                                <tr className="bg-blue-500/5">
                                    <td colSpan={7} className="py-2 px-4 border-b border-blue-500/10">
                                        <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 font-bold uppercase tracking-wider text-[10px]">
                                            <TrendingUp className="size-3" />
                                            Potenzielle Investments
                                        </div>
                                    </td>
                                </tr>
                            )}
                            {potentialData.map(renderRow)}
                        </tbody>
                    </table>
                </div>
                <div className="p-3 bg-muted/20 border-t border-border text-[10px] text-muted-foreground flex justify-between items-center">
                    <div>{watchlistData.length} beobachtete Aktien insgesamt</div>
                    <div className="flex items-center gap-1">
                        <div className="size-1.5 rounded-full bg-blue-500" />
                        <span>CHF Werte basieren auf aktuellem Wechselkurs</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
