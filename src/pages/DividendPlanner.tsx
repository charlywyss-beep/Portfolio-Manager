import { useNavigate } from 'react-router-dom';
import { usePortfolio } from '../context/PortfolioContext';
import { Calendar, TrendingUp, Edit, Trash2, RefreshCw, ChevronLeft, ChevronRight, Landmark } from 'lucide-react';
import { Logo } from '../components/Logo';
import { cn } from '../utils';
import { useState, useEffect, useRef } from 'react';

import { useCurrencyFormatter } from '../utils/currency';
import { getCurrentDividendPeriod } from '../utils/dividend';
import { DividendCalendarChart } from '../components/DividendCalendarChart';
import { translateSector } from '../utils/sectorTranslation';

export function DividendPlanner() {
    const navigate = useNavigate();
    const { stocks, positions, fixedDeposits, deleteFixedDeposit, lastGlobalRefresh, isGlobalRefreshing, refreshAllPrices } = usePortfolio();
    const { convertToCHF } = useCurrencyFormatter();

    // Main table: 0: [Anteile, Rendite %], 1: [Div./Akt., Frequenz], 2: [Frequenzweise, Jährlich], 3: [EX-Tag, Zahl-Tag], 4: [Aktion]
    const [mobilePage, setMobilePage] = useState(0);
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
                setMobilePage((p) => Math.min(4, p + 1));
            } else {
                setMobilePage((p) => Math.max(0, p - 1));
            }
        }
        touchStartRef.current = null;
    };

    // Bank Erträge: 0: [Betrag, Zins %], 1: [Ø Monatlich, Frequenz], 2: [Quartalsweise, Jährlich], 3: [Aktion]
    const [mobileBankPage, setMobileBankPage] = useState(0);
    const bankTouchStartRef = useRef<{ x: number; y: number; time: number; isStockCol: boolean } | null>(null);

    const handleBankTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
        const touch = e.touches[0];
        const isStockCol = !!(e.target as HTMLElement)?.closest('th:first-child, td:first-child');
        bankTouchStartRef.current = {
            x: touch.clientX,
            y: touch.clientY,
            time: Date.now(),
            isStockCol
        };
    };

    const handleBankTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
        if (!bankTouchStartRef.current || bankTouchStartRef.current.isStockCol) {
            bankTouchStartRef.current = null;
            return;
        }
        const touch = e.changedTouches[0];
        const dx = touch.clientX - bankTouchStartRef.current.x;
        const dy = touch.clientY - bankTouchStartRef.current.y;
        const dt = Date.now() - bankTouchStartRef.current.time;

        // Horizontal swipe: only when touch started to the right of the first column (> 140px)
        if (bankTouchStartRef.current.x > 140 && Math.abs(dx) > 35 && Math.abs(dx) > Math.abs(dy) * 1.2 && dt < 700) {
            if (dx < 0) {
                setMobileBankPage((p) => Math.min(3, p + 1));
            } else {
                setMobileBankPage((p) => Math.max(0, p - 1));
            }
        }
        bankTouchStartRef.current = null;
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

    const handleSort = (key: 'name' | 'yield' | 'amount' | 'date') => {
        setSortConfig((prev) => {
            const isSameKey = prev.key === key;
            const defaultDir = key === 'name' ? 'asc' : 'desc';
            let newDir: 'asc' | 'desc';
            if (!isSameKey) {
                newDir = defaultDir;
            } else {
                newDir = prev.direction === 'desc' ? 'asc' : 'desc';
            }
            return { key, direction: newDir };
        });
    };

    // Persistent Tab State
    const [activeDivTab, setActiveDivTab] = useState<'dividends' | 'bank' | 'calendar'>(() => {
        const saved = localStorage.getItem('dividend_active_tab');
        if (saved === 'dividends' || saved === 'bank' || saved === 'calendar') return saved;
        return 'dividends';
    });

    useEffect(() => {
        localStorage.setItem('dividend_active_tab', activeDivTab);
    }, [activeDivTab]);

    projectedDividends.sort((a, b) => {
        if (!a || !b) return 0;
        if (sortConfig.key === 'name') {
            return sortConfig.direction === 'asc'
                ? a.stock.name.localeCompare(b.stock.name)
                : b.stock.name.localeCompare(a.stock.name);
        }
        if (sortConfig.key === 'yield') {
            const yieldA = a.stock.dividendYield || 0;
            const yieldB = b.stock.dividendYield || 0;
            return sortConfig.direction === 'asc' ? yieldA - yieldB : yieldB - yieldA;
        }
        if (sortConfig.key === 'amount') {
            return sortConfig.direction === 'asc'
                ? a.annualDividendCHF - b.annualDividendCHF
                : b.annualDividendCHF - a.annualDividendCHF;
        }
        if (sortConfig.key === 'date') {
            // Sort by next Ex-Date or Pay-Date
            const dateA = a.stock.dividendExDate || '9999-12-31';
            const dateB = b.stock.dividendExDate || '9999-12-31';
            return sortConfig.direction === 'asc'
                ? dateA.localeCompare(dateB)
                : dateB.localeCompare(dateA);
        }
        return 0;
    });

    return (
        <div className="h-full flex flex-col p-4 md:p-6 space-y-3 bg-gradient-to-br from-background via-background to-muted/20 overflow-hidden">
            {/* Header - Fixed Height */}
            <div className="shrink-0 bg-background pb-2 -mt-4 -mx-4 px-4 md:-mt-6 md:-mx-6 md:px-6">
                <div className="border-b bg-card rounded-t-xl -mx-4 md:-mx-6">
                    <div className="w-full pl-14 pr-4 py-3 sm:py-3.5 md:px-6 md:pl-14 xl:pl-6">
                        <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3">
                                <div className="p-2 sm:p-3 rounded-xl bg-gradient-to-br from-green-500/20 to-emerald-500/20 text-green-600 dark:text-green-400 shrink-0">
                                    <TrendingUp className="size-5 sm:size-6" />
                                </div>
                                <div>
                                    <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Dividenden</h1>
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

            {/* Summary Cards - Fixed Height */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 shrink-0">
                <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 rounded-xl p-2.5 md:p-3 border border-green-200 dark:border-green-800 shadow-sm flex flex-col justify-between">
                    <span className="text-xs font-medium text-green-900 dark:text-green-100 flex items-center gap-1.5 mb-0.5">
                        <TrendingUp className="size-3" />
                        Jährlich
                    </span>
                    <div className="text-base sm:text-lg md:text-xl font-bold text-green-600 dark:text-green-400">
                        {totalAnnualNet.toLocaleString('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className="text-xs font-normal opacity-80">CHF</span>
                    </div>
                </div>

                <div className="bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-950/30 dark:to-cyan-950/30 rounded-xl p-2.5 md:p-3 border border-blue-200 dark:border-blue-800 shadow-sm flex flex-col justify-between">
                    <span className="text-xs font-medium text-blue-900 dark:text-blue-100 flex items-center gap-1.5 mb-0.5">
                        <Calendar className="size-3" />
                        Ø Monatlich
                    </span>
                    <div className="text-base sm:text-lg md:text-xl font-bold text-blue-800 dark:text-blue-400">
                        {totalMonthly.toLocaleString('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className="text-xs font-normal opacity-80">CHF</span>
                    </div>
                </div>

                <div className="bg-card rounded-xl p-2.5 md:p-3 border border-border shadow-sm flex flex-col justify-between">
                    <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5 mb-0.5">
                        <TrendingUp className="size-3" />
                        Ø Rendite
                    </span>
                    <div className="text-base sm:text-lg md:text-xl font-bold text-foreground">
                        {(projectedDividends.reduce((acc, curr) => acc + (curr?.stock.dividendYield || 0), 0) / (projectedDividends.length || 1)).toFixed(2)}%
                    </div>
                </div>

                <div className="bg-card rounded-xl p-2.5 md:p-3 border border-border shadow-sm flex flex-col justify-between">
                    <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5 mb-0.5">
                        <Calendar className="size-3" />
                        Zahler
                    </span>
                    <div className="text-base sm:text-lg md:text-xl font-bold text-foreground">
                        {projectedDividends.length} <span className="text-xs font-normal text-muted-foreground">Aktien</span>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className={cn(
                "grid gap-1.5 pb-1 shrink-0",
                bankRows.length > 0 ? "grid-cols-3" : "grid-cols-2"
            )}>
                <button
                    onClick={() => setActiveDivTab('dividends')}
                    className={cn(
                        "flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all border shadow-sm truncate",
                        activeDivTab === 'dividends'
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-card text-muted-foreground border-border hover:bg-accent hover:text-foreground"
                    )}
                >
                    <TrendingUp className="size-3.5 sm:size-4 shrink-0" />
                    <span className="truncate">Dividenden</span>
                </button>

                {bankRows.length > 0 && (
                    <button
                        onClick={() => setActiveDivTab('bank')}
                        className={cn(
                            "flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all border shadow-sm truncate",
                            activeDivTab === 'bank'
                                ? "bg-primary text-primary-foreground border-primary"
                                : "bg-card text-muted-foreground border-border hover:bg-accent hover:text-foreground"
                        )}
                    >
                        <Landmark className="size-3.5 sm:size-4 shrink-0" />
                        <span className="truncate">Bank-Erträge</span>
                    </button>
                )}

                <button
                    onClick={() => setActiveDivTab('calendar')}
                    className={cn(
                        "flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all border shadow-sm truncate",
                        activeDivTab === 'calendar'
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-card text-muted-foreground border-border hover:bg-accent hover:text-foreground"
                    )}
                >
                    <Calendar className="size-3.5 sm:size-4 shrink-0" />
                    <span className="truncate">Monatlich</span>
                </button>
            </div>

            {/* Main Dividend Table */}
            {activeDivTab === 'dividends' && (
                <div className="flex-1 min-h-0 flex flex-col rounded-xl border border-border bg-card shadow-sm overflow-hidden">
                    <div className="flex items-center justify-between p-3 border-b border-border bg-card shrink-0">
                        <h2 className="text-base md:text-lg font-semibold">Erwartete Dividenden</h2>

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
                        className="overflow-y-auto overflow-x-hidden xl:overflow-x-auto flex-1 min-h-0 p-0 w-full snap-y snap-mandatory scroll-pt-[48px] xl:snap-none xl:scroll-pt-0"
                    >
                    <table className="w-full text-xs xl:text-sm border-collapse table-fixed xl:table-auto">
                        <thead>
                            <tr className="border-b border-border bg-muted/20">
                                {/* 0. Aktie */}
                                <th className="text-left px-3 xl:px-4 py-0 xl:py-2 h-12 xl:h-auto font-semibold text-foreground xl:text-muted-foreground text-[15px] xl:text-xs uppercase tracking-wider sticky top-0 left-0 z-40 bg-card shadow-[5px_0_5px_-5px_rgba(0,0,0,0.1)] w-[160px] min-w-[160px] max-w-[160px] sm:w-[220px] sm:min-w-[220px] sm:max-w-[220px] xl:w-[180px] xl:min-w-[180px] xl:max-w-[180px] touch-pan-y align-middle">
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

                                {/* 1. Anteile */}
                                <th
                                    className={cn(
                                        "px-1 xl:px-4 py-0 xl:py-2 h-12 xl:h-auto font-semibold text-foreground xl:text-muted-foreground text-[13px] xl:text-xs uppercase tracking-wider text-center xl:text-right sticky top-0 z-30 bg-card w-1/2 xl:w-auto align-middle",
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
                                        <span className="truncate select-none font-semibold text-xs sm:text-[13px] text-foreground">
                                            Anteile
                                        </span>
                                    </div>
                                    <span className="hidden xl:inline">Anteile</span>
                                </th>

                                {/* 2. Rendite % */}
                                <th
                                    className={cn(
                                        "px-1 xl:px-4 py-0 xl:py-2 h-12 xl:h-auto font-semibold text-foreground xl:text-muted-foreground text-[13px] xl:text-xs uppercase tracking-wider text-center xl:text-right sticky top-0 z-30 bg-card w-1/2 xl:w-auto align-middle",
                                        mobilePage === 0 ? "table-cell" : "hidden xl:table-cell"
                                    )}
                                >
                                    <div className="flex xl:hidden items-center justify-center w-full h-12 px-1 relative">
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                handleSort('yield');
                                            }}
                                            className="flex items-center justify-center gap-1 px-1.5 py-1 rounded-md text-foreground hover:bg-muted active:bg-muted/70 transition-colors cursor-pointer select-none font-semibold text-xs sm:text-[13px] truncate"
                                        >
                                            <span className="truncate">Rendite %</span>
                                            {sortConfig.key === 'yield' && (
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
                                                setMobilePage((p) => Math.min(4, p + 1));
                                            }}
                                            disabled={mobilePage === 4}
                                            className="absolute right-1 size-8 sm:size-9 flex items-center justify-center rounded-lg bg-muted/40 hover:bg-muted active:bg-muted/70 text-muted-foreground hover:text-foreground active:text-foreground disabled:opacity-20 transition-colors shrink-0 cursor-pointer"
                                            title="Nächste Spalten"
                                            aria-label="Nächste Spalten"
                                        >
                                            <ChevronRight className="size-4 pointer-events-none text-muted-foreground" />
                                        </button>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => handleSort('yield')}
                                        className="hidden xl:inline-flex items-center gap-1 hover:text-foreground cursor-pointer select-none text-inherit uppercase"
                                    >
                                        <span>Rendite %</span>
                                        {sortConfig.key === 'yield' && (
                                            <span className="font-bold text-xs">
                                                {sortConfig.direction === 'desc' ? '↓' : '↑'}
                                            </span>
                                        )}
                                    </button>
                                </th>

                                {/* 3. Div./Akt. */}
                                <th
                                    className={cn(
                                        "px-1 xl:px-4 py-0 xl:py-2 h-12 xl:h-auto font-semibold text-foreground xl:text-muted-foreground text-[13px] xl:text-xs uppercase tracking-wider text-center xl:text-right sticky top-0 z-30 bg-card w-1/2 xl:w-auto align-middle",
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
                                        <span className="truncate select-none font-semibold text-xs sm:text-[13px] text-foreground">
                                            Div./Akt.
                                        </span>
                                    </div>
                                    <span className="hidden xl:inline">Div./Akt.</span>
                                </th>

                                {/* 4. Frequenz */}
                                <th
                                    className={cn(
                                        "px-1 xl:px-4 py-0 xl:py-2 h-12 xl:h-auto font-semibold text-foreground xl:text-muted-foreground text-[13px] xl:text-xs uppercase tracking-wider text-center xl:text-right sticky top-0 z-30 bg-card w-1/2 xl:w-auto align-middle",
                                        mobilePage === 1 ? "table-cell" : "hidden xl:table-cell"
                                    )}
                                >
                                    <div className="flex xl:hidden items-center justify-center w-full h-12 px-1 relative">
                                        <span className="truncate select-none font-semibold text-xs sm:text-[13px] text-foreground">
                                            Frequenz
                                        </span>
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                setMobilePage((p) => Math.min(4, p + 1));
                                            }}
                                            disabled={mobilePage === 4}
                                            className="absolute right-1 size-8 sm:size-9 flex items-center justify-center rounded-lg bg-muted/40 hover:bg-muted active:bg-muted/70 text-muted-foreground hover:text-foreground active:text-foreground disabled:opacity-20 transition-colors shrink-0 cursor-pointer"
                                            title="Nächste Spalten"
                                            aria-label="Nächste Spalten"
                                        >
                                            <ChevronRight className="size-4 pointer-events-none text-muted-foreground" />
                                        </button>
                                    </div>
                                    <span className="hidden xl:inline">Frequenz</span>
                                </th>

                                {/* 5. Frequenzweise */}
                                <th
                                    className={cn(
                                        "px-1 xl:px-4 py-0 xl:py-2 h-12 xl:h-auto font-semibold text-foreground xl:text-muted-foreground text-[13px] xl:text-xs uppercase tracking-wider text-center xl:text-right sticky top-0 z-30 bg-card w-1/2 xl:w-auto align-middle",
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
                                        <span className="truncate select-none font-semibold text-xs sm:text-[13px] text-foreground">
                                            Frequenzweise
                                        </span>
                                    </div>
                                    <span className="hidden xl:inline">Frequenzweise</span>
                                </th>

                                {/* 6. Jährlich */}
                                <th
                                    className={cn(
                                        "px-1 xl:px-4 py-0 xl:py-2 h-12 xl:h-auto font-semibold text-foreground xl:text-muted-foreground text-[13px] xl:text-xs uppercase tracking-wider text-center xl:text-right sticky top-0 z-30 bg-card w-1/2 xl:w-auto align-middle",
                                        mobilePage === 2 ? "table-cell" : "hidden xl:table-cell"
                                    )}
                                >
                                    <div className="flex xl:hidden items-center justify-center w-full h-12 px-1 relative">
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                handleSort('amount');
                                            }}
                                            className="flex items-center justify-center gap-1 px-1.5 py-1 rounded-md text-foreground hover:bg-muted active:bg-muted/70 transition-colors cursor-pointer select-none font-semibold text-xs sm:text-[13px] truncate"
                                        >
                                            <span className="truncate">Jährlich</span>
                                            {sortConfig.key === 'amount' && (
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
                                                setMobilePage((p) => Math.min(4, p + 1));
                                            }}
                                            disabled={mobilePage === 4}
                                            className="absolute right-1 size-8 sm:size-9 flex items-center justify-center rounded-lg bg-muted/40 hover:bg-muted active:bg-muted/70 text-muted-foreground hover:text-foreground active:text-foreground disabled:opacity-20 transition-colors shrink-0 cursor-pointer"
                                            title="Nächste Spalten"
                                            aria-label="Nächste Spalten"
                                        >
                                            <ChevronRight className="size-4 pointer-events-none text-muted-foreground" />
                                        </button>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => handleSort('amount')}
                                        className="hidden xl:inline-flex items-center gap-1 hover:text-foreground cursor-pointer select-none text-inherit uppercase"
                                    >
                                        <span>Jährlich</span>
                                        {sortConfig.key === 'amount' && (
                                            <span className="font-bold text-xs">
                                                {sortConfig.direction === 'desc' ? '↓' : '↑'}
                                            </span>
                                        )}
                                    </button>
                                </th>

                                {/* 7. EX-Tag */}
                                <th
                                    className={cn(
                                        "px-1 xl:px-4 py-0 xl:py-2 h-12 xl:h-auto font-semibold text-foreground xl:text-muted-foreground text-[13px] xl:text-xs uppercase tracking-wider text-center xl:text-right sticky top-0 z-30 bg-card w-1/2 xl:w-auto align-middle",
                                        mobilePage === 3 ? "table-cell" : "hidden xl:table-cell"
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
                                                handleSort('date');
                                            }}
                                            className="flex items-center justify-center gap-1 px-1.5 py-1 rounded-md text-foreground hover:bg-muted active:bg-muted/70 transition-colors cursor-pointer select-none font-semibold text-xs sm:text-[13px] truncate"
                                        >
                                            <span className="truncate">EX-Tag</span>
                                            {sortConfig.key === 'date' && (
                                                <span className="font-bold text-sm text-primary shrink-0">
                                                    {sortConfig.direction === 'desc' ? '↓' : '↑'}
                                                </span>
                                            )}
                                        </button>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => handleSort('date')}
                                        className="hidden xl:inline-flex items-center gap-1 hover:text-foreground cursor-pointer select-none text-inherit uppercase"
                                    >
                                        <span>EX-Tag</span>
                                        {sortConfig.key === 'date' && (
                                            <span className="font-bold text-xs">
                                                {sortConfig.direction === 'desc' ? '↓' : '↑'}
                                            </span>
                                        )}
                                    </button>
                                </th>

                                {/* 8. Zahl-Tag */}
                                <th
                                    className={cn(
                                        "px-1 xl:px-4 py-0 xl:py-2 h-12 xl:h-auto font-semibold text-foreground xl:text-muted-foreground text-[13px] xl:text-xs uppercase tracking-wider text-center xl:text-right sticky top-0 z-30 bg-card w-1/2 xl:w-auto align-middle",
                                        mobilePage === 3 ? "table-cell" : "hidden xl:table-cell"
                                    )}
                                >
                                    <div className="flex xl:hidden items-center justify-center w-full h-12 px-1 relative">
                                        <span className="truncate select-none font-semibold text-xs sm:text-[13px] text-foreground">
                                            Zahl-Tag
                                        </span>
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                setMobilePage((p) => Math.min(4, p + 1));
                                            }}
                                            disabled={mobilePage === 4}
                                            className="absolute right-1 size-8 sm:size-9 flex items-center justify-center rounded-lg bg-muted/40 hover:bg-muted active:bg-muted/70 text-muted-foreground hover:text-foreground active:text-foreground disabled:opacity-20 transition-colors shrink-0 cursor-pointer"
                                            title="Nächste Spalten"
                                            aria-label="Nächste Spalten"
                                        >
                                            <ChevronRight className="size-4 pointer-events-none text-muted-foreground" />
                                        </button>
                                    </div>
                                    <span className="hidden xl:inline">Zahl-Tag</span>
                                </th>

                                {/* 9. Aktion */}
                                <th
                                    className={cn(
                                        "px-1 xl:px-4 py-0 xl:py-2 h-12 xl:h-auto font-semibold text-foreground xl:text-muted-foreground text-[13px] xl:text-xs uppercase tracking-wider text-center w-full xl:w-[70px] xl:min-w-[70px] xl:max-w-[70px] sticky top-0 xl:sticky xl:-right-px xl:z-40 bg-card xl:shadow-[-5px_0_5px_-5px_rgba(0,0,0,0.1)] z-30 align-middle",
                                        mobilePage === 4 ? "table-cell" : "hidden xl:table-cell"
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
                                            Aktion
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
                                    <span className="hidden xl:inline">Aktion</span>
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
                                        <tr key={position.id} className="border-b border-border last:border-0 hover:bg-muted/50 transition-colors group snap-start snap-always h-[60px] xl:h-auto">
                                            {/* 0. Aktie */}
                                            <td className="px-3 py-1.5 xl:py-3 xl:px-4 h-[60px] xl:h-auto sticky left-0 z-20 group-hover:bg-muted/30 transition-colors shadow-[5px_0_5px_-5px_rgba(0,0,0,0.1)] w-[160px] min-w-[160px] max-w-[160px] sm:w-[220px] sm:min-w-[220px] sm:max-w-[220px] xl:w-[180px] xl:min-w-[180px] xl:max-w-[180px] touch-pan-y align-middle">
                                                <div className="absolute inset-0 bg-card -z-10" />
                                                <div className="relative flex items-center gap-2 xl:gap-3">
                                                    <div
                                                        className="cursor-pointer hover:scale-110 transition-transform p-0.5 shrink-0"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            navigate(`/stock/${stock.id}?from=dividends`);
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
                                                            className="font-bold text-[13px] xl:text-sm text-foreground truncate block leading-tight cursor-pointer hover:text-primary transition-colors"
                                                            title={stock.name}
                                                            onClick={() => navigate(`/stock/${stock.id}?from=dividends`)}
                                                        >
                                                            {stock.name}
                                                        </div>
                                                        <div className="flex items-center gap-1.5 mt-0.5">
                                                            <span className="text-xs font-semibold text-foreground/80 uppercase truncate">{stock.symbol}</span>
                                                            {stock.sector && stock.sector !== 'Simuliert' && (
                                                                <>
                                                                    <span className="text-muted-foreground/40 text-[10px]">•</span>
                                                                    <span className="text-xs text-muted-foreground truncate">{translateSector(stock.sector)}</span>
                                                                </>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                                {position.plannedPurchase?.savedAt && (
                                                    <div className="absolute top-1 right-1">
                                                        <div className="size-1.5 rounded-full bg-orange-500" title="Geplanter Kauf" />
                                                    </div>
                                                )}
                                            </td>

                                            {/* 1. Anteile */}
                                            <td className={cn("px-2 xl:px-4 py-1.5 xl:py-3 h-[60px] xl:h-auto text-center xl:text-right font-medium align-middle", mobilePage === 0 ? "table-cell" : "hidden xl:table-cell")}>
                                                <div className="flex flex-col items-center xl:items-end justify-center">
                                                    <span className="font-bold text-sm tabular-nums whitespace-nowrap">{position.shares}</span>
                                                </div>
                                            </td>

                                            {/* 2. Rendite % */}
                                            <td className={cn("px-2 xl:px-4 py-1.5 xl:py-3 h-[60px] xl:h-auto text-center xl:text-right align-middle", mobilePage === 0 ? "table-cell" : "hidden xl:table-cell")}>
                                                <div className="flex flex-col items-center xl:items-end justify-center">
                                                    <span className="text-sm font-bold text-green-600 dark:text-green-400 tabular-nums whitespace-nowrap">
                                                        {stock.dividendYield?.toFixed(2)}%
                                                    </span>
                                                </div>
                                            </td>

                                            {/* 3. Div./Akt. */}
                                            <td className={cn("px-2 xl:px-4 py-1.5 xl:py-3 h-[60px] xl:h-auto text-center xl:text-right align-middle", mobilePage === 1 ? "table-cell" : "hidden xl:table-cell")}>
                                                <div className="flex flex-col items-center xl:items-end justify-center">
                                                    <span className="text-sm font-semibold text-foreground tabular-nums whitespace-nowrap">
                                                        {stock.dividendAmount?.toFixed(2)} {divCurrency}
                                                    </span>
                                                </div>
                                            </td>

                                            {/* 4. Frequenz */}
                                            <td className={cn("px-2 xl:px-4 py-1.5 xl:py-3 h-[60px] xl:h-auto text-center xl:text-right capitalize text-xs xl:text-sm align-middle whitespace-nowrap", mobilePage === 1 ? "table-cell" : "hidden xl:table-cell")}>
                                                <div className="flex flex-col items-center xl:items-end justify-center">
                                                    <span>
                                                        {stock.dividendFrequency === 'annually' && 'Jährlich'}
                                                        {stock.dividendFrequency === 'semi-annually' && 'Halbjährlich'}
                                                        {stock.dividendFrequency === 'quarterly' && 'Quartalsweise'}
                                                        {stock.dividendFrequency === 'monthly' && 'Monatlich'}
                                                        {!stock.dividendFrequency && '-'}
                                                    </span>
                                                </div>
                                            </td>

                                            {/* 5. Frequenzweise */}
                                            <td className={cn("px-2 xl:px-4 py-1.5 xl:py-3 h-[60px] xl:h-auto text-center xl:text-right align-middle whitespace-nowrap", mobilePage === 2 ? "table-cell" : "hidden xl:table-cell")}>
                                                <div className="flex flex-col items-center xl:items-end justify-center">
                                                    <span className="font-semibold text-[13px] xl:text-sm tabular-nums leading-tight">{frequencyFormatted}</span>
                                                    {divCurrency !== 'CHF' && frequencyCHFFormatted && (
                                                        <span className="text-[13px] xl:text-sm font-semibold text-green-600 dark:text-green-400 tabular-nums leading-tight mt-0.5">
                                                            {frequencyCHFFormatted}
                                                        </span>
                                                    )}
                                                </div>
                                            </td>

                                            {/* 6. Jährlich */}
                                            <td className={cn("px-2 xl:px-4 py-1.5 xl:py-3 h-[60px] xl:h-auto text-center xl:text-right align-middle whitespace-nowrap", mobilePage === 2 ? "table-cell" : "hidden xl:table-cell")}>
                                                <div className="flex flex-col items-center xl:items-end justify-center">
                                                    <span className="font-bold text-[13px] xl:text-sm tabular-nums leading-tight">{annualFormatted}</span>
                                                    {divCurrency !== 'CHF' && (
                                                        <span className="text-[13px] xl:text-sm font-bold text-green-600 dark:text-green-400 tabular-nums leading-tight mt-0.5">
                                                            {annualCHFFormatted}
                                                        </span>
                                                    )}
                                                </div>
                                            </td>

                                            {/* 7. EX-Tag */}
                                            <td className={cn("px-2 xl:px-4 py-1.5 xl:py-3 h-[60px] xl:h-auto text-center xl:text-right align-middle", mobilePage === 3 ? "table-cell" : "hidden xl:table-cell")}>
                                                <div className="flex flex-col items-center xl:items-end justify-center gap-0.5">
                                                    <span className={cn(
                                                        "font-bold text-[13px] xl:text-sm whitespace-nowrap leading-tight",
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

                                            {/* 8. Zahl-Tag */}
                                            <td className={cn("px-2 xl:px-4 py-1.5 xl:py-3 h-[60px] xl:h-auto text-center xl:text-right align-middle", mobilePage === 3 ? "table-cell" : "hidden xl:table-cell")}>
                                                <div className="flex flex-col items-center xl:items-end justify-center gap-0.5">
                                                    <span className={cn(
                                                        "font-bold text-[13px] xl:text-sm whitespace-nowrap leading-tight",
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
                                            <td className={cn("px-2 py-1.5 xl:py-3 xl:px-1 h-[60px] xl:h-auto text-center w-full xl:w-[70px] xl:min-w-[70px] xl:max-w-[70px] xl:sticky xl:-right-px bg-card z-10 group-hover:bg-muted/30 transition-colors xl:shadow-[-5px_0_5px_-5px_rgba(0,0,0,0.1)] align-middle", mobilePage === 4 ? "table-cell" : "hidden xl:table-cell")}>
                                                <div className="absolute inset-0 bg-card -z-10" />
                                                <div className="relative flex items-center justify-center">
                                                    <button
                                                        onClick={() => navigate(`/dividends/edit/${stock.id}?from=dividends`)}
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
            </div>
            )}

            {/* Bank Accounts Section */}
            {activeDivTab === 'bank' && bankRows.length > 0 && (
                <div className="flex-1 min-h-0 flex flex-col rounded-xl border border-border bg-card shadow-sm overflow-hidden">
                    <div className="flex items-center justify-between p-3 border-b bg-muted/30 shrink-0">
                        <h2 className="text-base md:text-lg font-semibold">Bank Erträge & Gebühren</h2>
                    </div>

                    <div
                        onTouchStart={handleBankTouchStart}
                        onTouchEnd={handleBankTouchEnd}
                        className="overflow-y-auto overflow-x-hidden xl:overflow-x-auto flex-1 min-h-0 p-0 w-full snap-y snap-mandatory scroll-pt-[48px] xl:snap-none xl:scroll-pt-0"
                    >
                        <table className="w-full text-xs xl:text-sm border-collapse table-fixed xl:table-auto">
                            <thead>
                                <tr className="border-b border-border bg-muted/20">
                                    {/* 0. Bank / Institut */}
                                    <th className="text-left px-3 xl:px-4 py-0 xl:py-2 h-12 xl:h-auto font-semibold text-foreground xl:text-muted-foreground text-[15px] xl:text-xs uppercase tracking-wider sticky top-0 left-0 z-40 bg-card shadow-[5px_0_5px_-5px_rgba(0,0,0,0.1)] w-[160px] min-w-[160px] max-w-[160px] sm:w-[220px] sm:min-w-[220px] sm:max-w-[220px] xl:w-[180px] xl:min-w-[180px] xl:max-w-[180px] touch-pan-y align-middle">
                                        Bank / Institut
                                    </th>

                                    {/* 1. Betrag */}
                                    <th
                                        className={cn(
                                            "px-1 xl:px-4 py-0 xl:py-2 h-12 xl:h-auto font-semibold text-foreground xl:text-muted-foreground text-[13px] xl:text-xs uppercase tracking-wider text-center xl:text-right sticky top-0 z-30 bg-card w-1/2 xl:w-auto align-middle",
                                            mobileBankPage === 0 ? "table-cell" : "hidden xl:table-cell"
                                        )}
                                    >
                                        <div className="flex xl:hidden items-center justify-center w-full h-12 px-1 relative">
                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    e.preventDefault();
                                                    e.stopPropagation();
                                                    setMobileBankPage((p) => Math.max(0, p - 1));
                                                }}
                                                disabled={mobileBankPage === 0}
                                                className="absolute left-1 size-8 sm:size-9 flex items-center justify-center rounded-lg bg-muted/40 hover:bg-muted active:bg-muted/70 text-muted-foreground hover:text-foreground active:text-foreground disabled:opacity-20 transition-colors shrink-0 cursor-pointer"
                                                title="Vorherige Spalten"
                                                aria-label="Vorherige Spalten"
                                            >
                                                <ChevronLeft className="size-4 pointer-events-none text-muted-foreground" />
                                            </button>
                                            <span className="truncate select-none font-semibold text-xs sm:text-[13px] text-foreground">
                                                Betrag
                                            </span>
                                        </div>
                                        <span className="hidden xl:inline">Betrag</span>
                                    </th>

                                    {/* 2. Zins % */}
                                    <th
                                        className={cn(
                                            "px-1 xl:px-4 py-0 xl:py-2 h-12 xl:h-auto font-semibold text-foreground xl:text-muted-foreground text-[13px] xl:text-xs uppercase tracking-wider text-center xl:text-right sticky top-0 z-30 bg-card w-1/2 xl:w-auto align-middle",
                                            mobileBankPage === 0 ? "table-cell" : "hidden xl:table-cell"
                                        )}
                                    >
                                        <div className="flex xl:hidden items-center justify-center w-full h-12 px-1 relative">
                                            <span className="truncate select-none font-semibold text-xs sm:text-[13px] text-foreground">
                                                Zins %
                                            </span>
                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    e.preventDefault();
                                                    e.stopPropagation();
                                                    setMobileBankPage((p) => Math.min(3, p + 1));
                                                }}
                                                disabled={mobileBankPage === 3}
                                                className="absolute right-1 size-8 sm:size-9 flex items-center justify-center rounded-lg bg-muted/40 hover:bg-muted active:bg-muted/70 text-muted-foreground hover:text-foreground active:text-foreground disabled:opacity-20 transition-colors shrink-0 cursor-pointer"
                                                title="Nächste Spalten"
                                                aria-label="Nächste Spalten"
                                            >
                                                <ChevronRight className="size-4 pointer-events-none text-muted-foreground" />
                                            </button>
                                        </div>
                                        <span className="hidden xl:inline">Zins %</span>
                                    </th>

                                    {/* 3. Ø Monatlich */}
                                    <th
                                        className={cn(
                                            "px-1 xl:px-4 py-0 xl:py-2 h-12 xl:h-auto font-semibold text-foreground xl:text-muted-foreground text-[13px] xl:text-xs uppercase tracking-wider text-center xl:text-right sticky top-0 z-30 bg-card w-1/2 xl:w-auto align-middle",
                                            mobileBankPage === 1 ? "table-cell" : "hidden xl:table-cell"
                                        )}
                                    >
                                        <div className="flex xl:hidden items-center justify-center w-full h-12 px-1 relative">
                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    e.preventDefault();
                                                    e.stopPropagation();
                                                    setMobileBankPage((p) => Math.max(0, p - 1));
                                                }}
                                                disabled={mobileBankPage === 0}
                                                className="absolute left-1 size-8 sm:size-9 flex items-center justify-center rounded-lg bg-muted/40 hover:bg-muted active:bg-muted/70 text-muted-foreground hover:text-foreground active:text-foreground disabled:opacity-20 transition-colors shrink-0 cursor-pointer"
                                                title="Vorherige Spalten"
                                                aria-label="Vorherige Spalten"
                                            >
                                                <ChevronLeft className="size-4 pointer-events-none text-muted-foreground" />
                                            </button>
                                            <span className="truncate select-none font-semibold text-xs sm:text-[13px] text-foreground">
                                                Ø Monatlich
                                            </span>
                                        </div>
                                        <span className="hidden xl:inline">Ø Monatlich</span>
                                    </th>

                                    {/* 4. Frequenz */}
                                    <th
                                        className={cn(
                                            "px-1 xl:px-4 py-0 xl:py-2 h-12 xl:h-auto font-semibold text-foreground xl:text-muted-foreground text-[13px] xl:text-xs uppercase tracking-wider text-center xl:text-right sticky top-0 z-30 bg-card w-1/2 xl:w-auto align-middle",
                                            mobileBankPage === 1 ? "table-cell" : "hidden xl:table-cell"
                                        )}
                                    >
                                        <div className="flex xl:hidden items-center justify-center w-full h-12 px-1 relative">
                                            <span className="truncate select-none font-semibold text-xs sm:text-[13px] text-foreground">
                                                Frequenz
                                            </span>
                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    e.preventDefault();
                                                    e.stopPropagation();
                                                    setMobileBankPage((p) => Math.min(3, p + 1));
                                                }}
                                                disabled={mobileBankPage === 3}
                                                className="absolute right-1 size-8 sm:size-9 flex items-center justify-center rounded-lg bg-muted/40 hover:bg-muted active:bg-muted/70 text-muted-foreground hover:text-foreground active:text-foreground disabled:opacity-20 transition-colors shrink-0 cursor-pointer"
                                                title="Nächste Spalten"
                                                aria-label="Nächste Spalten"
                                            >
                                                <ChevronRight className="size-4 pointer-events-none text-muted-foreground" />
                                            </button>
                                        </div>
                                        <span className="hidden xl:inline">Frequenz</span>
                                    </th>

                                    {/* 5. Quartalsweise */}
                                    <th
                                        className={cn(
                                            "px-1 xl:px-4 py-0 xl:py-2 h-12 xl:h-auto font-semibold text-foreground xl:text-muted-foreground text-[13px] xl:text-xs uppercase tracking-wider text-center xl:text-right sticky top-0 z-30 bg-card w-1/2 xl:w-auto align-middle",
                                            mobileBankPage === 2 ? "table-cell" : "hidden xl:table-cell"
                                        )}
                                    >
                                        <div className="flex xl:hidden items-center justify-center w-full h-12 px-1 relative">
                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    e.preventDefault();
                                                    e.stopPropagation();
                                                    setMobileBankPage((p) => Math.max(0, p - 1));
                                                }}
                                                disabled={mobileBankPage === 0}
                                                className="absolute left-1 size-8 sm:size-9 flex items-center justify-center rounded-lg bg-muted/40 hover:bg-muted active:bg-muted/70 text-muted-foreground hover:text-foreground active:text-foreground disabled:opacity-20 transition-colors shrink-0 cursor-pointer"
                                                title="Vorherige Spalten"
                                                aria-label="Vorherige Spalten"
                                            >
                                                <ChevronLeft className="size-4 pointer-events-none text-muted-foreground" />
                                            </button>
                                            <span className="truncate select-none font-semibold text-xs sm:text-[13px] text-foreground">
                                                Quartalsweise
                                            </span>
                                        </div>
                                        <span className="hidden xl:inline">Quartalsweise</span>
                                    </th>

                                    {/* 6. Jährlich */}
                                    <th
                                        className={cn(
                                            "px-1 xl:px-4 py-0 xl:py-2 h-12 xl:h-auto font-semibold text-foreground xl:text-muted-foreground text-[13px] xl:text-xs uppercase tracking-wider text-center xl:text-right sticky top-0 z-30 bg-card w-1/2 xl:w-auto align-middle",
                                            mobileBankPage === 2 ? "table-cell" : "hidden xl:table-cell"
                                        )}
                                    >
                                        <div className="flex xl:hidden items-center justify-center w-full h-12 px-1 relative">
                                            <span className="truncate select-none font-semibold text-xs sm:text-[13px] text-foreground">
                                                Jährlich
                                            </span>
                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    e.preventDefault();
                                                    e.stopPropagation();
                                                    setMobileBankPage((p) => Math.min(3, p + 1));
                                                }}
                                                disabled={mobileBankPage === 3}
                                                className="absolute right-1 size-8 sm:size-9 flex items-center justify-center rounded-lg bg-muted/40 hover:bg-muted active:bg-muted/70 text-muted-foreground hover:text-foreground active:text-foreground disabled:opacity-20 transition-colors shrink-0 cursor-pointer"
                                                title="Nächste Spalten"
                                                aria-label="Nächste Spalten"
                                            >
                                                <ChevronRight className="size-4 pointer-events-none text-muted-foreground" />
                                            </button>
                                        </div>
                                        <span className="hidden xl:inline">Jährlich</span>
                                    </th>

                                    {/* 7. Aktion */}
                                    <th
                                        className={cn(
                                            "px-1 xl:px-4 py-0 xl:py-2 h-12 xl:h-auto font-semibold text-foreground xl:text-muted-foreground text-[13px] xl:text-xs uppercase tracking-wider text-center w-full xl:w-[70px] xl:min-w-[70px] xl:max-w-[70px] sticky top-0 xl:sticky xl:-right-px xl:z-40 bg-card xl:shadow-[-5px_0_5px_-5px_rgba(0,0,0,0.1)] z-30 align-middle",
                                            mobileBankPage === 3 ? "table-cell" : "hidden xl:table-cell"
                                        )}
                                    >
                                        <div className="flex xl:hidden items-center justify-center gap-3 w-full h-12 px-2">
                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    e.preventDefault();
                                                    e.stopPropagation();
                                                    setMobileBankPage((p) => Math.max(0, p - 1));
                                                }}
                                                disabled={mobileBankPage === 0}
                                                className="size-8 sm:size-9 flex items-center justify-center rounded-lg bg-muted/40 hover:bg-muted active:bg-muted/70 text-muted-foreground hover:text-foreground active:text-foreground disabled:opacity-20 transition-colors shrink-0 cursor-pointer"
                                                title="Vorherige Spalten"
                                                aria-label="Vorherige Spalten"
                                            >
                                                <ChevronLeft className="size-4 pointer-events-none text-muted-foreground" />
                                            </button>
                                            <span className="whitespace-nowrap text-center px-2 select-none font-semibold text-xs sm:text-[13px] text-foreground">
                                                Aktion
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
                                        <span className="hidden xl:inline">Aktion</span>
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {bankRows.map((data: any) => {
                                    const isNegative = data.isNegative;
                                    return (
                                        <tr key={data.id} className="border-b border-border/50 last:border-0 hover:bg-muted/50 transition-colors group snap-start snap-always h-[60px] xl:h-auto">
                                            <td className="px-3 py-1.5 xl:py-3 xl:px-4 font-medium sticky left-0 z-10 group-hover:bg-muted/30 transition-colors shadow-[5px_0_5px_-5px_rgba(0,0,0,0.1)] h-[60px] xl:h-auto align-middle w-[160px] min-w-[160px] max-w-[160px] sm:w-[220px] sm:min-w-[220px] sm:max-w-[220px] xl:w-[180px] xl:min-w-[180px] xl:max-w-[180px]">
                                                    <div className="absolute inset-0 bg-card -z-10" />
                                                    <div className="flex items-center gap-3">
                                                        <Logo
                                                            url={data.logoUrl}
                                                            alt={data.name}
                                                            fallback="BK"
                                                        />
                                                        <div>
                                                            <div className="font-semibold text-xs xl:text-sm">{data.name}</div>
                                                            <div className={`text-[10px] xl:text-xs font-medium ${isNegative ? 'text-red-500' : 'text-green-600'}`}>
                                                                {isNegative ? 'Konto-Gebühren' : 'Bank-Zinsen'}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className={cn("px-2 xl:px-4 py-1.5 xl:py-3 h-[60px] xl:h-auto text-center xl:text-right font-medium whitespace-nowrap align-middle", mobileBankPage === 0 ? "table-cell" : "hidden xl:table-cell")}>
                                                    <div className="flex flex-col items-center xl:items-end justify-center">
                                                        <span>CHF {data.depositAmount?.toLocaleString('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                                    </div>
                                                </td>
                                                <td className={cn("px-2 xl:px-4 py-1.5 xl:py-3 h-[60px] xl:h-auto text-center xl:text-right text-muted-foreground align-middle", mobileBankPage === 0 ? "table-cell" : "hidden xl:table-cell")}>
                                                    <div className="flex flex-col items-center xl:items-end justify-center">
                                                        <span>{data.yield > 0 ? `${data.yield.toFixed(2)}%` : '-'}</span>
                                                    </div>
                                                </td>
                                                <td className={cn("px-2 xl:px-4 py-1.5 xl:py-3 h-[60px] xl:h-auto text-center xl:text-right font-medium whitespace-nowrap align-middle", mobileBankPage === 1 ? "table-cell" : "hidden xl:table-cell", isNegative ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400')}>
                                                    <div className="flex flex-col items-center xl:items-end justify-center">
                                                        <span>{isNegative ? '-' : '+'} {Math.abs(data.annual / 12).toLocaleString('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} CHF</span>
                                                    </div>
                                                </td>
                                                <td className={cn("px-2 xl:px-4 py-1.5 xl:py-3 h-[60px] xl:h-auto text-center xl:text-right text-muted-foreground align-middle", mobileBankPage === 1 ? "table-cell" : "hidden xl:table-cell")}>
                                                    <div className="flex flex-col items-center xl:items-end justify-center">
                                                        <span>Jährlich</span>
                                                    </div>
                                                </td>
                                                <td className={cn("px-2 xl:px-4 py-1.5 xl:py-3 h-[60px] xl:h-auto text-center xl:text-right font-medium whitespace-nowrap align-middle", mobileBankPage === 2 ? "table-cell" : "hidden xl:table-cell", isNegative ? 'text-red-600/70' : 'text-green-600/70')}>
                                                    <div className="flex flex-col items-center xl:items-end justify-center">
                                                        <span>{isNegative ? '-' : '+'} CHF {Math.abs(data.quarterly).toLocaleString('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                                    </div>
                                                </td>
                                                <td className={cn("px-2 xl:px-4 py-1.5 xl:py-3 h-[60px] xl:h-auto text-center xl:text-right font-semibold whitespace-nowrap align-middle", mobileBankPage === 2 ? "table-cell" : "hidden xl:table-cell", isNegative ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400')}>
                                                    <div className="flex flex-col items-center xl:items-end justify-center">
                                                        <span>{isNegative ? '-' : '+'} CHF {Math.abs(data.annual).toLocaleString('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                                    </div>
                                                </td>
                                                <td className={cn("px-2 py-1.5 xl:py-3 xl:px-1 h-[60px] xl:h-auto text-center w-full xl:w-[70px] xl:min-w-[70px] xl:max-w-[70px] xl:sticky xl:-right-px bg-card z-10 xl:z-20 group-hover:bg-muted/50 transition-colors xl:shadow-[-5px_0_5px_-5px_rgba(0,0,0,0.1)] align-middle", mobileBankPage === 3 ? "table-cell" : "hidden xl:table-cell")}>
                                                    <div className="flex items-center justify-center gap-1">
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
            {/* Dividend Calendar Chart */}
            {activeDivTab === 'calendar' && (
                <div className="flex-1 min-h-0 overflow-y-auto bg-card border border-border rounded-xl p-4 md:p-6 shadow-sm">
                    <div className="flex items-center gap-2 mb-4">
                        <div className="p-2 bg-primary/10 rounded-lg">
                            <TrendingUp className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-foreground">Monatliche Dividenden (Geschätzt)</h2>
                            <p className="text-sm text-muted-foreground">Prognostizierte Verteilung der Zahlungen über das Jahr</p>
                        </div>
                    </div>
                    <DividendCalendarChart />
                </div>
            )}
        </div >
    );
}
