import { LandscapeBackButton } from '../components/LandscapeBackButton';
import { useState, useRef, useMemo, useEffect } from 'react';
import { usePortfolio } from '../context/PortfolioContext';

import {
    Download, Upload, AlertTriangle, FileJson, CheckCircle, XCircle, RotateCcw,
    Cloud, CloudUpload, CloudDownload, Key, Eye, EyeOff, RefreshCw, ExternalLink, Copy, Check, Loader2, Settings as SettingsIcon
} from 'lucide-react';
import { ConfirmModal } from '../components/ConfirmModal';
import packageJson from '../../package.json';
import {
    getGistCredentials,
    saveGistCredentials,
    connectOrCreateGist,
    pushDataToGist,
    pullDataFromGist,
    testGitHubToken
} from '../services/githubGistSync';

// Helper Component for Stock Management List Items (v3.14.02)
const StockManagementItem = ({ stock, positions, watchlists, stocks, fixedDeposits, importData }: any) => {
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
    const { positions, stocks, fixedDeposits, history, watchlists, importData, mortgageData, simulatorState, exportCurrentData } = usePortfolio();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [importStatus, setImportStatus] = useState<'idle' | 'success' | 'error'>('idle');
    const [importMessage, setImportMessage] = useState('');
    const [confirmImport, setConfirmImport] = useState<{ isOpen: boolean, data: any }>({ isOpen: false, data: null });
    const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);

    // GitHub Cloud Sync States
    const [gistToken, setGistToken] = useState(() => getGistCredentials().token);
    const [gistId, setGistId] = useState(() => getGistCredentials().gistId);
    const [lastSync, setLastSync] = useState<string | null>(() => getGistCredentials().lastSync);
    const [isTokenVisible, setIsTokenVisible] = useState(false);
    const [isTokenCopied, setIsTokenCopied] = useState(false);
    const [syncLoading, setSyncLoading] = useState(false);
    const [syncStatus, setSyncStatus] = useState<{ type: 'idle' | 'success' | 'error'; message: string }>({ type: 'idle', message: '' });
    const [connectedUser, setConnectedUser] = useState<string | null>(null);

    useEffect(() => {
        if (gistToken) {
            testGitHubToken(gistToken).then(res => {
                if (res.success && res.username) {
                    setConnectedUser(res.username);
                }
            });
        }
    }, [gistToken]);

    const handleConnectGist = async () => {
        if (!gistToken.trim()) {
            setSyncStatus({ type: 'error', message: 'Bitte ein gültiges GitHub Token (PAT) eingeben.' });
            return;
        }
        setSyncLoading(true);
        setSyncStatus({ type: 'idle', message: '' });
        const res = await connectOrCreateGist(gistToken, gistId);
        setSyncLoading(false);
        if (res.success) {
            setSyncStatus({ type: 'success', message: res.message });
            if (res.gistId) setGistId(res.gistId);
            if (res.username) setConnectedUser(res.username);
            const creds = getGistCredentials();
            setLastSync(creds.lastSync);
        } else {
            setSyncStatus({ type: 'error', message: res.message });
        }
    };

    const handleCloudPush = async () => {
        setSyncLoading(true);
        setSyncStatus({ type: 'idle', message: '' });
        const dataToSave = exportCurrentData();
        const res = await pushDataToGist(dataToSave);
        setSyncLoading(false);
        if (res.success) {
            setSyncStatus({ type: 'success', message: `✅ ${res.message}` });
            setLastSync(new Date().toISOString());
            if (res.gistId) setGistId(res.gistId);
        } else {
            setSyncStatus({ type: 'error', message: res.message });
        }
    };

    const handleCloudPull = async () => {
        const confirmed = window.confirm(
            "☁️ Möchten Sie die Portfolio-Daten von GitHub laden?\n\nLokale Daten werden durch den gesicherten Stand von GitHub ersetzt."
        );
        if (!confirmed) return;

        setSyncLoading(true);
        setSyncStatus({ type: 'idle', message: '' });
        const currentData = exportCurrentData();
        const res = await pullDataFromGist(currentData);
        setSyncLoading(false);
        if (res.success && res.data) {
            const imported = importData(res.data);
            if (imported) {
                const timeStr = res.updatedAt ? new Date(res.updatedAt).toLocaleString('de-CH') : '';
                setSyncStatus({ type: 'success', message: `✅ Daten erfolgreich von GitHub geladen! (Stand: ${timeStr})` });
                setLastSync(res.updatedAt || new Date().toISOString());
                if (res.gistId) setGistId(res.gistId);
            } else {
                setSyncStatus({ type: 'error', message: 'Fehler beim Einlesen der heruntergeladenen Daten.' });
            }
        } else {
            setSyncStatus({ type: 'error', message: res.message });
        }
    };

    const handleCopyToken = () => {
        if (!gistToken) return;
        navigator.clipboard.writeText(gistToken);
        setIsTokenCopied(true);
        setTimeout(() => setIsTokenCopied(false), 2000);
    };

    const formatTimestamp = (iso?: string | null) => {
        if (!iso) return 'Noch nie';
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

    // Categorized Stocks (v3.14.02)
    const categorizedStocks = useMemo(() => {
        const ownedIds = new Set(positions.map(p => p.stockId));
        return {
            portfolio: stocks.filter(s => ownedIds.has(s.id)),
            watchlistOnly: stocks.filter(s => watchlists.some(wl => wl.stockIds.includes(s.id)) && !ownedIds.has(s.id)),
            other: stocks.filter(s => !watchlists.some(wl => wl.stockIds.includes(s.id)) && !ownedIds.has(s.id))
        };
    }, [stocks, positions, watchlists]);

    const handleExport = () => {
        const data = {
            version: '1.0',
            appVersion: packageJson.version,
            exportedAt: new Date().toISOString(),
            positions,
            stocks,
            fixedDeposits,
            history,
            watchlists,
            mortgageData,
            simulatorState
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
        <div className="p-4 md:p-6 space-y-6 sm:space-y-8 animate-in fade-in duration-500 max-w-full bg-gradient-to-br from-background via-background to-muted/20 iphone-landscape-page-root">
            <div className="sticky top-0 z-50 bg-background pb-4 -mt-4 -mx-4 px-4 md:-mt-6 md:-mx-6 md:px-6 iphone-landscape-portfolio-header-wrap">
                <div className="border-b bg-card rounded-t-xl -mx-4 md:-mx-6">
                    <div className="w-full pl-14 pr-4 py-4 md:px-6 md:pl-14 xl:pl-6 iphone-landscape-portfolio-header-content">
                        <div className="flex items-center justify-between gap-3 iphone-landscape-portfolio-header-row">
                            <div className="flex items-center gap-3 iphone-landscape-portfolio-title-group">
                                <LandscapeBackButton />
                                <div className="p-3 rounded-xl bg-gradient-to-br from-slate-500/20 to-zinc-500/20 text-slate-600 dark:text-slate-300 iphone-landscape-portfolio-icon">
                                    <SettingsIcon className="size-6" />
                                </div>
                                <div>
                                    <h1 className="text-2xl sm:text-3xl font-bold tracking-tight iphone-landscape-portfolio-title">Einstellungen</h1>
                                    <p className="text-xs sm:text-sm text-muted-foreground hidden md:block iphone-landscape-portfolio-subtitle">Verwalten Sie Ihre Daten-Backups und Systemeinstellungen.</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* GitHub Cloud-Sync Card */}
            <div className="bg-card border border-border rounded-xl p-3.5 sm:p-6 shadow-sm space-y-5 sm:space-y-6 max-w-full overflow-hidden">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 pb-4 border-b border-border/60">
                    <div className="flex items-start sm:items-center gap-3 min-w-0">
                        <div className="p-2 sm:p-2.5 bg-blue-500/15 text-blue-600 dark:text-blue-400 rounded-xl border border-blue-500/20 shrink-0 mt-0.5 sm:mt-0">
                            <Cloud className="size-5 sm:size-6" />
                        </div>
                        <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                                <h2 className="text-base sm:text-lg font-bold text-foreground">GitHub Cloud-Sync</h2>
                                {connectedUser && (
                                    <span className="text-[11px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full flex items-center gap-1">
                                        <span className="size-1.5 rounded-full bg-emerald-500"></span>
                                        {connectedUser}
                                    </span>
                                )}
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                                Daten sicher und privat über GitHub Gist zwischen Geräten austauschen (z. B. Büro, Handy, Heim-PC)
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 text-xs pt-1 sm:pt-0">
                        <span className="text-muted-foreground">Letzter Sync:</span>
                        <span className="font-mono font-semibold text-foreground bg-muted px-2.5 py-1 rounded-md text-[11px] sm:text-xs">
                            {formatTimestamp(lastSync)}
                        </span>
                    </div>
                </div>

                {/* Token and Gist Settings Form */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full min-w-0">
                    {/* Token Field */}
                    <div className="space-y-1.5 min-w-0">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                            <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                                <Key className="size-3.5 text-primary shrink-0" />
                                <span>1. GitHub Personal Access Token (PAT)</span>
                            </label>
                            <a
                                href="https://github.com/settings/tokens/new?scopes=gist&description=Portfolio%20Manager%20Cloud%20Sync"
                                target="_blank"
                                rel="noreferrer"
                                className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 w-fit"
                            >
                                <span>Neuen Token erstellen</span>
                                <ExternalLink className="size-3" />
                            </a>
                        </div>
                        <div className="relative w-full min-w-0">
                            <input
                                type={isTokenVisible ? 'text' : 'password'}
                                value={gistToken}
                                onChange={(e) => {
                                    setGistToken(e.target.value);
                                    saveGistCredentials(e.target.value, gistId);
                                }}
                                placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                                className="w-full pl-3 pr-20 py-2 text-xs sm:text-sm bg-background border border-border rounded-lg font-mono focus:outline-none focus:ring-2 focus:ring-primary min-w-0"
                            />
                            <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
                                <button
                                    type="button"
                                    onClick={() => setIsTokenVisible(!isTokenVisible)}
                                    className="p-1.5 text-muted-foreground hover:text-foreground rounded transition-colors"
                                    title={isTokenVisible ? 'Verbergen' : 'Anzeigen'}
                                >
                                    {isTokenVisible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                                </button>
                                <button
                                    type="button"
                                    onClick={handleCopyToken}
                                    disabled={!gistToken}
                                    className="p-1.5 text-muted-foreground hover:text-foreground rounded transition-colors disabled:opacity-40"
                                    title="Token kopieren"
                                >
                                    {isTokenCopied ? <Check className="size-4 text-emerald-500" /> : <Copy className="size-4" />}
                                </button>
                            </div>
                        </div>
                        <p className="text-[11px] text-muted-foreground leading-normal">
                            Tipp: Sie können genau dasselbe GitHub Token verwenden wie im Arbeitszeitrechner!
                        </p>
                    </div>

                    {/* Gist ID Field */}
                    <div className="space-y-1.5 min-w-0">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                            <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                                <FileJson className="size-3.5 text-primary shrink-0" />
                                <span>2. GitHub Gist-ID (Cloud-Speicher)</span>
                            </label>
                            {gistId && (
                                <a
                                    href={`https://gist.github.com/${gistId}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 w-fit"
                                >
                                    <span>Gist auf GitHub ansehen</span>
                                    <ExternalLink className="size-3" />
                                </a>
                            )}
                        </div>
                        <div className="flex flex-col sm:flex-row gap-2 w-full min-w-0">
                            <input
                                type="text"
                                value={gistId}
                                onChange={(e) => {
                                    setGistId(e.target.value);
                                    saveGistCredentials(gistToken, e.target.value);
                                }}
                                placeholder="Wird automatisch ermittelt..."
                                className="w-full sm:flex-1 px-3 py-2 text-xs sm:text-sm bg-background border border-border rounded-lg font-mono focus:outline-none focus:ring-2 focus:ring-primary min-w-0"
                            />
                            <button
                                type="button"
                                onClick={handleConnectGist}
                                disabled={syncLoading || !gistToken.trim()}
                                className="w-full sm:w-auto px-3.5 py-2 text-xs font-semibold bg-secondary hover:bg-secondary/80 text-secondary-foreground rounded-lg transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap disabled:opacity-50 shrink-0"
                                title="Verbindung prüfen und Gist automatisch finden oder anlegen"
                            >
                                {syncLoading ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
                                <span>Verbindung testen</span>
                            </button>
                        </div>
                        <p className="text-[11px] text-muted-foreground leading-normal">
                            Bleibt leer oder wird automatisch gefüllt, sobald Sie auf "Verbindung testen" oder "Speichern" klicken.
                        </p>
                    </div>
                </div>

                {/* Sync Action Buttons */}
                <div className="pt-2 flex flex-col sm:flex-row items-stretch gap-2.5 sm:gap-3 w-full">
                    <button
                        onClick={handleCloudPush}
                        disabled={syncLoading || !gistToken.trim()}
                        className="flex-1 flex items-center justify-center gap-2 py-3 px-3 sm:px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs sm:text-sm rounded-xl transition-all shadow-sm active:scale-[0.99] disabled:opacity-50 text-center"
                    >
                        {syncLoading ? <Loader2 className="size-4 animate-spin" /> : <CloudUpload className="size-4 shrink-0" />}
                        <span>Auf GitHub speichern (Push)</span>
                    </button>

                    <button
                        onClick={handleCloudPull}
                        disabled={syncLoading || !gistToken.trim()}
                        className="flex-1 flex items-center justify-center gap-2 py-3 px-3 sm:px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs sm:text-sm rounded-xl transition-all shadow-sm active:scale-[0.99] disabled:opacity-50 text-center"
                    >
                        {syncLoading ? <Loader2 className="size-4 animate-spin" /> : <CloudDownload className="size-4 shrink-0" />}
                        <span>Von GitHub laden (Pull)</span>
                    </button>
                </div>

                {/* Status Message */}
                {syncStatus.message && (
                    <div
                        className={`p-3.5 rounded-xl border text-xs flex items-start gap-2.5 break-all sm:break-words ${
                            syncStatus.type === 'success'
                                ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300'
                                : 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300'
                        }`}
                    >
                        {syncStatus.type === 'success' ? (
                            <CheckCircle className="size-4 shrink-0 mt-0.5" />
                        ) : (
                            <AlertTriangle className="size-4 shrink-0 mt-0.5" />
                        )}
                        <div className="flex-1 leading-relaxed whitespace-pre-wrap">{syncStatus.message}</div>
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 w-full max-w-full overflow-hidden">
                {/* Export Card */}
                <div className="bg-card border border-border rounded-xl p-4 sm:p-6 shadow-sm space-y-4">
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
                <div className="bg-card border border-border rounded-xl p-4 sm:p-6 shadow-sm space-y-4">
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
            <div className="bg-card border border-border rounded-xl p-4 sm:p-6 shadow-sm space-y-4 max-w-full overflow-hidden">
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
                                                watchlists={watchlists}
                                                stocks={stocks}
                                                fixedDeposits={fixedDeposits}

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
                                                watchlists={watchlists}
                                                stocks={stocks}
                                                fixedDeposits={fixedDeposits}

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
            <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-900/20 rounded-xl p-4 sm:p-6 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4 sm:gap-6 w-full max-w-full overflow-hidden">
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
                        watchlists: json.watchlists || (json.watchlist ? [{ id: 'default', name: 'Merkliste', stockIds: json.watchlist, isDefault: true }] : []),
                        mortgageData: json.mortgageData,
                        simulatorState: json.simulatorState
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
