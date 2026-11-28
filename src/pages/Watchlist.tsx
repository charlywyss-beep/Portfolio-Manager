import { StockName } from '../components/StockName';
import { useState, useEffect, useRef, useMemo } from 'react';
import { usePortfolio } from '../context/PortfolioContext';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { useCurrencyFormatter } from '../utils/currency';

import { getCurrentDividendPeriod, translateFrequency } from '../utils/dividend';
import { LandscapeBackButton } from '../components/LandscapeBackButton';
import { Eye, Plus, Trash2, Edit, ShoppingBag, RefreshCw, TrendingUp, ChevronRight, ChevronLeft, PieChart, Trophy, Clock, ArrowUpDown, ClipboardList, Star } from 'lucide-react';

import { Logo } from '../components/Logo';
import { cn } from '../utils';
import { estimateMarketState } from '../utils/market';
import { translateSector } from '../utils/sectorTranslation';
import { isEtfAsset } from '../utils/fairValue';

import { AddPositionModal } from '../components/AddPositionModal'; // Import AddPositionModal
import { EditPositionModal } from '../components/EditPositionModal';
import { AddToWatchlistModal } from '../components/AddToWatchlistModal';
import { WatchlistPerformanceModal, type WatchlistPeriod } from '../components/WatchlistPerformanceModal';
import { WatchlistReorderModal, type WatchlistTabItem } from '../components/WatchlistReorderModal';
import { OrderBookModal } from '../components/OrderBookModal';
import type { Stock, OrderBookEntry } from '../types';

