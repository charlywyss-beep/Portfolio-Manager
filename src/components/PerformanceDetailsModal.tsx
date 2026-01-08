import { X, TrendingUp, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import { useCurrencyFormatter } from '../utils/currency';
import { cn } from '../utils';
import { Logo } from './Logo';
import { estimateMarketState } from '../utils/market';
import { usePortfolio } from '../context/PortfolioContext';

interface PerformanceDetailsModalProps {
    isOpen: boolean;
    onClose: () => void;
    positions: any[]; // Using any to avoid complex import of Position type extended with dailyGain
}

export function PerformanceDetailsModal({ isOpen, onClose, positions }: PerformanceDetailsModalProps) {
    const { convertToCHF, formatCurrency } = useCurrencyFormatter();
    const { refreshAllPrices, isGlobalRefreshing, lastGlobalRefresh, refreshTick } = usePortfolio();
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

    // Unified Timer Tracking (v3.12.70): Replaced local interval with dependency on global refreshTick
    useEffect(() => {
        // Modal re-renders automatically when refreshTick changes
    }, [refreshTick]);

    if (!isOpen) return null;

    // Sort positions: Stocks first (A-Z), then ETFs (A-Z)
    const sortedPositions = [...positions].sort((a, b) => {
        // 1. Sort by Type (Stock before ETF)
        const typeA = a.stock.type?.toLowerCase() || 'stock';
        const typeB = b.stock.type?.toLowerCase() || 'stock';

        // Custom order: stock comes before etf
        const isEtfA = typeA === 'etf';
        const isEtfB = typeB === 'etf';

        if (isEtfA !== isEtfB) {
            return isEtfA ? 1 : -1; // Stocks first
        }

        // 2. Sort by Name (A-Z)
        return a.stock.name.localeCompare(b.stock.name);
    });

    const totalDailyGain = sortedPositions.reduce((sum, p) => sum + convertToCHF(p.dailyGain, p.stock.currency), 0);

    const totalPerformanceGain = sortedPositions.reduce((sum, p) => {
        const currentValue = p.shares * p.stock.currentPrice;
        const purchaseValue = (p.purchases || []).reduce((pSum: number, purchase: any) =>
            pSum + (purchase.shares * purchase.price), 0);
        const gain = currentValue - purchaseValue;
        return sum + convertToCHF(gain, p.stock.currency);
    }, 0);

    const handleRowClick = (stockId: string) => {
        navigate(`/stock/${stockId}?from=performance`);
        onClose();
    };

    return (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
            <div className="absolute bg-black/50 rounded-xl" style={{
                width: 'min(calc(100vw - 2rem), calc(56rem + 300px))',
                height: 'min(calc(100vh - 2rem), calc(85vh + 240px))'
            }}></div>
            <div className="bg-card border border-border rounded-xl shadow-xl w-full max-w-[95vw] md:max-w-4xl max-h-[85vh] flex flex-col animate-in fade-in zoom-in-95 duration-200 relative z-10">
                <div className="flex items-center justify-between p-4 border-b border-border">
                    <h2 className="text-lg font-bold flex items-center gap-2">
                        <TrendingUp className="size-5 text-blue-500" />
                        Performance Details
                    </h2>
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
                            title="Alle Aktienpreise aktualisieren"
                        >
                            <RefreshCw className={cn("size-3.5", isGlobalRefreshing && "animate-spin")} />
                            <span>
                                {isGlobalRefreshing
                                    ? 'Aktualisiere...'
                                    : lastGlobalRefresh
                                        ? `Vor ${Math.floor((new Date().getTime() - lastGlobalRefresh.getTime()) / 60000)} Min`
                                        : 'Jetzt aktualisieren'}
                            </span>
                        </button>
                        <button onClick={onClose} className="p-2 hover:bg-secondary rounded-full transition-colors">
                            <X className="size-5" />
                        </button>
                    </div>
                </div>

                <div className="overflow-y-auto p-0 flex-1">
                    <table className="w-full text-xs md:text-sm">
                        <thead className="bg-muted/30 sticky top-0 z-10">
                            <tr className="border-b border-border">
                                <th className="text-left py-2 px-4 font-medium text-muted-foreground">Aktie / ETF</th>
                                <th style={{ width: '20px' }}></th>
                                <th className="text-right py-2 px-1 font-medium text-muted-foreground text-xs" style={{ width: '95px', whiteSpace: 'nowrap' }}>
                                    Kurs am: {new Date().toLocaleDateString('de-CH', { day: '2-digit', month: '2-digit' })}
                                </th>
                                <th className="text-right py-2 pr-4 pl-1 font-medium text-muted-foreground text-xs" style={{ width: '100px', whiteSpace: 'nowrap' }}>
                                    CHF +/- am: {new Date().toLocaleDateString('de-CH', { day: '2-digit', month: '2-digit' })}
                                </th>
                                <th style={{ width: '110px' }}></th>
                                <th className="text-right py-2 px-1 font-medium text-muted-foreground text-xs" style={{ width: '60px', whiteSpace: 'nowrap' }}>Performance %</th>
                                <th className="text-right py-2 pr-4 pl-1 font-medium text-muted-foreground text-xs" style={{ width: '150px', whiteSpace: 'nowrap' }}>Performance CHF</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {sortedPositions.map((p) => {
                                const dailyGainCHF = convertToCHF(p.dailyGain, p.stock.currency);
                                const isDailyPositive = dailyGainCHF >= 0;

                                // Calculate total performance
                                const currentValue = p.shares * p.stock.currentPrice;
                                const purchaseValue = (p.purchases || []).reduce((sum: number, purchase: any) =>
                                    sum + (purchase.shares * purchase.price), 0);
                                const totalGain = currentValue - purchaseValue;
                                const totalGainCHF = convertToCHF(totalGain, p.stock.currency);
                                const totalGainPercent = purchaseValue > 0 ? ((currentValue - purchaseValue) / purchaseValue) * 100 : 0;
                                const isTotalPositive = totalGainCHF >= 0;

                                // Market State Logic (v3.11.481):
                                // Strict Time-based.
                                const calcState = estimateMarketState(p.stock.symbol, p.stock.currency);
                                const isMarketOpen = calcState === 'REGULAR'; // Only Regular Trading Hours = Green

                                return (
                                    <tr
                                        key={p.id}
                                        onClick={() => handleRowClick(p.stock.id)}
                                        className="hover:bg-muted/30 transition-colors cursor-pointer group border-b border-border/50"
                                    >
                                        <td className="py-3 px-4 font-medium">
                                            <div className="flex items-center gap-3">
                                                <Logo
                                                    url={p.stock.logoUrl}
                                                    alt={p.stock.name}
                                                    fallback={p.stock.symbol.slice(0, 2)}
                                                    size="size-10"
                                                />
                                                <div className="flex flex-col min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <div className="break-words whitespace-pre-line text-sm group-hover:text-primary transition-colors leading-tight">{p.stock.name}</div>
                                                        {isMarketOpen ? (
                                                            <div className="size-2.5 flex-shrink-0 rounded-full bg-green-500 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.5)] border border-background" title={`Markt geöffnet (${calcState})`} />
                                                        ) : (
                                                            <div className="size-2.5 flex-shrink-0 rounded-full bg-red-500 border border-background" title={`Markt geschlossen (${calcState})`} />
                                                        )}
                                                    </div>
                                                    <span className="text-[10px] text-muted-foreground">{p.stock.symbol}</span>
                                                </div>
                                            </div>
                                        </td>
                                        <td style={{ width: '20px' }}></td>
                                        {/* Daily Performance */}
                                        <td className={cn("py-3 px-1 text-right font-medium text-xs", isDailyPositive ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400")} style={{ width: '60px' }}>
                                            {isDailyPositive ? '+' : ''}{p.dailyGainPercent.toFixed(2)}%
                                        </td>
                                        <td className={cn("py-3 pr-4 pl-1 text-right font-medium", isDailyPositive ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400")} style={{ width: '100px' }}>
                                            {isDailyPositive ? '+' : ''}{formatCurrency(dailyGainCHF, 'CHF').replace('CHF', '').trim()}
                                        </td>
                                        <td style={{ width: '150px' }}></td>
                                        {/* Total Performance */}
                                        <td className={cn("py-3 px-1 text-right font-medium text-xs", isTotalPositive ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400")} style={{ width: '60px' }}>
                                            {isTotalPositive ? '+' : ''}{totalGainPercent.toFixed(2)}%
                                        </td>
                                        <td className={cn("py-3 pr-4 pl-1 text-right font-bold", isTotalPositive ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400")} style={{ width: '150px' }}>
                                            {isTotalPositive ? '+' : ''}{formatCurrency(totalGainCHF, 'CHF').replace('CHF', '').trim()}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                        <tfoot className="bg-muted/20 border-t border-border">
                            <tr>
                                <td className="py-3 px-4 font-semibold text-muted-foreground" style={{ whiteSpace: 'nowrap' }}>Total:</td>
                                <td style={{ width: '20px' }}></td>
                                <td className="py-3 px-1" style={{ width: '60px', whiteSpace: 'nowrap' }}></td>
                                <td className={cn("py-3 pr-4 pl-1 text-right font-bold", totalDailyGain >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400")} style={{ width: '100px', whiteSpace: 'nowrap' }}>
                                    {totalDailyGain >= 0 ? '+' : ''}{formatCurrency(totalDailyGain, 'CHF')}
                                </td>
                                <td style={{ width: '150px' }}></td>
                                <td className="py-3 px-1" style={{ width: '60px', whiteSpace: 'nowrap' }}></td>
                                <td className={cn("py-3 pr-4 pl-1 text-right font-bold", totalPerformanceGain >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400")} style={{ width: '150px', whiteSpace: 'nowrap' }}>
                                    {totalPerformanceGain >= 0 ? '+' : ''}{formatCurrency(totalPerformanceGain, 'CHF')}
                                </td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>
        </div>
    );
}
