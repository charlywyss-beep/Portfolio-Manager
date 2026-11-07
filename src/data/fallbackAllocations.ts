export interface AllocationData {
    sectorWeights: Record<string, number>;
    countryWeights: Record<string, number>;
}

const FTSE_ALL_WORLD: AllocationData = {
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
};

const FTSE_HIGH_DIVIDEND: AllocationData = {
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
};

const EURO_DIVIDEND_ARISTOCRATS: AllocationData = {
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
};

const MSCI_WORLD: AllocationData = {
    sectorWeights: {
        technology: 26.5,
        financial_services: 16.0,
        healthcare: 11.2,
        industrials: 11.0,
        consumer_cyclical: 10.5,
        communication_services: 7.8,
        consumer_defensive: 6.2,
        energy: 4.0,
        basic_materials: 3.4,
        utilities: 2.5,
        realestate: 0.9
    },
    countryWeights: {
        us: 71.5,
        japan: 5.6,
        uk: 3.7,
        canada: 3.1,
        france: 2.8,
        switzerland: 2.5,
        germany: 2.3,
        australia: 1.8,
        netherlands: 1.3,
        other: 5.4
    }
};

const SP500: AllocationData = {
    sectorWeights: {
        technology: 32.5,
        financial_services: 13.8,
        healthcare: 11.5,
        consumer_cyclical: 10.8,
        communication_services: 9.2,
        industrials: 8.4,
        consumer_defensive: 5.8,
        energy: 3.3,
        utilities: 2.4,
        realestate: 2.3
    },
    countryWeights: {
        us: 100.0
    }
};

const NASDAQ_100: AllocationData = {
    sectorWeights: {
        technology: 51.5,
        communication_services: 16.2,
        consumer_cyclical: 13.5,
        consumer_defensive: 5.8,
        healthcare: 5.5,
        industrials: 4.5,
        utilities: 1.5,
        energy: 1.5
    },
    countryWeights: {
        us: 97.5,
        other: 2.5
    }
};

const GLOBAL_DIVIDEND_LEADERS: AllocationData = {
    sectorWeights: {
        financial_services: 34.0,
        healthcare: 14.5,
        energy: 12.0,
        consumer_defensive: 10.5,
        utilities: 8.5,
        communication_services: 7.5,
        industrials: 6.5,
        basic_materials: 4.0,
        technology: 2.5
    },
    countryWeights: {
        us: 24.0,
        france: 13.5,
        uk: 11.0,
        switzerland: 9.5,
        germany: 8.5,
        japan: 7.0,
        italy: 6.0,
        netherlands: 5.0,
        australia: 4.5,
        other: 11.0
    }
};

