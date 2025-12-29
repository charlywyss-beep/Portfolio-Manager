import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { X, Save, Trash2, Plus, Pencil } from 'lucide-react';
import { usePortfolio } from '../context/PortfolioContext';
import type { Stock, Purchase } from '../types';

import { DecimalInput } from './DecimalInput';
import { Logo } from './Logo';
import { useCurrencyFormatter } from '../utils/currency';

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
    const { updateStock } = usePortfolio();
    const { rates } = useCurrencyFormatter();
    const inputRef = useRef<HTMLTextAreaElement>(null);

    // State for individual purchases
    const [purchases, setPurchases] = useState<Purchase[]>([]);

    // Editable Stock Name
    const [stockName, setStockName] = useState(position.stock.name);

    // Fallback for "Manual Overrides" if user deletes all purchases but wants to set totals manually
    // NOTE: Manual states are "UI Values" (Pounds), not Storage Values (Pence)
    const [manualShares, setManualShares] = useState(position.shares.toString());
    const [manualPrice, setManualPrice] = useState('0'); // Initialized in useEffect
    const [manualFx, setManualFx] = useState(position.averageEntryFxRate?.toString() || '1.0');
    const [manualDate, setManualDate] = useState(position.buyDate ? new Date(position.buyDate).toISOString().split('T')[0] : '');

    // Helper to fix floating point dust
    // GBp: 4 decimals allowed. Others: 2 decimals.
    // FX Rates: 6 decimals (default).
    // Shares: 6 decimals (fractional shares).
    const fixPrice = (num: number) => parseFloat(num.toFixed(isGBX ? 4 : 2));
    const fixFx = (num: number) => parseFloat(num.toFixed(6));
    const fixShares = (num: number) => parseFloat(num.toFixed(6));

    const isGBX = position.stock.currency === 'GBp';

    // Scale Helpers: Storage (Pence) <-> UI (Pounds)
    // If GBX: Storage 3282 (p) -> UI 32.82 (£)
    const toUI = (storageVal: number) => isGBX ? storageVal / 100 : storageVal;
    const toStorage = (uiVal: number) => isGBX ? uiVal * 100 : uiVal;

    // Reset state when modal opens
    useEffect(() => {
        if (isOpen) {
            setStockName(position.stock.name); // Sync Name

            if (position.purchases && position.purchases.length > 0) {
                // Sanitize loaded purchases
                // Sanitize loaded purchases
                const sanitizedPurchases = position.purchases.map(p => ({
                    ...p,
                    shares: fixShares(p.shares),
                    price: fixPrice(toUI(p.price)), // Scale Price to UI and Fix Precision
                    fxRate: fixFx(p.fxRate)
                }));
                setPurchases(sanitizedPurchases);
            } else {
                // If no history exists, create one initial "Legacy" entry from current totals
                const initialEntry: Purchase = {
                    id: crypto.randomUUID(),
                    date: position.buyDate ? new Date(position.buyDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
                    shares: fixShares(position.shares),
                    price: fixPrice(toUI(position.buyPriceAvg)), // Scale Price to UI
                    fxRate: fixFx(position.averageEntryFxRate || 1.0)
                };
                setPurchases([initialEntry]);
            }

            // Sync manuals
            setManualShares(fixShares(position.shares).toString());
            setManualPrice(fixPrice(toUI(position.buyPriceAvg)).toString()); // Scale Price to UI
            setManualFx(fixFx(position.averageEntryFxRate || 1.0).toString());
            setManualDate(position.buyDate ? new Date(position.buyDate).toISOString().split('T')[0] : '');
        }
    }, [isOpen, position]);

    // Derived Totals from Purchases
    // NOTE: `p.price` here is the UI VALUE (Pounds). 
    // We need to convert back to Storage Value for correct "Average Price" calculation if we want the Result to be Storage Value?
    // Wait, the Header Display wants "UI Value" (Pounds).
    // The "onUpdate" wants "Storage Value" (Pence).
    // Let's keep `purchases` state as UI Values.
    const calculatedTotals = (purchases || []).reduce((acc, p) => {
        acc.shares += p.shares;
        acc.totalNativeCost += p.shares * p.price; // Cost in UI Units
        acc.totalCHFCost += p.shares * p.price * p.fxRate;
        // Find earliest date
        if (!acc.earliestDate || new Date(p.date) < new Date(acc.earliestDate)) {
            acc.earliestDate = p.date;
        }
        return acc;
    }, { shares: 0, totalNativeCost: 0, totalCHFCost: 0, earliestDate: '' });

    const calculatedAvgPriceUI = calculatedTotals.shares > 0 ? calculatedTotals.totalNativeCost / calculatedTotals.shares : 0;
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

        // Update Stock Name
        if (stockName.trim() !== position.stock.name) {
            updateStock(position.stock.id, { name: stockName });
        }

        // If we have purchases, use the calculated values
        if (purchases.length > 0) {
            // Must convert UI Prices back to Storage Prices for saving
            // Deep copy and map
            const purchasesToSave = purchases.map(p => ({
                ...p,
                price: toStorage(p.price)
            }));

            const finalAvgPrice = toStorage(calculatedAvgPriceUI);

            onUpdate(
                position.id,
                calculatedTotals.shares,
                finalAvgPrice,
                calculatedTotals.earliestDate,
                calculatedAvgFx,
                purchasesToSave
            );
        } else {
            // Manual fallback
            const newShares = parseFloat(manualShares);
            const newPriceUI = parseFloat(manualPrice);
            const newFx = parseFloat(manualFx);
            const isoDate = manualDate ? new Date(manualDate).toISOString() : undefined;

            onUpdate(position.id, newShares, toStorage(newPriceUI), isoDate, newFx, []);
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
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4 pointer-events-none">
            <div className="relative pointer-events-auto px-4 py-24 md:px-24 md:py-32 lg:px-36 lg:py-32">
                <div className="absolute inset-0 bg-black/50 backdrop-blur-sm rounded-xl"></div>
                <div className="bg-card border border-border rounded-xl shadow-xl w-full max-w-full md:max-w-4xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200 relative z-10 max-h-[calc(100vh-240px)]">
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
                        {/* Stock Info Bar */}
                        {/* Stock Info Bar */}
                        <div className="p-4 bg-muted/30 border-b border-border grid grid-cols-3 items-center gap-4">
                            {/* Left Column: Logo & Name */}
                            <div className="flex items-center gap-3 overflow-hidden justify-start">
                                <Link
                                    to={`/dividends/edit/${position.stock.id}?from=portfolio`}
                                    className="cursor-pointer hover:opacity-80 transition-opacity block"
                                    onClick={(e) => {
                                        // Allow default navigation (Link) but also close modal
                                        // We do NOT call preventDefault because we WANT the navigation.
                                        e.stopPropagation();
                                        onClose();
                                    }}
                                    title="Zu Stammdaten wechseln"
                                >
                                    <Logo
                                        url={position.stock.logoUrl}
                                        alt={stockName}
                                        fallback={position.stock.symbol.slice(0, 2)}
                                        size="size-10"
                                    />
                                </Link>
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-start gap-2 group/edit w-full">
                                        <textarea
                                            ref={inputRef}
                                            className="w-full text-base font-semibold bg-transparent border border-transparent hover:border-border focus:border-primary focus:ring-1 focus:ring-primary rounded px-1 -ml-1 transition-all outline-none text-foreground placeholder:text-muted-foreground resize-y min-h-[28px] overflow-hidden leading-snug"
                                            value={stockName}
                                            onChange={(e) => {
                                                setStockName(e.target.value);
                                                // Auto-resize
                                                e.target.style.height = 'auto';
                                                e.target.style.height = e.target.scrollHeight + 'px';
                                            }}
                                            onFocus={(e) => {
                                                e.target.style.height = 'auto';
                                                e.target.style.height = e.target.scrollHeight + 'px';
                                            }}
                                            rows={1}
                                            placeholder="Name der Position"
                                            style={{ height: 'auto' }}
                                        />
                                        <Pencil
                                            className="size-3.5 text-muted-foreground opacity-50 group-hover/edit:opacity-100 transition-opacity shrink-0 cursor-pointer hover:text-primary mt-1.5"
                                            onClick={() => inputRef.current?.focus()}
                                        />
                                    </div>
                                    <div className="text-xs text-muted-foreground mt-0.5 whitespace-nowrap overflow-hidden text-ellipsis">
                                        {position.stock.symbol} • Aktuell: {position.stock.currentPrice.toLocaleString('de-CH', { style: 'currency', currency: position.stock.currency })}
                                    </div>
                                </div>
                            </div>

                            {/* Middle Column: FX Info */}
                            <div className="flex justify-center">
                                {rates && position.stock.currency !== 'CHF' && rates[isGBX ? 'GBP' : position.stock.currency] && (
                                    <div className="px-4 py-2 bg-background/50 rounded-lg border border-border/50 flex flex-col items-center justify-center min-w-[120px]">
                                        <div className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">WECHSELKURS</div>
                                        <div className="font-mono font-medium text-sm text-primary">
                                            1 {isGBX ? 'GBP' : position.stock.currency} = {(1 / rates[isGBX ? 'GBP' : position.stock.currency]).toFixed(2)} CHF
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Right Column: New Balance */}
                            <div className="flex justify-end">
                                <div className="text-right px-4 py-2 bg-primary/5 rounded-lg border border-primary/10">
                                    <div className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">NEUER BESTAND</div>
                                    <div className="font-mono font-bold text-lg text-primary">
                                        {calculatedTotals.shares.toLocaleString('de-CH')} Stk
                                    </div>
                                    <div className="text-[10px] text-muted-foreground">
                                        Ø {calculatedAvgPriceUI.toLocaleString('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {isGBX ? 'GBP' : position.stock.currency}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Purchases List */}
                        <div className="p-6 space-y-4 flex-1">
                            {/* Header Row */}
                            <div className="grid grid-cols-12 gap-3 px-3 py-2 text-[10px] font-bold text-muted-foreground uppercase bg-muted/50 rounded-lg mb-2">
                                <div className="col-span-3">Datum</div>
                                <div className="col-span-2 text-center">Stück</div>
                                <div className="col-span-3 text-center">Kaufpreis ({isGBX ? 'GBP' : position.stock.currency})</div>
                                <div className="col-span-3 text-center">
                                    <div>Wechselkurs</div>
                                    <div className="font-normal normal-case text-[9px] opacity-70">CHF pro 1 {isGBX ? 'GBP' : position.stock.currency}</div>
                                </div>
                                <div className="col-span-1"></div>
                            </div>

                            <div className="space-y-2">
                                {purchases.map((purchase) => (
                                    <div key={purchase.id} className="grid grid-cols-12 gap-3 items-center bg-card p-2 rounded-lg border border-border/50 shadow-sm group hover:border-primary/30 transition-colors">
                                        {/* Date */}
                                        <div className="col-span-3">
                                            <input
                                                type="date"
                                                value={purchase.date}
                                                onChange={(e) => handleUpdatePurchase(purchase.id, 'date', e.target.value)}
                                                className="w-full h-8 px-2 text-sm border border-border rounded bg-background focus:ring-1 focus:ring-primary"
                                            />
                                        </div>
                                        {/* Shares */}
                                        <div className="col-span-2">
                                            <DecimalInput
                                                value={purchase.shares}
                                                onChange={(val) => handleUpdatePurchase(purchase.id, 'shares', parseFloat(val) || 0)}
                                                onFocus={(e) => e.target.select()}
                                                className="w-full h-8 px-2 text-sm border border-border rounded bg-background focus:ring-1 focus:ring-primary text-center"
                                            />
                                        </div>
                                        {/* Price */}
                                        <div className="col-span-3">
                                            <DecimalInput
                                                value={purchase.price}
                                                onChange={(val) => handleUpdatePurchase(purchase.id, 'price', parseFloat(val) || 0)}
                                                maxDecimals={isGBX ? 4 : 2}
                                                onFocus={(e) => e.target.select()}
                                                className="w-full h-8 px-2 text-sm border border-border rounded bg-background focus:ring-1 focus:ring-primary text-center"
                                            />
                                        </div>
                                        {/* FX Rate */}
                                        <div className="col-span-3">
                                            <DecimalInput
                                                value={purchase.fxRate}
                                                onChange={(val) => handleUpdatePurchase(purchase.id, 'fxRate', parseFloat(val) || 0)}
                                                disabled={position.stock.currency === 'CHF'}
                                                maxDecimals={4}
                                                onFocus={(e) => e.target.select()}
                                                className="w-full h-8 px-2 text-sm border border-border rounded bg-background focus:ring-1 focus:ring-primary disabled:opacity-50 text-center"
                                            />
                                        </div>
                                        {/* Delete Row */}
                                        <div className="col-span-1 flex justify-center">
                                            {purchases.length > 1 && (
                                                <button
                                                    type="button"
                                                    onClick={() => handleRemovePurchase(purchase.id)}
                                                    className="p-1.5 text-muted-foreground hover:text-red-500 hover:bg-red-50 rounded transition-colors opacity-0 group-hover:opacity-100"
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
        </div>
    );
}
