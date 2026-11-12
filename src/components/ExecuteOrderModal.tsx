import React, { useState, useEffect, useMemo } from 'react';
import { X, Check, Rocket, Calendar, ShieldCheck, Building2 } from 'lucide-react';
import { Logo } from './Logo';
import { useExchangeRates } from '../context/ExchangeRateContext';
import type { OrderBookEntry, ExecuteOrderParams } from '../types';

interface ExecuteOrderModalProps {
    isOpen: boolean;
    onClose: () => void;
    order: (OrderBookEntry & { currentPrice?: number; stock?: any }) | null;
    onExecute: (orderId: string, params: ExecuteOrderParams) => void;
}

export function ExecuteOrderModal({ isOpen, onClose, order, onExecute }: ExecuteOrderModalProps) {
    const { rates } = useExchangeRates();

    const isBuy = order?.mode !== 'sell';
    const currency = order?.currency || 'CHF';
    const isForeign = currency !== 'CHF';

    // Form states
    const [shares, setShares] = useState<number>(order?.shares || 1);
    const [executedPrice, setExecutedPrice] = useState<number>(order?.limitPrice || 0);
    const [executedDate, setExecutedDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
    const [broker, setBroker] = useState<string>('Swissquote');

    // FX & Fees
    const [fxRate, setFxRate] = useState<number>(1);
    const [feesCHF, setFeesCHF] = useState<number>(order?.totalFeesCHF || 0);
    const [totalAmountCHF, setTotalAmountCHF] = useState<number>(order?.totalInvestOrProceedsCHF || 0);

    // Initialize/Reset when order changes
    useEffect(() => {
        if (!order) return;

        const initialShares = order.shares || 1;
        // Pre-fill with dayLow or currentPrice if lower for buy, or limitPrice
        const initialPrice = order.currentPrice && order.currentPrice > 0 ? order.currentPrice : order.limitPrice;
        setShares(initialShares);
        setExecutedPrice(initialPrice);
        setExecutedDate(new Date().toISOString().split('T')[0]);
        setBroker('Swissquote');

        const initialFees = order.totalFeesCHF || 0;
        setFeesCHF(initialFees);

        if (order.currency && order.currency !== 'CHF') {
            // Determine initial FX rate (CHF per 1 foreign currency unit)
            // If rates from context are CHF -> Foreign (e.g. 1 CHF = 1.12 USD): rate is 1 / rates[curr]
            let defaultFx = 1;
            if (order.volumeNative > 0 && order.volumeCHF > 0) {
                defaultFx = order.volumeCHF / order.volumeNative;
            } else if (rates && (rates as any)[order.currency]) {
                const r = (rates as any)[order.currency];
                defaultFx = r > 0 ? 1 / r : 1;
            }
            // Round to 4 decimals (e.g. 0.8505)
            const roundedFx = parseFloat(defaultFx.toFixed(4));
            setFxRate(roundedFx);

            const volNative = initialShares * initialPrice;
            const totalCHF = isBuy ? (volNative * roundedFx + initialFees) : (volNative * roundedFx - initialFees);
            setTotalAmountCHF(parseFloat(totalCHF.toFixed(2)));
        } else {
            setFxRate(1);
            const volCHF = initialShares * initialPrice;
            const totalCHF = isBuy ? (volCHF + initialFees) : (volCHF - initialFees);
            setTotalAmountCHF(parseFloat(totalCHF.toFixed(2)));
        }
    }, [order, rates, isBuy]);

    // Derived calculations
    const volumeNative = useMemo(() => {
        return Math.max(0, shares * executedPrice);
    }, [shares, executedPrice]);

    // Recalculate when executedPrice or shares change
    const handlePriceOrSharesChange = (newPrice: number, newShares: number) => {
        setExecutedPrice(newPrice);
        setShares(newShares);

        const newVolNative = newShares * newPrice;
        if (isForeign) {
            const newTotalCHF = isBuy
                ? (newVolNative * fxRate + feesCHF)
                : (newVolNative * fxRate - feesCHF);
            setTotalAmountCHF(parseFloat(newTotalCHF.toFixed(2)));
        } else {
            const newTotalCHF = isBuy
                ? (newVolNative + feesCHF)
                : (newVolNative - feesCHF);
            setTotalAmountCHF(parseFloat(newTotalCHF.toFixed(2)));
        }
    };

    // When user types totalAmountCHF directly (e.g. from Swissquote statement: 3889.96)
    const handleTotalAmountCHFChange = (val: number) => {
        setTotalAmountCHF(val);
        if (isForeign && volumeNative > 0) {
            // In Swissquote: totalAmountCHF = totalUSD * fxRate
            // With fxRate = totalAmountCHF / totalUSD
            // If user enters totalAmountCHF, we adjust fxRate or keep fxRate and adjust effectiveBuyPrice
            if (fxRate > 0) {
                // Keep fxRate, let effectiveBuyPrice adjust
            }
        }
    };

    // When user changes fxRate (e.g. 0.8505)
    const handleFxRateChange = (newFx: number) => {
        setFxRate(newFx);
        if (isForeign) {
            const newTotalCHF = isBuy
                ? (volumeNative * newFx + feesCHF)
                : (volumeNative * newFx - feesCHF);
            setTotalAmountCHF(parseFloat(newTotalCHF.toFixed(2)));
        }
    };

    // When user changes fees
    const handleFeesChange = (newFees: number) => {
        setFeesCHF(newFees);
        const baseCHF = isForeign ? (volumeNative * fxRate) : volumeNative;
        const newTotalCHF = isBuy ? (baseCHF + newFees) : (baseCHF - newFees);
        setTotalAmountCHF(parseFloat(newTotalCHF.toFixed(2)));
    };

    // Calculate effective buy price all-in (inkl. Spesen) in foreign currency
    // Swissquote: totalUSD = totalAmountCHF / fxRate; effectiveBuyPrice = totalUSD / shares
    const effectiveBuyPrice = useMemo(() => {
        if (shares <= 0) return executedPrice;
        if (!isBuy) return executedPrice;
        if (isForeign) {
            if (fxRate > 0 && totalAmountCHF > 0) {
                const totalUSD = totalAmountCHF / fxRate;
                return totalUSD / shares;
            }
            if (volumeNative > 0 && feesCHF > 0) {
                const feeRatio = feesCHF / (volumeNative * fxRate);
                return executedPrice * (1 + feeRatio);
            }
            return executedPrice;
        } else {
            return totalAmountCHF / shares;
        }
    }, [shares, executedPrice, isBuy, isForeign, fxRate, totalAmountCHF, feesCHF, volumeNative]);

    if (!isOpen || !order) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onExecute(order.id, {
            executedPrice: Number(executedPrice),
            shares: Number(shares),
            executedDate,
            totalAmountCHF: Number(totalAmountCHF),
            feesCHF: Number(feesCHF),
            fxRate: isForeign ? Number(fxRate) : 1,
            effectiveBuyPrice: Number(effectiveBuyPrice),
            broker
        });
        onClose();
    };

    const fmtMoney = (val: number, curr: string) => {
        if (isNaN(val)) return '—';
        return `${new Intl.NumberFormat('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val)} ${curr}`;
    };

    return (
        <div
            className="fixed inset-0 bg-black/75 backdrop-blur-xs z-60 flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-150"
            onClick={onClose}
        >
            <div
                className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden flex flex-col text-foreground animate-in zoom-in-95 duration-150"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-muted/30">
                    <div className="flex items-center gap-3">
                        <div className="size-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                            <Rocket className="size-5" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h2 className="text-base sm:text-lg font-bold">Auftrag ins Depot verbuchen</h2>
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${
                                    isBuy ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40' : 'bg-rose-500/20 text-rose-400 border-rose-500/40'
                                }`}>
                                    {isBuy ? 'KAUF' : 'VERKAUF'}
                                </span>
                            </div>
                            <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
                                <Logo
                                    url={order.stock?.logoUrl}
                                    alt={order.stockName || order.stockSymbol}
                                    fallback={order.stockSymbol?.slice(0, 2) || '  '}
                                    size="size-4"
                                    className="shrink-0 rounded"
                                />
                                <span className="font-semibold text-foreground">{order.stockName}</span>
                                <span>({order.stockSymbol})</span>
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                    >
                        <X className="size-5" />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs sm:text-sm">
                    {/* Limit info banner */}
                    <div className="flex items-center justify-between p-2.5 rounded-lg bg-muted/40 border border-border/70 text-xs">
                        <span className="text-muted-foreground">Ursprüngliches Limit:</span>
                        <span className="font-mono font-bold text-foreground">
                            {fmtMoney(order.limitPrice, currency)}
                        </span>
                    </div>

                    {/* Inputs: Price & Shares */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-semibold text-muted-foreground mb-1">
                                Tatsächlicher Ausführungspreis ({currency}) *
                            </label>
                            <div className="relative">
                                <input
                                    type="number"
                                    step="any"
                                    min="0.0001"
                                    required
                                    value={executedPrice || ''}
                                    onChange={e => handlePriceOrSharesChange(parseFloat(e.target.value) || 0, shares)}
                                    className="w-full px-3 py-2 rounded-lg bg-background border border-amber-500/50 focus:border-primary focus:ring-1 focus:ring-primary text-foreground font-mono font-bold text-base outline-hidden"
                                    placeholder="z.B. 151.00"
                                />
                                <span className="absolute right-3 top-2.5 text-xs font-bold text-muted-foreground">
                                    {currency}
                                </span>
                            </div>
                            <span className="text-[11px] text-amber-500 dark:text-amber-400 mt-1 block">
                                Börsenkurs bei Ausführung (z. B. tiefer als Limit)
                            </span>
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-muted-foreground mb-1">
                                Anzahl Stücke *
                            </label>
                            <input
                                type="number"
                                step="any"
                                min="0.0001"
                                required
                                value={shares || ''}
                                onChange={e => handlePriceOrSharesChange(executedPrice, parseFloat(e.target.value) || 0)}
                                className="w-full px-3 py-2 rounded-lg bg-background border border-border focus:border-primary focus:ring-1 focus:ring-primary text-foreground font-mono font-bold text-base outline-hidden"
                                placeholder="z.B. 30"
                            />
                            <span className="text-[11px] text-muted-foreground mt-1 block">
                                Reiner Kurswert: <strong className="text-foreground">{fmtMoney(volumeNative, currency)}</strong>
                            </span>
                        </div>
                    </div>

                    {/* Currency / FX & Total CHF Section */}
                    {isForeign ? (
                        <div className="p-3.5 rounded-xl bg-muted/30 border border-border/80 space-y-3">
                            <div className="flex items-center justify-between text-xs font-semibold text-primary">
                                <span>Abrechnung & Währungsumrechnung ({currency} → CHF)</span>
                                <span className="text-[11px] text-muted-foreground font-normal">Exakt wie auf Bankbeleg</span>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <div>
                                    <label className="block text-[11px] font-semibold text-muted-foreground mb-1">
                                        Devisenkurs ({currency}/CHF)
                                    </label>
                                    <input
                                        type="number"
                                        step="any"
                                        value={fxRate || ''}
                                        onChange={e => handleFxRateChange(parseFloat(e.target.value) || 0)}
                                        className="w-full px-2.5 py-1.5 rounded-lg bg-background border border-border text-foreground font-mono font-semibold text-xs outline-hidden"
                                        placeholder="z.B. 0.8505"
                                    />
                                </div>

                                <div>
                                    <label className="block text-[11px] font-semibold text-muted-foreground mb-1">
                                        Gebühren (CHF)
                                    </label>
                                    <input
                                        type="number"
                                        step="any"
                                        value={feesCHF || ''}
                                        onChange={e => handleFeesChange(parseFloat(e.target.value) || 0)}
                                        className="w-full px-2.5 py-1.5 rounded-lg bg-background border border-border text-foreground font-mono font-semibold text-xs outline-hidden"
                                        placeholder="z.B. 47.37"
                                    />
                                </div>

                                <div>
                                    <label className="block text-[11px] font-semibold text-emerald-500 mb-1">
                                        Total Belastung (CHF) *
                                    </label>
                                    <input
                                        type="number"
                                        step="any"
                                        required
                                        value={totalAmountCHF || ''}
                                        onChange={e => handleTotalAmountCHFChange(parseFloat(e.target.value) || 0)}
                                        className="w-full px-2.5 py-1.5 rounded-lg bg-background border border-emerald-500/50 focus:border-emerald-500 text-foreground font-mono font-bold text-xs outline-hidden"
                                        placeholder="z.B. 3889.96"
                                    />
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-xl bg-muted/30 border border-border/80">
                            <div>
                                <label className="block text-xs font-semibold text-muted-foreground mb-1">
                                    Gebühren (CHF)
                                </label>
                                <input
                                    type="number"
                                    step="any"
                                    value={feesCHF || ''}
                                    onChange={e => handleFeesChange(parseFloat(e.target.value) || 0)}
                                    className="w-full px-3 py-2 rounded-lg bg-background border border-border text-foreground font-mono font-semibold text-xs outline-hidden"
                                    placeholder="z.B. 25.00"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-emerald-500 mb-1">
                                    Total Belastung (CHF)
                                </label>
                                <input
                                    type="number"
                                    step="any"
                                    required
                                    value={totalAmountCHF || ''}
                                    onChange={e => handleTotalAmountCHFChange(parseFloat(e.target.value) || 0)}
                                    className="w-full px-3 py-2 rounded-lg bg-background border border-emerald-500/50 text-foreground font-mono font-bold text-xs outline-hidden"
                                    placeholder="z.B. 2525.00"
                                />
                            </div>
                        </div>
                    )}

                    {/* Date & Broker */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-semibold text-muted-foreground mb-1 flex items-center gap-1.5">
                                <Calendar className="size-3.5 text-muted-foreground" />
                                Ausführungsdatum *
                            </label>
                            <input
                                type="date"
                                required
                                value={executedDate}
                                onChange={e => setExecutedDate(e.target.value)}
                                className="w-full px-3 py-2 rounded-lg bg-background border border-border text-foreground text-xs outline-hidden"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-muted-foreground mb-1 flex items-center gap-1.5">
                                <Building2 className="size-3.5 text-muted-foreground" />
                                Broker / Bank
                            </label>
                            <input
                                type="text"
                                value={broker}
                                onChange={e => setBroker(e.target.value)}
                                className="w-full px-3 py-2 rounded-lg bg-background border border-border text-foreground text-xs outline-hidden"
                                placeholder="z.B. Swissquote"
                            />
                        </div>
                    </div>

                    {/* Live Preview / Swissquote Style Summary Box */}
                    <div className="p-3.5 rounded-xl bg-primary/10 border border-primary/30 space-y-2">
                        <div className="text-xs font-bold text-primary flex items-center gap-1.5">
                            <ShieldCheck className="size-4" />
                            <span>Vorschau der Depot-Buchung</span>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1 text-xs">
                            <div>
                                <span className="text-[11px] text-muted-foreground block">Kaufkurs (All-in Spesen):</span>
                                <span className="font-mono font-bold text-foreground">
                                    {fmtMoney(effectiveBuyPrice, currency)}
                                </span>
                            </div>
                            {isForeign && (
                                <div>
                                    <span className="text-[11px] text-muted-foreground block">Devisenkurs:</span>
                                    <span className="font-mono font-bold text-foreground">
                                        {fxRate.toFixed(4)}
                                    </span>
                                </div>
                            )}
                            <div>
                                <span className="text-[11px] text-muted-foreground block">Effektive Depot-Kosten:</span>
                                <span className="font-mono font-bold text-emerald-400">
                                    {fmtMoney(totalAmountCHF, 'CHF')}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Footer Actions */}
                    <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-border">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 rounded-xl bg-muted hover:bg-muted/80 text-foreground font-semibold text-xs transition-colors"
                        >
                            Abbrechen
                        </button>
                        <button
                            type="submit"
                            className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md transition-all active:scale-95"
                        >
                            <Check className="size-4" />
                            <span>Im Depot verbuchen</span>
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
