
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
    // Christmas Eve (Dec 24) - often closed or early close, treating as closed for simplicity if requested, but stick to confirmed holidays. 
    // Boxing Day (Dec 26) - Closed in UK/EU often, but US open.
    // For now, specifically fixing Jan 1st as requested.

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
        // Approx 08:00 UTC - 16:30 UTC (09:00 - 17:30 CET)
        // LSE closes 16:30 UTC. XETRA closes 16:30 UTC. SIX closes 16:20 UTC.
        // We use a broad window: 07:55 UTC to 16:35 UTC to catch pre/post nuances or just strictly valid hours.
        return isOpen(8, 0, 16, 35) ? 'REGULAR' : 'CLOSED';
    }

    // specific check for US suffixes if simple symbol
    // 4. Currency Fallback

    // US Markets (NYSE, NASDAQ)
    // aprox. 14:30 UTC - 21:00 UTC (15:30 - 22:00 CET/CEST)
    if (currency === 'USD') {
        // US Holidays check (Independence Day July 4 etc would go here)
        if (month === 6 && date === 4) return 'CLOSED'; // July 4th
        return isOpen(14, 30, 21, 0) ? 'REGULAR' : 'CLOSED';
    }

    // European Markets Fallback (CHF, EUR, GBP)
    if (['CHF', 'EUR', 'GBP', 'GBp'].includes(currency)) {
        return isOpen(8, 0, 16, 35) ? 'REGULAR' : 'CLOSED';
    }

    // Asian Markets (HKD, JPY) - simplified
    // HK: 01:30 UTC - 08:00 UTC
    if (currency === 'HKD') {
        return isOpen(1, 30, 8, 0) ? 'REGULAR' : 'CLOSED';
    }

    // Default
    return 'CLOSED';
}
