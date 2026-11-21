
import { useState, useMemo, useEffect } from 'react';
import { Percent, X, RotateCcw } from 'lucide-react';
import { cn } from '../utils';
import { usePortfolio } from '../context/PortfolioContext';
import { usePortfolioData } from '../hooks/usePortfolioData';
import { useExchangeRates } from '../context/ExchangeRateContext';
import { convertToCHF } from '../utils/currency';
import { CalculatorPresetSelect, type PresetSelectOption } from './CalculatorPresetSelect';

interface InterestRateCalculatorProps {
    className?: string;
}

type InterestMode = 'rate' | 'capital' | 'income';

const INTEREST_CALC_STORAGE_KEY = 'finanz_rechner_interest_calc';

interface SavedInterestState {
    mode: InterestMode;
    selectedPreset: string;
    capital: string;
    interestIncome: string;
    interestRate: string;
}

const loadSavedInterestState = (): Partial<SavedInterestState> => {
    try {
        const raw = localStorage.getItem(INTEREST_CALC_STORAGE_KEY);
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

const getFrequencyFactor = (freq?: string) => {
    switch (freq) {
        case 'monthly': return 12;
        case 'quarterly': return 4;
        case 'semi-annually': return 2;
        case 'annually': return 1;
        default: return 1;
    }
};

export function InterestRateCalculator({ className }: InterestRateCalculatorProps) {
    const { fixedDeposits } = usePortfolio();
    const { positions, totals } = usePortfolioData();
    const { rates } = useExchangeRates();

    const [initial] = useState<Partial<SavedInterestState>>(() => loadSavedInterestState());
    const [mode, setMode] = useState<InterestMode>(
        initial.mode === 'capital' || initial.mode === 'income' ? initial.mode : 'rate'
    );
    const [selectedPreset, setSelectedPreset] = useState<string>(initial.selectedPreset || '');
    const [capital, setCapital] = useState<string>(initial.capital || '');
    const [interestIncome, setInterestIncome] = useState<string>(initial.interestIncome || '');
    const [interestRate, setInterestRate] = useState<string>(initial.interestRate || '');

    useEffect(() => {
        try {
            const payload: SavedInterestState = {
                mode,
                selectedPreset,
                capital,
                interestIncome,
                interestRate
            };
            localStorage.setItem(INTEREST_CALC_STORAGE_KEY, JSON.stringify(payload));
        } catch {}
    }, [mode, selectedPreset, capital, interestIncome, interestRate]);

    const dividendPositions = useMemo(() => {
        return positions
            .map(p => {
                const currentValCHF = convertToCHF(p.currentValue, p.stock.currency, rates);
                let divNative = 0;
                if (p.stock.dividendAmount) {
                    divNative = p.stock.dividendAmount * p.shares * getFrequencyFactor(p.stock.dividendFrequency);
                } else if (p.stock.dividendYield) {
                    divNative = p.currentValue * (p.stock.dividendYield / 100);
                }
                const divCurrency = p.stock.dividendCurrency || p.stock.currency;
                const annualDivCHF = convertToCHF(divNative, divCurrency, rates);
                return {
                    id: p.id,
                    name: p.stock.name,
                    symbol: p.stock.symbol,
                    capitalCHF: currentValCHF,
                    annualDivCHF,
                    yieldPct: currentValCHF > 0 ? (annualDivCHF / currentValCHF) * 100 : 0
                };
            })
            .filter(item => item.capitalCHF > 0 && item.annualDivCHF > 0)
            .sort((a, b) => a.name.localeCompare(b.name, 'de'));
    }, [positions, rates]);

    const activeDeposits = useMemo(() => {
        return (fixedDeposits || [])
            .filter(fd => fd.amount > 0)
            .sort((a, b) => a.bankName.localeCompare(b.bankName, 'de'));
    }, [fixedDeposits]);

    const handleSelectPreset = (val: string) => {
        setSelectedPreset(val);
        if (!val) return;

        if (val === 'portfolio:all') {
            const cap = totals.totalValueStock;
            const inc = totals.projectedYearlyDividends;
            const pct = cap > 0 ? (inc / cap) * 100 : 0;
            setCapital(cap.toFixed(2));
            setInterestIncome(inc.toFixed(2));
            setInterestRate(pct.toFixed(2));
            return;
        }

        if (val.startsWith('pos:')) {
            const posId = val.slice(4);
            const item = dividendPositions.find(p => p.id === posId);
            if (!item) return;
            setCapital(item.capitalCHF.toFixed(2));
            setInterestIncome(item.annualDivCHF.toFixed(2));
            setInterestRate(item.yieldPct.toFixed(2));
            return;
        }

        if (val.startsWith('fd:')) {
            const fdId = val.slice(3);
            const fd = activeDeposits.find(d => d.id === fdId);
            if (!fd) return;
            const annualInterest = (fd.amount * fd.interestRate) / 100;
            setCapital(fd.amount.toFixed(2));
            setInterestRate(fd.interestRate.toFixed(2));
            setInterestIncome(annualInterest.toFixed(2));
        }
    };

    const kNum = parseFloat(capital);
    const zNum = parseFloat(interestIncome);
    const pNum = parseFloat(interestRate);

    const hasAnyValue =
        selectedPreset !== '' ||
        (mode === 'rate' && (capital !== '' || interestIncome !== '')) ||
        (mode === 'capital' && (interestIncome !== '' || interestRate !== '')) ||
        (mode === 'income' && (capital !== '' || interestRate !== ''));

    const handleClear = () => {
        setSelectedPreset('');
        setCapital('');
        setInterestIncome('');
        setInterestRate('');
    };

    const formatNumber = (val: number) =>
        val.toLocaleString('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    let resultLabel = 'Berechneter Zinssatz';
    let result: React.ReactNode = null;
    let infoFormula = 'Formel: (Zins-Ertrag × 100) / Kapital — berechnet den Prozentsatz aus Ertrag und Kapital.';

    if (mode === 'rate') {
        resultLabel = 'Berechneter Zinssatz';
        infoFormula = 'Formel: (Zins-Ertrag × 100) / Kapital — berechnet den Prozentsatz aus Ertrag und Kapital.';
        if (!isNaN(zNum) && !isNaN(kNum) && kNum !== 0) {
            const p = (zNum * 100) / kNum;
            result = (
                <span className="text-2xl font-bold tracking-tight font-mono tabular-nums leading-tight block text-foreground">
                    {p.toFixed(2)}%
                </span>
            );
        }
    } else if (mode === 'capital') {
        resultLabel = 'Benötigtes Kapital';
        infoFormula = 'Formel: (Zins-Ertrag × 100) / Zinssatz — berechnet, wie viel Kapital für den gewünschten Ertrag nötig ist.';
        if (!isNaN(zNum) && !isNaN(pNum) && pNum !== 0) {
            const neededCapital = (zNum * 100) / pNum;
            result = (
                <span className="text-2xl font-bold tracking-tight font-mono tabular-nums leading-tight block text-foreground">
                    {formatNumber(neededCapital)}
                </span>
            );
        }
    } else {
        resultLabel = 'Berechneter Zins-Ertrag';
        infoFormula = 'Formel: (Kapital × Zinssatz) / 100 — berechnet den jährlichen Ertrag bei gegebenem Kapital und Zinssatz.';
        if (!isNaN(kNum) && !isNaN(pNum)) {
            const earned = (kNum * pNum) / 100;
            const isPositive = earned >= 0;
            result = (
                <span className={cn(
                    "text-2xl font-bold tracking-tight font-mono tabular-nums leading-tight block",
                    isPositive ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
                )}>
                    {isPositive ? '+' : ''}{formatNumber(earned)}
                </span>
            );
        }
    }

    const presetOptions = useMemo<PresetSelectOption[]>(() => {
        const list: PresetSelectOption[] = [];
        if (totals.totalValueStock > 0) {
            const totalYield = (totals.projectedYearlyDividends / totals.totalValueStock) * 100;
            list.push({
                value: 'portfolio:all',
                label: 'Gesamtes Depot',
                sublabel: 'CHF',
                meta: `${totalYield.toFixed(2)}%`,
                group: 'Übersicht'
            });
        }
        dividendPositions.forEach(item => {
            list.push({
                value: `pos:${item.id}`,
                label: item.name,
                sublabel: item.symbol,
                meta: `${item.yieldPct.toFixed(2)}%`,
                group: 'Bestand · Dividende CHF'
            });
        });
        activeDeposits.forEach(fd => {
            list.push({
                value: `fd:${fd.id}`,
                label: fd.bankName,
                sublabel: fd.currency,
                meta: `${fd.interestRate.toFixed(2)}%`,
                group: 'Festgeld & Konten'
            });
        });
        return list;
    }, [totals.totalValueStock, totals.projectedYearlyDividends, dividendPositions, activeDeposits]);

    return (
        <div className={cn("bg-card rounded-xl border border-border p-5 shadow-sm flex flex-col", className)}>
            <div className="flex items-center justify-between gap-2 h-[42px] mb-3 shrink-0">
                <div className="flex items-center gap-2.5 min-w-0">
                    <div className="p-2 rounded-lg bg-primary/10 text-primary shrink-0">
                        <Percent className="size-4" />
                    </div>
                    <div className="min-w-0">
                        <h3 className="text-base font-semibold leading-tight truncate">Zinssatz Rechner</h3>
                        <p className="text-xs text-muted-foreground truncate">Zinssatz, Kapital & Ertrag</p>
                    </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                    <div className="inline-flex bg-muted/50 rounded-lg p-0.5 gap-0.5">
                        {([
                            { id: 'rate', label: 'Zinssatz' },
                            { id: 'capital', label: 'Kapital' },
                            { id: 'income', label: 'Ertrag' }
                        ] as { id: InterestMode; label: string }[]).map((m) => (
                            <button
                                key={m.id}
                                type="button"
                                onClick={() => setMode(m.id)}
                                className={cn(
                                    "h-7 inline-flex items-center justify-center leading-none px-2 py-0 text-xs font-medium rounded-md transition-all whitespace-nowrap cursor-pointer",
                                    mode === m.id
                                        ? "bg-background text-foreground shadow-sm border border-border/70"
                                        : "text-muted-foreground hover:text-foreground border border-transparent"
                                )}
                            >
                                {m.label}
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

            {/* Optional Portfolio / Fixed Deposit Quick-Select */}
            <div className="flex items-center gap-1.5 h-8 mb-3 shrink-0">
                <CalculatorPresetSelect
                    value={selectedPreset}
                    onChange={handleSelectPreset}
                    options={presetOptions}
                    placeholder="Depot / Festgeld laden · optional"
                    ariaLabel="Depot oder Festgeld laden"
                />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-stretch">
                {/* Inputs */}
                <div className="space-y-3">
                    {mode === 'rate' && (
                        <>
                            <div className="bg-muted/30 rounded-xl p-3 border border-border/50">
                                <div className="h-5 mb-1.5 flex items-center justify-between gap-1">
                                    <label className="text-xs leading-5 font-medium text-muted-foreground truncate tracking-tight">Kapital</label>
                                </div>
                                <div className="relative">
                                    <input
                                        type="number"
                                        inputMode="decimal"
                                        value={capital}
                                        onChange={(e) => setCapital(e.target.value)}
                                        onKeyDown={preventArrowStep}
                                        placeholder="z.B. 10000"
                                        className="w-full h-10 pl-3 pr-8 py-0 text-base font-bold font-mono tabular-nums rounded-lg bg-background text-foreground border border-input focus:outline-none focus:ring-2 focus:ring-primary/20 no-spinner"
                                    />
                                    {capital !== '' && (
                                        <button
                                            type="button"
                                            onClick={() => setCapital('')}
                                            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                                            title="Feld leeren"
                                            aria-label="Kapital leeren"
                                        >
                                            <X className="size-3.5" />
                                        </button>
                                    )}
                                </div>
                            </div>

                            <div className="bg-muted/30 rounded-xl p-3 border border-border/50">
                                <div className="h-5 mb-1.5 flex items-center justify-between gap-1">
                                    <label className="text-xs leading-5 font-medium text-muted-foreground truncate tracking-tight">Zins-Ertrag</label>
                                </div>
                                <div className="relative">
                                    <input
                                        type="number"
                                        inputMode="decimal"
                                        value={interestIncome}
                                        onChange={(e) => setInterestIncome(e.target.value)}
                                        onKeyDown={preventArrowStep}
                                        placeholder="z.B. 400"
                                        className="w-full h-10 pl-3 pr-8 py-0 text-base font-bold font-mono tabular-nums rounded-lg bg-background text-foreground border border-input focus:outline-none focus:ring-2 focus:ring-primary/20 no-spinner"
                                    />
                                    {interestIncome !== '' && (
                                        <button
                                            type="button"
                                            onClick={() => setInterestIncome('')}
                                            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                                            title="Feld leeren"
                                            aria-label="Zins-Ertrag leeren"
                                        >
                                            <X className="size-3.5" />
                                        </button>
                                    )}
                                </div>
                            </div>
                        </>
                    )}

                    {mode === 'capital' && (
                        <>
                            <div className="bg-muted/30 rounded-xl p-3 border border-border/50">
                                <div className="h-5 mb-1.5 flex items-center justify-between gap-1">
                                    <label className="text-xs leading-5 font-medium text-muted-foreground truncate tracking-tight">Gewünschter Zins-Ertrag</label>
                                </div>
                                <div className="relative">
                                    <input
                                        type="number"
                                        inputMode="decimal"
                                        value={interestIncome}
                                        onChange={(e) => setInterestIncome(e.target.value)}
                                        onKeyDown={preventArrowStep}
                                        placeholder="z.B. 1000"
                                        className="w-full h-10 pl-3 pr-8 py-0 text-base font-bold font-mono tabular-nums rounded-lg bg-background text-foreground border border-input focus:outline-none focus:ring-2 focus:ring-primary/20 no-spinner"
                                    />
                                    {interestIncome !== '' && (
                                        <button
                                            type="button"
                                            onClick={() => setInterestIncome('')}
                                            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                                            title="Feld leeren"
                                            aria-label="Zins-Ertrag leeren"
                                        >
                                            <X className="size-3.5" />
                                        </button>
                                    )}
                                </div>
                            </div>

                            <div className="bg-muted/30 rounded-xl p-3 border border-border/50">
                                <div className="h-5 mb-1.5 flex items-center justify-between gap-1">
                                    <label className="text-xs leading-5 font-medium text-muted-foreground truncate tracking-tight">Zinssatz %</label>
                                </div>
                                <div className="relative">
                                    <input
                                        type="number"
                                        inputMode="decimal"
                                        value={interestRate}
                                        onChange={(e) => setInterestRate(e.target.value)}
                                        onKeyDown={preventArrowStep}
                                        placeholder="z.B. 4.0"
                                        className="w-full h-10 pl-3 pr-8 py-0 text-base font-bold font-mono tabular-nums rounded-lg bg-background text-foreground border border-input focus:outline-none focus:ring-2 focus:ring-primary/20 no-spinner"
                                    />
                                    {interestRate !== '' && (
                                        <button
                                            type="button"
                                            onClick={() => setInterestRate('')}
                                            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                                            title="Feld leeren"
                                            aria-label="Zinssatz leeren"
                                        >
                                            <X className="size-3.5" />
                                        </button>
                                    )}
                                </div>
                            </div>
                        </>
                    )}

                    {mode === 'income' && (
                        <>
                            <div className="bg-muted/30 rounded-xl p-3 border border-border/50">
                                <div className="h-5 mb-1.5 flex items-center justify-between gap-1">
                                    <label className="text-xs leading-5 font-medium text-muted-foreground truncate tracking-tight">Kapital</label>
                                </div>
                                <div className="relative">
                                    <input
                                        type="number"
                                        inputMode="decimal"
                                        value={capital}
                                        onChange={(e) => setCapital(e.target.value)}
                                        onKeyDown={preventArrowStep}
                                        placeholder="z.B. 25000"
                                        className="w-full h-10 pl-3 pr-8 py-0 text-base font-bold font-mono tabular-nums rounded-lg bg-background text-foreground border border-input focus:outline-none focus:ring-2 focus:ring-primary/20 no-spinner"
                                    />
                                    {capital !== '' && (
                                        <button
                                            type="button"
                                            onClick={() => setCapital('')}
                                            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                                            title="Feld leeren"
                                            aria-label="Kapital leeren"
                                        >
                                            <X className="size-3.5" />
                                        </button>
                                    )}
                                </div>
                            </div>

                            <div className="bg-muted/30 rounded-xl p-3 border border-border/50">
                                <div className="h-5 mb-1.5 flex items-center justify-between gap-1">
                                    <label className="text-xs leading-5 font-medium text-muted-foreground truncate tracking-tight">Zinssatz %</label>
                                </div>
                                <div className="relative">
                                    <input
                                        type="number"
                                        inputMode="decimal"
                                        value={interestRate}
                                        onChange={(e) => setInterestRate(e.target.value)}
                                        onKeyDown={preventArrowStep}
                                        placeholder="z.B. 4.0"
                                        className="w-full h-10 pl-3 pr-8 py-0 text-base font-bold font-mono tabular-nums rounded-lg bg-background text-foreground border border-input focus:outline-none focus:ring-2 focus:ring-primary/20 no-spinner"
                                    />
                                    {interestRate !== '' && (
                                        <button
                                            type="button"
                                            onClick={() => setInterestRate('')}
                                            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                                            title="Feld leeren"
                                            aria-label="Zinssatz leeren"
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
                <div className="flex flex-col items-center justify-center p-4 bg-muted/10 rounded-xl h-full border border-border/30">
                    <span className="text-xs font-medium text-muted-foreground mb-1">{resultLabel}</span>
                    {result ? result : (
                        <span className="text-2xl font-bold text-muted-foreground leading-tight">-</span>
                    )}
                </div>
            </div>

            {/* Hint */}
            <div className="mt-auto pt-4">
                <div className="min-h-[36px] flex items-center gap-2 px-3 py-1.5 bg-muted/20 rounded-lg text-xs text-muted-foreground leading-snug">
                    <span className="font-bold text-primary shrink-0">INFO:</span>
                    <p>{infoFormula}</p>
                </div>
            </div>
        </div>
    );
}
