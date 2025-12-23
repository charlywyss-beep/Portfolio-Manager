import { useState, useEffect } from 'react';
import { X, Save, Trash2, Plus } from 'lucide-react';
import type { Stock, Purchase } from '../types';

import { DecimalInput } from './DecimalInput';

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
        purchases?: Purchase[];
    };
    onUpdate: (id: string, newShares: number, newAvgPrice?: number, newBuyDate?: string, newFxRate?: number, newPurchases?: Purchase[]) => void;
    onDelete: (id: string) => void;
}

export function EditPositionModal({ isOpen, onClose, position, onUpdate, onDelete }: EditPositionModalProps) {
    // Unused: const { updateStock, stocks } = usePortfolio();
    // Unused: const currentStock = stocks.find(s => s.id === position.stock.id) || position.stock;

    // State for individual purchases
    const [purchases, setPurchases] = useState<Purchase[]>([]);

    // Fallback for "Manual Overrides" if user deletes all purchases but wants to set totals manually
    const [manualShares, setManualShares] = useState(position.shares.toString());
    const [manualPrice, setManualPrice] = useState(position.buyPriceAvg.toString());
    const [manualFx, setManualFx] = useState(position.averageEntryFxRate?.toString() || '1.0');
    const [manualDate, setManualDate] = useState(position.buyDate ? new Date(position.buyDate).toISOString().split('T')[0] : '');

    // Helper to fix floating point dust (e.g. 49.9999999 -> 50)
    const fixFloat = (num: number) => parseFloat(num.toFixed(6));

    // Reset state when modal opens
    useEffect(() => {
        if (isOpen) {
            if (position.purchases && position.purchases.length > 0) {
                // Sanitize loaded purchases
                const sanitizedPurchases = position.purchases.map(p => ({
                    ...p,
                    shares: fixFloat(p.shares),
                    price: fixFloat(p.price),
                    fxRate: fixFloat(p.fxRate)
                }));
                setPurchases(sanitizedPurchases);
            } else {
                // If no history exists, create one initial "Legacy" entry from current totals
                // so the user has something to edit or split up
                const initialEntry: Purchase = {
                    id: crypto.randomUUID(),
                    date: position.buyDate ? new Date(position.buyDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
                    shares: fixFloat(position.shares),
                    price: fixFloat(position.buyPriceAvg),
                    fxRate: fixFloat(position.averageEntryFxRate || 1.0)
                };
                setPurchases([initialEntry]);
            }

            // Still sync manuals just in case
            setManualShares(fixFloat(position.shares).toString());
            setManualPrice(fixFloat(position.buyPriceAvg).toString());
            setManualFx(fixFloat(position.averageEntryFxRate || 1.0).toString());
            setManualDate(position.buyDate ? new Date(position.buyDate).toISOString().split('T')[0] : '');
        }
    }, [isOpen, position]);

    // Derived Totals from Purchases
    const calculatedTotals = purchases.reduce((acc, p) => {
        acc.shares += p.shares;
        acc.totalNativeCost += p.shares * p.price;
        acc.totalCHFCost += p.shares * p.price * p.fxRate;
        // Find earliest date
        if (!acc.earliestDate || new Date(p.date) < new Date(acc.earliestDate)) {
            acc.earliestDate = p.date;
        }
        return acc;
    }, { shares: 0, totalNativeCost: 0, totalCHFCost: 0, earliestDate: '' });

    const calculatedAvgPrice = calculatedTotals.shares > 0 ? calculatedTotals.totalNativeCost / calculatedTotals.shares : 0;
    const calculatedAvgFx = calculatedTotals.totalNativeCost > 0 ? calculatedTotals.totalCHFCost / calculatedTotals.totalNativeCost : 1.0;

    const handleAddPurchase = () => {
        const newPurchase: Purchase = {
            id: crypto.randomUUID(),
            date: new Date().toISOString().split('T')[0],
            shares: 0,
            price: 0,
            fxRate: 1.0
        };
        setPurchases([...purchases, newPurchase]);
    };

    const handleUpdatePurchase = (id: string, field: keyof Purchase, value: any) => {
        setPurchases(purchases.map(p =>
            p.id === id ? { ...p, [field]: value } : p
        ));
    };

    const handleRemovePurchase = (id: string) => {
        setPurchases(purchases.filter(p => p.id !== id));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        // If we have purchases, use the calculated values
        if (purchases.length > 0) {
            onUpdate(
                position.id,
                calculatedTotals.shares,
                calculatedAvgPrice,
                calculatedTotals.earliestDate,
                calculatedAvgFx,
                purchases
            );
        } else {
            // Fallback (shouldn't really happen if we default to one entry, but safety first)
            const newShares = parseFloat(manualShares);
            const newPrice = parseFloat(manualPrice);
            const newFx = parseFloat(manualFx);
            const isoDate = manualDate ? new Date(manualDate).toISOString() : undefined;
            onUpdate(position.id, newShares, newPrice, isoDate, newFx, []);
        }
        onClose();
    };

    const handleDelete = () => {
        if (confirm(`Möchten Sie die Position "${position.stock.name}" wirklich löschen?`)) {
            onDelete(position.id);
            onClose();
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-border">
                    <div>
                        <h2 className="text-xl font-bold">Position bearbeiten</h2>
                        <p className="text-xs text-muted-foreground mt-1">
                            Erfassen Sie hier alle einzelnen Käufe. Der Durchschnitt wird automatisch berechnet.
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-muted rounded-lg transition-colors" title="Schließen">
                        <X className="size-5" />
                    </button>
                </div>

                {/* Content */}
                <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto flex flex-col">

                    {/* Stock Info Bar */}
                    <div className="p-4 bg-muted/30 border-b border-border flex items-center gap-3">
                        <div className="size-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold border border-primary/20 shrink-0">
                            {position.stock.symbol.slice(0, 2)}
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="font-semibold truncate">{position.stock.name}</div>
                            <div className="text-xs text-muted-foreground">
                                {position.stock.symbol} • Aktuell: {position.stock.currentPrice.toLocaleString('de-CH', { style: 'currency', currency: position.stock.currency })}
                            </div>
                        </div>
                        {/* Live Calculation Badge */}
                        <div className="text-right px-4 py-2 bg-primary/5 rounded-lg border border-primary/10">
                            <div className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">NEUER BESTAND</div>
                            <div className="font-mono font-bold text-lg text-primary">
                                {calculatedTotals.shares.toLocaleString('de-CH')} Stk
                            </div>
                            <div className="text-[10px] text-muted-foreground">
                                Ø {calculatedAvgPrice.toLocaleString('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {position.stock.currency}
                            </div>
                        </div>
                    </div>

                    {/* Purchases List */}
                    <div className="p-6 space-y-4 flex-1">
                        <div className="space-y-3">
                            {purchases.map((purchase) => (
                                <div key={purchase.id} className="grid grid-cols-12 gap-3 items-end bg-card p-3 rounded-lg border border-border shadow-sm group hover:border-primary/30 transition-colors">
                                    {/* Date */}
                                    <div className="col-span-3">
                                        <label className="text-[10px] uppercase font-bold text-muted-foreground mb-1 block">Datum</label>
                                        <input
                                            type="date"
                                            value={purchase.date}
                                            onChange={(e) => handleUpdatePurchase(purchase.id, 'date', e.target.value)}
                                            className="w-full h-9 px-2 text-sm border border-border rounded bg-background focus:ring-1 focus:ring-primary"
                                        />
                                    </div>
                                    {/* Shares */}
                                    <div className="col-span-2">
                                        <label className="text-[10px] uppercase font-bold text-muted-foreground mb-1 block">Stück</label>
                                        <DecimalInput
                                            value={purchase.shares}
                                            onChange={(val) => handleUpdatePurchase(purchase.id, 'shares', val)}
                                            className="w-full h-9 px-2 text-sm border border-border rounded bg-background focus:ring-1 focus:ring-primary"
                                        />
                                    </div>
                                    {/* Price */}
                                    <div className="col-span-3">
                                        <label className="text-[10px] uppercase font-bold text-muted-foreground mb-1 block">Preis ({position.stock.currency})</label>
                                        <DecimalInput
                                            value={purchase.price}
                                            onChange={(val) => handleUpdatePurchase(purchase.id, 'price', val)}
                                            className="w-full h-9 px-2 text-sm border border-border rounded bg-background focus:ring-1 focus:ring-primary"
                                        />
                                    </div>
                                    {/* FX Rate */}
                                    <div className="col-span-3">
                                        <label className="text-[10px] uppercase font-bold text-muted-foreground mb-1 block">Wechselkurs (CHF)</label>
                                        <DecimalInput
                                            value={purchase.fxRate}
                                            onChange={(val) => handleUpdatePurchase(purchase.id, 'fxRate', val)}
                                            disabled={position.stock.currency === 'CHF'}
                                            className="w-full h-9 px-2 text-sm border border-border rounded bg-background focus:ring-1 focus:ring-primary disabled:opacity-50"
                                        />
                                    </div>
                                    {/* Delete Row */}
                                    <div className="col-span-1 flex justify-center pb-1">
                                        {purchases.length > 1 && (
                                            <button
                                                type="button"
                                                onClick={() => handleRemovePurchase(purchase.id)}
                                                className="p-1.5 text-muted-foreground hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                                                title="Eintrag entfernen"
                                            >
                                                <Trash2 className="size-4" />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>

                        <button
                            type="button"
                            onClick={handleAddPurchase}
                            className="w-full py-2 border-2 border-dashed border-border rounded-lg text-sm text-muted-foreground hover:text-primary hover:border-primary/50 hover:bg-primary/5 transition-all flex items-center justify-center gap-2"
                        >
                            <Plus className="size-4" />
                            Weiteren Kauf hinzufügen
                        </button>
                    </div>

                    {/* Footer Actions */}
                    <div className="flex items-center gap-3 p-6 border-t border-border bg-muted/10">
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
