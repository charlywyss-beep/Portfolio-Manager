import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { usePortfolio } from '../context/PortfolioContext';
import type { Stock, Currency } from '../types';

interface AddDividendModalProps {
    isOpen: boolean;
    onClose: () => void;
    editingStock?: Stock | null;
}

export function AddDividendModal({ isOpen, onClose, editingStock }: AddDividendModalProps) {
    const { stocks, positions, updateStockDividend } = usePortfolio();

    const [selectedStockId, setSelectedStockId] = useState('');
    const [amount, setAmount] = useState('');
    const [yieldPercent, setYieldPercent] = useState('');
    const [currency, setCurrency] = useState<Currency>('CHF');
    const [exDate, setExDate] = useState('');
    const [payDate, setPayDate] = useState('');
    const [frequency, setFrequency] = useState<'quarterly' | 'semi-annually' | 'annually' | 'monthly'>('quarterly');

    // Pre-fill fields when editing
    useEffect(() => {
        if (editingStock) {
            setSelectedStockId(editingStock.id);
            setAmount(editingStock.dividendAmount?.toString() || '');
            setYieldPercent(editingStock.dividendYield?.toString() || '');
            setCurrency(editingStock.dividendCurrency || editingStock.currency);
            setExDate(editingStock.dividendExDate || '');
            setPayDate(editingStock.dividendPayDate || '');
            setFrequency(editingStock.dividendFrequency || 'quarterly');
        } else if (isOpen && !editingStock) {
            // Reset form when adding new
            setSelectedStockId('');
            setAmount('');
            setYieldPercent('');
            setCurrency('CHF');
            setExDate('');
            setPayDate('');
            setFrequency('quarterly');
        }
    }, [editingStock, isOpen]);

    // Auto-select stock and pre-fill when user selects from dropdown
    useEffect(() => {
        if (selectedStockId && !editingStock) {
            const stock = stocks.find(s => s.id === selectedStockId);
            if (stock) {
                setYieldPercent(stock.dividendYield?.toString() || '');
                setAmount(stock.dividendAmount?.toString() || '');
                setCurrency(stock.dividendCurrency || stock.currency);
                setExDate(stock.dividendExDate || '');
                setPayDate(stock.dividendPayDate || '');
                setFrequency(stock.dividendFrequency || 'quarterly');
            }
        }
    }, [selectedStockId, stocks, editingStock]);

    if (!isOpen) return null;

    const selectedStock = stocks.find(s => s.id === selectedStockId);
    const position = positions.find(p => p.stockId === selectedStockId);

    // Auto-calculate between yield% ↔ amount/share
    const handleYieldChange = (newYield: string) => {
        setYieldPercent(newYield);
        if (selectedStock && newYield) {
            const yieldValue = parseFloat(newYield);
            const dividendAmount = (selectedStock.currentPrice * yieldValue) / 100;
            setAmount(dividendAmount.toFixed(2));
        }
    };

    const handleAmountChange = (newAmount: string) => {
        setAmount(newAmount);
        if (selectedStock && newAmount) {
            const dividendAmount = parseFloat(newAmount);
            const yieldValue = (dividendAmount / selectedStock.currentPrice) * 100;
            setYieldPercent(yieldValue.toFixed(2));
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        if (!selectedStockId) return;

        updateStockDividend(selectedStockId, {
            dividendYield: yieldPercent ? parseFloat(yieldPercent) : undefined,
            dividendAmount: amount ? parseFloat(amount) : undefined,
            dividendCurrency: currency,
            dividendExDate: exDate || undefined,
            dividendPayDate: payDate || undefined,
            dividendFrequency: frequency
        });

        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-md animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-border">
                    <div>
                        <h2 className="text-xl font-bold">{editingStock ? 'Dividende bearbeiten' : 'Dividende bearbeiten/hinzufügen'}</h2>
                        <p className="text-sm text-muted-foreground">Dividendendaten erfassen</p>
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
                            disabled={!!editingStock}
                            className="w-full px-3 py-2 border rounded-md bg-background text-foreground disabled:opacity-60"
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
                            <label className="text-sm font-medium">Rendite %</label>
                            <input
                                type="number"
                                step="0.01"
                                min="0"
                                placeholder="z.B. 3.90"
                                value={yieldPercent}
                                onChange={(e) => handleYieldChange(e.target.value)}
                                className="w-full px-3 py-2 border rounded-md bg-background text-foreground"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium">Dividende/Aktie</label>
                            <input
                                type="number"
                                step="0.01"
                                min="0"
                                placeholder="z.B. 2.80"
                                value={amount}
                                onChange={(e) => handleAmountChange(e.target.value)}
                                className="w-full px-3 py-2 border rounded-md bg-background text-foreground"
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium">Währung</label>
                        <select
                            value={currency}
                            onChange={(e) => setCurrency(e.target.value as Currency)}
                            className="w-full px-3 py-2 border rounded-md bg-background text-foreground"
                        >
                            <option value="CHF">CHF (Schweizer Franken)</option>
                            <option value="USD">USD (US Dollar)</option>
                            <option value="EUR">EUR (Euro)</option>
                        </select>
                    </div>

                    {selectedStock && position && amount && (
                        <div className="p-3 bg-muted rounded-lg">
                            <p className="text-sm font-medium">Erwartete Jahresausschüttung</p>
                            <p className="text-lg font-bold text-primary">
                                {(parseFloat(amount) * position.shares).toFixed(2)} {currency}
                            </p>
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Ex-Datum</label>
                            <input
                                type="date"
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
                            Speichern
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