export function Watchlist() {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const {
        stocks,
        watchlists,
        positions,
        orderBook,
        removeFromWatchlist,
        addPosition,
        updatePosition,
        deletePosition,
        lastGlobalRefresh,
        isGlobalRefreshing,
        refreshAllPrices,
        refreshTick,
        createWatchlist,
        deleteWatchlist,
        renameWatchlist,
        updateStock,
        deleteOrderBookEntry
    } = usePortfolio();
    const { formatCurrency } = useCurrencyFormatter();
    const [buyStock, setBuyStock] = useState<Stock | null>(null); // State for buying stock
    const [editPosition, setEditPosition] = useState<any>(null); // State for editing position
    const [assignWatchlistStockId, setAssignWatchlistStockId] = useState<string | null>(null);
    const [isPerformanceModalOpen, setIsPerformanceModalOpen] = useState(false);

    useEffect(() => {
        if (searchParams.get('openPerformance') === 'true') {
            setIsPerformanceModalOpen(true);
            const next = new URLSearchParams(searchParams);
            next.delete('openPerformance');
            setSearchParams(next, { replace: true });
        }
    }, [searchParams, setSearchParams]);
    const [modalInitialPeriod, setModalInitialPeriod] = useState<WatchlistPeriod>('1D');
    const [isReorderModalOpen, setIsReorderModalOpen] = useState(false);
    const [isOrderBookModalOpen, setIsOrderBookModalOpen] = useState(false);
    const [showAllLimits, setShowAllLimits] = useState(false);
    const [draggedTabId, setDraggedTabId] = useState<string | null>(null);
    const [dragOverTabId, setDragOverTabId] = useState<string | null>(null);

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
        // Skip if in 'owned' or 'orders' mode (virtual tabs)
        if (activeWatchlistId === 'owned' || activeWatchlistId === 'orders') return;

        // If current list was deleted, fallback to 'owned'
        if (watchlists.length > 0 && activeWatchlistId && !watchlists.find(w => w.id === activeWatchlistId)) {
            setActiveWatchlistId('owned');
        }
    }, [watchlists, activeWatchlistId]);

    const activeWatchlist = (activeWatchlistId === 'owned' || activeWatchlistId === 'orders')
        ? null
        : (watchlists.find(w => w.id === activeWatchlistId) || watchlists[0]);

    // Sorting
    const [sortConfig, setSortConfig] = useState<{ key: 'name' | 'yield' | 'gap' | 'sellGap' | 'price' | 'exDate' | 'payDate', direction: 'asc' | 'desc' }>({ key: 'name', direction: 'asc' });

    // Strictly direct portfolio positions (used for the "Bestand" tab & count so alias ETFs like VHYL.AS aren't duplicated)
    const directOwnedStockIds = useMemo(() => {
        return new Set(positions.filter(p => p.shares > 0).map(p => String(p.stockId)));
    }, [positions]);

    // Extended owned set (including same-ISIN / same-ETF-base-ticker listings) ONLY for the green "Bestand" badge in custom watchlists
    const ownedBadgeStockIds = useMemo(() => {
        const badgeIds = new Set(directOwnedStockIds);
        const ownedIsins = new Set<string>();
        const ownedEtfBaseSymbols = new Set<string>();

        positions.forEach(p => {
            if (!(p.shares > 0)) return;
            const st = stocks.find(s => String(s.id) === String(p.stockId));
            if (!st) return;
            if (st.isin) ownedIsins.add(st.isin.trim().toUpperCase());
            if (isEtfAsset(st) && st.symbol) {
                ownedEtfBaseSymbols.add(st.symbol.split('.')[0].toUpperCase());
            }
        });

        stocks.forEach(s => {
            if (badgeIds.has(String(s.id))) return;
            if (s.isin && ownedIsins.has(s.isin.trim().toUpperCase())) {
                badgeIds.add(String(s.id));
                return;
            }
            if (isEtfAsset(s) && s.symbol && ownedEtfBaseSymbols.has(s.symbol.split('.')[0].toUpperCase())) {
                badgeIds.add(String(s.id));
            }
        });
        return badgeIds;
    }, [directOwnedStockIds, positions, stocks]);

    // Open Orders from orderBook
    const openOrders = useMemo(() => {
        return (orderBook || []).filter(o => o.status === 'open');
    }, [orderBook]);

    // Orders Stocks List: collects ONLY stocks/ETFs that have an active open order in orderBook (or optionally all limits if toggled)
    const ordersStocksList = useMemo(() => {
        const list: Stock[] = [];
        const addedStockIds = new Set<string>();

        // 1. Stocks matching open orders in orderBook (strictly placed orders)
        openOrders.forEach(order => {
            // Prefer exact stockId or exact symbol match; only fall back to ISIN if currency matches too
            // (prevents e.g. an EUR order on EQQQ.DE from being hijacked by a USD listing EQQQ.SW with the same ISIN)
            const orderSymLower = (order.stockSymbol || '').toLowerCase();
            const orderCurUpper = (order.currency || '').toUpperCase();
            const found =
                (order.stockId ? stocks.find(s => s.id === order.stockId) : undefined) ||
                (orderSymLower ? stocks.find(s => s.symbol.toLowerCase() === orderSymLower) : undefined) ||
                (order.stockIsin
                    ? stocks.find(s =>
                        s.isin &&
                        s.isin.toLowerCase() === order.stockIsin!.toLowerCase() &&
                        (!orderCurUpper || (s.currency || '').toUpperCase() === orderCurUpper)
                    )
                    : undefined);
            if (found) {
                if (!addedStockIds.has(String(found.id))) {
                    const enhancedStock: Stock = {
                        ...found,
                        targetPrice: order.mode === 'buy' ? (order.limitPrice || found.targetPrice) : found.targetPrice,
                        sellLimit: order.mode === 'sell' ? (order.limitPrice || found.sellLimit) : found.sellLimit,
                    };
                    list.push(enhancedStock);
                    addedStockIds.add(String(found.id));
                }
            } else {
                // Synthesize stock if order was created for symbol not yet in stocks
                const synthId = order.stockId || `order_${order.id}`;
                if (!addedStockIds.has(String(synthId))) {
                    const isLikelyEtfOrder = /\b(ETF|UCITS|MSCI|FTSE|NASDAQ|S&P|ALL-WORLD)\b/i.test(order.stockName || '')
                        || /^(EQQQ|SXRV|CSNDX|VWCE|VWRA|VWRL|VHYL|SWDA|IWDA|VUSA|TDIV|FUSD|WINC)\b/i.test(order.stockSymbol || '');
                    const synthStock: Stock = {
                        id: synthId,
                        name: order.stockName,
                        symbol: order.stockSymbol,
                        isin: order.stockIsin || '',
                        currency: (order.currency as any) || 'EUR',
                        currentPrice: order.limitPrice,
                        previousClose: order.limitPrice,
                        targetPrice: order.mode === 'buy' ? order.limitPrice : undefined,
                        sellLimit: order.mode === 'sell' ? order.limitPrice : undefined,
                        type: isLikelyEtfOrder ? 'etf' : 'stock',
                        sector: isLikelyEtfOrder ? 'ETF' : 'Auftrag',
                        dividendYield: order.grossYield || 0,
                        dividendFrequency: order.dividendFrequency || 'quarterly',
                    };
                    list.push(synthStock);
                    addedStockIds.add(String(synthId));
                }
            }
        });

        // 2. Only if showAllLimits is explicitly toggled: include watchlist stocks with targetPrice > 0 or sellLimit > 0
        if (showAllLimits) {
            stocks.forEach(s => {
                if (!addedStockIds.has(String(s.id))) {
                    const hasBuyLimit = typeof s.targetPrice === 'number' && s.targetPrice > 0;
                    const hasSellLimit = typeof s.sellLimit === 'number' && s.sellLimit > 0;
                    if (hasBuyLimit || hasSellLimit) {
                        list.push(s);
                        addedStockIds.add(String(s.id));
                    }
                }
            });
        }

        return list;
    }, [stocks, openOrders, showAllLimits]);

    // All available tabs (system tabs + custom watchlists)
    const allTabs = useMemo<WatchlistTabItem[]>(() => {
        const list: WatchlistTabItem[] = [
            { id: 'owned', name: 'Bestand', isSystem: true, badgeCount: directOwnedStockIds.size },
            { id: 'orders', name: 'Aufträge', isSystem: true, badgeCount: ordersStocksList.length }
        ];

        watchlists.forEach(wl => {
            list.push({
                id: wl.id,
                name: wl.name,
                isDefault: wl.isDefault,
                badgeCount: wl.stockIds.length
            });
        });

        return list;
    }, [directOwnedStockIds.size, ordersStocksList.length, watchlists]);

    // Custom Tab Order - Persisted in localStorage
    const TAB_ORDER_STORAGE_KEY = 'watchlist_tab_order_v1';
    const [tabOrder, setTabOrder] = useState<string[]>(() => {
        try {
            const saved = localStorage.getItem(TAB_ORDER_STORAGE_KEY);
            if (saved) {
                const parsed = JSON.parse(saved);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    return parsed;
                }
            }
        } catch (e) {
            console.error('Error loading tab order', e);
        }
        return ['owned', 'orders'];
    });

    const orderedTabs = useMemo(() => {
        const map = new Map(allTabs.map(t => [t.id, t]));
        const result: WatchlistTabItem[] = [];

        tabOrder.forEach(id => {
            const item = map.get(id);
            if (item) {
                result.push(item);
                map.delete(id);
            }
        });

        // If 'orders' was missing from tabOrder, place right after 'owned'
        if (map.has('orders')) {
            const ownedIdx = result.findIndex(t => t.id === 'owned');
            const ordersItem = map.get('orders')!;
            map.delete('orders');
            if (ownedIdx !== -1) {
                result.splice(ownedIdx + 1, 0, ordersItem);
            } else {
                result.push(ordersItem);
            }
        }

        // Append remaining items (newly created lists, etc.)
        map.forEach(item => {
            result.push(item);
        });

        return result;
    }, [allTabs, tabOrder]);

    const saveTabOrder = (newTabs: WatchlistTabItem[]) => {
        const newIds = newTabs.map(t => t.id);
        setTabOrder(newIds);
        try {
            localStorage.setItem(TAB_ORDER_STORAGE_KEY, JSON.stringify(newIds));
        } catch (e) {
            console.error('Error saving tab order', e);
        }
    };

    const moveTab = (sourceId: string, targetId: string) => {
        if (sourceId === targetId) return;
        const current = [...orderedTabs];
        const sourceIndex = current.findIndex(t => t.id === sourceId);
        const targetIndex = current.findIndex(t => t.id === targetId);
        if (sourceIndex === -1 || targetIndex === -1) return;

        const [moved] = current.splice(sourceIndex, 1);
        current.splice(targetIndex, 0, moved);
        saveTabOrder(current);
    };

    const resetTabOrder = () => {
        const defaultList: WatchlistTabItem[] = [
            ...allTabs.filter(t => t.id === 'owned'),
            ...allTabs.filter(t => t.id === 'orders'),
            ...allTabs.filter(t => !t.isSystem && !t.isDefault),
            ...allTabs.filter(t => t.isDefault)
        ];
        saveTabOrder(defaultList);
    };

    // Filter stocks based on activeWatchlistId
    const baseStocks = useMemo(() => {
        if (activeWatchlistId === 'owned') {
            return stocks.filter(s => directOwnedStockIds.has(String(s.id)));
        }
        if (activeWatchlistId === 'orders') {
            return ordersStocksList;
        }
        if (!activeWatchlist) return [];

        return stocks.filter(s => {
            const explicitlyInList = activeWatchlist.stockIds.includes(s.id);
            if (activeWatchlist.isDefault) {
                const isOwned = directOwnedStockIds.has(String(s.id));
                return explicitlyInList || isOwned;
            }
            return explicitlyInList;
        });
    }, [activeWatchlistId, directOwnedStockIds, ordersStocksList, activeWatchlist, stocks]);

    const watchlistStocks = useMemo(() => {
        return [...baseStocks].sort((a, b) => {
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
            if (sortConfig.key === 'exDate') {
                const dateA = getCurrentDividendPeriod(a).exDate;
                const dateB = getCurrentDividendPeriod(b).exDate;
                if (!dateA && !dateB) return 0;
                if (!dateA) return 1;
                if (!dateB) return -1;
                const timeA = new Date(dateA).getTime();
                const timeB = new Date(dateB).getTime();
                return sortConfig.direction === 'asc' ? timeA - timeB : timeB - timeA;
            }
            if (sortConfig.key === 'payDate') {
                const dateA = getCurrentDividendPeriod(a).payDate;
                const dateB = getCurrentDividendPeriod(b).payDate;
                if (!dateA && !dateB) return 0;
                if (!dateA) return 1;
                if (!dateB) return -1;
                const timeA = new Date(dateA).getTime();
                const timeB = new Date(dateB).getTime();
                return sortConfig.direction === 'asc' ? timeA - timeB : timeB - timeA;
            }
            return 0;
        });
    }, [baseStocks, sortConfig]);

    // Split into sections (Stocks vs ETFs); keep owned & unowned together in custom watchlists
    const allStocks = watchlistStocks.filter(s => !s.type || s.type === 'stock');
    const allEtfs = watchlistStocks.filter(s => s.type === 'etf');

    const ownedStocks = allStocks.filter(s => directOwnedStockIds.has(String(s.id)));
    const ownedEtfs = allEtfs.filter(s => directOwnedStockIds.has(String(s.id)));

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

    const subTabs: Array<{ id: string; label: string; count: number; icon: any; stocks: Stock[] }> = (() => {
        if (activeWatchlistId === 'owned') {
            return [
                { id: 'owned-stocks', label: 'Aktien', count: ownedStocks.length, icon: ShoppingBag, stocks: ownedStocks },
                { id: 'owned-etfs', label: 'ETFs', count: ownedEtfs.length, icon: PieChart, stocks: ownedEtfs }
            ];
        }
        if (activeWatchlistId === 'orders') {
            const tabs = [
                { id: 'orders-stocks', label: 'Aktien', count: allStocks.length, icon: ShoppingBag, stocks: allStocks }
            ];
            if (allEtfs.length > 0) {
                tabs.push({ id: 'orders-etfs', label: 'ETFs', count: allEtfs.length, icon: PieChart, stocks: allEtfs });
            }
            return tabs;
        }
        const stockTab = { id: 'all-stocks', label: 'Aktien', count: allStocks.length, icon: ShoppingBag, stocks: allStocks };
        const etfTab = { id: 'all-etfs', label: 'ETFs', count: allEtfs.length, icon: PieChart, stocks: allEtfs };
        if (isEtfList) {
            return [
                ...(allEtfs.length > 0 || allStocks.length === 0 ? [etfTab] : []),
                ...(allStocks.length > 0 ? [stockTab] : [])
            ];
        }
        return [
            ...(allStocks.length > 0 || allEtfs.length === 0 ? [stockTab] : []),
            ...(allEtfs.length > 0 ? [etfTab] : [])
        ];
    })();

    const handleRemoveStock = (stockId: string) => {
        if (activeWatchlistId === 'orders') {
            const stock = stocks.find(s => s.id === stockId);
            const stockName = stock?.name || 'diese Aktie';
            if (window.confirm(`Limit & offenen Auftrag für "${stockName}" entfernen?`)) {
                const matchingOrders = (orderBook || []).filter(o =>
                    o.status === 'open' && (
                        o.stockId === stockId ||
                        (stock && o.stockSymbol.toLowerCase() === stock.symbol.toLowerCase()) ||
                        (stock?.isin && o.stockIsin && o.stockIsin.toLowerCase() === stock.isin.toLowerCase())
                    )
                );
                matchingOrders.forEach(o => deleteOrderBookEntry(o.id));
                if (stock) {
                    updateStock(stock.id, { targetPrice: undefined, sellLimit: undefined });
                }
            }
            return;
        }
        if (activeWatchlistId === 'owned') return;
        removeFromWatchlist(stockId, activeWatchlistId);
    };

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

    const isCurrentEtf = activeSubTab.toLowerCase().includes('etf');
    const initialAssetFilter = isCurrentEtf ? 'etf' : 'stock';

    if (isPerformanceModalOpen) {
        return (
            <div className="h-full flex flex-col p-4 md:p-6 space-y-3 bg-gradient-to-br from-background via-background to-muted/20 overflow-hidden iphone-landscape-page-root">
                <WatchlistPerformanceModal
                    isOpen={true}
                    onClose={() => setIsPerformanceModalOpen(false)}
                    activeWatchlistId={activeWatchlistId}
                    initialPeriod={modalInitialPeriod}
                    initialAssetFilter={initialAssetFilter}
                />
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col p-4 md:p-6 space-y-3 bg-gradient-to-br from-background via-background to-muted/20 overflow-hidden iphone-landscape-page-root">
            {/* Header + Tabs Container - Fixed Height */}
            <div className="shrink-0 bg-background pb-4 -mt-4 -mx-4 px-4 md:-mt-6 md:-mx-6 md:px-6 iphone-landscape-portfolio-header-wrap">
                {/* Header */}
                <div className="border-b bg-card rounded-t-xl -mx-4 md:-mx-6">
                    <div className="w-full pl-14 pr-4 py-4 md:px-6 md:pl-14 xl:pl-6 iphone-landscape-portfolio-header-content">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 iphone-landscape-portfolio-header-row">
                            <div className="flex items-center gap-3 min-h-[38px] iphone-landscape-portfolio-title-group">
                                <LandscapeBackButton />
                                <div className="p-3 rounded-xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20 text-blue-600 dark:text-blue-400 shrink-0 iphone-landscape-portfolio-icon">
                                    <Eye className="size-6" />
                                </div>
                                <div>
                                    <h1 className="text-3xl font-bold tracking-tight whitespace-nowrap iphone-landscape-portfolio-title">Watchlist</h1>
                                    <p className="text-muted-foreground hidden md:block iphone-landscape-portfolio-subtitle">Aktien beobachten und Dividenden prüfen</p>
                                </div>
                            </div>

                            <div className="flex items-center justify-center sm:justify-end gap-2 w-full sm:w-auto sm:ml-auto iphone-landscape-portfolio-actions">
                                <button
                                    onClick={() => {
                                        setModalInitialPeriod('1D');
                                        setIsPerformanceModalOpen(true);
                                    }}
                                    className="flex items-center justify-center gap-2 bg-secondary text-secondary-foreground px-3.5 sm:px-4 py-2 rounded-lg hover:bg-secondary/90 transition-colors font-medium border border-border shadow-sm whitespace-nowrap cursor-pointer active:scale-95"
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

                {/* Watchlist Tabs Bar with Drag & Drop & Reorder */}
                <div className="-mx-4 md:-mx-6 px-4 md:px-6 pt-1.5 pb-2 mt-2 overflow-x-auto bg-background shrink-0 iphone-landscape-portfolio-subtabs">
                    <div className="flex items-center gap-2 min-w-max">
                        {orderedTabs.map((tab) => {
                            const isActive = activeWatchlistId === tab.id;
                            const isDragging = draggedTabId === tab.id;
                            const isOver = dragOverTabId === tab.id;

                            return (
                                <div
                                    key={tab.id}
                                    draggable
                                    onDragStart={(e) => {
                                        e.dataTransfer.setData('text/plain', tab.id);
                                        e.dataTransfer.effectAllowed = 'move';
                                        setDraggedTabId(tab.id);
                                    }}
                                    onDragOver={(e) => {
                                        e.preventDefault();
                                        e.dataTransfer.dropEffect = 'move';
                                        if (dragOverTabId !== tab.id) {
                                            setDragOverTabId(tab.id);
                                        }
                                    }}
                                    onDragLeave={() => {
                                        if (dragOverTabId === tab.id) {
                                            setDragOverTabId(null);
                                        }
                                    }}
                                    onDrop={(e) => {
                                        e.preventDefault();
                                        const sourceId = e.dataTransfer.getData('text/plain') || draggedTabId;
                                        if (sourceId && sourceId !== tab.id) {
                                            moveTab(sourceId, tab.id);
                                        }
                                        setDraggedTabId(null);
                                        setDragOverTabId(null);
                                    }}
                                    onDragEnd={() => {
                                        setDraggedTabId(null);
                                        setDragOverTabId(null);
                                    }}
                                    className={cn(
                                        "relative group transition-all duration-150 cursor-grab active:cursor-grabbing select-none",
                                        isDragging && "opacity-40 scale-95",
                                        isOver && "ring-2 ring-blue-500 rounded-full scale-105"
                                    )}
                                    title={`Tab "${tab.name}" verschieben (Drag & Drop)`}
                                >
                                    <button
                                        type="button"
                                        onClick={() => setActiveWatchlistId(tab.id)}
                                        className={cn(
                                            "px-4 py-2 rounded-full text-sm font-medium transition-all border flex items-center gap-1.5",
                                            isActive
                                                ? "bg-primary text-primary-foreground border-primary shadow-sm"
                                                : "bg-card text-muted-foreground border-border hover:bg-accent hover:text-foreground"
                                        )}
                                    >
                                        {tab.id === 'owned' && <ShoppingBag className="size-3.5 shrink-0" />}
                                        {tab.id === 'orders' && <Clock className="size-3.5 shrink-0 text-amber-500" />}
                                        <span>{tab.name}</span>
                                        {tab.id === 'orders' && (tab.badgeCount ?? 0) > 0 && (
                                            <span className={cn(
                                                "text-xs px-1.5 py-0.2 rounded-full font-mono font-bold leading-none ml-1",
                                                isActive
                                                    ? "bg-primary-foreground/20 text-primary-foreground"
                                                    : "bg-amber-500/20 text-amber-600 dark:text-amber-400"
                                            )}>
                                                {tab.badgeCount}
                                            </span>
                                        )}
                                    </button>
                                    {!tab.isSystem && activeWatchlistId === tab.id && (
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                if (confirm(`Liste "${tab.name}" wirklich löschen?`)) {
                                                    deleteWatchlist(tab.id);
                                                    setActiveWatchlistId('owned');
                                                }
                                            }}
                                            className="absolute top-0.5 -right-1 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity shadow-sm z-10 flex items-center justify-center cursor-pointer"
                                            title="Liste löschen"
                                        >
                                            <Trash2 className="size-3" />
                                        </button>
                                    )}
                                </div>
                            );
                        })}

                        {/* Add List Button */}
                        <button
                            onClick={() => {
                                const name = window.prompt("Name der neuen Liste:");
                                if (name) createWatchlist(name);
                            }}
                            className="p-2 iphone-landscape-pill-icon rounded-full bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors border border-border flex items-center justify-center shrink-0 cursor-pointer"
                            title="Neue Liste erstellen"
                        >
                            <Plus className="size-4" />
                        </button>

                        {/* Rename & Delete Buttons (for active non-system list) */}
                        {activeWatchlist && (
                            <>
                                <button
                                    onClick={() => {
                                        const newName = window.prompt("Neuer Name:", activeWatchlist.name);
                                        if (newName) renameWatchlist(activeWatchlist.id, newName);
                                    }}
                                    className="p-2 ml-1 iphone-landscape-pill-icon rounded-full text-muted-foreground hover:bg-accent transition-colors border border-border flex items-center justify-center shrink-0 cursor-pointer"
                                    title="Liste umbenennen"
                                >
                                    <Edit className="size-4" />
                                </button>
                                <button
                                    onClick={() => {
                                        if (confirm(`Liste "${activeWatchlist.name}" wirklich löschen?`)) {
                                            deleteWatchlist(activeWatchlist.id);
                                            setActiveWatchlistId('owned');
                                        }
                                    }}
                                    className="p-2 ml-1 iphone-landscape-pill-icon rounded-full text-red-500 hover:bg-red-500/10 transition-colors border border-border flex items-center justify-center shrink-0 cursor-pointer"
                                    title="Aktive Liste löschen"
                                    aria-label="Aktive Liste löschen"
                                >
                                    <Trash2 className="size-4" />
                                </button>
                            </>
                        )}

                        {/* Reorder Button */}
                        <button
                            onClick={() => setIsReorderModalOpen(true)}
                            className="p-2 ml-1 iphone-landscape-pill-icon rounded-full bg-secondary/60 text-secondary-foreground hover:bg-secondary transition-colors border border-border flex items-center justify-center shrink-0 cursor-pointer"
                            title="Listen frei anordnen / sortieren"
                            aria-label="Listen frei anordnen"
                        >
                            <ArrowUpDown className="size-4 text-blue-500" />
                        </button>
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
                    <div className="flex items-center gap-2 flex-wrap">
                        {currentTab?.icon && <currentTab.icon className="size-4 text-primary" />}
                        <h2 className="text-sm sm:text-base font-bold">{currentTab?.label}</h2>
                        <span className="text-xs font-mono bg-muted px-2 py-0.5 rounded-full text-muted-foreground">{currentTabStocks.length}</span>
                        <button
                            type="button"
                            onClick={() => {
                                setModalInitialPeriod('1M');
                                setIsPerformanceModalOpen(true);
                            }}
                            className="ml-1 sm:ml-2 flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/25 text-xs font-semibold transition-all active:scale-95 cursor-pointer shadow-2xs"
                            title="Rangliste & Performance-Vergleich (Woche, Monat, 3 Monate) für diese Watchlist öffnen"
                        >
                            <Trophy className="size-3.5 text-amber-400 shrink-0" />
                            <span>Rangliste (1W / 1M / 3M)</span>
                        </button>
                        {activeWatchlistId === 'orders' && (
                            <>
                                <button
                                    type="button"
                                    onClick={() => setIsOrderBookModalOpen(true)}
                                    className="ml-1 sm:ml-2 flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 dark:text-amber-400 border border-amber-500/25 text-xs font-semibold transition-all active:scale-95 cursor-pointer shadow-2xs shrink-0"
                                    title="Auftragsbuch mit allen Details und Limiten öffnen"
                                >
                                    <ClipboardList className="size-3.5 text-amber-500 shrink-0" />
                                    <span>Auftragsbuch {openOrders.length > 0 && `(${openOrders.length})`}</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setShowAllLimits(prev => !prev)}
                                    className={cn(
                                        "ml-1 flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all border cursor-pointer shadow-2xs shrink-0",
                                        showAllLimits
                                            ? "bg-blue-600 text-white border-blue-700"
                                            : "bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground border-border"
                                    )}
                                    title={showAllLimits ? "Zurück zu nur echten Aufträgen aus dem Auftragsbuch" : "Auch reine Watchlist-Kursziele ohne platzierten Auftrag einblenden"}
                                >
                                    <span>{showAllLimits ? 'Alle Limiten' : 'Nur Auftragsbuch'}</span>
                                </button>
                            </>
                        )}
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
                    ownedStockIds={ownedBadgeStockIds}
                    showOwnedBadge={activeWatchlistId !== 'owned'}
                    canRemove={activeWatchlistId !== 'owned'}
                    sortConfig={sortConfig}
                    setSortConfig={setSortConfig}
                    onNavigate={(id) => navigate(`/stock/${id}?from=watchlist`)}
                    onBuy={(stock) => handleBuy(stock)}
                    onEdit={(id) => navigate(`/stock/${id}?from=watchlist`)}
                    onRemove={handleRemoveStock}
                    onAssignWatchlists={(id) => setAssignWatchlistStockId(id)}
                    watchlists={watchlists}
                    formatCurrency={formatCurrency}
                    emptyMessage={
                        activeWatchlistId === 'orders'
                            ? "Keine offenen Aufträge oder gesetzten Limiten vorhanden. Neue Aufträge können im Simulator (Kauf / Verkauf) erfasst werden."
                            : "Keine Positionen in dieser Ansicht."
                    }
                    orderBook={orderBook}
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

                {/* AddToWatchlistModal for assigning stock/ETF to other watchlists */}
                <AddToWatchlistModal
                    isOpen={Boolean(assignWatchlistStockId)}
                    onClose={() => setAssignWatchlistStockId(null)}
                    stockId={assignWatchlistStockId || ''}
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

                {/* WatchlistReorderModal for freely moving and sorting tabs */}
                <WatchlistReorderModal
                    isOpen={isReorderModalOpen}
                    onClose={() => setIsReorderModalOpen(false)}
                    tabs={orderedTabs}
                    onSaveOrder={saveTabOrder}
                    onResetOrder={resetTabOrder}
                    activeTabId={activeWatchlistId}
                    onSelectTab={(id) => setActiveWatchlistId(id)}
                />

                {/* OrderBookModal */}
                <OrderBookModal
                    isOpen={isOrderBookModalOpen}
                    onClose={() => setIsOrderBookModalOpen(false)}
                    onLoadIntoSimulator={(entry) => {
                        setIsOrderBookModalOpen(false);
                        navigate(`/calculator?stock=${encodeURIComponent(entry.stockSymbol || entry.stockId || '')}&mode=${entry.mode}&from=watchlist`);
                    }}
                />
            </div>
    );
}

