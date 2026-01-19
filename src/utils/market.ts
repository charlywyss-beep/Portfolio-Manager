
export type MarketState = 'REGULAR' | 'PRE' | 'POST' | 'CLOSED';

// Helper to check for US Market Holidays (NYSE/NASDAQ)
function isUSMarketHoliday(now: Date): boolean {
    const d = now.getUTCDate();
    const m = now.getUTCMonth(); // 0-11
    const day = now.getUTCDay(); // 0-6 (Sun-Sat)

    // Fixed Dates
    if (m === 0 && d === 1) return true; // New Years Day
    if (m === 5 && d === 19) return true; // Juneteenth
    if (m === 6 && d === 4) return true; // Independence Day
    if (m === 11 && d === 25) return true; // Christmas

    // Floating Mondays/Thursdays
    // Helper: nthWeekdayOfMonth(year, month, dayOfWeek, n)
    // Actually simpler: just check specific ranges

    // MLK Day: 3rd Monday in Jan
    if (m === 0 && day === 1 && d >= 15 && d <= 21) return true;

    // Presidents Day: 3rd Monday in Feb
    if (m === 1 && day === 1 && d >= 15 && d <= 21) return true;

    // Memorial Day: Last Monday in May
    if (m === 4 && day === 1 && d >= 25) return true;

    // Labor Day: 1st Monday in Sept
    if (m === 8 && day === 1 && d <= 7) return true;

    // Thanksgiving: 4th Thursday in Nov
    if (m === 10 && day === 4 && d >= 22 && d <= 28) return true;

    // Good Friday (Hardcoded for 2024-2030 to avoid complex lunar math)
    const year = now.getUTCFullYear();
    if (year === 2024 && m === 2 && d === 29) return true;
    if (year === 2025 && m === 3 && d === 18) return true;
    if (year === 2026 && m === 3 && d === 3) return true; // April 3rd
    if (year === 2027 && m === 2 && d === 26) return true;

    return false;
}

export function estimateMarketState(symbol: string, currency: string): MarketState {
    const now = new Date();
    const utcHours = now.getUTCHours();
    const utcMinutes = now.getUTCMinutes();
    const day = now.getUTCDay(); // 0 = Sunday, 6 = Saturday

    // 1. Weekend Check
    if (day === 0 || day === 6) {
        return 'CLOSED';
    }

    const timeInMinutes = utcHours * 60 + utcMinutes;

    // Helper for time ranges
    const getDetailedState = (openH: number, openM: number, closeH: number, closeM: number): MarketState => {
        const start = openH * 60 + openM;
        const end = closeH * 60 + closeM;

        if (timeInMinutes < start) return 'PRE';
        if (timeInMinutes >= start && timeInMinutes < end) return 'REGULAR';
        return 'POST';
    };

    // 2. Check by Symbol Suffix
    const suffix = symbol?.split('.').pop()?.toUpperCase();
    const month = now.getUTCMonth();
    const date = now.getUTCDate();

    // Switzerland (SIX)
    const isSwiss = suffix === 'SW' || currency === 'CHF';
    if (isSwiss) {
        if (month === 0 && date === 1) return 'CLOSED'; // New Year
        if (month === 0 && date === 2) return 'CLOSED'; // Berchtoldstag
        if (month === 4 && date === 1) return 'CLOSED'; // Labor Day
        if (month === 7 && date === 1) return 'CLOSED'; // National Day
        if (month === 11 && date === 25) return 'CLOSED'; // Christmas
        if (month === 11 && date === 26) return 'CLOSED'; // St Stephen
        return getDetailedState(8, 0, 16, 20); // 09:00 - 17:20 CET
    }

    // European Markets
    if (['L', 'DE', 'F', 'AS', 'PA', 'MI', 'MC'].includes(suffix || '')) {
        if (month === 0 && date === 1) return 'CLOSED';
        if (month === 11 && date === 25) return 'CLOSED';
        if (month === 11 && date === 26) return 'CLOSED';
        return getDetailedState(8, 0, 16, 30); // 09:00 - 17:30 CET (Main window)
    }

    // 3. US Markets (NYSE, NASDAQ)
    if (currency === 'USD') {
        if (isUSMarketHoliday(now)) return 'CLOSED';
        return getDetailedState(14, 30, 21, 0); // 15:30 - 22:00 CET (Winter)
    }

    // 4. Fallback for EUR/GBP
    if (['EUR', 'GBP', 'GBp'].includes(currency)) {
        if (month === 0 && date === 1) return 'CLOSED';
        if (month === 11 && date === 25) return 'CLOSED';
        return getDetailedState(8, 0, 16, 30);
    }

    // Asian Markets (HKD)
    if (currency === 'HKD') {
        return getDetailedState(1, 30, 8, 0);
    }

    return 'CLOSED';
}
