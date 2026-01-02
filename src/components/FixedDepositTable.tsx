import { Landmark, Plus, Edit, Trash2 } from 'lucide-react';
import { usePortfolio } from '../context/PortfolioContext';
import { useCurrencyFormatter } from '../utils/currency';
import { cn } from '../utils';
import { Logo } from './Logo';

interface FixedDepositTableProps {
    searchTerm: string;
    setIsAddFixedDepositModalOpen: (open: boolean) => void;
    setEditingFixedDeposit: (deposit: any) => void;
}

export function FixedDepositTable({ searchTerm, setIsAddFixedDepositModalOpen, setEditingFixedDeposit }: FixedDepositTableProps) {
    const { fixedDeposits, deleteFixedDeposit } = usePortfolio();
    const { formatCurrency } = useCurrencyFormatter();

    const filteredFixedDeposits = fixedDeposits?.filter(fd =>
        fd.accountType !== 'vorsorge' && (
            fd.bankName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (fd.notes && fd.notes.toLowerCase().includes(searchTerm.toLowerCase()))
        )) || [];

    return (
        <div className="space-y-3">
            <div className="flex items-center gap-2">
                <Landmark className="size-6 text-primary" />
                <h2 className="text-xl font-bold tracking-tight">Bankguthaben</h2>
                <span className="text-sm font-mono bg-muted px-2 py-0.5 rounded-full text-muted-foreground">{filteredFixedDeposits.length} Konten</span>
                <button
                    onClick={() => setIsAddFixedDepositModalOpen(true)}
                    className="ml-auto flex items-center gap-1 text-xs bg-primary/10 hover:bg-primary/20 text-primary px-2 py-1 rounded transition-colors"
                >
                    <Plus className="size-3" />
                    <span>Konto hinzufügen</span>
                </button>
            </div>
            <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-muted/50 text-muted-foreground text-xs uppercase tracking-wider font-semibold border-b border-border">
                            <tr>
                                <th className="px-4 py-3 sticky left-0 z-20 bg-card shadow-[5px_0_5px_-5px_rgba(0,0,0,0.1)] w-[180px] lg:w-[250px] min-w-[180px] lg:min-w-[250px] max-w-[180px] lg:max-w-[250px]">Bank / Institut</th>
                                <th className="px-4 py-3 w-[130px] lg:w-[150px] min-w-[130px] lg:min-w-[150px] max-w-[130px] lg:max-w-[150px]">Konto-Typ</th>
                                <th className="px-4 py-3 text-right whitespace-nowrap min-w-[120px]">Betrag</th>
                                <th className="px-4 py-3 text-right min-w-[100px]">Zins p.a.</th>
                                <th className="px-4 py-3 text-right whitespace-nowrap min-w-[120px]">Jährlicher Ertrag</th>
                                <th className="px-1 py-3 text-center sticky right-0 bg-card z-50 w-[60px] min-w-[60px] max-w-[60px] shadow-[-5px_0_5px_-5px_rgba(0,0,0,0.1)]">Aktion</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {filteredFixedDeposits.map((fd) => {
                                const interestAmount = fd.amount * (fd.interestRate / 100);

                                // Calculate Annual Fee
                                let annualFee = 0;
                                if (fd.monthlyFee && fd.monthlyFee > 0) {
                                    if (fd.feeFrequency === 'annually') annualFee = fd.monthlyFee;
                                    else if (fd.feeFrequency === 'quarterly') annualFee = fd.monthlyFee * 4;
                                    else annualFee = fd.monthlyFee * 12; // Default to monthly
                                }

                                const netAnnualReturn = interestAmount - annualFee;
                                const isNegative = netAnnualReturn < 0;

                                return (
                                    <tr key={fd.id} className="group hover:bg-muted/30 transition-colors">
                                        <td className="px-4 py-3 font-medium sticky left-0 z-10 group-hover:bg-muted/30 transition-colors shadow-[5px_0_5px_-5px_rgba(0,0,0,0.1)]">
                                            <div className="absolute inset-0 bg-card -z-10" />
                                            <div className="relative flex items-center gap-3">
                                                <Logo
                                                    url={fd.logoUrl}
                                                    alt={fd.bankName}
                                                    fallback={fd.bankName.slice(0, 2).toUpperCase()}
                                                />
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-semibold whitespace-pre-line">{fd.bankName}</span>
                                                    {fd.iban && <span className="text-xs font-mono text-muted-foreground hidden lg:block">{fd.iban}</span>}
                                                    {fd.notes && <span className="text-xs text-muted-foreground italic mt-0.5">{fd.notes}</span>}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className={cn(
                                                "px-2 py-0.5 rounded-md text-xs font-medium border",
                                                fd.accountType === 'sparkonto'
                                                    ? "bg-blue-100 text-blue-900 border-blue-300 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-900/50"
                                                    : "bg-gray-50 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700"
                                            )}>
                                                {fd.accountType === 'sparkonto' ? 'Sparkonto' : 'Privatkonto'}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-right font-medium text-foreground whitespace-nowrap">
                                            {formatCurrency(fd.amount, fd.currency)}
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <span className={cn(
                                                "px-2 py-0.5 rounded-full text-xs font-medium border",
                                                fd.interestRate > 0
                                                    ? "bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-900/50"
                                                    : "bg-gray-100 text-gray-500 border-gray-200 dark:bg-gray-800 dark:text-gray-500 dark:border-gray-700"
                                            )}>
                                                {fd.interestRate.toFixed(2)}%
                                            </span>
                                        </td>
                                        <td className={cn(
                                            "px-4 py-3 text-right font-medium whitespace-nowrap",
                                            isNegative ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400"
                                        )}>    {isNegative ? '-' : '+'}CHF {Math.abs(netAnnualReturn).toLocaleString('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </td>
                                        <td className="px-1 py-3 w-[60px] min-w-[60px] max-w-[60px] sticky right-0 z-40 group-hover:bg-muted/30 transition-colors shadow-[-5px_0_5px_-5px_rgba(0,0,0,0.1)]">
                                            <div className="absolute inset-0 bg-card -z-10" />
                                            <div className="relative flex items-center justify-center gap-1">
                                                <button
                                                    onClick={() => {
                                                        setEditingFixedDeposit(fd);
                                                        setIsAddFixedDepositModalOpen(true);
                                                    }}
                                                    className="p-1 hover:bg-muted rounded text-primary transition-colors"
                                                    title="Bearbeiten"
                                                >
                                                    <Edit className="size-3.5" />
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        if (confirm(`Konto bei "${fd.bankName}" wirklich löschen?`)) {
                                                            deleteFixedDeposit(fd.id);
                                                        }
                                                    }}
                                                    className="text-muted-foreground hover:text-red-600 p-2 rounded-md hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors"
                                                    title="Löschen"
                                                >
                                                    <Trash2 className="size-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                )
                            })}
                            {filteredFixedDeposits.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">
                                        {searchTerm ? 'Keine Konten gefunden.' : 'Noch keine Bankguthaben erfasst.'}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
