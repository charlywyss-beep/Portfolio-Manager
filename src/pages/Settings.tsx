import { useState, useRef } from 'react';
import { usePortfolio } from '../context/PortfolioContext';
import { Download, Upload, AlertTriangle, FileJson, CheckCircle, XCircle, RotateCcw } from 'lucide-react';


export function Settings() {
    const { positions, stocks, fixedDeposits, history, watchlist, importData } = usePortfolio();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [importStatus, setImportStatus] = useState<'idle' | 'success' | 'error'>('idle');
    const [importMessage, setImportMessage] = useState('');

    const handleExport = () => {
        const data = {
            version: '1.0',
            exportedAt: new Date().toISOString(),
            positions,
            stocks,
            fixedDeposits,
            history,
            watchlist
        };

        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `portfolio-backup-${new Date().toISOString().split('T')[0]}.json`;
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

                if (window.confirm(`Möchten Sie wirklich ein Backup laden?\n\nDatum: ${json.exportedAt || 'Unbekannt'}\nPositionen: ${json.positions.length}\n\nACHTUNG: Alle aktuellen Daten werden überschrieben!`)) {
                    const success = importData({
                        positions: json.positions,
                        stocks: json.stocks,
                        fixedDeposits: json.fixedDeposits || [],
                        history: json.history || [],
                        watchlist: (json.watchlist || []) as string[]
                    });
                    if (success) {
                        setImportStatus('success');
                        setImportMessage(`Erfolgreich geladen: ${json.positions.length} Positionen, ${json.fixedDeposits?.length || 0} Bankkonten.`);
                    } else {
                        throw new Error("Fehler beim Verarbeiten der Daten.");
                    }
                } else {
                    // Cancelled
                    if (fileInputRef.current) fileInputRef.current.value = '';
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
        if (window.confirm("ACHTUNG: Wirklich ALLE Daten unwiderruflich löschen?\n\nDas Portfolio wird komplett zurückgesetzt.")) {
            importData({ positions: [], stocks: [], fixedDeposits: [], history: [], watchlist: [] });
            setImportStatus('success');
            setImportMessage("Alle Daten wurden gelöscht.");
        }
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
        </div>
    );
}
