import { useNavigate } from 'react-router-dom';
import { usePortfolio } from '../context/PortfolioContext';
import { Calendar, TrendingUp, Plus, Edit, Trash2 } from 'lucide-react';
import { Logo } from '../components/Logo';

import { useCurrencyFormatter } from '../utils/currency';
import { getCurrentDividendPeriod } from '../utils/dividend';

// Helper to translate frequency to German
const translateFrequency = (freq?: string) => {
    switch (freq) {
        case 'quarterly': return 'p.Q.';
        case 'semi-annually': return 'Halbjährlich';
        case 'annually': return 'Jährlich';
        case 'monthly': return 'Monatlich';
        default: return 'Jährlich';
    }
};

export function DividendPlanner() {
    const navigate = useNavigate();
    const { stocks, positions, fixedDeposits, deleteFixedDeposit } = usePortfolio();
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

            {/* Main Dividend Table */}
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
                    <table className="w-full min-w-[1000px]">
                        <thead>
                            <tr className="border-b border-border">
                                <th className="text-left py-3 px-4 font-semibold">Aktie</th>
                                <th className="text-right py-3 px-4 font-semibold">Anteile</th>
                                <th className="text-right py-3 px-4 font-semibold">Rendite %</th>
                                <th className="text-right py-3 px-4 font-semibold">Betrag/Aktie</th>
                                <th className="text-right py-3 px-4 font-semibold">Frequenz</th>
                                <th className="text-right py-3 px-4 font-semibold">Quartalsweise</th>
                                <th className="text-right py-3 px-4 font-semibold">Jährlich</th>
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
                                projectedDividends.map((data: any) => {
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
                                                <div className="flex items-center gap-3">
                                                    <Logo
                                                        url={stock.logoUrl}
                                                        alt={stock.name}
                                                        fallback={stock.symbol.slice(0, 2)}
                                                    />
                                                    <div>
                                                        <div
                                                            className="font-semibold cursor-pointer hover:text-primary transition-colors"
                                                            onClick={() => navigate(`/stock/${stock.id}`)}
                                                        >
                                                            {stock.name}
                                                        </div>
                                                        <div className="text-xs text-muted-foreground">{stock.symbol}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="text-right py-3 px-4">{position.shares}</td>
                                            <td className="text-right py-3 px-4 text-green-600 dark:text-green-400 font-medium">
                                                {stock.dividendYield?.toFixed(2)}%
                                            </td>
                                            <td className="text-right py-3 px-4 font-medium">
                                                {stock.dividendAmount ? (
                                                    divCurrency !== 'CHF' ? (
                                                        <div className="flex flex-col items-end">
                                                            <span>{formatCurrency(stock.dividendAmount, divCurrency)}</span>
                                                            <span className="text-xs text-muted-foreground font-normal">
                                                                {formatCurrency(convertToCHF(stock.dividendAmount, divCurrency), 'CHF')}
                                                            </span>
                                                        </div>
                                                    ) : (
                                                        `${stock.dividendAmount.toLocaleString('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} CHF`
                                                    )
                                                ) : '-'}
                                            </td>
                                            <td className="text-right py-3 px-4 text-muted-foreground">
                                                {translateFrequency(stock.dividendFrequency)}
                                                {currentDiv.periodLabel && (
                                                    <span className="ml-2 px-1.5 py-0.5 text-[10px] uppercase font-bold bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 rounded">
                                                        {currentDiv.periodLabel}
                                                    </span>
                                                )}
                                            </td>
                                            <td className="text-right py-3 px-4 text-muted-foreground">
                                                {stock.dividendFrequency !== 'annually' ? `CHF ${quarterlyDividendCHF.toFixed(2)}` : ''}
                                            </td>
                                            <td className="text-right py-3 px-4 font-semibold text-primary">
                                                {annualDisplay}
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

            {/* Bank Accounts Section */}
            {bankRows.length > 0 && (
                <div className="bg-card rounded-xl border shadow-sm overflow-hidden animate-in slide-in-from-bottom-4 duration-700">
                    <div className="flex items-center justify-between p-4 border-b bg-muted/30">
                        <h2 className="text-lg font-semibold">Bank Erträge & Gebühren</h2>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[1000px]">
                            <thead>
                                <tr className="border-b border-border">
                                    <th className="text-left py-3 px-4 font-semibold">Bank / Institut</th>
                                    <th className="text-right py-3 px-4 font-semibold">Betrag</th>
                                    <th className="text-right py-3 px-4 font-semibold">Zins %</th>
                                    <th className="text-right py-3 px-4 font-semibold">Ø Monatlich</th>
                                    <th className="text-right py-3 px-4 font-semibold">Frequenz</th>
                                    <th className="text-right py-3 px-4 font-semibold">Quartalsweise</th>
                                    <th className="text-right py-3 px-4 font-semibold">Jährlich</th>
                                    <th className="text-right py-3 px-4 w-24 sticky right-0 bg-card z-10 shadow-[-5px_0_5px_-5px_rgba(0,0,0,0.1)]">Aktionen</th>
                                </tr>
                            </thead>
                            <tbody>
                                {bankRows.map((data: any) => {
                                    const isNegative = data.isNegative;
                                    return (
                                        <tr key={data.id} className="border-b border-border last:border-0 hover:bg-muted/50 transition-colors group">
                                            <td className="py-3 px-4">
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
                                            <td className="text-right py-3 px-4 text-muted-foreground">
                                                CHF {data.depositAmount?.toLocaleString('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </td>
                                            <td className="text-right py-3 px-4 text-muted-foreground">
                                                {data.yield > 0 ? `${data.yield.toFixed(2)}%` : '-'}
                                            </td>
                                            <td className={`text-right py-3 px-4 font-medium ${isNegative ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                                                {isNegative ? '-' : '+'} {Math.abs(data.annual / 12).toLocaleString('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} CHF
                                            </td>
                                            <td className="text-right py-3 px-4 text-muted-foreground">
                                                Jährlich
                                            </td>
                                            <td className={`text-right py-3 px-4 ${isNegative ? 'text-red-600/70' : 'text-green-600/70'}`}>
                                                {isNegative ? '-' : '+'} CHF {Math.abs(data.quarterly).toLocaleString('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </td>
                                            <td className={`text-right py-3 px-4 font-semibold ${isNegative ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
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
            )}
        </div>
    );
}
