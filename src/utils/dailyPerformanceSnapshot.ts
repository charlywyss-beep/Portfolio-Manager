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

export const SEED_SNAPSHOT_2026_11_11: DailyPerformanceSnapshot = {
    dateKey: '2026-11-11',
    displayDate: '11.11.',
    fullDate: 'Mi, 11.11.2026',
    totalDailyGainCHF: 2868.80,
    totalDailyGainPercent: 0.68,
    savedAt: 1794419400000,
    positions: {
        'VWRA.L': { stockId: 'VWRA.L', symbol: 'VWRA.L', name: 'Vanguard FTSE All-World', currency: 'USD', currentPrice: 189.62, dailyGain: 2.73, dailyGainPercent: 1.46, dailyGainCHF: 2241.78 },
        'ABEA.DE': { stockId: 'ABEA.DE', symbol: 'ABEA.DE', name: 'Alphabet Inc.', currency: 'EUR', currentPrice: 263.10, dailyGain: 5.12, dailyGainPercent: 1.98, dailyGainCHF: 469.85 },
        'RIO.L': { stockId: 'RIO.L', symbol: 'RIO.L', name: 'Rio Tinto', currency: 'GBP', currentPrice: 63.85, dailyGain: 0.62, dailyGainPercent: 0.98, dailyGainCHF: 307.30 },
        'VHYL.SW': { stockId: 'VHYL.SW', symbol: 'VHYL.SW', name: 'Vanguard FTSE All-World High Dividend Yield UCITS ETF USD Distributing', currency: 'CHF', currentPrice: 77.67, dailyGain: 1.10, dailyGainPercent: 1.44, dailyGainCHF: 302.50 },
        'BATS.L': { stockId: 'BATS.L', symbol: 'BATS.L', name: 'BAT', currency: 'GBP', currentPrice: 45.46, dailyGain: 0.05, dailyGainPercent: 0.11, dailyGainCHF: 55.07 },
        'ZURN.SW': { stockId: 'ZURN.SW', symbol: 'ZURN.SW', name: 'ZURICH Versicherung', currency: 'CHF', currentPrice: 637.40, dailyGain: 1.02, dailyGainPercent: 0.16, dailyGainCHF: 25.00 },
        'TTE.PA': { stockId: 'TTE.PA', symbol: 'TTE.PA', name: 'TotalEnergies', currency: 'EUR', currentPrice: 79.37, dailyGain: 1.17, dailyGainPercent: 1.50, dailyGainCHF: 269.48 },
        'SREN.SW': { stockId: 'SREN.SW', symbol: 'SREN.SW', name: 'Swiss Re', currency: 'CHF', currentPrice: 150.50, dailyGain: -0.35, dailyGainPercent: -0.23, dailyGainCHF: -26.25 },
        'NESN.SW': { stockId: 'NESN.SW', symbol: 'NESN.SW', name: 'Nestle SA', currency: 'CHF', currentPrice: 85.91, dailyGain: -0.50, dailyGainPercent: -0.58, dailyGainCHF: -110.00 },
        'BRK-B': { stockId: 'BRK-B', symbol: 'BRK-B', name: 'Berkshire Hathaway Inc-B', currency: 'USD', currentPrice: 580.40, dailyGain: -2.92, dailyGainPercent: -0.50, dailyGainCHF: -121.15 },
        'PBR-A': { stockId: 'PBR-A', symbol: 'PBR-A', name: 'Petrobras', currency: 'USD', currentPrice: 15.90, dailyGain: -0.30, dailyGainPercent: -1.85, dailyGainCHF: -185.44 },
        'PEP': { stockId: 'PEP', symbol: 'PEP', name: 'PepsiCo, Inc.', currency: 'USD', currentPrice: 141.73, dailyGain: -1.88, dailyGainPercent: -1.31, dailyGainCHF: -310.72 },
        'GIS': { stockId: 'GIS', symbol: 'GIS', name: 'General Mills, Inc.', currency: 'USD', currentPrice: 33.74, dailyGain: -0.87, dailyGainPercent: -2.50, dailyGainCHF: -356.46 }
    }
};

/**
 * Loads the closing snapshot from the PREVIOUS trading day.
 * Strictly verifies that the snapshot matches the previous trading date.
 * If no snapshot exists for that date (or is older), returns null (or seed data for 11.11.26).
 */
export function loadYesterdaySnapshot(now: Date = new Date()): DailyPerformanceSnapshot | null {
    try {
        const prevTradingDate = getPreviousTradingDate(now);
        const expectedPrevKey = getLocalDateKey(prevTradingDate);
        const rawLatest = localStorage.getItem(STORAGE_KEY_LATEST);
        let latest: DailyPerformanceSnapshot | null = null;
        if (rawLatest) {
            try {
                latest = JSON.parse(rawLatest);
            } catch {
                latest = null;
            }
        }

        // If latest snapshot matches the previous trading date, return it!
        if (latest && latest.dateKey === expectedPrevKey) {
            return latest;
        }

        // Check history for the previous trading date snapshot
        const rawHistory = localStorage.getItem(STORAGE_KEY_HISTORY);
        if (rawHistory) {
            try {
                const history: Record<string, DailyPerformanceSnapshot> = JSON.parse(rawHistory);
                if (history[expectedPrevKey]) {
                    return history[expectedPrevKey];
                }
            } catch {
                // ignore
            }
        }

        // Fallback for 2026-11-11 seed snapshot
        if (expectedPrevKey === '2026-11-11') {
            return SEED_SNAPSHOT_2026_11_11;
        }

        return null;
    } catch (e) {
        console.warn('[dailyPerformanceSnapshot] Failed to load snapshot from localStorage', e);
        return null;
    }
}
