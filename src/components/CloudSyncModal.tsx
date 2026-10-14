import { useState, useEffect, useRef } from 'react';
import { Cloud, CloudUpload, CloudDownload, CheckCircle2, AlertCircle, Loader2, ExternalLink, X, Key, RefreshCw } from 'lucide-react';
import { usePortfolio } from '../context/PortfolioContext';
import {
    getGistCredentials,
    pushDataToGist,
    pullDataFromGist,
    connectOrCreateGist,
    testGitHubToken
} from '../services/githubGistSync';

interface CloudSyncModalProps {
    isOpen: boolean;
    onClose: () => void;
    onOpenSettings?: () => void;
}

export function CloudSyncModal({ isOpen, onClose, onOpenSettings }: CloudSyncModalProps) {
    const { exportCurrentData, importData } = usePortfolio();

    const [token, setToken] = useState('');
    const [gistId, setGistId] = useState('');
    const [lastSync, setLastSync] = useState<string | null>(null);
    const [username, setUsername] = useState<string | null>(null);

    const [isLoading, setIsLoading] = useState(false);
    const [statusType, setStatusType] = useState<'idle' | 'success' | 'error'>('idle');
    const [statusMessage, setStatusMessage] = useState('');
    const autoCloseTimerRef = useRef<any>(null);

    const reloadCredentials = () => {
        const creds = getGistCredentials();
        setToken(creds.token);
        setGistId(creds.gistId);
        setLastSync(creds.lastSync);
        if (creds.token) {
            testGitHubToken(creds.token).then(res => {
                if (res.success && res.username) {
                    setUsername(res.username);
                }
            });
        }
    };

    useEffect(() => {
        if (isOpen) {
            reloadCredentials();
            setStatusType('idle');
            setStatusMessage('');
        }
        return () => {
            if (autoCloseTimerRef.current) clearTimeout(autoCloseTimerRef.current);
        };
    }, [isOpen]);

    if (!isOpen) return null;

    const handleConnect = async () => {
        if (!token.trim()) {
            setStatusType('error');
            setStatusMessage('Bitte ein gültiges GitHub Token (PAT) eingeben.');
            return;
        }

        setIsLoading(true);
        setStatusType('idle');
        setStatusMessage('');

        const res = await connectOrCreateGist(token, gistId);
        setIsLoading(false);

        if (res.success) {
            setStatusType('success');
            setStatusMessage(res.message);
            if (res.gistId) setGistId(res.gistId);
            if (res.username) setUsername(res.username);
            reloadCredentials();
        } else {
            setStatusType('error');
            setStatusMessage(res.message);
        }
    };

    const handlePush = async () => {
        setIsLoading(true);
        setStatusType('idle');
        setStatusMessage('');

        const dataToSave = exportCurrentData();
        const res = await pushDataToGist(dataToSave);
        setIsLoading(false);

        if (res.success) {
            setStatusType('success');
            setStatusMessage(`✅ ${res.message}`);
            reloadCredentials();
            if (autoCloseTimerRef.current) clearTimeout(autoCloseTimerRef.current);
            autoCloseTimerRef.current = setTimeout(() => {
                onClose();
            }, 1200);
        } else {
            setStatusType('error');
            setStatusMessage(res.message);
        }
    };

    const handlePull = async () => {
        const confirmed = window.confirm(
            "☁️ Möchten Sie die Portfolio-Daten von GitHub laden?\n\nLokale Daten werden durch den gesicherten Stand von GitHub ersetzt."
        );
        if (!confirmed) return;

        setIsLoading(true);
        setStatusType('idle');
        setStatusMessage('');

        const currentData = exportCurrentData();
        const res = await pullDataFromGist(currentData);
        setIsLoading(false);

        if (res.success && res.data) {
            const imported = importData(res.data);
            if (imported) {
                setStatusType('success');
                const timeStr = res.updatedAt ? new Date(res.updatedAt).toLocaleString('de-CH') : '';
                setStatusMessage(`✅ Daten erfolgreich geladen! (Stand: ${timeStr})`);
                reloadCredentials();
                if (autoCloseTimerRef.current) clearTimeout(autoCloseTimerRef.current);
                autoCloseTimerRef.current = setTimeout(() => {
                    onClose();
                }, 1200);
            } else {
                setStatusType('error');
                setStatusMessage('Fehler beim Einlesen der heruntergeladenen Daten.');
            }
        } else {
            setStatusType('error');
            setStatusMessage(res.message);
        }
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

    return (
        <div
            className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={onClose}
        >
            <div
                className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="p-6 border-b border-border bg-gradient-to-r from-blue-600/10 via-primary/10 to-transparent flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-blue-500/15 text-blue-600 dark:text-blue-400 rounded-xl border border-blue-500/20">
                            <Cloud className="size-6" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-foreground">GitHub Cloud-Sync</h2>
                            <p className="text-xs text-muted-foreground">Daten geräteübergreifend synchronisieren</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-muted rounded-lg text-muted-foreground transition-colors"
                        aria-label="Schließen"
                    >
                        <X className="size-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
                    {/* Status Overview Card */}
                    <div className="bg-muted/40 border border-border rounded-xl p-4 space-y-2.5">
                        <div className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">GitHub-Konto:</span>
                            <span className="font-semibold text-foreground flex items-center gap-1.5">
                                {username ? (
                                    <>
                                        <span className="size-2 rounded-full bg-emerald-500 inline-block animate-pulse"></span>
                                        {username}
                                    </>
                                ) : token ? (
                                    <span className="text-amber-500">Token hinterlegt</span>
                                ) : (
                                    <span className="text-muted-foreground italic">Nicht verbunden</span>
                                )}
                            </span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">Letzter Cloud-Sync:</span>
                            <span className="font-mono font-medium text-foreground">{formatTimestamp(lastSync)}</span>
                        </div>
                        {gistId && (
                            <div className="flex items-center justify-between text-xs pt-1 border-t border-border/50">
                                <span className="text-muted-foreground">Gist-ID:</span>
                                <a
                                    href={`https://gist.github.com/${gistId}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="font-mono text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                                >
                                    <span>{gistId.substring(0, 12)}...</span>
                                    <ExternalLink className="size-3" />
                                </a>
                            </div>
                        )}
                    </div>

                    {/* If Token is missing */}
                    {!token ? (
                        <div className="space-y-4">
                            <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-start gap-3">
                                <Key className="size-5 text-amber-500 shrink-0 mt-0.5" />
                                <div className="text-xs space-y-1">
                                    <p className="font-semibold text-amber-600 dark:text-amber-400">
                                        GitHub Personal Access Token (PAT) erforderlich
                                    </p>
                                    <p className="text-muted-foreground leading-relaxed">
                                        Sie können denselben Token wie beim Arbeitszeitrechner nutzen oder einen neuen mit <code>gist</code>-Berechtigung erstellen.
                                    </p>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-semibold text-foreground">Token hier einfügen:</label>
                                <input
                                    type="password"
                                    placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                                    value={token}
                                    onChange={(e) => setToken(e.target.value)}
                                    className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg font-mono focus:outline-none focus:ring-2 focus:ring-primary"
                                />
                            </div>

                            <button
                                onClick={handleConnect}
                                disabled={isLoading || !token.trim()}
                                className="w-full py-2.5 px-4 bg-primary text-primary-foreground font-semibold text-sm rounded-xl hover:bg-primary/90 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                            >
                                {isLoading ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
                                <span>Verbindung herstellen & Gist verknüpfen</span>
                            </button>
                        </div>
                    ) : (
                        /* Sync Actions */
                        <div className="space-y-3">
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                Synchronisation ausführen
                            </p>

                            <div className="grid sm:grid-cols-2 gap-3">
                                {/* Push Button */}
                                <button
                                    onClick={handlePush}
                                    disabled={isLoading}
                                    className="flex flex-col items-center justify-center p-4 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 text-blue-600 dark:text-blue-400 rounded-xl transition-all group disabled:opacity-50 text-center"
                                >
                                    <div className="p-3 bg-blue-500/20 rounded-full mb-2 group-hover:scale-110 transition-transform">
                                        <CloudUpload className="size-6" />
                                    </div>
                                    <span className="font-bold text-sm">Auf GitHub speichern</span>
                                    <span className="text-[11px] text-muted-foreground mt-0.5">Lokale Daten hochladen (Push)</span>
                                </button>

                                {/* Pull Button */}
                                <button
                                    onClick={handlePull}
                                    disabled={isLoading}
                                    className="flex flex-col items-center justify-center p-4 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 rounded-xl transition-all group disabled:opacity-50 text-center"
                                >
                                    <div className="p-3 bg-emerald-500/20 rounded-full mb-2 group-hover:scale-110 transition-transform">
                                        <CloudDownload className="size-6" />
                                    </div>
                                    <span className="font-bold text-sm">Von GitHub laden</span>
                                    <span className="text-[11px] text-muted-foreground mt-0.5">Daten herunterladen (Pull)</span>
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Feedback Alert */}
                    {statusMessage && (
                        <div
                            className={`p-3.5 rounded-xl border text-xs flex items-start gap-2.5 ${
                                statusType === 'success'
                                    ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300'
                                    : 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300'
                            }`}
                        >
                            {statusType === 'success' ? (
                                <CheckCircle2 className="size-4 shrink-0 mt-0.5" />
                            ) : (
                                <AlertCircle className="size-4 shrink-0 mt-0.5" />
                            )}
                            <div className="flex-1 leading-relaxed whitespace-pre-wrap">{statusMessage}</div>
                        </div>
                    )}

                    {isLoading && (
                        <div className="flex items-center justify-center gap-2 py-2 text-xs text-muted-foreground">
                            <Loader2 className="size-4 animate-spin text-primary" />
                            <span>Synchronisation läuft...</span>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 bg-muted/30 border-t border-border flex items-center justify-between text-xs">
                    {onOpenSettings && (
                        <button
                            onClick={() => {
                                onClose();
                                onOpenSettings();
                            }}
                            className="text-primary hover:underline font-medium"
                        >
                            ⚙️ Zu den Sync-Einstellungen
                        </button>
                    )}
                    <button
                        onClick={onClose}
                        className="ml-auto px-4 py-2 bg-secondary hover:bg-secondary/80 text-secondary-foreground rounded-lg font-medium transition-colors"
                    >
                        Schließen
                    </button>
                </div>
            </div>
        </div>
    );
}
