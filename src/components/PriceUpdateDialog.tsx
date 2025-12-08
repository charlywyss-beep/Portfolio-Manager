import { useState } from 'react';
import { X, Save } from 'lucide-react';
import type { Stock } from '../types';
import { usePortfolio } from '../context/PortfolioContext';

interface PriceUpdateDialogProps {
    isOpen: boolean;
    onClose: () => void;
    stock: Stock;
}

export function PriceUpdateDialog({ isOpen, onClose, stock }: PriceUpdateDialogProps) {
    const { updateStockPrice } = usePortfolio();
    const [price, setPrice] = useState(stock.currentPrice.toString());

    if (!isOpen) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const newPrice = parseFloat(price);
        if (!isNaN(newPrice)) {
            updateStockPrice(stock.id, newPrice);
            onClose();
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="flex items-center justify-between p-4 border-b border-border">
                    <h3 className="font-semibold">Kurs aktualisieren</h3>
                    <button onClick={onClose} className="p-1 hover:bg-muted rounded-md text-muted-foreground">
                        <X className="size-4" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-4 space-y-4">
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-muted-foreground">
                            Aktueller Kurs für {stock.name} ({stock.currency})
                        </label>
                        <input
                            type="number"
                            step="0.01"
                            value={price}
                            onChange={(e) => setPrice(e.target.value)}
                            className="w-full px-3 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 text-lg font-mono"
                            autoFocus
                        />
                    </div>

                    <button
                        type="submit"
                        className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors font-medium"
                    >
                        <Save className="size-4" />
                        Speichern
                    </button>
                </form>
            </div>
        </div>
    );
}
