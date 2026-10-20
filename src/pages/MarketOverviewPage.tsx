import { useState, useEffect, useMemo, useCallback } from 'react';
import { 
    Globe, 
    RefreshCw, 
    Edit3, 
    Check, 
    Plus, 
    X, 
    MoveLeft, 
    MoveRight, 
    RotateCcw, 
    TrendingUp, 
    TrendingDown 
} from 'lucide-react';
import { usePortfolio } from '../context/PortfolioContext';
import { cn } from '../utils';

export interface MarketItem {
    id: string;
    symbol: string;
    name: string;
    category: 'indices' | 'commodities' | 'forex' | 'stocks' | 'crypto';
    decimals?: number;
}

export interface MarketQuoteData {
    price: number;
    previousClose: number;
    changePercent: number;
    changeAmount: number;
    currency?: string;
    high?: number;
    low?: number;
    lastUpdated?: Date;
}

export const DEFAULT_MARKET_ITEMS: MarketItem[] = [
    { id: '1', symbol: 'ZURN.SW', name: 'ZURICH INSURA...', category: 'stocks', decimals: 2 },
    { id: '2', symbol: 'R6C0.DE', name: 'Shell', category: 'stocks', decimals: 2 },
    { id: '3', symbol: 'VWCE.DE', name: 'Vanguard FTSE...', category: 'stocks', decimals: 2 },
    { id: '4', symbol: '^SSMI', name: 'Swiss Market In...', category: 'indices', decimals: 2 },
    { id: '5', symbol: 'SREN.SW', name: 'Swiss Re', category: 'stocks', decimals: 2 },
    { id: '6', symbol: '^NDX', name: 'Nasdaq-100 Ind...', category: 'indices', decimals: 2 },
    { id: '7', symbol: 'BZ=F', name: 'L&S Brent Oil', category: 'commodities', decimals: 2 },
    { id: '8', symbol: 'GC=F', name: 'Goldpreis (Spot)', category: 'commodities', decimals: 2 },
    { id: '9', symbol: 'SI=F', name: 'Silberpreis (Spot)', category: 'commodities', decimals: 2 },
    { id: '10', symbol: 'CHFGBP=X', name: 'CHF/GBP', category: 'forex', decimals: 4 },
    { id: '11', symbol: 'CHFEUR=X', name: 'CHF/EUR', category: 'forex', decimals: 4 },
    { id: '12', symbol: 'CHFUSD=X', name: 'CHF/USD', category: 'forex', decimals: 4 },
];

export const PRESET_OPTIONS: Omit<MarketItem, 'id'>[] = [
    // Indizes
    { symbol: '^SSMI', name: 'Swiss Market Index (SMI)', category: 'indices', decimals: 2 },
    { symbol: '^NDX', name: 'Nasdaq-100 Index', category: 'indices', decimals: 2 },
    { symbol: '^GSPC', name: 'S&P 500 Index', category: 'indices', decimals: 2 },
    { symbol: '^GDAXI', name: 'DAX (Deutschland)', category: 'indices', decimals: 2 },
    { symbol: '^DJI', name: 'Dow Jones Industrial', category: 'indices', decimals: 2 },
    { symbol: '^STOXX50E', name: 'Euro Stoxx 50', category: 'indices', decimals: 2 },
    // Rohstoffe
    { symbol: 'GC=F', name: 'Goldpreis (Spot)', category: 'commodities', decimals: 2 },
    { symbol: 'SI=F', name: 'Silberpreis (Spot)', category: 'commodities', decimals: 2 },
    { symbol: 'BZ=F', name: 'L&S Brent Oil', category: 'commodities', decimals: 2 },
    { symbol: 'CL=F', name: 'WTI Crude Oil', category: 'commodities', decimals: 2 },
    { symbol: 'HG=F', name: 'Kupfer (Copper)', category: 'commodities', decimals: 2 },
    { symbol: 'NG=F', name: 'Erdgas (Natural Gas)', category: 'commodities', decimals: 2 },
    { symbol: 'PL=F', name: 'Platin', category: 'commodities', decimals: 2 },
    // Währungen
    { symbol: 'CHFEUR=X', name: 'CHF/EUR', category: 'forex', decimals: 4 },
    { symbol: 'CHFUSD=X', name: 'CHF/USD', category: 'forex', decimals: 4 },
    { symbol: 'CHFGBP=X', name: 'CHF/GBP', category: 'forex', decimals: 4 },
    { symbol: 'EURCHF=X', name: 'EUR/CHF', category: 'forex', decimals: 4 },
    { symbol: 'USDCHF=X', name: 'USD/CHF', category: 'forex', decimals: 4 },
    { symbol: 'EURUSD=X', name: 'EUR/USD', category: 'forex', decimals: 4 },
    { symbol: 'GBPUSD=X', name: 'GBP/USD', category: 'forex', decimals: 4 },
    // Krypto
    { symbol: 'BTC-USD', name: 'Bitcoin (USD)', category: 'crypto', decimals: 2 },
    { symbol: 'ETH-USD', name: 'Ethereum (USD)', category: 'crypto', decimals: 2 },
    { symbol: 'SOL-USD', name: 'Solana (USD)', category: 'crypto', decimals: 2 },
];

