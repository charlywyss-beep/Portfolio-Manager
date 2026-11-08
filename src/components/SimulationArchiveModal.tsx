import { useState, useMemo } from 'react';
import { X, Search, FileText, ArrowDownToLine, Trash2, FolderArchive, Calendar, TrendingUp, TrendingDown } from 'lucide-react';
import { usePortfolio } from '../context/PortfolioContext';
import type { SavedSimulation } from '../types';

interface SimulationArchiveModalProps {
    isOpen: boolean;
    onClose: () => void;
    onLoadSimulation: (sim: SavedSimulation) => void;
    onExportPdf: (sim: SavedSimulation) => void;
}

export function SimulationArchiveModal({ isOpen, onClose, onLoadSimulation, onExportPdf }: SimulationArchiveModalProps) {
    const { simulations, deleteSimulation, clearSimulations } = usePortfolio();
    const [filter, setFilter] = useState<'all' | 'buy' | 'sell'>('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

    const filteredSimulations = useMemo(() => {
        return (simulations || []).filter(sim => {
            if (filter !== 'all' && sim.mode !== filter) return false;
            if (!searchTerm.trim()) return true;
            const term = searchTerm.toLowerCase();
            return (
                (sim.stockName && sim.stockName.toLowerCase().includes(term)) ||
                (sim.stockSymbol && sim.stockSymbol.toLowerCase().includes(term)) ||
                (sim.stockIsin && sim.stockIsin.toLowerCase().includes(term))
            );
        });
    }, [simulations, filter, searchTerm]);

    const buyCount = useMemo(() => (simulations || []).filter(s => s.mode === 'buy').length, [simulations]);
    const sellCount = useMemo(() => (simulations || []).filter(s => s.mode === 'sell').length, [simulations]);

    if (!isOpen) return null;

    const fmtMoney = (val: number | undefined, curr: string) => {
        if (val === undefined || isNaN(val)) return '–';
        const formattedNum = new Intl.NumberFormat('de-CH', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(val);
        return `${formattedNum} ${curr}`;
    };

    const formatDate = (iso: string) => {
        try {
            return new Date(iso).toLocaleString('de-CH', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        } catch {
            return iso;
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
            <div
                className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden text-foreground animate-in zoom-in-95 duration-200"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="px-5 py-4 border-b border-border flex items-center justify-between shrink-0 bg-muted/30">
                    <div className="flex items-center gap-3">
                        <div className="size-10 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0">
                            <FolderArchive className="size-5" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                                <span>Simulations-Archiv</span>
                                <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-400 font-semibold">
                                    {simulations?.length || 0}
                                </span>
                            </h2>
                            <p className="text-xs text-muted-foreground">
                                Automatisch über Cloud-Sync auf Desktop, iPad & iPhone abgeglichen
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 hover:bg-muted rounded-lg text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                        aria-label="Schliessen"
                    >
                        <X className="size-5" />
                    </button>
                </div>

                {/* Filters & Search Toolbar */}
                <div className="p-4 border-b border-border bg-background flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between shrink-0">
                    {/* Segmented Mode Filter */}
                    <div className="flex bg-muted rounded-lg p-1 border border-border/50 shrink-0">
                        <button
                            onClick={() => setFilter('all')}
                            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer ${filter === 'all'
                                ? 'bg-background text-foreground shadow-xs'
                                : 'text-muted-foreground hover:text-foreground'
                                }`}
                        >
                            Alle ({simulations?.length || 0})
                        </button>
                        <button
                            onClick={() => setFilter('buy')}
                            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all flex items-center gap-1.5 cursor-pointer ${filter === 'buy'
                                ? 'bg-emerald-600 text-white shadow-xs'
                                : 'text-muted-foreground hover:text-foreground'
                                }`}
                        >
                            <TrendingUp className="size-3.5" />
                            <span>Käufe ({buyCount})</span>
                        </button>
                        <button
                            onClick={() => setFilter('sell')}
                            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all flex items-center gap-1.5 cursor-pointer ${filter === 'sell'
                                ? 'bg-rose-600 text-white shadow-xs'
                                : 'text-muted-foreground hover:text-foreground'
                                }`}
                        >
                            <TrendingDown className="size-3.5" />
                            <span>Verkäufe ({sellCount})</span>
                        </button>
                    </div>

                    {/* Search Bar */}
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                        <input
                            type="text"
                            placeholder="Nach Aktie, Symbol oder ISIN suchen..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="w-full pl-9 pr-8 py-1.5 text-xs rounded-lg border border-input bg-muted/40 focus:bg-background text-foreground focus:ring-1 focus:ring-primary transition-all"
                        />
                        {searchTerm && (
                            <button
                                onClick={() => setSearchTerm('')}
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                            >
                                <X className="size-3.5" />
                            </button>
                        )}
                    </div>
                </div>

                {/* List Body */}
                <div className="p-4 sm:p-5 overflow-y-auto space-y-3 flex-1 bg-muted/10">
                    {filteredSimulations.length === 0 ? (
                        <div className="py-16 text-center space-y-3">
                            <div className="size-14 rounded-2xl bg-muted/50 border border-border/80 flex items-center justify-center mx-auto text-muted-foreground">
                                <FolderArchive className="size-7 opacity-50" />
                            </div>
                            <h3 className="text-sm font-bold text-foreground">Keine Simulationen gefunden</h3>
                            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                                {simulations?.length === 0
                                    ? 'Klicke im Simulator auf PDF oder Simulation merken, um eine Simulation dauerhaft im Archiv zu sichern.'
                                    : 'Keine Simulationen entsprechen deinem aktuellen Suchfilter.'}
                            </p>
                        </div>
                    ) : (
                        filteredSimulations.map(sim => (
                            <div
                                key={sim.id}
                                className="bg-card border border-border rounded-xl p-4 shadow-xs hover:border-border/80 transition-all space-y-3"
                            >
                                {/* Top Row */}
                                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/40 pb-2.5">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className={`px-2 py-0.5 text-[11px] font-bold rounded-md uppercase tracking-wider ${sim.mode === 'buy'
                                            ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                                            : 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                                            }`}>
                                            {sim.mode === 'buy' ? 'Kauf' : 'Verkauf'}
                                        </span>
                                        <span className="font-bold text-sm text-foreground">
                                            {sim.stockName || 'Aktie'}
                                        </span>
                                        {sim.stockSymbol && (
                                            <span className="font-mono text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                                                {sim.stockSymbol}
                                            </span>
                                        )}
                                        {sim.stockIsin && (
                                            <span className="text-[11px] text-muted-foreground hidden md:inline">
                                                ISIN: {sim.stockIsin}
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                        <Calendar className="size-3.5" />
                                        <span>{formatDate(sim.createdAt)}</span>
                                    </div>
                                </div>

                                {/* Metrics Grid */}
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                                    <div className="p-2 rounded-lg bg-muted/30 border border-border/40">
                                        <div className="text-[10px] uppercase font-semibold text-muted-foreground">Menge & Kurs</div>
                                        <div className="font-mono font-bold text-foreground">
                                            {sim.shares} Stk. à {fmtMoney(sim.price, sim.currency)}
                                        </div>
                                    </div>
                                    <div className="p-2 rounded-lg bg-muted/30 border border-border/40">
                                        <div className="text-[10px] uppercase font-semibold text-muted-foreground">Volumen</div>
                                        <div className="font-mono font-bold text-foreground">
                                            {fmtMoney(sim.volumeNative, sim.currency)}
                                        </div>
                                        {sim.currency !== 'CHF' && (
                                            <div className="text-[10px] text-muted-foreground">≈ {fmtMoney(sim.volumeCHF, 'CHF')}</div>
                                        )}
                                    </div>
                                    <div className="p-2 rounded-lg bg-muted/30 border border-border/40">
                                        <div className="text-[10px] uppercase font-semibold text-muted-foreground">Gebühren (CHF)</div>
                                        <div className="font-mono font-bold text-foreground">
                                            {fmtMoney(sim.totalFeesCHF, 'CHF')}
                                        </div>
                                    </div>
                                    <div className="p-2 rounded-lg bg-primary/10 border border-primary/20">
                                        <div className="text-[10px] uppercase font-semibold text-primary">
                                            {sim.mode === 'buy' ? 'Investition Total' : 'Erlös Total'}
                                        </div>
                                        <div className="font-mono font-bold text-sm text-foreground">
                                            {fmtMoney(sim.totalInvestOrProceedsCHF, 'CHF')}
                                        </div>
                                    </div>
                                </div>

                                {/* Dividend Bar (for Buy) */}
                                {sim.mode === 'buy' && (sim.annualDividendCHF || sim.grossYield) ? (
                                    <div className="flex flex-wrap items-center justify-between gap-2 p-2 px-3 rounded-lg bg-blue-500/10 border border-blue-500/20 text-xs text-blue-700 dark:text-blue-300">
                                        <div className="flex items-center gap-3 flex-wrap">
                                            <span>
                                                <strong>Brutto-Rendite:</strong> {(sim.grossYield || 0).toFixed(2)}%
                                            </span>
                                            {sim.taxRate !== undefined && sim.taxRate > 0 && (
                                                <span>
                                                    <strong>Netto (nach {sim.taxRate}% QSt):</strong> {((sim.grossYield || 0) * (1 - sim.taxRate / 100)).toFixed(2)}%
                                                </span>
                                            )}
                                            {sim.dividendFrequency && (
                                                <span className="capitalize">
                                                    • {sim.dividendFrequency === 'monthly' ? 'Monatlich' : sim.dividendFrequency === 'quarterly' ? 'Quartalsweise' : sim.dividendFrequency === 'semi-annually' ? 'Halbjährlich' : 'Jährlich'}
                                                </span>
                                            )}
                                        </div>
                                        {sim.annualDividendCHF && (
                                            <div className="font-semibold">
                                                Erw. Dividende: {fmtMoney(sim.annualDividendCHF, 'CHF')}
                                                {sim.currency !== 'CHF' && sim.annualDividendNative ? ` (${fmtMoney(sim.annualDividendNative, sim.currency)})` : ''}
                                            </div>
                                        )}
                                    </div>
                                ) : null}

                                {/* Actions Footer */}
                                <div className="flex items-center justify-end gap-2 pt-1 border-t border-border/30">
                                    {confirmDeleteId === sim.id ? (
                                        <div className="flex items-center gap-1.5 animate-in fade-in duration-150">
                                            <span className="text-xs text-rose-500 font-medium">Wirklich löschen?</span>
                                            <button
                                                onClick={() => {
                                                    deleteSimulation(sim.id);
                                                    setConfirmDeleteId(null);
                                                }}
                                                className="px-2.5 py-1 text-xs bg-rose-600 hover:bg-rose-700 text-white font-semibold rounded-md transition-colors cursor-pointer"
                                            >
                                                Ja, löschen
                                            </button>
                                            <button
                                                onClick={() => setConfirmDeleteId(null)}
                                                className="px-2 py-1 text-xs text-muted-foreground hover:bg-muted rounded-md transition-colors cursor-pointer"
                                            >
                                                Abbrechen
                                            </button>
                                        </div>
                                    ) : (
                                        <button
                                            onClick={() => setConfirmDeleteId(sim.id)}
                                            className="p-1.5 text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 rounded-md transition-colors cursor-pointer"
                                            title="Simulation aus dem Archiv löschen"
                                        >
                                            <Trash2 className="size-4" />
                                        </button>
                                    )}

                                    <button
                                        onClick={() => onExportPdf(sim)}
                                        className="text-xs font-semibold flex items-center gap-1.5 border border-border px-3 py-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                                        title="PDF für diese Simulation erstellen"
                                    >
                                        <FileText className="size-3.5 text-blue-500" />
                                        <span>PDF</span>
                                    </button>

                                    <button
                                        onClick={() => {
                                            onLoadSimulation(sim);
                                            onClose();
                                        }}
                                        className="text-xs font-semibold flex items-center gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90 px-3 py-1.5 rounded-lg transition-colors cursor-pointer shadow-xs active:scale-95"
                                        title="Werte dieser Simulation wieder in den Simulator laden"
                                    >
                                        <ArrowDownToLine className="size-3.5" />
                                        <span>In Simulator laden</span>
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* Footer */}
                <div className="px-5 py-3 border-t border-border bg-muted/20 flex items-center justify-between shrink-0">
                    <div>
                        {simulations?.length > 0 && (
                            <button
                                onClick={() => {
                                    if (window.confirm('Möchtest du wirklich alle gespeicherten Simulationen löschen?')) {
                                        clearSimulations();
                                    }
                                }}
                                className="text-xs text-muted-foreground hover:text-rose-500 transition-colors cursor-pointer"
                            >
                                Alle Simulationen leeren
                            </button>
                        )}
                    </div>
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/90 font-semibold text-xs rounded-xl shadow-xs transition-colors cursor-pointer"
                    >
                        Schliessen
                    </button>
                </div>
            </div>
        </div>
    );
}
