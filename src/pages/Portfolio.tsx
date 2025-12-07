import { useState } from 'react';
import { usePortfolio } from '../context/PortfolioContext';
import { Plus, Search, Trash2, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { cn } from '../utils';
import { AddPositionModal } from '../components/AddPositionModal';

export function Portfolio() {
    const { positions: rawPositions, stocks, addPosition, deletePosition } = usePortfolio();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    // Enrich positions with stock data
    const positions = rawPositions.map((pos) => {
        const stock = stocks.find((s) => s.id === pos.stockId)!;
        const currentValue = pos.shares * stock.currentPrice;
        const buyValue = pos.shares * pos.buyPriceAvg;
        const gainLoss = currentValue - buyValue;
        const gainLossPercent = (gainLoss / buyValue) * 100;

        return {
            ...pos,
            stock,
            currentValue,
            gainLoss,
            gainLossPercent,
        };
    });

    const filteredPositions = positions.filter((pos) =>
        pos.stock.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        pos.stock.symbol.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header / Actions */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="relative w-full sm:w-72">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                    <input
                        type="text"
                        placeholder="Aktien suchen..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 rounded-lg border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all shadow-sm"
                    />
                </div>
                <button
                    onClick={() => setIsModalOpen(true)}
                    className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors shadow-sm font-medium text-sm"
                >
                    <Plus className="size-4" />
                    <span>Position hinzufügen</span>
                </button>
            </div>

            {/* Portfolio Table */}
            <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-muted/50 text-muted-foreground font-medium border-b border-border">
                            <tr>
                                <th className="px-6 py-4">Name</th>
                                <th className="px-6 py-4 text-right">Preis</th>
                                <th className="px-6 py-4 text-right">Anteile</th>
                                <th className="px-6 py-4 text-right">Wert</th>
                                <th className="px-6 py-4 text-right">G/V</th>
                                <th className="px-6 py-4 text-center">Aktionen</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {filteredPositions.map((pos) => (
                                <tr key={pos.id} className="group hover:bg-muted/30 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            {pos.stock.logoUrl ? (
                                                <div className="size-10 rounded-lg bg-white p-1 border border-border shadow-sm flex items-center justify-center">
                                                    <img src={pos.stock.logoUrl} alt={pos.stock.name} className="object-contain max-h-full max-w-full" />
                                                </div>
                                            ) : (
                                                <div className="size-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold border border-primary/20">
                                                    {pos.stock.symbol.slice(0, 2)}
                                                </div>
                                            )}
                                            <div>
                                                <div className="font-semibold text-foreground">{pos.stock.name}</div>
                                                <div className="text-xs text-muted-foreground flex items-center gap-1">
                                                    <span className="font-mono bg-muted px-1 rounded">{pos.stock.symbol}</span>
                                                    <span>• {pos.stock.sector}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-right font-medium">
                                        {pos.stock.currentPrice.toLocaleString('de-DE', { style: 'currency', currency: pos.stock.currency })}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="font-medium">{pos.shares}</div>
                                        <div className="text-xs text-muted-foreground">Ø {pos.buyPriceAvg.toLocaleString('de-DE', { style: 'currency', currency: pos.stock.currency })}</div>
                                    </td>
                                    <td className="px-6 py-4 text-right font-bold">
                                        {pos.currentValue.toLocaleString('de-DE', { style: 'currency', currency: pos.stock.currency })}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className={cn(
                                            "flex items-center justify-end gap-1 font-medium",
                                            pos.gainLoss >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
                                        )}>
                                            {pos.gainLoss >= 0 ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
                                            {Math.abs(pos.gainLossPercent).toFixed(2)}%
                                        </div>
                                        <div className={cn(
                                            "text-xs",
                                            pos.gainLoss >= 0 ? "text-green-600/70 dark:text-green-400/70" : "text-red-600/70 dark:text-red-400/70"
                                        )}>
                                            {pos.gainLoss >= 0 ? '+' : ''}{pos.gainLoss.toLocaleString('de-DE', { style: 'currency', currency: pos.stock.currency })}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <button
                                            onClick={() => {
                                                if (confirm(`Position "${pos.stock.name}" wirklich löschen?`)) {
                                                    deletePosition(pos.id);
                                                }
                                            }}
                                            className="text-muted-foreground hover:text-red-600 p-2 rounded-md hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors"
                                            title="Position löschen"
                                        >
                                            <Trash2 className="size-5" />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {filteredPositions.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">
                                        {searchTerm ? 'Keine Aktien gefunden.' : 'Noch keine Aktien im Depot.'}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <AddPositionModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                stocks={stocks}
                onAdd={addPosition}
            />
        </div>
    );
}
