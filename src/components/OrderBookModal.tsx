import { useState, useMemo } from 'react';
import { X, Search, Trash2, ClipboardList, CheckCircle2, Clock, AlertCircle, Calendar, ArrowDownToLine, Rocket, Check } from 'lucide-react';
import { usePortfolio } from '../context/PortfolioContext';
import type { OrderBookEntry } from '../types';

interface OrderBookModalProps {
    isOpen: boolean;
    onClose: () => void;
    onLoadIntoSimulator?: (entry: OrderBookEntry) => void;
}

export function OrderBookModal({ isOpen, onClose, onLoadIntoSimulator }: OrderBookModalProps) {
    const { orderBook, deleteOrderBookEntry, clearOrderBook, executeOrderBookEntry, stocks } = usePortfolio();
    const [filter, setFilter] = useState<'all' | 'open' | 'executed' | 'expired'>('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
    const [executedSuccessId, setExecutedSuccessId] = useState<string | null>(null);

    // Compute live status and distances for every order
    const enrichedOrders = useMemo(() => {
        const now = new Date();
        return (orderBook || []).map(order => {
            const stock = stocks.find(s => s.id === order.stockId || s.symbol.toLowerCase() === order.stockSymbol.toLowerCase());
            const currentPrice = stock?.currentPrice || 0;
            const dayLow = (stock as any)?.dayLow;
            const dayHigh = (stock as any)?.dayHigh;

            // Check expiration (end of day of validUntil)
            const expiryDate = order.validUntil ? new Date(`${order.validUntil}T23:59:59`) : null;
            const isDatePast = expiryDate ? expiryDate.getTime() < now.getTime() : false;

            // Check if limit reached
            let isLimitReached = false;
            let percentDistance = 0;

            if (currentPrice > 0 && order.limitPrice > 0) {
                if (order.mode === 'buy') {
                    // Executed if currentPrice <= limitPrice OR dayLow <= limitPrice
                    isLimitReached = currentPrice <= order.limitPrice || (dayLow !== undefined && dayLow <= order.limitPrice);
                    percentDistance = ((currentPrice - order.limitPrice) / order.limitPrice) * 100;
                } else {
                    // Sell: executed if currentPrice >= limitPrice OR dayHigh >= limitPrice
                    isLimitReached = currentPrice >= order.limitPrice || (dayHigh !== undefined && dayHigh >= order.limitPrice);
                    percentDistance = ((order.limitPrice - currentPrice) / order.limitPrice) * 100;
                }
            }

            // Effective status
            let effectiveStatus: 'open' | 'executed' | 'expired' = order.status;
            if (order.status === 'open') {
                if (isLimitReached) {
                    // Ready to execute or already filled
                    effectiveStatus = 'executed';
                } else if (isDatePast) {
                    effectiveStatus = 'expired';
                }
            }

            return {
                ...order,
                stock,
                currentPrice,
                dayLow,
                dayHigh,
                isLimitReached,
                percentDistance,
                effectiveStatus,
                isDatePast
            };
        });
    }, [orderBook, stocks]);

    const counts = useMemo(() => {
        const total = enrichedOrders.length;
        const open = enrichedOrders.filter(o => o.effectiveStatus === 'open').length;
        const executed = enrichedOrders.filter(o => o.effectiveStatus === 'executed').length;
        const expired = enrichedOrders.filter(o => o.effectiveStatus === 'expired').length;
        return { total, open, executed, expired };
    }, [enrichedOrders]);

    const filteredOrders = useMemo(() => {
        return enrichedOrders.filter(order => {
            if (filter !== 'all' && order.effectiveStatus !== filter) return false;
            if (!searchTerm.trim()) return true;
            const term = searchTerm.toLowerCase();
            return (
                (order.stockName && order.stockName.toLowerCase().includes(term)) ||
                (order.stockSymbol && order.stockSymbol.toLowerCase().includes(term)) ||
                (order.stockIsin && order.stockIsin.toLowerCase().includes(term))
            );
        });
    }, [enrichedOrders, filter, searchTerm]);

    if (!isOpen) return null;

    const fmtMoney = (val: number | undefined, curr: string) => {
        if (val === undefined || isNaN(val)) return '—';
        const formattedNum = new Intl.NumberFormat('de-CH', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(val);
        return `${formattedNum} ${curr}`;
    };

    const formatDate = (dateStr: string) => {
        try {
            return new Date(dateStr).toLocaleDateString('de-CH', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric'
            });
        } catch {
            return dateStr;
        }
    };

    const handleExecuteDirectly = (orderId: string) => {
        const success = executeOrderBookEntry(orderId);
        if (success) {
            setExecutedSuccessId(orderId);
            setTimeout(() => setExecutedSuccessId(null), 2500);
        }
    };

    return (
        <div
            className="fixed inset-0 bg-black/70 backdrop-blur-xs z-50 flex items-center justify-center p-2 sm:p-4 overflow-y-auto"
            onClick={onClose}
        >
            <div
                className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200 text-foreground"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-muted/30 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-400">
                            <ClipboardList className="size-5" />
                        </div>
                        <div>
                            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                                <h2 className="text-base sm:text-lg font-bold">Auftragsbuch</h2>
                                <span className="text-[10px] sm:text-[11px] font-semibold px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-400 border border-blue-500/30 whitespace-nowrap">
                                    Offene Aufträge & Limite
                                </span>
                            </div>
                            <p className="text-xs text-muted-foreground">
                                Automatische Überwachung von Limiten & Gültigkeitsdaten über Cloud-Sync
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 hover:bg-muted rounded-lg text-muted-foreground hover:text-foreground transition-colors"
                    >
                        <X className="size-5" />
                    </button>
                </div>

                {/* Filter and Search Bar */}
                <div className="p-4 border-b border-border bg-card space-y-3 shrink-0">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        {/* Status Filter Tabs */}
                        <div className="flex items-center gap-1 sm:gap-1.5 bg-muted/50 p-1 rounded-xl text-xs font-medium overflow-x-auto no-scrollbar w-full sm:w-auto shrink-0">
                            <button
                                onClick={() => setFilter('all')}
                                className={`px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-lg transition-all whitespace-nowrap text-[11px] sm:text-xs ${filter === 'all'
                                    ? 'bg-primary text-primary-foreground font-semibold shadow-xs'
                                    : 'text-muted-foreground hover:text-foreground'
                                    }`}
                            >
                                Alle ({counts.total})
                            </button>
                            <button
                                onClick={() => setFilter('open')}
                                className={`px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-lg transition-all flex items-center gap-1.5 whitespace-nowrap text-[11px] sm:text-xs ${filter === 'open'
                                    ? 'bg-amber-500/20 text-amber-300 font-semibold border border-amber-500/40 shadow-xs'
                                    : 'text-muted-foreground hover:text-foreground'
                                    }`}
                            >
                                <Clock className="size-3 text-amber-400 shrink-0" />
                                <span>Wartend ({counts.open})</span>
                            </button>
                            <button
                                onClick={() => setFilter('executed')}
                                className={`px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-lg transition-all flex items-center gap-1.5 whitespace-nowrap text-[11px] sm:text-xs ${filter === 'executed'
                                    ? 'bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-500/40 shadow-xs'
                                    : 'text-muted-foreground hover:text-foreground'
                                    }`}
                            >
                                <CheckCircle2 className="size-3 text-emerald-400 shrink-0" />
                                <span>Ausgeführt ({counts.executed})</span>
                            </button>
                            <button
                                onClick={() => setFilter('expired')}
                                className={`px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-lg transition-all flex items-center gap-1.5 whitespace-nowrap text-[11px] sm:text-xs ${filter === 'expired'
                                    ? 'bg-rose-500/20 text-rose-300 font-semibold border border-rose-500/40 shadow-xs'
                                    : 'text-muted-foreground hover:text-foreground'
                                    }`}
                            >
                                <AlertCircle className="size-3 text-rose-400 shrink-0" />
                                <span>Abgelaufen ({counts.expired})</span>
                            </button>
                        </div>

                        {/* Search Input */}
                        <div className="relative flex-1 min-w-[200px] max-w-xs">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                placeholder="Nach Aktie, Symbol oder ISIN..."
                                className="w-full pl-9 pr-3 py-1.5 bg-muted/30 border border-border rounded-lg text-xs focus:outline-hidden focus:border-primary text-foreground placeholder:text-muted-foreground"
                            />
                        </div>
                    </div>
                </div>

                {/* Orders List */}
                <div className="p-4 overflow-y-auto space-y-3.5 flex-1">
                    {filteredOrders.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground space-y-3">
                            <ClipboardList className="size-12 mx-auto stroke-1 opacity-40 text-blue-400" />
                            <p className="text-sm font-medium">
                                {enrichedOrders.length === 0
                                    ? 'Noch keine Aufträge im Auftragsbuch angelegt.'
                                    : 'Keine Aufträge für den gewählten Filter gefunden.'}
                            </p>
                            <p className="text-xs max-w-md mx-auto text-muted-foreground/80">
                                Erstelle einen Kauf- oder Verkaufsauftrag mit gewünschtem Kauflimit und Gültigkeitsdatum im Simulator unter <strong>Kauf / Verkauf</strong>.
                            </p>
                        </div>
                    ) : (
                        filteredOrders.map(order => {
                            const isBuy = order.mode === 'buy';
                            const isExecuted = order.effectiveStatus === 'executed';
                            const isExpired = order.effectiveStatus === 'expired';
                            const isOpen = order.effectiveStatus === 'open';

                            return (
                                <div
                                    key={order.id}
                                    className={`bg-card border rounded-xl p-4 shadow-xs transition-all space-y-3 ${isExecuted
                                        ? 'border-emerald-500/40 bg-emerald-950/10'
                                        : isExpired
                                            ? 'border-rose-500/30 bg-rose-950/10 opacity-80'
                                            : 'border-border hover:border-border/80'
                                        }`}
                                >
                                    {/* Top Status Header */}
                                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/40 pb-2.5">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span
                                                className={`px-2 py-0.5 text-[11px] font-bold rounded-md uppercase tracking-wider ${isBuy
                                                    ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                                                    : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                                                    }`}
                                            >
                                                {isBuy ? 'Kauf' : 'Verkauf'}
                                            </span>
                                            <span className="font-bold text-sm text-foreground">
                                                {order.stockName || 'Aktie'}
                                            </span>
                                            {order.stockSymbol && (
                                                <span className="font-mono text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                                                    {order.stockSymbol}
                                                </span>
                                            )}
                                            {order.stockIsin && (
                                                <span className="text-[11px] text-muted-foreground hidden md:inline">
                                                    ISIN: {order.stockIsin}
                                                </span>
                                            )}
                                        </div>

                                        {/* Status Badge */}
                                        <div className="flex items-center gap-2">
                                            {isExecuted && (
                                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold rounded-md bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 animate-pulse">
                                                    <CheckCircle2 className="size-3.5" />
                                                    Auftrag ausgeführt
                                                </span>
                                            )}
                                            {isExpired && (
                                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-md bg-rose-500/20 text-rose-400 border border-rose-500/40">
                                                    <AlertCircle className="size-3.5" />
                                                    Auftrag abgelaufen
                                                </span>
                                            )}
                                            {isOpen && (
                                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/40">
                                                    <Clock className="size-3.5 text-amber-400" />
                                                    Wartet auf Limite
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Live Monitoring Banner */}
                                    {isExecuted && (
                                        <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-xs text-emerald-200">
                                            <div className="flex items-center gap-2">
                                                <CheckCircle2 className="size-4 text-emerald-400 shrink-0" />
                                                <span>
                                                    <strong>Meldung:</strong> Limit von <strong>{fmtMoney(order.limitPrice, order.currency)}</strong> erreicht!
                                                    {order.currentPrice > 0 && (
                                                        <span className="ml-1 text-emerald-300">
                                                            (Aktueller Kurs: {fmtMoney(order.currentPrice, order.currency)}
                                                            {order.dayLow !== undefined && order.dayLow < order.currentPrice ? ` • Tagestief: ${fmtMoney(order.dayLow, order.currency)}` : ''})
                                                        </span>
                                                    )}
                                                </span>
                                            </div>

                                            {order.status !== 'executed' ? (
                                                <button
                                                    onClick={() => handleExecuteDirectly(order.id)}
                                                    className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold flex items-center gap-1.5 shadow-xs transition-all active:scale-95"
                                                >
                                                    {executedSuccessId === order.id ? (
                                                        <>
                                                            <Check className="size-3.5" />
                                                            <span>Ins Depot gebucht!</span>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Rocket className="size-3.5" />
                                                            <span>🚀 Direkt ins Depot übernehmen</span>
                                                        </>
                                                    )}
                                                </button>
                                            ) : (
                                                <span className="text-[11px] text-emerald-400 font-semibold flex items-center gap-1">
                                                    <Check className="size-3" /> Bereits im Depot verbucht
                                                </span>
                                            )}
                                        </div>
                                    )}

                                    {isExpired && (
                                        <div className="flex items-center gap-2 p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300">
                                            <AlertCircle className="size-4 text-rose-400 shrink-0" />
                                            <span>
                                                <strong>Meldung:</strong> Auftrag abgelaufen. Das Gültigkeitsdatum (<strong>{formatDate(order.validUntil)}</strong>) wurde überschritten, ohne dass das Limit von {fmtMoney(order.limitPrice, order.currency)} ausgelöst wurde.
                                            </span>
                                        </div>
                                    )}

                                    {isOpen && (
                                        <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-lg bg-muted/40 border border-border/60 text-xs">
                                            <div className="flex items-center gap-2 text-foreground">
                                                <Clock className="size-3.5 text-amber-400" />
                                                <span>
                                                    <strong>Limit:</strong> {fmtMoney(order.limitPrice, order.currency)}
                                                    {order.currentPrice > 0 ? (
                                                        <>
                                                            <span className="text-muted-foreground mx-1.5">•</span>
                                                            <span className="text-muted-foreground">Aktuell:</span> <strong>{fmtMoney(order.currentPrice, order.currency)}</strong>
                                                            <span className={`ml-1.5 font-bold ${order.percentDistance > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                                                                (noch {order.percentDistance > 0 ? '+' : ''}{order.percentDistance.toFixed(2)}%)
                                                            </span>
                                                        </>
                                                    ) : (
                                                        <span className="text-muted-foreground ml-1.5">(Wartet auf Kurssignal)</span>
                                                    )}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-1.5 text-muted-foreground font-medium">
                                                <Calendar className="size-3.5" />
                                                <span>Gültig bis: <strong className="text-foreground">{formatDate(order.validUntil)}</strong></span>
                                            </div>
                                        </div>
                                    )}

                                    {/* Metrics Grid */}
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                                        <div className="p-2 rounded-lg bg-muted/30 border border-border/40">
                                            <div className="text-[10px] uppercase font-semibold text-muted-foreground">Menge & Limite</div>
                                            <div className="font-mono font-bold text-foreground">
                                                {order.shares} Stk. à {fmtMoney(order.limitPrice, order.currency)}
                                            </div>
                                        </div>
                                        <div className="p-2 rounded-lg bg-muted/30 border border-border/40">
                                            <div className="text-[10px] uppercase font-semibold text-muted-foreground">Auftragsvolumen</div>
                                            <div className="font-mono font-bold text-foreground">
                                                {fmtMoney(order.volumeNative, order.currency)}
                                            </div>
                                            {order.currency !== 'CHF' && (
                                                <div className="text-[10px] text-muted-foreground">≈ {fmtMoney(order.volumeCHF, 'CHF')}</div>
                                            )}
                                        </div>
                                        <div className="p-2 rounded-lg bg-muted/30 border border-border/40">
                                            <div className="text-[10px] uppercase font-semibold text-muted-foreground">Gebühren (CHF)</div>
                                            <div className="font-mono font-bold text-foreground">
                                                {fmtMoney(order.totalFeesCHF, 'CHF')}
                                            </div>
                                        </div>
                                        <div className="p-2 rounded-lg bg-primary/10 border border-primary/20">
                                            <div className="text-[10px] uppercase font-semibold text-primary">
                                                {isBuy ? 'Investition Total' : 'Erlös Total'}
                                            </div>
                                            <div className="font-mono font-bold text-sm text-foreground">
                                                {fmtMoney(order.totalInvestOrProceedsCHF, 'CHF')}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Bottom Action Footer */}
                                    <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border/40 text-xs">
                                        <div className="flex items-center gap-3 text-muted-foreground text-[11px]">
                                            <span>Erstellt: {formatDate(order.createdAt)}</span>
                                            {order.validUntil && <span>• Gültig bis: {formatDate(order.validUntil)}</span>}
                                            {order.status === 'executed' && order.executedAt && (
                                                <span className="text-emerald-400 font-semibold">• Ausgeführt am: {formatDate(order.executedAt)}</span>
                                            )}
                                        </div>

                                        <div className="flex items-center gap-2 flex-wrap">
                                            {/* Load into Simulator */}
                                            {onLoadIntoSimulator && (
                                                <button
                                                    onClick={() => {
                                                        onLoadIntoSimulator(order);
                                                        onClose();
                                                    }}
                                                    className="px-2.5 py-1.5 rounded-lg bg-muted hover:bg-muted/80 text-foreground font-medium flex items-center gap-1.5 transition-colors border border-border/60 text-xs whitespace-nowrap"
                                                    title="In den Simulator laden"
                                                >
                                                    <ArrowDownToLine className="size-3.5 text-blue-400 shrink-0" />
                                                    <span>In Simulator laden</span>
                                                </button>
                                            )}

                                            {/* Manual Execute toggle if needed */}
                                            {isOpen && (
                                                <button
                                                    onClick={() => handleExecuteDirectly(order.id)}
                                                    className="px-2.5 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 font-medium flex items-center gap-1.5 transition-colors text-xs whitespace-nowrap"
                                                    title="Manuell als ausgeführt ins Depot buchen"
                                                >
                                                    <Check className="size-3.5 shrink-0" />
                                                    <span>Jetzt ausführen</span>
                                                </button>
                                            )}

                                            {/* Delete */}
                                            {confirmDeleteId === order.id ? (
                                                <div className="flex items-center gap-1.5">
                                                    <button
                                                        onClick={() => {
                                                            deleteOrderBookEntry(order.id);
                                                            setConfirmDeleteId(null);
                                                        }}
                                                        className="px-2.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs transition-colors"
                                                    >
                                                        Ja, löschen
                                                    </button>
                                                    <button
                                                        onClick={() => setConfirmDeleteId(null)}
                                                        className="px-2 py-1.5 rounded-lg bg-muted hover:bg-muted/80 text-muted-foreground text-xs transition-colors"
                                                    >
                                                        Abbrechen
                                                    </button>
                                                </div>
                                            ) : (
                                                <button
                                                    onClick={() => setConfirmDeleteId(order.id)}
                                                    className="p-1.5 rounded-lg hover:bg-rose-500/10 text-muted-foreground hover:text-rose-400 transition-colors"
                                                    title="Auftrag entfernen"
                                                >
                                                    <Trash2 className="size-4" />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between px-5 py-3 border-t border-border bg-muted/20 text-xs shrink-0">
                    <span className="text-muted-foreground">
                        {counts.total} Auftrag{counts.total === 1 ? '' : 'e'} insgesamt • Synchronisiert mit Depot & Cloud
                    </span>
                    {counts.total > 0 && (
                        <button
                            onClick={() => {
                                if (window.confirm('Möchtest du wirklich alle Aufträge aus dem Auftragsbuch löschen?')) {
                                    clearOrderBook();
                                }
                            }}
                            className="text-xs text-rose-400 hover:text-rose-300 hover:underline transition-colors"
                        >
                            Auftragsbuch leeren
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
