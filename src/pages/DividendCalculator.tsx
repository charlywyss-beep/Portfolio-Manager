import { useState, useMemo, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Calculator, Coins, Settings2, Plus, Check, Eye, Pencil, FileText, Search, PlusCircle, X, BarChart3, PieChart, RefreshCw } from 'lucide-react';
import { fetchStockHistory, searchStocks } from '../services/yahoo-finance';

// Helper component for comma-friendly number input
const LocalNumberInput = ({ value, onChange, className, step = "any", title, placeholder }: {
    value: number | undefined;
    onChange: (val: number) => void;
    className?: string;
    step?: string;
    title?: string;
    placeholder?: string;
}) => {
    const [localValue, setLocalValue] = useState(value?.toString() || '');
    const lastEmitted = useRef(value);

    useEffect(() => {
        // Only sync if the external value is different from what we last emitted
        // This prevents cursor jumping and overwriting valid intermediate states (like "1." or "")
        if (value !== undefined && value !== lastEmitted.current) {
            setLocalValue(value.toString());
            lastEmitted.current = value;
        }
    }, [value]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newVal = e.target.value;
        setLocalValue(newVal);

        // Replace comma with dot for parsing
        const normalized = newVal.replace(',', '.');
        const parsed = parseFloat(normalized);

        if (!isNaN(parsed)) {
            lastEmitted.current = parsed;
            onChange(parsed);
        } else if (newVal === '') {
            lastEmitted.current = 0;
            onChange(0);
        }
    };

    return (
        <input
            type="text"
            inputMode="decimal"
            step={step}
            value={localValue}
            onChange={handleChange}
            className={className}
            title={title}
            placeholder={placeholder}
        />
    );
};

import { jsPDF } from 'jspdf';
import { usePortfolio } from '../context/PortfolioContext';
import { useExchangeRates } from '../context/ExchangeRateContext';
import { convertToCHF } from '../utils/currency';
import { cn } from '../utils';

