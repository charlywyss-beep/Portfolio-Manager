
import { useState } from 'react';
import { Calculator, X, RotateCcw } from 'lucide-react';
import { cn } from '../utils';

interface CurrencyGainCalculatorProps {
    className?: string;
}

type CalculatorMode = 'rate' | 'value';

const preventArrowStep = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault();
    }
};

export function CurrencyGainCalculator({ className }: CurrencyGainCalculatorProps) {
    const [mode, setMode] = useState<CalculatorMode>('rate');

    // State for Rate Mode
    const [oldRate, setOldRate] = useState<string>('');
    const [newRate, setNewRate] = useState<string>('');

    // State for Value Mode
    const [amount, setAmount] = useState<string>('');
    const [percentage, setPercentage] = useState<string>('');

    const hasAnyValue =
        (mode === 'rate' && (oldRate !== '' || newRate !== '')) ||
        (mode === 'value' && (amount !== '' || percentage !== ''));

    const handleClear = () => {
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

    if (mode === 'rate') {
        const oldRateNum = parseFloat(oldRate);
        const newRateNum = parseFloat(newRate);

        if (!isNaN(oldRateNum) && !isNaN(newRateNum) && oldRateNum !== 0) {
            const percentageChange = ((newRateNum - oldRateNum) / oldRateNum) * 100;
            const isPositive = percentageChange >= 0;

            result = (
                <div className="text-center">
                    <span className="text-xs font-medium text-muted-foreground mb-1 block">Veränderung</span>
                    <span className={cn(
                        "text-2xl font-bold tracking-tight font-mono tabular-nums leading-tight block",
                        isPositive ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
                    )}>
                        {isPositive ? '+' : ''}{percentageChange.toFixed(2)}%
                    </span>
                </div>
            );
        }
    } else {
        const amountNum = parseFloat(amount);
        const percentageNum = parseFloat(percentage);

        if (!isNaN(amountNum) && !isNaN(percentageNum)) {
            const gain = amountNum * (percentageNum / 100);
            const total = amountNum + gain;
            const isPositive = gain >= 0;

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
                        </span>
                    </div>
                    <div className="pt-2 border-t border-border/50">
                        <span className="text-xs font-medium text-muted-foreground mb-1 block">Neuer Wert</span>
                        <span className="text-base font-bold font-mono tabular-nums leading-tight text-foreground block">
                            {formatNumber(total)}
                        </span>
                    </div>
                </div>
            );
        }
    }

    return (
        <div className={cn("bg-card rounded-xl border border-border p-5 shadow-sm flex flex-col", className)}>
            <div className="flex items-center justify-between gap-2 h-[42px] mb-4 shrink-0">
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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-stretch">

                {/* Inputs Container */}
                <div className="space-y-3">
                    {mode === 'rate' ? (
                        <>
                            <div className="bg-muted/30 rounded-xl p-3 border border-border/50">
                                <label className="text-xs leading-4 font-medium text-muted-foreground mb-1.5 block">Alter Kurs</label>
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
                                <label className="text-xs leading-4 font-medium text-muted-foreground mb-1.5 block">Neuer Kurs</label>
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
                                <label className="text-xs leading-4 font-medium text-muted-foreground mb-1.5 block">Betrag</label>
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
                                <label className="text-xs leading-4 font-medium text-muted-foreground mb-1.5 block">Wertsteigerung %</label>
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
                <div className="flex flex-col items-center justify-center p-4 bg-muted/10 rounded-xl h-full border border-border/30">
                    {result ? result : (
                        <>
                            <span className="text-xs font-medium text-muted-foreground mb-2">Ergebnis</span>
                            <span className="text-2xl font-bold text-muted-foreground">-</span>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
