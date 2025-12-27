
import type { Stock } from '../types';

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

// Helpers
const normalizeCountry = (country?: string): string => {
    if (!country) return 'Unbekannt';
    const c = country.toLowerCase().trim();
    if (c === 'switzerland' || c === 'schweiz' || c === 'ch') return 'Schweiz';
    if (c === 'united states' || c === 'usa' || c === 'us' || c === 'vereinigte staaten') return 'USA';
    if (c === 'germany' || c === 'deutschland' || c === 'de') return 'Deutschland';
    if (['uk', 'britain', 'united kingdom'].includes(c)) return 'Großbritannien';
    if (['welt', 'world', 'global'].includes(c)) return 'Welt';
    return country;
};

export const analyzePortfolioRisk = (
    positions: { stock: Stock; currentValue: number }[]
): RiskAnalysisResult => {
    const totalValue = positions.reduce((sum, p) => sum + p.currentValue, 0);

    if (totalValue === 0) {
        return { totalValue: 0, topHolding: null, sectorDominance: null, countryDominance: null, clusters: [], score: 100 };
    }

    // 1. Top Holding Analysis
    const sortedByValue = [...positions].sort((a, b) => b.currentValue - a.currentValue);
    const topPos = sortedByValue[0];
    const topHolding = {
        symbol: topPos.stock.symbol,
        name: topPos.stock.name,
        value: topPos.currentValue,
        percent: (topPos.currentValue / totalValue) * 100
    };

    // 2. Sector & Country Maps
    const sectors = new Map<string, number>();
    const countries = new Map<string, number>();

    // Cluster: US Tech
    let usTechValue = 0;
    // Virtual USA Value (includes 100% of US Stocks + ~60% of World ETFs)
    let virtualUSAValue = 0;

    positions.forEach(p => {
        const sector = p.stock.sector || 'Andere';
        const country = normalizeCountry(p.stock.country);

        sectors.set(sector, (sectors.get(sector) || 0) + p.currentValue);
        countries.set(country, (countries.get(country) || 0) + p.currentValue);

        // Virtual USA Calculation
        if (country === 'USA') {
            virtualUSAValue += p.currentValue;
        } else if (country === 'Welt') {
            virtualUSAValue += (p.currentValue * 0.6); // Assume ~60% USA in World ETFs
        }

        // Check US Tech Cluster
        if (country === 'USA' && sector === 'Technology') {
            usTechValue += p.currentValue;
        }
        // QQQ / Nasdaq ETFs often fall here if manually mapped, or we can check symbol/name for common tech ETFs
        if (p.stock.symbol === 'EQQQ.DE' || p.stock.symbol.includes('QQQ')) {
            usTechValue += p.currentValue;
        }
    });

    // Find dominants
    const getDominant = (map: Map<string, number>) => {
        let maxName = '';
        let maxVal = 0;
        map.forEach((val, name) => {
            if (val > maxVal) {
                maxVal = val;
                maxName = name;
            }
        });
        return { name: maxName, value: maxVal, percent: (maxVal / totalValue) * 100 };
    };

    const domSector = getDominant(sectors);
    const domCountry = getDominant(countries);

    // 3. Identify Clusters / Warnings
    const clusters: RiskCluster[] = [];

    // Single Position Risk
    // Exclude ETFs from "Single Position" risk because they are inherently diversified buckets
    if (topHolding.percent > 15 && topPos.stock.type !== 'etf') {
        clusters.push({
            name: 'Klumpenrisiko Einzelposition',
            description: `Die Position "${topHolding.name}" macht ${topHolding.percent.toFixed(1)}% deines Portfolios aus.`,
            value: topHolding.value,
            percent: topHolding.percent,
            severity: topHolding.percent > 25 ? 'high' : 'medium'
        });
    }

    // Sector Risk (exclude 'ETF' or 'Andere' which are generic)
    if (domSector.name !== 'ETF' && domSector.name !== 'Andere' && domSector.percent > 25) {
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
            description: `Ca. ${virtualUSAPercent.toFixed(0)}% deines Portfolios hängen vom US-Markt ab (inkl. ~60% Anteil aus Welt-ETFs).`,
            value: virtualUSAValue,
            percent: virtualUSAPercent,
            severity: virtualUSAPercent > 70 ? 'high' : 'medium'
        });
    }
    // Fallback normal country risk (if not USA)
    else if (domCountry.name !== 'Welt' && domCountry.name !== 'USA' && domCountry.percent > 40) {
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

    // Calculate Score
    // Base 100, subtract penalties
    let score = 100;
    if (topHolding.percent > 10 && topPos.stock.type !== 'etf') score -= (topHolding.percent - 10) * 1.5;
    if (domSector.percent > 20 && domSector.name !== 'ETF') score -= (domSector.percent - 20);
    if (usTechPercent > 20) score -= (usTechPercent - 15);
    if (virtualUSAPercent > 60) score -= (virtualUSAPercent - 60);

    return {
        totalValue,
        topHolding,
        sectorDominance: { sector: domSector.name, value: domSector.value, percent: domSector.percent },
        countryDominance: { country: domCountry.name, value: domCountry.value, percent: domCountry.percent },
        clusters,
        score: Math.max(0, Math.round(score))
    };
};
