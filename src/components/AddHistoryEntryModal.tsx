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
        totalCost: number;
    };
}

export function AddHistoryEntryModal({ isOpen, onClose, editingEntry, currentTotals }: AddHistoryEntryModalProps) {
    const { addHistoryEntry, updateHistoryEntry } = usePortfolio();

    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [totalValue, setTotalValue] = useState<number | ''>('');
    const [investedCapital, setInvestedCapital] = useState<number | ''>('');
    const [notes, setNotes] = useState('');

    useEffect(() => {
        if (editingEntry) {
            setDate(editingEntry.date);
            setTotalValue(editingEntry.totalValue);
            setInvestedCapital(editingEntry.investedCapital || '');
            setNotes(editingEntry.notes || '');
        } else {
            // Default: if currentTotals provided, don't auto-fill yet (user should click button),
            // OR auto-fill if date is today?
            // Let's stick to "User clicks button" pattern for safety.
            // But default date can be today if not editing.

            // Wait, previous logic was: Default to End of Last Year
            const lastYear = new Date().getFullYear() - 1;
            setDate(`${lastYear}-12-31`);
            setTotalValue('');
            setInvestedCapital('');
            setNotes('');
        }
    }, [editingEntry, isOpen]);

    if (!isOpen) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        const entryData = {
            date,
            totalValue: Number(totalValue),
            investedCapital: investedCapital ? Number(investedCapital) : undefined,
            notes
        };

        if (editingEntry) {
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
                                    setTotalValue(currentTotals.totalValue);
                                    setInvestedCapital(currentTotals.totalCost);
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

                    <div className="space-y-2">
                        <label className="text-sm font-medium">Gesamtwert Portfolio (CHF)</label>
                        <input
                            type="number"
                            required
                            min="0"
                            step="0.01"
                            placeholder="z.B. 50000.00"
                            className="w-full h-10 px-3 rounded-md border border-input bg-background/50 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all font-mono"
                            value={totalValue}
                            onChange={(e) => setTotalValue(Number(e.target.value))}
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium">Investiertes Kapital (Optional)</label>
                        <input
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder="Für korrekte Rendite-Berechnung"
                            className="w-full h-10 px-3 rounded-md border border-input bg-background/50 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all font-mono"
                            value={investedCapital}
                            onChange={(e) => setInvestedCapital(Number(e.target.value))}
                        />
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
