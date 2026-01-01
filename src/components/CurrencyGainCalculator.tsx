
import { useState } from 'react';
import { Calculator } from 'lucide-react';
import { cn } from '../utils';

interface CurrencyGainCalculatorProps {
    className?: string;
}

type CalculatorMode = 'rate' | 'value';

export function CurrencyGainCalculator({ className }: CurrencyGainCalculatorProps) {
    const [mode, setMode] = useState<CalculatorMode>('rate');

    // State for Rate Mode
    const [oldRate, setOldRate] = useState<string>('');
    const [newRate, setNewRate] = useState<string>('');

    // State for Value Mode
    const [amount, setAmount] = useState<string>('');
    const [percentage, setPercentage] = useState<string>('');

    // Calculations
    let result: React.ReactNode = null;

    if (mode === 'rate') {
        const oldRateNum = parseFloat(oldRate);
        const newRateNum = parseFloat(newRate);

        let percentageChange: number | null = null;
        let isPositive = false;

        if (!isNaN(oldRateNum) && !isNaN(newRateNum) && oldRateNum !== 0) {
            percentageChange = ((newRateNum - oldRateNum) / oldRateNum) * 100;
            isPositive = percentageChange >= 0;

            result = percentageChange !== null ? (
                <div className="text-center">
                    <span className={cn(
                        "text-4xl font-bold tracking-tight font-mono block mb-1",
                        isPositive ? "text-emerald-500" : "text-destructive"
                    )}>
                        {isPositive ? '+' : ''}{percentageChange.toFixed(2)}%
                    </span>
                    <span className="text-sm font-medium text-muted-foreground mt-1 block">Veränderung</span>
                </div>
            ) : null;
        }
    } else {
        const amountNum = parseFloat(amount);
        const percentageNum = parseFloat(percentage);

        if (!isNaN(amountNum) && !isNaN(percentageNum)) {
            const gain = amountNum * (percentageNum / 100);
            const total = amountNum + gain;
            const isPositive = percentageNum >= 0;

            result = (
                <div className="text-center">
                    <span className={cn(
                        "text-4xl font-bold tracking-tight font-mono block mb-1",
                        isPositive ? "text-emerald-500" : "text-destructive"
                    )}>
                        {total.toFixed(2)}
                    </span>
                    <span className="text-sm font-medium text-muted-foreground mt-1 block">Neuer Wert</span>
                    <div className={cn(
                        "text-lg font-bold font-mono mt-2",
                        isPositive ? "text-emerald-500" : "text-destructive"
                    )}>
                        ({isPositive ? '+' : ''}{gain.toFixed(2)})
                    </div>
                </div>
            );
        }
    }

    return (
        <div className={cn("bg-card rounded-xl border border-border p-6 shadow-sm", className)}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10 text-primary">
                        <Calculator className="size-5" />
                    </div>
                    <div>
                        <h3 className="text-lg font-semibold">Gewinn Rechner</h3>
                        <p className="text-xs text-muted-foreground">Währungs- und Wertentwicklung</p>
                    </div>
                </div>

                {/* Mode Switcher */}
                <div className="flex bg-muted/50 rounded-lg p-1 self-start sm:self-auto">
                    <button
                        onClick={() => setMode('rate')}
                        className={cn(
                            "px-3 py-1 text-xs font-medium rounded-md transition-all",
                            mode === 'rate'
                                ? "bg-background text-foreground shadow-sm"
                                : "text-muted-foreground hover:text-foreground"
                        )}
                    >
                        Kurs-Vergleich
                    </button>
                    <button
                        onClick={() => setMode('value')}
                        className={cn(
                            "px-3 py-1 text-xs font-medium rounded-md transition-all",
                            mode === 'value'
                                ? "bg-background text-foreground shadow-sm"
                                : "text-muted-foreground hover:text-foreground"
                        )}
                    >
                        Wert-Steigerung
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">

                {/* Inputs Container */}
                <div className="space-y-4">
                    {mode === 'rate' ? (
                        <>
                            <div className="bg-muted/30 rounded-xl p-4 border border-border/50">
                                <label className="text-sm font-medium text-muted-foreground mb-2 block">Alter Kurs</label>
                                <input
                                    type="number"
                                    value={oldRate}
                                    onChange={(e) => setOldRate(e.target.value)}
                                    placeholder="0.00"
                                    className="w-full px-4 py-3 text-2xl font-bold rounded-lg bg-background text-foreground border border-input focus:outline-none focus:ring-2 focus:ring-primary/20"
                                    step="0.0001"
                                />
                            </div>

                            <div className="bg-muted/30 rounded-xl p-4 border border-border/50">
                                <label className="text-sm font-medium text-muted-foreground mb-2 block">Neuer Kurs</label>
                                <input
                                    type="number"
                                    value={newRate}
                                    onChange={(e) => setNewRate(e.target.value)}
                                    placeholder="0.00"
                                    className="w-full px-4 py-3 text-2xl font-bold rounded-lg bg-background text-foreground border border-input focus:outline-none focus:ring-2 focus:ring-primary/20"
                                    step="0.0001"
                                />
                            </div>
                        </>
                    ) : (
                        <>
                            <div className="bg-muted/30 rounded-xl p-4 border border-border/50">
                                <label className="text-sm font-medium text-muted-foreground mb-2 block">Betrag</label>
                                <input
                                    type="number"
                                    value={amount}
                                    onChange={(e) => setAmount(e.target.value)}
                                    placeholder="z.B. 100"
                                    className="w-full px-4 py-3 text-2xl font-bold rounded-lg bg-background text-foreground border border-input focus:outline-none focus:ring-2 focus:ring-primary/20"
                                    step="1"
                                />
                            </div>

                            <div className="bg-muted/30 rounded-xl p-4 border border-border/50">
                                <label className="text-sm font-medium text-muted-foreground mb-2 block">Wertsteigerung (%)</label>
                                <input
                                    type="number"
                                    value={percentage}
                                    onChange={(e) => setPercentage(e.target.value)}
                                    placeholder="z.B. 25"
                                    className="w-full px-4 py-3 text-2xl font-bold rounded-lg bg-background text-foreground border border-input focus:outline-none focus:ring-2 focus:ring-primary/20"
                                    step="0.01"
                                />
                            </div>
                        </>
                    )}
                </div>

                {/* Result Display */}
                <div className="flex flex-col items-center justify-center p-6 bg-muted/10 rounded-xl h-full border border-border/30">
                    <span className="text-sm font-medium text-muted-foreground mb-2">Ergebnis</span>

                    {result ? result : (
                        <span className="text-4xl font-bold text-muted-foreground">-</span>
                    )}
                </div>
            </div>
        </div>
    );
}
