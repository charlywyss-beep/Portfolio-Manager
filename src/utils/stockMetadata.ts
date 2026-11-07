import type { Stock } from '../types';
import { getFallbackAllocation } from '../data/fallbackAllocations';
import { translateSector } from './sectorTranslation';

interface KnownMetadata {
    country: string;
    sector: string;
    type?: 'stock' | 'etf';
}

const KNOWN_STOCK_METADATA: Record<string, KnownMetadata> = {
    // Schweiz (SMI / SPI)
    'NESN.SW': { country: 'Schweiz', sector: 'Nicht-zykl. Konsum' },
    'NOVN.SW': { country: 'Schweiz', sector: 'Gesundheitswesen' },
    'ROG.SW': { country: 'Schweiz', sector: 'Gesundheitswesen' },
    'ZURN.SW': { country: 'Schweiz', sector: 'Finanzdienstleistungen' },
    'SREN.SW': { country: 'Schweiz', sector: 'Finanzdienstleistungen' },
    'SLHN.SW': { country: 'Schweiz', sector: 'Finanzdienstleistungen' },
    'SCMN.SW': { country: 'Schweiz', sector: 'Kommunikation' },
    'SUNN.SW': { country: 'Schweiz', sector: 'Kommunikation' },
    'UBSG.SW': { country: 'Schweiz', sector: 'Finanzdienstleistungen' },
    'ABBN.SW': { country: 'Schweiz', sector: 'Industrie' },
    'HOLN.SW': { country: 'Schweiz', sector: 'Rohstoffe' },
    'SIKA.SW': { country: 'Schweiz', sector: 'Rohstoffe' },
    'GIVN.SW': { country: 'Schweiz', sector: 'Rohstoffe' },
    'LONN.SW': { country: 'Schweiz', sector: 'Gesundheitswesen' },
    'PGHN.SW': { country: 'Schweiz', sector: 'Finanzdienstleistungen' },
    'CFR.SW': { country: 'Schweiz', sector: 'Zykl. Konsumgüter' },
    'UHR.SW': { country: 'Schweiz', sector: 'Zykl. Konsumgüter' },
    'GEBN.SW': { country: 'Schweiz', sector: 'Industrie' },
    'KNIN.SW': { country: 'Schweiz', sector: 'Industrie' },
    'BALN.SW': { country: 'Schweiz', sector: 'Finanzdienstleistungen' },
    'helN.SW': { country: 'Schweiz', sector: 'Finanzdienstleistungen' },

    // Grossbritannien
    'BATS.L': { country: 'Grossbritannien', sector: 'Tabak' },
    'BTI': { country: 'Grossbritannien', sector: 'Tabak' },
    'RIO.L': { country: 'Grossbritannien', sector: 'Rohstoffe' },
    'RIO': { country: 'Grossbritannien', sector: 'Rohstoffe' },
    'LGEN.L': { country: 'Grossbritannien', sector: 'Finanzdienstleistungen' },
    'SHEL.L': { country: 'Grossbritannien', sector: 'Energie' },
    'SHEL': { country: 'Grossbritannien', sector: 'Energie' },
    'R6C0.DE': { country: 'Grossbritannien', sector: 'Energie' },
    'BP.L': { country: 'Grossbritannien', sector: 'Energie' },
    'ULVR.L': { country: 'Grossbritannien', sector: 'Nicht-zykl. Konsum' },
    'GSK.L': { country: 'Grossbritannien', sector: 'Gesundheitswesen' },
    'AZN.L': { country: 'Grossbritannien', sector: 'Gesundheitswesen' },
    'HSBA.L': { country: 'Grossbritannien', sector: 'Finanzdienstleistungen' },
    'NG.L': { country: 'Grossbritannien', sector: 'Versorger' },

    // Frankreich
    'TOTBD.XD': { country: 'Frankreich', sector: 'Energie' },
    'TTE.PA': { country: 'Frankreich', sector: 'Energie' },
    'TTE': { country: 'Frankreich', sector: 'Energie' },
    'CS.PA': { country: 'Frankreich', sector: 'Finanzdienstleistungen' },
    'DG.PA': { country: 'Frankreich', sector: 'Industrie' },
    'RMS.PA': { country: 'Frankreich', sector: 'Zykl. Konsumgüter' },
    'MC.PA': { country: 'Frankreich', sector: 'Zykl. Konsumgüter' },
    'MOH.F': { country: 'Frankreich', sector: 'Zykl. Konsumgüter' },
    'OR.PA': { country: 'Frankreich', sector: 'Nicht-zykl. Konsum' },
    'SAN.PA': { country: 'Frankreich', sector: 'Gesundheitswesen' },
    'SU.PA': { country: 'Frankreich', sector: 'Industrie' },
    'AIR.PA': { country: 'Frankreich', sector: 'Industrie' },
    'BNP.PA': { country: 'Frankreich', sector: 'Finanzdienstleistungen' },

    // Deutschland
    'MUV2.DE': { country: 'Deutschland', sector: 'Finanzdienstleistungen' },
    'ALV.DE': { country: 'Deutschland', sector: 'Finanzdienstleistungen' },
    'SIE.DE': { country: 'Deutschland', sector: 'Industrie' },
    'SAP.DE': { country: 'Deutschland', sector: 'Technologie' },
    'SAP': { country: 'Deutschland', sector: 'Technologie' },
    'DTE.DE': { country: 'Deutschland', sector: 'Kommunikation' },
    'PAH3.DE': { country: 'Deutschland', sector: 'Zykl. Konsumgüter' },
    'MBG.DE': { country: 'Deutschland', sector: 'Zykl. Konsumgüter' },
    'BMW.DE': { country: 'Deutschland', sector: 'Zykl. Konsumgüter' },
    'VOW3.DE': { country: 'Deutschland', sector: 'Zykl. Konsumgüter' },
    'BAS.DE': { country: 'Deutschland', sector: 'Rohstoffe' },
    'DHL.DE': { country: 'Deutschland', sector: 'Industrie' },

    // Niederlande / Skandinavien / Übriges Europa & International
    'ASML.AS': { country: 'Niederlande', sector: 'Technologie' },
    'ASML': { country: 'Niederlande', sector: 'Technologie' },
    '8ZI.F': { country: 'Dänemark', sector: 'Tabak' },
    'NVO': { country: 'Dänemark', sector: 'Gesundheitswesen' },
    'NOVOB.CO': { country: 'Dänemark', sector: 'Gesundheitswesen' },
    'DEVL.F': { country: 'Singapur', sector: 'Finanzdienstleistungen' },
    'D05.SI': { country: 'Singapur', sector: 'Finanzdienstleistungen' },
    'KSPI': { country: 'Kasachstan', sector: 'Finanzdienstleistungen' },
    'PBR': { country: 'Brasilien', sector: 'Energie' },

    // USA
    'BRK-B': { country: 'USA', sector: 'Finanzdienstleistungen' },
    'BRK.B': { country: 'USA', sector: 'Finanzdienstleistungen' },
    'PEP': { country: 'USA', sector: 'Nicht-zykl. Konsum' },
    'KO': { country: 'USA', sector: 'Nicht-zykl. Konsum' },
    'GIS': { country: 'USA', sector: 'Nicht-zykl. Konsum' },
    'KHC': { country: 'USA', sector: 'Nicht-zykl. Konsum' },
    'MO': { country: 'USA', sector: 'Tabak' },
    'PM': { country: 'USA', sector: 'Tabak' },
    'PG': { country: 'USA', sector: 'Nicht-zykl. Konsum' },
    'WMT': { country: 'USA', sector: 'Nicht-zykl. Konsum' },
    'COST': { country: 'USA', sector: 'Nicht-zykl. Konsum' },
    'CVX': { country: 'USA', sector: 'Energie' },
    'XOM': { country: 'USA', sector: 'Energie' },
    'COP': { country: 'USA', sector: 'Energie' },
    'O': { country: 'USA', sector: 'Immobilien' },
    'JPM': { country: 'USA', sector: 'Finanzdienstleistungen' },
    'V': { country: 'USA', sector: 'Finanzdienstleistungen' },
    'MA': { country: 'USA', sector: 'Finanzdienstleistungen' },
    'PYPL': { country: 'USA', sector: 'Finanzdienstleistungen' },
    'NVDA': { country: 'USA', sector: 'Technologie' },
    'AAPL': { country: 'USA', sector: 'Technologie' },
    'MSFT': { country: 'USA', sector: 'Technologie' },
    'TXN': { country: 'USA', sector: 'Technologie' },
    'AVGO': { country: 'USA', sector: 'Technologie' },
    'GOOG': { country: 'USA', sector: 'Kommunikation' },
    'GOOGL': { country: 'USA', sector: 'Kommunikation' },
    'ABEA.DE': { country: 'USA', sector: 'Kommunikation' },
    'ABEC.DE': { country: 'USA', sector: 'Kommunikation' },
    'ABEA.F': { country: 'USA', sector: 'Kommunikation' },
    'ABEC.F': { country: 'USA', sector: 'Kommunikation' },
    'MSF.DE': { country: 'USA', sector: 'Technologie' },
    'MSF.F': { country: 'USA', sector: 'Technologie' },
    'APC.DE': { country: 'USA', sector: 'Technologie' },
    'APC.F': { country: 'USA', sector: 'Technologie' },
    'NVD.DE': { country: 'USA', sector: 'Technologie' },
    'NVD.F': { country: 'USA', sector: 'Technologie' },
    'AMZ.DE': { country: 'USA', sector: 'Zykl. Konsumgüter' },
    'AMZ.F': { country: 'USA', sector: 'Zykl. Konsumgüter' },
    'FB2A.DE': { country: 'USA', sector: 'Kommunikation' },
    'FB2A.F': { country: 'USA', sector: 'Kommunikation' },
    'TL0.DE': { country: 'USA', sector: 'Zykl. Konsumgüter' },
    'TL0.F': { country: 'USA', sector: 'Zykl. Konsumgüter' },
    'BRYN.DE': { country: 'USA', sector: 'Finanzdienstleistungen' },
    'BRYN.F': { country: 'USA', sector: 'Finanzdienstleistungen' },
    'CCC3.DE': { country: 'USA', sector: 'Nicht-zykl. Konsum' },
    'PEP.DE': { country: 'USA', sector: 'Nicht-zykl. Konsum' },
    'PEP.F': { country: 'USA', sector: 'Nicht-zykl. Konsum' },
    'META': { country: 'USA', sector: 'Kommunikation' },
    'AMZN': { country: 'USA', sector: 'Zykl. Konsumgüter' },
    'TSLA': { country: 'USA', sector: 'Zykl. Konsumgüter' },
    'MCD': { country: 'USA', sector: 'Zykl. Konsumgüter' },
    'HD': { country: 'USA', sector: 'Zykl. Konsumgüter' },
    'JNJ': { country: 'USA', sector: 'Gesundheitswesen' },
    'ABBV': { country: 'USA', sector: 'Gesundheitswesen' },
    'LLY': { country: 'USA', sector: 'Gesundheitswesen' },
    'UNH': { country: 'USA', sector: 'Gesundheitswesen' }
};

