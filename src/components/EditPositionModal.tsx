import { useState, useEffect } from 'react';
import { X, Save, Trash2 } from 'lucide-react';
import type { Stock } from '../types';
import { cn } from '../utils';
import { usePortfolio } from '../context/PortfolioContext';

interface EditPositionModalProps {
    isOpen: boolean;
    onClose: () => void;
    position: {
        id: string;
        stock: Stock;
        shares: number;
        buyPriceAvg: number;
        buyDate?: string;
        averageEntryFxRate?: number;
    };
    onUpdate: (id: string, newShares: number, newAvgPrice?: number, newBuyDate?: string, newFxRate?: number) => void;
    onDelete: (id: string) => void;
}

export function EditPositionModal({ isOpen, onClose, position, onUpdate, onDelete }: EditPositionModalProps) {
    const { updateStock, stocks } = usePortfolio();
    const currentStock = stocks.find(s => s.id === position.stock.id) || position.stock;

    // Local State for Form Fields
    const [shares, setShares] = useState(position.shares.toString());
    const [avgPrice, setAvgPrice] = useState(position.buyPriceAvg.toString());
    const [avgFxRate, setAvgFxRate] = useState(position.averageEntryFxRate?.toString() || '');
    const [buyDate, setBuyDate] = useState(position.buyDate ? new Date(position.buyDate).toISOString().split('T')[0] : '');

    // Reset state when modal opens or position changes
    useEffect(() => {
        if (isOpen) {
            setShares(position.shares.toString());
            setAvgPrice(position.buyPriceAvg.toString());
            setAvgFxRate(position.averageEntryFxRate?.toString() || '');
            setBuyDate(position.buyDate ? new Date(position.buyDate).toISOString().split('T')[0] : '');
        }
    }, [isOpen, position]);

    if (!isOpen) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        
        const newShares = parseFloat(shares);
        const newPrice = parseFloat(avgPrice);
        const newFx = avgFxRate ? parseFloat(avgFxRate) : undefined;
        // Ensure date is valid ISO string if provided
        const isoDate = buyDate ? new Date(buyDate).toISOString() : undefined;

        if (newShares <= 0) {
            handleDelete();
            return;
        }

        onUpdate(position.id, newShares, newPrice, isoDate, newFx);
        onClose();
    };

    const handleDelete = () => {
        if (confirm(`Möchten Sie die Position "${position.stock.name}" wirklich löschen?`)) {
            onDelete(position.id);
            onClose();
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-border">
                    <div>
                        <h2 className="text-xl font-bold">Position bearbeiten</h2>
                        <p className="text-xs text-muted-foreground mt-1">Stammdaten manuell korrigieren</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-muted rounded-lg transition-colors"
                        title="Schließen"
                    >
                        <X className="size-5" />
                    </button>
                </div>

                {/* Content */}
                <form onSubmit={handleSubmit} className="p-6 overflow-y-auto flex-1 space-y-6">
                    
                    {/* Stock Info (Read Only) */}
                    <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg border border-border">
                        <div className="size-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold border border-primary/20 shrink-0">
                            {position.stock.symbol.slice(0, 2)}
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="font-semibold truncate">{position.stock.name}</div>
                            <div className="text-xs text-muted-foreground">
                                {position.stock.symbol} • Aktuell: {position.stock.currentPrice.toLocaleString('de-CH', { style: 'currency', currency: position.stock.currency })}
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4">
                        {/* shares */}
                        <div className="space-y-2">
                            <label className="text-sm font-medium">
                                Anzahl Bestand (Stück)
                            </label>
                            <input
                                type="number"
                                step="0.000001"
                                min="0"
                                required
                                value={shares}
                                onChange={(e) => setShares(e.target.value)}
                                className="w-full px-4 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
                            />
                        </div>

                        {/* Average Price */}
                        <div className="space-y-2">
                            <label className="text-sm font-medium">
                                Ø Kaufpreis ({position.stock.currency === 'GBp' ? 'GBP' : position.stock.currency})
                            </label>
                            <input
                                type="number"
                                step="0.000001"
                                min="0"
                                required
                                value={avgPrice}
                                onChange={(e) => setAvgPrice(e.target.value)}
                                className="w-full px-4 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
                            />
                            <p className="text-[10px] text-muted-foreground">
                                Durchschnittlicher Einstandspreis pro Stück in Originalwährung.
                            </p>
                        </div>

                        {/* FX Rate */}
                        {position.stock.currency !== 'CHF' && (
                            <div className="space-y-2">
                                <label className="text-sm font-medium">
                                    Ø Wechselkurs (CHF)
                                </label>
                                <div className="relative">
                                    <input
                                        type="number"
                                        step="0.000001"
                                        min="0.000001"
                                        placeholder="1.0"
                                        value={avgFxRate}
                                        onChange={(e) => setAvgFxRate(e.target.value)}
                                        className="w-full px-4 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 pr-12"
                                    />
                                    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm pointer-events-none">
                                        CHF
                                    </div>
                                </div>
                                <p className="text-[10px] text-muted-foreground">
                                    Gewichteter Durchschnittskurs aller Käufe (1 {position.stock.currency} = ? CHF).
                                </p>
                            </div>
                        )}

                        {/* Buy Date */}
                        <div className="space-y-2">
                            <label className="text-sm font-medium flex items-center gap-2">
                                Datum Erster Kauf <span className="text-xs text-muted-foreground font-normal">(Optional)</span>
                            </label>
                            <input
                                type="date"
                                value={buyDate}
                                onChange={(e) => setBuyDate(e.target.value)}
                                className="w-full px-4 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
                            />
                            <p className="text-[10px] text-muted-foreground">
                                Dient als Startpunkt für die Performance-Berechnung im Chart.
                            </p>
                        </div>
                    </div>

                    {/* ETF Options (Only if ETF) */}
                    {currentStock?.type === 'etf' && (
                        <div className="space-y-2 pt-4 border-t border-border">
                            <label className="text-sm font-medium">Ausschüttung (ETF Stammdaten)</label>
                            <div className="flex bg-muted rounded-lg p-1 border border-border">
                                <button
                                    type="button"
                                    onClick={() => updateStock(currentStock.id, { distributionPolicy: 'distributing' })}
                                    className={cn(
                                        "flex-1 px-3 py-2 text-sm font-medium rounded-md transition-all",
                                        currentStock.distributionPolicy !== 'accumulating'
                                            ? "bg-background text-foreground shadow-sm"
                                            : "text-muted-foreground hover:text-foreground"
                                    )}
                                >
                                    Ausschüttend
                                </button>
                                <button
                                    type="button"
                                    onClick={() => updateStock(currentStock.id, { distributionPolicy: 'accumulating' })}
                                    className={cn(
                                        "flex-1 px-3 py-2 text-sm font-medium rounded-md transition-all",
                                        currentStock.distributionPolicy === 'accumulating'
                                            ? "bg-background text-foreground shadow-sm"
                                            : "text-muted-foreground hover:text-foreground"
                                    )}
                                >
                                    Thesaurierend
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Actions */}
                    <div className="flex items-center gap-3 pt-4 border-t border-border mt-6">
                        <button
                            type="button"
                            onClick={handleDelete}
                            className="p-2.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-lg transition-colors border border-transparent hover:border-red-200 dark:hover:border-red-900"
                            title="Position löschen"
                        >
                            <Trash2 className="size-5" />
                        </button>
                        <div className="flex-1 flex gap-3">
                            <button
                                type="button"
                                onClick={onClose}
                                className="flex-1 px-4 py-2.5 border border-border rounded-lg hover:bg-muted font-medium transition-colors"
                            >
                                Abbrechen
                            </button>
                            <button
                                type="submit"
                                className="flex-1 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 font-medium transition-colors flex items-center justify-center gap-2"
                            >
                                <Save className="size-4" />
                                Speichern
                            </button>
                        </div>
                    </div>

                </form>
            </div>
        </div>
    );
}
