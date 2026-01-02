import { useNavigate } from 'react-router-dom';
import { usePortfolio } from '../context/PortfolioContext';
import { Calendar, TrendingUp, Edit, Trash2, RefreshCw } from 'lucide-react';
import { Logo } from '../components/Logo';
import { cn } from '../utils';
import { estimateMarketState } from '../utils/market';
import { useState, useEffect } from 'react';

import { useCurrencyFormatter } from '../utils/currency';
import { getCurrentDividendPeriod, translateFrequency } from '../utils/dividend';
import { DividendCalendarChart } from '../components/DividendCalendarChart';

export function DividendPlanner() {
    const navigate = useNavigate();
    const { stocks, positions, fixedDeposits, deleteFixedDeposit, lastGlobalRefresh, isGlobalRefreshing, refreshAllPrices } = usePortfolio();
    const { convertToCHF } = useCurrencyFormatter();

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
        <div className="p-6 md:p-8 space-y-8 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                <div className="flex items-center gap-3">
                    <div className="p-3 rounded-xl bg-gradient-to-br from-green-500/20 to-emerald-500/20 text-green-600 dark:text-green-400">
                        <Calendar className="size-6" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">Dividenden</h1>
                        <p className="text-muted-foreground">Erwartete Dividendenausschüttungen</p>
                    </div>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 rounded-xl p-4 border border-green-200 dark:border-green-800">
                    <div className="flex flex-col">
                        <span className="text-xs font-medium text-green-900 dark:text-green-100 flex items-center gap-2 mb-1">
                            <TrendingUp className="size-3" />
                            Gesamtdividende (Jahr)
                        </span>
                        <div className="text-xl font-bold text-green-600 dark:text-green-400">
                            CHF {totalAnnualNet.toLocaleString('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                    </div>
                </div>

                <div className="bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-950/30 dark:to-cyan-950/30 rounded-xl p-4 border border-blue-200 dark:border-blue-800">
                    <div className="flex flex-col">
                        <span className="text-xs font-medium text-blue-900 dark:text-blue-100 flex items-center gap-2 mb-1">
                            <Calendar className="size-3" />
                            Ø Monatlich
                        </span>
                        <div className="text-xl font-bold text-blue-800 dark:text-blue-400">
                            CHF {totalMonthly.toLocaleString('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
            </div>



            {/* Main Dividend Table (Moved Up) */}
            <div className="bg-card rounded-xl border shadow-sm overflow-hidden mt-8 mb-8">
                <div className="flex items-center justify-between p-4 border-b border-border bg-card">
                    <h2 className="text-lg font-semibold">Erwartete Dividenden</h2>

                    <div className="flex items-center gap-3">
                        <select
                            className="hidden md:block pl-3 pr-8 py-1.5 rounded-lg border border-border bg-background text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all shadow-sm appearance-none cursor-pointer"
                            value={sortConfig.key}
                            onChange={(e) => setSortConfig({ ...sortConfig, key: e.target.value as any })}
                        >
                            <option value="name">Name (A-Z)</option>
                            <option value="yield">Rendite % (Hoch)</option>
                            <option value="amount">Betrag (Hoch)</option>
                            <option value="date">Datum (Nächstes)</option>
                        </select>

                        <button
                            onClick={() => refreshAllPrices(true)}
                            disabled={isGlobalRefreshing}
                            className={cn(
                                "flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all shadow-sm",
                                "bg-blue-600 text-white border-blue-700 hover:bg-blue-700 hover:border-blue-800",
                                "active:scale-95",
                                isGlobalRefreshing && "opacity-50 cursor-not-allowed"
                            )}
                            title="Alle Aktienpreise aktualisieren"
                        >
                            <RefreshCw className={cn("size-3.5", isGlobalRefreshing && "animate-spin")} />
                            <span>
                                {isGlobalRefreshing
                                    ? 'Aktualisiere...'
                                    : lastGlobalRefresh
                                        ? `Vor ${Math.floor((new Date().getTime() - lastGlobalRefresh.getTime()) / 60000)} Min`
                                        : 'Jetzt aktualisieren'}
                            </span>
                        </button>
                    </div>
                </div>
            </div>


            <div className="overflow-x-auto">
                <table className="w-full min-w-[1000px]">
                    <thead>
                        <tr className="border-b border-border">
                            <th className="text-left py-3 px-4 font-semibold sticky left-0 z-30 bg-card shadow-[5px_0_5px_-5px_rgba(0,0,0,0.1)] min-w-[140px]">Aktie</th>
                            <th className="text-right py-3 px-4 font-semibold">Anteile</th>
                            <th className="text-right py-3 px-4 font-semibold whitespace-nowrap">Rendite %</th>
                            <th className="text-right py-3 px-4 font-semibold whitespace-nowrap">Div./Akt.</th>
                            <th className="text-right py-3 px-4 font-semibold">Frequenz</th>
                            <th className="text-right py-3 px-4 font-semibold whitespace-nowrap">Quartalsweise</th>
                            <th className="text-right py-3 px-4 font-semibold whitespace-nowrap">Jährlich</th>
                            <th className="text-right py-3 px-4 font-semibold whitespace-nowrap">EX-Tag</th>
                            <th className="text-right py-3 px-4 font-semibold whitespace-nowrap">Zahl-Tag</th>
                            <th className="px-1 py-3 text-center sticky right-0 bg-card z-10 w-[60px] shadow-[-5px_0_5px_-5px_rgba(0,0,0,0.1)]">Aktion</th>
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
                                const { position, stock, annualDividendNative, annualDividendCHF, quarterlyDividendCHF, divCurrency } = data!;

                                // Annual Display Logic
                                let annualDisplay: React.ReactNode;
                                if (divCurrency !== 'CHF') {
                                    // Manual Format for Tabular Alignment
                                    const annualNative = annualDividendNative || 0;
                                    let displayAnnualNative = annualNative;
                                    let displayAnnualCurrency = divCurrency;
                                    if (divCurrency === 'GBp') {
                                        displayAnnualNative /= 100;
                                        displayAnnualCurrency = 'GBP';
                                    }

                                    annualDisplay = (
                                        <div className="flex flex-col items-end gap-0.5">
                                            <div className="flex items-center justify-end gap-1.5 font-medium tabular-nums">
                                                <span>{displayAnnualNative.toLocaleString('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                                <span className="w-8 text-left text-[11px] uppercase text-muted-foreground/80 sm:text-sm sm:text-foreground/90 sm:w-8 translate-y-[0.5px]">{displayAnnualCurrency}</span>
                                            </div>
                                            <div className="flex items-center justify-end gap-1.5 font-medium tabular-nums">
                                                <span>{annualDividendCHF.toLocaleString('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                                <span className="w-8 text-left text-[11px] uppercase text-muted-foreground/80 sm:text-sm sm:text-foreground/90 sm:w-8 translate-y-[0.5px]">CHF</span>
                                            </div>
                                        </div>
                                    );
                                } else {
                                    annualDisplay = (
                                        <div className="flex items-center justify-end gap-1.5 font-medium tabular-nums">
                                            <span>{annualDividendCHF.toLocaleString('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                            <span className="w-8 text-left text-[11px] uppercase text-muted-foreground/80 sm:text-sm sm:text-foreground/90 sm:w-8 translate-y-[0.5px]">CHF</span>
                                        </div>
                                    );
                                }

                                const currentDiv = getCurrentDividendPeriod(stock);

                                return (
                                    <tr key={position.id} className="border-b border-border last:border-0 hover:bg-muted/50 transition-colors group">
                                        <td className="py-3 px-4 sticky left-0 z-20 group-hover:bg-muted/30 transition-colors shadow-[5px_0_5px_-5px_rgba(0,0,0,0.1)] min-w-[140px]">
                                            <div className="absolute inset-0 bg-card -z-10" />
                                            <div className="relative flex items-center gap-3">
                                                <div
                                                    className="cursor-pointer hover:scale-110 transition-transform p-1 -m-1"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        navigate('/portfolio');
                                                    }}
                                                    title="Zu den Positionen"
                                                >
                                                    <Logo
                                                        url={stock.logoUrl}
                                                        alt={stock.name}
                                                        fallback={stock.symbol.slice(0, 2)}
                                                    />
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <div
                                                            className="font-semibold cursor-pointer hover:text-primary transition-colors whitespace-pre-line"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                navigate(`/stock/${stock.id}`);
                                                            }}
                                                        >
                                                            {stock.name}
                                                        </div>
                                                        {(() => {
                                                            const calcState = estimateMarketState(stock.symbol, stock.currency);
                                                            const isMarketOpen = calcState === 'REGULAR';
                                                            return isMarketOpen ? (
                                                                <div className="size-2.5 flex-shrink-0 rounded-full bg-green-500 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.5)] border border-background" title={`Markt geöffnet (${calcState})`} />
                                                            ) : (
                                                                <div className="size-2.5 flex-shrink-0 rounded-full bg-red-500 border border-background" title={`Markt geschlossen (${calcState})`} />
                                                            );
                                                        })()}
                                                    </div>
                                                    <div className="text-xs text-muted-foreground">{stock.symbol}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="text-right py-3 px-4 font-medium">{position.shares}</td>
                                        <td className="text-right py-3 px-4 text-green-600 dark:text-green-400 font-medium">
                                            {stock.dividendYield?.toFixed(2)}%
                                        </td>
                                        <td className="text-right py-3 px-4 font-medium">
                                            {stock.dividendAmount ? (
                                                <div className="flex flex-col items-end gap-0.5">
                                                    {(() => {
                                                        // Native Line
                                                        let displayAmount = stock.dividendAmount || 0;
                                                        let displayCurrency = divCurrency;
                                                        if (divCurrency === 'GBp') {
                                                            displayAmount /= 100;
                                                            displayCurrency = 'GBP';
                                                        }

                                                        // CHF Line
                                                        const chfAmount = convertToCHF(stock.dividendAmount || 0, divCurrency);

                                                        return (
                                                            <>
                                                                <div className="flex items-center justify-end gap-1.5 font-medium tabular-nums">
                                                                    <span>{displayAmount.toLocaleString('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                                                    <span className="w-8 text-left text-[11px] uppercase text-muted-foreground/80 sm:text-sm sm:text-foreground/90 sm:w-8 translate-y-[0.5px]">{displayCurrency}</span>
                                                                </div>
                                                                {divCurrency !== 'CHF' && (
                                                                    <div className="flex items-center justify-end gap-1.5 font-medium tabular-nums">
                                                                        <span>{chfAmount.toLocaleString('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                                                        <span className="w-8 text-left text-[11px] uppercase text-muted-foreground/80 sm:text-sm sm:text-foreground/90 sm:w-8 translate-y-[0.5px]">CHF</span>
                                                                    </div>
                                                                )}
                                                            </>
                                                        );
                                                    })()}
                                                </div>
                                            ) : '-'}
                                        </td>
                                        <td className="text-right py-3 px-4 text-muted-foreground align-top">
                                            {(() => {
                                                const freqLabel = translateFrequency(stock.dividendFrequency);
                                                if (currentDiv.periodLabel) {
                                                    return (
                                                        <div className="grid grid-cols-[auto_24px] gap-x-0.5 justify-end items-center">
                                                            <span>{freqLabel}</span>
                                                            <span className="px-1.5 py-0.5 text-[10px] uppercase font-medium bg-muted text-muted-foreground border border-border rounded justify-self-end">
                                                                {currentDiv.periodLabel}
                                                            </span>
                                                        </div>
                                                    );
                                                }
                                                return freqLabel;
                                            })()}
                                        </td>
                                        <td className="text-right py-3 px-4 font-medium whitespace-nowrap">
                                            {stock.dividendFrequency !== 'annually' ? `CHF ${quarterlyDividendCHF.toFixed(2)}` : ''}
                                        </td>
                                        <td className="text-right py-3 px-4 font-semibold whitespace-nowrap">
                                            {annualDisplay}
                                        </td>
                                        <td className="text-right py-3 px-4 text-muted-foreground">
                                            <div className="flex flex-col items-end gap-1">
                                                <span className={(() => {
                                                    const dDays = currentDiv.exDate ? Math.ceil((new Date(currentDiv.exDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)) : null;
                                                    if (dDays !== null && dDays < 0) return "text-green-600 font-medium"; // Past -> Green
                                                    if (dDays !== null && dDays >= 0 && dDays <= 14) return "text-orange-500 font-medium"; // Soon -> Orange
                                                    return "";
                                                })()}>
                                                    {currentDiv.exDate
                                                        ? new Date(currentDiv.exDate).toLocaleDateString('de-DE')
                                                        : '-'}
                                                </span>
                                                {currentDiv.status === 'ex-dividend' && (
                                                    <span className="text-[10px] font-bold text-orange-500 bg-orange-100 dark:bg-orange-950/50 px-1.5 py-0.5 rounded">
                                                        Ex-Div
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="text-right py-3 px-4 text-muted-foreground">
                                            <div className="flex flex-col items-end gap-1">
                                                <span className={(() => {
                                                    const payDays = currentDiv.payDate ? Math.ceil((new Date(currentDiv.payDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)) : null;
                                                    const exDays = currentDiv.exDate ? Math.ceil((new Date(currentDiv.exDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)) : null;

                                                    // Paid (Past) -> Green
                                                    if (payDays !== null && payDays < 0) return "text-green-600 font-medium";

                                                    // Ex-Date passed + Pay-Date future -> Orange (Waiting for payment)
                                                    if (exDays !== null && exDays < 0 && payDays !== null && payDays >= 0) return "text-orange-500 font-medium";

                                                    // Soon check (fallback if Ex-Date not available or future)
                                                    if (payDays !== null && payDays >= 0 && payDays <= 14) return "text-orange-500 font-medium";

                                                    return "";
                                                })()}>
                                                    {currentDiv.payDate
                                                        ? new Date(currentDiv.payDate).toLocaleDateString('de-DE')
                                                        : '-'}
                                                </span>
                                                {currentDiv.status === 'paid' && (
                                                    <span className="text-[10px] font-bold text-green-600 bg-green-100 dark:bg-green-950/50 px-1.5 py-0.5 rounded flex items-center gap-1">
                                                        Bezahlt
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-1 py-3 text-center sticky right-0 z-10 group-hover:bg-muted/30 transition-colors shadow-[-5px_0_5px_-5px_rgba(0,0,0,0.1)]">
                                            <div className="absolute inset-0 bg-card -z-10" />
                                            <div className="relative flex items-center justify-center">
                                                <button
                                                    onClick={() => navigate(`/dividends/edit/${stock.id}`)}
                                                    className="p-2 hover:bg-primary/10 text-primary rounded-lg transition-colors"
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

            {/* Bank Accounts Section */ }
    {
        bankRows.length > 0 && (
            <div className="bg-card rounded-xl border shadow-sm overflow-hidden animate-in slide-in-from-bottom-4 duration-700">
                <div className="flex items-center justify-between p-4 border-b bg-muted/30">
                    <h2 className="text-lg font-semibold">Bank Erträge & Gebühren</h2>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full min-w-[1000px]">
                        <thead>
                            <tr className="border-b border-border">
                                <th className="text-left py-3 px-4 font-semibold sticky left-0 z-20 bg-card shadow-[5px_0_5px_-5px_rgba(0,0,0,0.1)]">Bank / Institut</th>
                                <th className="text-right py-3 px-4 font-semibold whitespace-nowrap">Betrag</th>
                                <th className="text-right py-3 px-4 font-semibold whitespace-nowrap">Zins %</th>
                                <th className="text-right py-3 px-4 font-semibold whitespace-nowrap">Ø Monatlich</th>
                                <th className="text-right py-3 px-4 font-semibold whitespace-nowrap">Frequenz</th>
                                <th className="text-right py-3 px-4 font-semibold whitespace-nowrap">Quartalsweise</th>
                                <th className="text-right py-3 px-4 font-semibold whitespace-nowrap">Jährlich</th>
                                <th className="text-right py-3 px-4 w-24 sticky right-0 bg-card z-10 shadow-[-5px_0_5px_-5px_rgba(0,0,0,0.1)]">Aktionen</th>
                            </tr>
                        </thead>
                        <tbody>
                            {bankRows.map((data: any) => {
                                const isNegative = data.isNegative;
                                return (
                                    <tr key={data.id} className="border-b border-border last:border-0 hover:bg-muted/50 transition-colors group">
                                        <td className="py-3 px-4 sticky left-0 z-10 bg-card group-hover:bg-muted/50 transition-colors shadow-[5px_0_5px_-5px_rgba(0,0,0,0.1)]">
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
                                        <td className="text-right py-3 px-4 sticky right-0 bg-card group-hover:bg-muted/50 transition-colors shadow-[-5px_0_5px_-5px_rgba(0,0,0,0.1)]">
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
    {/* Dividend Calendar Chart (Moved Down) */ }
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
        </div >
    );
}
