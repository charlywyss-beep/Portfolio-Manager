import type { Stock } from '../types';

export interface CountryTaxInfo {
    countryCode: string;
    countryName: string;
    flag: string;
    rate: number;
    description: string;
}

export const COUNTRY_TAX_RATES: Record<string, CountryTaxInfo> = {
    US: {
        countryCode: 'US',
        countryName: 'USA',
        flag: '🇺🇸',
        rate: 15,
        description: '15% mit W-8BEN (30% ohne W-8BEN)'
    },
    CH: {
        countryCode: 'CH',
        countryName: 'Schweiz',
        flag: '🇨🇭',
        rate: 35,
        description: '35% Eidg. Verrechnungssteuer (100% rückforderbar)'
    },
    GB: {
        countryCode: 'GB',
        countryName: 'Grossbritannien',
        flag: '🇬🇧',
        rate: 0,
        description: '0% Quellensteuer auf Dividenden'
    },
    IE: {
        countryCode: 'IE',
        countryName: 'Irland',
        flag: '🇮🇪',
        rate: 0,
        description: '0% Quellensteuer auf UCITS ETFs / Fonds'
    },
    DE: {
        countryCode: 'DE',
        countryName: 'Deutschland',
        flag: '🇩🇪',
        rate: 26.375,
        description: '26.375% (25% KapESt + 5.5% Soli)'
    },
    FR: {
        countryCode: 'FR',
        countryName: 'Frankreich',
        flag: '🇫🇷',
        rate: 25,
        description: '25% (bzw. 12.8% mit Vorabbefreiung)'
    },
    CA: {
        countryCode: 'CA',
        countryName: 'Kanada',
        flag: '🇨🇦',
        rate: 15,
        description: '15% (mit DBA, sonst 25%)'
    },
    NL: {
        countryCode: 'NL',
        countryName: 'Niederlande',
        flag: '🇳🇱',
        rate: 15,
        description: '15% Dividendensteuer'
    },
    DK: {
        countryCode: 'DK',
        countryName: 'Dänemark',
        flag: '🇩🇰',
        rate: 27,
        description: '27% Quellensteuer'
    },
    ES: {
        countryCode: 'ES',
        countryName: 'Spanien',
        flag: '🇪🇸',
        rate: 19,
        description: '19% Quellensteuer'
    },
    IT: {
        countryCode: 'IT',
        countryName: 'Italien',
        flag: '🇮🇹',
        rate: 26,
        description: '26% Quellensteuer'
    },
    BR: {
        countryCode: 'BR',
        countryName: 'Brasilien',
        flag: '🇧🇷',
        rate: 0,
        description: '0% auf Dividenden (JCP 15%)'
    },
    AU: {
        countryCode: 'AU',
        countryName: 'Australien',
        flag: '🇦🇺',
        rate: 0,
        description: '0% auf voll frankierte Dividenden'
    },
    JP: {
        countryCode: 'JP',
        countryName: 'Japan',
        flag: '🇯🇵',
        rate: 15.315,
        description: '15.315% Quellensteuer'
    }
};

/**
 * Detect country ISO code from stock's ISIN, country string, or symbol.
 */
export function detectStockCountry(stock?: Partial<Stock> | null): string {
    if (!stock) return 'OTHER';

    // 1. ISIN prefix (first 2 uppercase letters)
    if (stock.isin && stock.isin.length >= 2) {
        const prefix = stock.isin.trim().slice(0, 2).toUpperCase();
        if (COUNTRY_TAX_RATES[prefix]) return prefix;
        if (prefix === 'CH' || prefix === 'US' || prefix === 'DE' || prefix === 'GB' || prefix === 'IE') return prefix;
    }

    // 2. Country name string
    const c = (stock.country || '').toLowerCase().trim();
    if (['usa', 'us', 'united states', 'vereinigte staaten'].includes(c)) return 'US';
    if (['schweiz', 'switzerland', 'ch', 'swiss'].includes(c)) return 'CH';
    if (['grossbritannien', 'großbritannien', 'uk', 'united kingdom', 'britain'].includes(c)) return 'GB';
    if (['irland', 'ireland', 'ie'].includes(c)) return 'IE';
    if (['deutschland', 'germany', 'de'].includes(c)) return 'DE';
    if (['frankreich', 'france', 'fr'].includes(c)) return 'FR';
    if (['kanada', 'canada', 'ca'].includes(c)) return 'CA';
    if (['niederlande', 'netherlands', 'nl', 'holland'].includes(c)) return 'NL';
    if (['dänemark', 'daenemark', 'denmark', 'dk'].includes(c)) return 'DK';
    if (['spanien', 'spain', 'es'].includes(c)) return 'ES';
    if (['italien', 'italy', 'it'].includes(c)) return 'IT';
    if (['brasilien', 'brazil', 'br'].includes(c)) return 'BR';
    if (['australien', 'australia', 'au'].includes(c)) return 'AU';
    if (['japan', 'jp'].includes(c)) return 'JP';

    // 3. Symbol suffix
    const sym = (stock.symbol || '').toUpperCase();
    if (sym.endsWith('.SW')) return 'CH';
    if (sym.endsWith('.DE') || sym.endsWith('.F')) return 'DE';
    if (sym.endsWith('.L')) return 'GB';
    if (sym.endsWith('.PA')) return 'FR';
    if (sym.endsWith('.AS')) return 'NL';
    if (sym.endsWith('.CO')) return 'DK';
    if (sym.endsWith('.MC')) return 'ES';
    if (sym.endsWith('.MI')) return 'IT';
    if (sym.endsWith('.TO')) return 'CA';

    // 4. Currency heuristic
    if (stock.currency === 'USD') return 'US';
    if (stock.currency === 'CHF') return 'CH';
    if (stock.currency === 'GBP' || stock.currency === 'GBp') return 'GB';

    return 'OTHER';
}

/**
 * Returns the effective withholding tax rate in percent (e.g. 15, 30, 35, 0).
 */
export function getWithholdingTaxRate(stock?: Partial<Stock> | null): number {
    if (!stock) return 0;

    // Explicit override set by user on the stock
    if (typeof stock.withholdingTaxRate === 'number' && !isNaN(stock.withholdingTaxRate)) {
        return Math.max(0, Math.min(100, stock.withholdingTaxRate));
    }

    const countryCode = detectStockCountry(stock);
    const info = COUNTRY_TAX_RATES[countryCode];
    return info ? info.rate : 0;
}
