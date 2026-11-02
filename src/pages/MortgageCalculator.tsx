import { LandscapeBackButton } from '../components/LandscapeBackButton';
import { useMemo, useState } from 'react';
import { Building, Calculator, Plus, Trash2, Landmark, Percent, Wallet, Download, Car, ChevronDown, ChevronUp, Fuel, Zap, User, FileText, Gauge, Droplets, Calendar, ReceiptText, TrendingUp } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { cn } from '../utils';
import { PieChart as RechartsPie, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, Legend } from 'recharts';

import { SaronChart } from '../components/SaronChart';
import { DecimalInput } from '../components/DecimalInput';
import { usePortfolio } from '../context/PortfolioContext';
import type { MortgageTranche, BudgetEntry, OilPurchase, ElectricityReading, ElectricityTariffConfig } from '../types';
import {
    DEFAULT_ELECTRICITY_TARIFF,
    calculateElectricityInvoice,
    calculatePeriodDays,
    getReadingUsage
} from '../utils/electricityCalculator';

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
    const [isElectricityTariffOpen, setIsElectricityTariffOpen] = useState(false);
    const [expandedInvoiceId, setExpandedInvoiceId] = useState<string | null>(null);
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

    // Strom Statistik & Tarif-Helper
    const electricityTariff = mortgageData.electricityTariff || DEFAULT_ELECTRICITY_TARIFF;

    const updateTariff = (field: keyof ElectricityTariffConfig, val: number) => {
        const updated = { ...(mortgageData.electricityTariff || DEFAULT_ELECTRICITY_TARIFF), [field]: val };
        const inv = calculateElectricityInvoice(100, 100, 1, updated);
        updateMortgageData({
            electricityTariff: updated,
            electricityPriceHT: inv.effectiveRateHTRp,
            electricityPriceNT: inv.effectiveRateNTRp
        });
    };

    const resetToEniwaTariff = () => {
        const inv = calculateElectricityInvoice(100, 100, 1, DEFAULT_ELECTRICITY_TARIFF);
        updateMortgageData({
            electricityTariff: { ...DEFAULT_ELECTRICITY_TARIFF },
            electricityPriceHT: inv.effectiveRateHTRp,
            electricityPriceNT: inv.effectiveRateNTRp
        });
    };

    const electricityStats = useMemo(() => {
        if (!electricityReadings || electricityReadings.length === 0) return null;

        const tariff = mortgageData.electricityTariff || DEFAULT_ELECTRICITY_TARIFF;
        const sorted = [...electricityReadings].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        let totalUsageHT = 0;
        let totalUsageNT = 0;
        let totalDays = 0;
        let totalCostRecorded = 0;

        for (let i = 0; i < sorted.length; i++) {
            const curr = sorted[i];
            const prev = i > 0 ? sorted[i - 1] : undefined;
            const { usageHT, usageNT } = getReadingUsage(curr, prev);

            let days = 0;
            let months = curr.billingMonths || 1;

            if (curr.dateFrom && curr.date) {
                const p = calculatePeriodDays(curr.dateFrom, curr.date);
                days = p.days;
                if (!curr.billingMonths) months = p.months;
            } else if (prev) {
                days = Math.max(1, Math.round((new Date(curr.date).getTime() - new Date(prev.date).getTime()) / (1000 * 3600 * 24)));
                months = Math.max(1, Math.round(days / 30.416));
            } else if (usageHT > 0 || usageNT > 0) {
                days = 33;
                months = 1;
            }

            if (days > 0 && (usageHT > 0 || usageNT > 0 || curr.costTotal)) {
                totalDays += days;
                totalUsageHT += usageHT;
                totalUsageNT += usageNT;
                const inv = calculateElectricityInvoice(usageHT, usageNT, months, tariff);
                totalCostRecorded += (curr.costTotal || inv.totalInclVat);
            }
        }

        if (totalDays === 0) return null;

        const avgUsageHTPerDay = totalUsageHT / totalDays;
        const avgUsageNTPerDay = totalUsageNT / totalDays;
        const annualUsageHT = avgUsageHTPerDay * 365;
        const annualUsageNT = avgUsageNTPerDay * 365;

        // Breakdown for annual cost based on tariff
        const annualInvoice = calculateElectricityInvoice(annualUsageHT, annualUsageNT, 12, tariff);

        return {
            annualUsageHT,
            annualUsageNT,
            annualCost: annualInvoice.totalInclVat,
            avgCostHT: annualInvoice.energyHTAmount + annualInvoice.gridHTAmount,
            avgCostNT: annualInvoice.energyNTAmount + annualInvoice.gridNTAmount,
            annualInvoice,
            totalDays
        };
    }, [electricityReadings, mortgageData.electricityTariff, electricityPriceHT, electricityPriceNT]);

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
        <div className="p-4 md:p-6 space-y-6 bg-gradient-to-br from-background via-background to-muted/20 pb-24 iphone-landscape-page-root">
            {/* Sticky Header - Matched to Portfolio/Watchlist/Dividenden design */}
            <div className="sticky top-0 z-50 bg-background pb-4 -mt-4 -mx-4 px-4 md:-mt-6 md:-mx-6 md:px-6 iphone-landscape-portfolio-header-wrap">
                <div className="border-b bg-card rounded-t-xl -mx-4 md:-mx-6">
                    <div className="w-full pl-14 pr-4 py-4 md:px-6 md:pl-14 xl:pl-6 iphone-landscape-portfolio-header-content">
                        <div className="flex items-center justify-between gap-3 iphone-landscape-portfolio-header-row">
                            <div className="flex items-center gap-3 iphone-landscape-portfolio-title-group">
                                <LandscapeBackButton />
                                <div className="p-3 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 text-amber-600 dark:text-amber-400 iphone-landscape-portfolio-icon">
                                    <Wallet className="size-6" />
                                </div>
                                <div>
                                    <h1 className="text-3xl font-bold tracking-tight iphone-landscape-portfolio-title">Budget Planer</h1>
                                    <p className="text-muted-foreground hidden md:block iphone-landscape-portfolio-subtitle">Optimieren Sie Ihre Hypotheken und berechnen Sie die monatliche Tragbarkeit.</p>
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
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        const sorted = electricityReadings && electricityReadings.length > 0
                                            ? [...electricityReadings].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                                            : [];
                                        const latest = sorted[0];

                                        const newReading: ElectricityReading = {
                                            id: crypto.randomUUID(),
                                            dateFrom: latest?.date || '2026-08-28',
                                            date: new Date().toISOString().split('T')[0],
                                            standAltHT: latest ? latest.valueHT : 473,
                                            standAltNT: latest ? latest.valueNT : 3108,
                                            valueHT: latest ? latest.valueHT : 542,
                                            valueNT: latest ? latest.valueNT : 3583,
                                            usageHT: latest ? 0 : 69,
                                            usageNT: latest ? 0 : 475,
                                            billingMonths: 1,
                                            invoiceNumber: ''
                                        };
                                        updateMortgageData({ electricityReadings: [...(electricityReadings || []), newReading] });
                                        if (!isElectricityOpen) setIsElectricityOpen(true);
                                    }}
                                    className="text-sm bg-primary/10 text-primary hover:bg-primary/20 px-3 py-1.5 rounded-md font-medium transition-colors flex items-center gap-1"
                                >
                                    <Plus className="size-4" /> Rechnung / Ablesung erfassen
                                </button>
                            </div>
                        </div>

                        {isElectricityOpen && (
                            <div className="p-6 border-b border-border space-y-6">

                                {/* 1. Metadata Section (Kundennummer, Vertragskonto, Zähler) */}
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-accent/20 p-3 rounded-lg border border-border/50">
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground uppercase font-semibold">
                                            <User className="size-3 text-primary" />
                                            Kundennummer
                                        </div>
                                        <input
                                            type="text"
                                            value={electricityCustomerNumber || ''}
                                            onChange={(e) => updateMortgageData({ electricityCustomerNumber: e.target.value })}
                                            onFocus={(e) => e.target.select()}
                                            className="w-full bg-background border border-input rounded px-2.5 py-1.5 text-sm font-medium focus:ring-1 focus:ring-primary"
                                            placeholder="z.B. 130584"
                                        />
                                    </div>
                                    <div className="space-y-1 md:border-l md:border-border/50 md:pl-4">
                                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground uppercase font-semibold">
                                            <FileText className="size-3 text-primary" />
                                            Vertragskonto
                                        </div>
                                        <input
                                            type="text"
                                            value={electricityContractNumber || ''}
                                            onChange={(e) => updateMortgageData({ electricityContractNumber: e.target.value })}
                                            onFocus={(e) => e.target.select()}
                                            className="w-full bg-background border border-input rounded px-2.5 py-1.5 text-sm font-medium focus:ring-1 focus:ring-primary"
                                            placeholder="z.B. 530879"
                                        />
                                    </div>
                                    <div className="space-y-1 md:border-l md:border-border/50 md:pl-4">
                                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground uppercase font-semibold">
                                            <Gauge className="size-3 text-primary" />
                                            Zähler-Nr.
                                        </div>
                                        <input
                                            type="text"
                                            value={electricityMeterNumber || ''}
                                            onChange={(e) => updateMortgageData({ electricityMeterNumber: e.target.value })}
                                            onFocus={(e) => e.target.select()}
                                            className="w-full bg-background border border-input rounded px-2.5 py-1.5 text-sm font-medium focus:ring-1 focus:ring-primary"
                                            placeholder="z.B. 1LGZ0188395373"
                                        />
                                    </div>
                                </div>

                                {/* 2. Tarif & Kostenpunkte (1:1 gemäss Stromrechnung / StromVG) */}
                                <div className="bg-card border border-border/80 rounded-xl overflow-hidden">
                                    <div
                                        className="p-3.5 bg-muted/40 flex items-center justify-between cursor-pointer hover:bg-muted/60 transition-colors"
                                        onClick={() => setIsElectricityTariffOpen(!isElectricityTariffOpen)}
                                    >
                                        <div className="flex items-center gap-2">
                                            <div className="size-7 rounded-lg bg-yellow-500/10 text-yellow-500 flex items-center justify-center font-bold">
                                                ⚡
                                            </div>
                                            <div>
                                                <div className="text-sm font-bold flex items-center gap-2">
                                                    Tarif-Kostenpunkte (gemäss Stromrechnung)
                                                    <span className="text-[11px] font-normal text-muted-foreground bg-background/80 border border-border/60 px-2 py-0.5 rounded-full">
                                                        Eniwa Naturstrom Schweiz
                                                    </span>
                                                </div>
                                                <div className="text-xs text-muted-foreground mt-0.5">
                                                    Effektiv: HT {(electricityTariff.energyHT + electricityTariff.gridHT + electricityTariff.gridSdl + electricityTariff.gridReserve + electricityTariff.gridSolidar + electricityTariff.communityFee + electricityTariff.federalFee).toFixed(2)} Rp. (+MwSt ~{((electricityTariff.energyHT + electricityTariff.gridHT + electricityTariff.gridSdl + electricityTariff.gridReserve + electricityTariff.gridSolidar + electricityTariff.communityFee + electricityTariff.federalFee) * 1.081).toFixed(1)} Rp./kWh) | Feste Monatskosten: CHF {((electricityTariff.gridBaseFee + electricityTariff.gridMeasurementFee) * 1.081).toFixed(2)}/Mt.
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    resetToEniwaTariff();
                                                }}
                                                className="text-xs bg-background border border-border hover:bg-muted px-2.5 py-1 rounded text-foreground font-medium transition-colors shadow-2xs"
                                                title="Setzt die Standard-Kostenpunkte von Eniwa zurück"
                                            >
                                                Standard Eniwa Werte laden
                                            </button>
                                            <div className="p-1 text-muted-foreground">
                                                {isElectricityTariffOpen ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                                            </div>
                                        </div>
                                    </div>

                                    {isElectricityTariffOpen && (
                                        <div className="p-4 space-y-4 border-t border-border/60 bg-background/60">
                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

                                                {/* Block 1: Energie */}
                                                <div className="p-3 rounded-lg border border-border/60 bg-muted/20 space-y-2.5">
                                                    <div className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-1.5 border-b border-border/50 pb-1.5">
                                                        <span>1. Energie (Wirkenergie)</span>
                                                    </div>
                                                    <div className="space-y-1">
                                                        <label className="text-xs font-medium text-foreground block">
                                                            Hochtarif (HT) <span className="text-[11px] text-muted-foreground">(Eniwa Naturstrom)</span>
                                                        </label>
                                                        <div className="relative">
                                                            <DecimalInput
                                                                value={electricityTariff.energyHT}
                                                                onChange={(val) => updateTariff('energyHT', parseFloat(val) || 0)}
                                                                className="w-full bg-background border border-input rounded px-2.5 py-1.5 pr-14 text-sm font-mono"
                                                            />
                                                            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">Rp./kWh</span>
                                                        </div>
                                                    </div>
                                                    <div className="space-y-1">
                                                        <label className="text-xs font-medium text-foreground block">
                                                            Niedertarif (NT) <span className="text-[11px] text-muted-foreground">(Eniwa Naturstrom)</span>
                                                        </label>
                                                        <div className="relative">
                                                            <DecimalInput
                                                                value={electricityTariff.energyNT}
                                                                onChange={(val) => updateTariff('energyNT', parseFloat(val) || 0)}
                                                                className="w-full bg-background border border-input rounded px-2.5 py-1.5 pr-14 text-sm font-mono"
                                                            />
                                                            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">Rp./kWh</span>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Block 2: Netznutzung */}
                                                <div className="p-3 rounded-lg border border-border/60 bg-muted/20 space-y-2.5">
                                                    <div className="text-xs font-bold uppercase tracking-wider text-blue-500 flex items-center gap-1.5 border-b border-border/50 pb-1.5">
                                                        <span>2. Netznutzung (Netz & Umlagen)</span>
                                                    </div>
                                                    <div className="grid grid-cols-2 gap-2">
                                                        <div className="space-y-1">
                                                            <label className="text-xs font-medium text-foreground block">Netz HT</label>
                                                            <div className="relative">
                                                                <DecimalInput
                                                                    value={electricityTariff.gridHT}
                                                                    onChange={(val) => updateTariff('gridHT', parseFloat(val) || 0)}
                                                                    className="w-full bg-background border border-input rounded px-2 py-1 pr-11 text-xs font-mono"
                                                                />
                                                                <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">Rp.</span>
                                                            </div>
                                                        </div>
                                                        <div className="space-y-1">
                                                            <label className="text-xs font-medium text-foreground block">Netz NT</label>
                                                            <div className="relative">
                                                                <DecimalInput
                                                                    value={electricityTariff.gridNT}
                                                                    onChange={(val) => updateTariff('gridNT', parseFloat(val) || 0)}
                                                                    className="w-full bg-background border border-input rounded px-2 py-1 pr-11 text-xs font-mono"
                                                                />
                                                                <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">Rp.</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="grid grid-cols-3 gap-1.5 text-xs">
                                                        <div className="space-y-0.5">
                                                            <label className="text-[10px] text-muted-foreground block truncate" title="Systemdienstleistungen Swissgrid">Swissgrid SDL</label>
                                                            <DecimalInput
                                                                value={electricityTariff.gridSdl}
                                                                onChange={(val) => updateTariff('gridSdl', parseFloat(val) || 0)}
                                                                className="w-full bg-background border border-input rounded px-1.5 py-1 text-xs font-mono"
                                                            />
                                                        </div>
                                                        <div className="space-y-0.5">
                                                            <label className="text-[10px] text-muted-foreground block truncate" title="Stromreserve des Bundes">Stromreserve</label>
                                                            <DecimalInput
                                                                value={electricityTariff.gridReserve}
                                                                onChange={(val) => updateTariff('gridReserve', parseFloat(val) || 0)}
                                                                className="w-full bg-background border border-input rounded px-1.5 py-1 text-xs font-mono"
                                                            />
                                                        </div>
                                                        <div className="space-y-0.5">
                                                            <label className="text-[10px] text-muted-foreground block truncate" title="Zuschlag Übertragungsnetz">Solidar. Netz</label>
                                                            <DecimalInput
                                                                value={electricityTariff.gridSolidar}
                                                                onChange={(val) => updateTariff('gridSolidar', parseFloat(val) || 0)}
                                                                className="w-full bg-background border border-input rounded px-1.5 py-1 text-xs font-mono"
                                                            />
                                                        </div>
                                                    </div>
                                                    <div className="grid grid-cols-2 gap-2 pt-1 border-t border-border/40">
                                                        <div className="space-y-0.5">
                                                            <label className="text-[11px] font-medium text-foreground block truncate">Grundpreis Netznutzung</label>
                                                            <div className="relative">
                                                                <DecimalInput
                                                                    value={electricityTariff.gridBaseFee}
                                                                    onChange={(val) => updateTariff('gridBaseFee', parseFloat(val) || 0)}
                                                                    className="w-full bg-background border border-input rounded px-2 py-1 pr-14 text-xs font-mono"
                                                                />
                                                                <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">CHF/Mt.</span>
                                                            </div>
                                                        </div>
                                                        <div className="space-y-0.5">
                                                            <label className="text-[11px] font-medium text-foreground block truncate">Messkosten direkt</label>
                                                            <div className="relative">
                                                                <DecimalInput
                                                                    value={electricityTariff.gridMeasurementFee}
                                                                    onChange={(val) => updateTariff('gridMeasurementFee', parseFloat(val) || 0)}
                                                                    className="w-full bg-background border border-input rounded px-2 py-1 pr-14 text-xs font-mono"
                                                                />
                                                                <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">CHF/Mt.</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Block 3: Öffentliche Abgaben & Steuern */}
                                                <div className="p-3 rounded-lg border border-border/60 bg-muted/20 space-y-2.5">
                                                    <div className="text-xs font-bold uppercase tracking-wider text-amber-500 flex items-center gap-1.5 border-b border-border/50 pb-1.5">
                                                        <span>3. Öffentliche Abgaben & MwSt</span>
                                                    </div>
                                                    <div className="space-y-1">
                                                        <label className="text-xs font-medium text-foreground block">
                                                            Konzessionsabgabe Gemeinde
                                                        </label>
                                                        <div className="relative">
                                                            <DecimalInput
                                                                value={electricityTariff.communityFee}
                                                                onChange={(val) => updateTariff('communityFee', parseFloat(val) || 0)}
                                                                className="w-full bg-background border border-input rounded px-2.5 py-1.5 pr-14 text-sm font-mono"
                                                            />
                                                            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">Rp./kWh</span>
                                                        </div>
                                                    </div>
                                                    <div className="space-y-1">
                                                        <label className="text-xs font-medium text-foreground block">
                                                            Bundesabgaben (Energiegesetz / KEV)
                                                        </label>
                                                        <div className="relative">
                                                            <DecimalInput
                                                                value={electricityTariff.federalFee}
                                                                onChange={(val) => updateTariff('federalFee', parseFloat(val) || 0)}
                                                                className="w-full bg-background border border-input rounded px-2.5 py-1.5 pr-14 text-sm font-mono"
                                                            />
                                                            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">Rp./kWh</span>
                                                        </div>
                                                    </div>
                                                    <div className="space-y-1 pt-1 border-t border-border/40">
                                                        <label className="text-xs font-medium text-foreground block">
                                                            Mehrwertsteuer (MwSt)
                                                        </label>
                                                        <div className="relative">
                                                            <DecimalInput
                                                                value={electricityTariff.vatRate}
                                                                onChange={(val) => updateTariff('vatRate', parseFloat(val) || 0)}
                                                                className="w-full bg-background border border-input rounded px-2.5 py-1.5 pr-10 text-sm font-mono"
                                                            />
                                                            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
                                                        </div>
                                                    </div>
                                                </div>

                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* 3. Erfasste Rechnungen & Ablesungen (mit Zeitraum von–bis & 1:1 Kostenabbild) */}
                                <div className="space-y-3 pt-2">
                                    <div className="flex items-center justify-between">
                                        <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                                            <span>Erfasste Stromrechnungen & Ablesungen</span>
                                            <span className="text-xs font-medium bg-primary/10 text-primary px-2.5 py-0.5 rounded-full">
                                                {(electricityReadings || []).length} {((electricityReadings || []).length === 1) ? 'Eintrag' : 'Einträge'}
                                            </span>
                                        </h3>
                                    </div>

                                    <div className="space-y-3">
                                        {(electricityReadings || []).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map((reading, index, arr) => {
                                            const prevReading = index < arr.length - 1 ? arr[index + 1] : undefined;
                                            const { usageHT, usageNT } = getReadingUsage(reading, prevReading);
                                            const totalUsage = usageHT + usageNT;
                                            const period = calculatePeriodDays(reading.dateFrom, reading.date);
                                            const months = reading.billingMonths || period.months;
                                            const invoice = calculateElectricityInvoice(usageHT, usageNT, months, electricityTariff);
                                            const isExpanded = expandedInvoiceId === reading.id;

                                            return (
                                                <div key={reading.id} className="bg-card border border-border rounded-xl p-3.5 shadow-2xs space-y-3 transition-all hover:border-primary/40">
                                                    
                                                    {/* Header-Zeile mit Zeitraum, Gesamtverbrauch und Total Betrag */}
                                                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-2.5">
                                                        <div className="flex flex-wrap items-center gap-2">
                                                            <span className="text-xs font-bold bg-muted px-2.5 py-1 rounded-md text-foreground flex items-center gap-1.5">
                                                                <Calendar className="size-3.5 text-primary" />
                                                                {reading.dateFrom ? `${new Date(reading.dateFrom).toLocaleDateString('de-CH')} – ` : ''}
                                                                {new Date(reading.date).toLocaleDateString('de-CH')}
                                                            </span>
                                                            <span className="text-xs text-muted-foreground font-medium">
                                                                ({period.days} Tage / {months} Mt.)
                                                            </span>
                                                            {reading.invoiceNumber && (
                                                                <span className="text-xs text-muted-foreground border border-border/80 px-2 py-0.5 rounded">
                                                                    Rechnungs-Nr. {reading.invoiceNumber}
                                                                </span>
                                                            )}
                                                        </div>

                                                        <div className="flex items-center gap-2 ml-auto">
                                                            <div className="text-right">
                                                                <div className="text-base font-extrabold font-mono text-emerald-400">
                                                                    {formatCHF(reading.costTotal || invoice.totalInclVat, 2)}
                                                                </div>
                                                                <div className="text-[11px] text-muted-foreground">
                                                                    Verbrauch: <span className="font-semibold text-foreground">{totalUsage.toLocaleString('de-CH')} kWh</span> (HT: {usageHT} / NT: {usageNT})
                                                                </div>
                                                            </div>

                                                            <button
                                                                type="button"
                                                                onClick={() => setExpandedInvoiceId(isExpanded ? null : reading.id)}
                                                                className={cn(
                                                                    "px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-colors flex items-center gap-1 shrink-0",
                                                                    isExpanded
                                                                        ? "bg-primary text-primary-foreground border-primary"
                                                                        : "bg-muted/60 hover:bg-muted text-foreground border-border"
                                                                )}
                                                                title="1:1 Rechnungs-Abbild aufklappen"
                                                            >
                                                                <ReceiptText className="size-3.5" />
                                                                <span>{isExpanded ? 'Details verbergen' : 'Rechnung 1:1'}</span>
                                                            </button>

                                                            <button
                                                                onClick={() => {
                                                                    const newReadings = electricityReadings?.filter(r => r.id !== reading.id);
                                                                    updateMortgageData({ electricityReadings: newReadings });
                                                                }}
                                                                className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
                                                                title="Eintrag löschen"
                                                            >
                                                                <Trash2 className="size-4" />
                                                            </button>
                                                        </div>
                                                    </div>

                                                    {/* Eingabefelder: Zeitraum & Zählerstände (Stand alt -> Stand neu -> Verbrauch) */}
                                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2.5 text-xs">
                                                        <div className="space-y-1">
                                                            <label className="text-muted-foreground font-semibold uppercase text-[10.5px]">Ablesung Von</label>
                                                            <input
                                                                type="date"
                                                                value={reading.dateFrom || (reading.date === '2026-09-30' ? '2026-08-28' : '')}
                                                                onChange={(e) => {
                                                                    const newReadings = (electricityReadings || []).map(r => r.id === reading.id ? { ...r, dateFrom: e.target.value } : r);
                                                                    updateMortgageData({ electricityReadings: newReadings });
                                                                }}
                                                                className="w-full bg-background border border-input rounded px-2 py-1.5 text-xs font-mono"
                                                            />
                                                        </div>
                                                        <div className="space-y-1">
                                                            <label className="text-muted-foreground font-semibold uppercase text-[10.5px]">Ablesung Bis</label>
                                                            <input
                                                                type="date"
                                                                value={reading.date}
                                                                onChange={(e) => {
                                                                    const newReadings = (electricityReadings || []).map(r => r.id === reading.id ? { ...r, date: e.target.value } : r);
                                                                    updateMortgageData({ electricityReadings: newReadings });
                                                                }}
                                                                className="w-full bg-background border border-input rounded px-2 py-1.5 text-xs font-mono"
                                                            />
                                                        </div>

                                                        {/* HT Zählerstand alt -> neu -> kWh */}
                                                        <div className="space-y-1">
                                                            <div className="flex justify-between items-center text-[10.5px] uppercase font-semibold text-muted-foreground">
                                                                <span>Stand alt HT</span>
                                                                <span className="text-primary font-bold">{usageHT} kWh</span>
                                                            </div>
                                                            <div className="grid grid-cols-2 gap-1">
                                                                <DecimalInput
                                                                    value={reading.standAltHT ?? 473}
                                                                    placeholder="Alt"
                                                                    onChange={(val) => {
                                                                        const parsed = parseFloat(val) || 0;
                                                                        const newUsage = Math.max(0, reading.valueHT - parsed);
                                                                        const newReadings = (electricityReadings || []).map(r => r.id === reading.id ? { ...r, standAltHT: parsed, usageHT: newUsage } : r);
                                                                        updateMortgageData({ electricityReadings: newReadings });
                                                                    }}
                                                                    className="w-full bg-background border border-input rounded px-2 py-1.5 text-xs font-mono text-right"
                                                                    title="Stand alt Wirkenergie HT"
                                                                />
                                                                <DecimalInput
                                                                    value={reading.valueHT}
                                                                    placeholder="Neu"
                                                                    onChange={(val) => {
                                                                        const parsed = parseFloat(val) || 0;
                                                                        const alt = reading.standAltHT ?? 0;
                                                                        const newUsage = alt > 0 ? Math.max(0, parsed - alt) : reading.usageHT;
                                                                        const newReadings = (electricityReadings || []).map(r => r.id === reading.id ? { ...r, valueHT: parsed, usageHT: newUsage } : r);
                                                                        updateMortgageData({ electricityReadings: newReadings });
                                                                    }}
                                                                    className="w-full bg-background border border-input rounded px-2 py-1.5 text-xs font-mono font-bold text-right"
                                                                    title="Stand neu Wirkenergie HT"
                                                                />
                                                            </div>
                                                        </div>

                                                        {/* NT Zählerstand alt -> neu -> kWh */}
                                                        <div className="space-y-1">
                                                            <div className="flex justify-between items-center text-[10.5px] uppercase font-semibold text-muted-foreground">
                                                                <span>Stand alt NT</span>
                                                                <span className="text-primary font-bold">{usageNT} kWh</span>
                                                            </div>
                                                            <div className="grid grid-cols-2 gap-1">
                                                                <DecimalInput
                                                                    value={reading.standAltNT ?? 3108}
                                                                    placeholder="Alt"
                                                                    onChange={(val) => {
                                                                        const parsed = parseFloat(val) || 0;
                                                                        const newUsage = Math.max(0, reading.valueNT - parsed);
                                                                        const newReadings = (electricityReadings || []).map(r => r.id === reading.id ? { ...r, standAltNT: parsed, usageNT: newUsage } : r);
                                                                        updateMortgageData({ electricityReadings: newReadings });
                                                                    }}
                                                                    className="w-full bg-background border border-input rounded px-2 py-1.5 text-xs font-mono text-right"
                                                                    title="Stand alt Wirkenergie NT"
                                                                />
                                                                <DecimalInput
                                                                    value={reading.valueNT}
                                                                    placeholder="Neu"
                                                                    onChange={(val) => {
                                                                        const parsed = parseFloat(val) || 0;
                                                                        const alt = reading.standAltNT ?? 0;
                                                                        const newUsage = alt > 0 ? Math.max(0, parsed - alt) : reading.usageNT;
                                                                        const newReadings = (electricityReadings || []).map(r => r.id === reading.id ? { ...r, valueNT: parsed, usageNT: newUsage } : r);
                                                                        updateMortgageData({ electricityReadings: newReadings });
                                                                    }}
                                                                    className="w-full bg-background border border-input rounded px-2 py-1.5 text-xs font-mono font-bold text-right"
                                                                    title="Stand neu Wirkenergie NT"
                                                                />
                                                            </div>
                                                        </div>

                                                        {/* Abrechnungsmonate (Fixkosten) */}
                                                        <div className="space-y-1">
                                                            <label className="text-muted-foreground font-semibold uppercase text-[10.5px]">Abrechnungs-Mt.</label>
                                                            <input
                                                                type="number"
                                                                step="0.5"
                                                                min="0.5"
                                                                max="12"
                                                                value={months}
                                                                onChange={(e) => {
                                                                    const val = parseFloat(e.target.value) || 1;
                                                                    const newReadings = (electricityReadings || []).map(r => r.id === reading.id ? { ...r, billingMonths: val } : r);
                                                                    updateMortgageData({ electricityReadings: newReadings });
                                                                }}
                                                                className="w-full bg-background border border-input rounded px-2 py-1.5 text-xs font-mono text-center"
                                                                title="Anzahl Monate für monatliche Fixkosten (Grundpreis & Messung)"
                                                            />
                                                        </div>

                                                        {/* Optionale Rechnungsnummer */}
                                                        <div className="space-y-1">
                                                            <label className="text-muted-foreground font-semibold uppercase text-[10.5px]">Rechnungs-Nr.</label>
                                                            <input
                                                                type="text"
                                                                value={reading.invoiceNumber || ''}
                                                                onChange={(e) => {
                                                                    const newReadings = (electricityReadings || []).map(r => r.id === reading.id ? { ...r, invoiceNumber: e.target.value } : r);
                                                                    updateMortgageData({ electricityReadings: newReadings });
                                                                }}
                                                                placeholder="z.B. 7 134 488"
                                                                className="w-full bg-background border border-input rounded px-2 py-1.5 text-xs font-mono"
                                                            />
                                                        </div>
                                                    </div>

                                                    {/* 1:1 RECHNUNGS-ABBILD (Aufklappbar - genau wie auf Eniwa-Rechnung) */}
                                                    {isExpanded && (
                                                        <div className="mt-3 border border-border/80 rounded-xl overflow-hidden bg-background/95 shadow-md animate-in fade-in duration-200">
                                                            <div className="bg-muted/50 px-4 py-2.5 border-b border-border flex items-center justify-between text-xs font-bold">
                                                                <div className="flex items-center gap-2">
                                                                    <ReceiptText className="size-4 text-primary" />
                                                                    <span>Rechnungs-Aufschlüsselung (1:1 Abbild StromVG)</span>
                                                                </div>
                                                                <span className="font-mono text-muted-foreground">
                                                                    Ablesezeitraum: {reading.dateFrom ? `${new Date(reading.dateFrom).toLocaleDateString('de-CH')} – ` : ''}{new Date(reading.date).toLocaleDateString('de-CH')}
                                                                </span>
                                                            </div>

                                                            <div className="p-4 space-y-4 text-xs font-mono">

                                                                {/* 1. ENERGIE */}
                                                                <div className="space-y-1.5">
                                                                    <div className="font-sans font-bold text-sm text-primary flex items-center justify-between border-b border-border/60 pb-1">
                                                                        <span>1. Energie (Wirkenergie)</span>
                                                                        <span className="text-foreground">{formatCHF(invoice.subtotalEnergy, 2)}</span>
                                                                    </div>
                                                                    <div className="flex justify-between items-center text-muted-foreground pl-2 py-0.5">
                                                                        <span>Eniwa Naturstrom Schweiz Hochtarif (HT)</span>
                                                                        <span>{usageHT} kWh @ {electricityTariff.energyHT.toFixed(2)} Rp./kWh = {formatCHF(invoice.energyHTAmount, 2)}</span>
                                                                    </div>
                                                                    <div className="flex justify-between items-center text-muted-foreground pl-2 py-0.5">
                                                                        <span>Eniwa Naturstrom Schweiz Niedertarif (NT)</span>
                                                                        <span>{usageNT} kWh @ {electricityTariff.energyNT.toFixed(2)} Rp./kWh = {formatCHF(invoice.energyNTAmount, 2)}</span>
                                                                    </div>
                                                                    <div className="flex justify-between items-center font-bold text-foreground bg-muted/20 px-2 py-1 rounded">
                                                                        <span>Zwischentotal Energie exkl. MwSt</span>
                                                                        <span>{formatCHF(invoice.subtotalEnergy, 2)}</span>
                                                                    </div>
                                                                </div>

                                                                {/* 2. NETZNUTZUNG */}
                                                                <div className="space-y-1.5">
                                                                    <div className="font-sans font-bold text-sm text-blue-500 flex items-center justify-between border-b border-border/60 pb-1">
                                                                        <span>2. Netznutzung</span>
                                                                        <span className="text-foreground">{formatCHF(invoice.subtotalGrid, 2)}</span>
                                                                    </div>
                                                                    <div className="flex justify-between items-center text-muted-foreground pl-2 py-0.5">
                                                                        <span>Wirkenergie Hochtarif (HT)</span>
                                                                        <span>{usageHT} kWh @ {electricityTariff.gridHT.toFixed(2)} Rp./kWh = {formatCHF(invoice.gridHTAmount, 2)}</span>
                                                                    </div>
                                                                    <div className="flex justify-between items-center text-muted-foreground pl-2 py-0.5">
                                                                        <span>Wirkenergie Niedertarif (NT)</span>
                                                                        <span>{usageNT} kWh @ {electricityTariff.gridNT.toFixed(2)} Rp./kWh = {formatCHF(invoice.gridNTAmount, 2)}</span>
                                                                    </div>
                                                                    <div className="flex justify-between items-center text-muted-foreground pl-2 py-0.5">
                                                                        <span>Systemdienstleistungen Swissgrid</span>
                                                                        <span>{totalUsage} kWh @ {electricityTariff.gridSdl.toFixed(2)} Rp./kWh = {formatCHF(invoice.gridSdlAmount, 2)}</span>
                                                                    </div>
                                                                    <div className="flex justify-between items-center text-muted-foreground pl-2 py-0.5">
                                                                        <span>Stromreserve des Bundes</span>
                                                                        <span>{totalUsage} kWh @ {electricityTariff.gridReserve.toFixed(2)} Rp./kWh = {formatCHF(invoice.gridReserveAmount, 2)}</span>
                                                                    </div>
                                                                    <div className="flex justify-between items-center text-muted-foreground pl-2 py-0.5">
                                                                        <span>Zuschlag solidarisierte Kosten im Übertragungsnetz</span>
                                                                        <span>{totalUsage} kWh @ {electricityTariff.gridSolidar.toFixed(2)} Rp./kWh = {formatCHF(invoice.gridSolidarAmount, 2)}</span>
                                                                    </div>
                                                                    <div className="flex justify-between items-center text-muted-foreground pl-2 py-0.5">
                                                                        <span>Grundpreis Netznutzung</span>
                                                                        <span>{months} Mt. @ {formatCHF(electricityTariff.gridBaseFee, 2)}/Monat = {formatCHF(invoice.baseFeeAmount, 2)}</span>
                                                                    </div>
                                                                    <div className="flex justify-between items-center text-muted-foreground pl-2 py-0.5">
                                                                        <span>Messkosten direkt</span>
                                                                        <span>{months} Mt. @ {formatCHF(electricityTariff.gridMeasurementFee, 2)}/Monat = {formatCHF(invoice.measurementFeeAmount, 2)}</span>
                                                                    </div>
                                                                    <div className="flex justify-between items-center font-bold text-foreground bg-muted/20 px-2 py-1 rounded">
                                                                        <span>Zwischentotal Netznutzung exkl. MwSt</span>
                                                                        <span>{formatCHF(invoice.subtotalGrid, 2)}</span>
                                                                    </div>
                                                                </div>

                                                                {/* 3. ÖFFENTLICHE ABGABEN */}
                                                                <div className="space-y-1.5">
                                                                    <div className="font-sans font-bold text-sm text-amber-500 flex items-center justify-between border-b border-border/60 pb-1">
                                                                        <span>3. Öffentliche Abgaben</span>
                                                                        <span className="text-foreground">{formatCHF(invoice.subtotalFees, 2)}</span>
                                                                    </div>
                                                                    <div className="flex justify-between items-center text-muted-foreground pl-2 py-0.5">
                                                                        <span>Konzessionsabgabe an die Gemeinde</span>
                                                                        <span>{totalUsage} kWh @ {electricityTariff.communityFee.toFixed(2)} Rp./kWh = {formatCHF(invoice.communityFeeAmount, 2)}</span>
                                                                    </div>
                                                                    <div className="flex justify-between items-center text-muted-foreground pl-2 py-0.5">
                                                                        <span>Bundesabgaben gemäss Energiegesetz (KEV)</span>
                                                                        <span>{totalUsage} kWh @ {electricityTariff.federalFee.toFixed(2)} Rp./kWh = {formatCHF(invoice.federalFeeAmount, 2)}</span>
                                                                    </div>
                                                                    <div className="flex justify-between items-center font-bold text-foreground bg-muted/20 px-2 py-1 rounded">
                                                                        <span>Zwischentotal öffentliche Abgaben exkl. MwSt</span>
                                                                        <span>{formatCHF(invoice.subtotalFees, 2)}</span>
                                                                    </div>
                                                                </div>

                                                                {/* 4. TOTAL & MEHRWERTSTEUER */}
                                                                <div className="pt-2 border-t-2 border-border space-y-1.5">
                                                                    <div className="flex justify-between items-center text-muted-foreground">
                                                                        <span>Zwischentotal Strom exkl. MwSt</span>
                                                                        <span className="font-bold text-foreground">{formatCHF(invoice.totalExclVat, 2)}</span>
                                                                    </div>
                                                                    <div className="flex justify-between items-center text-muted-foreground">
                                                                        <span>Mehrwertsteuer {electricityTariff.vatRate.toFixed(1)} %</span>
                                                                        <span>{formatCHF(invoice.vatAmount, 2)}</span>
                                                                    </div>
                                                                    <div className="flex justify-between items-center text-base font-extrabold text-foreground bg-emerald-500/10 border border-emerald-500/30 px-3 py-2 rounded-lg mt-1 font-sans">
                                                                        <span className="text-emerald-400">Total Strom inkl. MwSt</span>
                                                                        <span className="text-emerald-400 font-mono text-lg">{formatCHF(invoice.totalInclVat, 2)}</span>
                                                                    </div>
                                                                </div>

                                                            </div>
                                                        </div>
                                                    )}

                                                </div>
                                            );
                                        })}

                                        {(electricityReadings || []).length === 0 && (
                                            <div className="text-center text-sm text-muted-foreground py-8 border border-dashed rounded-xl bg-muted/10">
                                                Noch keine Stromrechnungen erfasst. Klicke oben auf &quot;+ Rechnung / Ablesung erfassen&quot;.
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* 4. Current Reading Display (Latest Stand) */}
                                {electricityReadings && electricityReadings.length > 0 && (() => {
                                    const sortedReadings = [...electricityReadings].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
                                    const latest = sortedReadings[0];
                                    return (
                                        <div className="mt-6 border-t border-border pt-4">
                                            <h4 className="text-base font-semibold mb-3 text-foreground flex items-center gap-2">
                                                <Gauge className="size-4 text-primary" />
                                                <span>Aktueller Zählerstand (Zuletzt abgelesen)</span>
                                            </h4>

                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 font-medium">
                                                <div className="flex items-center justify-between bg-muted/30 p-2.5 rounded-lg border border-border/50">
                                                    <span className="text-muted-foreground text-sm font-semibold">Stand HT (Wirkenergie)</span>
                                                    <div className="flex items-center gap-2">
                                                        <DecimalInput
                                                            value={latest.valueHT}
                                                            onChange={(val) => {
                                                                const parsed = parseFloat(val) || 0;
                                                                const alt = latest.standAltHT ?? 0;
                                                                const newUsage = alt > 0 ? Math.max(0, parsed - alt) : latest.usageHT;
                                                                const newReadings = electricityReadings.map(r => r.id === latest.id ? { ...r, valueHT: parsed, usageHT: newUsage } : r);
                                                                updateMortgageData({ electricityReadings: newReadings });
                                                            }}
                                                            onFocus={(e) => e.target.select()}
                                                            className="bg-[#a3cc29] text-white px-2 py-1 rounded text-base font-mono font-bold tracking-wider shadow-xs w-[120px] text-center border-none focus:ring-2 focus:ring-primary outline-none"
                                                        />
                                                        <span className="text-muted-foreground text-xs font-bold">kWh</span>
                                                    </div>
                                                </div>

                                                <div className="flex items-center justify-between bg-muted/30 p-2.5 rounded-lg border border-border/50">
                                                    <span className="text-muted-foreground text-sm font-semibold">Stand NT (Wirkenergie)</span>
                                                    <div className="flex items-center gap-2">
                                                        <DecimalInput
                                                            value={latest.valueNT}
                                                            onChange={(val) => {
                                                                const parsed = parseFloat(val) || 0;
                                                                const alt = latest.standAltNT ?? 0;
                                                                const newUsage = alt > 0 ? Math.max(0, parsed - alt) : latest.usageNT;
                                                                const newReadings = electricityReadings.map(r => r.id === latest.id ? { ...r, valueNT: parsed, usageNT: newUsage } : r);
                                                                updateMortgageData({ electricityReadings: newReadings });
                                                            }}
                                                            onFocus={(e) => e.target.select()}
                                                            className="bg-[#a3cc29] text-white px-2 py-1 rounded text-base font-mono font-bold tracking-wider shadow-xs w-[120px] text-center border-none focus:ring-2 focus:ring-primary outline-none"
                                                        />
                                                        <span className="text-muted-foreground text-xs font-bold">kWh</span>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="mt-2 text-xs text-muted-foreground flex items-center justify-between">
                                                <span>
                                                    Ablesedatum: <span className="font-semibold text-foreground">{new Date(latest.date).toLocaleDateString('de-CH')}</span>
                                                    {latest.dateFrom && ` (Zeitraum ab ${new Date(latest.dateFrom).toLocaleDateString('de-CH')})`}
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })()}

                                {/* 5. Statistik & Budget-Hochrechnung */}
                                {electricityStats ? (
                                    <div className="mt-6 pt-5 border-t border-border space-y-3">
                                        <div className="flex items-center justify-between">
                                            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                                                <TrendingUp className="size-3.5 text-primary" />
                                                Statistik & Budget-Hochrechnung
                                            </h4>
                                            <span className="text-xs text-muted-foreground">
                                                Basis: {electricityStats.totalDays} abgelesene Tage
                                            </span>
                                        </div>

                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                            <div className="bg-yellow-500/10 border border-yellow-500/20 p-3 rounded-xl space-y-1">
                                                <div className="text-xs text-muted-foreground font-medium">Jahresverbrauch (Hochrechnung)</div>
                                                <div className="text-xl font-extrabold text-yellow-500 font-mono">
                                                    {(electricityStats.annualUsageHT + electricityStats.annualUsageNT).toFixed(0)} kWh
                                                </div>
                                                <div className="text-[11px] text-muted-foreground">
                                                    HT: {electricityStats.annualUsageHT.toFixed(0)} kWh / NT: {electricityStats.annualUsageNT.toFixed(0)} kWh
                                                </div>
                                            </div>

                                            <div className="bg-blue-500/10 border border-blue-500/20 p-3 rounded-xl space-y-1">
                                                <div className="text-xs text-muted-foreground font-medium">Jahreskosten (inkl. Fixkosten & MwSt)</div>
                                                <div className="text-xl font-extrabold text-blue-400 font-mono">
                                                    {formatCHF(electricityStats.annualCost, 2)}
                                                </div>
                                                <div className="text-[11px] text-muted-foreground">
                                                    Energie: {formatCHF(electricityStats.annualInvoice.subtotalEnergy, 0)} | Netz: {formatCHF(electricityStats.annualInvoice.subtotalGrid, 0)}
                                                </div>
                                            </div>

                                            <div className="bg-emerald-500/10 border border-emerald-500/20 p-3 rounded-xl space-y-1">
                                                <div className="text-xs text-muted-foreground font-medium">Monatliche Belastung fürs Budget</div>
                                                <div className="text-xl font-extrabold text-emerald-400 font-mono">
                                                    {formatCHF(electricityStats.annualCost / 12, 2)}
                                                </div>
                                                <div className="text-[11px] text-muted-foreground">
                                                    ca. {((electricityStats.annualUsageHT + electricityStats.annualUsageNT) / 12).toFixed(0)} kWh pro Monat
                                                </div>
                                            </div>
                                        </div>

                                        {/* Kostenverteilungs-Balken */}
                                        {electricityStats.annualInvoice && (
                                            <div className="space-y-1.5 pt-2">
                                                <div className="text-xs text-muted-foreground flex justify-between font-medium">
                                                    <span>Kostenaufteilung Strom:</span>
                                                    <span className="space-x-3 text-[11px]">
                                                        <span className="text-primary font-semibold">● Energie ({Math.round(electricityStats.annualInvoice.subtotalEnergy / electricityStats.annualCost * 100)}%)</span>
                                                        <span className="text-blue-400 font-semibold">● Netznutzung ({Math.round(electricityStats.annualInvoice.subtotalGrid / electricityStats.annualCost * 100)}%)</span>
                                                        <span className="text-amber-400 font-semibold">● Abgaben ({Math.round(electricityStats.annualInvoice.subtotalFees / electricityStats.annualCost * 100)}%)</span>
                                                        <span className="text-muted-foreground font-semibold">● MwSt ({Math.round(electricityStats.annualInvoice.vatAmount / electricityStats.annualCost * 100)}%)</span>
                                                    </span>
                                                </div>
                                                <div className="h-2 rounded-full overflow-hidden flex bg-muted/60">
                                                    <div className="bg-primary h-full" style={{ width: `${(electricityStats.annualInvoice.subtotalEnergy / electricityStats.annualCost) * 100}%` }} title="Energie" />
                                                    <div className="bg-blue-400 h-full" style={{ width: `${(electricityStats.annualInvoice.subtotalGrid / electricityStats.annualCost) * 100}%` }} title="Netznutzung" />
                                                    <div className="bg-amber-400 h-full" style={{ width: `${(electricityStats.annualInvoice.subtotalFees / electricityStats.annualCost) * 100}%` }} title="Öffentliche Abgaben" />
                                                    <div className="bg-slate-500 h-full" style={{ width: `${(electricityStats.annualInvoice.vatAmount / electricityStats.annualCost) * 100}%` }} title="MwSt" />
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <p className="text-sm text-muted-foreground italic mt-6 text-center">
                                        Erfassen Sie eine Stromrechnung mit Ablesezeitraum oder mindestens 2 Zählerstände für Statistiken.
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
