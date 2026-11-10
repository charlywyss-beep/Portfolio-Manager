export type MarketState = 'REGULAR' | 'PRE' | 'POST' | 'CLOSED';

// Helper to convert any timezone into exact local hours, minutes, and day of week
function getLocalTimeInZone(timeZone: string, date: Date = new Date()): { hours: number; minutes: number; day: number; timeInMinutes: number } {
    try {
        const formatter = new Intl.DateTimeFormat('en-US', {
            timeZone,
            hour12: false,
            weekday: 'short',
            hour: 'numeric',
            minute: 'numeric'
        });
        const parts = formatter.formatToParts(date);
        let hours = 0;
        let minutes = 0;
        let weekdayStr = '';
        for (const p of parts) {
            if (p.type === 'hour') hours = parseInt(p.value, 10);
            if (p.type === 'minute') minutes = parseInt(p.value, 10);
            if (p.type === 'weekday') weekdayStr = p.value;
        }
        if (hours === 24) hours = 0;
        const dayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
        const day = dayMap[weekdayStr] ?? date.getDay();
        return { hours, minutes, day, timeInMinutes: hours * 60 + minutes };
    } catch {
        const d = date.getDay();
        const h = date.getUTCHours();
        const m = date.getUTCMinutes();
        return { hours: h, minutes: m, day: d, timeInMinutes: h * 60 + m };
    }
}

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

    // Good Friday
    const year = now.getUTCFullYear();
    if (year === 2024 && m === 2 && d === 29) return true;
    if (year === 2025 && m === 3 && d === 18) return true;
    if (year === 2026 && m === 3 && d === 3) return true;
    if (year === 2027 && m === 2 && d === 26) return true;

    return false;
}

