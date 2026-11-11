import { ArrowLeft, TrendingUp, RefreshCw, ShoppingBag, Trophy, Flame, Target, ChevronUp, ChevronDown, TrendingDown, PieChart, Layers } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useEffect, useState, useMemo } from 'react';
import { useCurrencyFormatter } from '../utils/currency';
import { cn } from '../utils';
import { Logo } from './Logo';
import { estimateMarketState, hasMarketOpenedToday, isAnyStockMarketActiveToday, getMarketOpeningTimeHint } from '../utils/market';
import { usePortfolio } from '../context/PortfolioContext';
import { fetchMultipleHistoricalCloses } from '../services/yahoo-finance';

export type WatchlistPeriod = '1D' | '1W' | '1M' | '3M' | '6M' | '1Y';

const PERIOD_CONFIG: { key: WatchlistPeriod; label: string; hint: string }[] = [
    { key: '1D', label: 'Heute', hint: 'Live Tag' },
    { key: '1W', label: '1 Woche', hint: '7 Tage' },
    { key: '1M', label: '1 Monat', hint: '30 Tage' },
    { key: '3M', label: '3 Monate', hint: 'Quartal' },
    { key: '6M', label: '6 Monate', hint: 'Halbjahr' },
    { key: '1Y', label: '1 Jahr', hint: '12 Monate' }
];

interface WatchlistPerformanceModalProps {
    isOpen: boolean;
    onClose: () => void;
    activeWatchlistId?: string;
    initialPeriod?: WatchlistPeriod;
}