export function MarketOverviewPage() {
    const { stocks } = usePortfolio();

    // Stored items
    const [items, setItems] = useState<MarketItem[]>(() => {
        try {
            const raw = localStorage.getItem('portfolio_market_overview_items');
            if (raw) {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed) && parsed.length > 0) return parsed;
            }
        } catch (e) {
            console.warn('Failed to load market items', e);
        }
        return DEFAULT_MARKET_ITEMS;
    });

    const [quotes, setQuotes] = useState<Record<string, MarketQuoteData>>({});
    const [loading, setLoading] = useState(false);
    const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
    const [isEditMode, setIsEditMode] = useState(false);
    const [activeFilter, setActiveFilter] = useState<'all' | 'indices' | 'commodities' | 'forex' | 'stocks' | 'crypto'>('all');

    // Add modal state
    const [showAddModal, setShowAddModal] = useState(false);
    const [searchSymbol, setSearchSymbol] = useState('');
    const [customName, setCustomName] = useState('');
    const [customCategory, setCustomCategory] = useState<MarketItem['category']>('stocks');

    // Save to localStorage
    useEffect(() => {
        try {
            localStorage.setItem('portfolio_market_overview_items', JSON.stringify(items));
        } catch (e) {
            console.warn('Failed to save market items', e);
        }
    }, [items]);

    // Fetch live quotes for all symbols
    const fetchQuotes = useCallback(async () => {
        if (items.length === 0) return;
        setLoading(true);

        const newQuotes: Record<string, MarketQuoteData> = {};

        // Helper to fetch via direct Yahoo Chart API (Bulletproof, no crumb needed)
        const fetchChartDirect = async (sym: string): Promise<MarketQuoteData | null> => {
            try {
                const res = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?interval=1d&range=1d`, {
                    headers: { 'User-Agent': 'Mozilla/5.0' }
                });
                if (!res.ok) return null;
                const data = await res.json();
                const meta = data?.chart?.result?.[0]?.meta;
                if (!meta || meta.regularMarketPrice === undefined) return null;

                const price = meta.regularMarketPrice;
                const previousClose = meta.chartPreviousClose || meta.previousClose || price;
                const changeAmount = price - previousClose;
                const changePercent = previousClose > 0 ? (changeAmount / previousClose) * 100 : 0;

                return {
                    price,
                    previousClose,
                    changePercent,
                    changeAmount,
                    currency: meta.currency,
                    high: meta.regularMarketDayHigh,
                    low: meta.regularMarketDayLow,
                    lastUpdated: new Date()
                };
            } catch {
                return null;
            }
        };

        // 1. First try batch query via existing API proxy
        try {
            const symList = items.map(i => i.symbol);
            const res = await fetch(`/api/yahoo-quote?symbol=${symList.join(',')}&_=${Date.now()}`);
            if (res.ok) {
                const json = await res.json();
                const results = json.quoteResponse?.result || [];
                for (const r of results) {
                    if (r && r.symbol && r.regularMarketPrice !== undefined) {
                        const price = r.regularMarketPrice;
                        const previousClose = r.regularMarketPreviousClose || r.regularMarketOpen || price;
                        const changeAmount = price - previousClose;
                        const changePercent = previousClose > 0 ? (changeAmount / previousClose) * 100 : (r.regularMarketChangePercent || 0);

                        newQuotes[r.symbol] = {
                            price,
                            previousClose,
                            changePercent,
                            changeAmount,
                            currency: r.currency,
                            high: r.regularMarketDayHigh,
                            low: r.regularMarketDayLow,
                            lastUpdated: new Date()
                        };
                    }
                }
            }
        } catch {
            // Batch proxy not available, will fall back below
        }

        // 2. Fall back for any missing symbols using the direct chart endpoint
        const missingSymbols = items.map(i => i.symbol).filter(sym => !newQuotes[sym]);
        if (missingSymbols.length > 0) {
            await Promise.all(
                missingSymbols.map(async (sym) => {
                    const q = await fetchChartDirect(sym);
                    if (q) {
                        newQuotes[sym] = q;
                    }
                })
            );
        }

        // Merge with existing quotes so UI doesn't flicker
        setQuotes(prev => ({ ...prev, ...newQuotes }));
        setLastRefresh(new Date());
        setLoading(false);
    }, [items]);

    // Initial and periodic fetch
    useEffect(() => {
        fetchQuotes();
        const timer = setInterval(() => {
            fetchQuotes();
        }, 60000); // Auto-refresh every 60s
        return () => clearInterval(timer);
    }, [fetchQuotes]);

    // Filter items
    const filteredItems = useMemo(() => {
        if (activeFilter === 'all') return items;
        return items.filter(it => it.category === activeFilter);
    }, [items, activeFilter]);

    // Number format helper (German/Swiss style: 14.368,78)
    const formatNumber = (num: number | undefined, decimals = 2) => {
        if (num === undefined || isNaN(num)) return '-';
        return num.toLocaleString('de-DE', {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals
        });
    };

    // Reorder items
    const moveItem = (index: number, direction: 'left' | 'right') => {
        const targetIndex = direction === 'left' ? index - 1 : index + 1;
        if (targetIndex < 0 || targetIndex >= items.length) return;
        const newArr = [...items];
        const [moved] = newArr.splice(index, 1);
        newArr.splice(targetIndex, 0, moved);
        setItems(newArr);
    };

    // Remove item
    const removeItem = (id: string) => {
        setItems(prev => prev.filter(i => i.id !== id));
    };

    // Add item
    const addItem = (item: Omit<MarketItem, 'id'>) => {
        const newItem: MarketItem = {
            id: crypto.randomUUID(),
            ...item
        };
        setItems(prev => [...prev, newItem]);
        setShowAddModal(false);
        setSearchSymbol('');
        setCustomName('');
    };

    // Reset to default
    const resetToDefault = () => {
        if (window.confirm('Marktübersicht auf Standard-Kacheln zurücksetzen?')) {
            setItems(DEFAULT_MARKET_ITEMS);
        }
    };

    return (
        <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 py-4 md:py-8 space-y-6 pb-32">
            {/* Header Section */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/60 pb-4">
                <div className="flex items-center gap-3">
                    <div className="size-10 sm:size-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shadow-inner shrink-0">
                        <Globe className="size-5 sm:size-7" />
                    </div>
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
                            Marktübersicht
                        </h1>
                        <p className="text-xs sm:text-sm text-muted-foreground font-medium">
                            Rohstoffe, Währungen, Indizes &amp; Top-Märkte auf einen Blick
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-auto">
                    {/* Refresh Button */}
                    <button
                        onClick={fetchQuotes}
                        disabled={loading}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-card hover:bg-muted border border-border text-xs font-semibold text-foreground transition-all shadow-xs"
                        title="Kurse jetzt aktualisieren"
                    >
                        <RefreshCw className={cn("size-3.5", loading && "animate-spin text-primary")} />
                        <span className="hidden sm:inline">Aktualisieren</span>
                    </button>

                    {/* Edit Mode Toggle Button */}
                    <button
                        onClick={() => setIsEditMode(!isEditMode)}
                        className={cn(
                            "flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all shadow-sm border",
                            isEditMode
                                ? "bg-primary text-primary-foreground border-primary"
                                : "bg-card hover:bg-muted text-foreground border-border"
                        )}
                    >
                        {isEditMode ? (
                            <>
                                <Check className="size-3.5" />
                                <span>Fertig</span>
                            </>
                        ) : (
                            <>
                                <Edit3 className="size-3.5" />
                                <span>Bearbeiten</span>
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* Filter Tabs & Edit Actions */}
            <div className="flex flex-wrap items-center justify-between gap-2.5">
                <div className="flex items-center gap-1.5 overflow-x-auto scroller-none bg-muted/40 p-1 rounded-xl border border-border/50 max-w-full">
                    {[
                        { id: 'all', label: 'Alle' },
                        { id: 'indices', label: 'Indizes' },
                        { id: 'commodities', label: 'Rohstoffe' },
                        { id: 'forex', label: 'Währungen' },
                        { id: 'stocks', label: 'Aktien / ETFs' },
                        { id: 'crypto', label: 'Krypto' },
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveFilter(tab.id as any)}
                            className={cn(
                                "px-3 py-1.5 text-xs font-semibold rounded-lg transition-all whitespace-nowrap",
                                activeFilter === tab.id
                                    ? "bg-background text-foreground shadow-xs font-bold"
                                    : "text-muted-foreground hover:text-foreground hover:bg-background/40"
                            )}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                {isEditMode && (
                    <div className="flex items-center gap-2">
                        <button
                            onClick={resetToDefault}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-border bg-card hover:bg-muted text-xs font-medium text-muted-foreground transition-colors"
                        >
                            <RotateCcw className="size-3" />
                            <span>Standard</span>
                        </button>
                        <button
                            onClick={() => setShowAddModal(true)}
                            className="flex items-center gap-1 px-3.5 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 transition-all shadow-sm"
                        >
                            <Plus className="size-3.5" />
                            <span>Kachel hinzufügen</span>
                        </button>
                    </div>
                )}
            </div>

            {/* The Market Tiles Grid (Matching Bild 2 pixel-perfect!) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-3.5 sm:gap-4 md:gap-5">
                {filteredItems.map((item, index) => {
                    const q = quotes[item.symbol];
                    const changePct = q?.changePercent ?? 0;
                    const isPositive = changePct >= 0;
                    const decimals = item.decimals ?? (item.symbol.includes('=X') ? 4 : 2);

                    return (
                        <div
                            key={item.id}
                            className={cn(
                                "relative rounded-2xl p-4 sm:p-5 transition-all shadow-md flex flex-col justify-between select-none overflow-hidden group min-h-[130px] sm:min-h-[145px]",
                                isPositive
                                    ? "bg-[#3fb78f] text-slate-950 border border-emerald-600/30 shadow-emerald-950/10"
                                    : "bg-[#eb6a59] text-slate-950 border border-rose-600/30 shadow-rose-950/10"
                            )}
                        >
                            {/* Edit Overlay Controls */}
                            {isEditMode && (
                                <div className="absolute top-2 right-2 flex items-center gap-1 z-10 bg-black/40 backdrop-blur-md p-1 rounded-lg">
                                    {index > 0 && (
                                        <button
                                            type="button"
                                            onClick={(e) => { e.stopPropagation(); moveItem(index, 'left'); }}
                                            className="p-1 hover:bg-white/20 rounded text-white transition-colors"
                                            title="Nach links schieben"
                                        >
                                            <MoveLeft className="size-3.5" />
                                        </button>
                                    )}
                                    {index < items.length - 1 && (
                                        <button
                                            type="button"
                                            onClick={(e) => { e.stopPropagation(); moveItem(index, 'right'); }}
                                            className="p-1 hover:bg-white/20 rounded text-white transition-colors"
                                            title="Nach rechts schieben"
                                        >
                                            <MoveRight className="size-3.5" />
                                        </button>
                                    )}
                                    <button
                                        type="button"
                                        onClick={(e) => { e.stopPropagation(); removeItem(item.id); }}
                                        className="p-1 hover:bg-rose-600/80 rounded text-white transition-colors"
                                        title="Kachel entfernen"
                                    >
                                        <X className="size-3.5" />
                                    </button>
                                </div>
                            )}

                            {/* Top: Name */}
                            <div className="flex items-center justify-between gap-2">
                                <h3 className="font-extrabold text-base sm:text-lg tracking-tight truncate drop-shadow-xs text-slate-950">
                                    {item.name}
                                </h3>
                                <span className="text-[10px] uppercase font-bold tracking-wider opacity-60 shrink-0 font-mono">
                                    {item.symbol}
                                </span>
                            </div>

                            {/* Center: Price */}
                            <div className="my-1.5 text-center">
                                <div className="text-2xl sm:text-3xl md:text-4xl font-black tracking-tight drop-shadow-xs tabular-nums text-slate-950">
                                    {q ? formatNumber(q.price, decimals) : (
                                        <span className="opacity-40 animate-pulse text-xl">Laden...</span>
                                    )}
                                </div>
                            </div>

                            {/* Bottom: Change % */}
                            <div className="flex items-center justify-center gap-1 font-black text-base sm:text-lg drop-shadow-xs tabular-nums text-slate-950">
                                {q && (
                                    <>
                                        {isPositive ? (
                                            <TrendingUp className="size-4 shrink-0" />
                                        ) : (
                                            <TrendingDown className="size-4 shrink-0" />
                                        )}
                                        <span>
                                            {isPositive ? '+' : ''}{changePct.toFixed(2)}%
                                        </span>
                                    </>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Empty State */}
            {filteredItems.length === 0 && (
                <div className="p-12 text-center rounded-2xl border border-dashed border-border/80 bg-card/40 space-y-3">
                    <p className="text-sm text-muted-foreground">Keine Kacheln in dieser Kategorie vorhanden.</p>
                    <button
                        onClick={() => setShowAddModal(true)}
                        className="px-4 py-2 bg-primary text-primary-foreground text-xs font-bold rounded-lg hover:bg-primary/90 transition-all"
                    >
                        + Kachel hinzufügen
                    </button>
                </div>
            )}

            {/* Last updated footer info */}
            <div className="flex items-center justify-between text-xs text-muted-foreground pt-4 border-t border-border/40">
                <span className="flex items-center gap-1.5">
                    <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
                    Live-Daten via Yahoo Finance &bull; Auto-Aktualisierung aktiv
                </span>
                {lastRefresh && (
                    <span>
                        Zuletzt aktualisiert: {lastRefresh.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </span>
                )}
            </div>

            {/* Add Item Modal */}
            {showAddModal && (
                <div className="fixed inset-0 z-[2100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-card border border-border rounded-2xl shadow-2xl max-w-lg w-full p-5 space-y-4 animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between border-b border-border pb-3">
                            <h3 className="font-bold text-base flex items-center gap-2 text-foreground">
                                <Plus className="size-4 text-primary" />
                                Markt-Kachel hinzufügen
                            </h3>
                            <button
                                onClick={() => setShowAddModal(false)}
                                className="p-1.5 hover:bg-muted rounded-full transition-colors text-muted-foreground"
                            >
                                <X className="size-4" />
                            </button>
                        </div>

                        {/* Presets selection */}
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                                Beliebte Märkte &amp; Rohstoffe
                            </label>
                            <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto p-1 border border-border/60 rounded-xl bg-background/50">
                                {PRESET_OPTIONS.filter(p => !items.some(i => i.symbol === p.symbol)).map(preset => (
                                    <button
                                        key={preset.symbol}
                                        type="button"
                                        onClick={() => addItem(preset)}
                                        className="text-left p-2 rounded-lg bg-card hover:bg-primary/10 border border-border/60 hover:border-primary/40 transition-colors group flex flex-col"
                                    >
                                        <span className="text-xs font-bold text-foreground group-hover:text-primary truncate">
                                            {preset.name}
                                        </span>
                                        <span className="text-[10px] font-mono text-muted-foreground">
                                            {preset.symbol}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Portfolio / Watchlist Stocks */}
                        {stocks && stocks.length > 0 && (
                            <div className="space-y-2 pt-2 border-t border-border/60">
                                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                                    Aus deinem Portfolio / Watchlist
                                </label>
                                <div className="grid grid-cols-2 gap-2 max-h-36 overflow-y-auto p-1 border border-border/60 rounded-xl bg-background/50">
                                    {stocks.filter(s => !items.some(i => i.symbol === s.symbol)).map(stock => (
                                        <button
                                            key={stock.id}
                                            type="button"
                                            onClick={() => addItem({
                                                symbol: stock.symbol,
                                                name: stock.name,
                                                category: stock.type === 'etf' ? 'stocks' : 'stocks',
                                                decimals: 2
                                            })}
                                            className="text-left p-2 rounded-lg bg-card hover:bg-primary/10 border border-border/60 hover:border-primary/40 transition-colors group flex flex-col"
                                        >
                                            <span className="text-xs font-bold text-foreground group-hover:text-primary truncate">
                                                {stock.name}
                                            </span>
                                            <span className="text-[10px] font-mono text-muted-foreground">
                                                {stock.symbol}
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Custom Symbol Form */}
                        <div className="space-y-3 pt-2 border-t border-border/60">
                            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                                Eigenes Symbol eingeben
                            </label>
                            <div className="grid grid-cols-2 gap-2">
                                <div className="space-y-1">
                                    <label className="text-[11px] font-semibold text-muted-foreground">Yahoo Symbol*</label>
                                    <input
                                        type="text"
                                        placeholder="z.B. AAPL, ^GDAXI, CL=F..."
                                        value={searchSymbol}
                                        onChange={(e) => setSearchSymbol(e.target.value.toUpperCase())}
                                        className="w-full p-2 rounded-lg border border-border bg-background text-xs font-mono focus:ring-1 focus:ring-primary uppercase"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[11px] font-semibold text-muted-foreground">Name / Label (optional)</label>
                                    <input
                                        type="text"
                                        placeholder="z.B. Apple, DAX..."
                                        value={customName}
                                        onChange={(e) => setCustomName(e.target.value)}
                                        className="w-full p-2 rounded-lg border border-border bg-background text-xs focus:ring-1 focus:ring-primary"
                                    />
                                </div>
                            </div>
                            <div className="space-y-1">
                                <label className="text-[11px] font-semibold text-muted-foreground">Kategorie</label>
                                <select
                                    value={customCategory}
                                    onChange={(e) => setCustomCategory(e.target.value as any)}
                                    className="w-full p-2 rounded-lg border border-border bg-background text-xs focus:ring-1 focus:ring-primary"
                                >
                                    <option value="indices">Indizes</option>
                                    <option value="commodities">Rohstoffe</option>
                                    <option value="forex">Währungen</option>
                                    <option value="stocks">Aktien / ETFs</option>
                                    <option value="crypto">Krypto</option>
                                </select>
                            </div>
                        </div>

                        <div className="flex justify-end gap-2 pt-2 border-t border-border">
                            <button
                                type="button"
                                onClick={() => setShowAddModal(false)}
                                className="px-4 py-2 text-xs font-medium text-muted-foreground hover:bg-muted rounded-lg transition-colors"
                            >
                                Schließen
                            </button>
                            <button
                                type="button"
                                disabled={!searchSymbol.trim()}
                                onClick={() => {
                                    if (searchSymbol.trim()) {
                                        addItem({
                                            symbol: searchSymbol.trim(),
                                            name: customName.trim() || searchSymbol.trim(),
                                            category: customCategory,
                                            decimals: customCategory === 'forex' || searchSymbol.includes('=X') ? 4 : 2
                                        });
                                    }
                                }}
                                className="px-4 py-2 text-xs font-bold bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors shadow-sm"
                            >
                                Hinzufügen
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
