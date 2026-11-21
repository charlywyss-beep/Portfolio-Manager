
import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { PieChart, X, RotateCcw, ArrowRight } from 'lucide-react';
import { cn } from '../utils';
import { usePortfolio } from '../context/PortfolioContext';
import { useExchangeRates } from '../context/ExchangeRateContext';
import { CalculatorPresetSelect, type PresetSelectOption } from './CalculatorPresetSelect';

type Currency = 'CHF' | 'USD' | 'GBP' | 'EUR';

const SHARE_CALC_STORAGE_KEY = 'finanz_rechner_share_calc';

interface SavedShareState {
    selectedStockId: string;
    amount: string;
    price: string;
    currency: Currency;
    budgetInChf: boolean;
}

const loadSavedShareState = (): Partial<SavedShareState> => {
    try {
        const raw = localStorage.getItem(SHARE_CALC_STORAGE_KEY);
        if (!raw) return {};
        return JSON.parse(raw) || {};
    } catch {
        return {};
    }
};

interface ShareCalculatorProps {
    className?: string;
    transferredBudget?: {
        amount: string;
        currency: Currency;
        key: number;
    } | null;
}

const preventArrowStep = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault();
    }
};

const normalizeCurrency = (cur?: string): Currency => {
    if (cur === 'CHF' || cur === 'USD' || cur === 'EUR' || cur === 'GBP') return cur;
    if (cur === 'GBp') return 'GBP';
    return 'USD';
};

const normalizeStockPrice = (val: number, cur?: string) => (cur === 'GBp' ? val / 100 : val);

const formatPriceInput = (val: number) => {
    if (!Number.isFinite(val)) return '';
    return val >= 10 ? val.toFixed(2) : Number(val.toFixed(4)).toString();
};

