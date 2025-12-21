
import { useState, useEffect } from 'react';
import { ArrowLeft, Trash2, Search } from 'lucide-react';
import { usePortfolio } from '../context/PortfolioContext';
import { useParams, useNavigate } from 'react-router-dom';
import type { Stock, Currency } from '../types';
import { useCurrencyFormatter } from '../utils/currency';
import { fetchStockHistory } from '../services/finnhub';
import { cn } from '../utils';

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

export function EditDividendPage() {
    const { stockId } = useParams();
    const navigate = useNavigate();
    const { stocks, updateStockDividend, updateStockPrice, updateStock } = usePortfolio();

    const [selectedStockId, setSelectedStockId] = useState(''); // Local state for selection
    const [symbol, setSymbol] = useState(''); // NEW: Allow editing symbol
    const [isin, setIsin] = useState(''); // NEW: Allow editing ISIN
    const [sector, setSector] = useState(''); // NEW: Allow editing Sector
    const [domain, setDomain] = useState(''); // NEW: For logo generation
    const [price, setPrice] = useState('');
    const [targetPrice, setTargetPrice] = useState('');
    const [amount, setAmount] = useState('');
    const [yieldPercent, setYieldPercent] = useState('');
    const [currency, setCurrency] = useState<Currency>('CHF');
    const [logoUrl, setLogoUrl] = useState('');
    const [exDate, setExDate] = useState('');
    const [payDate, setPayDate] = useState('');
    const [frequency, setFrequency] = useState<'quarterly' | 'semi-annually' | 'annually' | 'monthly'>('quarterly');

    const [quarterlyDates, setQuarterlyDates] = useState<{ exDate: string; payDate: string; }[]>([
        { exDate: '', payDate: '' },
        { exDate: '', payDate: '' },
        { exDate: '', payDate: '' },
        { exDate: '', payDate: '' }
    ]);

    // Derived state
    const currentStockId = stockId || selectedStockId;
    const stock = stocks.find(s => s.id === currentStockId);


    // Pre-fill fields
    useEffect(() => {
        if (stock) {
            setSymbol(stock.symbol || ''); // Pre-fill symbol
            setIsin(stock.isin || ''); // Pre-fill ISIN
            setSector(stock.sector || ''); // Pre-fill Sector
            setPrice(stock.currentPrice ? stock.currentPrice.toFixed(2) : '');
            setTargetPrice(stock.targetPrice ? stock.targetPrice.toFixed(2) : '');
            setAmount(stock.dividendAmount?.toString() || '');
            setYieldPercent(stock.dividendYield?.toString() || '');
            setCurrency(stock.dividendCurrency || stock.currency);
            setLogoUrl(stock.logoUrl || '');
            setExDate(stock.dividendExDate || '');
            setPayDate(stock.dividendPayDate || '');
            setFrequency(stock.dividendFrequency || 'quarterly');

            if (stock.dividendDates && stock.dividendDates.length > 0) {
                const dates = [...stock.dividendDates];
                while (dates.length < 4) dates.push({ exDate: '', payDate: '' });
                setQuarterlyDates(dates);
            } else if (stock.dividendExDate || stock.dividendPayDate) {
                setQuarterlyDates([
                    { exDate: stock.dividendExDate || '', payDate: stock.dividendPayDate || '' },
                    { exDate: '', payDate: '' },
                    { exDate: '', payDate: '' },
                    { exDate: '', payDate: '' }
                ]);
            } else {
                setQuarterlyDates(Array(4).fill({ exDate: '', payDate: '' }));
            }
        }
    }, [stock]);


    // Handlers
    const getEffectivePrice = () => {
        return price ? parseFloat(price) : (stock?.currentPrice || 0);
    };

    const handlePriceChange = (newPrice: string) => {
        setPrice(newPrice);
        const p = parseFloat(newPrice.replace(',', '.'));
        const a = parseFloat(amount.replace(',', '.'));

        if (newPrice && !isNaN(p) && amount && !isNaN(a)) {
            const currentP = p;
            const factor = getFrequencyFactor(frequency);
            const divAmount = a;
            const newYield = ((divAmount * factor) / currentP) * 100;
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

    const handleFrequencyChange = (newFrequency: 'quarterly' | 'semi-annually' | 'annually' | 'monthly') => {
        setFrequency(newFrequency);
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



    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        const targetId = currentStockId;
        if (!targetId) return;

        // Update Price
        if (price && (!stock || parseFloat(price.replace(',', '.')) !== stock.currentPrice)) {
            updateStockPrice(targetId, parseFloat(price.replace(',', '.')));
        }

        // Update Stock Details (Symbol, Logo, Target Price)
        const updates: Partial<Stock> = {};

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
        if (currency && (!stock || currency !== stock.currency)) {
            updates.currency = currency;
        }

        if (Object.keys(updates).length > 0) {
            updateStock(targetId, updates);
        }

        // Dividends Logic
        let submissionDates = undefined;
        let submissionExDate = exDate || undefined;
        let submissionPayDate = payDate || undefined;

        if (frequency === 'quarterly' || frequency === 'semi-annually') {
            const datesToConsider = frequency === 'quarterly' ? quarterlyDates : quarterlyDates.slice(0, 2);
            // Fix: Do not filter empty dates to preserve Q1/Q2/Q3/Q4 slots!
            submissionDates = datesToConsider;

            // Set exDate/payDate from the first available one for display/sorting (optional)
            const firstValid = datesToConsider.find(d => d.exDate || d.payDate);
            if (firstValid) {
                submissionExDate = firstValid.exDate;
                submissionPayDate = firstValid.payDate;
            }
        }

        updateStockDividend(targetId, {
            dividendYield: yieldPercent ? parseFloat(yieldPercent.replace(',', '.')) : undefined,
            dividendAmount: amount ? parseFloat(amount.replace(',', '.')) : undefined,
            dividendCurrency: currency,
            dividendExDate: submissionExDate,
            dividendPayDate: submissionPayDate,
            dividendDates: submissionDates,
            dividendFrequency: frequency
        });

        navigate(-1); // Go back
    };

    const { rates } = useCurrencyFormatter();

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
            <div className="flex items-center gap-4 p-4 border-b border-border bg-card sticky top-0 z-10 w-full">
                <button onClick={() => navigate(-1)} className="p-2 -ml-2 hover:bg-muted rounded-full">
                    <ArrowLeft className="size-6" />
                </button>
                <div className="flex-1">
                    <h1 className="text-xl font-bold">{stock ? stock.name : 'Dividende hinzufügen'}</h1>
                    <p className="text-sm text-muted-foreground">{stock ? stock.symbol : 'Neue Erfassung'}</p>
                </div>
            </div>

            <div className="p-4 max-w-lg mx-auto w-full">
                <form onSubmit={handleSubmit} className="space-y-6">

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
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Price Section */}
                            <div className="bg-card border border-border rounded-xl p-4 shadow-sm space-y-4">
                                <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">Kursdaten</h3>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <div className="flex justify-between items-center">
                                            <label className="text-sm font-medium">Aktueller Kurs <span className="text-xs text-muted-foreground">({currency === 'GBp' ? 'GBp (Pence)' : currency})</span></label>
                                            {symbol && (
                                                <button
                                                    type="button"
                                                    onClick={async () => {
                                                        const res = await fetchStockHistory(symbol, '1D');
                                                        if (res.data && res.data.length > 0) {
                                                            let val = res.data[res.data.length - 1].value;
                                                            // Normalize GBp
                                                            if (res.currency === 'GBp') {
                                                                val = val / 100;
                                                                // If current currency is NOT GBp/GBP, maybe suggestion?
                                                                // For now just set the value correctly
                                                            }
                                                            setPrice(val.toFixed(2));
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
                                            className="w-full px-3 py-2 border rounded-md bg-background text-foreground text-lg"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-blue-600 dark:text-blue-400">Kauflimit</label>
                                        <input
                                            type="text"
                                            inputMode="decimal"
                                            autoComplete="off"
                                            step="0.01"
                                            placeholder="Optional"
                                            value={targetPrice}
                                            onChange={(e) => setTargetPrice(e.target.value)}
                                            onFocus={(e) => e.target.select()}
                                            className="w-full px-3 py-2 border rounded-md bg-background text-foreground text-lg"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Dividend Section */}
                            <div className="bg-card border border-border rounded-xl p-4 shadow-sm space-y-4">
                                <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">Dividende</h3>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Rendite %</label>
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
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Betrag <span className="text-xs text-muted-foreground">({currency === 'GBp' ? 'GBp (Pence)' : currency})</span></label>
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
                                    <label className="text-sm font-medium">Frequenz</label>
                                    <select
                                        value={frequency}
                                        onChange={(e) => handleFrequencyChange(e.target.value as any)}
                                        className="w-full px-3 py-2 border rounded-md bg-background text-foreground"
                                    >
                                        <option value="quarterly">Quartalsweise (4x/Jahr)</option>
                                        <option value="semi-annually">Halbjährlich (2x/Jahr)</option>
                                        <option value="annually">Jährlich (1x/Jahr)</option>
                                    </select>
                                </div>

                                {amount && !isNaN(parseFloat(amount)) && (
                                    <div className="p-4 bg-muted/50 rounded-lg text-center border border-border">
                                        <p className="text-sm font-medium text-muted-foreground">Erwartete Jahresausschüttung</p>
                                        <p className="text-2xl font-bold text-primary mt-1">
                                            {(parseFloat(amount.replace(',', '.')) * getFrequencyFactor(frequency)).toFixed(2)} {currency === 'GBp' ? 'GBp (Pence)' : currency}
                                        </p>
                                        {currency === 'GBp' && (
                                            <p className="text-sm text-muted-foreground mt-1">
                                                ≈ {((parseFloat(amount.replace(',', '.')) * getFrequencyFactor(frequency)) / 100).toFixed(2)} GBP (Pfund)
                                            </p>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Dates Section */}
                            <div className="bg-card border border-border rounded-xl p-4 shadow-sm space-y-4">
                                <div className="flex justify-between items-center">
                                    <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">Termine</h3>
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
                                                        value={date.exDate}
                                                        onChange={(e) => handleQuarterlyDateChange(idx, 'exDate', e.target.value)}
                                                        className="w-full px-2 py-2 text-sm border rounded bg-background"
                                                    />
                                                </div>
                                                <div className="space-y-1">
                                                    <div className="flex justify-between items-center">
                                                        <label className="text-xs text-muted-foreground font-medium uppercase">
                                                            {frequency === 'quarterly' ? `Q${idx + 1}` : `${idx + 1}.`} Zahldatum
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
                                                        value={date.payDate}
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
                                                value={exDate}
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
                                                <label className="text-sm font-medium">Zahldatum</label>
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
                                                value={payDate}
                                                onChange={(e) => setPayDate(e.target.value)}
                                                className="w-full px-3 py-2 border rounded-md bg-background text-foreground"
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="pt-4 pb-8">
                                <button
                                    type="submit"
                                    className="w-full px-4 py-3 bg-primary text-primary-foreground text-lg font-medium rounded-xl hover:bg-primary/90 shadow-lg"
                                >
                                    Speichern
                                </button>
                            </div>
                        </>
                    )}
                </form>
            </div>
        </div>
    );
}
