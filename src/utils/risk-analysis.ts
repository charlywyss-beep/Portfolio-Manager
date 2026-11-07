import type { Stock } from '../types';
import { FALLBACK_ALLOCATIONS, getFallbackAllocation } from '../data/fallbackAllocations';
import { normalizeCountry, normalizeSector, resolveStockCountry, resolveStockSector } from './stockMetadata';

export interface RiskAnalysisResult {
    totalValue: number;
    topHolding: {
        symbol: string;
        name: string;
        value: number;
        percent: number;
    } | null;
    sectorDominance: {
        sector: string;
        value: number;
        percent: number;
    } | null;
    countryDominance: {
        country: string;
        value: number;
        percent: number;
    } | null;
    clusters: RiskCluster[];
    score: number; // 0-100 (100 = best diversification)
}

export interface RiskCluster {
    name: string;
    description: string;
    value: number;
    percent: number;
    severity: 'low' | 'medium' | 'high';
}

export interface FixedDepositItem {
    amount: number;
    currency: string;
    accountType?: string;
    currentValueCHF?: number;
}

const ETF_SECTOR_MAP: Record<string, string> = {
    'realestate': 'Immobilien',
    'healthcare': 'Gesundheitswesen',
    'basic_materials': 'Rohstoffe',
    'consumer_cyclical': 'Zykl. Konsumgüter',
    'financial_services': 'Finanzdienstleistungen',
    'consumer_defensive': 'Nicht-zykl. Konsum',
    'technology': 'Technologie',
    'utilities': 'Versorger',
    'financial': 'Finanzdienstleistungen',
    'communication_services': 'Kommunikation',
    'energy': 'Energie',
    'industrials': 'Industrie'
};

const ETF_COUNTRY_MAP: Record<string, string> = {
    'us': 'USA',
    'uk': 'Grossbritannien',
    'united_kingdom': 'Grossbritannien',
    'japan': 'Japan',
    'china': 'China',
    'canada': 'Kanada',
    'france': 'Frankreich',
    'germany': 'Deutschland',
    'switzerland': 'Schweiz',
    'eurozone': 'Eurozone',
    'australia': 'Australien',
    'taiwan': 'Taiwan',
    'india': 'Indien',
    'korea': 'Südkorea',
    'italy': 'Italien',
    'sweden': 'Schweden',
    'denmark': 'Dänemark',
    'netherlands': 'Niederlande',
    'spain': 'Spanien',
    'other': 'Andere'
};