export function estimateMarketState(symbol: string, currency: string, now: Date = new Date()): MarketState {
    const sym = (symbol || '').toUpperCase();
    const curr = (currency || '').toUpperCase();
    const suffix = sym.includes('.') ? sym.split('.').pop() : '';

    // 1. Krypto (24/7/365 immer geöffnet)
    if (
        sym.startsWith('BTC') ||
        sym.startsWith('ETH') ||
        sym.startsWith('SOL') ||
        sym.includes('BTC-') ||
        sym.includes('ETH-') ||
        sym.includes('SOL-')
    ) {
        return 'REGULAR';
    }

    // 2. Rohstoffe / Futures (=F)
    // CME/NYMEX/ICE Futures: Sonntag 18:00 ET bis Freitag 17:00 ET (täglich 17:00-18:00 Pause)
    if (sym.includes('=F')) {
        const { day, timeInMinutes } = getLocalTimeInZone('America/New_York', now);
        if (day === 6) return 'CLOSED'; // Samstag
        if (day === 0 && timeInMinutes < 18 * 60) return 'CLOSED'; // Sonntag vor 18:00
        if (day === 5 && timeInMinutes >= 17 * 60) return 'CLOSED'; // Freitag nach 17:00
        if (timeInMinutes >= 17 * 60 && timeInMinutes < 18 * 60) return 'PRE'; // Tägliche 1h Pause
        return 'REGULAR';
    }

    // 3. Forex / Währungen (=X)
    // Devisenhandel: Sonntag 17:00 ET bis Freitag 17:00 ET durchgehend
    if (sym.includes('=X')) {
        const { day, timeInMinutes } = getLocalTimeInZone('America/New_York', now);
        if (day === 6) return 'CLOSED';
        if (day === 0 && timeInMinutes < 17 * 60) return 'CLOSED';
        if (day === 5 && timeInMinutes >= 17 * 60) return 'CLOSED';
        return 'REGULAR';
    }

    // 4. Asiatische Indizes & Märkte
    // Japan (TSE): Nikkei 225 (^N225), .T, JPY
    // Handelszeiten JST (UTC+9): 09:00 - 15:30 (aktiver Handelstag)
    if (sym === '^N225' || suffix === 'T' || curr === 'JPY') {
        const { day, timeInMinutes } = getLocalTimeInZone('Asia/Tokyo', now);
        if (day === 0 || day === 6) return 'CLOSED';
        if (timeInMinutes < 9 * 60) return 'PRE';
        if (timeInMinutes >= 9 * 60 && timeInMinutes < 15 * 60 + 30) return 'REGULAR';
        return 'POST';
    }

    // Hongkong (HKEX): Hang Seng (^HSI), .HK, HKD
    // Handelszeiten HKT (UTC+8): 09:30 - 16:00 (aktiver Handelstag)
    if (sym === '^HSI' || suffix === 'HK' || curr === 'HKD') {
        const { day, timeInMinutes } = getLocalTimeInZone('Asia/Hong_Kong', now);
        if (day === 0 || day === 6) return 'CLOSED';
        if (timeInMinutes < 9 * 60 + 30) return 'PRE';
        if (timeInMinutes >= 9 * 60 + 30 && timeInMinutes < 16 * 60) return 'REGULAR';
        return 'POST';
    }

    // China (SSE / SZSE): Shanghai Composite (000001.SS), CSI 300 (000300.SS), .SS, .SZ, CNY
    // Handelszeiten CST (UTC+8): 09:30 - 15:00 (aktiver Handelstag)
    if (sym.startsWith('000') || suffix === 'SS' || suffix === 'SZ' || curr === 'CNY') {
        const { day, timeInMinutes } = getLocalTimeInZone('Asia/Shanghai', now);
        if (day === 0 || day === 6) return 'CLOSED';
        if (timeInMinutes < 9 * 60 + 30) return 'PRE';
        if (timeInMinutes >= 9 * 60 + 30 && timeInMinutes < 15 * 60) return 'REGULAR';
        return 'POST';
    }

    // Südkorea (KRX): Kospi (^KS11), .KS, KRW
    // Handelszeiten KST (UTC+9): 09:00 - 15:30 durchgehend
    if (sym === '^KS11' || suffix === 'KS' || curr === 'KRW') {
        const { day, timeInMinutes } = getLocalTimeInZone('Asia/Seoul', now);
        if (day === 0 || day === 6) return 'CLOSED';
        if (timeInMinutes < 9 * 60) return 'PRE';
        if (timeInMinutes >= 9 * 60 && timeInMinutes < 15 * 60 + 30) return 'REGULAR';
        return 'POST';
    }

    // Taiwan (TWSE): Taiwan Weighted (^TWII), .TW, TWD
    // Handelszeiten NST (UTC+8): 09:00 - 13:30
    if (sym === '^TWII' || suffix === 'TW' || curr === 'TWD') {
        const { day, timeInMinutes } = getLocalTimeInZone('Asia/Taipei', now);
        if (day === 0 || day === 6) return 'CLOSED';
        if (timeInMinutes < 9 * 60) return 'PRE';
        if (timeInMinutes >= 9 * 60 && timeInMinutes < 13 * 60 + 30) return 'REGULAR';
        return 'POST';
    }

    // Indien (NSE / BSE): Nifty 50 (^NSEI), Sensex (^BSESN), .NS, .BO, INR
    // Handelszeiten IST (UTC+5:30): 09:15 - 15:30
    if (sym === '^NSEI' || sym === '^BSESN' || suffix === 'NS' || suffix === 'BO' || curr === 'INR') {
        const { day, timeInMinutes } = getLocalTimeInZone('Asia/Kolkata', now);
        if (day === 0 || day === 6) return 'CLOSED';
        if (timeInMinutes < 9 * 60 + 15) return 'PRE';
        if (timeInMinutes >= 9 * 60 + 15 && timeInMinutes < 15 * 60 + 30) return 'REGULAR';
        return 'POST';
    }

    // Australien (ASX): ASX 200 (^AXJO), .AX, AUD
    // Handelszeiten Sydney (AEST/AEDT): 10:00 - 16:00
    if (sym === '^AXJO' || suffix === 'AX' || curr === 'AUD') {
        const { day, timeInMinutes } = getLocalTimeInZone('Australia/Sydney', now);
        if (day === 0 || day === 6) return 'CLOSED';
        if (timeInMinutes < 10 * 60) return 'PRE';
        if (timeInMinutes >= 10 * 60 && timeInMinutes < 16 * 60) return 'REGULAR';
        return 'POST';
    }

    // 5. Schweiz (SIX Swiss Exchange)
    // Swiss Market Index (^SSMI), .SW oder Währung CHF
    // Handelszeiten Zürich (CET/CEST): 09:00 - 17:30
    const isSwiss = sym === '^SSMI' || suffix === 'SW' || curr === 'CHF';
    if (isSwiss) {
        const { day, timeInMinutes } = getLocalTimeInZone('Europe/Zurich', now);
        if (day === 0 || day === 6) return 'CLOSED';

        const month = now.getUTCMonth();
        const date = now.getUTCDate();
        if (month === 0 && date === 1) return 'CLOSED'; // Neujahr
        if (month === 0 && date === 2) return 'CLOSED'; // Berchtoldstag
        if (month === 4 && date === 1) return 'CLOSED'; // Tag der Arbeit
        if (month === 7 && date === 1) return 'CLOSED'; // Bundesfeiertag
        if (month === 11 && date === 25) return 'CLOSED'; // Weihnachten
        if (month === 11 && date === 26) return 'CLOSED'; // Stephanstag

        if (timeInMinutes < 9 * 60) return 'PRE';
        if (timeInMinutes >= 9 * 60 && timeInMinutes < 17 * 60 + 30) return 'REGULAR';
        return 'POST';
    }

    // 6. Deutschland & Europa (Frankfurt Xetra, Euro Stoxx)
    // DAX (^GDAXI), Euro Stoxx 50 (^STOXX50E), .DE, .F, .AS, .PA, .MI, .MC
    // Handelszeiten: 09:00 - 17:30
    if (sym === '^GDAXI' || sym === '^STOXX50E' || suffix === 'DE' || ['F', 'AS', 'PA', 'MI', 'MC'].includes(suffix || '')) {
        const { day, timeInMinutes } = getLocalTimeInZone('Europe/Berlin', now);
        if (day === 0 || day === 6) return 'CLOSED';

        const month = now.getUTCMonth();
        const date = now.getUTCDate();
        if (month === 0 && date === 1) return 'CLOSED';
        if (month === 11 && date === 25) return 'CLOSED';
        if (month === 11 && date === 26) return 'CLOSED';

        if (timeInMinutes < 9 * 60) return 'PRE';
        if (timeInMinutes >= 9 * 60 && timeInMinutes < 17 * 60 + 30) return 'REGULAR';
        return 'POST';
    }

    // 7. Grossbritannien (London Stock Exchange LSE)
    // .L, GBP, GBp, FTSE 100 (^FTSE)
    // Handelszeiten London (GMT/BST): 08:00 - 16:30
    if (suffix === 'L' || curr === 'GBP' || curr === 'GBp' || symbol === '^FTSE') {
        const { day, timeInMinutes } = getLocalTimeInZone('Europe/London', now);
        if (day === 0 || day === 6) return 'CLOSED';
        if (timeInMinutes < 8 * 60) return 'PRE';
        if (timeInMinutes >= 8 * 60 && timeInMinutes < 16 * 60 + 30) return 'REGULAR';
        return 'POST';
    }

    // 8. USA (NYSE & NASDAQ)
    // Nasdaq-100 (^NDX), S&P 500 (^GSPC), Dow Jones (^DJI), USD
    // Handelszeiten New York (ET):
    // Pre-Market: 04:00 - 09:30 ET
    // Regular: 09:30 - 16:00 ET (in MEZ: 15:30 - 22:00)
    // Post-Market: 16:00 - 20:00 ET
    if (sym === '^NDX' || sym === '^GSPC' || sym === '^DJI' || curr === 'USD' || !sym.includes('.')) {
        const { day, timeInMinutes } = getLocalTimeInZone('America/New_York', now);
        if (day === 0 || day === 6) return 'CLOSED';
        if (isUSMarketHoliday(now)) return 'CLOSED';

        if (timeInMinutes < 4 * 60) return 'CLOSED';
        if (timeInMinutes >= 4 * 60 && timeInMinutes < 9 * 60 + 30) return 'PRE';
        if (timeInMinutes >= 9 * 60 + 30 && timeInMinutes < 16 * 60) return 'REGULAR';
        if (timeInMinutes >= 16 * 60 && timeInMinutes < 20 * 60) return 'POST';
        return 'CLOSED';
    }

    // 9. Fallback für EUR
    if (curr === 'EUR') {
        const { day, timeInMinutes } = getLocalTimeInZone('Europe/Berlin', now);
        if (day === 0 || day === 6) return 'CLOSED';
        if (timeInMinutes < 9 * 60) return 'PRE';
        if (timeInMinutes >= 9 * 60 && timeInMinutes < 17 * 60 + 30) return 'REGULAR';
        return 'POST';
    }

    return 'CLOSED';
}