export function DividendCalculator() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { stocks, addStock, addToWatchlist, simulatorState, updateSimulatorState, positions, addPosition, updatePosition, deletePosition } = usePortfolio();
    const { rates } = useExchangeRates();

    // Catch-all: Ensure GBp is always converted to GBP on mount/update
    useEffect(() => {
        if (simulatorState.simCurrency === 'GBp') {
            updateSimulatorState({
                simCurrency: 'GBP',
                price: simulatorState.price / 100,
                dividend: simulatorState.dividend / 100
            });
        }
    }, [simulatorState.simCurrency, simulatorState.price, simulatorState.dividend, updateSimulatorState]);

    // PDF Export Handler
    const handleExportPDF = () => {
        const doc = new jsPDF();
        const { shares, price, dividend, selectedStockId, simName, simSymbol, fees, mode, simCurrency } = simulatorState;

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
        doc.setTextColor('#1e293b'); // Dark Slate for Timestamp
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
            doc.setTextColor('#1e293b');
            doc.text(`ISIN: ${stockIsin}`, 20, 54);
        }



        // Helper for currency formatting
        const fmtMoney = (val: number, curr: string) => {
            return new Intl.NumberFormat('de-CH', { style: 'currency', currency: curr }).format(val);
        };

        // Derived Logic & Currency Conversion for TOTALS only
        // 1. Calculate Volume in Native Currency
        const volumeNative = shares * price;

        // 2. Convert to CHF for Fees & Total Display
        // Helper to get CHF value
        const getCHF = (val: number, currency: string) => {
            if (!currency || currency === 'CHF') return val;

            // Base conversion
            const baseCHF = convertToCHF(val, currency, rates);

            // Apply FX Markup (Bank Fee)
            // BUY: You pay MORE CHF => Rate increases (Multiply by 1 + markup)
            // SELL: You receive LESS CHF => Rate decreases (Multiply by 1 - markup)
            const markup = (fees.fxMarkupPercent || 0) / 100;

            if (mode === 'buy') {
                return baseCHF * (1 + markup);
            } else {
                return baseCHF * (1 - markup);
            }
        };

        const volumeCHF = getCHF(volumeNative, simCurrency || 'CHF');

        // Usually broker fees are defined in CHF/Base Currency or calculated on value.
        // Let's assume fees are calculated on the CHF value of the transaction.
        // Fees Calculation
        const feeCurrency = fees.feeCurrency || 'CHF';
        const isNativeFees = feeCurrency === 'NATIVE';
        // Special handling for GBp (Pence) -> treat Native Fees as GBP (Pounds)
        const isGBp = simCurrency === 'GBp';
        const displayFeeCurrency = (isNativeFees && isGBp) ? 'GBP' : (isNativeFees ? simCurrency : 'CHF');

        // Calculate Fees
        let calcCourtage = 0;
        let calcStamp = 0;
        let totalFeesInFeeCurrency = 0;

        if (isNativeFees) {
            // NATIVE CURRENCY LOGIC
            if (isGBp) {
                // Treat as GBP (Pounds)
                // Volume is in Pence.
                // Courtage % is of Volume => Result in Pence. Need directly in Pounds (/100).
                const volPence = volumeNative;
                const courtagePence = volPence * (fees.courtagePercent / 100);
                const courtagePoundsDerived = courtagePence / 100;

                // Min is in Pounds
                calcCourtage = Math.max(courtagePoundsDerived, fees.courtageMin);

                // Stamp % of Volume => Result in Pence. Need in Pounds (/100).
                const stampPence = volPence * (fees.stampDutyPercent / 100);
                calcStamp = stampPence / 100;

                // Exchange Fee is in Pounds (Input)
                // Total in Pounds
                totalFeesInFeeCurrency = calcCourtage + calcStamp + fees.exchangeFee;

            } else {
                // Standard Native (e.g. USD, EUR)
                const feeBaseVolume = volumeNative;
                calcCourtage = Math.max(feeBaseVolume * (fees.courtagePercent / 100), fees.courtageMin);
                calcStamp = feeBaseVolume * (fees.stampDutyPercent / 100);
                totalFeesInFeeCurrency = calcCourtage + calcStamp + fees.exchangeFee;
            }
        } else {
            // CHF BASE LOGIC (Default)
            // Everything calculated based on volumeCHF
            calcCourtage = Math.max(volumeCHF * (fees.courtagePercent / 100), fees.courtageMin);
            calcStamp = volumeCHF * (fees.stampDutyPercent / 100);
            totalFeesInFeeCurrency = calcCourtage + calcStamp + fees.exchangeFee;
        }

        // Convert Total Fees to CHF for final summation
        let totalFeesCHF = totalFeesInFeeCurrency;
        if (isNativeFees) {
            // If GBp, we effectively already converted to GBP (Pounds). So convert GBP -> CHF.
            // If other, convert SimCurrency -> CHF.
            const conversionSourceCurrency = isGBp ? 'GBP' : simCurrency;
            totalFeesCHF = convertToCHF(totalFeesInFeeCurrency, conversionSourceCurrency, rates);
        }

        const totalFees = totalFeesCHF;

        // Totals in CHF
        const totalInvestCHF = mode === 'buy' ? volumeCHF + totalFees : 0;
        const totalProceedsCHF = mode === 'sell' ? volumeCHF - totalFees : 0;

        const grossYield = price > 0 ? (dividend / price) * 100 : 0;
        // Net yield: (Annual Dividend * Shares) / Total Invested (CHF)
        // Annual Dividend in CHF
        const annualDividendCHF = getCHF(shares * dividend, simCurrency || 'CHF');
        // const netYield = totalInvestCHF > 0 ? (annualDividendCHF / totalInvestCHF) * 100 : 0; // Not used in PDF

        // Table Data
        const startY = 65;
        const col1 = 20;
        const rowHeight = 10;

        doc.setFontSize(11);

        // Rows
        const drawRow = (label: string, value: string, y: number, boldValue = false) => {
            doc.setTextColor('#1e293b');
            doc.setFont('helvetica', 'normal');
            doc.text(label, col1, y);

            doc.setTextColor(primaryColor);
            if (boldValue) doc.setFont('helvetica', 'bold');
            else doc.setFont('helvetica', 'normal');
            doc.text(value, 190, y, { align: 'right' });

            // Dotted line
            doc.setDrawColor('#94a3b8');
            doc.setLineWidth(0.1);
            doc.line(col1 + doc.getTextWidth(label) + 2, y - 1, 188 - doc.getTextWidth(value), y - 1);
        };

        const displayCurr = simCurrency === 'GBp' ? 'GBP' : (simCurrency || 'CHF');

        drawRow('Anzahl', `${shares} Stk.`, startY);
        drawRow('Kurs', fmtMoney(price, displayCurr), startY + rowHeight);
        drawRow('Volumen', fmtMoney(volumeNative, displayCurr), startY + rowHeight * 2);

        // Fees Block
        let currentY = startY + rowHeight * 3 + 5;
        doc.setFontSize(10);
        doc.setTextColor(primaryColor);
        doc.text('Gebührenaufstellung', col1, currentY);
        currentY += 8;

        drawRow('Courtage', fmtMoney(calcCourtage, displayFeeCurrency), currentY);
        drawRow('Stempelsteuer', fmtMoney(calcStamp, displayFeeCurrency), currentY + rowHeight);
        drawRow('Börsengebühr', fmtMoney(fees.exchangeFee, displayFeeCurrency), currentY + rowHeight * 2);
        drawRow('Total Gebühren', fmtMoney(totalFeesInFeeCurrency, displayFeeCurrency), currentY + rowHeight * 3, true);

        let feesBlockY = currentY + rowHeight * 3;

        // If Fee Currency is NOT CHF, show Total Fees in CHF on a new line below
        if (displayFeeCurrency !== 'CHF') {
            feesBlockY += rowHeight;
            drawRow('Total Gebühren (CHF)', fmtMoney(totalFeesCHF, 'CHF'), feesBlockY, true);
        }

        // Exchange Rate (Moved below Total Gebühren as per user request)
        if (simCurrency && simCurrency !== 'CHF') {
            const displayBaseCurr = simCurrency === 'GBp' ? 'GBP' : simCurrency;
            const baseRate = rates[displayBaseCurr]; // e.g. 0.93 for GBP

            if (baseRate) {
                const markup = (fees.fxMarkupPercent || 0) / 100;
                let effectiveRate = (1 / baseRate);
                if (mode === 'buy') effectiveRate *= (1 + markup);
                else effectiveRate *= (1 - markup);

                const exchangeRateY = feesBlockY + 8; // Bit of spacing below the last fee line

                doc.setFontSize(9);
                doc.setTextColor('#1e293b');
                doc.text(`Wechselkurs: 1 ${displayBaseCurr} = ${effectiveRate.toFixed(4)} CHF`, 20, exchangeRateY);

                // Push block down for Total Sum
                // We used `currentY` to track broad sections, but we drifted with `feesBlockY`.
                // Let's reset `currentY` to be consistent with where we ended.
                // We ended at `exchangeRateY`.
                // The next block (Total Block) starts at `currentY`.
                // The original code did `currentY += rowHeight * 4 + 10;` which was static.
                // We need to be dynamic now.
                currentY = exchangeRateY;
            } else {
                // No exchange rate printed, but maybe extra fee line was printed.
                currentY = feesBlockY;
            }
        } else {
            // No exchange rate, maybe extra fee line? (Unlikely if CHF, but logic holds)
            currentY = feesBlockY;
        }

        // Total Block (Always CHF as per logic)
        // Add some breathing room before the gray box
        currentY += 15;
        doc.setFillColor('#f1f5f9'); // Slate 100
        doc.rect(15, currentY - 8, 180, 20, 'F');

        doc.setFontSize(14);
        doc.setTextColor(primaryColor);
        doc.setFont('helvetica', 'bold');
        const totalLabel = mode === 'buy' ? 'INVESTITION TOTAL' : 'NETTO ERLÖS';
        const totalValue = mode === 'buy' ? totalInvestCHF : totalProceedsCHF;

        doc.text(totalLabel, 25, currentY + 5);
        // Always display Total in CHF
        doc.text(fmtMoney(totalValue, 'CHF'), 185, currentY + 5, { align: 'right' });

        // Yield Info (Buy Only)
        if (mode === 'buy') {
            currentY += 25;
            doc.setFontSize(11);
            doc.setTextColor('#1e293b');
            doc.setFont('helvetica', 'normal');
            doc.text('Jährl. Ausschüttung:', 20, currentY);
            doc.setTextColor(primaryColor);

            doc.text(fmtMoney(annualDividendCHF, 'CHF'), 190, currentY, { align: 'right' });

            // Quarterly (Derived)
            currentY += 6;
            doc.setFontSize(9);
            doc.setTextColor('#52525b'); // Darker gray for quarterly
            doc.text('Ø Quartals-Ausschüttung:', 20, currentY);
            doc.text(fmtMoney(annualDividendCHF / 4, 'CHF'), 190, currentY, { align: 'right' });

            currentY += 4; // Extra spacing before Yield

            currentY += 8;
            doc.setTextColor('#1e293b');
            doc.text('Brutto-Rendite:', 20, currentY);
            doc.setTextColor(primaryColor);
            doc.text(`${grossYield.toFixed(2)}%`, 190, currentY, { align: 'right' });
        }

        // Footer
        doc.setFontSize(8);
        doc.setTextColor('#52525b');
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

    // Destructure Simulator State
    const { shares, price, dividend, selectedStockId, simName, simSymbol, simIsin, simCurrency, fees, mode } = simulatorState;

    // Watchlist Feedback
    const [showSuccess, setShowSuccess] = useState(false);

    // Price Editing State
    const [activeTab, setActiveTab] = useState<'search' | 'manual'>(selectedStockId === 'new' ? 'manual' : 'search');
    const [searchTerm, setSearchTerm] = useState('');
    const [showStockList, setShowStockList] = useState(false);
    const [hasMounted, setHasMounted] = useState(false);

    // Autofill Prevention State
    const [isNameReadOnly, setIsNameReadOnly] = useState(true);

    useEffect(() => {
        setHasMounted(true);
    }, []);
    const [isEditingPrice, setIsEditingPrice] = useState(false);
    const [editPriceVal, setEditPriceVal] = useState('');

    // Reset edit mode when stock changes
    useEffect(() => {
        setIsEditingPrice(false);
    }, [selectedStockId]);

    // Flag to prevent double-initialization or reset-loops from URL
    const isInitialized = useRef(false);

    // Initial URL-based logic (Reset only once)
    useEffect(() => {
        if (isInitialized.current) return;

        const queryMode = searchParams.get('mode');
        if (queryMode === 'new') {
            updateSimulatorState({
                selectedStockId: 'new',
                simName: '',
                simSymbol: '',
                simCurrency: 'CHF',
                price: 0,
                dividend: 0,
                mode: 'buy'
            });
        }
        isInitialized.current = true;
    }, [searchParams]);

    // Reactive synchronization when stock ID changes
    useEffect(() => {
        if (!selectedStockId || selectedStockId === 'new') return;

        const stock = stocks.find(s => s.id === selectedStockId);
        if (stock) {
            // Determine Stamp Duty
            let newStamp = 0.075;
            if (stock.currency !== 'CHF') newStamp = 0.15;

            // Calculate Annual Dividend
            let annualDiv = stock.dividendAmount || 0;
            if (stock.dividendFrequency === 'quarterly') annualDiv *= 4;
            else if (stock.dividendFrequency === 'monthly') annualDiv *= 12;
            else if (stock.dividendFrequency === 'semi-annually') annualDiv *= 2;

            // Update state ONLY if it's different to prevent loops
            if (stock.currency !== simCurrency || stock.symbol !== simSymbol) {
                updateSimulatorState({
                    simName: stock.name,
                    simSymbol: stock.symbol,
                    simIsin: stock.isin || '',
                    simCurrency: stock.currency,
                    price: stock.currentPrice,
                    dividend: annualDiv,
                    fees: { ...fees, stampDutyPercent: newStamp },
                });
            }
        }
    }, [selectedStockId, stocks]);

    // Derived Logic & Currency Conversion for TOTALS only
    // 1. Calculate Volume in Native Currency
    const volumeNative = shares * price;

    // 2. Convert to CHF for Fees & Total Display
    // Helper to get CHF value
    const getCHF = (val: number, currency: string) => {
        if (!currency || currency === 'CHF') return val;

        // Base conversion
        const baseCHF = convertToCHF(val, currency, rates);

        // Apply FX Markup (Bank Fee)
        // BUY: You pay MORE CHF => Rate increases (Multiply by 1 + markup)
        // SELL: You receive LESS CHF => Rate decreases (Multiply by 1 - markup)
        const markup = (fees.fxMarkupPercent || 0) / 100;

        if (mode === 'buy') {
            return baseCHF * (1 + markup);
        } else {
            return baseCHF * (1 - markup);
        }
    };

    const volumeCHF = getCHF(volumeNative, simCurrency || 'CHF');

    // Usually broker fees are defined in CHF/Base Currency or calculated on value.
    // Let's assume fees are calculated on the CHF value of the transaction.
    // Fees Calculation
    const feeCurrency = fees.feeCurrency || 'CHF';
    const isNativeFees = feeCurrency === 'NATIVE';
    // Special handling for GBp (Pence) -> treat Native Fees as GBP (Pounds)
    const isGBp = simCurrency === 'GBp';
    const displayFeeCurrency = (isNativeFees && isGBp) ? 'GBP' : (isNativeFees ? simCurrency : 'CHF');

    // Calculate Fees
    let calcCourtage = 0;
    let calcStamp = 0;
    let totalFeesInFeeCurrency = 0;

    if (isNativeFees) {
        // NATIVE CURRENCY LOGIC
        if (isGBp) {
            // Treat as GBP (Pounds)
            // Volume is in Pence. 
            // Courtage % is of Volume => Result in Pence. Need directly in Pounds (/100).
            const volPence = volumeNative;
            const courtagePence = volPence * (fees.courtagePercent / 100);
            const courtagePoundsDerived = courtagePence / 100;

            // Min is in Pounds
            calcCourtage = Math.max(courtagePoundsDerived, fees.courtageMin);

            // Stamp % of Volume => Result in Pence. Need in Pounds (/100).
            const stampPence = volPence * (fees.stampDutyPercent / 100);
            calcStamp = stampPence / 100;

            // Exchange Fee is in Pounds (Input)
            // Total in Pounds
            totalFeesInFeeCurrency = calcCourtage + calcStamp + fees.exchangeFee;

        } else {
            // Standard Native (e.g. USD, EUR)
            const feeBaseVolume = volumeNative;
            calcCourtage = Math.max(feeBaseVolume * (fees.courtagePercent / 100), fees.courtageMin);
            calcStamp = feeBaseVolume * (fees.stampDutyPercent / 100);
            totalFeesInFeeCurrency = calcCourtage + calcStamp + fees.exchangeFee;
        }
    } else {
        // CHF BASE LOGIC (Default)
        // Everything calculated based on volumeCHF
        calcCourtage = Math.max(volumeCHF * (fees.courtagePercent / 100), fees.courtageMin);
        calcStamp = volumeCHF * (fees.stampDutyPercent / 100);
        totalFeesInFeeCurrency = calcCourtage + calcStamp + fees.exchangeFee;
    }

    // Convert Total Fees to CHF for final summation
    let totalFeesCHF = totalFeesInFeeCurrency;
    if (isNativeFees) {
        // If GBp, we effectively already converted to GBP (Pounds). So convert GBP -> CHF.
        // If other, convert SimCurrency -> CHF.
        const conversionSourceCurrency = isGBp ? 'GBP' : simCurrency;
        totalFeesCHF = convertToCHF(totalFeesInFeeCurrency, conversionSourceCurrency, rates);
    }

    const totalFees = totalFeesCHF;

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
        setShowStockList(false);
        setSearchTerm('');

        if (stockId === 'new') {
            setActiveTab('manual');
            updateSimulatorState({
                selectedStockId: 'new',
                simName: '',
                simSymbol: '',
                simIsin: '',
                simCurrency: 'CHF',
                simType: 'stock',
                simSector: '',
                simValor: '',
                price: 0,
                dividend: 0,
                mode: 'buy'
            });
            return;
        }
        const stock = stocks.find(s => s.id === stockId);
        if (stock) {
            setActiveTab('search');
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
                simIsin: stock.isin || '',
                simCurrency: stock.currency === 'GBp' ? 'GBP' : stock.currency,
                simType: stock.type || 'stock',
                simSector: stock.sector || '',
                simValor: stock.valor || '',
                // If it's accumulating, ignore dividends
                dividend: (stock.distributionPolicy === 'accumulating') ? 0 : (stock.currency === 'GBp' ? annualDiv / 100 : annualDiv),
                price: stock.currency === 'GBp' ? stock.currentPrice / 100 : stock.currentPrice,
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
                    isin: simIsin,
                    valor: simulatorState.simValor,
                    type: simulatorState.simType,
                    currency: (simCurrency as any) || 'CHF',
                    currentPrice: price,
                    previousClose: price,
                    sector: simulatorState.simSector || 'Simuliert',
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

            let effectiveFxRate = 1;
            if (simCurrency && simCurrency !== 'CHF' && volumeNative > 0) {
                effectiveFxRate = volumeCHF / volumeNative;
            }

            addPosition({
                stockId: targetStockId,
                shares: shares,
                buyPriceAvg: effectivePrice,
                averageEntryFxRate: effectiveFxRate
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
        setTimeout(() => {
            setShowSuccess(false);
            if (searchParams.get('from') === 'portfolio') {
                navigate('/portfolio');
            }
        }, 1500);
    };


    const handleAddToWatchlist = () => {
        const fromWatchlist = searchParams.get('from') === 'watchlist';

        if (selectedStockId && selectedStockId !== 'new') {
            addToWatchlist(selectedStockId);
            setShowSuccess(true);
            setTimeout(() => {
                setShowSuccess(false);
                if (fromWatchlist) navigate('/watchlist');
            }, 1000);
        } else {
            // Create New Stock
            if (!simName || !simSymbol) return;
            const newId = addStock({
                symbol: simSymbol,
                name: simName,
                isin: simIsin,
                valor: simulatorState.simValor,
                type: simulatorState.simType,
                currency: simCurrency as any || 'CHF',
                currentPrice: price,
                previousClose: price,
                sector: simulatorState.simSector || 'Simuliert',
                dividendAmount: dividend,
                dividendYield: price > 0 ? (dividend / price) * 100 : 0,
                dividendFrequency: 'annually'
            });
            addToWatchlist(newId);
            updateSimulatorState({ selectedStockId: newId });
            setShowSuccess(true);
            setTimeout(() => {
                setShowSuccess(false);
                if (fromWatchlist) navigate('/watchlist');
            }, 1000);
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
            <div className="flex flex-col gap-6">

                {/* Integrated Investment Simulator (Full Width) */}
                <div className="w-full space-y-4">
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

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                            <div className="space-y-4">
                                {/* Tabs Selection - Exact Match with AddPositionModal */}
                                <div className="flex border-b border-border">
                                    <button
                                        onClick={() => {
                                            setActiveTab('search');
                                            if (selectedStockId === 'new') updateSimulatorState({ selectedStockId: '' });
                                        }}
                                        className={cn(
                                            "flex-1 py-3 text-sm font-medium border-b-2 transition-colors flex items-center justify-center gap-2",
                                            activeTab === 'search'
                                                ? "border-primary text-primary"
                                                : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30"
                                        )}
                                    >
                                        <Search className="size-4" /> Suchliste
                                    </button>
                                    <button
                                        onClick={() => {
                                            setActiveTab('manual');
                                            handleStockSelect('new');
                                        }}
                                        className={cn(
                                            "flex-1 py-3 text-sm font-medium border-b-2 transition-colors flex items-center justify-center gap-2",
                                            activeTab === 'manual'
                                                ? "border-primary text-primary"
                                                : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30"
                                        )}
                                    >
                                        <PlusCircle className="size-4" /> Manuell hinzufügen
                                    </button>
                                </div>

                                {activeTab === 'search' ? (
                                    <div className="space-y-4 pt-2">
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium">Aktie / ETF auswählen</label>
                                            {!selectedStockId || selectedStockId === 'new' ? (
                                                <>
                                                    <div className="relative">
                                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                                                        <input
                                                            type="text"
                                                            placeholder="Name oder Symbol suchen..."
                                                            value={searchTerm}
                                                            onChange={(e) => {
                                                                setSearchTerm(e.target.value);
                                                                setShowStockList(true);
                                                            }}
                                                            onFocus={() => setShowStockList(true)}
                                                            className="w-full pl-9 pr-4 py-2 border border-border rounded-lg bg-background focus:ring-2 focus:ring-primary/20"
                                                        />
                                                    </div>
                                                    {showStockList && searchTerm && (
                                                        <div className="max-h-60 overflow-y-auto border border-border rounded-lg divide-y divide-border bg-card shadow-lg z-50 mt-1">
                                                            {stocks
                                                                .filter(s =>
                                                                    s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                                                    s.symbol.toLowerCase().includes(searchTerm.toLowerCase())
                                                                )
                                                                .map(stock => (
                                                                    <button
                                                                        key={stock.id}
                                                                        type="button"
                                                                        onClick={() => handleStockSelect(stock.id)}
                                                                        className="w-full p-3 hover:bg-muted transition-colors text-left flex items-center gap-3"
                                                                    >
                                                                        <div className="size-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold border border-primary/20">
                                                                            {stock.symbol.slice(0, 2)}
                                                                        </div>
                                                                        <div className="flex-1">
                                                                            <div className="font-semibold flex items-center gap-2">
                                                                                {stock.name}
                                                                                {stock.type === 'etf' && <span className="text-[10px] bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 px-1.5 py-0.5 rounded">ETF</span>}
                                                                            </div>
                                                                            <div className="text-sm text-muted-foreground">
                                                                                {stock.symbol} • {stock.sector}
                                                                            </div>
                                                                        </div>
                                                                        <div className="text-right">
                                                                            <div className="font-medium">
                                                                                {stock.currentPrice.toLocaleString('de-CH', { style: 'currency', currency: stock.currency === 'GBp' ? 'GBP' : stock.currency })}
                                                                            </div>
                                                                        </div>
                                                                    </button>
                                                                ))}
                                                        </div>
                                                    )}
                                                </>
                                            ) : (
                                                <div className="p-4 border border-border rounded-lg bg-muted/30 flex items-center gap-3 animate-in fade-in zoom-in-95">
                                                    {stocks.find(s => s.id === selectedStockId)?.logoUrl ? (
                                                        <div className="size-12 rounded-lg p-1 bg-white border border-border flex items-center justify-center overflow-hidden">
                                                            <img
                                                                src={stocks.find(s => s.id === selectedStockId)?.logoUrl}
                                                                alt="Logo"
                                                                className="w-full h-full object-contain"
                                                            />
                                                        </div>
                                                    ) : (
                                                        <div className="size-12 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold border border-primary/20">
                                                            {stocks.find(s => s.id === selectedStockId)?.symbol.slice(0, 2)}
                                                        </div>
                                                    )}
                                                    <div className="flex-1">
                                                        <div className="font-semibold">{stocks.find(s => s.id === selectedStockId)?.name}</div>
                                                        <div className="text-sm text-muted-foreground">
                                                            {stocks.find(s => s.id === selectedStockId)?.symbol} • {stocks.find(s => s.id === selectedStockId)?.currentPrice.toLocaleString('de-CH', { style: 'currency', currency: stocks.find(s => s.id === selectedStockId)?.currency === 'GBp' ? 'GBP' : stocks.find(s => s.id === selectedStockId)?.currency })}
                                                        </div>
                                                    </div>
                                                    <button
                                                        onClick={() => updateSimulatorState({ selectedStockId: '' })}
                                                        className="text-muted-foreground hover:text-foreground p-1"
                                                        title="Auswahl entfernen"
                                                    >
                                                        <X className="size-5" />
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="space-y-4 pt-2 animate-in fade-in slide-in-from-right-2">
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="col-span-2">
                                                <label className="text-sm font-medium mb-2 block">Typ</label>
                                                <div className="flex gap-4">
                                                    <label className={cn(
                                                        "flex-1 flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors",
                                                        simulatorState.simType === 'stock' ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border hover:bg-muted/50"
                                                    )}>
                                                        <input type="radio" name="type" className="sr-only" checked={simulatorState.simType === 'stock'} onChange={() => updateSimulatorState({ simType: 'stock' })} />
                                                        <BarChart3 className={cn("size-5", simulatorState.simType === 'stock' ? "text-primary" : "text-muted-foreground")} />
                                                        <span className="font-medium">Aktie</span>
                                                    </label>
                                                    <label className={cn(
                                                        "flex-1 flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors",
                                                        simulatorState.simType === 'etf' ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border hover:bg-muted/50"
                                                    )}>
                                                        <input type="radio" name="type" className="sr-only" checked={simulatorState.simType === 'etf'} onChange={() => updateSimulatorState({ simType: 'etf' })} />
                                                        <PieChart className={cn("size-5", simulatorState.simType === 'etf' ? "text-primary" : "text-muted-foreground")} />
                                                        <span className="font-medium">ETF</span>
                                                    </label>
                                                </div>
                                            </div>

                                            <div className="space-y-2">
                                                <label className="text-sm font-medium">
                                                    {simulatorState.simType === 'etf' ? 'ETF Name' : 'Aktien Name'}
                                                </label>
                                                <input required
                                                    type="text"
                                                    id="calc_stock_name_input_v2"
                                                    autoComplete="off"
                                                    readOnly={isNameReadOnly}
                                                    onFocus={() => setIsNameReadOnly(false)}
                                                    data-lpignore="true"
                                                    data-1p-ignore="true"
                                                    data-form-type="other"
                                                    name="calc_stock_name_field_v2"
                                                    placeholder="z.B. Nestlé S.A."
                                                    className="w-full px-3 py-2 border rounded-md bg-background text-foreground"
                                                    value={simName} onChange={e => updateSimulatorState({ simName: e.target.value })} />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-sm font-medium">Symbol</label>
                                                <input required placeholder="z.B. NESN" className="w-full px-3 py-2 border rounded-md uppercase bg-background text-foreground"
                                                    value={simSymbol} onChange={e => updateSimulatorState({ simSymbol: e.target.value.toUpperCase() })} />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-sm font-medium">Sektor (Optional)</label>
                                                <input placeholder="z.B. Konsumgüter" className="w-full px-3 py-2 border rounded-md bg-background text-foreground"
                                                    value={simulatorState.simSector} onChange={e => updateSimulatorState({ simSector: e.target.value })} aria-label="Sektor" />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-sm font-medium">Währung</label>
                                                <select className="w-full px-3 py-2 border rounded-md bg-background text-foreground"
                                                    value={simCurrency} onChange={e => updateSimulatorState({ simCurrency: e.target.value })} aria-label="Währung">
                                                    <option value="USD">USD</option>
                                                    <option value="CHF">CHF</option>
                                                    <option value="EUR">EUR</option>
                                                    <option value="GBP">GBP (Pfund)</option>
                                                </select>
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-sm font-medium">Valor (Optional)</label>
                                                <input placeholder="z.B. 3886335" className="w-full px-3 py-2 border rounded-md bg-background text-foreground"
                                                    value={simulatorState.simValor} onChange={e => updateSimulatorState({ simValor: e.target.value })} aria-label="Valor" />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-sm font-medium">ISIN (Optional)</label>
                                                <input
                                                    placeholder="z.B. CH00..."
                                                    className="w-full px-3 py-2 border rounded-md bg-background text-foreground"
                                                    value={simIsin}
                                                    onChange={e => updateSimulatorState({ simIsin: e.target.value })}
                                                    onKeyDown={async (e) => {
                                                        if (e.key === 'Enter' && simIsin.length > 5) {
                                                            const results = await searchStocks(simIsin);
                                                            if (results && results.length > 0) {
                                                                const best = results[0];

                                                                // 1. Basic Info from Search
                                                                updateSimulatorState({
                                                                    simName: best.longname || best.shortname || best.symbol,
                                                                    simSymbol: best.symbol,
                                                                    simType: best.typeDisp === 'ETF' || best.quoteType === 'ETF' ? 'etf' : 'stock'
                                                                });

                                                                // 2. Fetch Details (Price & Currency)
                                                                // We reuse the exact logic from "Kurs laden" button
                                                                // The file has fetchStockHistory imported. 
                                                                // Let's use fetchStockHistory like the button does.

                                                                try {
                                                                    const res = await fetchStockHistory(best.symbol, '1D');
                                                                    if (res.data && res.data.length > 0) {
                                                                        let val = res.data[res.data.length - 1].value;
                                                                        const curr = res.currency || 'CHF'; // API often returns currency in meta

                                                                        // GBp check
                                                                        if (curr === 'GBp') {
                                                                            const isLSE = best.symbol.toUpperCase().endsWith('.L') || (simIsin && simIsin.startsWith('GB'));
                                                                            if (isLSE && val > 50) val /= 100;
                                                                            updateSimulatorState({ simCurrency: 'GBP', price: val });
                                                                        } else {
                                                                            updateSimulatorState({ simCurrency: curr, price: val });
                                                                        }
                                                                    }
                                                                } catch (err) {
                                                                    console.error("Auto-fetch price failed", err);
                                                                }
                                                            }
                                                        }
                                                    }}
                                                    aria-label="ISIN"
                                                />
                                            </div>
                                            <div className="space-y-2 col-span-1">
                                                <div className="flex justify-between items-center">
                                                    <label className="text-sm font-medium whitespace-nowrap overflow-hidden text-ellipsis">
                                                        Aktueller Aktien Kurs {simCurrency ? `(${simCurrency === 'GBp' ? 'GBP' : simCurrency})` : ''}
                                                    </label>
                                                    {(simSymbol || simName) && (
                                                        <button
                                                            type="button"
                                                            onClick={async () => {
                                                                const s = simSymbol || simName;
                                                                if (!s) return;
                                                                const res = await fetchStockHistory(s, '1D');
                                                                if (res.data && res.data.length > 0) {
                                                                    let val = res.data[res.data.length - 1].value;
                                                                    if (simCurrency === 'GBP') {
                                                                        const isLSE = s.toUpperCase().endsWith('.L') || (simIsin && simIsin.startsWith('GB'));
                                                                        if (isLSE && val > 50) val /= 100;
                                                                    }
                                                                    updateSimulatorState({ price: val });
                                                                }
                                                            }}
                                                            className="text-[10px] flex items-center gap-1 text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/20 dark:text-blue-400 px-2 py-0.5 rounded transition-colors"
                                                        >
                                                            <RefreshCw className="size-3" /> Kurs laden
                                                        </button>
                                                    )}
                                                </div>
                                                <input required type="number" step="0.01" placeholder="z.B. 98.50" className="w-full px-3 py-2 border rounded-md bg-background text-foreground"
                                                    value={simCurrency === 'GBP' ? parseFloat(price.toFixed(4)) : parseFloat(price.toFixed(2))}
                                                    onChange={e => updateSimulatorState({ price: parseFloat(e.target.value) || 0 })} aria-label="Kaufpreis" />
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Current Position Info & Edit */}
                                {(() => {
                                    const currentPos = positions.find(p => p.stockId === selectedStockId);
                                    if (!currentPos) return null;

                                    // Fix GBp display: If stock is GBp, buyPriceAvg is key.
                                    const stock = stocks.find(s => s.id === selectedStockId);
                                    let displayAvgPrice = currentPos.buyPriceAvg;
                                    let displayCurrency: string = stock?.currency || 'CHF';

                                    // GBp is now auto-converted to GBP in state, so we just check for GBP
                                    if (displayCurrency === 'GBp') {
                                        displayCurrency = 'GBP';
                                        displayAvgPrice = currentPos.buyPriceAvg / 100;
                                    }

                                    return (
                                        <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg border border-border/50 mb-6">
                                            {/* Shares */}
                                            <div className="flex flex-col items-center gap-1">
                                                <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Bestand</span>
                                                <span className="text-xl font-medium">{currentPos.shares} Stk.</span>
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
                                                            {displayAvgPrice.toLocaleString('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {simCurrency === 'GBp' ? 'GBP' : (simCurrency || 'CHF')}
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
                                                <span className="text-xl font-medium">
                                                    {(displayAvgPrice * currentPos.shares).toLocaleString('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {simCurrency === 'GBp' ? 'GBP' : (simCurrency || 'CHF')}
                                                </span>
                                            </div>
                                        </div>

                                    );
                                })()}
                                {/* Transaction details below selector always visible */}

                                {/* Core Inputs - Compact Grid */}
                                <div className="grid grid-cols-3 gap-3">
                                    <div className="space-y-1">
                                        <label className="text-[10px] uppercase font-medium text-muted-foreground">Anzahl Anteile</label>
                                        <LocalNumberInput
                                            value={shares}
                                            onChange={(val) => updateSimulatorState({ shares: val })}
                                            className="w-full px-2 py-1.5 text-lg rounded-md border border-input bg-background/50 text-foreground text-right font-mono focus:ring-1 focus:ring-primary no-spinner"
                                        />
                                        {price > 0 && dividend > 0 && (
                                            <div className="text-sm text-green-600 font-medium text-right mt-1">
                                                {((dividend / price) * 100).toFixed(2)}% Brutto
                                            </div>
                                        )}
                                    </div>
                                    <div className="space-y-1">
                                        <div className="flex justify-between items-center">
                                            <label className="text-[10px] uppercase font-medium text-muted-foreground whitespace-nowrap">
                                                Kaufpreis ({simCurrency === 'GBp' ? 'GBP' : (simCurrency || 'CHF')})
                                            </label>
                                            {(stocks.find(s => s.id === selectedStockId)?.symbol) && (
                                                <button
                                                    type="button"
                                                    onClick={async () => {
                                                        const stock = stocks.find(s => s.id === selectedStockId);
                                                        if (!stock?.symbol) return;
                                                        const res = await fetchStockHistory(stock.symbol, '1D');
                                                        if (res.data && res.data.length > 0) {
                                                            let val = res.data[res.data.length - 1].value;
                                                            // Use simulator currency for check (should be synced with stock typically, but simulator allows override?)
                                                            // Actually simCurrency is used for display.
                                                            const targetCurr = simCurrency === 'GBp' ? 'GBP' : (simCurrency || 'CHF');

                                                            if (targetCurr === 'GBP') {
                                                                const isLSE = stock.symbol.toUpperCase().endsWith('.L') || (stock.isin && stock.isin.startsWith('GB'));
                                                                if (isLSE && val > 50) val /= 100;
                                                            }
                                                            updateSimulatorState({ price: val });
                                                        }
                                                    }}
                                                    className="text-[10px] flex items-center gap-1 text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/20 dark:text-blue-400 px-1.5 py-0.5 rounded transition-colors -mr-1"
                                                    title="Aktuellen Kurs laden"
                                                >
                                                    <RefreshCw className="size-3" /> Kurs laden
                                                </button>
                                            )}
                                        </div>
                                        <LocalNumberInput
                                            step="0.01"
                                            value={simCurrency === 'GBp' || simCurrency === 'GBP' ? parseFloat(price.toFixed(4)) : parseFloat(price.toFixed(2))}
                                            onChange={(val) => updateSimulatorState({ price: val })}
                                            className="w-full px-2 py-1.5 text-lg rounded-md border border-input bg-background/50 text-foreground text-right font-mono focus:ring-1 focus:ring-primary no-spinner"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] uppercase font-medium text-muted-foreground whitespace-nowrap">
                                            Dividende ({simCurrency === 'GBp' ? 'GBP' : (simCurrency || 'CHF')})
                                        </label>
                                        <LocalNumberInput
                                            step="0.01"
                                            value={dividend}
                                            onChange={(val) => updateSimulatorState({ dividend: val })}
                                            className="w-full px-2 py-1.5 text-lg rounded-md border border-input bg-background/50 text-foreground text-right font-mono focus:ring-1 focus:ring-primary no-spinner"
                                        />
                                    </div>
                                </div>

                                {/* Manual Currency Select - Only show if New Simulation */}
                                {(selectedStockId === 'new' || !selectedStockId) && (
                                    <div className="flex items-center justify-end">
                                        <select
                                            value={simCurrency || 'CHF'}
                                            onChange={(e) => updateSimulatorState({ simCurrency: e.target.value })}
                                            className="text-xs border border-input bg-background text-foreground rounded px-2 py-1 focus:ring-1 focus:ring-primary transition-all"
                                            aria-label="Währung auswählen"
                                        >
                                            <option value="CHF">CHF</option>
                                            <option value="USD">USD</option>
                                            <option value="EUR">EUR</option>
                                            <option value="GBP">GBP</option>
                                            <option value="GBp">GBp (Pence)</option>
                                        </select>
                                    </div>
                                )}

                            </div>

                            <div className="space-y-4">
                                {/* Advanced Fees Section */}
                                {fees.showAdvanced && (
                                    <div className="bg-muted/40 p-3 rounded-md space-y-3 border border-border/50 animate-in fade-in slide-in-from-top-2">
                                        {/* Fee Currency Toggle - Only if foreign stock */}
                                        {simCurrency !== 'CHF' && (
                                            <div className="flex justify-end items-center gap-2 mb-2">
                                                <span className="text-[10px] uppercase text-muted-foreground mr-1">Gebühren in:</span>
                                                <div className="flex bg-background border border-input rounded p-0.5">
                                                    <button
                                                        onClick={() => updateSimulatorState({ fees: { ...fees, feeCurrency: 'CHF' } })}
                                                        className={`px-2 py-0.5 text-[10px] rounded transition-colors ${!fees.feeCurrency || fees.feeCurrency === 'CHF' ? 'bg-primary text-primary-foreground font-bold' : 'text-muted-foreground hover:text-foreground'}`}
                                                    >
                                                        CHF
                                                    </button>
                                                    <button
                                                        onClick={() => updateSimulatorState({ fees: { ...fees, feeCurrency: 'NATIVE' } })}
                                                        className={`px-2 py-0.5 text-[10px] rounded transition-colors ${fees.feeCurrency === 'NATIVE' ? 'bg-primary text-primary-foreground font-bold' : 'text-muted-foreground hover:text-foreground'}`}
                                                    >
                                                        {simCurrency === 'GBp' ? 'GBP' : simCurrency}
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="space-y-1">
                                                <label className="text-[10px] uppercase text-muted-foreground">Courtage %</label>
                                                <LocalNumberInput
                                                    step="0.01"
                                                    value={fees.courtagePercent}
                                                    onChange={(val) => updateSimulatorState({ fees: { ...fees, courtagePercent: val } })}
                                                    className="w-full px-2 py-1 text-sm rounded border border-input bg-background text-foreground text-right no-spinner"
                                                />
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-[10px] uppercase text-muted-foreground">Min. ({displayFeeCurrency})</label>
                                                <LocalNumberInput
                                                    value={fees.courtageMin}
                                                    onChange={(val) => updateSimulatorState({ fees: { ...fees, courtageMin: val } })}
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
                                                <button
                                                    onClick={() => updateSimulatorState({ fees: { ...fees, stampDutyPercent: 0.65 } })}
                                                    className={`flex-1 py-1.5 text-xs border rounded transition-colors flex items-center justify-center gap-2 ${fees.stampDutyPercent === 0.65
                                                        ? 'bg-indigo-600 text-white border-indigo-700 font-bold shadow-sm'
                                                        : 'bg-background hover:bg-muted text-foreground border-input'
                                                        }`}
                                                    title="UK SDRT (0.50%) + CH Stempel (0.15%)"
                                                >
                                                    🇬🇧 UK+CH 0.65%
                                                </button>
                                            </div>
                                        </div>

                                        <div className="flex items-center justify-between gap-4">
                                            <label className="text-[10px] uppercase text-muted-foreground whitespace-nowrap">Börsengebühren</label>
                                            <LocalNumberInput
                                                step="0.01"
                                                value={fees.exchangeFee}
                                                onChange={(val) => updateSimulatorState({ fees: { ...fees, exchangeFee: val } })}
                                                className="w-24 px-2 py-1 text-sm rounded border border-input bg-background text-foreground text-right no-spinner"
                                            />
                                        </div>

                                        <div className="flex items-center justify-between gap-4">
                                            <label className="text-[10px] uppercase text-muted-foreground whitespace-nowrap">FX Marge %</label>
                                            <LocalNumberInput
                                                step="0.01"
                                                value={fees.fxMarkupPercent || 0}
                                                onChange={(val) => updateSimulatorState({ fees: { ...fees, fxMarkupPercent: val } })}
                                                className="w-24 px-2 py-1 text-sm rounded border border-input bg-background text-foreground text-right no-spinner"
                                                title="Wechselkurs-Aufschlag der Bank (typisch 1.5%)"
                                            />
                                        </div>

                                        {/* Distribution Policy Toggle (Specific for ETFs) */}
                                        {((!selectedStockId || selectedStockId === 'new') && simulatorState.simType === 'etf') && (
                                            <div className="flex items-center justify-between gap-4 pt-1">
                                                <label className="text-[10px] uppercase text-muted-foreground whitespace-nowrap">Ausschüttung</label>
                                                <div className="flex bg-background border border-input rounded p-0.5">
                                                    <button
                                                        onClick={() => {
                                                            // Toggle Logic: If switching to 'accumulating', zero out dividend?
                                                            // We might need to store this in simulatorState basically as 'isAccumulating'
                                                            // But simulatorState is flat. Let's assume we handle it via visual feedback or setting Dividend to 0.
                                                            // Actually, we need to extend simulatorState if we want to persist this choice before Saving.
                                                            // FOR NOW: Just use it to set Dividend to 0 visually.
                                                            updateSimulatorState({ dividend: 0 }); // Reset to 0 if 'Accumulating'
                                                            // We can't easily persist 'distributionPolicy without adding it to simulatorState. 
                                                            // Let's add 'distributionPolicy' to simulatorState in context first? 
                                                            // Or just toggle visually? 
                                                            // User asked to select it HERE.
                                                            // So we should probably allow updating it.
                                                            // Let's assume for this step we just zero it out.
                                                            // Ideally we update Context to hold 'distributionPolicy' in simulatorState.
                                                        }}
                                                        className={`px-2 py-0.5 text-[10px] rounded transition-colors ${simulatorState.dividend > 0 ? 'bg-primary text-primary-foreground font-bold' : 'text-muted-foreground hover:text-foreground'}`}
                                                    >
                                                        Ausschüttend
                                                    </button>
                                                    <button
                                                        onClick={() => updateSimulatorState({ dividend: 0 })}
                                                        className={`px-2 py-0.5 text-[10px] rounded transition-colors ${simulatorState.dividend === 0 ? 'bg-primary text-primary-foreground font-bold' : 'text-muted-foreground hover:text-foreground'}`}
                                                    >
                                                        Thesaurierend
                                                    </button>
                                                </div>
                                            </div>
                                        )}

                                        {/* Removed redundant 'Total Gebühren' display as per user request (lower breakdown is sufficient) */}
                                        {/* 
                                    <div className="pt-2 border-t border-border/50 flex justify-between items-center">
                                        <span className="text-xs text-muted-foreground">Total Gebühren</span>
                                        <div className="text-right">
                                            {fees.feeCurrency === 'NATIVE' && (
                                                <div className="text-xs font-mono text-muted-foreground mb-1">
                                                    -{(totalFeesInFeeCurrency).toFixed(2)} {displayFeeCurrency}
                                                </div>
                                            )}
                                            <span className="text-sm font-bold text-red-500">-{totalFees.toFixed(2)} CHF</span>
                                        </div>
                                    </div> 
                                    */}
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

                                        {/* FX Rate Info */}
                                        {simCurrency !== 'CHF' && (
                                            <div className="flex justify-between items-center text-xs text-muted-foreground pt-1">
                                                <span>Wechselkurs:</span>
                                                <div className="flex flex-col items-end">
                                                    <span className="line-through opacity-50 text-[10px]">
                                                        {convertToCHF(1, simCurrency, rates).toFixed(4)}
                                                    </span>
                                                    <span className={mode === 'buy' ? 'text-red-400' : 'text-orange-400'}>
                                                        {(getCHF(1, simCurrency)).toFixed(4)}
                                                        <span className="text-[9px] ml-1">({fees.fxMarkupPercent || 0}%)</span>
                                                    </span>
                                                </div>
                                            </div>
                                        )}

                                        <div className="h-px bg-border my-2" />
                                        <div className="space-y-1 text-xs">
                                            <div className="flex justify-between">
                                                <span>Courtage:</span>
                                                <span className="text-red-500 font-mono">
                                                    {mode === 'buy' ? '+' : '-'} {calcCourtage.toFixed(2)} {displayFeeCurrency}
                                                </span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span>Stempelsteuer:</span>
                                                <span className="text-red-500 font-mono">
                                                    {mode === 'buy' ? '+' : '-'} {calcStamp.toFixed(2)} {displayFeeCurrency}
                                                </span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span>Börsengebühr:</span>
                                                <span className="text-red-500 font-mono">
                                                    {mode === 'buy' ? '+' : '-'} {fees.exchangeFee.toFixed(2)} {displayFeeCurrency}
                                                </span>
                                            </div>
                                            {/* Show Total Fees in CHF if Native is selected */}
                                            {fees.feeCurrency === 'NATIVE' && (
                                                <>
                                                    <div className="flex justify-between pt-1 border-t border-border/50 mt-1">
                                                        <span>Total Gebühren ({displayFeeCurrency}):</span>
                                                        <span className="text-red-500 font-mono">-{totalFeesInFeeCurrency.toFixed(2)} {displayFeeCurrency}</span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                        <span>Total Gebühren (CHF):</span>
                                                        <span className="text-red-500 font-mono">-{totalFees.toFixed(2)} CHF</span>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                        <div className="h-px bg-border my-2" />
                                        <div className="flex justify-between items-center font-bold">
                                            <span>{mode === 'buy' ? 'Investition Total' : 'Netto Erlös'} (CHF):</span>
                                            <span className={mode === 'buy' ? 'text-green-500 dark:text-green-400' : 'text-foreground font-medium font-mono'}>
                                                {mode === 'buy' ? totalInvestCHF.toLocaleString('de-CH', { style: 'currency', currency: 'CHF' }) : totalProceedsCHF.toLocaleString('de-CH', { style: 'currency', currency: 'CHF' })}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Yield Info (Buy Mode) */}
                                    {mode === 'buy' && (
                                        <div className="p-3 bg-primary text-primary-foreground rounded-md space-y-2 text-sm shadow-sm flex items-center justify-between">
                                            <div className="flex justify-between items-center w-full">
                                                <span className="opacity-90">Erw. Jährliche Dividende:</span>
                                                <span className="text-xl font-bold text-primary-foreground">
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
                                    <div className="p-2.5 rounded-lg bg-muted/30 border border-border/50 flex flex-col gap-1">
                                        <span className="text-sm font-bold text-foreground">
                                            {mode === 'buy' ? 'Investition Total' : 'Netto Erlös'} (CHF):
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
                                    <div className="p-2.5 rounded-lg bg-muted/30 border border-border/50 flex flex-col gap-1">
                                        <span className="text-sm font-bold text-foreground">Jährl. Ausschüttung (CHF):</span>
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
                                            : searchParams.get('from') === 'portfolio'
                                                ? 'Position hinzufügen'
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

                    {/* Projection Section (Right Col -> Now Below) */}
                    <div className="w-full space-y-4">
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

                            <div className="h-[300px] w-full min-h-[300px] min-w-0">
                                {hasMounted && (
                                    <ResponsiveContainer width="100%" height="100%" debounce={100} minWidth={1} minHeight={1}>
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
                                )}
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
                </div>
            </div>
        </div>

    );
}