export const analyzePortfolioRisk = (
    positions: { stock: Stock; currentValue: number }[],
    fixedDeposits: FixedDepositItem[] = []
): RiskAnalysisResult => {
    const positionsValue = positions.reduce((sum, p) => sum + p.currentValue, 0);
    const fixedDepositsValue = fixedDeposits.reduce((sum, fd) => sum + (fd.currentValueCHF ?? fd.amount), 0);
    const totalValue = positionsValue + fixedDepositsValue;

    if (totalValue === 0) {
        return { totalValue: 0, topHolding: null, sectorDominance: null, countryDominance: null, clusters: [], score: 100 };
    }

    // 1. Top Holding Analysis (excluding ETFs from single stock risk)
    const sortedByValue = [...positions].sort((a, b) => b.currentValue - a.currentValue);
    const topPos = sortedByValue.find(p => p.stock.type !== 'etf' && !getFallbackAllocation(p.stock)) || sortedByValue[0];
    const topHolding = topPos ? {
        symbol: topPos.stock.symbol,
        name: topPos.stock.name,
        value: topPos.currentValue,
        percent: (topPos.currentValue / totalValue) * 100
    } : null;

    // 2. Sector & Country Maps
    const sectors = new Map<string, number>();
    const countries = new Map<string, number>();

    let usTechValue = 0;
    let virtualUSAValue = 0;

    // Process positions
    positions.forEach(p => {
        const fallback = getFallbackAllocation(p.stock) || FALLBACK_ALLOCATIONS[p.stock.symbol];
        const effectiveSectorWeights = p.stock.sectorWeights || fallback?.sectorWeights;
        const effectiveCountryWeights = p.stock.countryWeights || fallback?.countryWeights;

        // Sectors
        if (p.stock.type === 'etf' && effectiveSectorWeights) {
            Object.entries(effectiveSectorWeights).forEach(([rawName, weight]) => {
                const name = rawName.toLowerCase().replace(/\s/g, '_');
                const displayName = ETF_SECTOR_MAP[name] || normalizeSector(rawName);
                const val = p.currentValue * (Number(weight) / 100);
                sectors.set(displayName, (sectors.get(displayName) || 0) + val);
            });
        } else {
            const rawSector = p.stock.sector || resolveStockSector(p.stock);
            const sector = normalizeSector(rawSector);
            sectors.set(sector, (sectors.get(sector) || 0) + p.currentValue);
        }

        // Countries
        if (p.stock.type === 'etf' && effectiveCountryWeights) {
            Object.entries(effectiveCountryWeights).forEach(([rawName, weight]) => {
                const name = rawName.toLowerCase().replace(/\s/g, '_');
                const rawDisplay = ETF_COUNTRY_MAP[name] || rawName;
                const displayName = normalizeCountry(rawDisplay);
                const val = p.currentValue * (Number(weight) / 100);
                countries.set(displayName, (countries.get(displayName) || 0) + val);

                if (displayName === 'USA') {
                    virtualUSAValue += val;
                }
            });
        } else {
            const rawCountry = p.stock.country || resolveStockCountry(p.stock);
            const country = normalizeCountry(rawCountry);
            countries.set(country, (countries.get(country) || 0) + p.currentValue);

            if (country === 'USA') {
                virtualUSAValue += p.currentValue;
            } else if (country === 'Welt') {
                virtualUSAValue += (p.currentValue * 0.6); // ~60% USA in generic World ETF
            }
        }

        // US Tech cluster check
        const resolvedCountry = normalizeCountry(p.stock.country || resolveStockCountry(p.stock));
        const resolvedSector = normalizeSector(p.stock.sector || resolveStockSector(p.stock));
        if (resolvedCountry === 'USA' && resolvedSector === 'Technologie') {
            usTechValue += p.currentValue;
        }
        if (p.stock.symbol === 'EQQQ.DE' || p.stock.symbol.includes('QQQ')) {
            usTechValue += p.currentValue;
        }
    });

    // Process Fixed Deposits (Cash & Vorsorge)
    fixedDeposits.forEach(fd => {
        const val = fd.currentValueCHF ?? fd.amount;
        const sector = fd.accountType === 'vorsorge' ? 'Vorsorge' : 'Liquidität';
        const country = 'Schweiz';

        sectors.set(sector, (sectors.get(sector) || 0) + val);
        countries.set(country, (countries.get(country) || 0) + val);
    });

    // Find Dominants - Exclude generic/unclassified categories from being the "dominant" choice
    const GENERIC_SECTOR_BUCKETS = new Set(['Andere', 'Unbekannt', 'Sonstige', 'ETF', 'Liquidität', 'Vorsorge', '']);
    const GENERIC_COUNTRY_BUCKETS = new Set(['Unbekannt', 'Andere', 'Sonstige', 'Welt', '']);

    const getDominant = (map: Map<string, number>, excludeSet: Set<string>) => {
        let maxName = '';
        let maxVal = 0;
        map.forEach((val, name) => {
            if (!excludeSet.has(name) && val > maxVal) {
                maxVal = val;
                maxName = name;
            }
        });
        if (!maxName) return null;
        return { name: maxName, value: maxVal, percent: (maxVal / totalValue) * 100 };
    };

    const domSector = getDominant(sectors, GENERIC_SECTOR_BUCKETS);
    const domCountry = getDominant(countries, GENERIC_COUNTRY_BUCKETS);

    // 3. Identify Clusters / Warnings
    const clusters: RiskCluster[] = [];

    // Single Position Risk (>15% in a single non-ETF stock)
    if (topHolding && topHolding.percent > 15 && topPos?.stock.type !== 'etf') {
        clusters.push({
            name: 'Klumpenrisiko Einzelposition',
            description: `Die Position "${topHolding.name}" macht ${topHolding.percent.toFixed(1)}% deines Gesamtvermögens aus.`,
            value: topHolding.value,
            percent: topHolding.percent,
            severity: topHolding.percent > 25 ? 'high' : 'medium'
        });
    }

    // Sector Risk (>25% in a single economic sector, excluding generic buckets)
    if (domSector && domSector.percent > 25) {
        clusters.push({
            name: `Sektor-Wette: ${domSector.name}`,
            description: `${domSector.percent.toFixed(1)}% sind im Sektor "${domSector.name}" investiert.`,
            value: domSector.value,
            percent: domSector.percent,
            severity: domSector.percent > 40 ? 'high' : 'medium'
        });
    }

    // Total USA Risk (Virtual)
    const virtualUSAPercent = (virtualUSAValue / totalValue) * 100;
    if (virtualUSAPercent > 55) {
        clusters.push({
            name: 'Hoher USA-Fokus',
            description: `Ca. ${virtualUSAPercent.toFixed(0)}% deines Gesamtportfolios hängen vom US-Markt ab (inkl. ETF-Anteilen).`,
            value: virtualUSAValue,
            percent: virtualUSAPercent,
            severity: virtualUSAPercent > 70 ? 'high' : 'medium'
        });
    } else if (domCountry && domCountry.name !== 'Schweiz' && domCountry.name !== 'USA' && domCountry.percent > 40) {
        clusters.push({
            name: `Länder-Fokus: ${domCountry.name}`,
            description: `${domCountry.percent.toFixed(1)}% liegen in ${domCountry.name}.`,
            value: domCountry.value,
            percent: domCountry.percent,
            severity: 'medium'
        });
    }

    // US Tech Cluster
    const usTechPercent = (usTechValue / totalValue) * 100;
    if (usTechPercent > 20) {
        clusters.push({
            name: 'US Tech Cluster',
            description: `${usTechPercent.toFixed(1)}% sind in US-Technologie Werten (oder Tech-ETFs) investiert. Dies erhöht die Volatilität.`,
            value: usTechValue,
            percent: usTechPercent,
            severity: usTechPercent > 35 ? 'high' : 'medium'
        });
    }

    // Calculate Score (Base 100, penalize for real risks)
    let score = 100;
    if (topHolding && topHolding.percent > 10 && topPos?.stock.type !== 'etf') {
        score -= (topHolding.percent - 10) * 1.5;
    }
    if (domSector && domSector.percent > 25) {
        score -= (domSector.percent - 20);
    }
    if (usTechPercent > 20) {
        score -= (usTechPercent - 15);
    }
    if (virtualUSAPercent > 60) {
        score -= (virtualUSAPercent - 60);
    }

    // Consistency guarantee: If no risk clusters are triggered, the portfolio is well diversified
    if (clusters.length === 0) {
        score = Math.max(88, Math.min(100, Math.round(score)));
    } else {
        score = Math.max(0, Math.min(100, Math.round(score)));
    }

    return {
        totalValue,
        topHolding,
        sectorDominance: domSector ? { sector: domSector.name, value: domSector.value, percent: domSector.percent } : null,
        countryDominance: domCountry ? { country: domCountry.name, value: domCountry.value, percent: domCountry.percent } : null,
        clusters,
        score
    };
};
