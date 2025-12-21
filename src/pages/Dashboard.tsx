import { useNavigate } from 'react-router-dom';

import { useState, useEffect } from 'react';
import { usePortfolioData } from '../hooks/usePortfolioData';
import { usePortfolio } from '../context/PortfolioContext';
import { ArrowUpRight, ArrowDownRight, TrendingUp, DollarSign, BarChart3, Calendar, Info, Plus, Trash2, Edit, Bell } from 'lucide-react';
import { cn } from '../utils';
import { useCurrencyFormatter } from '../utils/currency';
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
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
                        <h3 className="text-xl lg:text-3xl font-bold mt-1 tracking-tight">
                            {totals.totalValue.toLocaleString('de-CH', { style: 'currency', currency: 'CHF' })}
                        </h3>
                        <p className={cn("text-sm mt-2 font-medium",
                            totals.gainLoss >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
                        )}>
                            {totals.gainLoss >= 0 ? '+' : ''}{totals.gainLoss.toLocaleString('de-CH', { style: 'currency', currency: 'CHF' })} Gewinn/Verlust
                        </p>

                        <div className="mt-4 pt-4 border-t border-border flex flex-col items-start gap-1 xl:flex-row xl:items-center xl:justify-between">
                            <span className="text-sm text-muted-foreground font-medium">Investiertes Kapital</span>
                            <span className="font-bold text-base tracking-tight">
                                {totals.totalCost.toLocaleString('de-CH', { style: 'currency', currency: 'CHF' })}
                            </span>
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
                        <h3 className="text-2xl lg:text-3xl font-bold mt-1 tracking-tight">
                            {totals.projectedYearlyDividends.toLocaleString('de-CH', { style: 'currency', currency: 'CHF' })}
                        </h3>
                        <p className="text-sm text-muted-foreground mt-2">
                            Ø {(totals.projectedYearlyDividends / 12).toLocaleString('de-CH', { style: 'currency', currency: 'CHF' })} / Monat
                        </p>
                    </div>
                </div>

                {/* Top Performer (Stats) */}
                <div className="p-6 rounded-xl bg-card border border-border shadow-sm">
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-2 rounded-lg bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400">
                            <TrendingUp className="size-6" />
                        </div>
                    </div>
                    <div>
                        <p className="text-sm text-muted-foreground font-medium">Top Performer</p>
                        {positions.length > 0 ? (
                            <>
                                <h3
                                    className="text-xl font-bold mt-1 tracking-tight truncate cursor-pointer hover:text-primary transition-colors"
                                    onClick={() => navigate(`/stock/${positions.sort((a, b) => b.gainLossPercent - a.gainLossPercent)[0]?.stock.id}`)}
                                >
                                    {positions.sort((a, b) => b.gainLossPercent - a.gainLossPercent)[0]?.stock.name}
                                </h3>
                                <p className="text-sm text-green-600 dark:text-green-400 mt-2 font-medium">
                                    +{positions.sort((a, b) => b.gainLossPercent - a.gainLossPercent)[0]?.gainLossPercent.toFixed(2)}% ({convertToCHF(positions.sort((a, b) => b.gainLossPercent - a.gainLossPercent)[0]?.gainLoss, positions.sort((a, b) => b.gainLossPercent - a.gainLossPercent)[0]?.stock.currency).toLocaleString('de-CH', { style: 'currency', currency: 'CHF' })})
                                </p>
                            </>
                        ) : (
                            <span className="text-sm text-muted-foreground">Keine Daten</span>
                        )}
                    </div>
                </div>
            </div>

            {/* Reordered: Dividends & Watchlist */}
            <div className="grid grid-cols-1 lg:grid-cols-7 gap-6">
                {/* Upcoming Dividends List */}
                <div className="col-span-1 lg:col-span-3 p-6 rounded-xl bg-card border border-border shadow-sm">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="text-lg font-bold">Nächste Dividenden Auszahlungen</h3>
                        <Calendar className="size-5 text-muted-foreground" />
                    </div>
                    <div className="space-y-4">
                        {upcomingDividends.map((div, idx) => {
                            const daysToEx = div.exDate ? Math.ceil((new Date(div.exDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)) : null;
                            const showExWarning = daysToEx !== null && daysToEx >= 0 && daysToEx <= 7;

                            return (
                                <div
                                    key={idx}
                                    onClick={() => navigate('/dividends')}
                                    className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
                                >
                                    <div className="flex items-center gap-3">
                                        {div.stock?.logoUrl && (
                                            <img
                                                src={div.stock.logoUrl}
                                                alt={div.stock.name}
                                                className="size-8 rounded-full bg-white object-contain p-1 border border-border"
                                                onError={(e) => (e.currentTarget.style.display = 'none')}
                                            />
                                        )}
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <p className="font-bold text-lg">{div.stock.symbol}</p>
                                                {showExWarning && (
                                                    <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 text-xs font-medium" title={`Ex-Datum am ${new Date(div.exDate!).toLocaleDateString('de-DE')}`}>
                                                        <Bell className="size-3" />
                                                        <span>Ex in {daysToEx} Tagen</span>
                                                    </div>
                                                )}
                                            </div>
                                            <p className="text-base text-muted-foreground">{new Date(div.payDate).toLocaleDateString('de-DE')}</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="font-bold text-xl text-green-600 dark:text-green-400">
                                            +{formatCurrency(div.amount, div.currency)}
                                        </p>
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
                        <div className="space-y-4 flex-1 overflow-y-auto max-h-[400px]">
                            {filteredWatchlistDividends.length > 0 ? (
                                filteredWatchlistDividends.map((item, idx) => {
                                    // Filter dates again for display based on selection
                                    const visibleDates = item.exDates.filter(date => {
                                        const diffTime = new Date(date).getTime() - new Date().getTime();
                                        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                                        return diffDays <= watchlistTimeframe;
                                    });

                                    return (
                                        <div key={idx} className="flex items-center justify-between p-3 rounded-lg bg-blue-50/50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/50 hover:bg-blue-100/50 transition-colors">
                                            <div className="flex items-center gap-3">
                                                {item.stock.logoUrl && (
                                                    <img
                                                        src={item.stock.logoUrl}
                                                        alt={item.stock.name}
                                                        className="size-8 rounded-full bg-white object-contain p-1 border border-blue-200"
                                                        onError={(e) => (e.currentTarget.style.display = 'none')}
                                                    />
                                                )}
                                                <div>
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <p className="font-bold text-lg text-foreground">{item.stock.symbol}</p>
                                                    </div>

                                                    {/* Dates Row - Horizontal Scroll if needed, or wrap */}
                                                    <div className="flex flex-wrap gap-2 mb-2">
                                                        {visibleDates.map((date, dIdx) => {
                                                            const daysToEx = Math.ceil((new Date(date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
                                                            return (
                                                                <div key={dIdx} className="px-2 py-0.5 rounded-md bg-white dark:bg-blue-950 border border-blue-300 dark:border-blue-700 shadow text-blue-800 dark:text-blue-400 text-xs font-bold whitespace-nowrap">
                                                                    Ex in {daysToEx} Tagen
                                                                </div>
                                                            );
                                                        })}
                                                    </div>

                                                    <div
                                                        onClick={() => navigate('/watchlist')}
                                                        className="block mt-1 px-2 py-0.5 w-fit rounded-md bg-white dark:bg-blue-950 border border-blue-200 dark:border-blue-700 shadow hover:bg-blue-50 dark:hover:bg-blue-900 transition-colors cursor-pointer"
                                                    >
                                                        <p className="text-sm text-blue-900 dark:text-blue-300 font-medium">{item.stock.name}</p>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex flex-col items-end">
                                                <div className="px-3 py-1 rounded-md bg-white dark:bg-blue-950 border border-blue-200 dark:border-blue-700 shadow text-center min-w-[70px]">
                                                    <p className="font-bold text-green-600 dark:text-green-400">
                                                        {item.stock.dividendYield ? `${item.stock.dividendYield.toFixed(2)}%` : '-'}
                                                    </p>
                                                    <p className="text-[10px] text-blue-700 dark:text-blue-400 uppercase tracking-wider">Rendite</p>
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
                <div className="p-6 rounded-xl bg-card border border-border shadow-sm">
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-2">
                            <Calendar className="size-5 text-blue-500" />
                            <h3 className="text-lg font-bold">Dividenden Kalender</h3>
                        </div>
                    </div>
                    <DividendCalendarChart />
                </div>

                {/* Asset Allocation */}
                <div className="p-6 rounded-xl bg-card border border-border shadow-sm">
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

                {/* History Section */}
                <div className="col-span-1 lg:col-span-7 p-6 rounded-xl bg-card border border-border shadow-sm">
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex flex-col gap-1 mt-2">
                            <div className="flex items-center justify-between gap-4 text-xs">
                                <span className="text-muted-foreground">Investiert (Aktien/ETF):</span>
                                <span className="font-medium text-foreground">
                                    {formatCurrency(totals.totalCostStock, 'CHF')}
                                </span>
                            </div>
                            <div className="flex items-center justify-between gap-4 text-xs">
                                <span className="text-muted-foreground">+ Bankguthaben:</span>
                                <span className="font-medium text-foreground">
                                    {formatCurrency(totals.totalValueBank, 'CHF')}
                                </span>
                            </div>
                            <div className="flex items-center justify-between gap-4 text-xs">
                                <span className="text-muted-foreground">+ Vorsorgekapital:</span>
                                <span className="font-medium text-foreground">
                                    {formatCurrency(totals.totalValueVorsorge, 'CHF')}
                                </span>
                            </div>
                            <div className="h-px bg-border my-0.5 opacity-50" />
                            <div className="flex items-center justify-between gap-4 text-xs opacity-75">
                                <span className="text-muted-foreground">Rechnerisch (Basis):</span>
                                <span className="font-medium text-foreground">
                                    {formatCurrency(totals.totalCostStock + totals.totalValueBank + totals.totalValueVorsorge, 'CHF')}
                                </span>
                            </div>
                        </div>
                        <button
                            onClick={() => setIsHistoryModalOpen(true)}
                            className="flex items-center gap-1 text-xs bg-primary/10 hover:bg-primary/20 text-primary px-3 py-1.5 rounded-md transition-colors font-medium"
                        >
                            <Plus className="size-3" />
                            <span>Eintrag hinzufügen</span>
                        </button>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        {/* Chart */}
                        <div className="lg:col-span-2">
                            <HistoryChart />
                        </div>

                        {/* History Table */}
                        <div className="overflow-hidden border border-border rounded-lg bg-background/50 overflow-x-auto">
                            <table className="w-full text-sm text-left min-w-[500px]">
                                <thead className="bg-muted/50 text-muted-foreground font-medium border-b border-border">
                                    <tr>
                                        <th className="px-3 py-2 text-xs w-[100px]">Datum</th>
                                        <th className="px-2 py-2 text-right text-xs text-blue-500 font-bold w-[18%]">Aktien</th>
                                        <th className="px-2 py-2 text-right text-xs text-violet-500 font-bold w-[18%]">ETFs</th>
                                        <th className="px-2 py-2 text-right text-xs text-green-500 font-bold w-[18%]">Bank</th>
                                        <th className="px-2 py-2 text-right text-xs font-bold w-[18%]">Gesamt</th>
                                        <th className="px-3 py-2 text-center w-[60px]"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                    {history.map((entry) => (
                                        <tr key={entry.id} className="hover:bg-muted/30 transition-colors group">
                                            <td className="px-3 py-2 font-medium text-xs whitespace-nowrap">
                                                {new Date(entry.date).toLocaleDateString('de-DE')}
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
                                            <td className="px-3 py-2 text-center">
                                                <div className="flex items-center justify-center gap-1 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
                                                    <button
                                                        onClick={() => {
                                                            setEditingHistoryEntry(entry);
                                                            setIsHistoryModalOpen(true);
                                                        }}
                                                        className="p-1.5 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded transition-colors"
                                                        title="Eintrag bearbeiten"
                                                        aria-label="Eintrag bearbeiten"
                                                    >
                                                        <Edit className="size-3" />
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            if (confirm('Historischen Eintrag löschen?')) deleteHistoryEntry(entry.id);
                                                        }}
                                                        className="p-1.5 text-muted-foreground hover:text-red-500 hover:bg-red-500/10 rounded transition-colors"
                                                        title="Eintrag löschen"
                                                        aria-label="Eintrag löschen"
                                                    >
                                                        <Trash2 className="size-3" />
                                                    </button>
                                                </div>
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
                                <BarChart data={chartData} margin={{ top: 5, right: 20, left: -20, bottom: 5 }}>
                                    <XAxis
                                        dataKey="name"
                                        tick={{ fill: 'currentColor', fontSize: 13, opacity: 0.7 }}
                                        tickLine={false}
                                        axisLine={false}
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
