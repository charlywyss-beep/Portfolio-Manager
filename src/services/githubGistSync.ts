export interface GistSyncResult {
    success: boolean;
    message: string;
    gistId?: string;
    username?: string;
    updatedAt?: string;
    data?: any;
}

export const GIST_FILENAME = 'portfolio_manager_cloud_backup.json';
export const GIST_DESCRIPTION = 'Portfolio Manager Private Cloud Sync';

export const GIST_STORAGE_KEYS = {
    TOKEN: 'portfolio_github_token',
    GIST_ID: 'portfolio_gist_id',
    LAST_SYNC: 'portfolio_last_cloud_sync',
    PRE_SYNC_SNAPSHOT: 'portfolio_pre_sync_snapshot'
};

export function getGistCredentials(): { token: string; gistId: string; lastSync: string | null } {
    const token = localStorage.getItem(GIST_STORAGE_KEYS.TOKEN) || localStorage.getItem('gist_github_token') || '';
    const gistId = localStorage.getItem(GIST_STORAGE_KEYS.GIST_ID) || '';
    const lastSync = localStorage.getItem(GIST_STORAGE_KEYS.LAST_SYNC);
    return { token: token.trim(), gistId: gistId.trim(), lastSync };
}

export function saveGistCredentials(token: string, gistId?: string): void {
    localStorage.setItem(GIST_STORAGE_KEYS.TOKEN, token.trim());
    if (gistId !== undefined) {
        localStorage.setItem(GIST_STORAGE_KEYS.GIST_ID, gistId.trim());
    }
}

export async function testGitHubToken(token: string): Promise<{ success: boolean; username?: string; message: string }> {
    const cleanToken = token.trim();
    if (!cleanToken) {
        return { success: false, message: 'Bitte ein GitHub Token eingeben.' };
    }
    try {
        const res = await fetch('https://api.github.com/user', {
            headers: {
                'Authorization': `Bearer ${cleanToken}`,
                'Accept': 'application/vnd.github+json'
            }
        });
        if (res.ok) {
            const user = await res.json();
            return {
                success: true,
                username: user.login || user.name || 'GitHub User',
                message: `Erfolgreich autorisiert als ${user.login}!`
            };
        } else if (res.status === 401) {
            return { success: false, message: 'Token ist ungültig oder abgelaufen (401 Unauthorized).' };
        } else {
            return { success: false, message: `GitHub API Fehler: Status ${res.status}` };
        }
    } catch (e: any) {
        return { success: false, message: `Netzwerkfehler: ${e.message}` };
    }
}

export async function autoDiscoverPortfolioGist(token: string): Promise<string | null> {
    try {
        const res = await fetch('https://api.github.com/gists?per_page=100', {
            headers: {
                'Authorization': `Bearer ${token.trim()}`,
                'Accept': 'application/vnd.github+json'
            }
        });
        if (res.ok) {
            const gists = await res.json();
            const found = gists.find((g: any) => g.files && g.files[GIST_FILENAME]);
            if (found) {
                return found.id;
            }
        }
    } catch (e) {
        console.error('Auto discover Gist error:', e);
    }
    return null;
}

