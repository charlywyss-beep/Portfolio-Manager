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

export function saveYesterdaySnapshot(snapshot: DailyPerformanceSnapshot): void {
    try {
        localStorage.setItem(STORAGE_KEY_LATEST, JSON.stringify(snapshot));
        
        // Also keep in history (up to 7 days)
        const rawHistory = localStorage.getItem(STORAGE_KEY_HISTORY);
        const history: Record<string, DailyPerformanceSnapshot> = rawHistory ? JSON.parse(rawHistory) : {};
        history[snapshot.dateKey] = snapshot;
        
        // Prune older than 10 keys
        const keys = Object.keys(history).sort();
        if (keys.length > 10) {
            keys.slice(0, keys.length - 10).forEach(k => delete history[k]);
        }
        localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(history));
    } catch (e) {
        console.warn('[dailyPerformanceSnapshot] Failed to save snapshot to localStorage', e);
    }
}

export function loadYesterdaySnapshot(): DailyPerformanceSnapshot | null {
    try {
        const raw = localStorage.getItem(STORAGE_KEY_LATEST);
        if (!raw) return null;
        return JSON.parse(raw) as DailyPerformanceSnapshot;
    } catch (e) {
        console.warn('[dailyPerformanceSnapshot] Failed to load snapshot from localStorage', e);
        return null;
    }
}
