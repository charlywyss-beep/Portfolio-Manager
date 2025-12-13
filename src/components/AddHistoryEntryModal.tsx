import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { usePortfolio } from '../context/PortfolioContext';
import type { PortfolioHistoryEntry } from '../types';

interface AddHistoryEntryModalProps {
    isOpen: boolean;
    onClose: () => void;
    editingEntry?: PortfolioHistoryEntry | null;
    mode?: 'add' | 'edit';
    currentTotals?: {
        totalValue: number;
        stockValue?: number;
        etfValue?: number;
        cashValue?: number;
    };
}

export function AddHistoryEntryModal({ isOpen, onClose, editingEntry, currentTotals }: AddHistoryEntryModalProps) {
    const { addHistoryEntry, updateHistoryEntry } = usePortfolio();

    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

    // Detailed breakdown
    const [stockValue, setStockValue] = useState<number | ''>('');
    const [etfValue, setEtfValue] = useState<number | ''>('');
    const [cashValue, setCashValue] = useState<number | ''>('');

    const [notes, setNotes] = useState('');

    // Computed total for display
    const calculatedTotal = (Number(stockValue) || 0) + (Number(etfValue) || 0) + (Number(cashValue) || 0);


    useEffect(() => {
        if (editingEntry) {
            setDate(editingEntry.date);
            setStockValue(editingEntry.stockValue || '');
            setEtfValue(editingEntry.etfValue || '');
            setCashValue(editingEntry.cashValue || '');
            // Fallback: if editing legacy entry with only totalValue, put it in Stock? or Cash? 
            // Better to leave empty or maybe put in Stock if other two are missing?
            // Decision: If new fields are missing but totalValue exists, maybe put it all in Stock as default?
            // Or just leave blank and let user fix it.
            if (!editingEntry.stockValue && !editingEntry.etfValue && !editingEntry.cashValue && editingEntry.totalValue) {
                setStockValue(editingEntry.totalValue);
            }

            setNotes(editingEntry.notes || '');
        } else {
            const lastYear = new Date().getFullYear() - 1;
            setDate(`${lastYear}-12-31`);
            setStockValue('');
            setEtfValue('');
            setCashValue('');
            setNotes('');
        }
    }, [editingEntry, isOpen]);

    if (!isOpen) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        const entryData = {
            date,
            totalValue: calculatedTotal,
            stockValue: Number(stockValue) || 0,
            etfValue: Number(etfValue) || 0,
            cashValue: Number(cashValue) || 0,
            notes
        };

        if (editingEntry) {
            // @ts-ignore - investedCapital is optional/removed but might be in type
            updateHistoryEntry(editingEntry.id, entryData);
        } else {
            addHistoryEntry(entryData);
        }
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-card border border-border rounded-xl shadow-xl w-full max-w-md animate-in fade-in zoom-in-95 duration-200">
                <div className="flex items-center justify-between p-6 border-b border-border">
                    <h2 className="text-xl font-bold">
                        {editingEntry ? 'Eintrag bearbeiten' : 'Historischen Wert erfassen'}
                    </h2>
                    <div className="flex gap-2">
                        {!editingEntry && currentTotals && (
                            <button
                                onClick={() => {
                                    setDate(new Date().toISOString().split('T')[0]);
                                    setStockValue(Number((currentTotals.stockValue || 0).toFixed(2)));
                                    setEtfValue(Number((currentTotals.etfValue || 0).toFixed(2)));
                                    setCashValue(Number((currentTotals.cashValue || 0).toFixed(2)));
                                    setNotes('Automatischer Eintrag');
                                }}
                                className="px-3 py-1 text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 rounded-md hover:bg-blue-200 dark:hover:bg-blue-900/60 transition-colors"
                            >
                                Aktuelle Werte übernehmen
                            </button>
                        )}
                        <button onClick={onClose} className="p-2 hover:bg-secondary rounded-full transition-colors">
                            <X className="size-5" />
                        </button>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Datum</label>
                        <input
                            type="date"
                            required
                            className="w-full h-10 px-3 rounded-md border border-input bg-background/50 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                            value={date}
                            onChange={(e) => setDate(e.target.value)}
                        />
                        <p className="text-xs text-muted-foreground">Meistens der 31.12. des Jahres</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Aktien (CHF)</label>
                            <input
                                type="number"
                                required
                                min="0"
                                step="0.01"
                                className="w-full h-10 px-3 rounded-md border border-input bg-background/50 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all font-mono"
                                value={stockValue}
                                onChange={(e) => setStockValue(Number(e.target.value))}
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">ETFs (CHF)</label>
                            <input
                                type="number"
                                required
                                min="0"
                                step="0.01"
                                className="w-full h-10 px-3 rounded-md border border-input bg-background/50 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all font-mono"
                                value={etfValue}
                                onChange={(e) => setEtfValue(Number(e.target.value))}
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Bank/Bar (CHF)</label>
                            <input
                                type="number"
                                required
                                min="0"
                                step="0.01"
                                className="w-full h-10 px-3 rounded-md border border-input bg-background/50 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all font-mono"
                                value={cashValue}
                                onChange={(e) => setCashValue(Number(e.target.value))}
                            />
                        </div>
                    </div>

                    <div className="p-3 bg-muted/30 rounded-lg flex justify-between items-center border border-border">
                        <span className="font-medium text-muted-foreground">Gesamtwert</span>
                        <span className="font-bold text-lg font-mono">{calculatedTotal.toFixed(2)} CHF</span>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium">Notizen</label>
                        <textarea
                            className="w-full p-3 rounded-md border border-input bg-background/50 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all min-h-[60px]"
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                        />
                    </div>

                    <div className="flex justify-end gap-3 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary rounded-md transition-colors"
                        >
                            Abbrechen
                        </button>
                        <button
                            type="submit"
                            className="px-6 py-2 text-sm font-bold text-primary-foreground bg-primary hover:bg-primary/90 rounded-md shadow-sm transition-all"
                        >
                            {editingEntry ? 'Speichern' : 'Hinzufügen'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
