
export interface AllocationData {
    sectorWeights: Record<string, number>;
    countryWeights: Record<string, number>;
}

export const FALLBACK_ALLOCATIONS: Record<string, AllocationData> = {
    // Vanguard FTSE All-World UCITS ETF (USD) Accumulating
    // Tickers: VWRA.L, VWRP.L, VWRL.AS, etc.
    'VWRA.L': {
        sectorWeights: {
            technology: 31.6,
            financial_services: 15.5,
            consumer_cyclical: 13.1,
            industrials: 12.5,
            healthcare: 8.7,
            consumer_defensive: 4.4,
            energy: 3.7,
            basic_materials: 3.0,
            utilities: 2.9,
            communication_services: 2.7,
            realestate: 2.0
        },
        countryWeights: {
            us: 63.0,
            japan: 5.7,
            china: 3.4,
            uk: 3.4,
            canada: 3.0,
            taiwan: 2.2,
            france: 2.1,
            switzerland: 2.1,
            germany: 2.0,
            india: 2.0,
            australia: 1.8,
            korea: 1.3,
            netherlands: 1.1,
            sweden: 0.8,
            denmark: 0.8,
            italy: 0.6,
            other: 4.7
        }
    },
    // Adding VWRL.AS and others just in case
    'VWRL.AS': {
        sectorWeights: {
            technology: 31.6,
            financial_services: 15.5,
            consumer_cyclical: 13.1,
            industrials: 12.5,
            healthcare: 8.7,
            consumer_defensive: 4.4,
            energy: 3.7,
            basic_materials: 3.0,
            utilities: 2.9,
            communication_services: 2.7,
            realestate: 2.0
        },
        countryWeights: {
            us: 63.0,
            japan: 5.7,
            china: 3.4,
            uk: 3.4,
            canada: 3.0,
            taiwan: 2.2,
            france: 2.1,
            switzerland: 2.1,
            germany: 2.0,
            india: 2.0,
            australia: 1.8,
            korea: 1.3,
            netherlands: 1.1,
            sweden: 0.8,
            denmark: 0.8,
            italy: 0.6,
            other: 4.7
        }
    }
};
