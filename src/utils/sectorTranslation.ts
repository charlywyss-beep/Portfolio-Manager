/**
 * Sector & Industry Translation Utility
 * Translates Yahoo Finance English sectors and industries into clean, concise German terms.
 */

const INDUSTRY_MAP: Record<string, string> = {
    'tobacco': 'Tabak',
    'restaurants': 'Restaurants',
    'semiconductors': 'Halbleiter',
    'semiconductor equipment & materials': 'Halbleiter',
    'software - infrastructure': 'Software',
    'software - application': 'Software',
    'internet content & information': 'Internet & Medien',
    'information technology services': 'IT-Dienstleistungen',
    'computer hardware': 'Hardware',
    'consumer electronics': 'Unterhaltungselektronik',
    'telecom services': 'Telekommunikation',
    'auto manufacturers': 'Automobil',
    'aerospace & defense': 'Luftfahrt & Rüstung',
    'beverages - non-alcoholic': 'Getränke',
    'beverages - brewers': 'Brauereien',
    'beverages - wineries & distilleries': 'Spirituosen & Wein',
    'packaged foods': 'Lebensmittel',
    'confectioners': 'Süsswaren & Snacks',
    'household & personal products': 'Haushalt & Pflege',
    'discount stores': 'Einzelhandel',
    'grocery stores': 'Lebensmitteleinzelhandel',
    'pharmaceutical retailers': 'Apotheken & Drogerien',
    'drug manufacturers - general': 'Pharma',
    'drug manufacturers - specialty & generic': 'Pharma',
    'biotechnology': 'Biotechnologie',
    'medical devices': 'Medizintechnik',
    'medical instruments & supplies': 'Medizintechnik',
    'diagnostics & research': 'Diagnostik & Forschung',
    'healthcare plans': 'Krankenversicherung',
    'medical care facilities': 'Gesundheitseinrichtungen',
    'banks - diversified': 'Banken',
    'banks - regional': 'Regionalbanken',
    'insurance - diversified': 'Versicherungen',
    'insurance - life': 'Lebensversicherungen',
    'insurance - property & casualty': 'Sachversicherungen',
    'insurance - reinsurance': 'Rückversicherungen',
    'insurance brokers': 'Versicherungsmakler',
    'asset management': 'Vermögensverwaltung',
    'credit services': 'Finanzdienstleistungen',
    'financial data & stock exchanges': 'Finanzbörsen & Daten',
    'oil & gas integrated': 'Öl & Gas',
    'oil & gas e&p': 'Ölexploration & Förderung',
    'oil & gas refining & marketing': 'Raffinerien & Tankstellen',
    'utilities - regulated electric': 'Stromversorger',
    'utilities - renewable': 'Erneuerbare Energien',
    'utilities - regulated gas': 'Gasversorger',
    'utilities - regulated water': 'Wasserversorger',
    'utilities - diversified': 'Versorger',
    'reit - retail': 'REIT (Einzelhandel)',
    'reit - residential': 'REIT (Wohnen)',
    'reit - industrial': 'REIT (Industrie)',
    'reit - diversified': 'REIT (Diversifiziert)',
    'reit - healthcare facilities': 'REIT (Gesundheit)',
    'reit - specialty': 'REIT (Spezial)',
    'reit - office': 'REIT (Büro)',
    'chemicals': 'Chemie',
    'specialty chemicals': 'Spezialchemie',
    'building materials': 'Baustoffe',
    'steel': 'Stahl',
    'copper': 'Kupfer & Metalle',
    'gold': 'Edelmetalle & Gold',
    'other industrial metals & mining': 'Bergbau & Metalle',
    'farm products': 'Agrarwirtschaft',
    'apparel retail': 'Bekleidungseinzelhandel',
    'apparel manufacturing': 'Bekleidungsherstellung',
    'footwear & accessories': 'Schuhe & Accessoires',
    'luxury goods': 'Luxusgüter',
    'entertainment': 'Unterhaltung & Medien',
    'interactive media': 'Digitale Medien',
    'railroads': 'Eisenbahn & Logistik',
    'integrated freight & logistics': 'Logistik & Transport',
    'airports & air services': 'Flughäfen & Luftfahrt',
    'airlines': 'Fluggesellschaften',
    'waste management': 'Entsorgung & Recycling',
    'conglomerates': 'Mischkonzerne'
};

const SECTOR_MAP: Record<string, string> = {
    'consumer defensive': 'Basiskonsum',
    'consumer staples': 'Basiskonsum',
    'consumer cyclical': 'Zyklischer Konsum',
    'consumer discretionary': 'Zyklischer Konsum',
    'healthcare': 'Gesundheitswesen',
    'health care': 'Gesundheitswesen',
    'technology': 'Technologie',
    'information technology': 'Technologie',
    'financial services': 'Finanzdienstleistungen',
    'financials': 'Finanzen',
    'financial': 'Finanzen',
    'industrials': 'Industrie',
    'energy': 'Energie',
    'utilities': 'Versorger',
    'real estate': 'Immobilien',
    'basic materials': 'Rohstoffe',
    'materials': 'Rohstoffe',
    'communication services': 'Kommunikation',
    'telecommunication services': 'Telekommunikation',
    'etf': 'ETF'
};

/**
 * Translates Yahoo Finance sector & industry into a user-friendly German label.
 * Prioritizes distinct industries (e.g. "Tabak", "Restaurants", "Halbleiter") where helpful,
 * and falls back to clean German sector names (e.g. "Basiskonsum", "Zyklischer Konsum", "Technologie").
 */
export function translateSector(rawSector?: string | null, rawIndustry?: string | null): string {
    const indKey = (rawIndustry || '').trim().toLowerCase();
    if (indKey && INDUSTRY_MAP[indKey]) {
        return INDUSTRY_MAP[indKey];
    }

    // Check industry key for REIT prefix
    if (indKey && indKey.startsWith('reit')) {
        return 'REIT / Immobilien';
    }

    const secKey = (rawSector || '').trim().toLowerCase();
    if (secKey && SECTOR_MAP[secKey]) {
        return SECTOR_MAP[secKey];
    }

    // Check if rawSector itself matched an industry (sometimes industry is passed in sector field)
    if (secKey && INDUSTRY_MAP[secKey]) {
        return INDUSTRY_MAP[secKey];
    }

    // Fallback: return original sector or industry trimmed, or empty string
    return (rawSector || rawIndustry || '').trim();
}
