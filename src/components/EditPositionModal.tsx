import { useState, useEffect, useRef, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { X, Save, Trash2, Plus, Pencil, Landmark } from 'lucide-react';
import { usePortfolio } from '../context/PortfolioContext';
import { cn } from '../utils'; // Added import
import type { Stock, Purchase, Currency } from '../types';

import { DecimalInput } from './DecimalInput';
import { Logo } from './Logo';
import { useCurrencyFormatter, convertToCHF } from '../utils/currency';

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
        broker?: string;
    };
    onUpdate: (id: string, newShares: number, newAvgPrice?: number, newBuyDate?: string, newFxRate?: number, newPurchases?: Purchase[], newBroker?: string) => void;
    onDelete: (id: string) => void;
}

export function EditPositionModal({ isOpen, onClose, position, onUpdate, onDelete }: EditPositionModalProps) {
    const { updateStock, positions, fixedDeposits } = usePortfolio();
    const { rates } = useCurrencyFormatter();
    const inputRef = useRef<HTMLTextAreaElement>(null);

    // State for individual purchases
    const [purchases, setPurchases] = useState<Purchase[]>([]);
    const [inputInCHF, setInputInCHF] = useState(false);
    const [broker, setBroker] = useState(position.broker || '');

    // Editable Stock Name & Currency
    const [stockName, setStockName] = useState(position.stock.name);
    const [selectedCurrency, setSelectedCurrency] = useState<Currency>(position.stock.currency || 'CHF');

    // Helper to fix floating point dust
    const isGBX = selectedCurrency === 'GBp';
    const fixPrice = (num: number) => parseFloat(num.toFixed(isGBX ? 4 : 2));
    const fixFx = (num: number) => parseFloat(num.toFixed(6));
    const fixShares = (num: number) => parseFloat(num.toFixed(6));

    // Live FX Rate for current selected currency (in CHF per foreign unit)
    const liveFxRate = useMemo(() => {
        if (selectedCurrency === 'CHF') return 1.0;
        const currKey = isGBX ? 'GBP' : selectedCurrency;
        return convertToCHF(1, currKey, rates);
    }, [selectedCurrency, isGBX, rates]);

    // Fallback for "Manual Overrides" if user deletes all purchases but wants to set totals manually
    const [manualShares, setManualShares] = useState(position.shares.toString());
    const [manualPrice, setManualPrice] = useState('0'); // Initialized in useEffect
    const [manualFx, setManualFx] = useState(position.averageEntryFxRate?.toString() || '1.0');
    const [manualDate, setManualDate] = useState(position.buyDate ? new Date(position.buyDate).toISOString().split('T')[0] : '');

    const brokerSuggestions = useMemo(() => {
        const set = new Set<string>([
            'Swissquote',
            'Saxo Bank',
            'Interactive Brokers',
            'UBS',
            'PostFinance',
            'Raiffeisen',
            'Zürcher Kantonalbank',
            'Trade Republic',
            'DEGIRO'
        ]);
        (positions || []).forEach(p => { if (p.broker) set.add(p.broker); });
        (fixedDeposits || []).forEach(fd => { if (fd.bankName) set.add(fd.bankName); });
        return Array.from(set);
    }, [positions, fixedDeposits]);

    // Scale Helpers: Storage (Pence) <-> UI (Pounds)
    const toUI = (storageVal: number) => isGBX ? storageVal / 100 : storageVal;
    const toStorage = (uiVal: number) => isGBX ? uiVal * 100 : uiVal;

    // Reset state when modal opens
    useEffect(() => {
        if (isOpen) {
            const initialCurrency = position.stock.currency || 'CHF';
            setStockName(position.stock.name);
            setBroker(position.broker || "");
            setSelectedCurrency(initialCurrency);
            setInputInCHF(false);

            if (position.purchases && position.purchases.length > 0) {
                // Sanitize loaded purchases
                const sanitizedPurchases = position.purchases.map(p => ({
                    ...p,
                    shares: fixShares(p.shares),
                    price: fixPrice(toUI(p.price)),
                    fxRate: initialCurrency === 'CHF' ? 1.0 : fixFx(p.fxRate || 1.0)
                }));
                setPurchases(sanitizedPurchases);
            } else {
                // If no history exists, create one initial entry from current totals
                const initialEntry: Purchase = {
                    id: crypto.randomUUID(),
                    date: position.buyDate ? new Date(position.buyDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
                    shares: fixShares(position.shares),
                    price: fixPrice(toUI(position.buyPriceAvg)),
                    fxRate: initialCurrency === 'CHF' ? 1.0 : fixFx(position.averageEntryFxRate || 1.0)
                };
                setPurchases([initialEntry]);
            }

            // Sync manuals
            setManualShares(fixShares(position.shares).toString());
            setManualPrice(fixPrice(toUI(position.buyPriceAvg)).toString());
            setManualFx(initialCurrency === 'CHF' ? '1.0' : fixFx(position.averageEntryFxRate || 1.0).toString());
            setManualDate(position.buyDate ? new Date(position.buyDate).toISOString().split('T')[0] : '');
        }
    }, [isOpen, position]);

    // Auto-resize stock name textarea
    useEffect(() => {
        if (inputRef.current) {
            inputRef.current.style.height = '0px';
            const scrollHeight = inputRef.current.scrollHeight;
            inputRef.current.style.height = `${scrollHeight}px`;
            inputRef.current.style.overflow = 'hidden';
        }
    }, [stockName, isOpen]);

    // Handle currency changes
    const handleCurrencyChange = (newCurr: Currency) => {
        setSelectedCurrency(newCurr);
        // Persist immediately to context
        updateStock(position.stock.id, { currency: newCurr });

        if (newCurr === 'CHF') {
            setInputInCHF(false);
            // CHF has always fxRate = 1.0
            setPurchases(prev => prev.map(p => ({
                ...p,
                fxRate: 1.0
            })));
        } else {
            // For foreign currency: if fxRate was 1.0 or missing, auto-fill with current live rate
            const targetRate = convertToCHF(1, newCurr === 'GBp' ? 'GBP' : newCurr, rates);
            setPurchases(prev => prev.map(p => {
                if (!p.fxRate || p.fxRate === 1.0) {
                    return { ...p, fxRate: fixFx(targetRate) };
                }
                return p;
            }));
        }
    };

    // Derived Totals from Purchases
    const calculatedTotals = (purchases || []).reduce((acc, p) => {
        const effectiveFx = selectedCurrency === 'CHF' ? 1.0 : (p.fxRate || 1.0);
        acc.shares += p.shares;
        acc.totalNativeCost += p.shares * p.price;
        acc.totalCHFCost += p.shares * p.price * effectiveFx;
        if (!acc.earliestDate || new Date(p.date) < new Date(acc.earliestDate)) {
            acc.earliestDate = p.date;
        }
        return acc;
    }, { shares: 0, totalNativeCost: 0, totalCHFCost: 0, earliestDate: '' });

    const calculatedAvgPriceUI = calculatedTotals.shares > 0 ? calculatedTotals.totalNativeCost / calculatedTotals.shares : 0;
    const calculatedAvgFx = selectedCurrency === 'CHF'
        ? 1.0
        : (calculatedTotals.totalNativeCost > 0 ? calculatedTotals.totalCHFCost / calculatedTotals.totalNativeCost : 1.0);

    const handleAddPurchase = () => {
        const newPurchase: Purchase = {
            id: crypto.randomUUID(),
            date: new Date().toISOString().split('T')[0],
            shares: 0,
            price: 0,
            fxRate: selectedCurrency === 'CHF' ? 1.0 : fixFx(liveFxRate)
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

        // Update Stock Name and Currency
        updateStock(position.stock.id, {
            name: stockName.trim(),
            currency: selectedCurrency
        });

        // If we have purchases, use the calculated values
        if (purchases.length > 0) {
            const purchasesToSave = purchases.map(p => ({
                ...p,
                price: toStorage(p.price),
                fxRate: selectedCurrency === 'CHF' ? 1.0 : (p.fxRate || 1.0)
            }));

            const finalAvgPrice = toStorage(calculatedAvgPriceUI);
            const finalAvgFx = selectedCurrency === 'CHF' ? 1.0 : calculatedAvgFx;

            onUpdate(
                position.id,
                calculatedTotals.shares,
                finalAvgPrice,
                calculatedTotals.earliestDate,
                finalAvgFx,
                purchasesToSave,
                broker.trim()
            );
        } else {
            // Manual fallback
            const newShares = parseFloat(manualShares);
            const newPriceUI = parseFloat(manualPrice);
            const newFx = selectedCurrency === 'CHF' ? 1.0 : parseFloat(manualFx);
            const isoDate = manualDate ? new Date(manualDate).toISOString() : undefined;

            onUpdate(position.id, newShares, toStorage(newPriceUI), isoDate, newFx, [], broker.trim());
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
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4 pointer-events-none overflow-hidden">
            <div className="relative pointer-events-auto w-full max-w-4xl px-2 py-4 md:px-4">
                <div className="absolute inset-0 bg-black/50 backdrop-blur-sm rounded-xl"></div>
                <div className="bg-card border border-border rounded-xl shadow-xl w-full flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200 relative z-10 max-h-[calc(100vh-48px)]">
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
                        <div className="p-4 bg-muted/30 border-b border-border grid grid-cols-3 items-center gap-4">
                            {/* Left Column: Logo & Name */}
                            <div className="flex items-center gap-3 overflow-hidden justify-start">
                                <Link
                                    to={`/dividends/edit/${position.stock.id}?from=portfolio`}
                                    className="cursor-pointer hover:opacity-80 transition-opacity block"
                                    onClick={(e) => {
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
                                            className="w-full text-base font-semibold bg-transparent border border-transparent hover:border-border focus:border-primary focus:ring-1 focus:ring-primary rounded px-1 -ml-1 transition-all outline-none text-foreground placeholder:text-muted-foreground resize-none min-h-[28px] leading-relaxed whitespace-pre-wrap"
                                            value={stockName}
                                            onChange={(e) => setStockName(e.target.value)}
                                            rows={1}
                                            placeholder="Name der Position"
                                        />
                                        <Pencil
                                            className="size-3.5 text-muted-foreground opacity-50 group-hover/edit:opacity-100 transition-opacity shrink-0 cursor-pointer hover:text-primary mt-1.5"
                                            onClick={() => inputRef.current?.focus()}
                                        />
                                    </div>
                                    <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5 flex-wrap">
                                        <span className="font-semibold text-foreground/90">{position.stock.symbol}</span>
                                        <span>•</span>
                                        <span>Aktuell: {position.stock.currentPrice.toLocaleString('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                        <select
                                            value={selectedCurrency}
                                            onChange={(e) => handleCurrencyChange(e.target.value as Currency)}
                                            className="bg-secondary/80 hover:bg-secondary text-foreground font-bold text-xs rounded px-2 py-0.5 border border-border cursor-pointer transition-colors outline-none"
                                            title="Währung dieser Position ändern"
                                        >
                                            <option value="CHF">CHF</option>
                                            <option value="EUR">EUR</option>
                                            <option value="USD">USD</option>
                                            <option value="GBP">GBP</option>
                                            <option value="GBp">GBp</option>
                                        </select>
                                    </div>
                                </div>
                            </div>

                            {/* Middle Column: FX Info */}
                            <div className="flex justify-center">
                                {selectedCurrency !== 'CHF' ? (
                                    <div className="px-4 py-2 bg-background/50 rounded-lg border border-border/50 flex flex-col items-center justify-center min-w-[120px]">
                                        <div className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">LIVE WECHSELKURS</div>
                                        <div className="font-mono font-medium text-sm text-primary">
                                            1 {isGBX ? 'GBP' : selectedCurrency} = {liveFxRate.toFixed(4)} CHF
                                        </div>
                                    </div>
                                ) : (
                                    <div className="px-4 py-2 bg-background/50 rounded-lg border border-border/50 flex flex-col items-center justify-center min-w-[120px]">
                                        <div className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">WÄHRUNG</div>
                                        <div className="font-mono font-medium text-sm text-foreground">
                                            CHF (Heimatwährung)
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
                                        Ø {calculatedAvgPriceUI.toLocaleString('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {isGBX ? 'GBP' : selectedCurrency}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Bank / Broker Row */}
                        <div className="px-6 py-3 bg-muted/20 border-b border-border/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div className="flex items-center gap-2.5 flex-1 max-w-md">
                                <div className="p-1.5 rounded-lg bg-primary/10 text-primary shrink-0">
                                    <Landmark className="size-4" />
                                </div>
                                <label className="text-xs font-semibold text-foreground whitespace-nowrap">Bank / Broker:</label>
                                <div className="relative flex-1">
                                    <input
                                        type="text"
                                        list="broker-list-options"
                                        value={broker}
                                        onChange={(e) => setBroker(e.target.value)}
                                        placeholder="z.B. Swissquote, Saxo, UBS, PostFinance..."
                                        className="w-full px-3 py-1.5 text-xs rounded-lg bg-background border border-input focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground placeholder:text-muted-foreground/50 transition-all font-medium"
                                    />
                                    <datalist id="broker-list-options">
                                        {brokerSuggestions.map((b) => (
                                            <option key={b} value={b} />
                                        ))}
                                    </datalist>
                                </div>
                            </div>
                            {broker && (
                                <div className="text-xs text-muted-foreground hidden sm:flex items-center gap-1.5">
                                    <span>Depot bei:</span>
                                    <span className="font-semibold text-foreground px-2 py-0.5 rounded bg-muted/50 border border-border/50">{broker}</span>
                                </div>
                            )}
                        </div>

                        {/* Purchases List */}
                        <div className="p-6 space-y-4 flex-1">
                            {/* Input Mode Toggle (CHF vs Native) */}
                            <div className="flex items-center justify-between mb-4 px-1">
                                <h3 className="text-sm font-semibold">Käufe</h3>
                                {selectedCurrency !== 'CHF' && (
                                    <div className="flex items-center gap-2">
                                        <label className="text-xs text-muted-foreground cursor-pointer select-none flex items-center gap-2">
                                            <input
                                                type="checkbox"
                                                checked={inputInCHF}
                                                onChange={(e) => setInputInCHF(e.target.checked)}
                                                className="rounded border-gray-300 text-primary focus:ring-primary shadow-sm"
                                            />
                                            Kaufpreise in CHF eingeben
                                        </label>
                                    </div>
                                )}
                            </div>

                            {/* Header Row */}
                            <div className="grid grid-cols-12 gap-3 px-3 py-2 text-[10px] font-bold text-muted-foreground uppercase bg-muted/50 rounded-lg mb-2">
                                <div className="col-span-3">Datum</div>
                                <div className="col-span-2 text-center">Stück</div>
                                <div className="col-span-3 text-center">
                                    Kaufpreis ({inputInCHF ? 'CHF' : (isGBX ? 'GBP' : selectedCurrency)})
                                </div>
                                <div className="col-span-3 text-center">
                                    <div>Wechselkurs</div>
                                    <div className="font-normal normal-case text-[9px] opacity-70">
                                        {selectedCurrency === 'CHF' ? '1.0 (CHF)' : `CHF pro 1 ${isGBX ? 'GBP' : selectedCurrency}`}
                                    </div>
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
                                                value={inputInCHF && selectedCurrency !== 'CHF' ? purchase.price * (purchase.fxRate || 1) : purchase.price}
                                                onChange={(val) => {
                                                    const numVal = parseFloat(val) || 0;
                                                    if (inputInCHF && selectedCurrency !== 'CHF') {
                                                        const rate = purchase.fxRate || liveFxRate || 1;
                                                        handleUpdatePurchase(purchase.id, 'price', numVal / rate);
                                                    } else {
                                                        handleUpdatePurchase(purchase.id, 'price', numVal);
                                                    }
                                                }}
                                                maxDecimals={inputInCHF ? 2 : (isGBX ? 4 : 2)}
                                                onFocus={(e) => e.target.select()}
                                                className={cn(
                                                    "w-full h-8 px-2 text-sm border border-border rounded bg-background focus:ring-1 focus:ring-primary text-center",
                                                    inputInCHF && selectedCurrency !== 'CHF' && "bg-blue-50/50 border-blue-200 dark:border-blue-800 focus:bg-background"
                                                )}
                                            />
                                        </div>
                                        {/* FX Rate */}
                                        <div className="col-span-3">
                                            <DecimalInput
                                                value={selectedCurrency === 'CHF' ? 1.0 : purchase.fxRate}
                                                onChange={(val) => handleUpdatePurchase(purchase.id, 'fxRate', parseFloat(val) || 0)}
                                                disabled={selectedCurrency === 'CHF'}
                                                maxDecimals={6}
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
