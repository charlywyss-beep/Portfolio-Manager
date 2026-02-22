import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, BarChart2, Search, RefreshCw, TrendingUp, TrendingDown } from 'lucide-react';
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
    const [years, setYears] = useState<5 | 10>(10);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [data, setData] = useState<MonthlySeasonality[] | null>(null);
    const [tooltip, setTooltip] = useState<{ month: number; x: number; y: number } | null>(null);
    const chartRef = useRef<HTMLDivElement>(null);

    // Collect all unique stocks from portfolio + watchlists
    const portfolioStocks = stocks.filter(s => positions.some(p => p.stockId === s.id));
    const watchlistStockIds = new Set(watchlists.flatMap(w => w.stockIds || []));
    const watchlistStocks = stocks.filter(s => watchlistStockIds.has(s.id) && !portfolioStocks.includes(s));

    const loadData = async (sym: string, y: 5 | 10) => {
        if (!sym.trim()) return;
        setLoading(true);
        setError(null);
        setData(null);
        const result = await fetchSeasonalityData(sym.trim().toUpperCase(), y);
        setLoading(false);
        if (result.error) {
            setError(result.error);
        } else {
            setData(result.data);
        }
    };

    useEffect(() => {
        if (activeSymbol) {
            loadData(activeSymbol, years);
        }
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
        navigate(`/seasonality/${sym}`, { replace: true });
    };

    // Chart metrics
    const maxAbs = data ? Math.max(...data.map(d => Math.abs(d.avgReturn)), 0.5) : 1;

    // Best and worst months
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
                                    <p className="text-muted-foreground hidden md:block">Ø monatliche Rendite über {years} Jahre</p>
                                </div>
                            </div>
                            {/* Year toggle */}
                            <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
                                {([5, 10] as const).map(y => (
                                    <button
                                        key={y}
                                        onClick={() => setYears(y)}
                                        className={cn(
                                            "px-3 py-1.5 rounded-md text-sm font-medium transition-all",
                                            years === y
                                                ? "bg-card text-foreground shadow-sm"
                                                : "text-muted-foreground hover:text-foreground"
                                        )}
                                    >
                                        {y}J
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Search & Stock Picker */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
                {/* Search */}
                <div className="lg:col-span-1 space-y-3 lg:sticky lg:top-0 lg:self-start lg:overflow-y-auto lg:max-h-[calc(100vh-80px)] pr-0.5">
                    <form onSubmit={handleSearch} className="flex gap-2">
                        <input
                            type="text"
                            value={inputSymbol}
                            onChange={e => setInputSymbol(e.target.value.toUpperCase())}
                            placeholder="Symbol z.B. AAPL"
                            className="flex-1 px-3 py-2 rounded-lg border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                        />
                        <button
                            type="submit"
                            className="px-3 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
                        >
                            <Search className="size-4" />
                        </button>
                    </form>

                    {/* Portfolio Stocks */}
                    {portfolioStocks.length > 0 && (
                        <div className="bg-card border border-border rounded-xl p-3">
                            <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">Bestand</p>
                            <div className="space-y-1">
                                {portfolioStocks.map(s => (
                                    <button
                                        key={s.id}
                                        onClick={() => selectStock(s.symbol)}
                                        className={cn(
                                            "w-full text-left px-2 py-1.5 rounded-md text-sm transition-colors flex items-center justify-between",
                                            activeSymbol === s.symbol
                                                ? "bg-primary text-primary-foreground"
                                                : "hover:bg-accent text-foreground"
                                        )}
                                    >
                                        <span className="font-medium truncate">{s.name || s.symbol}</span>
                                        <span className={cn(
                                            "text-xs ml-1 shrink-0",
                                            activeSymbol === s.symbol ? "text-primary-foreground/70" : "text-muted-foreground"
                                        )}>{s.symbol}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Watchlist Stocks */}
                    {watchlistStocks.length > 0 && (
                        <div className="bg-card border border-border rounded-xl p-3">
                            <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">Watchlist</p>
                            <div className="space-y-1">
                                {watchlistStocks.map(s => (
                                    <button
                                        key={s.id}
                                        onClick={() => selectStock(s.symbol)}
                                        className={cn(
                                            "w-full text-left px-2 py-1.5 rounded-md text-sm transition-colors flex items-center justify-between",
                                            activeSymbol === s.symbol
                                                ? "bg-primary text-primary-foreground"
                                                : "hover:bg-accent text-foreground"
                                        )}
                                    >
                                        <span className="font-medium truncate">{s.name || s.symbol}</span>
                                        <span className={cn(
                                            "text-xs ml-1 shrink-0",
                                            activeSymbol === s.symbol ? "text-primary-foreground/70" : "text-muted-foreground"
                                        )}>{s.symbol}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Main Chart Area */}
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
                                <div className="bg-card border border-border rounded-xl p-3 text-center">
                                    <p className="text-xs text-muted-foreground mb-1">Symbol</p>
                                    <p className="text-lg font-bold">{activeSymbol}</p>
                                    <p className="text-xs text-muted-foreground">{years} Jahre Analyse</p>
                                </div>
                                <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-3 text-center">
                                    <p className="text-xs text-muted-foreground mb-1 flex items-center justify-center gap-1"><TrendingUp className="size-3 text-green-500" /> Stärkster Monat</p>
                                    {best && <>
                                        <p className="text-lg font-bold text-green-600 dark:text-green-400">{MONTH_NAMES[best.month]}</p>
                                        <p className="text-xs text-green-600 dark:text-green-400 font-medium">Ø +{best.avgReturn.toFixed(2)}%</p>
                                    </>}
                                </div>
                                <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-center">
                                    <p className="text-xs text-muted-foreground mb-1 flex items-center justify-center gap-1"><TrendingDown className="size-3 text-red-500" /> Schwächster Monat</p>
                                    {worst && <>
                                        <p className="text-lg font-bold text-red-600 dark:text-red-400">{MONTH_NAMES[worst.month]}</p>
                                        <p className="text-xs text-red-600 dark:text-red-400 font-medium">Ø {worst.avgReturn.toFixed(2)}%</p>
                                    </>}
                                </div>
                            </div>

                            {/* Bar Chart */}
                            <div className="bg-card border border-border rounded-xl p-5">
                                <h2 className="font-semibold mb-1">Ø Monatsrendite — {activeSymbol} ({years} Jahre)</h2>
                                <p className="text-xs text-muted-foreground mb-5">Historische Durchschnittsrendite pro Kalendermonat. Grün = positiv, Rot = negativ.</p>

                                <div ref={chartRef} className="relative select-none" style={{ height: 260 }}>
                                    {/* Zero baseline */}
                                    <div
                                        className="absolute left-0 right-0 border-t border-border/80"
                                        style={{ top: '50%' }}
                                    />

                                    {/* Bars */}
                                    <div className="absolute inset-0 flex items-stretch gap-1 px-1">
                                        {data.map((d, i) => {
                                            const isPositive = d.avgReturn >= 0;
                                            const barHeight = Math.abs(d.avgReturn) / maxAbs * 45; // % of half-height
                                            return (
                                                <div
                                                    key={i}
                                                    className="flex-1 flex flex-col items-center cursor-pointer"
                                                    onMouseEnter={(e) => {
                                                        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                                                        const chartRect = chartRef.current!.getBoundingClientRect();
                                                        setTooltip({ month: i, x: rect.left - chartRect.left + rect.width / 2, y: rect.top - chartRect.top });
                                                    }}
                                                    onMouseLeave={() => setTooltip(null)}
                                                >
                                                    {/* Top half: positive bars grow upward */}
                                                    <div className="flex-1 flex items-end justify-center">
                                                        {isPositive && (
                                                            <div
                                                                className={cn(
                                                                    "w-full rounded-t-sm transition-all",
                                                                    tooltip?.month === i
                                                                        ? "bg-green-500"
                                                                        : "bg-green-500/70 hover:bg-green-500"
                                                                )}
                                                                style={{ height: `${barHeight}%` }}
                                                            />
                                                        )}
                                                    </div>
                                                    {/* Bottom half: negative bars grow downward */}
                                                    <div className="flex-1 flex items-start justify-center">
                                                        {!isPositive && (
                                                            <div
                                                                className={cn(
                                                                    "w-full rounded-b-sm transition-all",
                                                                    tooltip?.month === i
                                                                        ? "bg-red-500"
                                                                        : "bg-red-500/70 hover:bg-red-500"
                                                                )}
                                                                style={{ height: `${barHeight}%` }}
                                                            />
                                                        )}
                                                    </div>
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
                                                top: tooltip.y - 130 < 0 ? 10 : tooltip.y - 130,
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

                                {/* Month Labels */}
                                <div className="flex gap-1 px-1 mt-1">
                                    {MONTH_NAMES.map((m, i) => (
                                        <div
                                            key={i}
                                            className={cn(
                                                "flex-1 text-center text-xs transition-colors",
                                                tooltip?.month === i ? "text-foreground font-semibold" : "text-muted-foreground"
                                            )}
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
                                                    <td className={cn("text-right py-2 px-4 tabular-nums", d.medianReturn >= 0 ? "text-green-600/70 dark:text-green-400/70" : "text-red-600/70 dark:text-red-400/70")}>
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
        </div>
    );
}
