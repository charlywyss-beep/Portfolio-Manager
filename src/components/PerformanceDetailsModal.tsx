import { X, TrendingUp } from 'lucide-react';
import { useCurrencyFormatter } from '../utils/currency';
import { cn } from '../utils';

interface PerformanceDetailsModalProps {
    isOpen: boolean;
    onClose: () => void;
    positions: any[]; // Using any to avoid complex import of Position type extended with dailyGain
}

export function PerformanceDetailsModal({ isOpen, onClose, positions }: PerformanceDetailsModalProps) {
    const { convertToCHF, formatCurrency } = useCurrencyFormatter();

    if (!isOpen) return null;

    // Sort positions by daily gain descending
    const sortedPositions = [...positions].sort((a, b) => {
        const valA = convertToCHF(a.dailyGain, a.stock.currency);
        const valB = convertToCHF(b.dailyGain, b.stock.currency);
        return valB - valA;
    });

    const totalGain = sortedPositions.reduce((sum, p) => sum + convertToCHF(p.dailyGain, p.stock.currency), 0);

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-card border border-border rounded-xl shadow-xl w-full max-w-lg max-h-[80vh] flex flex-col animate-in fade-in zoom-in-95 duration-200">
                <div className="flex items-center justify-between p-6 border-b border-border">
                    <h2 className="text-xl font-bold flex items-center gap-2">
                        <TrendingUp className="size-5 text-blue-500" />
                        Tagesperformance Details
                    </h2>
                    <button onClick={onClose} className="p-2 hover:bg-secondary rounded-full transition-colors">
                        <X className="size-5" />
                    </button>
                </div>

                <div className="overflow-y-auto p-0 flex-1">
                    <table className="w-full text-sm">
                        <thead className="bg-muted/30 sticky top-0 backdrop-blur-md z-10">
                            <tr className="border-b border-border">
                                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Aktie / ETF</th>
                                <th className="text-right py-3 px-4 font-medium text-muted-foreground">%</th>
                                <th className="text-right py-3 px-4 font-medium text-muted-foreground">Gewinn/Verlust</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {sortedPositions.map((p) => {
                                const gainCHF = convertToCHF(p.dailyGain, p.stock.currency);
                                const isPositive = gainCHF >= 0;

                                return (
                                    <tr key={p.id} className="hover:bg-muted/20 transition-colors">
                                        <td className="py-3 px-4 font-medium">
                                            <div className="flex flex-col">
                                                <span>{p.stock.name}</span>
                                                <span className="text-[10px] text-muted-foreground">{p.stock.symbol}</span>
                                            </div>
                                        </td>
                                        <td className={cn("py-3 px-4 text-right font-medium", isPositive ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400")}>
                                            {isPositive ? '+' : ''}{p.dailyGainPercent.toFixed(2)}%
                                        </td>
                                        <td className={cn("py-3 px-4 text-right font-bold", isPositive ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400")}>
                                            {isPositive ? '+' : ''}{formatCurrency(gainCHF, 'CHF').replace('CHF', '')}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                <div className="p-4 border-t border-border bg-muted/20">
                    <div className="flex justify-between items-center px-2">
                        <span className="font-semibold text-muted-foreground">Total (Aktien & ETFs)</span>
                        <span className={cn("text-lg font-bold", totalGain >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400")}>
                            {totalGain >= 0 ? '+' : ''}{formatCurrency(totalGain, 'CHF')}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
}
