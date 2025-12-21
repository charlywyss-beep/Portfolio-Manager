import { useNavigate } from 'react-router-dom';
import { usePortfolio } from '../context/PortfolioContext';
import { Calendar, TrendingUp, Plus, Edit } from 'lucide-react';

import { useCurrencyFormatter } from '../utils/currency';
import { getCurrentDividendPeriod } from '../utils/dividend';

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

export function DividendPlanner() {
    const navigate = useNavigate();
    const { stocks, positions } = usePortfolio();
    const { formatCurrency, convertToCHF } = useCurrencyFormatter();

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

    const totalAnnual = projectedDividends.reduce((sum, d) => sum + d!.annualDividendCHF, 0);
    const totalMonthly = totalAnnual / 12;

    return (
        <div className="p-6 md:p-8 space-y-8 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                <div className="flex items-center gap-3">
                    <div className="p-3 rounded-xl bg-gradient-to-br from-green-500/20 to-emerald-500/20 text-green-600 dark:text-green-400">
                        <Calendar className="size-6" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">Dividenden Planer</h1>
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
                            CHF {totalAnnual.toLocaleString('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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

            {/* Table */}
            <div className="bg-card rounded-xl border shadow-sm overflow-hidden">
                <div className="flex items-center justify-between p-4 border-b bg-muted/30">
                    <h2 className="text-lg font-semibold">Erwartete Dividenden</h2>
                    <button
                        onClick={() => navigate('/dividends/add')}
                        className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 font-medium transition-colors"
                    >
                        <Plus className="size-4" />
                        Dividende hinzufügen
                    </button>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-border">
                                <th className="text-left py-3 px-4 font-semibold">Aktie</th>
                                <th className="text-right py-3 px-4 font-semibold">Anteile</th>
                                <th className="text-right py-3 px-4 font-semibold">Rendite %</th>
                                <th className="text-right py-3 px-4 font-semibold">Betrag/Aktie</th>
                                <th className="text-right py-3 px-4 font-semibold">Jährlich</th>
                                <th className="text-right py-3 px-4 font-semibold">Quartalsweise</th>
                                <th className="text-right py-3 px-4 font-semibold">Frequenz</th>
                                <th className="text-right py-3 px-4 font-semibold">Ex-Date</th>
                                <th className="text-right py-3 px-4 font-semibold">Pay-Date</th>
                                <th className="text-right py-3 px-4 w-24 sticky right-0 bg-card z-10 shadow-[-5px_0_5px_-5px_rgba(0,0,0,0.1)]">Aktionen</th>
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
                                projectedDividends.map((data) => {
                                    const { position, stock, annualDividendNative, annualDividendCHF, quarterlyDividendCHF, divCurrency } = data!;

                                    // Annual Display Logic
                                    let annualDisplay: React.ReactNode;
                                    if (divCurrency !== 'CHF') {
                                        const nativeFormatted = formatCurrency(annualDividendNative, divCurrency, false);
                                        const chfFormatted = formatCurrency(annualDividendCHF, 'CHF', false);

                                        annualDisplay = (
                                            <div className="flex flex-col items-end">
                                                <span>{nativeFormatted}</span>
                                                <span className="text-xs text-muted-foreground font-normal">{chfFormatted}</span>
                                            </div>
                                        );
                                    } else {
                                        annualDisplay = formatCurrency(annualDividendCHF, 'CHF', false);
                                    }

                                    const currentDiv = getCurrentDividendPeriod(stock);

                                    return (
                                        <tr key={position.id} className="border-b border-border last:border-0 hover:bg-muted/50 transition-colors group">
                                            <td className="py-3 px-4">
                                                <div
                                                    className="font-semibold cursor-pointer hover:text-primary transition-colors"
                                                    onClick={() => navigate(`/stock/${stock.id}`)}
                                                >
                                                    {stock.name}
                                                </div>
                                                <div className="text-xs text-muted-foreground">{stock.symbol}</div>
                                            </td>
                                            <td className="text-right py-3 px-4">{position.shares}</td>
                                            <td className="text-right py-3 px-4 text-green-600 dark:text-green-400 font-medium">
                                                {stock.dividendYield?.toFixed(2)}%
                                            </td>
                                            <td className="text-right py-3 px-4 font-medium">
                                                {stock.dividendAmount ? formatCurrency(stock.dividendAmount, divCurrency) : '-'}
                                            </td>
                                            <td className="text-right py-3 px-4 font-semibold text-primary">
                                                {annualDisplay}
                                            </td>
                                            <td className="text-right py-3 px-4 text-muted-foreground">
                                                CHF {quarterlyDividendCHF.toFixed(2)}
                                            </td>
                                            <td className="text-right py-3 px-4 text-muted-foreground">
                                                {translateFrequency(stock.dividendFrequency)}
                                                {currentDiv.periodLabel && (
                                                    <span className="ml-2 px-1.5 py-0.5 text-[10px] uppercase font-bold bg-muted rounded">
                                                        {currentDiv.periodLabel}
                                                    </span>
                                                )}
                                            </td>
                                            <td className="text-right py-3 px-4 text-muted-foreground">
                                                <div className="flex flex-col items-end gap-1">
                                                    <span>
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
                                                    <span>
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
                                            <td className="text-right py-3 px-4 sticky right-0 bg-card group-hover:bg-muted/50 transition-colors shadow-[-5px_0_5px_-5px_rgba(0,0,0,0.1)]">
                                                <button
                                                    onClick={() => navigate(`/dividends/edit/${stock.id}`)}
                                                    className="p-2 hover:bg-primary/10 text-primary rounded-lg transition-colors"
                                                    title="Bearbeiten"
                                                >
                                                    <Edit className="size-4" />
                                                </button>
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
    );
}
