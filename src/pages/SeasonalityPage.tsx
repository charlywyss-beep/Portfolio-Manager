import { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { BarChart2, Search, RefreshCw, TrendingUp, TrendingDown, ChevronDown, ChevronUp, Coins, Globe, Save, Check, Sparkles, ShoppingBag, Compass, Calendar, Maximize2, X, FileText } from 'lucide-react';
import { LandscapeBackButton } from '../components/LandscapeBackButton';
import { usePortfolio } from '../context/PortfolioContext';
import { fetchSeasonalityData } from '../services/yahoo-finance';
import type { MonthlySeasonality } from '../services/yahoo-finance';
import { cn } from '../utils';
import { translateSector } from '../utils/sectorTranslation';

const MONTH_NAMES = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
const MONTH_NAMES_FULL = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];

export function SeasonalityPage() {
    const { symbol: symbolParam } = useParams<{ symbol?: string }>();
    const navigate = useNavigate();
    const { stocks, positions, watchlists, updateStock } = usePortfolio();

    const [inputSymbol, setInputSymbol] = useState(symbolParam || '');
    const [activeSymbol, setActiveSymbol] = useState(symbolParam || '');
    const [years, setYears] = useState<number>(10);
    const [analysisMode, setAnalysisMode] = useState<'range' | 'single'>('range');
    const [targetYear, setTargetYear] = useState<number>(new Date().getFullYear());
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

    const activeStock = useMemo(() => {
        return stocks.find(s => s.symbol.toUpperCase() === activeSymbol.toUpperCase());
    }, [stocks, activeSymbol]);

    const [notes, setNotes] = useState(activeStock?.notes || '');
    const [isSavingNotes, setIsSavingNotes] = useState(false);
    const [notesSavedFeedback, setNotesSavedFeedback] = useState(false);
    const [isNotesModalOpen, setIsNotesModalOpen] = useState(false);
    const [isNotesOpen, setIsNotesOpen] = useState<boolean>(() => {
        try {
            const saved = localStorage.getItem('seasonality_notes_open');
            return saved !== null ? saved === 'true' : true;
        } catch {
            return true;
        }
    });
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const toggleNotesOpen = (value?: boolean) => {
        setIsNotesOpen(prev => {
            const next = value !== undefined ? value : !prev;
            try {
                localStorage.setItem('seasonality_notes_open', String(next));
            } catch {}
            if (next) {
                setTimeout(adjustTextareaHeight, 60);
            }
            return next;
        });
    };

    const adjustTextareaHeight = () => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = `${Math.max(160, textareaRef.current.scrollHeight)}px`;
        }
    };

    useEffect(() => {
        setNotes(activeStock?.notes || '');
        setNotesSavedFeedback(false);
        if (isNotesOpen) {
            setTimeout(adjustTextareaHeight, 50);
        }
    }, [activeStock?.id]);

    useEffect(() => {
        if (isNotesOpen) {
            adjustTextareaHeight();
        }
    }, [notes, isNotesOpen]);

    const handleSaveNotes = async () => {
        if (!activeStock) return;
        setIsSavingNotes(true);
        await new Promise(r => setTimeout(r, 350));
        updateStock(activeStock.id, { notes });
        setIsSavingNotes(false);
        setNotesSavedFeedback(true);
        setTimeout(() => setNotesSavedFeedback(false), 2500);
    };

    const upcomingDividendDates = useMemo(() => {
        if (!activeStock) return { exDate: null, payDate: null, rawExDate: null };
        const now = new Date();
        now.setHours(0, 0, 0, 0);

        const pairs: { exDate?: string; payDate?: string }[] = [];
        if (activeStock.dividendDates && Array.isArray(activeStock.dividendDates)) {
            pairs.push(...activeStock.dividendDates);
        }
        if (activeStock.dividendExDate || activeStock.dividendPayDate) {
            pairs.push({ exDate: activeStock.dividendExDate, payDate: activeStock.dividendPayDate });
        }

        let nextPair: { exDate?: string; payDate?: string } | null = null;
        let minFutureDiff = Infinity;

        for (const p of pairs) {
            const exTime = p.exDate ? new Date(p.exDate).getTime() : NaN;
            const payTime = p.payDate ? new Date(p.payDate).getTime() : NaN;
            const targetTime = !isNaN(exTime) ? exTime : payTime;

            if (!isNaN(targetTime)) {
                const diff = targetTime - now.getTime();
                if (diff >= 0 && diff < minFutureDiff) {
                    minFutureDiff = diff;
                    nextPair = p;
                }
            }
        }

        if (!nextPair && pairs.length > 0) {
            nextPair = pairs.filter(p => p.exDate || p.payDate).pop() || null;
        }

        const fmt = (d?: string) => {
            if (!d) return null;
            try {
                const parts = d.split('-');
                if (parts.length === 3) {
                    return `${parts[2]}.${parts[1]}.${parts[0]}`;
                }
                return new Date(d).toLocaleDateString('de-CH');
            } catch {
                return d;
            }
        };

        return {
            exDate: fmt(nextPair?.exDate),
            payDate: fmt(nextPair?.payDate),
            rawExDate: nextPair?.exDate ? new Date(nextPair.exDate) : null
        };
    }, [activeStock]);

    const seasonalStrategy = useMemo(() => {
        if (!data || data.length !== 12) return null;

        const currentMonthIdx = new Date().getMonth(); // 0 = Jan .. 11 = Dec
        const currentMonthData = data[currentMonthIdx];

        // Sort by avgReturn desc and asc
        const sortedByReturnDesc = [...data].sort((a, b) => b.avgReturn - a.avgReturn);
        const sortedByReturnAsc = [...data].sort((a, b) => a.avgReturn - b.avgReturn);

        const strongestMonth = sortedByReturnDesc[0];
        const secondStrongest = sortedByReturnDesc[1];
        const weakestMonth = sortedByReturnAsc[0];

        // Best buying prep window: Month right before strongest rally
        const monthBeforeStrongestIdx = (strongestMonth.month + 11) % 12;
        const monthBeforeStrongest = data[monthBeforeStrongestIdx];

        // Check if nextExDate is in data
        let exMonthInfo: { monthIdx: number; name: string; avgReturn: number; winRate: number; dateStr: string } | null = null;
        if (upcomingDividendDates.rawExDate) {
            const exM = upcomingDividendDates.rawExDate.getMonth();
            const exData = data[exM];
            if (exData) {
                exMonthInfo = {
                    monthIdx: exM,
                    name: MONTH_NAMES_FULL[exM],
                    avgReturn: exData.avgReturn,
                    winRate: Math.round(exData.positiveRate * 100),
                    dateStr: upcomingDividendDates.exDate || ''
                };
            }
        }

        return {
            currentMonthIdx,
            currentMonthName: MONTH_NAMES_FULL[currentMonthIdx],
            currentMonthData,
            strongestMonth,
            secondStrongest,
            weakestMonth,
            monthBeforeStrongest,
            exMonthInfo
        };
    }, [data, upcomingDividendDates]);

    const portfolioStocks = stocks.filter(s => positions.some(p => p.stockId === s.id));
    const watchlistStockIds = new Set(watchlists.flatMap(w => w.stockIds || []));
    const watchlistStocks = stocks.filter(s => watchlistStockIds.has(s.id) && !portfolioStocks.includes(s));

    const loadData = async (sym: string, y: number) => {
        if (!sym.trim()) return;
        setLoading(true);
        setError(null);
        setData(null);
        setRangeYears(null);
        const result = await fetchSeasonalityData(
            sym.trim().toUpperCase(),
            analysisMode === 'range' ? y : 10,
            analysisMode === 'single' ? targetYear : undefined
        );
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
    }, [activeSymbol, years, analysisMode, targetYear]);

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
        <div className="p-4 md:p-6 space-y-6 bg-gradient-to-br from-background via-background to-muted/20 min-h-screen iphone-landscape-page-root">
            {/* Header */}
            <div className="sticky top-0 z-50 bg-background pb-4 -mt-4 -mx-4 px-4 md:-mt-6 md:-mx-6 md:px-6 iphone-landscape-portfolio-header-wrap">
                <div className="border-b bg-card rounded-t-xl -mx-4 md:-mx-6">
                    <div className="w-full pl-14 pr-4 py-4 md:px-6 md:pl-14 xl:pl-6 iphone-landscape-portfolio-header-content">
                        <div className="flex items-center justify-between gap-3 iphone-landscape-portfolio-header-row">
                            <div className="flex items-center gap-3 iphone-landscape-portfolio-title-group">
                                <LandscapeBackButton />
                                <div className="p-3 rounded-xl bg-gradient-to-br from-violet-500/20 to-purple-500/20 text-violet-600 dark:text-violet-400 iphone-landscape-portfolio-icon">
                                    <BarChart2 className="size-6" />
                                </div>
                                <div>
                                    <h1 className="text-3xl font-bold tracking-tight iphone-landscape-portfolio-title">Saisonalität</h1>
                                    <p className="text-muted-foreground hidden md:block iphone-landscape-portfolio-subtitle">
                                        {rangeYears
                                            ? (rangeYears.start === rangeYears.end ? `${rangeYears.start}` : `${rangeYears.start} – ${rangeYears.end}`)
                                            : (loading ? 'Lädt...' : (analysisMode === 'range' ? `${new Date().getFullYear() - (years - 1)} – ${new Date().getFullYear()}` : `${targetYear}`))}
                                    </p>
                                </div>
                            </div>
                            {/* Modus + Eingabe rechts */}
                            <div className="flex items-center gap-3 iphone-landscape-portfolio-actions">
                                <Link
                                    to="/market-overview"
                                    className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-card hover:bg-muted text-xs font-semibold text-foreground transition-all shadow-xs"
                                    title="Zur Marktübersicht (Rohstoffe, Währungen, Indizes)"
                                >
                                    <Globe className="size-3.5 text-primary" />
                                    <span>Marktübersicht</span>
                                </Link>
                                <div className="flex bg-muted p-1 rounded-lg iphone-landscape-segmented">
                                    <button
                                        onClick={() => setAnalysisMode('range')}
                                        className={cn(
                                            "px-3 py-1.5 rounded-md text-xs font-medium transition-all",
                                            analysisMode === 'range' ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                                        )}
                                    >
                                        Bereich
                                    </button>
                                    <button
                                        onClick={() => setAnalysisMode('single')}
                                        className={cn(
                                            "px-3 py-1.5 rounded-md text-xs font-medium transition-all",
                                            analysisMode === 'single' ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                                        )}
                                    >
                                        Einzeljahr
                                    </button>
                                </div>

                                <div className="flex items-center gap-2 bg-muted rounded-xl px-4 py-2 iphone-landscape-field">
                                    <label className="text-sm text-muted-foreground whitespace-nowrap font-medium">
                                        {analysisMode === 'range' ? 'Jahre:' : 'Jahr:'}
                                    </label>
                                    <input
                                        type="number"
                                        min={analysisMode === 'range' ? 1 : 1900}
                                        max={analysisMode === 'range' ? 50 : 2100}
                                        value={analysisMode === 'range' ? years : targetYear}
                                        onChange={e => {
                                            const v = parseInt(e.target.value);
                                            if (!isNaN(v)) {
                                                if (analysisMode === 'range') {
                                                    if (v >= 1 && v <= 50) setYears(v);
                                                } else {
                                                    setTargetYear(v);
                                                }
                                            }
                                        }}
                                        className="w-14 bg-transparent text-base font-bold text-foreground text-center focus:outline-none"
                                    />
                                </div>
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
                                            "w-full text-left px-2 py-1.5 rounded-md text-sm transition-colors flex items-center gap-2 min-w-0",
                                            activeSymbol === s.symbol ? "bg-primary text-primary-foreground font-semibold" : "hover:bg-accent text-foreground"
                                        )}
                                        title={s.name || s.symbol}
                                    >
                                        {/* Logo */}
                                        {s.logoUrl ? (
                                            <img src={s.logoUrl} alt="" className="size-6 rounded-full object-contain bg-white shrink-0" />
                                        ) : (
                                            <div className="size-6 rounded-full bg-muted flex items-center justify-center text-xs font-bold shrink-0">
                                                {(s.name || s.symbol)[0]}
                                            </div>
                                        )}
                                        {/* Name (Volle Breite) */}
                                        <span className="truncate flex-1 min-w-0">
                                            {s.name || s.symbol}
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
                                                "w-full text-left px-2 py-1.5 rounded-md text-sm transition-colors flex items-center gap-2 min-w-0",
                                                activeSymbol === s.symbol ? "bg-primary text-primary-foreground font-semibold" : "hover:bg-accent text-foreground"
                                            )}
                                            title={s.name || s.symbol}
                                        >
                                            {/* Logo */}
                                            {s.logoUrl ? (
                                                <img src={s.logoUrl} alt="" className="size-6 rounded-full object-contain bg-white shrink-0" />
                                            ) : (
                                                <div className="size-6 rounded-full bg-muted flex items-center justify-center text-xs font-bold shrink-0">
                                                    {(s.name || s.symbol)[0]}
                                                </div>
                                            )}
                                            {/* Name (Volle Breite) */}
                                            <span className="truncate flex-1 min-w-0">
                                                {s.name || s.symbol}
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
                        <div className="bg-card border border-border rounded-xl p-6 text-center space-y-3">
                            <p className="text-red-500 font-medium">{error}</p>
                            {error.includes('404') && (
                                <p className="text-xs text-muted-foreground max-w-md mx-auto">
                                    Die Live-Daten-Schnittstelle ist auf rein statischen Seiten (z.&nbsp;B. GitHub Pages) nicht direkt erreichbar. Bitte öffnen Sie die App auf dem iPad über die lokale Netzwerkadresse (z.&nbsp;B. <code className="bg-muted px-1.5 py-0.5 rounded text-[11px]">http://192.168.0.27:5173</code>).
                                </p>
                            )}
                            <button
                                onClick={() => loadData(activeSymbol, years)}
                                className="px-3 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary rounded-lg text-xs font-semibold transition-colors inline-flex items-center gap-1.5"
                            >
                                <RefreshCw className="size-3.5" />
                                <span>Erneut versuchen</span>
                            </button>
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
                                                <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                                                    <span className="font-bold text-foreground">{activeSymbol}</span>
                                                    {activeStock?.sector && activeStock.sector !== 'Simuliert' && (
                                                        <>
                                                            <span>•</span>
                                                            <span>{translateSector(activeStock.sector)}</span>
                                                        </>
                                                    )}
                                                </div>
                                                <p className="text-[11px] text-muted-foreground">
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
                                <h2 className="font-semibold mb-1">
                                    Ø Monatsrendite — {activeSymbol} {analysisMode === 'single' ? `(${targetYear})` : `(${rangeYears ? (rangeYears.end - rangeYears.start + 1) : years} Jahre)`}
                                </h2>
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

                                                            {/* Dividend Marker */}
                                                            {d.divEvents.length > 0 && (
                                                                <div
                                                                    className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center pointer-events-none"
                                                                    style={{
                                                                        top: isPositive ? HALF - barPx - 18 : HALF + barPx + 4,
                                                                        zIndex: 10
                                                                    }}
                                                                >
                                                                    <div className="bg-amber-500/20 text-amber-600 dark:text-amber-400 p-0.5 rounded-full border border-amber-500/20 shadow-sm">
                                                                        <Coins className="size-2.5" />
                                                                    </div>
                                                                </div>
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

                                                        {tooltipData.divEvents.length > 0 && (
                                                            <div className="pt-1 mt-1 border-t border-border/50">
                                                                <p className="flex items-center gap-1.5 text-amber-500 font-medium">
                                                                    <Coins className="size-3" />
                                                                    {analysisMode === 'single' ? (
                                                                        `Ex-Dividende: ${new Date(tooltipData.divEvents[0].date).toLocaleDateString()}`
                                                                    ) : (
                                                                        `Historisch: ${tooltipData.divEvents.length} Dividenden`
                                                                    )}
                                                                </p>
                                                            </div>
                                                        )}

                                                        <p className="text-muted-foreground pt-1">{tooltipData.count} Jahre Daten</p>
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
                                                <th className="text-right py-2 px-4 font-medium">Ex-Div</th>
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
                                                    {(() => {
                                                        const hasDiv = d.divEvents.length > 0;
                                                        const exTooltip = hasDiv
                                                            ? (analysisMode === 'single'
                                                                ? `Ex-Tag: ${new Date(d.divEvents[0].date).toLocaleDateString('de-CH')}`
                                                                : `${d.divEvents.length} Ex-Tage historisch in diesem Monat`)
                                                            : undefined;
                                                        return (
                                                            <td
                                                                className={cn("text-right py-2 px-4 tabular-nums", hasDiv && "cursor-pointer")}
                                                                title={exTooltip}
                                                            >
                                                                {hasDiv ? (
                                                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 font-medium text-xs border border-amber-500/25 hover:bg-amber-500/20 transition-all shadow-sm">
                                                                        <Coins className="size-3.5 shrink-0" />
                                                                        <span>
                                                                            {analysisMode === 'single'
                                                                                ? new Date(d.divEvents[0].date).toLocaleDateString('de-CH', { day: '2-digit', month: '2-digit' })
                                                                                : `${d.divEvents.length} Ex-Tage`}
                                                                        </span>
                                                                    </span>
                                                                ) : (
                                                                    <span className="text-muted-foreground/30">-</span>
                                                                )}
                                                            </td>
                                                        );
                                                    })()}
                                                    <td className="text-right py-2 px-4 text-muted-foreground">{d.count}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Saisonaler Strategie-Kompass & Auswertung */}
                            {seasonalStrategy && (
                                <div className="bg-card border border-border rounded-xl p-4 md:p-6 shadow-sm space-y-4">
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-border">
                                        <div className="flex items-center gap-2.5">
                                            <div className="p-2 rounded-xl bg-blue-500/15 text-blue-500 shrink-0">
                                                <Compass className="size-5" />
                                            </div>
                                            <div>
                                                <h3 className="font-bold text-base md:text-lg flex items-center gap-2">
                                                    Saisonaler Strategie-Kompass • {activeStock?.name || activeSymbol}
                                                </h3>
                                                <p className="text-xs text-muted-foreground">
                                                    Konkrete Handlungsempfehlungen basierend auf {years} Jahren Statistik
                                                </p>
                                            </div>
                                        </div>
                                        {/* Status-Badge für aktuellen Monat */}
                                        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border bg-muted/40 text-xs font-semibold shrink-0">
                                            <span className="size-2 rounded-full bg-blue-500 animate-pulse" />
                                            <span>Aktueller Monat {seasonalStrategy.currentMonthName}:</span>
                                            <span className={cn(
                                                "font-bold tabular-nums",
                                                seasonalStrategy.currentMonthData.avgReturn >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
                                            )}>
                                                {seasonalStrategy.currentMonthData.avgReturn >= 0 ? '+' : ''}{seasonalStrategy.currentMonthData.avgReturn.toFixed(2)}%
                                            </span>
                                        </div>
                                    </div>

                                    {/* 3 Strategie-Karten */}
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                                        {/* 1. Kauf-Fenster */}
                                        <div className="p-3.5 rounded-xl border border-emerald-500/25 bg-emerald-500/10 flex flex-col justify-between gap-2.5">
                                            <div>
                                                <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold text-sm mb-1.5">
                                                    <ShoppingBag className="size-4 shrink-0" />
                                                    <span>1. Kauf-Fenster (Einstiege / Nachkäufe)</span>
                                                </div>
                                                <div className="text-xs text-foreground/90 space-y-1.5">
                                                    <p>
                                                        <strong>{MONTH_NAMES_FULL[seasonalStrategy.monthBeforeStrongest.month]}:</strong>{' '}
                                                        Statistischer Vorbereitungsmonat (Ø {seasonalStrategy.monthBeforeStrongest.avgReturn >= 0 ? '+' : ''}{seasonalStrategy.monthBeforeStrongest.avgReturn.toFixed(2)}%) direkt vor der stärksten Rallye im {MONTH_NAMES_FULL[seasonalStrategy.strongestMonth.month]}.
                                                    </p>
                                                    {seasonalStrategy.weakestMonth.month !== seasonalStrategy.monthBeforeStrongest.month && (
                                                        <p className="text-muted-foreground">
                                                            Günstigster Tiefpunkt: <strong>{MONTH_NAMES_FULL[seasonalStrategy.weakestMonth.month]}</strong> (Ø {seasonalStrategy.weakestMonth.avgReturn.toFixed(2)}%) für antizyklische Nachkäufe.
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="pt-2 border-t border-emerald-500/20 text-[11px] text-emerald-700 dark:text-emerald-300 font-medium">
                                                ➔ Tipp: Vor starken Monaten akkumulieren, nicht hinterherkaufen.
                                            </div>
                                        </div>

                                        {/* 2. Verkaufs-Fenster */}
                                        <div className="p-3.5 rounded-xl border border-blue-500/25 bg-blue-500/10 flex flex-col justify-between gap-2.5">
                                            <div>
                                                <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 font-bold text-sm mb-1.5">
                                                    <TrendingUp className="size-4 shrink-0" />
                                                    <span>2. Verkaufs-Fenster (Gewinnmitnahmen)</span>
                                                </div>
                                                <div className="text-xs text-foreground/90 space-y-1.5">
                                                    <p>
                                                        <strong>{MONTH_NAMES_FULL[seasonalStrategy.strongestMonth.month]}</strong> (Ø +{seasonalStrategy.strongestMonth.avgReturn.toFixed(2)}%, {Math.round(seasonalStrategy.strongestMonth.positiveRate * 100)}% Trefferquote) &amp;{' '}
                                                        <strong>{MONTH_NAMES_FULL[seasonalStrategy.secondStrongest.month]}</strong> (Ø +{seasonalStrategy.secondStrongest.avgReturn.toFixed(2)}%, {Math.round(seasonalStrategy.secondStrongest.positiveRate * 100)}% Trefferquote).
                                                    </p>
                                                    <p className="text-muted-foreground">
                                                        Hier markiert die Aktie statistisch ihre Jahreshöchstkurse. Ideales Fenster für Teilverkäufe oder Verlustreduktion.
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="pt-2 border-t border-blue-500/20 text-[11px] text-blue-700 dark:text-blue-300 font-medium">
                                                ➔ Tipp: Am Ende der Rallye Teilgewinne realisieren.
                                            </div>
                                        </div>

                                        {/* 3. Ex-Tag & Dividenden-Effekt */}
                                        <div className="p-3.5 rounded-xl border border-amber-500/25 bg-amber-500/10 flex flex-col justify-between gap-2.5">
                                            <div>
                                                <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 font-bold text-sm mb-1.5">
                                                    <Calendar className="size-4 shrink-0" />
                                                    <span>3. Ex-Tag &amp; Dividenden-Effekt</span>
                                                </div>
                                                <div className="text-xs text-foreground/90 space-y-1.5">
                                                    {seasonalStrategy.exMonthInfo ? (
                                                        <>
                                                            <p>
                                                                Nächster Ex-Tag: <strong>{seasonalStrategy.exMonthInfo.dateStr}</strong> ({seasonalStrategy.exMonthInfo.name}).
                                                            </p>
                                                            <p className={cn("text-xs", seasonalStrategy.exMonthInfo.avgReturn < 0 ? "text-amber-700 dark:text-amber-300 font-medium" : "text-muted-foreground")}>
                                                                {seasonalStrategy.exMonthInfo.name} historisch: {seasonalStrategy.exMonthInfo.avgReturn >= 0 ? '+' : ''}{seasonalStrategy.exMonthInfo.avgReturn.toFixed(2)}% ({seasonalStrategy.exMonthInfo.winRate}% Trefferquote).
                                                                {seasonalStrategy.exMonthInfo.avgReturn < 0 && " Dividendenabschlag drückt oft den Kurs!"}
                                                            </p>
                                                        </>
                                                    ) : (
                                                        <p className="text-muted-foreground">
                                                            Keine bevorstehenden Ex-Dividenden-Termine für diese Aktie hinterlegt.
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="pt-2 border-t border-amber-500/20 text-[11px] text-amber-700 dark:text-amber-300 font-medium">
                                                ➔ Fazit: Ausstiege besser VOR dem Ex-Tag umsetzen.
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Persönliche Saisonalitäts-Strategie & Notizen */}
                            <div className="bg-card border border-border rounded-xl p-4 md:p-6 shadow-sm space-y-3">
                                <div className="flex items-center justify-between pb-2 border-b border-border flex-wrap gap-2">
                                    <h3 className="font-bold text-base md:text-lg flex items-center gap-2">
                                        <FileText className="size-4 md:size-5 text-purple-500 shrink-0" />
                                        Persönliche Strategie &amp; Notizen zu {activeStock?.name || activeSymbol}
                                    </h3>
                                    <div className="flex items-center gap-2 flex-wrap">
                                        {seasonalStrategy && (
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    const template = `Saisonaler Fahrplan (${years} Jahre):\n` +
                                                        `• Kauf-Fenster: ${MONTH_NAMES_FULL[seasonalStrategy.monthBeforeStrongest.month]} (vor ${MONTH_NAMES_FULL[seasonalStrategy.strongestMonth.month]}-Rallye)\n` +
                                                        `• Verkaufs-Fenster: ${MONTH_NAMES_FULL[seasonalStrategy.strongestMonth.month]} & ${MONTH_NAMES_FULL[seasonalStrategy.secondStrongest.month]}\n` +
                                                        (seasonalStrategy.exMonthInfo ? `• Ex-Tag: ${seasonalStrategy.exMonthInfo.dateStr} (${seasonalStrategy.exMonthInfo.name} historisch ${seasonalStrategy.exMonthInfo.avgReturn >= 0 ? '+' : ''}${seasonalStrategy.exMonthInfo.avgReturn.toFixed(2)}%)\n` : '') +
                                                        `• Ziel / Limit:\n`;
                                                    setNotes(prev => prev ? `${prev.trim()}\n\n${template}` : template);
                                                    if (!isNotesOpen) toggleNotesOpen(true);
                                                }}
                                                className="h-8 sm:h-9 inline-flex items-center justify-center gap-1.5 px-3 rounded-lg border border-border bg-muted/60 hover:bg-muted text-foreground text-xs sm:text-sm font-semibold transition-all cursor-pointer"
                                                title="Saisonale Kurz-Zusammenfassung als Vorlage in das Notizfeld einfügen"
                                            >
                                                <Sparkles className="size-3.5 text-amber-400" />
                                                <span className="hidden sm:inline">Vorlage einfügen</span>
                                                <span className="sm:hidden">Vorlage</span>
                                            </button>
                                        )}
                                        <button
                                            type="button"
                                            onClick={() => setIsNotesModalOpen(true)}
                                            className="h-8 sm:h-9 inline-flex items-center justify-center gap-1.5 px-3 rounded-lg border border-purple-500/30 bg-purple-500/10 hover:bg-purple-500/20 text-purple-600 dark:text-purple-400 text-xs sm:text-sm font-semibold transition-all shadow-sm cursor-pointer"
                                            title="Notizfeld in großem Vollfenster öffnen"
                                        >
                                            <Maximize2 className="size-3.5" />
                                            <span>Großansicht</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => toggleNotesOpen()}
                                            className="h-8 sm:h-9 inline-flex items-center justify-center gap-1.5 px-3 rounded-lg border border-blue-500/30 bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 text-xs sm:text-sm font-semibold transition-all shadow-sm cursor-pointer"
                                            title={isNotesOpen ? "Notizfeld einklappen" : "Notizfeld aufklappen"}
                                        >
                                            {isNotesOpen ? (
                                                <>
                                                    <ChevronUp className="size-3.5" />
                                                    <span>Einklappen</span>
                                                </>
                                            ) : (
                                                <>
                                                    <ChevronDown className="size-3.5" />
                                                    <span>Aufklappen</span>
                                                </>
                                            )}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={handleSaveNotes}
                                            disabled={isSavingNotes || !activeStock}
                                            className={cn(
                                                "h-8 sm:h-9 px-3.5 rounded-lg font-medium text-xs sm:text-sm transition-all inline-flex items-center justify-center gap-1.5 cursor-pointer",
                                                notesSavedFeedback
                                                    ? "bg-green-500 text-white"
                                                    : "bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                                            )}
                                        >
                                            {notesSavedFeedback ? (
                                                <>
                                                    <Check className="size-4" />
                                                    <span>Gespeichert!</span>
                                                </>
                                            ) : isSavingNotes ? (
                                                <span>Speichern...</span>
                                            ) : (
                                                <>
                                                    <Save className="size-4" />
                                                    <span>Speichern</span>
                                                </>
                                            )}
                                        </button>
                                    </div>
                                </div>

                                {!isNotesOpen ? (
                                    <div
                                        onClick={() => toggleNotesOpen(true)}
                                        className="p-4 bg-background/50 hover:bg-background/80 border border-border/80 hover:border-border rounded-xl cursor-pointer transition-all group"
                                    >
                                        <p className="text-sm text-foreground line-clamp-3 leading-relaxed font-sans">
                                            {notes ? notes : <span className="italic text-muted-foreground">Keine Notizen erfasst. Klicken zum Aufklappen und Erfassen...</span>}
                                        </p>
                                        {notes && (
                                            <p className="text-xs text-muted-foreground mt-2">
                                                {notes.split('\n').length} Zeilen eingeklappt • Klick öffnet die Notiz
                                            </p>
                                        )}
                                    </div>
                                ) : (
                                    <>
                                        <div className="relative">
                                            <textarea
                                                ref={textareaRef}
                                                value={notes}
                                                onChange={(e) => {
                                                    setNotes(e.target.value);
                                                    adjustTextareaHeight();
                                                }}
                                                onDoubleClick={() => setIsNotesModalOpen(true)}
                                                placeholder={activeStock ? `Persönliche Notizen, Timing-Plan oder Limit-Ziele für ${activeStock.name || activeSymbol} festhalten (wird auch auf der Detailseite synchronisiert)...` : "Aktie auswählen..."}
                                                disabled={!activeStock}
                                                className="w-full bg-background border border-border rounded-lg p-3.5 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-primary text-foreground placeholder:text-muted-foreground resize-y min-h-[160px] leading-relaxed transition-all"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setIsNotesModalOpen(true)}
                                                className="absolute top-2.5 right-2.5 p-1.5 rounded-md bg-muted/80 hover:bg-muted text-muted-foreground hover:text-foreground transition-all border border-border/50 shadow-sm cursor-pointer"
                                                title="In Großansicht öffnen"
                                            >
                                                <Maximize2 className="size-3.5" />
                                            </button>
                                        </div>

                                        <div className="flex items-center justify-between text-xs text-muted-foreground flex-wrap gap-2 pt-1">
                                            <p>
                                                💡 Notizen werden automatisch mit der Aktiendetailseite synchronisiert und dauerhaft im Portfolio gespeichert.
                                            </p>
                                            <div className="flex items-center gap-3">
                                                <button
                                                    type="button"
                                                    onClick={() => toggleNotesOpen(false)}
                                                    className="text-blue-500 hover:text-blue-400 font-semibold inline-flex items-center gap-1 cursor-pointer hover:underline text-xs sm:text-sm"
                                                >
                                                    <ChevronUp className="size-3.5" />
                                                    <span>Einklappen</span>
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setIsNotesModalOpen(true)}
                                                    className="text-primary hover:underline font-semibold inline-flex items-center gap-1 cursor-pointer text-xs sm:text-sm"
                                                >
                                                    <Maximize2 className="size-3.5" />
                                                    <span>Großansicht</span>
                                                </button>
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>
                        </>
                    )}
                </div>

            </div>

            {/* Großansicht Modal für Notizen */}
            {isNotesModalOpen && (
                <div
                    className="fixed inset-0 z-[2000] flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
                    onClick={() => setIsNotesModalOpen(false)}
                >
                    <div
                        className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-muted/20">
                            <div className="flex items-center gap-2.5">
                                <div className="p-2 bg-purple-500/10 text-purple-500 rounded-lg">
                                    <FileText className="size-5" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-base sm:text-lg text-foreground">
                                        Persönliche Strategie &amp; Notizen • {activeStock?.name || activeSymbol}
                                    </h3>
                                    <p className="text-xs text-muted-foreground">
                                        Großansicht zum bequemen Lesen &amp; Schreiben • Synchronisiert mit Portfolio
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsNotesModalOpen(false)}
                                className="p-1.5 hover:bg-muted text-muted-foreground hover:text-foreground rounded-lg transition-colors cursor-pointer"
                                title="Schließen"
                            >
                                <X className="size-5" />
                            </button>
                        </div>

                        {/* Sub-bar */}
                        <div className="px-5 py-2.5 bg-muted/10 border-b border-border flex items-center justify-between gap-3 flex-wrap">
                            <div className="flex items-center gap-2">
                                {seasonalStrategy && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const template = `Saisonaler Fahrplan (${years} Jahre):\n` +
                                                `• Kauf-Fenster: ${MONTH_NAMES_FULL[seasonalStrategy.monthBeforeStrongest.month]} (vor ${MONTH_NAMES_FULL[seasonalStrategy.strongestMonth.month]}-Rallye)\n` +
                                                `• Verkaufs-Fenster: ${MONTH_NAMES_FULL[seasonalStrategy.strongestMonth.month]} & ${MONTH_NAMES_FULL[seasonalStrategy.secondStrongest.month]}\n` +
                                                (seasonalStrategy.exMonthInfo ? `• Ex-Tag: ${seasonalStrategy.exMonthInfo.dateStr} (${seasonalStrategy.exMonthInfo.name} historisch ${seasonalStrategy.exMonthInfo.avgReturn >= 0 ? '+' : ''}${seasonalStrategy.exMonthInfo.avgReturn.toFixed(2)}%)\n` : '') +
                                                `• Ziel / Limit:\n`;
                                            setNotes(prev => prev ? `${prev.trim()}\n\n${template}` : template);
                                        }}
                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-border bg-card hover:bg-muted text-foreground transition-all shadow-sm cursor-pointer"
                                    >
                                        <Sparkles className="size-3.5 text-amber-400" />
                                        <span>Saisonale Vorlage einfügen</span>
                                    </button>
                                )}
                            </div>
                            <div className="text-xs text-muted-foreground flex items-center gap-2">
                                <span>{notes.split('\n').length} Zeilen</span>
                                <span>•</span>
                                <span>{notes.length} Zeichen</span>
                            </div>
                        </div>

                        {/* Modal Body: Large readable editor */}
                        <div className="p-5 flex-1 min-h-[350px] max-h-[65vh] flex flex-col">
                            <textarea
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                placeholder="Persönliche Notizen, Timing-Plan, Einstiegs- und Kursziele hier erfassen..."
                                className="w-full flex-1 min-h-[320px] p-4 text-sm leading-relaxed bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary text-foreground placeholder:text-muted-foreground resize-y font-sans"
                                autoFocus
                            />
                        </div>

                        {/* Footer */}
                        <div className="flex items-center justify-between px-5 py-3.5 bg-muted/20 border-t border-border">
                            <span className="text-xs text-muted-foreground hidden sm:inline">
                                💡 Gespeicherte Notizen bleiben dauerhaft erhalten und sind auch in den Stammdaten sichtbar.
                            </span>
                            <div className="flex items-center gap-2.5 ml-auto">
                                <button
                                    type="button"
                                    onClick={() => setIsNotesModalOpen(false)}
                                    className="px-4 py-2 text-sm font-medium hover:bg-muted text-foreground rounded-lg transition-colors border border-border cursor-pointer"
                                >
                                    Schließen
                                </button>
                                <button
                                    type="button"
                                    onClick={async () => {
                                        await handleSaveNotes();
                                        setIsNotesModalOpen(false);
                                    }}
                                    disabled={isSavingNotes || !activeStock}
                                    className={cn(
                                        "px-4 py-2 rounded-lg font-medium text-sm transition-all flex items-center gap-2 cursor-pointer",
                                        notesSavedFeedback
                                            ? "bg-green-500 text-white"
                                            : "bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                                    )}
                                >
                                    {notesSavedFeedback ? (
                                        <>
                                            <Check className="size-4" />
                                            <span>Gespeichert!</span>
                                        </>
                                    ) : isSavingNotes ? (
                                        <span>Speichern...</span>
                                    ) : (
                                        <>
                                            <Save className="size-4" />
                                            <span>Speichern &amp; Schließen</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div >
    );
}
