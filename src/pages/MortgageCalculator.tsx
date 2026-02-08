import { useMemo, useState } from 'react';
import { Building, Calculator, Plus, Trash2, Landmark, Percent, Wallet, Download, Car, ChevronDown, ChevronUp, Fuel, Zap, User, FileText, Gauge, Droplets } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { cn } from '../utils';
import { PieChart as RechartsPie, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, Legend } from 'recharts';

import { SaronChart } from '../components/SaronChart';
import { DecimalInput } from '../components/DecimalInput';
import { usePortfolio } from '../context/PortfolioContext';
import type { MortgageTranche, BudgetEntry, OilPurchase, ElectricityReading } from '../types';

const formatCHF = (amount: number, fractionDigits = 0) => {
    return new Intl.NumberFormat('de-CH', {
        style: 'decimal',
        minimumFractionDigits: fractionDigits,
        maximumFractionDigits: fractionDigits
    }).format(amount) + ' CHF';
};

export const MortgageCalculator = () => {
    const { mortgageData, updateMortgageData } = usePortfolio();

    const { propertyValue, maintenanceRate, yearlyAmortization, tranches, budgetItems, incomeItems, autoCosts, fuelPricePerLiter, consumptionPer100km, dailyKm, workingDaysPerMonth, oilTankCapacity, oilPurchases, electricityReadings, electricityPriceHT, electricityPriceNT, electricityCustomerNumber, electricityContractNumber, electricityMeterNumber, waterHistory } = mortgageData;

    const [isFuelCalcOpen, setIsFuelCalcOpen] = useState(false);

    // Collapsible states for cards (default: expanded)
    const [isBudgetOpen, setIsBudgetOpen] = useState(false);
    const [isIncomeOpen, setIsIncomeOpen] = useState(false);
    const [isPropertyOpen, setIsPropertyOpen] = useState(false);
    const [isFinanceOpen, setIsFinanceOpen] = useState(false);
    const [isAutoOpen, setIsAutoOpen] = useState(false);
    const [isHeatingCalcOpen, setIsHeatingCalcOpen] = useState(false);
    const [isElectricityOpen, setIsElectricityOpen] = useState(false);
    const [isWaterOpen, setIsWaterOpen] = useState(false);

    // Water entry form state




    // Fahrkosten Berechnung
    const calculatedMonthlyFuelCost = useMemo(() => {
        const fuel = fuelPricePerLiter || 0;
        const consumption = consumptionPer100km || 0;
        const km = dailyKm || 0;
        const days = workingDaysPerMonth || 22;
        return (consumption / 100) * km * fuel * days;
    }, [fuelPricePerLiter, consumptionPer100km, dailyKm, workingDaysPerMonth]);

    // Heizöl Statistik (Verbrauch & Kosten)
    const oilStats = useMemo(() => {
        if (!oilPurchases || oilPurchases.length < 2) return null;

        const sorted = [...oilPurchases].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        let totalLitersConsumed = 0;
        let totalCost = 0;
        let totalDays = 0;

        // Calculate intervals
        // Assumption: Consumption between P1 and P2 is equal to the amount filled at P2.
        for (let i = 1; i < sorted.length; i++) {
            const prev = sorted[i - 1];
            const curr = sorted[i];

            const days = (new Date(curr.date).getTime() - new Date(prev.date).getTime()) / (1000 * 3600 * 24);
            if (days <= 0) continue;

            totalDays += days;
            totalLitersConsumed += curr.liters; // The amount we had to put in to make it full again
            totalCost += (curr.liters * (curr.pricePer100L / 100)); // Cost of that refill
        }

        if (totalDays === 0) return null;

        const avgLitersPerDay = totalLitersConsumed / totalDays;
        const avgPricePer100L = totalCost / (totalLitersConsumed / 100);

        return {
            avgLitersPerYear: avgLitersPerDay * 365,
            avgCostPerYear: (avgLitersPerDay * 365) * (avgPricePer100L / 100)
        };
    }, [oilPurchases]);

    // Strom Statistik
    const electricityStats = useMemo(() => {
        if (!electricityReadings || electricityReadings.length < 2) return null;

        const sorted = [...electricityReadings].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        let totalUsageHT = 0;
        let totalUsageNT = 0;
        let totalDays = 0;

        // Preise in CHF umrechnen (Eingabe ist in Rp.)
        const priceHT = (electricityPriceHT || 0) / 100;
        const priceNT = (electricityPriceNT || 0) / 100;

        for (let i = 1; i < sorted.length; i++) {
            const prev = sorted[i - 1];
            const curr = sorted[i];

            const days = (new Date(curr.date).getTime() - new Date(prev.date).getTime()) / (1000 * 3600 * 24);
            if (days <= 0) continue;

            const usageHT = curr.valueHT - prev.valueHT;
            const usageNT = curr.valueNT - prev.valueNT;

            // Ignore resets or negative usage (meter replacement/rollover not handled for simplicity unless explicit)
            if (usageHT >= 0) totalUsageHT += usageHT;
            if (usageNT >= 0) totalUsageNT += usageNT;

            totalDays += days;
        }

        if (totalDays === 0) return null;

        // Annualize
        const avgUsageHTPerDay = totalUsageHT / totalDays;
        const avgUsageNTPerDay = totalUsageNT / totalDays;

        const annualUsageHT = avgUsageHTPerDay * 365;
        const annualUsageNT = avgUsageNTPerDay * 365;

        const annualCostHT = annualUsageHT * priceHT;
        const annualCostNT = annualUsageNT * priceNT;

        return {
            annualUsageHT,
            annualUsageNT,
            annualCost: annualCostHT + annualCostNT,
            avgCostHT: annualCostHT,
            avgCostNT: annualCostNT
        };
    }, [electricityReadings, electricityPriceHT, electricityPriceNT]);

    // Water Statistics
    const waterStats = useMemo(() => {
        if (!waterHistory || waterHistory.length === 0) return null;

        const totalCost = waterHistory.reduce((sum, entry) => sum + entry.costTotal, 0);
        const avgCostPerYear = totalCost / waterHistory.length;

        // Calculate average usage just for completeness (optional)
        const totalUsage = waterHistory.reduce((sum, entry) => sum + entry.usage, 0);
        const avgUsagePerYear = totalUsage / waterHistory.length;

        return {
            avgCostPerYear,
            avgUsagePerYear
        };
    }, [waterHistory]);

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

    const totalMonthlyCost = monthlyData.interest
        + monthlyData.amortization
        + monthlyData.maintenance
        + ((oilStats?.avgCostPerYear || 0) / 12)
        + ((electricityStats?.annualCost || 0) / 12)
        + ((waterStats?.avgCostPerYear || 0) / 12);

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
            return formatCHF(amount, 2);
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
                showFoot: 'lastPage' as const,
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
                { content: 'Posten', styles: { halign: 'left' as const } },
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
                { content: 'Total Einnahmen ø Mtl.', styles: { halign: 'left' as const } },
                { content: '', styles: { halign: 'right' as const } },
                { content: formatCurrencyPDF(totalIncomeMonthly), styles: { halign: 'right' as const } }
            ]
        ];

        autoTable(doc, getTableOptions(38, headers, incomeData, [16, 185, 129], incomeFooter));

        // Property & Finance Section
        let finalY = (doc as any).lastAutoTable.finalY + 8;
        doc.setFontSize(12);
        doc.text('Immobilie & Finanzierung', 14, finalY);

        const propertyData = [
            ['Immobilienwert', '', formatCurrencyPDF(propertyValue)],
            ['Unterhalt & Nebenkosten', `${maintenanceRate}%`, formatCurrencyPDF(yearlyMaintenance)],
            ['Amortisation (Jährlich)', '', formatCurrencyPDF(yearlyAmortization)]
        ];

        const propertyHeaders = [
            [
                { content: 'Eigenschaft', styles: { halign: 'left' as const } },
                { content: 'Details', styles: { halign: 'right' as const } },
                { content: 'Betrag (Jahr)', styles: { halign: 'right' as const } }
            ]
        ];

        autoTable(doc, getTableOptions(finalY + 3, propertyHeaders, propertyData, [75, 85, 99]));

        // Mortgage Tranches
        finalY = (doc as any).lastAutoTable.finalY + 5;
        const mortgageData = tranches.map((t, idx) => [
            `${idx + 1}. Hypothek`,
            `${t.rate.toFixed(2)}%`,
            formatCurrencyPDF(t.amount)
        ]);

        const mortgageHeaders = [
            [
                { content: 'Tranche', styles: { halign: 'left' as const } },
                { content: 'Zins', styles: { halign: 'right' as const } },
                { content: 'Betrag', styles: { halign: 'right' as const } }
            ]
        ];

        const mortgageFooter = [
            [
                { content: 'Total Schulden / Mischzins', styles: { halign: 'left' as const } },
                { content: `${weightedRate.toFixed(2)}%`, styles: { halign: 'right' as const } },
                { content: formatCurrencyPDF(totalDebt), styles: { halign: 'right' as const } }
            ]
        ];

        autoTable(doc, getTableOptions(finalY + 3, mortgageHeaders, mortgageData, [75, 85, 99], mortgageFooter));

        // Expenses Table (Combined Auto + Budget)
        finalY = (doc as any).lastAutoTable.finalY + 8;
        if (finalY > 230) {
            doc.addPage();
            finalY = 20;
        }
        doc.setFontSize(12);
        doc.text('Ausgaben Budget (inkl. Auto)', 14, finalY);

        const combinedExpenseData = [
            ...sortedAutoCosts.map(item => [
                item.name || 'Auto: Unbenannt',
                (item.frequency || 'monthly') === 'monthly' ? 'Monatlich' : 'Jährlich',
                formatCurrencyPDF(item.amount)
            ]),
            ...sortedBudgetItems.map(item => [
                item.name || 'Unbenannt',
                (item.frequency || 'monthly') === 'monthly' ? 'Monatlich' : 'Jährlich',
                formatCurrencyPDF(item.amount)
            ])
        ];

        const expenseHeaders = [
            [
                { content: 'Posten', styles: { halign: 'left' as const } },
                { content: 'Frequenz', styles: { halign: 'right' as const } },
                { content: 'Betrag', styles: { halign: 'right' as const } }
            ]
        ];

        const expenseFooter = [
            [
                { content: 'Total Ausgaben ø Mtl.', styles: { halign: 'left' as const } },
                { content: '', styles: { halign: 'right' as const } },
                { content: formatCurrencyPDF(totalExpensesMonthly + totalAutoCostsMonthly), styles: { halign: 'right' as const } }
            ]
        ];

        autoTable(doc, getTableOptions(finalY + 3, expenseHeaders, combinedExpenseData, [59, 130, 246], expenseFooter));

        // Summary Table
        finalY = (doc as any).lastAutoTable.finalY + 12;
        if (finalY > 180) {
            doc.addPage();
            finalY = 20;
        }
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
            ['Hypothekarzinsen', formatCurrencyPDF(yearlyInterest / 12)],
            ['Amortisation', formatCurrencyPDF(yearlyAmortization / 12)],
            ['Unterhalt & Nebenkosten %', formatCurrencyPDF(yearlyMaintenance / 12)],
            ['Heizöl Kosten', formatCurrencyPDF((oilStats?.avgCostPerYear || 0) / 12)],
            ['Strom Kosten', formatCurrencyPDF((electricityStats?.annualCost || 0) / 12)],
            ['Wasser Kosten', formatCurrencyPDF((waterStats?.avgCostPerYear || 0) / 12)],
            ['Budget Ausgaben (inkl. Auto)', formatCurrencyPDF(totalExpensesMonthly + totalAutoCostsMonthly)],
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
            ['Hypothekarzinsen', formatCurrencyPDF(yearlyInterest)],
            ['Amortisation', formatCurrencyPDF(yearlyAmortization)],
            ['Unterhalt & Nebenkosten %', formatCurrencyPDF(yearlyMaintenance)],
            ['Heizöl Kosten', formatCurrencyPDF(oilStats?.avgCostPerYear || 0)],
            ['Strom Kosten', formatCurrencyPDF(electricityStats?.annualCost || 0)],
            ['Wasser Kosten', formatCurrencyPDF(waterStats?.avgCostPerYear || 0)],
            ['Budget Ausgaben (inkl. Auto)', formatCurrencyPDF((totalExpensesMonthly + totalAutoCostsMonthly) * 12)],
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
        <div className="p-4 md:p-6 space-y-6 bg-gradient-to-br from-background via-background to-muted/20 pb-24">
            {/* Sticky Header - Matched to Portfolio/Watchlist/Dividenden design */}
            <div className="sticky top-0 z-50 bg-background pb-4 -mt-4 -mx-4 px-4 md:-mt-6 md:-mx-6 md:px-6">
                <div className="border-b bg-card rounded-t-xl -mx-4 md:-mx-6">
                    <div className="w-full pl-14 pr-4 py-4 md:px-6 md:pl-14 lg:pl-6">
                        <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3">
                                <div className="p-3 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 text-amber-600 dark:text-amber-400">
                                    <Wallet className="size-6" />
                                </div>
                                <div>
                                    <h1 className="text-3xl font-bold tracking-tight">Budget Planer</h1>
                                    <p className="text-muted-foreground hidden md:block">Optimieren Sie Ihre Hypotheken und berechnen Sie die monatliche Tragbarkeit.</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
                {/* LEFT COLUMN: INPUTS */}
                <div className="space-y-6">


                    {/* NEW: Income Plan */}
                    <div className="bg-card rounded-xl border border-border overflow-hidden shadow-sm">
                        <div className="p-6 border-b border-border flex justify-between items-center cursor-pointer hover:bg-muted/30 transition-colors" onClick={() => setIsIncomeOpen(!isIncomeOpen)}>
                            <h2 className="text-lg font-semibold flex items-center gap-2">
                                <Wallet className="size-5 text-emerald-500" />
                                Einnahmen
                                {isIncomeOpen ? <ChevronUp className="size-4 text-muted-foreground" /> : <ChevronDown className="size-4 text-muted-foreground" />}
                            </h2>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    const newItems = [...(incomeItems || []), { id: crypto.randomUUID(), name: '', amount: 0, frequency: 'monthly' as const }];
                                    updateMortgageData({ incomeItems: newItems });
                                }}
                                className="text-sm bg-primary/10 text-primary hover:bg-primary/20 px-3 py-1.5 rounded-md font-medium transition-colors flex items-center gap-1"
                            >
                                <Plus className="size-4" /> Eingabe
                            </button>
                        </div>
                        {isIncomeOpen && (
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
                                    Total: {formatCHF(
                                        (incomeItems || []).reduce((sum: number, i: BudgetEntry) => {
                                            const monthlyAmount = i.frequency === 'yearly' ? i.amount / 12 : i.amount;
                                            return sum + monthlyAmount;
                                        }, 0)
                                    )} / Mt
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Property & Maintenance */}
                    <div className="bg-card rounded-xl border border-border overflow-hidden shadow-sm">
                        <div className="p-6 border-b border-border flex justify-between items-center cursor-pointer hover:bg-muted/30 transition-colors" onClick={() => setIsPropertyOpen(!isPropertyOpen)}>
                            <h2 className="text-lg font-semibold flex items-center gap-2">
                                <Building className="size-5 text-primary" />
                                Immobilie & Nebenkosten
                                {isPropertyOpen ? <ChevronUp className="size-4 text-muted-foreground" /> : <ChevronDown className="size-4 text-muted-foreground" />}
                            </h2>
                        </div>
                        {isPropertyOpen && (
                            <div className="p-6 space-y-4">

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
                                            ≈ {formatCHF(yearlyMaintenance / 12)} / Monat
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
                                        <div className="grid gap-6 sm:grid-cols-2 pt-2 border-t border-border/50">
                                            <div className="flex justify-between items-center text-xs">
                                                <span className="text-muted-foreground">Monatlicher Unterhalt</span>
                                                <span className="font-mono font-bold text-amber-500">{formatCHF(yearlyMaintenance / 12)}</span>
                                            </div>
                                            <div className="flex justify-between items-center text-xs">
                                                <span className="text-muted-foreground">Monatliche Amortisation</span>
                                                <span className="font-mono font-bold text-emerald-500">{formatCHF(yearlyAmortization / 12)}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>


                    {/* Mortgage Tranches */}
                    <div className="bg-card rounded-xl border border-border overflow-hidden shadow-sm">
                        <div className="p-6 border-b border-border flex justify-between items-center cursor-pointer hover:bg-muted/30 transition-colors" onClick={() => setIsFinanceOpen(!isFinanceOpen)}>
                            <h2 className="text-lg font-semibold flex items-center gap-2">
                                <Landmark className="size-5 text-primary" />
                                Hypotheken
                                {isFinanceOpen ? <ChevronUp className="size-4 text-muted-foreground" /> : <ChevronDown className="size-4 text-muted-foreground" />}
                            </h2>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    addTranche();
                                }}
                                className="text-sm bg-primary/10 text-primary hover:bg-primary/20 px-3 py-1.5 rounded-md font-medium transition-colors flex items-center gap-1"
                            >
                                <Plus className="size-4" /> Eingabe
                            </button>
                        </div>
                        {isFinanceOpen && (
                            <div className="p-6 space-y-4">
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

                                <div className="space-y-2 mt-4 pt-4 border-t border-border">
                                    <div className="flex justify-between items-center text-sm px-2">
                                        <span className="text-muted-foreground font-semibold">Total Hypothekardschuld</span>
                                        <span className="font-mono font-bold text-base">
                                            {formatCHF(totalDebt)}
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-center text-sm px-2 bg-blue-500/5 py-1.5 rounded-lg border border-blue-500/10 mb-2">
                                        <div className="flex items-center gap-2">
                                            <Percent className="size-3.5 text-blue-500" />
                                            <span className="text-blue-700 dark:text-blue-400 font-semibold">Hypothekarzinsen</span>
                                        </div>
                                        <span className="font-mono font-bold text-blue-600 dark:text-blue-400">
                                            {formatCHF(yearlyInterest / 12)} / Mt
                                        </span>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4 mt-2 px-2">
                                        <div className="bg-accent/20 rounded-lg p-3 border border-border/50">
                                            <div className="text-[10px] uppercase font-bold text-muted-foreground mb-1">Belehnung (LTV)</div>
                                            <div className={cn("text-lg font-bold font-mono", ltv > 80 ? "text-destructive" : ltv > 66 ? "text-amber-500" : "text-emerald-500")}>
                                                {ltv.toFixed(1)}%
                                            </div>
                                            <div className="text-[10px] text-muted-foreground leading-tight mt-0.5">
                                                {ltv > 80 ? "Kritisch (>80%)" : ltv > 66 ? "2. Hypothek (>66%)" : "1. Hypothek (≤66%)"}
                                            </div>
                                        </div>
                                        <div className="bg-accent/20 rounded-lg p-3 border border-border/50">
                                            <div className="text-[10px] uppercase font-bold text-muted-foreground mb-1">Mischzinssatz</div>
                                            <div className="text-lg font-bold text-foreground font-mono">
                                                {weightedRate.toFixed(2)}%
                                            </div>
                                            <div className="text-[10px] text-muted-foreground leading-tight mt-0.5">
                                                Gewichtet nach Betrag
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
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
                                    <Plus className="size-4" /> Eingabe
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
                                        <span className="font-mono">{new Intl.NumberFormat('de-CH', { style: 'currency', currency: 'CHF', maximumFractionDigits: 0 }).format(monthlyData.interest + monthlyData.amortization + monthlyData.maintenance)} / Mt</span>
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
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-muted-foreground">Heizöl (ø Monatlich)</span>
                                        <span className="font-mono text-orange-600 dark:text-orange-400">
                                            {new Intl.NumberFormat('de-CH', { style: 'currency', currency: 'CHF', maximumFractionDigits: 0 }).format((oilStats?.avgCostPerYear || 0) / 12)} / Mt
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-muted-foreground">Strom (ø Monatlich)</span>
                                        <span className="font-mono text-yellow-600 dark:text-yellow-400">
                                            {new Intl.NumberFormat('de-CH', { style: 'currency', currency: 'CHF', maximumFractionDigits: 0 }).format((electricityStats?.annualCost || 0) / 12)} / Mt
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-muted-foreground">Wasser (ø Monatlich)</span>
                                        <span className="font-mono text-blue-600 dark:text-blue-400">
                                            {new Intl.NumberFormat('de-CH', { style: 'currency', currency: 'CHF', maximumFractionDigits: 0 }).format((waterStats?.avgCostPerYear || 0) / 12)} / Mt
                                        </span>
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
                                <Plus className="size-4" /> Eingabe
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
                                    Total: {formatCHF(
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
                                                    {formatCHF(calculatedMonthlyFuelCost)} / Mt
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

                    {/* NEW: Heizungskosten Card */}
                    <div className="bg-card rounded-xl border border-border overflow-hidden shadow-sm">
                        <div className="p-6 border-b border-border flex justify-between items-center cursor-pointer hover:bg-muted/30 transition-colors" onClick={() => setIsHeatingCalcOpen(!isHeatingCalcOpen)}>
                            <h2 className="text-lg font-semibold flex items-center gap-2">
                                <Fuel className="size-5 text-orange-500" />
                                Heizöl Kosten
                                {isHeatingCalcOpen ? <ChevronUp className="size-4 text-muted-foreground" /> : <ChevronDown className="size-4 text-muted-foreground" />}
                            </h2>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    const newPurchase: OilPurchase = {
                                        id: crypto.randomUUID(),
                                        date: new Date().toISOString().split('T')[0], // Default to today
                                        liters: 0,
                                        pricePer100L: 0
                                    };
                                    updateMortgageData({ oilPurchases: [...(oilPurchases || []), newPurchase] });
                                    if (!isHeatingCalcOpen) setIsHeatingCalcOpen(true);
                                }}
                                className="text-sm bg-primary/10 text-primary hover:bg-primary/20 px-3 py-1.5 rounded-md font-medium transition-colors flex items-center gap-1"
                            >
                                <Plus className="size-4" /> Eingabe
                            </button>
                        </div>
                        {isHeatingCalcOpen && (
                            <div className="p-6 border-b border-border space-y-4">
                                {/* Tank Info */}
                                <div className="flex items-center gap-2 text-sm">
                                    <label className="text-muted-foreground">Tank Kapazität (L):</label>
                                    <DecimalInput
                                        value={oilTankCapacity || 5000}
                                        onChange={(val) => updateMortgageData({ oilTankCapacity: parseFloat(val) || 0 })}
                                        className="w-24 bg-background border border-input rounded px-2 py-1 h-7 font-mono"
                                    />
                                </div>

                                {/* Purchases Table */}
                                <div className="space-y-2">
                                    <div className="grid grid-cols-12 gap-2 text-[10px] uppercase font-semibold text-muted-foreground mb-1 px-2">
                                        <div className="col-span-3">Datum</div>
                                        <div className="col-span-3 text-right">Liter</div>
                                        <div className="col-span-3 text-right">CHF / 100L</div>
                                        <div className="col-span-2 text-right">Total</div>
                                        <div className="col-span-1"></div>
                                    </div>

                                    <div className="space-y-2">
                                        {(oilPurchases || []).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()).map((purchase) => (
                                            <div key={purchase.id} className="grid grid-cols-12 gap-2 items-center bg-accent/30 p-2 rounded border border-border/50 text-sm">
                                                <div className="col-span-3">
                                                    <input
                                                        type="date"
                                                        value={purchase.date}
                                                        onChange={(e) => {
                                                            const newPurchases = (oilPurchases || []).map(p => p.id === purchase.id ? { ...p, date: e.target.value } : p);
                                                            updateMortgageData({ oilPurchases: newPurchases });
                                                        }}
                                                        className="w-full bg-background border border-input rounded px-2 py-1 text-xs h-7"
                                                    />
                                                </div>
                                                <div className="col-span-3 flex justify-end">
                                                    <div className="w-24 relative">
                                                        <DecimalInput
                                                            value={purchase.liters}
                                                            onChange={(val) => {
                                                                const newPurchases = (oilPurchases || []).map(p => p.id === purchase.id ? { ...p, liters: parseFloat(val) || 0 } : p);
                                                                updateMortgageData({ oilPurchases: newPurchases });
                                                            }}
                                                            className="w-full bg-background border border-input rounded px-2 py-1 text-xs h-7 pr-6 text-right"
                                                        />
                                                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">L</span>
                                                    </div>
                                                </div>
                                                <div className="col-span-3 flex justify-end">
                                                    <div className="w-24 relative">
                                                        <div className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">CHF</div>
                                                        <DecimalInput
                                                            value={purchase.pricePer100L}
                                                            onChange={(val) => {
                                                                const newPurchases = (oilPurchases || []).map(p => p.id === purchase.id ? { ...p, pricePer100L: parseFloat(val) || 0 } : p);
                                                                updateMortgageData({ oilPurchases: newPurchases });
                                                            }}
                                                            className="w-full bg-background border border-input rounded px-2 py-1 text-xs h-7 pl-8 text-right bg-transparent"
                                                        />
                                                    </div>
                                                </div>
                                                <div className="col-span-2 text-right font-mono font-medium text-xs">
                                                    CHF {(purchase.liters * (purchase.pricePer100L / 100)).toFixed(0)}
                                                </div>
                                                <div className="col-span-1 flex justify-end">
                                                    <button
                                                        onClick={() => {
                                                            const newPurchases = oilPurchases?.filter(p => p.id !== purchase.id);
                                                            updateMortgageData({ oilPurchases: newPurchases });
                                                        }}
                                                        className="text-muted-foreground hover:text-destructive"
                                                    >
                                                        <Trash2 className="size-3" />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                        {(oilPurchases || []).length === 0 && (
                                            <div className="text-center text-sm text-muted-foreground py-4 border border-dashed rounded-lg">
                                                Noch keine Einkäufe erfasst.
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Statistics */}
                                {oilStats ? (
                                    <div className="mt-4 pt-4 border-t border-border space-y-2">
                                        <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-2">Statistik (Ø Jährlich)</h4>
                                        <div className="flex justify-between items-center bg-emerald-500/10 p-2 rounded">
                                            <span className="text-sm">Ø Verbrauch:</span>
                                            <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                                                {Math.round(oilStats.avgLitersPerYear).toLocaleString('de-CH')} L / Jahr
                                            </span>
                                        </div>
                                        <div className="flex justify-between items-center bg-amber-500/10 p-2 rounded">
                                            <span className="text-sm">Ø Kosten:</span>
                                            <span className="font-mono font-bold text-amber-600 dark:text-amber-400">
                                                {formatCHF(oilStats.avgCostPerYear)} / Jahr
                                            </span>
                                        </div>
                                        <div className="text-right text-xs text-muted-foreground mt-1">
                                            (ca. {formatCHF(oilStats.avgCostPerYear / 12)} / Monat)
                                        </div>
                                        <p className="text-[10px] text-muted-foreground italic mt-2">
                                            Basierend auf {oilPurchases?.length} Füllungen. Berechnung nimmt an, dass Tank immer voll gefüllt wird.
                                        </p>
                                    </div>
                                ) : (
                                    <p className="text-xs text-muted-foreground italic mt-4 text-center">
                                        Erfassen Sie mindestens 2 Einkäufe für Statistiken.
                                    </p>
                                )}
                            </div>
                        )}
                    </div>

                    {/* NEW: Strom Kosten Card */}
                    <div className="bg-card rounded-xl border border-border overflow-hidden shadow-sm">
                        <div className="p-6 border-b border-border flex justify-between items-center cursor-pointer hover:bg-muted/30 transition-colors" onClick={() => setIsElectricityOpen(!isElectricityOpen)}>
                            <h2 className="text-lg font-semibold flex items-center gap-2">
                                <Zap className="size-5 text-yellow-500" />
                                Strom Kosten
                                {isElectricityOpen ? <ChevronUp className="size-4 text-muted-foreground" /> : <ChevronDown className="size-4 text-muted-foreground" />}
                            </h2>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    const newReading: ElectricityReading = {
                                        id: crypto.randomUUID(),
                                        date: new Date().toISOString().split('T')[0],
                                        valueHT: 0,
                                        valueNT: 0
                                    };
                                    updateMortgageData({ electricityReadings: [...(electricityReadings || []), newReading] });
                                    if (!isElectricityOpen) setIsElectricityOpen(true);
                                }}
                                className="text-sm bg-primary/10 text-primary hover:bg-primary/20 px-3 py-1.5 rounded-md font-medium transition-colors flex items-center gap-1"
                            >
                                <Plus className="size-4" /> Eingabe
                            </button>
                        </div>
                        {isElectricityOpen && (
                            <div className="p-6 border-b border-border space-y-6">

                                {/* Metadata Section (Kundennummer, etc.) */}
                                <div className="grid grid-cols-3 gap-4 bg-accent/20 p-3 rounded-lg border border-border/50">
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground uppercase font-semibold">
                                            <User className="size-3" />
                                            Kundennummer
                                        </div>
                                        <input
                                            type="text"
                                            value={electricityCustomerNumber || ''}
                                            onChange={(e) => updateMortgageData({ electricityCustomerNumber: e.target.value })}
                                            onFocus={(e) => e.target.select()}
                                            className="w-full bg-background border border-input rounded px-2 py-1.5 text-sm font-medium focus:ring-1 focus:ring-primary"
                                            placeholder="z.B. 129865"
                                        />
                                    </div>
                                    <div className="space-y-1 border-l border-border/50 pl-4">
                                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground uppercase font-semibold">
                                            <FileText className="size-3" />
                                            Vertragskonto
                                        </div>
                                        <input
                                            type="text"
                                            value={electricityContractNumber || ''}
                                            onChange={(e) => updateMortgageData({ electricityContractNumber: e.target.value })}
                                            onFocus={(e) => e.target.select()}
                                            className="w-full bg-background border border-input rounded px-2 py-1.5 text-sm font-medium focus:ring-1 focus:ring-primary"
                                            placeholder="z.B. 530160"
                                        />
                                    </div>
                                    <div className="space-y-1 border-l border-border/50 pl-4">
                                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground uppercase font-semibold">
                                            <Gauge className="size-3" />
                                            Zähler
                                        </div>
                                        <input
                                            type="text"
                                            value={electricityMeterNumber || ''}
                                            onChange={(e) => updateMortgageData({ electricityMeterNumber: e.target.value })}
                                            onFocus={(e) => e.target.select()}
                                            className="w-full bg-background border border-input rounded px-2 py-1.5 text-sm font-medium focus:ring-1 focus:ring-primary"
                                            placeholder="z.B. 53212"
                                        />
                                    </div>
                                </div>

                                {/* Price Inputs */}
                                <div className="grid grid-cols-2 gap-4 bg-accent/30 p-3 rounded-lg border border-border/50">
                                    <div className="space-y-1">
                                        <label className="text-sm font-medium text-foreground block">
                                            Hochtarif (Total) <span className="opacity-70 text-xs font-normal text-muted-foreground block">Energie + Netz + Abgaben</span>
                                        </label>
                                        <div className="relative w-[140px]">
                                            <DecimalInput
                                                value={electricityPriceHT || 0}
                                                onChange={(val) => updateMortgageData({ electricityPriceHT: parseFloat(val) || 0 })}
                                                className="w-full bg-background border border-input rounded px-3 py-2 pl-3 pr-16 text-base"
                                            />
                                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">Rp./kWh</span>
                                        </div>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-sm font-medium text-foreground block">
                                            Niedertarif (Total) <span className="opacity-70 text-xs font-normal text-muted-foreground block">Energie + Netz + Abgaben</span>
                                        </label>
                                        <div className="relative w-[140px]">
                                            <DecimalInput
                                                value={electricityPriceNT || 0}
                                                onChange={(val) => updateMortgageData({ electricityPriceNT: parseFloat(val) || 0 })}
                                                className="w-full bg-background border border-input rounded px-3 py-2 pl-3 pr-16 text-base"
                                            />
                                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">Rp./kWh</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Reading List */}
                                <div className="space-y-2 pt-2">
                                    <div className="grid grid-cols-12 gap-2 text-xs uppercase font-semibold text-muted-foreground mb-1 px-2">
                                        <div className="col-span-4">Datum</div>
                                        <div className="col-span-3 text-right">HT Stand</div>
                                        <div className="col-span-3 text-right">NT Stand</div>
                                        <div className="col-span-1"></div>
                                    </div>

                                    <div className="space-y-2">
                                        {(electricityReadings || []).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()).map((reading) => (
                                            <div key={reading.id} className="grid grid-cols-12 gap-2 items-center bg-accent/30 p-2 rounded border border-border/50 text-base">
                                                <div className="col-span-4">
                                                    <input
                                                        type="date"
                                                        value={reading.date}
                                                        onChange={(e) => {
                                                            const newReadings = (electricityReadings || []).map(r => r.id === reading.id ? { ...r, date: e.target.value } : r);
                                                            updateMortgageData({ electricityReadings: newReadings });
                                                        }}
                                                        className="w-full bg-background border border-input rounded px-3 py-1.5 text-sm h-9"
                                                    />
                                                </div>
                                                <div className="col-span-3">
                                                    <DecimalInput
                                                        value={reading.valueHT}
                                                        onChange={(val) => {
                                                            const newReadings = (electricityReadings || []).map(r => r.id === reading.id ? { ...r, valueHT: parseFloat(val) || 0 } : r);
                                                            updateMortgageData({ electricityReadings: newReadings });
                                                        }}
                                                        className="w-full bg-background border border-input rounded px-3 py-1.5 text-sm h-9 text-right"
                                                    />
                                                </div>
                                                <div className="col-span-3">
                                                    <DecimalInput
                                                        value={reading.valueNT}
                                                        onChange={(val) => {
                                                            const newReadings = (electricityReadings || []).map(r => r.id === reading.id ? { ...r, valueNT: parseFloat(val) || 0 } : r);
                                                            updateMortgageData({ electricityReadings: newReadings });
                                                        }}
                                                        className="w-full bg-background border border-input rounded px-3 py-1.5 text-sm h-9 text-right"
                                                    />
                                                </div>
                                                <div className="col-span-1 flex justify-end">
                                                    <button
                                                        onClick={() => {
                                                            const newReadings = electricityReadings?.filter(r => r.id !== reading.id);
                                                            updateMortgageData({ electricityReadings: newReadings });
                                                        }}
                                                        className="text-muted-foreground hover:text-destructive"
                                                    >
                                                        <Trash2 className="size-4" />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                        {(electricityReadings || []).length === 0 && (
                                            <div className="text-center text-sm text-muted-foreground py-6 border border-dashed rounded-lg">
                                                Noch keine Zählerstände erfasst.
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Current Reading Display (Latest) */}
                                {electricityReadings && electricityReadings.length > 0 && (() => {
                                    const sortedReadings = [...electricityReadings].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
                                    const latest = sortedReadings[0];
                                    return (
                                        <div className="mt-6 border-t border-border pt-4">
                                            <h4 className="text-xl font-semibold mb-4 text-foreground">Aktueller Zählerstand</h4>

                                            <div className="space-y-3 font-medium">
                                                <div className="flex items-center justify-between bg-muted/30 p-1 rounded-md">
                                                    <span className="text-muted-foreground w-32 text-right pr-4 text-base">Stand HT</span>
                                                    <div className="flex-1 flex justify-center">
                                                        <DecimalInput
                                                            value={latest.valueHT}
                                                            onChange={(val) => {
                                                                const newReadings = electricityReadings.map(r => r.id === latest.id ? { ...r, valueHT: parseFloat(val) || 0 } : r);
                                                                updateMortgageData({ electricityReadings: newReadings });
                                                            }}
                                                            onFocus={(e) => e.target.select()}
                                                            className="bg-[#a3cc29] text-white px-2 py-1 rounded text-lg font-mono tracking-wider shadow-sm w-[140px] text-center border-none focus:ring-2 focus:ring-primary outline-none"
                                                        />
                                                    </div>
                                                    <span className="text-muted-foreground w-16 pl-2 text-base">kWh</span>
                                                </div>

                                                <div className="flex items-center justify-between bg-muted/30 p-1 rounded-md">
                                                    <span className="text-muted-foreground w-32 text-right pr-4 text-base">Stand NT</span>
                                                    <div className="flex-1 flex justify-center">
                                                        <DecimalInput
                                                            value={latest.valueNT}
                                                            onChange={(val) => {
                                                                const newReadings = electricityReadings.map(r => r.id === latest.id ? { ...r, valueNT: parseFloat(val) || 0 } : r);
                                                                updateMortgageData({ electricityReadings: newReadings });
                                                            }}
                                                            onFocus={(e) => e.target.select()}
                                                            className="bg-[#a3cc29] text-white px-2 py-1 rounded text-lg font-mono tracking-wider shadow-sm w-[140px] text-center border-none focus:ring-2 focus:ring-primary outline-none"
                                                        />
                                                    </div>
                                                    <span className="text-muted-foreground w-16 pl-2 text-base">kWh</span>
                                                </div>
                                            </div>

                                            <div className="mt-3 text-base text-foreground">
                                                Ablesedatum: <span className="font-medium">{new Date(latest.date).toLocaleDateString('de-CH')}</span>
                                            </div>
                                        </div>
                                    );
                                })()}

                                {/* Stats */}
                                {electricityStats ? (
                                    <div className="mt-8 pt-6 border-t border-border space-y-2">
                                        <h4 className="text-sm font-semibold uppercase text-muted-foreground mb-2">Statistik (Ø Jährlich)</h4>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="bg-yellow-500/10 p-3 rounded">
                                                <div className="text-sm text-muted-foreground">Verbrauch</div>
                                                <div className="text-lg font-bold text-yellow-600 dark:text-yellow-400">
                                                    {(electricityStats.annualUsageHT + electricityStats.annualUsageNT).toFixed(0)} kWh
                                                </div>
                                                <div className="text-xs text-muted-foreground">
                                                    HT: {electricityStats.annualUsageHT.toFixed(0)} / NT: {electricityStats.annualUsageNT.toFixed(0)}
                                                </div>
                                            </div>
                                            <div className="bg-yellow-500/10 p-3 rounded">
                                                <div className="text-sm text-muted-foreground">Kosten</div>
                                                <div className="text-lg font-bold text-yellow-600 dark:text-yellow-400">
                                                    {formatCHF(electricityStats.annualCost)}
                                                </div>
                                                <div className="text-xs text-muted-foreground">
                                                    HT: {electricityStats.avgCostHT.toFixed(0)} / NT: {electricityStats.avgCostNT.toFixed(0)}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="text-center text-sm text-muted-foreground mt-1">
                                            monatlich ca. {formatCHF(electricityStats.annualCost / 12)}
                                        </div>
                                    </div>
                                ) : (
                                    <p className="text-sm text-muted-foreground italic mt-6 text-center">
                                        Erfassen Sie mindestens 2 Zählerstände für Statistiken.
                                    </p>
                                )}
                            </div>
                        )}
                    </div>

                    {/* NEW: Wasser Kosten Card */}
                    <div className="bg-card rounded-xl border border-border overflow-hidden shadow-sm">
                        <div className="p-6 border-b border-border flex justify-between items-center cursor-pointer hover:bg-muted/30 transition-colors" onClick={() => setIsWaterOpen(!isWaterOpen)}>
                            <h2 className="text-lg font-semibold flex items-center gap-2">
                                <Droplets className="size-5 text-blue-500" />
                                Wasser Kosten
                                {isWaterOpen ? <ChevronUp className="size-4 text-muted-foreground" /> : <ChevronDown className="size-4 text-muted-foreground" />}
                            </h2>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    const newEntry = {
                                        id: crypto.randomUUID(),
                                        year: new Date().getFullYear(),
                                        messpunkt: '',
                                        usage: 0,
                                        costFresh: 0,
                                        costWaste: 0,
                                        costTotal: 0,
                                        date: new Date().toISOString()
                                    };
                                    updateMortgageData({ waterHistory: [...(waterHistory || []), newEntry] });
                                    if (!isWaterOpen) setIsWaterOpen(true);
                                }}
                                className="text-sm bg-primary/10 text-primary hover:bg-primary/20 px-3 py-1.5 rounded-md font-medium transition-colors flex items-center gap-1"
                            >
                                <Plus className="size-4" /> Eingabe
                            </button>
                        </div>
                        {isWaterOpen && (
                            <div className="p-6 border-b border-border space-y-6">
                                {/* Water History Table */}
                                <div className="space-y-2">

                                    {(waterHistory || []).length > 0 ? (
                                        <div className="space-y-2">
                                            <div className="flex gap-2 text-[10px] uppercase font-semibold text-muted-foreground mb-1 px-2">
                                                <div className="w-[130px]">Datum</div>
                                                <div className="w-[90px] text-right">Zählerstand</div>
                                                <div className="w-[70px] text-right">m³</div>
                                                <div className="w-[100px] text-right">Frischwasser</div>
                                                <div className="w-[100px] text-right">Abwasser</div>
                                                <div className="w-[100px] text-right">Total</div>
                                                <div className="w-[30px]"></div>
                                            </div>
                                            {(waterHistory || []).sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime()).map((entry: any) => (
                                                <div key={entry.id} className="flex gap-2 items-center bg-accent/30 p-2 rounded border border-border/50 text-sm">
                                                    <div className="w-[130px]">
                                                        <input
                                                            type="date"
                                                            value={entry.date}
                                                            onChange={(e) => {
                                                                const dateVal = e.target.value;
                                                                const newYear = dateVal ? parseInt(dateVal.split('-')[0]) : entry.year;
                                                                const newHistory = (waterHistory || []).map((h: any) => h.id === entry.id ? { ...h, date: dateVal, year: newYear } : h);
                                                                updateMortgageData({ waterHistory: newHistory });
                                                            }}
                                                            className="w-full bg-background border border-input rounded px-2 py-1.5 text-sm h-9"
                                                        />
                                                    </div>
                                                    <div className="w-[90px]">
                                                        <input
                                                            type="text"
                                                            value={entry.messpunkt}
                                                            onChange={(e) => {
                                                                const val = e.target.value.replace(/[^0-9]/g, '');
                                                                const newHistory = (waterHistory || []).map((h: any) => h.id === entry.id ? { ...h, messpunkt: val } : h);
                                                                updateMortgageData({ waterHistory: newHistory });
                                                            }}
                                                            maxLength={6}
                                                            className="w-full bg-background border border-input rounded px-2 py-1.5 text-sm h-9 text-right"
                                                        />
                                                    </div>
                                                    <div className="w-[70px]">
                                                        <input
                                                            type="text"
                                                            value={entry.usage}
                                                            onChange={(e) => {
                                                                const val = e.target.value.replace(/[^0-9]/g, '');
                                                                const newHistory = (waterHistory || []).map((h: any) => h.id === entry.id ? { ...h, usage: parseInt(val) || 0 } : h);
                                                                updateMortgageData({ waterHistory: newHistory });
                                                            }}
                                                            maxLength={5}
                                                            className="w-full bg-background border border-input rounded px-2 py-1.5 text-sm h-9 text-right"
                                                        />
                                                    </div>
                                                    <div className="w-[100px]">
                                                        <DecimalInput
                                                            value={entry.costFresh}
                                                            onChange={(val) => {
                                                                const newHistory = (waterHistory || []).map((h: any) => h.id === entry.id ? { ...h, costFresh: parseFloat(val) || 0 } : h);
                                                                updateMortgageData({ waterHistory: newHistory });
                                                            }}
                                                            className="w-full bg-background border border-input rounded px-2 py-1.5 text-sm h-9 text-right"
                                                        />
                                                    </div>
                                                    <div className="w-[100px]">
                                                        <DecimalInput
                                                            value={entry.costWaste}
                                                            onChange={(val) => {
                                                                const newHistory = (waterHistory || []).map((h: any) => h.id === entry.id ? { ...h, costWaste: parseFloat(val) || 0 } : h);
                                                                updateMortgageData({ waterHistory: newHistory });
                                                            }}
                                                            className="w-full bg-background border border-input rounded px-2 py-1.5 text-sm h-9 text-right"
                                                        />
                                                    </div>
                                                    <div className="w-[100px]">
                                                        <DecimalInput
                                                            value={entry.costTotal}
                                                            onChange={(val) => {
                                                                const newHistory = (waterHistory || []).map((h: any) => h.id === entry.id ? { ...h, costTotal: parseFloat(val) || 0 } : h);
                                                                updateMortgageData({ waterHistory: newHistory });
                                                            }}
                                                            className="w-full bg-background border border-input rounded px-2 py-1.5 text-sm h-9 text-right"
                                                        />
                                                    </div>
                                                    <div className="w-[30px] flex justify-end">
                                                        <button
                                                            onClick={() => {
                                                                const newHistory = waterHistory?.filter((e: any) => e.id !== entry.id);
                                                                updateMortgageData({ waterHistory: newHistory });
                                                            }}
                                                            className="text-muted-foreground hover:text-destructive p-1"
                                                        >
                                                            <Trash2 className="size-4" />
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="text-center text-sm text-muted-foreground py-6 border border-dashed rounded-lg">
                                            Noch keine Einträge erfasst.
                                        </div>
                                    )}
                                </div>

                                {/* Statistics */}
                                {(waterHistory || []).length > 0 && (() => {
                                    const sorted = [...(waterHistory || [])].sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
                                    const latest = sorted[0];
                                    return (
                                        <div className="mt-6 pt-6 border-t border-border space-y-2">
                                            <h4 className="text-sm font-semibold uppercase text-muted-foreground mb-2">Aktuellste Daten ({latest.year})</h4>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="bg-blue-500/10 p-3 rounded">
                                                    <div className="text-sm text-muted-foreground">Verbrauch</div>
                                                    <div className="text-lg font-bold text-blue-600 dark:text-blue-400">
                                                        {latest.usage.toFixed(1)} m³
                                                    </div>
                                                </div>
                                                <div className="bg-blue-500/10 p-3 rounded">
                                                    <div className="text-sm text-muted-foreground">Kosten</div>
                                                    <div className="text-lg font-bold text-blue-600 dark:text-blue-400">
                                                        {formatCHF(latest.costTotal)}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="text-center text-sm text-muted-foreground mt-1">
                                                monatlich ca. {formatCHF(latest.costTotal / 12)}
                                            </div>
                                        </div>
                                    );
                                })()}
                            </div>
                        )}
                    </div>

                </div>

                {/* RIGHT COLUMN: RESULTS */}
                <div className="space-y-6">

                    {/* Monthly Cost Breakdown */}
                    <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
                        <div className="p-6 border-b border-border">
                            <h2 className="text-lg font-semibold flex items-center gap-2">
                                <Calculator className="size-5 text-primary" />
                                Wohnkosten Liegenschaft
                            </h2>
                        </div>
                        <div className="p-6 space-y-6">
                            <div className="flex items-center justify-center py-2">
                                <div className="text-center">
                                    <div className="text-sm text-muted-foreground mb-1">Total pro Monat</div>
                                    <div className="text-4xl font-bold tracking-tight text-foreground font-mono">
                                        {formatCHF(totalMonthlyCost)}
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
                                    <span className="font-mono">{formatCHF(monthlyData.interest)}</span>
                                </div>
                                {/* Amortization Row */}
                                <div className="flex items-center justify-between text-sm">
                                    <div className="flex items-center gap-2">
                                        <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
                                        <span>Amortisation</span>
                                    </div>
                                    <span className="font-mono">{formatCHF(monthlyData.amortization)}</span>
                                </div>
                                {/* Maintenance Row */}
                                <div className="flex items-center justify-between text-sm">
                                    <div className="flex items-center gap-2">
                                        <div className="w-3 h-3 rounded-full bg-amber-500"></div>
                                        <span>Unterhalt & Nebenkosten</span>
                                    </div>
                                    <span className="font-mono">{formatCHF(monthlyData.maintenance)}</span>
                                </div>
                                {/* Utility Costs */}
                                {oilStats && (
                                    <div className="flex items-center justify-between text-sm">
                                        <div className="flex items-center gap-2">
                                            <div className="w-3 h-3 rounded-full bg-orange-500"></div>
                                            <span>Heizöl Kosten</span>
                                        </div>
                                        <span className="font-mono">{formatCHF(oilStats.avgCostPerYear / 12)}</span>
                                    </div>
                                )}
                                {electricityStats && (
                                    <div className="flex items-center justify-between text-sm">
                                        <div className="flex items-center gap-2">
                                            <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                                            <span>Strom Kosten</span>
                                        </div>
                                        <span className="font-mono">{formatCHF(electricityStats.annualCost / 12)}</span>
                                    </div>
                                )}
                                {waterStats && (
                                    <div className="flex items-center justify-between text-sm">
                                        <div className="flex items-center gap-2">
                                            <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                                            <span>Wasser Kosten</span>
                                        </div>
                                        <span className="font-mono">{formatCHF(waterStats.avgCostPerYear / 12)}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                        {/* Simple Visual Bar */}
                        <div className="h-4 w-full flex">
                            <div className="h-full bg-blue-500 w-[var(--width)]" style={{ '--width': `${(monthlyData.interest / totalMonthlyCost) * 100}%` } as React.CSSProperties}></div>
                            <div className="h-full bg-emerald-500 w-[var(--width)]" style={{ '--width': `${(monthlyData.amortization / totalMonthlyCost) * 100}%` } as React.CSSProperties}></div>
                            <div className="h-full bg-amber-500 w-[var(--width)]" style={{ '--width': `${(monthlyData.maintenance / totalMonthlyCost) * 100}%` } as React.CSSProperties}></div>
                            {oilStats && <div className="h-full bg-orange-500 w-[var(--width)]" style={{ '--width': `${(oilStats.avgCostPerYear / 12 / totalMonthlyCost) * 100}%` } as React.CSSProperties}></div>}
                            {electricityStats && <div className="h-full bg-yellow-500 w-[var(--width)]" style={{ '--width': `${(electricityStats.annualCost / 12 / totalMonthlyCost) * 100}%` } as React.CSSProperties}></div>}
                            {waterStats && <div className="h-full bg-blue-500 w-[var(--width)]" style={{ '--width': `${(waterStats.avgCostPerYear / 12 / totalMonthlyCost) * 100}%` } as React.CSSProperties}></div>}
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
                                            formatter={(value: number) => formatCHF(value)}
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
        </div >
    );
};
