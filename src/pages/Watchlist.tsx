import { useState, useEffect } from 'react';
import { usePortfolio } from '../context/PortfolioContext';
import { useNavigate } from 'react-router-dom';

import { useCurrencyFormatter } from '../utils/currency';

import { getCurrentDividendPeriod, translateFrequency } from '../utils/dividend';
import { Eye, Plus, Trash2, Edit, ShoppingBag, RefreshCw, TrendingUp, ChevronDown, ChevronRight, PieChart } from 'lucide-react';

import { Logo } from '../components/Logo';
import { cn } from '../utils';
import { estimateMarketState } from '../utils/market';

import { AddPositionModal } from '../components/AddPositionModal'; // Import AddPositionModal
import { EditPositionModal } from '../components/EditPositionModal';
import { WatchlistPerformanceModal } from '../components/WatchlistPerformanceModal';
import type { Stock } from '../types';

export function Watchlist() {
    const navigate = useNavigate();
    const { stocks, watchlists, positions, removeFromWatchlist, addPosition, updatePosition, deletePosition, lastGlobalRefresh, isGlobalRefreshing, refreshAllPrices, refreshTick, createWatchlist, deleteWatchlist, renameWatchlist } = usePortfolio(); // Get refresh + tick
    const { formatCurrency, convertToCHF } = useCurrencyFormatter();
    const [buyStock, setBuyStock] = useState<Stock | null>(null); // State for buying stock
    const [editPosition, setEditPosition] = useState<any>(null); // State for editing position
    const [isPerformanceModalOpen, setIsPerformanceModalOpen] = useState(false);

    // Collapsible states
    // Collapsible states - Persisted
    const [isOwnedStocksOpen, setIsOwnedStocksOpen] = useState(() => localStorage.getItem('wl_sec_owned_stocks') !== 'false'); // Default true
    const [isOwnedEtfsOpen, setIsOwnedEtfsOpen] = useState(() => localStorage.getItem('wl_sec_owned_etfs') !== 'false'); // Default true
    const [isPotentialStocksOpen, setIsPotentialStocksOpen] = useState(() => localStorage.getItem('wl_sec_pot_stocks') === 'true'); // Default false
    const [isPotentialEtfsOpen, setIsPotentialEtfsOpen] = useState(() => localStorage.getItem('wl_sec_pot_etfs') === 'true'); // Default false

    // Persist collapsible states
    useEffect(() => { localStorage.setItem('wl_sec_owned_stocks', String(isOwnedStocksOpen)); }, [isOwnedStocksOpen]);
    useEffect(() => { localStorage.setItem('wl_sec_owned_etfs', String(isOwnedEtfsOpen)); }, [isOwnedEtfsOpen]);
    useEffect(() => { localStorage.setItem('wl_sec_pot_stocks', String(isPotentialStocksOpen)); }, [isPotentialStocksOpen]);
    useEffect(() => { localStorage.setItem('wl_sec_pot_etfs', String(isPotentialEtfsOpen)); }, [isPotentialEtfsOpen]);


    // Multi-Watchlist State - Persist in localStorage to survive navigation
    const STORAGE_KEY = 'watchlist_active_tab';
    const [activeWatchlistId, setActiveWatchlistId] = useState<string>(() => {
        // Read from localStorage on mount, default to 'owned' if not found
        const saved = localStorage.getItem(STORAGE_KEY);
        return saved || 'owned';
    });

    // Persist activeWatchlistId to localStorage on change
    useEffect(() => {
        localStorage.setItem(STORAGE_KEY, activeWatchlistId);
    }, [activeWatchlistId]);

    // Handle deleted watchlist (but don't override valid selection on mount)
    useEffect(() => {
        // Skip if in 'owned' mode (virtual tab)
        if (activeWatchlistId === 'owned') return;

        // If current list was deleted, fallback to 'owned'
        if (activeWatchlistId && !watchlists.find(w => w.id === activeWatchlistId)) {
            setActiveWatchlistId('owned');
        }
    }, [watchlists, activeWatchlistId]);

    const activeWatchlist = watchlists.find(w => w.id === activeWatchlistId) || watchlists[0];

    // Sorting
    const [sortConfig, setSortConfig] = useState<{ key: 'name' | 'yield' | 'gap' | 'sellGap', direction: 'asc' | 'desc' }>({ key: 'name', direction: 'asc' });

    // Filter stocks that are in the watchlist
    const watchlistStocks = stocks
        .filter(s => {
            if (!activeWatchlist) return false;

            // Check explicit membership
            const explicitlyInList = activeWatchlist.stockIds.includes(s.id);

            // For Default List ("Merkliste"), AUTO-INCLUDE all owned positions
            if (activeWatchlist.isDefault) {
                const isOwned = positions.some(p => String(p.stockId) === String(s.id));
                return explicitlyInList || isOwned;
            }

            return explicitlyInList;
        })
        .sort((a, b) => {
            if (sortConfig.key === 'name') {
                return a.name.localeCompare(b.name);
            }
            if (sortConfig.key === 'yield') {
                const yieldA = a.dividendYield || 0;
                const yieldB = b.dividendYield || 0;
                return yieldB - yieldA; // Descending
            }
            if (sortConfig.key === 'gap') {
                const targetA = a.targetPrice || 0;
                const targetB = b.targetPrice || 0;
                if (!targetA) return 1;
                if (!targetB) return -1;
                const gapA = (a.currentPrice - targetA) / targetA;
                const gapB = (b.currentPrice - targetB) / targetB;
                return gapA - gapB;
            }
            if (sortConfig.key === 'sellGap') {
                const sellA = a.sellLimit || 0;
                const sellB = b.sellLimit || 0;
                if (!sellA) return 1;
                if (!sellB) return -1;
                const gapA = (sellA - a.currentPrice) / sellA;
                const gapB = (sellB - b.currentPrice) / sellB;
                return gapA - gapB;
            }
            return 0;
        });

    // Split into sections (Stocks vs ETFs)
    const ownedStocks = watchlistStocks.filter(s =>
        positions.some(p => String(p.stockId) === String(s.id)) && (!s.type || s.type === 'stock')
    );
    const ownedEtfs = watchlistStocks.filter(s =>
        positions.some(p => String(p.stockId) === String(s.id)) && s.type === 'etf'
    );

    const potentialStocks = watchlistStocks.filter(s =>
        !positions.some(p => String(p.stockId) === String(s.id)) && (!s.type || s.type === 'stock')
    );
    const potentialEtfs = watchlistStocks.filter(s =>
        !positions.some(p => String(p.stockId) === String(s.id)) && s.type === 'etf'
    );


    // Visibility Logic: Context-sensitive
    // Show sections if we have owned OR potential items of that type
    const hasStocks = ownedStocks.length > 0 || potentialStocks.length > 0;
    const hasEtfs = ownedEtfs.length > 0 || potentialEtfs.length > 0;

    // Show Stock Sections if: We have any stocks (owned or potential) OR we have NO ETFs (default view)
    const showStockSections = hasStocks || !hasEtfs;
    // Show ETF Sections if: We have any ETFs (owned or potential) OR we have NO Stocks
    const showEtfSections = hasEtfs || !hasStocks;

    // Unified Timer Tracking (v3.12.70): Replaced local interval with dependency on global refreshTick
    useEffect(() => {
        // Auto-collapse if empty
        if (ownedStocks.length === 0) {
            setIsOwnedStocksOpen(false);
        }

        if (ownedEtfs.length === 0) {
            setIsOwnedEtfsOpen(false);
        }
    }, [ownedStocks.length, ownedEtfs.length]);

    useEffect(() => {
        // Auto-refresh if last refresh was more than 5 minutes ago
        if (lastGlobalRefresh) {
            const minutesSinceRefresh = Math.floor((new Date().getTime() - lastGlobalRefresh.getTime()) / 60000);
            if (minutesSinceRefresh >= 5 && !isGlobalRefreshing) {
                console.log('[Watchlist] Triggering auto-refresh based on global tick...');
                refreshAllPrices();
            }
        }
    }, [refreshTick, lastGlobalRefresh, isGlobalRefreshing, refreshAllPrices]);

    // iOS Safari: Check on visibility change (when tab becomes visible again)
    useEffect(() => {
        const handleVisibilityChange = () => {
            if (!document.hidden && lastGlobalRefresh) {
                const minutesSinceRefresh = Math.floor((new Date().getTime() - lastGlobalRefresh.getTime()) / 60000);
                if (minutesSinceRefresh >= 5 && !isGlobalRefreshing) {
                    refreshAllPrices();
                }
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [lastGlobalRefresh, isGlobalRefreshing, refreshAllPrices]);

    // Unified Buy Handler: Always opens Calculator (Buy/Sell Page)
    const handleBuy = (stock: Stock) => {
        navigate(`/calculator?stock=${stock.id}&mode=buy&from=watchlist`);
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
            {/* Header */}
            <div className="border-b bg-card sticky top-0 z-[100]">
                <div className="w-full px-4 py-4 md:px-4">
                    <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                            <div className="p-3 rounded-xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20 text-blue-600 dark:text-blue-400">
                                <Eye className="size-6" />
                            </div>
                            <div>
                                <h1 className="text-3xl font-bold tracking-tight">Watchlist</h1>
                                <p className="text-muted-foreground hidden md:block">Aktien beobachten und Dividenden prüfen</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-2 ml-auto">
                            {/* Global Refresh Button */}
                            <button
                                onClick={() => refreshAllPrices(true)}
                                disabled={isGlobalRefreshing}
                                className={cn(
                                    "flex items-center gap-2 px-4 py-2 rounded-lg border font-medium transition-all shadow-sm",
                                    "bg-blue-600 text-white border-blue-700 hover:bg-blue-700 hover:border-blue-800",
                                    "active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                                )}
                                title="Preise jetzt aktualisieren"
                            >
                                <RefreshCw className={cn("size-4", isGlobalRefreshing && "animate-spin")} />
                                <span className="hidden sm:inline">
                                    {isGlobalRefreshing
                                        ? 'Aktualisiere...'
                                        : lastGlobalRefresh
                                            ? `Vor ${Math.floor((new Date().getTime() - lastGlobalRefresh.getTime()) / 60000)} Min`
                                            : 'Aktualisieren'}
                                </span>
                            </button>
                            <button
                                onClick={() => setIsPerformanceModalOpen(true)}
                                className="flex items-center gap-2 bg-secondary text-secondary-foreground px-4 py-2 rounded-lg hover:bg-secondary/90 transition-colors font-medium border border-border shadow-sm"
                            >
                                <TrendingUp className="size-4 text-blue-500" />
                                <span>Details</span>
                            </button>
                            <button
                                onClick={() => {
                                    navigate('/calculator?mode=new&from=watchlist');
                                }}
                                className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors font-medium shadow-sm"
                            >
                                <Plus className="size-4" />
                                <span>Hinzufügen</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Watchlist Tabs */}
            <div className="px-4 pb-2 mt-4 overflow-x-auto">
                <div className="flex items-center gap-2 min-w-max">
                    {/* 1. Bestand (Always first) */}
                    <button
                        onClick={() => setActiveWatchlistId('owned')}
                        className={cn(
                            "px-4 py-2 rounded-full text-sm font-medium transition-all border",
                            activeWatchlistId === 'owned'
                                ? "bg-primary text-primary-foreground border-primary shadow-sm"
                                : "bg-card text-muted-foreground border-border hover:bg-accent hover:text-foreground"
                        )}
                    >
                        Bestand
                    </button>

                    {/* 2. Other User Lists (excluding Merkliste) */}
                    {watchlists.filter(wl => !wl.isDefault).map(wl => (
                        <div key={wl.id} className="relative group">
                            <button
                                onClick={() => setActiveWatchlistId(wl.id)}
                                className={cn(
                                    "px-4 py-2 rounded-full text-sm font-medium transition-all border",
                                    activeWatchlistId === wl.id
                                        ? "bg-primary text-primary-foreground border-primary shadow-sm"
                                        : "bg-card text-muted-foreground border-border hover:bg-accent hover:text-foreground"
                                )}
                            >
                                {wl.name}
                            </button>
                            {activeWatchlistId === wl.id && (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        if (confirm(`Liste "${wl.name}" wirklich löschen?`)) {
                                            deleteWatchlist(wl.id);
                                            setActiveWatchlistId('owned');
                                        }
                                    }}
                                    className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                                    title="Liste löschen"
                                >
                                    <Trash2 className="size-3" />
                                </button>
                            )}
                        </div>
                    ))}

                    {/* 3. Merkliste (Default Watchlist) - Always Last */}
                    {watchlists.filter(wl => wl.isDefault).map(wl => (
                        <div key={wl.id} className="relative group">
                            <button
                                onClick={() => setActiveWatchlistId(wl.id)}
                                className={cn(
                                    "px-4 py-2 rounded-full text-sm font-medium transition-all border",
                                    activeWatchlistId === wl.id
                                        ? "bg-primary text-primary-foreground border-primary shadow-sm"
                                        : "bg-card text-muted-foreground border-border hover:bg-accent hover:text-foreground"
                                )}
                            >
                                {wl.name}
                            </button>
                        </div>
                    ))}
                    {/* Add List Button */}
                    <button
                        onClick={() => {
                            const name = window.prompt("Name der neuen Liste:");
                            if (name) createWatchlist(name);
                        }}
                        className="p-2 rounded-full bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors border border-border"
                        title="Neue Liste erstellen"
                    >
                        <Plus className="size-4" />
                    </button>
                    {/* Rename Button (for active list) */}
                    {activeWatchlist && (
                        <button
                            onClick={() => {
                                const newName = window.prompt("Neuer Name:", activeWatchlist.name);
                                if (newName) renameWatchlist(activeWatchlist.id, newName);
                            }}
                            className="p-2 ml-2 rounded-full text-muted-foreground hover:bg-accent transition-colors"
                            title="Liste umbenennen"
                        >
                            <Edit className="size-4" />
                        </button>
                    )}
                </div>
            </div>

            <div className="w-full px-2 py-4 md:px-4 space-y-8">
                {/* 1. OWNED STOCKS (Always Visible) */}
                {showStockSections && (
                    <div className="bg-card rounded-xl border shadow-sm overflow-hidden w-full">

                        <button
                            onClick={() => setIsOwnedStocksOpen(!isOwnedStocksOpen)}
                            className="w-full flex flex-col md:flex-row md:items-center justify-between p-4 border-b bg-green-500/5 gap-2 hover:bg-green-500/10 transition-colors text-left"
                        >
                            <div className="flex items-center gap-2">
                                <ShoppingBag className="size-5 text-green-600" />
                                <h2 className="text-lg font-bold">Aktien im Bestand</h2>
                                {isOwnedStocksOpen ? <ChevronDown className="size-4 ml-2 opacity-50" /> : <ChevronRight className="size-4 ml-2 opacity-50" />}
                            </div>
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[10px] md:text-xs font-medium text-muted-foreground bg-background/50 px-3 py-1.5 rounded-lg border border-border/50">
                                <span className="hidden sm:inline">Legende:</span>
                                <div className="flex items-center gap-1.5">
                                    <div className="flex items-center gap-1 text-green-600 dark:text-green-400">
                                        <div className="size-2 rounded-full bg-green-500 animate-pulse" />
                                        <span className="font-bold">KAUFEN</span>
                                    </div>
                                    <span>Kurs &lt; Limit</span>
                                </div>
                                <div className="w-px h-3 bg-border hidden sm:block" />
                                <div className="flex items-center gap-1.5">
                                    <div className="flex items-center gap-1 text-red-500">
                                        <div className="size-2 rounded-full bg-red-500" />
                                        <span className="font-bold">KEINE INFO</span>
                                    </div>
                                    <span>Limit fehlt</span>
                                </div>
                            </div>
                        </button>

                        {isOwnedStocksOpen && (
                            <div className="overflow-x-auto w-full overscroll-x-none border-b border-border animate-in slide-in-from-top-2 duration-200">
                                <WatchlistTable
                                    stocks={ownedStocks}
                                    sortConfig={sortConfig}
                                    setSortConfig={setSortConfig}
                                    onNavigate={(id) => navigate(`/stock/${id}?from=watchlist`)}
                                    onBuy={(stock) => handleBuy(stock)}
                                    // Blue "Edit" button now opens details page
                                    onEdit={(id) => navigate(`/stock/${id}?from=watchlist`)}
                                    onRemove={(id) => removeFromWatchlist(id, activeWatchlistId)}
                                    formatCurrency={formatCurrency}
                                    convertToCHF={convertToCHF}
                                    emptyMessage="Keine Aktien im Bestand."
                                />
                            </div>
                        )}
                    </div>
                )}

                {/* 2. OWNED ETFS (Always Visible if present) */}
                {showEtfSections && ownedEtfs.length > 0 && (
                    <div className="bg-card rounded-xl border shadow-sm overflow-hidden w-full">
                        <button
                            onClick={() => setIsOwnedEtfsOpen(!isOwnedEtfsOpen)}
                            className="w-full flex flex-col md:flex-row md:items-center justify-between p-4 border-b bg-green-500/5 gap-2 hover:bg-green-500/10 transition-colors text-left"
                        >
                            <div className="flex items-center gap-2">
                                <PieChart className="size-5 text-green-600" />
                                <h2 className="text-lg font-bold">ETFs im Bestand</h2>
                                {isOwnedEtfsOpen ? <ChevronDown className="size-4 ml-2 opacity-50" /> : <ChevronRight className="size-4 ml-2 opacity-50" />}
                            </div>
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[10px] md:text-xs font-medium text-muted-foreground bg-background/50 px-3 py-1.5 rounded-lg border border-border/50">
                                <span className="hidden sm:inline">Legende:</span>
                                <div className="flex items-center gap-1.5">
                                    <div className="flex items-center gap-1 text-green-600 dark:text-green-400">
                                        <div className="size-2 rounded-full bg-green-500 animate-pulse" />
                                        <span className="font-bold">KAUFEN</span>
                                    </div>
                                    <span>Kurs &lt; Limit</span>
                                </div>
                                <div className="w-px h-3 bg-border hidden sm:block" />
                                <div className="flex items-center gap-1.5">
                                    <div className="flex items-center gap-1 text-red-500">
                                        <div className="size-2 rounded-full bg-red-500" />
                                        <span className="font-bold">KEINE INFO</span>
                                    </div>
                                    <span>Limit fehlt</span>
                                </div>
                            </div>
                        </button>

                        {isOwnedEtfsOpen && (
                            <div className="overflow-x-auto w-full overscroll-x-none border-b border-border animate-in slide-in-from-top-2 duration-200">
                                <WatchlistTable
                                    stocks={ownedEtfs}
                                    sortConfig={sortConfig}
                                    setSortConfig={setSortConfig}
                                    onNavigate={(id) => navigate(`/stock/${id}?from=watchlist`)}
                                    onBuy={(stock) => handleBuy(stock)}
                                    // Blue "Edit" button now opens details page
                                    onEdit={(id) => navigate(`/stock/${id}?from=watchlist`)}
                                    onRemove={(id) => removeFromWatchlist(id, activeWatchlistId)}
                                    formatCurrency={formatCurrency}
                                    convertToCHF={convertToCHF}
                                    emptyMessage="Keine ETFs im Bestand."
                                />
                            </div>
                        )}
                    </div>
                )}

                {/* 3. POTENTIAL STOCKS (Collapsible, Default Closed) - Hide if in 'Bestand' mode */}
                {activeWatchlistId !== 'owned' && showStockSections && (
                    <div className="bg-card rounded-xl border shadow-sm overflow-hidden w-full">
                        <button
                            onClick={() => setIsPotentialStocksOpen(!isPotentialStocksOpen)}
                            className="w-full flex flex-col md:flex-row md:items-center justify-between p-4 border-b bg-blue-500/5 gap-2 hover:bg-blue-500/10 transition-colors text-left"
                        >
                            <div className="flex items-center gap-2">
                                <TrendingUp className="size-5 text-blue-600" />
                                <h2 className="text-lg font-bold">Potenzielle Aktien: {potentialStocks.length}</h2>
                                {isPotentialStocksOpen ? <ChevronDown className="size-4 ml-2 opacity-50" /> : <ChevronRight className="size-4 ml-2 opacity-50" />}
                            </div>
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[10px] md:text-xs font-medium text-muted-foreground bg-background/50 px-3 py-1.5 rounded-lg border border-border/50">
                                <span className="hidden sm:inline">Legende:</span>
                                <div className="flex items-center gap-1.5">
                                    <div className="flex items-center gap-1 text-green-600 dark:text-green-400">
                                        <div className="size-2 rounded-full bg-green-500 animate-pulse" />
                                        <span className="font-bold">KAUFEN</span>
                                    </div>
                                    <span>Kurs &lt; Limit</span>
                                </div>
                                <div className="w-px h-3 bg-border hidden sm:block" />
                                <div className="flex items-center gap-1.5">
                                    <div className="flex items-center gap-1 text-red-500">
                                        <div className="size-2 rounded-full bg-red-500" />
                                        <span className="font-bold">KEINE INFO</span>
                                    </div>
                                    <span>Limit fehlt</span>
                                </div>
                            </div>
                        </button>

                        {isPotentialStocksOpen && (
                            <div className="overflow-x-auto w-full overscroll-x-none border-b border-border animate-in slide-in-from-top-2 duration-200">
                                <WatchlistTable
                                    stocks={potentialStocks}
                                    sortConfig={sortConfig}
                                    setSortConfig={setSortConfig}
                                    onNavigate={(id) => navigate(`/stock/${id}?from=watchlist`)}
                                    onBuy={(stock) => handleBuy(stock)}
                                    // Blue "Edit" button now opens details page
                                    onEdit={(id) => navigate(`/stock/${id}?from=watchlist`)}
                                    onRemove={(id) => removeFromWatchlist(id, activeWatchlistId)}
                                    formatCurrency={formatCurrency}
                                    convertToCHF={convertToCHF}
                                    emptyMessage="Keine potenziellen Aktien auf der Watchlist."
                                />
                            </div>
                        )}
                    </div>
                )}

                {/* 4. POTENTIAL ETFS (Collapsible, Default Closed) - Hide if in 'Bestand' mode */}
                {activeWatchlistId !== 'owned' && showEtfSections && (
                    <div className="bg-card rounded-xl border shadow-sm overflow-hidden w-full">
                        <button
                            onClick={() => setIsPotentialEtfsOpen(!isPotentialEtfsOpen)}
                            className="w-full flex flex-col md:flex-row md:items-center justify-between p-4 border-b bg-blue-500/5 gap-2 hover:bg-blue-500/10 transition-colors text-left"
                        >
                            <div className="flex items-center gap-2">
                                <PieChart className="size-5 text-blue-600" />
                                <h2 className="text-lg font-bold">Potenzielle ETFs: {potentialEtfs.length}</h2>
                                {isPotentialEtfsOpen ? <ChevronDown className="size-4 ml-2 opacity-50" /> : <ChevronRight className="size-4 ml-2 opacity-50" />}
                            </div>
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[10px] md:text-xs font-medium text-muted-foreground bg-background/50 px-3 py-1.5 rounded-lg border border-border/50">
                                <span className="hidden sm:inline">Legende:</span>
                                <div className="flex items-center gap-1.5">
                                    <div className="flex items-center gap-1 text-green-600 dark:text-green-400">
                                        <div className="size-2 rounded-full bg-green-500 animate-pulse" />
                                        <span className="font-bold">KAUFEN</span>
                                    </div>
                                    <span>Kurs &lt; Limit</span>
                                </div>
                                <div className="w-px h-3 bg-border hidden sm:block" />
                                <div className="flex items-center gap-1.5">
                                    <div className="flex items-center gap-1 text-red-500">
                                        <div className="size-2 rounded-full bg-red-500" />
                                        <span className="font-bold">KEINE INFO</span>
                                    </div>
                                    <span>Limit fehlt</span>
                                </div>
                            </div>
                        </button>

                        {isPotentialEtfsOpen && (
                            <div className="overflow-x-auto w-full overscroll-x-none border-b border-border animate-in slide-in-from-top-2 duration-200">
                                <WatchlistTable
                                    stocks={potentialEtfs}
                                    sortConfig={sortConfig}
                                    setSortConfig={setSortConfig}
                                    onNavigate={(id) => navigate(`/stock/${id}?from=watchlist`)}
                                    onBuy={(stock) => handleBuy(stock)}
                                    // Blue "Edit" button now opens details page
                                    onEdit={(id) => navigate(`/stock/${id}?from=watchlist`)}
                                    onRemove={(id) => removeFromWatchlist(id, activeWatchlistId)}
                                    formatCurrency={formatCurrency}
                                    convertToCHF={convertToCHF}
                                    emptyMessage="Keine potenziellen ETFs auf der Watchlist."
                                />
                            </div>
                        )}


                    </div>
                )}


                {/* AddPositionModal for buying from watchlist */}
                {buyStock && (
                    <AddPositionModal
                        isOpen={!!buyStock}
                        onClose={() => setBuyStock(null)}
                        stocks={stocks}
                        onAdd={(pos) => {
                            addPosition(pos);
                            setBuyStock(null);
                        }}
                        preSelectedStock={buyStock}
                    />
                )}
                {/* WatchlistPerformanceModal */}
                <WatchlistPerformanceModal
                    isOpen={isPerformanceModalOpen}
                    onClose={() => setIsPerformanceModalOpen(false)}
                />

                {/* EditPositionModal for editing owned stocks from watchlist */}
                {editPosition && (
                    <EditPositionModal
                        isOpen={!!editPosition}
                        onClose={() => setEditPosition(null)}
                        position={editPosition}
                        onUpdate={(id, newShares, newAvgPrice, newBuyDate, newFxRate, newPurchases) => {
                            updatePosition(id, {
                                shares: newShares,
                                buyPriceAvg: newAvgPrice,
                                buyDate: newBuyDate,
                                averageEntryFxRate: newFxRate,
                                purchases: newPurchases
                            });
                            setEditPosition(null);
                        }}
                        onDelete={(id) => {
                            deletePosition(id);
                            setEditPosition(null);
                        }}
                    />
                )}
            </div>
        </div>
    );
}

interface WatchlistTableProps {
    stocks: Stock[];
    sortConfig: { key: string; direction: 'asc' | 'desc' };
    setSortConfig: (config: any) => void;
    onNavigate: (id: string) => void;
    onBuy: (stock: Stock) => void;
    onEdit: (id: string) => void;
    onRemove: (id: string) => void;
    formatCurrency: any;
    convertToCHF: (amount: number, from: string) => number;
    emptyMessage: string;
}

function WatchlistTable({
    stocks,
    sortConfig,
    setSortConfig,
    onNavigate,
    onBuy,
    onEdit,
    onRemove,
    formatCurrency,
    convertToCHF,
    emptyMessage
}: WatchlistTableProps) {
    if (stocks.length === 0) {
        return (
            <div className="p-12 text-center text-muted-foreground">
                <div className="flex flex-col items-center gap-2">
                    <ShoppingBag className="size-12 opacity-20" />
                    <p>{emptyMessage}</p>
                </div>
            </div>
        );
    }

    return (
        <table className="w-full text-left border-collapse min-w-[1200px] xl:min-w-0 table-fixed">
            <thead>
                <tr className="border-b bg-muted/20">
                    <th className="p-4 font-semibold text-muted-foreground text-xs uppercase tracking-wider whitespace-normal sticky -left-px z-20 bg-card shadow-[5px_0_5px_-5px_rgba(0,0,0,0.1)] w-[150px] min-w-[150px] max-w-[150px] md:w-[200px] md:min-w-[200px] md:max-w-[200px]">Aktie</th>
                    <th
                        className="p-4 font-semibold text-muted-foreground text-xs uppercase tracking-wider text-right cursor-pointer hover:text-primary transition-colors w-[10%]"
                        onClick={() => {
                            setSortConfig({
                                key: 'yield',
                                direction: sortConfig.key === 'yield' && sortConfig.direction === 'desc' ? 'asc' : 'desc'
                            });
                        }}
                    >
                        Div. Rendite {sortConfig.key === 'yield' && (sortConfig.direction === 'desc' ? '↓' : '↑')}
                    </th>
                    <th className="p-4 font-semibold text-muted-foreground text-xs uppercase tracking-wider text-right w-[15%]">Aktueller Kurs</th>
                    <th
                        className="p-4 font-semibold text-muted-foreground text-xs uppercase tracking-wider text-right cursor-pointer hover:text-primary transition-colors w-[15%]"
                        onClick={() => {
                            setSortConfig({
                                key: 'gap',
                                direction: sortConfig.key === 'gap' && sortConfig.direction === 'asc' ? 'desc' : 'asc'
                            });
                        }}
                    >
                        Kauflimit {sortConfig.key === 'gap' && (sortConfig.direction === 'asc' ? '↓' : '↑')}
                    </th>
                    <th
                        className="p-4 font-semibold text-muted-foreground text-xs uppercase tracking-wider text-right cursor-pointer hover:text-primary transition-colors w-[10%]"
                        onClick={() => {
                            setSortConfig({
                                key: 'sellGap',
                                direction: sortConfig.key === 'sellGap' && sortConfig.direction === 'asc' ? 'desc' : 'asc'
                            });
                        }}
                    >
                        Verkaufslimit {sortConfig.key === 'sellGap' && (sortConfig.direction === 'asc' ? '↓' : '↑')}
                    </th>
                    <th className="p-4 font-semibold text-muted-foreground text-xs uppercase tracking-wider text-right w-[10%]">EX-Tag</th>
                    <th className="p-4 font-semibold text-muted-foreground text-xs uppercase tracking-wider text-right w-[10%]">Zahl-Tag</th>
                    <th className="p-4 md:pl-12 font-semibold text-muted-foreground text-xs uppercase tracking-wider text-center w-[110px] md:sticky md:-right-px z-20 bg-card md:shadow-[-5px_0_5px_-5px_rgba(0,0,0,0.1)]">Aktionen</th>
                </tr>
            </thead>
            <tbody className="divide-y">
                {stocks.map((stock) => {
                    const currentDiv = getCurrentDividendPeriod(stock);

                    const isUnderTarget = stock.targetPrice && stock.currentPrice <= stock.targetPrice;
                    const isOverSell = stock.sellLimit && stock.currentPrice >= stock.sellLimit;
                    const stockChange = stock.previousClose ? ((stock.currentPrice - stock.previousClose) / stock.previousClose) * 100 : 0;
                    const calcState = estimateMarketState(stock.symbol, stock.currency);
                    const isMarketOpen = calcState === 'REGULAR';

                    return (
                        <tr key={stock.id} className="hover:bg-muted/30 transition-colors group">
                            <td className="p-4 sticky -left-px z-10 group-hover:bg-muted/30 transition-colors shadow-[5px_0_5px_-5px_rgba(0,0,0,0.1)] w-[150px] min-w-[150px] max-w-[150px] md:w-[200px] md:min-w-[200px] md:max-w-[200px]">
                                <div className="absolute inset-0 bg-card -z-10" />
                                <div className="flex items-center gap-3 relative">
                                    <Logo
                                        url={stock.logoUrl}
                                        alt={stock.name}
                                        fallback={stock.symbol.slice(0, 2)}
                                        size="size-10"
                                    />
                                    <div className="flex flex-col min-w-0">
                                        <div className="flex items-center gap-1.5">
                                            <span
                                                className="font-bold text-sm whitespace-pre-wrap leading-snug group-hover:text-primary transition-colors cursor-pointer"
                                                onClick={() => onNavigate(stock.id)}
                                                title={stock.name}
                                            >
                                                {stock.name}
                                            </span>
                                            {isMarketOpen ? (
                                                <div className="size-2 rounded-full bg-green-500 animate-pulse shrink-0 shadow-[0_0_8px_rgba(34,197,94,0.5)] border border-background" title={`Markt geöffnet (${calcState})`} />
                                            ) : (
                                                <div className="size-2 rounded-full bg-red-500 shrink-0 border border-background" title={`Markt geschlossen (${calcState})`} />
                                            )}
                                        </div>
                                        <span className="text-xs text-muted-foreground uppercase">{stock.symbol}</span>
                                    </div>
                                </div>
                            </td>
                            <td className="p-4 text-right">
                                <div className="flex flex-col items-end">
                                    <span className="font-bold text-sm text-green-600 dark:text-green-400">
                                        {stock.dividendYield ? `${stock.dividendYield.toFixed(2)}%` : '-'}
                                    </span>
                                    <span className="text-[10px] text-muted-foreground uppercase tracking-tight">
                                        {translateFrequency(stock.dividendFrequency)}
                                    </span>
                                </div>
                            </td>
                            <td className="p-4 text-right">
                                <div className="flex flex-col items-end gap-0.5">
                                    <span className="font-bold text-sm text-foreground">
                                        {formatCurrency(stock.currentPrice, stock.currency, false)}
                                    </span>
                                    {stock.currency !== 'CHF' && (
                                        <span className="font-bold text-sm text-foreground">
                                            {formatCurrency(convertToCHF(stock.currentPrice, stock.currency), 'CHF', false)}
                                        </span>
                                    )}
                                    {stock.previousClose !== undefined && (
                                        <span className={cn(
                                            "text-xs md:text-[10px] font-bold px-1.5 py-0.5 rounded mt-1",
                                            stockChange >= 0
                                                ? "bg-green-500/10 text-green-600"
                                                : "bg-red-500/10 text-red-600"
                                        )}>
                                            {stockChange >= 0 ? '+' : ''}{stockChange.toFixed(2)}%
                                        </span>
                                    )}
                                </div>
                            </td>
                            <td className="p-4 text-right">
                                <div className="flex flex-col items-end gap-1">
                                    <div className="flex items-center gap-2">
                                        {isUnderTarget && (
                                            <div className="size-2 rounded-full bg-green-500 animate-pulse shrink-0" title="Limit erreicht!" />
                                        )}
                                        <div className="flex flex-col items-end gap-0.5">
                                            <span className={cn(
                                                "font-bold text-sm",
                                                isUnderTarget ? "text-green-600 dark:text-green-400" : "text-foreground"
                                            )}>
                                                {stock.targetPrice ? formatCurrency(stock.targetPrice, stock.currency, false) : '-'}
                                            </span>
                                            {stock.targetPrice && stock.currency !== 'CHF' && (
                                                <span className={cn(
                                                    "font-bold text-sm",
                                                    isUnderTarget ? "text-green-600 dark:text-green-400" : "text-foreground"
                                                )}>
                                                    {formatCurrency(convertToCHF(stock.targetPrice, stock.currency), 'CHF', false)}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    {stock.targetPrice && (
                                        <span className="text-[10px] font-medium text-muted-foreground">
                                            Gap: {((stock.currentPrice - stock.targetPrice) / stock.targetPrice * 100).toFixed(1)}%
                                        </span>
                                    )}
                                </div>
                            </td>
                            <td className="p-4 text-right">
                                <div className="flex flex-col items-end gap-1">
                                    <div className="flex items-center gap-2">
                                        {isOverSell && (
                                            <div className="size-2 rounded-full bg-green-500 animate-pulse shrink-0" title="Verkaufslimit erreicht!" />
                                        )}
                                        <div className="flex flex-col items-end gap-0.5">
                                            <span className={cn(
                                                "font-bold text-sm",
                                                isOverSell ? "text-green-600 dark:text-green-400" : "text-foreground"
                                            )}>
                                                {stock.sellLimit ? formatCurrency(stock.sellLimit, stock.currency, false) : '-'}
                                            </span>
                                            {stock.sellLimit && stock.currency !== 'CHF' && (
                                                <span className={cn(
                                                    "font-bold text-sm",
                                                    isOverSell ? "text-green-600 dark:text-green-400" : "text-foreground"
                                                )}>
                                                    {formatCurrency(convertToCHF(stock.sellLimit, stock.currency), 'CHF', false)}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    {stock.sellLimit && (
                                        <span className="text-[10px] font-medium text-muted-foreground">
                                            Gap: {((stock.sellLimit - stock.currentPrice) / stock.sellLimit * 100).toFixed(1)}%
                                        </span>
                                    )}
                                </div>
                            </td>
                            <td className="p-4 text-right">
                                <div className="flex flex-col items-end gap-0.5">
                                    <span className={cn(
                                        "font-bold text-sm",
                                        (() => {
                                            const dDays = currentDiv.exDate ? Math.ceil((new Date(currentDiv.exDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)) : null;
                                            if (dDays !== null && dDays < 0) return "text-green-600 font-medium";
                                            if (dDays !== null && dDays >= 0 && dDays <= 14) return "text-orange-500 font-medium";
                                            return "text-muted-foreground";
                                        })()
                                    )}>
                                        {currentDiv.exDate
                                            ? new Date(currentDiv.exDate).toLocaleDateString('de-CH', { day: '2-digit', month: '2-digit', year: '2-digit' })
                                            : '-'}
                                    </span>
                                    {currentDiv.status === 'ex-dividend' && (
                                        <span className="text-[9px] font-bold text-orange-500 bg-orange-100 dark:bg-orange-950/50 px-1 py-0.5 rounded leading-none uppercase">
                                            Ex-Div
                                        </span>
                                    )}
                                </div>
                            </td>
                            <td className="p-4 text-right">
                                <div className="flex flex-col items-end gap-0.5">
                                    <span className={cn(
                                        "font-bold text-sm",
                                        (() => {
                                            const payDays = currentDiv.payDate ? Math.ceil((new Date(currentDiv.payDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)) : null;
                                            const exDays = currentDiv.exDate ? Math.ceil((new Date(currentDiv.exDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)) : null;
                                            if (payDays !== null && payDays < 0) return "text-green-600 font-medium";
                                            if (exDays !== null && exDays < 0 && payDays !== null && payDays >= 0) return "text-orange-500 font-medium";
                                            if (payDays !== null && payDays >= 0 && payDays <= 14) return "text-orange-500 font-medium";
                                            return "text-muted-foreground";
                                        })()
                                    )}>
                                        {currentDiv.payDate
                                            ? new Date(currentDiv.payDate).toLocaleDateString('de-CH', { day: '2-digit', month: '2-digit', year: '2-digit' })
                                            : '-'}
                                    </span>
                                    {stock.dividendAmount ? (
                                        <div className="flex flex-col items-end">
                                            <span className="text-[10px] text-muted-foreground whitespace-nowrap font-medium">
                                                {formatCurrency(stock.dividendAmount, stock.currency, false)}
                                            </span>
                                            {stock.currency !== 'CHF' && (
                                                <span className="text-[10px] text-muted-foreground whitespace-nowrap font-medium">
                                                    {formatCurrency(convertToCHF(stock.dividendAmount, stock.currency), 'CHF', false)}
                                                </span>
                                            )}
                                        </div>
                                    ) : currentDiv.status === 'paid' && (
                                        <span className="text-[9px] font-bold text-green-600 bg-green-100 dark:bg-green-950/50 px-1 py-0.5 rounded leading-none uppercase">
                                            Bezahlt
                                        </span>
                                    )}
                                </div>
                            </td>
                            <td className="p-4 md:pl-12 md:sticky md:-right-px z-10 group-hover:bg-muted/30 transition-colors md:shadow-[-5px_0_5px_-5px_rgba(0,0,0,0.1)]">
                                <div className="absolute inset-0 bg-card -z-10" />
                                <div className="flex items-center justify-center gap-2 relative">
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onBuy(stock);
                                        }}
                                        className="p-2 text-green-600 bg-green-500/10 hover:bg-green-500/20 rounded-lg transition-colors"
                                        title="Kaufen"
                                    >
                                        <ShoppingBag className="size-4" />
                                    </button>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onEdit(stock.id);
                                        }}
                                        className="p-2 text-blue-600 bg-blue-500/10 hover:bg-blue-500/20 rounded-lg transition-colors"
                                        title="Bearbeiten"
                                    >
                                        <Edit className="size-4" />
                                    </button>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onRemove(stock.id);
                                        }}
                                        className="p-2 text-red-500 bg-red-500/10 hover:bg-red-500/20 rounded-lg transition-colors"
                                        title="Entfernen"
                                    >
                                        <Trash2 className="size-4" />
                                    </button>
                                </div>
                            </td>
                        </tr>
                    );
                })}
            </tbody>
        </table>
    );
}
