
export function estimateMarketState(symbol: string, currency: string): 'REGULAR' | 'CLOSED' {
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
    // New Year's Day (Jan 1)
    if (month === 0 && date === 1) {
        return 'CLOSED';
    }
    // Christmas Day (Dec 25)
    if (month === 11 && date === 25) {
        return 'CLOSED';
    }

    const timeInMinutes = utcHours * 60 + utcMinutes;

    // Helper for time ranges
    const isOpen = (openHour: number, openMin: number, closeHour: number, closeMin: number) => {
        const start = openHour * 60 + openMin;
        const end = closeHour * 60 + closeMin;
        return timeInMinutes >= start && timeInMinutes < end;
    };

    // 3. Check by Symbol Suffix (More accurate than currency)
    const suffix = symbol?.split('.').pop()?.toUpperCase();

    // European Markets (.L = LSE, .SW = SIX, .DE/.F = Germany, .AS = Amsterdam, .PA = Paris, .MI = Milan)
    if (['L', 'SW', 'DE', 'F', 'AS', 'PA', 'MI', 'MC'].includes(suffix || '')) {
        // Exchange Hours in UTC:
        // LSE: 08:00 - 16:30 UTC
        // XETRA (DE): 08:00 - 16:35 UTC (09:00 - 17:35 CET)
        // SIX (SW): 08:00 - 16:20 UTC (09:00 - 17:20 CET)
        // Euronext: 08:00 - 16:30 UTC
        // We use a broad window: 07:55 UTC to 16:40 UTC
        return isOpen(7, 55, 16, 40) ? 'REGULAR' : 'CLOSED';
    }

    // 4. Currency Fallback for EU
    if (['CHF', 'EUR', 'GBP', 'GBp'].includes(currency)) {
        return isOpen(7, 55, 16, 40) ? 'REGULAR' : 'CLOSED';
    }

    // 5. US Markets (NYSE, NASDAQ)
    // Hours: 09:30 - 16:00 EST
    // UTC (Standard Time - Winter): 14:30 - 21:00 UTC
    // UTC (Daylight Time - Summer): 13:30 - 20:00 UTC
    // Note: This simple logic assumes Winter time (UTC offsets change).
    // Ideally, we'd use a library, but for now we stick to Standard Time (Winter) as primary or cover both.
    // Let's use 13:30 to 21:00 to cover both DST shifts broadly, OR just assume Winter for now (Jan).
    // Jan = Winter. US Open = 14:30 UTC.
    if (currency === 'USD') {
        // US Holidays
        if (month === 6 && date === 4) return 'CLOSED'; // July 4th
        if (month === 11 && date === 25) return 'CLOSED'; // Xmas
        if (month === 0 && date === 1) return 'CLOSED'; // New Year

        // Broad Window for US (14:30 - 21:00 UTC)
        return isOpen(14, 25, 21, 5) ? 'REGULAR' : 'CLOSED';
    }

    // Asian Markets (HKD)
    // HK: 09:30 - 16:00 HKT = 01:30 - 08:00 UTC
    if (currency === 'HKD') {
        return isOpen(1, 30, 8, 5) ? 'REGULAR' : 'CLOSED';
    }

    // Default
    return 'CLOSED';
}
