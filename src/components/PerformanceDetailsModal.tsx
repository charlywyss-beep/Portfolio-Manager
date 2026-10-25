import { ArrowLeft, TrendingUp, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useEffect, useState, useRef } from 'react';
import { useCurrencyFormatter } from '../utils/currency';
import { cn } from '../utils';
import { Logo } from './Logo';
import { estimateMarketState } from '../utils/market';
import { usePortfolio } from '../context/PortfolioContext';

interface PerformanceDetailsModalProps {
    isOpen: boolean;
    onClose: () => void;
    positions: any[]; // Using any to avoid complex import of Position type extended with dailyGain
}

export function PerformanceDetailsModal({ isOpen, onClose, positions }: PerformanceDetailsModalProps) {
    const { convertToCHF, formatCurrency } = useCurrencyFormatter();
    const { refreshAllPrices, isGlobalRefreshing, lastGlobalRefresh, refreshTick } = usePortfolio();
    const navigate = useNavigate();

    // 0: Kurs, 1: % am DD.MM., 2: CHF am DD.MM., 3: Performance %, 4: Performance CHF
    const [mobileColIndex, setMobileColIndex] = useState(0);
    const touchStartRef = useRef<{ x: number; y: number; time: number; isStockCol: boolean } | null>(null);

    const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
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

    // Sort positions:
    // 1. Priorität: Geöffnete Börsen zuerst (Live-Handel), danach geschlossene Börsen
    // 2. Priorität: Alphabetisch A - Z wie bisher (Aktien vor ETFs)
    const sortedPositions = [...positions].sort((a, b) => {
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

    const totalPerformanceGain = sortedPositions.reduce((sum, p) => {
        const currentValue = p.shares * p.stock.currentPrice;
        const purchaseValue = (p.purchases || []).reduce((pSum: number, purchase: any) =>
            pSum + (purchase.shares * purchase.price), 0);
        // Use FX-aware CHF calculation
        const currentValueCHF = convertToCHF(currentValue, p.stock.currency);
        const entryFxRate = p.averageEntryFxRate || 1;
        const purchaseValueCHF = p.stock.currency !== 'CHF'
            ? purchaseValue * entryFxRate
            : purchaseValue;
        return sum + (currentValueCHF - purchaseValueCHF);
    }, 0);

    const handleRowClick = (stockId: string) => {
        navigate(`/stock/${stockId}?from=performance`);
        onClose();
    };

    const todayDateLabel = new Date().toLocaleDateString('de-CH', { day: '2-digit', month: '2-digit' });

    return (
        <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-2 sm:p-4 md:py-3 iphone-modal-overlay"
            onClick={onClose}
        >
            <div
                className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-[95vw] md:max-w-4xl max-h-[96vh] flex flex-col animate-in fade-in zoom-in-95 duration-200 relative z-10 overflow-hidden iphone-modal-shell"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card z-10 iphone-modal-header-card">
                    <div className="flex items-center gap-2.5 min-w-0">
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
                        <h2 className="text-lg font-bold truncate iphone-landscape-portfolio-title">
                            Performance Details
                        </h2>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
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
                <div className="grid grid-cols-2 gap-3 p-3 bg-muted/20 border-b border-border shrink-0">
                    <div className="bg-card p-2.5 px-3.5 rounded-lg border border-border shadow-sm flex flex-col justify-between">
                        <span className="text-xs text-muted-foreground font-medium mb-1 truncate">Tages-Performance</span>
                        <span className={cn(
                            "text-base sm:text-lg md:text-xl font-bold tracking-tight",
                            totalDailyGain >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
                        )}>
                            {totalDailyGain >= 0 ? '+' : ''}{formatCurrency(totalDailyGain, 'CHF')}
                        </span>
                    </div>
                    <div className="bg-card p-2.5 px-3.5 rounded-lg border border-border shadow-sm flex flex-col justify-between">
                        <span className="text-xs text-muted-foreground font-medium mb-1 truncate">Gesamt-Performance</span>
                        <span className={cn(
                            "text-base sm:text-lg md:text-xl font-bold tracking-tight",
                            totalPerformanceGain >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
                        )}>
                            {totalPerformanceGain >= 0 ? '+' : ''}{formatCurrency(totalPerformanceGain, 'CHF')}
                        </span>
                    </div>
                </div>

                <div
                    onTouchStart={handleTouchStart}
                    onTouchEnd={handleTouchEnd}
                    className="overflow-y-auto p-0 flex-1 w-full snap-y snap-mandatory scroll-pt-[48px] md:snap-none md:scroll-pt-0"
                >
                    <table className="w-full text-xs md:text-sm border-collapse table-fixed md:table-auto">
                        <thead>
                            <tr className="border-b border-border bg-muted/20">
                                {/* 0. Aktie / ETF */}
                                <th className="text-left px-3 md:px-4 py-0 md:py-2 h-12 md:h-auto font-semibold text-foreground md:text-muted-foreground text-[15px] md:text-xs uppercase tracking-wider sticky top-0 left-0 z-40 bg-card shadow-[5px_0_5px_-5px_rgba(0,0,0,0.1)] w-[170px] min-w-[170px] max-w-[170px] md:w-[200px] md:min-w-[200px] md:max-w-[200px] touch-pan-y align-middle">
                                    Aktie / ETF
                                </th>

                                {/* 1. Kurs */}
                                <th
                                    className={cn(
                                        "px-1 md:px-2 py-0 md:py-2 h-12 md:h-auto font-semibold text-foreground md:text-muted-foreground text-[13px] md:text-xs uppercase tracking-wider text-right sticky top-0 z-30 bg-card align-middle md:w-[85px] whitespace-nowrap",
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
                                        "px-1 md:px-2 py-0 md:py-2 h-12 md:h-auto font-semibold text-foreground md:text-muted-foreground text-[13px] md:text-xs uppercase tracking-wider text-right sticky top-0 z-30 bg-card align-middle md:w-[105px] whitespace-nowrap",
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
                                        <span className="whitespace-nowrap text-center flex-1 px-1">
                                            % am {todayDateLabel}
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
                                    <span className="hidden md:inline whitespace-nowrap">% am {todayDateLabel}</span>
                                </th>

                                {/* 3. CHF am Datum */}
                                <th
                                    className={cn(
                                        "px-1 md:px-2 py-0 md:py-2 h-12 md:h-auto font-semibold text-foreground md:text-muted-foreground text-[13px] md:text-xs uppercase tracking-wider text-right sticky top-0 z-30 bg-card align-middle md:w-[115px] whitespace-nowrap",
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
                                        <span className="whitespace-nowrap text-center flex-1 px-1">
                                            CHF am {todayDateLabel}
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
                                    <span className="hidden md:inline whitespace-nowrap">CHF am {todayDateLabel}</span>
                                </th>

                                {/* Spacer (Desktop only) */}
                                <th className="hidden md:table-cell md:w-[30px] sticky top-0 z-30 bg-card"></th>

                                {/* 4. Performance % */}
                                <th
                                    className={cn(
                                        "px-1 md:px-2 py-0 md:py-2 h-12 md:h-auto font-semibold text-foreground md:text-muted-foreground text-[13px] md:text-xs uppercase tracking-wider text-right sticky top-0 z-30 bg-card align-middle md:w-[130px] whitespace-nowrap",
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
                                        <span className="whitespace-nowrap text-center flex-1 px-1">
                                            Performance %
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
                                    <span className="hidden md:inline whitespace-nowrap">Performance %</span>
                                </th>

                                {/* 5. Performance CHF */}
                                <th
                                    className={cn(
                                        "px-1 md:pr-4 md:pl-2 py-0 md:py-2 h-12 md:h-auto font-semibold text-foreground md:text-muted-foreground text-[13px] md:text-xs uppercase tracking-wider text-right sticky top-0 z-30 bg-card align-middle md:w-[145px] whitespace-nowrap",
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
                                        <span className="whitespace-nowrap text-center flex-1 px-1">
                                            Performance CHF
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
                                    <span className="hidden md:inline whitespace-nowrap">Performance CHF</span>
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {sortedPositions.map((p) => {
                                const dailyGainCHF = convertToCHF(p.dailyGain, p.stock.currency);
                                const isDailyPositive = dailyGainCHF >= 0;

                                // Calculate total performance with proper FX handling
                                const currentValue = p.shares * p.stock.currentPrice;
                                const purchaseValue = (p.purchases || []).reduce((sum: number, purchase: any) =>
                                    sum + (purchase.shares * purchase.price), 0);
                                
                                // CHF values: current value at today's FX rate, purchase at historical FX rate
                                const currentValueCHF = convertToCHF(currentValue, p.stock.currency);
                                const entryFxRate = p.averageEntryFxRate || 1;
                                const purchaseValueCHF = p.stock.currency !== 'CHF'
                                    ? purchaseValue * entryFxRate
                                    : purchaseValue;
                                const totalGainCHF = currentValueCHF - purchaseValueCHF;
                                const totalGainPercent = purchaseValueCHF > 0 ? (totalGainCHF / purchaseValueCHF) * 100 : 0;
                                const isTotalPositive = totalGainCHF >= 0;

                                // Market State Logic (v3.11.481):
                                const calcState = estimateMarketState(p.stock.symbol, p.stock.currency);
                                const isMarketOpen = calcState === 'REGULAR'; // Only Regular Trading Hours = Green

                                return (
                                    <tr
                                        key={p.id}
                                        onClick={() => handleRowClick(p.stock.id)}
                                        className="hover:bg-muted/30 transition-colors cursor-pointer group border-b border-border/50 snap-start snap-always h-[60px] md:h-auto"
                                    >
                                        {/* 0. Aktie / ETF */}
                                        <td className="px-3 py-1.5 md:py-2.5 md:px-4 h-[60px] md:h-auto font-medium sticky left-0 z-10 group-hover:bg-muted/30 transition-colors shadow-[5px_0_5px_-5px_rgba(0,0,0,0.1)] w-[170px] min-w-[170px] max-w-[170px] md:w-[200px] md:min-w-[200px] md:max-w-[200px] overflow-hidden touch-pan-y align-middle">
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
                                                        className="font-bold text-[13px] md:text-sm truncate block group-hover:text-primary transition-colors cursor-pointer leading-tight"
                                                        title={p.stock.name}
                                                    >
                                                        {p.stock.name}
                                                    </span>
                                                    <div className="flex items-center gap-1.5 mt-0.5">
                                                        <span className="text-[11px] text-muted-foreground uppercase truncate">{p.stock.symbol}</span>
                                                        {isMarketOpen ? (
                                                            <div className="size-2 flex-shrink-0 rounded-full bg-green-500 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.5)] border border-background" title={`Markt geöffnet (${calcState})`} />
                                                        ) : (
                                                            <div className="size-2 flex-shrink-0 rounded-full bg-red-500 border border-background" title={`Markt geschlossen (${calcState})`} />
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </td>

                                        {/* 1. Current Price (Original currency only) */}
                                        <td
                                            className={cn(
                                                "px-3 py-1.5 md:py-2.5 md:px-2 h-[60px] md:h-auto text-right font-medium whitespace-nowrap align-middle md:w-[85px]",
                                                mobileColIndex === 0 ? "table-cell" : "hidden md:table-cell"
                                            )}
                                        >
                                            <span className="font-bold text-[15px] md:text-sm text-foreground">
                                                {formatCurrency(p.stock.currentPrice, p.stock.currency, false)}
                                            </span>
                                        </td>

                                        {/* 2. Daily Performance % */}
                                        <td
                                            className={cn(
                                                "px-3 py-1.5 md:py-2.5 md:px-2 h-[60px] md:h-auto text-right font-bold text-sm whitespace-nowrap align-middle md:w-[105px]",
                                                mobileColIndex === 1 ? "table-cell" : "hidden md:table-cell",
                                                isDailyPositive ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
                                            )}
                                        >
                                            <span className="tabular-nums">{isDailyPositive ? '+' : ''}{p.dailyGainPercent.toFixed(2)}%</span>
                                        </td>

                                        {/* 3. Daily Performance CHF */}
                                        <td
                                            className={cn(
                                                "px-3 py-1.5 md:py-2.5 md:px-2 h-[60px] md:h-auto text-right font-bold text-sm whitespace-nowrap align-middle md:w-[115px]",
                                                mobileColIndex === 2 ? "table-cell" : "hidden md:table-cell",
                                                isDailyPositive ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
                                            )}
                                        >
                                            <span className="tabular-nums">{isDailyPositive ? '+' : ''}{formatCurrency(dailyGainCHF, 'CHF').replace('CHF', '').trim()} CHF</span>
                                        </td>

                                        {/* Spacer (Desktop only) */}
                                        <td className="hidden md:table-cell md:w-[30px]"></td>

                                        {/* 4. Total Performance % */}
                                        <td
                                            className={cn(
                                                "px-3 py-1.5 md:py-2.5 md:px-2 h-[60px] md:h-auto text-right font-bold text-sm whitespace-nowrap align-middle md:w-[130px]",
                                                mobileColIndex === 3 ? "table-cell" : "hidden md:table-cell",
                                                isTotalPositive ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
                                            )}
                                        >
                                            <span className="tabular-nums">{isTotalPositive ? '+' : ''}{totalGainPercent.toFixed(2)}%</span>
                                        </td>

                                        {/* 5. Total Performance CHF */}
                                        <td
                                            className={cn(
                                                "px-3 py-1.5 md:py-2.5 md:pr-4 md:pl-2 h-[60px] md:h-auto text-right font-bold text-sm whitespace-nowrap align-middle md:w-[145px]",
                                                mobileColIndex === 4 ? "table-cell" : "hidden md:table-cell",
                                                isTotalPositive ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
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
        </div>
    );
}