/**
 * Checks whether an asset is a stock or ETF (as opposed to 24/7 crypto, commodities, forex).
 */
export function isStockOrEtf(symbol: string): boolean {
    const s = (symbol || '').toUpperCase();
    if (
        s.startsWith('BTC') ||
        s.startsWith('ETH') ||
        s.startsWith('SOL') ||
        s.includes('BTC-') ||
        s.includes('ETH-') ||
        s.includes('SOL-') ||
        s.includes('=F') ||
        s.includes('=X')
    ) {
        return false;
    }
    return true;
}

/**
 * Checks whether the specific market for this stock has opened today (regular session started).
 * For example:
 * - European/Swiss markets open at 09:00 CET.
 * - US markets open at 09:30 ET (15:30 CET).
 * On a trading day before the regular market open (e.g. US stocks at 10:00 CET),
 * this returns false, meaning yesterday's closing change must not be counted as today's live gain.
 */
export function hasMarketOpenedToday(symbol: string, currency: string, now: Date = new Date()): boolean {
    const sym = (symbol || '').toUpperCase();
    const curr = (currency || '').toUpperCase();
    const suffix = sym.includes('.') ? sym.split('.').pop() : '';

    // 1. Krypto (24/7)
    if (
        sym.startsWith('BTC') ||
        sym.startsWith('ETH') ||
        sym.startsWith('SOL') ||
        sym.includes('BTC-') ||
        sym.includes('ETH-') ||
        sym.includes('SOL-')
    ) {
        return true;
    }

    // 2. Rohstoffe / Futures (=F)
    if (sym.includes('=F')) {
        const { day, timeInMinutes } = getLocalTimeInZone('America/New_York', now);
        if (day === 6) return false;
        if (day === 0 && timeInMinutes < 18 * 60) return false;
        if (day === 5 && timeInMinutes >= 17 * 60) return false;
        return true;
    }

    // 3. Forex (=X)
    if (sym.includes('=X')) {
        const { day, timeInMinutes } = getLocalTimeInZone('America/New_York', now);
        if (day === 6) return false;
        if (day === 0 && timeInMinutes < 17 * 60) return false;
        if (day === 5 && timeInMinutes >= 17 * 60) return false;
        return true;
    }

    // 4. Asien
    if (sym === '^N225' || suffix === 'T' || curr === 'JPY') {
        const { day, timeInMinutes } = getLocalTimeInZone('Asia/Tokyo', now);
        if (day === 0 || day === 6) return false;
        return timeInMinutes >= 9 * 60;
    }
    if (sym === '^HSI' || suffix === 'HK' || curr === 'HKD') {
        const { day, timeInMinutes } = getLocalTimeInZone('Asia/Hong_Kong', now);
        if (day === 0 || day === 6) return false;
        return timeInMinutes >= 9 * 60 + 30;
    }
    if (sym.startsWith('000') || suffix === 'SS' || suffix === 'SZ' || curr === 'CNY') {
        const { day, timeInMinutes } = getLocalTimeInZone('Asia/Shanghai', now);
        if (day === 0 || day === 6) return false;
        return timeInMinutes >= 9 * 60 + 30;
    }
    if (sym === '^KS11' || suffix === 'KS' || curr === 'KRW') {
        const { day, timeInMinutes } = getLocalTimeInZone('Asia/Seoul', now);
        if (day === 0 || day === 6) return false;
        return timeInMinutes >= 9 * 60;
    }
    if (sym === '^TWII' || suffix === 'TW' || curr === 'TWD') {
        const { day, timeInMinutes } = getLocalTimeInZone('Asia/Taipei', now);
        if (day === 0 || day === 6) return false;
        return timeInMinutes >= 9 * 60;
    }
    if (sym === '^NSEI' || sym === '^BSESN' || suffix === 'NS' || suffix === 'BO' || curr === 'INR') {
        const { day, timeInMinutes } = getLocalTimeInZone('Asia/Kolkata', now);
        if (day === 0 || day === 6) return false;
        return timeInMinutes >= 9 * 60 + 15;
    }
    if (sym === '^AXJO' || suffix === 'AX' || curr === 'AUD') {
        const { day, timeInMinutes } = getLocalTimeInZone('Australia/Sydney', now);
        if (day === 0 || day === 6) return false;
        return timeInMinutes >= 10 * 60;
    }

    // 5. Schweiz (SIX) - Handelszeiten 09:00 - 17:30 CET
    const isSwiss = sym === '^SSMI' || suffix === 'SW' || curr === 'CHF';
    if (isSwiss) {
        const { day, timeInMinutes } = getLocalTimeInZone('Europe/Zurich', now);
        if (day === 0 || day === 6) return false;
        const month = now.getUTCMonth();
        const date = now.getUTCDate();
        if (month === 0 && (date === 1 || date === 2)) return false;
        if (month === 4 && date === 1) return false;
        if (month === 7 && date === 1) return false;
        if (month === 11 && (date === 25 || date === 26)) return false;
        return timeInMinutes >= 9 * 60;
    }

    // 6. Deutschland & Europa (Frankfurt XETRA, Euronext) - Handelszeiten 09:00 - 17:30 CET
    if (sym === '^GDAXI' || sym === '^STOXX50E' || suffix === 'DE' || ['F', 'AS', 'PA', 'MI', 'MC'].includes(suffix || '')) {
        const { day, timeInMinutes } = getLocalTimeInZone('Europe/Berlin', now);
        if (day === 0 || day === 6) return false;
        const month = now.getUTCMonth();
        const date = now.getUTCDate();
        if (month === 0 && date === 1) return false;
        if (month === 11 && (date === 25 || date === 26)) return false;
        return timeInMinutes >= 9 * 60;
    }

    // 7. Grossbritannien (London Stock Exchange LSE) - Handelszeiten 08:00 - 16:30 GMT (09:00 - 17:30 CET)
    if (suffix === 'L' || curr === 'GBP' || curr === 'GBp' || symbol === '^FTSE') {
        const { day, timeInMinutes } = getLocalTimeInZone('Europe/London', now);
        if (day === 0 || day === 6) return false;
        return timeInMinutes >= 8 * 60;
    }

    // 8. USA (NYSE & NASDAQ) - Handelszeiten 09:30 - 16:00 ET (15:30 - 22:00 MEZ)
    if (sym === '^NDX' || sym === '^GSPC' || sym === '^DJI' || curr === 'USD' || !sym.includes('.')) {
        const { day, timeInMinutes } = getLocalTimeInZone('America/New_York', now);
        if (day === 0 || day === 6) return false;
        if (isUSMarketHoliday(now)) return false;
        return timeInMinutes >= 9 * 60 + 30;
    }

    // 9. Fallback EUR
    if (curr === 'EUR') {
        const { day, timeInMinutes } = getLocalTimeInZone('Europe/Berlin', now);
        if (day === 0 || day === 6) return false;
        return timeInMinutes >= 9 * 60;
    }

    return false;
}

