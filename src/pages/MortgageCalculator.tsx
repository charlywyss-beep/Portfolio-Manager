import { useState, useMemo } from 'react';
import { Building, Calculator, Plus, Trash2, Landmark, Percent } from 'lucide-react';
import { cn } from '../utils';
import { PieChart as RechartsPie, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, Legend } from 'recharts';

import { SaronChart } from '../components/SaronChart';
import { DecimalInput } from '../components/DecimalInput';

interface Tranche {
    id: string;
    name: string;
    amount: number;
    rate: number;
}

export const MortgageCalculator = () => {
    const [propertyValue, setPropertyValue] = useState<number>(1000000);
    const [maintenanceRate, setMaintenanceRate] = useState<number>(0.7); // % per year
    const [yearlyAmortization, setYearlyAmortization] = useState<number>(10000); // 1% typical

    const [tranches, setTranches] = useState<Tranche[]>([
        { id: '1', name: 'Festhypothek 5J', amount: 400000, rate: 1.5 },
        { id: '2', name: 'SARON / Variabel', amount: 200000, rate: 2.1 },
    ]);

    const addTranche = () => {
        const newId = Math.random().toString(36).substr(2, 9);
        setTranches([...tranches, { id: newId, name: 'Neues Tranche', amount: 0, rate: 2.0 }]);
    };

    const updateTranche = (id: string, field: keyof Tranche, value: string | number) => {
        setTranches(tranches.map(t => {
            if (t.id !== id) return t;
            return { ...t, [field]: value };
        }));
    };

    const removeTranche = (id: string) => {
        setTranches(tranches.filter(t => t.id !== id));
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
                                        onChange={setPropertyValue}
                                        className={cn(inputClass, "pl-9")}
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Unterhalt & Nebenkosten (%)</label>
                                <div className="relative">
                                    <Percent className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground size-4" />
                                    <DecimalInput
                                        value={maintenanceRate}
                                        onChange={setMaintenanceRate}
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
                                        onChange={setYearlyAmortization}
                                        className={cn(inputClass, "pl-9")}
                                    />
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    Direkte oder indirekte Amortisation pro Jahr.
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
                            {tranches.map((tranche) => (
                                <div key={tranche.id} className="grid grid-cols-12 gap-2 items-end bg-accent/30 p-3 rounded-lg border border-transparent hover:border-border transition-all">
                                    <div className="col-span-5 sm:col-span-5 space-y-1">
                                        <label className="text-xs text-muted-foreground">Bezeichnung</label>
                                        <input
                                            type="text"
                                            value={tranche.name}
                                            onChange={(e) => updateTranche(tranche.id, 'name', e.target.value)}
                                            className={inputClass}
                                            placeholder="z.B. Festhypothek"
                                        />
                                    </div>
                                    <div className="col-span-4 sm:col-span-3 space-y-1">
                                        <label className="text-xs text-muted-foreground">Betrag</label>
                                        <DecimalInput
                                            value={tranche.amount}
                                            onChange={(val) => updateTranche(tranche.id, 'amount', val)}
                                            className={inputClass}
                                        />
                                    </div>
                                    <div className="col-span-2 sm:col-span-3 space-y-1">
                                        <label className="text-xs text-muted-foreground">Zins (%)</label>
                                        <DecimalInput
                                            value={tranche.rate}
                                            onChange={(val) => updateTranche(tranche.id, 'rate', val)}
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
                            <div className="text-2xl font-bold text-primary font-mono">
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
                            <div className="h-full bg-blue-500" style={{ width: `${(monthlyData.interest / totalMonthlyCost) * 100}%` }}></div>
                            <div className="h-full bg-emerald-500" style={{ width: `${(monthlyData.amortization / totalMonthlyCost) * 100}%` }}></div>
                            <div className="h-full bg-amber-500" style={{ width: `${(monthlyData.maintenance / totalMonthlyCost) * 100}%` }}></div>
                        </div>
                    </div>

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

                    {/* SARON Chart */}
                    <SaronChart />

                </div>
            </div>
        </div>
    );
};
