import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, BarChart2, Search, RefreshCw, TrendingUp, TrendingDown, ChevronDown, ChevronUp } from 'lucide-react';
import { usePortfolio } from '../context/PortfolioContext';
import { fetchSeasonalityData } from '../services/yahoo-finance';
import type { MonthlySeasonality } from '../services/yahoo-finance';
import { cn } from '../utils';

const MONTH_NAMES = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
const MONTH_NAMES_FULL = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];

export function SeasonalityPage() {
    const { symbol: symbolParam } = useParams<{ symbol?: string }>();
    const navigate = useNavigate();
    const { stocks, positions, watchlists } = usePortfolio();

    const [inputSymbol, setInputSymbol] = useState(symbolParam || '');
    const [activeSymbol, setActiveSymbol] = useState(symbolParam || '');
    const [years, setYears] = useState<number>(10);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [data, setData] = useState<MonthlySeasonality[] | null>(null);
    const [rangeYears, setRangeYears] = useState<{ start: number; end: number } | null>(null);
    const [tooltip, setTooltip] = useState<{ month: number; x: number; y: number } | null>(null);
    const [watchlistOpen, setWatchlistOpen] = useState(false);
    const [suggestions, setSuggestions] = useState<typeof stocks>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const chartRef = useRef<HTMLDivElement>(null);
    const searchRef = useRef<HTMLDivElement>(null);

    const portfolioStocks = stocks.filter(s => positions.some(p => p.stockId === s.id));
    const watchlistStockIds = new Set(watchlists.flatMap(w => w.stockIds || []));
    const watchlistStocks = stocks.filter(s => watchlistStockIds.has(s.id) && !portfolioStocks.includes(s));

    const loadData = async (sym: string, y: number) => {
        if (!sym.trim()) return;
        setLoading(true);
        setError(null);
        setData(null);
        setRangeYears(null);
        const result = await fetchSeasonalityData(sym.trim().toUpperCase(), y);
        setLoading(false);
        if (result.error) setError(result.error);
        else {
            setData(result.data);
            if (result.startYear && result.endYear) {
                setRangeYears({ start: result.startYear, end: result.endYear });
            }
        }
    };

    useEffect(() => {
        if (activeSymbol) loadData(activeSymbol, years);
    }, [activeSymbol, years]);

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        const sym = inputSymbol.trim().toUpperCase();
        if (!sym) return;
        setActiveSymbol(sym);
        navigate(`/seasonality/${sym}`, { replace: true });
    };

    const selectStock = (sym: string) => {
        setInputSymbol(sym);
        setActiveSymbol(sym);
        setSuggestions([]);
        setShowSuggestions(false);
        navigate(`/seasonality/${sym}`, { replace: true });
    };

    const handleInputChange = (val: string) => {
        setInputSymbol(val);
        if (val.trim().length < 1) {
            setSuggestions([]);
            setShowSuggestions(false);
            return;
        }
        const q = val.toLowerCase();
        const matches = stocks.filter(s =>
            s.symbol.toLowerCase().includes(q) ||
            (s.name || '').toLowerCase().includes(q)
        ).slice(0, 8);
        setSuggestions(matches);
        setShowSuggestions(matches.length > 0);
    };

    const maxAbs = data ? Math.max(...data.map(d => Math.abs(d.avgReturn)), 0.5) : 1;
    const best = data ? [...data].sort((a, b) => b.avgReturn - a.avgReturn)[0] : null;
    const worst = data ? [...data].sort((a, b) => a.avgReturn - b.avgReturn)[0] : null;
    const tooltipData = tooltip !== null && data ? data[tooltip.month] : null;

    return (
        <div className="p-4 md:p-6 space-y-6 bg-gradient-to-br from-background via-background to-muted/20 min-h-screen">
            {/* Header */}
            <div className="sticky top-0 z-50 bg-background pb-4 -mt-4 -mx-4 px-4 md:-mt-6 md:-mx-6 md:px-6">
                <div className="border-b bg-card rounded-t-xl -mx-4 md:-mx-6">
                    <div className="w-full pl-14 pr-4 py-4 md:px-6 md:pl-14 lg:pl-6">
                        <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3">
                                <button onClick={() => navigate(-1)} className="p-2 hover:bg-accent rounded-lg transition-colors text-muted-foreground">
                                    <ArrowLeft className="size-5" />
                                </button>
                                <div className="p-3 rounded-xl bg-gradient-to-br from-violet-500/20 to-purple-500/20 text-violet-600 dark:text-violet-400">
                                    <BarChart2 className="size-6" />
                                </div>
                                <div>
                                    <h1 className="text-3xl font-bold tracking-tight">Saisonalität</h1>
                                    <p className="text-muted-foreground hidden md:block">
                                        {rangeYears
                                            ? (rangeYears.start === rangeYears.end ? `${rangeYears.start}` : `${rangeYears.start} – ${rangeYears.end}`)
                                            : (loading ? 'Lädt...' : `${new Date().getFullYear() - (years - 1)} – ${new Date().getFullYear()}`)}
                                    </p>
                                </div>
                            </div>
                            {/* Jahre-Eingabe rechts */}
                            <div className="flex items-center gap-2 bg-muted rounded-xl px-4 py-2">
                                <label className="text-sm text-muted-foreground whitespace-nowrap font-medium">Jahre:</label>
                                <input
                                    type="number"
                                    min={1}
                                    max={10}
                                    value={years}
                                    onChange={e => {
                                        const v = parseInt(e.target.value);
                                        if (!isNaN(v) && v >= 1 && v <= 10) setYears(v);
                                    }}
                                    className="w-14 bg-transparent text-base font-bold text-foreground text-center focus:outline-none"
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Grid: left panel + right content — items-stretch makes both columns same height */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 items-stretch">

                {/* LEFT: Search + separate Bestand and Watchlist cards */}
                <div className="lg:col-span-1 lg:h-full flex flex-col gap-3 lg:overflow-hidden">
                    {/* Autocomplete Search */}
                    <div ref={searchRef} className="relative">
                        <form onSubmit={handleSearch} className="flex gap-2">
                            <input
                                type="text"
                                value={inputSymbol}
                                onChange={e => handleInputChange(e.target.value)}
                                onFocus={() => inputSymbol.length > 0 && setShowSuggestions(suggestions.length > 0)}
                                onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                                placeholder="Name oder Symbol suchen…"
                                className="flex-1 px-3 py-2 rounded-lg border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                            />
                            <button type="submit" className="px-3 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors">
                                <Search className="size-4" />
                            </button>
                        </form>
                        {showSuggestions && (
                            <div className="absolute top-full left-0 right-0 mt-1 bg-popover border border-border rounded-xl shadow-xl z-50 overflow-hidden">
                                {suggestions.map(s => (
                                    <button
                                        key={s.id}
                                        type="button"
                                        onMouseDown={() => selectStock(s.symbol)}
                                        className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent transition-colors text-left"
                                    >
                                        {s.logoUrl ? (
                                            <img src={s.logoUrl} alt="" className="size-6 rounded-full object-contain bg-white shrink-0" />
                                        ) : (
                                            <div className="size-6 rounded-full bg-muted flex items-center justify-center text-xs font-bold shrink-0">
                                                {(s.name || s.symbol)[0]}
                                            </div>
                                        )}
                                        <span className="flex-1 font-medium truncate">{s.name || s.symbol}</span>
                                        <span className="text-xs text-muted-foreground shrink-0">{s.symbol}</span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Bestand — natural height */}
                    {portfolioStocks.length > 0 && (
                        <div className="bg-card border border-border rounded-xl p-3">
                            <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">Bestand</p>
                            <div className="space-y-1">
                                {portfolioStocks.map(s => (
                                    <button
                                        key={s.id}
                                        onClick={() => selectStock(s.symbol)}
                                        className={cn(
                                            "w-full text-left px-2 py-1.5 rounded-md text-sm transition-colors flex items-center gap-2",
                                            activeSymbol === s.symbol ? "bg-primary text-primary-foreground" : "hover:bg-accent text-foreground"
                                        )}
                                    >
                                        {/* Logo */}
                                        {s.logoUrl ? (
                                            <img src={s.logoUrl} alt="" className="size-6 rounded-full object-contain bg-white shrink-0" />
                                        ) : (
                                            <div className="size-6 rounded-full bg-muted flex items-center justify-center text-xs font-bold shrink-0">
                                                {(s.name || s.symbol)[0]}
                                            </div>
                                        )}
                                        {/* Name */}
                                        <span className="font-medium truncate flex-1">
                                            {s.name || s.symbol}
                                        </span>
                                        <span className={cn("text-xs shrink-0", activeSymbol === s.symbol ? "text-primary-foreground/70" : "text-muted-foreground")}>
                                            {s.symbol}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Watchlist — collapsed by default, flex-1 when open */}
                    {watchlistStocks.length > 0 && (
                        <div className={`bg-card border border-border rounded-xl p-3 flex flex-col ${watchlistOpen ? 'flex-1 min-h-0' : ''}`}>
                            <button
                                onClick={() => setWatchlistOpen(o => !o)}
                                className="flex items-center justify-between w-full text-left"
                            >
                                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Watchlist</p>
                                {watchlistOpen ? <ChevronUp className="size-3.5 text-muted-foreground" /> : <ChevronDown className="size-3.5 text-muted-foreground" />}
                            </button>
                            {watchlistOpen && (
                                <div className="space-y-1 overflow-y-auto flex-1 min-h-0 mt-2">
                                    {watchlistStocks.map(s => (
                                        <button
                                            key={s.id}
                                            onClick={() => selectStock(s.symbol)}
                                            className={cn(
                                                "w-full text-left px-2 py-1.5 rounded-md text-sm transition-colors flex items-center gap-2",
                                                activeSymbol === s.symbol ? "bg-primary text-primary-foreground" : "hover:bg-accent text-foreground"
                                            )}
                                        >
                                            {/* Logo */}
                                            {s.logoUrl ? (
                                                <img src={s.logoUrl} alt="" className="size-6 rounded-full object-contain bg-white shrink-0" />
                                            ) : (
                                                <div className="size-6 rounded-full bg-muted flex items-center justify-center text-xs font-bold shrink-0">
                                                    {(s.name || s.symbol)[0]}
                                                </div>
                                            )}
                                            {/* Name */}
                                            <span className="font-medium truncate flex-1">
                                                {s.name || s.symbol}
                                            </span>
                                            <span className={cn("text-xs shrink-0", activeSymbol === s.symbol ? "text-primary-foreground/70" : "text-muted-foreground")}>
                                                {s.symbol}
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>



                {/* RIGHT: Chart + Table */}
                <div className="lg:col-span-3 space-y-4">
                    {!activeSymbol && (
                        <div className="bg-card border border-border rounded-xl flex flex-col items-center justify-center py-20 text-center">
                            <BarChart2 className="size-12 text-muted-foreground/30 mb-4" />
                            <p className="text-muted-foreground font-medium">Aktien-Symbol eingeben oder aus der Liste wählen</p>
                        </div>
                    )}

                    {loading && (
                        <div className="bg-card border border-border rounded-xl flex flex-col items-center justify-center py-20">
                            <RefreshCw className="size-8 text-primary animate-spin mb-3" />
                            <p className="text-muted-foreground">Lade {years} Jahre Daten für <strong>{activeSymbol}</strong>...</p>
                        </div>
                    )}

                    {error && !loading && (
                        <div className="bg-card border border-border rounded-xl p-6 text-center">
                            <p className="text-red-500 font-medium">{error}</p>
                        </div>
                    )}

                    {data && !loading && (
                        <>
                            {/* Summary Cards */}
                            <div className="grid grid-cols-3 gap-3">
                                <div className="bg-card border border-border rounded-xl p-3 flex flex-col items-center gap-1">
                                    {/* Logo + klickbarer Name */}
                                    {(() => {
                                        const activeStock = stocks.find(s => s.symbol === activeSymbol);
                                        return (
                                            <>
                                                {activeStock?.logoUrl ? (
                                                    <img src={activeStock.logoUrl} alt="" className="size-10 rounded-full object-contain bg-white" />
                                                ) : (
                                                    <div className="size-10 rounded-full bg-muted flex items-center justify-center text-sm font-bold">
                                                        {activeSymbol[0]}
                                                    </div>
                                                )}
                                                <button
                                                    onClick={() => activeStock && navigate(`/stock/${activeStock.id}`)}
                                                    className="text-lg font-bold hover:underline leading-tight text-center"
                                                    disabled={!activeStock}
                                                    title={activeStock ? 'Zur Aktiendetailseite' : undefined}
                                                >
                                                    {activeStock?.name || activeSymbol}
                                                </button>
                                                <p className="text-xs text-muted-foreground">
                                                    {rangeYears
                                                        ? (rangeYears.start === rangeYears.end ? `${rangeYears.start}` : `${rangeYears.start} – ${rangeYears.end}`)
                                                        : `${new Date().getFullYear() - (years - 1)} – ${new Date().getFullYear()}`}
                                                </p>
                                            </>
                                        );
                                    })()}
                                </div>
                                <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-3 text-center">
                                    <p className="text-xs text-muted-foreground mb-1 flex items-center justify-center gap-1">
                                        <TrendingUp className="size-3 text-green-500" /> Stärkster Monat
                                    </p>
                                    {best && <>
                                        <p className="text-lg font-bold text-green-600 dark:text-green-400">{MONTH_NAMES[best.month]}</p>
                                        <p className="text-xs text-green-600 dark:text-green-400 font-medium">Ø +{best.avgReturn.toFixed(2)}%</p>
                                    </>}
                                </div>
                                <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-center">
                                    <p className="text-xs text-muted-foreground mb-1 flex items-center justify-center gap-1">
                                        <TrendingDown className="size-3 text-red-500" /> Schwächster Monat
                                    </p>
                                    {worst && <>
                                        <p className="text-lg font-bold text-red-600 dark:text-red-400">{MONTH_NAMES[worst.month]}</p>
                                        <p className="text-xs text-red-600 dark:text-red-400 font-medium">Ø {worst.avgReturn.toFixed(2)}%</p>
                                    </>}
                                </div>
                            </div>

                            {/* Bar Chart */}
                            <div className="bg-card border border-border rounded-xl p-5">
                                <h2 className="font-semibold mb-1">Ø Monatsrendite — {activeSymbol} ({years} Jahre)</h2>
                                <p className="text-xs text-muted-foreground mb-3">Historische Durchschnittsrendite pro Kalendermonat. Grün = positiv, Rot = negativ.</p>

                                {(() => {
                                    const CHART_H = 200;
                                    const HALF = CHART_H / 2; // 100px
                                    const BAR_MAX_PX = HALF * 0.88;
                                    return (
                                        <div ref={chartRef} className="relative select-none" style={{ height: CHART_H }}>
                                            {/* Zero baseline */}
                                            <div className="absolute left-0 right-0 border-t border-border" style={{ top: HALF }} />

                                            {/* Bars — absolute positioning with px heights */}
                                            <div className="absolute inset-0 flex gap-1 px-1">
                                                {data.map((d, i) => {
                                                    const isPositive = d.avgReturn >= 0;
                                                    const barPx = Math.max(2, Math.round(Math.abs(d.avgReturn) / maxAbs * BAR_MAX_PX));
                                                    const isHovered = tooltip?.month === i;
                                                    return (
                                                        <div
                                                            key={i}
                                                            className="flex-1 relative cursor-pointer"
                                                            style={{ height: CHART_H }}
                                                            onMouseEnter={(e) => {
                                                                const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                                                                const chartRect = chartRef.current!.getBoundingClientRect();
                                                                setTooltip({ month: i, x: rect.left - chartRect.left + rect.width / 2, y: 0 });
                                                            }}
                                                            onMouseLeave={() => setTooltip(null)}
                                                        >
                                                            {isPositive ? (
                                                                <div
                                                                    className={cn("absolute left-0 right-0 rounded-t-sm transition-all", isHovered ? "bg-green-500" : "bg-green-500/75")}
                                                                    style={{ bottom: HALF, height: barPx }}
                                                                />
                                                            ) : (
                                                                <div
                                                                    className={cn("absolute left-0 right-0 rounded-b-sm transition-all", isHovered ? "bg-red-500" : "bg-red-500/75")}
                                                                    style={{ top: HALF, height: barPx }}
                                                                />
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>

                                            {/* Tooltip */}
                                            {tooltip !== null && tooltipData && (
                                                <div
                                                    className="absolute z-50 bg-popover border border-border rounded-xl shadow-xl p-3 text-xs pointer-events-none min-w-[140px]"
                                                    style={{
                                                        left: Math.min(Math.max(tooltip.x - 70, 0), (chartRef.current?.offsetWidth || 400) - 150),
                                                        top: 6,
                                                    }}
                                                >
                                                    <p className="font-bold text-sm mb-1">{MONTH_NAMES_FULL[tooltipData.month]}</p>
                                                    <div className="space-y-0.5">
                                                        <p>Ø Rendite: <span className={cn("font-bold", tooltipData.avgReturn >= 0 ? "text-green-500" : "text-red-500")}>{tooltipData.avgReturn >= 0 ? '+' : ''}{tooltipData.avgReturn.toFixed(2)}%</span></p>
                                                        <p>Median: <span className={cn("font-medium", tooltipData.medianReturn >= 0 ? "text-green-500" : "text-red-500")}>{tooltipData.medianReturn >= 0 ? '+' : ''}{tooltipData.medianReturn.toFixed(2)}%</span></p>
                                                        <p>Trefferquote: <span className="font-medium text-foreground">{(tooltipData.positiveRate * 100).toFixed(0)}%</span></p>
                                                        <p className="text-muted-foreground">{tooltipData.count} Jahre Daten</p>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })()}

                                {/* Month Labels */}
                                <div className="flex gap-1 px-1 mt-2">
                                    {MONTH_NAMES.map((m, i) => (
                                        <div
                                            key={i}
                                            className={cn("flex-1 text-center text-xs transition-colors", tooltip?.month === i ? "text-foreground font-semibold" : "text-muted-foreground")}
                                        >
                                            {m}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Detail Table */}
                            <div className="bg-card border border-border rounded-xl overflow-hidden">
                                <div className="p-4 border-b border-border">
                                    <h2 className="font-semibold">Detailauswertung</h2>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="border-b border-border text-muted-foreground">
                                                <th className="text-left py-2 px-4 font-medium">Monat</th>
                                                <th className="text-right py-2 px-4 font-medium">Ø Rendite</th>
                                                <th className="text-right py-2 px-4 font-medium">Median</th>
                                                <th className="text-right py-2 px-4 font-medium">Trefferquote</th>
                                                <th className="text-right py-2 px-4 font-medium">Datenpunkte</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {data.map((d, i) => (
                                                <tr
                                                    key={i}
                                                    className="border-b border-border last:border-0 hover:bg-muted/40 transition-colors"
                                                    onMouseEnter={() => setTooltip({ month: i, x: 0, y: 0 })}
                                                    onMouseLeave={() => setTooltip(null)}
                                                >
                                                    <td className="py-2 px-4 font-medium">{MONTH_NAMES_FULL[i]}</td>
                                                    <td className={cn("text-right py-2 px-4 font-semibold tabular-nums", d.avgReturn >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400")}>
                                                        {d.avgReturn >= 0 ? '+' : ''}{d.avgReturn.toFixed(2)}%
                                                    </td>
                                                    <td className={cn("text-right py-2 px-4 tabular-nums", d.medianReturn >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400")}>
                                                        {d.medianReturn >= 0 ? '+' : ''}{d.medianReturn.toFixed(2)}%
                                                    </td>
                                                    <td className="text-right py-2 px-4 tabular-nums">
                                                        <span className={cn(
                                                            "inline-flex items-center gap-1 font-medium",
                                                            d.positiveRate >= 0.6 ? "text-green-600 dark:text-green-400"
                                                                : d.positiveRate <= 0.4 ? "text-red-600 dark:text-red-400"
                                                                    : "text-foreground"
                                                        )}>
                                                            {(d.positiveRate * 100).toFixed(0)}%
                                                        </span>
                                                    </td>
                                                    <td className="text-right py-2 px-4 text-muted-foreground">{d.count}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </>
                    )}
                </div>

            </div>
        </div >
    );
}
