
import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calculator, X, RotateCcw, ArrowRight, Coins } from 'lucide-react';
import { cn } from '../utils';
import { usePortfolio } from '../context/PortfolioContext';
import { useExchangeRates } from '../context/ExchangeRateContext';
import { convertToCHF } from '../utils/currency';
import { CalculatorPresetSelect, type PresetSelectOption } from './CalculatorPresetSelect';

interface CurrencyGainCalculatorProps {
    className?: string;
}

type CalculatorMode = 'rate' | 'value';
type DividendHorizon = 'sinceBuy' | '1' | '2' | '3' | '5' | '10';

const GAIN_CALC_STORAGE_KEY = 'finanz_rechner_gain_calc';

interface SavedGainState {
    mode: CalculatorMode;
    selectedPositionId: string;
    oldRate: string;
    newRate: string;
    amount: string;
    percentage: string;
    includeDividend: boolean;
    dividendHorizon: DividendHorizon;
}

const VALID_HORIZONS: DividendHorizon[] = ['sinceBuy', '1', '2', '3', '5', '10'];

const loadSavedGainState = (): Partial<SavedGainState> => {
    try {
        const raw = localStorage.getItem(GAIN_CALC_STORAGE_KEY);
        if (!raw) return {};
        return JSON.parse(raw) || {};
    } catch {
        return {};
    }
};

const preventArrowStep = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault();
    }
};

const normalizeStockPrice = (val: number, cur?: string) => (cur === 'GBp' ? val / 100 : val);

const formatPriceInput = (val: number) => {
    if (!Number.isFinite(val)) return '';
    return val >= 10 ? val.toFixed(2) : Number(val.toFixed(4)).toString();
};

const getFrequencyFactor = (freq?: string) => {
    switch (freq) {
        case 'monthly': return 12;
        case 'quarterly': return 4;
        case 'semi-annually': return 2;
        case 'annually': return 1;
        default: return 1;
    }
};

const convertBetweenCurrencies = (
    val: number,
    fromCur: string,
    toCur: string,
    rates: Record<string, number>
) => {
    const normFrom = fromCur === 'GBp' ? 'GBP' : (fromCur || 'CHF');
    const normTo = toCur === 'GBp' ? 'GBP' : (toCur || 'CHF');
    if (normFrom === normTo) return val;
    const inChf = convertToCHF(val, normFrom, rates);
    if (normTo === 'CHF') return inChf;
    const targetRate = rates[normTo];
    return targetRate && targetRate > 0 ? inChf * targetRate : inChf;
};

