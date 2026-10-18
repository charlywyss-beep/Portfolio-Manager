import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePortfolio } from '../context/PortfolioContext';
import { Plus, PieChart, BarChart3, Landmark, RefreshCw, ShieldCheck } from 'lucide-react';
import { useCurrencyFormatter } from '../utils/currency';
import { cn } from '../utils'; // Import cn
import { EditPositionModal } from '../components/EditPositionModal';
import { AddFixedDepositModal } from '../components/AddFixedDepositModal';
import { PositionTable } from '../components/PositionTable';
import { VorsorgeSection } from '../components/VorsorgeSection';
import { FixedDepositTable } from '../components/FixedDepositTable';

export function Portfolio() {
    const { positions: rawPositions, stocks, fixedDeposits, deletePosition, updatePosition, refreshAllPrices, isGlobalRefreshing, lastGlobalRefresh } = usePortfolio();
    const navigate = useNavigate();
    const [isAddFixedDepositModalOpen, setIsAddFixedDepositModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [selectedPosition, setSelectedPosition] = useState<any>(null);
    const [editingFixedDeposit, setEditingFixedDeposit] = useState<any>(null);
    const { convertToCHF } = useCurrencyFormatter();

    // Persistent Tab State
    const [activeTab, setActiveTab] = useState<'stocks' | 'etfs' | 'vorsorge' | 'bank'>(() => {
        const saved = localStorage.getItem('portfolio_active_tab');
        if (saved === 'stocks' || saved === 'etfs' || saved === 'vorsorge' || saved === 'bank') {
            return saved;
        }
        return 'stocks';
    });

    useEffect(() => {
        localStorage.setItem('portfolio_active_tab', activeTab);
    }, [activeTab]);

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
            buyValueCHF,
            gainLossTotalCHF,
            forexImpactCHF
        };
    }).filter(Boolean) as any[];

    // Sorting
    const [sortConfig, setSortConfig] = useState<{ key: 'name' | 'currency' | 'value' | 'performance', direction: 'asc' | 'desc' }>({ key: 'name', direction: 'asc' });

    const getSortedPositions = (posList: any[]) => {
        return [...posList].sort((a, b) => {
            if (sortConfig.key === 'name') {
                return a.stock.name.localeCompare(b.stock.name);
            }
            if (sortConfig.key === 'currency') {
                const currComp = a.stock.currency.localeCompare(b.stock.currency);
                if (currComp !== 0) return currComp;
                return a.stock.name.localeCompare(b.stock.name);
            }
            if (sortConfig.key === 'value') {
                return b.currentValueCHF - a.currentValueCHF;
            }
            if (sortConfig.key === 'performance') {
                return b.gainLossTotalPercent - a.gainLossTotalPercent;
            }
            return 0;
        });
    };

    const sortedPositions = getSortedPositions(positions);

    const stockPositions = sortedPositions.filter(p => !p.stock.type || p.stock.type === 'stock');
    const etfPositions = sortedPositions.filter(p => p.stock.type === 'etf');
    const vorsorgeDeposits = fixedDeposits?.filter(fd => fd.accountType === 'vorsorge') || [];
    const filteredFixedDeposits = fixedDeposits?.filter(fd => fd.accountType !== 'vorsorge') || [];

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
        <div className="h-full flex flex-col p-4 md:p-6 space-y-3 bg-gradient-to-br from-background via-background to-muted/20 overflow-hidden">
            {/* Header - Fixed Height */}
            <div className="shrink-0 bg-background pb-2 -mt-4 -mx-4 px-4 md:-mt-6 md:-mx-6 md:px-6">
                <div className="border-b bg-card rounded-t-xl -mx-4 md:-mx-6">
                    <div className="w-full px-3 sm:px-4 py-3 sm:py-3.5 md:px-6 lg:px-6">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div className="flex items-center gap-3 pl-12 lg:pl-0 min-h-[38px]">
                                <div className="p-2 sm:p-3 rounded-xl bg-gradient-to-br from-emerald-500/20 to-green-500/20 text-emerald-600 dark:text-emerald-400 shrink-0">
                                    <BarChart3 className="size-5 sm:size-6" />
                                </div>
                                <div>
                                    <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Positionen</h1>
                                    <p className="text-muted-foreground hidden md:block">Aktien, ETFs und Festgeld verwalten</p>
                                </div>
                            </div>

                            <div className="flex items-center justify-center sm:justify-end gap-2 w-full sm:w-auto sm:ml-auto">
                                <button
                                    onClick={() => setIsAddFixedDepositModalOpen(true)}
                                    className="flex items-center justify-center gap-2 bg-secondary text-secondary-foreground px-3.5 sm:px-4 py-2 rounded-lg hover:bg-secondary/90 transition-colors font-medium border border-border shadow-sm shrink-0"
                                    title="Bank / Vorsorge"
                                >
                                    <Landmark className="size-4" />
                                    <span className="hidden md:inline">Bank / Vorsorge</span>
                                </button>
                                <button
                                    onClick={() => navigate('/calculator?mode=buy&from=portfolio')}
                                    className="flex items-center justify-center gap-1.5 sm:gap-2 bg-primary text-primary-foreground px-3.5 sm:px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors font-medium shadow-sm shrink-0 whitespace-nowrap"
                                >
                                    <Plus className="size-4" />
                                    <span>Neu</span>
                                </button>
                                <select
                                    className="w-auto min-w-0 px-3 py-2 rounded-lg border border-border bg-card text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all shadow-sm appearance-none cursor-pointer text-center"
                                    value={sortConfig.key}
                                    onChange={(e) => setSortConfig({ ...sortConfig, key: e.target.value as any })}
                                >
                                    <option value="name">Name: A-Z</option>
                                    <option value="currency">Währung</option>
                                    <option value="value">Wert: Hoch-Tief</option>
                                    <option value="performance">Performance: Beste</option>
                                </select>
                                <button
                                    onClick={() => refreshAllPrices(true)}
                                    disabled={isGlobalRefreshing}
                                    className={cn(
                                        "flex items-center justify-center gap-2 px-3.5 sm:px-4 py-2 rounded-lg border font-medium transition-all shadow-sm shrink-0",
                                        "bg-blue-600 text-white border-blue-700 hover:bg-blue-700 hover:border-blue-800",
                                        "active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                                    )}
                                    title="Alle Aktienpreise aktualisieren"
                                >
                                    <RefreshCw className={cn("size-4", isGlobalRefreshing && "animate-spin")} />
                                    <span className="hidden md:inline">
                                        {isGlobalRefreshing
                                            ? 'Aktualisiere...'
                                            : lastGlobalRefresh
                                                ? `Vor ${Math.floor((new Date().getTime() - lastGlobalRefresh.getTime()) / 60000)} Min`
                                                : 'Aktualisieren'}
                                    </span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Sub-Tabs: Aktien | ETFs | Vorsorge | Bank */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 shrink-0">
                <button
                    onClick={() => setActiveTab('stocks')}
                    className={cn(
                        "flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs md:text-sm font-semibold transition-all border shadow-sm shrink-0",
                        activeTab === 'stocks'
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-card text-muted-foreground border-border hover:bg-accent hover:text-foreground"
                    )}
                >
                    <BarChart3 className="size-4" />
                    <span>Aktien</span>
                    <span className={cn(
                        "text-xs px-1.5 py-0.5 rounded-full font-mono",
                        activeTab === 'stocks' ? "bg-primary-foreground/20 text-primary-foreground" : "bg-muted text-muted-foreground"
                    )}>
                        {stockPositions.length}
                    </span>
                </button>

                <button
                    onClick={() => setActiveTab('etfs')}
                    className={cn(
                        "flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs md:text-sm font-semibold transition-all border shadow-sm shrink-0",
                        activeTab === 'etfs'
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-card text-muted-foreground border-border hover:bg-accent hover:text-foreground"
                    )}
                >
                    <PieChart className="size-4" />
                    <span>ETFs</span>
                    <span className={cn(
                        "text-xs px-1.5 py-0.5 rounded-full font-mono",
                        activeTab === 'etfs' ? "bg-primary-foreground/20 text-primary-foreground" : "bg-muted text-muted-foreground"
                    )}>
                        {etfPositions.length}
                    </span>
                </button>

                <button
                    onClick={() => setActiveTab('vorsorge')}
                    className={cn(
                        "flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs md:text-sm font-semibold transition-all border shadow-sm shrink-0",
                        activeTab === 'vorsorge'
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-card text-muted-foreground border-border hover:bg-accent hover:text-foreground"
                    )}
                >
                    <ShieldCheck className="size-4" />
                    <span>Vorsorge</span>
                    <span className={cn(
                        "text-xs px-1.5 py-0.5 rounded-full font-mono",
                        activeTab === 'vorsorge' ? "bg-primary-foreground/20 text-primary-foreground" : "bg-muted text-muted-foreground"
                    )}>
                        {vorsorgeDeposits.length}
                    </span>
                </button>

                <button
                    onClick={() => setActiveTab('bank')}
                    className={cn(
                        "flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs md:text-sm font-semibold transition-all border shadow-sm shrink-0",
                        activeTab === 'bank'
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-card text-muted-foreground border-border hover:bg-accent hover:text-foreground"
                    )}
                >
                    <Landmark className="size-4" />
                    <span>Bankguthaben</span>
                    <span className={cn(
                        "text-xs px-1.5 py-0.5 rounded-full font-mono",
                        activeTab === 'bank' ? "bg-primary-foreground/20 text-primary-foreground" : "bg-muted text-muted-foreground"
                    )}>
                        {filteredFixedDeposits.length}
                    </span>
                </button>
            </div>

            {/* Active Section fills flex-1 min-h-0 */}
            {activeTab === 'stocks' && (
                <PositionTable
                    title="Aktien"
                    icon={BarChart3}
                    data={stockPositions}
                    emptyMessage="Noch keine Aktien im Depot."
                    setSelectedPosition={setSelectedPosition}
                    setIsEditModalOpen={setIsEditModalOpen}
                    hideHeader={true}
                />
            )}

            {activeTab === 'etfs' && (
                <PositionTable
                    title="ETFs"
                    icon={PieChart}
                    data={etfPositions}
                    emptyMessage="Noch keine ETFs im Depot."
                    setSelectedPosition={setSelectedPosition}
                    setIsEditModalOpen={setIsEditModalOpen}
                    hideHeader={true}
                />
            )}

            {activeTab === 'vorsorge' && (
                <VorsorgeSection
                    searchTerm=""
                    setIsAddFixedDepositModalOpen={setIsAddFixedDepositModalOpen}
                    setEditingFixedDeposit={setEditingFixedDeposit}
                />
            )}

            {activeTab === 'bank' && (
                <FixedDepositTable
                    searchTerm=""
                    setIsAddFixedDepositModalOpen={setIsAddFixedDepositModalOpen}
                    setEditingFixedDeposit={setEditingFixedDeposit}
                />
            )}

            <AddFixedDepositModal
                isOpen={isAddFixedDepositModalOpen}
                onClose={() => {
                    setIsAddFixedDepositModalOpen(false);
                    setEditingFixedDeposit(null);
                }}
                editingDeposit={editingFixedDeposit}
            />

            {
                selectedPosition && (
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
                )
            }
        </div >
    );
}
