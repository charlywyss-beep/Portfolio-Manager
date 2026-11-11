import { ArrowLeft, TrendingUp, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useEffect, useState, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useCurrencyFormatter } from '../utils/currency';
import { cn } from '../utils';
import { Logo } from './Logo';
import { estimateMarketState, hasMarketOpenedToday, isAnyStockMarketActiveToday, getMarketOpeningTimeHint } from '../utils/market';
import { loadYesterdaySnapshot, getPreviousTradingDate } from '../utils/dailyPerformanceSnapshot';
import { isLikelyEtf } from '../utils/stockMetadata';
import { usePortfolio } from '../context/PortfolioContext';

interface PerformanceDetailsModalProps {
    isOpen: boolean;
    onClose: () => void;
    positions: any[]; // Using any to avoid complex import of Position type extended with dailyGain
}

function formatDate2Digit(d: Date): string {
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = String(d.getFullYear()).slice(-2);
    return `${day}.${month}.${year}`;
}

export function PerformanceDetailsModal({ isOpen, onClose, positions }: PerformanceDetailsModalProps) {
    const { convertToCHF, formatCurrency } = useCurrencyFormatter();
    const { refreshAllPrices, isGlobalRefreshing, lastGlobalRefresh, refreshTick } = usePortfolio();
    const navigate = useNavigate();

    // 0: Kurs, 1: % am DD.MM., 2: CHF am DD.MM., 3: Performance %, 4: Performance CHF
    const [assetFilter, setAssetFilter] = useState<'all' | 'stock' | 'etf'>('all');
    const [mobileColIndex, setMobileColIndex] = useState(0);
    const [viewMode, setViewMode] = useState<'live' | 'yesterday'>('live');
    const yesterdaySnapshot = useMemo(() => loadYesterdaySnapshot(), [isOpen, refreshTick]);
    const [sortConfig, setSortConfig] = useState<{
        key: 'default' | 'dailyPct' | 'dailyChf' | 'totalPct' | 'totalChf';
        direction: 'desc' | 'asc';
    }>({ key: 'default', direction: 'desc' });

    const toggleSort = (key: 'dailyPct' | 'dailyChf' | 'totalPct' | 'totalChf') => {
        setSortConfig((prev) => {
            if (prev.key !== key) {
                return { key, direction: 'desc' };
            }
            if (prev.direction === 'desc') {
                return { key, direction: 'asc' };
            }
            return { key: 'default', direction: 'desc' };
        });
    };

    const touchStartRef = useRef<{ x: number; y: number; time: number; isStockCol: boolean } | null>(null);

    const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
        if (window.innerWidth >= 768) return;
        const touch = e.touches[0];
        const isStockCol = !!(e.target as HTMLElement)?.closest('th:first-child, td:first-child');
        touchStartRef.current = {
            x: touch.clientX,
            y: touch.clientY,
            time: Date.now(),
            isStockCol
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

        // Horizontal swipe: only when touch started to the right of the "Aktie" column (> 140px) and is horizontal
        if (touchStartRef.current.x > 140 && Math.abs(dx) > 35 && Math.abs(dx) > Math.abs(dy) * 1.2 && dt < 700) {
            if (dx < 0) {
                setMobileColIndex((i) => Math.min(4, i + 1));
            } else {
                setMobileColIndex((i) => Math.max(0, i - 1));
            }
        }
        touchStartRef.current = null;
    };

    // Prevent body scroll when modal is open
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, [isOpen]);

    // Unified Timer Tracking (v3.12.70): Replaced local interval with dependency on global refreshTick
    useEffect(() => {
        // Modal re-renders automatically when refreshTick changes
    }, [refreshTick]);

    if (!isOpen) return null;

    const stockItems = positions.map(p => ({ symbol: p.stock.symbol, currency: p.stock.currency }));
    const isAnyActiveToday = isAnyStockMarketActiveToday(stockItems);
    const isAnyMarketOpen = positions.some(p => estimateMarketState(p.stock.symbol, p.stock.currency) === 'REGULAR');
    const validTimestamps = positions
        .map(p => p.stock?.lastQuoteDate ? new Date(p.stock.lastQuoteDate).getTime() : 0)
        .filter(t => t > 0);
    const latestTimestamp = validTimestamps.length > 0 ? Math.max(...validTimestamps) : 0;
    const effectiveDate = (!isAnyActiveToday && latestTimestamp > 0)
        ? new Date(latestTimestamp)
        : new Date();
    const todayDateLabel = formatDate2Digit(new Date());
    const prevTradingDate = getPreviousTradingDate(new Date());
    const fallbackYesterdayLabel = formatDate2Digit(prevTradingDate);

    // Format snapshot date with 2-digit year (e.g. '10.11.26')
    let formattedSnapshotLabel: string | null = null;
    if (yesterdaySnapshot?.dateKey) {
        try {
            const parts = yesterdaySnapshot.dateKey.split('-');
            if (parts.length === 3) {
                const yr = parts[0].slice(-2);
                formattedSnapshotLabel = `${parts[2]}.${parts[1]}.${yr}`;
            }
        } catch {
            // ignore
        }
    }

    // Ensure yesterdayDateLabel is strictly from a past day and NEVER equal to today
    let yesterdayDateLabel = (formattedSnapshotLabel && formattedSnapshotLabel !== todayDateLabel)
        ? formattedSnapshotLabel
        : fallbackYesterdayLabel;
    if (yesterdayDateLabel === todayDateLabel) {
        yesterdayDateLabel = fallbackYesterdayLabel;
    }

    const fullDateLabel = effectiveDate.toLocaleDateString('de-CH', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' });
    const isViewingYesterday = isAnyActiveToday && viewMode === 'yesterday';
    const activeDateLabel = (isViewingYesterday || !isAnyActiveToday) ? yesterdayDateLabel : todayDateLabel;

    const getPositionMetrics = (p: any) => {
        const snap = (isViewingYesterday && yesterdaySnapshot?.positions) ? yesterdaySnapshot.positions[p.stock.id] : null;
        const displayPrice = isViewingYesterday
            ? ((p.stock.previousClose && p.stock.previousClose > 0) ? p.stock.previousClose : (snap ? snap.currentPrice : p.stock.currentPrice))
            : p.stock.currentPrice;

        const purchaseValue = (p.purchases || []).reduce((pSum: number, purchase: any) =>
            pSum + (purchase.shares * purchase.price), 0);
        const entryFxRate = p.averageEntryFxRate || 1;
        const purchaseValueCHF = p.stock.currency !== 'CHF'
            ? purchaseValue * entryFxRate
            : purchaseValue;

        const liveCurrentValueCHF = convertToCHF(p.shares * p.stock.currentPrice, p.stock.currency);
        const liveTotalGainCHF = liveCurrentValueCHF - purchaseValueCHF;
        const liveDailyGainCHF = convertToCHF(p.dailyGain, p.stock.currency);

        // Mathematical perfection: Yesterday total gain = Live total gain minus today's live daily gain
        const totalGainCHF = isViewingYesterday
            ? (liveTotalGainCHF - liveDailyGainCHF)
            : liveTotalGainCHF;

        const totalGainPercent = purchaseValueCHF > 0 ? (totalGainCHF / purchaseValueCHF) * 100 : 0;
        const dailyGainCHF = snap ? snap.dailyGainCHF : (isViewingYesterday ? 0 : liveDailyGainCHF);

        return { dailyGainCHF, totalGainCHF, totalGainPercent, displayPrice };
    };

    // Sort positions:
    // Standard ('default'):
    // 1. Priorität: Geöffnete Börsen zuerst (Live-Handel), danach geschlossene Börsen
    // 2. Priorität: Aktien vor ETFs
    // 3. Priorität: Alphabetisch A - Z
    const isPositionEtf = (p: any) => p.stock?.type?.toLowerCase() === 'etf' || isLikelyEtf(p.stock);
    const filteredPositions = positions.filter((p) => {
        if (assetFilter === 'stock') return !isPositionEtf(p);
        if (assetFilter === 'etf') return isPositionEtf(p);
        return true;
    });

    const sortedPositions = [...filteredPositions].sort((a, b) => {
        if (sortConfig.key !== 'default') {
            const mA = getPositionMetrics(a);
            const mB = getPositionMetrics(b);
            let valA = 0;
            let valB = 0;
            if (sortConfig.key === 'dailyPct') {
                const sA = (isViewingYesterday && yesterdaySnapshot?.positions) ? yesterdaySnapshot.positions[a.stock.id] : null;
                const sB = (isViewingYesterday && yesterdaySnapshot?.positions) ? yesterdaySnapshot.positions[b.stock.id] : null;
                valA = sA ? sA.dailyGainPercent : (a.dailyGainPercent || 0);
                valB = sB ? sB.dailyGainPercent : (b.dailyGainPercent || 0);
                valA = Number.isFinite(valA) ? valA : 0;
                valB = Number.isFinite(valB) ? valB : 0;
            } else if (sortConfig.key === 'dailyChf') {
                const sA = (isViewingYesterday && yesterdaySnapshot?.positions) ? yesterdaySnapshot.positions[a.stock.id] : null;
                const sB = (isViewingYesterday && yesterdaySnapshot?.positions) ? yesterdaySnapshot.positions[b.stock.id] : null;
                valA = sA ? sA.dailyGainCHF : mA.dailyGainCHF;
                valB = sB ? sB.dailyGainCHF : mB.dailyGainCHF;
                valA = Number.isFinite(valA) ? valA : 0;
                valB = Number.isFinite(valB) ? valB : 0;
            } else if (sortConfig.key === 'totalPct') {
                valA = mA.totalGainPercent;
                valB = mB.totalGainPercent;
            } else if (sortConfig.key === 'totalChf') {
                valA = mA.totalGainCHF;
                valB = mB.totalGainCHF;
            }
            if (valA !== valB) {
                return sortConfig.direction === 'desc' ? valB - valA : valA - valB;
            }
        }

        const stateA = estimateMarketState(a.stock.symbol, a.stock.currency);
        const stateB = estimateMarketState(b.stock.symbol, b.stock.currency);
        const isOpenA = stateA === 'REGULAR';
        const isOpenB = stateB === 'REGULAR';

        // 1. Regel: Zuerst geöffnete Börsen (Live), dann geschlossene Börsen
        if (isOpenA !== isOpenB) {
            return isOpenA ? -1 : 1;
        }

        // 2. Regel: Typ (Aktien vor ETFs wie bisher)
        const typeA = a.stock.type?.toLowerCase() || 'stock';
        const typeB = b.stock.type?.toLowerCase() || 'stock';
        const isEtfA = typeA === 'etf';
        const isEtfB = typeB === 'etf';

        if (isEtfA !== isEtfB) {
            return isEtfA ? 1 : -1;
        }

        // 3. Regel: Alphabetisch von A bis Z wie bisher
        return a.stock.name.localeCompare(b.stock.name, 'de', { sensitivity: 'base' });
    });

    const totalDailyGain = sortedPositions.reduce((sum, p) => sum + convertToCHF(p.dailyGain, p.stock.currency), 0);
    const totalStockValue = sortedPositions.reduce((sum, p) => sum + convertToCHF(p.shares * p.stock.currentPrice, p.stock.currency), 0);
    const previousTotalValue = totalStockValue - totalDailyGain;
    const totalDailyGainPercent = previousTotalValue > 0 ? (totalDailyGain / previousTotalValue) * 100 : 0;

    const totalPerformanceGain = sortedPositions.reduce((sum, p) => {
        const m = getPositionMetrics(p);
        return sum + m.totalGainCHF;
    }, 0);

    const totalPurchaseValueCHF = sortedPositions.reduce((sum, p) => {
        const purchaseValue = (p.purchases || []).reduce((pSum: number, purchase: any) =>
            pSum + (purchase.shares * purchase.price), 0);
        const entryFxRate = p.averageEntryFxRate || 1;
        return sum + (p.stock.currency !== 'CHF' ? purchaseValue * entryFxRate : purchaseValue);
    }, 0);
    const totalPerformanceGainPercent = totalPurchaseValueCHF > 0
        ? (totalPerformanceGain / totalPurchaseValueCHF) * 100
        : 0;

    const handleRowClick = (stockId: string) => {
        navigate(`/stock/${stockId}?from=performance`);
        onClose();
    };

    const displayedDailyGain = isViewingYesterday && yesterdaySnapshot
        ? yesterdaySnapshot.totalDailyGainCHF
        : totalDailyGain;
    const displayedDailyGainPercent = isViewingYesterday && yesterdaySnapshot
        ? yesterdaySnapshot.totalDailyGainPercent
        : totalDailyGainPercent;

    return createPortal(
        <div
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[9999] flex items-center justify-center p-2 sm:p-4 md:py-3 iphone-modal-overlay"
            onClick={onClose}
        >
            <div
                className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-[96vw] md:max-w-5xl lg:max-w-6xl xl:max-w-7xl max-h-[96vh] flex flex-col animate-in fade-in zoom-in-95 duration-200 relative z-10 overflow-hidden iphone-modal-shell"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card z-10 iphone-modal-header-card">
                    <div className="flex items-center gap-2 min-w-0">
                        <button
                            type="button"
                            onClick={onClose}
                            className="iphone-landscape-back-btn inline-flex items-center justify-center size-8 rounded-lg bg-secondary/90 hover:bg-secondary text-foreground border border-border shadow-sm shrink-0 transition-all active:scale-95"
                            title="Zurück"
                            aria-label="Zurück"
                        >
                            <ArrowLeft className="size-4" />
                        </button>
                        <div className="p-2 rounded-xl bg-gradient-to-br from-blue-500/20 to-indigo-500/20 text-blue-600 dark:text-blue-400 shrink-0 iphone-landscape-portfolio-icon">
                            <TrendingUp className="size-5" />
                        </div>
                        <h2 className="text-base sm:text-lg font-bold truncate iphone-landscape-portfolio-title">
                            <span className="hidden sm:inline">Performance Details</span>
                            <span className="sm:hidden">Performance</span>
                        </h2>
                    </div>
                    <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                        {/* Filter Tabs: Alle / Aktien / ETFs */}
                        <div className="flex items-center bg-secondary/80 p-0.5 rounded-lg border border-border">
                            <button
                                type="button"
                                onClick={() => setAssetFilter('all')}
                                className={cn(
                                    "px-2 sm:px-2.5 py-0.5 sm:py-1 text-[11px] sm:text-xs font-semibold rounded-md transition-all cursor-pointer",
                                    assetFilter === 'all'
                                        ? "bg-primary text-primary-foreground shadow-sm"
                                        : "text-muted-foreground hover:text-foreground"
                                )}
                            >
                                Alle
                            </button>
                            <button
                                type="button"
                                onClick={() => setAssetFilter('stock')}
                                className={cn(
                                    "px-2 sm:px-2.5 py-0.5 sm:py-1 text-[11px] sm:text-xs font-semibold rounded-md transition-all cursor-pointer",
                                    assetFilter === 'stock'
                                        ? "bg-primary text-primary-foreground shadow-sm"
                                        : "text-muted-foreground hover:text-foreground"
                                )}
                            >
                                Aktien
                            </button>
                            <button
                                type="button"
                                onClick={() => setAssetFilter('etf')}
                                className={cn(
                                    "px-2 sm:px-2.5 py-0.5 sm:py-1 text-[11px] sm:text-xs font-semibold rounded-md transition-all cursor-pointer",
                                    assetFilter === 'etf'
                                        ? "bg-primary text-primary-foreground shadow-sm"
                                        : "text-muted-foreground hover:text-foreground"
                                )}
                            >
                                ETFs
                            </button>
                        </div>
                        <button
                            onClick={() => refreshAllPrices(true)}
                            disabled={isGlobalRefreshing}
                            className={cn(
                                "flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all shadow-sm shrink-0 whitespace-nowrap iphone-landscape-btn",
                                "bg-blue-600 text-white border-blue-700 hover:bg-blue-700 hover:border-blue-800",
                                "active:scale-95",
                                isGlobalRefreshing && "opacity-50 cursor-not-allowed"
                            )}
                            title="Alle Aktienpreise aktualisieren"
                        >
                            <RefreshCw className={cn("size-3.5", isGlobalRefreshing && "animate-spin")} />
                            <span className="hidden sm:inline">
                                {isGlobalRefreshing
                                    ? 'Aktualisiere...'
                                    : lastGlobalRefresh
                                        ? `Vor ${Math.floor((new Date().getTime() - lastGlobalRefresh.getTime()) / 60000)} Min`
                                        : 'Jetzt aktualisieren'}
                            </span>
                        </button>
                    </div>
                </div>

                <div className="flex flex-col flex-1 min-h-0 overflow-hidden iphone-modal-body-card iphone-modal-body-flush">
                {/* Summary Totals */}
                <div className="grid grid-cols-2 gap-2 p-2.5 sm:gap-3 sm:p-3 bg-muted/20 border-b border-border shrink-0">
                    <div className="bg-card py-2.5 px-2.5 sm:p-3 sm:px-3.5 rounded-lg border border-border shadow-sm flex flex-col justify-between">
                        <div className="flex items-center justify-between mb-1 gap-1.5 flex-wrap min-h-[1.75rem]">
                            <span className="text-[13px] sm:text-base text-white font-semibold tracking-tight whitespace-nowrap">Tages-Performance</span>
                            {isAnyActiveToday ? (
                                <div className="inline-flex items-center bg-secondary/80 p-0.5 rounded-md border border-border text-[10px] sm:text-xs font-bold tabular-nums shadow-xs">
                                    <button
                                        type="button"
                                        onClick={() => setViewMode('live')}
                                        className={cn(
                                            "px-2 py-0.5 rounded transition-all cursor-pointer flex items-center gap-1",
                                            viewMode === 'live'
                                                ? "bg-emerald-600 text-white shadow-xs font-bold"
                                                : "text-muted-foreground hover:text-foreground"
                                        )}
                                        title="Heutige Live-Sitzung"
                                    >
                                        {isAnyMarketOpen && <span className="size-1.5 rounded-full bg-white animate-pulse" />}
                                        Live {todayDateLabel}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setViewMode('yesterday')}
                                        className={cn(
                                            "px-2 py-0.5 rounded transition-all cursor-pointer flex items-center gap-1",
                                            viewMode === 'yesterday'
                                                ? "bg-blue-600 text-white shadow-xs font-bold"
                                                : "text-muted-foreground hover:text-foreground"
                                        )}
                                        title={`Schlusskurse vom Vortag (${yesterdayDateLabel}) anzeigen`}
                                    >
                                        {yesterdayDateLabel}
                                    </button>
                                </div>
                            ) : (
                                <span title={fullDateLabel} className="text-[10px] sm:text-xs font-bold text-slate-900 dark:text-slate-100 bg-secondary/80 border border-border px-1.5 py-0.5 rounded-md tabular-nums whitespace-nowrap shadow-xs">
                                    Schlusskurse vom {yesterdayDateLabel}
                                </span>
                            )}
                        </div>
                        <div className="flex items-baseline gap-2 flex-wrap">
                            <span className={cn(
                                "text-[18px] sm:text-xl md:text-2xl font-bold font-sans tabular-nums tracking-tight whitespace-nowrap",
                                displayedDailyGain >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-[#ff3b30]"
                            )}>
                                {displayedDailyGain >= 0 ? '+' : ''}{formatCurrency(displayedDailyGain, 'CHF')}
                            </span>
                            <span className={cn(
                                "text-xs sm:text-sm font-bold tabular-nums px-1.5 py-0.5 rounded-md inline-flex items-center gap-0.5 whitespace-nowrap",
                                displayedDailyGain >= 0
                                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                    : "bg-rose-500/10 text-rose-600 dark:text-[#ff3b30]"
                            )}>
                                {displayedDailyGain >= 0 ? '+' : ''}{displayedDailyGainPercent.toFixed(2)}%
                            </span>
                        </div>
                    </div>
                    <div className="bg-card py-2.5 px-2.5 sm:p-3 sm:px-3.5 rounded-lg border border-border shadow-sm flex flex-col justify-between items-end text-right">
                        <div className="flex items-center justify-end mb-1 gap-1.5 flex-wrap w-full min-h-[1.75rem]">
                            <span className="text-[13px] sm:text-base text-white font-semibold tracking-tight whitespace-nowrap">Gesamt-Performance</span>
                            <span className="text-[10px] sm:text-xs font-bold text-slate-900 dark:text-slate-100 bg-secondary/80 border border-border px-1.5 py-0.5 rounded-md tabular-nums whitespace-nowrap shadow-xs">
                                {isViewingYesterday ? `Seit Kauf per ${yesterdayDateLabel} Schlusskurs` : `Seit Kauf Live ${todayDateLabel}`}
                            </span>
                        </div>
                        <div className="flex items-baseline justify-end gap-2 flex-wrap w-full">
                            <span className={cn(
                                "text-[18px] sm:text-xl md:text-2xl font-bold font-sans tabular-nums tracking-tight whitespace-nowrap",
                                totalPerformanceGain >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-[#ff3b30]"
                            )}>
                                {totalPerformanceGain >= 0 ? '+' : ''}{formatCurrency(totalPerformanceGain, 'CHF')}
                            </span>
                            <span className={cn(
                                "text-xs sm:text-sm font-bold tabular-nums px-1.5 py-0.5 rounded-md inline-flex items-center gap-0.5 whitespace-nowrap",
                                totalPerformanceGain >= 0
                                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                    : "bg-rose-500/10 text-rose-600 dark:text-[#ff3b30]"
                            )}>
                                {totalPerformanceGain >= 0 ? '+' : ''}{totalPerformanceGainPercent.toFixed(2)}%
                            </span>
                        </div>
                    </div>
                </div>

                <div
                    onTouchStart={handleTouchStart}
                    onTouchEnd={handleTouchEnd}
                    className="overflow-y-auto overflow-x-auto p-0 flex-1 w-full snap-y snap-mandatory scroll-pt-[48px] md:snap-none md:scroll-pt-0"
                >
                    <table className="w-full text-xs md:text-sm border-collapse table-fixed md:table-auto">
                        <thead>
                            <tr className="border-b border-border bg-muted/20">
                                {/* 0. Aktie / ETF */}
                                <th
                                    onClick={() => setSortConfig({ key: 'default', direction: 'desc' })}
                                    className="text-left px-3 md:px-4 py-0 md:py-2 h-12 md:h-auto font-semibold text-foreground md:text-muted-foreground text-[15px] md:text-xs uppercase tracking-wider sticky top-0 left-0 z-40 bg-card shadow-[5px_0_5px_-5px_rgba(0,0,0,0.1)] w-[170px] min-w-[170px] max-w-[170px] md:w-[280px] md:min-w-[260px] lg:w-[340px] lg:min-w-[320px] md:max-w-none touch-pan-y align-middle cursor-pointer select-none"
                                    title="Standard-Sortierung (Offene Börsen zuerst, A-Z)"
                                >
                                    Aktie / ETF
                                </th>

                                {/* 1. Kurs */}
                                <th
                                    className={cn(
                                        "px-1 md:px-2 py-0 md:py-2 h-12 md:h-auto font-semibold text-foreground md:text-muted-foreground text-[13px] md:text-xs uppercase tracking-wider text-center md:text-right sticky top-0 z-30 bg-card align-middle md:w-[90px] lg:w-[100px] whitespace-nowrap",
                                        mobileColIndex === 0 ? "table-cell" : "hidden md:table-cell"
                                    )}
                                >
                                    <div className="flex md:hidden items-center justify-between w-full h-12">
                                        <button
                                            type="button"
                                            onClick={(e) => { e.stopPropagation(); setMobileColIndex((i) => Math.max(0, i - 1)); }}
                                            disabled={mobileColIndex === 0}
                                            className="p-1.5 rounded hover:bg-muted disabled:opacity-20 transition-opacity shrink-0"
                                        >
                                            <ChevronLeft className="size-4" />
                                        </button>
                                        <span className="whitespace-nowrap text-center flex-1 px-1">
                                            Kurs
                                        </span>
                                        <button
                                            type="button"
                                            onClick={(e) => { e.stopPropagation(); setMobileColIndex((i) => Math.min(4, i + 1)); }}
                                            disabled={mobileColIndex === 4}
                                            className="p-1.5 rounded hover:bg-muted disabled:opacity-20 transition-opacity shrink-0"
                                        >
                                            <ChevronRight className="size-4" />
                                        </button>
                                    </div>
                                    <span className="hidden md:inline whitespace-nowrap">Kurs</span>
                                </th>

                                {/* 2. % am Datum */}
                                <th
                                    className={cn(
                                        "px-1 md:px-2 py-0 md:py-2 h-12 md:h-auto font-semibold text-foreground md:text-muted-foreground text-[13px] md:text-xs uppercase tracking-wider text-center md:text-right sticky top-0 z-30 bg-card align-middle md:w-[105px] lg:w-[115px] whitespace-nowrap",
                                        mobileColIndex === 1 ? "table-cell" : "hidden md:table-cell"
                                    )}
                                >
                                    <div className="flex md:hidden items-center justify-between w-full h-12">
                                        <button
                                            type="button"
                                            onClick={(e) => { e.stopPropagation(); setMobileColIndex((i) => Math.max(0, i - 1)); }}
                                            disabled={mobileColIndex === 0}
                                            className="p-1.5 rounded hover:bg-muted disabled:opacity-20 transition-opacity shrink-0"
                                        >
                                            <ChevronLeft className="size-4" />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={(e) => { e.stopPropagation(); toggleSort('dailyPct'); }}
                                            className={cn(
                                                "whitespace-nowrap text-center flex-1 px-1 py-1 rounded hover:bg-muted/50 transition-colors uppercase font-semibold",
                                                sortConfig.key === 'dailyPct' && "text-blue-400"
                                            )}
                                        >
                                            % am {activeDateLabel}{sortConfig.key === 'dailyPct' ? (sortConfig.direction === 'desc' ? ' ↓' : ' ↑') : ''}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={(e) => { e.stopPropagation(); setMobileColIndex((i) => Math.min(4, i + 1)); }}
                                            disabled={mobileColIndex === 4}
                                            className="p-1.5 rounded hover:bg-muted disabled:opacity-20 transition-opacity shrink-0"
                                        >
                                            <ChevronRight className="size-4" />
                                        </button>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => toggleSort('dailyPct')}
                                        className={cn(
                                            "hidden md:inline-flex items-center justify-end gap-1 whitespace-nowrap uppercase font-semibold hover:text-foreground transition-colors",
                                            sortConfig.key === 'dailyPct' && "text-blue-400"
                                        )}
                                    >
                                        % am {activeDateLabel}{sortConfig.key === 'dailyPct' ? (sortConfig.direction === 'desc' ? ' ↓' : ' ↑') : ''}
                                    </button>
                                </th>

                                {/* 3. CHF am Datum */}
                                <th
                                    className={cn(
                                        "px-1 md:px-2 py-0 md:py-2 h-12 md:h-auto font-semibold text-foreground md:text-muted-foreground text-[13px] md:text-xs uppercase tracking-wider text-center md:text-right sticky top-0 z-30 bg-card align-middle md:w-[120px] lg:w-[130px] whitespace-nowrap",
                                        mobileColIndex === 2 ? "table-cell" : "hidden md:table-cell"
                                    )}
                                >
                                    <div className="flex md:hidden items-center justify-between w-full h-12">
                                        <button
                                            type="button"
                                            onClick={(e) => { e.stopPropagation(); setMobileColIndex((i) => Math.max(0, i - 1)); }}
                                            disabled={mobileColIndex === 0}
                                            className="p-1.5 rounded hover:bg-muted disabled:opacity-20 transition-opacity shrink-0"
                                        >
                                            <ChevronLeft className="size-4" />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={(e) => { e.stopPropagation(); toggleSort('dailyChf'); }}
                                            className={cn(
                                                "whitespace-nowrap text-center flex-1 px-1 py-1 rounded hover:bg-muted/50 transition-colors uppercase font-semibold",
                                                sortConfig.key === 'dailyChf' && "text-blue-400"
                                            )}
                                        >
                                            CHF am {activeDateLabel}{sortConfig.key === 'dailyChf' ? (sortConfig.direction === 'desc' ? ' ↓' : ' ↑') : ''}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={(e) => { e.stopPropagation(); setMobileColIndex((i) => Math.min(4, i + 1)); }}
                                            disabled={mobileColIndex === 4}
                                            className="p-1.5 rounded hover:bg-muted disabled:opacity-20 transition-opacity shrink-0"
                                        >
                                            <ChevronRight className="size-4" />
                                        </button>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => toggleSort('dailyChf')}
                                        className={cn(
                                            "hidden md:inline-flex items-center justify-end gap-1 whitespace-nowrap uppercase font-semibold hover:text-foreground transition-colors",
                                            sortConfig.key === 'dailyChf' && "text-blue-400"
                                        )}
                                    >
                                        CHF am {activeDateLabel}{sortConfig.key === 'dailyChf' ? (sortConfig.direction === 'desc' ? ' ↓' : ' ↑') : ''}
                                    </button>
                                </th>

                                {/* Spacer (Desktop only) */}
                                <th className="hidden lg:table-cell lg:w-[16px] sticky top-0 z-30 bg-card"></th>

                                {/* 4. Performance % */}
                                <th
                                    className={cn(
                                        "px-1 md:px-2 py-0 md:py-2 h-12 md:h-auto font-semibold text-foreground md:text-muted-foreground text-[13px] md:text-xs uppercase tracking-wider text-center md:text-right sticky top-0 z-30 bg-card align-middle md:w-[110px] lg:w-[120px] whitespace-nowrap",
                                        mobileColIndex === 3 ? "table-cell" : "hidden md:table-cell"
                                    )}
                                >
                                    <div className="flex md:hidden items-center justify-between w-full h-12">
                                        <button
                                            type="button"
                                            onClick={(e) => { e.stopPropagation(); setMobileColIndex((i) => Math.max(0, i - 1)); }}
                                            disabled={mobileColIndex === 0}
                                            className="p-1.5 rounded hover:bg-muted disabled:opacity-20 transition-opacity shrink-0"
                                        >
                                            <ChevronLeft className="size-4" />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={(e) => { e.stopPropagation(); toggleSort('totalPct'); }}
                                            className={cn(
                                                "whitespace-nowrap text-center flex-1 px-1 py-1 rounded hover:bg-muted/50 transition-colors uppercase font-semibold",
                                                sortConfig.key === 'totalPct' && "text-blue-400"
                                            )}
                                        >
                                            Performance %{sortConfig.key === 'totalPct' ? (sortConfig.direction === 'desc' ? ' ↓' : ' ↑') : ''}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={(e) => { e.stopPropagation(); setMobileColIndex((i) => Math.min(4, i + 1)); }}
                                            disabled={mobileColIndex === 4}
                                            className="p-1.5 rounded hover:bg-muted disabled:opacity-20 transition-opacity shrink-0"
                                        >
                                            <ChevronRight className="size-4" />
                                        </button>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => toggleSort('totalPct')}
                                        className={cn(
                                            "hidden md:inline-flex items-center justify-end gap-1 whitespace-nowrap uppercase font-semibold hover:text-foreground transition-colors",
                                            sortConfig.key === 'totalPct' && "text-blue-400"
                                        )}
                                    >
                                        Performance %{sortConfig.key === 'totalPct' ? (sortConfig.direction === 'desc' ? ' ↓' : ' ↑') : ''}
                                    </button>
                                </th>

                                {/* 5. Performance CHF */}
                                <th
                                    className={cn(
                                        "px-1 md:pr-4 md:pl-2 py-0 md:py-2 h-12 md:h-auto font-semibold text-foreground md:text-muted-foreground text-[13px] md:text-xs uppercase tracking-wider text-center md:text-right sticky top-0 z-30 bg-card align-middle md:w-[140px] lg:w-[155px] whitespace-nowrap",
                                        mobileColIndex === 4 ? "table-cell" : "hidden md:table-cell"
                                    )}
                                >
                                    <div className="flex md:hidden items-center justify-between w-full h-12">
                                        <button
                                            type="button"
                                            onClick={(e) => { e.stopPropagation(); setMobileColIndex((i) => Math.max(0, i - 1)); }}
                                            disabled={mobileColIndex === 0}
                                            className="p-1.5 rounded hover:bg-muted disabled:opacity-20 transition-opacity shrink-0"
                                        >
                                            <ChevronLeft className="size-4" />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={(e) => { e.stopPropagation(); toggleSort('totalChf'); }}
                                            className={cn(
                                                "whitespace-nowrap text-center flex-1 px-1 py-1 rounded hover:bg-muted/50 transition-colors uppercase font-semibold",
                                                sortConfig.key === 'totalChf' && "text-blue-400"
                                            )}
                                        >
                                            Performance CHF{sortConfig.key === 'totalChf' ? (sortConfig.direction === 'desc' ? ' ↓' : ' ↑') : ''}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={(e) => { e.stopPropagation(); setMobileColIndex((i) => Math.min(4, i + 1)); }}
                                            disabled={mobileColIndex === 4}
                                            className="p-1.5 rounded hover:bg-muted disabled:opacity-20 transition-opacity shrink-0"
                                        >
                                            <ChevronRight className="size-4" />
                                        </button>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => toggleSort('totalChf')}
                                        className={cn(
                                            "hidden md:inline-flex items-center justify-end gap-1 whitespace-nowrap uppercase font-semibold hover:text-foreground transition-colors",
                                            sortConfig.key === 'totalChf' && "text-blue-400"
                                        )}
                                    >
                                        Performance CHF{sortConfig.key === 'totalChf' ? (sortConfig.direction === 'desc' ? ' ↓' : ' ↑') : ''}
                                    </button>
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {sortedPositions.map((p) => {
                                const { dailyGainCHF, totalGainCHF, totalGainPercent, displayPrice } = getPositionMetrics(p);
                                const snap = (isViewingYesterday && yesterdaySnapshot?.positions) ? yesterdaySnapshot.positions[p.stock.id] : null;
                                const dailyGainPercent = snap ? snap.dailyGainPercent : p.dailyGainPercent;
                                const isDailyPositive = dailyGainCHF >= 0;
                                const isDailyZero = Math.abs(dailyGainCHF) < 0.005;
                                const isTotalPositive = totalGainCHF >= 0;

                                // Market State Logic (v3.11.481):
                                const calcState = estimateMarketState(p.stock.symbol, p.stock.currency);
                                const isMarketOpen = isViewingYesterday ? false : (calcState === 'REGULAR');
                                const hasOpened = hasMarketOpenedToday(p.stock.symbol, p.stock.currency);
                                const isWaitingForOpen = isViewingYesterday ? false : (isAnyActiveToday && !hasOpened);
                                const openingHint = getMarketOpeningTimeHint(p.stock.symbol, p.stock.currency);

                                return (
                                    <tr
                                        key={p.id}
                                        onClick={() => handleRowClick(p.stock.id)}
                                        className="hover:bg-muted/30 transition-colors cursor-pointer group border-b border-border/50 snap-start snap-always h-[60px] md:h-auto"
                                    >
                                        {/* 0. Aktie / ETF */}
                                        <td className="px-3 py-1.5 md:py-2.5 md:px-4 h-[60px] md:h-auto font-medium sticky left-0 z-10 group-hover:bg-muted/30 transition-colors shadow-[5px_0_5px_-5px_rgba(0,0,0,0.1)] w-[170px] min-w-[170px] max-w-[170px] md:w-[280px] md:min-w-[260px] lg:w-[340px] lg:min-w-[320px] md:max-w-none overflow-hidden touch-pan-y align-middle">
                                            <div className="absolute inset-0 bg-card -z-10" />
                                            <div className="flex items-center gap-2 md:gap-3 relative">
                                                <Logo
                                                    url={p.stock.logoUrl}
                                                    alt={p.stock.name}
                                                    fallback={p.stock.symbol.slice(0, 2)}
                                                    size="size-8 md:size-10"
                                                />
                                                <div className="flex flex-col min-w-0 flex-1 justify-center">
                                                    <span
                                                        className="font-bold text-[13px] md:text-sm truncate md:whitespace-normal md:line-clamp-2 block group-hover:text-primary transition-colors cursor-pointer leading-tight"
                                                        title={p.stock.name}
                                                    >
                                                        {p.stock.name}
                                                    </span>
                                                    <div className="flex items-center gap-1.5 mt-0.5">
                                                        <span className="text-[11px] text-muted-foreground uppercase truncate">{p.stock.symbol}</span>
                                                        {isMarketOpen ? (
                                                            <div className="size-2 flex-shrink-0 rounded-full bg-green-500 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.5)] border border-background" title={`Markt geöffnet (${calcState})`} />
                                                        ) : (
                                                            <div className="size-2 flex-shrink-0 rounded-full bg-red-500 border border-background" title={isViewingYesterday ? `Schlusskurs vom ${yesterdayDateLabel}` : isWaitingForOpen ? `${openingHint} (${calcState})` : `Markt geschlossen (${calcState})`} />
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </td>

                                        {/* 1. Current Price (Original currency only) */}
                                        <td
                                            className={cn(
                                                "px-3 py-1.5 md:py-2.5 md:px-2 h-[60px] md:h-auto text-center md:text-right font-medium whitespace-nowrap align-middle md:w-[90px] lg:w-[100px]",
                                                mobileColIndex === 0 ? "table-cell" : "hidden md:table-cell"
                                            )}
                                        >
                                            <span className="font-bold text-[15px] md:text-sm text-foreground">
                                                {formatCurrency(displayPrice, p.stock.currency, false)}
                                            </span>
                                        </td>

                                        {/* 2. Daily Performance % */}
                                        <td
                                            className={cn(
                                                "px-3 py-1.5 md:py-2.5 md:px-2 h-[60px] md:h-auto text-center md:text-right font-bold text-sm whitespace-nowrap align-middle md:w-[105px] lg:w-[115px]",
                                                mobileColIndex === 1 ? "table-cell" : "hidden md:table-cell",
                                                isWaitingForOpen
                                                    ? "text-muted-foreground/60 dark:text-slate-500"
                                                    : isDailyZero
                                                        ? "text-muted-foreground"
                                                        : isDailyPositive
                                                            ? "text-green-600 dark:text-green-400"
                                                            : "text-red-600 dark:text-[#ff3b30]"
                                            )}
                                            title={isWaitingForOpen ? openingHint : undefined}
                                        >
                                            <span className="tabular-nums">{isWaitingForOpen || isDailyZero ? '0.00%' : `${isDailyPositive ? '+' : ''}${dailyGainPercent.toFixed(2)}%`}</span>
                                        </td>

                                        {/* 3. Daily Performance CHF */}
                                        <td
                                            className={cn(
                                                "px-3 py-1.5 md:py-2.5 md:px-2 h-[60px] md:h-auto text-center md:text-right font-bold text-sm whitespace-nowrap align-middle md:w-[120px] lg:w-[130px]",
                                                mobileColIndex === 2 ? "table-cell" : "hidden md:table-cell",
                                                isWaitingForOpen
                                                    ? "text-muted-foreground/60 dark:text-slate-500"
                                                    : isDailyZero
                                                        ? "text-muted-foreground"
                                                        : isDailyPositive
                                                            ? "text-green-600 dark:text-green-400"
                                                            : "text-red-600 dark:text-[#ff3b30]"
                                            )}
                                            title={isWaitingForOpen ? openingHint : undefined}
                                        >
                                            <span className="tabular-nums">{isWaitingForOpen || isDailyZero ? '0.00 CHF' : `${isDailyPositive ? '+' : ''}${formatCurrency(dailyGainCHF, 'CHF').replace('CHF', '').trim()} CHF`}</span>
                                        </td>

                                        {/* Spacer (Desktop only) */}
                                        <td className="hidden lg:table-cell lg:w-[16px]"></td>

                                        {/* 4. Total Performance % */}
                                        <td
                                            className={cn(
                                                "px-3 py-1.5 md:py-2.5 md:px-2 h-[60px] md:h-auto text-center md:text-right font-bold text-sm whitespace-nowrap align-middle md:w-[110px] lg:w-[120px]",
                                                mobileColIndex === 3 ? "table-cell" : "hidden md:table-cell",
                                                isTotalPositive ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-[#ff3b30]"
                                            )}
                                        >
                                            <span className="tabular-nums">{isTotalPositive ? '+' : ''}{totalGainPercent.toFixed(2)}%</span>
                                        </td>

                                        {/* 5. Total Performance CHF */}
                                        <td
                                            className={cn(
                                                "px-3 py-1.5 md:py-2.5 md:pr-4 md:pl-2 h-[60px] md:h-auto text-center md:text-right font-bold text-sm whitespace-nowrap align-middle md:w-[140px] lg:w-[155px]",
                                                mobileColIndex === 4 ? "table-cell" : "hidden md:table-cell",
                                                isTotalPositive ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-[#ff3b30]"
                                            )}
                                        >
                                            <span className="tabular-nums">{isTotalPositive ? '+' : ''}{formatCurrency(totalGainCHF, 'CHF').replace('CHF', '').trim()} CHF</span>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
                </div>
            </div>
        </div>,
        document.body
    );
}
