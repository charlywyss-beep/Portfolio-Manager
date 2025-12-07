import { useState } from 'react';
import { X, TrendingDown } from 'lucide-react';
import type { Stock } from '../types';
import { cn } from '../utils';

interface EditPositionModalProps {
    isOpen: boolean;
    onClose: () => void;
    position: {
        id: string;
        stock: Stock;
        shares: number;
        buyPriceAvg: number;
    };
    onUpdate: (id: string, newShares: number) => void;
    onDelete: (id: string) => void;
}

export function EditPositionModal({ isOpen, onClose, position, onUpdate, onDelete }: EditPositionModalProps) {
    const [shares, setShares] = useState(position.shares.toString());
    const [isSelling, setIsSelling] = useState(false);

    if (!isOpen) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const newShares = parseFloat(shares);

        if (newShares <= 0) {
            // Delete position if shares become 0 or negative
            onDelete(position.id);
        } else if (newShares !== position.shares) {
            onUpdate(position.id, newShares);
        }

        onClose();
    };

    const handleSell = (amount: number) => {
        const newShares = Math.max(0, position.shares - amount);
        setShares(newShares.toString());
        setIsSelling(true);
    };

    const sharesToSell = isSelling ? position.shares - parseFloat(shares || '0') : 0;

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-md animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-border">
                    <h2 className="text-xl font-bold">Position bearbeiten</h2>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-muted rounded-lg transition-colors"
                    >
                        <X className="size-5" />
                    </button>
                </div>

                {/* Content */}
                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    {/* Stock Info */}
                    <div className="p-4 border border-border rounded-lg bg-muted/30">
                        <div className="font-semibold">{position.stock.name}</div>
                        <div className="text-sm text-muted-foreground">{position.stock.symbol}</div>
                        <div className="mt-2 text-sm">
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Aktueller Kurs:</span>
                                <span className="font-medium">
                                    {position.stock.currentPrice.toLocaleString('de-DE', {
                                        style: 'currency',
                                        currency: position.stock.currency,
                                    })}
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Ø Kaufpreis:</span>
                                <span className="font-medium">
                                    {position.buyPriceAvg.toLocaleString('de-DE', {
                                        style: 'currency',
                                        currency: position.stock.currency,
                                    })}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Shares Input */}
                    <div className="space-y-2">
                        <label htmlFor="shares" className="text-sm font-medium flex items-center justify-between">
                            <span>Anzahl Anteile</span>
                            <span className="text-xs text-muted-foreground">
                                Aktuell: {position.shares}
                            </span>
                        </label>
                        <input
                            id="shares"
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder={position.shares.toString()}
                            value={shares}
                            onChange={(e) => {
                                setShares(e.target.value);
                                setIsSelling(true);
                            }}
                            className="w-full px-4 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
                            required
                        />
                    </div>

                    {/* Quick Sell Buttons */}
                    <div className="space-y-2">
                        <div className="text-sm font-medium text-muted-foreground">Schnellverkauf</div>
                        <div className="grid grid-cols-4 gap-2">
                            {[25, 50, 75, 100].map((percent) => (
                                <button
                                    key={percent}
                                    type="button"
                                    onClick={() => handleSell((position.shares * percent) / 100)}
                                    className="px-3 py-2 text-sm border border-border rounded-lg hover:bg-muted transition-colors"
                                >
                                    {percent}%
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Preview */}
                    {isSelling && sharesToSell > 0 && (
                        <div className="p-4 bg-red-50 dark:bg-red-950/20 rounded-lg border border-red-200 dark:border-red-900/30">
                            <div className="flex items-center gap-2 text-red-600 dark:text-red-400 font-medium mb-2">
                                <TrendingDown className="size-4" />
                                <span>Verkauf</span>
                            </div>
                            <div className="text-sm space-y-1">
                                <div className="flex justify-between">
                                    <span>Verkaufte Anteile:</span>
                                    <span className="font-medium">{sharesToSell.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span>Verbleibende Anteile:</span>
                                    <span className="font-medium">{parseFloat(shares || '0').toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between border-t border-red-200 dark:border-red-900/30 pt-1 mt-1">
                                    <span>Verkaufswert:</span>
                                    <span className="font-medium">
                                        {(sharesToSell * position.stock.currentPrice).toLocaleString('de-DE', {
                                            style: 'currency',
                                            currency: position.stock.currency,
                                        })}
                                    </span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Actions */}
                    <div className="flex gap-3 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-2 border border-border rounded-lg hover:bg-muted transition-colors font-medium"
                        >
                            Abbrechen
                        </button>
                        <button
                            type="submit"
                            className={cn(
                                "flex-1 px-4 py-2 rounded-lg font-medium transition-colors",
                                "bg-primary text-primary-foreground hover:bg-primary/90"
                            )}
                        >
                            {parseFloat(shares || '0') === 0 ? 'Position löschen' : 'Speichern'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
