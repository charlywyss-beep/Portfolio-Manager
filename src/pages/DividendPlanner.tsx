import { useNavigate } from 'react-router-dom';
import { usePortfolio } from '../context/PortfolioContext';
import { Calendar, TrendingUp, Edit, Trash2, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';
import { Logo } from '../components/Logo';
import { cn } from '../utils';
import { useState, useEffect, useRef } from 'react';

import { useCurrencyFormatter } from '../utils/currency';
import { getCurrentDividendPeriod } from '../utils/dividend';
import { DividendCalendarChart } from '../components/DividendCalendarChart';

export function DividendPlanner() {
    const navigate = useNavigate();
    const { stocks, positions, fixedDeposits, deleteFixedDeposit, lastGlobalRefresh, isGlobalRefreshing, refreshAllPrices } = usePortfolio();
    const { convertToCHF } = useCurrencyFormatter();

    // 0: Anteile, 1: Rendite %, 2: Div./Akt., 3: Frequenz, 4: Quartalsweise, 5: Jährlich, 6: EX-Tag, 7: Zahl-Tag, 8: Aktion
    const [mobileColIndex, setMobileColIndex] = useState(1);
    const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);

    const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
        const touch = e.touches[0];
        touchStartRef.current = {
            x: touch.clientX,
            y: touch.clientY,
            time: Date.now()
        };
    };

    const handleTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
        if (!touchStartRef.current) return;
        const touch = e.changedTouches[0];
        const dx = touch.clientX - touchStartRef.current.x;
        const dy = touch.clientY - touchStartRef.current.y;
        const dt = Date.now() - touchStartRef.current.time;

        // Horizontal swipe: only when touch started to the right of the "Aktie" column (> 140px)
        if (touchStartRef.current.x > 140 && Math.abs(dx) > 35 && Math.abs(dx) > Math.abs(dy) * 1.2 && dt < 700) {
            if (dx < 0) {
                setMobileColIndex((i) => Math.min(8, i + 1));
            } else {
                setMobileColIndex((i) => Math.max(0, i - 1));
            }
        }
        touchStartRef.current = null;
    };

    // Calculate projected dividends from yield
    const projectedDividends = positions
        .map((pos) => {
            const stock = stocks.find((s) => s.id === pos.stockId);
            if (!stock) return null;

            // Frequency factor
            const factor = stock.dividendFrequency === 'quarterly' ? 4
                : stock.dividendFrequency === 'semi-annually' ? 2
                    : stock.dividendFrequency === 'monthly' ? 12
                        : 1;

            // Preferred: Precise payout amount. Fallback: Calculation via yield
            let annualDividendNative = 0;
            if (stock.dividendAmount) {
                annualDividendNative = stock.dividendAmount * pos.shares * factor;
            } else if (stock.dividendYield) {
                annualDividendNative = (pos.shares * stock.currentPrice) * (stock.dividendYield / 100);
            }

            if (annualDividendNative === 0) return null;

            const divCurrency = stock.dividendCurrency || stock.currency;
            const annualDividendCHF = convertToCHF(annualDividendNative, divCurrency);
            const quarterlyDividendCHF = annualDividendCHF / 4;

            return {
                position: pos,
                stock,
                annualDividendNative,
                annualDividendCHF,
                quarterlyDividendCHF,
                divCurrency
            };
        })
        .filter(Boolean);
    // Sorted later based on state

    // Calculate Annual Net Bank Impact (Interest - Fees)
    const annualBankNet = fixedDeposits.reduce((sum, deposit) => {
        // Interest
        const interest = deposit.amount * (deposit.interestRate / 100);

        // Fee
        let fee = 0;
        if (deposit.monthlyFee && deposit.monthlyFee > 0) {
            if (deposit.feeFrequency === 'annually') fee = deposit.monthlyFee;
            else if (deposit.feeFrequency === 'quarterly') fee = deposit.monthlyFee * 4;
            else fee = deposit.monthlyFee * 12;
        }

        return sum + (interest - fee);
    }, 0);

    const totalAnnualDividends = projectedDividends.reduce((sum, d) => sum + d!.annualDividendCHF, 0);
    const totalAnnualNet = totalAnnualDividends + annualBankNet; // Sum of Dividends + Net Bank Impact
    const totalMonthly = totalAnnualNet / 12;

    // Prepare Bank Rows Data
    const bankRows = fixedDeposits.map(deposit => {
        // Calculate Annual Interest
        const annualInterest = deposit.amount * (deposit.interestRate / 100);

        // Calculate Annual Fee
        let annualFee = 0;
        if (deposit.monthlyFee && deposit.monthlyFee > 0) {
            if (deposit.feeFrequency === 'annually') annualFee = deposit.monthlyFee;
            else if (deposit.feeFrequency === 'quarterly') annualFee = deposit.monthlyFee * 4;
            else annualFee = deposit.monthlyFee * 12; // Default to monthly
        }

        const netAnnual = annualInterest - annualFee;

        return {
            type: 'bank',
            id: deposit.id,
            name: deposit.bankName,
            symbol: netAnnual >= 0 ? 'Zins' : 'Gebühr',
            logoUrl: deposit.logoUrl,
            shares: 1,
            yield: deposit.interestRate,
            amount: netAnnual >= 0 ? (annualInterest / 12) : -(annualFee / 12), // Monthly approx
            depositAmount: deposit.amount,
            frequency: 'annual',
            quarterly: netAnnual / 4,
            annual: netAnnual,
            currency: 'CHF',
            isNegative: netAnnual < 0
        };
    }).filter((d: any) => d && Math.abs(d.annual) > 0.01);

    // Force re-render every minute to update the "Updated X min ago" text
    // Also trigger auto-refresh after 5 minutes
    const [, setTick] = useState(0);
    useEffect(() => {
        const timer = setInterval(() => {
            setTick(t => t + 1);

            // Auto-refresh if last refresh was more than 5 minutes ago
            if (lastGlobalRefresh) {
                const minutesSinceRefresh = Math.floor((new Date().getTime() - lastGlobalRefresh.getTime()) / 60000);
                if (minutesSinceRefresh >= 5 && !isGlobalRefreshing) {
                    refreshAllPrices();
                }
            }
        }, 60000); // 60000ms = 1 minute

        // iOS Safari: Check on visibility change (when tab becomes visible again)
        const handleVisibilityChange = () => {
            if (!document.hidden && lastGlobalRefresh) {
                const minutesSinceRefresh = Math.floor((new Date().getTime() - lastGlobalRefresh.getTime()) / 60000);
                if (minutesSinceRefresh >= 5 && !isGlobalRefreshing) {
                    refreshAllPrices();
                }
                setTick(t => t + 1); // Force re-render to update displayed time
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            clearInterval(timer);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [lastGlobalRefresh, isGlobalRefreshing, refreshAllPrices]);

    // Sorting
    const [sortConfig, setSortConfig] = useState<{ key: 'name' | 'yield' | 'amount' | 'date', direction: 'asc' | 'desc' }>({ key: 'name', direction: 'asc' });

    projectedDividends.sort((a, b) => {
        if (!a || !b) return 0;
        if (sortConfig.key === 'name') {
            return a.stock.name.localeCompare(b.stock.name);
        }
        if (sortConfig.key === 'yield') {
            const yieldA = a.stock.dividendYield || 0;
            const yieldB = b.stock.dividendYield || 0;
            return yieldB - yieldA; // Descending
        }
        if (sortConfig.key === 'amount') {
            return b.annualDividendCHF - a.annualDividendCHF; // Descending
        }
        if (sortConfig.key === 'date') {
            // Sort by next Ex-Date or Pay-Date
            const dateA = a.stock.dividendExDate || '9999-12-31';
            const dateB = b.stock.dividendExDate || '9999-12-31';
            return dateA.localeCompare(dateB);
        }
        return 0;
    });

    return (
        <div className="p-4 md:p-6 space-y-6 bg-gradient-to-br from-background via-background to-muted/20">
            {/* Header - Matched to Portfolio/Watchlist design */}
            <div className="sticky top-0 z-50 bg-background pb-4 -mt-4 -mx-4 px-4 md:-mt-6 md:-mx-6 md:px-6">
                <div className="border-b bg-card rounded-t-xl -mx-4 md:-mx-6">
                    <div className="w-full pl-14 pr-4 py-4 md:px-6 md:pl-14 lg:pl-6">
                        <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3">
                                <div className="p-3 rounded-xl bg-gradient-to-br from-green-500/20 to-emerald-500/20 text-green-600 dark:text-green-400">
                                    <TrendingUp className="size-6" />
                                </div>
                                <div>
                                    <h1 className="text-3xl font-bold tracking-tight">Dividenden</h1>
                                    <p className="text-muted-foreground hidden md:block">Übersicht aller erwarteten Zahlungen</p>
                                </div>
                            </div>

                            <div className="flex items-center gap-2 ml-auto">
                                <button
                                    onClick={() => refreshAllPrices(true)}
                                    disabled={isGlobalRefreshing}
                                    className={cn(
                                        "p-2.5 md:p-2 md:px-4 rounded-lg flex items-center gap-2 transition-all font-medium whitespace-nowrap",
                                        isGlobalRefreshing
                                            ? "bg-muted text-muted-foreground cursor-not-allowed"
                                            : "bg-blue-600 text-white hover:bg-blue-700 shadow-sm active:scale-95"
                                    )}
                                    title="Preise aktualisieren"
                                >
                                    <RefreshCw className={cn("size-5 md:size-4", isGlobalRefreshing && "animate-spin")} />
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
            </div>

            {/* Main Dividend Table */}
            <div className="bg-card rounded-xl border shadow-sm overflow-hidden">
                <div className="flex items-center justify-between p-4 border-b border-border bg-card">
                    <h2 className="text-lg font-semibold">Erwartete Dividenden</h2>

                    <div className="flex items-center gap-3">
                        <select
                            className="pl-3 pr-8 py-1.5 rounded-lg border border-border bg-card text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all shadow-sm appearance-none cursor-pointer"
                            value={sortConfig.key}
                            onChange={(e) => setSortConfig({ ...sortConfig, key: e.target.value as any })}
                        >
                            <option value="name">Name (A-Z)</option>
                            <option value="yield">Rendite % (Hoch)</option>
                            <option value="amount">Betrag (Hoch)</option>
                            <option value="date">Datum (Nächstes)</option>
                        </select>
                    </div>
                </div>

                <div
                    onTouchStart={handleTouchStart}
                    onTouchEnd={handleTouchEnd}
                    className="overflow-y-auto max-h-[calc(100dvh-280px)] md:max-h-none w-full border-b border-border snap-y snap-mandatory scroll-pt-[50px] md:snap-none md:scroll-pt-0"
                >
                    <table className="w-full text-left border-collapse md:min-w-[1000px] xl:min-w-0 table-fixed">
                        <thead>
                            <tr className="border-b border-border bg-muted/20">
                                {/* 0. Aktie */}
                                <th className="px-3 md:px-4 py-0 md:py-3 h-12 md:h-auto font-semibold text-foreground md:text-muted-foreground text-[15px] md:text-xs uppercase tracking-wider whitespace-normal sticky top-0 left-0 z-40 bg-card shadow-[5px_0_5px_-5px_rgba(0,0,0,0.1)] w-[160px] min-w-[160px] max-w-[160px] md:w-[180px] md:min-w-[180px] md:max-w-[180px] touch-pan-y align-middle">
                                    Aktie
                                </th>

                                {/* 1. Anteile */}
                                <th
                                    className={cn(
                                        "px-1 md:px-4 py-0 md:py-3 h-12 md:h-auto font-semibold text-foreground md:text-muted-foreground text-[13px] md:text-xs uppercase tracking-wider text-right sticky top-0 z-30 bg-card align-middle",
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
                                            Anteile
                                        </span>
                                        <button
                                            type="button"
                                            onClick={(e) => { e.stopPropagation(); setMobileColIndex((i) => Math.min(8, i + 1)); }}
                                            disabled={mobileColIndex === 8}
                                            className="p-1.5 rounded hover:bg-muted disabled:opacity-20 transition-opacity shrink-0"
                                        >
                                            <ChevronRight className="size-4" />
                                        </button>
                                    </div>
                                    <span className="hidden md:inline">Anteile</span>
                                </th>

                                {/* 2. Rendite % */}
                                <th
                                    className={cn(
                                        "px-1 md:px-4 py-0 md:py-3 h-12 md:h-auto font-semibold text-foreground md:text-muted-foreground text-[13px] md:text-xs uppercase tracking-wider text-right sticky top-0 z-30 bg-card align-middle",
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
                                            Rendite %
                                        </span>
                                        <button
                                            type="button"
                                            onClick={(e) => { e.stopPropagation(); setMobileColIndex((i) => Math.min(8, i + 1)); }}
                                            disabled={mobileColIndex === 8}
                                            className="p-1.5 rounded hover:bg-muted disabled:opacity-20 transition-opacity shrink-0"
                                        >
                                            <ChevronRight className="size-4" />
                                        </button>
                                    </div>
                                    <span className="hidden md:inline">Rendite %</span>
                                </th>

                                {/* 3. Div./Akt. */}
                                <th
                                    className={cn(
                                        "px-1 md:px-4 py-0 md:py-3 h-12 md:h-auto font-semibold text-foreground md:text-muted-foreground text-[13px] md:text-xs uppercase tracking-wider text-right sticky top-0 z-30 bg-card align-middle",
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
                                            Div./Akt.
                                        </span>
                                        <button
                                            type="button"
                                            onClick={(e) => { e.stopPropagation(); setMobileColIndex((i) => Math.min(8, i + 1)); }}
                                            disabled={mobileColIndex === 8}
                                            className="p-1.5 rounded hover:bg-muted disabled:opacity-20 transition-opacity shrink-0"
                                        >
                                            <ChevronRight className="size-4" />
                                        </button>
                                    </div>
                                    <span className="hidden md:inline">Div./Akt.</span>
                                </th>

                                {/* 4. Frequenz */}
                                <th
                                    className={cn(
                                        "px-1 md:px-4 py-0 md:py-3 h-12 md:h-auto font-semibold text-foreground md:text-muted-foreground text-[13px] md:text-xs uppercase tracking-wider text-right sticky top-0 z-30 bg-card align-middle",
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
                                            Frequenz
                                        </span>
                                        <button
                                            type="button"
                                            onClick={(e) => { e.stopPropagation(); setMobileColIndex((i) => Math.min(8, i + 1)); }}
                                            disabled={mobileColIndex === 8}
                                            className="p-1.5 rounded hover:bg-muted disabled:opacity-20 transition-opacity shrink-0"
                                        >
                                            <ChevronRight className="size-4" />
                                        </button>
                                    </div>
                                    <span className="hidden md:inline">Frequenz</span>
                                </th>

                                {/* 5. Frequenzweise */}
                                <th
                                    className={cn(
                                        "px-1 md:px-4 py-0 md:py-3 h-12 md:h-auto font-semibold text-foreground md:text-muted-foreground text-[13px] md:text-xs uppercase tracking-wider text-right sticky top-0 z-30 bg-card align-middle",
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
                                            Frequenzweise
                                        </span>
                                        <button
                                            type="button"
                                            onClick={(e) => { e.stopPropagation(); setMobileColIndex((i) => Math.min(8, i + 1)); }}
                                            disabled={mobileColIndex === 8}
                                            className="p-1.5 rounded hover:bg-muted disabled:opacity-20 transition-opacity shrink-0"
                                        >
                                            <ChevronRight className="size-4" />
                                        </button>
                                    </div>
                                    <span className="hidden md:inline">Frequenzweise</span>
                                </th>

                                {/* 6. Jährlich */}
                                <th
                                    className={cn(
                                        "px-1 md:px-4 py-0 md:py-3 h-12 md:h-auto font-semibold text-foreground md:text-muted-foreground text-[13px] md:text-xs uppercase tracking-wider text-right sticky top-0 z-30 bg-card align-middle",
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
                                            Jährlich
                                        </span>
                                        <button
                                            type="button"
                                            onClick={(e) => { e.stopPropagation(); setMobileColIndex((i) => Math.min(8, i + 1)); }}
                                            disabled={mobileColIndex === 8}
                                            className="p-1.5 rounded hover:bg-muted disabled:opacity-20 transition-opacity shrink-0"
                                        >
                                            <ChevronRight className="size-4" />
                                        </button>
                                    </div>
                                    <span className="hidden md:inline">Jährlich</span>
                                </th>

                                {/* 7. EX-Tag */}
                                <th
                                    className={cn(
                                        "px-1 md:px-4 py-0 md:py-3 h-12 md:h-auto font-semibold text-foreground md:text-muted-foreground text-[13px] md:text-xs uppercase tracking-wider text-right sticky top-0 z-30 bg-card align-middle",
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
                                            EX-Tag
                                        </span>
                                        <button
                                            type="button"
                                            onClick={(e) => { e.stopPropagation(); setMobileColIndex((i) => Math.min(8, i + 1)); }}
                                            disabled={mobileColIndex === 8}
                                            className="p-1.5 rounded hover:bg-muted disabled:opacity-20 transition-opacity shrink-0"
                                        >
                                            <ChevronRight className="size-4" />
                                        </button>
                                    </div>
                                    <span className="hidden md:inline">EX-Tag</span>
                                </th>

                                {/* 8. Zahl-Tag */}
                                <th
                                    className={cn(
                                        "px-1 md:px-4 py-0 md:py-3 h-12 md:h-auto font-semibold text-foreground md:text-muted-foreground text-[13px] md:text-xs uppercase tracking-wider text-right sticky top-0 z-30 bg-card align-middle",
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
                                            Zahl-Tag
                                        </span>
                                        <button
                                            type="button"
                                            onClick={(e) => { e.stopPropagation(); setMobileColIndex((i) => Math.min(8, i + 1)); }}
                                            disabled={mobileColIndex === 8}
                                            className="p-1.5 rounded hover:bg-muted disabled:opacity-20 transition-opacity shrink-0"
                                        >
                                            <ChevronRight className="size-4" />
                                        </button>
                                    </div>
                                    <span className="hidden md:inline">Zahl-Tag</span>
                                </th>

                                {/* 9. Aktion */}
                                <th
                                    className={cn(
                                        "px-1 md:px-1 py-0 md:py-3 h-12 md:h-auto font-semibold text-foreground md:text-muted-foreground text-[13px] md:text-xs uppercase tracking-wider text-center md:w-[60px] md:min-w-[60px] md:max-w-[60px] md:sticky md:-right-px bg-card z-30 md:shadow-[-5px_0_5px_-5px_rgba(0,0,0,0.1)] sticky top-0 align-middle",
                                        mobileColIndex === 8 ? "table-cell" : "hidden md:table-cell"
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
                                            onClick={(e) => { e.stopPropagation(); setMobileColIndex((i) => Math.min(8, i + 1)); }}
                                            disabled={mobileColIndex === 8}
                                            className="p-1.5 rounded hover:bg-muted disabled:opacity-20 transition-opacity shrink-0"
                                        >
                                            <ChevronRight className="size-4" />
                                        </button>
                                    </div>
                                    <span className="hidden md:inline">Aktion</span>
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {projectedDividends.length === 0 ? (
                                <tr>
                                    <td colSpan={10} className="text-center py-8 text-muted-foreground">
                                        Keine Dividenden-Aktien im Portfolio
                                    </td>
                                </tr>
                            ) : (
                                projectedDividends.map((data: any) => {
                                    const { position, stock, annualDividendNative, annualDividendCHF, divCurrency } = data!;

                                    // Dividend per payout period (Frequenzweise) and Annual: Original currency + CHF
                                    const annualNative = annualDividendNative || 0;
                                    let displayAnnualNative = annualNative;
                                    let displayAnnualCurrency = divCurrency;
                                    if (divCurrency === 'GBp') {
                                        displayAnnualNative /= 100;
                                        displayAnnualCurrency = 'GBP';
                                    }
                                    const annualFormatted = divCurrency !== 'CHF'
                                        ? `${displayAnnualNative.toLocaleString('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${displayAnnualCurrency}`
                                        : `${annualDividendCHF.toLocaleString('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} CHF`;

                                    // Payout amount per frequency in native currency
                                    // stock.dividendAmount is dividend per share per payout event.
                                    // Total per event for position = stock.dividendAmount * position.shares
                                    let perPaymentNative = 0;
                                    const freqFactor = stock.dividendFrequency === 'quarterly' ? 4
                                        : stock.dividendFrequency === 'semi-annually' ? 2
                                            : stock.dividendFrequency === 'monthly' ? 12
                                                : 1;
                                    if (stock.dividendAmount && position.shares) {
                                        perPaymentNative = stock.dividendAmount * position.shares;
                                    } else {
                                        perPaymentNative = annualNative / freqFactor;
                                    }
                                    let displayPaymentNative = perPaymentNative;
                                    if (divCurrency === 'GBp') {
                                        displayPaymentNative /= 100;
                                    }
                                    const frequencyFormatted = perPaymentNative > 0
                                        ? `${displayPaymentNative.toLocaleString('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${displayAnnualCurrency}`
                                        : '-';

                                    const perPaymentCHF = annualDividendCHF / freqFactor;
                                    const frequencyCHFFormatted = perPaymentCHF > 0
                                        ? `${perPaymentCHF.toLocaleString('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} CHF`
                                        : null;
                                    const annualCHFFormatted = `${annualDividendCHF.toLocaleString('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} CHF`;

                                    const currentDiv = getCurrentDividendPeriod(stock);

                                    return (
                                        <tr key={position.id} className="border-b border-border last:border-0 hover:bg-muted/50 transition-colors group snap-start snap-always h-[60px] md:h-auto">
                                            {/* 0. Aktie */}
                                            <td className="px-3 py-1.5 md:py-3 md:px-4 h-[60px] md:h-auto sticky left-0 z-20 group-hover:bg-muted/30 transition-colors shadow-[5px_0_5px_-5px_rgba(0,0,0,0.1)] w-[160px] min-w-[160px] max-w-[160px] md:w-[180px] md:min-w-[180px] md:max-w-[180px] touch-pan-y align-middle">
                                                <div className="absolute inset-0 bg-card -z-10" />
                                                <div className="relative flex items-center gap-2 md:gap-3">
                                                    <div
                                                        className="cursor-pointer hover:scale-110 transition-transform p-0.5 shrink-0"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            navigate(`/stock/${stock.id}`);
                                                        }}
                                                    >
                                                        {stock.logoUrl ? (
                                                            <div className="size-8 rounded-full overflow-hidden bg-background border border-border shadow-sm flex-shrink-0">
                                                                <img
                                                                    src={stock.logoUrl}
                                                                    alt={stock.symbol}
                                                                    className="w-full h-full object-contain p-0.5"
                                                                    onError={(e) => {
                                                                        (e.target as HTMLImageElement).style.display = 'none';
                                                                        (e.target as HTMLImageElement).parentElement!.innerText = stock.symbol.slice(0, 2);
                                                                        (e.target as HTMLImageElement).parentElement!.className = "size-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary border border-primary/20 flex-shrink-0";
                                                                    }}
                                                                />
                                                            </div>
                                                        ) : (
                                                            <div className="size-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary border border-primary/20 flex-shrink-0">
                                                                {stock.symbol.slice(0, 2)}
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="flex flex-col min-w-0 flex-1 justify-center">
                                                        <div
                                                            className="font-bold text-[13px] md:text-sm text-foreground truncate block leading-tight cursor-pointer hover:text-primary transition-colors"
                                                            title={stock.name}
                                                            onClick={() => navigate(`/stock/${stock.id}`)}
                                                        >
                                                            {stock.name}
                                                        </div>
                                                        <div className="text-xs text-muted-foreground uppercase truncate mt-0.5">{stock.symbol}</div>
                                                    </div>
                                                </div>
                                                {position.plannedPurchase?.savedAt && (
                                                    <div className="absolute top-1 right-1">
                                                        <div className="size-1.5 rounded-full bg-orange-500" title="Geplanter Kauf" />
                                                    </div>
                                                )}
                                            </td>

                                            {/* 1. Anteile */}
                                            <td className={cn("px-3 py-1.5 md:py-3 md:px-4 h-[60px] md:h-auto text-right font-medium align-middle", mobileColIndex === 0 ? "table-cell" : "hidden md:table-cell")}>
                                                <span className="font-bold text-sm tabular-nums whitespace-nowrap">{position.shares}</span>
                                            </td>

                                            {/* 2. Rendite % */}
                                            <td className={cn("px-3 py-1.5 md:py-3 md:px-4 h-[60px] md:h-auto text-right align-middle", mobileColIndex === 1 ? "table-cell" : "hidden md:table-cell")}>
                                                <span className="text-sm font-bold text-green-600 dark:text-green-400 tabular-nums whitespace-nowrap">
                                                    {stock.dividendYield?.toFixed(2)}%
                                                </span>
                                            </td>

                                            {/* 3. Div./Akt. */}
                                            <td className={cn("px-3 py-1.5 md:py-3 md:px-4 h-[60px] md:h-auto text-right align-middle", mobileColIndex === 2 ? "table-cell" : "hidden md:table-cell")}>
                                                <span className="text-sm font-semibold text-foreground tabular-nums whitespace-nowrap">
                                                    {stock.dividendAmount?.toFixed(2)} {divCurrency}
                                                </span>
                                            </td>

                                            {/* 4. Frequenz */}
                                            <td className={cn("px-3 py-1.5 md:py-3 md:px-4 h-[60px] md:h-auto text-right capitalize text-xs md:text-sm align-middle whitespace-nowrap", mobileColIndex === 3 ? "table-cell" : "hidden md:table-cell")}>
                                                {stock.dividendFrequency === 'annually' && 'Jährlich'}
                                                {stock.dividendFrequency === 'semi-annually' && 'Halbjährlich'}
                                                {stock.dividendFrequency === 'quarterly' && 'Quartalsweise'}
                                                {stock.dividendFrequency === 'monthly' && 'Monatlich'}
                                                {!stock.dividendFrequency && '-'}
                                            </td>

                                            {/* 5. Frequenzweise */}
                                            <td className={cn("px-3 py-1.5 md:py-3 md:px-4 h-[60px] md:h-auto text-right align-middle whitespace-nowrap", mobileColIndex === 4 ? "table-cell" : "hidden md:table-cell")}>
                                                <div className="flex flex-col items-end justify-center">
                                                    <span className="font-semibold text-[13px] md:text-sm tabular-nums leading-tight">{frequencyFormatted}</span>
                                                    {divCurrency !== 'CHF' && frequencyCHFFormatted && (
                                                        <span className="text-[11px] text-muted-foreground tabular-nums leading-tight mt-0.5">
                                                            {frequencyCHFFormatted}
                                                        </span>
                                                    )}
                                                </div>
                                            </td>

                                            {/* 6. Jährlich */}
                                            <td className={cn("px-3 py-1.5 md:py-3 md:px-4 h-[60px] md:h-auto text-right align-middle whitespace-nowrap", mobileColIndex === 5 ? "table-cell" : "hidden md:table-cell")}>
                                                <div className="flex flex-col items-end justify-center">
                                                    <span className="font-bold text-[13px] md:text-sm tabular-nums leading-tight">{annualFormatted}</span>
                                                    {divCurrency !== 'CHF' && (
                                                        <span className="text-[11px] text-muted-foreground tabular-nums leading-tight mt-0.5">
                                                            {annualCHFFormatted}
                                                        </span>
                                                    )}
                                                </div>
                                            </td>

                                            {/* 7. EX-Tag */}
                                            <td className={cn("px-3 py-1.5 md:py-3 md:px-4 h-[60px] md:h-auto text-right align-middle", mobileColIndex === 6 ? "table-cell" : "hidden md:table-cell")}>
                                                <div className="flex flex-col items-end justify-center gap-0.5">
                                                    <span className={cn(
                                                        "font-bold text-[13px] md:text-sm whitespace-nowrap leading-tight",
                                                        (() => {
                                                            const dDays = currentDiv.exDate ? Math.ceil((new Date(currentDiv.exDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)) : null;
                                                            if (dDays !== null && dDays < 0) return "text-green-600 dark:text-green-400 font-medium";
                                                            if (dDays !== null && dDays >= 0 && dDays <= 14) return "text-orange-500 font-medium";
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

                                            {/* 8. Zahl-Tag */}
                                            <td className={cn("px-3 py-1.5 md:py-3 md:px-4 h-[60px] md:h-auto text-right align-middle", mobileColIndex === 7 ? "table-cell" : "hidden md:table-cell")}>
                                                <div className="flex flex-col items-end justify-center gap-0.5">
                                                    <span className={cn(
                                                        "font-bold text-[13px] md:text-sm whitespace-nowrap leading-tight",
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

                                            {/* 9. Aktion */}
                                            <td className={cn("px-2 py-1.5 md:py-3 md:px-1 h-[60px] md:h-auto text-center md:w-[60px] md:min-w-[60px] md:max-w-[60px] md:sticky md:-right-px bg-card z-20 group-hover:bg-muted/30 transition-colors md:shadow-[-5px_0_5px_-5px_rgba(0,0,0,0.1)] align-middle", mobileColIndex === 8 ? "table-cell" : "hidden md:table-cell")}>
                                                <div className="absolute inset-0 bg-card -z-10" />
                                                <div className="relative flex items-center justify-center">
                                                    <button
                                                        onClick={() => navigate(`/dividends/edit/${stock.id}`)}
                                                        className="p-1.5 hover:bg-primary/10 text-primary rounded-lg transition-colors"
                                                        title="Bearbeiten"
                                                    >
                                                        <Edit className="size-4" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div >

            {/* Summary Cards - Below Table */}
            < div className="grid grid-cols-2 md:grid-cols-4 gap-4" >
                <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 rounded-xl p-4 border border-green-200 dark:border-green-800">
                    <div className="flex flex-col">
                        <span className="text-xs font-medium text-green-900 dark:text-green-100 flex items-center gap-2 mb-1">
                            <TrendingUp className="size-3" />
                            Jährlich
                        </span>
                        <div className="text-xl font-bold text-green-600 dark:text-green-400 flex flex-col items-start leading-none">
                            <span className="text-xs font-medium opacity-80 mb-0.5">CHF</span>
                            <span>{totalAnnualNet.toLocaleString('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                    </div>
                </div>

                <div className="bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-950/30 dark:to-cyan-950/30 rounded-xl p-4 border border-blue-200 dark:border-blue-800">
                    <div className="flex flex-col">
                        <span className="text-xs font-medium text-blue-900 dark:text-blue-100 flex items-center gap-2 mb-1">
                            <Calendar className="size-3" />
                            Ø Monatlich
                        </span>
                        <div className="text-xl font-bold text-blue-800 dark:text-blue-400 flex flex-col items-start leading-none">
                            <span className="text-xs font-medium opacity-80 mb-0.5">CHF</span>
                            <span>{totalMonthly.toLocaleString('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                    </div>
                </div>

                <div className="bg-card rounded-xl p-4 border border-border shadow-sm">
                    <div className="flex flex-col">
                        <span className="text-xs font-medium text-muted-foreground flex items-center gap-2 mb-1">
                            <TrendingUp className="size-3" />
                            Ø Dividenden-Rendite
                        </span>
                        <div className="text-xl font-bold text-foreground">
                            {(projectedDividends.reduce((acc, curr) => acc + (curr?.stock.dividendYield || 0), 0) / (projectedDividends.length || 1)).toFixed(2)}%
                        </div>
                    </div>
                </div>

                <div className="bg-card rounded-xl p-4 border border-border shadow-sm">
                    <div className="flex flex-col">
                        <span className="text-xs font-medium text-muted-foreground flex items-center gap-2 mb-1">
                            <Calendar className="size-3" />
                            Zahler
                        </span>
                        <div className="text-xl font-bold text-foreground">
                            {projectedDividends.length} <span className="text-xs font-normal text-muted-foreground">Positionen</span>
                        </div>
                    </div>
                </div>
            </div >

            {/* Bank Accounts Section */}
            {
                bankRows.length > 0 && (
                    <div className="bg-card rounded-xl border shadow-sm overflow-hidden animate-in slide-in-from-bottom-4 duration-700">
                        <div className="flex items-center justify-between p-4 border-b bg-muted/30">
                            <h2 className="text-lg font-semibold">Bank Erträge & Gebühren</h2>
                        </div>

                        <div className="overflow-x-auto overscroll-x-none">
                            <table className="w-full min-w-[1000px]">
                                <thead>
                                    <tr className="border-b border-border">
                                        <th className="text-left py-3 px-4 font-semibold sticky -left-px z-20 bg-card shadow-[5px_0_5px_-5px_rgba(0,0,0,0.1)]">Bank / Institut</th>
                                        <th className="text-right py-3 px-4 font-semibold whitespace-nowrap">Betrag</th>
                                        <th className="text-right py-3 px-4 font-semibold whitespace-nowrap">Zins %</th>
                                        <th className="text-right py-3 px-4 font-semibold whitespace-nowrap">Ø Monatlich</th>
                                        <th className="text-right py-3 px-4 font-semibold whitespace-nowrap">Frequenz</th>
                                        <th className="text-right py-3 px-4 font-semibold whitespace-nowrap">Quartalsweise</th>
                                        <th className="text-right py-3 px-4 font-semibold whitespace-nowrap">Jährlich</th>
                                        <th className="text-center py-3 px-1 w-[60px] min-w-[60px] max-w-[60px] md:sticky md:-right-px bg-card z-50 md:shadow-[-5px_0_5px_-5px_rgba(0,0,0,0.1)]">Aktion</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {bankRows.map((data: any) => {
                                        const isNegative = data.isNegative;
                                        return (
                                            <tr key={data.id} className="border-b border-border last:border-0 hover:bg-muted/50 transition-colors group">
                                                <td className="py-3 px-4 sticky -left-px z-10 bg-card group-hover:bg-muted/50 transition-colors shadow-[5px_0_5px_-5px_rgba(0,0,0,0.1)]">
                                                    <div className="flex items-center gap-3">
                                                        <Logo
                                                            url={data.logoUrl}
                                                            alt={data.name}
                                                            fallback="BK"
                                                        />
                                                        <div>
                                                            <div className="font-semibold">{data.name}</div>
                                                            <div className={`text-xs font-medium ${isNegative ? 'text-red-500' : 'text-green-600'}`}>
                                                                {isNegative ? 'Konto-Gebühren' : 'Bank-Zinsen'}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="text-right py-3 px-4 font-medium whitespace-nowrap">
                                                    CHF {data.depositAmount?.toLocaleString('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </td>
                                                <td className="text-right py-3 px-4 text-muted-foreground">
                                                    {data.yield > 0 ? `${data.yield.toFixed(2)}%` : '-'}
                                                </td>
                                                <td className={`text-right py-3 px-4 font-medium whitespace-nowrap ${isNegative ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                                                    {isNegative ? '-' : '+'} {Math.abs(data.annual / 12).toLocaleString('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} CHF
                                                </td>
                                                <td className="text-right py-3 px-4 text-muted-foreground">
                                                    Jährlich
                                                </td>
                                                <td className={`text-right py-3 px-4 font-medium whitespace-nowrap ${isNegative ? 'text-red-600/70' : 'text-green-600/70'}`}>
                                                    {isNegative ? '-' : '+'} CHF {Math.abs(data.quarterly).toLocaleString('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </td>
                                                <td className={`text-right py-3 px-4 font-semibold whitespace-nowrap ${isNegative ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                                                    {isNegative ? '-' : '+'} CHF {Math.abs(data.annual).toLocaleString('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </td>
                                                <td className="text-center py-3 px-1 w-[60px] min-w-[60px] max-w-[60px] md:sticky md:-right-px bg-card z-40 group-hover:bg-muted/50 transition-colors md:shadow-[-5px_0_5px_-5px_rgba(0,0,0,0.1)]">
                                                    <div className="flex items-center justify-end gap-1">
                                                        <button
                                                            onClick={() => navigate('/portfolio')}
                                                            className="p-2 hover:bg-background rounded-md transition-colors text-muted-foreground hover:text-foreground"
                                                            title="Zu den Konten"
                                                        >
                                                            <Edit className="size-4" />
                                                        </button>
                                                        <button
                                                            onClick={() => {
                                                                if (window.confirm('Wollen Sie dieses Bankkonto wirklich löschen?')) {
                                                                    deleteFixedDeposit(data.id);
                                                                }
                                                            }}
                                                            className="p-2 hover:bg-red-100 dark:hover:bg-red-900/30 text-red-500 rounded-md transition-colors"
                                                            title="Löschen"
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
                    </div>
                )
            }
            {/* Dividend Calendar Chart (Moved Down) */}
            <div className="mt-8 mb-8">
                <div className="flex items-center gap-2 mb-4">
                    <div className="p-2 bg-primary/10 rounded-lg">
                        <TrendingUp className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-foreground">Monatliche Dividenden (Geschätzt)</h2>
                        <p className="text-sm text-muted-foreground">Prognostizierte Verteilung der Zahlungen über das Jahr</p>
                    </div>
                </div>

                <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
                    <DividendCalendarChart />
                </div>
            </div>
        </div >
    );
}
