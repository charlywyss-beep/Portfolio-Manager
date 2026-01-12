
export type MarketState = 'REGULAR' | 'PRE' | 'POST' | 'CLOSED';

export function estimateMarketState(symbol: string, currency: string): MarketState {
    const now = new Date();
    const utcHours = now.getUTCHours();
    const utcMinutes = now.getUTCMinutes();
    const day = now.getUTCDay(); // 0 = Sunday, 6 = Saturday
    const date = now.getUTCDate();
    const month = now.getUTCMonth(); // 0 = Jan, 11 = Dec

    // 1. Weekend Check
    if (day === 0 || day === 6) {
        return 'CLOSED';
    }

    // 2. Holiday Check (Fixed dates)
    const isHoliday = (month === 0 && date === 1) || (month === 11 && date === 25);
    if (isHoliday) return 'CLOSED';

    const timeInMinutes = utcHours * 60 + utcMinutes;

    // Helper for time ranges
    const getDetailedState = (openH: number, openM: number, closeH: number, closeM: number): MarketState => {
        const start = openH * 60 + openM;
        const end = closeH * 60 + closeM;

        if (timeInMinutes < start) return 'PRE';
        if (timeInMinutes >= start && timeInMinutes < end) return 'REGULAR';
        return 'POST';
    };

    // 3. Check by Symbol Suffix
    const suffix = symbol?.split('.').pop()?.toUpperCase();

    // Switzerland (SIX)
    const isSwiss = suffix === 'SW' || currency === 'CHF';
    if (isSwiss) {
        if (month === 0 && date === 2) return 'CLOSED';
        if (month === 4 && date === 1) return 'CLOSED';
        if (month === 7 && date === 1) return 'CLOSED';
        if (month === 11 && date === 26) return 'CLOSED';
        return getDetailedState(8, 0, 16, 20); // 09:00 - 17:20 CET
    }

    // European Markets
    if (['L', 'DE', 'F', 'AS', 'PA', 'MI', 'MC'].includes(suffix || '')) {
        return getDetailedState(8, 0, 16, 30); // 09:00 - 17:30 CET (Main window)
    }

    // 4. Currency Fallback for EU
    if (['EUR', 'GBP', 'GBp'].includes(currency)) {
        return getDetailedState(8, 0, 16, 30);
    }

    // 5. US Markets (NYSE, NASDAQ)
    if (currency === 'USD') {
        if (month === 6 && date === 4) return 'CLOSED'; // July 4th
        return getDetailedState(14, 30, 21, 0); // 15:30 - 22:00 CET (Winter)
    }

    // Asian Markets (HKD)
    if (currency === 'HKD') {
        return getDetailedState(1, 30, 8, 0);
    }

    return 'CLOSED';
}
