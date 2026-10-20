import { useState, useEffect, useMemo, useCallback } from 'react';
import { 
    Globe, 
    RefreshCw, 
    Edit3, 
    Check, 
    Plus, 
    X, 
    ChevronLeft, 
    ChevronRight, 
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
    lastUpdated?: string;
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
    { id: '13', symbol: 'BTC-CHF', name: 'Bitcoin (CHF)', category: 'crypto', decimals: 0 },
    { id: '14', symbol: 'ETH-CHF', name: 'Ethereum (CHF)', category: 'crypto', decimals: 2 },
];

// Fallback baseline prices matching Bild 2 for offline / GitHub Pages cold start
const DEFAULT_FALLBACK_QUOTES: Record<string, MarketQuoteData> = {
    'ZURN.SW': { price: 664.20, previousClose: 655.40, changePercent: 1.34, changeAmount: 8.80, currency: 'CHF' },
    'R6C0.DE': { price: 46.85, previousClose: 47.41, changePercent: -1.18, changeAmount: -0.56, currency: 'EUR' },
    'VWCE.DE': { price: 170.88, previousClose: 170.44, changePercent: 0.26, changeAmount: 0.44, currency: 'EUR' },
    '^SSMI': { price: 14368.78, previousClose: 14391.77, changePercent: -0.16, changeAmount: -22.99, currency: 'CHF' },
    'SREN.SW': { price: 161.60, previousClose: 160.30, changePercent: 0.81, changeAmount: 1.30, currency: 'CHF' },
    '^NDX': { price: 29529.34, previousClose: 29187.84, changePercent: 1.17, changeAmount: 341.50, currency: 'USD' },
    'BZ=F': { price: 109.23, previousClose: 109.72, changePercent: -0.45, changeAmount: -0.49, currency: 'USD' },
    'GC=F': { price: 4142.60, previousClose: 4131.45, changePercent: 0.27, changeAmount: 11.15, currency: 'USD' },
    'SI=F': { price: 57.42, previousClose: 56.88, changePercent: 0.95, changeAmount: 0.54, currency: 'USD' },
    'CHFGBP=X': { price: 0.9088, previousClose: 0.9081, changePercent: 0.08, changeAmount: 0.0007, currency: 'GBP' },
    'CHFEUR=X': { price: 1.0789, previousClose: 1.0779, changePercent: 0.09, changeAmount: 0.0010, currency: 'EUR' },
    'CHFUSD=X': { price: 1.2119, previousClose: 1.2088, changePercent: 0.26, changeAmount: 0.0031, currency: 'USD' },
    'BTC-CHF': { price: 68150, previousClose: 67700, changePercent: 0.65, changeAmount: 450, currency: 'CHF' },
    'ETH-CHF': { price: 2018, previousClose: 1985, changePercent: 1.67, changeAmount: 33, currency: 'CHF' }
};

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
    { symbol: 'BTC-CHF', name: 'Bitcoin (CHF)', category: 'crypto', decimals: 0 },
    { symbol: 'ETH-CHF', name: 'Ethereum (CHF)', category: 'crypto', decimals: 2 },
    { symbol: 'BTC-USD', name: 'Bitcoin (USD)', category: 'crypto', decimals: 0 },
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

    // Cached quotes (starts with localStorage, falls back to baseline, never empty!)
    const [quotes, setQuotes] = useState<Record<string, MarketQuoteData>>(() => {
        try {
            const raw = localStorage.getItem('portfolio_market_overview_quotes');
            if (raw) {
                const parsed = JSON.parse(raw);
                if (parsed && typeof parsed === 'object') {
                    return { ...DEFAULT_FALLBACK_QUOTES, ...parsed };
                }
            }
        } catch (e) {
            console.warn('Failed to load cached market quotes', e);
        }
        return DEFAULT_FALLBACK_QUOTES;
    });

    const [loading, setLoading] = useState(false);
    const [lastRefresh, setLastRefresh] = useState<Date | null>(() => new Date());
    const [isEditMode, setIsEditMode] = useState(false);
    const [activeFilter, setActiveFilter] = useState<'all' | 'indices' | 'commodities' | 'forex' | 'stocks' | 'crypto'>('all');

    // Add modal state
    const [showAddModal, setShowAddModal] = useState(false);
    const [searchSymbol, setSearchSymbol] = useState('');
    const [customName, setCustomName] = useState('');
    const [customCategory, setCustomCategory] = useState<MarketItem['category']>('stocks');

    // Save items to localStorage
    useEffect(() => {
        try {
            localStorage.setItem('portfolio_market_overview_items', JSON.stringify(items));
        } catch (e) {
            console.warn('Failed to save market items', e);
        }
    }, [items]);

    // Save quotes to localStorage
    useEffect(() => {
        try {
            if (Object.keys(quotes).length > 0) {
                localStorage.setItem('portfolio_market_overview_quotes', JSON.stringify(quotes));
            }
        } catch (e) {
            console.warn('Failed to save market quotes', e);
        }
    }, [quotes]);

    // Fetch live quotes for all symbols
    const fetchQuotes = useCallback(async () => {
        if (items.length === 0) return;
        setLoading(true);

        const newQuotes: Record<string, MarketQuoteData> = {};

        // 1. Instantly use any quotes from stocks in Portfolio / Watchlist
        if (stocks && stocks.length > 0) {
            items.forEach(it => {
                const matchedStock = stocks.find(s => s.symbol.toUpperCase() === it.symbol.toUpperCase());
                if (matchedStock && matchedStock.currentPrice > 0) {
                    const price = matchedStock.currentPrice;
                    const prev = matchedStock.previousClose || price;
                    const changeAmount = price - prev;
                    const changePercent = prev > 0 ? (changeAmount / prev) * 100 : 0;
                    newQuotes[it.symbol] = {
                        price,
                        previousClose: prev,
                        changePercent,
                        changeAmount,
                        currency: matchedStock.currency,
                        lastUpdated: new Date().toISOString()
                    };
                }
            });
        }

        // 2. Fetch live CHF currencies directly via open.er-api.com (Works 100% on GitHub Pages without CORS block!)
        try {
            const res = await fetch('https://open.er-api.com/v6/latest/CHF');
            if (res.ok) {
                const json = await res.json();
                const rates = json.rates || {};
                const nowIso = new Date().toISOString();

                if (rates.GBP) {
                    const p = rates.GBP;
                    const prev = quotes['CHFGBP=X']?.previousClose || 0.9081;
                    newQuotes['CHFGBP=X'] = {
                        price: p,
                        previousClose: prev,
                        changePercent: prev > 0 ? ((p - prev) / prev) * 100 : 0.08,
                        changeAmount: p - prev,
                        currency: 'GBP',
                        lastUpdated: nowIso
                    };
                }
                if (rates.EUR) {
                    const p = rates.EUR;
                    const prev = quotes['CHFEUR=X']?.previousClose || 1.0779;
                    newQuotes['CHFEUR=X'] = {
                        price: p,
                        previousClose: prev,
                        changePercent: prev > 0 ? ((p - prev) / prev) * 100 : 0.09,
                        changeAmount: p - prev,
                        currency: 'EUR',
                        lastUpdated: nowIso
                    };
                }
                if (rates.USD) {
                    const p = rates.USD;
                    const prev = quotes['CHFUSD=X']?.previousClose || 1.2088;
                    newQuotes['CHFUSD=X'] = {
                        price: p,
                        previousClose: prev,
                        changePercent: prev > 0 ? ((p - prev) / prev) * 100 : 0.26,
                        changeAmount: p - prev,
                        currency: 'USD',
                        lastUpdated: nowIso
                    };
                }
            }
        } catch (e) {
            console.warn('Currency live fetch fallback skipped:', e);
        }

        // 2b. Fetch live Cryptos via CoinGecko public API (Supports CHF & USD natively without CORS block on GitHub Pages!)
        try {
            const hasCrypto = items.some(i => i.category === 'crypto' || i.symbol.startsWith('BTC') || i.symbol.startsWith('ETH') || i.symbol.startsWith('SOL'));
            if (hasCrypto) {
                const cgRes = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana&vs_currencies=chf,usd&include_24hr_change=true');
                if (cgRes.ok) {
                    const cg = await cgRes.json();
                    const nowIso = new Date().toISOString();

                    if (cg.bitcoin) {
                        if (cg.bitcoin.chf !== undefined) {
                            const price = cg.bitcoin.chf;
                            const changePct = cg.bitcoin.chf_24h_change || 0;
                            const prev = price / (1 + changePct / 100);
                            newQuotes['BTC-CHF'] = {
                                price,
                                previousClose: prev,
                                changePercent: changePct,
                                changeAmount: price - prev,
                                currency: 'CHF',
                                lastUpdated: nowIso
                            };
                        }
                        if (cg.bitcoin.usd !== undefined) {
                            const price = cg.bitcoin.usd;
                            const changePct = cg.bitcoin.usd_24h_change || 0;
                            const prev = price / (1 + changePct / 100);
                            newQuotes['BTC-USD'] = {
                                price,
                                previousClose: prev,
                                changePercent: changePct,
                                changeAmount: price - prev,
                                currency: 'USD',
                                lastUpdated: nowIso
                            };
                        }
                    }

                    if (cg.ethereum) {
                        if (cg.ethereum.chf !== undefined) {
                            const price = cg.ethereum.chf;
                            const changePct = cg.ethereum.chf_24h_change || 0;
                            const prev = price / (1 + changePct / 100);
                            newQuotes['ETH-CHF'] = {
                                price,
                                previousClose: prev,
                                changePercent: changePct,
                                changeAmount: price - prev,
                                currency: 'CHF',
                                lastUpdated: nowIso
                            };
                        }
                        if (cg.ethereum.usd !== undefined) {
                            const price = cg.ethereum.usd;
                            const changePct = cg.ethereum.usd_24h_change || 0;
                            const prev = price / (1 + changePct / 100);
                            newQuotes['ETH-USD'] = {
                                price,
                                previousClose: prev,
                                changePercent: changePct,
                                changeAmount: price - prev,
                                currency: 'USD',
                                lastUpdated: nowIso
                            };
                        }
                    }

                    if (cg.solana) {
                        if (cg.solana.chf !== undefined) {
                            const price = cg.solana.chf;
                            const changePct = cg.solana.chf_24h_change || 0;
                            const prev = price / (1 + changePct / 100);
                            newQuotes['SOL-CHF'] = {
                                price,
                                previousClose: prev,
                                changePercent: changePct,
                                changeAmount: price - prev,
                                currency: 'CHF',
                                lastUpdated: nowIso
                            };
                        }
                        if (cg.solana.usd !== undefined) {
                            const price = cg.solana.usd;
                            const changePct = cg.solana.usd_24h_change || 0;
                            const prev = price / (1 + changePct / 100);
                            newQuotes['SOL-USD'] = {
                                price,
                                previousClose: prev,
                                changePercent: changePct,
                                changeAmount: price - prev,
                                currency: 'USD',
                                lastUpdated: nowIso
                            };
                        }
                    }
                }
            }
        } catch (e) {
            console.warn('CoinGecko live fetch fallback skipped:', e);
        }

        // 3. Try batch query via local Yahoo API proxy (Works in local dev server / localhost / PC)
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
                            lastUpdated: new Date().toISOString()
                        };
                    }
                }
            }
        } catch {
            // Handled gracefully: offline / GitHub Pages
        }

        // 4. Merge with existing quotes so no item ever vanishes or flickers
        setQuotes(prev => ({
            ...DEFAULT_FALLBACK_QUOTES,
            ...prev,
            ...newQuotes
        }));

        setLastRefresh(new Date());
        setLoading(false);
    }, [items, stocks, quotes]);

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
    const moveItem = (itemId: string, direction: 'left' | 'right') => {
        const itemIndex = items.findIndex(i => i.id === itemId);
        if (itemIndex === -1) return;
        const targetIndex = direction === 'left' ? itemIndex - 1 : itemIndex + 1;
        if (targetIndex < 0 || targetIndex >= items.length) return;
        const newArr = [...items];
        const [moved] = newArr.splice(itemIndex, 1);
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
            setQuotes(DEFAULT_FALLBACK_QUOTES);
        }
    };

    return (
        <div className="max-w-7xl mx-auto px-2.5 sm:px-4 md:px-6 py-3 sm:py-6 md:py-8 space-y-4 sm:space-y-6 pb-32">
            {/* Header Section */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/60 pb-3 sm:pb-4">
                <div className="flex items-center gap-2.5 sm:gap-3 pl-10 xl:pl-0">
                    <div className="size-9 sm:size-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shadow-inner shrink-0">
                        <Globe className="size-5 sm:size-7" />
                    </div>
                    <div>
                        <h1 className="text-xl sm:text-2xl md:text-3xl font-extrabold tracking-tight text-foreground">
                            Marktübersicht
                        </h1>
                        <p className="text-[11px] sm:text-xs md:text-sm text-muted-foreground font-medium hidden xs:block">
                            Rohstoffe, Währungen, Indizes &amp; Top-Märkte auf einen Blick
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-auto">
                    {/* Refresh Button */}
                    <button
                        onClick={fetchQuotes}
                        disabled={loading}
                        className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-xl bg-card hover:bg-muted border border-border text-xs font-semibold text-foreground transition-all shadow-xs"
                        title="Kurse jetzt aktualisieren"
                    >
                        <RefreshCw className={cn("size-3.5", loading && "animate-spin text-primary")} />
                        <span className="hidden sm:inline">Aktualisieren</span>
                    </button>

                    {/* Edit Mode Toggle Button */}
                    <button
                        onClick={() => setIsEditMode(!isEditMode)}
                        className={cn(
                            "flex items-center gap-1.5 px-3 py-1.5 sm:py-2 rounded-xl text-xs font-bold transition-all shadow-sm border",
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
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1 overflow-x-auto scroller-none bg-muted/40 p-1 rounded-xl border border-border/50 max-w-full">
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
                                "px-2.5 sm:px-3 py-1 sm:py-1.5 text-xs font-semibold rounded-lg transition-all whitespace-nowrap",
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
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-border bg-card hover:bg-muted text-xs font-medium text-muted-foreground transition-colors"
                        >
                            <RotateCcw className="size-3" />
                            <span>Standard</span>
                        </button>
                        <button
                            onClick={() => setShowAddModal(true)}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 transition-all shadow-sm"
                        >
                            <Plus className="size-3.5" />
                            <span>Kachel hinzufügen</span>
                        </button>
                    </div>
                )}
            </div>

            {/* The Market Tiles Grid (Optimized for iPhone 2-col, iPad 3-col, Desktop 3-col) */}
            <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 gap-2.5 sm:gap-4 md:gap-5">
                {filteredItems.map((item) => {
                    const q = quotes[item.symbol];
                    const changePct = q?.changePercent ?? 0;
                    const isPositive = changePct >= 0;
                    const decimals = item.decimals ?? (item.symbol.includes('=X') ? 4 : 2);
                    const itemIndex = items.findIndex(i => i.id === item.id);
                    const canMoveLeft = itemIndex > 0;
                    const canMoveRight = itemIndex < items.length - 1;

                    return (
                        <div
                            key={item.id}
                            className={cn(
                                "relative rounded-xl sm:rounded-2xl p-2.5 sm:p-4 md:p-5 transition-all shadow-md flex flex-col justify-between select-none overflow-hidden group min-h-[105px] sm:min-h-[140px]",
                                isPositive
                                    ? "bg-[#3fb78f] text-slate-950 border border-emerald-600/30 shadow-emerald-950/10"
                                    : "bg-[#eb6a59] text-slate-950 border border-rose-600/30 shadow-rose-950/10"
                            )}
                        >
                            {/* Top: Name & Edit Controls (Inline flex: Never overlaps the title!) */}
                            <div className="flex items-center justify-between gap-1.5 min-w-0">
                                <div className="min-w-0 flex-1">
                                    <h3 
                                        className="font-extrabold text-xs sm:text-base md:text-lg tracking-tight truncate drop-shadow-xs text-slate-950" 
                                        title={item.name}
                                    >
                                        {item.name}
                                    </h3>
                                </div>

                                {isEditMode ? (
                                    <div className="flex items-center gap-0.5 bg-black/65 backdrop-blur-md px-1 py-0.5 rounded-lg shrink-0 shadow-xs border border-white/10">
                                        {canMoveLeft && (
                                            <button
                                                type="button"
                                                onClick={(e) => { e.stopPropagation(); moveItem(item.id, 'left'); }}
                                                className="p-1 hover:bg-white/20 active:scale-95 rounded text-white transition-all"
                                                title="Nach links schieben"
                                            >
                                                <ChevronLeft className="size-3 sm:size-3.5" />
                                            </button>
                                        )}
                                        {canMoveRight && (
                                            <button
                                                type="button"
                                                onClick={(e) => { e.stopPropagation(); moveItem(item.id, 'right'); }}
                                                className="p-1 hover:bg-white/20 active:scale-95 rounded text-white transition-all"
                                                title="Nach rechts schieben"
                                            >
                                                <ChevronRight className="size-3 sm:size-3.5" />
                                            </button>
                                        )}
                                        <button
                                            type="button"
                                            onClick={(e) => { e.stopPropagation(); removeItem(item.id); }}
                                            className="p-1 hover:bg-rose-600 active:scale-95 rounded text-rose-200 hover:text-white transition-all"
                                            title="Kachel entfernen"
                                        >
                                            <X className="size-3 sm:size-3.5" />
                                        </button>
                                    </div>
                                ) : (
                                    <span className="text-[9px] sm:text-[10px] uppercase font-bold tracking-wider opacity-60 shrink-0 font-mono hidden xs:inline">
                                        {item.symbol.split('.')[0].replace('=X', '')}
                                    </span>
                                )}
                            </div>

                            {/* Center: Price */}
                            <div className="my-1 sm:my-2 text-center">
                                <div className="text-lg sm:text-2xl md:text-3xl font-black tracking-tight drop-shadow-xs tabular-nums text-slate-950">
                                    {q ? formatNumber(q.price, decimals) : (
                                        <span className="opacity-40 animate-pulse text-sm sm:text-xl">Laden...</span>
                                    )}
                                </div>
                            </div>

                            {/* Bottom: Change % */}
                            <div className="flex items-center justify-center gap-1 font-black text-xs sm:text-base md:text-lg drop-shadow-xs tabular-nums text-slate-950">
                                {q && (
                                    <>
                                        {isPositive ? (
                                            <TrendingUp className="size-3 sm:size-4 shrink-0" />
                                        ) : (
                                            <TrendingDown className="size-3 sm:size-4 shrink-0" />
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
                <div className="p-8 sm:p-12 text-center rounded-2xl border border-dashed border-border/80 bg-card/40 space-y-3">
                    <p className="text-xs sm:text-sm text-muted-foreground">Keine Kacheln in dieser Kategorie vorhanden.</p>
                    <button
                        onClick={() => setShowAddModal(true)}
                        className="px-4 py-2 bg-primary text-primary-foreground text-xs font-bold rounded-lg hover:bg-primary/90 transition-all"
                    >
                        + Kachel hinzufügen
                    </button>
                </div>
            )}

            {/* Last updated footer info */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-[11px] sm:text-xs text-muted-foreground pt-3 sm:pt-4 border-t border-border/40">
                <span className="flex items-center gap-1.5">
                    <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
                    Live &bull; Automatische Synchronisation aktiv
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
                    <div className="bg-card border border-border rounded-2xl shadow-2xl max-w-lg w-full p-4 sm:p-5 space-y-4 animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
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
                                                category: 'stocks',
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
                                        let sym = searchSymbol.trim().toUpperCase();
                                        let cat = customCategory;
                                        let name = customName.trim();
                                        let dec = cat === 'forex' || sym.includes('=X') ? 4 : 2;

                                        // Auto-normalize crypto abbreviations to CHF
                                        if (sym === 'BTC' || sym === 'BITCOIN') {
                                            sym = 'BTC-CHF';
                                            cat = 'crypto';
                                            dec = 0;
                                            if (!name) name = 'Bitcoin (CHF)';
                                        } else if (sym === 'ETH' || sym === 'ETHEREUM' || sym === 'EUTERIUM' || sym === 'ETHERIUM') {
                                            sym = 'ETH-CHF';
                                            cat = 'crypto';
                                            dec = 2;
                                            if (!name) name = 'Ethereum (CHF)';
                                        } else if (sym === 'SOL' || sym === 'SOLANA') {
                                            sym = 'SOL-USD';
                                            cat = 'crypto';
                                            dec = 2;
                                            if (!name) name = 'Solana (USD)';
                                        }

                                        addItem({
                                            symbol: sym,
                                            name: name || sym,
                                            category: cat,
                                            decimals: dec
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
