import { X, TrendingUp } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useCurrencyFormatter } from '../utils/currency';
import { cn } from '../utils';
import { Logo } from './Logo';

interface PerformanceDetailsModalProps {
    isOpen: boolean;
    onClose: () => void;
    positions: any[]; // Using any to avoid complex import of Position type extended with dailyGain
}

export function PerformanceDetailsModal({ isOpen, onClose, positions }: PerformanceDetailsModalProps) {
    const { convertToCHF, formatCurrency } = useCurrencyFormatter();
    const navigate = useNavigate();

    if (!isOpen) return null;

    // Sort positions by daily gain descending
    const sortedPositions = [...positions].sort((a, b) => {
        const valA = convertToCHF(a.dailyGain, a.stock.currency);
        const valB = convertToCHF(b.dailyGain, b.stock.currency);
        return valB - valA;
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
        navigate(`/stock/${stockId}`);
        onClose();
    };

    return (
        <div className="fixed top-16 lg:left-[250px] right-0 bottom-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-card border border-border rounded-xl shadow-xl w-full max-w-4xl max-h-[60vh] flex flex-col animate-in fade-in zoom-in-95 duration-200">
                <div className="flex items-center justify-between p-4 border-b border-border">
                    <h2 className="text-lg font-bold flex items-center gap-2">
                        <TrendingUp className="size-5 text-blue-500" />
                        Performance Details
                    </h2>
                    <button onClick={onClose} className="p-2 hover:bg-secondary rounded-full transition-colors">
                        <X className="size-5" />
                    </button>
                </div>

                <div className="overflow-y-auto p-0 flex-1">
                    <table className="w-full text-sm">
                        <thead className="bg-muted/30 sticky top-0 z-10">
                            <tr className="border-b border-border">
                                <th className="text-left py-2 px-4 font-medium text-muted-foreground">Aktie / ETF</th>
                                <th className="text-right py-2 px-1 font-medium text-muted-foreground text-xs" style={{ width: '95px', whiteSpace: 'nowrap' }}>
                                    {(() => {
                                        // Check if data is fresh (from today)
                                        const now = new Date();
                                        const isFresh = positions.some(p => {
                                            if (!p.stock.lastQuoteDate) return false;
                                            const date = new Date(p.stock.lastQuoteDate);
                                            return date.getDate() === now.getDate() &&
                                                date.getMonth() === now.getMonth() &&
                                                date.getFullYear() === now.getFullYear();
                                        });

                                        if (isFresh) return "Heute %";

                                        // If mixed or old, try to show the most common date or just "Letzter"
                                        const dates = positions.map(p => p.stock.lastQuoteDate ? new Date(p.stock.lastQuoteDate).toLocaleDateString('de-CH', { day: '2-digit', month: '2-digit' }) : '').filter(Boolean);
                                        if (dates.length > 0) {
                                            // Simple heuristic: Take the first one (usually they update together) or generic
                                            return `Kurs ${dates[0]}`;
                                        }
                                        return "Kurs %";
                                    })()}
                                </th>
                                <th className="text-right py-2 pr-4 pl-1 font-medium text-muted-foreground text-xs" style={{ width: '100px', whiteSpace: 'nowrap' }}>
                                    {(() => {
                                        // Check freshness again for CHF label (could DRY this up but inline is fine for now)
                                        const now = new Date();
                                        const isFresh = positions.some(p => {
                                            if (!p.stock.lastQuoteDate) return false;
                                            const date = new Date(p.stock.lastQuoteDate);
                                            return date.getDate() === now.getDate() &&
                                                date.getMonth() === now.getMonth() &&
                                                date.getFullYear() === now.getFullYear();
                                        });
                                        return isFresh ? "Heute CHF" : "Wert CHF";
                                    })()}
                                </th>
                                <th style={{ width: '150px' }}></th>
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

                                return (
                                    <tr
                                        key={p.id}
                                        onClick={() => handleRowClick(p.stock.id)}
                                        className="hover:bg-muted/30 transition-colors cursor-pointer group"
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
                                                    <span className="truncate group-hover:text-primary transition-colors">{p.stock.name}</span>
                                                    <span className="text-[10px] text-muted-foreground">{p.stock.symbol}</span>
                                                </div>
                                            </div>
                                        </td>
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