export const FALLBACK_ALLOCATIONS: Record<string, AllocationData> = {
    // Vanguard FTSE All-World UCITS ETF
    'VWRA.L': FTSE_ALL_WORLD,
    'VWRP.L': FTSE_ALL_WORLD,
    'VWRL.AS': FTSE_ALL_WORLD,
    'VWRL.SW': FTSE_ALL_WORLD,
    'VWRL.L': FTSE_ALL_WORLD,
    'VWCE.DE': FTSE_ALL_WORLD,
    'VWRA': FTSE_ALL_WORLD,
    'VWRL': FTSE_ALL_WORLD,

    // Vanguard FTSE All-World High Dividend Yield UCITS ETF
    'VHYL.AS': FTSE_HIGH_DIVIDEND,
    'VHYL.L': FTSE_HIGH_DIVIDEND,
    'VHYL.SW': FTSE_HIGH_DIVIDEND,
    'VHYD.SW': FTSE_HIGH_DIVIDEND,
    'VGWE.DE': FTSE_HIGH_DIVIDEND,
    'VHYG.L': FTSE_HIGH_DIVIDEND,
    'VHYL': FTSE_HIGH_DIVIDEND,
    'VHYD': FTSE_HIGH_DIVIDEND,

    // SPDR S&P Euro Dividend Aristocrats
    'SPYW.DE': EURO_DIVIDEND_ARISTOCRATS,
    'EUDV.DE': EURO_DIVIDEND_ARISTOCRATS,
    'SPYW': EURO_DIVIDEND_ARISTOCRATS,

    // MSCI World ETFs
    'IWDA.L': MSCI_WORLD,
    'IWDA.AS': MSCI_WORLD,
    'HWDC.SW': MSCI_WORLD,
    'SWDA.L': MSCI_WORLD,
    'EUNL.DE': MSCI_WORLD,
    'WINC.AS': {
        sectorWeights: {
            technology: 24.0,
            financial_services: 18.5,
            healthcare: 13.5,
            industrials: 11.0,
            consumer_defensive: 9.0,
            consumer_cyclical: 8.0,
            communication_services: 6.5,
            energy: 5.0,
            utilities: 4.5
        },
        countryWeights: {
            us: 64.0,
            uk: 6.5,
            japan: 6.0,
            switzerland: 4.5,
            france: 4.0,
            germany: 3.5,
            canada: 3.0,
            other: 8.5
        }
    },

    // S&P 500 & US Dividend / Tech ETFs
    'VOO': SP500,
    'CSPX.L': SP500,
    'VUAA.L': SP500,
    'VUSA.SW': SP500,
    'QQQ': NASDAQ_100,
    'EQQQ.DE': NASDAQ_100,
    'CSNDX.SW': NASDAQ_100,
    'SCHD': {
        sectorWeights: {
            financial_services: 18.5,
            healthcare: 16.0,
            consumer_defensive: 14.5,
            industrials: 13.0,
            energy: 12.5,
            technology: 10.0,
            consumer_cyclical: 8.5,
            communication_services: 4.5,
            utilities: 2.5
        },
        countryWeights: { us: 100.0 }
    },
    'IUES.SW': {
        sectorWeights: { energy: 100.0 },
        countryWeights: { us: 100.0 }
    },

    // Global Dividend ETFs
    'TDIV.AS': GLOBAL_DIVIDEND_LEADERS,
    'LDGA.SW': {
        sectorWeights: {
            financial_services: 25.0,
            industrials: 15.5,
            healthcare: 13.0,
            consumer_defensive: 12.5,
            technology: 11.0,
            energy: 7.5,
            utilities: 6.5,
            consumer_cyclical: 5.0,
            basic_materials: 4.0
        },
        countryWeights: {
            us: 45.0,
            uk: 9.0,
            japan: 8.5,
            switzerland: 6.5,
            france: 5.5,
            germany: 4.5,
            australia: 4.5,
            canada: 4.0,
            other: 12.5
        }
    },

    // Sector / Thematic ETFs
    'URNM': {
        sectorWeights: { energy: 70.0, basic_materials: 30.0 },
        countryWeights: { canada: 48.0, australia: 18.0, us: 14.0, other: 20.0 }
    }
};

export function getFallbackAllocation(stock: { symbol?: string; isin?: string; name?: string }): AllocationData | undefined {
    const sym = (stock.symbol || '').trim().toUpperCase();
    if (sym && FALLBACK_ALLOCATIONS[sym]) {
        return FALLBACK_ALLOCATIONS[sym];
    }

    const baseSym = sym.split('.')[0];
    if (baseSym && FALLBACK_ALLOCATIONS[baseSym]) {
        return FALLBACK_ALLOCATIONS[baseSym];
    }

    const isin = (stock.isin || '').trim().toUpperCase();
    if (isin === 'IE00B8GKDB10' || isin === 'IE00BK5BR626') return FTSE_HIGH_DIVIDEND;
    if (isin === 'IE00BK5BQT80' || isin === 'IE00B3RBWM25') return FTSE_ALL_WORLD;

    const name = (stock.name || '').toLowerCase();
    if (name.includes('high dividend') && (name.includes('all-world') || name.includes('all world') || name.includes('ftse'))) {
        return FTSE_HIGH_DIVIDEND;
    }
    if (name.includes('ftse all-world') || name.includes('ftse all world')) {
        return FTSE_ALL_WORLD;
    }
    if (name.includes('msci world') || name.includes('ishrs core msci')) {
        return MSCI_WORLD;
    }
    if (name.includes('nasdaq 100') || name.includes('nasdaq-100')) {
        return NASDAQ_100;
    }
    if (name.includes('s&p 500') && name.includes('energy')) {
        return FALLBACK_ALLOCATIONS['IUES.SW'];
    }
    if (name.includes('s&p 500')) {
        return SP500;
    }

    return undefined;
}
