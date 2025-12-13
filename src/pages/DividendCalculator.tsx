import { useState, useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Calculator, RefreshCw, Coins, Settings2, Plus, Check } from 'lucide-react';

import { usePortfolio } from '../context/PortfolioContext';

export function DividendCalculator() {
    const { stocks, addStock, addToWatchlist, watchlist } = usePortfolio();

    // State for inputs (Projection)
    const [initialCapital, setInitialCapital] = useState(10000);
    const [monthlyContribution, setMonthlyContribution] = useState(500);
    const [years, setYears] = useState(20);
    const [dividendYield, setDividendYield] = useState(3.5);
    const [priceAppreciation, setPriceAppreciation] = useState(4.0);
    const [reinvest, setReinvest] = useState(true);

    // Integrated Simulator State
    const [selectedStockId, setSelectedStockId] = useState<string>('');
    const [simName, setSimName] = useState('');
    const [simSymbol, setSimSymbol] = useState('');
    const [simShares, setSimShares] = useState(150);
    const [simPrice, setSimPrice] = useState(90.50);
    const [simDividend, setSimDividend] = useState(3.05);

    // Advanced Fees State
    const [showAdvancedFees, setShowAdvancedFees] = useState(true);
    const [courtagePercent, setCourtagePercent] = useState(0.5); // %
    const [courtageMin, setCourtageMin] = useState(40); // CHF
    const [stampDutyPercent, setStampDutyPercent] = useState(0.075); // % (0.075 CH, 0.15 Foreign)
    const [exchangeFee, setExchangeFee] = useState(2.00); // CHF

    // Watchlist Feedback
    const [showSuccess, setShowSuccess] = useState(false);

    // Fee Logic
    const volume = simShares * simPrice;
    const calcCourtage = Math.max(volume * (courtagePercent / 100), courtageMin);
    const calcStamp = volume * (stampDutyPercent / 100);
    const totalFees = calcCourtage + calcStamp + exchangeFee;
    const totalInvest = volume + totalFees;

    const netYield = totalInvest > 0 ? ((simShares * simDividend) / totalInvest) * 100 : 0;

    // Handle Stock Selection
    const handleStockSelect = (stockId: string) => {
        setSelectedStockId(stockId);
        if (stockId === 'new') {
            setSimName('');
            setSimSymbol('');
            setSimPrice(0);
            setSimDividend(0);
            return;
        }
        const stock = stocks.find(s => s.id === stockId);
        if (stock) {
            setSimName(stock.name);
            setSimSymbol(stock.symbol);
            setSimPrice(stock.currentPrice);
            setSimDividend(stock.dividendAmount || 0);
            // Auto-detect Stamp Duty based on rough guess (optional, defaults to CH)
            if (stock.currency !== 'CHF') setStampDutyPercent(0.15); // Foreign
            else setStampDutyPercent(0.075); // CH
        }
    };

    const handleAddToWatchlist = () => {
        if (selectedStockId && selectedStockId !== 'new') {
            addToWatchlist(selectedStockId);
            setShowSuccess(true);
            setTimeout(() => setShowSuccess(false), 3000);
        } else {
            // Create New Stock
            if (!simName || !simSymbol) return; // Validation
            const newId = addStock({
                symbol: simSymbol,
                name: simName,
                currency: 'CHF', // Default for now
                currentPrice: simPrice,
                previousClose: simPrice,
                sector: 'Unbekannt',
                dividendAmount: simDividend,
                dividendYield: simPrice > 0 ? (simDividend / simPrice) * 100 : 0,
                dividendFrequency: 'annually'
            });
            addToWatchlist(newId);
            setSelectedStockId(newId); // Switch to the new ID
            setShowSuccess(true);
            setTimeout(() => setShowSuccess(false), 3000);
        }
    };

    // Calculation Logic (Projection)
    const projectionData = useMemo(() => {
        let currentCapital = initialCapital;
        let totalInvested = initialCapital;
        let totalPayouts = 0;
        const data = [];

        for (let year = 0; year <= years; year++) {
            const annualDividend = currentCapital * (dividendYield / 100);

            data.push({
                year,
                invested: Math.round(totalInvested),
                capital: Math.round(currentCapital),
                dividend: Math.round(annualDividend),
                monthlyDividend: Math.round(annualDividend / 12),
                totalPayouts: Math.round(totalPayouts)
            });

            if (year < years) {
                const yearlyContribution = monthlyContribution * 12;
                const gain = currentCapital * (priceAppreciation / 100);
                currentCapital += gain + yearlyContribution;
                if (reinvest) {
                    currentCapital += annualDividend;
                } else {
                    totalPayouts += annualDividend;
                }
                totalInvested += yearlyContribution;
            }
        }
        return data;
    }, [initialCapital, monthlyContribution, years, dividendYield, priceAppreciation, reinvest]);

    const finalYear = projectionData[projectionData.length - 1];
    const totalProfit = (finalYear.capital - finalYear.invested) + finalYear.totalPayouts;
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
                        <div className="flex items-center justify-between mb-6 text-primary">
                            <div className="flex items-center gap-2">
                                <Coins className="size-5" />
                                <h3 className="font-semibold text-lg">Profi-Simulator</h3>
                            </div>
                            <button
                                onClick={() => setShowAdvancedFees(!showAdvancedFees)}
                                className={`text-xs flex items-center gap-1 border border-border px-2 py-1 rounded hover:bg-muted ${showAdvancedFees ? 'bg-muted text-primary' : 'text-muted-foreground'}`}
                            >
                                <Settings2 size={12} />
                                {showAdvancedFees ? 'Gebühren ausblenden' : 'Gebühren Details'}
                            </button>
                        </div>

                        <div className="space-y-6">
                            {/* Stock Selector */}
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-muted-foreground">Aktie / Simulation</label>
                                <select
                                    className="w-full px-3 py-2 rounded-lg border border-border bg-background focus:ring-2 focus:ring-primary/20 focus:outline-none transition-all"
                                    onChange={(e) => handleStockSelect(e.target.value)}
                                    value={selectedStockId}
                                >
                                    <option value="" disabled>-- Wähle Aktie oder Neu --</option>
                                    <option value="new">+ Neue Simulation (Manuell)</option>
                                    <optgroup label="Meine Watchlist & Portfolio">
                                        {stocks.map(stock => (
                                            <option key={stock.id} value={stock.id}>
                                                {stock.name} ({stock.symbol}) - {stock.currency} {stock.currentPrice}
                                            </option>
                                        ))}
                                    </optgroup>
                                </select>
                            </div>

                            {/* Manual Name Inputs (only if New or Custom) */}
                            {(selectedStockId === 'new' || !selectedStockId) && (
                                <div className="grid grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2">
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-muted-foreground">Name</label>
                                        <input
                                            type="text"
                                            value={simName}
                                            onChange={(e) => setSimName(e.target.value)}
                                            placeholder="z.B. Nestlé"
                                            className="w-full px-3 py-2 rounded-lg border border-border bg-background focus:ring-2 focus:ring-primary/20 focus:outline-none"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-muted-foreground">Symbol</label>
                                        <input
                                            type="text"
                                            value={simSymbol}
                                            onChange={(e) => setSimSymbol(e.target.value)}
                                            placeholder="z.B. NESN"
                                            className="w-full px-3 py-2 rounded-lg border border-border bg-background focus:ring-2 focus:ring-primary/20 focus:outline-none"
                                        />
                                    </div>
                                </div>
                            )}

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-muted-foreground">Anzahl Aktien</label>
                                    <input
                                        type="number"
                                        value={simShares}
                                        onChange={(e) => setSimShares(Number(e.target.value))}
                                        className="w-full px-3 py-2 rounded-lg border border-border bg-background focus:ring-2 focus:ring-primary/20 focus:outline-none transition-all text-right font-mono"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-muted-foreground">Kaufkurs (CHF)</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={simPrice}
                                        onChange={(e) => setSimPrice(Number(e.target.value))}
                                        className="w-full px-3 py-2 rounded-lg border border-border bg-background focus:ring-2 focus:ring-primary/20 focus:outline-none transition-all text-right font-mono"
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-muted-foreground">Dividende pro Aktie (jährlich)</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    value={simDividend}
                                    onChange={(e) => setSimDividend(Number(e.target.value))}
                                    className="w-full px-3 py-2 rounded-lg border border-border bg-background focus:ring-2 focus:ring-primary/20 focus:outline-none transition-all text-right font-mono"
                                />
                            </div>

                            {/* Advanced Fees Section */}
                            {showAdvancedFees && (
                                <div className="bg-muted/30 p-4 rounded-lg space-y-4 border border-border animate-in fade-in slide-in-from-top-4">
                                    <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Erweiterte Gebühren Struktur</h4>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1">
                                            <label className="text-xs text-muted-foreground">Courtage Rate (%)</label>
                                            <input
                                                type="number"
                                                step="0.01"
                                                value={courtagePercent}
                                                onChange={(e) => setCourtagePercent(Number(e.target.value))}
                                                className="w-full px-2 py-1 text-sm rounded border border-border text-right"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-xs text-muted-foreground">Min. Courtage (CHF)</label>
                                            <input
                                                type="number"
                                                value={courtageMin}
                                                onChange={(e) => setCourtageMin(Number(e.target.value))}
                                                className="w-full px-2 py-1 text-sm rounded border border-border text-right"
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-xs text-muted-foreground block">Stempelsteuer (Bund)</label>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => setStampDutyPercent(0.075)}
                                                className={`flex-1 py-1 text-xs border rounded transition-colors ${stampDutyPercent === 0.075 ? 'bg-primary/20 border-primary text-primary font-medium' : 'bg-background hover:bg-muted'}`}
                                            >
                                                🇨🇭 Schweiz (0.075%)
                                            </button>
                                            <button
                                                onClick={() => setStampDutyPercent(0.15)}
                                                className={`flex-1 py-1 text-xs border rounded transition-colors ${stampDutyPercent === 0.15 ? 'bg-primary/20 border-primary text-primary font-medium' : 'bg-background hover:bg-muted'}`}
                                            >
                                                🌍 Ausland (0.15%)
                                            </button>
                                        </div>
                                    </div>

                                    <div className="space-y-1">
                                        <label className="text-xs text-muted-foreground">Börsengebühren / Zuschläge (CHF)</label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            value={exchangeFee}
                                            onChange={(e) => setExchangeFee(Number(e.target.value))}
                                            className="w-full px-2 py-1 text-sm rounded border border-border text-right"
                                        />
                                    </div>

                                    <div className="pt-2 border-t border-border/50 text-xs flex justify-between text-muted-foreground">
                                        <span>Berechnete Courtage:</span>
                                        <span>{calcCourtage.toFixed(2)} CHF</span>
                                    </div>
                                    <div className="text-xs flex justify-between text-muted-foreground">
                                        <span>Berechnete Steuer:</span>
                                        <span>{calcStamp.toFixed(2)} CHF</span>
                                    </div>
                                    <div className="text-xs flex justify-between font-medium text-foreground pt-1">
                                        <span>Total Gebühren:</span>
                                        <span>{totalFees.toFixed(2)} CHF</span>
                                    </div>
                                </div>
                            )}


                            {/* Results Grid */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-border mt-4">
                                <div className="p-3 rounded-lg bg-muted/30 flex flex-col items-center justify-center text-center">
                                    <span className="text-xs font-medium text-muted-foreground mb-1">Total Investition</span>
                                    <span className="text-lg font-bold text-foreground">
                                        {totalInvest.toLocaleString('de-CH', { style: 'currency', currency: 'CHF' })}
                                    </span>
                                    <span className="text-[10px] text-muted-foreground">(Inkl. {totalFees.toFixed(2)} Geb.)</span>
                                </div>
                                <div className="p-3 rounded-lg bg-muted/30 flex flex-col items-center justify-center text-center">
                                    <span className="text-xs font-medium text-muted-foreground mb-1">Jährliche Zahlung</span>
                                    <span className="text-lg font-bold text-green-600 dark:text-green-400">
                                        {(simShares * simDividend).toLocaleString('de-CH', { style: 'currency', currency: 'CHF' })}
                                    </span>
                                </div>
                                <div className={`p-3 rounded-lg border flex flex-col items-center justify-center text-center ${netYield > 0 ? 'bg-primary/10 border-primary/20' : 'bg-muted/50 border-transparent'}`}>
                                    <span className="text-xs font-medium text-primary mb-1">Netto-Rendite</span>
                                    <span className="text-xl font-bold text-primary">
                                        {netYield.toFixed(2)}%
                                    </span>
                                </div>
                            </div>

                            {/* Watchlist Action */}
                            <div className="pt-2">
                                <button
                                    onClick={handleAddToWatchlist}
                                    disabled={simShares <= 0 || simPrice <= 0 || (selectedStockId === 'new' && (!simName || !simSymbol))}
                                    className={`w-full py-2.5 rounded-lg flex items-center justify-center gap-2 transition-all ${showSuccess
                                        ? 'bg-green-600 text-white hover:bg-green-700'
                                        : 'bg-primary text-primary-foreground hover:opacity-90'
                                        } disabled:opacity-50 disabled:cursor-not-allowed`}
                                >
                                    {showSuccess ? (
                                        <>
                                            <Check size={18} />
                                            Gespeichert!
                                        </>
                                    ) : (
                                        <>
                                            <Plus size={18} />
                                            {selectedStockId && selectedStockId !== 'new' && watchlist.includes(selectedStockId)
                                                ? 'In Watchlist (Bereits vorhanden)'
                                                : 'In Watchlist speichern'}
                                        </>
                                    )}
                                </button>
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
