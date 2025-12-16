import { useState, useMemo, useEffect } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Calculator, Coins, Settings2, Plus, Check, Eye, Pencil, FileText } from 'lucide-react';

import { jsPDF } from 'jspdf';
import { usePortfolio } from '../context/PortfolioContext';
import { useExchangeRates } from '../context/ExchangeRateContext';
import { convertToCHF } from '../utils/currency';

export function DividendCalculator() {
    const { stocks, addStock, addToWatchlist, simulatorState, updateSimulatorState, positions, addPosition, updatePosition, deletePosition } = usePortfolio();
    const { rates } = useExchangeRates();

    // PDF Export Handler
    const handleExportPDF = () => {
        const doc = new jsPDF();
        const { shares, price, dividend, selectedStockId, simName, simSymbol, fees, mode } = simulatorState;

        // Find Stock for ISIN/Details
        let stockIsin = '';
        if (selectedStockId && selectedStockId !== 'new') {
            const stock = stocks.find(s => s.id === selectedStockId);
            if (stock) {
                stockIsin = stock.isin || '';
            }
        }

        // Colors
        const primaryColor = '#0f172a'; // Slate 900
        const accentColor = mode === 'buy' ? '#16a34a' : '#dc2626'; // Green or Red

        // Header
        doc.setFontSize(22);
        doc.setTextColor(primaryColor);
        doc.text('Kauf / Verkauf Abrechnung', 20, 25);

        doc.setFontSize(10);
        doc.setTextColor('#64748b'); // Slate 500
        doc.text(`Erstellt am: ${new Date().toLocaleDateString('de-DE')} ${new Date().toLocaleTimeString('de-DE')}`, 20, 32);

        // Transaction Type Badge
        doc.setFillColor(accentColor);
        doc.roundedRect(150, 18, 40, 12, 2, 2, 'F');
        doc.setTextColor('#ffffff');
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text(mode === 'buy' ? 'KAUF' : 'VERKAUF', 170, 26, { align: 'center' });

        // Stock Details
        doc.setTextColor(primaryColor);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(14);
        let stockName = simName || 'Unbekannte Aktie';
        let stockSymbol = simSymbol || 'N/A';

        if (selectedStockId && selectedStockId !== 'new') {
            const stock = stocks.find(s => s.id === selectedStockId);
            if (stock) {
                stockName = stock.name;
                stockSymbol = stock.symbol;
            }
        }

        doc.text(`${stockName} (${stockSymbol})`, 20, 48);

        if (stockIsin) {
            doc.setFontSize(10);
            doc.setTextColor('#64748b');
            doc.text(`ISIN: ${stockIsin}`, 20, 54);
        }

        // Calculation Data (Already CHF from State)
        const volume = shares * price;
        const calcCourtage = Math.max(volume * (fees.courtagePercent / 100), fees.courtageMin);
        const calcStamp = volume * (fees.stampDutyPercent / 100);
        const totalFees = calcCourtage + calcStamp + fees.exchangeFee;
        const totalInvest = mode === 'buy' ? volume + totalFees : 0;
        const totalProceeds = mode === 'sell' ? volume - totalFees : 0;
        const grossYield = price > 0 ? (dividend / price) * 100 : 0;

        // Table Data
        const startY = 65;
        const col1 = 20;
        const rowHeight = 10;

        doc.setFontSize(11);

        // Rows
        const drawRow = (label: string, value: string, y: number, boldValue = false) => {
            doc.setTextColor('#64748b');
            doc.setFont('helvetica', 'normal');
            doc.text(label, col1, y);

            doc.setTextColor(primaryColor);
            if (boldValue) doc.setFont('helvetica', 'bold');
            else doc.setFont('helvetica', 'normal');
            doc.text(value, 190, y, { align: 'right' });

            // Dotted line
            doc.setDrawColor('#e2e8f0');
            doc.setLineWidth(0.1);
            doc.line(col1 + doc.getTextWidth(label) + 2, y - 1, 188 - doc.getTextWidth(value), y - 1);
        };

        drawRow('Anzahl', `${shares} Stk.`, startY);
        drawRow('Kurs', `CHF ${price.toFixed(2)}`, startY + rowHeight);
        drawRow('Volumen', `CHF ${volume.toFixed(2)}`, startY + rowHeight * 2);

        // Fees Block
        let currentY = startY + rowHeight * 3 + 5;
        doc.setFontSize(10);
        doc.setTextColor(primaryColor);
        doc.text('Gebührenaufstellung', col1, currentY);
        currentY += 8;

        drawRow('Courtage', `CHF ${calcCourtage.toFixed(2)}`, currentY);
        drawRow('Stempelsteuer', `CHF ${calcStamp.toFixed(2)}`, currentY + rowHeight);
        drawRow('Börsengebühr', `CHF ${fees.exchangeFee.toFixed(2)}`, currentY + rowHeight * 2);
        drawRow('Total Gebühren', `CHF ${totalFees.toFixed(2)}`, currentY + rowHeight * 3, true);

        // Total Block
        currentY += rowHeight * 4 + 10;
        doc.setFillColor('#f1f5f9'); // Slate 100
        doc.rect(15, currentY - 8, 180, 20, 'F');

        doc.setFontSize(14);
        doc.setTextColor(primaryColor);
        doc.setFont('helvetica', 'bold');
        const totalLabel = mode === 'buy' ? 'INVESTITION TOTAL' : 'NETTO ERLÖS';
        const totalValue = mode === 'buy' ? totalInvest : totalProceeds;

        doc.text(totalLabel, 25, currentY + 5);
        doc.text(`CHF ${totalValue.toFixed(2)}`, 185, currentY + 5, { align: 'right' });

        // Yield Info (Buy Only)
        if (mode === 'buy') {
            currentY += 25;
            doc.setFontSize(11);
            doc.setTextColor('#64748b');
            doc.setFont('helvetica', 'normal');
            doc.text('Erwartete Jährliche Dividende:', 20, currentY);
            doc.setTextColor(primaryColor);
            doc.text(`CHF ${(shares * dividend).toFixed(2)}`, 190, currentY, { align: 'right' });

            currentY += 8;
            doc.setTextColor('#64748b');
            doc.text('Brutto-Rendite:', 20, currentY);
            doc.setTextColor(primaryColor);
            doc.text(`${grossYield.toFixed(2)}%`, 190, currentY, { align: 'right' });
        }

        // Footer
        doc.setFontSize(8);
        doc.setTextColor('#94a3b8');
        doc.text('Portfolio Manager - Simulation', 105, 290, { align: 'center' });

        doc.save(`Simulation_${stockName.replace(/[^a-z0-9]/gi, '_')}_${new Date().toISOString().split('T')[0]}.pdf`);
    };

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
    const { shares, price, dividend, selectedStockId, simName, simSymbol, simCurrency, fees, mode } = simulatorState; // Added simCurrency

    // Reset edit mode when stock changes
    useEffect(() => {
        setIsEditingPrice(false);
    }, [selectedStockId]);

    // FIX: Sync Simulator State when navigating to this page with a pre-selected stock
    // This ensures simCurrency is correctly set to e.g. 'GBp' instead of staying 'CHF'
    useEffect(() => {
        if (selectedStockId && selectedStockId !== 'new') {
            const stock = stocks.find(s => s.id === selectedStockId);
            if (stock && stock.currency !== simCurrency) {
                // Determine Stamp Duty
                let newStamp = 0.075;
                if (stock.currency !== 'CHF') newStamp = 0.15;

                // Calculate Annual Dividend
                let annualDiv = stock.dividendAmount || 0;
                if (stock.dividendFrequency === 'quarterly') annualDiv *= 4;
                else if (stock.dividendFrequency === 'monthly') annualDiv *= 12;
                else if (stock.dividendFrequency === 'semi-annually') annualDiv *= 2;

                updateSimulatorState({
                    simName: stock.name,
                    simSymbol: stock.symbol,
                    simCurrency: stock.currency,
                    price: stock.currentPrice,
                    dividend: annualDiv,
                    fees: { ...fees, stampDutyPercent: newStamp },
                });
            }
        }
    }, [selectedStockId, stocks, simCurrency]);

    // Derived Logic & Currency Conversion for TOTALS only
    // 1. Calculate Volume in Native Currency
    const volumeNative = shares * price;

    // 2. Convert to CHF for Fees & Total Display
    // Helper to get CHF value
    const getCHF = (val: number, currency: string) => {
        if (!currency || currency === 'CHF') return val;
        // Special case for GBp: Price is in Pence, but convertToCHF handles it if passed 'GBp'
        // But if we have a raw value like 4238 (Pence), convertToCHF(4238, 'GBp') returns ~47 CHF. Correct.
        return convertToCHF(val, currency, rates);
    };

    const volumeCHF = getCHF(volumeNative, simCurrency || 'CHF');

    // Fees are calculated on CHF Volume usually? Or Native? 
    // Usually broker fees are defined in CHF/Base Currency or calculated on value.
    // Let's assume fees are calculated on the CHF value of the transaction.
    const calcCourtage = Math.max(volumeCHF * (fees.courtagePercent / 100), fees.courtageMin);
    const calcStamp = volumeCHF * (fees.stampDutyPercent / 100);
    const totalFees = calcCourtage + calcStamp + fees.exchangeFee;

    // Totals in CHF
    const totalInvestCHF = mode === 'buy' ? volumeCHF + totalFees : 0;
    const totalProceedsCHF = mode === 'sell' ? volumeCHF - totalFees : 0;

    const grossYield = price > 0 ? (dividend / price) * 100 : 0;
    // Net yield: (Annual Dividend * Shares) / Total Invested (CHF)
    // Annual Dividend in CHF
    const annualDividendCHF = getCHF(shares * dividend, simCurrency || 'CHF');
    const netYield = totalInvestCHF > 0 ? (annualDividendCHF / totalInvestCHF) * 100 : 0;

    // Handle Stock Selection
    const handleStockSelect = (stockId: string) => {
        if (stockId === 'new') {
            updateSimulatorState({
                selectedStockId: 'new',
                simName: '',
                simSymbol: '',
                simCurrency: 'CHF', // Default new
                price: 0,
                dividend: 0,
                mode: 'buy'
            });
            return;
        }
        const stock = stocks.find(s => s.id === stockId);
        if (stock) {
            let newStamp = 0.075; // Default CH
            if (stock.currency !== 'CHF') newStamp = 0.15; // Foreign

            // Calculate Annual Dividend based on Frequency
            let annualDiv = stock.dividendAmount || 0;
            if (stock.dividendFrequency === 'quarterly') annualDiv *= 4;
            else if (stock.dividendFrequency === 'monthly') annualDiv *= 12;
            else if (stock.dividendFrequency === 'semi-annually') annualDiv *= 2;

            // REVERTED CONVERSION: Use Native Values
            updateSimulatorState({
                selectedStockId: stock.id,
                simName: stock.name,
                simSymbol: stock.symbol,
                simCurrency: stock.currency, // Store Currency
                price: stock.currentPrice,   // Store Native Price (e.g. 4238 GBp)
                dividend: annualDiv,         // Store Native Div (e.g. 250 GBp)
                fees: { ...fees, stampDutyPercent: newStamp },
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
                    currency: (simCurrency as any) || 'CHF',
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

            // Calculate effective price in NATIVE currency
            // If we have fees in CHF, we need to approximate them in Native or just use Price.
            // For now, simpler to just use the Execution Price (Native) as the Average Price foundation.
            // If we want to include fees: effectivePrice = price + (totalFees / volumeCHF * price)
            let effectivePrice = price;
            if (volumeCHF > 0) {
                const feeRatio = totalFees / volumeCHF;
                effectivePrice = price * (1 + feeRatio);
            }
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
                                <h3 className="font-semibold text-lg">Kauf / Verkauf</h3>
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
                                    onClick={handleExportPDF}
                                    title="Als PDF speichern"
                                    className="text-xs flex items-center gap-1 border border-border px-2 py-1.5 rounded text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                                >
                                    <FileText size={12} />
                                    PDF
                                </button>
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
                                {selectedStockId && selectedStockId !== 'new' && (
                                    <div className="text-[10px] text-muted-foreground px-1 flex justify-between">
                                        <span>ISIN: {stocks.find(s => s.id === selectedStockId)?.isin || '-'}</span>
                                    </div>
                                )}
                            </div>

                            {/* Current Position Info & Edit */}
                            {(() => {
                                const currentPos = positions.find(p => p.stockId === selectedStockId);
                                if (!currentPos) return null;

                                // Fix GBp display: If stock is GBp, buyPriceAvg is key.
                                const stock = stocks.find(s => s.id === selectedStockId);
                                let displayAvgPrice = currentPos.buyPriceAvg;
                                let displayCurrency: string = stock?.currency || 'CHF';

                                // Handling GBp Display specifically for "Ø Kauf"
                                if (displayCurrency === 'GBp') {
                                    // If raw value is > 200 (likely Pence), divide by 100 for GBP view?
                                    // Or display as 'p'? FormatCurrency usually displays GBP.
                                    displayCurrency = 'GBP';
                                    displayAvgPrice = currentPos.buyPriceAvg / 100; // Correct scaling: 2800p -> 28.00 £
                                }

                                return (
                                    {/* Position Header - Clean 3-Item Layout */ }
                                    < div className = "flex items-center justify-between p-4 bg-muted/30 rounded-lg border border-border/50 mb-6" >
                                        {/* Shares */ }
                                        < div className = "flex flex-col items-center gap-1" >
                                                <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Bestand</span>
                                                <span className="text-xl font-bold">{currentPos.shares} Stk.</span>
                                            </div>

                        {/* Divider */}
                        <div className="h-8 w-px bg-border/50"></div>

                        {/* Avg Price */}
                        <div className="flex flex-col items-center gap-1">
                            <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Ø Einstieg</span>
                            <div className="flex items-center gap-2 group cursor-pointer"
                                onClick={() => {
                                    setEditPriceVal(currentPos.buyPriceAvg.toString());
                                    setIsEditingPrice(true);
                                }}
                            >
                                {isEditingPrice ? (
                                    <div className="flex items-center gap-1 animate-in fade-in zoom-in-95 duration-200">
                                        <input
                                            type="number"
                                            step="0.01"
                                            className="w-24 px-2 py-0.5 text-center border rounded bg-background text-foreground text-lg font-bold focus:ring-1 focus:ring-primary no-spinner"
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
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                if (editPriceVal && !isNaN(Number(editPriceVal))) {
                                                    updatePosition(currentPos.id, { buyPriceAvg: Number(editPriceVal) });
                                                    setIsEditingPrice(false);
                                                }
                                            }}
                                            className="p-1 hover:bg-green-500/20 text-green-600 rounded"
                                        >
                                            <Check size={16} />
                                        </button>
                                    </div>
                                ) : (
                                    <span className="text-xl font-bold group-hover:text-primary transition-colors flex items-center gap-2">
                                        {displayAvgPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {simCurrency === 'GBp' ? '£' : (simCurrency || 'CHF')}
                                        <Pencil size={12} className="opacity-0 group-hover:opacity-50 text-muted-foreground" />
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Divider */}
                        <div className="h-8 w-px bg-border/50"></div>

                        {/* Total Value */}
                        <div className="flex flex-col items-center gap-1">
                            <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Gesamtwert</span>
                            <span className="text-xl font-bold">
                                {(displayAvgPrice * currentPos.shares).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {simCurrency === 'GBp' ? '£' : (simCurrency || 'CHF')}
                            </span>
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
                                className="w-full px-2 py-1.5 text-sm rounded-md border border-input bg-background text-foreground text-right font-mono focus:ring-1 focus:ring-primary no-spinner"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-muted-foreground">
                                Kurs ({simCurrency || 'CHF'})
                            </label>
                            <input
                                type="number"
                                step="0.01"
                                value={price}
                                onChange={(e) => updateSimulatorState({ price: Number(e.target.value) })}
                                className="w-full px-2 py-1.5 text-sm rounded-md border border-input bg-background text-foreground text-right font-mono focus:ring-1 focus:ring-primary no-spinner"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-muted-foreground">
                                Div. ({simCurrency || 'CHF'})
                            </label>
                            <input
                                type="number"
                                step="0.01"
                                value={dividend}
                                onChange={(e) => updateSimulatorState({ dividend: Number(e.target.value) })}
                                className="w-full px-2 py-1.5 text-sm rounded-md border border-input bg-background text-foreground text-right font-mono focus:ring-1 focus:ring-primary no-spinner"
                            />
                        </div>
                    </div>

                    {/* Manual Currency Select - Only show if New Simulation */}
                    {(selectedStockId === 'new' || !selectedStockId) && (
                        <div className="flex items-center justify-end">
                            <select
                                value={simCurrency || 'CHF'}
                                onChange={(e) => updateSimulatorState({ simCurrency: e.target.value })}
                                className="text-xs border rounded px-1 py-0.5"
                            >
                                <option value="CHF">CHF</option>
                                <option value="USD">USD</option>
                                <option value="EUR">EUR</option>
                                <option value="GBP">GBP</option>
                                <option value="GBp">GBp (Pence)</option>
                            </select>
                        </div>
                    )}

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
                                        className="w-full px-2 py-1 text-sm rounded border border-input bg-background text-foreground text-right no-spinner"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] uppercase text-muted-foreground">Min. (CHF)</label>
                                    <input
                                        type="number"
                                        value={fees.courtageMin}
                                        onChange={(e) => updateSimulatorState({ fees: { ...fees, courtageMin: Number(e.target.value) } })}
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
                                            <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1 4-10 15.3 15.3 0 0 1 4-10z"></path>
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
                                    className="w-24 px-2 py-1 text-sm rounded border border-input bg-background text-foreground text-right no-spinner"
                                />
                            </div>

                            <div className="pt-2 border-t border-border/50 flex justify-between items-center">
                                <span className="text-xs text-muted-foreground">Total Gebühren</span>
                                <span className="text-sm font-bold text-red-500">-{totalFees.toFixed(2)} CHF</span>
                            </div>
                        </div>
                    )}

                    {/* Results / Breakdown */}
                    <div className="space-y-3 pt-2">
                        <div className="p-3 bg-muted rounded-md space-y-2 text-sm">
                            <div className="flex justify-between items-center">
                                <span className="text-muted-foreground">Volumen ({simCurrency}):</span>
                                <span className="font-mono font-medium">
                                    {(() => {
                                        if (simCurrency === 'GBp') {
                                            // Display GBp Volume in GBP for readability
                                            return (volumeNative / 100).toLocaleString('de-CH', { style: 'currency', currency: 'GBP' });
                                        }
                                        return volumeNative.toLocaleString('de-CH', { style: 'currency', currency: simCurrency || 'CHF' });
                                    })()}
                                </span>
                            </div>
                            <div className="flex justify-between items-center text-xs text-muted-foreground">
                                <span>Volumen (CHF):</span>
                                <span>{volumeCHF.toLocaleString('de-CH', { style: 'currency', currency: 'CHF' })}</span>
                            </div>
                            <div className="h-px bg-border my-2" />
                            <div className="space-y-1 text-xs">
                                <div className="flex justify-between">
                                    <span>Courtage:</span>
                                    <span className="text-red-500 font-mono">{mode === 'buy' ? '+' : '-'} {calcCourtage.toFixed(2)} CHF</span>
                                </div>
                                <div className="flex justify-between">
                                    <span>Stempelsteuer:</span>
                                    <span className="text-red-500 font-mono">{mode === 'buy' ? '+' : '-'} {calcStamp.toFixed(2)} CHF</span>
                                </div>
                                <div className="flex justify-between">
                                    <span>Börsengebühr:</span>
                                    <span className="text-red-500 font-mono">{mode === 'buy' ? '+' : '-'} {fees.exchangeFee.toFixed(2)} CHF</span>
                                </div>
                            </div>
                            <div className="h-px bg-border my-2" />
                            <div className="flex justify-between items-center font-bold">
                                <span>{mode === 'buy' ? 'Investition Total' : 'Netto Erlös'} (CHF):</span>
                                <span className={mode === 'buy' ? 'text-green-500 dark:text-green-400' : 'text-blue-600 dark:text-blue-400 font-mono'}>
                                    {mode === 'buy' ? totalInvestCHF.toLocaleString('de-CH', { style: 'currency', currency: 'CHF' }) : totalProceedsCHF.toLocaleString('de-CH', { style: 'currency', currency: 'CHF' })}
                                </span>
                            </div>
                        </div>

                        {/* Yield Info (Buy Mode) */}
                        {mode === 'buy' && (
                            <div className="p-3 bg-primary text-primary-foreground rounded-md space-y-2 text-sm shadow-sm flex items-center justify-between">
                                <div className="flex justify-between items-center w-full">
                                    <span className="opacity-90">Erw. Jährliche Dividende:</span>
                                    <span className="font-medium text-xl text-primary-foreground">
                                        {(() => {
                                            const annualDivNative = shares * dividend;
                                            if (simCurrency === 'GBp') {
                                                return (annualDivNative / 100).toLocaleString('de-CH', { style: 'currency', currency: 'GBP' });
                                            }
                                            return annualDivNative.toLocaleString('de-CH', { style: 'currency', currency: simCurrency || 'CHF' });
                                        })()}
                                    </span>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Results Grid - Compact 2x2 */}
                    <div className="grid grid-cols-2 gap-3 pt-2">
                        {/* Total Invest / Proceeds */}
                        {/* Total Invest / Proceeds */}
                        {/* Total Invest / Proceeds */}
                        <div className="p-2.5 rounded-lg bg-muted/30 border border-border/50 flex flex-col justify-between">
                            <span className="text-[10px] text-muted-foreground uppercase tracking-wide">
                                {mode === 'buy' ? 'Investition Total' : 'Netto Erlös'} (CHF)
                            </span>
                            <div className="flex flex-col items-end">
                                <span className={`text-lg font-bold leading-none ${mode === 'sell' ? 'text-green-600' : 'text-foreground'}`}>
                                    {(mode === 'buy' ? totalInvestCHF : totalProceedsCHF).toLocaleString('de-CH', { style: 'currency', currency: 'CHF' })}
                                </span>
                                <span className="text-[10px] text-muted-foreground mt-0.5">
                                    {volumeCHF.toLocaleString('de-CH', { style: 'currency', currency: 'CHF', maximumFractionDigits: 0 })}
                                    {mode === 'buy' ? ' + ' : ' - '}{totalFees.toFixed(0)} Geb.
                                </span>
                            </div>
                        </div>

                        {/* Annual Payout */}
                        <div className="p-2.5 rounded-lg bg-muted/30 border border-border/50 flex flex-col justify-between">
                            <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Jäh. Ausschüttung (CHF)</span>
                            <div className="flex flex-col items-end">
                                <span className="text-lg font-bold text-foreground leading-none">
                                    {annualDividendCHF.toLocaleString('de-CH', { style: 'currency', currency: 'CHF' })}
                                </span>
                                {mode === 'sell' && <span className="text-[10px] text-red-500 font-medium">Verlust an Div.</span>}
                            </div>
                        </div>
                    </div>

                    {/* Net Yield Highlight with Gross (Only for Buy) */}
                    {mode === 'buy' && (
                        <div className={`p-3 rounded-lg border flex items-center justify-between gap-4 ${netYield > 0 ? 'bg-primary text-primary-foreground border-primary shadow-md' : 'bg-muted text-muted-foreground border-transparent'}`}>
                            <div className="flex flex-col items-start">
                                <span className="text-xs font-bold uppercase opacity-90">Brutto-Rendite</span>
                                <span className="text-2xl font-bold tracking-tight text-primary-foreground">{grossYield.toFixed(2)}%</span>
                            </div>
                            <div className="h-8 w-px bg-current opacity-20"></div>
                            <div className="flex flex-col items-end">
                                <span className="text-xs font-bold uppercase opacity-90">Netto-Rendite</span>
                                <span className="text-2xl font-bold tracking-tight text-primary-foreground">{netYield.toFixed(2)}%</span>
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

                {/* Projection Section (Right Col) */ }
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
                <ResponsiveContainer width="100%" height="100%" minHeight={100} minWidth={100}>
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
                    <span className="text-xl font-bold text-green-500 dark:text-green-400">{displayDividendYear.dividend.toLocaleString('de-CH', { style: 'currency', currency: 'CHF', maximumFractionDigits: 0 })}</span>
                </div>
            </div>
        </div>
    </div>
            </div >
        </div >
    );
}
