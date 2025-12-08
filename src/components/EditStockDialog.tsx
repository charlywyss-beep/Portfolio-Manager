import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { usePortfolio } from '../context/PortfolioContext';
import type { Stock } from '../types';

interface EditStockDialogProps {
    stock: Stock;
    isOpen: boolean;
    onClose: () => void;
}

export function EditStockDialog({ stock, isOpen, onClose }: EditStockDialogProps) {
    const { updateStockPrice, updateStockDividendYield } = usePortfolio();

    const [currentPrice, setCurrentPrice] = useState(stock.currentPrice.toString());
    const [dividendYield, setDividendYield] = useState(stock.dividendYield?.toString() || '');
    const [dividendPerShare, setDividendPerShare] = useState('');

    useEffect(() => {
        setCurrentPrice(stock.currentPrice.toString());
        setDividendYield(stock.dividendYield?.toString() || '');

        // Calculate dividend per share from yield
        if (stock.dividendYield && stock.currentPrice) {
            const perShare = (stock.currentPrice * stock.dividendYield / 100).toFixed(2);
            setDividendPerShare(perShare);
        } else {
            setDividendPerShare('');
        }
    }, [stock]);

    if (!isOpen) return null;

    const handleDividendPerShareChange = (value: string) => {
        setDividendPerShare(value);
        if (value && currentPrice && parseFloat(currentPrice) > 0) {
            const yieldPercent = ((parseFloat(value) / parseFloat(currentPrice)) * 100).toFixed(2);
            setDividendYield(yieldPercent);
        } else if (!value) {
            setDividendYield('');
        }
    };

    const handleDividendYieldChange = (value: string) => {
        setDividendYield(value);
        if (value && currentPrice && parseFloat(currentPrice) > 0) {
            const perShare = ((parseFloat(currentPrice) * parseFloat(value)) / 100).toFixed(2);
            setDividendPerShare(perShare);
        } else if (!value) {
            setDividendPerShare('');
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        if (currentPrice && parseFloat(currentPrice) !== stock.currentPrice) {
            updateStockPrice(stock.id, parseFloat(currentPrice));
        }

        const newYield = dividendYield ? parseFloat(dividendYield) : undefined;
        if (newYield !== stock.dividendYield) {
            updateStockDividendYield(stock.id, newYield || 0);
        }

        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-md animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-border">
                    <div>
                        <h2 className="text-xl font-bold">{stock.name}</h2>
                        <p className="text-sm text-muted-foreground">{stock.symbol}</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-muted rounded-lg transition-colors">
                        <X className="size-5" />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Aktueller Kurs</label>
                        <input
                            type="number"
                            step="0.01"
                            min="0"
                            required
                            value={currentPrice}
                            onChange={(e) => setCurrentPrice(e.target.value)}
                            className="w-full px-3 py-2 border rounded-md bg-background text-foreground"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Dividende/Aktie</label>
                            <input
                                type="number"
                                step="0.01"
                                min="0"
                                placeholder={`z.B. 2.80 ${stock.currency}`}
                                value={dividendPerShare}
                                onChange={(e) => handleDividendPerShareChange(e.target.value)}
                                className="w-full px-3 py-2 border rounded-md bg-background text-foreground"
                            />
                            <p className="text-xs text-muted-foreground">
                                Jährlich pro Aktie
                            </p>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium">Rendite %</label>
                            <input
                                type="number"
                                step="0.01"
                                min="0"
                                placeholder="z.B. 3.5"
                                value={dividendYield}
                                onChange={(e) => handleDividendYieldChange(e.target.value)}
                                className="w-full px-3 py-2 border rounded-md bg-background text-foreground"
                            />
                            <p className="text-xs text-muted-foreground">
                                Dividendenrendite
                            </p>
                        </div>
                    </div>

                    <div className="flex gap-3 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-2 border rounded-lg hover:bg-muted font-medium"
                        >
                            Abbrechen
                        </button>
                        <button
                            type="submit"
                            className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 font-medium"
                        >
                            Speichern
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
