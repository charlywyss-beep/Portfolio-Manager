import { useState } from 'react';
import { usePortfolio } from '../context/PortfolioContext';
import { Plus, Search, Pencil, Trash2, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { cn } from '../utils';
import { AddPositionModal } from '../components/AddPositionModal';
import { EditPositionModal } from '../components/EditPositionModal';

export function Portfolio() {
    const { positions: rawPositions, stocks, addPosition, deletePosition, updatePosition } = usePortfolio();
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [selectedPosition, setSelectedPosition] = useState<any>(null);
    const [searchTerm, setSearchTerm] = useState('');

    // Enrich positions with stock data and calculations
    const positions = rawPositions.map((pos) => {
        const stock = stocks.find((s) => s.id === pos.stockId)!;

        // Current values
        const currentValue = pos.shares * stock.currentPrice;
        const buyValue = pos.shares * pos.buyPriceAvg;

        // Total gain/loss (since purchase)
        const gainLossTotal = currentValue - buyValue;
        const gainLossTotalPercent = (gainLossTotal / buyValue) * 100;

        // Daily performance
        const dailyChange = stock.currentPrice - stock.previousClose;
        const dailyChangePercent = (dailyChange / stock.previousClose) * 100;
        const dailyValueChange = pos.shares * dailyChange;

        return {
            ...pos,
            stock,
            currentValue,
            buyValue,
            gainLossTotal,
            gainLossTotalPercent,
            dailyChange,
            dailyChangePercent,
            dailyValueChange,
        };
    });

    const filteredPositions = positions.filter((pos) =>
        pos.stock.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        pos.stock.symbol.toLowerCase().includes(searchTerm.toLowerCase()) ||
        pos.stock.valor?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        pos.stock.isin?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleEdit = (pos: any) => {
        setSelectedPosition(pos);
        setIsEditModalOpen(true);
    };

    const handleUpdate = (id: string, newShares: number) => {
        updatePosition(id, { shares: newShares });
    };

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
                    onClick={() => setIsAddModalOpen(true)}
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
                                <th className="px-4 py-3 min-w-[200px]">Name</th>
                                <th className="px-4 py-3 min-w-[120px]">Valor / ISIN</th>
                                <th className="px-4 py-3 text-right">Anzahl</th>
                                <th className="px-4 py-3 text-right">Kauf Kurs</th>
                                <th className="px-4 py-3 text-right">Kauf Wert</th>
                                <th className="px-4 py-3 text-right">Aktueller Kurs</th>
                                <th className="px-4 py-3 text-right">Aktueller Wert</th>
                                <th className="px-4 py-3 text-right">Heute +/-</th>
                                <th className="px-4 py-3 text-right">Heute % +/-</th>
                                <th className="px-4 py-3 text-right">Wert heute</th>
                                <th className="px-4 py-3 text-right">Gesamt +/-</th>
                                <th className="px-4 py-3 text-right">Gesamt % +/-</th>
                                <th className="px-4 py-3 text-right">Wert seit Kauf</th>
                                <th className="px-4 py-3 text-center">Kauf/Verkauf</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {filteredPositions.map((pos) => (
                                <tr key={pos.id} className="group hover:bg-muted/30 transition-colors">
                                    {/* Name */}
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-3">
                                            {pos.stock.logoUrl ? (
                                                <div className="size-8 rounded-lg bg-white p-1 border border-border shadow-sm flex items-center justify-center shrink-0">
                                                    <img src={pos.stock.logoUrl} alt={pos.stock.name} className="object-contain max-h-full max-w-full" />
                                                </div>
                                            ) : (
                                                <div className="size-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold border border-primary/20 text-xs shrink-0">
                                                    {pos.stock.symbol.slice(0, 2)}
                                                </div>
                                            )}
                                            <div className="min-w-0">
                                                <div className="font-semibold text-foreground truncate">{pos.stock.name}</div>
                                                <div className="text-xs text-muted-foreground flex items-center gap-1">
                                                    <span className="font-mono bg-muted px-1 rounded">{pos.stock.symbol}</span>
                                                    <span>• {pos.stock.sector}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </td>

                                    {/* Valor / ISIN */}
                                    <td className="px-4 py-3">
                                        <div className="text-xs space-y-0.5">
                                            {pos.stock.valor && (
                                                <div className="font-mono">
                                                    <span className="text-muted-foreground">Valor: </span>
                                                    <span className="font-medium">{pos.stock.valor}</span>
                                                </div>
                                            )}
                                            {pos.stock.isin && (
                                                <div className="font-mono text-muted-foreground truncate" title={pos.stock.isin}>
                                                    {pos.stock.isin}
                                                </div>
                                            )}
                                        </div>
                                    </td>

                                    {/* Anzahl */}
                                    <td className="px-4 py-3 text-right font-medium">{pos.shares}</td>

                                    {/* Kauf Kurs */}
                                    <td className="px-4 py-3 text-right">
                                        {pos.buyPriceAvg.toLocaleString('de-DE', { style: 'currency', currency: pos.stock.currency })}
                                    </td>

                                    {/* Kauf Wert */}
                                    <td className="px-4 py-3 text-right font-medium">
                                        {pos.buyValue.toLocaleString('de-DE', { style: 'currency', currency: pos.stock.currency })}
                                    </td>

                                    {/* Aktueller Kurs */}
                                    <td className="px-4 py-3 text-right">
                                        {pos.stock.currentPrice.toLocaleString('de-DE', { style: 'currency', currency: pos.stock.currency })}
                                    </td>

                                    {/* Aktueller Wert */}
                                    <td className="px-4 py-3 text-right font-bold">
                                        {pos.currentValue.toLocaleString('de-DE', { style: 'currency', currency: pos.stock.currency })}
                                    </td>

                                    {/* Heute +/- */}
                                    <td className="px-4 py-3 text-right">
                                        <div className={cn(
                                            "font-medium",
                                            pos.dailyChange >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
                                        )}>
                                            {pos.dailyChange >= 0 ? '+' : ''}{pos.dailyChange.toLocaleString('de-DE', { style: 'currency', currency: pos.stock.currency })}
                                        </div>
                                    </td>

                                    {/* Heute % +/- */}
                                    <td className="px-4 py-3 text-right">
                                        <div className={cn(
                                            "flex items-center justify-end gap-1 font-medium",
                                            pos.dailyChange >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
                                        )}>
                                            {pos.dailyChange >= 0 ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
                                            {pos.dailyChange >= 0 ? '+' : ''}{pos.dailyChangePercent.toFixed(2)}%
                                        </div>
                                    </td>

                                    {/* Wert heute */}
                                    <td className="px-4 py-3 text-right">
                                        <div className={cn(
                                            "font-medium",
                                            pos.dailyValueChange >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
                                        )}>
                                            {pos.dailyValueChange >= 0 ? '+' : ''}{pos.dailyValueChange.toLocaleString('de-DE', { style: 'currency', currency: pos.stock.currency })}
                                        </div>
                                    </td>

                                    {/* Gesamt +/- */}
                                    <td className="px-4 py-3 text-right">
                                        <div className={cn(
                                            "font-medium",
                                            pos.gainLossTotal >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
                                        )}>
                                            {pos.gainLossTotal >= 0 ? '+' : ''}{pos.gainLossTotal.toLocaleString('de-DE', { style: 'currency', currency: pos.stock.currency })}
                                        </div>
                                    </td>

                                    {/* Gesamt % +/- */}
                                    <td className="px-4 py-3 text-right">
                                        <div className={cn(
                                            "flex items-center justify-end gap-1 font-medium",
                                            pos.gainLossTotal >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
                                        )}>
                                            {pos.gainLossTotal >= 0 ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
                                            {pos.gainLossTotal >= 0 ? '+' : ''}{pos.gainLossTotalPercent.toFixed(2)}%
                                        </div>
                                    </td>

                                    {/* Wert seit Kauf (same as Gesamt +/-) */}
                                    <td className="px-4 py-3 text-right">
                                        <div className={cn(
                                            "font-medium",
                                            pos.gainLossTotal >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
                                        )}>
                                            {pos.gainLossTotal >= 0 ? '+' : ''}{pos.gainLossTotal.toLocaleString('de-DE', { style: 'currency', currency: pos.stock.currency })}
                                        </div>
                                    </td>

                                    {/* Aktionen */}
                                    <td className="px-4 py-3">
                                        <div className="flex items-center justify-center gap-1">
                                            <button
                                                onClick={() => handleEdit(pos)}
                                                className="text-muted-foreground hover:text-primary p-2 rounded-md hover:bg-primary/10 transition-colors"
                                                title="Position bearbeiten"
                                            >
                                                <Pencil className="size-4" />
                                            </button>
                                            <button
                                                onClick={() => {
                                                    if (confirm(`Position "${pos.stock.name}" wirklich löschen?`)) {
                                                        deletePosition(pos.id);
                                                    }
                                                }}
                                                className="text-muted-foreground hover:text-red-600 p-2 rounded-md hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors"
                                                title="Position löschen"
                                            >
                                                <Trash2 className="size-4" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {filteredPositions.length === 0 && (
                                <tr>
                                    <td colSpan={14} className="px-4 py-12 text-center text-muted-foreground">
                                        {searchTerm ? 'Keine Aktien gefunden.' : 'Noch keine Aktien im Depot.'}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <AddPositionModal
                isOpen={isAddModalOpen}
                onClose={() => setIsAddModalOpen(false)}
                stocks={stocks}
                onAdd={addPosition}
            />

            {selectedPosition && (
                <EditPositionModal
                    isOpen={isEditModalOpen}
                    onClose={() => {
                        setIsEditModalOpen(false);
                        setSelectedPosition(null);
                    }}
                    position={selectedPosition}
                    onUpdate={handleUpdate}
                    onDelete={deletePosition}
                />
            )}
        </div>
    );
}
