
import { useState, useMemo, useEffect } from 'react';
import { Calculator } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { cn } from '../utils';

export function CompoundInterestProjection() {
    const [initialCapital, setInitialCapital] = useState(10000);
    const [monthlyContribution, setMonthlyContribution] = useState(500);
    const [years, setYears] = useState(20);
    const [dividendYield, setDividendYield] = useState(3.5);
    const [priceAppreciation, setPriceAppreciation] = useState(4.0);
    const [reinvest, setReinvest] = useState(true);
    const [hasMounted, setHasMounted] = useState(false);

    useEffect(() => {
        setHasMounted(true);
    }, []);

    const projectionData = useMemo(() => {
        let currentCapital = initialCapital;
        let totalInvested = initialCapital;
        const data = [];

        for (let year = 0; year <= years; year++) {
            data.push({
                year: `J${year}`,
                capital: currentCapital,
                invested: totalInvested,
                dividend: currentCapital * (dividendYield / 100)
            });

            // Calculate next year
            const annualContribution = monthlyContribution * 12;
            totalInvested += annualContribution;

            // 1. Price Appreciation
            currentCapital = currentCapital * (1 + priceAppreciation / 100);

            // 2. New Money
            currentCapital += annualContribution;

            // 3. Dividends (if reinvested)
            if (reinvest) {
                const dividends = currentCapital * (dividendYield / 100); // Simplify: Dividends on new capital
                currentCapital += dividends;
            }
        }
        return data;
    }, [initialCapital, monthlyContribution, years, dividendYield, priceAppreciation, reinvest]);

    const finalYear = projectionData[projectionData.length - 1];
    const displayDividendYear = finalYear;

    return (
        <div className="p-5 rounded-xl bg-card border border-border shadow-sm">
            <div className="flex items-center gap-2 mb-4 text-primary">
                <Calculator className="size-5" />
                <h3 className="font-semibold text-lg">Zinseszins Projektion</h3>
            </div>

            {/* Compact Inputs for Projection */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
                <div className="space-y-1">
                    <label className="text-[10px] uppercase text-muted-foreground">Startkapital</label>
                    <input
                        type="number"
                        value={initialCapital}
                        onChange={(e) => setInitialCapital(Number(e.target.value))}
                        onFocus={(e) => e.target.select()}
                        className="w-full px-2 py-1.5 text-sm rounded border border-input bg-background/50 text-right no-spinner"
                    />
                </div>
                <div className="space-y-1">
                    <label className="text-[10px] uppercase text-muted-foreground">Sparrate / Mt.</label>
                    <input
                        type="number"
                        value={monthlyContribution}
                        onChange={(e) => setMonthlyContribution(Number(e.target.value))}
                        onFocus={(e) => e.target.select()}
                        className="w-full px-2 py-1.5 text-sm rounded border border-input bg-background/50 text-right no-spinner"
                    />
                </div>
                <div className="space-y-1">
                    <label className="text-[10px] uppercase text-muted-foreground">Jahre</label>
                    <input
                        type="number"
                        value={years}
                        onChange={(e) => setYears(Number(e.target.value))}
                        onFocus={(e) => e.target.select()}
                        className="w-full px-2 py-1.5 text-sm rounded border border-input bg-background/50 text-right no-spinner"
                    />
                </div>
                <div className="space-y-1">
                    <label className="text-[10px] uppercase text-muted-foreground">Div. Rendite %</label>
                    <input
                        type="number"
                        step="0.1"
                        value={dividendYield}
                        onChange={(e) => setDividendYield(Number(e.target.value))}
                        onFocus={(e) => e.target.select()}
                        className="w-full px-2 py-1.5 text-sm rounded border border-input bg-background/50 text-right no-spinner"
                    />
                </div>
                <div className="space-y-1">
                    <label className="text-[10px] uppercase text-muted-foreground">Kursgewinn %</label>
                    <input
                        type="number"
                        step="0.1"
                        value={priceAppreciation}
                        onChange={(e) => setPriceAppreciation(Number(e.target.value))}
                        onFocus={(e) => e.target.select()}
                        className="w-full px-2 py-1.5 text-sm rounded border border-input bg-background/50 text-right no-spinner"
                    />
                </div>
                <div className="space-y-1">
                    <label className="text-[10px] uppercase text-muted-foreground">Reinvest?</label>
                    <button
                        onClick={() => setReinvest(!reinvest)}
                        className={cn(
                            "w-full py-1.5 text-xs rounded border transition-colors",
                            reinvest ? 'bg-primary/20 border-primary text-primary font-bold' : 'bg-background border-input text-muted-foreground'
                        )}
                    >
                        {reinvest ? 'JA' : 'NEIN'}
                    </button>
                </div>
            </div>

            <div className="h-[300px] w-full min-h-[300px] min-w-0">
                {hasMounted && (
                    <ResponsiveContainer width="100%" height="100%" debounce={100} minWidth={1} minHeight={1}>
                        <AreaChart data={projectionData} margin={{ top: 5, right: 0, left: 0, bottom: 0 }}>
                            <defs>
                                <linearGradient id="colorCapital" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                            <XAxis dataKey="year" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                            <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(val) => `${(val / 1000).toFixed(0)}k`} />
                            <Tooltip
                                contentStyle={{ backgroundColor: 'hsl(var(--popover))', borderColor: 'hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }}
                                formatter={(val: number) => val.toLocaleString('de-CH', { style: 'currency', currency: 'CHF', maximumFractionDigits: 0 })}
                            />
                            <Area type="monotone" dataKey="capital" stroke="hsl(var(--primary))" fill="url(#colorCapital)" />
                        </AreaChart>
                    </ResponsiveContainer>
                )}
            </div>

            {/* Stats Footer */}
            <div className="flex justify-between items-end pt-4 mt-2 border-t border-border/50">
                <div>
                    <span className="text-xs text-muted-foreground block">Endkapital (in {years} Jahren)</span>
                    <span className="text-xl font-bold text-primary">{finalYear.capital.toLocaleString('de-CH', { style: 'currency', currency: 'CHF', maximumFractionDigits: 0 })}</span>
                </div>
                <div className="text-right">
                    <span className="text-xs text-muted-foreground block">Passives Einkommen / Jahr</span>
                    <span className="text-xl font-bold text-green-500 dark:text-green-400">{displayDividendYear.dividend.toLocaleString('de-CH', { style: 'currency', currency: 'CHF', maximumFractionDigits: 0 })}</span>
                </div>
            </div>
        </div>
    );
}