const ISIN_COUNTRY_PREFIX: Record<string, string> = {
    'CH': 'Schweiz',
    'LI': 'Schweiz',
    'US': 'USA',
    'GB': 'Grossbritannien',
    'JE': 'Grossbritannien',
    'GG': 'Grossbritannien',
    'FR': 'Frankreich',
    'DE': 'Deutschland',
    'NL': 'Niederlande',
    'DK': 'Dänemark',
    'SE': 'Schweden',
    'NO': 'Norwegen',
    'FI': 'Finnland',
    'IT': 'Italien',
    'ES': 'Spanien',
    'AT': 'Österreich',
    'BE': 'Belgien',
    'PT': 'Portugal',
    'CA': 'Kanada',
    'JP': 'Japan',
    'AU': 'Australien',
    'SG': 'Singapur',
    'HK': 'Hongkong',
    'CN': 'China',
    'TW': 'Taiwan',
    'KR': 'Südkorea',
    'IN': 'Indien',
    'BR': 'Brasilien',
    'KZ': 'Kasachstan',
    'ZA': 'Südafrika'
};

const TICKER_SUFFIX_COUNTRY: Record<string, string> = {
    'SW': 'Schweiz',
    'VX': 'Schweiz',
    'PA': 'Frankreich',
    'DE': 'Deutschland',
    'L': 'Grossbritannien',
    'AS': 'Niederlande',
    'CO': 'Dänemark',
    'ST': 'Schweden',
    'OL': 'Norwegen',
    'HE': 'Finnland',
    'MI': 'Italien',
    'MC': 'Spanien',
    'VI': 'Österreich',
    'BR': 'Belgien',
    'TO': 'Kanada',
    'T': 'Japan',
    'AX': 'Australien',
    'SI': 'Singapur',
    'HK': 'Hongkong',
    'SA': 'Brasilien'
};

