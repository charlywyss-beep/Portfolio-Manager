import { useState, useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Calculator, RefreshCw, Coins } from 'lucide-react';

import { usePortfolio } from '../context/PortfolioContext';

export function DividendCalculator() {
    const { stocks } = usePortfolio();

    // State for inputs
    const [initialCapital, setInitialCapital] = useState(10000);
    const [monthlyContribution, setMonthlyContribution] = useState(500);
    const [years, setYears] = useState(20);
    const [dividendYield, setDividendYield] = useState(3.5);
    const [priceAppreciation, setPriceAppreciation] = useState(4.0);
    const [reinvest, setReinvest] = useState(true);

    // Integrated Simulator State
    const [simShares, setSimShares] = useState(150);
    const [simPrice, setSimPrice] = useState(90.50);
    const [simFees, setSimFees] = useState(9.00);
    const [simDividend, setSimDividend] = useState(3.05);

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



                    {/* Integrated Investment Simulator */}
                    <div className="p-6 rounded-xl bg-card border border-border shadow-sm animate-in fade-in slide-in-from-bottom-8 duration-700">
                        <div className="flex items-center gap-2 mb-6 text-primary">
                            <Coins className="size-5" />
                            <h3 className="font-semibold text-lg">Investitions-Rechner</h3>
                        </div>

                        <div className="space-y-6">
                            {/* Stock Selector */}
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-muted-foreground">Aktie aus Watchlist wählen (Optional)</label>
                                <select
                                    className="w-full px-3 py-2 rounded-lg border border-border bg-background focus:ring-2 focus:ring-primary/20 focus:outline-none transition-all"
                                    onChange={(e) => {
                                        const stock = stocks.find(s => s.id === e.target.value);
                                        if (stock) {
                                            setSimPrice(stock.currentPrice);
                                            setSimDividend(stock.dividendAmount || 0);
                                        }
                                    }}
                                    defaultValue=""
                                >
                                    <option value="" disabled>-- Aktie wählen --</option>
                                    {stocks.map(stock => (
                                        <option key={stock.id} value={stock.id}>
                                            {stock.name} ({stock.symbol})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                {/* Inputs Row 1 */}
                                <div className="space-y-2">
                                    <label htmlFor="sim-shares" className="text-sm font-medium text-muted-foreground">Anzahl Aktien</label>
                                    <input
                                        id="sim-shares"
                                        type="number"
                                        value={simShares}
                                        onChange={(e) => setSimShares(Number(e.target.value))}
                                        className="w-full px-3 py-2 rounded-lg border border-border bg-background focus:ring-2 focus:ring-primary/20 focus:outline-none transition-all text-right"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label htmlFor="sim-price" className="text-sm font-medium text-muted-foreground">Kaufkurs / Aktie</label>
                                    <input
                                        id="sim-price"
                                        type="number"
                                        step="0.01"
                                        value={simPrice}
                                        onChange={(e) => setSimPrice(Number(e.target.value))}
                                        className="w-full px-3 py-2 rounded-lg border border-border bg-background focus:ring-2 focus:ring-primary/20 focus:outline-none transition-all text-right"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label htmlFor="sim-fees" className="text-sm font-medium text-muted-foreground">Gebühren (Total)</label>
                                    <input
                                        id="sim-fees"
                                        type="number"
                                        step="0.01"
                                        value={simFees}
                                        onChange={(e) => setSimFees(Number(e.target.value))}
                                        className="w-full px-3 py-2 rounded-lg border border-border bg-background focus:ring-2 focus:ring-primary/20 focus:outline-none transition-all text-right"
                                    />
                                </div>
                            </div>

                            {/* Inputs Row 2 */}
                            <div className="space-y-2">
                                <label htmlFor="sim-dividend" className="text-sm font-medium text-muted-foreground">Dividende pro Aktie (jährlich)</label>
                                <input
                                    id="sim-dividend"
                                    type="number"
                                    step="0.01"
                                    value={simDividend}
                                    onChange={(e) => setSimDividend(Number(e.target.value))}
                                    className="w-full px-3 py-2 rounded-lg border border-border bg-background focus:ring-2 focus:ring-primary/20 focus:outline-none transition-all text-right"
                                />
                            </div>

                            {/* Results Grid */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-border mt-4">
                                <div className="p-3 rounded-lg bg-muted/30 flex flex-col items-center justify-center text-center">
                                    <span className="text-xs font-medium text-muted-foreground mb-1">Investition (inkl. Gebühren)</span>
                                    <span className="text-lg font-bold text-foreground">
                                        {((simShares * simPrice) + simFees).toLocaleString('de-CH', { style: 'currency', currency: 'CHF' })}
                                    </span>
                                </div>
                                <div className="p-3 rounded-lg bg-muted/30 flex flex-col items-center justify-center text-center">
                                    <span className="text-xs font-medium text-muted-foreground mb-1">Jähliche Ausschüttung</span>
                                    <span className="text-lg font-bold text-green-600 dark:text-green-400">
                                        {(simShares * simDividend).toLocaleString('de-CH', { style: 'currency', currency: 'CHF' })}
                                    </span>
                                </div>
                                <div className="p-3 rounded-lg bg-primary/10 border border-primary/20 flex flex-col items-center justify-center text-center">
                                    <span className="text-xs font-medium text-primary mb-1">Netto-Rendite</span>
                                    <span className="text-xl font-bold text-primary">
                                        {((simShares * simPrice) + simFees) > 0
                                            ? (((simShares * simDividend) / ((simShares * simPrice) + simFees)) * 100).toFixed(2)
                                            : '0.00'}%
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
