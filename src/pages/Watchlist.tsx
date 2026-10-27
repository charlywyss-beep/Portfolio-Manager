import { useState, useEffect, useRef, useMemo } from 'react';
import { usePortfolio } from '../context/PortfolioContext';
import { useNavigate } from 'react-router-dom';

import { useCurrencyFormatter } from '../utils/currency';

import { getCurrentDividendPeriod, translateFrequency } from '../utils/dividend';
import { Eye, Plus, Trash2, Edit, ShoppingBag, RefreshCw, TrendingUp, ChevronRight, ChevronLeft, PieChart, ArrowLeft } from 'lucide-react';

import { Logo } from '../components/Logo';
import { cn } from '../utils';
import { estimateMarketState } from '../utils/market';
import { translateSector } from '../utils/sectorTranslation';

import { AddPositionModal } from '../components/AddPositionModal'; // Import AddPositionModal
import { EditPositionModal } from '../components/EditPositionModal';
import { WatchlistPerformanceModal } from '../components/WatchlistPerformanceModal';
import type { Stock } from '../types';

export function Watchlist() {
    const navigate = useNavigate();
    const { stocks, watchlists, positions, removeFromWatchlist, addPosition, updatePosition, deletePosition, lastGlobalRefresh, isGlobalRefreshing, refreshAllPrices, refreshTick, createWatchlist, deleteWatchlist, renameWatchlist } = usePortfolio(); // Get refresh + tick
    const { formatCurrency } = useCurrencyFormatter();
    const [buyStock, setBuyStock] = useState<Stock | null>(null); // State for buying stock
    const [editPosition, setEditPosition] = useState<any>(null); // State for editing position
    const [isPerformanceModalOpen, setIsPerformanceModalOpen] = useState(false);


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

    // Watchlist Component (v3.14.02)
    useEffect(() => {
        // Skip if in 'owned' mode (virtual tab)
        if (activeWatchlistId === 'owned') return;

        // If current list was deleted, fallback to 'owned'
        if (watchlists.length > 0 && activeWatchlistId && !watchlists.find(w => w.id === activeWatchlistId)) {
            setActiveWatchlistId('owned');
        }
    }, [watchlists, activeWatchlistId]);

    const activeWatchlist = watchlists.find(w => w.id === activeWatchlistId) || watchlists[0];

    // Sorting
    const [sortConfig, setSortConfig] = useState<{ key: 'name' | 'yield' | 'gap' | 'sellGap' | 'price', direction: 'asc' | 'desc' }>({ key: 'name', direction: 'asc' });

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
                return sortConfig.direction === 'asc'
                    ? a.name.localeCompare(b.name)
                    : b.name.localeCompare(a.name);
            }
            if (sortConfig.key === 'yield') {
                const yieldA = a.dividendYield || 0;
                const yieldB = b.dividendYield || 0;
                return sortConfig.direction === 'asc' ? yieldA - yieldB : yieldB - yieldA;
            }
            if (sortConfig.key === 'price') {
                const priceA = a.previousClose ? ((a.currentPrice - a.previousClose) / a.previousClose) * 100 : 0;
                const priceB = b.previousClose ? ((b.currentPrice - b.previousClose) / b.previousClose) * 100 : 0;
                return sortConfig.direction === 'asc' ? priceA - priceB : priceB - priceA;
            }
            if (sortConfig.key === 'gap') {
                const targetA = a.targetPrice || 0;
                const targetB = b.targetPrice || 0;
                if (!targetA && !targetB) return 0;
                if (!targetA) return 1;
                if (!targetB) return -1;
                const gapA = (a.currentPrice - targetA) / targetA;
                const gapB = (b.currentPrice - targetB) / targetB;
                return sortConfig.direction === 'asc' ? gapA - gapB : gapB - gapA;
            }
            if (sortConfig.key === 'sellGap') {
                const sellA = a.sellLimit || 0;
                const sellB = b.sellLimit || 0;
                if (!sellA && !sellB) return 0;
                if (!sellA) return 1;
                if (!sellB) return -1;
                const gapA = (a.currentPrice - sellA) / sellA;
                const gapB = (b.currentPrice - sellB) / sellB;
                return sortConfig.direction === 'asc' ? gapA - gapB : gapB - gapA;
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

    // Unified Timer Tracking (v3.12.70): Replaced local interval with dependency on global refreshTick

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

    const isEtfList = activeWatchlist?.name?.toLowerCase().includes('etf') ?? false;

    const subTabs: Array<{ id: string; label: string; count: number; icon: any; stocks: Stock[] }> = activeWatchlistId === 'owned'
        ? [
            { id: 'owned-stocks', label: 'Aktien', count: ownedStocks.length, icon: ShoppingBag, stocks: ownedStocks },
            { id: 'owned-etfs', label: 'ETFs', count: ownedEtfs.length, icon: PieChart, stocks: ownedEtfs }
        ]
        : isEtfList
            ? [
                ...(ownedEtfs.length > 0
                    ? [{ id: 'owned-etfs', label: 'Bestand ETFs', count: ownedEtfs.length, icon: PieChart, stocks: ownedEtfs }]
                    : []),
                ...(ownedStocks.length > 0
                    ? [{ id: 'owned-stocks', label: 'Bestand Aktien', count: ownedStocks.length, icon: ShoppingBag, stocks: ownedStocks }]
                    : []),
                ...(potentialEtfs.length > 0 || (ownedEtfs.length === 0 && potentialStocks.length === 0 && ownedStocks.length === 0)
                    ? [{ id: 'pot-etfs', label: (ownedEtfs.length > 0 || ownedStocks.length > 0) ? 'Watchlist ETFs' : 'ETFs', count: potentialEtfs.length, icon: PieChart, stocks: potentialEtfs }]
                    : []),
                ...(potentialStocks.length > 0
                    ? [{ id: 'pot-stocks', label: (ownedStocks.length > 0 || ownedEtfs.length > 0) ? 'Watchlist Aktien' : 'Aktien', count: potentialStocks.length, icon: ShoppingBag, stocks: potentialStocks }]
                    : [])
            ]
            : [
                ...(ownedStocks.length > 0
                    ? [{ id: 'owned-stocks', label: 'Bestand Aktien', count: ownedStocks.length, icon: ShoppingBag, stocks: ownedStocks }]
                    : []),
                ...(ownedEtfs.length > 0
                    ? [{ id: 'owned-etfs', label: 'Bestand ETFs', count: ownedEtfs.length, icon: PieChart, stocks: ownedEtfs }]
                    : []),
                ...(potentialStocks.length > 0 || (ownedStocks.length === 0 && potentialEtfs.length === 0 && ownedEtfs.length === 0)
                    ? [{ id: 'pot-stocks', label: (ownedStocks.length > 0 || ownedEtfs.length > 0) ? 'Watchlist Aktien' : 'Aktien', count: potentialStocks.length, icon: ShoppingBag, stocks: potentialStocks }]
                    : []),
                ...(potentialEtfs.length > 0
                    ? [{ id: 'pot-etfs', label: (ownedStocks.length > 0 || ownedEtfs.length > 0) ? 'Watchlist ETFs' : 'ETFs', count: potentialEtfs.length, icon: PieChart, stocks: potentialEtfs }]
                    : [])
            ];

    const SUBTAB_STORAGE_KEY = 'watchlist_active_subtab';
    const [activeSubTab, setActiveSubTab] = useState<string>(() => {
        return localStorage.getItem(SUBTAB_STORAGE_KEY) || 'owned-stocks';
    });

    useEffect(() => {
        localStorage.setItem(SUBTAB_STORAGE_KEY, activeSubTab);
    }, [activeSubTab]);
    const prevWatchlistIdRef = useRef(activeWatchlistId);

    useEffect(() => {
        if (prevWatchlistIdRef.current !== activeWatchlistId) {
            prevWatchlistIdRef.current = activeWatchlistId;
            if (subTabs.length > 0) {
                setActiveSubTab(subTabs[0].id);
            }
        } else if (!subTabs.some(t => t.id === activeSubTab) && subTabs.length > 0) {
            setActiveSubTab(subTabs[0].id);
        }
    }, [activeWatchlistId, subTabs, activeSubTab]);

    const currentTab = subTabs.find(t => t.id === activeSubTab) || subTabs[0];
    const currentTabStocks = currentTab?.stocks || [];

    return (
        <div className="h-full flex flex-col p-4 md:p-6 space-y-3 bg-gradient-to-br from-background via-background to-muted/20 overflow-hidden iphone-landscape-page-root">
            {/* Header + Tabs Container - Fixed Height */}
            <div className="shrink-0 bg-background pb-1 -mt-4 -mx-4 px-4 md:-mt-6 md:-mx-6 md:px-6 iphone-landscape-portfolio-header-wrap">
                {/* Header */}
                <div className="border-b bg-card rounded-t-xl -mx-4 md:-mx-6">
                    <div className="w-full px-3 sm:px-4 py-3 sm:py-3.5 md:px-6 lg:px-6 iphone-landscape-portfolio-header-content">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 iphone-landscape-portfolio-header-row">
                            <div className="flex items-center gap-2.5 sm:gap-3 pl-12 xl:pl-0 min-h-[38px] iphone-landscape-portfolio-title-group">
                                <button
                                    onClick={() => window.history.length > 1 ? navigate(-1) : navigate('/')}
                                    className="flex items-center justify-center p-2 rounded-xl bg-card border border-border text-foreground hover:bg-accent transition-all shadow-sm active:scale-95 shrink-0 group"
                                    title="Zurück"
                                    aria-label="Zurück"
                                >
                                    <ArrowLeft className="size-5 transition-transform group-hover:-translate-x-0.5" />
                                </button>
                                <div className="p-2 sm:p-3 rounded-xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20 text-blue-600 dark:text-blue-400 shrink-0 iphone-landscape-portfolio-icon">
                                    <Eye className="size-5 sm:size-6" />
                                </div>
                                <div>
                                    <h1 className="text-2xl sm:text-3xl font-bold tracking-tight iphone-landscape-portfolio-title">Watchlist</h1>
                                    <p className="text-muted-foreground hidden md:block iphone-landscape-portfolio-subtitle">Aktien beobachten und Dividenden prüfen</p>
                                </div>
                            </div>

                            <div className="flex items-center justify-center sm:justify-end gap-2 w-full sm:w-auto sm:ml-auto iphone-landscape-portfolio-actions">
                                <button
                                    onClick={() => setIsPerformanceModalOpen(true)}
                                    className="flex items-center justify-center gap-2 bg-secondary text-secondary-foreground px-3.5 sm:px-4 py-2 rounded-lg hover:bg-secondary/90 transition-colors font-medium border border-border shadow-sm whitespace-nowrap"
                                >
                                    <TrendingUp className="size-4 text-blue-500 shrink-0" />
                                    <span>Details</span>
                                </button>
                                {/* Global Refresh Button */}
                                <button
                                    onClick={() => refreshAllPrices(true)}
                                    disabled={isGlobalRefreshing}
                                    className={cn(
                                        "flex items-center justify-center gap-2 px-3.5 sm:px-4 py-2 rounded-lg border font-medium transition-all shadow-sm shrink-0",
                                        "bg-blue-600 text-white border-blue-700 hover:bg-blue-700 hover:border-blue-800",
                                        "active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                                    )}
                                    title="Preise jetzt aktualisieren"
                                >
                                    <RefreshCw className={cn("size-4", isGlobalRefreshing && "animate-spin")} />
                                    <span className="hidden md:inline">
                                        {isGlobalRefreshing
                                            ? 'Aktualisiere...'
                                            : lastGlobalRefresh
                                                ? `Vor ${Math.floor((new Date().getTime() - lastGlobalRefresh.getTime()) / 60000)} Min`
                                                : 'Aktualisieren'}
                                    </span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Watchlist Tabs */}
                <div className="-mx-4 md:-mx-6 px-4 md:px-6 pt-1.5 pb-2 mt-2 overflow-x-auto bg-background shrink-0 iphone-landscape-portfolio-subtabs">
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
                                        className="absolute top-0.5 -right-1 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity shadow-sm z-10 flex items-center justify-center"
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
                            className="p-2 iphone-landscape-pill-icon rounded-full bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors border border-border"
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
                                className="p-2 ml-2 iphone-landscape-pill-icon rounded-full text-muted-foreground hover:bg-accent transition-colors"
                                title="Liste umbenennen"
                            >
                                <Edit className="size-4" />
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Sub-Tabs: Switches between the active sections of this list */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 shrink-0 iphone-landscape-portfolio-subtabs">
                {subTabs.map((tab) => {
                    const Icon = tab.icon;
                    const isActive = activeSubTab === tab.id;
                    return (
                        <button
                            key={tab.id}
                            onClick={() => setActiveSubTab(tab.id)}
                            className={cn(
                                "flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs md:text-sm font-semibold transition-all border shadow-sm shrink-0",
                                isActive
                                    ? "bg-primary text-primary-foreground border-primary"
                                    : "bg-card text-muted-foreground border-border hover:bg-accent hover:text-foreground"
                            )}
                        >
                            <Icon className="size-4" />
                            <span>{tab.label}</span>
                            <span className={cn(
                                "text-xs px-1.5 py-0.5 rounded-full font-mono",
                                isActive ? "bg-primary-foreground/20 text-primary-foreground" : "bg-muted text-muted-foreground"
                            )}>
                                {tab.count}
                            </span>
                        </button>
                    );
                })}
                <button
                    onClick={() => {
                        navigate('/calculator?mode=new&from=watchlist');
                    }}
                    className="ml-auto flex items-center justify-center gap-2 bg-primary text-primary-foreground px-3.5 py-1.5 rounded-lg text-xs md:text-sm hover:bg-primary/90 transition-colors font-semibold border border-primary shadow-sm whitespace-nowrap shrink-0 iphone-subtab-right"
                >
                    <Plus className="size-4 shrink-0" />
                    <span>Hinzufügen</span>
                </button>
            </div>

            {/* Table card fills flex-1 min-h-0 */}
            <div className="flex-1 min-h-0 flex flex-col rounded-xl border border-border bg-card shadow-sm overflow-hidden">
                {/* Header / Legend Bar */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between p-2.5 sm:p-3 border-b bg-muted/20 shrink-0 gap-2">
                    <div className="flex items-center gap-2">
                        {currentTab?.icon && <currentTab.icon className="size-4 text-primary" />}
                        <h2 className="text-sm sm:text-base font-bold">{currentTab?.label}</h2>
                        <span className="text-xs font-mono bg-muted px-2 py-0.5 rounded-full text-muted-foreground">{currentTabStocks.length}</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] sm:text-xs font-medium text-muted-foreground bg-background/50 px-2.5 py-1 rounded-lg border border-border/50">
                        <span className="hidden sm:inline">Legende:</span>
                        <div className="flex items-center gap-1 text-green-600 dark:text-green-400">
                            <div className="size-2 rounded-full bg-green-500 animate-pulse" />
                            <span className="font-bold">KAUFEN</span>
                            <span className="text-muted-foreground hidden md:inline">Kurs &lt; Limit</span>
                        </div>
                        <div className="w-px h-3 bg-border hidden sm:block" />
                        <div className="flex items-center gap-1 text-red-500">
                            <div className="size-2 rounded-full bg-red-500" />
                            <span className="font-bold">KEINE INFO</span>
                            <span className="text-muted-foreground hidden md:inline">Limit fehlt</span>
                        </div>
                    </div>
                </div>

                {/* Watchlist Table */}
                <WatchlistTable
                    stocks={currentTabStocks}
                    sortConfig={sortConfig}
                    setSortConfig={setSortConfig}
                    onNavigate={(id) => navigate(`/stock/${id}?from=watchlist`)}
                    onBuy={(stock) => handleBuy(stock)}
                    onEdit={(id) => navigate(`/stock/${id}?from=watchlist`)}
                    onRemove={(id) => removeFromWatchlist(id, activeWatchlistId)}
                    formatCurrency={formatCurrency}
                    emptyMessage="Keine Positionen in dieser Ansicht."
                />
            </div>


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
                    activeWatchlistId={activeWatchlistId}
                />

                {/* EditPositionModal for editing owned stocks from watchlist */}
                {editPosition && (
                    <EditPositionModal
                        isOpen={!!editPosition}
                        onClose={() => setEditPosition(null)}
                        position={editPosition}
                        onUpdate={(id, newShares, newAvgPrice, newBuyDate, newFxRate, newPurchases, newBroker) => {
                            updatePosition(id, {
                                shares: newShares,
                                buyPriceAvg: newAvgPrice,
                                buyDate: newBuyDate,
                                averageEntryFxRate: newFxRate,
                                purchases: newPurchases,
                                broker: newBroker
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
    emptyMessage
}: WatchlistTableProps) {
    // 0: [Div. Rendite, Aktueller Kurs], 1: [Kauflimit, Verkaufslimit], 2: [EX-Tag, Zahl-Tag], 3: [Aktionen]
    const [mobilePage, setMobilePage] = useState(0);
    const touchStartRef = useRef<{ x: number; y: number; time: number; isStockCol: boolean } | null>(null);

    const handleSort = (key: string) => {
        setSortConfig((prev: any) => {
            const isSameKey = prev.key === key;
            const defaultDir = (key === 'gap' || key === 'sellGap') ? 'asc' : 'desc';
            let newDir: 'asc' | 'desc';
            if (!isSameKey) {
                newDir = defaultDir;
            } else {
                newDir = prev.direction === 'desc' ? 'asc' : 'desc';
            }
            return { key, direction: newDir };
        });
    };

    const sortedStocks = useMemo(() => {
        return [...stocks].sort((a, b) => {
            if (sortConfig.key === 'name') {
                return sortConfig.direction === 'asc'
                    ? a.name.localeCompare(b.name)
                    : b.name.localeCompare(a.name);
            }
            if (sortConfig.key === 'yield') {
                const yieldA = (a.dividendYield !== undefined && a.dividendYield !== null) ? a.dividendYield : -999999;
                const yieldB = (b.dividendYield !== undefined && b.dividendYield !== null) ? b.dividendYield : -999999;
                return sortConfig.direction === 'asc' ? yieldA - yieldB : yieldB - yieldA;
            }
            if (sortConfig.key === 'price') {
                const priceA = a.previousClose ? ((a.currentPrice - a.previousClose) / a.previousClose) * 100 : 0;
                const priceB = b.previousClose ? ((b.currentPrice - b.previousClose) / b.previousClose) * 100 : 0;
                return sortConfig.direction === 'asc' ? priceA - priceB : priceB - priceA;
            }
            if (sortConfig.key === 'gap') {
                const targetA = a.targetPrice || 0;
                const targetB = b.targetPrice || 0;
                if (!targetA && !targetB) return 0;
                if (!targetA) return 1;
                if (!targetB) return -1;
                const gapA = (a.currentPrice - targetA) / targetA;
                const gapB = (b.currentPrice - targetB) / targetB;
                return sortConfig.direction === 'asc' ? gapA - gapB : gapB - gapA;
            }
            if (sortConfig.key === 'sellGap') {
                const sellA = a.sellLimit || 0;
                const sellB = b.sellLimit || 0;
                if (!sellA && !sellB) return 0;
                if (!sellA) return 1;
                if (!sellB) return -1;
                const gapA = (a.currentPrice - sellA) / sellA;
                const gapB = (b.currentPrice - sellB) / sellB;
                return sortConfig.direction === 'asc' ? gapA - gapB : gapB - gapA;
            }
            return 0;
        });
    }, [stocks, sortConfig]);

    if (stocks.length === 0) {
        return (
            <div className="flex-1 min-h-0 flex flex-col items-center justify-center p-12 text-center text-muted-foreground">
                <ShoppingBag className="size-12 opacity-20 mb-2" />
                <p>{emptyMessage}</p>
            </div>
        );
    }

    const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
        const touch = e.touches[0];
        const isHeaderOrInteractive = !!(e.target as HTMLElement)?.closest('thead, button, a, input, select');
        const isStockCol = !!(e.target as HTMLElement)?.closest('th:first-child, td:first-child');
        touchStartRef.current = {
            x: touch.clientX,
            y: touch.clientY,
            time: Date.now(),
            isStockCol: isStockCol || isHeaderOrInteractive
        };
    };

    const handleTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
        if (!touchStartRef.current || touchStartRef.current.isStockCol) {
            touchStartRef.current = null;
            return;
        }
        const touch = e.changedTouches[0];
        const dx = touch.clientX - touchStartRef.current.x;
        const dy = touch.clientY - touchStartRef.current.y;
        const dt = Date.now() - touchStartRef.current.time;

        // Horizontal swipe: only when touch started to the right of the "Aktie" column (> 140px)
        if (touchStartRef.current.x > 140 && Math.abs(dx) > 35 && Math.abs(dx) > Math.abs(dy) * 1.2 && dt < 700) {
            if (dx < 0) {
                // Swiped left -> next page
                setMobilePage((p) => Math.min(3, p + 1));
            } else {
                // Swiped right -> prev page
                setMobilePage((p) => Math.max(0, p - 1));
            }
        }
        touchStartRef.current = null;
    };

    return (
        <div
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            className="overflow-y-auto overflow-x-hidden xl:overflow-x-auto flex-1 min-h-0 p-0 w-full snap-y snap-mandatory scroll-pt-[48px] xl:snap-none xl:scroll-pt-0"
        >
            <table className="w-full text-xs xl:text-sm border-collapse table-fixed xl:table-auto">
                <thead>
                    <tr className="border-b bg-muted/20">
                        {/* 0. Aktie */}
                        <th className="px-3 xl:px-4 py-0 xl:py-2 h-12 xl:h-auto font-semibold text-foreground xl:text-muted-foreground text-[15px] xl:text-xs uppercase tracking-wider sticky top-0 left-0 z-40 bg-card shadow-[5px_0_5px_-5px_rgba(0,0,0,0.1)] w-[170px] sm:w-[240px] md:w-[260px] min-w-[170px] sm:min-w-[240px] md:min-w-[260px] max-w-[170px] sm:max-w-[240px] md:max-w-[260px] xl:w-[200px] xl:min-w-[200px] xl:max-w-[200px] touch-pan-y align-middle">
                            <button
                                type="button"
                                onClick={() => handleSort('name')}
                                className="flex items-center gap-1 hover:text-foreground text-inherit cursor-pointer select-none text-left"
                            >
                                <span>Aktie</span>
                                {sortConfig.key === 'name' && (
                                    <span className="font-bold text-sm">
                                        {sortConfig.direction === 'asc' ? '↑' : '↓'}
                                    </span>
                                )}
                            </button>
                        </th>

                        {/* 1. Div. Rendite */}
                        <th
                            className={cn(
                                "px-1 xl:px-4 py-0 xl:py-2 h-12 xl:h-auto font-semibold text-foreground xl:text-muted-foreground text-[13px] xl:text-xs uppercase tracking-wider text-center xl:text-right sticky top-0 z-30 bg-card w-1/2 xl:w-[10%] align-middle",
                                mobilePage === 0 ? "table-cell" : "hidden xl:table-cell"
                            )}
                        >
                            <div className="flex xl:hidden items-center justify-center w-full h-12 px-1 relative">
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        setMobilePage((p) => Math.max(0, p - 1));
                                    }}
                                    disabled={mobilePage === 0}
                                    className="absolute left-1 size-8 sm:size-9 flex items-center justify-center rounded-lg bg-muted/40 hover:bg-muted active:bg-muted/70 text-muted-foreground hover:text-foreground active:text-foreground disabled:opacity-20 transition-colors shrink-0 cursor-pointer"
                                    title="Vorherige Spalten"
                                    aria-label="Vorherige Spalten"
                                >
                                    <ChevronLeft className="size-4 pointer-events-none text-muted-foreground" />
                                </button>
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        handleSort('yield');
                                    }}
                                    className="flex items-center justify-center gap-1 px-1.5 py-1 rounded-md text-foreground hover:bg-muted active:bg-muted/70 transition-colors cursor-pointer select-none font-semibold text-xs sm:text-[13px] truncate"
                                >
                                    <span className="truncate">Div. Rendite</span>
                                    {sortConfig.key === 'yield' && (
                                        <span className="font-bold text-sm text-primary shrink-0">
                                            {sortConfig.direction === 'desc' ? '↓' : '↑'}
                                        </span>
                                    )}
                                </button>
                            </div>
                            <button
                                type="button"
                                onClick={() => handleSort('yield')}
                                className="hidden xl:inline-flex items-center gap-1 hover:text-foreground cursor-pointer select-none text-inherit uppercase"
                            >
                                <span>Div. Rendite</span>
                                {sortConfig.key === 'yield' && (
                                    <span className="font-bold text-xs">
                                        {sortConfig.direction === 'desc' ? '↓' : '↑'}
                                    </span>
                                )}
                            </button>
                        </th>

                        {/* 2. Aktueller Kurs */}
                        <th
                            className={cn(
                                "px-1 xl:px-4 py-0 xl:py-2 h-12 xl:h-auto font-semibold text-foreground xl:text-muted-foreground text-[13px] xl:text-xs uppercase tracking-wider text-center xl:text-right sticky top-0 z-30 bg-card w-1/2 xl:w-[15%] align-middle",
                                mobilePage === 0 ? "table-cell" : "hidden xl:table-cell"
                            )}
                        >
                            <div className="flex xl:hidden items-center justify-center w-full h-12 px-1 relative">
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        handleSort('price');
                                    }}
                                    className="flex items-center justify-center gap-1 px-1.5 py-1 rounded-md text-foreground hover:bg-muted active:bg-muted/70 transition-colors cursor-pointer select-none font-semibold text-xs sm:text-[13px] truncate"
                                >
                                    <span className="truncate">Aktueller Kurs</span>
                                    {sortConfig.key === 'price' && (
                                        <span className="font-bold text-sm text-primary shrink-0">
                                            {sortConfig.direction === 'desc' ? '↓' : '↑'}
                                        </span>
                                    )}
                                </button>
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        setMobilePage((p) => Math.min(3, p + 1));
                                    }}
                                    disabled={mobilePage === 3}
                                    className="absolute right-1 size-8 sm:size-9 flex items-center justify-center rounded-lg bg-muted/40 hover:bg-muted active:bg-muted/70 text-muted-foreground hover:text-foreground active:text-foreground disabled:opacity-20 transition-colors shrink-0 cursor-pointer"
                                    title="Nächste Spalten"
                                    aria-label="Nächste Spalten"
                                >
                                    <ChevronRight className="size-4 pointer-events-none text-muted-foreground" />
                                </button>
                            </div>
                            <button
                                type="button"
                                onClick={() => handleSort('price')}
                                className="hidden xl:inline-flex items-center gap-1 hover:text-foreground cursor-pointer select-none text-inherit uppercase"
                            >
                                <span>Aktueller Kurs</span>
                                {sortConfig.key === 'price' && (
                                    <span className="font-bold text-xs">
                                        {sortConfig.direction === 'desc' ? '↓' : '↑'}
                                    </span>
                                )}
                            </button>
                        </th>

                        {/* 3. Kauflimit */}
                        <th
                            className={cn(
                                "px-1 xl:px-4 py-0 xl:py-2 h-12 xl:h-auto font-semibold text-foreground xl:text-muted-foreground text-[13px] xl:text-xs uppercase tracking-wider text-center xl:text-right sticky top-0 z-30 bg-card w-1/2 xl:w-[15%] align-middle",
                                mobilePage === 1 ? "table-cell" : "hidden xl:table-cell"
                            )}
                        >
                            <div className="flex xl:hidden items-center justify-center w-full h-12 px-1 relative">
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        setMobilePage((p) => Math.max(0, p - 1));
                                    }}
                                    disabled={mobilePage === 0}
                                    className="absolute left-1 size-8 sm:size-9 flex items-center justify-center rounded-lg bg-muted/40 hover:bg-muted active:bg-muted/70 text-muted-foreground hover:text-foreground active:text-foreground disabled:opacity-20 transition-colors shrink-0 cursor-pointer"
                                    title="Vorherige Spalten"
                                    aria-label="Vorherige Spalten"
                                >
                                    <ChevronLeft className="size-4 pointer-events-none text-muted-foreground" />
                                </button>
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        handleSort('gap');
                                    }}
                                    className="flex items-center justify-center gap-1 px-1.5 py-1 rounded-md text-foreground hover:bg-muted active:bg-muted/70 transition-colors cursor-pointer select-none font-semibold text-xs sm:text-[13px] truncate"
                                >
                                    <span className="truncate">Kauflimit</span>
                                    {sortConfig.key === 'gap' && (
                                        <span className="font-bold text-sm text-primary shrink-0">
                                            {sortConfig.direction === 'asc' ? '↓' : '↑'}
                                        </span>
                                    )}
                                </button>
                            </div>
                            <button
                                type="button"
                                onClick={() => handleSort('gap')}
                                className="hidden xl:inline-flex items-center gap-1 hover:text-foreground cursor-pointer select-none text-inherit uppercase"
                            >
                                <span>Kauflimit</span>
                                {sortConfig.key === 'gap' && (
                                    <span className="font-bold text-xs">
                                        {sortConfig.direction === 'asc' ? '↓' : '↑'}
                                    </span>
                                )}
                            </button>
                        </th>

                        {/* 4. Verkaufslimit */}
                        <th
                            className={cn(
                                "px-1 xl:px-4 py-0 xl:py-2 h-12 xl:h-auto font-semibold text-foreground xl:text-muted-foreground text-[13px] xl:text-xs uppercase tracking-wider text-center xl:text-right sticky top-0 z-30 bg-card w-1/2 xl:w-[10%] align-middle",
                                mobilePage === 1 ? "table-cell" : "hidden xl:table-cell"
                            )}
                        >
                            <div className="flex xl:hidden items-center justify-center w-full h-12 px-1 relative">
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        handleSort('sellGap');
                                    }}
                                    className="flex items-center justify-center gap-1 px-1.5 py-1 rounded-md text-foreground hover:bg-muted active:bg-muted/70 transition-colors cursor-pointer select-none font-semibold text-xs sm:text-[13px] truncate"
                                >
                                    <span className="truncate">Verkaufslimit</span>
                                    {sortConfig.key === 'sellGap' && (
                                        <span className="font-bold text-sm text-primary shrink-0">
                                            {sortConfig.direction === 'asc' ? '↓' : '↑'}
                                        </span>
                                    )}
                                </button>
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        setMobilePage((p) => Math.min(3, p + 1));
                                    }}
                                    disabled={mobilePage === 3}
                                    className="absolute right-1 size-8 sm:size-9 flex items-center justify-center rounded-lg bg-muted/40 hover:bg-muted active:bg-muted/70 text-muted-foreground hover:text-foreground active:text-foreground disabled:opacity-20 transition-colors shrink-0 cursor-pointer"
                                    title="Nächste Spalten"
                                    aria-label="Nächste Spalten"
                                >
                                    <ChevronRight className="size-4 pointer-events-none text-muted-foreground" />
                                </button>
                            </div>
                            <button
                                type="button"
                                onClick={() => handleSort('sellGap')}
                                className="hidden xl:inline-flex items-center gap-1 hover:text-foreground cursor-pointer select-none text-inherit uppercase"
                            >
                                <span>Verkaufslimit</span>
                                {sortConfig.key === 'sellGap' && (
                                    <span className="font-bold text-xs">
                                        {sortConfig.direction === 'asc' ? '↓' : '↑'}
                                    </span>
                                )}
                            </button>
                        </th>

                        {/* 5. EX-Tag */}
                        <th
                            className={cn(
                                "px-1 xl:px-4 py-0 xl:py-2 h-12 xl:h-auto font-semibold text-foreground xl:text-muted-foreground text-[13px] xl:text-xs uppercase tracking-wider text-center xl:text-right sticky top-0 z-30 bg-card w-1/2 xl:w-[10%] align-middle",
                                mobilePage === 2 ? "table-cell" : "hidden xl:table-cell"
                            )}
                        >
                            <div className="flex xl:hidden items-center justify-center w-full h-12 px-1 relative">
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        setMobilePage((p) => Math.max(0, p - 1));
                                    }}
                                    disabled={mobilePage === 0}
                                    className="absolute left-1 size-8 sm:size-9 flex items-center justify-center rounded-lg bg-muted/40 hover:bg-muted active:bg-muted/70 text-muted-foreground hover:text-foreground active:text-foreground disabled:opacity-20 transition-colors shrink-0 cursor-pointer"
                                    title="Vorherige Spalten"
                                    aria-label="Vorherige Spalten"
                                >
                                    <ChevronLeft className="size-4 pointer-events-none text-muted-foreground" />
                                </button>
                                <span className="whitespace-nowrap text-center px-1.5 select-none font-semibold text-xs sm:text-[13px] text-foreground truncate">
                                    EX-Tag
                                </span>
                            </div>
                            <span className="hidden xl:inline">EX-Tag</span>
                        </th>

                        {/* 6. Zahl-Tag */}
                        <th
                            className={cn(
                                "px-1 xl:px-4 py-0 xl:py-2 h-12 xl:h-auto font-semibold text-foreground xl:text-muted-foreground text-[13px] xl:text-xs uppercase tracking-wider text-center xl:text-right sticky top-0 z-30 bg-card w-1/2 xl:w-[10%] align-middle",
                                mobilePage === 2 ? "table-cell" : "hidden xl:table-cell"
                            )}
                        >
                            <div className="flex xl:hidden items-center justify-center w-full h-12 px-1 relative">
                                <span className="whitespace-nowrap text-center px-1.5 select-none font-semibold text-xs sm:text-[13px] text-foreground truncate">
                                    Zahl-Tag
                                </span>
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        setMobilePage((p) => Math.min(3, p + 1));
                                    }}
                                    disabled={mobilePage === 3}
                                    className="absolute right-1 size-8 sm:size-9 flex items-center justify-center rounded-lg bg-muted/40 hover:bg-muted active:bg-muted/70 text-muted-foreground hover:text-foreground active:text-foreground disabled:opacity-20 transition-colors shrink-0 cursor-pointer"
                                    title="Nächste Spalten"
                                    aria-label="Nächste Spalten"
                                >
                                    <ChevronRight className="size-4 pointer-events-none text-muted-foreground" />
                                </button>
                            </div>
                            <span className="hidden xl:inline">Zahl-Tag</span>
                        </th>

                        {/* 7. Aktionen */}
                        <th
                            className={cn(
                                "px-1 xl:px-4 xl:pl-12 py-0 xl:py-2 h-12 xl:h-auto font-semibold text-foreground xl:text-muted-foreground text-[13px] xl:text-xs uppercase tracking-wider text-center w-full xl:w-[110px] sticky top-0 xl:sticky xl:-right-px xl:z-40 bg-card xl:shadow-[-5px_0_5px_-5px_rgba(0,0,0,0.1)] z-30 align-middle",
                                mobilePage === 3 ? "table-cell" : "hidden xl:table-cell"
                            )}
                        >
                            <div className="flex xl:hidden items-center justify-center gap-3 w-full h-12 px-2">
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        setMobilePage((p) => Math.max(0, p - 1));
                                    }}
                                    disabled={mobilePage === 0}
                                    className="size-8 sm:size-9 flex items-center justify-center rounded-lg bg-muted/40 hover:bg-muted active:bg-muted/70 text-muted-foreground hover:text-foreground active:text-foreground disabled:opacity-20 transition-colors shrink-0 cursor-pointer"
                                    title="Vorherige Spalten"
                                    aria-label="Vorherige Spalten"
                                >
                                    <ChevronLeft className="size-4 pointer-events-none text-muted-foreground" />
                                </button>
                                <span className="whitespace-nowrap text-center px-2 select-none font-semibold text-xs sm:text-[13px] text-foreground">
                                    Aktionen
                                </span>
                                <button
                                    type="button"
                                    disabled={true}
                                    className="size-8 sm:size-9 flex items-center justify-center rounded-lg bg-muted/40 text-muted-foreground opacity-20 shrink-0 cursor-not-allowed"
                                    title="Nächste Spalten"
                                    aria-label="Nächste Spalten"
                                >
                                    <ChevronRight className="size-4 pointer-events-none text-muted-foreground" />
                                </button>
                            </div>
                            <span className="hidden xl:inline">Aktionen</span>
                        </th>
                    </tr>
                </thead>
                <tbody className="divide-y">
                    {sortedStocks.map((stock) => {
                        const currentDiv = getCurrentDividendPeriod(stock);

                        const isUnderTarget = stock.targetPrice && stock.currentPrice <= stock.targetPrice;
                        const isOverSell = stock.sellLimit && stock.currentPrice >= stock.sellLimit;
                        const stockChange = stock.previousClose ? ((stock.currentPrice - stock.previousClose) / stock.previousClose) * 100 : 0;
                        const calcState = estimateMarketState(stock.symbol, stock.currency);
                        const isMarketOpen = calcState === 'REGULAR';

                        return (
                            <tr key={stock.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors group snap-start snap-always h-[60px] xl:h-auto">
                                <td className="px-3 py-1.5 xl:p-4 h-[60px] xl:h-auto sticky left-0 z-20 group-hover:bg-muted/30 transition-colors shadow-[5px_0_5px_-5px_rgba(0,0,0,0.1)] overflow-hidden w-[160px] sm:w-[220px] md:w-[250px] min-w-[160px] sm:min-w-[220px] md:min-w-[250px] max-w-[160px] sm:max-w-[220px] md:max-w-[250px] xl:w-[200px] xl:min-w-[200px] xl:max-w-[200px] touch-pan-y align-middle">
                                    <div className="absolute inset-0 bg-card -z-10" />
                                    <div className="flex items-center gap-2 xl:gap-3 relative">
                                        <Logo
                                            url={stock.logoUrl}
                                            alt={stock.name}
                                            fallback={stock.symbol.slice(0, 2)}
                                            size="size-8 xl:size-10"
                                        />
                                        <div className="flex flex-col min-w-0 flex-1 justify-center">
                                            <span
                                                className="font-bold text-[13px] xl:text-sm truncate block group-hover:text-primary transition-colors cursor-pointer"
                                                onClick={() => onNavigate(stock.id)}
                                                title={stock.name}
                                            >
                                                {stock.name}
                                            </span>
                                            <div className="flex items-center gap-1.5 mt-0.5">
                                                <span className="text-xs font-semibold text-foreground/80 uppercase truncate">{stock.symbol}</span>
                                                {stock.sector && stock.sector !== 'Simuliert' && (
                                                    <>
                                                        <span className="text-muted-foreground/40 text-[10px]">•</span>
                                                        <span className="text-xs text-muted-foreground truncate">{translateSector(stock.sector)}</span>
                                                    </>
                                                )}
                                                {isMarketOpen ? (
                                                    <div className="size-2 rounded-full bg-green-500 animate-pulse shrink-0 shadow-[0_0_8px_rgba(34,197,94,0.5)] border border-background" title={`Markt geöffnet (${calcState})`} />
                                                ) : (
                                                    <div className="size-2 rounded-full bg-red-500 shrink-0 border border-background" title={`Markt geschlossen (${calcState})`} />
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </td>
                                <td className={cn("px-2 xl:p-4 h-[60px] xl:h-auto text-center xl:text-right align-middle", mobilePage === 0 ? "table-cell" : "hidden xl:table-cell")}>
                                    <div className="flex flex-col items-center xl:items-end justify-center gap-0.5">
                                        <span className="font-bold text-sm xl:text-sm text-green-600 dark:text-green-400 leading-tight">
                                            {stock.dividendYield ? `${stock.dividendYield.toFixed(2)}%` : '-'}
                                        </span>
                                        <span className="text-[11px] text-muted-foreground uppercase tracking-tight leading-tight">
                                            {translateFrequency(stock.dividendFrequency)}
                                        </span>
                                    </div>
                                </td>
                                <td className={cn("px-2 xl:p-4 h-[60px] xl:h-auto text-center xl:text-right align-middle", mobilePage === 0 ? "table-cell" : "hidden xl:table-cell")}>
                                    <div className="flex flex-col items-center xl:items-end justify-center gap-0.5">
                                        <span className="font-bold text-[15px] xl:text-sm text-foreground whitespace-nowrap leading-tight">
                                            {formatCurrency(stock.currentPrice, stock.currency, false)}
                                        </span>
                                        {stock.previousClose !== undefined && (
                                            <span className={cn(
                                                "text-xs font-bold px-1.5 py-0.5 rounded leading-tight whitespace-nowrap",
                                                stockChange >= 0
                                                    ? "bg-green-500/15 text-green-600 dark:text-green-400"
                                                    : "bg-red-500/15 text-red-600 dark:text-red-400"
                                            )}>
                                                {stockChange >= 0 ? '+' : ''}{stockChange.toFixed(2)}%
                                            </span>
                                        )}
                                    </div>
                                </td>
                                <td className={cn("px-2 xl:p-4 h-[60px] xl:h-auto text-center xl:text-right align-middle", mobilePage === 1 ? "table-cell" : "hidden xl:table-cell")}>
                                    <div className="flex flex-col items-center xl:items-end justify-center gap-0.5">
                                        <div className="flex items-center gap-1.5">
                                            {isUnderTarget && (
                                                <div className="size-2 rounded-full bg-green-500 animate-pulse shrink-0" title="Limit erreicht!" />
                                            )}
                                            <span className={cn(
                                                "font-bold text-[15px] xl:text-sm whitespace-nowrap leading-tight",
                                                isUnderTarget ? "text-green-600 dark:text-green-400" : "text-foreground"
                                            )}>
                                                {stock.targetPrice ? formatCurrency(stock.targetPrice, stock.currency, false) : '-'}
                                            </span>
                                        </div>
                                        {stock.targetPrice ? (() => {
                                            const buyGap = ((stock.currentPrice - stock.targetPrice) / stock.targetPrice * 100);
                                            const isReached = buyGap <= 0;
                                            return (
                                                <span className={cn(
                                                    "text-xs font-semibold whitespace-nowrap leading-tight",
                                                    isReached ? "text-green-600 dark:text-green-400 font-bold" : "text-red-500 dark:text-red-400"
                                                )}>
                                                    Gap: {buyGap > 0 ? '+' : ''}{buyGap.toFixed(1)}%
                                                </span>
                                            );
                                        })() : null}
                                    </div>
                                </td>
                                <td className={cn("px-2 xl:p-4 h-[60px] xl:h-auto text-center xl:text-right align-middle", mobilePage === 1 ? "table-cell" : "hidden xl:table-cell")}>
                                    <div className="flex flex-col items-center xl:items-end justify-center gap-0.5">
                                        <div className="flex items-center gap-1.5">
                                            {isOverSell && (
                                                <div className="size-2.5 rounded-full bg-green-500 animate-pulse shrink-0" title="Verkaufslimit erreicht!" />
                                            )}
                                            <span className={cn(
                                                "font-bold text-[15px] xl:text-sm whitespace-nowrap leading-tight",
                                                isOverSell ? "text-green-600 dark:text-green-400" : "text-foreground"
                                            )}>
                                                {stock.sellLimit ? formatCurrency(stock.sellLimit, stock.currency, false) : '-'}
                                            </span>
                                        </div>
                                        {stock.sellLimit ? (() => {
                                            const sellGap = ((stock.currentPrice - stock.sellLimit) / stock.sellLimit * 100);
                                            const isReached = sellGap >= 0;
                                            return (
                                                <span className={cn(
                                                    "text-xs font-semibold whitespace-nowrap leading-tight",
                                                    isReached ? "text-green-600 dark:text-green-400 font-bold" : "text-muted-foreground"
                                                )}>
                                                    Gap: {sellGap > 0 ? '+' : ''}{sellGap.toFixed(1)}%
                                                </span>
                                            );
                                        })() : null}
                                    </div>
                                </td>
                                <td className={cn("px-2 xl:p-4 h-[60px] xl:h-auto text-center xl:text-right align-middle", mobilePage === 2 ? "table-cell" : "hidden xl:table-cell")}>
                                    <div className="flex flex-col items-center xl:items-end justify-center gap-0.5">
                                        <span className={cn(
                                            "font-bold text-[15px] xl:text-sm whitespace-nowrap leading-tight",
                                            (() => {
                                                const dDays = currentDiv.exDate ? Math.ceil((new Date(currentDiv.exDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)) : null;
                                                if (dDays !== null && dDays < 0) return "text-red-500 dark:text-red-400 font-medium";
                                                if (dDays !== null && dDays >= 0 && dDays <= 14) return "text-orange-500 font-medium";
                                                if (dDays !== null && dDays > 14) return "text-green-600 dark:text-green-400 font-medium";
                                                return "text-muted-foreground";
                                            })()
                                        )}>
                                            {currentDiv.exDate
                                                ? new Date(currentDiv.exDate).toLocaleDateString('de-CH', { day: '2-digit', month: '2-digit', year: '2-digit' })
                                                : '-'}
                                        </span>
                                        {currentDiv.status === 'ex-dividend' && (
                                            <span className="text-[11px] font-bold text-orange-500 bg-orange-100 dark:bg-orange-950/50 px-1.5 py-0.5 rounded leading-none uppercase">
                                                Ex-Div
                                            </span>
                                        )}
                                    </div>
                                </td>
                                <td className={cn("px-2 xl:p-4 h-[60px] xl:h-auto text-center xl:text-right align-middle", mobilePage === 2 ? "table-cell" : "hidden xl:table-cell")}>
                                    <div className="flex flex-col items-center xl:items-end justify-center gap-0.5">
                                        <span className={cn(
                                            "font-bold text-[15px] xl:text-sm whitespace-nowrap leading-tight",
                                            (() => {
                                                const payDays = currentDiv.payDate ? Math.ceil((new Date(currentDiv.payDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)) : null;
                                                const exDays = currentDiv.exDate ? Math.ceil((new Date(currentDiv.exDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)) : null;
                                                if (payDays !== null && payDays < 0) return "text-green-600 dark:text-green-400 font-medium";
                                                if (exDays !== null && exDays < 0 && payDays !== null && payDays >= 0) return "text-orange-500 font-medium";
                                                if (payDays !== null && payDays >= 0 && payDays <= 14) return "text-orange-500 font-medium";
                                                return "text-muted-foreground";
                                            })()
                                        )}>
                                            {currentDiv.payDate
                                                ? new Date(currentDiv.payDate).toLocaleDateString('de-CH', { day: '2-digit', month: '2-digit', year: '2-digit' })
                                                : '-'}
                                        </span>
                                        {currentDiv.status === 'paid' && (
                                            <span className="text-[11px] font-bold text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-950/50 px-1.5 py-0.5 rounded leading-none uppercase">
                                                Bezahlt
                                            </span>
                                        )}
                                    </div>
                                </td>
                                <td className={cn("px-2 xl:p-4 h-[60px] xl:h-auto text-center xl:pl-12 xl:sticky xl:-right-px z-10 group-hover:bg-muted/30 transition-colors xl:shadow-[-5px_0_5px_-5px_rgba(0,0,0,0.1)] align-middle", mobilePage === 3 ? "table-cell" : "hidden xl:table-cell")}>
                                    <div className="absolute inset-0 bg-card -z-10" />
                                    <div className="flex items-center justify-center gap-1.5 relative">
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onBuy(stock);
                                            }}
                                            className="p-1.5 text-green-600 bg-green-500/10 hover:bg-green-500/20 rounded-lg transition-colors"
                                            title="Kaufen"
                                        >
                                            <ShoppingBag className="size-4" />
                                        </button>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onEdit(stock.id);
                                            }}
                                            className="p-1.5 text-blue-600 bg-blue-500/10 hover:bg-blue-500/20 rounded-lg transition-colors"
                                            title="Bearbeiten"
                                        >
                                            <Edit className="size-4" />
                                        </button>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onRemove(stock.id);
                                            }}
                                            className="p-1.5 text-red-500 bg-red-500/10 hover:bg-red-500/20 rounded-lg transition-colors"
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
    </div>
);
}