export function normalizeCountryName(country?: string | null): string {
    if (!country) return 'Unbekannt';
    const c = country.toLowerCase().trim();
    if (!c || c === 'unbekannt' || c === 'unknown') return 'Unbekannt';
    if (['switzerland', 'schweiz', 'ch'].includes(c)) return 'Schweiz';
    if (['united states', 'usa', 'us', 'vereinigte staaten', 'united states of america'].includes(c)) return 'USA';
    if (['germany', 'deutschland', 'de'].includes(c)) return 'Deutschland';
    if (['united kingdom', 'uk', 'britain', 'großbritannien', 'grossbritannien', 'england'].includes(c)) return 'Grossbritannien';
    if (['france', 'frankreich', 'fr'].includes(c)) return 'Frankreich';
    if (['ireland', 'irland', 'ie'].includes(c)) return 'Irland';
    if (['netherlands', 'niederlande', 'the netherlands', 'nl'].includes(c)) return 'Niederlande';
    if (['denmark', 'dänemark', 'dk'].includes(c)) return 'Dänemark';
    if (['sweden', 'schweden', 'se'].includes(c)) return 'Schweden';
    if (['norway', 'norwegen', 'no'].includes(c)) return 'Norwegen';
    if (['finland', 'finnland', 'fi'].includes(c)) return 'Finnland';
    if (['italy', 'italien', 'it'].includes(c)) return 'Italien';
    if (['spain', 'spanien', 'es'].includes(c)) return 'Spanien';
    if (['austria', 'österreich', 'at'].includes(c)) return 'Österreich';
    if (['belgium', 'belgien', 'be'].includes(c)) return 'Belgien';
    if (['portugal', 'pt'].includes(c)) return 'Portugal';
    if (['canada', 'kanada', 'ca'].includes(c)) return 'Kanada';
    if (['japan', 'jp'].includes(c)) return 'Japan';
    if (['china', 'cn'].includes(c)) return 'China';
    if (['taiwan', 'tw'].includes(c)) return 'Taiwan';
    if (['india', 'indien', 'in'].includes(c)) return 'Indien';
    if (['australia', 'australien', 'au'].includes(c)) return 'Australien';
    if (['singapore', 'singapur', 'sg'].includes(c)) return 'Singapur';
    if (['hong kong', 'hongkong', 'hk'].includes(c)) return 'Hongkong';
    if (['korea', 'südkorea', 'south korea', 'kr'].includes(c)) return 'Südkorea';
    if (['brazil', 'brasilien', 'br'].includes(c)) return 'Brasilien';
    if (['kazakhstan', 'kasachstan', 'kz'].includes(c)) return 'Kasachstan';
    if (['south africa', 'südafrika', 'za'].includes(c)) return 'Südafrika';
    if (['world', 'welt', 'global', 'international'].includes(c)) return 'Welt';
    if (['eurozone', 'europa'].includes(c)) return 'Eurozone';
    if (['other', 'andere', 'übrige', 'übrige länder'].includes(c)) return 'Übrige Länder';

    return country.charAt(0).toUpperCase() + country.slice(1);
}

