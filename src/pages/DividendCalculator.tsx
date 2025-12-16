import { useState, useMemo, useEffect } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Calculator, Coins, Settings2, Plus, Check, Eye, Pencil, X } from 'lucide-react';

import { usePortfolio } from '../context/PortfolioContext';

export function DividendCalculator() {
    const { stocks, addStock, addToWatchlist, simulatorState, updateSimulatorState, positions, addPosition, updatePosition, deletePosition } = usePortfolio();

    // State for inputs (Projection) - Keeping local as these are temporary "playground" values usually
    const [initialCapital, setInitialCapital] = useState(10000);
    const [monthlyContribution, setMonthlyContribution] = useState(500);
    const [years, setYears] = useState(20);
    const [dividendYield, setDividendYield] = useState(3.5);
    const [priceAppreciation, setPriceAppreciation] = useState(4.0);
    const [reinvest, setReinvest] = useState(true);

    // Watchlist Feedback
    const [showSuccess, setShowSuccess] = useState(false);

    // Price Editing State
    const [isEditingPrice, setIsEditingPrice] = useState(false);
    const [editPriceVal, setEditPriceVal] = useState('');

    // Destructure Simulator State
    const { shares, price, dividend, selectedStockId, simName, simSymbol, fees, mode } = simulatorState;

    // Reset edit mode when stock changes
    useEffect(() => {
        setIsEditingPrice(false);
    }, [selectedStockId]);

    // Derived Logic
    const volume = shares * price;
    const calcCourtage = Math.max(volume * (fees.courtagePercent / 100), fees.courtageMin);
    const calcStamp = volume * (fees.stampDutyPercent / 100);
    const totalFees = calcCourtage + calcStamp + fees.exchangeFee;

    // Mode-specific Value
    const totalInvest = mode === 'buy' ? volume + totalFees : 0; // Cost to Buy
    const totalProceeds = mode === 'sell' ? volume - totalFees : 0; // Net payout from Sell

    const grossYield = price > 0 ? (dividend / price) * 100 : 0;
    // Net yield only makes sense for BUY (yield on cost)
    const netYield = totalInvest > 0 ? ((shares * dividend) / totalInvest) * 100 : 0;

    // Handle Stock Selection
    const handleStockSelect = (stockId: string) => {
        if (stockId === 'new') {
            updateSimulatorState({
                selectedStockId: 'new',
                simName: '',
                simSymbol: '',
                price: 0,
                dividend: 0,
                mode: 'buy' // Default to buy for new
            });
            return;
        }
        const stock = stocks.find(s => s.id === stockId);
        if (stock) {
            let newStamp = 0.075; // Default CH
            if (stock.currency !== 'CHF') newStamp = 0.15; // Foreign

            updateSimulatorState({
                selectedStockId: stock.id,
                simName: stock.name,
                simSymbol: stock.symbol,
                price: stock.currentPrice,
                dividend: stock.dividendAmount || 0,
                fees: { ...fees, stampDutyPercent: newStamp },
                // If user owns it, they might want to sell, but keep previous mode or default to buy?
                // Use existing mode
            });
        }
    };

    // Refined Execute Handler
    const onExecute = () => {
        if (mode === 'buy') {
            let targetStockId = selectedStockId;

            if (selectedStockId === 'new') {
                if (!simName || !simSymbol) return;
                targetStockId = addStock({
                    symbol: simSymbol,
                    name: simName,
                    currency: 'CHF',
                    currentPrice: price,
                    previousClose: price,
                    sector: 'Unbekannt',
                    dividendAmount: dividend,
                    dividendYield: price > 0 ? (dividend / price) * 100 : 0,
                    dividendFrequency: 'annually'
                });
                addToWatchlist(targetStockId);
                updateSimulatorState({ selectedStockId: targetStockId });
            }

            const effectivePrice = totalInvest / shares;
            addPosition({
                stockId: targetStockId,
                shares: shares,
                buyPriceAvg: effectivePrice
            });
        }
        else if (mode === 'sell') {
            const position = positions.find(p => p.stockId === selectedStockId);
            if (!position) return; // Cannot sell what you don't have

            const remainingShares = position.shares - shares;
            if (remainingShares <= 0) {
                deletePosition(position.id);
            } else {
                updatePosition(position.id, { shares: remainingShares });
            }
        }
        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 3000);
    };


    const handleAddToWatchlist = () => {
        // Legacy: "Result to Watchlist" - kept for "Watchlist" button
        if (selectedStockId && selectedStockId !== 'new') {
            addToWatchlist(selectedStockId);
            setShowSuccess(true);
            setTimeout(() => setShowSuccess(false), 3000);
        } else {
            // Create New Stock
            if (!simName || !simSymbol) return;
            const newId = addStock({
                symbol: simSymbol,
                name: simName,
                currency: 'CHF',
                currentPrice: price,
                previousClose: price,
                sector: 'Simuliert',
                dividendAmount: dividend,
                dividendYield: price > 0 ? (dividend / price) * 100 : 0,
                dividendFrequency: 'annually'
            });
            addToWatchlist(newId);
            updateSimulatorState({ selectedStockId: newId });
            setShowSuccess(true);
            setTimeout(() => setShowSuccess(false), 3000);
        }
    };

    // Calculation Logic (Projection)
    const projectionData = useMemo(() => {
        let currentCapital = initialCapital;
        let totalInvested = initialCapital;
        let totalPayouts = 0;
        const data = [];

        for (let year = 0; year <= years; year++) {
            const annualDividend = currentCapital * (dividendYield / 100);

            data.push({
                year,
                invested: Math.round(totalInvested),
                capital: Math.round(currentCapital),
                dividend: Math.round(annualDividend),
                monthlyDividend: Math.round(annualDividend / 12),
                totalPayouts: Math.round(totalPayouts)
            });

            if (year < years) {
                const yearlyContribution = monthlyContribution * 12;
                const gain = currentCapital * (priceAppreciation / 100);
                currentCapital += gain + yearlyContribution;
                if (reinvest) {
                    currentCapital += annualDividend;
                } else {
                    totalPayouts += annualDividend;
                }
                totalInvested += yearlyContribution;
            }
        }
        return data;
    }, [initialCapital, monthlyContribution, years, dividendYield, priceAppreciation, reinvest]);

    const finalYear = projectionData[projectionData.length - 1];
    const displayDividendYear = years > 0 ? projectionData[years - 1] : projectionData[0];

    return (
        <div className="p-4 md:p-6 space-y-6 animate-in fade-in duration-500">
            {/* Header */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

                {/* Integrated Investment Simulator (Left Col - Compact) */}
                <div className="lg:col-span-5 space-y-4">
                    <div className="p-5 rounded-xl bg-card border border-border shadow-sm">
                        <div className="flex items-center justify-between mb-4 text-primary">
                            <div className="flex items-center gap-2">
                                <Coins className="size-5" />
                                <h3 className="font-semibold text-lg">Simulator Kauf / Verkauf</h3>
                            </div>
                            <div className="flex items-center gap-2">
                                {/* Buy/Sell Switch */}
                                <div className="flex bg-muted rounded-lg p-1 border border-border/50">
                                    <button
                                        onClick={() => updateSimulatorState({ mode: 'buy' })}
                                        className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${mode === 'buy'
                                            ? 'bg-green-600 text-white shadow-sm'
                                            : 'text-muted-foreground hover:text-foreground'
                                            }`}
                                    >
                                        Kaufen
                                    </button>
                                    <button
                                        onClick={() => updateSimulatorState({ mode: 'sell' })}
                                        className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${mode === 'sell'
                                            ? 'bg-red-600 text-white shadow-sm'
                                            : 'text-muted-foreground hover:text-foreground'
                                            }`}
                                    >
                                        Verkaufen
                                    </button>
                                </div>
                                <button
                                    onClick={() => updateSimulatorState({ fees: { ...fees, showAdvanced: !fees.showAdvanced } })}
                                    className={`text-xs flex items-center gap-1 border px-2 py-1.5 rounded transition-colors ${fees.showAdvanced
                                        ? 'bg-primary/10 border-primary text-primary font-medium'
                                        : 'border-border text-muted-foreground hover:bg-muted hover:text-foreground'
                                        }`}
                                >
                                    <Settings2 size={12} />
                                    {fees.showAdvanced ? 'Gebühren' : 'Gebühren'}
                                </button>
                            </div>
                        </div>

                        <div className="space-y-4">
                            {/* Stock Selector */}
                            <div className="space-y-1">
                                <label className="text-xs font-medium text-muted-foreground">Aktie / Simulation</label>
                                <select
                                    className="w-full px-3 py-2 text-sm rounded-md border border-input bg-background text-foreground focus:ring-1 focus:ring-primary focus:border-primary transition-all appearance-none"
                                    onChange={(e) => handleStockSelect(e.target.value)}
                                    value={selectedStockId}
                                >
                                    <option value="" disabled className="bg-card text-muted-foreground">-- Wähle Aktie oder Neu --</option>
                                    <option value="new" className="bg-card text-foreground">+ Neue Simulation (Manuell)</option>
                                    <optgroup label="Meine Watchlist & Portfolio" className="bg-card text-foreground">
                                        {stocks.map(stock => (
                                            <option key={stock.id} value={stock.id}>
                                                {stock.name} {stock.symbol} - {stock.currency} {stock.currentPrice}
                                            </option>
                                        ))}
                                    </optgroup>
                                </select>
                            </div>

                            {/* Current Position Info & Edit */}
                            {(() => {
                                const currentPos = positions.find(p => p.stockId === selectedStockId);
                                if (!currentPos) return null;

                                // Reset edit state if stock changes (using key approach or simple effect)
                                // Since we are inside render, let's use a useEffect hook at top level, OR just handle it via the key/selection change handler.
                                // Better: Put the logic in the main body and just render here. But since I can't easily jump to main body, I will use an IIFE for render, 
                                // BUT I need the handlers. 
                                // Let's rewrite this block to just BE the UI, and I'll add the handlers/useEffect via a separate tool call to the top of the file/component.
                                return (
                                    <div className="flex items-center justify-between p-3 bg-muted/40 rounded-lg border border-border/50 text-xs mb-4">
                                        <div className="flex items-center gap-2">
                                            <span className="text-muted-foreground">Dein Bestand:</span>
                                            <span className="font-bold">{currentPos.shares} Stk.</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-muted-foreground">Ø Kauf:</span>
                                            {isEditingPrice ? (
                                                <div className="flex items-center gap-1 animate-in fade-in zoom-in-95 duration-200">
                                                    <input
                                                        type="number"
                                                        step="0.01"
                                                        className="w-20 px-2 py-0.5 text-right border rounded bg-background text-foreground text-xs focus:ring-1 focus:ring-primary no-spinner"
                                                        value={editPriceVal}
                                                        onChange={(e) => setEditPriceVal(e.target.value)}
                                                        onFocus={(e) => e.target.select()}
                                                        autoFocus
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter') {
                                                                if (editPriceVal && !isNaN(Number(editPriceVal))) {
                                                                    updatePosition(currentPos.id, { buyPriceAvg: Number(editPriceVal) });
                                                                    setIsEditingPrice(false);
                                                                }
                                                            } else if (e.key === 'Escape') {
                                                                setIsEditingPrice(false);
                                                            }
                                                        }}
                                                    />
                                                    <button
                                                        onClick={() => {
                                                            if (editPriceVal && !isNaN(Number(editPriceVal))) {
                                                                updatePosition(currentPos.id, { buyPriceAvg: Number(editPriceVal) });
                                                                setIsEditingPrice(false);
                                                            }
                                                        }}
                                                        className="p-1 hover:bg-green-500/20 text-green-600 rounded"
                                                        title="Speichern"
                                                    >
                                                        <Check size={14} />
                                                    </button>
                                                    <button
                                                        onClick={() => setIsEditingPrice(false)}
                                                        className="p-1 hover:bg-red-500/20 text-red-600 rounded"
                                                        title="Abbrechen"
                                                    >
                                                        <X size={14} />
                                                    </button>
                                                </div>
                                            ) : (
                                                <div
                                                    className="flex items-center gap-1 group cursor-pointer hover:text-primary transition-colors px-1 py-0.5 rounded hover:bg-primary/5"
                                                    onClick={() => {
                                                        setEditPriceVal(currentPos.buyPriceAvg.toString());
                                                        setIsEditingPrice(true);
                                                    }}
                                                    title="Ø Kaufkurs korrigieren"
                                                >
                                                    <span className="font-bold border-b border-dotted border-muted-foreground/50 group-hover:border-primary">
                                                        {currentPos.buyPriceAvg.toLocaleString('de-CH', { style: 'currency', currency: currentPos.stock.currency })}
                                                    </span>
                                                    <Pencil size={12} className="opacity-40 group-hover:opacity-100 transition-opacity" />
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })()}
                            {(selectedStockId === 'new' || !selectedStockId) && (
                                <div className="grid grid-cols-2 gap-3 animate-in fade-in slide-in-from-top-2">
                                    <div className="space-y-1">
                                        <label className="text-[10px] uppercase font-bold text-muted-foreground">Name</label>
                                        <input
                                            type="text"
                                            value={simName}
                                            onChange={(e) => updateSimulatorState({ simName: e.target.value })}
                                            placeholder="z.B. Nestlé"
                                            className="w-full px-2 py-1.5 text-sm rounded-md border border-input bg-background text-foreground focus:ring-1 focus:ring-primary"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] uppercase font-bold text-muted-foreground">Symbol</label>
                                        <input
                                            type="text"
                                            value={simSymbol}
                                            onChange={(e) => updateSimulatorState({ simSymbol: e.target.value })}
                                            placeholder="z.B. NESN"
                                            className="w-full px-2 py-1.5 text-sm rounded-md border border-input bg-background text-foreground focus:ring-1 focus:ring-primary"
                                        />
                                    </div>
                                </div>
                            )}

                            {/* Core Inputs - Compact Grid */}
                            <div className="grid grid-cols-3 gap-3">
                                <div className="space-y-1">
                                    <label className="text-[10px] uppercase font-bold text-muted-foreground">Anzahl</label>
                                    <input
                                        type="number"
                                        value={shares}
                                        onChange={(e) => updateSimulatorState({ shares: Number(e.target.value) })}
                                        onFocus={(e) => {
                                            const target = e.target;
                                            setTimeout(() => target.select(), 50);
                                        }}
                                        className="w-full px-2 py-1.5 text-sm rounded-md border border-input bg-background text-foreground text-right font-mono focus:ring-1 focus:ring-primary no-spinner"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] uppercase font-bold text-muted-foreground">Kurs (CHF)</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={price}
                                        onChange={(e) => updateSimulatorState({ price: Number(e.target.value) })}
                                        onFocus={(e) => {
                                            const target = e.target;
                                            setTimeout(() => target.select(), 50);
                                        }}
                                        className="w-full px-2 py-1.5 text-sm rounded-md border border-input bg-background text-foreground text-right font-mono focus:ring-1 focus:ring-primary no-spinner"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] uppercase font-bold text-muted-foreground">Div. (CHF)</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={dividend}
                                        onChange={(e) => updateSimulatorState({ dividend: Number(e.target.value) })}
                                        onFocus={(e) => {
                                            const target = e.target;
                                            setTimeout(() => target.select(), 50);
                                        }}
                                        className="w-full px-2 py-1.5 text-sm rounded-md border border-input bg-background text-foreground text-right font-mono focus:ring-1 focus:ring-primary no-spinner"
                                    />
                                </div>
                            </div>

                            {/* Advanced Fees Section */}
                            {fees.showAdvanced && (
                                <div className="bg-muted/40 p-3 rounded-md space-y-3 border border-border/50 animate-in fade-in slide-in-from-top-2">
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="space-y-1">
                                            <label className="text-[10px] uppercase text-muted-foreground">Courtage %</label>
                                            <input
                                                type="number"
                                                step="0.01"
                                                value={fees.courtagePercent}
                                                onChange={(e) => updateSimulatorState({ fees: { ...fees, courtagePercent: Number(e.target.value) } })}
                                                onFocus={(e) => {
                                                    const target = e.target;
                                                    setTimeout(() => target.select(), 50);
                                                }}
                                                className="w-full px-2 py-1 text-sm rounded border border-input bg-background text-foreground text-right no-spinner"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[10px] uppercase text-muted-foreground">Min. (CHF)</label>
                                            <input
                                                type="number"
                                                value={fees.courtageMin}
                                                onChange={(e) => updateSimulatorState({ fees: { ...fees, courtageMin: Number(e.target.value) } })}
                                                onFocus={(e) => {
                                                    const target = e.target;
                                                    setTimeout(() => target.select(), 50);
                                                }}
                                                className="w-full px-2 py-1 text-sm rounded border border-input bg-background text-foreground text-right no-spinner"
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-1">
                                        <label className="text-[10px] uppercase text-muted-foreground block">Stempelsteuer</label>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => updateSimulatorState({ fees: { ...fees, stampDutyPercent: 0.075 } })}
                                                className={`flex-1 py-1.5 text-xs border rounded transition-colors flex items-center justify-center gap-2 ${fees.stampDutyPercent === 0.075
                                                    ? 'bg-red-600 text-white border-red-700 font-bold shadow-sm'
                                                    : 'bg-background hover:bg-muted text-foreground border-input'
                                                    }`}
                                            >
                                                {/* Swiss Cross SVG */}
                                                <svg width="14" height="14" viewBox="0 0 32 32" className="shrink-0">
                                                    {fees.stampDutyPercent !== 0.075 && <rect width="32" height="32" fill="#D52B1E" rx="4" />}
                                                    <path d="M13 6h6v7h7v6h-7v7h-6v-7h-7v-6h7z" fill={fees.stampDutyPercent === 0.075 ? "currentColor" : "white"} />
                                                </svg>
                                                Schweiz 0.075%
                                            </button>
                                            <button
                                                onClick={() => updateSimulatorState({ fees: { ...fees, stampDutyPercent: 0.15 } })}
                                                className={`flex-1 py-1.5 text-xs border rounded transition-colors flex items-center justify-center gap-2 ${fees.stampDutyPercent === 0.15
                                                    ? 'bg-blue-600 text-white border-blue-700 font-bold shadow-sm'
                                                    : 'bg-background hover:bg-muted text-foreground border-input'
                                                    }`}
                                            >
                                                {/* Earth Icon (SVG) */}
                                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                                                    <circle cx="12" cy="12" r="10"></circle>
                                                    <line x1="2" y1="12" x2="22" y2="12"></line>
                                                    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
                                                </svg>
                                                Ausland 0.15%
                                            </button>
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between gap-4">
                                        <label className="text-[10px] uppercase text-muted-foreground whitespace-nowrap">Börsengebühren</label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            value={fees.exchangeFee}
                                            onChange={(e) => updateSimulatorState({ fees: { ...fees, exchangeFee: Number(e.target.value) } })}
                                            onFocus={(e) => e.target.select()}
                                            className="w-24 px-2 py-1 text-sm rounded border border-input bg-background text-foreground text-right no-spinner"
                                        />
                                    </div>

                                    <div className="pt-2 border-t border-border/50 flex justify-between items-center">
                                        <span className="text-xs text-muted-foreground">Total Gebühren</span>
                                        <span className="text-sm font-bold text-red-500">-{totalFees.toFixed(2)} CHF</span>
                                    </div>
                                </div>
                            )}

                            {/* Results Grid - Compact 2x2 */}
                            <div className="grid grid-cols-2 gap-3 pt-2">
                                {/* Total Invest / Proceeds */}
                                <div className="p-2.5 rounded-lg bg-muted/30 border border-border/50 flex flex-col justify-between">
                                    <span className="text-[10px] text-muted-foreground uppercase tracking-wide">
                                        {mode === 'buy' ? 'Investition Total' : 'Netto Erlös'}
                                    </span>
                                    <div className="flex flex-col items-end">
                                        <span className={`text-lg font-bold leading-none ${mode === 'sell' ? 'text-green-600' : 'text-foreground'}`}>
                                            {(mode === 'buy' ? totalInvest : totalProceeds).toLocaleString('de-CH', { style: 'currency', currency: 'CHF' })}
                                        </span>
                                        <span className="text-[10px] text-muted-foreground mt-0.5">
                                            {volume.toLocaleString('de-CH', { style: 'currency', currency: 'CHF', maximumFractionDigits: 0 })}
                                            {mode === 'buy' ? ' + ' : ' - '}{totalFees.toFixed(0)} Geb.
                                        </span>
                                    </div>
                                </div>

                                {/* Annual Payout */}
                                <div className="p-2.5 rounded-lg bg-muted/30 border border-border/50 flex flex-col justify-between">
                                    <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Jäh. Ausschüttung</span>
                                    <div className="flex flex-col items-end">
                                        <span className="text-lg font-bold text-foreground leading-none">
                                            {(shares * dividend).toLocaleString('de-CH', { style: 'currency', currency: 'CHF' })}
                                        </span>
                                        {mode === 'sell' && <span className="text-[10px] text-red-500 font-medium">Verlust an Div.</span>}
                                    </div>
                                </div>
                            </div>

                            {/* Net Yield Highlight with Gross (Only for Buy) */}
                            {mode === 'buy' && (
                                <div className={`p-3 rounded-lg border flex items-center justify-between gap-4 ${netYield > 0 ? 'bg-primary text-primary-foreground border-primary shadow-md' : 'bg-muted text-muted-foreground border-transparent'}`}>
                                    <div className="flex flex-col items-start">
                                        <span className="text-xs font-bold uppercase">Brutto-Rendite</span>
                                        <span className="text-2xl font-bold tracking-tight">{grossYield.toFixed(2)}%</span>
                                    </div>
                                    <div className="h-8 w-px bg-current opacity-20"></div>
                                    <div className="flex flex-col items-end">
                                        <span className="text-xs font-bold uppercase">Netto-Rendite</span>
                                        <span className="text-2xl font-bold tracking-tight">{netYield.toFixed(2)}%</span>
                                    </div>
                                </div>
                            )}

                            {/* Execute Action */}
                            <div className="flex gap-3">
                                <button
                                    onClick={onExecute}
                                    disabled={shares <= 0 || price <= 0 || (mode === 'buy' && selectedStockId === 'new' && (!simName || !simSymbol))}
                                    className={`flex-1 py-2 rounded-md text-sm font-bold flex items-center justify-center gap-2 transition-all shadow-sm ${showSuccess
                                        ? 'bg-green-600 text-white hover:bg-green-700'
                                        : mode === 'buy'
                                            ? 'bg-blue-600 text-white hover:bg-blue-700'
                                            : 'bg-red-600 text-white hover:bg-red-700'
                                        } disabled:opacity-50 disabled:cursor-not-allowed`}
                                >
                                    {showSuccess ? <Check size={16} /> : (mode === 'buy' ? <Plus size={16} /> : <Coins size={16} />)}
                                    {showSuccess
                                        ? 'Ausgeführt!'
                                        : mode === 'buy'
                                            ? 'Kaufen & Ins Depot übernehmen'
                                            : 'Verkaufen & Ausbuchen'
                                    }
                                </button>

                            </div>

                            {/* Watchlist Action (Full Width) */}
                            {mode === 'buy' && (
                                <button
                                    onClick={handleAddToWatchlist}
                                    className="w-full py-2 rounded-md font-medium text-sm border border-border bg-background hover:bg-accent text-foreground flex items-center justify-center gap-2 transition-colors"
                                >
                                    <Eye size={16} />
                                    In Watchlist speichern
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* Projection Section (Right Col) */}
                <div className="lg:col-span-7 space-y-4">
                    <div className="p-5 rounded-xl bg-card border border-border shadow-sm">
                        <div className="flex items-center gap-2 mb-4 text-primary">
                            <Calculator className="size-5" />
                            <h3 className="font-semibold text-lg">Zinseszins Projection</h3>
                        </div>

                        {/* Compact Inputs for Projection */}
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
                            <div className="space-y-1">
                                <label className="text-[10px] uppercase text-muted-foreground">Startkapital</label>
                                <input
                                    type="number"
                                    value={initialCapital}
                                    onChange={(e) => setInitialCapital(Number(e.target.value))}
                                    onFocus={(e) => e.target.select()}
                                    className="w-full px-2 py-1.5 text-sm rounded border border-input bg-background/50 text-right no-spinner"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] uppercase text-muted-foreground">Sparrate / Mt.</label>
                                <input
                                    type="number"
                                    value={monthlyContribution}
                                    onChange={(e) => setMonthlyContribution(Number(e.target.value))}
                                    onFocus={(e) => e.target.select()}
                                    className="w-full px-2 py-1.5 text-sm rounded border border-input bg-background/50 text-right no-spinner"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] uppercase text-muted-foreground">Jahre</label>
                                <input
                                    type="number"
                                    value={years}
                                    onChange={(e) => setYears(Number(e.target.value))}
                                    onFocus={(e) => e.target.select()}
                                    className="w-full px-2 py-1.5 text-sm rounded border border-input bg-background/50 text-right no-spinner"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] uppercase text-muted-foreground">Div. Rendite %</label>
                                <input
                                    type="number"
                                    step="0.1"
                                    value={dividendYield}
                                    onChange={(e) => setDividendYield(Number(e.target.value))}
                                    onFocus={(e) => e.target.select()}
                                    className="w-full px-2 py-1.5 text-sm rounded border border-input bg-background/50 text-right no-spinner"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] uppercase text-muted-foreground">Kursgewinn %</label>
                                <input
                                    type="number"
                                    step="0.1"
                                    value={priceAppreciation}
                                    onChange={(e) => setPriceAppreciation(Number(e.target.value))}
                                    onFocus={(e) => e.target.select()}
                                    className="w-full px-2 py-1.5 text-sm rounded border border-input bg-background/50 text-right no-spinner"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] uppercase text-muted-foreground">Reinvest?</label>
                                <button
                                    onClick={() => setReinvest(!reinvest)}
                                    className={`w-full py-1.5 text-xs rounded border transition-colors ${reinvest ? 'bg-primary/20 border-primary text-primary font-bold' : 'bg-background border-input text-muted-foreground'}`}
                                >
                                    {reinvest ? 'JA' : 'NEIN'}
                                </button>
                            </div>
                        </div>

                        <div className="h-[300px] w-full min-w-0">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={projectionData} margin={{ top: 5, right: 0, left: 0, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="colorCapital" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                                    <XAxis dataKey="year" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(val) => `${(val / 1000).toFixed(0)}k`} />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: 'hsl(var(--popover))', borderColor: 'hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }}
                                        formatter={(val: number) => val.toLocaleString('de-CH', { style: 'currency', currency: 'CHF', maximumFractionDigits: 0 })}
                                    />
                                    <Area type="monotone" dataKey="capital" stroke="hsl(var(--primary))" fill="url(#colorCapital)" />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>

                        {/* Stats Footer */}
                        <div className="flex justify-between items-end pt-4 mt-2 border-t border-border/50">
                            <div>
                                <span className="text-xs text-muted-foreground block">Endkapital (in {years} Jahren)</span>
                                <span className="text-xl font-bold text-primary">{finalYear.capital.toLocaleString('de-CH', { style: 'currency', currency: 'CHF', maximumFractionDigits: 0 })}</span>
                            </div>
                            <div className="text-right">
                                <span className="text-xs text-muted-foreground block">Passives Einkommen / Jahr</span>
                                <span className="text-xl font-bold text-green-600 dark:text-green-400">{displayDividendYear.dividend.toLocaleString('de-CH', { style: 'currency', currency: 'CHF', maximumFractionDigits: 0 })}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
