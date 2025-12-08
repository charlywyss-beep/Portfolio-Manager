import { useState } from 'react';
import { X } from 'lucide-react';
import { usePortfolio } from '../context/PortfolioContext';

interface AddDividendModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export function AddDividendModal({ isOpen, onClose }: AddDividendModalProps) {
    const { stocks, positions, addDividend } = usePortfolio();

    const [selectedStockId, setSelectedStockId] = useState('');
    const [amount, setAmount] = useState('');
    const [currency, setCurrency] = useState<'CHF' | 'USD' | 'EUR'>('CHF');
    const [exDate, setExDate] = useState('');
    const [payDate, setPayDate] = useState('');
    const [frequency, setFrequency] = useState<'quarterly' | 'semi-annually' | 'annually' | 'monthly'>('quarterly');

    if (!isOpen) return null;

    const selectedStock = stocks.find(s => s.id === selectedStockId);
    const position = positions.find(p => p.stockId === selectedStockId);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        if (!selectedStockId || !amount || !exDate || !payDate) return;

        const stock = stocks.find(s => s.id === selectedStockId);
        if (!stock) return;

        addDividend({
            stockId: selectedStockId,
            amount: parseFloat(amount),
            currency: currency,
            exDate,
            payDate,
            frequency
        });

        // Reset form
        setSelectedStockId('');
        setAmount('');
        setExDate('');
        setPayDate('');
        setFrequency('quarterly');
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-md animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-border">
                    <div>
                        <h2 className="text-xl font-bold">Dividende hinzufügen</h2>
                        <p className="text-sm text-muted-foreground">Manuelle Dividendenzahlung erfassen</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-muted rounded-lg transition-colors">
                        <X className="size-5" />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Aktie</label>
                        <select
                            value={selectedStockId}
                            onChange={(e) => setSelectedStockId(e.target.value)}
                            required
                            className="w-full px-3 py-2 border rounded-md bg-background text-foreground"
                        >
                            <option value="">Aktie auswählen...</option>
                            {stocks
                                .filter(stock => positions.some(p => p.stockId === stock.id))
                                .map((stock) => (
                                    <option key={stock.id} value={stock.id}>
                                        {stock.name} ({stock.symbol})
                                    </option>
                                ))}
                        </select>
                        {position && (
                            <p className="text-xs text-muted-foreground">
                                {position.shares} Anteile im Depot
                            </p>
                        )}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Dividende pro Aktie</label>
                            <input
                                type="number"
                                step="0.01"
                                min="0"
                                required
                                placeholder="z.B. 0.88"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                className="w-full px-3 py-2 border rounded-md bg-background text-foreground"
                            />
                            {selectedStock && position && amount && (
                                <p className="text-xs text-muted-foreground">
                                    Total: {(parseFloat(amount) * position.shares).toFixed(2)} {currency}
                                </p>
                            )}
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium">Währung</label>
                            <select
                                value={currency}
                                onChange={(e) => setCurrency(e.target.value as any)}
                                className="w-full px-3 py-2 border rounded-md bg-background text-foreground"
                            >
                                <option value="CHF">CHF (Schweizer Franken)</option>
                                <option value="USD">USD (US Dollar)</option>
                                <option value="EUR">EUR (Euro)</option>
                            </select>
                            <p className="text-xs text-muted-foreground">
                                Dividendenwährung
                            </p>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Ex-Datum</label>
                            <input
                                type="date"
                                required
                                value={exDate}
                                onChange={(e) => setExDate(e.target.value)}
                                className="w-full px-3 py-2 border rounded-md bg-background text-foreground"
                            />
                            <p className="text-xs text-muted-foreground">Stichtag</p>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium">Zahldatum</label>
                            <input
                                type="date"
                                required
                                value={payDate}
                                onChange={(e) => setPayDate(e.target.value)}
                                className="w-full px-3 py-2 border rounded-md bg-background text-foreground"
                            />
                            <p className="text-xs text-muted-foreground">Auszahlung</p>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium">Frequenz</label>
                        <select
                            value={frequency}
                            onChange={(e) => setFrequency(e.target.value as any)}
                            className="w-full px-3 py-2 border rounded-md bg-background text-foreground"
                        >
                            <option value="quarterly">Quartalsweise (4x/Jahr)</option>
                            <option value="semi-annually">Halbjährlich (2x/Jahr)</option>
                            <option value="annually">Jährlich (1x/Jahr)</option>
                            <option value="monthly">Monatlich</option>
                        </select>
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
                            Hinzufügen
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