/**
 * Maps fine-grained industries (e.g. "Tabak", "Konsum", "Rückversicherung", "Minen")
 * to unified macro sectors so AssetAllocationChart and RiskAnalysisCard speak the same language.
 */
export function normalizeMacroSector(sector?: string | null): string {
    if (!sector) return 'Andere';
    const raw = sector.trim();
    if (!raw || raw === 'Simuliert') return 'Andere';

    const translated = translateSector(raw);
    const s = translated.toLowerCase();

    if (
        s.includes('nicht-zykl') ||
        s.includes('basiskonsum') ||
        s === 'konsum' ||
        s === 'konsumgüter' ||
        s.includes('lebensmittel') ||
        s.includes('getränke') ||
        s.includes('tabak') ||
        s.includes('haushalt') ||
        s.includes('süsswaren') ||
        s.includes('brauereien') ||
        s.includes('spirituosen') ||
        s === 'consumer_defensive' ||
        s === 'consumer defensive' ||
        s === 'consumer staples'
    ) {
        return 'Nicht-zykl. Konsum';
    }

    if (
        s.includes('zykl') ||
        s.includes('automobil') ||
        s.includes('luxus') ||
        s.includes('bekleidung') ||
        s.includes('restaurants') ||
        s.includes('einzelhandel') ||
        s === 'consumer_cyclical' ||
        s === 'consumer cyclical' ||
        s === 'consumer discretionary'
    ) {
        return 'Zykl. Konsumgüter';
    }

    if (
        s.includes('finanz') ||
        s.includes('versicherung') ||
        s.includes('rückversicherung') ||
        s.includes('bank') ||
        s.includes('holding') ||
        s.includes('vermögensverwaltung') ||
        s === 'financial_services' ||
        s === 'financial services' ||
        s === 'financials'
    ) {
        return 'Finanzdienstleistungen';
    }

    if (
        s.includes('technolog') ||
        s.includes('halbleiter') ||
        s.includes('software') ||
        s.includes('hardware') ||
        s.includes('it-dienst') ||
        s.includes('unterhaltungselektronik')
    ) {
        return 'Technologie';
    }

    if (
        s.includes('gesundheit') ||
        s.includes('pharma') ||
        s.includes('biotech') ||
        s.includes('medizintechnik') ||
        s.includes('diagnostik') ||
        s === 'healthcare'
    ) {
        return 'Gesundheitswesen';
    }

    if (
        s.includes('energie') ||
        s.includes('öl') ||
        s.includes('raffinerie') ||
        s === 'energy'
    ) {
        return 'Energie';
    }

    if (
        s.includes('rohstoff') ||
        s.includes('minen') ||
        s.includes('bergbau') ||
        s.includes('chemie') ||
        s.includes('baustoff') ||
        s.includes('stahl') ||
        s.includes('kupfer') ||
        s.includes('edelmetall') ||
        s === 'basic_materials' ||
        s === 'materials'
    ) {
        return 'Rohstoffe';
    }

    if (
        s.includes('industrie') ||
        s.includes('logistik') ||
        s.includes('luftfahrt') ||
        s.includes('eisenbahn') ||
        s.includes('entsorgung') ||
        s.includes('mischkonzern') ||
        s === 'industrials'
    ) {
        return 'Industrie';
    }

    if (
        s.includes('kommunikation') ||
        s.includes('telekom') ||
        s.includes('medien') ||
        s.includes('unterhaltung') ||
        s === 'communication_services' ||
        s === 'communication services'
    ) {
        return 'Kommunikation';
    }

    if (
        s.includes('versorger') ||
        s.includes('stromversorger') ||
        s.includes('wasserversorger') ||
        s.includes('erneuerbare') ||
        s === 'utilities'
    ) {
        return 'Versorger';
    }

    if (
        s.includes('immobilien') ||
        s.includes('reit') ||
        s === 'realestate' ||
        s === 'real estate'
    ) {
        return 'Immobilien';
    }

    return translated;
}

