import { useState, Fragment } from 'react';
import { usePortfolio } from '../context/PortfolioContext';
import { useNavigate } from 'react-router-dom';

import { useCurrencyFormatter } from '../utils/currency';
import { smartWrap } from '../utils/text';
import { getCurrentDividendPeriod, translateFrequency } from '../utils/dividend';
import { Eye, Plus, Trash2, Edit, ShoppingBag } from 'lucide-react';

import { AddPositionModal } from '../components/AddPositionModal'; // Import AddPositionModal
import type { Stock } from '../types';

export function Watchlist() {
    const navigate = useNavigate();
    const { stocks, watchlist, removeFromWatchlist, addPosition } = usePortfolio(); // Get addPosition
    const { formatCurrency, convertToCHF } = useCurrencyFormatter();
    const [buyStock, setBuyStock] = useState<Stock | null>(null); // State for buying stock

    // Filter stocks that are in the watchlist
    const watchlistStocks = stocks.filter(s => watchlist.includes(s.id));

    return (
        <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
            {/* Header */}
            <div className="border-b bg-card sticky top-0 z-[100]">
                <div className="w-full px-4 py-4 md:px-4">
                    <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                            <div className="p-3 rounded-xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20 text-blue-600 dark:text-blue-400">
                                <Eye className="size-6" />
                            </div>
                            <div>
                                <h1 className="text-3xl font-bold tracking-tight">Watchlist</h1>
                                <p className="text-muted-foreground">Aktien beobachten und Dividenden prüfen</p>
                            </div>
                        </div>

                        <button
                            onClick={() => {
                                navigate('/calculator?mode=new&from=watchlist');
                            }}
                            className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors font-medium shadow-sm"
                        >
                            <Plus className="size-4" />
                            <span>Aktie hinzufügen</span>
                        </button>
                    </div>
                </div>
            </div>

            <div className="w-full px-2 py-4 md:px-4">
                <div className="bg-card rounded-xl border shadow-sm overflow-hidden w-full">
                    <div className="flex flex-col md:flex-row md:items-center justify-between p-4 border-b bg-muted/30 gap-2">
                        <h2 className="text-lg font-semibold">Beobachtete Aktien</h2>
                        <div className="flex items-center gap-4 text-xs font-medium text-muted-foreground bg-background/50 px-3 py-1.5 rounded-lg border border-border/50">
                            <span>Aktueller Kurs:</span>
                            <div className="flex items-center gap-1.5">
                                <div className="flex items-center gap-1 text-green-600 dark:text-green-400">
                                    <div className="size-2 rounded-full bg-green-500 animate-pulse" />
                                    <span className="font-bold">KAUFEN</span>
                                </div>
                                <span>(Kurs &lt; Limit)</span>
                            </div>
                            <div className="w-px h-3 bg-border" />
                            <div className="flex items-center gap-1.5">
                                <div className="flex items-center gap-1 text-red-500">
                                    <div className="size-2 rounded-full bg-red-500" />
                                </div>
                                <span>(Kurs &gt; Limit)</span>
                            </div>
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-border">
                                    <th className="text-left py-3 px-4 font-semibold sticky left-0 z-40 bg-card shadow-[5px_0_5px_-5px_rgba(0,0,0,0.1)] min-w-[140px]">Aktie</th>
                                    <th className="text-right py-3 px-2 sm:px-4 font-semibold whitespace-nowrap">Aktueller Kurs</th>
                                    <th className="text-right py-3 px-4 font-semibold whitespace-nowrap">Kauflimit</th>
                                    <th className="text-right py-3 px-4 font-semibold whitespace-nowrap">Rendite %</th>
                                    <th className="text-right py-3 px-4 font-semibold">Dividende</th>
                                    <th className="text-right py-3 px-4 font-semibold">Frequenz</th>
                                    <th className="text-right py-3 px-4 font-semibold whitespace-nowrap">EX-Tag</th>
                                    <th className="text-right py-3 px-4 font-semibold whitespace-nowrap">Zahl-Tag</th>
                                    <th className="px-1 py-3 text-center sticky right-0 bg-card z-30 w-[60px] shadow-[-5px_0_5px_-5px_rgba(0,0,0,0.1)]">Aktion</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {watchlistStocks.length === 0 ? (
                                    <tr>
                                        <td colSpan={9} className="text-center py-12 text-muted-foreground">
                                            <div className="flex flex-col items-center gap-2">
                                                <div className="p-3 bg-muted rounded-full">
                                                    <Eye className="size-6 opacity-50" />
                                                </div>
                                                <p className="font-medium">Noch keine Aktien auf der Watchlist.</p>
                                                <button
                                                    onClick={() => navigate('/calculator?mode=new&from=watchlist')}
                                                    className="text-primary hover:underline text-sm"
                                                >
                                                    Jetzt hinzufügen
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    watchlistStocks.map((stock) => {
                                        // Valuation Logic
                                        const hasTarget = !!stock.targetPrice;
                                        const isUndervalued = hasTarget && stock.currentPrice <= (stock.targetPrice || 0);
                                        const overvaluationPercent = hasTarget ? ((stock.currentPrice - (stock.targetPrice || 0)) / (stock.targetPrice || 1)) * 100 : 0;

                                        return (
                                            <tr key={stock.id} className="hover:bg-muted/50 transition-colors group">
                                                <td className="py-3 px-4 sticky left-0 z-20 group-hover:bg-muted/30 transition-colors shadow-[5px_0_5px_-5px_rgba(0,0,0,0.1)] min-w-[140px] align-top">
                                                    <div className="absolute inset-0 bg-card -z-10" />
                                                    <div className="relative flex items-start gap-3">
                                                        <div
                                                            className="cursor-pointer hover:scale-110 transition-transform p-1 -m-1"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                navigate('/portfolio');
                                                            }}
                                                            title="Zu den Positionen"
                                                        >
                                                            {stock.logoUrl ? (
                                                                <img
                                                                    src={stock.logoUrl}
                                                                    alt={stock.symbol}
                                                                    className="h-8 w-auto max-w-12 rounded-lg bg-white object-contain p-1 border border-border"
                                                                    onError={(e) => (e.currentTarget.style.display = 'none')}
                                                                />
                                                            ) : (
                                                                <div className="size-8 rounded-full bg-muted flex items-center justify-center">
                                                                    <span className="font-bold text-xs">{stock.symbol.slice(0, 2)}</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                        <div>
                                                            <div
                                                                className="font-semibold cursor-pointer hover:text-primary transition-colors"
                                                                onClick={() => navigate(`/stock/${stock.id}`)}
                                                            >
                                                                {/* Smart Wrap: Prevent wrapping for short names (e.g. Swiss Re), allow for long names */}
                                                                {smartWrap(stock.name)}
                                                            </div>
                                                            <div className="text-xs text-muted-foreground">{stock.symbol}</div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="text-right py-3 px-2 sm:px-4 align-top">
                                                    <div className="flex flex-col items-end gap-1">
                                                        <span className="font-medium whitespace-nowrap">{formatCurrency(stock.currentPrice, stock.currency, false)}</span>
                                                        {stock.currency !== 'CHF' && (
                                                            <span className="font-medium whitespace-nowrap">
                                                                {formatCurrency(convertToCHF(stock.currentPrice, stock.currency), 'CHF', false)}
                                                            </span>
                                                        )}
                                                        {hasTarget && (
                                                            <div className="flex items-center justify-end gap-1.5 text-xs">
                                                                {isUndervalued ? (
                                                                    <>
                                                                        <div className="flex items-center gap-1 text-green-600 dark:text-green-400 font-medium">
                                                                            <div className="size-2 rounded-full bg-green-500 animate-pulse" />
                                                                            <span>{overvaluationPercent.toFixed(1)}%</span>
                                                                        </div>
                                                                        <span className="text-[10px] font-bold text-green-700 dark:text-green-300 bg-green-100 dark:bg-green-900/30 px-1.5 py-0.5 rounded">
                                                                            KAUFEN
                                                                        </span>
                                                                    </>
                                                                ) : (
                                                                    <div className="flex items-center gap-1 text-red-500 font-medium">
                                                                        <div className="size-2 rounded-full bg-red-500" />
                                                                        <span>+{overvaluationPercent.toFixed(1)}%</span>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="text-right py-3 px-4 font-medium align-top">
                                                    {hasTarget ? (
                                                        <div className="flex flex-col items-end gap-1">
                                                            <span className="font-medium whitespace-nowrap">{formatCurrency(stock.targetPrice || 0, stock.currency, false)}</span>
                                                            {stock.currency !== 'CHF' && (
                                                                <span className="font-medium whitespace-nowrap">
                                                                    {formatCurrency(convertToCHF(stock.targetPrice || 0, stock.currency), 'CHF', false)}
                                                                </span>
                                                            )}
                                                        </div>
                                                    ) : '-'}
                                                </td>
                                                <td className="text-right py-3 px-4 align-top">
                                                    <div className="flex flex-col items-end">
                                                        <span className="text-green-600 dark:text-green-400 font-medium">
                                                            {stock.dividendYield ? `${stock.dividendYield.toFixed(2)}%` : '-'}
                                                        </span>
                                                        {hasTarget && stock.dividendYield && stock.targetPrice && (
                                                            <span className="text-[10px] text-muted-foreground" title="Rendite bei Kauflimit">
                                                                Ziel: {((stock.dividendYield * stock.currentPrice) / stock.targetPrice).toFixed(2)}%
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="text-right py-3 px-4 align-top">
                                                    {stock.dividendAmount ? (
                                                        <div className="flex flex-col items-end gap-1">
                                                            <span className="font-medium whitespace-nowrap">{formatCurrency(stock.dividendAmount, stock.dividendCurrency || stock.currency, false)}</span>
                                                            {stock.currency !== 'CHF' && (
                                                                <span className="font-medium whitespace-nowrap">
                                                                    {formatCurrency(convertToCHF(stock.dividendAmount, stock.dividendCurrency || stock.currency), 'CHF', false)}
                                                                </span>
                                                            )}
                                                        </div>
                                                    ) : '-'}
                                                </td>
                                                <td className="text-right py-3 px-4 text-muted-foreground align-top">
                                                    {(() => {
                                                        const freqLabel = translateFrequency(stock.dividendFrequency);
                                                        const currentDiv = getCurrentDividendPeriod(stock);
                                                        if (currentDiv.periodLabel) {
                                                            return (
                                                                <div className="grid grid-cols-[auto_24px] gap-x-0.5 justify-end items-center">
                                                                    <span>{freqLabel}</span>
                                                                    <span className="px-1.5 py-0.5 text-xs uppercase font-medium bg-muted text-muted-foreground border border-border rounded justify-self-end">
                                                                        {currentDiv.periodLabel}
                                                                    </span>
                                                                </div>
                                                            );
                                                        }
                                                        return freqLabel;
                                                    })()}
                                                </td>
                                                <td className="text-right py-3 px-4 text-muted-foreground align-top">
                                                    {stock.dividendDates && stock.dividendDates.length > 0 ? (
                                                        <div className="grid grid-cols-[30px_70px] gap-x-1 justify-end items-center text-right text-sm">
                                                            {stock.dividendDates
                                                                .map((d, i) => ({ ...d, label: stock.dividendFrequency === 'semi-annually' ? `${i + 1}.` : `Q${i + 1}` }))
                                                                .filter(d => d.exDate)
                                                                .sort((a, b) => new Date(a.exDate).getTime() - new Date(b.exDate).getTime())
                                                                .map((d, idx) => {
                                                                    const dateObj = new Date(d.exDate);
                                                                    const dDays = Math.ceil((dateObj.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
                                                                    const isPast = dDays < 0;
                                                                    const isSoon = dDays >= 0 && dDays <= 14;
                                                                    const formattedDate = dateObj.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' });
                                                                    const colorClass = isPast ? "text-green-600 font-medium" : isSoon ? "text-orange-500 font-medium" : "";

                                                                    return (
                                                                        <Fragment key={idx}>
                                                                            <span className="px-1.5 py-0.5 text-xs uppercase font-medium bg-muted text-muted-foreground border border-border rounded justify-self-end">
                                                                                {d.label}
                                                                            </span>
                                                                            <span className={colorClass + " whitespace-nowrap tabular-nums"}>
                                                                                {formattedDate}
                                                                            </span>
                                                                        </Fragment>
                                                                    );
                                                                })}
                                                        </div>
                                                    ) : (
                                                        <div className={(() => {
                                                            const dDays = stock.dividendExDate ? Math.ceil((new Date(stock.dividendExDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)) : null;
                                                            if (dDays !== null && dDays < 0) return "text-sm whitespace-nowrap text-green-600 font-medium"; // Past -> Green
                                                            if (dDays !== null && dDays >= 0 && dDays <= 14) return "text-sm whitespace-nowrap text-orange-500 font-medium"; // Soon -> Orange
                                                            return "text-sm whitespace-nowrap";
                                                        })()}>
                                                            {stock.dividendExDate ? new Date(stock.dividendExDate).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '-'}
                                                        </div>
                                                    )
                                                    }
                                                </td>
                                                <td className="text-right py-3 px-4 text-muted-foreground align-top">
                                                    {stock.dividendDates && stock.dividendDates.length > 0 ? (
                                                        <div className="grid grid-cols-[30px_70px] gap-x-1 justify-end items-center text-right text-sm">
                                                            {stock.dividendDates
                                                                .map((d, i) => ({ ...d, label: stock.dividendFrequency === 'semi-annually' ? `${i + 1}.` : `Q${i + 1}` }))
                                                                .filter(d => d.payDate)
                                                                .sort((a, b) => new Date(a.payDate).getTime() - new Date(b.payDate).getTime())
                                                                .map((d, idx) => {
                                                                    const dateObj = new Date(d.payDate);
                                                                    const payDays = Math.ceil((dateObj.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));

                                                                    let exDays = null;
                                                                    if (d.exDate) {
                                                                        exDays = Math.ceil((new Date(d.exDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
                                                                    }

                                                                    const isPast = payDays < 0;
                                                                    // Orange if Ex-Date passed AND Pay-Date future, OR if Pay-Date almost here
                                                                    const isPending = (exDays !== null && exDays < 0 && payDays >= 0) || (payDays >= 0 && payDays <= 14);

                                                                    const formattedDate = dateObj.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' });
                                                                    const colorClass = isPast ? "text-green-600 font-medium" : isPending ? "text-orange-500 font-medium" : "";

                                                                    return (
                                                                        <Fragment key={idx}>
                                                                            <span className="px-1.5 py-0.5 text-xs uppercase font-medium bg-muted text-muted-foreground border border-border rounded justify-self-end">
                                                                                {d.label}
                                                                            </span>
                                                                            <span className={colorClass + " whitespace-nowrap tabular-nums"}>
                                                                                {formattedDate}
                                                                            </span>
                                                                        </Fragment>
                                                                    );
                                                                })}
                                                        </div>
                                                    ) : (
                                                        <div className={(() => {
                                                            const payDays = stock.dividendPayDate ? Math.ceil((new Date(stock.dividendPayDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)) : null;
                                                            const exDays = stock.dividendExDate ? Math.ceil((new Date(stock.dividendExDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)) : null;

                                                            // Past -> Green
                                                            if (payDays !== null && payDays < 0) return "text-sm whitespace-nowrap text-green-600 font-medium";

                                                            // Ex-Date passed + Pay-Date future -> Orange
                                                            if (exDays !== null && exDays < 0 && payDays !== null && payDays >= 0) return "text-sm whitespace-nowrap text-orange-500 font-medium";

                                                            // Soon -> Orange
                                                            if (payDays !== null && payDays >= 0 && payDays <= 14) return "text-sm whitespace-nowrap text-orange-500 font-medium";

                                                            return "text-sm whitespace-nowrap";
                                                        })()}>
                                                            {stock.dividendPayDate ? new Date(stock.dividendPayDate).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '-'}
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="px-1 py-3 text-center sticky right-0 z-20 group-hover:bg-muted/30 transition-colors shadow-[-5px_0_5px_-5px_rgba(0,0,0,0.1)]">
                                                    <div className="absolute inset-0 bg-card -z-10" />
                                                    <div className="relative flex items-center justify-center gap-0 sm:gap-1 opacity-100 transition-opacity">
                                                        <button
                                                            onClick={() => navigate(`/calculator?stock=${stock.id}&from=watchlist`)}
                                                            className="p-1.5 sm:p-2 hover:bg-green-500/10 text-green-600 dark:text-green-400 rounded-lg transition-colors"
                                                            title="Kaufen (Simulation im Calculator)"
                                                        >
                                                            <ShoppingBag className="size-4" />
                                                        </button>
                                                        <button
                                                            onClick={() => navigate(`/dividends/edit/${stock.id}?from=watchlist`)}
                                                            className="p-1.5 sm:p-2 hover:bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-lg transition-colors"
                                                            title="Bearbeiten"
                                                        >
                                                            <Edit className="size-4" />
                                                        </button>
                                                        <button
                                                            onClick={() => {
                                                                if (confirm(`${stock.name} von der Watchlist entfernen?`)) {
                                                                    removeFromWatchlist(stock.id);
                                                                }
                                                            }}
                                                            className="p-1.5 sm:p-2 hover:bg-red-500/10 text-red-600 dark:text-red-400 rounded-lg transition-colors"
                                                            title="Aus Watchlist entfernen"
                                                        >
                                                            <Trash2 className="size-4" />
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
            </div>

            {/* Removed AddWatchlistStockModal as it's superseded by the calculator */}

            {/* Buy Modal */}
            <AddPositionModal
                isOpen={!!buyStock}
                onClose={() => setBuyStock(null)}
                stocks={stocks}
                preSelectedStock={buyStock}
                onAdd={(pos) => {
                    addPosition(pos);
                    // Remove from watchlist after buying
                    if (buyStock) {
                        removeFromWatchlist(buyStock.id);
                    }
                    setBuyStock(null);
                    // Optional: Navigate to portfolio or show success
                    // navigate('/portfolio');
                }}
            />
        </div >
    );
}
