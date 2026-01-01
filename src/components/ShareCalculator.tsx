
import { useState } from 'react';
import { PieChart } from 'lucide-react';
import { cn } from '../utils';

interface ShareCalculatorProps {
    className?: string;
}

type Currency = 'CHF' | 'USD' | 'GBP' | 'EUR';

export function ShareCalculator({ className }: ShareCalculatorProps) {
    const [amount, setAmount] = useState<string>('');
    const [price, setPrice] = useState<string>('');
    const [currency, setCurrency] = useState<Currency>('USD');

    const amountNum = parseFloat(amount);
    const priceNum = parseFloat(price);

    let shares: number | null = null;
    let remaining: number | null = null;

    if (!isNaN(amountNum) && !isNaN(priceNum) && priceNum !== 0) {
        shares = Math.floor(amountNum / priceNum);
        remaining = amountNum - (shares * priceNum);
    }

    return (
        <div className={cn("bg-card rounded-xl border border-border p-6 shadow-sm", className)}>
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                        <PieChart className="size-5" />
                    </div>
                    <div>
                        <h3 className="text-lg font-semibold">Aktien-Kauf Rechner</h3>
                        <p className="text-xs text-muted-foreground">Anzahl Anteile berechnen</p>
                    </div>
                </div>

                {/* Currency Selector */}
                <div className="flex bg-muted/50 rounded-lg p-1">
                    {(['CHF', 'USD', 'EUR', 'GBP'] as Currency[]).map((c) => (
                        <button
                            key={c}
                            onClick={() => setCurrency(c)}
                            className={cn(
                                "px-2.5 py-1 text-xs font-medium rounded-md transition-all",
                                currency === c
                                    ? "bg-background text-foreground shadow-sm"
                                    : "text-muted-foreground hover:text-foreground"
                            )}
                        >
                            {c}
                        </button>
                    ))}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">

                {/* Inputs Container */}
                <div className="space-y-4">
                    <div className="bg-muted/30 rounded-xl p-4 border border-border/50">
                        <label className="text-sm font-medium text-muted-foreground mb-2 block">Verfügbarer Betrag ({currency})</label>
                        <input
                            type="number"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            placeholder="z.B. 50000"
                            className="w-full px-4 py-3 text-2xl font-bold rounded-lg bg-background text-foreground border border-input focus:outline-none focus:ring-2 focus:ring-primary/20"
                            step="100"
                        />
                    </div>

                    <div className="bg-muted/30 rounded-xl p-4 border border-border/50">
                        <label className="text-sm font-medium text-muted-foreground mb-2 block">Aktienkurs ({currency})</label>
                        <input
                            type="number"
                            value={price}
                            onChange={(e) => setPrice(e.target.value)}
                            placeholder="z.B. 170"
                            className="w-full px-4 py-3 text-2xl font-bold rounded-lg bg-background text-foreground border border-input focus:outline-none focus:ring-2 focus:ring-primary/20"
                            step="0.01"
                        />
                    </div>
                </div>

                {/* Result Display */}
                <div className="flex flex-col items-center justify-center p-6 bg-muted/10 rounded-xl h-full border border-border/30">
                    <span className="text-sm font-medium text-muted-foreground mb-2">Mögliche Anzahl</span>

                    {shares !== null ? (
                        <div className="text-center">
                            <span className="text-4xl font-bold tracking-tight font-mono block mb-1 text-foreground">
                                {shares} <span className="text-lg text-muted-foreground font-sans">Stk.</span>
                            </span>
                            <div className="mt-4 flex flex-col items-center">
                                <span className="text-sm font-medium text-muted-foreground">Restbetrag:</span>
                                <span className="text-xl font-bold font-mono text-foreground mt-1">
                                    {remaining?.toFixed(2)} <span className="text-sm font-sans font-normal text-muted-foreground">{currency}</span>
                                </span>
                            </div>
                        </div>
                    ) : (
                        <span className="text-4xl font-bold text-muted-foreground">-</span>
                    )}
                </div>
            </div>
        </div>
    );
}
