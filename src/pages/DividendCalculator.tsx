import { useState, useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Calculator, RefreshCw, Percent, Coins } from 'lucide-react';

export function DividendCalculator() {
    // State for inputs
    const [initialCapital, setInitialCapital] = useState(10000);
    const [monthlyContribution, setMonthlyContribution] = useState(500);
    const [years, setYears] = useState(20);
    const [dividendYield, setDividendYield] = useState(3.5);
    const [priceAppreciation, setPriceAppreciation] = useState(4.0);
    const [reinvest, setReinvest] = useState(true);

    // Helper Calculator State
    const [calcDividend, setCalcDividend] = useState(3.05);
    const [calcPrice, setCalcPrice] = useState(90.50);

    // Payout Calculator State
    const [payoutShares, setPayoutShares] = useState(150);
    const [payoutDividend, setPayoutDividend] = useState(4.50);

    // Calculation Logic
    const projectionData = useMemo(() => {
        let currentCapital = initialCapital;
        let totalInvested = initialCapital;
        let totalPayouts = 0; // Track payouts (dividends NOT reinvested)
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
                totalPayouts: Math.round(totalPayouts) // Store cumulative payouts
            });

            // Next year calculation
            if (year < years) {
                // Add yearly contributions
                const yearlyContribution = monthlyContribution * 12;

                // Capital Gain
                const gain = currentCapital * (priceAppreciation / 100);

                // Update Capital
                currentCapital += gain + yearlyContribution;

                if (reinvest) {
                    currentCapital += annualDividend;
                } else {
                    totalPayouts += annualDividend; // Accumulate payouts if not reinvested
                }

                totalInvested += yearlyContribution;
            }
        }
        return data;
    }, [initialCapital, monthlyContribution, years, dividendYield, priceAppreciation, reinvest]);

    const finalYear = projectionData[projectionData.length - 1];

    // Total Profit = (Current Value - Invested) + (Cash Payouts)
    const totalProfit = (finalYear.capital - finalYear.invested) + finalYear.totalPayouts;

    // For display, use the dividend of the last COMPLETED year (what was paid effectively),
    // not the projected dividend for the NEXT year (which is what finalYear.dividend is).
    // If years=1, we want index 0 (Year 1's dividend).
    const displayDividendYear = years > 0 ? projectionData[years - 1] : projectionData[0];

    return (
        <div className="p-6 md:p-8 space-y-8 animate-in fade-in duration-500">
            {/* Header */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Input Section */}
                <div className="lg:col-span-4 space-y-6">
                    <div className="p-6 rounded-xl bg-card border border-border shadow-sm">
                        <div className="flex items-center gap-2 mb-6 text-primary">
                            <Calculator className="size-5" />
                            <h3 className="font-semibold text-lg">Parameter</h3>
                        </div>

                        <div className="space-y-4">
                            {/* Scenarios */}
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-muted-foreground">Szenario wählen</label>
                                <div className="grid grid-cols-3 gap-2">
                                    <button
                                        onClick={() => { setDividendYield(2.0); setPriceAppreciation(2.0); }}
                                        className="px-2 py-1.5 text-xs font-medium rounded-md border border-border hover:bg-muted hover:text-primary transition-colors focus:outline-none focus:ring-2 focus:ring-primary/20"
                                        title="2% Dividende + 2% Kurs = 4% Total"
                                    >
                                        Konservativ
                                    </button>
                                    <button
                                        onClick={() => { setDividendYield(3.0); setPriceAppreciation(4.0); }}
                                        className="px-2 py-1.5 text-xs font-medium rounded-md border border-border bg-muted/50 text-foreground hover:bg-muted hover:text-primary transition-colors focus:outline-none focus:ring-2 focus:ring-primary/20"
                                        title="3% Dividende + 4% Kurs = 7% Total"
                                    >
                                        Ausgewogen
                                    </button>
                                    <button
                                        onClick={() => { setDividendYield(1.5); setPriceAppreciation(7.5); }}
                                        className="px-2 py-1.5 text-xs font-medium rounded-md border border-border hover:bg-muted hover:text-primary transition-colors focus:outline-none focus:ring-2 focus:ring-primary/20"
                                        title="1.5% Dividende + 7.5% Kurs = 9% Total"
                                    >
                                        Wachstum
                                    </button>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-muted-foreground">Startkapital (CHF)</label>
                                <input
                                    type="number"
                                    value={initialCapital}
                                    onChange={(e) => setInitialCapital(Number(e.target.value))}
                                    className="w-full px-3 py-2 rounded-lg border border-border bg-background focus:ring-2 focus:ring-primary/20 focus:outline-none transition-all text-right"
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-muted-foreground">Monatliche Sparrate (CHF)</label>
                                <input
                                    type="number"
                                    value={monthlyContribution}
                                    onChange={(e) => setMonthlyContribution(Number(e.target.value))}
                                    className="w-full px-3 py-2 rounded-lg border border-border bg-background focus:ring-2 focus:ring-primary/20 focus:outline-none transition-all text-right"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-muted-foreground">Laufzeit (Jahre)</label>
                                    <input
                                        type="number"
                                        value={years}
                                        onChange={(e) => setYears(Number(e.target.value))}
                                        className="w-full px-3 py-2 rounded-lg border border-border bg-background focus:ring-2 focus:ring-primary/20 focus:outline-none transition-all text-right"
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
                                    <label className="text-sm font-medium text-muted-foreground">Dividenden Rendite (%)</label>
                                    <input
                                        type="number"
                                        step="0.1"
                                        value={dividendYield}
                                        onChange={(e) => setDividendYield(Number(e.target.value))}
                                        className="w-full px-3 py-2 rounded-lg border border-border bg-background focus:ring-2 focus:ring-primary/20 focus:outline-none transition-all text-right"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-muted-foreground">Kursgewinn pro Jahr (%)</label>
                                    <input
                                        type="number"
                                        step="0.1"
                                        value={priceAppreciation}
                                        onChange={(e) => setPriceAppreciation(Number(e.target.value))}
                                        className="w-full px-3 py-2 rounded-lg border border-border bg-background focus:ring-2 focus:ring-primary/20 focus:outline-none transition-all text-right"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Dividend Yield Calculator Helper */}
                    <div className="p-6 rounded-xl bg-card border border-border shadow-sm animate-in fade-in slide-in-from-bottom-4 duration-700">
                        <div className="flex items-center gap-2 mb-4 text-primary">
                            <Percent className="size-5" />
                            <h3 className="font-semibold text-lg">Dividenden-Rendite</h3>
                        </div>
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <label htmlFor="calc-dividend" className="text-sm font-medium text-muted-foreground">Dividende pro Aktie (jährlich)</label>
                                <div className="relative">
                                    <input
                                        id="calc-dividend"
                                        type="number"
                                        step="0.01"
                                        value={calcDividend}
                                        onChange={(e) => setCalcDividend(Number(e.target.value))}
                                        className="w-full px-3 py-2 rounded-lg border border-border bg-background focus:ring-2 focus:ring-primary/20 focus:outline-none transition-all text-right"
                                        placeholder="z.B. 3.05"
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label htmlFor="calc-price" className="text-sm font-medium text-muted-foreground">Aktueller Aktienkurs</label>
                                <div className="relative">
                                    <input
                                        id="calc-price"
                                        type="number"
                                        step="0.01"
                                        value={calcPrice}
                                        onChange={(e) => setCalcPrice(Number(e.target.value))}
                                        className="w-full px-3 py-2 rounded-lg border border-border bg-background focus:ring-2 focus:ring-primary/20 focus:outline-none transition-all text-right"
                                        placeholder="z.B. 90.50"
                                    />
                                </div>
                            </div>
                            <div className="pt-4 border-t border-border mt-2">
                                <div className="flex justify-between items-center rounded-lg bg-muted/50 p-3">
                                    <span className="font-medium text-sm">Berechnete Rendite:</span>
                                    <span className="text-xl font-bold text-green-600 dark:text-green-400">
                                        {calcPrice > 0 ? ((calcDividend / calcPrice) * 100).toFixed(2) : '0.00'}%
                                    </span>
                                </div>
                                <button
                                    onClick={() => setDividendYield(Number((calcPrice > 0 ? (calcDividend / calcPrice) * 100 : 0).toFixed(2)))}
                                    className="w-full mt-3 text-xs text-primary hover:underline text-center"
                                >
                                    Rendite übernehmen
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Payout Calculator (Ausschüttungs-Rechner) */}
                    <div className="p-6 rounded-xl bg-card border border-border shadow-sm animate-in fade-in slide-in-from-bottom-8 duration-700">
                        <div className="flex items-center gap-2 mb-4 text-primary">
                            <Coins className="size-5" />
                            <h3 className="font-semibold text-lg">Ausschüttungs-Rechner</h3>
                        </div>
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label htmlFor="payout-shares" className="text-sm font-medium text-muted-foreground">Anzahl Aktien</label>
                                    <input
                                        id="payout-shares"
                                        type="number"
                                        value={payoutShares}
                                        onChange={(e) => setPayoutShares(Number(e.target.value))}
                                        className="w-full px-3 py-2 rounded-lg border border-border bg-background focus:ring-2 focus:ring-primary/20 focus:outline-none transition-all text-right"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label htmlFor="payout-dividend" className="text-sm font-medium text-muted-foreground">Dividende / Aktie</label>
                                    <input
                                        id="payout-dividend"
                                        type="number"
                                        step="0.01"
                                        value={payoutDividend}
                                        onChange={(e) => setPayoutDividend(Number(e.target.value))}
                                        className="w-full px-3 py-2 rounded-lg border border-border bg-background focus:ring-2 focus:ring-primary/20 focus:outline-none transition-all text-right"
                                    />
                                </div>
                            </div>

                            <div className="pt-4 border-t border-border mt-2">
                                <div className="flex justify-between items-center rounded-lg bg-muted/50 p-3">
                                    <span className="font-medium text-sm">Jährliche Ausschüttung:</span>
                                    <span className="text-xl font-bold text-green-600 dark:text-green-400">
                                        {(payoutShares * payoutDividend).toLocaleString('de-CH', { style: 'currency', currency: 'CHF' })}
                                    </span>
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
                            <span className="text-sm text-muted-foreground font-medium mb-1">Endkapital nach {years} Jahren</span>
                            <span className="text-2xl font-bold tracking-tight text-primary">
                                {finalYear.capital.toLocaleString('de-CH', { style: 'currency', currency: 'CHF', maximumFractionDigits: 0 })}
                            </span>
                            <div className="mt-4 pt-4 border-t border-border flex items-center justify-between">
                                <span className="text-sm text-muted-foreground font-medium">Investiertes Kapital</span>
                                <span className="font-bold text-base tracking-tight">
                                    {finalYear.invested.toLocaleString('de-CH', { style: 'currency', currency: 'CHF', maximumFractionDigits: 0 })}
                                </span>
                            </div>
                        </div>
                        <div className="p-5 rounded-xl bg-card border border-border shadow-sm flex flex-col justify-between">
                            <div>
                                <span className="text-sm text-muted-foreground font-medium mb-1 block">Passives Einkommen monatlich</span>
                                <span className="text-2xl font-bold tracking-tight text-green-600 dark:text-green-400">
                                    {displayDividendYear.monthlyDividend.toLocaleString('de-CH', { style: 'currency', currency: 'CHF', maximumFractionDigits: 0 })}
                                </span>
                            </div>
                            <div className="mt-3 pt-3 border-t border-border">
                                <span className="text-sm text-muted-foreground font-medium mb-1 block">Passives Einkommen jährlich</span>
                                <span className="text-2xl font-bold tracking-tight text-green-600 dark:text-green-400">
                                    {displayDividendYear.dividend.toLocaleString('de-CH', { style: 'currency', currency: 'CHF', maximumFractionDigits: 0 })}
                                </span>
                            </div>
                        </div>
                        <div className="p-5 rounded-xl bg-card border border-border shadow-sm flex flex-col">
                            <span className="text-sm text-muted-foreground font-medium mb-1">Gesamtgewinn nach {years} Jahren</span>
                            <span className="text-2xl font-bold tracking-tight text-blue-600 dark:text-blue-400">
                                {totalProfit.toLocaleString('de-CH', { style: 'currency', currency: 'CHF', maximumFractionDigits: 0 })}
                            </span>
                        </div>
                    </div>

                    {/* Chart */}
                    <div className="p-6 rounded-xl bg-card border border-border shadow-sm h-[400px]">
                        <h4 className="text-sm font-medium text-muted-foreground mb-4">Vermögensentwicklung</h4>
                        <ResponsiveContainer width="100%" height={350}>
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
                                    formatter={(value: number) => value.toLocaleString('de-CH', { style: 'currency', currency: 'CHF', maximumFractionDigits: 0 })}
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
