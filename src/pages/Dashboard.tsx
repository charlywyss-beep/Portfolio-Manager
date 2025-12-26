
import { useNavigate } from 'react-router-dom';

import { useState, useEffect } from 'react';
import { usePortfolioData } from '../hooks/usePortfolioData';
import { usePortfolio } from '../context/PortfolioContext';
import { ArrowUpRight, ArrowDownRight, TrendingUp, DollarSign, BarChart3, Calendar, Info, Plus, Trash2, Edit, Bell } from 'lucide-react';
import { cn } from '../utils';
import { useCurrencyFormatter } from '../utils/currency';
import { smartWrap } from '../utils/text';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { HistoryChart } from '../components/HistoryChart';
import { AddHistoryEntryModal } from '../components/AddHistoryEntryModal';
// import { CurrencyChart } from '../components/CurrencyChart'; // Removed from dashboard
import { DividendCalendarChart } from '../components/DividendCalendarChart';
import { AssetAllocationChart } from '../components/AssetAllocationChart';
import { PieChart as PieChartIcon } from 'lucide-react';

// Helper to translate frequency to German
const translateFrequency = (freq?: string) => {
    switch (freq) {
        case 'quarterly': return 'Quartalsweise';
        case 'semi-annually': return 'Halbjährlich';
        case 'annually': return 'Jährlich';
        case 'monthly': return 'Monatlich';
        default: return 'Jährlich';
    }
};

