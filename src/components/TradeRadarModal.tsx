import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import {
    X,
    Radar,
    Target,
    Search,
    RefreshCw,
    ShoppingBag,
    Eye,
    TrendingUp,
    TrendingDown,
    Flame,
    ShieldAlert,
    Telescope,
    ArrowUpRight,
    ArrowDownRight,
    Layers,
    Activity,
    ArrowUpDown,
    ChevronDown,
    Check
} from 'lucide-react';
import { Logo } from './Logo';
import { StockName } from './StockName';
import { cn } from '../utils';
import type { Watchlist } from '../types';
import type { RadarCategory, TradeRadarItem, TradeRadarSummary } from '../utils/tradeRadar';

interface TradeRadarModalProps {
    isOpen: boolean;
    onClose: () => void;
    radar: TradeRadarSummary;
    initialTradeMode?: 'buy' | 'sell';
    initialCategory?: RadarCategory;
    initialSourceFilter?: string;
    initialSearchTerm?: string;
    highlightStockId?: string;
    highlightSymbol?: string;
    watchlists: Watchlist[];
    isRefreshing?: boolean;
    onRefreshPrices?: () => void;
    onSelectForTrade: (stockId: string, tradeMode: 'buy' | 'sell', suggestedPrice?: number) => void;
}

