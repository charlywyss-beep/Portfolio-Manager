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

    // Calculate total performance (since purchase)
    const totalPerformanceGain = sortedPositions.reduce((sum, p) => {
        const currentValue = p.shares * p.stock.currentPrice;
        const purchaseValue = p.purchases.reduce((pSum: number, purchase: any) =>
            pSum + (purchase.shares * purchase.price), 0);
        const gain = currentValue - purchaseValue;
        return sum + convertToCHF(gain, p.stock.currency);
    }, 0);

    const handleRowClick = (stockId: string) => {
        navigate(`/stock/${stockId}`);
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-card border border-border rounded-xl shadow-xl w-full max-w-4xl max-h-[80vh] flex flex-col animate-in fade-in zoom-in-95 duration-200">
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
                        <thead className="bg-muted/30 sticky top-0 backdrop-blur-md z-10">
                            <tr className="border-b border-border">
                                <th className="text-left py-2 px-4 font-medium text-muted-foreground">Aktie / ETF</th>
                                <th className="text-right py-2 pl-8 pr-3 font-medium text-muted-foreground text-xs uppercase tracking-wider" colSpan={2}>
                                    Heute
                                </th>
                                <th className="text-right py-2 pr-4 font-medium text-muted-foreground text-xs uppercase tracking-wider" colSpan={2} style={{ paddingLeft: '200px' }}>
                                    Performance
                                </th>
                            </tr>
                            <tr className="border-b border-border">
                                <th className="text-left py-1 px-4"></th>
                                <th className="text-right py-1 px-1 font-medium text-muted-foreground text-xs" style={{ width: '60px' }}>%</th>
                                <th className="text-right py-1 px-1 font-medium text-muted-foreground text-xs" style={{ width: '100px' }}>CHF</th>
                                <th className="text-right py-1 font-medium text-muted-foreground text-xs" style={{ width: '60px', paddingLeft: '200px', paddingRight: '4px' }}>%</th>
                                <th className="text-right py-1 pr-4 pl-1 font-medium text-muted-foreground text-xs" style={{ width: '150px' }}>CHF</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {sortedPositions.map((p) => {
                                const dailyGainCHF = convertToCHF(p.dailyGain, p.stock.currency);
                                const isDailyPositive = dailyGainCHF >= 0;

                                // Calculate total performance
                                const currentValue = p.shares * p.stock.currentPrice;
                                const purchaseValue = p.purchases.reduce((sum: number, purchase: any) =>
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
                                        <td className={cn("py-3 px-1 text-right font-medium", isDailyPositive ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400")} style={{ width: '100px' }}>
                                            {isDailyPositive ? '+' : ''}{formatCurrency(dailyGainCHF, 'CHF').replace('CHF', '').trim()}
                                        </td>
                                        {/* Total Performance */}
                                        <td className={cn("py-3 text-right font-medium text-xs", isTotalPositive ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400")} style={{ width: '60px', paddingLeft: '200px', paddingRight: '4px' }}>
                                            {isTotalPositive ? '+' : ''}{totalGainPercent.toFixed(2)}%
                                        </td>
                                        <td className={cn("py-3 text-right font-bold", isTotalPositive ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400")} style={{ width: '150px', paddingRight: '16px', paddingLeft: '4px' }}>
                                            {isTotalPositive ? '+' : ''}{formatCurrency(totalGainCHF, 'CHF').replace('CHF', '').trim()}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                        <tfoot className="bg-muted/20 border-t border-border">
                            <tr>
                                <td className="py-3 px-4 font-semibold text-muted-foreground">Total:</td>
                                <td className="py-3 px-1" style={{ width: '60px' }}></td>
                                <td className={cn("py-3 px-1 text-right font-bold", totalDailyGain >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400")} style={{ width: '100px' }}>
                                    {totalDailyGain >= 0 ? '+' : ''}{formatCurrency(totalDailyGain, 'CHF')}
                                </td>
                                <td className="py-3" style={{ width: '60px', paddingLeft: '200px', paddingRight: '4px' }}></td>
                                <td className={cn("py-3 text-right font-bold", totalPerformanceGain >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400")} style={{ width: '150px', paddingRight: '16px', paddingLeft: '4px' }}>
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
