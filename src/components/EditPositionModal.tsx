import { useState } from 'react';
import { X, TrendingDown, TrendingUp, Edit } from 'lucide-react';
import type { Stock } from '../types';
import { cn } from '../utils';
import { useCurrencyFormatter } from '../utils/currency';
import { TransactionSuccessDialog } from './TransactionSuccessDialog';

interface EditPositionModalProps {
    isOpen: boolean;
    onClose: () => void;
    position: {
        id: string;
        stock: Stock;
        shares: number;
        buyPriceAvg: number;
    };
    onUpdate: (id: string, newShares: number, newAvgPrice?: number, newBuyDate?: string) => void;
    onDelete: (id: string) => void;
}

export function EditPositionModal({ isOpen, onClose, position, onUpdate, onDelete }: EditPositionModalProps) {
    const [tab, setTab] = useState<'sell' | 'buy' | 'correct'>('correct');
    const { formatCurrency, convertToCHF } = useCurrencyFormatter();

    // Sell state
    const [sellShares, setSellShares] = useState('');

    // Buy state
    const [buyShares, setBuyShares] = useState('');
    const [buyPrice, setBuyPrice] = useState(position.stock.currentPrice.toFixed(2));

    // Correction state
    const [correctShares, setCorrectShares] = useState(position.shares.toString());
    // Correction state
    const [correctShares, setCorrectShares] = useState(position.shares.toString());
    const [correctPrice, setCorrectPrice] = useState(position.buyPriceAvg.toString());
    const [correctBuyDate, setCorrectBuyDate] = useState(position.buyDate ? new Date(position.buyDate).toISOString().split('T')[0] : '');

    // Transaction success state
    const [showSuccessDialog, setShowSuccessDialog] = useState(false);
    const [completedTransaction, setCompletedTransaction] = useState<any>(null);

    // Helper: Format shares (no decimals for whole numbers)
    const formatShares = (shares: number) => {
        return shares % 1 === 0 ? shares.toString() : shares.toFixed(2);
    };

    if (!isOpen) return null;

    const handleSell = (e: React.FormEvent) => {
        e.preventDefault();
        const sharesToSell = parseFloat(sellShares);
        const newShares = position.shares - sharesToSell;
        const sellValue = sharesToSell * position.stock.currentPrice;
        const profitLoss = sellValue - (sharesToSell * position.buyPriceAvg);

        // Calculate CHF equivalent for record
        const chfValue = convertToCHF(sellValue, position.stock.currency);

        // Store transaction data
        setCompletedTransaction({
            type: 'sell',
            stock: position.stock,
            shares: sharesToSell,
            pricePerShare: position.stock.currentPrice,
            totalValue: sellValue,
            chfEquivalent: chfValue,
            avgBuyPrice: position.buyPriceAvg,
            profitLoss: profitLoss,
        });

        if (newShares <= 0) {
            onDelete(position.id);
        } else {
            onUpdate(position.id, newShares);
        }

        // Don't close yet - show success dialog first
        setShowSuccessDialog(true);
    };

    const handleBuy = (e: React.FormEvent) => {
        e.preventDefault();
        const sharesToBuy = parseFloat(buyShares);
        const pricePerShare = parseFloat(buyPrice);

        // Calculate new average buy price
        const currentValue = position.shares * position.buyPriceAvg;
        const addedValue = sharesToBuy * pricePerShare;
        const newTotalShares = position.shares + sharesToBuy;
        const newAvgPrice = (currentValue + addedValue) / newTotalShares;

        // Calculate CHF equivalent for record
        const chfValue = convertToCHF(addedValue, position.stock.currency);

        // Store transaction data
        setCompletedTransaction({
            type: 'buy',
            stock: position.stock,
            shares: sharesToBuy,
            pricePerShare: pricePerShare,
            totalValue: addedValue,
            chfEquivalent: chfValue,
            newAvgPrice: newAvgPrice,
        });

        onUpdate(position.id, newTotalShares, newAvgPrice);

        // Don't close yet - show success dialog first
        setShowSuccessDialog(true);
    };

    const handleCorrection = (e: React.FormEvent) => {
        e.preventDefault();
        const newShares = parseFloat(correctShares);
        const newPrice = parseFloat(correctPrice);

        // Ensure date is valid ISO string if provided
        const isoDate = correctBuyDate ? new Date(correctBuyDate).toISOString() : undefined;

        if (newShares <= 0) {
            if (confirm("Bestand auf 0 setzen löscht die Position. Fortfahren?")) {
                onDelete(position.id);
                onClose();
            }
            return;
        }

        onUpdate(position.id, newShares, newPrice, isoDate);
        onClose();
    };

    const sellValue = sellShares ? parseFloat(sellShares) * position.stock.currentPrice : 0;
    const buyValue = buyShares && buyPrice ? parseFloat(buyShares) * parseFloat(buyPrice) : 0;

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-md animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-border">
                    <h2 className="text-xl font-bold">Kauf/Verkauf</h2>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-muted rounded-lg transition-colors"
                    >
                        <X className="size-5" />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-border">
                    <button
                        onClick={() => setTab('sell')}
                        className={cn(
                            "flex-1 px-4 py-3 font-medium transition-colors flex items-center justify-center gap-2",
                            tab === 'sell'
                                ? "bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 border-b-2 border-red-600 dark:border-red-400"
                                : "text-muted-foreground hover:bg-muted"
                        )}
                    >
                        <TrendingDown className="size-4" />
                        Verkaufen
                    </button>
                    <button
                        onClick={() => setTab('buy')}
                        className={cn(
                            "flex-1 px-4 py-3 font-medium transition-colors flex items-center justify-center gap-2",
                            tab === 'buy'
                                ? "bg-green-50 dark:bg-green-950/20 text-green-600 dark:text-green-400 border-b-2 border-green-600 dark:border-green-400"
                                : "text-muted-foreground hover:bg-muted"
                        )}
                    >
                        <TrendingUp className="size-4" />
                        Kaufen
                    </button>
                    <button
                        onClick={() => setTab('correct')}
                        className={cn(
                            "flex-1 px-4 py-3 font-medium transition-colors flex items-center justify-center gap-2",
                            tab === 'correct'
                                ? "bg-blue-50 dark:bg-blue-950/20 text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400"
                                : "text-muted-foreground hover:bg-muted"
                        )}
                    >
                        <Edit className="size-4" />
                        Korrektur
                    </button>
                </div>

                {/* Content */}
                <div className="p-6">
                    {/* Stock Info */}
                    <div className="p-4 border border-border rounded-lg bg-muted/30 mb-6">
                        <div className="font-semibold">{position.stock.name}</div>
                        <div className="text-sm text-muted-foreground">{position.stock.symbol}</div>
                        <div className="mt-2 text-sm grid grid-cols-2 gap-2">
                            <div>
                                <span className="text-muted-foreground">Aktueller Kurs:</span>
                                <div className="font-medium">
                                    {position.stock.currentPrice.toLocaleString('de-DE', {
                                        style: 'currency',
                                        currency: position.stock.currency,
                                    })}
                                </div>
                            </div>
                            <div>
                                <span className="text-muted-foreground">Bestand:</span>
                                <div className="font-medium">{position.shares} Stk</div>
                            </div>
                        </div>
                    </div>

                    {/* Sell Form */}
                    {tab === 'sell' && (
                        <form onSubmit={handleSell} className="space-y-4">
                            <div className="space-y-2">
                                <label htmlFor="sellShares" className="text-sm font-medium">
                                    Anzahl verkaufen
                                </label>
                                <input
                                    id="sellShares"
                                    type="number"
                                    step="0.01"
                                    min="0.01"
                                    max={position.shares}
                                    placeholder="z.B. 4"
                                    value={sellShares}
                                    onChange={(e) => setSellShares(e.target.value)}
                                    className="w-full px-4 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-red-500/20"
                                    required
                                />
                                <div className="text-xs text-muted-foreground">
                                    Maximal {position.shares} Stück verfügbar
                                </div>
                            </div>

                            {/* Quick Sell */}
                            <div className="space-y-2">
                                <div className="text-sm font-medium text-muted-foreground">Schnellauswahl</div>
                                <div className="grid grid-cols-4 gap-2">
                                    {[25, 50, 75, 100].map((percent) => {
                                        const amount = (position.shares * percent) / 100;
                                        return (
                                            <button
                                                key={percent}
                                                type="button"
                                                onClick={() => setSellShares(amount.toFixed(2))}
                                                className="px-3 py-2 text-sm border border-border rounded-lg hover:bg-muted transition-colors"
                                            >
                                                {percent}%
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Preview */}
                            {sellShares && parseFloat(sellShares) > 0 && (
                                <div className="p-4 bg-red-50 dark:bg-red-950/20 rounded-lg border border-red-200 dark:border-red-900/30">
                                    <div className="text-sm space-y-1">
                                        <div className="flex justify-between font-medium text-red-600 dark:text-red-400">
                                            <span>Verkaufte Anteile:</span>
                                            <div className="text-right">
                                                <div>{formatShares(parseFloat(sellShares))} Stk</div>
                                                <div className="text-xs text-muted-foreground mt-0.5">
                                                    zu: {formatCurrency(position.stock.currentPrice, position.stock.currency)}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex justify-between">
                                            <span>Verbleibend:</span>
                                            <span className="font-medium">{formatShares(position.shares - parseFloat(sellShares))} Stk</span>
                                        </div>
                                        <div className="flex justify-between border-t border-red-200 dark:border-red-900/30 pt-1 mt-1">
                                            <span>Verkaufswert:</span>
                                            <span className="font-medium text-red-600 dark:text-red-400">
                                                {formatCurrency(sellValue, position.stock.currency)}
                                            </span>
                                        </div>
                                        <div className="flex justify-between text-xs text-muted-foreground">
                                            <span>Einstandspreis (Ø):</span>
                                            <span>
                                                {formatCurrency(position.buyPriceAvg, position.stock.currency)}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Actions */}
                            <div className="flex gap-3 pt-4">
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="flex-1 px-4 py-2 border border-border rounded-lg hover:bg-muted transition-colors font-medium"
                                >
                                    Abbrechen
                                </button>
                                <button
                                    type="submit"
                                    disabled={!sellShares || parseFloat(sellShares) <= 0}
                                    className={cn(
                                        "flex-1 px-4 py-2 rounded-lg font-medium transition-colors",
                                        sellShares && parseFloat(sellShares) > 0
                                            ? "bg-red-600 text-white hover:bg-red-700"
                                            : "bg-muted text-muted-foreground cursor-not-allowed"
                                    )}
                                >
                                    {parseFloat(sellShares || '0') >= position.shares ? 'Position schließen' : 'Verkaufen'}
                                </button>
                            </div>
                        </form>
                    )}

                    {/* Buy Form */}
                    {tab === 'buy' && (
                        <form onSubmit={handleBuy} className="space-y-4">
                            <div className="space-y-2">
                                <label htmlFor="buyShares" className="text-sm font-medium">
                                    Anzahl kaufen
                                </label>
                                <input
                                    id="buyShares"
                                    type="number"
                                    step="0.01"
                                    min="0.01"
                                    placeholder="z.B. 6"
                                    value={buyShares}
                                    onChange={(e) => setBuyShares(e.target.value)}
                                    className="w-full px-4 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-green-500/20"
                                    required
                                />
                            </div>

                            <div className="space-y-2">
                                <label htmlFor="buyPrice" className="text-sm font-medium">
                                    Kaufpreis pro Stück ({position.stock.currency === 'GBp' ? 'GBP' : position.stock.currency})
                                </label>
                                <div className="relative">
                                    <input
                                        id="buyPrice"
                                        type="number"
                                        step="0.01"
                                        min="0.01"
                                        placeholder={position.stock.currentPrice.toFixed(2)}
                                        value={buyPrice}
                                        onChange={(e) => setBuyPrice(e.target.value)}
                                        className="w-full px-4 py-2 pr-12 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-green-500/20"
                                        required
                                    />
                                    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm pointer-events-none">
                                        {position.stock.currency === 'GBp' ? 'GBP' : position.stock.currency}
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setBuyPrice(position.stock.currentPrice.toString())}
                                    className="text-xs text-primary hover:underline"
                                >
                                    Aktuellen Kurs übernehmen ({position.stock.currentPrice.toLocaleString('de-DE', { style: 'currency', currency: position.stock.currency === 'GBp' ? 'GBP' : position.stock.currency })})
                                </button>
                            </div>

                            {/* Preview */}
                            {buyShares && buyPrice && parseFloat(buyShares) > 0 && parseFloat(buyPrice) > 0 && (
                                <div className="p-4 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-900/30">
                                    <div className="text-sm space-y-1">
                                        <div className="flex justify-between font-medium text-green-600 dark:text-green-400">
                                            <span>Gekaufte Anteile:</span>
                                            <div className="text-right">
                                                <div>{formatShares(parseFloat(buyShares))} Stk</div>
                                                <div className="text-xs text-muted-foreground mt-0.5">
                                                    zu: {formatCurrency(parseFloat(buyPrice), position.stock.currency)}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex justify-between">
                                            <span>Neuer Bestand:</span>
                                            <span className="font-medium">{formatShares(position.shares + parseFloat(buyShares))} Stk</span>
                                        </div>
                                        <div className="flex justify-between border-t border-green-200 dark:border-green-900/30 pt-1 mt-1">
                                            <span>Kaufwert:</span>
                                            <span className="font-medium text-green-600 dark:text-green-400">
                                                {formatCurrency(buyValue, position.stock.currency)}
                                            </span>
                                        </div>
                                        <div className="flex justify-between text-xs text-muted-foreground">
                                            <span>Neuer Einstandspreis (Ø):</span>
                                            <span>
                                                {formatCurrency((position.shares * position.buyPriceAvg + buyValue) / (position.shares + parseFloat(buyShares)), position.stock.currency)}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Actions */}
                            <div className="flex gap-3 pt-4">
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="flex-1 px-4 py-2 border border-border rounded-lg hover:bg-muted transition-colors font-medium"
                                >
                                    Abbrechen
                                </button>
                                <button
                                    type="submit"
                                    disabled={!buyShares || !buyPrice || parseFloat(buyShares) <= 0 || parseFloat(buyPrice) <= 0}
                                    className={cn(
                                        "flex-1 px-4 py-2 rounded-lg font-medium transition-colors",
                                        buyShares && buyPrice && parseFloat(buyShares) > 0 && parseFloat(buyPrice) > 0
                                            ? "bg-green-600 text-white hover:bg-green-700"
                                            : "bg-muted text-muted-foreground cursor-not-allowed"
                                    )}
                                >
                                    Kaufen
                                </button>
                            </div>
                        </form>
                    )}

                    {/* Correction Form */}
                    {tab === 'correct' && (
                        <form onSubmit={handleCorrection} className="space-y-4">
                            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg text-sm text-blue-700 dark:text-blue-300 mb-4">
                                Hier kannst du Schreibfehler korrigieren. Diese Änderung wird <strong>nicht</strong> als Kauf/Verkauf in der Historie gespeichert.
                            </div>

                            <div className="space-y-2">
                                <label htmlFor="correctShares" className="text-sm font-medium">
                                    Aktueller Bestand (Stück)
                                </label>
                                <input
                                    id="correctShares"
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    placeholder="z.B. 10"
                                    value={correctShares}
                                    onChange={(e) => setCorrectShares(e.target.value)}
                                    className="w-full px-4 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                                    required
                                />
                            </div>

                            <div className="space-y-2">
                                <label htmlFor="correctPrice" className="text-sm font-medium">
                                    Durchschnittlicher Kaufpreis ({position.stock.currency === 'GBp' ? 'GBP' : position.stock.currency})
                                </label>
                                <div className="relative">
                                    <input
                                        id="correctPrice"
                                        type="number"
                                        step="0.01"
                                        min="0.01"
                                        placeholder="z.B. 150.00"
                                        value={correctPrice}
                                        onChange={(e) => setCorrectPrice(e.target.value)}
                                        className="w-full px-4 py-2 pr-12 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                                        required
                                    />
                                    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm pointer-events-none">
                                        {position.stock.currency === 'GBp' ? 'GBP' : position.stock.currency}
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label htmlFor="correctBuyDate" className="text-sm font-medium">
                                    Kaufdatum (Erster Kauf)
                                </label>
                                <input
                                    id="correctBuyDate"
                                    type="date"
                                    value={correctBuyDate}
                                    onChange={(e) => setCorrectBuyDate(e.target.value)}
                                    className="w-full px-4 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                                />
                                <p className="text-xs text-muted-foreground">
                                    Optional. Wird für die "Seit Kauf"-Ansicht im Chart verwendet.
                                </p>
                            </div>

                            <div className="flex gap-3 pt-4">
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="flex-1 px-4 py-2 border border-border rounded-lg hover:bg-muted transition-colors font-medium"
                                >
                                    Abbrechen
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors"
                                >
                                    Speichern
                                </button>
                            </div>
                        </form>
                    )}
                </div>
            </div>

            {/* Transaction Success Dialog */}
            {completedTransaction && (
                <TransactionSuccessDialog
                    isOpen={showSuccessDialog}
                    onClose={() => {
                        setShowSuccessDialog(false);
                        setCompletedTransaction(null);
                        onClose();
                    }}
                    transaction={completedTransaction}
                />
            )}
        </div>
    );
}