export function isLikelyEtf(stock: Pick<Stock, 'type' | 'symbol' | 'name' | 'isin'>): boolean {
    if (stock.type === 'etf') return true;
    if (getFallbackAllocation(stock)) return true;

    const name = (stock.name || '').toLowerCase();
    const sym = (stock.symbol || '').toUpperCase();
    if (
        /\b(etf|ucits|ishares|vanguard|spdr|vaneck|invesco|xtrackers|amundi|lyxor|wisdomtree|sprott)\b/i.test(name) ||
        ['VOO', 'QQQ', 'SCHD', 'URNM', 'VNQ', 'JEPI', 'JEPQ'].includes(sym)
    ) {
        return true;
    }
    return false;
}

const KNOWN_NAME_METADATA: Array<{ pattern: RegExp; meta: KnownMetadata }> = [
    { pattern: /\balphabet\b/i, meta: { country: 'USA', sector: 'Kommunikation' } },
    { pattern: /\bgoogle\b/i, meta: { country: 'USA', sector: 'Kommunikation' } },
    { pattern: /\bmicrosoft\b/i, meta: { country: 'USA', sector: 'Technologie' } },
    { pattern: /\bnvidia\b/i, meta: { country: 'USA', sector: 'Technologie' } },
    { pattern: /\bapple\b/i, meta: { country: 'USA', sector: 'Technologie' } },
    { pattern: /\bamazon\b/i, meta: { country: 'USA', sector: 'Zykl. Konsumgüter' } },
    { pattern: /\bmeta platforms\b/i, meta: { country: 'USA', sector: 'Kommunikation' } },
    { pattern: /\btesla\b/i, meta: { country: 'USA', sector: 'Zykl. Konsumgüter' } },
    { pattern: /\bberkshire hathaway\b/i, meta: { country: 'USA', sector: 'Finanzdienstleistungen' } },
    { pattern: /\bpepsico\b/i, meta: { country: 'USA', sector: 'Nicht-zykl. Konsum' } },
    { pattern: /\bcoca-cola\b|\bcoca cola\b/i, meta: { country: 'USA', sector: 'Nicht-zykl. Konsum' } },
    { pattern: /\bgeneral mills\b/i, meta: { country: 'USA', sector: 'Nicht-zykl. Konsum' } },
    { pattern: /\bkraft heinz\b/i, meta: { country: 'USA', sector: 'Nicht-zykl. Konsum' } },
    { pattern: /\baltria\b|\bphilip morris\b/i, meta: { country: 'USA', sector: 'Tabak' } },
    { pattern: /\brealty income\b/i, meta: { country: 'USA', sector: 'Immobilien' } },
    { pattern: /\bchevron\b|\bconocophillips\b|\bconoco phillips\b|\bexxon\b/i, meta: { country: 'USA', sector: 'Energie' } },
    { pattern: /\bjp\s*morgan\b|\bjpmorgan\b|\bpaypal\b/i, meta: { country: 'USA', sector: 'Finanzdienstleistungen' } },
    { pattern: /\btexas instruments\b|\bbroadcom\b/i, meta: { country: 'USA', sector: 'Technologie' } },
    { pattern: /\btotalenergies\b|\btotal energies\b/i, meta: { country: 'Frankreich', sector: 'Energie' } },
    { pattern: /\blvmh\b|\bhermes\b|\bhermès\b/i, meta: { country: 'Frankreich', sector: 'Zykl. Konsumgüter' } },
    { pattern: /\bvinci\b/i, meta: { country: 'Frankreich', sector: 'Industrie' } },
    { pattern: /\baxa\b/i, meta: { country: 'Frankreich', sector: 'Finanzdienstleistungen' } },
    { pattern: /\bshell\b/i, meta: { country: 'Grossbritannien', sector: 'Energie' } },
    { pattern: /\brio tinto\b/i, meta: { country: 'Grossbritannien', sector: 'Rohstoffe' } },
    { pattern: /\bbritish american tobacco\b|^bat$/i, meta: { country: 'Grossbritannien', sector: 'Tabak' } },
    { pattern: /\blegal\s*&\s*general\b/i, meta: { country: 'Grossbritannien', sector: 'Finanzdienstleistungen' } },
    { pattern: /\bnestl[eé]\b/i, meta: { country: 'Schweiz', sector: 'Nicht-zykl. Konsum' } },
    { pattern: /\bzurich\b|\bzürich versicherung\b|\bswiss re\b|\bswiss life\b/i, meta: { country: 'Schweiz', sector: 'Finanzdienstleistungen' } },
    { pattern: /\bswisscom\b|\bsunrise\b/i, meta: { country: 'Schweiz', sector: 'Kommunikation' } },
    { pattern: /\bnovo nordisk\b/i, meta: { country: 'Dänemark', sector: 'Gesundheitswesen' } },
    { pattern: /\bscandinavian tobacco\b/i, meta: { country: 'Dänemark', sector: 'Tabak' } },
    { pattern: /\basml\b/i, meta: { country: 'Niederlande', sector: 'Technologie' } },
    { pattern: /\bdbs\b/i, meta: { country: 'Singapur', sector: 'Finanzdienstleistungen' } },
    { pattern: /\bkaspi\b/i, meta: { country: 'Kasachstan', sector: 'Finanzdienstleistungen' } },
    { pattern: /\bpetrobras\b/i, meta: { country: 'Brasilien', sector: 'Energie' } }
];

