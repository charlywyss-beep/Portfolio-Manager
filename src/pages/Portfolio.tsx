import { useState } from 'react';
import { usePortfolio } from '../context/PortfolioContext';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Trash2, ArrowUpRight, ArrowDownRight, PieChart, BarChart3, Edit, Landmark } from 'lucide-react';
import { cn } from '../utils';
import { useCurrencyFormatter } from '../utils/currency';
import { AddPositionModal } from '../components/AddPositionModal';
import { EditPositionModal } from '../components/EditPositionModal';
import { AddFixedDepositModal } from '../components/AddFixedDepositModal';
import { PriceUpdateDialog } from '../components/PriceUpdateDialog';

export function Portfolio() {
    const navigate = useNavigate();
    const { positions: rawPositions, stocks, fixedDeposits, addPosition, deletePosition, updatePosition, deleteFixedDeposit } = usePortfolio();
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isAddFixedDepositModalOpen, setIsAddFixedDepositModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [selectedPosition, setSelectedPosition] = useState<any>(null);
    const [editingFixedDeposit, setEditingFixedDeposit] = useState<any>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [priceEditStock, setPriceEditStock] = useState<any>(null);
    const { formatCurrency } = useCurrencyFormatter();

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

    const handleEdit = (pos: any) => {
        setSelectedPosition(pos);
        setIsEditModalOpen(true);
    };

    const handleUpdate = (id: string, newShares: number, newAvgPrice?: number) => {
        const updates: any = { shares: newShares };
        if (newAvgPrice !== undefined) {
            updates.buyPriceAvg = newAvgPrice;
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
                    <table className="w-full text-sm text-left">
                        <thead className="bg-muted/50 text-muted-foreground font-medium border-b border-border">
                            <tr>
                                <th className="px-4 py-3 min-w-[200px]">Name</th>
                                <th className="px-4 py-3 min-w-[120px]">Valor / ISIN</th>
                                <th className="px-4 py-3 text-right whitespace-nowrap">Anzahl</th>
                                <th className="px-4 py-3 text-right whitespace-nowrap">Kauf Kurs</th>
                                <th className="px-4 py-3 text-right whitespace-nowrap">Kauf Wert</th>
                                <th className="px-4 py-3 text-right whitespace-nowrap">Aktueller Kurs</th>
                                <th className="px-4 py-3 text-right whitespace-nowrap">Aktueller Wert</th>
                                <th className="px-4 py-3 text-right whitespace-nowrap">Gesamt +/-</th>
                                <th className="px-4 py-3 text-right whitespace-nowrap">Gesamt % +/-</th>
                                <th className="px-4 py-3 text-center sticky right-0 bg-muted z-10 shadow-[-10px_0_10px_-10px_rgba(0,0,0,0.1)]">Aktionen</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {data.map((pos) => (
                                <tr key={pos.id} className="group hover:bg-muted/30 transition-colors">
                                    {/* Name */}
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-3">
                                            {pos.stock.logoUrl ? (
                                                <div className="size-8 rounded-lg bg-white p-1 border border-border shadow-sm flex items-center justify-center shrink-0">
                                                    <img src={pos.stock.logoUrl} alt={pos.stock.name} className="object-contain max-h-full max-w-full" />
                                                </div>
                                            ) : (
                                                <div className="size-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold border border-primary/20 text-xs shrink-0">
                                                    {pos.stock.symbol.slice(0, 2)}
                                                </div>
                                            )}
                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-center gap-2">
                                                    <div
                                                        className="font-semibold text-foreground truncate cursor-pointer hover:text-primary transition-colors"
                                                        onClick={() => navigate(`/stock/${pos.stock.id}`)}
                                                    >
                                                        {pos.stock.name}
                                                    </div>
                                                </div>
                                                <div className="text-xs text-muted-foreground flex items-center gap-1">
                                                    <span className="font-mono bg-muted px-1 rounded">{pos.stock.symbol}</span>
                                                    <span>• {pos.stock.sector}</span>
                                                    {pos.stock.dividendYield && <span>• {pos.stock.dividendYield.toFixed(2)}% Div.</span>}
                                                </div>
                                            </div>
                                        </div>
                                    </td>

                                    {/* Valor / ISIN */}
                                    <td className="px-4 py-3">
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
                                        {pos.buyPriceAvg.toLocaleString('de-DE', { style: 'currency', currency: pos.stock.currency })}
                                    </td>

                                    {/* Kauf Wert */}
                                    <td className="px-4 py-3 text-right font-medium">
                                        {pos.buyValue.toLocaleString('de-DE', { style: 'currency', currency: pos.stock.currency })}
                                    </td>

                                    {/* Aktueller Kurs */}
                                    <td className="px-4 py-3 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            <span>{pos.stock.currentPrice.toLocaleString('de-DE', { style: 'currency', currency: pos.stock.currency })}</span>
                                            <button
                                                onClick={() => setPriceEditStock(pos.stock)}
                                                className="text-muted-foreground hover:text-primary p-1 rounded transition-colors"
                                                title="Kurs aktualisieren"
                                            >
                                                <Edit className="size-3" />
                                            </button>
                                        </div>
                                    </td>

                                    {/* Aktueller Wert */}
                                    <td className="px-4 py-3 text-right font-bold">
                                        {formatCurrency(pos.currentValue, pos.stock.currency)}
                                    </td>

                                    {/* Gesamt +/- */}
                                    <td className="px-4 py-3 text-right">
                                        <div className={cn(
                                            "font-medium",
                                            pos.gainLossTotal >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
                                        )}>
                                            {pos.gainLossTotal >= 0 ? '+' : ''}{formatCurrency(pos.gainLossTotal, pos.stock.currency)}
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
                                    <td className="px-4 py-3 sticky right-0 bg-card group-hover:bg-muted/30 transition-colors shadow-[-10px_0_10px_-10px_rgba(0,0,0,0.1)]">
                                        <div className="flex items-center justify-center gap-1">
                                            <button
                                                onClick={() => handleEdit(pos)}
                                                className="text-muted-foreground hover:text-primary p-2 rounded-md hover:bg-primary/10 transition-colors"
                                                title="Position bearbeiten"
                                            >
                                                <Edit className="size-4" />
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

    const FixedDepositTable = () => {
        const filteredFixedDeposits = fixedDeposits?.filter(fd =>
            fd.bankName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (fd.notes && fd.notes.toLowerCase().includes(searchTerm.toLowerCase()))
        ) || [];

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
                                    <th className="px-4 py-3">Bank / Institut</th>
                                    <th className="px-4 py-3">Konto-Typ</th>
                                    <th className="px-4 py-3 text-right">Betrag</th>
                                    <th className="px-4 py-3 text-right">Zins p.a.</th>
                                    <th className="px-4 py-3 text-right">Jährlicher Ertrag</th>
                                    <th className="px-4 py-3 text-center">Aktionen</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {filteredFixedDeposits.map((fd) => {
                                    const interestAmount = fd.amount * (fd.interestRate / 100);
                                    return (
                                        <tr key={fd.id} className="group hover:bg-muted/30 transition-colors">
                                            <td className="px-4 py-3 font-medium">
                                                <div className="flex items-center gap-3">
                                                    {fd.logoUrl ? (
                                                        <div className="size-8 rounded-lg bg-white p-1 border border-border shadow-sm flex items-center justify-center shrink-0">
                                                            <img src={fd.logoUrl} alt={fd.bankName} className="object-contain max-h-full max-w-full" />
                                                        </div>
                                                    ) : (
                                                        <div className="size-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold border border-primary/20 text-xs shrink-0">
                                                            {fd.bankName.slice(0, 2).toUpperCase()}
                                                        </div>
                                                    )}
                                                    <div className="flex flex-col">
                                                        <span>{fd.bankName}</span>
                                                        {fd.notes && <span className="text-xs text-muted-foreground">{fd.notes}</span>}
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
                                            <td className="px-4 py-3 text-right font-medium text-green-600 dark:text-green-400">
                                                +{formatCurrency(interestAmount, fd.currency)}
                                            </td>
                                            <td className="px-4 py-3">
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
                        <span>Bankkonto</span>
                    </button>
                    <button
                        onClick={() => setIsAddModalOpen(true)}
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

            {/* Fixed Deposits Table */}
            <FixedDepositTable />

            <AddPositionModal
                isOpen={isAddModalOpen}
                onClose={() => setIsAddModalOpen(false)}
                stocks={stocks}
                onAdd={addPosition}
            />

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

            {priceEditStock && (
                <PriceUpdateDialog
                    isOpen={true}
                    onClose={() => setPriceEditStock(null)}
                    stock={priceEditStock}
                />
            )}
        </div>
    );
}
