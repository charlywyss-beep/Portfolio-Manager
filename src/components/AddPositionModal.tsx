import { useState } from 'react';
import { X, Search } from 'lucide-react';
import type { Stock } from '../types';
import { cn } from '../utils';

interface AddPositionModalProps {
    isOpen: boolean;
    onClose: () => void;
    stocks: Stock[];
    onAdd: (position: { stockId: string; shares: number; buyPriceAvg: number }) => void;
}

export function AddPositionModal({ isOpen, onClose, stocks, onAdd }: AddPositionModalProps) {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedStock, setSelectedStock] = useState<Stock | null>(null);
    const [shares, setShares] = useState('');
    const [buyPrice, setBuyPrice] = useState('');

    if (!isOpen) return null;

    const filteredStocks = stocks.filter(
        (stock) =>
            stock.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            stock.symbol.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedStock || !shares || !buyPrice) return;

        onAdd({
            stockId: selectedStock.id,
            shares: parseFloat(shares),
            buyPriceAvg: parseFloat(buyPrice),
        });

        // Reset form
        setSelectedStock(null);
        setShares('');
        setBuyPrice('');
        setSearchTerm('');
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-border">
                    <h2 className="text-xl font-bold">Position hinzufügen</h2>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-muted rounded-lg transition-colors"
                    >
                        <X className="size-5" />
                    </button>
                </div>

                {/* Content */}
                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    {/* Stock Selection */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Aktie auswählen</label>
                        {!selectedStock ? (
                            <>
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                                    <input
                                        type="text"
                                        placeholder="Aktienname oder Symbol suchen..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="w-full pl-9 pr-4 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
                                    />
                                </div>
                                <div className="max-h-60 overflow-y-auto border border-border rounded-lg divide-y divide-border">
                                    {filteredStocks.map((stock) => (
                                        <button
                                            key={stock.id}
                                            type="button"
                                            onClick={() => setSelectedStock(stock)}
                                            className="w-full p-3 hover:bg-muted transition-colors text-left flex items-center gap-3"
                                        >
                                            <div className="size-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold border border-primary/20">
                                                {stock.symbol.slice(0, 2)}
                                            </div>
                                            <div className="flex-1">
                                                <div className="font-semibold">{stock.name}</div>
                                                <div className="text-sm text-muted-foreground">
                                                    {stock.symbol} • {stock.sector}
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <div className="font-medium">
                                                    {stock.currentPrice.toLocaleString('de-DE', {
                                                        style: 'currency',
                                                        currency: stock.currency,
                                                    })}
                                                </div>
                                                <div className="text-xs text-muted-foreground">
                                                    {stock.dividendYield}% Dividend
                                                </div>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </>
                        ) : (
                            <div className="p-4 border border-border rounded-lg bg-muted/30 flex items-center gap-3">
                                <div className="size-12 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold border border-primary/20">
                                    {selectedStock.symbol.slice(0, 2)}
                                </div>
                                <div className="flex-1">
                                    <div className="font-semibold">{selectedStock.name}</div>
                                    <div className="text-sm text-muted-foreground">
                                        {selectedStock.symbol} • {selectedStock.currentPrice.toLocaleString('de-DE', {
                                            style: 'currency',
                                            currency: selectedStock.currency,
                                        })}
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setSelectedStock(null)}
                                    className="text-muted-foreground hover:text-foreground"
                                >
                                    <X className="size-5" />
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Shares Input */}
                    <div className="space-y-2">
                        <label htmlFor="shares" className="text-sm font-medium">
                            Anzahl Anteile
                        </label>
                        <input
                            id="shares"
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="z.B. 10"
                            value={shares}
                            onChange={(e) => setShares(e.target.value)}
                            className="w-full px-4 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
                            required
                        />
                    </div>

                    {/* Buy Price Input */}
                    <div className="space-y-2">
                        <label htmlFor="buyPrice" className="text-sm font-medium">
                            Durchschnittlicher Kaufpreis
                        </label>
                        <input
                            id="buyPrice"
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder={selectedStock ? `z.B. ${selectedStock.currentPrice}` : 'z.B. 150.00'}
                            value={buyPrice}
                            onChange={(e) => setBuyPrice(e.target.value)}
                            className="w-full px-4 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
                            required
                        />
                    </div>

                    {/* Summary */}
                    {selectedStock && shares && buyPrice && (
                        <div className="p-4 bg-muted/50 rounded-lg border border-border space-y-2">
                            <h3 className="font-semibold text-sm">Zusammenfassung</h3>
                            <div className="grid grid-cols-2 gap-2 text-sm">
                                <div className="text-muted-foreground">Gesamtinvestition:</div>
                                <div className="font-medium text-right">
                                    {(parseFloat(shares) * parseFloat(buyPrice)).toLocaleString('de-DE', {
                                        style: 'currency',
                                        currency: selectedStock.currency,
                                    })}
                                </div>
                                <div className="text-muted-foreground">Aktueller Wert:</div>
                                <div className="font-medium text-right">
                                    {(parseFloat(shares) * selectedStock.currentPrice).toLocaleString('de-DE', {
                                        style: 'currency',
                                        currency: selectedStock.currency,
                                    })}
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
                            disabled={!selectedStock || !shares || !buyPrice}
                            className={cn(
                                "flex-1 px-4 py-2 rounded-lg font-medium transition-colors",
                                selectedStock && shares && buyPrice
                                    ? "bg-primary text-primary-foreground hover:bg-primary/90"
                                    : "bg-muted text-muted-foreground cursor-not-allowed"
                            )}
                        >
                            Position hinzufügen
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