const fmtPrice = (val: number | null | undefined, currency: string) => {
    if (val === null || val === undefined || !isFinite(val) || val <= 0) return '—';
    return `${val.toLocaleString('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
};

const getModeBadgeMeta = (
    type: TradeRadarItem['buyLimitType'],
    colorMode: TradeRadarItem['buyLimitColorMode']
): { label: string; cls: string } => {
    const colorCls =
        colorMode === 'quality'
            ? 'bg-purple-500/15 text-purple-400 border-purple-500/35'
            : colorMode === 'risk'
                ? 'bg-amber-500/15 text-amber-400 border-amber-500/35'
                : colorMode === 'manual'
                    ? 'bg-pink-500/15 text-pink-400 border-pink-500/35'
                    : 'bg-blue-500/15 text-blue-400 border-blue-500/35';

    if (type === 'fairValue') return { label: 'FW', cls: colorCls };
    if (type === 'quality') return { label: 'B', cls: colorCls };
    if (type === 'risk') return { label: 'C', cls: colorCls };
    if (type === 'manual') return { label: 'M', cls: colorCls };
    if (type === 'order') return { label: 'AFT', cls: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/35' };
    return { label: 'A', cls: colorCls };
};

export function TradeRadarModal({
    isOpen,
    onClose,
    radar,
    initialTradeMode = 'buy',
    initialCategory = 'all_assets',
    initialSourceFilter,
    initialSearchTerm = '',
    highlightStockId,
    highlightSymbol,
    watchlists,
    isRefreshing = false,
    onRefreshPrices,
    onSelectForTrade
}: TradeRadarModalProps) {
    const navigate = useNavigate();

    const [radarMode, setRadarMode] = useState<'buy' | 'sell'>(initialTradeMode);
    const [activeCategory, setActiveCategory] = useState<RadarCategory>(initialCategory);
    // 'all' | 'portfolio_all' | 'portfolio_stock' | 'portfolio_etf' | 'watchlist_all' | 'wl:<id>'
    const [sourceFilter, setSourceFilter] = useState<string>(initialSourceFilter || 'all');
    const [openDropdown, setOpenDropdown] = useState<'portfolio' | 'watchlist' | null>(null);
    const dropdownContainerRef = useRef<HTMLDivElement>(null);
    const highlightRowRef = useRef<HTMLTableRowElement | null>(null);
    const [searchTerm, setSearchTerm] = useState(initialSearchTerm);
    const [sortConfig, setSortConfig] = useState<{
        key: 'default' | 'name' | 'signal' | 'price' | 'limit' | 'fairValue';
        direction: 'asc' | 'desc';
    }>({ key: 'default', direction: 'asc' });
    const hasAutoSyncedSma200Ref = useRef(false);

    const handleSort = (key: 'name' | 'signal' | 'price' | 'limit' | 'fairValue') => {
        setSortConfig(prev => {
            if (prev.key === key) {
                return { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
            }
            const defaultDir: 'asc' | 'desc' =
                key === 'signal' || key === 'price'
                    ? 'desc'
                    : (key === 'limit' || key === 'fairValue') && radarMode === 'sell'
                        ? 'desc'
                        : 'asc';
            return { key, direction: defaultDir };
        });
    };

    const sortedWatchlists = useMemo(
        () => [...watchlists].sort((a, b) => a.name.localeCompare(b.name, 'de', { sensitivity: 'base' })),
        [watchlists]
    );
    const isPortfolioSource = sourceFilter.startsWith('portfolio_');
    const isWatchlistSource = sourceFilter === 'watchlist_all' || sourceFilter.startsWith('wl:');

    // Einmalig automatisch GD 200 nachladen, wenn beim Öffnen des Radars mehr als die Hälfte der Titel noch keinen GD 200 hat
    useEffect(() => {
        if (!isOpen || hasAutoSyncedSma200Ref.current || isRefreshing || !onRefreshPrices) return;
        if (radar.items.length === 0) return;
        const withGd200Count = radar.items.filter(i => i.twoHundredDayAverage && i.twoHundredDayAverage > 0).length;
        if (withGd200Count < Math.ceil(radar.items.length * 0.5)) {
            hasAutoSyncedSma200Ref.current = true;
            onRefreshPrices();
        }
    }, [isOpen, radar.items, isRefreshing, onRefreshPrices]);

    useEffect(() => {
        if (isOpen) {
            const derivedMode: 'buy' | 'sell' =
                initialCategory === 'sell_approaching' || initialCategory === 'sell_reached'
                    ? 'sell'
                    : initialCategory === 'buy_limit' || initialCategory === 'zone1' || initialCategory === 'zone2' || initialCategory === 'zone3' || initialCategory === 'below_sma200'
                        ? 'buy'
                        : initialTradeMode;
            setRadarMode(derivedMode);
            setActiveCategory(initialCategory);
            setSearchTerm(initialSearchTerm || '');
            setOpenDropdown(null);
            if (initialSourceFilter) {
                setSourceFilter(initialSourceFilter);
            } else if (initialSearchTerm) {
                setSourceFilter('all');
            }
        }
    }, [isOpen, initialTradeMode, initialCategory, initialSourceFilter, initialSearchTerm]);

    useEffect(() => {
        if (!isOpen || (!highlightStockId && !highlightSymbol)) return;
        const timer = window.setTimeout(() => {
            highlightRowRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
        }, 60);
        return () => window.clearTimeout(timer);
    }, [isOpen, highlightStockId, highlightSymbol, sourceFilter]);

    const clearPrefilledSearchIfActive = () => {
        if (initialSearchTerm && searchTerm.trim().toLowerCase() === initialSearchTerm.trim().toLowerCase()) {
            setSearchTerm('');
        }
    };

    const handleSwitchRadarMode = (nextMode: 'buy' | 'sell') => {
        if (nextMode === radarMode) return;
        setRadarMode(nextMode);
        setActiveCategory('all_assets');
        clearPrefilledSearchIfActive();
    };

    useEffect(() => {
        if (!isOpen) return;
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                if (openDropdown) {
                    setOpenDropdown(null);
                } else {
                    onClose();
                }
            }
        };
        const onPointerDown = (e: MouseEvent) => {
            if (dropdownContainerRef.current && !dropdownContainerRef.current.contains(e.target as Node)) {
                setOpenDropdown(null);
            }
        };
        window.addEventListener('keydown', onKeyDown);
        window.addEventListener('mousedown', onPointerDown);
        return () => {
            window.removeEventListener('keydown', onKeyDown);
            window.removeEventListener('mousedown', onPointerDown);
        };
    }, [isOpen, onClose, openDropdown]);

    // Scope + watchlist filters (without search) so KPI card counts stay informative even when pre-filtered to one stock
    const scopeFilteredItems = useMemo(() => {
        return radar.items.filter(item => {
            if (sourceFilter === 'portfolio_all' && !item.inPortfolio) return false;
            if (sourceFilter === 'portfolio_stock' && (!item.inPortfolio || item.assetType !== 'stock')) return false;
            if (sourceFilter === 'portfolio_etf' && (!item.inPortfolio || item.assetType !== 'etf')) return false;
            if (sourceFilter === 'watchlist_all' && item.watchlistIds.length === 0) return false;
            if (sourceFilter.startsWith('wl:')) {
                const wlId = sourceFilter.slice(3);
                if (!item.watchlistIds.includes(wlId)) return false;
            }
            return true;
        });
    }, [radar.items, sourceFilter]);

    const scopedItems = useMemo(() => {
        const term = searchTerm.trim().toLowerCase();
        if (!term) return scopeFilteredItems;
        // Wenn gezielt von einer Aktie (z. B. MO) geöffnet: exakt diese Aktie anzeigen statt Teilstring-Treffer wie "ExxonMobil"
        const isPrefilledFocus = Boolean(
            highlightStockId &&
            initialSearchTerm &&
            term === initialSearchTerm.trim().toLowerCase()
        );
        if (isPrefilledFocus) {
            return scopeFilteredItems.filter(item =>
                String(item.stock.id) === String(highlightStockId) ||
                item.stock.symbol.trim().toLowerCase() === term
            );
        }
        return scopeFilteredItems.filter(item => {
            const hay = `${item.stock.name} ${item.stock.symbol} ${item.stock.isin || ''} ${item.stock.sector || ''}`.toLowerCase();
            return hay.includes(term);
        });
    }, [scopeFilteredItems, searchTerm, highlightStockId, initialSearchTerm]);

    const scopedCounts = useMemo(() => {
        const buySignals = scopeFilteredItems.filter(i => i.isBuyLimitReached || i.buyZone !== null || i.isBelowSma200).length;
        const sellSignals = scopeFilteredItems.filter(i => i.sellStatus !== null).length;
        const sellCandidates = scopeFilteredItems.filter(i => i.inPortfolio || i.hasExplicitSellLimit).length;
        return {
            allSignals: scopeFilteredItems.filter(i => i.hasAnySignal).length,
            buySignals,
            sellSignals,
            sellCandidates,
            buyLimit: scopeFilteredItems.filter(i => i.isBuyLimitReached).length,
            zone1: scopeFilteredItems.filter(i => i.buyZone === 1).length,
            zone2: scopeFilteredItems.filter(i => i.buyZone === 2).length,
            zone3: scopeFilteredItems.filter(i => i.buyZone === 3).length,
            belowSma200: scopeFilteredItems.filter(i => i.isBelowSma200).length,
            sellApproaching: scopeFilteredItems.filter(i => i.sellStatus === 'approaching').length,
            sellReached: scopeFilteredItems.filter(i => i.sellStatus === 'reached').length,
            allAssets: scopeFilteredItems.length
        };
    }, [scopeFilteredItems]);

    const visibleItems = useMemo(() => {
        const list = scopedItems.filter(item => {
            if (radarMode === 'buy') {
                switch (activeCategory) {
                    case 'buy_limit':
                        return item.isBuyLimitReached;
                    case 'zone1':
                        return item.buyZone === 1;
                    case 'zone2':
                        return item.buyZone === 2;
                    case 'zone3':
                        return item.buyZone === 3;
                    case 'below_sma200':
                        return item.isBelowSma200;
                    case 'all_assets':
                        return true;
                    case 'all_signals':
                    default:
                        return item.isBuyLimitReached || item.buyZone !== null || item.isBelowSma200;
                }
            }

            // Verkaufs-Modus: strikt nur Verkaufs-Signale bzw. Bestände & gesetzte Verkaufslimite
            switch (activeCategory) {
                case 'sell_approaching':
                    return item.sellStatus === 'approaching';
                case 'sell_reached':
                    return item.sellStatus === 'reached';
                case 'all_assets':
                    return isWatchlistSource ? true : (item.inPortfolio || item.hasExplicitSellLimit);
                case 'all_signals':
                default:
                    return item.sellStatus !== null;
            }
        });

        const compareName = (a: TradeRadarItem, b: TradeRadarItem) => {
            const nameCmp = (a.stock.name || a.stock.symbol || '').trim().localeCompare(
                (b.stock.name || b.stock.symbol || '').trim(),
                'de',
                { sensitivity: 'base' }
            );
            if (nameCmp !== 0) return nameCmp;
            return (a.stock.symbol || '').localeCompare(b.stock.symbol || '', 'de', { sensitivity: 'base' });
        };

        const signalRank = (item: TradeRadarItem): number => {
            if (radarMode === 'sell') {
                if (item.sellStatus === 'reached') return 3;
                if (item.sellStatus === 'approaching') return 2;
                if (item.isOvervaluedWatchlist) return 1;
                return 0;
            }
            if (item.isBuyLimitReached) return 5;
            if (item.buyZone === 3) return 4;
            if (item.buyZone === 2) return 3;
            if (item.buyZone === 1) return 2;
            if (item.isBelowSma200) return 1;
            return 0;
        };

        const dir = sortConfig.direction === 'asc' ? 1 : -1;

        return [...list].sort((a, b) => {
            if (sortConfig.key === 'default') {
                if (a.inPortfolio !== b.inPortfolio) {
                    return a.inPortfolio ? -1 : 1;
                }
                return compareName(a, b);
            }
            if (sortConfig.key === 'name') {
                return compareName(a, b) * dir;
            }
            if (sortConfig.key === 'signal') {
                const rankDiff = signalRank(a) - signalRank(b);
                if (rankDiff !== 0) return rankDiff * dir;
                const urgDiff = a.urgencyScore - b.urgencyScore;
                if (urgDiff !== 0) return urgDiff * dir;
                return compareName(a, b);
            }
            if (sortConfig.key === 'price') {
                const diff = a.dayChangePct - b.dayChangePct;
                if (diff !== 0) return diff * dir;
                return compareName(a, b);
            }
            if (sortConfig.key === 'limit') {
                const gapA = radarMode === 'buy' ? a.buyGapPct : a.sellGapPct;
                const gapB = radarMode === 'buy' ? b.buyGapPct : b.sellGapPct;
                if (gapA === null && gapB === null) return compareName(a, b);
                if (gapA === null) return 1;
                if (gapB === null) return -1;
                if (gapA !== gapB) return (gapA - gapB) * dir;
                return compareName(a, b);
            }
            if (sortConfig.key === 'fairValue') {
                const fvA = a.fairValue > 0 ? a.fairValueGapPct : null;
                const fvB = b.fairValue > 0 ? b.fairValueGapPct : null;
                if (fvA === null && fvB === null) return compareName(a, b);
                if (fvA === null) return 1;
                if (fvB === null) return -1;
                if (fvA !== fvB) return (fvA - fvB) * dir;
                return compareName(a, b);
            }
            return compareName(a, b);
        });
    }, [scopedItems, radarMode, activeCategory, isWatchlistSource, sortConfig]);

    const allAssetsPool = useMemo(() => {
        if (radarMode === 'buy') return scopedItems;
        return isWatchlistSource ? scopedItems : scopedItems.filter(i => i.inPortfolio || i.hasExplicitSellLimit);
    }, [scopedItems, radarMode, isWatchlistSource]);

    const hiddenItems = useMemo(() => {
        if (activeCategory === 'all_assets') return [];
        const visibleIds = new Set(visibleItems.map(i => i.stock.id));
        return allAssetsPool
            .filter(i => !visibleIds.has(i.stock.id))
            .sort((a, b) =>
                (a.stock.name || a.stock.symbol || '').localeCompare(
                    b.stock.name || b.stock.symbol || '',
                    'de',
                    { sensitivity: 'base' }
                )
            );
    }, [allAssetsPool, visibleItems, activeCategory]);

    if (!isOpen) return null;

    const kpiCards: {
        key: RadarCategory;
        group: 'buy' | 'sell';
        label: string;
        sublabel: string;
        count: number;
        icon: typeof Target;
        activeCls: string;
        idleCls: string;
        countCls: string;
    }[] = [
        {
            key: 'buy_limit',
            group: 'buy',
            label: 'Kauflimit erreicht',
            sublabel: 'Kurs ≤ Limit',
            count: scopedCounts.buyLimit,
            icon: Target,
            activeCls: 'bg-emerald-500/20 border-emerald-500 ring-1 ring-emerald-500/60',
            idleCls: 'bg-emerald-500/5 border-emerald-500/25 hover:border-emerald-500/55',
            countCls: 'text-emerald-400'
        },
        {
            key: 'zone1',
            group: 'buy',
            label: 'Kaufzone 1',
            sublabel: '1. Tranche · Einstieg',
            count: scopedCounts.zone1,
            icon: ArrowDownRight,
            activeCls: 'bg-teal-500/20 border-teal-500 ring-1 ring-teal-500/60',
            idleCls: 'bg-teal-500/5 border-teal-500/25 hover:border-teal-500/55',
            countCls: 'text-teal-400'
        },
        {
            key: 'zone2',
            group: 'buy',
            label: 'Kaufzone 2',
            sublabel: '2. Tranche · Nachkauf',
            count: scopedCounts.zone2,
            icon: TrendingDown,
            activeCls: 'bg-amber-500/20 border-amber-500 ring-1 ring-amber-500/60',
            idleCls: 'bg-amber-500/5 border-amber-500/25 hover:border-amber-500/55',
            countCls: 'text-amber-400'
        },
        {
            key: 'zone3',
            group: 'buy',
            label: 'Kaufzone 3',
            sublabel: '3. Tranche · Crash',
            count: scopedCounts.zone3,
            icon: ShieldAlert,
            activeCls: 'bg-rose-500/20 border-rose-500 ring-1 ring-rose-500/60',
            idleCls: 'bg-rose-500/5 border-rose-500/25 hover:border-rose-500/55',
            countCls: 'text-rose-400'
        },
        {
            key: 'below_sma200',
            group: 'buy',
            label: 'Unter 200-Tage-Linie',
            sublabel: isRefreshing && scopedCounts.belowSma200 === 0 ? 'Lädt GD 200…' : 'Kurs < GD 200',
            count: scopedCounts.belowSma200,
            icon: Activity,
            activeCls: 'bg-sky-500/20 border-sky-500 ring-1 ring-sky-500/60',
            idleCls: 'bg-sky-500/5 border-sky-500/25 hover:border-sky-500/55',
            countCls: 'text-sky-400'
        },
        {
            key: 'sell_approaching',
            group: 'sell',
            label: 'Verkauf Anlauf',
            sublabel: 'Bestand · vor Ziel',
            count: scopedCounts.sellApproaching,
            icon: ArrowUpRight,
            activeCls: 'bg-orange-500/20 border-orange-500 ring-1 ring-orange-500/60',
            idleCls: 'bg-orange-500/5 border-orange-500/25 hover:border-orange-500/55',
            countCls: 'text-orange-400'
        },
        {
            key: 'sell_reached',
            group: 'sell',
            label: 'Verkauf erreicht',
            sublabel: 'Bestand · Limit / Ziel',
            count: scopedCounts.sellReached,
            icon: Flame,
            activeCls: 'bg-fuchsia-500/20 border-fuchsia-500 ring-1 ring-fuchsia-500/60',
            idleCls: 'bg-fuchsia-500/5 border-fuchsia-500/25 hover:border-fuchsia-500/55',
            countCls: 'text-fuchsia-400'
        }
    ];

    const visibleKpiCards = kpiCards.filter(card => card.group === radarMode);
    const activeModeSignalCount = radarMode === 'buy' ? scopedCounts.buySignals : scopedCounts.sellSignals;
    const activeModeAssetCount = radarMode === 'buy'
        ? scopedCounts.allAssets
        : (isWatchlistSource ? scopedCounts.allAssets : scopedCounts.sellCandidates);

    return createPortal(
        <div
            className="fixed inset-0 bg-black/75 backdrop-blur-xs z-[2000] flex items-center justify-center p-2 sm:p-4 md:p-6 overflow-y-auto overscroll-contain animate-in fade-in duration-150"
            onClick={onClose}
        >
            <div
                className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-[1220px] h-[90vh] max-h-[92dvh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200 text-foreground my-auto"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between gap-3 px-4 sm:px-5 py-3.5 border-b border-border bg-muted/30 shrink-0 flex-wrap">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className={cn(
                            'p-2.5 rounded-xl shrink-0',
                            radarMode === 'buy'
                                ? 'bg-emerald-500/15 text-emerald-400'
                                : 'bg-orange-500/15 text-orange-400'
                        )}>
                            <Radar className="size-5" />
                        </div>
                        <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                                <h2 className="text-base sm:text-lg font-bold truncate">
                                    {radarMode === 'buy' ? 'Kauf-Radar' : 'Verkaufs-Radar'}
                                </h2>
                                <span className={cn(
                                    'h-6 px-2.5 inline-flex items-center justify-center rounded-full text-xs font-semibold border leading-none whitespace-nowrap',
                                    radarMode === 'buy'
                                        ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                                        : 'bg-orange-500/15 text-orange-400 border-orange-500/30'
                                )}>
                                    {radarMode === 'buy'
                                        ? `${scopedCounts.buySignals} Kaufsignale · ${scopedCounts.allAssets} Titel`
                                        : `${scopedCounts.sellSignals} Verkaufssignale · ${activeModeAssetCount} Titel`}
                                </span>
                            </div>
                            <p className="text-xs text-foreground/80 truncate">
                                {radarMode === 'buy'
                                    ? 'Kauflimiten & Kaufzonen 1–3 für Bestand und alle Watchlists auf einen Blick'
                                    : 'Verkaufslimiten & Verkaufszonen für Bestand und gesetzte Verkaufslimite'}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                        {/* Kauf / Verkauf Umschalter im Modal */}
                        <div className="h-8 inline-flex items-center bg-muted rounded-lg p-0.5 border border-border/60">
                            <button
                                type="button"
                                onClick={() => handleSwitchRadarMode('buy')}
                                className={cn(
                                    'h-full px-3 py-0 inline-flex items-center justify-center gap-1.5 leading-none text-xs font-semibold rounded-md transition-all cursor-pointer whitespace-nowrap',
                                    radarMode === 'buy'
                                        ? 'bg-emerald-600 text-white shadow-xs'
                                        : 'text-foreground/90 hover:text-foreground'
                                )}
                            >
                                <span>Kaufen</span>
                                <span className={cn(
                                    'font-mono font-bold tabular-nums',
                                    radarMode === 'buy' ? 'text-white/90' : 'text-emerald-400'
                                )}>
                                    {scopedCounts.buySignals}
                                </span>
                            </button>
                            <button
                                type="button"
                                onClick={() => handleSwitchRadarMode('sell')}
                                className={cn(
                                    'h-full px-3 py-0 inline-flex items-center justify-center gap-1.5 leading-none text-xs font-semibold rounded-md transition-all cursor-pointer whitespace-nowrap',
                                    radarMode === 'sell'
                                        ? 'bg-orange-600 text-white shadow-xs'
                                        : 'text-foreground/90 hover:text-foreground'
                                )}
                            >
                                <span>Verkaufen</span>
                                <span className={cn(
                                    'font-mono font-bold tabular-nums',
                                    radarMode === 'sell' ? 'text-white/90' : 'text-orange-400'
                                )}>
                                    {scopedCounts.sellSignals}
                                </span>
                            </button>
                        </div>

                        {onRefreshPrices && (
                            <button
                                type="button"
                                onClick={onRefreshPrices}
                                disabled={isRefreshing}
                                className="h-8 px-3 py-0 rounded-lg border border-border bg-background hover:bg-muted text-xs font-semibold text-foreground inline-flex items-center justify-center gap-1.5 leading-none transition-colors cursor-pointer disabled:opacity-50"
                                title="Aktuelle Kurse & 52W-Daten aktualisieren"
                            >
                                <RefreshCw className={cn('size-3.5 text-blue-400', isRefreshing && 'animate-spin')} />
                                <span className="hidden sm:inline">Kurse laden</span>
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={onClose}
                            className="h-8 w-8 inline-flex items-center justify-center hover:bg-muted rounded-lg text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                            aria-label="Schliessen"
                        >
                            <X className="size-5" />
                        </button>
                    </div>
                </div>

                {/* Mode-Specific KPI Signal Cards (5 Kauf-Karten ODER 2 Verkauf-Karten) */}
                <div className="px-4 sm:px-5 pt-3.5 pb-2.5 border-b border-border/60 bg-background/40 shrink-0 space-y-2.5">
                    <div className={cn(
                        'grid gap-2',
                        radarMode === 'buy'
                            ? 'grid-cols-2 md:grid-cols-3 lg:grid-cols-5'
                            : 'grid-cols-1 sm:grid-cols-2'
                    )}>
                        {visibleKpiCards.map(card => {
                            const Icon = card.icon;
                            const isSelected = activeCategory === card.key;
                            return (
                                <button
                                    key={card.key}
                                    type="button"
                                    onClick={() => {
                                        clearPrefilledSearchIfActive();
                                        setActiveCategory(prev => (prev === card.key ? 'all_assets' : card.key));
                                    }}
                                    className={cn(
                                        'p-2.5 rounded-xl border text-left transition-all cursor-pointer active:scale-[0.99] flex flex-col justify-between gap-1',
                                        isSelected ? card.activeCls : card.idleCls
                                    )}
                                >
                                    <div className="flex items-center justify-between gap-1.5">
                                        <span className="text-xs font-bold text-foreground truncate">{card.label}</span>
                                        <Icon className={cn('size-3.5 shrink-0', card.countCls)} />
                                    </div>
                                    <div className="flex items-baseline justify-between gap-1.5">
                                        <span className={cn('text-xl font-extrabold tabular-nums leading-none', card.countCls)}>
                                            {card.count}
                                        </span>
                                        <span className="text-xs text-foreground/85 truncate">{card.sublabel}</span>
                                    </div>
                                </button>
                            );
                        })}
                    </div>

                    {/* Filter Toolbar — einheitliche Farbe, Höhe h-7 & Schrift auf allen Buttons/Dropdowns */}
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <div ref={dropdownContainerRef} className="flex flex-wrap items-center gap-1.5">
                            {/* 1. Nur Signale Toggle (blau nur wenn wirklich alle Signale aktiv; Klick von einer Zone springt direkt zu allen Signalen) */}
                            <button
                                type="button"
                                onClick={() => {
                                    setOpenDropdown(null);
                                    clearPrefilledSearchIfActive();
                                    setActiveCategory(prev => (prev === 'all_signals' ? 'all_assets' : 'all_signals'));
                                }}
                                className={cn(
                                    'h-7 px-2.5 py-0 rounded-lg border text-xs font-semibold inline-flex items-center justify-center gap-1.5 leading-none transition-colors cursor-pointer whitespace-nowrap',
                                    activeCategory === 'all_signals'
                                        ? 'bg-blue-600 text-white border-blue-500 shadow-xs'
                                        : 'bg-muted/70 text-foreground border-border/60 hover:bg-muted'
                                )}
                                title={activeCategory === 'all_signals'
                                    ? 'Aktuell alle Signale sichtbar · Klick zeigt alle Titel'
                                    : 'Klick zeigt alle Signale (alle Kaufzonen & GD 200 zusammen)'}
                            >
                                <span>{radarMode === 'buy' ? 'Nur Kaufsignale' : 'Nur Verkaufssignale'}</span>
                                <span className="font-mono tabular-nums">{activeModeSignalCount}</span>
                            </button>

                            {/* 2. Bestand Split-Button: zu oberst "Bestand Alle" (1-Klick), Pfeil öffnet Aktien / ETFs */}
                            <div className="relative">
                                <div
                                    className={cn(
                                        'h-7 rounded-lg border text-xs font-semibold inline-flex items-stretch overflow-hidden transition-colors whitespace-nowrap',
                                        isPortfolioSource
                                            ? 'bg-blue-600 text-white border-blue-500 shadow-xs'
                                            : 'bg-muted/70 text-foreground border-border/60'
                                    )}
                                >
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setOpenDropdown(null);
                                            setSourceFilter(prev => (prev === 'portfolio_all' ? 'all' : 'portfolio_all'));
                                        }}
                                        aria-label="Bestand Alle filtern"
                                        className={cn(
                                            'h-full pl-2.5 pr-2 py-0 inline-flex items-center justify-center leading-none transition-colors cursor-pointer',
                                            isPortfolioSource ? 'hover:bg-blue-500/80' : 'hover:bg-muted'
                                        )}
                                    >
                                        {sourceFilter === 'portfolio_stock'
                                            ? 'Bestand Aktien'
                                            : sourceFilter === 'portfolio_etf'
                                                ? 'Bestand ETFs'
                                                : 'Bestand Alle'}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setOpenDropdown(prev => (prev === 'portfolio' ? null : 'portfolio'))}
                                        aria-label="Bestand Auswahl öffnen"
                                        aria-expanded={openDropdown === 'portfolio'}
                                        className={cn(
                                            'h-full px-1.5 py-0 border-l inline-flex items-center justify-center leading-none transition-colors cursor-pointer',
                                            isPortfolioSource
                                                ? 'border-white/25 hover:bg-blue-500/80'
                                                : 'border-border/70 hover:bg-muted'
                                        )}
                                    >
                                        <ChevronDown className={cn('size-3.5 shrink-0 transition-transform', openDropdown === 'portfolio' && 'rotate-180')} />
                                    </button>
                                </div>
                                {openDropdown === 'portfolio' && (
                                    <div className="absolute left-0 top-full mt-1 z-30 min-w-full w-max py-0.5 rounded-lg border border-border bg-card shadow-xl">
                                        {[
                                            ...(sourceFilter === 'portfolio_stock' || sourceFilter === 'portfolio_etf'
                                                ? [{ value: 'portfolio_all', label: 'Bestand Alle' }]
                                                : []),
                                            { value: 'portfolio_stock', label: 'Aktien' },
                                            { value: 'portfolio_etf', label: 'ETFs' }
                                        ].map(opt => {
                                            const active = sourceFilter === opt.value;
                                            return (
                                                <button
                                                    key={opt.value}
                                                    type="button"
                                                    onClick={() => {
                                                        setSourceFilter(opt.value);
                                                        setOpenDropdown(null);
                                                    }}
                                                    className={cn(
                                                        'w-full px-2.5 py-1 text-left text-xs font-semibold flex items-center justify-between gap-2 transition-colors cursor-pointer whitespace-nowrap',
                                                        active
                                                            ? 'bg-blue-600/20 text-blue-400'
                                                            : 'text-foreground hover:bg-muted'
                                                    )}
                                                >
                                                    <span>{opt.label}</span>
                                                    {active && <Check className="size-3.5 shrink-0" />}
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>

                            {/* 3. Watchlist Split-Button: zu oberst "Watchlist Alle" (1-Klick), Pfeil öffnet einzelne Watchlists A–Z */}
                            {sortedWatchlists.length > 0 && (
                                <div className="relative">
                                    <div
                                        className={cn(
                                            'h-7 rounded-lg border text-xs font-semibold inline-flex items-stretch overflow-hidden transition-colors whitespace-nowrap',
                                            isWatchlistSource
                                                ? 'bg-blue-600 text-white border-blue-500 shadow-xs'
                                                : 'bg-muted/70 text-foreground border-border/60'
                                        )}
                                    >
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setOpenDropdown(null);
                                                setSourceFilter(prev => (prev === 'watchlist_all' ? 'all' : 'watchlist_all'));
                                            }}
                                            aria-label="Alle Watchlists filtern"
                                            className={cn(
                                                'h-full pl-2.5 pr-2 py-0 inline-flex items-center justify-center leading-none transition-colors cursor-pointer',
                                                isWatchlistSource ? 'hover:bg-blue-500/80' : 'hover:bg-muted'
                                            )}
                                        >
                                            {sourceFilter.startsWith('wl:')
                                                ? (sortedWatchlists.find(w => `wl:${w.id}` === sourceFilter)?.name || 'Watchlist Alle')
                                                : 'Watchlist Alle'}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setOpenDropdown(prev => (prev === 'watchlist' ? null : 'watchlist'))}
                                            aria-label="Watchlist Auswahl öffnen"
                                            aria-expanded={openDropdown === 'watchlist'}
                                            className={cn(
                                                'h-full px-1.5 py-0 border-l inline-flex items-center justify-center leading-none transition-colors cursor-pointer',
                                                isWatchlistSource
                                                    ? 'border-white/25 hover:bg-blue-500/80'
                                                    : 'border-border/70 hover:bg-muted'
                                            )}
                                        >
                                            <ChevronDown className={cn('size-3.5 shrink-0 transition-transform', openDropdown === 'watchlist' && 'rotate-180')} />
                                        </button>
                                    </div>
                                    {openDropdown === 'watchlist' && (
                                        <div className="absolute left-0 top-full mt-1 z-30 min-w-full w-max max-h-64 overflow-y-auto py-0.5 rounded-lg border border-border bg-card shadow-xl">
                                            {[
                                                ...(sourceFilter.startsWith('wl:')
                                                    ? [{ value: 'watchlist_all', label: 'Watchlist Alle' }]
                                                    : []),
                                                ...sortedWatchlists.map(wl => ({ value: `wl:${wl.id}`, label: wl.name }))
                                            ].map(opt => {
                                                const active = sourceFilter === opt.value;
                                                return (
                                                    <button
                                                        key={opt.value}
                                                        type="button"
                                                        onClick={() => {
                                                            setSourceFilter(opt.value);
                                                            setOpenDropdown(null);
                                                        }}
                                                        className={cn(
                                                            'w-full px-2.5 py-1 text-left text-xs font-semibold flex items-center justify-between gap-2 transition-colors cursor-pointer whitespace-nowrap',
                                                            active
                                                                ? 'bg-blue-600/20 text-blue-400'
                                                                : 'text-foreground hover:bg-muted'
                                                        )}
                                                    >
                                                        <span>{opt.label}</span>
                                                        {active && <Check className="size-3.5 shrink-0" />}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            )}

                            {sourceFilter !== 'all' && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setSourceFilter('all');
                                        setOpenDropdown(null);
                                    }}
                                    className="h-7 px-2.5 py-0 rounded-lg border border-border/60 bg-muted/70 hover:bg-muted text-xs font-semibold text-foreground inline-flex items-center justify-center gap-1 leading-none transition-colors cursor-pointer whitespace-nowrap"
                                    title="Auswahl zurücksetzen (Bestand & Watchlists)"
                                >
                                    <X className="size-3 shrink-0" />
                                    <span>Alle</span>
                                </button>
                            )}
                        </div>

                        {/* Search input */}
                        <div className="relative w-full sm:w-56">
                            <Search className="size-3.5 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                placeholder="Titel oder Symbol..."
                                className="h-7 w-full pl-8 pr-7 py-0 rounded-lg border border-border bg-background text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                            />
                            {searchTerm && (
                                <button
                                    type="button"
                                    onClick={() => setSearchTerm('')}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                                    aria-label="Suche löschen"
                                >
                                    <X className="size-3.5" />
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* Table Body */}
                <div className="flex-1 overflow-y-auto overflow-x-auto radar-scrollbar">
                    {visibleItems.length === 0 ? (
                        <div className="flex flex-col items-center justify-center text-center py-14 px-6 space-y-2.5">
                            <div className="p-3 rounded-full bg-muted/60 text-muted-foreground">
                                <Layers className="size-6" />
                            </div>
                            <p className="text-sm font-semibold text-foreground">
                                Keine Titel in dieser Auswahl
                            </p>
                            <p className="text-xs text-muted-foreground max-w-md">
                                Aktuell erfüllt kein Titel im gewählten Filter dieses Signal. Wechsle auf «Alle Signale» oder «Alle Titel», um alle Bestände und Watchlist-Werte zu sehen.
                            </p>
                            {activeCategory !== 'all_assets' && (
                                <button
                                    type="button"
                                    onClick={() => setActiveCategory('all_assets')}
                                    className="h-7 px-3 py-0 rounded-lg border border-border bg-background hover:bg-muted text-xs font-semibold text-foreground inline-flex items-center justify-center leading-none transition-colors cursor-pointer mt-1"
                                >
                                    Alle Titel anzeigen
                                </button>
                            )}
                        </div>
                    ) : (
                        <>
                        <table className="w-full text-left border-collapse">
                            <thead className="sticky top-0 z-10 bg-muted/95 backdrop-blur-xs border-b border-border text-xs font-bold text-foreground uppercase tracking-wider">
                                <tr>
                                    <th className="py-2.5 pl-4 pr-2">
                                        <button
                                            type="button"
                                            onClick={() => handleSort('name')}
                                            className="inline-flex items-center gap-1 text-foreground hover:text-blue-400 transition-colors cursor-pointer select-none uppercase"
                                            title="Alphabetisch nach Name sortieren"
                                        >
                                            <span>Aktie / ETF</span>
                                            {sortConfig.key === 'name' ? (
                                                <span className="text-blue-400 font-bold leading-none">
                                                    {sortConfig.direction === 'asc' ? '↑' : '↓'}
                                                </span>
                                            ) : (
                                                <ArrowUpDown className="size-3 text-foreground/50" />
                                            )}
                                        </button>
                                    </th>
                                    <th className="py-2.5 px-2.5">
                                        <button
                                            type="button"
                                            onClick={() => handleSort('signal')}
                                            className="inline-flex items-center gap-1 text-foreground hover:text-blue-400 transition-colors cursor-pointer select-none uppercase"
                                            title="Nach Signalstärke sortieren"
                                        >
                                            <span>{radarMode === 'buy' ? 'Kaufsignal' : 'Verkaufssignal'}</span>
                                            {sortConfig.key === 'signal' ? (
                                                <span className="text-blue-400 font-bold leading-none">
                                                    {sortConfig.direction === 'asc' ? '↑' : '↓'}
                                                </span>
                                            ) : (
                                                <ArrowUpDown className="size-3 text-foreground/50" />
                                            )}
                                        </button>
                                    </th>
                                    <th className="py-2.5 px-2.5 text-right">
                                        <button
                                            type="button"
                                            onClick={() => handleSort('price')}
                                            className="inline-flex items-center justify-end gap-1 text-foreground hover:text-blue-400 transition-colors cursor-pointer select-none uppercase"
                                            title="Nach Tagesveränderung in % sortieren"
                                        >
                                            <span>Kurs</span>
                                            {sortConfig.key === 'price' ? (
                                                <span className="text-blue-400 font-bold leading-none">
                                                    {sortConfig.direction === 'asc' ? '↑' : '↓'}
                                                </span>
                                            ) : (
                                                <ArrowUpDown className="size-3 text-foreground/50" />
                                            )}
                                        </button>
                                    </th>
                                    <th className="py-2.5 px-2.5 text-right">
                                        <button
                                            type="button"
                                            onClick={() => handleSort('limit')}
                                            className="inline-flex items-center justify-end gap-1 text-foreground hover:text-blue-400 transition-colors cursor-pointer select-none uppercase"
                                            title={radarMode === 'buy' ? 'Nach Abstand zum Kauflimit in % sortieren' : 'Nach Abstand zum Verkaufslimit in % sortieren'}
                                        >
                                            <span>{radarMode === 'buy' ? 'Kauflimit & Zonen' : 'Verkaufslimit'}</span>
                                            {sortConfig.key === 'limit' ? (
                                                <span className="text-blue-400 font-bold leading-none">
                                                    {sortConfig.direction === 'asc' ? '↑' : '↓'}
                                                </span>
                                            ) : (
                                                <ArrowUpDown className="size-3 text-foreground/50" />
                                            )}
                                        </button>
                                    </th>
                                    <th className="py-2.5 px-2.5 text-right">
                                        <button
                                            type="button"
                                            onClick={() => handleSort('fairValue')}
                                            className="inline-flex items-center justify-end gap-1 text-foreground hover:text-blue-400 transition-colors cursor-pointer select-none uppercase"
                                            title="Nach Abstand zum Fairen Wert in % sortieren"
                                        >
                                            <span>Fairer Wert</span>
                                            {sortConfig.key === 'fairValue' ? (
                                                <span className="text-blue-400 font-bold leading-none">
                                                    {sortConfig.direction === 'asc' ? '↑' : '↓'}
                                                </span>
                                            ) : (
                                                <ArrowUpDown className="size-3 text-foreground/50" />
                                            )}
                                        </button>
                                    </th>
                                    <th className="py-2.5 pl-2.5 pr-4 text-right">Aktion</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border/50 text-xs">
                                {visibleItems.map(item => {
                                    const modeMeta = item.effectiveBuyLimit
                                        ? getModeBadgeMeta(item.buyLimitType, item.buyLimitColorMode)
                                        : null;
                                    const z1 = item.supportZones[0];
                                    const z2 = item.supportZones[1];
                                    const z3 = item.supportZones[2];

                                    const waitBuyReason =
                                        !item.isBuyLimitReached && item.buyZone === null && !item.isBelowSma200
                                            ? item.fairValueGapPct !== null && item.fairValueGapPct >= 20
                                                ? `Überbewertet · +${item.fairValueGapPct.toFixed(1)} % über FW`
                                                : item.buyGapPct !== null && item.buyGapPct > 4
                                                    ? `Kurs +${item.buyGapPct.toFixed(1)} % über Kauflimit`
                                                    : 'Kein Rücksetzer · Kurs im Trend'
                                            : null;

                                    const primaryReason = radarMode === 'sell'
                                        ? item.sellReason
                                        : activeCategory === 'buy_limit'
                                            ? item.buyLimitReason
                                            : activeCategory === 'below_sma200'
                                                ? item.sma200Reason
                                                : activeCategory === 'zone1' || activeCategory === 'zone2' || activeCategory === 'zone3'
                                                    ? item.buyZoneReason
                                                    : item.isBuyLimitReached
                                                        ? item.buyLimitReason
                                                        : (item.buyZoneReason || item.sma200Reason || waitBuyReason);

                                    const suggestedBuyPrice = item.effectiveBuyLimit && item.effectiveBuyLimit > 0
                                        ? item.effectiveBuyLimit
                                        : item.currentPrice;
                                    const suggestedSellPrice = item.effectiveSellLimit && item.effectiveSellLimit > 0
                                        ? item.effectiveSellLimit
                                        : item.currentPrice;

                                    const isHighlighted = Boolean(
                                        (highlightStockId && String(item.stock.id) === String(highlightStockId)) ||
                                        (highlightSymbol && item.stock.symbol.trim().toLowerCase() === highlightSymbol.trim().toLowerCase())
                                    );

                                    return (
                                        <tr
                                            key={item.stock.id}
                                            ref={isHighlighted ? highlightRowRef : undefined}
                                            className={cn(
                                                'hover:bg-muted/35 transition-colors group',
                                                isHighlighted && (radarMode === 'sell' ? 'bg-orange-500/10' : 'bg-emerald-500/10')
                                            )}
                                        >
                                            {/* 1. Aktie / ETF */}
                                            <td className="py-2.5 pl-4 pr-2 align-middle">
                                                <div className="flex items-center gap-2 min-w-[170px] max-w-[235px]">
                                                    <Logo
                                                        url={item.stock.logoUrl}
                                                        alt={item.stock.name}
                                                        fallback={item.stock.symbol.slice(0, 2)}
                                                        size="size-8"
                                                    />
                                                    <div className="min-w-0 flex-1">
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                onClose();
                                                                navigate(`/stock/${encodeURIComponent(item.stock.id)}`);
                                                            }}
                                                            className="text-left hover:text-primary transition-colors block w-full cursor-pointer"
                                                            title="Aktien-Details öffnen"
                                                        >
                                                            <StockName
                                                                name={item.stock.name}
                                                                className="font-bold text-[13px] text-foreground group-hover:text-primary truncate"
                                                            />
                                                        </button>
                                                        <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                                                            <span className="font-mono text-xs text-muted-foreground font-semibold">
                                                                {item.stock.symbol}
                                                            </span>
                                                            {item.assetType === 'etf' && (
                                                                <span className="px-1.5 py-0.5 rounded text-xs font-bold bg-blue-500/15 text-blue-400 border border-blue-500/30 leading-none">
                                                                    ETF
                                                                </span>
                                                            )}
                                                            {item.inPortfolio && (
                                                                <span
                                                                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-semibold bg-blue-500/15 text-blue-400 border border-blue-500/30 leading-none"
                                                                    title={`Im Bestand: ${item.shares} Stk.${item.positionGainPct !== null ? ` · ${item.positionGainPct >= 0 ? '+' : ''}${item.positionGainPct.toFixed(1)} %` : ''}`}
                                                                >
                                                                    <ShoppingBag className="size-3 shrink-0" />
                                                                    <span>Bestand</span>
                                                                    {item.positionGainPct !== null && (
                                                                        <span className={cn('font-mono', item.positionGainPct >= 0 ? 'text-emerald-400' : 'text-rose-400')}>
                                                                            {item.positionGainPct >= 0 ? '+' : ''}{item.positionGainPct.toFixed(0)}%
                                                                        </span>
                                                                    )}
                                                                </span>
                                                            )}
                                                            {!item.inPortfolio && item.watchlistNames.length > 0 && (
                                                                <span
                                                                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium bg-muted text-muted-foreground border border-border/70 leading-none max-w-[140px] truncate"
                                                                    title={`Watchlist: ${item.watchlistNames.join(', ')}`}
                                                                >
                                                                    <Eye className="size-3 shrink-0" />
                                                                    <span className="truncate">
                                                                        {item.watchlistNames[0]}
                                                                        {item.watchlistNames.length > 1 ? ` +${item.watchlistNames.length - 1}` : ''}
                                                                    </span>
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>

                                            {/* 2. Radar-Signal (strikt getrennt nach Kauf vs. Verkauf) */}
                                            <td className="py-2.5 px-2.5 align-middle">
                                                <div className="flex flex-col gap-1 min-w-[155px]">
                                                    <div className="flex items-center gap-1.5 flex-wrap">
                                                        {radarMode === 'buy' ? (
                                                            <>
                                                                {item.isBuyLimitReached && (
                                                                    <span className="h-5 px-2 inline-flex items-center justify-center gap-1 rounded-md text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/45 leading-none whitespace-nowrap">
                                                                        <Target className="size-3 shrink-0" />
                                                                        Kauflimit erreicht
                                                                    </span>
                                                                )}
                                                                {item.buyZone === 3 && (
                                                                    <span className="h-5 px-2 inline-flex items-center justify-center rounded-md text-xs font-bold bg-rose-500/20 text-rose-400 border border-rose-500/45 leading-none whitespace-nowrap">
                                                                        Kaufzone 3
                                                                    </span>
                                                                )}
                                                                {item.buyZone === 2 && (
                                                                    <span className="h-5 px-2 inline-flex items-center justify-center rounded-md text-xs font-bold bg-amber-500/20 text-amber-400 border border-amber-500/45 leading-none whitespace-nowrap">
                                                                        Kaufzone 2
                                                                    </span>
                                                                )}
                                                                {item.buyZone === 1 && (
                                                                    <span className="h-5 px-2 inline-flex items-center justify-center rounded-md text-xs font-bold bg-teal-500/20 text-teal-400 border border-teal-500/45 leading-none whitespace-nowrap">
                                                                        Kaufzone 1
                                                                    </span>
                                                                )}
                                                                {item.isBelowSma200 && (
                                                                    <span
                                                                        className="h-5 px-2 inline-flex items-center justify-center gap-1 rounded-md text-xs font-bold bg-sky-500/20 text-sky-400 border border-sky-500/45 leading-none whitespace-nowrap"
                                                                        title={item.sma200Reason || 'Kurs unter 200-Tage-Linie'}
                                                                    >
                                                                        <Activity className="size-3 shrink-0" />
                                                                        Unter GD 200
                                                                    </span>
                                                                )}
                                                                {!item.isBuyLimitReached && item.buyZone === null && !item.isBelowSma200 && (
                                                                    <span className="h-5 px-2 inline-flex items-center justify-center rounded-md text-xs font-semibold bg-muted/70 text-foreground/85 border border-border/70 leading-none whitespace-nowrap">
                                                                        Abwarten
                                                                    </span>
                                                                )}
                                                            </>
                                                        ) : (
                                                            <>
                                                                {item.sellStatus === 'reached' && (
                                                                    <span className="h-5 px-2 inline-flex items-center justify-center gap-1 rounded-md text-xs font-bold bg-fuchsia-500/20 text-fuchsia-400 border border-fuchsia-500/45 leading-none whitespace-nowrap">
                                                                        <Flame className="size-3 shrink-0" />
                                                                        {item.sellSource === 'limit' ? 'Verkaufslimit erreicht' : 'Verkaufszone erreicht'}
                                                                    </span>
                                                                )}
                                                                {item.sellStatus === 'approaching' && (
                                                                    <span className="h-5 px-2 inline-flex items-center justify-center gap-1 rounded-md text-xs font-bold bg-orange-500/20 text-orange-400 border border-orange-500/45 leading-none whitespace-nowrap">
                                                                        <TrendingUp className="size-3 shrink-0" />
                                                                        {item.sellSource === 'limit' ? 'Anlauf Verkaufslimit' : 'Verkaufszone Anlauf'}
                                                                    </span>
                                                                )}
                                                                {item.sellStatus === null && (
                                                                    item.isOvervaluedWatchlist ? (
                                                                        <span className="h-5 px-2 inline-flex items-center justify-center rounded-md text-xs font-semibold bg-orange-500/15 text-orange-300 border border-orange-500/35 leading-none whitespace-nowrap">
                                                                            Überbewertet · +{item.fairValueGapPct?.toFixed(0)}%
                                                                        </span>
                                                                    ) : (
                                                                        <span className="h-5 px-2 inline-flex items-center justify-center rounded-md text-xs font-semibold bg-muted/70 text-foreground/85 border border-border/70 leading-none whitespace-nowrap">
                                                                            Abwarten
                                                                        </span>
                                                                    )
                                                                )}
                                                            </>
                                                        )}
                                                    </div>
                                                    {primaryReason && (
                                                        <span className="text-xs text-muted-foreground leading-snug">
                                                            {primaryReason}
                                                        </span>
                                                    )}
                                                </div>
                                            </td>

                                            {/* 3. Kurs */}
                                            <td className="py-2.5 px-3 text-right align-middle whitespace-nowrap">
                                                <div className="font-mono font-bold text-[13px] text-foreground tabular-nums">
                                                    {fmtPrice(item.currentPrice, item.displayCurrency)}
                                                </div>
                                                <div className="flex items-center justify-end gap-1.5 mt-0.5 text-xs font-mono tabular-nums">
                                                    <span className={item.dayChangePct >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                                                        {item.dayChangePct >= 0 ? '+' : ''}{item.dayChangePct.toFixed(2)}%
                                                    </span>
                                                    {item.drawdownFrom52wHighPct !== null && item.drawdownFrom52wHighPct <= -5 && (
                                                        <span className="text-muted-foreground" title="Abstand vom 52-Wochen-Hoch">
                                                            · 52W {item.drawdownFrom52wHighPct.toFixed(0)}%
                                                        </span>
                                                    )}
                                                </div>
                                            </td>

                                            {/* 4. Kauflimit & Zonen (Kauf-Modus) ODER Verkaufslimit (Verkauf-Modus) */}
                                            <td className="py-2.5 px-2.5 text-right align-middle whitespace-nowrap">
                                                {radarMode === 'buy' ? (
                                                    item.effectiveBuyLimit ? (
                                                        <div
                                                            className="inline-flex flex-col items-end"
                                                            title={z1 && z2 && z3 ? `Zonen · Z1: ${z1.targetPrice.toFixed(2)} · Z2: ${z2.targetPrice.toFixed(2)} · Z3: ${z3.targetPrice.toFixed(2)} ${item.displayCurrency}` : undefined}
                                                        >
                                                            <div className="flex items-center justify-end gap-1.5">
                                                                {modeMeta && (
                                                                    <span className={cn(
                                                                        'w-[26px] h-5 inline-flex items-center justify-center rounded text-xs font-bold border leading-none shrink-0',
                                                                        modeMeta.cls
                                                                    )}>
                                                                        {modeMeta.label}
                                                                    </span>
                                                                )}
                                                                <span className={cn(
                                                                    'font-mono font-bold text-[13px] tabular-nums min-w-[96px] text-right',
                                                                    item.isBuyLimitReached ? 'text-emerald-400' : 'text-foreground'
                                                                )}>
                                                                    {fmtPrice(item.effectiveBuyLimit, item.displayCurrency)}
                                                                </span>
                                                            </div>
                                                            {item.buyGapPct !== null && (
                                                                <span className={cn(
                                                                    'text-xs font-mono font-semibold tabular-nums mt-0.5',
                                                                    item.buyGapPct <= 0
                                                                        ? 'text-emerald-400'
                                                                        : item.buyGapPct <= 4
                                                                            ? 'text-teal-400'
                                                                            : 'text-muted-foreground'
                                                                )}>
                                                                    {item.buyGapPct <= 0
                                                                        ? `Erreicht · ${item.buyGapPct.toFixed(1)}%`
                                                                        : `Abstand +${item.buyGapPct.toFixed(1)}%`}
                                                                </span>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <div className="inline-flex flex-col items-end">
                                                            <span className="text-xs font-medium text-muted-foreground">Kein Limit</span>
                                                            {z1 && z2 && z3 && (
                                                                <span
                                                                    className="text-xs font-mono text-muted-foreground/80 mt-0.5 tabular-nums"
                                                                    title={`Zone 1: ${z1.targetPrice.toFixed(2)} · Zone 2: ${z2.targetPrice.toFixed(2)} · Zone 3: ${z3.targetPrice.toFixed(2)} ${item.displayCurrency}`}
                                                                >
                                                                    Z1 {z1.targetPrice.toFixed(0)} · Z2 {z2.targetPrice.toFixed(0)} · Z3 {z3.targetPrice.toFixed(0)}
                                                                </span>
                                                            )}
                                                        </div>
                                                    )
                                                ) : item.effectiveSellLimit ? (
                                                    <div className="inline-flex flex-col items-end">
                                                        <div className="flex items-center justify-end gap-1.5">
                                                            {(() => {
                                                                const slBadge =
                                                                    item.sellLimitType === 'conservative'
                                                                        ? { label: 'A', title: 'Verkaufslimit Sicherheit A', cls: 'bg-blue-500/15 text-blue-400 border-blue-500/35' }
                                                                        : item.sellLimitType === 'quality'
                                                                            ? { label: 'B', title: 'Verkaufslimit Qualität B', cls: 'bg-purple-500/15 text-purple-400 border-purple-500/35' }
                                                                            : item.sellLimitType === 'risk'
                                                                                ? { label: 'C', title: 'Verkaufslimit Risiko-Abschlag C', cls: 'bg-amber-500/15 text-amber-400 border-amber-500/35' }
                                                                                : item.sellLimitType === 'manual'
                                                                                    ? { label: 'M', title: 'Verkaufslimit Manuell', cls: 'bg-pink-500/15 text-pink-400 border-pink-500/35' }
                                                                                    : { label: 'VK', title: 'Verkaufslimit / Verkaufsauftrag', cls: 'bg-orange-500/15 text-orange-400 border-orange-500/35' };
                                                                return (
                                                                    <span
                                                                        className={cn(
                                                                            'w-[26px] h-5 inline-flex items-center justify-center rounded text-xs font-bold border leading-none shrink-0',
                                                                            slBadge.cls
                                                                        )}
                                                                        title={slBadge.title}
                                                                    >
                                                                        {slBadge.label}
                                                                    </span>
                                                                );
                                                            })()}
                                                            <span className={cn(
                                                                'font-mono font-bold text-[13px] tabular-nums min-w-[96px] text-right',
                                                                item.sellStatus === 'reached' ? 'text-fuchsia-400' : 'text-foreground'
                                                            )}>
                                                                {fmtPrice(item.effectiveSellLimit, item.displayCurrency)}
                                                            </span>
                                                        </div>
                                                        {item.sellGapPct !== null && (
                                                            <span className={cn(
                                                                'text-xs font-mono font-semibold tabular-nums mt-0.5',
                                                                item.sellGapPct >= 0
                                                                    ? 'text-fuchsia-400'
                                                                    : item.sellGapPct >= -7
                                                                        ? 'text-orange-400'
                                                                        : 'text-muted-foreground'
                                                            )}>
                                                                {item.sellGapPct >= 0 ? `Erreicht · +${item.sellGapPct.toFixed(1)}%` : `${item.sellGapPct.toFixed(1)}%`}
                                                            </span>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <span className="text-xs font-medium text-muted-foreground">Kein VK-Limit</span>
                                                )}
                                            </td>

                                            {/* 5. Fairer Wert */}
                                            <td className="py-2.5 px-2.5 text-right align-middle whitespace-nowrap">
                                                {item.fairValue > 0 ? (
                                                    <div className="inline-flex flex-col items-end">
                                                        <div className="flex items-center justify-end gap-1.5">
                                                            {(() => {
                                                                const fwBadge =
                                                                    item.fairValueMode === 'quality'
                                                                        ? { label: 'FW', title: 'Fairer Wert Qualität B', cls: 'bg-purple-500/15 text-purple-400 border-purple-500/35' }
                                                                        : item.fairValueMode === 'risk'
                                                                            ? { label: 'FW', title: 'Fairer Wert Risiko-Abschlag C', cls: 'bg-amber-500/15 text-amber-400 border-amber-500/35' }
                                                                            : item.fairValueMode === 'manual'
                                                                                ? { label: 'FW', title: 'Fairer Wert Manuell', cls: 'bg-pink-500/15 text-pink-400 border-pink-500/35' }
                                                                                : { label: 'FW', title: 'Fairer Wert Sicherheit A', cls: 'bg-blue-500/15 text-blue-400 border-blue-500/35' };
                                                                return (
                                                                    <span
                                                                        className={cn(
                                                                            'w-[26px] h-5 inline-flex items-center justify-center rounded text-xs font-bold border leading-none shrink-0',
                                                                            fwBadge.cls
                                                                        )}
                                                                        title={fwBadge.title}
                                                                    >
                                                                        {fwBadge.label}
                                                                    </span>
                                                                );
                                                            })()}
                                                            <span className="font-mono font-semibold text-[13px] text-foreground tabular-nums min-w-[96px] text-right">
                                                                {fmtPrice(item.fairValue, item.displayCurrency)}
                                                            </span>
                                                        </div>
                                                        {item.fairValueGapPct !== null && (
                                                            <span className={cn(
                                                                'text-xs font-mono font-semibold tabular-nums mt-0.5',
                                                                item.fairValueGapPct <= 0
                                                                    ? 'text-emerald-400'
                                                                    : item.fairValueGapPct >= 45
                                                                        ? 'text-fuchsia-400'
                                                                        : item.fairValueGapPct >= 25
                                                                            ? 'text-orange-400'
                                                                            : 'text-muted-foreground'
                                                            )}>
                                                                {item.fairValueGapPct >= 0 ? '+' : ''}{item.fairValueGapPct.toFixed(1)}%
                                                            </span>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <span className="text-xs text-muted-foreground">—</span>
                                                )}
                                            </td>

                                            {/* 6. Aktionen — exakt bündig zum aktiven Modus, alle h-7 */}
                                            <td className="py-2.5 pl-2.5 pr-4 text-right align-middle whitespace-nowrap">
                                                <div className="inline-flex items-center justify-end gap-1.5">
                                                    {radarMode === 'sell' ? (
                                                        <button
                                                            type="button"
                                                            onClick={() => onSelectForTrade(item.stock.id, 'sell', suggestedSellPrice)}
                                                            className="h-7 w-[84px] px-2 py-0 rounded-lg border border-rose-500/45 bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white text-xs font-semibold inline-flex items-center justify-center leading-none transition-colors cursor-pointer"
                                                            title={`Verkauf im Simulator öffnen (${fmtPrice(suggestedSellPrice, item.displayCurrency)})`}
                                                        >
                                                            Verkaufen
                                                        </button>
                                                    ) : (
                                                        <button
                                                            type="button"
                                                            onClick={() => onSelectForTrade(item.stock.id, 'buy', suggestedBuyPrice)}
                                                            className="h-7 w-[84px] px-2 py-0 rounded-lg border border-emerald-500/45 bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white text-xs font-semibold inline-flex items-center justify-center leading-none transition-colors cursor-pointer"
                                                            title={`Kauf im Simulator öffnen (${fmtPrice(suggestedBuyPrice, item.displayCurrency)})`}
                                                        >
                                                            Kaufen
                                                        </button>
                                                    )}

                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            onClose();
                                                            navigate(`/fair-value?stock=${encodeURIComponent(item.stock.symbol)}&from=calculator`);
                                                        }}
                                                        className="h-7 w-7 p-0 rounded-lg border border-border bg-background hover:bg-muted text-muted-foreground hover:text-foreground inline-flex items-center justify-center leading-none transition-colors cursor-pointer shrink-0"
                                                        title="Im Fairen-Wert-Rechner öffnen"
                                                        aria-label="Fairer Wert öffnen"
                                                    >
                                                        <Telescope className="size-3.5" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                        {hiddenItems.length > 0 && (
                            <div className="px-4 py-3 border-t border-border/70 bg-muted/20 flex flex-wrap items-center justify-between gap-2.5 text-xs">
                                <div className="min-w-0 text-foreground/90">
                                    <span className="font-semibold text-foreground">
                                        {hiddenItems.length} {hiddenItems.length === 1 ? 'weiterer Titel' : 'weitere Titel'}{' '}
                                        {activeCategory === 'all_signals'
                                            ? (radarMode === 'buy' ? 'ohne Kaufsignal:' : 'ohne Verkaufssignal:')
                                            : 'in dieser Auswahl ausgeblendet:'}
                                    </span>{' '}
                                    <span>
                                        {hiddenItems
                                            .slice(0, 5)
                                            .map(i => i.stock.name || i.stock.symbol)
                                            .join(', ')}
                                        {hiddenItems.length > 5 ? ` +${hiddenItems.length - 5} weitere` : ''}
                                    </span>
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0">
                                    {activeCategory !== 'all_signals' && activeModeSignalCount > visibleItems.length && (
                                        <button
                                            type="button"
                                            onClick={() => setActiveCategory('all_signals')}
                                            className="h-7 px-2.5 py-0 rounded-lg border border-blue-500/45 bg-blue-600/20 hover:bg-blue-600 text-foreground hover:text-white text-xs font-semibold inline-flex items-center justify-center leading-none transition-colors cursor-pointer whitespace-nowrap"
                                        >
                                            Alle {activeModeSignalCount} Signale
                                        </button>
                                    )}
                                    <button
                                        type="button"
                                        onClick={() => setActiveCategory('all_assets')}
                                        className="h-7 px-2.5 py-0 rounded-lg border border-border bg-background hover:bg-muted text-foreground text-xs font-semibold inline-flex items-center justify-center leading-none transition-colors cursor-pointer whitespace-nowrap"
                                    >
                                        Alle {allAssetsPool.length} Titel anzeigen
                                    </button>
                                </div>
                            </div>
                        )}
                        </>
                    )}
                </div>

                {/* Compact Legend Footer (strikt nach aktivem Modus) */}
                <div className="px-4 py-2.5 border-t border-border bg-muted/25 flex items-center justify-between gap-3 text-xs text-foreground/85 shrink-0">
                    <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1 min-w-0">
                        {radarMode === 'buy' ? (
                            <>
                                <span><strong className="text-emerald-400">Kauflimit:</strong> Kurs ≤ Limit</span>
                                <span><strong className="text-teal-400">Zone 1:</strong> ≤ 4 % vor Limit / -10 % bis -20 %</span>
                                <span><strong className="text-amber-400">Zone 2:</strong> -20 % bis -30 % / GD 200 / 52W-Tief</span>
                                <span><strong className="text-rose-400">Zone 3:</strong> ab -30 % / ≥ 15 % unter GD 200</span>
                                <span><strong className="text-sky-400">GD 200:</strong> Kurs unter 200-Tage-Linie</span>
                            </>
                        ) : (
                            <>
                                <span><strong className="text-orange-400">Verkauf Anlauf:</strong> ab 93 % vom Verkaufslimit oder +25 % über Fairem Wert</span>
                                <span><strong className="text-fuchsia-400">Verkauf erreicht:</strong> Kurs ≥ Verkaufslimit oder stark überbewertet</span>
                                <span><strong className="text-foreground">Gilt für:</strong> Bestand &amp; gesetzte Verkaufslimite</span>
                            </>
                        )}
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="h-7 px-3 py-0 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 font-semibold text-xs inline-flex items-center justify-center leading-none transition-colors cursor-pointer shrink-0 whitespace-nowrap"
                    >
                        Schliessen
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}
