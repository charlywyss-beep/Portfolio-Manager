import { useNavigate } from 'react-router-dom';
import { usePortfolio } from '../context/PortfolioContext';
import { cn } from '../utils';
import { useCurrencyFormatter } from '../utils/currency';
import { Logo } from './Logo';
import { estimateMarketState } from '../utils/market';
import { translateSector } from '../utils/sectorTranslation';
import { Edit, Trash2, ArrowUpRight, ArrowDownRight, ChevronLeft, ChevronRight, Landmark } from 'lucide-react';
import { ConfirmModal } from './ConfirmModal';
import { useState, useRef } from 'react';

interface PositionTableProps {
    title: string;
    icon: React.ElementType;
    data: any[];
    emptyMessage: string;
    setSelectedPosition: (pos: any) => void;
    setIsEditModalOpen: (open: boolean) => void;
    headerAction?: React.ReactNode;
    hideHeader?: boolean;
}

export function PositionTable({
    title,
    icon: Icon,
    data,
    emptyMessage,
    setSelectedPosition,
    setIsEditModalOpen,
    headerAction,
    hideHeader
}: PositionTableProps) {
    const { deletePosition } = usePortfolio();
    const navigate = useNavigate();
    const { formatCurrency, convertToCHF } = useCurrencyFormatter();
    const [confirmDelete, setConfirmDelete] = useState<{ isOpen: boolean, posId: string | null, name: string }>({ isOpen: false, posId: null, name: '' });

    // 0: Anzahl, 1: Ø Kauf, 2: Invest, 3: Kurs, 4: Wert, 5: %, 6: +/-, 7: Aktion
    const [mobileColIndex, setMobileColIndex] = useState(4); // Default to Wert
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

        // Horizontal swipe: only when touch started to the right of the "Aktie" column (> 140px)
        if (touchStartRef.current.x > 140 && Math.abs(dx) > 35 && Math.abs(dx) > Math.abs(dy) * 1.2 && dt < 700) {
            if (dx < 0) {
                // Swiped left -> next column
                setMobileColIndex((i) => Math.min(7, i + 1));
            } else {
                // Swiped right -> prev column
                setMobileColIndex((i) => Math.max(0, i - 1));
            }
        }
        touchStartRef.current = null;
    };

    return (
        <div className="flex-1 min-h-0 flex flex-col space-y-3 overflow-hidden">
            {!hideHeader && (
                <div className="flex items-center gap-2 shrink-0">
                    <Icon className="size-6 text-primary" />
                    <h2 className="text-xl font-bold tracking-tight">{title}</h2>
                    <span className="text-sm font-mono bg-muted px-2 py-0.5 rounded-full text-muted-foreground">{data.length} Positionen</span>
                    {headerAction && <div className="ml-auto">{headerAction}</div>}
                </div>
            )}
            <div className="flex-1 min-h-0 flex flex-col rounded-xl border border-border bg-card shadow-sm overflow-hidden">
                <div
                    onTouchStart={handleTouchStart}
                    onTouchEnd={handleTouchEnd}
                    className="overflow-y-auto flex-1 min-h-0 p-0 w-full snap-y snap-mandatory scroll-pt-[48px] md:snap-none md:scroll-pt-0"
                >
                    <table className="w-full text-xs md:text-sm border-collapse table-fixed md:table-auto">
                        <thead>
                            <tr className="border-b border-border bg-muted/20">
                                {/* 0. Aktie */}
                                <th className="text-left px-3 md:px-4 py-0 md:py-2 h-12 md:h-auto font-semibold text-foreground md:text-muted-foreground text-[15px] md:text-xs uppercase tracking-wider sticky top-0 left-0 z-40 bg-card shadow-[5px_0_5px_-5px_rgba(0,0,0,0.1)] w-[160px] min-w-[160px] max-w-[160px] md:w-[180px] md:min-w-[180px] md:max-w-[180px] touch-pan-y align-middle">
                                    Aktie
                                </th>

                                {/* 1. Anzahl */}
                                <th
                                    className={cn(
                                        "px-1 md:px-4 py-0 md:py-2 h-12 md:h-auto font-semibold text-foreground md:text-muted-foreground text-[13px] md:text-xs uppercase tracking-wider text-right sticky top-0 z-30 bg-card align-middle",
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
                                            Anzahl
                                        </span>
                                        <button
                                            type="button"
                                            onClick={(e) => { e.stopPropagation(); setMobileColIndex((i) => Math.min(7, i + 1)); }}
                                            disabled={mobileColIndex === 7}
                                            className="p-1.5 rounded hover:bg-muted disabled:opacity-20 transition-opacity shrink-0"
                                        >
                                            <ChevronRight className="size-4" />
                                        </button>
                                    </div>
                                    <span className="hidden md:inline">Anzahl</span>
                                </th>

                                {/* 2. Ø Kauf */}
                                <th
                                    className={cn(
                                        "px-1 md:px-4 py-0 md:py-2 h-12 md:h-auto font-semibold text-foreground md:text-muted-foreground text-[13px] md:text-xs uppercase tracking-wider text-right sticky top-0 z-30 bg-card align-middle",
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
                                            Ø Kauf
                                        </span>
                                        <button
                                            type="button"
                                            onClick={(e) => { e.stopPropagation(); setMobileColIndex((i) => Math.min(7, i + 1)); }}
                                            disabled={mobileColIndex === 7}
                                            className="p-1.5 rounded hover:bg-muted disabled:opacity-20 transition-opacity shrink-0"
                                        >
                                            <ChevronRight className="size-4" />
                                        </button>
                                    </div>
                                    <span className="hidden md:inline">Ø Kauf</span>
                                </th>

                                {/* 3. Invest */}
                                <th
                                    className={cn(
                                        "px-1 md:px-4 py-0 md:py-2 h-12 md:h-auto font-semibold text-foreground md:text-muted-foreground text-[13px] md:text-xs uppercase tracking-wider text-right sticky top-0 z-30 bg-card align-middle",
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
                                            Invest
                                        </span>
                                        <button
                                            type="button"
                                            onClick={(e) => { e.stopPropagation(); setMobileColIndex((i) => Math.min(7, i + 1)); }}
                                            disabled={mobileColIndex === 7}
                                            className="p-1.5 rounded hover:bg-muted disabled:opacity-20 transition-opacity shrink-0"
                                        >
                                            <ChevronRight className="size-4" />
                                        </button>
                                    </div>
                                    <span className="hidden md:inline">Invest</span>
                                </th>

                                {/* 4. Kurs */}
                                <th
                                    className={cn(
                                        "px-1 md:px-4 py-0 md:py-2 h-12 md:h-auto font-semibold text-foreground md:text-muted-foreground text-[13px] md:text-xs uppercase tracking-wider text-right sticky top-0 z-30 bg-card align-middle",
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
                                            Kurs
                                        </span>
                                        <button
                                            type="button"
                                            onClick={(e) => { e.stopPropagation(); setMobileColIndex((i) => Math.min(7, i + 1)); }}
                                            disabled={mobileColIndex === 7}
                                            className="p-1.5 rounded hover:bg-muted disabled:opacity-20 transition-opacity shrink-0"
                                        >
                                            <ChevronRight className="size-4" />
                                        </button>
                                    </div>
                                    <span className="hidden md:inline">Kurs</span>
                                </th>

                                {/* 5. Wert */}
                                <th
                                    className={cn(
                                        "px-1 md:px-4 py-0 md:py-2 h-12 md:h-auto font-semibold text-foreground md:text-muted-foreground text-[13px] md:text-xs uppercase tracking-wider text-right sticky top-0 z-30 bg-card align-middle",
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
                                            Wert
                                        </span>
                                        <button
                                            type="button"
                                            onClick={(e) => { e.stopPropagation(); setMobileColIndex((i) => Math.min(7, i + 1)); }}
                                            disabled={mobileColIndex === 7}
                                            className="p-1.5 rounded hover:bg-muted disabled:opacity-20 transition-opacity shrink-0"
                                        >
                                            <ChevronRight className="size-4" />
                                        </button>
                                    </div>
                                    <span className="hidden md:inline">Wert</span>
                                </th>

                                {/* 6. % */}
                                <th
                                    className={cn(
                                        "px-1 md:px-4 py-0 md:py-2 h-12 md:h-auto font-semibold text-foreground md:text-muted-foreground text-[13px] md:text-xs uppercase tracking-wider text-right sticky top-0 z-30 bg-card align-middle",
                                        mobileColIndex === 5 ? "table-cell" : "hidden md:table-cell"
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
                                            %
                                        </span>
                                        <button
                                            type="button"
                                            onClick={(e) => { e.stopPropagation(); setMobileColIndex((i) => Math.min(7, i + 1)); }}
                                            disabled={mobileColIndex === 7}
                                            className="p-1.5 rounded hover:bg-muted disabled:opacity-20 transition-opacity shrink-0"
                                        >
                                            <ChevronRight className="size-4" />
                                        </button>
                                    </div>
                                    <span className="hidden md:inline">%</span>
                                </th>

                                {/* 7. +/- */}
                                <th
                                    className={cn(
                                        "px-1 md:px-4 py-0 md:py-2 h-12 md:h-auto font-semibold text-foreground md:text-muted-foreground text-[13px] md:text-xs uppercase tracking-wider text-right sticky top-0 z-30 bg-card align-middle",
                                        mobileColIndex === 6 ? "table-cell" : "hidden md:table-cell"
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
                                            +/-
                                        </span>
                                        <button
                                            type="button"
                                            onClick={(e) => { e.stopPropagation(); setMobileColIndex((i) => Math.min(7, i + 1)); }}
                                            disabled={mobileColIndex === 7}
                                            className="p-1.5 rounded hover:bg-muted disabled:opacity-20 transition-opacity shrink-0"
                                        >
                                            <ChevronRight className="size-4" />
                                        </button>
                                    </div>
                                    <span className="hidden md:inline">+/-</span>
                                </th>

                                {/* 8. Aktion */}
                                <th
                                    className={cn(
                                        "px-1 md:px-2 py-0 md:py-2 h-12 md:h-auto font-semibold text-foreground md:text-muted-foreground text-[13px] md:text-xs uppercase tracking-wider text-center md:text-right sticky top-0 md:sticky md:top-0 md:-right-px bg-card z-30 md:z-40 md:w-[80px] md:shadow-[-5px_0_5px_-5px_rgba(0,0,0,0.1)] align-middle",
                                        mobileColIndex === 7 ? "table-cell" : "hidden md:table-cell"
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
                                            Aktion
                                        </span>
                                        <button
                                            type="button"
                                            onClick={(e) => { e.stopPropagation(); setMobileColIndex((i) => Math.min(7, i + 1)); }}
                                            disabled={mobileColIndex === 7}
                                            className="p-1.5 rounded hover:bg-muted disabled:opacity-20 transition-opacity shrink-0"
                                        >
                                            <ChevronRight className="size-4" />
                                        </button>
                                    </div>
                                    <span className="hidden md:inline">Aktion</span>
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {data.map((pos) => {
                                return (
                                    <tr key={pos.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors group snap-start snap-always h-[60px] md:h-auto">
                                        {/* 0. Aktie */}
                                        <td className="px-3 md:px-4 py-1.5 md:py-2 h-[60px] md:h-auto sticky left-0 z-20 group-hover:bg-muted/30 transition-colors shadow-[5px_0_5px_-5px_rgba(0,0,0,0.1)] w-[160px] min-w-[160px] max-w-[160px] md:w-[180px] md:min-w-[180px] md:max-w-[180px] touch-pan-y align-middle">
                                            <div className="absolute inset-0 bg-card -z-10" />
                                            <div className="relative flex items-center gap-2.5 sm:gap-3">
                                                <Logo
                                                    url={pos.stock.logoUrl}
                                                    alt={pos.stock.name}
                                                    fallback={pos.stock.symbol.slice(0, 2)}
                                                />
                                                <div className="min-w-0 flex-1 flex flex-col items-start gap-0.5">
                                                    <div
                                                        className="font-semibold text-foreground cursor-pointer hover:text-primary transition-colors text-xs sm:text-sm whitespace-pre-line truncate max-w-full"
                                                        onClick={() => navigate(`/stock/${pos.stock.id}?from=portfolio`)}
                                                    >
                                                        {pos.stock.name}
                                                    </div>
                                                    <div className="flex items-center gap-1.5 mt-0.5">
                                                        <div className="text-[10px] sm:text-xs font-mono font-semibold text-foreground/80">{pos.stock.symbol}</div>
                                                        {pos.stock.sector && pos.stock.sector !== 'Simuliert' && (
                                                            <>
                                                                <span className="text-muted-foreground/40 text-[10px]">•</span>
                                                                <span className="text-[10px] sm:text-xs text-muted-foreground truncate">{translateSector(pos.stock.sector)}</span>
                                                            </>
                                                        )}
                                                        {pos.broker && (
                                                            <>
                                                                <span className="text-muted-foreground/40 text-[10px]">•</span>
                                                                <span className="inline-flex items-center gap-1 text-[10px] sm:text-xs font-medium text-primary bg-primary/10 px-1.5 py-0.2 rounded border border-primary/20" title={`Depot: ${pos.broker}`}>
                                                                    <Landmark className="size-2.5 shrink-0" />
                                                                    <span className="truncate max-w-[85px]">{pos.broker}</span>
                                                                </span>
                                                            </>
                                                        )}
                                                        {(() => {
                                                            const calculatedState = estimateMarketState(pos.stock.symbol, pos.stock.currency);
                                                            const isMarketOpen = calculatedState === 'REGULAR';

                                                            return isMarketOpen ? (
                                                                <div className="size-2 rounded-full bg-green-500 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.5)] border border-background shrink-0" title={`Markt geöffnet (${calculatedState})`} />
                                                            ) : (
                                                                <div className="size-2 rounded-full bg-red-500 border border-background shrink-0" title={`Markt geschlossen (${calculatedState})`} />
                                                            );
                                                        })()}
                                                    </div>
                                                </div>
                                            </div>
                                        </td>

                                        {/* 1. Anzahl */}
                                        <td className={cn("px-2 md:px-4 py-1.5 md:py-2 h-[60px] md:h-auto text-right font-medium align-middle", mobileColIndex === 0 ? "table-cell" : "hidden md:table-cell")}>
                                            {pos.shares}
                                        </td>

                                        {/* 2. Kauf Kurs */}
                                        <td className={cn("px-2 md:px-4 py-1.5 md:py-2 h-[60px] md:h-auto text-right align-middle", mobileColIndex === 1 ? "table-cell" : "hidden md:table-cell")}>
                                            <div className="flex flex-col items-end">
                                                <span className="font-medium whitespace-nowrap">{formatCurrency(pos.buyPriceAvg, pos.stock.currency, false)}</span>
                                                {pos.stock.currency !== 'CHF' && (
                                                    <span className="font-medium whitespace-nowrap text-xs text-muted-foreground">
                                                        {formatCurrency(pos.buyValueCHF / pos.shares, 'CHF', false)}
                                                    </span>
                                                )}
                                            </div>
                                        </td>

                                        {/* 3. Invest */}
                                        <td className={cn("px-2 md:px-4 py-1.5 md:py-2 h-[60px] md:h-auto text-right font-medium align-middle", mobileColIndex === 2 ? "table-cell" : "hidden md:table-cell")}>
                                            <div className="flex flex-col items-end">
                                                <span className="font-medium whitespace-nowrap">{formatCurrency(pos.buyValue, pos.stock.currency, false)}</span>
                                                {pos.stock.currency !== 'CHF' && (
                                                    <span className="font-medium whitespace-nowrap text-xs text-muted-foreground">
                                                        {formatCurrency(pos.buyValueCHF, 'CHF', false)}
                                                    </span>
                                                )}
                                            </div>
                                        </td>

                                        {/* 4. Aktueller Kurs */}
                                        <td className={cn("px-2 md:px-4 py-1.5 md:py-2 h-[60px] md:h-auto text-right align-middle", mobileColIndex === 3 ? "table-cell" : "hidden md:table-cell")}>
                                            <div className="flex flex-col items-end">
                                                <span className="font-medium whitespace-nowrap">{formatCurrency(pos.stock.currentPrice, pos.stock.currency, false)}</span>
                                                {pos.stock.currency !== 'CHF' && (
                                                    <span className="font-medium whitespace-nowrap text-xs text-muted-foreground">
                                                        {formatCurrency(convertToCHF(pos.stock.currentPrice, pos.stock.currency), 'CHF', false)}
                                                    </span>
                                                )}
                                            </div>
                                        </td>

                                        {/* 5. Aktueller Wert */}
                                        <td className={cn("px-2 md:px-4 py-1.5 md:py-2 h-[60px] md:h-auto text-right font-bold align-middle", mobileColIndex === 4 ? "table-cell" : "hidden md:table-cell")}>
                                            <div className="flex flex-col items-end">
                                                <span className="font-medium whitespace-nowrap">{formatCurrency(pos.currentValue, pos.stock.currency, false)}</span>
                                                {pos.stock.currency !== 'CHF' && (
                                                    <span className="font-medium whitespace-nowrap text-xs text-muted-foreground">
                                                        {formatCurrency(convertToCHF(pos.currentValue, pos.stock.currency), 'CHF', false)}
                                                    </span>
                                                )}
                                            </div>
                                        </td>

                                        {/* 6. % */}
                                        <td className={cn("px-2 md:px-4 py-1.5 md:py-2 h-[60px] md:h-auto text-right align-middle", mobileColIndex === 5 ? "table-cell" : "hidden md:table-cell")}>
                                            <div className={cn(
                                                "flex items-center justify-end gap-1 font-medium",
                                                pos.gainLossTotal >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
                                            )}>
                                                {pos.gainLossTotal >= 0 ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
                                                {pos.gainLossTotal >= 0 ? '+' : ''}{pos.gainLossTotalPercent.toFixed(2)}%
                                            </div>
                                        </td>

                                        {/* 7. Gesamt +/- */}
                                        <td className={cn("px-2 md:px-4 py-1.5 md:py-2 h-[60px] md:h-auto text-right align-middle", mobileColIndex === 6 ? "table-cell" : "hidden md:table-cell")}>
                                            <div className="flex flex-col items-end gap-0.5">
                                                {(() => {
                                                    const nativeGain = pos.gainLossTotal;
                                                    const chfGain = pos.gainLossTotalCHF;
                                                    const isNativeCHF = pos.stock.currency === 'CHF';

                                                    return (
                                                        <>
                                                            <div className={cn(
                                                                "flex items-center justify-end gap-1.5 font-medium tabular-nums",
                                                                nativeGain >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
                                                            )} title="Gewinn/Verlust (Native)">
                                                                <span>
                                                                    {nativeGain >= 0 ? '+' : ''}{nativeGain.toLocaleString('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                                </span>
                                                                <span className="w-8 text-left text-[11px] uppercase text-current/80 sm:text-sm sm:w-8 translate-y-[0.5px]">
                                                                    {pos.stock.currency === 'GBp' ? 'GBP' : pos.stock.currency}
                                                                </span>
                                                            </div>

                                                            {!isNativeCHF && (
                                                                <div className={cn(
                                                                    "flex items-center justify-end gap-1.5 font-medium tabular-nums",
                                                                    chfGain >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
                                                                )} title="Gewinn/Verlust in CHF">
                                                                    <span>
                                                                        {chfGain >= 0 ? '+' : ''}{chfGain.toLocaleString('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                                    </span>
                                                                    <span className="w-8 text-left text-[11px] uppercase text-current/80 sm:text-sm sm:w-8 translate-y-[0.5px]">
                                                                        CHF
                                                                    </span>
                                                                </div>
                                                            )}

                                                            {!isNativeCHF && (
                                                                <div className={cn(
                                                                    "flex items-center justify-end gap-1.5 font-medium tabular-nums text-xs mt-0.5",
                                                                    pos.forexImpactCHF >= 0
                                                                        ? "text-emerald-600 dark:text-emerald-400"
                                                                        : "text-red-500"
                                                                )} title="Anteil Währungsgewinn/-verlust">
                                                                    <span>
                                                                        Währ. {pos.forexImpactCHF >= 0 ? '+' : ''}{pos.forexImpactCHF.toLocaleString('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                                    </span>
                                                                    <span className="w-8 text-left text-[11px] uppercase text-current/80 sm:text-sm sm:w-8 translate-y-[0.5px]">
                                                                        CHF
                                                                    </span>
                                                                </div>
                                                            )}
                                                        </>
                                                    );
                                                })()}
                                            </div>
                                        </td>

                                        {/* 8. Aktion */}
                                        <td className={cn(
                                            "text-center py-1.5 md:py-2 px-1 h-[60px] md:h-auto md:w-[80px] md:min-w-[80px] md:max-w-[80px] md:sticky md:-right-px z-10 md:z-20 group-hover:bg-muted transition-colors md:shadow-[-5px_0_5px_-5px_rgba(0,0,0,0.1)] align-middle",
                                            mobileColIndex === 7 ? "table-cell" : "hidden md:table-cell"
                                        )}>
                                            <div className="absolute inset-0 bg-card -z-10" />
                                            <div className="relative flex items-center justify-center gap-1">
                                                <button
                                                    onClick={() => {
                                                        setSelectedPosition(pos);
                                                        setIsEditModalOpen(true);
                                                    }}
                                                    className="p-1 hover:bg-muted rounded text-primary transition-colors"
                                                    title="Position bearbeiten (Kauf/Verkauf/Korrektur)"
                                                >
                                                    <Edit className="size-3.5" />
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        setConfirmDelete({ isOpen: true, posId: pos.id, name: pos.stock.name });
                                                    }}
                                                    className="p-1.5 sm:p-2 hover:bg-red-500/10 text-red-600 dark:text-red-400 rounded-lg transition-colors"
                                                    title="Position löschen"
                                                >
                                                    <Trash2 className="size-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                            {data.length === 0 && (
                                <tr>
                                    <td colSpan={9} className="px-4 py-12 text-center text-muted-foreground">
                                        {emptyMessage}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
            <ConfirmModal
                isOpen={confirmDelete.isOpen}
                onClose={() => setConfirmDelete({ isOpen: false, posId: null, name: '' })}
                onConfirm={() => {
                    if (confirmDelete.posId) {
                        deletePosition(confirmDelete.posId);
                    }
                }}
                title="Position löschen"
                message={`Möchten Sie die Position "${confirmDelete.name}" wirklich aus Ihrem Portfolio löschen?`}
            />
        </div>
    );
}