interface WatchlistTableProps {
    stocks: Stock[];
    ownedStockIds: Set<string>;
    showOwnedBadge: boolean;
    canRemove: boolean;
    sortConfig: { key: string; direction: 'asc' | 'desc' };
    setSortConfig: (config: any) => void;
    onNavigate: (id: string) => void;
    onBuy: (stock: Stock) => void;
    onEdit: (id: string) => void;
    onRemove: (id: string) => void;
    onAssignWatchlists: (id: string) => void;
    watchlists: Array<{ id: string; name: string; stockIds: string[] }>;
    formatCurrency: any;
    emptyMessage: string;
    orderBook?: OrderBookEntry[];
}

function WatchlistTable({
    stocks,
    ownedStockIds,
    showOwnedBadge,
    canRemove,
    sortConfig,
    setSortConfig,
    onNavigate,
    onBuy,
    onEdit,
    onRemove,
    onAssignWatchlists,
    watchlists,
    formatCurrency,
    emptyMessage,
    orderBook
}: WatchlistTableProps) {
    // 0: [Div. Rendite, Aktueller Kurs], 1: [Kauflimit, Verkaufslimit], 2: [EX-Tag, Zahl-Tag], 3: [Aktionen]
    const [mobilePage, setMobilePage] = useState(0);
    const touchStartRef = useRef<{ x: number; y: number; time: number; isStockCol: boolean } | null>(null);

    const handleSort = (key: string) => {
        setSortConfig((prev: any) => {
            const isSameKey = prev.key === key;
            const defaultDir = (key === 'gap' || key === 'sellGap' || key === 'exDate' || key === 'payDate') ? 'asc' : 'desc';
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
            if (sortConfig.key === 'exDate') {
                const dateA = getCurrentDividendPeriod(a).exDate;
                const dateB = getCurrentDividendPeriod(b).exDate;
                if (!dateA && !dateB) return 0;
                if (!dateA) return 1;
                if (!dateB) return -1;
                const timeA = new Date(dateA).getTime();
                const timeB = new Date(dateB).getTime();
                return sortConfig.direction === 'asc' ? timeA - timeB : timeB - timeA;
            }
            if (sortConfig.key === 'payDate') {
                const dateA = getCurrentDividendPeriod(a).payDate;
                const dateB = getCurrentDividendPeriod(b).payDate;
                if (!dateA && !dateB) return 0;
                if (!dateA) return 1;
                if (!dateB) return -1;
                const timeA = new Date(dateA).getTime();
                const timeB = new Date(dateB).getTime();
                return sortConfig.direction === 'asc' ? timeA - timeB : timeB - timeA;
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
            className="overflow-y-auto overflow-x-auto flex-1 min-h-0 p-0 w-full snap-y snap-mandatory scroll-pt-[48px] xl:snap-none xl:scroll-pt-0"
        >
            <table className="w-full text-xs xl:text-sm border-collapse table-fixed xl:table-auto">
                <thead>
                    <tr className="border-b bg-muted/20">
                        {/* 0. Aktie */}
                        <th className="px-3 xl:px-4 py-0 xl:py-2 h-12 xl:h-auto font-semibold text-foreground xl:text-muted-foreground text-[15px] xl:text-xs uppercase tracking-wider sticky top-0 left-0 z-40 bg-card shadow-[5px_0_5px_-5px_rgba(0,0,0,0.1)] w-[180px] sm:w-[240px] md:w-[260px] min-w-[180px] sm:min-w-[240px] md:min-w-[260px] max-w-[220px] sm:max-w-[260px] md:max-w-[280px] xl:w-auto xl:min-w-[360px] xl:max-w-none touch-pan-y align-middle">
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
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        handleSort('exDate');
                                    }}
                                    className="flex items-center justify-center gap-1 px-1.5 py-1 rounded-md text-foreground hover:bg-muted active:bg-muted/70 transition-colors cursor-pointer select-none font-semibold text-xs sm:text-[13px] truncate"
                                >
                                    <span className="truncate">EX-Tag</span>
                                    {sortConfig.key === 'exDate' && (
                                        <span className="font-bold text-sm text-primary shrink-0">
                                            {sortConfig.direction === 'desc' ? '↓' : '↑'}
                                        </span>
                                    )}
                                </button>
                            </div>
                            <button
                                type="button"
                                onClick={() => handleSort('exDate')}
                                className="hidden xl:inline-flex items-center gap-1 hover:text-foreground cursor-pointer select-none text-inherit uppercase"
                            >
                                <span>EX-Tag</span>
                                {sortConfig.key === 'exDate' && (
                                    <span className="font-bold text-xs">
                                        {sortConfig.direction === 'desc' ? '↓' : '↑'}
                                    </span>
                                )}
                            </button>
                        </th>

                        {/* 6. Zahl-Tag */}
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
                                        handleSort('payDate');
                                    }}
                                    className="flex items-center justify-center gap-1 px-1.5 py-1 rounded-md text-foreground hover:bg-muted active:bg-muted/70 transition-colors cursor-pointer select-none font-semibold text-xs sm:text-[13px] truncate"
                                >
                                    <span className="truncate">Zahl-Tag</span>
                                    {sortConfig.key === 'payDate' && (
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
                                onClick={() => handleSort('payDate')}
                                className="hidden xl:inline-flex items-center gap-1 hover:text-foreground cursor-pointer select-none text-inherit uppercase"
                            >
                                <span>Zahl-Tag</span>
                                {sortConfig.key === 'payDate' && (
                                    <span className="font-bold text-xs">
                                        {sortConfig.direction === 'desc' ? '↓' : '↑'}
                                    </span>
                                )}
                            </button>
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

                        const matchingOrder = orderBook?.find((o: any) =>
                            o.status === 'open' && (
                                (o.stockId && o.stockId === stock.id) ||
                                (o.stockSymbol && o.stockSymbol.toLowerCase() === stock.symbol.toLowerCase()) ||
                                (o.stockIsin && stock.isin && o.stockIsin.toLowerCase() === stock.isin.toLowerCase())
                            )
                        );

                        const effectiveTargetPrice = stock.targetPrice || (matchingOrder?.mode === 'buy' ? matchingOrder.limitPrice : undefined);
                        const effectiveSellLimit = stock.sellLimit || (matchingOrder?.mode === 'sell' ? matchingOrder.limitPrice : undefined);
                        const isUnderTarget = effectiveTargetPrice && stock.currentPrice > 0 && stock.currentPrice <= effectiveTargetPrice;
                        const isOverSell = effectiveSellLimit && stock.currentPrice > 0 && stock.currentPrice >= effectiveSellLimit;
                        const stockChange = stock.previousClose ? ((stock.currentPrice - stock.previousClose) / stock.previousClose) * 100 : 0;
                        const calcState = estimateMarketState(stock.symbol, stock.currency);
                        const isMarketOpen = calcState === 'REGULAR';

                        return (
                            <tr key={stock.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors group snap-start snap-always h-[60px] xl:h-auto">
                                <td className="px-3 py-1.5 xl:p-4 h-[60px] xl:h-auto sticky left-0 z-20 group-hover:bg-muted/30 transition-colors shadow-[5px_0_5px_-5px_rgba(0,0,0,0.1)] overflow-hidden w-[180px] sm:w-[240px] md:w-[260px] min-w-[180px] sm:min-w-[240px] md:min-w-[260px] max-w-[220px] sm:max-w-[260px] md:max-w-[280px] xl:w-auto xl:min-w-[360px] xl:max-w-none touch-pan-y align-middle">
                                    <div className="absolute inset-0 bg-card -z-10" />
                                    <div className="flex items-center gap-2 xl:gap-3 relative">
                                        <Logo
                                            url={stock.logoUrl}
                                            alt={stock.name}
                                            fallback={stock.symbol.slice(0, 2)}
                                            size="size-8 xl:size-10"
                                        />
                                        <div className="flex flex-col min-w-0 flex-1 justify-center">
                                            <div onClick={() => onNavigate(stock.id)} className="cursor-pointer">
                                                <StockName name={stock.name} className="font-bold text-[13px] xl:text-sm group-hover:text-primary transition-colors" />
                                            </div>
                                            <div className="flex items-center gap-1.5 mt-0.5 whitespace-nowrap overflow-hidden max-w-full">
                                                <span className="text-xs font-mono font-semibold text-foreground/80 uppercase whitespace-nowrap shrink-0">{stock.symbol}</span>
                                                {stock.sector && stock.sector !== 'Simuliert' && (
                                                    <>
                                                        <span className="text-muted-foreground/40 text-[10px] shrink-0">•</span>
                                                        <span className="text-xs text-muted-foreground truncate min-w-0" title={translateSector(stock.sector, (stock as any).industry)}>{translateSector(stock.sector, (stock as any).industry)}</span>
                                                    </>
                                                )}
                                                {isMarketOpen ? (
                                                    <div className="size-2 rounded-full bg-green-500 animate-pulse shrink-0 shadow-[0_0_8px_rgba(34,197,94,0.5)] border border-background" title={`Markt geöffnet (${calcState})`} />
                                                ) : (
                                                    <div className="size-2 rounded-full bg-red-500 shrink-0 border border-background" title={`Markt geschlossen (${calcState})`} />
                                                )}
                                                {showOwnedBadge && ownedStockIds.has(String(stock.id)) && (
                                                    <span
                                                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30 shrink-0 leading-none"
                                                        title="Aktuell im Bestand"
                                                    >
                                                        <ShoppingBag className="size-2.5 shrink-0" />
                                                        <span>Bestand</span>
                                                    </span>
                                                )}
                                                {matchingOrder && (() => {
                                                    const orderLimit = matchingOrder.limitPrice;
                                                    let orderGap: number | null = null;
                                                    let isOrderReached = false;
                                                    if (orderLimit > 0 && stock.currentPrice > 0) {
                                                        if (matchingOrder.mode === 'buy') {
                                                            orderGap = ((stock.currentPrice - orderLimit) / orderLimit * 100);
                                                            isOrderReached = orderGap <= 0;
                                                        } else {
                                                            orderGap = ((stock.currentPrice - orderLimit) / orderLimit * 100);
                                                            isOrderReached = orderGap >= 0;
                                                        }
                                                    }
                                                    return (
                                                        <span
                                                            className={cn(
                                                                "inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide border shrink-0 leading-none",
                                                                isOrderReached
                                                                    ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                                                                    : "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30"
                                                            )}
                                                            title={`Offener Auftrag im Auftragsbuch: ${matchingOrder.mode === 'buy' ? 'Kauf' : 'Verkauf'} ${matchingOrder.shares} Stk. à ${formatCurrency(matchingOrder.limitPrice, matchingOrder.currency, false)}${orderGap !== null ? ` • Gap: ${orderGap > 0 ? '+' : ''}${orderGap.toFixed(1)}%` : ''} (Gültig bis ${matchingOrder.validUntil})`}
                                                        >
                                                            <Clock className="size-2.5 shrink-0" />
                                                            <span>
                                                                {matchingOrder.mode === 'buy' ? 'Kauf' : 'Verkauf'} {matchingOrder.shares} Stk.
                                                                {orderGap !== null && (
                                                                    <span className={cn(
                                                                        "font-mono ml-1 font-bold",
                                                                        isOrderReached ? "text-emerald-600 dark:text-emerald-400" : "text-amber-700 dark:text-amber-300"
                                                                    )}>
                                                                        • Gap: {orderGap > 0 ? '+' : ''}{orderGap.toFixed(1)}%
                                                                    </span>
                                                                )}
                                                            </span>
                                                        </span>
                                                    );
                                                })()}
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
                                        <div className="inline-flex items-center justify-center xl:justify-end gap-1.5">
                                            {isUnderTarget && (
                                                <div className="size-2 rounded-full bg-green-500 animate-pulse shrink-0" title="Limit erreicht!" />
                                            )}
                                            {effectiveTargetPrice && (() => {
                                                const activeParams = stock.fairValueParams as any;
                                                const resolvedTargetMode =
                                                    stock.targetPriceType
                                                    || (!stock.targetPrice && matchingOrder?.mode === 'buy'
                                                        ? 'manual'
                                                        : activeParams?.valuationMode === 'quality'
                                                            ? 'quality'
                                                            : activeParams?.valuationMode === 'risk'
                                                                ? 'risk'
                                                                : activeParams?.valuationMode === 'conservative'
                                                                    ? 'conservative'
                                                                    : (activeParams?.valuationMode === 'manual' || activeParams?.isCustom)
                                                                        ? 'manual'
                                                                        : 'conservative');
                                                const fvProfileMode =
                                                    activeParams?.valuationMode === 'quality'
                                                        ? 'quality'
                                                        : activeParams?.valuationMode === 'risk'
                                                            ? 'risk'
                                                            : (activeParams?.valuationMode === 'manual' || activeParams?.isCustom)
                                                                ? 'manual'
                                                                : 'conservative';
                                                const limitBadge = resolvedTargetMode === 'manual'
                                                    ? { label: 'M', title: 'Kauflimit Manuell', cls: 'bg-pink-500/15 text-pink-700 dark:text-pink-300 border-pink-500/35' }
                                                    : resolvedTargetMode === 'risk'
                                                        ? { label: 'C', title: 'Kauflimit Risiko-Abschlag C', cls: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/35' }
                                                        : resolvedTargetMode === 'quality'
                                                            ? { label: 'B', title: 'Kauflimit Qualität B', cls: 'bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/35' }
                                                            : resolvedTargetMode === 'fairValue'
                                                                ? (fvProfileMode === 'quality'
                                                                    ? { label: 'FW', title: 'Kauflimit Fairer Wert B', cls: 'bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/35' }
                                                                    : fvProfileMode === 'risk'
                                                                        ? { label: 'FW', title: 'Kauflimit Fairer Wert C', cls: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/35' }
                                                                        : fvProfileMode === 'manual'
                                                                            ? { label: 'FW', title: 'Kauflimit Fairer Wert Manuell', cls: 'bg-pink-500/15 text-pink-700 dark:text-pink-300 border-pink-500/35' }
                                                                            : { label: 'FW', title: 'Kauflimit Fairer Wert A', cls: 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/35' })
                                                                : { label: 'A', title: 'Kauflimit Sicherheit A', cls: 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/35' };
                                                return (
                                                    <span
                                                        className={cn(
                                                            "inline-flex items-center justify-center w-[26px] h-5 px-1 text-xs font-bold leading-none rounded border shrink-0",
                                                            limitBadge.cls
                                                        )}
                                                        title={limitBadge.title}
                                                    >
                                                        {limitBadge.label}
                                                    </span>
                                                );
                                            })()}
                                            <span className={cn(
                                                "font-bold tabular-nums text-[15px] xl:text-sm whitespace-nowrap leading-tight",
                                                effectiveTargetPrice && "xl:min-w-[98px] xl:text-right",
                                                isUnderTarget ? "text-green-600 dark:text-green-400" : "text-foreground"
                                            )}>
                                                {effectiveTargetPrice ? formatCurrency(effectiveTargetPrice, stock.currency, false) : '-'}
                                            </span>
                                        </div>
                                        {effectiveTargetPrice ? (() => {
                                            const buyGap = ((stock.currentPrice - effectiveTargetPrice) / effectiveTargetPrice * 100);
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
                                        <div className="inline-flex items-center justify-center xl:justify-end gap-1.5">
                                            {isOverSell && (
                                                <div className="size-2.5 rounded-full bg-green-500 animate-pulse shrink-0" title="Verkaufslimit erreicht!" />
                                            )}
                                            {effectiveSellLimit && (() => {
                                                const resolvedSellType =
                                                    stock.sellLimitType
                                                    || stock.fairValueParams?.sellLimitType
                                                    || (!stock.sellLimit && matchingOrder?.mode === 'sell' ? 'order' : 'manual');
                                                const sellBadge = resolvedSellType === 'conservative'
                                                    ? { label: 'A', title: 'Verkaufslimit Sicherheit A', cls: 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/35' }
                                                    : resolvedSellType === 'quality'
                                                        ? { label: 'B', title: 'Verkaufslimit Qualität B', cls: 'bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/35' }
                                                        : resolvedSellType === 'risk'
                                                            ? { label: 'C', title: 'Verkaufslimit Risiko-Abschlag C', cls: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/35' }
                                                            : resolvedSellType === 'order'
                                                                ? { label: 'VK', title: 'Offener Verkaufsauftrag', cls: 'bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/35' }
                                                                : { label: 'M', title: 'Verkaufslimit Manuell', cls: 'bg-pink-500/15 text-pink-700 dark:text-pink-300 border-pink-500/35' };
                                                return (
                                                    <span
                                                        className={cn(
                                                            "inline-flex items-center justify-center w-[26px] h-5 px-1 text-xs font-bold leading-none rounded border shrink-0",
                                                            sellBadge.cls
                                                        )}
                                                        title={sellBadge.title}
                                                    >
                                                        {sellBadge.label}
                                                    </span>
                                                );
                                            })()}
                                            <span className={cn(
                                                "font-bold tabular-nums text-[15px] xl:text-sm whitespace-nowrap leading-tight",
                                                effectiveSellLimit && "xl:min-w-[98px] xl:text-right",
                                                isOverSell ? "text-green-600 dark:text-green-400" : "text-foreground"
                                            )}>
                                                {effectiveSellLimit ? formatCurrency(effectiveSellLimit, stock.currency, false) : '-'}
                                            </span>
                                        </div>
                                        {effectiveSellLimit ? (() => {
                                            const sellGap = ((stock.currentPrice - effectiveSellLimit) / effectiveSellLimit * 100);
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
                                            "text-[15px] xl:text-sm whitespace-nowrap leading-tight tabular-nums",
                                            (() => {
                                                const dDays = currentDiv.exDate ? Math.ceil((new Date(currentDiv.exDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)) : null;
                                                if (dDays !== null && dDays < 0) return "text-[#ff1e1e] dark:text-[#ff2b2b] font-bold";
                                                if (dDays !== null && dDays >= 0 && dDays <= 14) return "text-amber-500 dark:text-amber-400 font-semibold";
                                                if (dDays !== null && dDays > 14) return "text-green-600 dark:text-green-400 font-medium";
                                                return "text-muted-foreground";
                                            })()
                                        )}>
                                            {currentDiv.exDate
                                                ? new Date(currentDiv.exDate).toLocaleDateString('de-CH', { day: '2-digit', month: '2-digit', year: '2-digit' })
                                                : '-'}
                                        </span>
                                        {currentDiv.status === 'ex-dividend' && (
                                            <span className="text-xs font-bold text-white bg-[#e61919] dark:bg-[#ff2424] px-1.5 py-0.5 rounded leading-none uppercase tracking-wide">
                                                Ex-Div
                                            </span>
                                        )}
                                    </div>
                                </td>
                                <td className={cn("px-2 xl:p-4 h-[60px] xl:h-auto text-center xl:text-right align-middle", mobilePage === 2 ? "table-cell" : "hidden xl:table-cell")}>
                                    <div className="flex flex-col items-center xl:items-end justify-center gap-0.5">
                                        <span className={cn(
                                            "text-[15px] xl:text-sm whitespace-nowrap leading-tight tabular-nums",
                                            (() => {
                                                const payDays = currentDiv.payDate ? Math.ceil((new Date(currentDiv.payDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)) : null;
                                                const exDays = currentDiv.exDate ? Math.ceil((new Date(currentDiv.exDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)) : null;
                                                if (payDays !== null && payDays < 0) return "text-green-600 dark:text-green-400 font-semibold";
                                                if (exDays !== null && exDays < 0 && payDays !== null && payDays >= 0) return "text-amber-500 dark:text-amber-400 font-semibold";
                                                if (payDays !== null && payDays >= 0 && payDays <= 14) return "text-amber-500 dark:text-amber-400 font-semibold";
                                                return "text-muted-foreground";
                                            })()
                                        )}>
                                            {currentDiv.payDate
                                                ? new Date(currentDiv.payDate).toLocaleDateString('de-CH', { day: '2-digit', month: '2-digit', year: '2-digit' })
                                                : '-'}
                                        </span>
                                        {currentDiv.status === 'paid' && (
                                            <span className="text-xs font-bold text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-950/50 px-1.5 py-0.5 rounded leading-none uppercase">
                                                Bezahlt
                                            </span>
                                        )}
                                    </div>
                                </td>
                                <td className={cn("px-2 xl:p-4 h-[60px] xl:h-auto text-center xl:pl-12 xl:sticky xl:-right-px z-10 group-hover:bg-muted/30 transition-colors xl:shadow-[-5px_0_5px_-5px_rgba(0,0,0,0.1)] align-middle", mobilePage === 3 ? "table-cell" : "hidden xl:table-cell")}>
                                    <div className="absolute inset-0 bg-card -z-10" />
                                    <div className="flex items-center justify-center gap-1.5 relative">
                                        {(() => {
                                            const memberLists = watchlists.filter(w => w.stockIds.includes(stock.id));
                                            const isInAnyList = memberLists.length > 0;
                                            return (
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        onAssignWatchlists(stock.id);
                                                    }}
                                                    className={cn(
                                                        "p-1.5 rounded-lg transition-colors cursor-pointer",
                                                        isInAnyList
                                                            ? "text-amber-500 bg-amber-500/10 hover:bg-amber-500/20"
                                                            : "text-muted-foreground bg-muted/50 hover:text-amber-500 hover:bg-amber-500/10"
                                                    )}
                                                    title={isInAnyList
                                                        ? `In Watchlists: ${memberLists.map(w => w.name).join(', ')} · Klick zum Bearbeiten`
                                                        : 'In andere Watchlists aufnehmen zum Vergleichen'}
                                                >
                                                    <Star className={cn("size-4", isInAnyList && "fill-amber-500")} />
                                                </button>
                                            );
                                        })()}
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
                                        {canRemove && (
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
                                        )}
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
