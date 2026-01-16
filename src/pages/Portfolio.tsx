import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePortfolio } from '../context/PortfolioContext';
import { Plus, Search, PieChart, BarChart3, Landmark, RefreshCw } from 'lucide-react';
import { useCurrencyFormatter } from '../utils/currency';
import { cn } from '../utils'; // Import cn
import { EditPositionModal } from '../components/EditPositionModal';
import { AddFixedDepositModal } from '../components/AddFixedDepositModal';
import { PositionTable } from '../components/PositionTable';
import { VorsorgeSection } from '../components/VorsorgeSection';
import { FixedDepositTable } from '../components/FixedDepositTable';

export function Portfolio() {
    const { positions: rawPositions, stocks, deletePosition, updatePosition, refreshAllPrices, isGlobalRefreshing, lastGlobalRefresh } = usePortfolio();
    const navigate = useNavigate();
    const [isAddFixedDepositModalOpen, setIsAddFixedDepositModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [selectedPosition, setSelectedPosition] = useState<any>(null);
    const [editingFixedDeposit, setEditingFixedDeposit] = useState<any>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const { convertToCHF } = useCurrencyFormatter();

    // Force re-render every minute to update the "Updated X min ago" text
    // Also trigger auto-refresh after 5 minutes
    const [, setTick] = useState(0);
    useEffect(() => {
        const timer = setInterval(() => {
            setTick(t => t + 1);

            // Auto-refresh if last refresh was more than 5 minutes ago
            if (lastGlobalRefresh) {
                const minutesSinceRefresh = Math.floor((new Date().getTime() - lastGlobalRefresh.getTime()) / 60000);
                if (minutesSinceRefresh >= 5 && !isGlobalRefreshing) {
                    refreshAllPrices();
                }
            }
        }, 60000); // 60000ms = 1 minute

        // iOS Safari: Check on visibility change (when tab becomes visible again)
        const handleVisibilityChange = () => {
            if (!document.hidden && lastGlobalRefresh) {
                const minutesSinceRefresh = Math.floor((new Date().getTime() - lastGlobalRefresh.getTime()) / 60000);
                if (minutesSinceRefresh >= 5 && !isGlobalRefreshing) {
                    refreshAllPrices();
                }
                setTick(t => t + 1); // Force re-render to update displayed time
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            clearInterval(timer);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [lastGlobalRefresh, isGlobalRefreshing, refreshAllPrices]);

    // Enrich positions with stock data and calculations
    const positions = (rawPositions || []).map((pos) => {
        const stock = stocks.find((s) => s.id === pos.stockId);
        if (!stock) return null;

        // Current values
        const currentPrice = stock.currentPrice ?? 0;
        const previousClose = stock.previousClose ?? currentPrice;
        const currentValue = pos.shares * currentPrice;
        const buyValue = pos.shares * pos.buyPriceAvg;

        // Total gain/loss (since purchase)
        const gainLossTotal = currentValue - buyValue;
        const gainLossTotalPercent = buyValue !== 0 ? (gainLossTotal / buyValue) * 100 : 0;

        // Daily performance
        const dailyChange = currentPrice - previousClose;
        const dailyChangePercent = previousClose !== 0 ? (dailyChange / previousClose) * 100 : 0;
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


    // Sorting
    const [sortConfig, setSortConfig] = useState<{ key: 'name' | 'currency' | 'value' | 'performance', direction: 'asc' | 'desc' }>({ key: 'name', direction: 'asc' });

    const getSortedPositions = (posList: any[]) => {
        return [...posList].sort((a, b) => {
            if (sortConfig.key === 'name') {
                return a.stock.name.localeCompare(b.stock.name);
            }
            if (sortConfig.key === 'currency') {
                // Primary: Currency, Secondary: Name
                const currComp = a.stock.currency.localeCompare(b.stock.currency);
                if (currComp !== 0) return currComp;
                return a.stock.name.localeCompare(b.stock.name);
            }
            if (sortConfig.key === 'value') {
                return b.currentValueCHF - a.currentValueCHF; // High to Low
            }
            if (sortConfig.key === 'performance') {
                return b.gainLossTotalPercent - a.gainLossTotalPercent; // Best first
            }
            return 0;
        });
    };

    const sortedFilteredPositions = getSortedPositions(filteredPositions);

    const stockPositions = sortedFilteredPositions.filter(p => !p.stock.type || p.stock.type === 'stock');
    const etfPositions = sortedFilteredPositions.filter(p => p.stock.type === 'etf');

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
                {/* SORT CONTROL */}
                {/* SORT CONTROL REMOVED */}
                <div className="flex gap-2 w-full sm:w-auto">
                    <button
                        onClick={() => setIsAddFixedDepositModalOpen(true)}
                        className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-secondary text-secondary-foreground px-4 py-2 rounded-lg hover:bg-secondary/90 transition-colors shadow-sm font-medium text-sm border border-border"
                    >
                        <Landmark className="size-4" />
                        <span className="hidden sm:inline">Bank / Vorsorge</span>
                        <span className="sm:hidden">Bank</span>
                    </button>
                    <button
                        onClick={() => navigate('/calculator?mode=buy&from=portfolio')}
                        className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors shadow-sm font-medium text-sm"
                    >
                        <Plus className="size-4" />
                        <span>Neu</span>
                    </button>
                </div>
            </div>

            {/* Aktien Table */}
            <PositionTable
                title="Aktien"
                icon={BarChart3}
                data={stockPositions}
                emptyMessage={searchTerm ? 'Keine Aktien gefunden.' : 'Noch keine Aktien im Depot.'}
                setSelectedPosition={setSelectedPosition}
                setIsEditModalOpen={setIsEditModalOpen}
                headerAction={
                    <div className="flex items-center gap-2">
                        <select
                            className="pl-3 pr-8 py-1.5 rounded-lg border border-border bg-card text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all shadow-sm appearance-none cursor-pointer"
                            value={sortConfig.key}
                            onChange={(e) => setSortConfig({ ...sortConfig, key: e.target.value as any })}
                        >
                            <option value="name">Name (A-Z)</option>
                            <option value="currency">Währung</option>
                            <option value="value">Wert (Hoch-Tief)</option>
                            <option value="performance">Performance (Beste)</option>
                        </select>
                        <button
                            onClick={() => refreshAllPrices(true)}
                            disabled={isGlobalRefreshing}
                            className={cn(
                                "flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all shadow-sm",
                                "bg-blue-600 text-white border-blue-700 hover:bg-blue-700 hover:border-blue-800",
                                "active:scale-95",
                                isGlobalRefreshing && "opacity-50 cursor-not-allowed"
                            )}
                            title="Alle Aktienpreise aktualisieren"
                        >
                            <RefreshCw className={cn("size-3.5", isGlobalRefreshing && "animate-spin")} />
                            <span>
                                {isGlobalRefreshing
                                    ? 'Aktualisiere...'
                                    : lastGlobalRefresh
                                        ? `Vor ${Math.floor((new Date().getTime() - lastGlobalRefresh.getTime()) / 60000)} Min`
                                        : 'Jetzt aktualisieren'}
                            </span>
                        </button>
                    </div>
                }
            />

            {/* ETFs Table */}
            <PositionTable
                title="ETFs"
                icon={PieChart}
                data={etfPositions}
                emptyMessage={searchTerm ? 'Keine ETFs gefunden.' : 'Noch keine ETFs im Depot.'}
                setSelectedPosition={setSelectedPosition}
                setIsEditModalOpen={setIsEditModalOpen}
            />

            {/* Vorsorge Section */}
            <VorsorgeSection
                searchTerm={searchTerm}
                setIsAddFixedDepositModalOpen={setIsAddFixedDepositModalOpen}
                setEditingFixedDeposit={setEditingFixedDeposit}
            />

            {/* Bankguthaben Table */}
            <FixedDepositTable
                searchTerm={searchTerm}
                setIsAddFixedDepositModalOpen={setIsAddFixedDepositModalOpen}
                setEditingFixedDeposit={setEditingFixedDeposit}
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
        </div>
    );
}