export function CurrencyGainCalculator({ className }: CurrencyGainCalculatorProps) {
    const navigate = useNavigate();
    const { positions, stocks, updateSimulatorState } = usePortfolio();
    const { rates } = useExchangeRates();

    const [initial] = useState<Partial<SavedGainState>>(() => loadSavedGainState());
    const [mode, setMode] = useState<CalculatorMode>(initial.mode === 'value' ? 'value' : 'rate');
    const [selectedPositionId, setSelectedPositionId] = useState<string>(initial.selectedPositionId || '');

    // State for Rate Mode
    const [oldRate, setOldRate] = useState<string>(initial.oldRate || '');
    const [newRate, setNewRate] = useState<string>(initial.newRate || '');

    // State for Value Mode
    const [amount, setAmount] = useState<string>(initial.amount || '');
    const [percentage, setPercentage] = useState<string>(initial.percentage || '');

    // Dividend projection toggle & horizon
    const [includeDividend, setIncludeDividend] = useState<boolean>(Boolean(initial.includeDividend));
    const [dividendHorizon, setDividendHorizon] = useState<DividendHorizon>(
        initial.dividendHorizon && VALID_HORIZONS.includes(initial.dividendHorizon)
            ? initial.dividendHorizon
            : '1'
    );

    useEffect(() => {
        try {
            const payload: SavedGainState = {
                mode,
                selectedPositionId,
                oldRate,
                newRate,
                amount,
                percentage,
                includeDividend,
                dividendHorizon
            };
            localStorage.setItem(GAIN_CALC_STORAGE_KEY, JSON.stringify(payload));
        } catch {}
    }, [mode, selectedPositionId, oldRate, newRate, amount, percentage, includeDividend, dividendHorizon]);

    const ownedOptions = useMemo(() => {
        return positions
            .filter(p => p.shares > 0)
            .map(position => {
                const stock = stocks.find(s => s.id === position.stockId);
                return stock ? { position, stock } : null;
            })
            .filter((item): item is NonNullable<typeof item> => item !== null)
            .sort((a, b) => a.stock.name.localeCompare(b.stock.name, 'de'));
    }, [positions, stocks]);

    const selectedEntry = useMemo(
        () => ownedOptions.find(o => o.position.id === selectedPositionId) || null,
        [ownedOptions, selectedPositionId]
    );

    const selectedCurrency = selectedEntry
        ? (selectedEntry.stock.currency === 'GBp' ? 'GBP' : selectedEntry.stock.currency)
        : '';
    const selectedCurrentPrice = selectedEntry
        ? normalizeStockPrice(selectedEntry.stock.currentPrice, selectedEntry.stock.currency)
        : 0;
    const selectedSellLimit = selectedEntry?.stock.sellLimit && selectedEntry.stock.sellLimit > 0
        ? normalizeStockPrice(selectedEntry.stock.sellLimit, selectedEntry.stock.currency)
        : null;

    // Annual gross dividend of selected position in selectedCurrency
    const annualDividendTotal = useMemo(() => {
        if (!selectedEntry) return 0;
        const { position, stock } = selectedEntry;
        if (stock.distributionPolicy === 'accumulating') return 0;

        if (stock.dividendAmount && stock.dividendAmount > 0) {
            const factor = getFrequencyFactor(stock.dividendFrequency);
            const annualPerShare = stock.dividendAmount * factor;
            const normalizedPerShare = (stock.currency === 'GBp' && !stock.dividendCurrency)
                ? annualPerShare / 100
                : annualPerShare;
            const rawTotal = normalizedPerShare * position.shares;
            return convertBetweenCurrencies(
                rawTotal,
                stock.dividendCurrency || stock.currency,
                stock.currency,
                rates
            );
        }

        if (stock.dividendYield && stock.dividendYield > 0 && selectedCurrentPrice > 0) {
            return (position.shares * selectedCurrentPrice) * (stock.dividendYield / 100);
        }

        return 0;
    }, [selectedEntry, selectedCurrentPrice, rates]);

    // Weighted holding duration in years (if purchase date(s) exist)
    const holdingYears = useMemo(() => {
        if (!selectedEntry) return null;
        const { position } = selectedEntry;
        const nowMs = Date.now();
        const MS_PER_YEAR = 365.25 * 24 * 60 * 60 * 1000;

        if (position.purchases && position.purchases.length > 0) {
            let weightedSum = 0;
            let totalShares = 0;
            position.purchases.forEach(p => {
                if (!p.date || !(p.shares > 0)) return;
                const ts = new Date(p.date).getTime();
                if (!Number.isFinite(ts)) return;
                const yrs = Math.max(0, (nowMs - ts) / MS_PER_YEAR);
                weightedSum += yrs * p.shares;
                totalShares += p.shares;
            });
            if (totalShares > 0) {
                return weightedSum / totalShares;
            }
        }

        if (position.buyDate) {
            const ts = new Date(position.buyDate).getTime();
            if (Number.isFinite(ts)) {
                return Math.max(0, (nowMs - ts) / MS_PER_YEAR);
            }
        }

        return null;
    }, [selectedEntry]);

    const hasHoldingYears = holdingYears !== null && holdingYears >= 0.05;
    const hasDividend = selectedEntry !== null && annualDividendTotal > 0;
    const activeDividendMode = includeDividend && hasDividend;

    const effectiveHorizon: DividendHorizon =
        dividendHorizon === 'sinceBuy' && !hasHoldingYears ? '1' : dividendHorizon;

    const effectiveDividendYears = useMemo(() => {
        if (effectiveHorizon === 'sinceBuy') {
            return holdingYears ?? 1;
        }
        return Number(effectiveHorizon) || 1;
    }, [effectiveHorizon, holdingYears]);

    const horizonShortLabel = useMemo(() => {
        if (effectiveHorizon === 'sinceBuy') {
            return `Seit Kauf · ${(holdingYears ?? 0).toFixed(1)} J`;
        }
        return `${effectiveHorizon} J`;
    }, [effectiveHorizon, holdingYears]);

    const horizonOptions = useMemo(() => {
        const items: { id: DividendHorizon; label: string; title: string }[] = [];
        if (hasHoldingYears && holdingYears !== null) {
            items.push({
                id: 'sinceBuy',
                label: 'Kauf',
                title: `Seit Kauf · ca. ${holdingYears.toFixed(1)} Jahre`
            });
        }
        items.push({ id: '1', label: '1J', title: '1 Jahr Dividende' });
        if (!hasHoldingYears) {
            items.push({ id: '2', label: '2J', title: '2 Jahre Dividenden hochrechnen' });
        }
        items.push({ id: '3', label: '3J', title: '3 Jahre Dividenden hochrechnen' });
        items.push({ id: '5', label: '5J', title: '5 Jahre Dividenden hochrechnen' });
        items.push({ id: '10', label: '10J', title: '10 Jahre Dividenden hochrechnen' });
        return items;
    }, [hasHoldingYears, holdingYears]);

    const projectedDividend = activeDividendMode
        ? annualDividendTotal * effectiveDividendYears
        : 0;

    const handleSelectPosition = (posId: string) => {
        setSelectedPositionId(posId);
        if (!posId) return;
        const entry = ownedOptions.find(o => o.position.id === posId);
        if (!entry) return;
        const buyPrice = normalizeStockPrice(entry.position.buyPriceAvg, entry.stock.currency);
        const curPrice = normalizeStockPrice(entry.stock.currentPrice, entry.stock.currency);
        const costBasis = entry.position.shares * buyPrice;
        const pctSinceBuy = buyPrice > 0 ? ((curPrice - buyPrice) / buyPrice) * 100 : 0;
        setOldRate(formatPriceInput(buyPrice));
        setNewRate(formatPriceInput(curPrice));
        setAmount(costBasis.toFixed(2));
        setPercentage(pctSinceBuy.toFixed(2));
    };

    const isAtSellLimit = selectedSellLimit !== null && Math.abs(parseFloat(newRate) - selectedSellLimit) < 0.0001;

    const handleToggleSellLimit = () => {
        if (!selectedEntry || selectedSellLimit === null) return;
        if (isAtSellLimit) {
            setNewRate(formatPriceInput(selectedCurrentPrice));
        } else {
            setNewRate(formatPriceInput(selectedSellLimit));
        }
    };

    const hasAnyValue =
        selectedPositionId !== '' ||
        (mode === 'rate' && (oldRate !== '' || newRate !== '')) ||
        (mode === 'value' && (amount !== '' || percentage !== ''));

    const handleClear = () => {
        setSelectedPositionId('');
        setIncludeDividend(false);
        setDividendHorizon('1');
        if (mode === 'rate') {
            setOldRate('');
            setNewRate('');
        } else {
            setAmount('');
            setPercentage('');
        }
    };

    // Calculations
    let result: React.ReactNode = null;

    const formatNumber = (val: number) =>
        val.toLocaleString('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    const oldRateNum = parseFloat(oldRate);
    const newRateNum = parseFloat(newRate);
    const amountNum = parseFloat(amount);
    const percentageNum = parseFloat(percentage);

    if (mode === 'rate') {
        if (!isNaN(oldRateNum) && !isNaN(newRateNum) && oldRateNum !== 0) {
            const percentageChange = ((newRateNum - oldRateNum) / oldRateNum) * 100;
            const positionGain = selectedEntry
                ? (newRateNum - oldRateNum) * selectedEntry.position.shares
                : null;

            if (activeDividendMode && selectedEntry && positionGain !== null) {
                const costBase = oldRateNum * selectedEntry.position.shares;
                const divPct = costBase > 0 ? (projectedDividend / costBase) * 100 : 0;
                const totalPct = percentageChange + divPct;
                const totalGain = positionGain + projectedDividend;
                const isTotalPositive = totalPct >= 0;

                result = (
                    <div className="text-center w-full">
                        <div>
                            <span className="text-xs font-medium text-muted-foreground mb-0.5 block">
                                Gesamtrendite · {horizonShortLabel}
                            </span>
                            <span className={cn(
                                "text-2xl font-bold tracking-tight font-mono tabular-nums leading-tight block",
                                isTotalPositive ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
                            )}>
                                {isTotalPositive ? '+' : ''}{totalPct.toFixed(2)}%
                            </span>
                            <div className="mt-1.5 mx-auto w-fit grid grid-cols-[auto_auto] gap-x-4 gap-y-0.5 text-[13px] leading-snug">
                                <span className="text-left text-muted-foreground">Kurs</span>
                                <span className={cn(
                                    "text-right font-mono tabular-nums font-semibold",
                                    percentageChange >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
                                )}>
                                    {percentageChange >= 0 ? '+' : ''}{percentageChange.toFixed(2)}%
                                </span>
                                <span className="text-left text-muted-foreground">Dividende</span>
                                <span className="text-right font-mono tabular-nums font-semibold text-green-600 dark:text-green-400">
                                    +{divPct.toFixed(2)}%
                                </span>
                            </div>
                        </div>
                        <div className="pt-1.5 mt-1.5 border-t border-border/50">
                            <span className="text-xs font-medium text-muted-foreground mb-0.5 block">
                                {totalGain >= 0 ? 'Gesamtgewinn' : 'Gesamtverlust'} · {selectedEntry.position.shares} Stk.
                            </span>
                            <span className={cn(
                                "text-base font-bold font-mono tabular-nums leading-tight block",
                                totalGain >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
                            )}>
                                {totalGain >= 0 ? '+' : ''}{formatNumber(totalGain)} <span className="text-xs font-sans font-normal text-muted-foreground">{selectedCurrency}</span>
                            </span>
                        </div>
                    </div>
                );
            } else {
                const isPositive = percentageChange >= 0;
                result = (
                    <div className={cn("text-center w-full", positionGain !== null && "space-y-3")}>
                        <div>
                            <span className="text-xs font-medium text-muted-foreground mb-1 block">Veränderung</span>
                            <span className={cn(
                                "text-2xl font-bold tracking-tight font-mono tabular-nums leading-tight block",
                                isPositive ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
                            )}>
                                {isPositive ? '+' : ''}{percentageChange.toFixed(2)}%
                            </span>
                        </div>
                        {positionGain !== null && (
                            <div className="pt-2 border-t border-border/50">
                                <span className="text-xs font-medium text-muted-foreground mb-1 block">
                                    {positionGain >= 0 ? 'Gewinn' : 'Verlust'} · {selectedEntry?.position.shares} Stk.
                                </span>
                                <span className={cn(
                                    "text-base font-bold font-mono tabular-nums leading-tight block",
                                    positionGain >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
                                )}>
                                    {positionGain >= 0 ? '+' : ''}{formatNumber(positionGain)} <span className="text-xs font-sans font-normal text-muted-foreground">{selectedCurrency}</span>
                                </span>
                            </div>
                        )}
                    </div>
                );
            }
        }
    } else {
        if (!isNaN(amountNum) && !isNaN(percentageNum)) {
            const gain = amountNum * (percentageNum / 100);
            const totalGain = gain + projectedDividend;
            const totalValue = amountNum + totalGain;
            const isPositive = totalGain >= 0;

            if (activeDividendMode) {
                const totalReturnPct = amountNum > 0 ? (totalGain / amountNum) * 100 : percentageNum;
                result = (
                    <div className="text-center w-full">
                        <div>
                            <span className="text-xs font-medium text-muted-foreground mb-0.5 block">
                                {isPositive ? 'Gesamtgewinn' : 'Gesamtverlust'} · {horizonShortLabel}
                            </span>
                            <span className={cn(
                                "text-2xl font-bold tracking-tight font-mono tabular-nums leading-tight block",
                                isPositive ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
                            )}>
                                {isPositive ? '+' : ''}{formatNumber(totalGain)}
                                {selectedCurrency && (
                                    <span className="text-xs font-sans font-normal text-muted-foreground ml-1">{selectedCurrency}</span>
                                )}
                            </span>
                            <div className="mt-1.5 mx-auto w-fit grid grid-cols-[auto_auto] gap-x-4 gap-y-0.5 text-[13px] leading-snug">
                                <span className="text-left text-muted-foreground">Kurs</span>
                                <span className={cn(
                                    "text-right font-mono tabular-nums font-semibold",
                                    gain >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
                                )}>
                                    {gain >= 0 ? '+' : ''}{formatNumber(gain)}
                                </span>
                                <span className="text-left text-muted-foreground">Dividende</span>
                                <span className="text-right font-mono tabular-nums font-semibold text-green-600 dark:text-green-400">
                                    +{formatNumber(projectedDividend)}
                                </span>
                            </div>
                        </div>
                        <div className="pt-1.5 mt-1.5 border-t border-border/50">
                            <span className="text-xs font-medium text-muted-foreground mb-0.5 block">
                                Gesamtwert · {totalReturnPct >= 0 ? '+' : ''}{totalReturnPct.toFixed(2)}%
                            </span>
                            <span className="text-base font-bold font-mono tabular-nums leading-tight text-foreground block">
                                {formatNumber(totalValue)}
                                {selectedCurrency && (
                                    <span className="text-xs font-sans font-normal text-muted-foreground ml-1">{selectedCurrency}</span>
                                )}
                            </span>
                        </div>
                    </div>
                );
            } else {
                result = (
                    <div className="text-center space-y-3 w-full">
                        <div>
                            <span className="text-xs font-medium text-muted-foreground mb-1 block">
                                {isPositive ? 'Gewinn' : 'Verlust'}
                            </span>
                            <span className={cn(
                                "text-2xl font-bold tracking-tight font-mono tabular-nums leading-tight block",
                                isPositive ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
                            )}>
                                {isPositive ? '+' : ''}{formatNumber(gain)}
                                {selectedCurrency && (
                                    <span className="text-xs font-sans font-normal text-muted-foreground ml-1">{selectedCurrency}</span>
                                )}
                            </span>
                        </div>
                        <div className="pt-2 border-t border-border/50">
                            <span className="text-xs font-medium text-muted-foreground mb-1 block">Neuer Wert</span>
                            <span className="text-base font-bold font-mono tabular-nums leading-tight text-foreground block">
                                {formatNumber(totalValue)}
                                {selectedCurrency && (
                                    <span className="text-xs font-sans font-normal text-muted-foreground ml-1">{selectedCurrency}</span>
                                )}
                            </span>
                        </div>
                    </div>
                );
            }
        }
    }

    const simulatedSellPrice = useMemo(() => {
        if (!selectedEntry) return null;
        if (mode === 'rate') {
            return !isNaN(newRateNum) && newRateNum > 0 ? newRateNum : null;
        }
        if (!isNaN(amountNum) && amountNum > 0 && !isNaN(percentageNum) && selectedEntry.position.shares > 0) {
            const targetTotal = amountNum * (1 + percentageNum / 100);
            const targetPerShare = targetTotal / selectedEntry.position.shares;
            return targetPerShare > 0 ? targetPerShare : null;
        }
        return null;
    }, [selectedEntry, mode, newRateNum, amountNum, percentageNum]);

    const canSimulateSell = selectedEntry !== null && simulatedSellPrice !== null && simulatedSellPrice > 0;

    const handleSimulateSell = () => {
        if (!selectedEntry || !simulatedSellPrice || simulatedSellPrice <= 0) return;
        const { position, stock } = selectedEntry;
        const sellPrice = Number(simulatedSellPrice.toFixed(4));
        const normalizedCurrency = stock.currency === 'GBp' ? 'GBP' : stock.currency;
        const isAcc = stock.distributionPolicy === 'accumulating';
        let annualDiv = stock.dividendAmount || 0;
        const stockFreq = stock.dividendFrequency && stock.dividendFrequency !== 'none' ? stock.dividendFrequency : 'annually';
        if (stockFreq === 'quarterly') annualDiv *= 4;
        else if (stockFreq === 'monthly') annualDiv *= 12;
        else if (stockFreq === 'semi-annually') annualDiv *= 2;
        const normalizedDiv = stock.currency === 'GBp' ? annualDiv / 100 : annualDiv;

        updateSimulatorState({
            mode: 'sell',
            selectedStockId: stock.id,
            simName: stock.name,
            simSymbol: stock.symbol,
            simIsin: stock.isin || '',
            simCurrency: normalizedCurrency,
            simType: stock.type === 'etf' ? 'etf' : 'stock',
            simDistributionPolicy: stock.distributionPolicy || (isAcc ? 'accumulating' : 'distributing'),
            simFrequency: isAcc ? undefined : stockFreq,
            shares: position.shares,
            price: sellPrice,
            dividend: isAcc ? 0 : normalizedDiv
        });
        navigate(`/calculator?from=exchange-rates&price=${encodeURIComponent(sellPrice.toString())}`);
    };

    const presetOptions = useMemo<PresetSelectOption[]>(() => {
        return ownedOptions.map(({ position, stock }) => ({
            value: position.id,
            label: stock.name,
            sublabel: stock.symbol,
            meta: `${position.shares.toLocaleString('de-CH')} Stk.`
        }));
    }, [ownedOptions]);

    return (
        <div className={cn("bg-card rounded-xl border border-border p-5 shadow-sm flex flex-col", className)}>
            <div className="flex items-center justify-between gap-2 h-[42px] mb-3 shrink-0">
                <div className="flex items-center gap-2.5 min-w-0">
                    <div className="p-2 rounded-lg bg-primary/10 text-primary shrink-0">
                        <Calculator className="size-4" />
                    </div>
                    <div className="min-w-0">
                        <h3 className="text-base font-semibold leading-tight truncate">Gewinn Rechner</h3>
                        <p className="text-xs text-muted-foreground truncate">Währungs- & Wertentwicklung</p>
                    </div>
                </div>

                {/* Mode Switcher & Clear */}
                <div className="flex items-center gap-1.5 shrink-0">
                    <div className="inline-flex bg-muted/50 rounded-lg p-0.5 gap-0.5">
                        <button
                            type="button"
                            onClick={() => setMode('rate')}
                            className={cn(
                                "h-7 inline-flex items-center justify-center leading-none px-2 py-0 text-xs font-medium rounded-md transition-all whitespace-nowrap cursor-pointer",
                                mode === 'rate'
                                    ? "bg-background text-foreground shadow-sm border border-border/70"
                                    : "text-muted-foreground hover:text-foreground border border-transparent"
                            )}
                        >
                            Kurs
                        </button>
                        <button
                            type="button"
                            onClick={() => setMode('value')}
                            className={cn(
                                "h-7 inline-flex items-center justify-center leading-none px-2 py-0 text-xs font-medium rounded-md transition-all whitespace-nowrap cursor-pointer",
                                mode === 'value'
                                    ? "bg-background text-foreground shadow-sm border border-border/70"
                                    : "text-muted-foreground hover:text-foreground border border-transparent"
                            )}
                        >
                            Steigerung
                        </button>
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

            {/* Optional Owned Position Quick-Select + Dividend & Target Chips */}
            <div className="flex items-center gap-1.5 h-8 mb-3 shrink-0">
                <CalculatorPresetSelect
                    value={selectedPositionId}
                    onChange={handleSelectPosition}
                    options={presetOptions}
                    placeholder="Bestand laden · optional"
                    ariaLabel="Bestands-Position laden"
                />
                {hasDividend && (
                    <button
                        type="button"
                        onClick={() => setIncludeDividend(prev => !prev)}
                        title={includeDividend
                            ? `Dividenden ${formatNumber(annualDividendTotal)} ${selectedCurrency}/Jahr Brutto wieder ausblenden`
                            : `Dividenden ${formatNumber(annualDividendTotal)} ${selectedCurrency}/Jahr Brutto einbeziehen und hochrechnen`}
                        className={cn(
                            "h-8 inline-flex items-center justify-center leading-none gap-1 px-2 py-0 text-xs font-semibold rounded-lg border transition-colors cursor-pointer whitespace-nowrap shrink-0",
                            includeDividend
                                ? "bg-emerald-500/15 border-emerald-500/50 text-emerald-600 dark:text-emerald-400"
                                : "bg-muted/40 hover:bg-muted border-border/70 text-muted-foreground hover:text-foreground"
                        )}
                    >
                        <Coins className="size-3.5 shrink-0" />
                        <span>Dividende</span>
                    </button>
                )}
                {selectedSellLimit !== null && mode === 'rate' && (
                    <button
                        type="button"
                        onClick={handleToggleSellLimit}
                        title={isAtSellLimit
                            ? `Aktuellen Kurs ${formatPriceInput(selectedCurrentPrice)} ${selectedCurrency} laden`
                            : `Verkaufslimit ${formatPriceInput(selectedSellLimit)} ${selectedCurrency} laden`}
                        className={cn(
                            "h-8 inline-flex items-center justify-center leading-none px-2 py-0 text-xs font-semibold rounded-lg border transition-colors cursor-pointer whitespace-nowrap shrink-0",
                            isAtSellLimit
                                ? "bg-amber-500/15 border-amber-500/50 text-amber-600 dark:text-amber-400"
                                : "bg-muted/40 hover:bg-muted border-border/70 text-muted-foreground hover:text-foreground"
                        )}
                    >
                        Ziel
                    </button>
                )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-stretch">

                {/* Inputs Container */}
                <div className="space-y-3">
                    {mode === 'rate' ? (
                        <>
                            <div className="bg-muted/30 rounded-xl p-3 border border-border/50">
                                <div className="h-5 mb-1.5 flex items-center justify-between gap-1">
                                    <label className="text-xs leading-5 font-medium text-muted-foreground truncate">
                                        {selectedEntry ? `Alter Kurs · ${selectedCurrency}` : 'Alter Kurs'}
                                    </label>
                                </div>
                                <div className="relative">
                                    <input
                                        type="number"
                                        inputMode="decimal"
                                        value={oldRate}
                                        onChange={(e) => setOldRate(e.target.value)}
                                        onKeyDown={preventArrowStep}
                                        placeholder="0.00"
                                        className="w-full h-10 pl-3 pr-8 py-0 text-base font-bold font-mono tabular-nums rounded-lg bg-background text-foreground border border-input focus:outline-none focus:ring-2 focus:ring-primary/20 no-spinner"
                                    />
                                    {oldRate !== '' && (
                                        <button
                                            type="button"
                                            onClick={() => setOldRate('')}
                                            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                                            title="Feld leeren"
                                            aria-label="Alter Kurs leeren"
                                        >
                                            <X className="size-3.5" />
                                        </button>
                                    )}
                                </div>
                            </div>

                            <div className="bg-muted/30 rounded-xl p-3 border border-border/50">
                                <div className="h-5 mb-1.5 flex items-center justify-between gap-1">
                                    <label className="text-xs leading-5 font-medium text-muted-foreground truncate">
                                        {selectedEntry ? `Neuer Kurs · ${selectedCurrency}` : 'Neuer Kurs'}
                                    </label>
                                </div>
                                <div className="relative">
                                    <input
                                        type="number"
                                        inputMode="decimal"
                                        value={newRate}
                                        onChange={(e) => setNewRate(e.target.value)}
                                        onKeyDown={preventArrowStep}
                                        placeholder="0.00"
                                        className="w-full h-10 pl-3 pr-8 py-0 text-base font-bold font-mono tabular-nums rounded-lg bg-background text-foreground border border-input focus:outline-none focus:ring-2 focus:ring-primary/20 no-spinner"
                                    />
                                    {newRate !== '' && (
                                        <button
                                            type="button"
                                            onClick={() => setNewRate('')}
                                            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                                            title="Feld leeren"
                                            aria-label="Neuer Kurs leeren"
                                        >
                                            <X className="size-3.5" />
                                        </button>
                                    )}
                                </div>
                            </div>
                        </>
                    ) : (
                        <>
                            <div className="bg-muted/30 rounded-xl p-3 border border-border/50">
                                <div className="h-5 mb-1.5 flex items-center justify-between gap-1">
                                    <label className="text-xs leading-5 font-medium text-muted-foreground truncate">
                                        {selectedEntry ? `Einstandswert · ${selectedCurrency}` : 'Betrag'}
                                    </label>
                                </div>
                                <div className="relative">
                                    <input
                                        type="number"
                                        inputMode="decimal"
                                        value={amount}
                                        onChange={(e) => setAmount(e.target.value)}
                                        onKeyDown={preventArrowStep}
                                        placeholder="z.B. 100"
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
                                    <label className="text-xs leading-5 font-medium text-muted-foreground truncate">Wertsteigerung %</label>
                                </div>
                                <div className="relative">
                                    <input
                                        type="number"
                                        inputMode="decimal"
                                        value={percentage}
                                        onChange={(e) => setPercentage(e.target.value)}
                                        onKeyDown={preventArrowStep}
                                        placeholder="z.B. 25"
                                        className="w-full h-10 pl-3 pr-8 py-0 text-base font-bold font-mono tabular-nums rounded-lg bg-background text-foreground border border-input focus:outline-none focus:ring-2 focus:ring-primary/20 no-spinner"
                                    />
                                    {percentage !== '' && (
                                        <button
                                            type="button"
                                            onClick={() => setPercentage('')}
                                            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                                            title="Feld leeren"
                                            aria-label="Wertsteigerung leeren"
                                        >
                                            <X className="size-3.5" />
                                        </button>
                                    )}
                                </div>
                            </div>
                        </>
                    )}
                </div>

                {/* Result Display */}
                <div className={cn(
                    "flex flex-col items-center justify-center bg-muted/10 rounded-xl h-full border border-border/30",
                    activeDividendMode ? "p-2.5" : "p-4"
                )}>
                    {activeDividendMode && (
                        <div className="inline-flex items-center bg-muted/60 rounded-lg p-0.5 gap-0.5 mb-1.5">
                            {horizonOptions.map(opt => (
                                <button
                                    key={opt.id}
                                    type="button"
                                    onClick={() => setDividendHorizon(opt.id)}
                                    title={opt.title}
                                    className={cn(
                                        "h-6 inline-flex items-center justify-center leading-none px-2 py-0 text-xs font-semibold rounded-md transition-all whitespace-nowrap cursor-pointer",
                                        effectiveHorizon === opt.id
                                            ? "bg-background text-emerald-600 dark:text-emerald-400 shadow-xs border border-emerald-500/40"
                                            : "text-muted-foreground hover:text-foreground border border-transparent"
                                    )}
                                >
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                    )}
                    {result ? result : (
                        <>
                            <span className="text-xs font-medium text-muted-foreground mb-2">Ergebnis</span>
                            <span className="text-2xl font-bold text-muted-foreground">-</span>
                        </>
                    )}
                </div>
            </div>

            {/* Footer Action: Sell Simulation */}
            <div className="mt-auto pt-4">
                <button
                    type="button"
                    disabled={!canSimulateSell}
                    onClick={handleSimulateSell}
                    title={canSimulateSell && selectedEntry && simulatedSellPrice
                        ? `Verkauf von ${selectedEntry.position.shares} Stk. ${selectedEntry.stock.symbol} zu ${formatPriceInput(simulatedSellPrice)} ${selectedCurrency} in Kauf / Verkauf prüfen`
                        : 'Bestands-Position und Zielkurs oder Prozentwert eingeben'}
                    className={cn(
                        "w-full h-9 inline-flex items-center justify-center leading-none gap-1.5 px-3 py-0 rounded-lg border text-xs font-semibold transition-all whitespace-nowrap",
                        canSimulateSell
                            ? "border-primary/40 bg-primary/10 hover:bg-primary/20 text-primary cursor-pointer active:scale-[0.99]"
                            : "border-border/50 bg-muted/20 text-muted-foreground/50 cursor-not-allowed"
                    )}
                >
                    <span>Als Verkauf in Kauf / Verkauf</span>
                    <ArrowRight className="size-3.5 shrink-0" />
                </button>
            </div>
        </div>
    );
}
