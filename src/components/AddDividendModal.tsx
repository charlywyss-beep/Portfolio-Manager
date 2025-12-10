import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { usePortfolio } from '../context/PortfolioContext';
import type { Stock, Currency } from '../types';

interface AddDividendModalProps {
    isOpen: boolean;
    onClose: () => void;
    editingStock?: Stock | null;
}

// Helper to get annual factor
const getFrequencyFactor = (freq: string) => {
    switch (freq) {
        case 'monthly': return 12;
        case 'quarterly': return 4;
        case 'semi-annually': return 2;
        case 'annually': return 1;
        default: return 1;
    }
};

export function AddDividendModal({ isOpen, onClose, editingStock }: AddDividendModalProps) {
    const { stocks, positions, updateStockDividend } = usePortfolio();

    // 1. All Hooks MUST be at the top level, before any return statements
    const [selectedStockId, setSelectedStockId] = useState('');
    const [amount, setAmount] = useState('');
    const [yieldPercent, setYieldPercent] = useState('');
    const [currency, setCurrency] = useState<Currency>('CHF');
    const [exDate, setExDate] = useState('');
    const [payDate, setPayDate] = useState('');
    const [frequency, setFrequency] = useState<'quarterly' | 'semi-annually' | 'annually' | 'monthly'>('quarterly');

    const [quarterlyDates, setQuarterlyDates] = useState<{ exDate: string; payDate: string; }[]>([
        { exDate: '', payDate: '' },
        { exDate: '', payDate: '' },
        { exDate: '', payDate: '' },
        { exDate: '', payDate: '' }
    ]);

    // Derived state (safe to have here, but used in effects)
    const selectedStock = stocks.find(s => s.id === selectedStockId);
    const position = positions.find(p => p.stockId === selectedStockId);

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

            if (editingStock.dividendDates && editingStock.dividendDates.length > 0) {
                // Ensure we always have 4 for the UI if quarterly, even if the data says otherwise (though it should be sync)
                // But generally just fill with what we have + empties if needed
                const dates = [...editingStock.dividendDates];
                while (dates.length < 4) dates.push({ exDate: '', payDate: '' });
                setQuarterlyDates(dates);
            } else {
                setQuarterlyDates([
                    { exDate: '', payDate: '' },
                    { exDate: '', payDate: '' },
                    { exDate: '', payDate: '' },
                    { exDate: '', payDate: '' }
                ]);
            }
        } else if (isOpen && !editingStock) {
            // Reset form when adding new
            setSelectedStockId('');
            setAmount('');
            setYieldPercent('');
            setCurrency('CHF');
            setExDate('');
            setPayDate('');
            setFrequency('quarterly');
            setQuarterlyDates(Array(4).fill({ exDate: '', payDate: '' }));
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
                if (stock.dividendDates && stock.dividendDates.length > 0) {
                    const dates = [...stock.dividendDates];
                    while (dates.length < 4) dates.push({ exDate: '', payDate: '' });
                    setQuarterlyDates(dates);
                } else {
                    setQuarterlyDates(Array(4).fill({ exDate: '', payDate: '' }));
                }
            }
        }
    }, [selectedStockId, stocks, editingStock]);

    // 2. Helper Logic (Handlers) - Safe to define here

    // Auto-calculate between yield% ↔ amount/share (Annualized)
    const handleYieldChange = (newYield: string) => {
        setYieldPercent(newYield);
        if (selectedStock && newYield && !isNaN(parseFloat(newYield))) {
            const yieldValue = parseFloat(newYield);
            const factor = getFrequencyFactor(frequency);
            // Amount = (Price * Yield) / 100 / Factor
            const dividendAmount = ((selectedStock.currentPrice * yieldValue) / 100) / factor;
            if (isFinite(dividendAmount)) {
                setAmount(dividendAmount.toFixed(4));
            }
        }
    };

    const handleAmountChange = (newAmount: string) => {
        setAmount(newAmount);
        if (selectedStock && newAmount && !isNaN(parseFloat(newAmount))) {
            const dividendAmount = parseFloat(newAmount);
            const factor = getFrequencyFactor(frequency);
            const yieldValue = ((dividendAmount * factor) / selectedStock.currentPrice) * 100;
            if (isFinite(yieldValue)) {
                setYieldPercent(yieldValue.toFixed(2));
            }
        }
    };

    // Update yield when frequency changes (instead of useEffect, we do it in the handler)
    const handleFrequencyChange = (newFrequency: 'quarterly' | 'semi-annually' | 'annually' | 'monthly') => {
        setFrequency(newFrequency);
        // Optional: Recalculate Yield if Amount is present, to keep Amount constant but update Yield logic
        if (amount && selectedStock && !isNaN(parseFloat(amount))) {
            const dividendAmount = parseFloat(amount);
            const factor = getFrequencyFactor(newFrequency);
            const yieldValue = ((dividendAmount * factor) / selectedStock.currentPrice) * 100;
            if (isFinite(yieldValue)) {
                setYieldPercent(yieldValue.toFixed(2));
            }
        }
    };

    const handleQuarterlyDateChange = (index: number, field: 'exDate' | 'payDate', value: string) => {
        const newDates = [...quarterlyDates];
        newDates[index] = { ...newDates[index], [field]: value };
        setQuarterlyDates(newDates);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        if (!selectedStockId) return;

        // If quarterly, use the array. Otherwise clear the array and use single fields.
        let submissionDates = undefined;
        let submissionExDate = exDate || undefined;
        let submissionPayDate = payDate || undefined;

        if (frequency === 'quarterly') {
            // Filter out empty entries if desired, or keep them? 
            // Better to keep valid date pairs.
            const validDates = quarterlyDates.filter(d => d.payDate); // At least payDate is usually required for calculation
            if (validDates.length > 0) {
                submissionDates = validDates;
                // Maybe set single fields to the FIRST date as fallback/display?
                submissionExDate = validDates[0].exDate;
                submissionPayDate = validDates[0].payDate;
            }
        }

        updateStockDividend(selectedStockId, {
            dividendYield: yieldPercent ? parseFloat(yieldPercent) : undefined,
            dividendAmount: amount ? parseFloat(amount) : undefined,
            dividendCurrency: currency,
            dividendExDate: submissionExDate,
            dividendPayDate: submissionPayDate,
            dividendDates: submissionDates,
            dividendFrequency: frequency
        });

        onClose();
    };

    // 3. Conditional Return ONLY AFTER all hooks are declared
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-md animate-in zoom-in-95 duration-200 overflow-y-auto max-h-[90vh]">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-border sticky top-0 bg-card z-10">
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
                                step="0.0001"
                                min="0"
                                placeholder="z.B. 3.90"
                                value={yieldPercent}
                                onChange={(e) => handleYieldChange(e.target.value)}
                                className="w-full px-3 py-2 border rounded-md bg-background text-foreground"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium">Dividende/Zahlung</label>
                            <input
                                type="number"
                                step="0.0001"
                                min="0"
                                placeholder="z.B. 0.6006"
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
                            <option value="GBp">GBp (Britische Pence)</option>
                        </select>
                    </div>

                    {selectedStock && position && amount && !isNaN(parseFloat(amount)) && (
                        <div className="p-3 bg-muted rounded-lg">
                            <p className="text-sm font-medium">Erwartete Jahresausschüttung</p>
                            <p className="text-lg font-bold text-primary">
                                {(parseFloat(amount) * position.shares * getFrequencyFactor(frequency)).toFixed(2)} {currency}
                            </p>
                        </div>
                    )}

                    <div className="space-y-2">
                        <label className="text-sm font-medium">Frequenz</label>
                        <select
                            value={frequency}
                            onChange={(e) => handleFrequencyChange(e.target.value as any)}
                            className="w-full px-3 py-2 border rounded-md bg-background text-foreground"
                        >
                            <option value="quarterly">Quartalsweise (4x/Jahr)</option>
                            <option value="semi-annually">Halbjährlich (2x/Jahr)</option>
                            <option value="annually">Jährlich (1x/Jahr)</option>
                            <option value="monthly">Monatlich</option>
                        </select>
                    </div>

                    {frequency === 'quarterly' ? (
                        <div className="space-y-3 bg-muted/30 p-3 rounded-lg border border-border">
                            <label className="text-sm font-bold block mb-2">Auszahlungsdaten (4 Quartale)</label>
                            {quarterlyDates.map((date, idx) => (
                                <div key={idx} className="grid grid-cols-2 gap-3 pb-2 border-b border-border/50 last:border-0 last:pb-0">
                                    <div className="space-y-1">
                                        <label className="text-xs text-muted-foreground font-medium">Q{idx + 1} Ex-Datum</label>
                                        <input
                                            type="date"
                                            value={date.exDate}
                                            onChange={(e) => handleQuarterlyDateChange(idx, 'exDate', e.target.value)}
                                            className="w-full px-2 py-1.5 text-sm border rounded bg-background"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs text-muted-foreground font-medium">Q{idx + 1} Zahldatum</label>
                                        <input
                                            type="date"
                                            value={date.payDate}
                                            onChange={(e) => handleQuarterlyDateChange(idx, 'payDate', e.target.value)}
                                            className="w-full px-2 py-1.5 text-sm border rounded bg-background"
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
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
                    )}

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