function findKnownByName(name?: string | null): KnownMetadata | undefined {
    if (!name) return undefined;
    const trimmed = name.replace(/\s+/g, ' ').trim();
    return KNOWN_NAME_METADATA.find(entry => entry.pattern.test(trimmed))?.meta;
}

export function enrichStockMetadata(stock: Stock): Stock {
    const sym = (stock.symbol || '').trim().toUpperCase();
    const baseSym = sym.split('.')[0];
    const known = KNOWN_STOCK_METADATA[sym] || KNOWN_STOCK_METADATA[baseSym] || findKnownByName(stock.name);
    const etf = isLikelyEtf(stock);
    const resolvedType: 'stock' | 'etf' = etf ? 'etf' : (known?.type || stock.type || 'stock');

    // 1. Resolve Sector
    let resolvedSector = stock.sector && stock.sector !== 'Simuliert' ? translateSector(stock.sector) : '';
    if (!resolvedSector || resolvedSector === 'Andere' || resolvedSector === 'Unbekannt') {
        if (known?.sector) {
            resolvedSector = known.sector;
        } else if (resolvedType === 'etf') {
            resolvedSector = 'ETF';
        }
    }

    // 2. Resolve Country (Authoritative company homeland overrides exchange listing / purchase currency)
    let resolvedCountry = normalizeCountryName(stock.country);
    const isinPrefix = (stock.isin || '').trim().toUpperCase().slice(0, 2);
    const authoritativeStockCountry = resolvedType !== 'etf'
        ? (known?.country || (isinPrefix && isinPrefix !== 'IE' && isinPrefix !== 'LU' ? ISIN_COUNTRY_PREFIX[isinPrefix] : undefined))
        : undefined;

    if (resolvedType === 'etf' && (resolvedCountry === 'Unbekannt' || resolvedCountry === 'Irland' || resolvedCountry === 'Luxemburg')) {
        const fb = getFallbackAllocation(stock);
        if (fb && fb.countryWeights.us && fb.countryWeights.us >= 95) {
            resolvedCountry = 'USA';
        } else {
            resolvedCountry = 'Welt';
        }
    } else if (authoritativeStockCountry) {
        // Always prefer true company domicile (e.g. Alphabet bought in EUR on Xetra -> USA, not Deutschland)
        resolvedCountry = authoritativeStockCountry;
    } else if (resolvedCountry === 'Unbekannt') {
        if (isinPrefix && ISIN_COUNTRY_PREFIX[isinPrefix]) {
            resolvedCountry = ISIN_COUNTRY_PREFIX[isinPrefix];
        } else if (sym.includes('.')) {
            const suffix = sym.split('.').pop() || '';
            if (TICKER_SUFFIX_COUNTRY[suffix]) {
                resolvedCountry = TICKER_SUFFIX_COUNTRY[suffix];
            }
        } else if (sym && stock.currency === 'USD') {
            resolvedCountry = 'USA';
        } else if (sym && stock.currency === 'CHF') {
            resolvedCountry = 'Schweiz';
        } else if (sym && (stock.currency === 'GBP' || stock.currency === 'GBp')) {
            resolvedCountry = 'Grossbritannien';
        }
    }

    const finalCountry = resolvedCountry === 'Unbekannt' ? stock.country : resolvedCountry;
    const finalCurrency = (sym.endsWith('.SW') && stock.currency === 'EUR') ? 'CHF' : stock.currency;

    if (
        stock.type === resolvedType &&
        stock.sector === resolvedSector &&
        stock.country === finalCountry &&
        stock.currency === finalCurrency
    ) {
        return stock;
    }

    return {
        ...stock,
        type: resolvedType,
        sector: resolvedSector,
        country: finalCountry,
        currency: finalCurrency
    };
}

