
import { useState } from 'react';
import { Percent } from 'lucide-react';
import { cn } from '../utils';

interface InterestRateCalculatorProps {
    className?: string;
}

export function InterestRateCalculator({ className }: InterestRateCalculatorProps) {
    const [interestIncome, setInterestIncome] = useState<string>('');
    const [capital, setCapital] = useState<string>('');

    // Calculation: Zinssatz = (Zins-Ertrag * 100) / Kapital
    const zNum = parseFloat(interestIncome);
    const kNum = parseFloat(capital);

    let result: React.ReactNode = null;

    if (!isNaN(zNum) && !isNaN(kNum) && kNum !== 0) {
        const p = (zNum * 100) / kNum;
        result = (
            <div className="text-center">
                <span className="text-4xl font-bold tracking-tight font-mono block mb-1 text-primary">
                    {p.toFixed(2)}%
                </span>
                <span className="text-sm font-medium text-muted-foreground mt-1 block">Zinssatz</span>
            </div>
        );
    }

    return (
        <div className={cn("bg-card rounded-xl border border-border p-6 shadow-sm", className)}>
            <div className="flex items-center gap-3 mb-6">
                <div className="p-2 rounded-lg bg-primary/10 text-primary">
                    <Percent className="size-5" />
                </div>
                <div>
                    <h3 className="text-lg font-semibold">Zinssatz Rechner</h3>
                    <p className="text-xs text-muted-foreground">Berechnung des Zinssatzes in Prozent</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                {/* Inputs */}
                <div className="space-y-4">
                    <div className="bg-muted/30 rounded-xl p-4 border border-border/50">
                        <label className="text-sm font-medium text-muted-foreground mb-2 block tracking-tight">Kapital</label>
                        <input
                            type="number"
                            value={capital}
                            onChange={(e) => setCapital(e.target.value)}
                            placeholder="z.B. 1000.00"
                            className="w-full px-4 py-3 text-2xl font-bold rounded-lg bg-background text-foreground border border-input focus:outline-none focus:ring-2 focus:ring-primary/20"
                            step="0.01"
                        />
                    </div>

                    <div className="bg-muted/30 rounded-xl p-4 border border-border/50">
                        <label className="text-sm font-medium text-muted-foreground mb-2 block tracking-tight">Zins-Ertrag</label>
                        <input
                            type="number"
                            value={interestIncome}
                            onChange={(e) => setInterestIncome(e.target.value)}
                            placeholder="z.B. 10.00"
                            className="w-full px-4 py-3 text-2xl font-bold rounded-lg bg-background text-foreground border border-input focus:outline-none focus:ring-2 focus:ring-primary/20"
                            step="0.01"
                        />
                    </div>
                </div>

                {/* Result Display */}
                <div className="flex flex-col items-center justify-center p-6 bg-muted/10 rounded-xl h-full border border-border/30">
                    <span className="text-sm font-medium text-muted-foreground mb-2">Berechneter Zinssatz</span>
                    {result ? result : (
                        <span className="text-4xl font-bold text-muted-foreground">-</span>
                    )}
                </div>
            </div>

            {/* Hint */}
            <div className="mt-6 flex items-start gap-2 p-3 bg-muted/20 rounded-lg text-[10px] text-muted-foreground leading-relaxed">
                <span className="font-bold text-primary">INFO:</span>
                <p>Formel: (Zins-Ertrag * 100) / Kapital. Dies berechnet, wie hoch der Zinssatz in Prozent ist, basierend auf dem Ertrag und dem eingesetzten Kapital.</p>
            </div>
        </div>
    );
}