/**
 * Checks whether ANY equity market in the provided stock list has opened today.
 * If true, today's trading day has begun (e.g. 09:00 CET European open).
 * If false (e.g. at 06:00 CET before European open or on weekends), no market has opened today yet.
 */
export function isAnyStockMarketActiveToday(
    stocks: { symbol: string; currency: string }[],
    now: Date = new Date()
): boolean {
    const equityStocks = stocks.filter(s => isStockOrEtf(s.symbol));
    const list = equityStocks.length > 0 ? equityStocks : stocks;
    return list.some(s => hasMarketOpenedToday(s.symbol, s.currency, now));
}

/**
 * Returns a human-friendly hint of when the market will open today.
 */
export function getMarketOpeningTimeHint(symbol: string, currency: string): string {
    const sym = (symbol || '').toUpperCase();
    const curr = (currency || '').toUpperCase();
    const suffix = sym.includes('.') ? sym.split('.').pop() : '';

    if (suffix === 'L' || curr === 'GBP' || curr === 'GBp') {
        return 'Börse öffnet um 09:00 Uhr MEZ (LSE)';
    }
    if (sym === '^NDX' || sym === '^GSPC' || sym === '^DJI' || curr === 'USD' || !sym.includes('.')) {
        return 'Börse öffnet um 15:30 Uhr MEZ (US)';
    }
    if (sym === '^SSMI' || suffix === 'SW' || curr === 'CHF') {
        return 'Börse öffnet um 09:00 Uhr (SIX)';
    }
    if (curr === 'EUR' || suffix === 'DE' || ['F', 'AS', 'PA', 'MI', 'MC'].includes(suffix || '')) {
        return 'Börse öffnet um 09:00 Uhr (EU)';
    }
    return 'Börse noch geschlossen';
}