// Aliases for unified naming across components
export const normalizeCountry = normalizeCountryName;
export const normalizeSector = normalizeMacroSector;

/**
 * Resolves the country of a stock or ETF using metadata, ISIN, symbol suffix or currency.
 */
export function resolveStockCountry(stock?: Partial<Stock> | null): string {
    if (!stock) return 'Unbekannt';
    const dummyStock = {
        id: stock.id || 'temp',
        name: stock.name || '',
        symbol: stock.symbol || '',
        isin: stock.isin,
        currency: stock.currency || 'USD',
        type: stock.type,
        currentPrice: stock.currentPrice || 0,
        previousClose: stock.previousClose,
        sector: stock.sector,
        country: stock.country,
        dividendYield: stock.dividendYield
    } as Stock;
    const enriched = enrichStockMetadata(dummyStock);
    return enriched.country || 'Unbekannt';
}

/**
 * Resolves the macro sector of a stock or ETF using metadata or translated sectors.
 */
export function resolveStockSector(stock?: Partial<Stock> | null): string {
    if (!stock) return 'Andere';
    const dummyStock = {
        id: stock.id || 'temp',
        name: stock.name || '',
        symbol: stock.symbol || '',
        isin: stock.isin,
        currency: stock.currency || 'USD',
        type: stock.type,
        currentPrice: stock.currentPrice || 0,
        previousClose: stock.previousClose,
        sector: stock.sector,
        country: stock.country,
        dividendYield: stock.dividendYield
    } as Stock;
    const enriched = enrichStockMetadata(dummyStock);
    return normalizeMacroSector(enriched.sector) || 'Andere';
}