export function WatchlistPerformanceModal({
    isOpen,
    onClose,
    activeWatchlistId,
    initialPeriod = '1D'
}: WatchlistPerformanceModalProps) {
    const { convertToCHF, formatCurrency } = useCurrencyFormatter();
    const { stocks, watchlists, positions, refreshAllPrices, isGlobalRefreshing, lastGlobalRefresh } = usePortfolio();
    const navigate = useNavigate();

    const [selectedPeriod, setSelectedPeriod] = useState<WatchlistPeriod>(initialPeriod);
    const [periodData, setPeriodData] = useState<Record<string, { baselinePrice: number; gainPercent: number; startDate: string }>>({});
    const [isLoadingPeriod, setIsLoadingPeriod] = useState<boolean>(false);

    // Sorting config
    const [sortConfig, setSortConfig] = useState<{
        key: 'rank' | 'name' | 'price' | 'gain' | 'gap' | 'total';
        direction: 'asc' | 'desc';
    }>({ key: 'gain', direction: 'desc' });

    // Sync initialPeriod if prop changes
    useEffect(() => {
        if (initialPeriod) {
            setSelectedPeriod(initialPeriod);
        }
    }, [initialPeriod]);

    const [currentWatchlistId, setCurrentWatchlistId] = useState(activeWatchlistId || 'owned');

    useEffect(() => {
        if (activeWatchlistId) {
            setCurrentWatchlistId(activeWatchlistId);
        }
    }, [activeWatchlistId]);

    // Get stock IDs based on the active watchlist
    const activeWatchlist = currentWatchlistId && currentWatchlistId !== 'owned'
        ? watchlists.find(w => w.id === currentWatchlistId)
        : null;

    let watchlistStockIds: string[];
    if (currentWatchlistId === 'owned' || !currentWatchlistId) {
        // "Bestand" mode or no specific tab: show all stocks that have positions
        watchlistStockIds = stocks
            .filter(s => positions.some(p => String(p.stockId) === String(s.id)))
            .map(s => s.id);
    } else if (activeWatchlist) {
        watchlistStockIds = activeWatchlist.stockIds || [];
    } else {
        // Fallback to default watchlist
        const defaultWatchlist = watchlists.find(w => w.isDefault) || watchlists[0];
        watchlistStockIds = defaultWatchlist?.stockIds || [];
    }

    // Determine active tab name for the subtitle
    const activeTabName = currentWatchlistId === 'owned'
        ? 'Bestand'
        : activeWatchlist?.name || 'Alle Aktien';

    const isAnyActiveToday = isAnyStockMarketActiveToday(
        stocks.map(s => ({ symbol: s.symbol, currency: s.currency }))
    );

    const relevantStocks = useMemo(() => {
        return stocks.filter(s => watchlistStockIds.includes(s.id));
    }, [stocks, watchlistStockIds]);

    const [assetFilter, setAssetFilter] = useState<'all' | 'stock' | 'etf'>('stock');

    const stockCount = useMemo(() => relevantStocks.filter(s => !s.type || s.type === 'stock').length, [relevantStocks]);
    const etfCount = useMemo(() => relevantStocks.filter(s => s.type === 'etf').length, [relevantStocks]);

    // Filter stocks based on assetFilter
    const filteredStocks = useMemo(() => {
        if (stockCount > 0 && etfCount > 0) {
            if (assetFilter === 'stock') {
                return relevantStocks.filter(s => !s.type || s.type === 'stock');
            }
            if (assetFilter === 'etf') {
                return relevantStocks.filter(s => s.type === 'etf');
            }
        }
        return relevantStocks;
    }, [relevantStocks, assetFilter, stockCount, etfCount]);

    // Fetch historical data for periods other than '1D'
    useEffect(() => {
        if (!isOpen || selectedPeriod === '1D' || relevantStocks.length === 0) {
            return;
        }

        let isCancelled = false;

        async function loadHistoricalData() {
            setIsLoadingPeriod(true);
            try {
                const symbols = relevantStocks.map(s => s.symbol).filter(Boolean);
                const range = selectedPeriod as '1W' | '1M' | '3M' | '6M' | '1Y';
                const histMap = await fetchMultipleHistoricalCloses(symbols, range);

                if (isCancelled) return;

                const newMap: Record<string, { baselinePrice: number; gainPercent: number; startDate: string }> = {};

                for (const stock of relevantStocks) {
                    const h = histMap[stock.symbol.toUpperCase()];
                    if (h && h.close > 0) {
                        const cur = stock.currentPrice || h.close;
                        const gainPct = ((cur - h.close) / h.close) * 100;
                        newMap[stock.id] = {
                            baselinePrice: h.close,
                            gainPercent: gainPct,
                            startDate: h.startDate
                        };
                    }
                }

                setPeriodData(newMap);
            } catch (err) {
                console.error('[WatchlistPerformanceModal] Error loading period data:', err);
            } finally {
                if (!isCancelled) {
                    setIsLoadingPeriod(false);
                }
            }
        }

        loadHistoricalData();

        return () => {
            isCancelled = true;
        };
    }, [isOpen, selectedPeriod, relevantStocks]);

    // Enrich stock data
    const enrichedData = useMemo(() => {
        return filteredStocks.map(stock => {
            const pos = positions.find(p => String(p.stockId) === String(stock.id));
            const hasOpenedToday = hasMarketOpenedToday(stock.symbol, stock.currency);
            const shouldCalcDaily = !isAnyActiveToday || hasOpenedToday;

            // Daily 1D
            let dailyChange = 0;
            let dailyGainPercent = 0;
            let dailyGainCHF = 0;

            if (shouldCalcDaily) {
                dailyChange = stock.currentPrice - (stock.previousClose || stock.currentPrice);
                dailyGainPercent = stock.previousClose ? (dailyChange / stock.previousClose) * 100 : 0;
                dailyGainCHF = pos ? dailyChange * pos.shares : 0;
            }

            // Period Data (1W, 1M, 3M, 6M, 1Y)
            const pData = periodData[stock.id];
            const isPeriod = selectedPeriod !== '1D';
            const effectiveGainPercent = isPeriod
                ? (pData?.gainPercent ?? 0)
                : dailyGainPercent;
            const baselinePrice = isPeriod
                ? (pData?.baselinePrice ?? stock.currentPrice)
                : (stock.previousClose || stock.currentPrice);

            // Total Performance if owned (FX-aware)
            let totalGainPercent = 0;
            let totalGainCHF = 0;
            if (pos) {
                const currentValue = pos.shares * stock.currentPrice;
                const purchaseValue = (pos.purchases || []).reduce((sum: number, purchase: any) =>
                    sum + (purchase.shares * purchase.price), 0);
                const currentValueCHF = convertToCHF(currentValue, stock.currency);
                const entryFxRate = pos.averageEntryFxRate || 1;
                const purchaseValueCHF = stock.currency !== 'CHF'
                    ? purchaseValue * entryFxRate
                    : purchaseValue;
                totalGainCHF = currentValueCHF - purchaseValueCHF;
                totalGainPercent = purchaseValueCHF > 0 ? (totalGainCHF / purchaseValueCHF) * 100 : 0;
            }

            const targetPrice = stock.targetPrice;
            const buyGap = targetPrice ? ((stock.currentPrice - targetPrice) / targetPrice * 100) : null;
            const isLimitReached = buyGap !== null && buyGap <= 0;

            return {
                stock,
                pos,
                isOwned: !!pos,
                dailyChange,
                dailyGainPercent,
                dailyGainCHF,
                baselinePrice,
                effectiveGainPercent,
                hasPeriodData: !isPeriod || Boolean(pData),
                periodStartDate: pData?.startDate,
                totalGainPercent,
                totalGainCHF,
                targetPrice,
                buyGap,
                isLimitReached
            };
        });
    }, [filteredStocks, positions, periodData, selectedPeriod, isAnyActiveToday, convertToCHF]);

    // Sorting
    const sortedData = useMemo(() => {
        return [...enrichedData].sort((a, b) => {
            const dir = sortConfig.direction === 'desc' ? -1 : 1;
            if (sortConfig.key === 'gain') {
                return (a.effectiveGainPercent - b.effectiveGainPercent) * dir;
            }
            if (sortConfig.key === 'price') {
                return (a.stock.currentPrice - b.stock.currentPrice) * dir;
            }
            if (sortConfig.key === 'name') {
                return a.stock.name.localeCompare(b.stock.name) * dir;
            }
            if (sortConfig.key === 'gap') {
                const gapA = a.buyGap !== null ? a.buyGap : 9999;
                const gapB = b.buyGap !== null ? b.buyGap : 9999;
                return (gapA - gapB) * dir;
            }
            if (sortConfig.key === 'total') {
                return (a.totalGainPercent - b.totalGainPercent) * dir;
            }
            return (a.effectiveGainPercent - b.effectiveGainPercent) * dir;
        });
    }, [enrichedData, sortConfig]);

    // Key statistics for the selected period
    const stats = useMemo(() => {
        if (enrichedData.length === 0) return null;

        const sortedByGain = [...enrichedData].sort((a, b) => b.effectiveGainPercent - a.effectiveGainPercent);
        const best = sortedByGain[0];
        const worst = sortedByGain[sortedByGain.length - 1];

        const sumGains = enrichedData.reduce((sum, d) => sum + d.effectiveGainPercent, 0);
        const avgGain = sumGains / enrichedData.length;
        const winners = enrichedData.filter(d => d.effectiveGainPercent > 0.005).length;
        const losers = enrichedData.filter(d => d.effectiveGainPercent < -0.005).length;

        // Max abs gain for relative visual progress bar
        const maxAbsGain = Math.max(
            ...enrichedData.map(d => Math.abs(d.effectiveGainPercent)),
            1
        );

        return {
            best,
            worst,
            avgGain,
            winners,
            losers,
            maxAbsGain
        };
    }, [enrichedData]);

    const handleSort = (key: 'rank' | 'name' | 'price' | 'gain' | 'gap' | 'total') => {
        setSortConfig(prev => {
            if (prev.key === key) {
                return { key, direction: prev.direction === 'desc' ? 'asc' : 'desc' };
            }
            return { key, direction: key === 'name' ? 'asc' : 'desc' };
        });
    };

    const handleRowClick = (stockId: string) => {
        navigate(`/stock/${stockId}?from=watchlist-performance`);
        onClose();
    };

    if (!isOpen) return null;

    const isPeriodMode = selectedPeriod !== '1D';

    return (
        <div className="flex-1 min-h-0 flex flex-col rounded-xl border border-border bg-card shadow-sm overflow-hidden w-full h-full animate-in fade-in duration-150">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 sm:p-4 border-b border-border bg-card z-10 gap-3 pl-14 xl:pl-4">
                    <div className="flex items-center gap-2.5 min-w-0">
                        <button
                            type="button"
                            onClick={onClose}
                            className="iphone-landscape-back-btn inline-flex items-center justify-center size-8 rounded-lg bg-secondary/90 hover:bg-secondary text-foreground border border-border shadow-sm shrink-0 transition-all active:scale-95 cursor-pointer"
                            title="Zurück"
                            aria-label="Zurück"
                        >
                            <ArrowLeft className="size-4" />
                        </button>
                        <div className="p-2 rounded-xl bg-gradient-to-br from-blue-500/20 to-indigo-500/20 text-blue-600 dark:text-blue-400 shrink-0 iphone-landscape-portfolio-icon">
                            <TrendingUp className="size-5" />
                        </div>
                        <div className="min-w-0">
                            <h2 className="text-base sm:text-lg font-bold truncate flex items-center gap-2">
                                <span>Watchlist Performance</span>
                                <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-primary/10 text-primary border border-primary/20 truncate">
                                    {activeTabName}
                                </span>
                            </h2>
                            <p className="text-xs text-muted-foreground hidden md:block">
                                Rangliste & Performance-Vergleich deiner beobachteten Titel
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0 flex-wrap">
                        {/* Period Selector Pills */}
                        <div className="inline-flex items-center rounded-lg border border-border bg-muted/60 p-0.5 gap-0.5 shadow-2xs">
                            {PERIOD_CONFIG.map(p => {
                                const isSelected = selectedPeriod === p.key;
                                return (
                                    <button
                                        key={p.key}
                                        type="button"
                                        onClick={() => {
                                            setSelectedPeriod(p.key);
                                            if (p.key !== '1D') {
                                                setSortConfig({ key: 'gain', direction: 'desc' });
                                            }
                                        }}
                                        className={cn(
                                            "px-2 sm:px-2.5 py-1 text-xs font-bold rounded-md transition-all cursor-pointer whitespace-nowrap",
                                            isSelected
                                                ? "bg-blue-600 text-white shadow-xs"
                                                : "text-muted-foreground hover:text-foreground hover:bg-card/70"
                                        )}
                                        title={`${p.label} (${p.hint})`}
                                    >
                                        <span>{p.label}</span>
                                    </button>
                                );
                            })}
                        </div>

                        {/* Refresh Button */}
                        <button
                            onClick={() => refreshAllPrices(true)}
                            disabled={isGlobalRefreshing}
                            className={cn(
                                "flex items-center justify-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg border text-xs font-medium transition-all shadow-sm shrink-0 whitespace-nowrap",
                                "bg-card hover:bg-muted text-foreground border-border",
                                "active:scale-95 disabled:opacity-50 cursor-pointer"
                            )}
                            title="Preise aktualisieren"
                        >
                            <RefreshCw className={cn("size-3.5", (isGlobalRefreshing || isLoadingPeriod) && "animate-spin text-blue-500")} />
                            <span className="hidden lg:inline">
                                {isGlobalRefreshing || isLoadingPeriod
                                    ? 'Lädt...'
                                    : lastGlobalRefresh
                                        ? `vor ${Math.floor((new Date().getTime() - lastGlobalRefresh.getTime()) / 60000)}m`
                                        : 'Update'}
                            </span>
                        </button>
                    </div>
                </div>

                {/* Watchlist Tabs Bar */}
            <div className="px-3 sm:px-4 py-2 border-b border-border/70 bg-muted/20 flex items-center gap-1.5 overflow-x-auto scroller-none shrink-0 pl-14 xl:pl-4">
                <button
                    type="button"
                    onClick={() => setCurrentWatchlistId('owned')}
                    className={cn(
                        "px-3 py-1 rounded-full text-xs font-semibold transition-all border shrink-0 cursor-pointer",
                        currentWatchlistId === 'owned'
                            ? "bg-primary text-primary-foreground border-primary shadow-xs"
                            : "bg-card text-muted-foreground border-border hover:bg-muted hover:text-foreground"
                    )}
                >
                    Bestand
                </button>
                {watchlists.filter(wl => !wl.isDefault).map(wl => (
                    <button
                        key={wl.id}
                        type="button"
                        onClick={() => setCurrentWatchlistId(wl.id)}
                        className={cn(
                            "px-3 py-1 rounded-full text-xs font-semibold transition-all border shrink-0 cursor-pointer whitespace-nowrap",
                            currentWatchlistId === wl.id
                                ? "bg-primary text-primary-foreground border-primary shadow-xs"
                                : "bg-card text-muted-foreground border-border hover:bg-muted hover:text-foreground"
                        )}
                    >
                        {wl.name}
                    </button>
                ))}
                {watchlists.filter(wl => wl.isDefault).map(wl => (
                    <button
                        key={wl.id}
                        type="button"
                        onClick={() => setCurrentWatchlistId(wl.id)}
                        className={cn(
                            "px-3 py-1 rounded-full text-xs font-semibold transition-all border shrink-0 cursor-pointer whitespace-nowrap",
                            currentWatchlistId === wl.id
                                ? "bg-primary text-primary-foreground border-primary shadow-xs"
                                : "bg-card text-muted-foreground border-border hover:bg-muted hover:text-foreground"
                        )}
                    >
                        {wl.name}
                    </button>
                ))}
            </div>

            {/* Sub-Tabs: Trennung Aktien / ETFs (wenn beides vorhanden ist) */}
            {stockCount > 0 && etfCount > 0 && (
                <div className="px-3 sm:px-4 py-1.5 border-b border-border/70 bg-card/60 flex items-center gap-2 overflow-x-auto scroller-none shrink-0 pl-14 xl:pl-4">
                    <button
                        type="button"
                        onClick={() => setAssetFilter('stock')}
                        className={cn(
                            "flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all border shadow-2xs shrink-0 cursor-pointer",
                            assetFilter === 'stock'
                                ? "bg-primary text-primary-foreground border-primary"
                                : "bg-card text-muted-foreground border-border hover:bg-muted hover:text-foreground"
                        )}
                    >
                        <ShoppingBag className="size-3.5" />
                        <span>Aktien</span>
                        <span className={cn(
                            "text-[10px] px-1.5 py-0.2 rounded-full font-mono",
                            assetFilter === 'stock' ? "bg-primary-foreground/20 text-primary-foreground" : "bg-muted text-muted-foreground"
                        )}>
                            {stockCount}
                        </span>
                    </button>

                    <button
                        type="button"
                        onClick={() => setAssetFilter('etf')}
                        className={cn(
                            "flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all border shadow-2xs shrink-0 cursor-pointer",
                            assetFilter === 'etf'
                                ? "bg-primary text-primary-foreground border-primary"
                                : "bg-card text-muted-foreground border-border hover:bg-muted hover:text-foreground"
                        )}
                    >
                        <PieChart className="size-3.5" />
                        <span>ETFs</span>
                        <span className={cn(
                            "text-[10px] px-1.5 py-0.2 rounded-full font-mono",
                            assetFilter === 'etf' ? "bg-primary-foreground/20 text-primary-foreground" : "bg-muted text-muted-foreground"
                        )}>
                            {etfCount}
                        </span>
                    </button>

                    <button
                        type="button"
                        onClick={() => setAssetFilter('all')}
                        className={cn(
                            "flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all border shadow-2xs shrink-0 cursor-pointer",
                            assetFilter === 'all'
                                ? "bg-primary text-primary-foreground border-primary"
                                : "bg-card text-muted-foreground border-border hover:bg-muted hover:text-foreground"
                        )}
                    >
                        <Layers className="size-3.5" />
                        <span>Alle</span>
                        <span className={cn(
                            "text-[10px] px-1.5 py-0.2 rounded-full font-mono",
                            assetFilter === 'all' ? "bg-primary-foreground/20 text-primary-foreground" : "bg-muted text-muted-foreground"
                        )}>
                            {relevantStocks.length}
                        </span>
                    </button>
                </div>
            )}

            {/* KPI Highlight Strip */}
                {stats && (
                    <div className="px-4 py-2.5 bg-muted/30 border-b border-border/70 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs shrink-0">
                        <div className="flex items-center gap-2 p-1.5 rounded-lg bg-card/60 border border-border/50">
                            <Trophy className="size-4 text-amber-400 shrink-0" />
                            <div className="min-w-0">
                                <div className="text-[10px] text-muted-foreground uppercase font-semibold">1. Platz ({selectedPeriod === '1D' ? 'Heute' : selectedPeriod})</div>
                                <div className="font-bold truncate text-foreground flex items-center gap-1">
                                    <span className="truncate">{stats.best.stock.name}</span>
                                    <span className={cn("font-mono font-bold text-xs shrink-0", stats.best.effectiveGainPercent >= 0 ? "text-green-500" : "text-red-500")}>
                                        {stats.best.effectiveGainPercent >= 0 ? '+' : ''}{stats.best.effectiveGainPercent.toFixed(1)}%
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-2 p-1.5 rounded-lg bg-card/60 border border-border/50">
                            <Flame className="size-4 text-blue-400 shrink-0" />
                            <div className="min-w-0">
                                <div className="text-[10px] text-muted-foreground uppercase font-semibold">Durchschnitt</div>
                                <div className={cn("font-mono font-bold text-sm", stats.avgGain >= 0 ? "text-green-500" : "text-red-500")}>
                                    {stats.avgGain >= 0 ? '+' : ''}{stats.avgGain.toFixed(2)}%
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-2 p-1.5 rounded-lg bg-card/60 border border-border/50">
                            <Target className="size-4 text-purple-400 shrink-0" />
                            <div className="min-w-0">
                                <div className="text-[10px] text-muted-foreground uppercase font-semibold">Gewinner / Verlierer</div>
                                <div className="font-mono font-bold text-xs text-foreground">
                                    <span className="text-green-500">{stats.winners} Plus</span>
                                    <span className="text-muted-foreground mx-1">/</span>
                                    <span className="text-red-500">{stats.losers} Minus</span>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-2 p-1.5 rounded-lg bg-card/60 border border-border/50">
                            <TrendingDown className="size-4 text-red-400 shrink-0" />
                            <div className="min-w-0">
                                <div className="text-[10px] text-muted-foreground uppercase font-semibold">Schlusslicht</div>
                                <div className="font-bold truncate text-foreground flex items-center gap-1">
                                    <span className="truncate">{stats.worst.stock.name}</span>
                                    <span className={cn("font-mono font-bold text-xs shrink-0", stats.worst.effectiveGainPercent >= 0 ? "text-green-500" : "text-red-500")}>
                                        {stats.worst.effectiveGainPercent >= 0 ? '+' : ''}{stats.worst.effectiveGainPercent.toFixed(1)}%
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Table Body */}
                <div className="flex flex-col flex-1 min-h-0 overflow-hidden iphone-modal-body-card iphone-modal-body-flush">
                    <div className="overflow-auto p-0 flex-1">
                        <table className="w-full text-xs md:text-sm border-collapse">
                            <thead>
                                <tr className="border-b border-border bg-muted/20">
                                    <th
                                        onClick={() => handleSort('gain')}
                                        className="text-center py-3 px-2 font-semibold text-muted-foreground uppercase tracking-wider sticky top-0 z-30 bg-card align-middle cursor-pointer hover:text-foreground w-12"
                                        title="Nach Rang sortieren"
                                    >
                                        <div className="flex items-center justify-center gap-0.5">
                                            <span>Rang</span>
                                            {sortConfig.key === 'gain' && (
                                                sortConfig.direction === 'desc' ? <ChevronDown className="size-3 text-primary" /> : <ChevronUp className="size-3 text-primary" />
                                            )}
                                        </div>
                                    </th>

                                    <th
                                        onClick={() => handleSort('name')}
                                        className="text-left py-3 px-4 font-semibold text-muted-foreground uppercase tracking-wider sticky top-0 z-30 bg-card align-middle cursor-pointer hover:text-foreground min-w-[220px]"
                                    >
                                        <div className="flex items-center gap-1">
                                            <span>Aktie</span>
                                            {sortConfig.key === 'name' && (
                                                sortConfig.direction === 'desc' ? <ChevronDown className="size-3 text-primary" /> : <ChevronUp className="size-3 text-primary" />
                                            )}
                                        </div>
                                    </th>

                                    {isPeriodMode && (
                                        <th className="text-right py-3 px-2 font-semibold text-muted-foreground uppercase tracking-wider sticky top-0 z-30 bg-card align-middle">
                                            Startkurs
                                        </th>
                                    )}

                                    <th
                                        onClick={() => handleSort('price')}
                                        className="text-right py-3 px-2 font-semibold text-muted-foreground uppercase tracking-wider sticky top-0 z-30 bg-card align-middle cursor-pointer hover:text-foreground"
                                    >
                                        <div className="flex items-center justify-end gap-1">
                                            <span>Aktueller Kurs</span>
                                            {sortConfig.key === 'price' && (
                                                sortConfig.direction === 'desc' ? <ChevronDown className="size-3 text-primary" /> : <ChevronUp className="size-3 text-primary" />
                                            )}
                                        </div>
                                    </th>

                                    <th
                                        onClick={() => handleSort('gain')}
                                        className="text-right py-3 px-4 font-semibold text-muted-foreground uppercase tracking-wider sticky top-0 z-30 bg-card align-middle cursor-pointer hover:text-foreground min-w-[140px]"
                                    >
                                        <div className="flex items-center justify-end gap-1">
                                            <span>{isPeriodMode ? `Rendite (${selectedPeriod})` : 'Tag %'}</span>
                                            {sortConfig.key === 'gain' && (
                                                sortConfig.direction === 'desc' ? <ChevronDown className="size-3 text-primary" /> : <ChevronUp className="size-3 text-primary" />
                                            )}
                                        </div>
                                    </th>

                                    {!isPeriodMode && (
                                        <th className="text-right py-3 px-2 font-semibold text-muted-foreground uppercase tracking-wider sticky top-0 z-30 bg-card align-middle">
                                            Tag CHF
                                        </th>
                                    )}

                                    <th
                                        onClick={() => handleSort('gap')}
                                        className="text-right py-3 px-3 font-semibold text-muted-foreground uppercase tracking-wider border-l border-border/50 sticky top-0 z-30 bg-card align-middle cursor-pointer hover:text-foreground"
                                    >
                                        <div className="flex items-center justify-end gap-1">
                                            <span>Kauflimit & Gap</span>
                                            {sortConfig.key === 'gap' && (
                                                sortConfig.direction === 'desc' ? <ChevronDown className="size-3 text-primary" /> : <ChevronUp className="size-3 text-primary" />
                                            )}
                                        </div>
                                    </th>

                                    <th
                                        onClick={() => handleSort('total')}
                                        className="text-right py-3 px-4 font-semibold text-muted-foreground uppercase tracking-wider sticky top-0 z-30 bg-card align-middle cursor-pointer hover:text-foreground"
                                    >
                                        <div className="flex items-center justify-end gap-1">
                                            <span>Portfolio</span>
                                            {sortConfig.key === 'total' && (
                                                sortConfig.direction === 'desc' ? <ChevronDown className="size-3 text-primary" /> : <ChevronUp className="size-3 text-primary" />
                                            )}
                                        </div>
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border/50">
                                {sortedData.map((item, idx) => {
                                    const {
                                        stock,
                                        isOwned,
                                        pos,
                                        dailyGainPercent,
                                        dailyGainCHF,
                                        baselinePrice,
                                        effectiveGainPercent,
                                        totalGainPercent,
                                        totalGainCHF,
                                        targetPrice,
                                        buyGap,
                                        isLimitReached
                                    } = item;

                                    const calcState = estimateMarketState(stock.symbol, stock.currency);
                                    const isMarketOpen = calcState === 'REGULAR';
                                    const hasOpenedToday = hasMarketOpenedToday(stock.symbol, stock.currency);
                                    const isWaitingForOpen = isAnyActiveToday && !hasOpenedToday;
                                    const openingHint = getMarketOpeningTimeHint(stock.symbol, stock.currency);

                                    const isPos = effectiveGainPercent > 0.005;
                                    const isNeg = effectiveGainPercent < -0.005;
                                    const isZero = !isPos && !isNeg;

                                    // Medal for rank
                                    const rankNumber = idx + 1;
                                    const rankBadge = rankNumber === 1
                                        ? (
                                            <div
                                                className={cn(
                                                    "size-6 sm:size-7 rounded-full border flex items-center justify-center text-sm shadow-xs",
                                                    isNeg
                                                        ? "bg-red-500/15 border-red-500/40 text-red-400"
                                                        : "bg-gradient-to-br from-amber-400/25 to-yellow-600/15 border-amber-400/40"
                                                )}
                                                title="1. Platz"
                                            >
                                                🥇
                                            </div>
                                        )
                                        : rankNumber === 2
                                            ? (
                                                <div
                                                    className={cn(
                                                        "size-6 sm:size-7 rounded-full border flex items-center justify-center text-sm shadow-xs",
                                                        isNeg
                                                            ? "bg-red-500/15 border-red-500/40 text-red-400"
                                                            : "bg-gradient-to-br from-slate-300/25 to-slate-500/15 border-slate-300/40"
                                                    )}
                                                    title="2. Platz"
                                                >
                                                    🥈
                                                </div>
                                            )
                                            : rankNumber === 3
                                                ? (
                                                    <div
                                                        className={cn(
                                                            "size-6 sm:size-7 rounded-full border flex items-center justify-center text-sm shadow-xs",
                                                            isNeg
                                                                ? "bg-red-500/15 border-red-500/40 text-red-400"
                                                                : "bg-gradient-to-br from-amber-700/25 to-amber-900/15 border-amber-600/40"
                                                        )}
                                                        title="3. Platz"
                                                    >
                                                        🥉
                                                    </div>
                                                )
                                                : (
                                                    <div
                                                        className={cn(
                                                            "size-6 sm:size-7 rounded-full font-mono font-bold text-xs flex items-center justify-center shadow-2xs border transition-colors",
                                                            isPos
                                                                ? "bg-green-500/15 border-green-500/35 text-green-600 dark:text-green-400"
                                                                : isNeg
                                                                    ? "bg-red-500/15 border-red-500/35 text-red-600 dark:text-red-400"
                                                                    : "bg-muted/70 border-border/80 text-muted-foreground"
                                                        )}
                                                        title={`${rankNumber}. Platz (${isPos ? 'Im Plus' : isNeg ? 'Im Minus' : 'Neutral'})`}
                                                    >
                                                        {rankNumber}
                                                    </div>
                                                );

                                    // Bar calculation relative to maximum absolute gain
                                    const barWidth = stats?.maxAbsGain
                                        ? Math.min(100, Math.max(6, (Math.abs(effectiveGainPercent) / stats.maxAbsGain) * 100))
                                        : 0;

                                    return (
                                        <tr
                                            key={stock.id}
                                            onClick={() => handleRowClick(stock.id)}
                                            className="hover:bg-muted/30 transition-colors cursor-pointer group"
                                        >
                                            {/* Rank */}
                                            <td className="py-2.5 sm:py-3 px-2 text-center bg-card group-hover:bg-muted/30 transition-colors w-12">
                                                <div className="flex items-center justify-center">
                                                    {rankBadge}
                                                </div>
                                            </td>

                                            {/* Stock Info */}
                                            <td className="py-2.5 sm:py-3 px-3 sm:px-4 bg-card group-hover:bg-muted/30 transition-colors min-w-[220px]">
                                                <div className="flex items-center gap-2.5 sm:gap-3">
                                                    <Logo
                                                        url={stock.logoUrl}
                                                        alt={stock.name}
                                                        fallback={stock.symbol.slice(0, 2)}
                                                        size="size-8 sm:size-9"
                                                    />
                                                    <div className="flex flex-col min-w-0 flex-1">
                                                        <div className="flex items-start gap-1.5">
                                                            <span
                                                                className="font-bold text-xs sm:text-sm whitespace-pre-line line-clamp-2 group-hover:text-primary transition-colors leading-snug break-words"
                                                                title={stock.name}
                                                            >
                                                                {stock.name}
                                                            </span>
                                                            {isMarketOpen ? (
                                                                <div className="size-2 rounded-full bg-green-500 animate-pulse shrink-0 mt-1 border border-background shadow-[0_0_8px_rgba(34,197,94,0.4)]" title="Markt geöffnet" />
                                                            ) : (
                                                                <div className="size-2 rounded-full bg-red-500 shrink-0 mt-1 border border-background" title={isWaitingForOpen ? `${openingHint} (${calcState})` : `Markt geschlossen (${calcState})`} />
                                                            )}
                                                        </div>
                                                        <div className="flex items-center gap-1.5 sm:gap-2 text-[10px] text-muted-foreground font-mono mt-0.5">
                                                            <span className="shrink-0">{stock.symbol}</span>
                                                            {stock.sector && (
                                                                <>
                                                                    <span>•</span>
                                                                    <span className="truncate max-w-[140px]">{stock.sector}</span>
                                                                </>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>

                                            {/* Start Price (Period Mode) */}
                                            {isPeriodMode && (
                                                <td className="py-3 px-2 text-right font-mono text-muted-foreground whitespace-nowrap">
                                                    {isLoadingPeriod ? (
                                                        <span className="animate-pulse">...</span>
                                                    ) : (
                                                        formatCurrency(baselinePrice, stock.currency, false)
                                                    )}
                                                </td>
                                            )}

                                            {/* Current Price */}
                                            <td className="py-3 px-2 text-right font-bold font-mono whitespace-nowrap">
                                                {formatCurrency(stock.currentPrice, stock.currency, false)}
                                            </td>

                                            {/* Gain / Performance */}
                                            <td className="py-3 px-4 text-right whitespace-nowrap min-w-[140px]">
                                                {isPeriodMode ? (
                                                    isLoadingPeriod ? (
                                                        <div className="font-mono text-xs text-muted-foreground animate-pulse">Lade...</div>
                                                    ) : (
                                                        <div className="flex flex-col items-end gap-1">
                                                            <div className={cn(
                                                                "font-mono font-bold text-sm sm:text-base",
                                                                isZero
                                                                    ? "text-muted-foreground"
                                                                    : isPos
                                                                        ? "text-green-600 dark:text-green-400"
                                                                        : "text-red-600 dark:text-red-400"
                                                            )}>
                                                                {isZero ? '0.00%' : `${isPos ? '+' : ''}${effectiveGainPercent.toFixed(2)}%`}
                                                            </div>
                                                            {/* Mini Visual Bar */}
                                                            <div className="w-24 h-1.5 bg-muted rounded-full overflow-hidden flex justify-start">
                                                                <div
                                                                    className={cn(
                                                                        "h-full rounded-full transition-all duration-500",
                                                                        isPos ? "bg-green-500" : "bg-red-500"
                                                                    )}
                                                                    style={{ width: `${barWidth}%` }}
                                                                />
                                                            </div>
                                                        </div>
                                                    )
                                                ) : (
                                                    <div className={cn(
                                                        "font-mono font-bold text-sm",
                                                        isWaitingForOpen
                                                            ? "text-muted-foreground/60"
                                                            : isDailyZero(dailyGainPercent)
                                                                ? "text-muted-foreground"
                                                                : dailyGainPercent >= 0
                                                                    ? "text-green-600 dark:text-green-400"
                                                                    : "text-red-600 dark:text-red-400"
                                                    )}>
                                                        {isWaitingForOpen || isDailyZero(dailyGainPercent) ? '0.00%' : `${dailyGainPercent >= 0 ? '+' : ''}${dailyGainPercent.toFixed(2)}%`}
                                                    </div>
                                                )}
                                            </td>

                                            {/* Tag CHF (only 1D mode) */}
                                            {!isPeriodMode && (
                                                <td className="py-3 px-2 text-right font-semibold font-mono whitespace-nowrap opacity-80">
                                                    {isOwned ? (
                                                        <span className={cn(dailyGainPercent >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400")}>
                                                            {dailyGainPercent >= 0 ? '+' : ''}{formatCurrency(convertToCHF(dailyGainCHF, stock.currency), 'CHF').replace('CHF', '').trim()}
                                                        </span>
                                                    ) : (
                                                        <span className="text-muted-foreground/30">-</span>
                                                    )}
                                                </td>
                                            )}

                                            {/* Kauflimit & Gap */}
                                            <td className="py-3 px-3 text-right border-l border-border/50 whitespace-nowrap">
                                                {targetPrice ? (
                                                    <div className="flex flex-col items-end">
                                                        <div className="font-mono text-xs font-medium text-foreground">
                                                            {formatCurrency(targetPrice, stock.currency, false)}
                                                        </div>
                                                        <div className={cn(
                                                            "font-mono text-[11px] font-bold flex items-center gap-0.5",
                                                            isLimitReached ? "text-green-600 dark:text-green-400 font-black animate-pulse" : "text-muted-foreground"
                                                        )}>
                                                            {buyGap !== null ? `${buyGap > 0 ? '+' : ''}${buyGap.toFixed(1)}%` : '-'}
                                                            {isLimitReached && <ShoppingBag className="size-3 inline-block ml-0.5" />}
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <span className="text-muted-foreground/40 text-xs">Kein Limit</span>
                                                )}
                                            </td>

                                            {/* Portfolio Status */}
                                            <td className="py-3 px-4 bg-muted/10 whitespace-nowrap">
                                                {isOwned && pos ? (
                                                    <div className="flex flex-col items-end">
                                                        <div className="text-[10px] text-muted-foreground font-semibold">
                                                            {pos.shares} Stk. im Depot
                                                        </div>
                                                        <div className={cn(
                                                            "font-bold text-xs font-mono",
                                                            totalGainPercent >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
                                                        )}>
                                                            {totalGainPercent >= 0 ? '+' : ''}{totalGainPercent.toFixed(1)}% ({formatCurrency(totalGainCHF, 'CHF', false)})
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="text-right">
                                                        <span className="text-[10px] text-muted-foreground/50 uppercase tracking-wider font-semibold">
                                                            Watchlist
                                                        </span>
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    {/* Footer */}
                    <div className="p-3 bg-muted/20 border-t border-border text-[10px] text-muted-foreground flex justify-between items-center flex-wrap gap-2">
                        <div>{filteredStocks.length} Titel in <strong className="text-foreground">{activeTabName}</strong>{stockCount > 0 && etfCount > 0 && assetFilter !== 'all' ? ` (${assetFilter === 'stock' ? 'Aktien' : 'ETFs'})` : ''}</div>
                        <div className="flex items-center gap-2">
                            <span>Klick auf eine Zeile öffnet die Detailanalyse & den Fairen Wert</span>
                        </div>
                    </div>
                </div>
        </div>
    );
}

function isDailyZero(val: number): boolean {
    return Math.abs(val) < 0.005;
}
