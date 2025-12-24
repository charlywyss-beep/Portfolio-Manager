import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePortfolio } from '../context/PortfolioContext';
import { Plus, Search, Trash2, ArrowUpRight, ArrowDownRight, PieChart, BarChart3, Edit, Landmark } from 'lucide-react';
import { cn } from '../utils';
import { useCurrencyFormatter } from '../utils/currency';
import { smartWrap } from '../utils/text';
import { EditPositionModal } from '../components/EditPositionModal';
import { AddFixedDepositModal } from '../components/AddFixedDepositModal';
import { Logo } from '../components/Logo';




export function Portfolio() {
    const { positions: rawPositions, stocks, fixedDeposits, deletePosition, updatePosition, deleteFixedDeposit } = usePortfolio();
    const navigate = useNavigate();
    const [isAddFixedDepositModalOpen, setIsAddFixedDepositModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [selectedPosition, setSelectedPosition] = useState<any>(null);
    const [editingFixedDeposit, setEditingFixedDeposit] = useState<any>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const { formatCurrency, convertToCHF } = useCurrencyFormatter();

    // Enrich positions with stock data and calculations
    const positions = rawPositions.map((pos) => {
        const stock = stocks.find((s) => s.id === pos.stockId)!;
        if (!stock) return null; // Should not happen

        // Current values
        const currentValue = pos.shares * stock.currentPrice;
        const buyValue = pos.shares * pos.buyPriceAvg;

        // Total gain/loss (since purchase)
        const gainLossTotal = currentValue - buyValue;
        const gainLossTotalPercent = buyValue !== 0 ? (gainLossTotal / buyValue) * 100 : 0;

        // Daily performance
        const dailyChange = stock.currentPrice - stock.previousClose;
        const dailyChangePercent = stock.previousClose !== 0 ? (dailyChange / stock.previousClose) * 100 : 0;
        const dailyValueChange = pos.shares * dailyChange;

        // Forex Calculations
        const currentFxRate = stock.currency === 'CHF' ? 1 : convertToCHF(1, stock.currency);
        // entryFxRate is usually "CHF per User-Unit" (e.g. per Pound).
        const entryFxRate = pos.averageEntryFxRate ?? (stock.currency === 'CHF' ? 1 : 1);

        const currentValueCHF = currentValue * currentFxRate;

        // Fix for GBp: buyValue is Pence, but entryFxRate is per Pound.
        // We must normalize buyValue to Pounds for the CHF Cost calculation.
        const normalizedBuyValue = stock.currency === 'GBp' ? buyValue / 100 : buyValue;

        // Auto-Correct for Legacy GBP Rates (if stored as 0.93 instead of 1.07)
        // GBP is stronger than CHF, so rate should be > 1.0.
        let effectiveEntryRate = entryFxRate;
        if (stock.currency === 'GBp' && entryFxRate < 1.0 && entryFxRate > 0) {
            effectiveEntryRate = 1 / entryFxRate;
        }

        const buyValueCHF = normalizedBuyValue * effectiveEntryRate;

        const gainLossTotalCHF = currentValueCHF - buyValueCHF;
        // forexImpactCHF calculated below using normalized values

        const normalizedCurrentValue = stock.currency === 'GBp' ? currentValue / 100 : currentValue;
        const currentValAtEntryFx = normalizedCurrentValue * effectiveEntryRate; // What value would be if FX never changed.

        // FX Impact calculation
        const forexImpactCHF = currentValueCHF - currentValAtEntryFx;

        // This is strictly "FX contribution to Current Value". 
        // If you want "FX contribution to P/L", it's slightly more complex, but this is a standard approx.


        return {
            ...pos,
            stock,
            currentValue,
            buyValue,
            gainLossTotal,
            gainLossTotalPercent,
            dailyChange,
            dailyChangePercent,
            dailyValueChange,
            buyValueCHF, // New: Fixes Invest Column
            gainLossTotalCHF, // New
            forexImpactCHF // New
        };
    }).filter(Boolean) as any[];

    const filteredPositions = positions.filter((pos) =>
        pos.stock.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        pos.stock.symbol.toLowerCase().includes(searchTerm.toLowerCase()) ||
        pos.stock.valor?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        pos.stock.isin?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const stockPositions = filteredPositions.filter(p => !p.stock.type || p.stock.type === 'stock');
    const etfPositions = filteredPositions.filter(p => p.stock.type === 'etf');



    const handleUpdate = (id: string, newShares: number, newAvgPrice?: number, newBuyDate?: string, newFxRate?: number, newPurchases?: any[]) => {
        const updates: any = { shares: newShares };
        if (newAvgPrice !== undefined) {
            updates.buyPriceAvg = newAvgPrice;
        }
        if (newBuyDate !== undefined) {
            updates.buyDate = newBuyDate;
        }
        if (newFxRate !== undefined) {
            updates.averageEntryFxRate = newFxRate;
        }
        if (newPurchases !== undefined) {
            updates.purchases = newPurchases;
        }
        updatePosition(id, updates);
    };

    const PositionTable = ({ title, icon: Icon, data, emptyMessage }: { title: string, icon: any, data: any[], emptyMessage: string }) => (
        <div className="space-y-3">
            <div className="flex items-center gap-2">
                <Icon className="size-5 text-primary" />
                <h2 className="text-lg font-bold">{title}</h2>
                <span className="text-xs font-mono bg-muted px-2 py-0.5 rounded-full text-muted-foreground">{data.length} Positionen</span>
            </div>
            <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                        <thead className="bg-muted/50 text-muted-foreground font-medium border-b border-border">
                            <tr>
                                <th className="px-2 py-3 min-w-[150px] sticky left-0 z-20 bg-card shadow-[5px_0_5px_-5px_rgba(0,0,0,0.1)]">Name</th>
                                <th className="px-2 py-3 min-w-[80px]">ISIN</th>
                                <th className="px-2 py-3 text-right whitespace-nowrap">Anzahl</th>
                                <th className="px-2 py-3 text-right whitespace-nowrap">Ø Kauf</th>
                                <th className="px-2 py-3 text-right whitespace-nowrap">Invest</th>
                                <th className="px-2 py-3 text-right whitespace-nowrap">Kurs</th>
                                <th className="px-2 py-3 text-right whitespace-nowrap">Wert</th>
                                <th className="px-2 py-3 text-right whitespace-nowrap">+/-</th>
                                <th className="px-2 py-3 text-right whitespace-nowrap">%</th>
                                <th className="px-2 py-3 text-center sticky right-0 bg-card z-10 shadow-[-5px_0_5px_-5px_rgba(0,0,0,0.1)]">Aktionen</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {data.map((pos) => (
                                <tr key={pos.id} className="group hover:bg-muted/30 transition-colors">
                                    <td className="px-2 py-3 sticky left-0 z-10 bg-card group-hover:bg-muted/30 transition-colors shadow-[5px_0_5px_-5px_rgba(0,0,0,0.1)]">
                                        <div className="flex items-center gap-3">
                                            <Logo
                                                url={pos.stock.logoUrl}
                                                alt={pos.stock.name}
                                                fallback={pos.stock.symbol.slice(0, 2)}
                                            />
                                            <div className="min-w-0 flex-1 flex flex-col items-start gap-0.5">
                                                <div
                                                    className="font-semibold text-foreground cursor-pointer hover:text-primary transition-colors text-sm"
                                                    onClick={() => navigate(`/stock/${pos.stock.id}`)}
                                                >
                                                    {smartWrap(pos.stock.name)}
                                                </div>
                                                <div className="text-xs font-mono text-muted-foreground">{pos.stock.symbol}</div>
                                                <div className="text-[10px] text-muted-foreground/80">{pos.stock.sector}</div>
                                            </div>
                                        </div>
                                    </td>

                                    {/* Valor / ISIN */}
                                    <td className="px-2 py-3">
                                        <div className="text-xs space-y-0.5">
                                            {pos.stock.valor && (
                                                <div className="font-mono">
                                                    <span className="text-muted-foreground">Valor: </span>
                                                    <span className="font-medium">{pos.stock.valor}</span>
                                                </div>
                                            )}
                                            {pos.stock.isin && (
                                                <div className="font-mono text-muted-foreground truncate" title={pos.stock.isin}>
                                                    {pos.stock.isin}
                                                </div>
                                            )}
                                        </div>
                                    </td>

                                    {/* Anzahl */}
                                    <td className="px-4 py-3 text-right font-medium">{pos.shares}</td>

                                    {/* Kauf Kurs */}
                                    <td className="px-4 py-3 text-right">
                                        <div className="flex flex-col items-end">
                                            <span className="whitespace-nowrap">{formatCurrency(pos.buyPriceAvg, pos.stock.currency, false)}</span>
                                            {pos.stock.currency !== 'CHF' && (
                                                <span className="text-xs text-cyan-600 dark:text-cyan-400 font-medium whitespace-nowrap mt-0.5">
                                                    {formatCurrency(pos.buyValueCHF / pos.shares, 'CHF', false)}
                                                </span>
                                            )}
                                        </div>
                                    </td>

                                    {/* Kauf Wert */}
                                    <td className="px-4 py-3 text-right font-medium">
                                        <div className="flex flex-col items-end">
                                            <span className="whitespace-nowrap">{formatCurrency(pos.buyValue, pos.stock.currency, false)}</span>
                                            {pos.stock.currency !== 'CHF' && (
                                                <span className="text-xs text-cyan-600 dark:text-cyan-400 font-medium whitespace-nowrap mt-0.5">
                                                    {formatCurrency(pos.buyValueCHF, 'CHF', false)}
                                                </span>
                                            )}
                                        </div>
                                    </td>

                                    {/* Aktueller Kurs */}
                                    <td className="px-4 py-3 text-right">
                                        <div className="flex flex-col items-end">
                                            <span className="whitespace-nowrap">{formatCurrency(pos.stock.currentPrice, pos.stock.currency, false)}</span>
                                            {pos.stock.currency !== 'CHF' && (
                                                <span className="text-xs text-cyan-600 dark:text-cyan-400 font-medium whitespace-nowrap mt-0.5">
                                                    {formatCurrency(convertToCHF(pos.stock.currentPrice, pos.stock.currency), 'CHF', false)}
                                                </span>
                                            )}
                                        </div>
                                    </td>

                                    {/* Aktueller Wert */}
                                    <td className="px-4 py-3 text-right font-bold">
                                        <div className="flex flex-col items-end">
                                            <span className="whitespace-nowrap">{formatCurrency(pos.currentValue, pos.stock.currency, false)}</span>
                                            {pos.stock.currency !== 'CHF' && (
                                                <span className="text-xs text-cyan-600 dark:text-cyan-400 font-medium whitespace-nowrap mt-0.5">
                                                    {formatCurrency(convertToCHF(pos.currentValue, pos.stock.currency), 'CHF', false)}
                                                </span>
                                            )}
                                        </div>
                                    </td>

                                    {/* Gesamt +/- */}
                                    <td className="px-4 py-3 text-right">
                                        <div className="flex flex-col items-end">
                                            <span className={cn(
                                                "font-medium whitespace-nowrap",
                                                pos.gainLossTotal >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
                                            )}>
                                                {pos.gainLossTotal >= 0 ? '+' : ''}{formatCurrency(pos.gainLossTotal, pos.stock.currency, false)}
                                            </span>
                                            {pos.stock.currency !== 'CHF' && (
                                                <>
                                                    <div
                                                        className={cn(
                                                            "text-xs font-medium whitespace-nowrap mt-0.5",
                                                            pos.gainLossTotalCHF >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
                                                        )}
                                                        title="Gewinn/Verlust in CHF (inkl. Währungseffekt)"
                                                    >
                                                        {pos.gainLossTotalCHF >= 0 ? '+' : ''}{formatCurrency(pos.gainLossTotalCHF, 'CHF', false)}
                                                    </div>
                                                    <div className={cn(
                                                        "text-[10px] whitespace-nowrap mt-0.5",
                                                        pos.forexImpactCHF >= 0 ? "text-emerald-600/80 dark:text-emerald-400/80" : "text-rose-600/80 dark:text-rose-400/80"
                                                    )} title="Anteil Währungsgewinn/-verlust">
                                                        (Währung: {pos.forexImpactCHF >= 0 ? '+' : ''}{formatCurrency(pos.forexImpactCHF, 'CHF', false)})
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    </td>

                                    {/* Gesamt % +/- */}
                                    <td className="px-4 py-3 text-right">
                                        <div className={cn(
                                            "flex items-center justify-end gap-1 font-medium",
                                            pos.gainLossTotal >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
                                        )}>
                                            {pos.gainLossTotal >= 0 ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
                                            {pos.gainLossTotal >= 0 ? '+' : ''}{pos.gainLossTotalPercent.toFixed(2)}%
                                        </div>
                                    </td>

                                    {/* Aktionen */}
                                    <td className="px-2 py-3 sticky right-0 bg-card group-hover:bg-muted/30 transition-colors shadow-[-5px_0_5px_-5px_rgba(0,0,0,0.1)]">
                                        <div className="flex items-center justify-center gap-1">
                                            <button
                                                onClick={() => {
                                                    setSelectedPosition(pos);
                                                    setIsEditModalOpen(true);
                                                }}
                                                className="p-1 hover:bg-muted rounded text-primary transition-colors"
                                                title="Position bearbeiten (Kauf/Verkauf/Korrektur)"
                                            >
                                                <Edit className="size-3.5" />
                                            </button>
                                            <button
                                                onClick={() => {
                                                    if (confirm(`Position "${pos.stock.name}" wirklich löschen?`)) {
                                                        deletePosition(pos.id);
                                                    }
                                                }}
                                                className="text-muted-foreground hover:text-red-600 p-2 rounded-md hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors"
                                                title="Position löschen"
                                            >
                                                <Trash2 className="size-4" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {data.length === 0 && (
                                <tr>
                                    <td colSpan={10} className="px-4 py-12 text-center text-muted-foreground">
                                        {emptyMessage}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );

    const VorsorgeSection = () => {
        const vorsorgeDeposits = fixedDeposits?.filter(fd => fd.accountType === 'vorsorge') || [];

        if (vorsorgeDeposits.length === 0 && !searchTerm) return null;

        const filteredVorsorge = vorsorgeDeposits.filter(fd =>
            fd.bankName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (fd.notes && fd.notes.toLowerCase().includes(searchTerm.toLowerCase()))
        );

        if (filteredVorsorge.length === 0 && searchTerm) return null;

        const totalVorsorge = vorsorgeDeposits.reduce((sum, fd) => sum + fd.amount, 0);

        return (
            <div className="space-y-4 mb-8">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <h2 className="text-lg font-bold">Vorsorge</h2>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
                    <div className="flex justify-between items-end mb-6 border-b border-border pb-4">
                        <div>
                            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Vorsorgevermögen</h3>
                            <p className="text-xs text-muted-foreground mt-1">Total über alle 3a Konten</p>
                        </div>
                        <div className="text-right">
                            <span className="text-xl font-bold text-primary block">
                                {totalVorsorge.toLocaleString('de-CH', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} CHF
                            </span>
                        </div>
                    </div>

                    <div className="space-y-6">
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
                                <div key={fd.id} className="group relative">
                                    <div className="flex justify-between items-start mb-2">
                                        <div className="flex items-center gap-3">
                                            <Logo
                                                url={fd.logoUrl}
                                                alt={fd.bankName}
                                                size="size-10"
                                                fallback={
                                                    fd.accountType === 'vorsorge' ? '3a' : fd.bankName.slice(0, 2).toUpperCase()
                                                }
                                                className={fd.accountType === 'vorsorge' ? "bg-blue-100 text-blue-700 border-blue-200" : undefined}
                                            />
                                            <div>
                                                <h4 className="font-bold text-lg">{fd.bankName}</h4>
                                                {fd.notes && <p className="text-xs text-muted-foreground">{fd.notes}</p>}
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <span className="text-xl font-medium text-slate-600 dark:text-slate-300">
                                                {formatCurrency(fd.amount, fd.currency)}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Progress Bar Section */}
                                    <div className="ml-[52px]">
                                        <div className="flex justify-between text-xs mb-1.5 font-medium">
                                            <span className="text-slate-500 dark:text-slate-400">
                                                {current.toLocaleString('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className="text-[10px] uppercase text-muted-foreground ml-1">von {limit.toLocaleString('de-CH', { minimumFractionDigits: 2 })} Limit 2025</span>
                                            </span>
                                        </div>
                                        <div className="h-2.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden border border-slate-200 dark:border-slate-700">
                                            <div
                                                className="h-full bg-slate-700 dark:bg-slate-400 rounded-full transition-all duration-500"
                                                style={{ width: `${percent}%` }}
                                            />
                                        </div>
                                    </div>

                                    <div className="absolute top-0 right-0 flex gap-1 bg-card/80 backdrop-blur-sm p-1 rounded-bl-lg border-l border-b border-border shadow-sm">
                                        <button
                                            onClick={() => {
                                                setEditingFixedDeposit(fd);
                                                setIsAddFixedDepositModalOpen(true);
                                            }}
                                            className="p-1.5 hover:bg-muted rounded text-primary transition-colors"
                                            title="Bearbeiten"
                                            aria-label="Konto bearbeiten"
                                        >
                                            <Edit className="size-4" />
                                        </button>
                                        <button
                                            onClick={() => {
                                                if (confirm(`Konto bei "${fd.bankName}" wirklich löschen?`)) deleteFixedDeposit(fd.id);
                                            }}
                                            className="p-1.5 hover:bg-red-50 hover:text-red-600 rounded text-muted-foreground transition-colors"
                                            title="Löschen"
                                            aria-label="Konto löschen"
                                        >
                                            <Trash2 className="size-4" />
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        );
    };

    const FixedDepositTable = () => {
        const filteredFixedDeposits = fixedDeposits?.filter(fd =>
            fd.accountType !== 'vorsorge' && (
                fd.bankName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                (fd.notes && fd.notes.toLowerCase().includes(searchTerm.toLowerCase()))
            )) || [];

        // If filtering hides everything but there ARE header items, we might want to just show empty state inside the table
        // But if there are NO non-vorsorge deposits at all, and no search term, maybe hide the whole section? 
        // User asked for "Bankguthaben" implementation, usually implies the list exists.

        return (
            <div className="space-y-3">
                <div className="flex items-center gap-2">
                    <Landmark className="size-5 text-primary" />
                    <h2 className="text-lg font-bold">Bankguthaben (Konto & Einlagen)</h2>
                    <span className="text-xs font-mono bg-muted px-2 py-0.5 rounded-full text-muted-foreground">{filteredFixedDeposits.length} Konten</span>
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
                            <thead className="bg-muted/50 text-muted-foreground font-medium border-b border-border">
                                <tr>
                                    <th className="px-2 py-3">Bank / Institut</th>
                                    <th className="px-2 py-3">Konto-Typ</th>
                                    <th className="px-4 py-3 text-right">Betrag</th>
                                    <th className="px-4 py-3 text-right">Zins p.a.</th>
                                    <th className="px-4 py-3 text-right">Jährlicher Ertrag</th>
                                    <th className="px-4 py-3 text-center">Aktionen</th>
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
                                            <td className="px-4 py-3 font-medium">
                                                <div className="flex items-center gap-3">
                                                    <Logo
                                                        url={fd.logoUrl}
                                                        alt={fd.bankName}
                                                        fallback={fd.bankName.slice(0, 2).toUpperCase()}
                                                    />
                                                    <div className="flex flex-col">
                                                        <span>{fd.bankName}</span>
                                                        {fd.notes && <span className="text-xs text-muted-foreground">{fd.notes}</span>}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-2 py-3">
                                                <span className={cn(
                                                    "px-2 py-0.5 rounded-md text-xs font-medium border",
                                                    fd.accountType === 'sparkonto'
                                                        ? "bg-blue-100 text-blue-900 border-blue-300 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-900/50"
                                                        : "bg-gray-50 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700"
                                                )}>
                                                    {fd.accountType === 'sparkonto' ? 'Sparkonto' : 'Privatkonto'}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-right font-bold text-foreground">
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
                                            <td className={`px-4 py-3 text-right font-medium ${isNegative ? 'text-red-500' : 'text-green-600 dark:text-green-400'}`}>
                                                {isNegative ? '-' : '+'}CHF {Math.abs(netAnnualReturn).toLocaleString('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </td>
                                            <td className="px-2 py-3">
                                                <div className="flex items-center justify-center gap-1">
                                                    <button
                                                        onClick={() => {
                                                            setEditingFixedDeposit(fd);
                                                            setIsAddFixedDepositModalOpen(true);
                                                        }}
                                                        className="text-muted-foreground hover:text-primary p-2 rounded-md hover:bg-primary/10 transition-colors"
                                                        title="Bearbeiten"
                                                    >
                                                        <Edit className="size-4" />
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
    };

    return (
        <div className="p-6 md:p-8 space-y-8 animate-in fade-in duration-500">
            {/* Header / Actions */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="relative w-full sm:w-72">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                    <input
                        type="text"
                        placeholder="Aktien, ETFs oder Festgeld suchen..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 rounded-lg border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all shadow-sm"
                    />
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => setIsAddFixedDepositModalOpen(true)}
                        className="flex items-center gap-2 bg-secondary text-secondary-foreground px-4 py-2 rounded-lg hover:bg-secondary/90 transition-colors shadow-sm font-medium text-sm border border-border"
                    >
                        <Landmark className="size-4" />
                        <span>Bank / Vorsorge</span>
                    </button>
                    <button
                        onClick={() => navigate('/calculator?mode=buy&from=portfolio')}
                        className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors shadow-sm font-medium text-sm"
                    >
                        <Plus className="size-4" />
                        <span>Aktie / ETF</span>
                    </button>
                </div>
            </div>

            {/* Aktien Table */}
            <PositionTable
                title="Aktien"
                icon={BarChart3}
                data={stockPositions}
                emptyMessage={searchTerm ? 'Keine Aktien gefunden.' : 'Noch keine Aktien im Depot.'}
            />

            {/* ETFs Table */}
            <PositionTable
                title="ETFs"
                icon={PieChart}
                data={etfPositions}
                emptyMessage={searchTerm ? 'Keine ETFs gefunden.' : 'Noch keine ETFs im Depot.'}
            />

            {/* Vorsorge Section */}
            <VorsorgeSection />

            {/* Bankguthaben Table */}
            <FixedDepositTable />

            <AddFixedDepositModal
                isOpen={isAddFixedDepositModalOpen}
                onClose={() => {
                    setIsAddFixedDepositModalOpen(false);
                    setEditingFixedDeposit(null);
                }}
                editingDeposit={editingFixedDeposit}
            />

            {selectedPosition && (
                <EditPositionModal
                    isOpen={isEditModalOpen}
                    onClose={() => {
                        setIsEditModalOpen(false);
                        setSelectedPosition(null);
                    }}
                    position={selectedPosition}
                    onUpdate={handleUpdate}
                    onDelete={deletePosition}
                />
            )}


        </div>
    );
}
