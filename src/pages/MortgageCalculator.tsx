import { useMemo, useState } from 'react';
import { Building, Calculator, Plus, Trash2, Landmark, Percent, Wallet, Download, Car, ChevronDown, ChevronUp, Fuel } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { cn } from '../utils';
import { PieChart as RechartsPie, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, Legend } from 'recharts';

import { SaronChart } from '../components/SaronChart';
import { DecimalInput } from '../components/DecimalInput';
import { usePortfolio } from '../context/PortfolioContext';
import type { MortgageTranche, BudgetEntry } from '../types';

export const MortgageCalculator = () => {
    const { mortgageData, updateMortgageData } = usePortfolio();

    const { propertyValue, maintenanceRate, yearlyAmortization, tranches, budgetItems, incomeItems, autoCosts, fuelPricePerLiter, consumptionPer100km, dailyKm, workingDaysPerMonth } = mortgageData;

    const [isFuelCalcOpen, setIsFuelCalcOpen] = useState(false);

    // Collapsible states for cards (default: expanded)
    const [isBudgetOpen, setIsBudgetOpen] = useState(true);
    const [isAutoOpen, setIsAutoOpen] = useState(true);

    // Fahrkosten Berechnung
    const calculatedMonthlyFuelCost = useMemo(() => {
        const fuel = fuelPricePerLiter || 0;
        const consumption = consumptionPer100km || 0;
        const km = dailyKm || 0;
        const days = workingDaysPerMonth || 22;
        return (consumption / 100) * km * fuel * days;
    }, [fuelPricePerLiter, consumptionPer100km, dailyKm, workingDaysPerMonth]);

    const setPropertyValue = (val: number) => updateMortgageData({ propertyValue: val });
    const setMaintenanceRate = (val: number) => updateMortgageData({ maintenanceRate: val });
    const setYearlyAmortization = (val: number) => updateMortgageData({ yearlyAmortization: val });

    const addTranche = () => {
        const newId = Math.random().toString(36).substr(2, 9);
        const newTranches = [...tranches, { id: newId, name: 'Festhypothek 2 Jahre', amount: 0, rate: 2.0 }];
        updateMortgageData({ tranches: newTranches });
    };

    const updateTranche = (id: string, field: keyof MortgageTranche, value: string | number) => {
        const newTranches = tranches.map(t => {
            if (t.id !== id) return t;
            return { ...t, [field]: value };
        });
        updateMortgageData({ tranches: newTranches });
    };

    const removeTranche = (id: string) => {
        const newTranches = tranches.filter(t => t.id !== id);
        updateMortgageData({ tranches: newTranches });
    };

    // --- Calculations ---
    const totalDebt = useMemo(() => tranches.reduce((sum, t) => sum + Number(t.amount), 0), [tranches]);
    const ltv = propertyValue > 0 ? (totalDebt / propertyValue) * 100 : 0;

    const weightedRate = useMemo(() => {
        if (totalDebt === 0) return 0;
        const weightedSum = tranches.reduce((sum, t) => sum + (Number(t.amount) * Number(t.rate)), 0);
        return weightedSum / totalDebt;
    }, [tranches, totalDebt]);

    const yearlyInterest = useMemo(() => {
        return tranches.reduce((sum, t) => sum + (Number(t.amount) * (Number(t.rate) / 100)), 0);
    }, [tranches]);

    const yearlyMaintenance = (propertyValue * maintenanceRate) / 100;

    const monthlyData = {
        interest: yearlyInterest / 12,
        amortization: yearlyAmortization / 12,
        maintenance: yearlyMaintenance / 12,
    };

    const totalMonthlyCost = monthlyData.interest + monthlyData.amortization + monthlyData.maintenance;

    const exportToPDF = () => {
        const doc = new jsPDF();

        doc.setFontSize(18);
        doc.text('Budget Plan Übersicht', 14, 20);
        doc.setFontSize(9);
        doc.text(`Erstellt am: ${new Date().toLocaleDateString('de-CH')}`, 14, 26);

        // Helper to sort items: Monthly first, then Yearly
        const sortItemsByFrequency = (items: BudgetEntry[]) => {
            return [...(items || [])].sort((a, b) => {
                const freqA = a.frequency || 'monthly';
                const freqB = b.frequency || 'monthly';
                if (freqA === freqB) return 0;
                return freqA === 'monthly' ? -1 : 1;
            });
        };

        const sortedIncomeItems = sortItemsByFrequency(incomeItems || []);
        const sortedBudgetItems = sortItemsByFrequency(budgetItems || []);
        const sortedAutoCosts = sortItemsByFrequency(autoCosts || []);

        // Calculate Totals
        const totalIncomeMonthly = sortedIncomeItems.reduce((sum: number, i: BudgetEntry) => {
            const freq = i.frequency || 'monthly';
            return sum + (freq === 'yearly' ? i.amount / 12 : i.amount);
        }, 0);

        const totalExpensesMonthly = sortedBudgetItems.reduce((sum: number, i: BudgetEntry) => {
            const freq = i.frequency || 'monthly';
            return sum + (freq === 'yearly' ? i.amount / 12 : i.amount);
        }, 0);

        const totalAutoCostsMonthly = sortedAutoCosts.reduce((sum: number, i: BudgetEntry) => {
            const freq = i.frequency || 'monthly';
            return sum + (freq === 'yearly' ? i.amount / 12 : i.amount);
        }, 0);

        const totalAvailable = totalIncomeMonthly - (totalMonthlyCost + totalExpensesMonthly + totalAutoCostsMonthly);

        // Helper to format currency for PDF (Number + CHF suffix)
        const formatCurrencyPDF = (amount: number) => {
            return new Intl.NumberFormat('de-CH', {
                style: 'decimal',
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            }).format(amount) + ' CHF';
        };

        // Shared table options for consistent styling
        const getTableOptions = (startY: number, head: any[][], body: any[][], headColor: [number, number, number], foot?: any[][]) => {
            return {
                startY,
                head,
                body,
                foot,
                theme: 'striped' as const,
                headStyles: {
                    fillColor: headColor
                },
                footStyles: {
                    fillColor: headColor
                },
                columnStyles: {
                    0: { halign: 'left' as const },   // Name -> Left
                    1: { halign: 'right' as const },  // Frequency -> Right
                    2: { halign: 'right' as const }   // Amount -> Right
                },
                didParseCell: (data: any) => {
                    // Explicitly enforce header and footer alignment to match body columns
                    if (data.section === 'head' || data.section === 'foot') {
                        if (data.column.index === 0) {
                            data.cell.styles.halign = 'left';
                        } else {
                            data.cell.styles.halign = 'right';
                        }
                    }
                }
            };
        };

        const headers = [
            [
                { content: 'Quelle', styles: { halign: 'left' as const } },
                { content: 'Frequenz', styles: { halign: 'right' as const } },
                { content: 'Betrag', styles: { halign: 'right' as const } }
            ]
        ];

        // Income Table
        doc.setFontSize(12);
        doc.text('Einnahmen', 14, 35);

        const incomeData = sortedIncomeItems.map(item => [
            item.name || 'Unbenannt',
            (item.frequency || 'monthly') === 'monthly' ? 'Monatlich' : 'Jährlich',
            formatCurrencyPDF(item.amount)
        ]);

        const incomeFooter = [
            [
                { content: 'Total ø Monatlich', styles: { halign: 'left' as const } },
                { content: '', styles: { halign: 'right' as const } },
                { content: formatCurrencyPDF(totalIncomeMonthly), styles: { halign: 'right' as const } }
            ]
        ];

        autoTable(doc, getTableOptions(38, headers, incomeData, [16, 185, 129], incomeFooter));

        // Expenses Table
        let finalY = (doc as any).lastAutoTable.finalY + 8;
        doc.setFontSize(12);
        doc.text('Ausgaben Budget', 14, finalY);

        const expenseData = sortedBudgetItems.map(item => [
            item.name || 'Unbenannt',
            (item.frequency || 'monthly') === 'monthly' ? 'Monatlich' : 'Jährlich',
            formatCurrencyPDF(item.amount)
        ]);

        const expenseHeaders = [
            [
                { content: 'Posten', styles: { halign: 'left' as const } },
                { content: 'Frequenz', styles: { halign: 'right' as const } },
                { content: 'Betrag', styles: { halign: 'right' as const } }
            ]
        ];

        const expenseFooter = [
            [
                { content: 'Total ø Monatlich', styles: { halign: 'left' as const } },
                { content: '', styles: { halign: 'right' as const } },
                { content: formatCurrencyPDF(totalExpensesMonthly), styles: { halign: 'right' as const } }
            ]
        ];

        autoTable(doc, getTableOptions(finalY + 3, expenseHeaders, expenseData, [59, 130, 246], expenseFooter));

        // Auto Costs Table
        finalY = (doc as any).lastAutoTable.finalY + 8;
        doc.setFontSize(12);
        doc.text('Auto Kosten', 14, finalY);

        const autoCostsData = sortedAutoCosts.map(item => [
            item.name || 'Unbenannt',
            (item.frequency || 'monthly') === 'monthly' ? 'Monatlich' : 'Jährlich',
            formatCurrencyPDF(item.amount)
        ]);

        const autoCostsFooter = [
            [
                { content: 'Total ø Monatlich', styles: { halign: 'left' as const } },
                { content: '', styles: { halign: 'right' as const } },
                { content: formatCurrencyPDF(totalAutoCostsMonthly), styles: { halign: 'right' as const } }
            ]
        ];

        autoTable(doc, getTableOptions(finalY + 3, headers, autoCostsData, [33, 150, 243], autoCostsFooter));

        // Summary Table
        finalY = (doc as any).lastAutoTable.finalY + 8;
        doc.setFontSize(12);
        doc.text('Zusammenfassung Monatlich', 14, finalY);

        const summaryHeaders = [
            [
                { content: 'Kategorie', styles: { halign: 'left' as const } },
                { content: 'Betrag', styles: { halign: 'right' as const } }
            ]
        ];

        // Monthly Summary Data with conditional styling
        const isMonthlyPositive = totalAvailable > 0;
        const monthlySummaryStyle = {
            fillColor: isMonthlyPositive ? [220, 252, 231] as [number, number, number] : [254, 226, 226] as [number, number, number], // green-100 : red-100
            fontStyle: 'bold' as const
        };

        const summaryData = [
            ['Total Einnahmen', formatCurrencyPDF(totalIncomeMonthly)],
            ['Wohnkosten Hypothek + NK', formatCurrencyPDF(totalMonthlyCost)],
            ['Budget Ausgaben', formatCurrencyPDF(totalExpensesMonthly)],
            ['Auto Kosten', formatCurrencyPDF(totalAutoCostsMonthly)],
            [
                { content: 'Verfügbar Sparquote', styles: monthlySummaryStyle },
                { content: formatCurrencyPDF(totalAvailable), styles: { ...monthlySummaryStyle, halign: 'right' as const } }
            ]
        ];

        autoTable(doc, {
            startY: finalY + 3,
            head: summaryHeaders,
            body: summaryData,
            theme: 'grid',
            headStyles: { fillColor: [75, 85, 99] }, // Gray
            columnStyles: {
                0: { halign: 'left', cellWidth: 120 }, // Fixed width for Category
                1: { halign: 'right', fontStyle: 'bold' } // Amount -> Right
            }
        });

        // Yearly Summary Table
        finalY = (doc as any).lastAutoTable.finalY + 10;

        doc.setFontSize(12);
        doc.text('Zusammenfassung Jährlich', 14, finalY);

        const isYearlyPositive = (totalAvailable * 12) > 0;
        const yearlySummaryStyle = {
            fillColor: isYearlyPositive ? [220, 252, 231] as [number, number, number] : [254, 226, 226] as [number, number, number],
            fontStyle: 'bold' as const
        };

        const summaryDataYearly = [
            ['Total Einnahmen', formatCurrencyPDF(totalIncomeMonthly * 12)],
            ['Wohnkosten Hypothek + NK', formatCurrencyPDF(totalMonthlyCost * 12)],
            ['Budget Ausgaben', formatCurrencyPDF(totalExpensesMonthly * 12)],
            ['Auto Kosten', formatCurrencyPDF(totalAutoCostsMonthly * 12)],
            [
                { content: 'Verfügbar Sparquote', styles: yearlySummaryStyle },
                { content: formatCurrencyPDF(totalAvailable * 12), styles: { ...yearlySummaryStyle, halign: 'right' as const } }
            ]
        ];

        autoTable(doc, {
            startY: finalY + 3,
            head: summaryHeaders,
            body: summaryDataYearly,
            theme: 'grid',
            headStyles: { fillColor: [75, 85, 99] }, // Gray
            columnStyles: {
                0: { halign: 'left', cellWidth: 120 }, // Fixed width for Category
                1: { halign: 'right', fontStyle: 'bold' } // Amount -> Right
            }
        });

        doc.save('budget_plan.pdf');
    };

    const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444']; // emerald, blue, amber, red

    const pieData = tranches.map(t => ({ name: t.name, value: Number(t.amount) }));

    // Helper for Input Classes
    const inputClass = "w-full bg-background border border-input rounded-md px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

    return (
        <div className="p-6 space-y-6 max-w-7xl mx-auto pb-24">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Hypotheken Rechner</h1>
                    <p className="text-muted-foreground mt-1">
                        Optimieren Sie Ihren Finanzierungsmix und berechnen Sie die monatliche Tragbarkeit.
                    </p>
                </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
                {/* LEFT COLUMN: INPUTS */}
                <div className="space-y-6">

                    {/* Property & Maintenance */}
                    <div className="bg-card rounded-xl border border-border p-6 shadow-sm space-y-4">
                        <h2 className="text-lg font-semibold flex items-center gap-2">
                            <Building className="size-5 text-primary" />
                            Immobilie & Nebenkosten
                        </h2>

                        <div className="grid gap-4 sm:grid-cols-2">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Immobilienwert</label>
                                <div className="relative">
                                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-8 h-4 flex items-center justify-center text-xs">
                                        CHF
                                    </div>
                                    <DecimalInput
                                        value={propertyValue}
                                        onChange={(val) => setPropertyValue(parseFloat(val) || 0)}
                                        className={cn(inputClass, "pl-14")}
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Unterhalt & Nebenkosten (%)</label>
                                <div className="relative">
                                    <Percent className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground size-4" />
                                    <DecimalInput
                                        value={maintenanceRate}
                                        onChange={(val) => setMaintenanceRate(parseFloat(val) || 0)}
                                        className={cn(inputClass, "pl-9")}
                                    />
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    ≈ {new Intl.NumberFormat('de-CH', { style: 'currency', currency: 'CHF', maximumFractionDigits: 0 }).format(yearlyMaintenance / 12)} / Monat
                                </p>
                            </div>
                            <div className="space-y-2 sm:col-span-2">
                                <label className="text-sm font-medium">Amortisation (Jährlich)</label>
                                <div className="relative">
                                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-8 h-4 flex items-center justify-center text-xs">
                                        CHF
                                    </div>
                                    <DecimalInput
                                        value={yearlyAmortization}
                                        onChange={(val) => setYearlyAmortization(parseFloat(val) || 0)}
                                        className={cn(inputClass, "pl-14")}
                                    />
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    Pflicht bei Belehnung &gt; 66% (2. Hypothek). Üblich: ~1% vom Immobilienwert.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Mortgage Tranches */}
                    <div className="bg-card rounded-xl border border-border p-6 shadow-sm space-y-4">
                        <div className="flex items-center justify-between">
                            <h2 className="text-lg font-semibold flex items-center gap-2">
                                <Landmark className="size-5 text-primary" />
                                Finanzierungsmix
                            </h2>
                            <button
                                onClick={addTranche}
                                className="text-sm bg-primary/10 text-primary hover:bg-primary/20 px-3 py-1.5 rounded-md font-medium transition-colors flex items-center gap-1"
                            >
                                <Plus className="size-4" /> Add
                            </button>
                        </div>

                        <div className="space-y-3">
                            {tranches.map((tranche, index) => (
                                <div key={tranche.id} className="grid grid-cols-12 gap-2 items-end bg-accent/30 p-3 rounded-lg border border-transparent hover:border-border transition-all">
                                    <div className="col-span-5 sm:col-span-5 space-y-1">
                                        <label className="text-xs text-muted-foreground">{index + 1}. Hypothek</label>
                                        <select
                                            value={tranche.name}
                                            onChange={(e) => updateTranche(tranche.id, 'name', e.target.value)}
                                            className={inputClass}
                                        >
                                            <option value="" disabled>Bitte wählen...</option>
                                            <optgroup label="SARON / Markt">
                                                <option value="SARON Indikativ">SARON Indikativ</option>
                                                <option value="SARON HYPO 3 Jahre">SARON HYPO 3 Jahre</option>
                                            </optgroup>
                                            <optgroup label="Festhypotheken">
                                                <option value="Festhypothek 2 Jahre">Festhypothek 2 Jahre</option>
                                                <option value="Festhypothek 3 Jahre">Festhypothek 3 Jahre</option>
                                                <option value="Festhypothek 4 Jahre">Festhypothek 4 Jahre</option>
                                                <option value="Festhypothek 5 Jahre">Festhypothek 5 Jahre</option>
                                                <option value="Festhypothek 6 Jahre">Festhypothek 6 Jahre</option>
                                                <option value="Festhypothek 7 Jahre">Festhypothek 7 Jahre</option>
                                                {/* Extended for completeness */}
                                                <option value="Festhypothek 8 Jahre">Festhypothek 8 Jahre</option>
                                                <option value="Festhypothek 9 Jahre">Festhypothek 9 Jahre</option>
                                                <option value="Festhypothek 10 Jahre">Festhypothek 10 Jahre</option>
                                            </optgroup>
                                        </select>
                                    </div>
                                    <div className="col-span-4 sm:col-span-3 space-y-1">
                                        <label className="text-xs text-muted-foreground">Betrag</label>
                                        <DecimalInput
                                            value={tranche.amount}
                                            onChange={(val) => updateTranche(tranche.id, 'amount', parseFloat(val) || 0)}
                                            className={inputClass}
                                        />
                                    </div>
                                    <div className="col-span-2 sm:col-span-3 space-y-1">
                                        <label className="text-xs text-muted-foreground">Zins (%)</label>
                                        <DecimalInput
                                            value={tranche.rate}
                                            onChange={(val) => updateTranche(tranche.id, 'rate', parseFloat(val) || 0)}
                                            className={inputClass}
                                        />
                                    </div>
                                    <div className="col-span-1 flex justify-center pb-2">
                                        <button
                                            onClick={() => removeTranche(tranche.id)}
                                            className="text-muted-foreground hover:text-destructive transition-colors"
                                            title="Entfernen"
                                        >
                                            <Trash2 className="size-4" />
                                        </button>
                                    </div>
                                </div>
                            ))}

                            {tranches.length === 0 && (
                                <div className="text-center py-8 text-muted-foreground text-sm border-2 border-dashed border-border rounded-lg">
                                    Keine Tranchen vorhanden. Fügen Sie eine Hypothek hinzu.
                                </div>
                            )}
                        </div>

                        <div className="flex justify-between items-center text-sm px-2 pt-2 border-t border-border">
                            <span className="text-muted-foreground">Total Hypothekardschuld</span>
                            <span className="font-mono font-bold">
                                {new Intl.NumberFormat('de-CH', { style: 'currency', currency: 'CHF', maximumFractionDigits: 0 }).format(totalDebt)}
                            </span>
                        </div>
                    </div>

                    {/* NEW: Income Plan */}
                    <div className="bg-card rounded-xl border border-border overflow-hidden shadow-sm">
                        <div className="p-4 border-b border-border flex justify-between items-center">
                            <h2 className="text-lg font-semibold flex items-center gap-2">
                                <Wallet className="size-5 text-emerald-500" />
                                Einnahmen
                            </h2>
                            <button
                                onClick={() => {
                                    const newItems = [...(incomeItems || []), { id: crypto.randomUUID(), name: '', amount: 0, frequency: 'monthly' as const }];
                                    updateMortgageData({ incomeItems: newItems });
                                }}
                                className="text-sm bg-primary/10 text-primary hover:bg-primary/20 px-3 py-1.5 rounded-md font-medium transition-colors flex items-center gap-1"
                            >
                                <Plus className="size-4" /> Add Income
                            </button>
                        </div>
                        <div className="p-4 space-y-2">
                            <div className="space-y-1">
                                {(incomeItems || []).map((item: BudgetEntry, index: number) => (
                                    <div key={item.id} className="grid grid-cols-12 gap-2 items-center bg-accent/30 px-2 py-0.5 rounded-lg">
                                        <div className="col-span-5">
                                            <input
                                                value={item.name}
                                                onChange={(e) => {
                                                    const newItems = [...(incomeItems || [])];
                                                    newItems[index] = { ...item, name: e.target.value };
                                                    updateMortgageData({ incomeItems: newItems });
                                                }}
                                                className="w-full bg-transparent border-none text-sm focus:ring-0 p-0 font-medium h-7"
                                                placeholder="Quelle (z.B. Lohn)"
                                            />
                                        </div>
                                        <div className="col-span-3">
                                            <select
                                                value={item.frequency || 'monthly'}
                                                onChange={(e) => {
                                                    const newItems = [...(incomeItems || [])];
                                                    newItems[index] = { ...item, frequency: e.target.value as 'monthly' | 'yearly' };
                                                    updateMortgageData({ incomeItems: newItems });
                                                }}
                                                className="w-full bg-background border border-input rounded px-1 py-0 text-xs h-7"
                                            >
                                                <option value="monthly">Monatlich</option>
                                                <option value="yearly">Jährlich</option>
                                            </select>
                                        </div>
                                        <div className="col-span-3 relative">
                                            <div className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">CHF</div>
                                            <DecimalInput
                                                value={item.amount}
                                                onChange={(val) => {
                                                    const newItems = [...(incomeItems || [])];
                                                    newItems[index] = { ...item, amount: parseFloat(val) || 0 };
                                                    updateMortgageData({ incomeItems: newItems });
                                                }}
                                                className="w-full bg-background border border-input rounded px-1 py-0 pl-8 text-sm text-right h-7"
                                            />
                                        </div>
                                        <div className="col-span-1 flex justify-end">
                                            <button
                                                onClick={() => {
                                                    const newItems = (incomeItems || []).filter((i: BudgetEntry) => i.id !== item.id);
                                                    updateMortgageData({ incomeItems: newItems });
                                                }}
                                                className="text-muted-foreground hover:text-destructive p-1"
                                            >
                                                <Trash2 className="size-4" />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                                {(incomeItems || []).length === 0 && (
                                    <div className="text-center text-sm text-muted-foreground py-4 border border-dashed rounded-lg">
                                        Noch keine Einnahmen erfasst.
                                    </div>
                                )}
                            </div>
                            <div className="pt-2 flex justify-end text-sm font-medium">
                                Total: {new Intl.NumberFormat('de-CH', { style: 'currency', currency: 'CHF', maximumFractionDigits: 0 }).format(
                                    (incomeItems || []).reduce((sum: number, i: BudgetEntry) => {
                                        const monthlyAmount = i.frequency === 'yearly' ? i.amount / 12 : i.amount;
                                        return sum + monthlyAmount;
                                    }, 0)
                                )} / Mt
                            </div>
                        </div>
                    </div>

                    {/* NEW: Budget Plan */}
                    <div className="bg-card rounded-xl border border-border overflow-hidden shadow-sm">
                        <div className="p-6 border-b border-border flex justify-between items-center cursor-pointer hover:bg-muted/30 transition-colors" onClick={() => setIsBudgetOpen(!isBudgetOpen)}>
                            <h2 className="text-lg font-semibold flex items-center gap-2">
                                <Wallet className="size-5 text-primary" />
                                Budget Plan
                                {isBudgetOpen ? <ChevronUp className="size-4 text-muted-foreground" /> : <ChevronDown className="size-4 text-muted-foreground" />}
                            </h2>
                            <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                                <button
                                    onClick={exportToPDF}
                                    className="text-sm bg-secondary/80 text-secondary-foreground hover:bg-secondary px-3 py-1.5 rounded-md font-medium transition-colors flex items-center gap-1"
                                    title="Als PDF exportieren"
                                >
                                    <Download className="size-4" /> PDF
                                </button>
                                <button
                                    onClick={() => {
                                        const newItems = [...(budgetItems || []), { id: crypto.randomUUID(), name: '', amount: 0, frequency: 'monthly' as const }];
                                        updateMortgageData({ budgetItems: newItems });
                                    }}
                                    className="text-sm bg-primary/10 text-primary hover:bg-primary/20 px-3 py-1.5 rounded-md font-medium transition-colors flex items-center gap-1"
                                >
                                    <Plus className="size-4" /> Add Item
                                </button>
                            </div>
                        </div>
                        {isBudgetOpen && (
                            <div className="p-4 space-y-2">
                                <div className="space-y-1">
                                    {(budgetItems || []).map((item: BudgetEntry, index: number) => (
                                        <div key={item.id} className="grid grid-cols-12 gap-2 items-center bg-accent/30 px-2 py-0.5 rounded-lg">
                                            <div className="col-span-5">
                                                <input
                                                    value={item.name}
                                                    onChange={(e) => {
                                                        const newItems = [...(budgetItems || [])];
                                                        newItems[index] = { ...item, name: e.target.value };
                                                        updateMortgageData({ budgetItems: newItems });
                                                    }}
                                                    className="w-full bg-transparent border-none text-sm focus:ring-0 p-0 font-medium h-7"
                                                    placeholder="Name (z.B. Essen)"
                                                />
                                            </div>
                                            <div className="col-span-3">
                                                <select
                                                    value={item.frequency || 'monthly'}
                                                    onChange={(e) => {
                                                        const newItems = [...(budgetItems || [])];
                                                        newItems[index] = { ...item, frequency: e.target.value as 'monthly' | 'yearly' };
                                                        updateMortgageData({ budgetItems: newItems });
                                                    }}
                                                    className="w-full bg-background border border-input rounded px-1 py-0 text-xs h-7"
                                                >
                                                    <option value="monthly">Monatlich</option>
                                                    <option value="yearly">Jährlich</option>
                                                </select>
                                            </div>
                                            <div className="col-span-3 relative">
                                                <div className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">CHF</div>
                                                <DecimalInput
                                                    value={item.amount}
                                                    onChange={(val) => {
                                                        const newItems = [...(budgetItems || [])];
                                                        newItems[index] = { ...item, amount: parseFloat(val) || 0 };
                                                        updateMortgageData({ budgetItems: newItems });
                                                    }}
                                                    className="w-full bg-background border border-input rounded px-1 py-0 pl-8 text-sm text-right h-7"
                                                />
                                            </div>
                                            <div className="col-span-1 flex justify-end">
                                                <button
                                                    onClick={() => {
                                                        const newItems = (budgetItems || []).filter((i: BudgetEntry) => i.id !== item.id);
                                                        updateMortgageData({ budgetItems: newItems });
                                                    }}
                                                    className="text-muted-foreground hover:text-destructive p-1"
                                                >
                                                    <Trash2 className="size-4" />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                    {(budgetItems || []).length === 0 && (
                                        <div className="text-center text-sm text-muted-foreground py-4 border border-dashed rounded-lg">
                                            Noch keine Ausgaben erfasst.
                                        </div>
                                    )}
                                </div>

                                {/* Totals Section */}
                                {/* Totals Section */}

                                {/* Totals Section */}
                                <div className="space-y-2 pt-4 border-t border-border">
                                    {/* Income Summary */}
                                    <div className="flex justify-between items-center text-sm text-emerald-500">
                                        <span>Total Einnahmen</span>
                                        <span className="font-mono">
                                            {new Intl.NumberFormat('de-CH', { style: 'currency', currency: 'CHF', maximumFractionDigits: 0 }).format(
                                                (incomeItems || []).reduce((sum: number, i: BudgetEntry) => {
                                                    const monthlyAmount = i.frequency === 'yearly' ? i.amount / 12 : i.amount;
                                                    return sum + monthlyAmount;
                                                }, 0)
                                            )} / Mt
                                        </span>
                                    </div>
                                    <div className="my-1 border-t border-border border-dashed opacity-50" />

                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-muted-foreground">Wohnkosten (Hypothek + NK)</span>
                                        <span className="font-mono">{new Intl.NumberFormat('de-CH', { style: 'currency', currency: 'CHF', maximumFractionDigits: 0 }).format(totalMonthlyCost)} / Mt</span>
                                    </div>
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-muted-foreground">Budget Ausgaben (ø Monatlich)</span>
                                        <span className="font-mono">
                                            {new Intl.NumberFormat('de-CH', { style: 'currency', currency: 'CHF', maximumFractionDigits: 0 }).format(
                                                (budgetItems || []).reduce((sum: number, i: BudgetEntry) => {
                                                    const monthlyAmount = i.frequency === 'yearly' ? i.amount / 12 : i.amount;
                                                    return sum + monthlyAmount;
                                                }, 0)
                                            )} / Mt
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-muted-foreground">Auto Kosten (ø Monatlich)</span>
                                        <span className="font-mono">
                                            {new Intl.NumberFormat('de-CH', { style: 'currency', currency: 'CHF', maximumFractionDigits: 0 }).format(
                                                (autoCosts || []).reduce((sum: number, i: BudgetEntry) => {
                                                    const monthlyAmount = i.frequency === 'yearly' ? i.amount / 12 : i.amount;
                                                    return sum + monthlyAmount;
                                                }, 0)
                                            )} / Mt
                                        </span>
                                    </div>

                                    <div className="flex justify-between items-center font-bold text-lg pt-1">
                                        <span>Gesamtausgaben</span>
                                        <span className="text-red-400 font-mono">
                                            - {new Intl.NumberFormat('de-CH', { style: 'currency', currency: 'CHF', maximumFractionDigits: 0 }).format(
                                                totalMonthlyCost +
                                                (budgetItems || []).reduce((sum: number, i: BudgetEntry) => {
                                                    const monthlyAmount = i.frequency === 'yearly' ? i.amount / 12 : i.amount;
                                                    return sum + monthlyAmount;
                                                }, 0) +
                                                (autoCosts || []).reduce((sum: number, i: BudgetEntry) => {
                                                    const monthlyAmount = i.frequency === 'yearly' ? i.amount / 12 : i.amount;
                                                    return sum + monthlyAmount;
                                                }, 0)
                                            )} / Mt
                                        </span>
                                    </div>

                                    <div className="my-2 border-t-2 border-border" />

                                    <div className="flex justify-between items-center font-bold text-lg">
                                        <span>Verfügbar Sparquote</span>
                                        <span className={cn("font-mono",
                                            ((incomeItems || []).reduce((sum: number, i: BudgetEntry) => sum + (i.frequency === 'yearly' ? i.amount / 12 : i.amount), 0) - (totalMonthlyCost + (budgetItems || []).reduce((sum: number, i: BudgetEntry) => sum + (i.frequency === 'yearly' ? i.amount / 12 : i.amount), 0) + (autoCosts || []).reduce((sum: number, i: BudgetEntry) => sum + (i.frequency === 'yearly' ? i.amount / 12 : i.amount), 0))) > 0
                                                ? "text-emerald-500"
                                                : "text-destructive"
                                        )}>
                                            {new Intl.NumberFormat('de-CH', { style: 'currency', currency: 'CHF', maximumFractionDigits: 0 }).format(
                                                ((incomeItems || []).reduce((sum: number, i: BudgetEntry) => sum + (i.frequency === 'yearly' ? i.amount / 12 : i.amount), 0)) -
                                                (totalMonthlyCost + (budgetItems || []).reduce((sum: number, i: BudgetEntry) => sum + (i.frequency === 'yearly' ? i.amount / 12 : i.amount), 0) + (autoCosts || []).reduce((sum: number, i: BudgetEntry) => sum + (i.frequency === 'yearly' ? i.amount / 12 : i.amount), 0))
                                            )} / Mt
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-center font-bold text-lg">
                                        <span>Verfügbar Sparquote</span>
                                        <span className={cn("font-mono",
                                            (((incomeItems || []).reduce((sum: number, i: BudgetEntry) => sum + (i.frequency === 'yearly' ? i.amount / 12 : i.amount), 0)) -
                                                (totalMonthlyCost + (budgetItems || []).reduce((sum: number, i: BudgetEntry) => sum + (i.frequency === 'yearly' ? i.amount / 12 : i.amount), 0) + (autoCosts || []).reduce((sum: number, i: BudgetEntry) => sum + (i.frequency === 'yearly' ? i.amount / 12 : i.amount), 0))) * 12 > 0
                                                ? "text-emerald-500"
                                                : "text-destructive"
                                        )}>
                                            ≈ {new Intl.NumberFormat('de-CH', { style: 'currency', currency: 'CHF', maximumFractionDigits: 0 }).format(
                                                (((incomeItems || []).reduce((sum: number, i: BudgetEntry) => sum + (i.frequency === 'yearly' ? i.amount / 12 : i.amount), 0)) -
                                                    (totalMonthlyCost + (budgetItems || []).reduce((sum: number, i: BudgetEntry) => sum + (i.frequency === 'yearly' ? i.amount / 12 : i.amount), 0) + (autoCosts || []).reduce((sum: number, i: BudgetEntry) => sum + (i.frequency === 'yearly' ? i.amount / 12 : i.amount), 0))) * 12
                                            )} / Jahr
                                        </span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* NEW: Auto Costs Card */}
                    <div className="bg-card rounded-xl border border-border overflow-hidden shadow-sm">
                        <div className="p-6 border-b border-border flex justify-between items-center cursor-pointer hover:bg-muted/30 transition-colors" onClick={() => setIsAutoOpen(!isAutoOpen)}>
                            <h2 className="text-lg font-semibold flex items-center gap-2">
                                <Car className="size-5 text-blue-500" />
                                Auto Kosten
                                {isAutoOpen ? <ChevronUp className="size-4 text-muted-foreground" /> : <ChevronDown className="size-4 text-muted-foreground" />}
                            </h2>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    const newItems = [...(autoCosts || []), { id: crypto.randomUUID(), name: '', amount: 0, frequency: 'monthly' as const }];
                                    updateMortgageData({ autoCosts: newItems });
                                }}
                                className="text-sm bg-primary/10 text-primary hover:bg-primary/20 px-3 py-1.5 rounded-md font-medium transition-colors flex items-center gap-1"
                            >
                                <Plus className="size-4" /> Add Item
                            </button>
                        </div>
                        {isAutoOpen && (
                            <div className="p-4 space-y-2">
                                <div className="space-y-1">
                                    {(autoCosts || []).map((item: BudgetEntry, index: number) => (
                                        <div key={item.id} className="grid grid-cols-12 gap-2 items-center bg-accent/30 px-2 py-0.5 rounded-lg">
                                            <div className="col-span-5">
                                                <input
                                                    value={item.name}
                                                    onChange={(e) => {
                                                        const newItems = [...(autoCosts || [])];
                                                        newItems[index] = { ...item, name: e.target.value };
                                                        updateMortgageData({ autoCosts: newItems });
                                                    }}
                                                    className="w-full bg-transparent border-none text-sm focus:ring-0 p-0 font-medium h-7"
                                                    placeholder="z.B. Versicherung"
                                                />
                                            </div>
                                            <div className="col-span-3">
                                                <select
                                                    value={item.frequency || 'monthly'}
                                                    onChange={(e) => {
                                                        const newItems = [...(autoCosts || [])];
                                                        newItems[index] = { ...item, frequency: e.target.value as 'monthly' | 'yearly' };
                                                        updateMortgageData({ autoCosts: newItems });
                                                    }}
                                                    className="w-full bg-background border border-input rounded px-1 py-0 text-xs h-7"
                                                >
                                                    <option value="monthly">Monatlich</option>
                                                    <option value="yearly">Jährlich</option>
                                                </select>
                                            </div>
                                            <div className="col-span-3 relative">
                                                <div className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">CHF</div>
                                                <DecimalInput
                                                    value={item.amount}
                                                    onChange={(val) => {
                                                        const newItems = [...(autoCosts || [])];
                                                        newItems[index] = { ...item, amount: parseFloat(val) || 0 };
                                                        updateMortgageData({ autoCosts: newItems });
                                                    }}
                                                    className="w-full bg-background border border-input rounded px-1 py-0 pl-8 text-sm text-right h-7"
                                                />
                                            </div>
                                            <div className="col-span-1 flex justify-end">
                                                <button
                                                    onClick={() => {
                                                        const newItems = (autoCosts || []).filter((i: BudgetEntry) => i.id !== item.id);
                                                        updateMortgageData({ autoCosts: newItems });
                                                    }}
                                                    className="text-muted-foreground hover:text-destructive p-1"
                                                >
                                                    <Trash2 className="size-4" />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                    {(autoCosts || []).length === 0 && (
                                        <div className="text-center text-sm text-muted-foreground py-4 border border-dashed rounded-lg">
                                            Noch keine Auto Kosten erfasst.
                                        </div>
                                    )}
                                </div>
                                <div className="pt-2 flex justify-end text-sm font-medium">
                                    Total: {new Intl.NumberFormat('de-CH', { style: 'currency', currency: 'CHF', maximumFractionDigits: 0 }).format(
                                        (autoCosts || []).reduce((sum: number, i: BudgetEntry) => {
                                            const monthlyAmount = i.frequency === 'yearly' ? i.amount / 12 : i.amount;
                                            return sum + monthlyAmount;
                                        }, 0)
                                    )} / Mt
                                </div>

                                {/* Fahrkosten Rechner (Accordion) */}
                                <div className="mt-4 border-t border-border pt-4">
                                    <button
                                        onClick={() => setIsFuelCalcOpen(!isFuelCalcOpen)}
                                        className="w-full flex items-center justify-between text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                                    >
                                        <span className="flex items-center gap-2">
                                            <Fuel className="size-4" />
                                            Fahrkosten Rechner
                                        </span>
                                        {isFuelCalcOpen ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                                    </button>
                                    {isFuelCalcOpen && (
                                        <div className="mt-3 space-y-3 bg-accent/30 rounded-lg p-3">
                                            <div className="grid grid-cols-2 gap-3">
                                                <div className="space-y-1">
                                                    <label className="text-xs text-muted-foreground">Benzin CHF/L</label>
                                                    <DecimalInput
                                                        value={fuelPricePerLiter || 0}
                                                        onChange={(val) => updateMortgageData({ fuelPricePerLiter: parseFloat(val) || 0 })}
                                                        className="w-full bg-background border border-input rounded px-2 py-1 text-sm h-8"
                                                    />
                                                </div>
                                                <div className="space-y-1">
                                                    <label className="text-xs text-muted-foreground">Verbrauch L/100km</label>
                                                    <DecimalInput
                                                        value={consumptionPer100km || 0}
                                                        onChange={(val) => updateMortgageData({ consumptionPer100km: parseFloat(val) || 0 })}
                                                        className="w-full bg-background border border-input rounded px-2 py-1 text-sm h-8"
                                                    />
                                                </div>
                                                <div className="space-y-1">
                                                    <label className="text-xs text-muted-foreground">km / Tag</label>
                                                    <DecimalInput
                                                        value={dailyKm || 0}
                                                        onChange={(val) => updateMortgageData({ dailyKm: parseFloat(val) || 0 })}
                                                        className="w-full bg-background border border-input rounded px-2 py-1 text-sm h-8"
                                                    />
                                                </div>
                                                <div className="space-y-1">
                                                    <label className="text-xs text-muted-foreground">Arbeitstage / Mt</label>
                                                    <DecimalInput
                                                        value={workingDaysPerMonth || 22}
                                                        onChange={(val) => updateMortgageData({ workingDaysPerMonth: parseFloat(val) || 22 })}
                                                        className="w-full bg-background border border-input rounded px-2 py-1 text-sm h-8"
                                                    />
                                                </div>
                                            </div>
                                            <div className="flex justify-between items-center pt-2 border-t border-border">
                                                <span className="text-sm text-muted-foreground">Berechnete Fahrkosten:</span>
                                                <span className="font-mono font-bold text-blue-500">
                                                    {new Intl.NumberFormat('de-CH', { style: 'currency', currency: 'CHF', maximumFractionDigits: 0 }).format(calculatedMonthlyFuelCost)} / Mt
                                                </span>
                                            </div>
                                            <p className="text-xs text-muted-foreground italic">
                                                Übertragen Sie diesen Wert manuell in "Fahrkosten" oben.
                                            </p>
                                        </div>
                                    )}
                                </div>

                            </div>
                        )}
                    </div>

                </div>

                {/* RIGHT COLUMN: RESULTS */}
                <div className="space-y-6">

                    {/* Key Metrics Cards */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-card rounded-xl border border-border p-4 shadow-sm">
                            <div className="text-sm text-muted-foreground mb-1">Belehnung (LTV)</div>
                            <div className={cn("text-2xl font-bold font-mono", ltv > 80 ? "text-destructive" : ltv > 66 ? "text-amber-500" : "text-emerald-500")}>
                                {ltv.toFixed(1)}%
                            </div>
                            <div className="text-xs text-muted-foreground mt-1">
                                {ltv > 80 ? "Kritisch (>80%)" : ltv > 66 ? "2. Hypothek (>66%)" : "1. Hypothek (≤66%)"}
                            </div>
                        </div>
                        <div className="bg-card rounded-xl border border-border p-4 shadow-sm">
                            <div className="text-sm text-muted-foreground mb-1">Mischzinssatz</div>
                            <div className="text-2xl font-bold text-foreground font-mono">
                                {weightedRate.toFixed(2)}%
                            </div>
                            <div className="text-xs text-muted-foreground mt-1">
                                Gewichtet nach Betrag
                            </div>
                        </div>
                    </div>

                    {/* Monthly Cost Breakdown */}
                    <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
                        <div className="p-6 border-b border-border">
                            <h2 className="text-lg font-semibold flex items-center gap-2">
                                <Calculator className="size-5 text-primary" />
                                Monatliche Kosten
                            </h2>
                        </div>
                        <div className="p-6 space-y-6">
                            <div className="flex items-center justify-center py-2">
                                <div className="text-center">
                                    <div className="text-sm text-muted-foreground mb-1">Total pro Monat</div>
                                    <div className="text-4xl font-bold tracking-tight text-foreground font-mono">
                                        {new Intl.NumberFormat('de-CH', { style: 'currency', currency: 'CHF', maximumFractionDigits: 0 }).format(totalMonthlyCost)}
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-3">
                                {/* Interest Row */}
                                <div className="flex items-center justify-between text-sm">
                                    <div className="flex items-center gap-2">
                                        <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                                        <span>Hypothekarzinsen</span>
                                    </div>
                                    <span className="font-mono">{new Intl.NumberFormat('de-CH', { style: 'currency', currency: 'CHF', maximumFractionDigits: 0 }).format(monthlyData.interest)}</span>
                                </div>
                                {/* Amortization Row */}
                                <div className="flex items-center justify-between text-sm">
                                    <div className="flex items-center gap-2">
                                        <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
                                        <span>Amortisation</span>
                                    </div>
                                    <span className="font-mono">{new Intl.NumberFormat('de-CH', { style: 'currency', currency: 'CHF', maximumFractionDigits: 0 }).format(monthlyData.amortization)}</span>
                                </div>
                                {/* Maintenance Row */}
                                <div className="flex items-center justify-between text-sm">
                                    <div className="flex items-center gap-2">
                                        <div className="w-3 h-3 rounded-full bg-amber-500"></div>
                                        <span>Unterhalt & Nebenkosten</span>
                                    </div>
                                    <span className="font-mono">{new Intl.NumberFormat('de-CH', { style: 'currency', currency: 'CHF', maximumFractionDigits: 0 }).format(monthlyData.maintenance)}</span>
                                </div>
                            </div>
                        </div>
                        {/* Simple Visual Bar */}
                        <div className="h-4 w-full flex">
                            <div className="h-full bg-blue-500 w-[var(--width)]" style={{ '--width': `${(monthlyData.interest / totalMonthlyCost) * 100}%` } as React.CSSProperties}></div>
                            <div className="h-full bg-emerald-500 w-[var(--width)]" style={{ '--width': `${(monthlyData.amortization / totalMonthlyCost) * 100}%` } as React.CSSProperties}></div>
                            <div className="h-full bg-amber-500 w-[var(--width)]" style={{ '--width': `${(monthlyData.maintenance / totalMonthlyCost) * 100}%` } as React.CSSProperties}></div>
                        </div>
                    </div>

                    {/* SARON Chart */}
                    <SaronChart />

                    {/* Tranche Visual */}
                    {tranches.length > 0 && (
                        <div className="bg-card rounded-xl border border-border p-6 shadow-sm">
                            <h3 className="text-sm font-medium mb-4 text-muted-foreground">Mix-Verteilung</h3>
                            <div className="h-[200px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <RechartsPie>
                                        <Pie
                                            data={pieData}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={60}
                                            outerRadius={80}
                                            paddingAngle={5}
                                            dataKey="value"
                                        >
                                            {pieData.map((_entry, index) => (
                                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                            ))}
                                        </Pie>
                                        <RechartsTooltip
                                            formatter={(value: number) => new Intl.NumberFormat('de-CH', { style: 'currency', currency: 'CHF', maximumFractionDigits: 0 }).format(value)}
                                            contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }}
                                            itemStyle={{ color: 'hsl(var(--foreground))' }}
                                        />
                                        <Legend />
                                    </RechartsPie>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    )}

                </div>
            </div>
        </div>
    );
};
