export interface AllocationData {
    sectorWeights: Record<string, number>;
    countryWeights: Record<string, number>;
}

export const FALLBACK_ALLOCATIONS: Record<string, AllocationData> = {
    // Vanguard FTSE All-World UCITS ETF (USD) Accumulating / Distributing
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
    },
    // Vanguard FTSE All-World High Dividend Yield UCITS ETF (USD) Distributing / Accumulating
    // Tickers: VHYL.AS, VHYL.L, VHYD.SW, VHYL
    'VHYL.AS': {
        sectorWeights: {
            financial_services: 26.2,
            industrials: 11.4,
            consumer_defensive: 10.3,
            healthcare: 9.8,
            technology: 9.1,
            energy: 8.7,
            utilities: 6.2,
            basic_materials: 5.8,
            consumer_cyclical: 5.6,
            communication_services: 4.8,
            realestate: 2.1
        },
        countryWeights: {
            us: 42.5,
            japan: 7.8,
            uk: 7.4,
            switzerland: 6.5,
            australia: 4.2,
            germany: 4.1,
            france: 3.8,
            canada: 3.4,
            taiwan: 2.8,
            china: 2.5,
            netherlands: 1.8,
            other: 13.2
        }
    },
    'VHYL.L': {
        sectorWeights: {
            financial_services: 26.2,
            industrials: 11.4,
            consumer_defensive: 10.3,
            healthcare: 9.8,
            technology: 9.1,
            energy: 8.7,
            utilities: 6.2,
            basic_materials: 5.8,
            consumer_cyclical: 5.6,
            communication_services: 4.8,
            realestate: 2.1
        },
        countryWeights: {
            us: 42.5,
            japan: 7.8,
            uk: 7.4,
            switzerland: 6.5,
            australia: 4.2,
            germany: 4.1,
            france: 3.8,
            canada: 3.4,
            taiwan: 2.8,
            china: 2.5,
            netherlands: 1.8,
            other: 13.2
        }
    },
    'VHYD.SW': {
        sectorWeights: {
            financial_services: 26.2,
            industrials: 11.4,
            consumer_defensive: 10.3,
            healthcare: 9.8,
            technology: 9.1,
            energy: 8.7,
            utilities: 6.2,
            basic_materials: 5.8,
            consumer_cyclical: 5.6,
            communication_services: 4.8,
            realestate: 2.1
        },
        countryWeights: {
            us: 42.5,
            japan: 7.8,
            uk: 7.4,
            switzerland: 6.5,
            australia: 4.2,
            germany: 4.1,
            france: 3.8,
            canada: 3.4,
            taiwan: 2.8,
            china: 2.5,
            netherlands: 1.8,
            other: 13.2
        }
    },
    'VHYL': {
        sectorWeights: {
            financial_services: 26.2,
            industrials: 11.4,
            consumer_defensive: 10.3,
            healthcare: 9.8,
            technology: 9.1,
            energy: 8.7,
            utilities: 6.2,
            basic_materials: 5.8,
            consumer_cyclical: 5.6,
            communication_services: 4.8,
            realestate: 2.1
        },
        countryWeights: {
            us: 42.5,
            japan: 7.8,
            uk: 7.4,
            switzerland: 6.5,
            australia: 4.2,
            germany: 4.1,
            france: 3.8,
            canada: 3.4,
            taiwan: 2.8,
            china: 2.5,
            netherlands: 1.8,
            other: 13.2
        }
    },
    // State Street SPDR S&P Euro Dividend Aristocrats UCITS ETF (EUR)
    // Tickers: SPYW.DE, EUDV.DE, SPYW
    'SPYW.DE': {
        sectorWeights: {
            utilities: 20.5,
            financial_services: 18.2,
            industrials: 17.5,
            consumer_defensive: 13.8,
            basic_materials: 10.4,
            realestate: 7.6,
            healthcare: 4.5,
            consumer_cyclical: 3.8,
            communication_services: 3.7
        },
        countryWeights: {
            germany: 28.5,
            france: 21.2,
            italy: 14.8,
            spain: 12.3,
            finland: 9.4,
            netherlands: 5.8,
            belgium: 4.2,
            austria: 2.6,
            portugal: 1.2
        }
    },
    'EUDV.DE': {
        sectorWeights: {
            utilities: 20.5,
            financial_services: 18.2,
            industrials: 17.5,
            consumer_defensive: 13.8,
            basic_materials: 10.4,
            realestate: 7.6,
            healthcare: 4.5,
            consumer_cyclical: 3.8,
            communication_services: 3.7
        },
        countryWeights: {
            germany: 28.5,
            france: 21.2,
            italy: 14.8,
            spain: 12.3,
            finland: 9.4,
            netherlands: 5.8,
            belgium: 4.2,
            austria: 2.6,
            portugal: 1.2
        }
    },
    'SPYW': {
        sectorWeights: {
            utilities: 20.5,
            financial_services: 18.2,
            industrials: 17.5,
            consumer_defensive: 13.8,
            basic_materials: 10.4,
            realestate: 7.6,
            healthcare: 4.5,
            consumer_cyclical: 3.8,
            communication_services: 3.7
        },
        countryWeights: {
            germany: 28.5,
            france: 21.2,
            italy: 14.8,
            spain: 12.3,
            finland: 9.4,
            netherlands: 5.8,
            belgium: 4.2,
            austria: 2.6,
            portugal: 1.2
        }
    }
};
