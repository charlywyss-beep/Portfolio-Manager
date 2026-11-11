import { ShieldCheck, Edit, Trash2 } from 'lucide-react';
import { usePortfolio } from '../context/PortfolioContext';
import { Logo } from './Logo';
import { ConfirmModal } from './ConfirmModal';
import { useState } from 'react';
import { cn } from '../utils';

interface VorsorgeSectionProps {
    searchTerm: string;
    setIsAddFixedDepositModalOpen: (open: boolean) => void;
    setEditingFixedDeposit: (deposit: any) => void;
}

export function VorsorgeSection({ searchTerm, setIsAddFixedDepositModalOpen, setEditingFixedDeposit }: VorsorgeSectionProps) {
    const { fixedDeposits, deleteFixedDeposit } = usePortfolio();
    const [confirmDelete, setConfirmDelete] = useState<{ isOpen: boolean, fdId: string | null, name: string }>({ isOpen: false, fdId: null, name: '' });

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonthShort = now.toLocaleString('de-CH', { month: 'short' });

    const vorsorgeDeposits = fixedDeposits?.filter(fd => fd.accountType === 'vorsorge') || [];

    if (vorsorgeDeposits.length === 0 && !searchTerm) return null;

    const filteredVorsorge = vorsorgeDeposits.filter(fd =>
        fd.bankName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (fd.notes && fd.notes.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    if (filteredVorsorge.length === 0 && searchTerm) return null;

    const totalVorsorge = vorsorgeDeposits.reduce((sum, fd) => sum + fd.amount, 0);
    const totalVorsorgeInterest = vorsorgeDeposits.reduce((sum, fd) => sum + (fd.amount * (fd.interestRate || 0)) / 100, 0);

    return (
        <div className="flex-1 min-h-0 flex flex-col space-y-3 overflow-hidden">
            <div className="flex items-center gap-2 shrink-0">
                <ShieldCheck className="size-6 text-primary" />
                <h2 className="text-xl font-bold tracking-tight">Vorsorge</h2>
                <span className="text-sm font-mono bg-muted px-2 py-0.5 rounded-full text-muted-foreground">{vorsorgeDeposits.length} Konten</span>
            </div>

            <div className="bg-card border border-border rounded-xl p-3 shadow-sm shrink-0">
                <div className="flex justify-between items-end border-b border-border pb-2">
                    <div>
                        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Vorsorge Status</h3>
                        <p className="text-xs text-muted-foreground mt-1">Total über alle 3a Konten</p>
                    </div>
                    <div className="text-right">
                        <span className="text-xl font-bold block text-white">
                            {totalVorsorge.toLocaleString('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} CHF
                        </span>
                        {totalVorsorgeInterest > 0 && (
                            <span className="text-xs font-mono text-emerald-400 font-semibold block mt-0.5">
                                +{totalVorsorgeInterest.toLocaleString('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} CHF Zinsertrag p.a.
                            </span>
                        )}
                    </div>
                </div>
            </div>

            <div className="flex-1 min-h-0 flex flex-col rounded-xl border border-border bg-card shadow-sm overflow-hidden">
                <div className="overflow-auto flex-1 min-h-0 p-0 w-full">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-muted/50 text-muted-foreground text-xs uppercase tracking-wider font-semibold border-b border-border">
                            <tr>
                                <th className="px-4 py-3 sticky top-0 left-0 z-40 bg-card shadow-[5px_0_5px_-5px_rgba(0,0,0,0.1)] w-[180px] lg:w-[250px] min-w-[180px] lg:min-w-[250px] max-w-[180px] lg:max-w-[250px] align-middle">Bank / Institut</th>
                                <th className="px-4 py-3 sticky top-0 z-30 bg-card w-[120px] lg:w-[140px] min-w-[120px] lg:min-w-[140px] max-w-[120px] lg:max-w-[140px] align-middle">Konto-Typ</th>
                                <th className="px-4 py-3 sticky top-0 z-30 bg-card text-right whitespace-nowrap min-w-[140px] align-middle">Vorsorgekapital Stand {currentMonthShort} {currentYear}</th>
                                <th className="px-4 py-3 sticky top-0 z-30 bg-card text-right min-w-[100px] align-middle">Zins p.a.</th>
                                <th className="px-4 py-3 sticky top-0 z-30 bg-card text-right whitespace-nowrap min-w-[120px] align-middle">Jährlicher Ertrag</th>
                                <th className="px-4 py-3 sticky top-0 z-30 bg-card min-w-[280px] align-middle">Einzahlung {currentYear} Fortschritt</th>
                                <th className="text-center py-3 px-1 w-[60px] min-w-[60px] max-w-[60px] sticky top-0 md:sticky md:-right-px bg-card z-30 md:z-40 shadow-[-5px_0_5px_-5px_rgba(0,0,0,0.1)] align-middle">Aktion</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {filteredVorsorge.map(fd => {
                                // Offizieller gesetzlicher Säule 3a Jahresbeitrag 2026
                                const limit = 7258;

                                // Berechne aktuell basierend auf manuell oder auto
                                // Nur abgeschlossene Monate zählen (Januar = 0, wenn wir im Januar sind, z.B. Nov = 10 abgeschlossene Monate)
                                const completedMonths = now.getMonth();
                                const calculatedAuto = fd.autoContribution && fd.monthlyContribution
                                    ? fd.monthlyContribution * completedMonths
                                    : 0;

                                const current = fd.autoContribution
                                    ? Math.min(limit, calculatedAuto)
                                    : (fd.currentYearContribution || 0);

                                const percent = Math.min((current / limit) * 100, 100);

                                const interestAmount = fd.amount * ((fd.interestRate || 0) / 100);

                                // Jährliche Gebühren abziehen, falls vorhanden
                                let annualFee = 0;
                                if (fd.monthlyFee && fd.monthlyFee > 0) {
                                    if (fd.feeFrequency === 'annually') annualFee = fd.monthlyFee;
                                    else if (fd.feeFrequency === 'quarterly') annualFee = fd.monthlyFee * 4;
                                    else annualFee = fd.monthlyFee * 12;
                                }

                                const netAnnualReturn = interestAmount - annualFee;
                                const isNegative = netAnnualReturn < 0;

                                return (
                                    <tr key={fd.id} className="group hover:bg-muted/30 transition-colors">
                                        <td className="px-4 py-3 font-medium sticky -left-px z-10 group-hover:bg-muted/30 transition-colors shadow-[5px_0_5px_-5px_rgba(0,0,0,0.1)] align-middle w-[180px] lg:w-[250px] min-w-[180px] lg:min-w-[250px] max-w-[180px] lg:max-w-[250px]">
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
                                                    <span className="text-sm font-semibold whitespace-pre-line">{fd.bankName}</span>
                                                    {fd.iban && <span className="text-xs font-mono text-muted-foreground hidden lg:block">{fd.iban}</span>}
                                                    {fd.notes && <span className="text-xs text-muted-foreground italic mt-0.5">{fd.notes}</span>}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 align-middle w-[120px] lg:w-[140px] min-w-[120px]">
                                            <span className="px-2 py-0.5 rounded-md text-xs font-medium border bg-blue-100 text-blue-900 border-blue-300 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-900/50">
                                                Vorsorge 3a
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-right font-medium align-middle whitespace-nowrap min-w-[140px]">
                                            <span className="text-base font-bold text-white tracking-tight">
                                                {fd.amount.toLocaleString('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} CHF
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-right align-middle min-w-[100px]">
                                            <span className={cn(
                                                "px-2 py-0.5 rounded-full text-xs font-medium border font-mono",
                                                (fd.interestRate || 0) > 0
                                                    ? "bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-900/50"
                                                    : "bg-gray-100 text-gray-500 border-gray-200 dark:bg-gray-800 dark:text-gray-500 dark:border-gray-700"
                                            )}>
                                                {(fd.interestRate || 0).toFixed(2)}%
                                            </span>
                                        </td>
                                        <td className={cn(
                                            "px-4 py-3 text-right font-medium whitespace-nowrap align-middle min-w-[120px] font-mono",
                                            isNegative ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400"
                                        )}>
                                            {isNegative ? '-' : '+'}CHF {Math.abs(netAnnualReturn).toLocaleString('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </td>
                                        <td className="px-4 py-3 align-middle min-w-[280px]">
                                            <div className="flex flex-col gap-1.5 py-0.5 max-w-lg">
                                                <div className="flex justify-between items-baseline">
                                                    <span className="text-sm font-bold !text-white tracking-tight">
                                                        {current.toLocaleString('de-CH', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} CHF
                                                    </span>
                                                    <span className="text-xs font-mono font-semibold text-emerald-400">
                                                        {percent.toFixed(1)}%
                                                    </span>
                                                </div>
                                                <div className="h-2 w-full bg-green-100 dark:bg-green-900/30 rounded-full overflow-hidden border border-green-200 dark:border-green-800">
                                                    <div
                                                        className="h-full bg-green-600 dark:bg-green-500 rounded-full transition-all duration-500 w-[var(--width)]"
                                                        style={{ '--width': `${percent}%` } as React.CSSProperties}
                                                    />
                                                </div>
                                                <div className="text-xs text-muted-foreground">
                                                    <span>
                                                        von möglichen <span className="font-medium text-foreground/90">{limit.toLocaleString('de-CH', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} CHF</span>
                                                    </span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="text-center py-3 px-1 w-[60px] min-w-[60px] max-w-[60px] sticky -right-px z-40 group-hover:bg-muted/30 transition-colors shadow-[-5px_0_5px_-5px_rgba(0,0,0,0.1)] align-middle">
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
                                                        setConfirmDelete({ isOpen: true, fdId: fd.id, name: fd.bankName });
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
            <ConfirmModal
                isOpen={confirmDelete.isOpen}
                onClose={() => setConfirmDelete({ isOpen: false, fdId: null, name: '' })}
                onConfirm={() => {
                    if (confirmDelete.fdId) {
                        deleteFixedDeposit(confirmDelete.fdId);
                    }
                }}
                title="Vorsorge-Konto löschen"
                message={`Möchten Sie das Vorsorge-Konto bei "${confirmDelete.name}" wirklich löschen?`}
            />
        </div>
    );
}
