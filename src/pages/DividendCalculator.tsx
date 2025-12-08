import { useState, useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Calculator, RefreshCw } from 'lucide-react';

export function DividendCalculator() {
    // State for inputs
    const [initialCapital, setInitialCapital] = useState(10000);
    const [monthlyContribution, setMonthlyContribution] = useState(500);
    const [years, setYears] = useState(20);
    const [dividendYield, setDividendYield] = useState(3.5);
    const [priceAppreciation, setPriceAppreciation] = useState(4.0);
    const [reinvest, setReinvest] = useState(true);

    // Calculation Logic
    const projectionData = useMemo(() => {
        let currentCapital = initialCapital;
        let totalInvested = initialCapital;
        const data = [];

        for (let year = 0; year <= years; year++) {
            // Calculate dividends for this year (based on start of year capital)
            const annualDividend = currentCapital * (dividendYield / 100);

            data.push({
                year,
                invested: Math.round(totalInvested),
                capital: Math.round(currentCapital),
                dividend: Math.round(annualDividend),
                monthlyDividend: Math.round(annualDividend / 12),
            });

            // Next year calculation
            if (year < years) {
                // Add yearly contributions (simplified: added at end of year/evenly, but for yearly step we add effectively)
                const yearlyContribution = monthlyContribution * 12;

                // Capital Gain
                const gain = currentCapital * (priceAppreciation / 100);

                // Update Capital
                currentCapital += gain + yearlyContribution;

                if (reinvest) {
                    currentCapital += annualDividend;
                }

                totalInvested += yearlyContribution;
            }
        }
        return data;
    }, [initialCapital, monthlyContribution, years, dividendYield, priceAppreciation, reinvest]);

    const finalYear = projectionData[projectionData.length - 1];

    return (
        <div className="space-y-6 animate-in fade-in duration-500">

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Input Section */}
                <div className="lg:col-span-4 space-y-6">
                    <div className="p-6 rounded-xl bg-card border border-border shadow-sm">
                        <div className="flex items-center gap-2 mb-6 text-primary">
                            <Calculator className="size-5" />
                            <h3 className="font-semibold text-lg">Parameter</h3>
                        </div>

                        <div className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-muted-foreground">Startkapital (€)</label>
                                <input
                                    type="number"
                                    value={initialCapital}
                                    onChange={(e) => setInitialCapital(Number(e.target.value))}
                                    className="w-full px-3 py-2 rounded-lg border border-border bg-background focus:ring-2 focus:ring-primary/20 focus:outline-none transition-all"
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-muted-foreground">Monatliche Sparrate (€)</label>
                                <input
                                    type="number"
                                    value={monthlyContribution}
                                    onChange={(e) => setMonthlyContribution(Number(e.target.value))}
                                    className="w-full px-3 py-2 rounded-lg border border-border bg-background focus:ring-2 focus:ring-primary/20 focus:outline-none transition-all"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-muted-foreground">Laufzeit (Jahre)</label>
                                    <input
                                        type="number"
                                        value={years}
                                        onChange={(e) => setYears(Number(e.target.value))}
                                        className="w-full px-3 py-2 rounded-lg border border-border bg-background focus:ring-2 focus:ring-primary/20 focus:outline-none transition-all"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-muted-foreground flex items-center justify-between">
                                        Reinvestieren?
                                        <RefreshCw className="size-3" />
                                    </label>
                                    <div className="h-10 flex items-center">
                                        <label className="relative inline-flex items-center cursor-pointer">
                                            <input type="checkbox" checked={reinvest} onChange={(e) => setReinvest(e.target.checked)} className="sr-only peer" />
                                            <div className="w-11 h-6 bg-input peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                                        </label>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-muted-foreground">Div. Rendite (%)</label>
                                    <input
                                        type="number"
                                        step="0.1"
                                        value={dividendYield}
                                        onChange={(e) => setDividendYield(Number(e.target.value))}
                                        className="w-full px-3 py-2 rounded-lg border border-border bg-background focus:ring-2 focus:ring-primary/20 focus:outline-none transition-all"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-muted-foreground">Kursgewinn p.a. (%)</label>
                                    <input
                                        type="number"
                                        step="0.1"
                                        value={priceAppreciation}
                                        onChange={(e) => setPriceAppreciation(Number(e.target.value))}
                                        className="w-full px-3 py-2 rounded-lg border border-border bg-background focus:ring-2 focus:ring-primary/20 focus:outline-none transition-all"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Results Section */}
                <div className="lg:col-span-8 space-y-6">
                    {/* Key Stats Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="p-5 rounded-xl bg-card border border-border shadow-sm flex flex-col">
                            <span className="text-sm text-muted-foreground font-medium mb-1">Endkapital (nach {years} Jahren)</span>
                            <span className="text-2xl font-bold tracking-tight text-primary">
                                {finalYear.capital.toLocaleString('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })}
                            </span>
                            <div className="mt-4 pt-4 border-t border-border flex items-center justify-between">
                                <span className="text-sm text-muted-foreground font-medium">Investiertes Kapital</span>
                                <span className="font-bold text-base tracking-tight">
                                    {finalYear.invested.toLocaleString('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })}
                                </span>
                            </div>
                        </div>
                        <div className="p-5 rounded-xl bg-card border border-border shadow-sm flex flex-col">
                            <span className="text-sm text-muted-foreground font-medium mb-1">Passives Einkommen (Monat)</span>
                            <span className="text-2xl font-bold tracking-tight text-green-600 dark:text-green-400">
                                {finalYear.monthlyDividend.toLocaleString('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })}
                            </span>
                            <span className="text-xs text-muted-foreground mt-2">
                                Jährlich: {finalYear.dividend.toLocaleString('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })}
                            </span>
                        </div>
                        <div className="p-5 rounded-xl bg-card border border-border shadow-sm flex flex-col">
                            <span className="text-sm text-muted-foreground font-medium mb-1">Gesamtgewinn</span>
                            <span className="text-2xl font-bold tracking-tight text-blue-600 dark:text-blue-400">
                                {(finalYear.capital - finalYear.invested).toLocaleString('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })}
                            </span>
                            <span className="text-xs text-muted-foreground mt-2">
                                Davon Zinseszins & Kurseffekt
                            </span>
                        </div>
                    </div>

                    {/* Chart */}
                    <div className="p-6 rounded-xl bg-card border border-border shadow-sm h-[400px]">
                        <h4 className="text-sm font-medium text-muted-foreground mb-4">Vermögensentwicklung</h4>
                        <ResponsiveContainer width="100%" height="90%">
                            <AreaChart data={projectionData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="colorCapital" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                                    </linearGradient>
                                    <linearGradient id="colorInvested" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="hsl(var(--muted-foreground))" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="hsl(var(--muted-foreground))" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                                <XAxis
                                    dataKey="year"
                                    stroke="hsl(var(--muted-foreground))"
                                    fontSize={12}
                                    tickLine={false}
                                    axisLine={false}
                                />
                                <YAxis
                                    stroke="hsl(var(--muted-foreground))"
                                    fontSize={12}
                                    tickLine={false}
                                    axisLine={false}
                                    tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
                                />
                                <Tooltip
                                    contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }}
                                    itemStyle={{ color: 'hsl(var(--foreground))' }}
                                    formatter={(value: number) => value.toLocaleString('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="capital"
                                    name="Gesamtkapital"
                                    stroke="hsl(var(--primary))"
                                    strokeWidth={2}
                                    fillOpacity={1}
                                    fill="url(#colorCapital)"
                                />
                                <Area
                                    type="monotone"
                                    dataKey="invested"
                                    name="Investiert"
                                    stroke="hsl(var(--muted-foreground))"
                                    strokeWidth={2}
                                    strokeDasharray="5 5"
                                    fillOpacity={1}
                                    fill="url(#colorInvested)"
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>
        </div>
    );
}
