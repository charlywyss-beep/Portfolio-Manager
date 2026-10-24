import { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Trash2, Search, Pencil, Check, Calculator, ShieldCheck, Sparkles, Sliders, Save, AlertTriangle, Calendar } from 'lucide-react';
import { usePortfolio } from '../context/PortfolioContext';
import { useParams, useNavigate } from 'react-router-dom';
import type { Stock, Currency } from '../types';
import { useCurrencyFormatter } from '../utils/currency';
import { fetchStockHistory, fetchStockQuote } from '../services/yahoo-finance';
import { cn } from '../utils';
import { computeSmartAutoParams, calculateDcfFairValue } from '../utils/fairValue';
import { translateSector } from '../utils/sectorTranslation';

// Helper to get annual factor
const getFrequencyFactor = (freq: string) => {
    switch (freq) {
        case 'monthly': return 12;
        case 'quarterly': return 4;
        case 'semi-annually': return 2;
        case 'annually': return 1;
        default: return 1;
    }
};

// Helper to fix corrupted date years (e.g., 0002 instead of 2026)
const sanitizeDateYear = (dateStr: string, referenceDate?: string): string => {
    if (!dateStr || dateStr.length < 4) return dateStr;

    // Parse year from YYYY-MM-DD format (first 4 chars)
    const year = parseInt(dateStr.substring(0, 4), 10);

    // Check if year is clearly wrong (< 1900 or > 2100)
    if (isNaN(year) || year < 1900 || year > 2100) {
        // Try to use reference date's year
        if (referenceDate && referenceDate.length >= 4) {
            const refYear = parseInt(referenceDate.substring(0, 4), 10);
            if (!isNaN(refYear) && refYear >= 1900 && refYear <= 2100) {
                return refYear.toString() + dateStr.substring(4);
            }
        }
        // Fallback: Use current year
        const thisYear = new Date().getFullYear();
        return thisYear.toString() + dateStr.substring(4);
    }

    return dateStr;
};