export function Dashboard() {
    const navigate = useNavigate();
    const { totals, upcomingDividends, positions, upcomingWatchlistDividends, bankRisks } = usePortfolioData();
    const { history, deleteHistoryEntry } = usePortfolio();
    const { formatCurrency, convertToCHF } = useCurrencyFormatter();
    const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
    const [editingHistoryEntry, setEditingHistoryEntry] = useState<any>(null);
    const [hasMounted, setHasMounted] = useState(false);

    useEffect(() => {
        setHasMounted(true);
    }, []);
    const [watchlistTimeframe, setWatchlistTimeframe] = useState<number>(90); // Default 90 days
    const [upcomingTimeframe, setUpcomingTimeframe] = useState<number>(90); // Default 90 days



    // Prepare chart data: Top 5 Performers
    const chartData = positions
        .sort((a, b) => b.gainLossPercent - a.gainLossPercent)
        .slice(0, 5)
        .map(p => ({
            name: p.stock.symbol,
            gain: p.gainLossPercent,
            fullName: p.stock.name,
            valueCHF: convertToCHF(p.gainLoss, p.stock.currency)
        }));

    const CustomTooltip = ({ active, payload }: any) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-popover border border-border p-3 rounded-lg shadow-lg">
                    <p className="font-bold text-lg text-popover-foreground mb-1">{payload[0].payload.fullName}</p>
                    <p className={cn("text-base font-bold", payload[0].value >= 0 ? "text-green-500" : "text-red-500")}>
                        {payload[0].value >= 0 ? '+' : ''}{payload[0].value.toFixed(2)}%
                    </p>
                    <p className="text-sm text-muted-foreground">
                        {payload[0].payload.valueCHF.toLocaleString('de-CH', { style: 'currency', currency: 'CHF' })}
                    </p>
                </div>
            );
        }
        return null;
    };

    // NEW: Filter by selected timeframe (check if ANY date fits)
    const filteredWatchlistDividends = upcomingWatchlistDividends.filter(item => {
        return item.exDates.some(date => {
            const diffTime = new Date(date).getTime() - new Date().getTime();
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            return diffDays <= watchlistTimeframe;
        });
    });

    return (
        <div className="p-6 md:p-8 space-y-8 animate-in fade-in duration-500">
            {/* Risk Warnings */}
            {bankRisks.length > 0 && (
                <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-xl p-4 flex items-start gap-3">
                    <Info className="size-5 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                    <div className="space-y-1">
                        <h3 className="text-sm font-semibold text-amber-900 dark:text-amber-200">
                            Einlagensicherung Limit überschritten
                        </h3>
                        {bankRisks.map(risk => (
                            <p key={risk.bankName} className="text-xs text-amber-800 dark:text-amber-300">
                                <strong>{risk.bankName}</strong>: {formatCurrency(risk.total, 'CHF')}
                                <span className="opacity-75"> (Limit: 100'000 CHF)</span>
                            </p>
                        ))}
                        <p className="text-[10px] text-amber-700 dark:text-amber-400 pt-1">
                            Guthaben über 100'000 CHF pro Bank sind möglicherweise nicht durch die Einlagensicherung geschützt.
                        </p>
                    </div>
                </div>
            )}

            {/* Top Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {/* Total Value */}
                <div className="p-6 rounded-xl bg-card border border-border shadow-sm">
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-2 rounded-lg bg-primary/10 text-primary">
                            <DollarSign className="size-6" />
                        </div>
                        <span className={cn(
                            "flex items-center text-sm font-medium px-2 py-1 rounded-full",
                            totals.gainLoss >= 0 ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                        )}>
                            {totals.gainLoss >= 0 ? <ArrowUpRight className="size-4 mr-1" /> : <ArrowDownRight className="size-4 mr-1" />}
                            {totals.gainLossPercent.toFixed(2)}%
                        </span>
                    </div>
                    <div>
                        <p className="text-sm text-muted-foreground font-medium">Gesamtwert</p>
                        <h3 className="text-xl lg:text-2xl font-bold mt-1 tracking-tight">
                            {totals.totalValue.toLocaleString('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} CHF
                        </h3>
                        <p className={cn("text-sm mt-2 font-medium",
                            totals.gainLoss >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
                        )}>
                            {totals.gainLoss >= 0 ? '+' : ''}{totals.gainLoss.toLocaleString('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} CHF Gewinn/Verlust
                        </p>

                        <div className="mt-4 pt-4 border-t border-border flex flex-col gap-1">
                            <div className="flex items-center justify-between gap-4 text-sm">
                                <span className="text-muted-foreground">Aktien/ETF:</span>
                                <span className="font-medium text-foreground">
                                    {totals.totalValueStock.toLocaleString('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} CHF
                                </span>
                            </div>
                            <div className="flex items-center justify-between gap-4 text-sm">
                                <span className="text-muted-foreground">Bankguthaben:</span>
                                <span className="font-medium text-foreground">
                                    {totals.totalValueBank.toLocaleString('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} CHF
                                </span>
                            </div>
                            <div className="flex items-center justify-between gap-4 text-sm">
                                <span className="text-muted-foreground">Vorsorgekapital:</span>
                                <span className="font-medium text-white">
                                    {totals.totalValueVorsorge.toLocaleString('de-CH', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} CHF
                                </span>
                            </div>
                            <div className="h-px bg-border my-0.5 opacity-50" />
                            <div className="flex items-center justify-between gap-4 text-sm opacity-75">
                                <span className="text-muted-foreground">Total:</span>
                                <span className="font-medium text-foreground">
                                    {(totals.totalValueStock + totals.totalValueBank + totals.totalValueVorsorge).toLocaleString('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} CHF
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Projected Dividends */}
                <div className="p-6 rounded-xl bg-card border border-border shadow-sm">
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-2 rounded-lg bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
                            <TrendingUp className="size-6" />
                        </div>
                    </div>
                    <div>
                        <p className="text-sm text-muted-foreground font-medium">Erwartete Dividende (Jahr)</p>
                        <h3 className="text-xl lg:text-2xl font-bold mt-1 tracking-tight">
                            {totals.projectedYearlyDividends.toLocaleString('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} CHF
                        </h3>
                        <p className="text-base font-medium text-foreground mt-2">
                            Ø {(totals.projectedYearlyDividends / 12).toLocaleString('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} CHF / Monat
                        </p>
                    </div>
                </div>

                {/* Daily Performance (Replaces Top Performer Stock) */}
                <div className="p-6 rounded-xl bg-card border border-border shadow-sm">
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-2 rounded-lg bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400">
                            <TrendingUp className="size-6" />
                        </div>
                        <span className={cn(
                            "flex items-center text-sm font-medium px-2 py-1 rounded-full",
                            totals.dailyGain >= 0 ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                        )}>
                            {totals.dailyGain >= 0 ? <ArrowUpRight className="size-4 mr-1" /> : <ArrowDownRight className="size-4 mr-1" />}
                            {Math.abs(totals.dailyGainPercent).toFixed(2)}%
                        </span>
                    </div>
                    <div>
                        <p className="text-sm text-muted-foreground font-medium">Tagesperformance</p>
                        <h3 className={cn("text-xl lg:text-2xl font-bold mt-1 tracking-tight", totals.dailyGain >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400")}>
                            {totals.dailyGain >= 0 ? '+' : ''}{totals.dailyGain.toLocaleString('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} CHF
                        </h3>
                        <p className="text-sm text-muted-foreground mt-2">
                            seit gestern
                        </p>
                    </div>
                </div>

                {/* Top Performer ETF */}
                {/* Top Performers (ETF & Stock) */}
                <div className="p-6 rounded-xl bg-card border border-border shadow-sm">
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-2 rounded-lg bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400">
                            <TrendingUp className="size-6" />
                        </div>
                    </div>
                    <div>
                        {(() => {
                            const topEtf = positions
                                .filter(p => p.stock.type === 'etf')
                                .sort((a, b) => b.gainLossPercent - a.gainLossPercent)[0];

                            const topStock = positions
                                .filter(p => !p.stock.type || p.stock.type === 'stock')
                                .sort((a, b) => b.gainLossPercent - a.gainLossPercent)[0];

                            if (!topEtf && !topStock) {
                                return <span className="text-sm text-muted-foreground">Keine Daten</span>;
                            }

                            return (
                                <div className="space-y-4">
                                    {/* Top ETF */}
                                    {topEtf && (
                                        <div>
                                            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Top ETF</p>
                                            <h3
                                                className="text-lg font-bold mt-0.5 tracking-tight cursor-pointer hover:text-primary transition-colors truncate"
                                                onClick={() => navigate(`/stock/${topEtf.stock.id}`)}
                                                title={topEtf.stock.name}
                                            >
                                                {smartWrap(topEtf.stock.name)}
                                            </h3>
                                            <p className="text-sm text-green-600 dark:text-green-400 font-medium">
                                                +{topEtf.gainLossPercent.toFixed(2)}% ({convertToCHF(topEtf.gainLoss, topEtf.stock.currency).toLocaleString('de-CH', { style: 'currency', currency: 'CHF' })})
                                            </p>
                                        </div>
                                    )}

                                    {/* Divider if both exist */}
                                    {topEtf && topStock && <div className="h-px bg-border/50" />}

                                    {/* Top Stock */}
                                    {topStock && (
                                        <div>
                                            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Top Aktie</p>
                                            <h3
                                                className="text-lg font-bold mt-0.5 tracking-tight cursor-pointer hover:text-primary transition-colors truncate"
                                                onClick={() => navigate(`/stock/${topStock.stock.id}`)}
                                                title={topStock.stock.name}
                                            >
                                                {smartWrap(topStock.stock.name)}
                                            </h3>
                                            <p className="text-sm text-green-600 dark:text-green-400 font-medium">
                                                +{topStock.gainLossPercent.toFixed(2)}% ({convertToCHF(topStock.gainLoss, topStock.stock.currency).toLocaleString('de-CH', { style: 'currency', currency: 'CHF' })})
                                            </p>
                                        </div>
                                    )}
                                </div>
                            );
                        })()}
                    </div>
                </div>
            </div>

            {/* Reordered: Dividends & Watchlist */}
            <div className="grid grid-cols-1 lg:grid-cols-7 gap-6">
                {/* Upcoming Dividends List */}
                <div className="col-span-1 lg:col-span-3 p-3 md:p-6 rounded-xl bg-card border border-border shadow-sm">
                    <div className="flex items-center justify-between mb-4 md:mb-6">
                        <div className="flex items-center gap-3">
                            <h3 className="text-lg font-bold">Nächste Dividenden Auszahlungen</h3>
                            <Calendar className="size-5 text-muted-foreground" />
                        </div>
                        <select
                            value={upcomingTimeframe}
                            onChange={(e) => setUpcomingTimeframe(Number(e.target.value))}
                            className="text-xs px-2 py-1 rounded border border-border bg-background"
                            title="Zeitraum auswählen"
                            aria-label="Zeitraum auswählen"
                        >
                            <option value={90}>3 Monate</option>
                            <option value={180}>6 Monate</option>
                            <option value={270}>9 Monate</option>
                            <option value={365}>1 Jahr</option>
                        </select>
                    </div>
                    <div className="space-y-4 max-h-[500px] overflow-y-auto pr-1 md:pr-2">
                        {upcomingDividends
                            .filter(div => {
                                const diffTime = new Date(div.payDate).getTime() - new Date().getTime();
                                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                                return diffDays <= upcomingTimeframe;
                            })
                            .map((div, idx) => {
                                const daysToEx = div.exDate ? Math.ceil((new Date(div.exDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)) : null;
                                const showExWarning = daysToEx !== null && daysToEx >= 0;

                                return (
                                    <div
                                        key={idx}
                                        onClick={() => navigate('/dividends')}
                                        className="flex items-center justify-between p-2 md:p-3 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
                                    >
                                        <div className="flex items-center gap-2 md:gap-3">
                                            {div.stock?.logoUrl && (
                                                <img
                                                    src={div.stock.logoUrl}
                                                    alt={div.stock.name}
                                                    className="size-8 rounded-full bg-white object-contain p-1 border border-border"
                                                    onError={(e) => (e.currentTarget.style.display = 'none')}
                                                />
                                            )}
                                            <div>
                                                <p
                                                    className="font-bold text-lg leading-tight mb-1 cursor-pointer hover:text-primary transition-colors"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        navigate(`/stock/${div.stock.symbol}`);
                                                    }}
                                                >
                                                    {smartWrap(div.stock.name)}
                                                </p>
                                                <div className="flex flex-col gap-1 mt-1">
                                                    {showExWarning && (
                                                        <div className="flex items-center gap-2">
                                                            <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 text-xs font-bold shadow-sm whitespace-nowrap w-[110px] justify-center text-center flex-shrink-0" title={`Ex-Datum am ${new Date(div.exDate!).toLocaleDateString('de-DE')}`}>
                                                                <Bell className="size-3 flex-shrink-0" />
                                                                <span>Ex in {daysToEx} Tagen</span>
                                                            </div>
                                                            <span className="text-xs text-muted-foreground">{new Date(div.exDate!).toLocaleDateString('de-DE')}</span>
                                                        </div>
                                                    )}
                                                    <p className="text-xs font-medium text-muted-foreground">
                                                        Zahltag: {new Date(div.payDate).toLocaleDateString('de-DE')}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="text-right flex flex-col items-end gap-0.5">
                                            <div className="font-bold text-base sm:text-lg md:text-xl text-green-600 dark:text-green-400 whitespace-nowrap leading-tight">
                                                {formatCurrency(div.amount, div.currency, false)}
                                            </div>
                                            {div.currency !== 'CHF' && (
                                                <div className="font-bold text-sm sm:text-base md:text-lg text-green-600 dark:text-green-400 whitespace-nowrap leading-tight opacity-90">
                                                    {formatCurrency(convertToCHF(div.amount, div.currency), 'CHF', false)}
                                                </div>
                                            )}
                                            <p className="text-sm font-medium text-muted-foreground">{translateFrequency(div.stock.dividendFrequency)}</p>
                                        </div>
                                    </div>
                                )
                            })}
                        {upcomingDividends.length === 0 && <p className="text-sm text-muted-foreground">Keine anstehenden Dividenden.</p>}
                    </div>
                </div>

                {/* Watchlist Opportunities (Blue Info Cards) */}
                {upcomingWatchlistDividends.length > 0 && (
                    <div className="col-span-1 lg:col-span-4 p-6 rounded-xl bg-card border border-border shadow-sm">
                        <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center gap-3">
                                <h3 className="text-lg font-bold text-blue-800 dark:text-blue-400">Watchlist Chancen</h3>
                                <Info className="size-5 text-blue-500" />
                            </div>
                            <select
                                value={watchlistTimeframe}
                                onChange={(e) => setWatchlistTimeframe(Number(e.target.value))}
                                className="text-xs px-2 py-1 rounded border border-border bg-background"
                                title="Zeitraum auswählen"
                                aria-label="Zeitraum auswählen"
                            >
                                <option value={90}>3 Monate</option>
                                <option value={180}>6 Monate</option>
                                <option value={270}>9 Monate</option>
                                <option value={365}>1 Jahr</option>
                            </select>
                        </div>
                        <div className="space-y-4 flex-1 overflow-y-auto max-h-[500px]">
                            {filteredWatchlistDividends.length > 0 ? (
                                filteredWatchlistDividends.map((item, idx) => {
                                    // Filter dates again for display based on selection
                                    const visibleDates = item.exDates.filter(date => {
                                        const diffTime = new Date(date).getTime() - new Date().getTime();
                                        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                                        return diffDays <= watchlistTimeframe;
                                    });

                                    return (
                                        <div key={idx} className="flex items-center justify-between p-3 rounded-lg border border-transparent border-b-border hover:bg-muted/50 transition-colors">
                                            <div className="flex items-center gap-3">
                                                {item.stock.logoUrl && (
                                                    <img
                                                        src={item.stock.logoUrl}
                                                        alt={item.stock.name}
                                                        className="size-8 rounded-full bg-white object-contain p-1 border border-border cursor-pointer hover:opacity-80 transition-opacity"
                                                        onClick={() => navigate('/watchlist')}
                                                        onError={(e) => (e.currentTarget.style.display = 'none')}
                                                    />
                                                )}
                                                <div>
                                                    <p className="font-bold text-lg text-foreground cursor-pointer hover:text-primary transition-colors leading-tight mb-1" onClick={() => navigate(`/stock/${item.stock.symbol}`)}>
                                                        {item.stock.name}
                                                    </p>
                                                    <div className="flex flex-wrap flex-col items-start gap-1 mt-0.5">
                                                        {visibleDates.map((date, dIdx) => {
                                                            const daysToEx = Math.ceil((new Date(date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
                                                            // Find corresponding pay date
                                                            const dateObj = item.stock.dividendDates?.find(d => d.exDate === date);
                                                            const payDate = dateObj?.payDate || (item.stock.dividendExDate === date ? item.stock.dividendPayDate : null);

                                                            return (
                                                                <div key={dIdx} className="flex flex-col gap-0.5">
                                                                    <div className="flex items-center gap-2">
                                                                        <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 text-xs font-bold shadow-sm whitespace-nowrap w-[110px] justify-center text-center flex-shrink-0">
                                                                            <Bell className="size-3 flex-shrink-0" />
                                                                            <span>Ex in {daysToEx} Tagen</span>
                                                                        </div>
                                                                        <span className="text-xs font-medium text-muted-foreground">{new Date(date).toLocaleDateString('de-DE')}</span>
                                                                    </div>
                                                                    {payDate && (
                                                                        <p className="text-xs font-medium text-muted-foreground pl-1">
                                                                            Zahltag: {new Date(payDate).toLocaleDateString('de-DE')}
                                                                        </p>
                                                                    )}
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex flex-col items-end">
                                                <div className="px-3 py-1 text-center min-w-[80px]">
                                                    <p className="font-bold text-xl md:text-2xl text-green-600 dark:text-green-400">
                                                        {item.stock.dividendYield ? `${item.stock.dividendYield.toFixed(2)}% ` : '-'}
                                                    </p>
                                                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold mt-0.5">Rendite</p>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })
                            ) : (
                                <p className="text-sm text-muted-foreground text-center py-4">
                                    Keine Chancen im gewählten Zeitraum.
                                </p>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* NEW: Advanced Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Dividend Calendar */}
                {/* Dividend Calendar */}
                <div className="p-3 md:p-6 rounded-xl bg-card border border-border shadow-sm">
                    <div className="flex items-center justify-between mb-4 md:mb-6">
                        <div className="flex items-center gap-2">
                            <Calendar className="size-5 text-blue-500" />
                            <h3 className="text-lg font-bold">Dividenden Kalender</h3>
                        </div>
                    </div>
                    <DividendCalendarChart />
                </div>

                {/* Asset Allocation */}
                <div className="p-3 md:p-6 rounded-xl bg-card border border-border shadow-sm">
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-2">
                            <PieChartIcon className="size-5 text-purple-500" />
                            <h3 className="text-lg font-bold">Verteilung nach Sektor</h3>
                        </div>
                    </div>
                    <AssetAllocationChart />
                </div>
            </div>


            {/* Bottom Section: Dividends & Chart */}
            <div className="grid grid-cols-1 lg:grid-cols-7 gap-6">

                <div className="col-span-1 lg:col-span-7 p-6 rounded-xl bg-card border border-border shadow-sm">
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs text-muted-foreground">Investiert (Aktien/ETF):</span>
                            <span className="text-xs font-medium text-foreground">
                                {formatCurrency(totals.totalCostStock, 'CHF')}
                            </span>
                        </div>
                        <button
                            onClick={() => setIsHistoryModalOpen(true)}
                            className="flex items-center gap-1 text-xs bg-primary/10 hover:bg-primary/20 text-primary px-3 py-1.5 rounded-md transition-colors font-medium"
                        >
                            <Plus className="size-3" />
                            <span>Eintrag hinzufügen</span>
                        </button>
                    </div>

                    <div className="flex flex-col gap-8">
                        {/* Chart */}
                        <div className="w-full">
                            <HistoryChart />
                        </div>

                        {/* History Table */}
                        <div className="overflow-hidden border border-border rounded-lg bg-background/50 overflow-x-auto">
                            <table className="w-full text-sm text-left min-w-[500px]">
                                <thead className="bg-muted/50 text-muted-foreground font-medium border-b border-border">
                                    <tr>
                                        <th className="px-3 py-2 text-left text-xs w-[140px]">Datum</th>
                                        <th className="px-2 py-2 text-right text-xs text-blue-500 font-bold w-[20%]">Aktien</th>
                                        <th className="px-2 py-2 text-right text-xs text-violet-500 font-bold w-[20%]">ETFs</th>
                                        <th className="px-2 py-2 text-right text-xs text-green-500 font-bold w-[20%]">Bank</th>
                                        <th className="px-2 py-2 text-right text-xs font-bold w-[20%]">Gesamt</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                    {history.map((entry) => (
                                        <tr key={entry.id} className="hover:bg-muted/30 transition-colors group">
                                            <td className="px-3 py-2 font-medium text-xs whitespace-nowrap">
                                                <div className="flex items-center gap-3">
                                                    <div className="flex items-center gap-0.5">
                                                        <button
                                                            onClick={() => {
                                                                setEditingHistoryEntry(entry);
                                                                setIsHistoryModalOpen(true);
                                                            }}
                                                            className="p-1 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded transition-colors"
                                                            title="Eintrag bearbeiten"
                                                        >
                                                            <Edit className="size-3" />
                                                        </button>
                                                        <button
                                                            onClick={() => {
                                                                if (confirm('Historischen Eintrag löschen?')) deleteHistoryEntry(entry.id);
                                                            }}
                                                            className="p-1 text-muted-foreground hover:text-red-500 hover:bg-red-500/10 rounded transition-colors"
                                                            title="Eintrag löschen"
                                                        >
                                                            <Trash2 className="size-3" />
                                                        </button>
                                                    </div>
                                                    <span>{new Date(entry.date).toLocaleDateString('de-DE')}</span>
                                                </div>
                                            </td>
                                            <td className="px-2 py-2 text-right text-xs text-blue-500 font-medium">
                                                {entry.stockValue ? formatCurrency(entry.stockValue, 'CHF').replace('CHF', '') : '-'}
                                            </td>
                                            <td className="px-2 py-2 text-right text-xs text-violet-500 font-medium">
                                                {entry.etfValue ? formatCurrency(entry.etfValue, 'CHF').replace('CHF', '') : '-'}
                                            </td>
                                            <td className="px-2 py-2 text-right text-xs text-green-500 font-medium">
                                                {entry.cashValue ? formatCurrency(entry.cashValue, 'CHF').replace('CHF', '') : '-'}
                                            </td>
                                            <td className="px-2 py-2 text-right font-bold text-xs text-foreground whitespace-nowrap">
                                                {formatCurrency(entry.totalValue, 'CHF').replace('CHF', '')}
                                            </td>
                                        </tr>
                                    ))}
                                    {history.length === 0 && (
                                        <tr>
                                            <td colSpan={3} className="px-3 py-8 text-center text-muted-foreground text-xs">
                                                Keine Daten vorhanden.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>




                {/* Top 5 Performance Chart */}
                <div className="col-span-1 lg:col-span-7 p-6 rounded-xl bg-card border border-border shadow-sm flex flex-col min-h-[400px]">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="text-lg font-bold">Top 5 Performance</h3>
                        <BarChart3 className="size-5 text-muted-foreground" />
                    </div>
                    <div className="w-full h-[300px] min-h-[300px] min-w-0">
                        {hasMounted && chartData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%" debounce={100} minWidth={1} minHeight={1}>
                                <BarChart data={chartData} margin={{ top: 5, right: 20, left: -20, bottom: 40 }}>
                                    <XAxis
                                        dataKey="fullName"
                                        tick={({ x, y, payload }) => {
                                            const words = payload.value.split(' ');
                                            const lines = [];
                                            let currentLine = words[0];

                                            for (let i = 1; i < words.length; i++) {
                                                if ((currentLine + ' ' + words[i]).length < 15) {
                                                    currentLine += ' ' + words[i];
                                                } else {
                                                    lines.push(currentLine);
                                                    currentLine = words[i];
                                                }
                                            }
                                            lines.push(currentLine);
                                            // Limit to 2 lines
                                            if (lines.length > 2) {
                                                lines[1] = lines[1] + '...';
                                                lines.length = 2;
                                            }

                                            return (
                                                <g transform={`translate(${x},${y})`}>
                                                    {lines.map((line, index) => (
                                                        <text
                                                            key={index}
                                                            x={0}
                                                            y={0}
                                                            dy={16 + (index * 12)}
                                                            textAnchor="middle"
                                                            fill="currentColor"
                                                            fontSize={11}
                                                            opacity={0.7}
                                                        >
                                                            {line}
                                                        </text>
                                                    ))}
                                                </g>
                                            );
                                        }}
                                        tickLine={false}
                                        axisLine={false}
                                        interval={0}
                                    />
                                    <YAxis
                                        tick={{ fill: 'currentColor', fontSize: 13, opacity: 0.7 }}
                                        tickLine={false}
                                        axisLine={false}
                                        tickFormatter={(value) => `${value}%`}
                                    />
                                    <Tooltip content={<CustomTooltip />} cursor={{ fill: 'transparent', opacity: 0.1 }} />
                                    <Bar dataKey="gain" radius={[4, 4, 0, 0]}>
                                        {chartData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.gain >= 0 ? '#22c55e' : '#ef4444'} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
                                Keine Performance-Daten verfügbar
                            </div>
                        )}
                    </div>
                </div>


            </div >

            {/* Modals */}
            {editingHistoryEntry && (
                <AddHistoryEntryModal
                    isOpen={!!editingHistoryEntry}
                    onClose={() => setEditingHistoryEntry(null)}
                    editingEntry={editingHistoryEntry}
                    mode="edit"
                />
            )}
            <AddHistoryEntryModal
                isOpen={isHistoryModalOpen}
                onClose={() => {
                    setIsHistoryModalOpen(false);
                    setEditingHistoryEntry(null);
                }}
                editingEntry={editingHistoryEntry}
                currentTotals={{
                    totalValue: totals.totalValue,
                    stockValue: totals.stockValue,
                    etfValue: totals.etfValue,
                    cashValue: totals.cashValue
                }}
            />
        </div >
    );
}
