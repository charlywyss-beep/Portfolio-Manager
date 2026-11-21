
import { useState } from 'react';
import { PieChart, X, RotateCcw } from 'lucide-react';
import { cn } from '../utils';

interface ShareCalculatorProps {
    className?: string;
}

type Currency = 'CHF' | 'USD' | 'GBP' | 'EUR';

const preventArrowStep = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault();
    }
};

export function ShareCalculator({ className }: ShareCalculatorProps) {
    const [amount, setAmount] = useState<string>('');
    const [price, setPrice] = useState<string>('');
    const [currency, setCurrency] = useState<Currency>('USD');

    const amountNum = parseFloat(amount);
    const priceNum = parseFloat(price);
    const hasAnyValue = amount !== '' || price !== '';

    const handleClear = () => {
        setAmount('');
        setPrice('');
    };

    let shares: number | null = null;
    let remaining: number | null = null;

    if (!isNaN(amountNum) && !isNaN(priceNum) && priceNum !== 0) {
        shares = Math.floor(amountNum / priceNum);
        remaining = amountNum - (shares * priceNum);
    }

    return (
        <div className={cn("bg-card rounded-xl border border-border p-5 shadow-sm flex flex-col", className)}>
            <div className="flex items-center justify-between gap-2 h-[42px] mb-4 shrink-0">
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
                                onClick={() => setCurrency(c)}
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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-stretch">

                {/* Inputs Container */}
                <div className="space-y-3">
                    <div className="bg-muted/30 rounded-xl p-3 border border-border/50">
                        <label className="text-xs leading-4 font-medium text-muted-foreground mb-1.5 block">Verfügbarer Betrag · {currency}</label>
                        <div className="relative">
                            <input
                                type="number"
                                inputMode="decimal"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                onKeyDown={preventArrowStep}
                                placeholder="z.B. 50000"
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
                        <label className="text-xs leading-4 font-medium text-muted-foreground mb-1.5 block">Aktienkurs · {currency}</label>
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
                        <div className="text-center space-y-3 w-full">
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
                            </div>
                        </div>
                    ) : (
                        <>
                            <span className="text-xs font-medium text-muted-foreground mb-1">Mögliche Anzahl</span>
                            <span className="text-2xl font-bold text-muted-foreground leading-tight">-</span>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
