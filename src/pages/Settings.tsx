import { useState, useRef, useMemo } from 'react';
import { usePortfolio } from '../context/PortfolioContext';

import { Download, Upload, AlertTriangle, FileJson, CheckCircle, XCircle, RotateCcw } from 'lucide-react';
import { ConfirmModal } from '../components/ConfirmModal';

// Helper Component for Stock Management List Items (v3.12.123)
const StockManagementItem = ({ stock, positions, watchlists, stocks, fixedDeposits, history, importData }: any) => {
    const [isConfirmOpen, setIsConfirmOpen] = useState(false);
    const isInPortfolio = positions.some((p: any) => p.stockId === stock.id);
    const isInWatchlist = watchlists.some((wl: any) => wl.stockIds?.includes(stock.id));
    const isActive = isInPortfolio || isInWatchlist;

    return (
        <div key={stock.id} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg border border-border/50">
            <div className="flex-1">
                <div className="flex items-center gap-2">
                    <span className="font-semibold">{stock.name}</span>
                    <span className="text-sm text-muted-foreground">({stock.symbol})</span>
                    {stock.type === 'etf' && (
                        <span className="text-[10px] bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 px-1.5 py-0.5 rounded">ETF</span>
                    )}
                </div>
                {stock.isin && (
                    <div className="text-xs text-muted-foreground font-mono">{stock.isin}</div>
                )}
                {isActive && (
                    <div className="text-xs text-green-600 dark:text-green-400 mt-1">
                        {isInPortfolio && '✓ In Portfolio'}
                        {isInPortfolio && isInWatchlist && ' • '}
                        {isInWatchlist && '✓ In Watchlist'}
                    </div>
                )}
            </div>
            <button
                onClick={() => setIsConfirmOpen(true)}
                disabled={isActive}
                className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${isActive
                    ? 'bg-muted text-muted-foreground cursor-not-allowed opacity-50'
                    : 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 border border-red-200 dark:border-red-900/30'
                    }`}
                title={isActive ? 'Aktiv in Portfolio oder Watchlist - nicht löschbar' : 'Löschen'}
            >
                {isActive ? 'Aktiv' : 'Löschen'}
            </button>

            <ConfirmModal
                isOpen={isConfirmOpen}
                onClose={() => setIsConfirmOpen(false)}
                onConfirm={() => {
                    const updatedStocks = stocks.filter((s: any) => s.id !== stock.id);
                    importData({
                        positions,
                        stocks: updatedStocks,
                        fixedDeposits,
                        watchlists
                    });
                }}
                title="Aktie löschen"
                message={`Möchten Sie "${stock.name}" wirklich aus der Datenbank löschen?`}
            />
        </div>
    );
};

export function Settings() {
    const { positions, stocks, fixedDeposits, history, watchlists, importData, mortgageData } = usePortfolio();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [importStatus, setImportStatus] = useState<'idle' | 'success' | 'error'>('idle');
    const [importMessage, setImportMessage] = useState('');
    const [confirmImport, setConfirmImport] = useState<{ isOpen: boolean, data: any }>({ isOpen: false, data: null });
    const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);

    // Categorized Stocks (v3.12.123)
    const categorizedStocks = useMemo(() => {
        const ownedIds = new Set(positions.map(p => p.stockId));
        return {
            portfolio: stocks.filter(s => ownedIds.has(s.id)),
            watchlistOnly: stocks.filter(s => watchlists.some(wl => wl.stockIds.includes(s.id)) && !ownedIds.has(s.id)),
            other: stocks.filter(s => !watchlists.some(wl => wl.stockIds.includes(s.id)) && !ownedIds.has(s.id))
        };
    }, [stocks, positions, watchlist]);

    const handleExport = () => {
        const data = {
            version: '1.0',
            exportedAt: new Date().toISOString(),
            positions,
            stocks,
            fixedDeposits,
            history,
            watchlist,
            mortgageData
        };

        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        const date = new Date();
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        link.download = `portfolio-backup-${year}-${day}-${month}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const json = JSON.parse(e.target?.result as string);

                // Basic validation
                if (!json.positions || !json.stocks) {
                    throw new Error("Ungültiges Backup-Format");
                }

                if (json.positions && json.stocks) {
                    setConfirmImport({ isOpen: true, data: json });
                }
            } catch (err: any) {
                console.error(err);
                setImportStatus('error');
                setImportMessage(err.message || "Fehler beim Lesen der Datei.");
            }
        };
        reader.readAsText(file);
    };

    const handleReset = () => {
        setIsResetConfirmOpen(true);
    };

    return (
        <div className="p-6 md:p-8 space-y-8 animate-in fade-in duration-500">
            <div className="flex items-center gap-3 mb-8">
                <h1 className="text-2xl font-bold tracking-tight">Einstellungen</h1>
                <p className="text-muted-foreground">Verwalten Sie Ihre Daten-Backups und Systemeinstellungen.</p>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
                {/* Export Card */}
                <div className="bg-card border border-border rounded-xl p-6 shadow-sm space-y-4">
                    <div className="flex items-center gap-3 text-primary">
                        <div className="p-2 bg-primary/10 rounded-lg">
                            <Download className="size-6" />
                        </div>
                        <h2 className="text-lg font-semibold">Backup erstellen</h2>
                    </div>
                    <p className="text-sm text-muted-foreground">
                        Laden Sie eine vollständige Kopie Ihrer Portfolio-Daten als JSON-Datei herunter.
                        Speichern Sie diese Datei sicher ab.
                    </p>
                    <div className="bg-muted/50 p-4 rounded-lg text-sm space-y-2">
                        <div className="flex justify-between">
                            <span>Aktien & ETFs:</span>
                            <span className="font-mono font-medium">{positions.length}</span>
                        </div>
                        <div className="flex justify-between">
                            <span>Bankkonten:</span>
                            <span className="font-mono font-medium">{fixedDeposits.length}</span>
                        </div>
                        <div className="flex justify-between">
                            <span>Historie-Einträge:</span>
                            <span className="font-mono font-medium">{history.length}</span>
                        </div>
                    </div>
                    <button
                        onClick={handleExport}
                        className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors font-medium"
                    >
                        <FileJson className="size-4" />
                        <span>Backup herunterladen</span>
                    </button>
                </div>

                {/* Import Card */}
                <div className="bg-card border border-border rounded-xl p-6 shadow-sm space-y-4">
                    <div className="flex items-center gap-3 text-amber-600 dark:text-amber-500">
                        <div className="p-2 bg-amber-100 dark:bg-amber-900/20 rounded-lg">
                            <Upload className="size-6" />
                        </div>
                        <h2 className="text-lg font-semibold">Backup wiederherstellen</h2>
                    </div>
                    <p className="text-sm text-muted-foreground">
                        Laden Sie eine zuvor exportierte JSON-Datei hoch, um Ihre Daten wiederherzustellen.
                    </p>

                    <div className="relative">
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".json"
                            onChange={handleImport}
                            className="hidden"
                            id="backup-upload"
                        />
                        <label
                            htmlFor="backup-upload"
                            className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors"
                        >
                            <Upload className="size-8 text-muted-foreground mb-2" />
                            <span className="text-sm font-medium text-muted-foreground">JSON-Datei hier ablegen oder klicken</span>
                        </label>
                    </div>

                    {importStatus === 'success' && (
                        <div className="flex items-start gap-2 text-sm text-green-600 bg-green-50 dark:bg-green-900/10 p-3 rounded-md border border-green-200 dark:border-green-900/20">
                            <CheckCircle className="size-4 mt-0.5 shrink-0" />
                            <span>{importMessage}</span>
                        </div>
                    )}
                    {importStatus === 'error' && (
                        <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 dark:bg-red-900/10 p-3 rounded-md border border-red-200 dark:border-red-900/20">
                            <XCircle className="size-4 mt-0.5 shrink-0" />
                            <span>{importMessage}</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Stock Management */}
            <div className="bg-card border border-border rounded-xl p-6 shadow-sm space-y-4">
                <div className="flex items-center gap-3 text-primary mb-4">
                    <div className="p-2 bg-primary/10 rounded-lg">
                        <FileJson className="size-5" />
                    </div>
                    <div>
                        <h2 className="text-lg font-semibold">Stock-Verwaltung</h2>
                        <p className="text-sm text-muted-foreground">Alte/nicht verwendete Aktien löschen</p>
                    </div>
                </div>

                <div className="space-y-6 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                    {stocks.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-4">Keine Stocks vorhanden</p>
                    ) : (
                        <>
                            {/* Portfolio Category */}
                            {categorizedStocks.portfolio.length > 0 && (
                                <div className="space-y-2">
                                    <div className="sticky top-0 bg-card z-10 py-2 border-b border-border/50 flex items-center justify-between">
                                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">In Portfolio</span>
                                        <span className="bg-primary/10 text-primary text-[10px] px-2 py-0.5 rounded-full font-mono font-bold">{categorizedStocks.portfolio.length}</span>
                                    </div>
                                    <div className="space-y-2">
                                        {categorizedStocks.portfolio.map(stock => (
                                            <StockManagementItem
                                                key={stock.id}
                                                stock={stock}
                                                positions={positions}
                                                watchlist={watchlist}
                                                stocks={stocks}
                                                fixedDeposits={fixedDeposits}
                                                history={history}
                                                importData={importData}
                                            />
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Watchlist Category */}
                            {categorizedStocks.watchlistOnly.length > 0 && (
                                <div className="space-y-2">
                                    <div className="sticky top-0 bg-card z-10 py-2 border-b border-border/50 flex items-center justify-between mt-4">
                                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">In Watchlist</span>
                                        <span className="bg-blue-500/10 text-blue-600 text-[10px] px-2 py-0.5 rounded-full font-mono font-bold">{categorizedStocks.watchlistOnly.length}</span>
                                    </div>
                                    <div className="space-y-2">
                                        {categorizedStocks.watchlistOnly.map(stock => (
                                            <StockManagementItem
                                                key={stock.id}
                                                stock={stock}
                                                positions={positions}
                                                watchlist={watchlist}
                                                stocks={stocks}
                                                fixedDeposits={fixedDeposits}
                                                history={history}
                                                importData={importData}
                                            />
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Other Category */}
                            {categorizedStocks.other.length > 0 && (
                                <div className="space-y-2">
                                    <div className="sticky top-0 bg-card z-10 py-2 border-b border-border/50 flex items-center justify-between mt-4">
                                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Andere / Nicht verwendet</span>
                                        <span className="bg-muted text-muted-foreground text-[10px] px-2 py-0.5 rounded-full font-mono font-bold">{categorizedStocks.other.length}</span>
                                    </div>
                                    <div className="space-y-2">
                                        {categorizedStocks.other.map(stock => (
                                            <StockManagementItem
                                                key={stock.id}
                                                stock={stock}
                                                positions={positions}
                                                watchlists={watchlists}
                                                stocks={stocks}
                                                fixedDeposits={fixedDeposits}
                                                history={history}
                                                importData={importData}
                                            />
                                        ))}
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>

            {/* Danger Zone */}
            <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-900/20 rounded-xl p-6 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-6">
                <div className="space-y-1">
                    <h3 className="text-lg font-semibold text-red-700 dark:text-red-400 flex items-center gap-2">
                        <AlertTriangle className="size-5" />
                        Daten zurücksetzen
                    </h3>
                    <p className="text-sm text-red-600/80 dark:text-red-400/80">
                        Löscht alle Positionen, Konten und Historien unwiderruflich.
                    </p>
                </div>
                <button
                    onClick={handleReset}
                    className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-background border border-red-200 dark:border-red-900/30 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors font-medium text-sm whitespace-nowrap"
                >
                    <RotateCcw className="size-4" />
                    <span>Alles löschen</span>
                </button>
            </div>

            <ConfirmModal
                isOpen={confirmImport.isOpen}
                onClose={() => {
                    setConfirmImport({ isOpen: false, data: null });
                    if (fileInputRef.current) fileInputRef.current.value = '';
                }}
                onConfirm={() => {
                    const json = confirmImport.data;
                    const success = importData({
                        positions: json.positions,
                        stocks: json.stocks,
                        fixedDeposits: json.fixedDeposits || [],
                        history: json.history || [],
                        watchlists: json.watchlists || (json.watchlist ? [{ id: 'default', name: 'Merkliste', stockIds: json.watchlist, isDefault: true }] : [])
                    });
                    if (success) {
                        setImportStatus('success');
                        setImportMessage(`Erfolgreich geladen: ${json.positions.length} Positionen, ${json.fixedDeposits?.length || 0} Bankkonten.`);
                    }
                }}
                title="Backup wiederherstellen"
                message={`Möchten Sie wirklich dieses Backup laden? Alle aktuellen Daten werden überschrieben!\n\nDatum: ${confirmImport.data?.exportedAt || 'Unbekannt'}\nPositionen: ${confirmImport.data?.positions?.length || 0}`}
                confirmText="Backup laden"
                variant="warning"
            />

            <ConfirmModal
                isOpen={isResetConfirmOpen}
                onClose={() => setIsResetConfirmOpen(false)}
                onConfirm={() => {
                    importData({ positions: [], stocks: [], fixedDeposits: [], history: [], watchlists: [] });
                    setImportStatus('success');
                    setImportMessage("Alle Daten wurden gelöscht.");
                }}
                title="Daten zurücksetzen"
                message="ACHTUNG: Wirklich ALLE Daten unwiderruflich löschen? Das Portfolio wird komplett zurückgesetzt."
                confirmText="Alles löschen"
                variant="danger"
            />
        </div >
    );
}
