
import { useState, useEffect } from 'react';
import { ArrowLeft } from 'lucide-react';
import { usePortfolio } from '../context/PortfolioContext';
import { useParams, useNavigate } from 'react-router-dom';
import type { Stock, Currency } from '../types';

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
    const { stocks, positions, updateStockDividend, updateStockPrice, updateStock } = usePortfolio();

    const [selectedStockId, setSelectedStockId] = useState(''); // Local state for selection
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
    // Use param stockId if available, otherwise fallback to local selectedStockId state
    const currentStockId = stockId || selectedStockId;
    const stock = stocks.find(s => s.id === currentStockId);
    const position = positions.find(p => p.stockId === currentStockId);

    // Redirect if invalid stock
    // useEffect(() => {
    //     if (!stock && stockId) {
    //         // Wait for load? Or redirect?
    //     }
    // }, [stock, stockId]);

    // Pre-fill fields
    useEffect(() => {
        if (stock) {
            setPrice(stock.currentPrice?.toString() || '');
            setTargetPrice(stock.targetPrice?.toString() || '');
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
    }, [stock]); // Depend on stock change


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

        // Update Logo and Target Price
        const updates: Partial<Stock> = {};
        if (logoUrl !== undefined && (!stock || logoUrl !== stock.logoUrl)) {
            updates.logoUrl = logoUrl;
        }
        if (targetPrice !== undefined && (!stock || (targetPrice ? parseFloat(targetPrice.replace(',', '.')) : undefined) !== stock.targetPrice)) {
            updates.targetPrice = targetPrice ? parseFloat(targetPrice.replace(',', '.')) : undefined;
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
            const validDates = datesToConsider.filter(d => d.exDate || d.payDate);

            if (validDates.length > 0) {
                submissionDates = validDates;
                submissionExDate = validDates[0].exDate;
                submissionPayDate = validDates[0].payDate;
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

    // if (!stock) {
    //     return <div className="p-8 text-center">Aktie nicht gefunden...</div>;
    // }

    return (
        <div className="min-h-screen bg-background pb-20">
            {/* Header */}
            <div className="flex items-center gap-4 p-4 border-b border-border bg-card sticky top-0 z-10">
                <button onClick={() => navigate(-1)} className="p-2 -ml-2 hover:bg-muted rounded-full">
                    <ArrowLeft className="size-6" />
                </button>
                <div>
                    <h1 className="text-xl font-bold">{stock ? stock.name : 'Dividende hinzufügen'}</h1>
                    <p className="text-sm text-muted-foreground">{stock ? stock.symbol : 'Neue Erfassung'}</p>
                </div>
            </div>

            <div className="p-4 max-w-lg mx-auto">
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
                            {/* Price Section */}
                            <div className="bg-card border border-border rounded-xl p-4 shadow-sm space-y-4">
                                <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">Kursdaten</h3>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Aktueller Kurs</label>
                                        <input
                                            type="text"
                                            inputMode="decimal"
                                            autoComplete="off"
                                            step="0.01"
                                            required
                                            value={price}
                                            onChange={(e) => handlePriceChange(e.target.value)}
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
                                            className="w-full px-3 py-2 border rounded-md bg-background text-foreground text-lg"
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Betrag</label>
                                        <input
                                            type="text"
                                            inputMode="decimal"
                                            autoComplete="off"
                                            step="0.01"
                                            placeholder="z.B. 0.60"
                                            value={amount}
                                            onChange={(e) => handleAmountChange(e.target.value)}
                                            className="w-full px-3 py-2 border rounded-md bg-background text-foreground text-lg"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Währung</label>
                                    <select
                                        value={currency}
                                        onChange={(e) => setCurrency(e.target.value as Currency)}
                                        className="w-full px-3 py-2 border rounded-md bg-background text-foreground"
                                    >
                                        <option value="CHF">CHF (Schweizer Franken)</option>
                                        <option value="USD">USD (US Dollar)</option>
                                        <option value="EUR">EUR (Euro)</option>
                                        <option value="GBp">GBp (Britische Pence)</option>
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

                                {position && amount && !isNaN(parseFloat(amount)) && (
                                    <div className="p-4 bg-muted/50 rounded-lg text-center border border-border">
                                        <p className="text-sm font-medium text-muted-foreground">Erwartete Jahresausschüttung</p>
                                        <p className="text-2xl font-bold text-primary mt-1">
                                            {(parseFloat(amount.replace(',', '.')) * position.shares * getFrequencyFactor(frequency)).toFixed(2)} {currency}
                                        </p>
                                    </div>
                                )}
                            </div>

                            {/* Dates Section */}
                            <div className="bg-card border border-border rounded-xl p-4 shadow-sm space-y-4">
                                <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">Termine</h3>

                                {(frequency === 'quarterly' || frequency === 'semi-annually') ? (
                                    <div className="space-y-4">
                                        {quarterlyDates.slice(0, frequency === 'semi-annually' ? 2 : 4).map((date, idx) => (
                                            <div key={idx} className="grid grid-cols-2 gap-4 pb-4 border-b border-border/50 last:border-0 last:pb-0">
                                                <div className="space-y-1">
                                                    <label className="text-xs text-muted-foreground font-medium uppercase">
                                                        {frequency === 'quarterly' ? `Q${idx + 1}` : `${idx + 1}.`} Ex-Datum
                                                    </label>
                                                    <input
                                                        type="date"
                                                        value={date.exDate}
                                                        onChange={(e) => handleQuarterlyDateChange(idx, 'exDate', e.target.value)}
                                                        className="w-full px-2 py-2 text-sm border rounded bg-background"
                                                    />
                                                </div>
                                                <div className="space-y-1">
                                                    <label className="text-xs text-muted-foreground font-medium uppercase">
                                                        {frequency === 'quarterly' ? `Q${idx + 1}` : `${idx + 1}.`} Zahldatum
                                                    </label>
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
                                            <label className="text-sm font-medium">Ex-Datum</label>
                                            <input
                                                type="date"
                                                value={exDate}
                                                onChange={(e) => setExDate(e.target.value)}
                                                className="w-full px-3 py-2 border rounded-md bg-background text-foreground"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium">Zahldatum</label>
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

                            {/* Logo Section */}
                            <div className="bg-card border border-border rounded-xl p-4 shadow-sm space-y-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Logo URL</label>
                                    <input
                                        type="url"
                                        placeholder="https://example.com/logo.png"
                                        value={logoUrl}
                                        onChange={(e) => setLogoUrl(e.target.value)}
                                        className="w-full px-3 py-2 border rounded-md bg-background text-foreground"
                                    />
                                </div>
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
