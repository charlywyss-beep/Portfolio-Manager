
export function estimateMarketState(_symbol: string, currency: string): 'REGULAR' | 'CLOSED' {
    const now = new Date();
    const utcHours = now.getUTCHours();
    const utcMinutes = now.getUTCMinutes();
    const day = now.getUTCDay(); // 0 = Sunday, 6 = Saturday

    // 1. Weekend Check
    if (day === 0 || day === 6) {
        return 'CLOSED';
    }

    // 2. US Markets (NYSE, NASDAQ)
    // aprox. 14:30 UTC - 21:00 UTC (15:30 - 22:00 CET/CEST)
    // Simplified: Open if currency is USD and time is within window
    if (currency === 'USD') {
        const timeInMinutes = utcHours * 60 + utcMinutes;
        const openTime = 14 * 60 + 30; // 14:30 UTC
        const closeTime = 21 * 60;     // 21:00 UTC

        if (timeInMinutes >= openTime && timeInMinutes < closeTime) {
            return 'REGULAR';
        }
        return 'CLOSED';
    }

    // 3. European Markets (XETRA, SIX, LSE)
    // CHF, EUR, GBP
    // Approx 08:00 UTC - 16:30 UTC (09:00 - 17:30 CET)
    if (['CHF', 'EUR', 'GBP', 'GBp'].includes(currency)) {
        const timeInMinutes = utcHours * 60 + utcMinutes;
        const openTime = 8 * 60;       // 08:00 UTC
        const closeTime = 16 * 60 + 30; // 16:30 UTC

        if (timeInMinutes >= openTime && timeInMinutes < closeTime) {
            return 'REGULAR';
        }
        return 'CLOSED';
    }

    // Default: If we don't know, assume CLOSED to be safe (or REGULAR if you prefer optimism, but CLOSED is safer for "dots")
    // Actually, user hates Gray, so let's default to CLOSED if it's clearly night, or REGULAR if day? 
    // Let's stick to CLOSED as default fallback for unknown currencies to avoid false "Open".
    return 'CLOSED';
}