export function ShareCalculator({ className, transferredBudget }: ShareCalculatorProps) {
    const navigate = useNavigate();
    const { stocks, positions, watchlists, updateSimulatorState } = usePortfolio();
    const { rates } = useExchangeRates();

    const [initial] = useState<Partial<SavedShareState>>(() => loadSavedShareState());
    const [selectedStockId, setSelectedStockId] = useState<string>(initial.selectedStockId || '');
    const [amount, setAmount] = useState<string>(initial.amount || '');
    const [price, setPrice] = useState<string>(initial.price || '');
    const [currency, setCurrency] = useState<Currency>(normalizeCurrency(initial.currency));
    const [budgetInChf, setBudgetInChf] = useState<boolean>(Boolean(initial.budgetInChf) && normalizeCurrency(initial.currency) !== 'CHF');
    const [isTransferredFlash, setIsTransferredFlash] = useState<boolean>(false);

    useEffect(() => {
        try {
            const payload: SavedShareState = {
                selectedStockId,
                amount,
                price,
                currency,
                budgetInChf
            };
            localStorage.setItem(SHARE_CALC_STORAGE_KEY, JSON.stringify(payload));
        } catch {}
    }, [selectedStockId, amount, price, currency, budgetInChf]);

    const { ownedStocks, watchlistStocks } = useMemo(() => {
        const ownedIds = new Set(positions.filter(p => p.shares > 0).map(p => p.stockId));
        const watchIds = new Set(watchlists.flatMap(w => w.stockIds));

        const owned = stocks
            .filter(s => ownedIds.has(s.id))
            .sort((a, b) => a.name.localeCompare(b.name, 'de'));
        const watch = stocks
            .filter(s => watchIds.has(s.id) && !ownedIds.has(s.id))
            .sort((a, b) => a.name.localeCompare(b.name, 'de'));

        return { ownedStocks: owned, watchlistStocks: watch };
    }, [stocks, positions, watchlists]);

    const selectedStock = useMemo(
        () => stocks.find(s => s.id === selectedStockId) || null,
        [stocks, selectedStockId]
    );

    const selectedCurrentPrice = selectedStock
        ? normalizeStockPrice(selectedStock.currentPrice, selectedStock.currency)
        : 0;
    const selectedTargetPrice = selectedStock?.targetPrice && selectedStock.targetPrice > 0
        ? normalizeStockPrice(selectedStock.targetPrice, selectedStock.currency)
        : null;

    // Handle incoming budget transfer from Wechselkurs card
    useEffect(() => {
        if (!transferredBudget) return;
        setAmount(transferredBudget.amount);
        if (selectedStock && normalizeCurrency(selectedStock.currency) !== transferredBudget.currency) {
            if (transferredBudget.currency === 'CHF') {
                setBudgetInChf(true);
            } else {
                setSelectedStockId('');
                setCurrency(transferredBudget.currency);
                setBudgetInChf(false);
            }
        } else {
            setCurrency(transferredBudget.currency);
            setBudgetInChf(false);
        }
        setIsTransferredFlash(true);
        const timer = window.setTimeout(() => setIsTransferredFlash(false), 1400);
        return () => window.clearTimeout(timer);
    }, [transferredBudget?.key]);

    const handleSelectStock = (stockId: string) => {
        setSelectedStockId(stockId);
        if (!stockId) return;
        const stock = stocks.find(s => s.id === stockId);
        if (!stock) return;
        const nextCur = normalizeCurrency(stock.currency);
        const curPrice = normalizeStockPrice(stock.currentPrice, stock.currency);
        setCurrency(nextCur);
        if (nextCur === 'CHF') setBudgetInChf(false);
        setPrice(formatPriceInput(curPrice));
    };

    const handleSelectCurrency = (nextCur: Currency) => {
        setCurrency(nextCur);
        if (nextCur === 'CHF') setBudgetInChf(false);
    };

    const isAtTargetLimit = selectedTargetPrice !== null && Math.abs(parseFloat(price) - selectedTargetPrice) < 0.0001;

    const handleToggleLimitPrice = () => {
        if (!selectedStock || selectedTargetPrice === null) return;
        if (isAtTargetLimit) {
            setPrice(formatPriceInput(selectedCurrentPrice));
        } else {
            setPrice(formatPriceInput(selectedTargetPrice));
        }
    };

    const amountNum = parseFloat(amount);
    const priceNum = parseFloat(price);
    const isChfConverted = budgetInChf && currency !== 'CHF';
    const fxRateChfToCur = currency === 'CHF' ? 1 : (rates[currency] || 1);
    const effectiveAmountInStockCurrency = !isNaN(amountNum)
        ? (isChfConverted ? amountNum * fxRateChfToCur : amountNum)
        : NaN;

    const hasAnyValue = amount !== '' || price !== '' || selectedStockId !== '';

    const handleClear = () => {
        setSelectedStockId('');
        setAmount('');
        setPrice('');
        setBudgetInChf(false);
    };

    let shares: number | null = null;
    let remaining: number | null = null;

    if (!isNaN(effectiveAmountInStockCurrency) && effectiveAmountInStockCurrency >= 0 && !isNaN(priceNum) && priceNum > 0) {
        shares = Math.floor(effectiveAmountInStockCurrency / priceNum);
        remaining = effectiveAmountInStockCurrency - (shares * priceNum);
    }

    const canTransferToBuySim = shares !== null && shares > 0 && !isNaN(priceNum) && priceNum > 0;

    const handleTransferToBuySim = () => {
        if (!canTransferToBuySim || shares === null) return;
        const roundedPrice = Number(priceNum.toFixed(4));

        if (selectedStock) {
            const normalizedCur = normalizeCurrency(selectedStock.currency);
            const isAcc = selectedStock.distributionPolicy === 'accumulating';
            let annualDiv = selectedStock.dividendAmount || 0;
            const stockFreq = selectedStock.dividendFrequency && selectedStock.dividendFrequency !== 'none'
                ? selectedStock.dividendFrequency
                : 'annually';
            if (stockFreq === 'quarterly') annualDiv *= 4;
            else if (stockFreq === 'monthly') annualDiv *= 12;
            else if (stockFreq === 'semi-annually') annualDiv *= 2;
            const normalizedDiv = selectedStock.currency === 'GBp' ? annualDiv / 100 : annualDiv;

            updateSimulatorState({
                mode: 'buy',
                selectedStockId: selectedStock.id,
                simName: selectedStock.name,
                simSymbol: selectedStock.symbol,
                simIsin: selectedStock.isin || '',
                simCurrency: normalizedCur,
                simType: selectedStock.type === 'etf' ? 'etf' : 'stock',
                simDistributionPolicy: selectedStock.distributionPolicy || (isAcc ? 'accumulating' : 'distributing'),
                simFrequency: isAcc ? undefined : stockFreq,
                shares,
                price: roundedPrice,
                dividend: isAcc ? 0 : normalizedDiv
            });
            navigate(`/calculator?from=exchange-rates&price=${encodeURIComponent(roundedPrice.toString())}`);
        } else {
            updateSimulatorState({
                mode: 'buy',
                selectedStockId: 'new',
                simName: '',
                simSymbol: '',
                simIsin: '',
                simCurrency: currency,
                simType: 'stock',
                shares,
                price: roundedPrice,
                dividend: 0
            });
            navigate('/calculator?from=exchange-rates');
        }
    };

    const presetOptions = useMemo<PresetSelectOption[]>(() => {
        const list: PresetSelectOption[] = [];
        ownedStocks.forEach(stock => {
            list.push({
                value: stock.id,
                label: stock.name,
                sublabel: stock.symbol,
                meta: normalizeCurrency(stock.currency),
                group: 'Bestand'
            });
        });
        watchlistStocks.forEach(stock => {
            list.push({
                value: stock.id,
                label: stock.name,
                sublabel: stock.symbol,
                meta: normalizeCurrency(stock.currency),
                group: 'Watchlist'
            });
        });
        return list;
    }, [ownedStocks, watchlistStocks]);

    const budgetCurrencyLabel = isChfConverted ? 'CHF' : currency;

    return (
        <div className={cn("bg-card rounded-xl border border-border p-5 shadow-sm flex flex-col", className)}>
            <div className="flex items-center justify-between gap-2 h-[42px] mb-3 shrink-0">
                <div className="flex items-center gap-2.5 min-w-0">
                    <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shrink-0">
                        <PieChart className="size-4" />
                    </div>
                    <div className="min-w-0">
                        <h3 className="text-base font-semibold leading-tight truncate">Aktien-Kauf Rechner</h3>
                        <p className="text-xs text-muted-foreground truncate">Anzahl Anteile berechnen</p>
                    </div>
                </div>

                {/* Currency Selector & Clear */}
                <div className="flex items-center gap-1.5 shrink-0">
                    <div className="inline-flex bg-muted/50 rounded-lg p-0.5 gap-0.5">
                        {(['CHF', 'USD', 'EUR', 'GBP'] as Currency[]).map((c) => (
                            <button
                                key={c}
                                type="button"
                                onClick={() => handleSelectCurrency(c)}
                                className={cn(
                                    "h-7 inline-flex items-center justify-center leading-none px-2 py-0 text-xs font-bold rounded-md transition-all whitespace-nowrap cursor-pointer",
                                    currency === c
                                        ? "bg-background text-foreground shadow-sm border border-border/70"
                                        : "text-muted-foreground hover:text-foreground border border-transparent"
                                )}
                            >
                                {c}
                            </button>
                        ))}
                    </div>
                    {hasAnyValue && (
                        <button
                            type="button"
                            onClick={handleClear}
                            className="h-7 w-7 inline-flex items-center justify-center rounded-lg border border-border bg-card hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer shrink-0"
                            title="Eingaben leeren"
                            aria-label="Eingaben leeren"
                        >
                            <RotateCcw className="size-3.5" />
                        </button>
                    )}
                </div>
            </div>

            {/* Optional Stock / ETF Quick-Select + Buy Limit Chip */}
            <div className="flex items-center gap-1.5 h-8 mb-3 shrink-0">
                <CalculatorPresetSelect
                    value={selectedStockId}
                    onChange={handleSelectStock}
                    options={presetOptions}
                    placeholder="Titel laden · optional"
                    ariaLabel="Titel laden"
                />
                {selectedTargetPrice !== null && (
                    <button
                        type="button"
                        onClick={handleToggleLimitPrice}
                        title={isAtTargetLimit
                            ? `Aktuellen Kurs ${formatPriceInput(selectedCurrentPrice)} ${currency} laden`
                            : `Kauflimit ${formatPriceInput(selectedTargetPrice)} ${currency} laden`}
                        className={cn(
                            "h-8 inline-flex items-center justify-center leading-none px-2 py-0 text-xs font-semibold rounded-lg border transition-colors cursor-pointer whitespace-nowrap shrink-0",
                            isAtTargetLimit
                                ? "bg-amber-500/15 border-amber-500/50 text-amber-600 dark:text-amber-400"
                                : "bg-muted/40 hover:bg-muted border-border/70 text-muted-foreground hover:text-foreground"
                        )}
                    >
                        Limit
                    </button>
                )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-stretch">

                {/* Inputs Container */}
                <div className="space-y-3">
                    <div className={cn(
                        "bg-muted/30 rounded-xl p-3 border transition-colors",
                        isTransferredFlash ? "border-emerald-500/70 bg-emerald-500/5" : "border-border/50"
                    )}>
                        <div className="h-5 mb-1.5 flex items-center justify-between gap-1">
                            <label className="text-xs leading-5 font-medium text-muted-foreground truncate">
                                Verfügbarer Betrag · {budgetCurrencyLabel}
                            </label>
                            {currency !== 'CHF' && (
                                <button
                                    type="button"
                                    onClick={() => setBudgetInChf(prev => !prev)}
                                    title={budgetInChf
                                        ? `Budget direkt in ${currency} eingeben`
                                        : `Budget in CHF eingeben und live in ${currency} umrechnen`}
                                    className={cn(
                                        "h-5 inline-flex items-center justify-center leading-none px-1.5 py-0 text-xs font-semibold rounded border transition-colors cursor-pointer whitespace-nowrap shrink-0",
                                        budgetInChf
                                            ? "bg-primary/15 border-primary/50 text-primary"
                                            : "bg-background/80 border-border text-muted-foreground hover:text-foreground"
                                    )}
                                >
                                    in CHF
                                </button>
                            )}
                        </div>
                        <div className="relative">
                            <input
                                type="number"
                                inputMode="decimal"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                onKeyDown={preventArrowStep}
                                placeholder={isChfConverted ? "z.B. 10000" : "z.B. 50000"}
                                className="w-full h-10 pl-3 pr-8 py-0 text-base font-bold font-mono tabular-nums rounded-lg bg-background text-foreground border border-input focus:outline-none focus:ring-2 focus:ring-primary/20 no-spinner"
                            />
                            {amount !== '' && (
                                <button
                                    type="button"
                                    onClick={() => setAmount('')}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                                    title="Feld leeren"
                                    aria-label="Betrag leeren"
                                >
                                    <X className="size-3.5" />
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="bg-muted/30 rounded-xl p-3 border border-border/50">
                        <div className="h-5 mb-1.5 flex items-center justify-between gap-1">
                            <label className="text-xs leading-5 font-medium text-muted-foreground truncate">
                                Aktienkurs · {currency}
                            </label>
                        </div>
                        <div className="relative">
                            <input
                                type="number"
                                inputMode="decimal"
                                value={price}
                                onChange={(e) => setPrice(e.target.value)}
                                onKeyDown={preventArrowStep}
                                placeholder="z.B. 170"
                                className="w-full h-10 pl-3 pr-8 py-0 text-base font-bold font-mono tabular-nums rounded-lg bg-background text-foreground border border-input focus:outline-none focus:ring-2 focus:ring-primary/20 no-spinner"
                            />
                            {price !== '' && (
                                <button
                                    type="button"
                                    onClick={() => setPrice('')}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                                    title="Feld leeren"
                                    aria-label="Aktienkurs leeren"
                                >
                                    <X className="size-3.5" />
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* Result Display */}
                <div className="flex flex-col items-center justify-center p-4 bg-muted/10 rounded-xl h-full border border-border/30">
                    {shares !== null ? (
                        <div className="text-center space-y-2.5 w-full">
                            <div>
                                <span className="text-xs font-medium text-muted-foreground mb-1 block">Mögliche Anzahl</span>
                                <span className="text-2xl font-bold tracking-tight font-mono tabular-nums leading-tight block text-foreground">
                                    {shares.toLocaleString('de-CH')} <span className="text-sm text-muted-foreground font-sans font-semibold">Stk.</span>
                                </span>
                            </div>
                            <div className="pt-2 border-t border-border/50">
                                <span className="text-xs font-medium text-muted-foreground mb-1 block">Restbetrag</span>
                                <span className="text-base font-bold font-mono tabular-nums leading-tight text-foreground block">
                                    {(remaining ?? 0).toLocaleString('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className="text-xs font-sans font-normal text-muted-foreground">{currency}</span>
                                </span>
                                {isChfConverted && Number.isFinite(effectiveAmountInStockCurrency) && effectiveAmountInStockCurrency > 0 && (
                                    <span className="text-xs font-mono tabular-nums text-muted-foreground mt-1 block">
                                        ≈ {effectiveAmountInStockCurrency.toLocaleString('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {currency}
                                    </span>
                                )}
                            </div>
                        </div>
                    ) : (
                        <>
                            <span className="text-xs font-medium text-muted-foreground mb-1">Mögliche Anzahl</span>
                            <span className="text-2xl font-bold text-muted-foreground leading-tight">-</span>
                            {isChfConverted && Number.isFinite(effectiveAmountInStockCurrency) && effectiveAmountInStockCurrency > 0 && (
                                <span className="text-xs font-mono tabular-nums text-muted-foreground mt-2">
                                    ≈ {effectiveAmountInStockCurrency.toLocaleString('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {currency}
                                </span>
                            )}
                        </>
                    )}
                </div>
            </div>

            {/* Footer Action: Transfer to Kauf / Verkauf */}
            <div className="mt-auto pt-4">
                <button
                    type="button"
                    disabled={!canTransferToBuySim}
                    onClick={handleTransferToBuySim}
                    title={canTransferToBuySim && shares !== null
                        ? `${shares.toLocaleString('de-CH')} Stk.${selectedStock ? ` ${selectedStock.symbol}` : ''} zu ${formatPriceInput(priceNum)} ${currency} in Kauf / Verkauf übernehmen`
                        : 'Betrag und Aktienkurs eingeben'}
                    className={cn(
                        "w-full h-9 inline-flex items-center justify-center leading-none gap-1.5 px-3 py-0 rounded-lg border text-xs font-semibold transition-all whitespace-nowrap",
                        canTransferToBuySim
                            ? "border-emerald-500/40 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 cursor-pointer active:scale-[0.99]"
                            : "border-border/50 bg-muted/20 text-muted-foreground/50 cursor-not-allowed"
                    )}
                >
                    <span>In Kauf / Verkauf übernehmen</span>
                    <ArrowRight className="size-3.5 shrink-0" />
                </button>
            </div>
        </div>
    );
}
