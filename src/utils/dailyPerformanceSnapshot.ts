export interface PositionDailySnapshot {
    stockId: string;
    symbol: string;
    name: string;
    currency: string;
    currentPrice: number;
    dailyGain: number;
    dailyGainPercent: number;
    dailyGainCHF: number;
}

export interface DailyPerformanceSnapshot {
    dateKey: string;           // e.g. '2026-11-09'
    displayDate: string;       // e.g. '09.11.'
    fullDate: string;          // e.g. 'Mo, 09.11.2026'
    totalDailyGainCHF: number;
    totalDailyGainPercent: number;
    positions: Record<string, PositionDailySnapshot>;
    savedAt: number;
}

const STORAGE_KEY_LATEST = 'portfolio_yesterday_closing_snapshot';
const STORAGE_KEY_HISTORY = 'portfolio_closing_snapshots_history';

/**
 * Calculates the previous trading day (skipping weekends: Saturday and Sunday).
 * e.g. Wednesday -> Tuesday, Monday -> Friday.
 */
export function getPreviousTradingDate(referenceDate: Date = new Date()): Date {
    const d = new Date(referenceDate);
    do {
        d.setDate(d.getDate() - 1);
    } while (d.getDay() === 0 || d.getDay() === 6);
    return d;
}

export function getLocalDateKey(date: Date = new Date()): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

export function saveYesterdaySnapshot(snapshot: DailyPerformanceSnapshot): void {
    try {
        const todayKey = getLocalDateKey();
        
        // Always store in history
        const rawHistory = localStorage.getItem(STORAGE_KEY_HISTORY);
        const history: Record<string, DailyPerformanceSnapshot> = rawHistory ? JSON.parse(rawHistory) : {};
        history[snapshot.dateKey] = snapshot;
        
        // Prune older than 10 keys
        const keys = Object.keys(history).sort();
        if (keys.length > 10) {
            keys.slice(0, keys.length - 10).forEach(k => delete history[k]);
        }
        localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(history));

        // Only save as LATEST if it's strictly a past day, OR if no previous closing snapshot exists
        const currentLatestRaw = localStorage.getItem(STORAGE_KEY_LATEST);
        let currentLatest: DailyPerformanceSnapshot | null = null;
        try {
            if (currentLatestRaw) currentLatest = JSON.parse(currentLatestRaw);
        } catch {
            currentLatest = null;
        }

        if (snapshot.dateKey < todayKey || !currentLatest || currentLatest.dateKey === snapshot.dateKey) {
            localStorage.setItem(STORAGE_KEY_LATEST, JSON.stringify(snapshot));
        }
    } catch (e) {
        console.warn('[dailyPerformanceSnapshot] Failed to save snapshot to localStorage', e);
    }
}

/**
 * Loads the last closing snapshot from the PREVIOUS trading day.
 * Ensures that today's date is NEVER returned as yesterday's snapshot.
 */
export function loadYesterdaySnapshot(now: Date = new Date()): DailyPerformanceSnapshot | null {
    try {
        const todayKey = getLocalDateKey(now);
        const rawLatest = localStorage.getItem(STORAGE_KEY_LATEST);
        let latest: DailyPerformanceSnapshot | null = null;
        if (rawLatest) {
            try {
                latest = JSON.parse(rawLatest);
            } catch {
                latest = null;
            }
        }

        // If latest snapshot is strictly from before today, it is indeed yesterday's closing snapshot!
        if (latest && latest.dateKey && latest.dateKey < todayKey) {
            return latest;
        }

        // If latest was stored with today's date (or missing), search history for the newest snapshot BEFORE today
        const rawHistory = localStorage.getItem(STORAGE_KEY_HISTORY);
        if (rawHistory) {
            try {
                const history: Record<string, DailyPerformanceSnapshot> = JSON.parse(rawHistory);
                const pastKeys = Object.keys(history).filter(k => k < todayKey).sort();
                if (pastKeys.length > 0) {
                    const bestKey = pastKeys[pastKeys.length - 1];
                    return history[bestKey];
                }
            } catch {
                // ignore
            }
        }

        return null;
    } catch (e) {
        console.warn('[dailyPerformanceSnapshot] Failed to load snapshot from localStorage', e);
        return null;
    }
}