export async function connectOrCreateGist(token: string, providedGistId?: string): Promise<GistSyncResult> {
    const cleanToken = token.trim();
    const tokenCheck = await testGitHubToken(cleanToken);
    if (!tokenCheck.success) {
        return { success: false, message: tokenCheck.message };
    }

    let gistId = providedGistId?.trim() || '';

    // If an existing Gist ID was provided, check if it works
    if (gistId) {
        try {
            const res = await fetch(`https://api.github.com/gists/${gistId}`, {
                headers: {
                    'Authorization': `Bearer ${cleanToken}`,
                    'Accept': 'application/vnd.github+json'
                }
            });
            if (res.ok) {
                saveGistCredentials(cleanToken, gistId);
                return {
                    success: true,
                    gistId,
                    username: tokenCheck.username,
                    message: `Verbindung zu Gist ${gistId} erfolgreich hergestellt!`
                };
            }
        } catch (e) {
            console.warn('Gist check failed, searching for existing gist...', e);
        }
    }

    // Auto-discover existing gist
    const discoveredId = await autoDiscoverPortfolioGist(cleanToken);
    if (discoveredId) {
        saveGistCredentials(cleanToken, discoveredId);
        return {
            success: true,
            gistId: discoveredId,
            username: tokenCheck.username,
            message: `Bestehenden Portfolio-Cloud-Speicher auf GitHub gefunden & verknüpft!`
        };
    }

    // Create a new secret Gist if none found
    try {
        const createRes = await fetch('https://api.github.com/gists', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${cleanToken}`,
                'Content-Type': 'application/json',
                'Accept': 'application/vnd.github+json'
            },
            body: JSON.stringify({
                description: GIST_DESCRIPTION,
                public: false,
                files: {
                    [GIST_FILENAME]: {
                        content: JSON.stringify({
                            createdAt: new Date().toISOString(),
                            info: "Initial Portfolio Manager Cloud Backup"
                        }, null, 2)
                    }
                }
            })
        });

        if (createRes.ok) {
            const newGist = await createRes.json();
            saveGistCredentials(cleanToken, newGist.id);
            return {
                success: true,
                gistId: newGist.id,
                username: tokenCheck.username,
                message: `Neuen privaten Cloud-Speicher (Gist) erfolgreich auf GitHub erstellt!`
            };
        } else {
            const errData = await createRes.json().catch(() => ({}));
            return {
                success: false,
                message: `Fehler beim Erstellen des Gists: ${errData.message || createRes.statusText}`
            };
        }
    } catch (e: any) {
        return { success: false, message: `Netzwerkfehler beim Erstellen: ${e.message}` };
    }
}

export async function pushDataToGist(dataToSave: any): Promise<GistSyncResult> {
    const { token } = getGistCredentials();
    let { gistId } = getGistCredentials();

    if (!token) {
        return { success: false, message: 'Kein GitHub Token vorhanden. Bitte trage zuerst dein PAT in den Einstellungen ein.' };
    }

    if (!gistId) {
        const connectRes = await connectOrCreateGist(token);
        if (!connectRes.success || !connectRes.gistId) {
            return { success: false, message: connectRes.message };
        }
        gistId = connectRes.gistId;
    }

    try {
        const timestamp = new Date().toISOString();
        const payload = {
            description: GIST_DESCRIPTION,
            files: {
                [GIST_FILENAME]: {
                    content: JSON.stringify({
                        updatedAt: timestamp,
                        ...dataToSave
                    }, null, 2)
                }
            }
        };

        let res = await fetch(`https://api.github.com/gists/${gistId}`, {
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                'Accept': 'application/vnd.github+json'
            },
            body: JSON.stringify(payload)
        });

        if (!res.ok) {
            // If gist ID not found or error, attempt auto-discovery once
            const discovered = await autoDiscoverPortfolioGist(token);
            if (discovered && discovered !== gistId) {
                gistId = discovered;
                saveGistCredentials(token, gistId);
                res = await fetch(`https://api.github.com/gists/${gistId}`, {
                    method: 'PATCH',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json',
                        'Accept': 'application/vnd.github+json'
                    },
                    body: JSON.stringify(payload)
                });
            }
        }

        if (res.ok) {
            localStorage.setItem(GIST_STORAGE_KEYS.LAST_SYNC, timestamp);
            return {
                success: true,
                gistId,
                updatedAt: timestamp,
                message: 'Daten erfolgreich auf GitHub gespeichert!'
            };
        } else {
            const err = await res.json().catch(() => ({}));
            return {
                success: false,
                message: `Upload fehlgeschlagen: ${err.message || res.statusText}`
            };
        }
    } catch (e: any) {
        return { success: false, message: `Upload-Fehler: ${e.message}` };
    }
}

export async function pullDataFromGist(currentDataToSnapshot?: any): Promise<GistSyncResult> {
    const { token } = getGistCredentials();
    let { gistId } = getGistCredentials();

    if (!token) {
        return { success: false, message: 'Kein GitHub Token vorhanden. Bitte trage zuerst dein PAT in den Einstellungen ein.' };
    }

    if (!gistId) {
        const discovered = await autoDiscoverPortfolioGist(token);
        if (discovered) {
            gistId = discovered;
            saveGistCredentials(token, gistId);
        } else {
            return {
                success: false,
                message: 'Kein bestehender Portfolio-Cloud-Speicher auf GitHub gefunden. Bitte zuerst auf "Auf GitHub speichern" klicken.'
            };
        }
    }

    try {
        let res = await fetch(`https://api.github.com/gists/${gistId}`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/vnd.github+json'
            }
        });

        if (!res.ok) {
            const discovered = await autoDiscoverPortfolioGist(token);
            if (discovered && discovered !== gistId) {
                gistId = discovered;
                saveGistCredentials(token, gistId);
                res = await fetch(`https://api.github.com/gists/${gistId}`, {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Accept': 'application/vnd.github+json'
                    }
                });
            }
        }

        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            return { success: false, message: `Download fehlgeschlagen: ${err.message || res.statusText}` };
        }

        const gistData = await res.json();
        const fileObj = gistData.files && gistData.files[GIST_FILENAME];
        if (!fileObj || !fileObj.content) {
            return { success: false, message: `Datei "${GIST_FILENAME}" im Gist nicht gefunden oder leer.` };
        }

        const cloudData = JSON.parse(fileObj.content);

        // Save pre-sync snapshot if current data provided
        if (currentDataToSnapshot) {
            try {
                localStorage.setItem(GIST_STORAGE_KEYS.PRE_SYNC_SNAPSHOT, JSON.stringify(currentDataToSnapshot));
            } catch (e) {
                console.warn('Could not save pre-sync snapshot', e);
            }
        }

        const timestamp = cloudData.updatedAt || new Date().toISOString();
        localStorage.setItem(GIST_STORAGE_KEYS.LAST_SYNC, timestamp);

        return {
            success: true,
            gistId,
            data: cloudData,
            updatedAt: timestamp,
            message: 'Daten erfolgreich von GitHub geladen!'
        };
    } catch (e: any) {
        return { success: false, message: `Download-Fehler: ${e.message}` };
    }
}
