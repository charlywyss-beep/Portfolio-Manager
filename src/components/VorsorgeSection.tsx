import { ShieldCheck, Edit, Trash2 } from 'lucide-react';
import { usePortfolio } from '../context/PortfolioContext';
import { useCurrencyFormatter } from '../utils/currency';
import { Logo } from './Logo';

interface VorsorgeSectionProps {
    searchTerm: string;
    setIsAddFixedDepositModalOpen: (open: boolean) => void;
    setEditingFixedDeposit: (deposit: any) => void;
}

export function VorsorgeSection({ searchTerm, setIsAddFixedDepositModalOpen, setEditingFixedDeposit }: VorsorgeSectionProps) {
    const { fixedDeposits, deleteFixedDeposit } = usePortfolio();
    const { formatCurrency } = useCurrencyFormatter();

    const vorsorgeDeposits = fixedDeposits?.filter(fd => fd.accountType === 'vorsorge') || [];

    if (vorsorgeDeposits.length === 0 && !searchTerm) return null;

    const filteredVorsorge = vorsorgeDeposits.filter(fd =>
        fd.bankName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (fd.notes && fd.notes.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    if (filteredVorsorge.length === 0 && searchTerm) return null;

    const totalVorsorge = vorsorgeDeposits.reduce((sum, fd) => sum + fd.amount, 0);

    return (
        <div className="space-y-3">
            <div className="flex items-center gap-2">
                <ShieldCheck className="size-6 text-primary" />
                <h2 className="text-xl font-bold tracking-tight">Vorsorge</h2>
            </div>

            <div className="bg-card border border-border rounded-xl p-3 shadow-sm">
                <div className="flex justify-between items-end mb-3 border-b border-border pb-2">
                    <div>
                        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Vorsorge Status</h3>
                        <p className="text-xs text-muted-foreground mt-1">Total über alle 3a Konten</p>
                    </div>
                    <div className="text-right">
                        <span className="text-xl font-bold block" style={{ color: '#ffffff' }}>
                            {totalVorsorge.toLocaleString('de-CH', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} CHF
                        </span>
                    </div>
                </div>
            </div>

            <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                        <thead className="bg-muted/50 text-muted-foreground text-xs uppercase tracking-wider font-semibold border-b border-border">
                            <tr>
                                <th className="px-2 py-3 sticky left-0 z-20 bg-card shadow-[5px_0_5px_-5px_rgba(0,0,0,0.1)] min-w-[200px]">Bank / Institut</th>
                                <th className="px-2 py-3 min-w-[100px]">Konto-Typ</th>
                                <th className="px-4 py-3 text-right min-w-[120px]">Vorsorgevermögen</th>
                                <th className="px-4 py-3 min-w-[200px]">Fortschritt 2025</th>
                                <th className="px-1 py-3 text-center sticky right-0 bg-card z-10 w-[60px] shadow-[-5px_0_5px_-5px_rgba(0,0,0,0.1)]">Aktion</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {filteredVorsorge.map(fd => {
                                const limit = 7258;
                                // Calculate current based on manual or auto
                                const currentMonth = new Date().getMonth() + 1;
                                const calculatedAuto = fd.autoContribution && fd.monthlyContribution
                                    ? fd.monthlyContribution * currentMonth
                                    : 0;

                                const current = fd.autoContribution
                                    ? Math.min(limit, calculatedAuto)
                                    : (fd.currentYearContribution || 0);

                                const percent = Math.min((current / limit) * 100, 100);

                                return (
                                    <tr key={fd.id} className="group hover:bg-muted/30 transition-colors">
                                        <td className="px-2 py-3 font-medium sticky left-0 z-10 group-hover:bg-muted/30 transition-colors shadow-[5px_0_5px_-5px_rgba(0,0,0,0.1)]">
                                            <div className="absolute inset-0 bg-card -z-10" />
                                            <div className="relative flex items-center gap-3">
                                                <Logo
                                                    url={fd.logoUrl}
                                                    alt={fd.bankName}
                                                    fallback={
                                                        fd.accountType === 'vorsorge' ? '3a' : fd.bankName.slice(0, 2).toUpperCase()
                                                    }
                                                    className={fd.accountType === 'vorsorge' ? "bg-blue-100 text-blue-700 border-blue-200" : undefined}
                                                />
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-semibold">{fd.bankName}</span>
                                                    {fd.iban && <span className="text-xs font-mono text-muted-foreground">{fd.iban}</span>}
                                                    {fd.notes && <span className="text-xs text-muted-foreground italic mt-0.5">{fd.notes}</span>}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-2 py-3">
                                            <span className="px-2 py-0.5 rounded-md text-xs font-medium border bg-blue-100 text-blue-900 border-blue-300 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-900/50">
                                                Vorsorge 3a
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-right font-medium">
                                            <span style={{ color: '#ffffff' }}>
                                                {fd.amount.toLocaleString('de-CH', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} CHF
                                            </span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex flex-col gap-1.5">
                                                <div className="flex justify-between text-xs font-medium">
                                                    <span>
                                                        <span className="!text-white">{current.toLocaleString('de-CH', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span> <span className="text-[10px] uppercase text-muted-foreground ml-1">von {limit.toLocaleString('de-CH', { minimumFractionDigits: 0 })}</span>
                                                    </span>
                                                </div>
                                                <div className="h-2.5 w-full bg-green-100 dark:bg-green-900/30 rounded-full overflow-hidden border border-green-200 dark:border-green-800">
                                                    <div
                                                        className="h-full bg-green-600 dark:bg-green-500 rounded-full transition-all duration-500 w-[var(--width)]"
                                                        style={{ '--width': `${percent}%` } as React.CSSProperties}
                                                    />
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-1 py-3 sticky right-0 z-10 group-hover:bg-muted/30 transition-colors shadow-[-5px_0_5px_-5px_rgba(0,0,0,0.1)]">
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
                                                        if (confirm(`Konto bei "${fd.bankName}" wirklich löschen?`)) deleteFixedDeposit(fd.id);
                                                    }}
                                                    className="text-muted-foreground hover:text-red-600 p-2 rounded-md hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors"
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
        </div>
    );
}
