import { useState, useRef } from 'react';
import { usePortfolio } from '../context/PortfolioContext';
import { Download, Upload, AlertTriangle, FileJson, CheckCircle, XCircle, RotateCcw, Eye, EyeOff, Save } from 'lucide-react';
import { cn } from '../utils';

export function Settings() {
    const { positions, stocks, fixedDeposits, history, watchlist, importData, finnhubApiKey, setFinnhubApiKey } = usePortfolio();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [importStatus, setImportStatus] = useState<'idle' | 'success' | 'error'>('idle');
    const [importMessage, setImportMessage] = useState('');
    const [showApiKey, setShowApiKey] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);
    const [apiTestStatus, setApiTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
    const [apiTestMessage, setApiTestMessage] = useState('');

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

    const testApiKey = async () => {
        if (!finnhubApiKey) {
            setApiTestStatus('error');
            setApiTestMessage('Kein API Key eingetragen');
            return;
        }

        setApiTestStatus('testing');
        setApiTestMessage('Teste Verbindung zu Finnhub...');

        try {
            // Simple quote request to test the key
            const response = await fetch(`https://finnhub.io/api/v1/quote?symbol=AAPL&token=${finnhubApiKey}`);

            if (response.status === 403) {
                setApiTestStatus('error');
                setApiTestMessage('❌ Key ungültig oder keine Berechtigung');
                return;
            }

            if (response.status === 429) {
                setApiTestStatus('error');
                setApiTestMessage('⚠️ API Limit erreicht (zu viele Anfragen)');
                return;
            }

            if (!response.ok) {
                setApiTestStatus('error');
                setApiTestMessage(`❌ API Fehler: ${response.status}`);
                return;
            }

            const data = await response.json();

            if (data && data.c !== undefined) {
                setApiTestStatus('success');
                setApiTestMessage(`✅ Key ist gültig und aktiv! (AAPL Kurs: $${data.c})`);
            } else {
                setApiTestStatus('error');
                setApiTestMessage('❌ Ungültige Antwort von API');
            }
        } catch (error) {
            setApiTestStatus('error');
            setApiTestMessage('❌ Netzwerkfehler - API nicht erreichbar');
        }
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

            {/* API Settings */}
            <div className="bg-card border border-border rounded-xl p-6 shadow-sm space-y-4">
                <div className="flex items-center gap-3">
                    <h2 className="text-lg font-semibold">Externe Dienste</h2>
                </div>
                <div className="space-y-2">
                    <label htmlFor="finnhub-key" className="text-sm font-medium">Finnhub API Key (für Aktien-Charts)</label>
                    <div className="flex gap-2">
                        <div className="relative flex-1">
                            <input
                                id="finnhub-key"
                                type={showApiKey ? "text" : "password"}
                                placeholder="Finnhub API Key hier eingeben"
                                value={finnhubApiKey}
                                onChange={(e) => {
                                    setFinnhubApiKey(e.target.value);
                                    setSaveSuccess(false);
                                }}
                                className="w-full p-2 pr-10 border border-border rounded-md bg-background"
                            />
                            <button
                                onClick={() => setShowApiKey(!showApiKey)}
                                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1"
                                title={showApiKey ? "Verbergen" : "Anzeigen"}
                            >
                                {showApiKey ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                            </button>
                        </div>
                        <button
                            className={cn(
                                "px-3 py-2 rounded-md text-sm font-medium transition-all flex items-center gap-2",
                                saveSuccess ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-primary text-primary-foreground hover:opacity-90"
                            )}
                            onClick={() => {
                                // Simulate save feedback (it's already saved by hook, but explicit feedback is good)
                                setSaveSuccess(true);
                                setTimeout(() => setSaveSuccess(false), 2000);
                            }}
                        >
                            {saveSuccess ? (
                                <>
                                    <CheckCircle className="size-4" />
                                    Gespeichert
                                </>
                            ) : (
                                <>
                                    <Save className="size-4" />
                                    Speichern
                                </>
                            )}
                        </button>
                        <button
                            className="px-3 py-2 bg-muted hover:bg-muted/80 rounded-md text-sm font-medium transition-colors"
                            onClick={() => window.open('https://finnhub.io/register', '_blank')}
                        >
                            Key holen
                        </button>
                    </div>
                    {/* API Status with Test Button */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between gap-4 p-3 bg-muted/30 rounded-lg">
                            <div className="flex-1">
                                <p className="text-xs font-medium text-muted-foreground mb-1">Status:</p>
                                <p className="text-sm">
                                    {finnhubApiKey ? (
                                        <>
                                            <span className="text-green-600 dark:text-green-400 font-medium">✓ Key eingetragen</span>
                                            <span className="text-muted-foreground ml-2 text-xs">
                                                ({finnhubApiKey.substring(0, 8)}...)
                                            </span>
                                        </>
                                    ) : (
                                        <span className="text-orange-500 font-medium">⚠ Kein Key (Simulation-Modus)</span>
                                    )}
                                </p>
                            </div>
                            <button
                                onClick={testApiKey}
                                disabled={!finnhubApiKey || apiTestStatus === 'testing'}
                                className={cn(
                                    "px-4 py-2 rounded-md text-sm font-medium transition-all whitespace-nowrap",
                                    apiTestStatus === 'testing' ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" :
                                        !finnhubApiKey ? "bg-muted text-muted-foreground cursor-not-allowed" :
                                            "bg-primary text-primary-foreground hover:opacity-90"
                                )}
                            >
                                {apiTestStatus === 'testing' ? 'Teste...' : 'Key testen'}
                            </button>
                        </div>

                        {/* Test Result */}
                        {apiTestMessage && (
                            <div className={cn(
                                "p-3 rounded-lg border text-sm",
                                apiTestStatus === 'success' ? "bg-green-50 border-green-200 text-green-800 dark:bg-green-900/20 dark:border-green-800 dark:text-green-400" :
                                    apiTestStatus === 'error' ? "bg-red-50 border-red-200 text-red-800 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400" :
                                        "bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-400"
                            )}>
                                {apiTestMessage}
                            </div>
                        )}

                        <p className="text-[10px] text-muted-foreground italic">
                            Tipp: Neue Finnhub Keys brauchen oft 5-10 Min. bis sie aktiv sind.
                        </p>
                    </div>
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