export function EditDividendPage() {
    const { stockId } = useParams();
    const navigate = useNavigate();
    const { stocks, positions, updateStockDividend, updateStockPrice, updateStock } = usePortfolio();

    const [selectedStockId, setSelectedStockId] = useState(''); // Local state for selection
    const [stockNameOverride, setStockNameOverride] = useState<string | undefined>(undefined);
    const [symbol, setSymbol] = useState(''); // NEW: Allow editing symbol
    const [isin, setIsin] = useState(''); // NEW: Allow editing ISIN
    const [sector, setSector] = useState(''); // NEW: Allow editing Sector
    const [domain, setDomain] = useState(''); // NEW: For logo generation
    const [price, setPrice] = useState('');
    const [targetPrice, setTargetPrice] = useState('');
    const [sellLimit, setSellLimit] = useState('');
    const [fairValue, setFairValue] = useState('');
    const [amount, setAmount] = useState('');
    const [yieldPercent, setYieldPercent] = useState('');
    const [currency, setCurrency] = useState<Currency>('CHF');
    const [logoUrl, setLogoUrl] = useState('');
    const [exDate, setExDate] = useState('');
    const [payDate, setPayDate] = useState('');
    const [frequency, setFrequency] = useState<'none' | 'quarterly' | 'semi-annually' | 'annually' | 'monthly'>('quarterly');

    const [quarterlyDates, setQuarterlyDates] = useState<{ exDate: string; payDate: string; }[]>([
        { exDate: '', payDate: '' },
        { exDate: '', payDate: '' },
        { exDate: '', payDate: '' },
        { exDate: '', payDate: '' }
    ]);
    const [fvModeTick, setFvModeTick] = useState(0);
    const [isSavedFeedback, setIsSavedFeedback] = useState(false);
    const [isDirty, setIsDirty] = useState(false);
    const [showUnsavedModal, setShowUnsavedModal] = useState(false);

    // Derived state
    const rawId = decodeURIComponent((stockId || selectedStockId || '').trim());
    const stock = stocks.find(s =>
        s.id.trim() === rawId ||
        s.id.toLowerCase() === rawId.toLowerCase() ||
        s.symbol.toLowerCase() === rawId.toLowerCase() ||
        s.isin?.toLowerCase() === rawId.toLowerCase()
    ) || (() => {
        const foundPos = positions.find(p => p.id === rawId || p.stockId === rawId);
        return foundPos ? stocks.find(s => s.id === foundPos.stockId) : undefined;
    })();

    const currentStockId = stock?.id || rawId;

    const inputRef = useRef<HTMLInputElement>(null);

    const handleBack = () => {
        if (isDirty) {
            setShowUnsavedModal(true);
        } else {
            navigate(-1);
        }
    };


    // Pre-fill fields when stock ID changes
    useEffect(() => {
        if (stock) {
            setSymbol(stock.symbol || ''); // Pre-fill symbol
            setIsin(stock.isin || ''); // Pre-fill ISIN
            const existingSector = stock.sector ? translateSector(stock.sector) : '';
            setSector(existingSector); // Pre-fill Sector
            if (!existingSector && stock.symbol) {
                fetchStockQuote(stock.symbol).then(q => {
                    if (q && q.sector) {
                        const translated = translateSector(q.sector);
                        setSector(translated);
                        updateStock(stock.id, { sector: translated });
                    }
                }).catch(() => {});
            }
            setPrice(stock.currentPrice ? stock.currentPrice.toFixed(2) : '');
            setTargetPrice(stock.targetPrice ? stock.targetPrice.toFixed(2) : '');
            setSellLimit(stock.sellLimit ? stock.sellLimit.toFixed(2) : '');
            setFairValue(stock.fairValue ? stock.fairValue.toFixed(2) : '');
            setAmount(stock.dividendAmount?.toString() || '');

            // Recalculate yield on mount to ensure it matches current price/amount
            const currentP = stock.currentPrice;
            const am = stock.dividendAmount;
            const freq = stock.dividendFrequency || 'quarterly';
            if (currentP && am) {
                const factor = getFrequencyFactor(freq);
                const calcYield = ((am * factor) / currentP) * 100;
                setYieldPercent(calcYield.toFixed(2));
            } else {
                setYieldPercent(stock.dividendYield ? stock.dividendYield.toFixed(2) : '');
            }

            setCurrency(stock.dividendCurrency || stock.currency);
            setLogoUrl(stock.logoUrl || '');
            setExDate(stock.dividendExDate || '');
            setPayDate(stock.dividendPayDate || '');
            setFrequency(freq);

            if (stock.dividendDates && stock.dividendDates.length > 0) {
                // Sanitize dates when loading to fix corrupted years
                const dates = stock.dividendDates.map((d: any) => ({
                    exDate: sanitizeDateYear(d.exDate || ''),
                    payDate: sanitizeDateYear(d.payDate || '', d.exDate)
                }));
                while (dates.length < 4) dates.push({ exDate: '', payDate: '' });
                setQuarterlyDates(dates);
            } else if (stock.dividendExDate || stock.dividendPayDate) {
                setQuarterlyDates([
                    {
                        exDate: sanitizeDateYear(stock.dividendExDate || ''),
                        payDate: sanitizeDateYear(stock.dividendPayDate || '', stock.dividendExDate)
                    },
                    { exDate: '', payDate: '' },
                    { exDate: '', payDate: '' },
                    { exDate: '', payDate: '' }
                ]);
            } else {
                setQuarterlyDates(Array(4).fill({ exDate: '', payDate: '' }));
            }
            setIsDirty(false);
            setStockNameOverride(undefined);
        }
    }, [stock?.id, stock?.symbol]);


    // Handlers
    const getEffectivePrice = () => {
        return price ? parseFloat(price) : (stock?.currentPrice || 0);
    };

    const handlePriceChange = (newPrice: string) => {
        setPrice(newPrice);
        const p = parseFloat(newPrice.replace(',', '.'));
        const a = parseFloat(amount.replace(',', '.'));

        if (newPrice && !isNaN(p) && amount && !isNaN(a)) {
            const factor = getFrequencyFactor(frequency);
            const newYield = ((a * factor) / p) * 100;
            if (isFinite(newYield)) {
                setYieldPercent(newYield.toFixed(2));
            }
        }
    };

    const handleYieldChange = (newYield: string) => {
        setYieldPercent(newYield);
        const currentP = getEffectivePrice();
        const y = parseFloat(newYield.replace(',', '.'));

        if (currentP && newYield && !isNaN(y)) {
            const yieldValue = y;
            const factor = getFrequencyFactor(frequency);
            const dividendAmount = ((currentP * yieldValue) / 100) / factor;
            if (isFinite(dividendAmount)) {
                setAmount(dividendAmount.toFixed(4));
            }
        }
    };

    const handleAmountChange = (newAmount: string) => {
        setAmount(newAmount);
        const currentP = getEffectivePrice();
        const a = parseFloat(newAmount.replace(',', '.'));

        if (currentP && newAmount && !isNaN(a)) {
            const dividendAmount = a;
            const factor = getFrequencyFactor(frequency);
            const yieldValue = ((dividendAmount * factor) / currentP) * 100;
            if (isFinite(yieldValue)) {
                setYieldPercent(yieldValue.toFixed(2));
            }
        }
    };

    const handleFrequencyChange = (newFrequency: 'none' | 'quarterly' | 'semi-annually' | 'annually' | 'monthly') => {
        setFrequency(newFrequency);
        // Skip yield recalculation if 'none' is selected
        if (newFrequency === 'none') return;

        const currentP = getEffectivePrice();
        if (amount && currentP && !isNaN(parseFloat(amount))) {
            const dividendAmount = parseFloat(amount);
            const factor = getFrequencyFactor(newFrequency);
            const yieldValue = ((dividendAmount * factor) / currentP) * 100;
            if (isFinite(yieldValue)) {
                setYieldPercent(yieldValue.toFixed(2));
            }
        }
    };

    const handleQuarterlyDateChange = (index: number, field: 'exDate' | 'payDate', value: string) => {
        const newDates = [...quarterlyDates];
        newDates[index] = { ...newDates[index], [field]: value };

        // Auto-set PayDate if ExDate is set and PayDate is empty
        if (field === 'exDate' && value && !newDates[index].payDate) {
            newDates[index].payDate = value;
        }

        setQuarterlyDates(newDates);
    };

    const handleAutoFillExDates = () => {
        if (frequency === 'quarterly' || frequency === 'semi-annually') {
            const newDates = quarterlyDates.map(qd => {
                if (qd.payDate && !qd.exDate) {
                    const p = new Date(qd.payDate);
                    if (!isNaN(p.getTime())) {
                        p.setDate(p.getDate() - 14);
                        return { ...qd, exDate: p.toISOString().split('T')[0] };
                    }
                } else if (qd.exDate && !qd.payDate) {
                    const p = new Date(qd.exDate);
                    if (!isNaN(p.getTime())) {
                        p.setDate(p.getDate() + 14);
                        return { ...qd, payDate: p.toISOString().split('T')[0] };
                    }
                } else if (qd.payDate) {
                    const p = new Date(qd.payDate);
                    if (!isNaN(p.getTime())) {
                        p.setDate(p.getDate() - 14);
                        return { ...qd, exDate: p.toISOString().split('T')[0] };
                    }
                }
                return qd;
            });
            setQuarterlyDates(newDates);
            setIsDirty(true);
        } else {
            if (payDate && !exDate) {
                const p = new Date(payDate);
                if (!isNaN(p.getTime())) {
                    p.setDate(p.getDate() - 14);
                    setExDate(p.toISOString().split('T')[0]);
                    setIsDirty(true);
                }
            } else if (exDate && !payDate) {
                const p = new Date(exDate);
                if (!isNaN(p.getTime())) {
                    p.setDate(p.getDate() + 14);
                    setPayDate(p.toISOString().split('T')[0]);
                    setIsDirty(true);
                }
            }
        }
    };

    const handleSetVanguardSchedule = () => {
        let year = new Date().getFullYear();
        for (const q of quarterlyDates) {
            const d = q.payDate || q.exDate;
            if (d && d.length >= 4) {
                const y = parseInt(d.substring(0, 4));
                if (!isNaN(y) && y >= 2020 && y <= 2035) {
                    year = y;
                    break;
                }
            }
        }

        const newDates = [
            { exDate: `${year}-03-12`, payDate: `${year}-03-26` },
            { exDate: `${year}-06-11`, payDate: `${year}-06-25` },
            { exDate: `${year}-09-10`, payDate: `${year}-09-24` },
            { exDate: `${year}-12-10`, payDate: `${year}-12-23` }
        ];
        setQuarterlyDates(newDates);
        setIsDirty(true);
    };



    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        const targetId = stock?.id || currentStockId;
        if (!targetId) return;

        // Update Price
        if (price && (!stock || parseFloat(price.replace(',', '.')) !== stock.currentPrice)) {
            updateStockPrice(targetId, parseFloat(price.replace(',', '.')));
        }

        // Update Stock Details (Symbol, Logo, Target Price)
        const updates: Partial<Stock> = {};

        // Name Update
        if (stockNameOverride !== undefined && stockNameOverride.trim() !== stock?.name) {
            updates.name = stockNameOverride;
        }

        // Name Update
        if (stockNameOverride !== undefined && stockNameOverride.trim() !== stock?.name) {
            updates.name = stockNameOverride;
        }

        // Symbol update
        if (symbol && (!stock || symbol !== stock.symbol)) {
            updates.symbol = symbol.toUpperCase(); // Ensure uppercase
        }

        if (logoUrl !== undefined && (!stock || logoUrl !== stock.logoUrl)) {
            updates.logoUrl = logoUrl;
        }
        if (isin !== undefined && (!stock || isin !== stock.isin)) {
            updates.isin = isin;
        }
        if (sector !== undefined && (!stock || sector !== stock.sector)) {
            updates.sector = sector;
        }
        if (targetPrice !== undefined && (!stock || (targetPrice ? parseFloat(targetPrice.replace(',', '.')) : undefined) !== stock.targetPrice)) {
            updates.targetPrice = targetPrice ? parseFloat(targetPrice.replace(',', '.')) : undefined;
        }
        if (sellLimit !== undefined && (!stock || (sellLimit ? parseFloat(sellLimit.replace(',', '.')) : undefined) !== stock.sellLimit)) {
            updates.sellLimit = sellLimit ? parseFloat(sellLimit.replace(',', '.')) : undefined;
        }
        if (fairValue !== undefined && (!stock || (fairValue ? parseFloat(fairValue.replace(',', '.')) : undefined) !== stock.fairValue)) {
            updates.fairValue = fairValue ? parseFloat(fairValue.replace(',', '.')) : undefined;
        }
        if (currency && (!stock || currency !== stock.currency)) {
            updates.currency = currency;
        }

        if (Object.keys(updates).length > 0) {
            updateStock(targetId, updates);
        }

        // Dividends Logic - If 'none' frequency, clear all dividend data
        if (frequency === 'none') {
            updateStockDividend(targetId, {
                dividendYield: undefined,
                dividendAmount: undefined,
                dividendCurrency: undefined,
                dividendExDate: undefined,
                dividendPayDate: undefined,
                dividendDates: undefined,
                dividendFrequency: 'none'
            });
        } else {
            let submissionDates = undefined;
            // Sanitize Single/Annual dates
            let submissionExDate = exDate ? sanitizeDateYear(exDate) : undefined;
            let submissionPayDate = payDate ? sanitizeDateYear(payDate, exDate) : undefined;

            if (frequency === 'quarterly' || frequency === 'semi-annually') {
                const datesToConsider = frequency === 'quarterly' ? quarterlyDates : quarterlyDates.slice(0, 2);

                // Sanitize Quarterly dates
                submissionDates = datesToConsider.map(d => ({
                    exDate: sanitizeDateYear(d.exDate || ''),
                    payDate: sanitizeDateYear(d.payDate || '', d.exDate)
                }));

                // Set exDate/payDate from the first available one for display/sorting (optional)
                const firstValid = submissionDates.find(d => d.exDate || d.payDate);
                if (firstValid) {
                    submissionExDate = firstValid.exDate;
                    submissionPayDate = firstValid.payDate;
                }
            }

            updateStockDividend(targetId, {
                dividendYield: yieldPercent ? parseFloat(yieldPercent.replace(',', '.')) : undefined,
                dividendAmount: amount ? parseFloat(amount.replace(',', '.')) : undefined,
                dividendCurrency: currency,
                dividendExDate: submissionExDate || undefined,
                dividendPayDate: submissionPayDate || undefined,
                dividendDates: submissionDates,
                dividendFrequency: frequency
            });
        }

        // Stay on page and show saved feedback
        setIsDirty(false);
        setIsSavedFeedback(true);
        setTimeout(() => setIsSavedFeedback(false), 2000);
    };

    const { rates, formatCurrency } = useCurrencyFormatter();

    const convertAmount = (val: number, from: Currency | string, to: Currency | string) => {
        if (!rates || from === to) return val;

        // 1. Convert to CHF (Base)
        // Handle GBp (Pence) special case: Divide by 100 to get Pounds
        let amountInCHF = 0;
        let rateFrom = rates[from === 'GBp' ? 'GBP' : from] || 1;

        let normalizedFromVal = val;
        if (from === 'GBp') normalizedFromVal = val / 100;

        // If from is CHF, amount is already CHF. Else divide by rate (Currency per CHF)
        if (from === 'CHF') amountInCHF = normalizedFromVal;
        else amountInCHF = normalizedFromVal / rateFrom;

        // 2. Convert CHF to target
        let rateTo = rates[to === 'GBp' ? 'GBP' : to] || 1;
        let result = 0;

        if (to === 'CHF') result = amountInCHF;
        else result = amountInCHF * rateTo;

        // Handle GBp (Pence) target: Multiply by 100
        if (to === 'GBp') result = result * 100;

        return result;
    };

    const handleCurrencyChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const newCurrency = e.target.value as Currency;
        const oldCurrency = currency;
        setCurrency(newCurrency);

        // Auto-Convert Dividend Amount if present
        if (amount && !isNaN(parseFloat(amount))) {
            const currentVal = parseFloat(amount.replace(',', '.'));
            const newVal = convertAmount(currentVal, oldCurrency, newCurrency);
            if (isFinite(newVal)) {
                setAmount(newVal.toFixed(4));
            }
        }
    };

    return (
        <div className="min-h-screen bg-background pb-20">
            {/* Header */}
            <div className="flex items-center gap-3 sm:gap-4 pl-14 pr-4 py-3 md:py-4 md:pl-14 xl:pl-8 border-b border-border bg-background/95 backdrop-blur sticky top-0 z-40 w-full transition-all shadow-sm">
                <button
                    type="button"
                    onClick={handleBack}
                    className="flex items-center justify-center p-1.5 bg-white text-blue-600 border border-blue-100 shadow-md hover:bg-blue-50 transition-all font-medium rounded-lg transform active:scale-95 shrink-0"
                    title="Zurück"
                >
                    <ArrowLeft className="size-5" />
                    <span className="hidden md:inline text-sm ml-1.5">Zurück</span>
                </button>
                <div className="flex-1 flex items-center gap-3 min-w-0">
                    {logoUrl && (
                        <img
                            src={logoUrl}
                            alt="Logo"
                            className="size-9 sm:size-10 rounded-full bg-white object-contain p-1 border border-border shrink-0"
                            onError={(e) => (e.currentTarget.style.display = 'none')}
                        />
                    )}
                    <div className="flex-1 min-w-0">
                        {stock ? (
                            <div className="flex items-center gap-2 group/edit w-full min-w-0">
                                <input
                                    ref={inputRef}
                                    type="text"
                                    className="w-full text-lg sm:text-xl md:text-2xl font-bold bg-transparent border border-transparent hover:border-border focus:border-primary focus:ring-1 focus:ring-primary rounded px-1.5 py-1 -ml-1 transition-all outline-none text-foreground placeholder:text-muted-foreground truncate leading-tight"
                                    value={stockNameOverride !== undefined ? stockNameOverride : stock.name}
                                    onChange={(e) => {
                                        setStockNameOverride(e.target.value);
                                        setIsDirty(true);
                                    }}
                                    placeholder="Name der Position"
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            handleSubmit(e);
                                        }
                                    }}
                                />
                                <button
                                    type="button"
                                    onClick={() => inputRef.current?.focus()}
                                    className="p-1.5 text-muted-foreground hover:text-primary hover:bg-muted/50 rounded-lg transition-all shrink-0"
                                    title="Klicken zum Bearbeiten"
                                >
                                    <Pencil className="size-4" />
                                </button>
                            </div>
                        ) : (
                            <h1 className="text-xl font-bold truncate">Dividende hinzufügen</h1>
                        )}
                        <div className="flex items-center gap-2 text-muted-foreground mt-0.5 text-xs sm:text-sm truncate">
                            <span className="font-bold text-foreground">{stock ? stock.symbol : 'Neue Erfassung'}</span>
                            {stock && (sector || stock.sector) && (sector || stock.sector) !== 'Simuliert' && (
                                <>
                                    <span>•</span>
                                    <span>{translateSector(sector || stock.sector)}</span>
                                </>
                            )}
                        </div>
                    </div>
                </div>

                {/* Always-visible Header Speichern Button */}
                <button
                    type="button"
                    onClick={handleSubmit}
                    className={cn(
                        "flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-xl font-semibold text-xs sm:text-sm transition-all transform active:scale-95 shadow-md shrink-0 ml-auto cursor-pointer",
                        isSavedFeedback
                            ? "bg-emerald-600 text-white shadow-emerald-500/20"
                            : "bg-primary text-primary-foreground hover:bg-primary/90 shadow-primary/20 hover:shadow-lg"
                    )}
                    title="SPEICHERN (Strg + Enter)"
                >
                    {isSavedFeedback ? (
                        <>
                            <Check className="size-4 stroke-[2.5]" />
                            <span>Gespeichert!</span>
                        </>
                    ) : (
                        <>
                            <Save className="size-4" />
                            <span>Speichern</span>
                        </>
                    )}
                </button>
            </div>

            <div className="p-4 sm:p-6 max-w-3xl md:max-w-4xl lg:max-w-5xl mx-auto w-full">
                <form onSubmit={handleSubmit} onChangeCapture={() => setIsDirty(true)} className="space-y-6">

                    {/* Stock Selection if no ID passed */}
                    {!stockId && (
                        <div className="bg-card border border-border rounded-xl p-4 shadow-sm space-y-4">
                            <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">Aktie auswählen</h3>
                            <div className="space-y-2">
                                <select
                                    value={selectedStockId}
                                    onChange={(e) => setSelectedStockId(e.target.value)}
                                    required
                                    className="w-full px-3 py-2 border rounded-md bg-background text-foreground text-lg"
                                >
                                    <option value="">Bitte wählen...</option>
                                    {stocks.map((s) => (
                                        <option key={s.id} value={s.id}>
                                            {s.name} ({s.symbol})
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    )}

                    {(!stockId && !selectedStockId) ? (
                        <div className="text-center text-muted-foreground py-8">
                            Bitte wähle zuerst eine Aktie aus.
                        </div>
                    ) : (
                        <>
                            {/* Stock Definition Section (Symbol & Logo) */}
                            <div className="bg-card border border-border rounded-xl p-4 shadow-sm space-y-4">
                                <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">Stammdaten</h3>
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Symbol (Ticker) <span className="text-xs text-muted-foreground">(für Charts)</span></label>
                                        <div className="relative">
                                            <input
                                                type="text"
                                                value={symbol}
                                                onChange={(e) => setSymbol(e.target.value)}
                                                placeholder="z.B. AAPL oder NESN.SW"
                                                className={cn(
                                                    "w-full px-3 py-2 border rounded-md bg-background text-foreground font-mono uppercase",
                                                    (currency === 'CHF' && symbol && !symbol.toUpperCase().endsWith('.SW')) ? "border-amber-500 focus:ring-amber-500" : ""
                                                )}
                                            />
                                        </div>
                                        {currency === 'CHF' && symbol && !symbol.toUpperCase().endsWith('.SW') && (
                                            <div className="flex items-center gap-2 text-amber-500 animate-pulse mt-1">
                                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-alert-triangle shrink-0"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" /><path d="M12 9v4" /><path d="M12 17h.01" /></svg>
                                                <p className="text-xs font-medium">
                                                    Hinweis: Für <b>CHF</b> Aktien an der Schweizer Börse fehlt meist die Endung <b>.SW</b>
                                                </p>
                                            </div>
                                        )}
                                        <p className="text-[10px] text-muted-foreground">
                                            Nutze Yahoo Finance Symbole (z.B. <b>NESN.SW</b> für Nestle, <b>BATS.L</b> für BAT)
                                        </p>
                                    </div>
                                    <div className="pt-2 flex flex-wrap gap-2">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const query = `${stock?.name || symbol} Yahoo Finance Symbol`;
                                                window.open(`https://www.google.com/search?q=${encodeURIComponent(query)}`, '_blank');
                                            }}
                                            className="flex-1 px-2 py-1.5 bg-secondary text-secondary-foreground text-xs font-medium rounded-md hover:bg-secondary/80 border border-border whitespace-nowrap"
                                            title="Global Search (US/UK)"
                                        >
                                            Global
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const query = `${stock?.name || symbol} Frankfurt Yahoo Finance Symbol`;
                                                window.open(`https://www.google.com/search?q=${encodeURIComponent(query)}`, '_blank');
                                            }}
                                            className="flex-1 px-2 py-1.5 bg-secondary text-secondary-foreground text-xs font-medium rounded-md hover:bg-secondary/80 border border-border whitespace-nowrap"
                                            title="Frankfurt (.F)"
                                        >
                                            Frankfurt
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const query = `${stock?.name || symbol} Xetra Yahoo Finance Symbol`;
                                                window.open(`https://www.google.com/search?q=${encodeURIComponent(query)}`, '_blank');
                                            }}
                                            className="flex-1 px-2 py-1.5 bg-secondary text-secondary-foreground text-xs font-medium rounded-md hover:bg-secondary/80 border border-border whitespace-nowrap"
                                            title="Xetra (.DE)"
                                        >
                                            Xetra
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const query = `${stock?.name || symbol} SIX Swiss Exchange Yahoo Finance Symbol`;
                                                window.open(`https://www.google.com/search?q=${encodeURIComponent(query)}`, '_blank');
                                            }}
                                            className="flex-1 px-2 py-1.5 bg-secondary text-secondary-foreground text-xs font-medium rounded-md hover:bg-secondary/80 border border-border whitespace-nowrap"
                                            title="Schweiz (.SW)"
                                        >
                                            Schweiz
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const query = `${stock?.name || symbol} London Stock Exchange Yahoo Finance Symbol`;
                                                window.open(`https://www.google.com/search?q=${encodeURIComponent(query)}`, '_blank');
                                            }}
                                            className="flex-1 px-2 py-1.5 bg-secondary text-secondary-foreground text-xs font-medium rounded-md hover:bg-secondary/80 border border-border whitespace-nowrap"
                                            title="London (.L)"
                                        >
                                            London
                                        </button>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">ISIN</label>
                                        <input
                                            type="text"
                                            value={isin}
                                            onChange={(e) => setIsin(e.target.value)}
                                            placeholder="z.B. CH0038863350"
                                            className="w-full px-3 py-2 border rounded-md bg-background text-foreground font-mono uppercase"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Sektor</label>
                                        <input
                                            type="text"
                                            value={sector}
                                            onChange={(e) => setSector(e.target.value)}
                                            placeholder="z.B. Technologie oder Konsumgüter"
                                            className="w-full px-3 py-2 border rounded-md bg-background text-foreground"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Logo URL</label>
                                        <div className="flex gap-2">
                                            <input
                                                type="url"
                                                placeholder="https://example.com/logo.png"
                                                value={logoUrl}
                                                onChange={(e) => setLogoUrl(e.target.value)}
                                                className="flex-1 px-3 py-2 border rounded-md bg-background text-foreground text-xs"
                                            />
                                            {logoUrl && (
                                                <img
                                                    src={logoUrl}
                                                    alt="Preview"
                                                    className="size-9 rounded-md border border-border bg-white object-contain p-1"
                                                    onError={(e) => (e.currentTarget.style.display = 'none')}
                                                />
                                            )}
                                        </div>

                                        <div className="pt-2 flex flex-col gap-2">
                                            <div className="flex gap-2 items-end">
                                                <div className="flex-1 space-y-1">
                                                    <label className="text-[10px] text-muted-foreground uppercase font-semibold">Domain für Logo</label>
                                                    <input
                                                        type="text"
                                                        placeholder="z.B. novartis.com"
                                                        value={domain}
                                                        onChange={(e) => setDomain(e.target.value)}
                                                        className="w-full px-3 py-2 border rounded-md bg-background text-foreground text-sm"
                                                    />
                                                </div>
                                            </div>
                                            <div className="flex gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        if (!domain) return;
                                                        let clean = domain.toLowerCase().replace('https://', '').replace('http://', '').replace('www.', '');
                                                        if (clean.includes('/')) clean = clean.split('/')[0];
                                                        setLogoUrl(`https://logo.clearbit.com/${clean}`);
                                                    }}
                                                    disabled={!domain}
                                                    className="flex-1 px-3 py-2 bg-secondary text-secondary-foreground text-xs font-medium rounded-md hover:bg-secondary/80 border border-border disabled:opacity-50"
                                                >
                                                    Clearbit Logo
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        if (!domain) return;
                                                        let clean = domain.toLowerCase().replace('https://', '').replace('http://', '').replace('www.', '');
                                                        if (clean.includes('/')) clean = clean.split('/')[0];
                                                        setLogoUrl(`https://www.google.com/s2/favicons?domain=${clean}&sz=128`);
                                                    }}
                                                    disabled={!domain}
                                                    className="flex-1 px-3 py-2 bg-secondary text-secondary-foreground text-xs font-medium rounded-md hover:bg-secondary/80 border border-border disabled:opacity-50"
                                                >
                                                    Google Icon
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        if (!domain) return;
                                                        let clean = domain.toLowerCase().replace('https://', '').replace('http://', '').replace('www.', '');
                                                        if (clean.includes('/')) clean = clean.split('/')[0];
                                                        setLogoUrl(`https://icons.duckduckgo.com/ip3/${clean}.ico`);
                                                    }}
                                                    disabled={!domain}
                                                    className="flex-1 px-3 py-2 bg-secondary text-secondary-foreground text-xs font-medium rounded-md hover:bg-secondary/80 border border-border disabled:opacity-50"
                                                >
                                                    DDG Icon
                                                </button>
                                            </div>
                                            <div className="pt-1">
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        const query = stock ? `${stock.name} logo transparent` : `${symbol || domain} logo transparent`;
                                                        window.open(`https://www.google.com/search?q=${encodeURIComponent(query)}&tbm=isch`, '_blank');
                                                    }}
                                                    className="w-full text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center justify-center gap-1"
                                                >
                                                    <Search className="size-3" /> Logo auf Google suchen
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Price Section */}
                            <div className="bg-card border border-border rounded-xl p-4 shadow-sm space-y-4">
                                <div className="flex items-center justify-between">
                                    <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">Kursdaten</h3>
                                    {currentStockId && (
                                        <button
                                            type="button"
                                            onClick={() => navigate(`/calculator?stock=${encodeURIComponent(String(currentStockId))}`)}
                                            className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-lg bg-blue-600/20 hover:bg-blue-600/35 text-blue-300 border border-blue-400/30 transition-colors"
                                            title="Aktie direkt in Kauf / Verkauf öffnen"
                                        >
                                            <Calculator className="size-3.5" />
                                            <span>Kauf / Verkauf</span>
                                        </button>
                                    )}
                                </div>

                                {/* Kaufpreis Average Display */}
                                {stocks.find(s => String(s.id) === String(currentStockId) || (stock && s.symbol.toLowerCase() === stock.symbol.toLowerCase())) && positions.find(p => String(p.stockId) === String(currentStockId) || (stock && p.stockId === stock.id)) && (
                                    <div className="flex justify-between items-center py-2 px-3 bg-muted/30 rounded-lg border border-border/50 mb-2">
                                        <label className="text-sm font-medium text-muted-foreground">Kaufpreis Ø</label>
                                        <span className="font-mono font-medium">
                                            {formatCurrency(
                                                positions.find(p => String(p.stockId) === String(currentStockId) || (stock && p.stockId === stock.id))?.buyPriceAvg || 0,
                                                stocks.find(s => String(s.id) === String(currentStockId))?.currency || 'CHF'
                                            )}
                                        </span>
                                    </div>
                                )}

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="flex flex-col h-full gap-2">
                                        <div className="flex justify-between items-center min-h-[28px]">
                                            <label className="text-sm font-medium">Aktueller Kurs <span className="text-xs text-muted-foreground">({currency === 'GBp' ? 'GBP' : currency})</span></label>
                                            {symbol && (
                                                <button
                                                    type="button"
                                                    onClick={async () => {
                                                        const [res, q] = await Promise.all([
                                                            fetchStockHistory(symbol, '1D'),
                                                            fetchStockQuote(symbol).catch(() => null)
                                                        ]);
                                                        if (res?.data && res.data.length > 0) {
                                                            let val = res.data[res.data.length - 1].value;

                                                            setPrice(val.toFixed(2));

                                                            // Auto-sync yield
                                                            const am = parseFloat(amount.replace(',', '.'));
                                                            if (!isNaN(am) && val > 0) {
                                                                const factor = getFrequencyFactor(frequency);
                                                                const yieldValue = ((am * factor) / val) * 100;
                                                                if (isFinite(yieldValue)) {
                                                                    setYieldPercent(yieldValue.toFixed(2));
                                                                }
                                                            }
                                                        }
                                                        if (q && q.sector && !sector) {
                                                            const translated = translateSector(q.sector);
                                                            setSector(translated);
                                                            if (currentStockId) {
                                                                updateStock(currentStockId, { sector: translated });
                                                            }
                                                        }
                                                    }}
                                                    className="text-xs flex items-center gap-1 text-blue-600 hover:text-blue-700 bg-blue-50 dark:bg-blue-900/20 px-2 py-0.5 rounded transition-colors"
                                                    title="Kurs von Yahoo Finance laden"
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-refresh-cw"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" /><path d="M21 3v5h-5" /><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" /><path d="M3 21v-5h5" /></svg>
                                                    Kurs laden
                                                </button>
                                            )}
                                        </div>
                                        <input
                                            type="text"
                                            inputMode="decimal"
                                            autoComplete="off"
                                            step="0.01"
                                            required
                                            value={price}
                                            onChange={(e) => handlePriceChange(e.target.value)}
                                            onFocus={(e) => e.target.select()}
                                            className="w-full px-3 py-2 border rounded-md bg-background text-foreground text-lg mt-auto"
                                        />
                                    </div>
                                    {(() => {
                                        void fvModeTick;
                                        const currentStockObj = stocks.find(s => String(s.id) === String(currentStockId));
                                        const symKey = (currentStockObj?.symbol || symbol || '').toUpperCase();
                                        let localParams: any = null;
                                        try {
                                            const mapRaw = localStorage.getItem('fair_value_params_map');
                                            if (symKey && mapRaw) {
                                                const map = JSON.parse(mapRaw);
                                                if (map[symKey]) localParams = map[symKey];
                                            }
                                        } catch {
                                            // ignore
                                        }
                                        const stockParams = currentStockObj?.fairValueParams;
                                        let activeParams = stockParams || localParams;
                                        if (localParams && stockParams) {
                                            const localTime = localParams.updatedAt ? new Date(localParams.updatedAt).getTime() : 0;
                                            const stockTime = stockParams.updatedAt ? new Date(stockParams.updatedAt).getTime() : 0;
                                            activeParams = localTime >= stockTime ? localParams : stockParams;
                                        }

                                        const effectivePrice = parseFloat((price || '').toString().replace(',', '.')) || currentStockObj?.currentPrice || 0;
                                        const parsedYield = parseFloat((yieldPercent || '').toString().replace(',', '.'));
                                        const effectiveYield = !isNaN(parsedYield) && parsedYield >= 0 ? parsedYield : currentStockObj?.dividendYield;
                                        const smartAutoConservative = computeSmartAutoParams(
                                            { price: effectivePrice, dividendYield: effectiveYield },
                                            null,
                                            currentStockObj,
                                            symKey,
                                            'conservative'
                                        );
                                        const smartAutoQuality = computeSmartAutoParams(
                                            { price: effectivePrice, dividendYield: effectiveYield },
                                            null,
                                            currentStockObj,
                                            symKey,
                                            'quality'
                                        );

                                        const parsedFv = parseFloat((fairValue || '').toString().replace(',', '.'));
                                        const isManualFv = Boolean(activeParams?.isCustom);
                                        const currentValuationMode: 'conservative' | 'quality' = activeParams?.valuationMode === 'quality' ? 'quality' : 'conservative';
                                        const currentMode: 'conservative' | 'quality' | 'manual' = isManualFv ? 'manual' : currentValuationMode;

                                        let mosPct = 20;
                                        if (currentMode === 'manual') {
                                             mosPct = activeParams?.mos ?? smartAutoConservative.mos ?? 20;
                                        } else if (currentMode === 'quality') {
                                             mosPct = (activeParams?.valuationMode === 'quality' && !activeParams?.isCustom && activeParams?.mos) ? activeParams.mos : smartAutoQuality.mos;
                                        } else {
                                             mosPct = (activeParams?.valuationMode === 'conservative' && !activeParams?.isCustom && activeParams?.mos) ? activeParams.mos : smartAutoConservative.mos;
                                        }

                                        const calcBuyPrice = !isNaN(parsedFv) && parsedFv > 0 ? parsedFv * (1 - mosPct / 100) : null;

                                        const handleToggleFvMode = () => {
                                            if (!symKey) return;
                                            const now = new Date().toISOString();
                                            let map: Record<string, any> = {};
                                            try {
                                                const mapRaw = localStorage.getItem('fair_value_params_map');
                                                if (mapRaw) map = JSON.parse(mapRaw);
                                            } catch {
                                                // ignore
                                            }
                                            const existingLocal = map[symKey] || {};
                                            const existingBackup = existingLocal.customBackup || stockParams?.customBackup || (activeParams?.isCustom ? activeParams : null);

                                            if (currentMode === 'conservative') {
                                                // Switch to Qualität (B)
                                                const dcfQuality = calculateDcfFairValue(smartAutoQuality, effectivePrice);
                                                const newFv = parseFloat(dcfQuality.fairValue.toFixed(2));
                                                const nextEntry = {
                                                    ...smartAutoQuality,
                                                    isCustom: false,
                                                    valuationMode: 'quality' as const,
                                                    ...(existingBackup ? { customBackup: existingBackup } : {}),
                                                    updatedAt: now
                                                };
                                                map[symKey] = nextEntry;
                                                try {
                                                    localStorage.setItem('fair_value_params_map', JSON.stringify(map));
                                                } catch {
                                                    // ignore
                                                }
                                                if (newFv > 0) {
                                                    setFairValue(newFv.toFixed(2));
                                                }
                                                if (currentStockObj) {
                                                    updateStock(currentStockObj.id, {
                                                        ...(newFv > 0 ? { fairValue: newFv } : {}),
                                                        fairValueParams: nextEntry
                                                    });
                                                }
                                            } else if (currentMode === 'quality') {
                                                // Switch to Manuell
                                                const backupToRestore = existingBackup || {
                                                    ...(activeParams || smartAutoQuality),
                                                    ...(!isNaN(parsedFv) && parsedFv > 0 ? { manualFairValue: parsedFv } : {})
                                                };
                                                const restoredDcf = calculateDcfFairValue(backupToRestore, effectivePrice);
                                                const newManualFv = (backupToRestore.manualFairValue && Number(backupToRestore.manualFairValue) > 0)
                                                    ? parseFloat(Number(backupToRestore.manualFairValue).toFixed(2))
                                                    : parseFloat(restoredDcf.fairValue.toFixed(2));

                                                const nextEntry = {
                                                    ...backupToRestore,
                                                    isCustom: true,
                                                    customBackup: backupToRestore,
                                                    updatedAt: now
                                                };
                                                map[symKey] = nextEntry;
                                                try {
                                                    localStorage.setItem('fair_value_params_map', JSON.stringify(map));
                                                } catch {
                                                    // ignore
                                                }
                                                if (newManualFv > 0) {
                                                    setFairValue(newManualFv.toFixed(2));
                                                }
                                                if (currentStockObj) {
                                                    updateStock(currentStockObj.id, {
                                                        ...(newManualFv > 0 ? { fairValue: newManualFv } : {}),
                                                        fairValueParams: nextEntry
                                                    });
                                                }
                                            } else {
                                                // Switch from Manuell to Sicherheit (A)
                                                const manualBackupToSave = {
                                                    ...(existingBackup || activeParams || smartAutoConservative),
                                                    ...(!isNaN(parsedFv) && parsedFv > 0 ? { manualFairValue: parsedFv } : {}),
                                                    updatedAt: now
                                                };
                                                const dcfConservative = calculateDcfFairValue(smartAutoConservative, effectivePrice);
                                                const newAutoFv = parseFloat(dcfConservative.fairValue.toFixed(2));

                                                const nextEntry = {
                                                    ...smartAutoConservative,
                                                    isCustom: false,
                                                    valuationMode: 'conservative' as const,
                                                    customBackup: manualBackupToSave,
                                                    updatedAt: now
                                                };
                                                map[symKey] = nextEntry;
                                                try {
                                                    localStorage.setItem('fair_value_params_map', JSON.stringify(map));
                                                } catch {
                                                    // ignore
                                                }
                                                if (newAutoFv > 0) {
                                                    setFairValue(newAutoFv.toFixed(2));
                                                }
                                                if (currentStockObj) {
                                                    updateStock(currentStockObj.id, {
                                                        ...(newAutoFv > 0 ? { fairValue: newAutoFv } : {}),
                                                        fairValueParams: nextEntry
                                                    });
                                                }
                                            }
                                            setFvModeTick(t => t + 1);
                                        };

                                        return (
                                            <>
                                                <div className="flex flex-col h-full gap-2">
                                                    <div className="flex justify-between items-center min-h-[28px]">
                                                        <label className="text-sm font-medium">Kauflimit</label>
                                                        {calcBuyPrice !== null && (
                                                            <button
                                                                type="button"
                                                                onClick={handleToggleFvMode}
                                                                className={cn(
                                                                    "flex items-center gap-1 text-xs font-semibold px-1.5 py-0.5 rounded border transition-colors cursor-pointer",
                                                                    currentMode === 'manual'
                                                                        ? "text-emerald-400 bg-emerald-500/15 hover:bg-emerald-500/25 border-emerald-500/40"
                                                                        : currentMode === 'quality'
                                                                            ? "text-purple-400 bg-purple-500/15 hover:bg-purple-500/25 border-purple-500/40"
                                                                            : "text-blue-400 bg-blue-500/15 hover:bg-blue-500/25 border-blue-500/40"
                                                                )}
                                                                title={
                                                                    currentMode === 'conservative'
                                                                        ? "Sicherheit (A): Klick für Wechsel zu Qualität (B)"
                                                                        : currentMode === 'quality'
                                                                            ? "Qualität (B): Klick für Wechsel zu Manuell"
                                                                            : "Manuell: Klick für Wechsel zu Sicherheit (A)"
                                                                }
                                                            >
                                                                {currentMode === 'conservative' && <ShieldCheck className="size-3 shrink-0" />}
                                                                {currentMode === 'quality' && <Sparkles className="size-3 shrink-0" />}
                                                                {currentMode === 'manual' && <Sliders className="size-3 shrink-0" />}
                                                                <span>
                                                                    {currentMode === 'manual'
                                                                        ? 'Kaufpreis (Manuell)'
                                                                        : currentMode === 'quality'
                                                                            ? 'Kaufpreis (Qualität B)'
                                                                            : 'Kaufpreis (Sicherheit A)'}
                                                                </span>
                                                            </button>
                                                        )}
                                                    </div>
                                                    <div className="relative mt-auto">
                                                        <input
                                                            type="text"
                                                            inputMode="decimal"
                                                            autoComplete="off"
                                                            placeholder="Optional"
                                                            value={targetPrice}
                                                            onChange={(e) => setTargetPrice(e.target.value)}
                                                            onFocus={(e) => e.target.select()}
                                                            className={`w-full px-3 py-2 border rounded-md bg-background text-foreground text-lg ${calcBuyPrice !== null ? 'pr-20' : ''}`}
                                                        />
                                                        {calcBuyPrice !== null && (
                                                            <span
                                                                className={cn(
                                                                    "absolute right-3 top-1/2 -translate-y-1/2 font-mono font-semibold text-base pointer-events-none select-none",
                                                                    currentMode === 'manual'
                                                                        ? "text-emerald-400"
                                                                        : currentMode === 'quality'
                                                                            ? "text-purple-400"
                                                                            : "text-blue-400"
                                                                )}
                                                                title={`Errechneter Kaufpreis inkl. ${mosPct}% Sicherheitsmarge (${currentMode === 'manual' ? 'Manuelle Werte' : currentMode === 'quality' ? 'Qualität B' : 'Sicherheit A'})`}
                                                            >
                                                                {calcBuyPrice.toFixed(2)}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="flex flex-col h-full gap-2">
                                                    <div className="flex justify-between items-center min-h-[28px]">
                                                        <label className="text-sm font-medium">Verkaufslimit</label>
                                                    </div>
                                                    <input
                                                        type="text"
                                                        inputMode="decimal"
                                                        autoComplete="off"
                                                        placeholder="Preis zum Verkauf..."
                                                        value={sellLimit}
                                                        onChange={(e) => setSellLimit(e.target.value)}
                                                        onFocus={(e) => e.target.select()}
                                                        className="w-full px-3 py-2 border rounded-md bg-background text-foreground text-lg mt-auto"
                                                    />
                                                </div>
                                                <div className="flex flex-col h-full gap-2">
                                                    <div className="flex justify-between items-center min-h-[28px]">
                                                        <button
                                                            type="button"
                                                            onClick={() => navigate(`/fair-value?stock=${encodeURIComponent(String(currentStockId || symKey))}`)}
                                                            className="text-sm font-medium hover:text-primary transition-colors cursor-pointer text-left"
                                                            title="Zum Fenster Fairer Wert wechseln"
                                                        >
                                                            Fairer Wert
                                                        </button>
                                                        {!isNaN(parsedFv) && parsedFv > 0 && (
                                                            <button
                                                                type="button"
                                                                onClick={handleToggleFvMode}
                                                                className={cn(
                                                                    "flex items-center gap-1 text-xs font-semibold px-1.5 py-0.5 rounded border transition-colors cursor-pointer",
                                                                    currentMode === 'manual'
                                                                        ? "text-emerald-400 bg-emerald-500/15 hover:bg-emerald-500/25 border-emerald-500/40"
                                                                        : currentMode === 'quality'
                                                                            ? "text-purple-400 bg-purple-500/15 hover:bg-purple-500/25 border-purple-500/40"
                                                                            : "text-blue-400 bg-blue-500/15 hover:bg-blue-500/25 border-blue-500/40"
                                                                )}
                                                                title="Klicken, um zwischen Sicherheit (A), Qualität (B) und Manuell zu wechseln"
                                                            >
                                                                {currentMode === 'conservative' && <ShieldCheck className="size-3 shrink-0" />}
                                                                {currentMode === 'quality' && <Sparkles className="size-3 shrink-0" />}
                                                                {currentMode === 'manual' && <Sliders className="size-3 shrink-0" />}
                                                                <span>{currentMode === 'manual' ? 'Manuell' : currentMode === 'quality' ? 'Qualität (B)' : 'Sicherheit (A)'}</span>
                                                            </button>
                                                        )}
                                                    </div>
                                                    <input
                                                        type="text"
                                                        readOnly
                                                        placeholder="Optional"
                                                        value={fairValue}
                                                        onClick={() => navigate(`/fair-value?stock=${encodeURIComponent(String(currentStockId || symKey))}`)}
                                                        title="Klicken, um zum Fenster Fairer Wert zu wechseln"
                                                        className={cn(
                                                            "w-full px-3 py-2 border rounded-md bg-background text-lg mt-auto font-mono font-semibold transition-colors cursor-pointer",
                                                            !isNaN(parsedFv) && parsedFv > 0
                                                                ? currentMode === 'manual'
                                                                    ? "border-emerald-500/60 hover:border-emerald-400 text-emerald-400"
                                                                    : currentMode === 'quality'
                                                                        ? "border-purple-500/60 hover:border-purple-400 text-purple-400"
                                                                        : "border-blue-500/60 hover:border-blue-400 text-blue-400"
                                                                : "text-foreground hover:border-primary/50"
                                                        )}
                                                    />
                                                </div>
                                            </>
                                        );
                                    })()}
                                </div>
                            </div>


                            {/* Dividend Section - Always visible */}
                            <div className="bg-card border border-border rounded-xl p-4 shadow-sm space-y-4">
                                <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">Dividende</h3>

                                {/* Frequency selector at top */}
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Ausschüttungsrhythmus</label>
                                    <select
                                        value={frequency}
                                        onChange={(e) => handleFrequencyChange(e.target.value as any)}
                                        className="w-full px-3 py-2 border rounded-md bg-background text-foreground"
                                    >
                                        <option value="none">Keine Dividende</option>
                                        <option value="quarterly">Quartalsweise (4x/Jahr)</option>
                                        <option value="semi-annually">Halbjährlich (2x/Jahr)</option>
                                        <option value="annually">Jährlich (1x/Jahr)</option>
                                        <option value="monthly">Monatlich (12x/Jahr)</option>
                                    </select>
                                </div>

                                {/* Only show dividend details if frequency is not 'none' */}
                                {frequency !== 'none' && (
                                    <>

                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <label className="text-sm font-medium">Rendite %</label>
                                                <div className="space-y-2">
                                                    <input
                                                        type="text"
                                                        inputMode="decimal"
                                                        autoComplete="off"
                                                        step="0.01"
                                                        placeholder="z.B. 3.90"
                                                        value={yieldPercent}
                                                        onChange={(e) => handleYieldChange(e.target.value)}
                                                        onFocus={(e) => e.target.select()}
                                                        className="w-full px-3 py-2 border rounded-md bg-background text-foreground text-lg"
                                                    />
                                                    {(() => {
                                                        const currentPos = positions.find(p => String(p.stockId) === String(currentStockId) || (stock && p.stockId === stock.id));
                                                        const buyPriceAvg = currentPos?.buyPriceAvg;
                                                        const am = parseFloat(amount.replace(',', '.'));
                                                        const factor = getFrequencyFactor(frequency);
                                                        const currentP = getEffectivePrice();

                                                        if (isNaN(am) || am <= 0 || !currentP || currentP <= 0) return null;

                                                        const currentMathYield = (am * factor / currentP) * 100;
                                                        const targetVal = buyPriceAvg && buyPriceAvg > 0 ? buyPriceAvg : (targetPrice ? parseFloat(targetPrice.replace(',', '.')) : stock?.targetPrice);

                                                        if (!targetVal || targetVal <= 0 || Math.abs(currentP - targetVal) < 0.01) {
                                                            // Only show mathematical current yield if no distinct target/buy price exists
                                                            return (
                                                                <div className="flex justify-between items-center px-2 py-1 bg-muted/30 border border-border/50 rounded text-[10px] md:text-xs">
                                                                    <span className="text-muted-foreground font-medium uppercase tracking-wider">Aktuell (Math.)</span>
                                                                    <span className="text-foreground font-bold font-mono">{currentMathYield.toFixed(2)}%</span>
                                                                </div>
                                                            );
                                                        }

                                                        const targetYield = (am * factor / targetVal) * 100;
                                                        const isEinstand = buyPriceAvg && buyPriceAvg > 0;

                                                        return (
                                                            <div className={cn(
                                                                "mt-2 px-2 py-1 inline-flex items-center gap-2 rounded border text-[10px] md:text-xs font-mono font-bold",
                                                                isEinstand ? "bg-blue-50 dark:bg-blue-900/20 border-blue-100 dark:border-blue-900/30 text-blue-700 dark:text-blue-300" : "bg-amber-50 dark:bg-amber-900/20 border-amber-100 dark:border-amber-900/30 text-amber-700 dark:text-amber-300"
                                                            )}>
                                                                <span className="uppercase tracking-wider opacity-70">{isEinstand ? 'Rendite (Einstand)' : 'Rendite (Kauflimit)'}</span>
                                                                <span>{targetYield.toFixed(2)}%</span>
                                                            </div>
                                                        );
                                                    })()}
                                                </div>
                                            </div>

                                            <div className="space-y-2">
                                                <label className="text-sm font-medium">Betrag <span className="text-xs text-muted-foreground">({currency === 'GBp' ? 'GBP' : currency})</span></label>
                                                <input
                                                    type="text"
                                                    inputMode="decimal"
                                                    autoComplete="off"
                                                    step="0.01"
                                                    placeholder="z.B. 0.60"
                                                    value={amount}
                                                    onChange={(e) => handleAmountChange(e.target.value)}
                                                    onFocus={(e) => e.target.select()}
                                                    className="w-full px-3 py-2 border rounded-md bg-background text-foreground text-lg"
                                                />
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <label className="text-sm font-medium">Währung</label>
                                            <select
                                                value={currency}
                                                onChange={handleCurrencyChange}
                                                className="w-full px-3 py-2 border rounded-md bg-background text-foreground"
                                            >
                                                <option value="CHF">CHF (Schweizer Franken)</option>
                                                <option value="USD">USD (US Dollar)</option>
                                                <option value="EUR">EUR (Euro)</option>
                                                <option value="GBp">GBp (Britische Pence)</option>
                                                <option value="GBP">GBP (Britische Pfund)</option>
                                            </select>
                                        </div>


                                        <div className="space-y-2">
                                            <label className="text-sm font-medium">Ausschüttung</label>
                                            <div className="flex bg-muted rounded-lg p-1 border border-border">
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        // If switching to distributing, maybe keep as is
                                                        updateStock(currentStockId!, { distributionPolicy: 'distributing' });
                                                    }}
                                                    className={cn(
                                                        "flex-1 px-3 py-2 text-sm font-medium rounded-md transition-all",
                                                        stock?.distributionPolicy !== 'accumulating'
                                                            ? "bg-background text-foreground shadow-sm"
                                                            : "text-muted-foreground hover:text-foreground"
                                                    )}
                                                >
                                                    Ausschüttend
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        updateStock(currentStockId!, { distributionPolicy: 'accumulating' });
                                                    }}
                                                    className={cn(
                                                        "flex-1 px-3 py-2 text-sm font-medium rounded-md transition-all",
                                                        stock?.distributionPolicy === 'accumulating'
                                                            ? "bg-background text-foreground shadow-sm"
                                                            : "text-muted-foreground hover:text-foreground"
                                                    )}
                                                >
                                                    Thesaurierend
                                                </button>
                                            </div>
                                        </div>

                                        {amount && !isNaN(parseFloat(amount)) && (
                                            <div className="p-4 bg-muted/50 rounded-lg text-center border border-border">
                                                <p className="text-sm font-medium text-muted-foreground">Erwartete Jahresausschüttung</p>
                                                <p className="text-2xl font-bold text-foreground mt-1">
                                                    {(parseFloat(amount.replace(',', '.')) * getFrequencyFactor(frequency)).toFixed(2)} {currency === 'GBp' ? 'GBP' : currency}
                                                </p>
                                                {currency === 'GBp' && (
                                                    <p className="text-sm text-muted-foreground mt-1">
                                                        ≈ {((parseFloat(amount.replace(',', '.')) * getFrequencyFactor(frequency)) / 100).toFixed(2)} GBP (Pfund)
                                                    </p>
                                                )}
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>

                            {/* Dates Section - Only show if frequency is not 'none' */}
                            {frequency !== 'none' && (
                                <div className="bg-card border border-border rounded-xl p-4 shadow-sm space-y-4">
                                    <div className="flex flex-wrap justify-between items-center gap-2">
                                        <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">Termine</h3>
                                        <div className="flex items-center gap-2 flex-wrap">
                                            {frequency === 'quarterly' && (
                                                <button
                                                    type="button"
                                                    onClick={handleSetVanguardSchedule}
                                                    className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/30 flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-colors font-medium border border-blue-200 dark:border-blue-800/50"
                                                    title="Vanguard Standard-Quartale (März, Juni, Sept, Dez) eintragen"
                                                >
                                                    <Calendar className="size-3.5" />
                                                    <span>Vanguard-Quartale</span>
                                                </button>
                                            )}
                                            <button
                                                type="button"
                                                onClick={handleAutoFillExDates}
                                                className="text-xs text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-900/30 flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-colors font-medium border border-emerald-200 dark:border-emerald-800/50"
                                                title="Ex-Tage automatisch 14 Tage vor den eingetragenen Zahltagen berechnen"
                                            >
                                                <Sparkles className="size-3.5" />
                                                <span>Ex-Tage auto (14 Tage vor Zahltag)</span>
                                            </button>
                                            {symbol && (
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        const year = new Date().getFullYear();
                                                        window.open(`https://www.google.com/search?q=${symbol}+dividend+dates+${year}+${year + 1}`, '_blank');
                                                    }}
                                                    className="text-xs text-primary hover:text-primary/80 flex items-center gap-1.5 px-2 py-1 bg-primary/10 rounded-md transition-colors"
                                                    title="Auf Google nach Dividenden-Terminen suchen"
                                                >
                                                    <Search className="size-3.5" />
                                                    <span className="font-medium">Termine suchen</span>
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    {(frequency === 'quarterly' || frequency === 'semi-annually') ? (
                                        <div className="space-y-4">
                                            {quarterlyDates.slice(0, frequency === 'semi-annually' ? 2 : 4).map((date, idx) => (
                                                <div key={idx} className="grid grid-cols-2 gap-4 pb-4 border-b border-border/50 last:border-0 last:pb-0">
                                                    <div className="space-y-1">
                                                        <div className="flex justify-between items-center">
                                                            <label className="text-xs text-muted-foreground font-medium uppercase">
                                                                {frequency === 'quarterly' ? `Q${idx + 1}` : `${idx + 1}.`} Ex-Datum
                                                            </label>
                                                            {date.exDate && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleQuarterlyDateChange(idx, 'exDate', '')}
                                                                    className="text-muted-foreground hover:text-red-500 transition-colors p-0.5"
                                                                    title="Datum löschen"
                                                                >
                                                                    <Trash2 className="size-3" />
                                                                </button>
                                                            )}
                                                        </div>
                                                        <input
                                                            type="date"
                                                            value={sanitizeDateYear(date.exDate)}
                                                            onChange={(e) => handleQuarterlyDateChange(idx, 'exDate', e.target.value)}
                                                            className="w-full px-2 py-2 text-sm border rounded bg-background"
                                                        />
                                                    </div>
                                                    <div className="space-y-1">
                                                        <div className="flex justify-between items-center">
                                                            <label className="text-xs text-muted-foreground font-medium uppercase">
                                                                {frequency === 'quarterly' ? `Q${idx + 1}` : `${idx + 1}.`} Zahl-Datum
                                                            </label>
                                                            {date.payDate && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleQuarterlyDateChange(idx, 'payDate', '')}
                                                                    className="text-muted-foreground hover:text-red-500 transition-colors p-0.5"
                                                                    title="Datum löschen"
                                                                >
                                                                    <Trash2 className="size-3" />
                                                                </button>
                                                            )}
                                                        </div>
                                                        <input
                                                            type="date"
                                                            value={sanitizeDateYear(date.payDate, date.exDate)}
                                                            min={sanitizeDateYear(date.exDate) || undefined}
                                                            onChange={(e) => handleQuarterlyDateChange(idx, 'payDate', e.target.value)}
                                                            className="w-full px-2 py-2 text-sm border rounded bg-background"
                                                        />
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <div className="flex justify-between items-center">
                                                    <label className="text-sm font-medium">Ex-Datum</label>
                                                    {exDate && (
                                                        <button
                                                            type="button"
                                                            onClick={() => setExDate('')}
                                                            className="text-muted-foreground hover:text-red-500 transition-colors p-0.5"
                                                            title="Datum löschen"
                                                        >
                                                            <Trash2 className="size-3" />
                                                        </button>
                                                    )}
                                                </div>
                                                <input
                                                    type="date"
                                                    value={sanitizeDateYear(exDate)}
                                                    onChange={(e) => {
                                                        const newVal = e.target.value;
                                                        setExDate(newVal);
                                                        // Only auto-fill if date is complete (YYYY-MM-DD)
                                                        if (newVal && newVal.length === 10 && !payDate) {
                                                            setPayDate(newVal);
                                                        }
                                                    }}
                                                    className="w-full px-3 py-2 border rounded-md bg-background text-foreground"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <div className="flex justify-between items-center">
                                                    <label className="text-sm font-medium">Zahl-Datum</label>
                                                    {payDate && (
                                                        <button
                                                            type="button"
                                                            onClick={() => setPayDate('')}
                                                            className="text-muted-foreground hover:text-red-500 transition-colors p-0.5"
                                                            title="Datum löschen"
                                                        >
                                                            <Trash2 className="size-3" />
                                                        </button>
                                                    )}
                                                </div>
                                                <input
                                                    type="date"
                                                    value={sanitizeDateYear(payDate, exDate)}
                                                    min={sanitizeDateYear(exDate) || undefined}
                                                    onChange={(e) => setPayDate(e.target.value)}
                                                    className="w-full px-3 py-2 border rounded-md bg-background text-foreground"
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            <div className="pt-4 pb-8">
                                <button
                                    type="submit"
                                    className={cn(
                                        "w-full px-4 py-3 text-lg font-medium rounded-xl shadow-lg transition-all flex items-center justify-center gap-2",
                                        isSavedFeedback
                                            ? "bg-emerald-600 text-white"
                                            : "bg-primary text-primary-foreground hover:bg-primary/90"
                                    )}
                                >
                                    {isSavedFeedback ? (
                                        <>
                                            <Check className="size-5" />
                                            <span>Gespeichert!</span>
                                        </>
                                    ) : (
                                        <span>Speichern</span>
                                    )}
                                </button>
                            </div>
                        </>
                    )}
                </form>
            </div>

            {/* Modal: Ungespeicherte Änderungen beim Klick auf Zurück */}
            {showUnsavedModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-card border border-border rounded-2xl p-6 shadow-2xl max-w-sm w-full space-y-4">
                        <div className="flex items-center gap-3 text-amber-500">
                            <AlertTriangle className="size-6 shrink-0" />
                            <h3 className="text-lg font-bold text-foreground">Änderungen speichern?</h3>
                        </div>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                            Sie haben Änderungen an <strong>{stock?.name || 'dieser Position'}</strong> vorgenommen. Möchten Sie diese vor dem Verlassen speichern?
                        </p>
                        <div className="flex flex-col gap-2 pt-2">
                            <button
                                type="button"
                                onClick={(e) => {
                                    handleSubmit(e);
                                    setIsDirty(false);
                                    setShowUnsavedModal(false);
                                    navigate(-1);
                                }}
                                className="w-full py-2.5 px-4 bg-primary text-primary-foreground hover:bg-primary/90 font-semibold text-sm rounded-xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
                            >
                                <Save className="size-4" />
                                <span>Speichern & Zurück</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setIsDirty(false);
                                    setShowUnsavedModal(false);
                                    navigate(-1);
                                }}
                                className="w-full py-2 px-4 bg-muted hover:bg-muted/80 text-foreground font-medium text-sm rounded-xl transition-colors cursor-pointer"
                            >
                                Verwerfen
                            </button>
                            <button
                                type="button"
                                onClick={() => setShowUnsavedModal(false)}
                                className="w-full py-1.5 px-4 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                            >
                                Abbrechen
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
