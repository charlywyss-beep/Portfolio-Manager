// Shared Fair Value calculation and Smart Auto-Parameter helpers

export const FUNDAMENTAL_FALLBACKS: Record<string, { eps: number; growth: number; pe: number; pe10?: number; div?: number; mos?: number; label: string }> = {
    'AMZN': { eps: 7.17, growth: 12.0, pe: 20.0, pe10: 18.0, div: 0, mos: 15, label: 'TTM' },
    'MSFT': { eps: 17.95, growth: 13.0, pe: 20.0, pe10: 18.5, div: 0.79, mos: 15, label: 'TTM Bereinigt (Analysten)' },
    'KHC': { eps: 2.60, growth: 2.0, pe: 11.5, pe10: 10.5, div: 6.8, mos: 20, label: 'Operativ / Bereinigt' },
    'BATS.L': { eps: 3.62, growth: 3.0, pe: 11.5, pe10: 10.0, mos: 20, label: 'Bereinigt (Adj. EPS)' },
    'BTI': { eps: 4.65, growth: 3.0, pe: 11.5, pe10: 10.0, mos: 20, label: 'Bereinigt (Adj. EPS)' },
    'NESN.SW': { eps: 4.60, growth: 5.0, pe: 17.0, pe10: 16.5, mos: 15, label: 'Bereinigt (Underlying)' },
    'NESN': { eps: 4.60, growth: 5.0, pe: 17.0, pe10: 16.5, mos: 15, label: 'Bereinigt (Underlying)' },
    'ROG.SW': { eps: 18.80, growth: 5.5, pe: 16.5, pe10: 15.5, mos: 15, label: 'Core EPS (Bereinigt)' },
    'NOVN.SW': { eps: 6.80, growth: 5.5, pe: 16.0, pe10: 15.0, mos: 15, label: 'Core EPS (Bereinigt)' },
    'O': { eps: 4.20, growth: 3.5, pe: 15.0, pe10: 14.0, mos: 15, label: 'AFFO (Cashflow)' },
    'SREN.SW': { eps: 16.42, growth: 2.5, pe: 9.5, pe10: 9.0, div: 4.82, mos: 20, label: 'Konsens EPS' },
    'SREN': { eps: 16.42, growth: 2.5, pe: 9.5, pe10: 9.0, div: 4.82, mos: 20, label: 'Konsens EPS' },
    'ZURN.SW': { eps: 40.30, growth: 6.0, pe: 14.0, pe10: 13.0, mos: 15, label: 'Konsens EPS 2026 (CHF)' },
    'ZURN': { eps: 40.30, growth: 6.0, pe: 14.0, pe10: 13.0, mos: 15, label: 'Konsens EPS 2026 (CHF)' },
    'BRK-B': { eps: 25.0, growth: 7.5, pe: 18.0, pe10: 16.5, div: 0, mos: 15, label: 'Look-Through EPS 2026' },
    'BRK.B': { eps: 25.0, growth: 7.5, pe: 18.0, pe10: 16.5, div: 0, mos: 15, label: 'Look-Through EPS 2026' },
    'TSLA': { eps: 3.50, growth: 22.0, pe: 38.0, pe10: 30.0, div: 0, mos: 20, label: 'Konsens EPS (Forward 2025/26)' },
    'SPCX': { eps: 1.77, growth: 25.0, pe: 25.0, pe10: 20.0, div: 0, mos: 20, label: 'Konsens EPS Forward 2027' },
    'ANT': { eps: 1.15, growth: 25.0, pe: 25.0, pe10: 20.0, div: 0, mos: 20, label: 'Konsens EPS Forward 2027' },
    'NVDA': { eps: 4.80, growth: 18.0, pe: 20.0, pe10: 17.0, div: 0, mos: 20, label: 'Konsens EPS (Forward FY26)' },
    'NVD.DE': { eps: 4.45, growth: 18.0, pe: 20.0, pe10: 17.0, div: 0, mos: 20, label: 'Konsens EPS in EUR' },
    'CVX': { eps: 14.00, growth: 4.5, pe: 13.0, pe10: 11.5, mos: 15, label: 'Mid-Cycle EPS (Normalisiert)' },
    'XOM': { eps: 13.40, growth: 4.5, pe: 13.0, pe10: 11.5, mos: 15, label: 'Mid-Cycle EPS (Normalisiert)' },
    'COP': { eps: 11.70, growth: 4.5, pe: 12.5, pe10: 11.0, mos: 15, label: 'Mid-Cycle EPS (Normalisiert)' },
    'SHEL': { eps: 10.50, growth: 3.5, pe: 10.0, pe10: 9.0, mos: 20, label: 'Mid-Cycle ADR USD (2:1)' },
    'SHEL.L': { eps: 4.20, growth: 3.5, pe: 10.0, pe10: 9.0, mos: 20, label: 'Mid-Cycle (Europa-KGV GBP)' },
    'R6C0.DE': { eps: 4.80, growth: 3.5, pe: 10.0, pe10: 9.0, mos: 20, label: 'Mid-Cycle (Europa-KGV EUR)' },
    'TTE': { eps: 10.80, growth: 3.5, pe: 8.5, pe10: 8.0, mos: 20, label: 'Mid-Cycle ADR USD' },
    'TTE.PA': { eps: 8.80, growth: 3.5, pe: 8.5, pe10: 8.0, mos: 20, label: 'Mid-Cycle (Europa-KGV EUR)' },
    'BP.L': { eps: 0.75, growth: 3.0, pe: 9.0, pe10: 8.5, mos: 20, label: 'Mid-Cycle RC Profit (GBP)' },
    'BP': { eps: 5.50, growth: 3.0, pe: 9.0, pe10: 8.5, mos: 20, label: 'Mid-Cycle RC Profit (ADR USD)' },
    'PBR-A': { eps: 3.70, growth: 2.0, pe: 4.5, pe10: 4.0, mos: 25, label: 'TTM ADR USD (Normalisiert)' },
    'PBR': { eps: 3.70, growth: 2.0, pe: 4.5, pe10: 4.0, mos: 25, label: 'TTM ADR USD (Normalisiert)' },
    'LOGN.SW': { eps: 4.10, growth: 6.0, pe: 17.5, pe10: 15.5, div: 1.66, mos: 20, label: 'TTM in CHF (USD 5.45 umgerechnet)' },
    'LOGI': { eps: 5.45, growth: 6.0, pe: 17.5, pe10: 15.5, div: 1.66, mos: 20, label: 'TTM in USD (Berichtswährung)' },
    'ALC.SW': { eps: 2.68, growth: 9.5, pe: 20.0, pe10: 18.0, div: 0.49, mos: 20, label: 'Core EPS in CHF ($3.05 USD)' },
    'ALC': { eps: 3.05, growth: 9.5, pe: 20.0, pe10: 18.0, div: 0.49, mos: 20, label: 'Core EPS in USD (FY2024)' },
    'TSM': { eps: 16.50, growth: 18.0, pe: 22.0, pe10: 18.5, div: 1.15, mos: 20, label: 'ADR USD (Bereinigt)' },
    'NVO': { eps: 3.85, growth: 13.0, pe: 20.0, pe10: 18.0, div: 4.5, mos: 15, label: 'ADR USD (Bereinigt DKK/USD)' },
    'NOVO-B.CO': { eps: 26.5, growth: 13.0, pe: 20.0, pe10: 18.0, div: 4.5, mos: 15, label: 'DKK (Kopenhagen)' },
};

export const WIDE_MOAT_QUALITY = new Set([
    'AAPL', 'MSFT', 'GOOGL', 'GOOG', 'AMZN', 'NVDA', 'META', 'TSLA', 'V', 'MA',
    'ABEA.DE', 'ABEC.DE', 'ABEA', 'ABEC', 'APC.DE', 'APC', 'MSF.DE', 'MSF', 'AMZ.DE', 'AMZ', 'NVD.DE', 'NVD', 'FB2A.DE', 'FB2A', 'TL0.DE', 'TL0',
    'PG', 'KO', 'PEP', 'JNJ', 'MCD', 'COST', 'WMT', 'ABBV', 'LLY', 'UNH', 'HD', 'NVO', 'NOVO-B.CO',
    'ASML.AS', 'ASML', 'SAP.DE', 'SAP', 'NESN.SW', 'ROG.SW', 'NOVN.SW', 'LIN', 'OR.PA',
    'SREN.SW', 'SREN', 'ZURN.SW', 'ZURN',
    'BRK-B', 'BRK.B', 'BRK-A', 'BRK.A'
]);

export type EtfDistributionType = 'accumulating' | 'distributing';

export interface EtfPreset {
    distribution: EtfDistributionType;
    eps: number;
    baseCurrency?: 'USD' | 'EUR' | 'CHF' | 'GBP';
    quoteCurrency?: 'USD' | 'EUR' | 'CHF' | 'GBP';
    asOf?: string; // YYYY-MM (z.B. '2026-11')
    growthA: number;
    growthB: number;
    peA: number;
    peB: number;
    pe5A: number;
    pe5B: number;
    fallbackDiv?: number;
    label: string;
}

export interface EtfPresetStatus {
    hasPreset: boolean;
    asOfLabel?: string; // z.B. 'Stand 11.2026'
    ageMonths?: number;
    isStaleWarning?: boolean; // >= 6 Monate
    isGrowthCapped?: boolean; // >= 12 Monate (Wachstums-Deckel erreicht)
    baseCurrency?: string;
    quoteCurrency?: string;
    fxConverted?: boolean;
}

const ETF_PRESET_DEFAULT_AS_OF = '2026-11';
// Echter Live-Referenzkurs am Kalibrierungstag (Stand 11.2026: 1 CHF = 1.1865 USD bzw. 1 USD = 0.8428 CHF; 1 CHF = 1.084 EUR)
// Damit ergibt die Rückrechnung USD -> CHF am Kalibrierungstag exakt den kalibrierten CHF-Kurs (z.B. USDV.SW = 4.50 CHF -> Kauflimit 68.41 CHF).
const ETF_PRESET_BASE_USD_PER_CHF = 1.1865;
const ETF_PRESET_BASE_EUR_PER_CHF = 1.084;

// Curated 2026 Index-EPS & Distribution Profiles for ETFs (prevents circular price/18 drift and properly separates Dist vs. Acc)
// For CHF/EUR-traded ETFs whose underlying index earns in USD, `eps` is stored in `baseCurrency: 'USD'` and converted live via `rates`.
export const ETF_PRESETS: Record<string, EtfPreset> = {
    // Vanguard FTSE All-World High Dividend Yield (Distributing) - Index in USD
    'VHYL.SW': { distribution: 'distributing', eps: parseFloat((4.85 * ETF_PRESET_BASE_USD_PER_CHF).toFixed(3)), baseCurrency: 'USD', quoteCurrency: 'CHF', asOf: ETF_PRESET_DEFAULT_AS_OF, growthA: 4.5, growthB: 5.0, peA: 13.5, peB: 14.5, pe5A: 14.5, pe5B: 15.5, fallbackDiv: 3.7, label: 'FTSE High Div Index-EPS' },
    'VHYL.AS': { distribution: 'distributing', eps: parseFloat((5.20 * (ETF_PRESET_BASE_USD_PER_CHF / ETF_PRESET_BASE_EUR_PER_CHF)).toFixed(3)), baseCurrency: 'USD', quoteCurrency: 'EUR', asOf: ETF_PRESET_DEFAULT_AS_OF, growthA: 4.5, growthB: 5.0, peA: 13.5, peB: 14.5, pe5A: 14.5, pe5B: 15.5, fallbackDiv: 3.7, label: 'FTSE High Div Index-EPS' },
    'VHYL.L':  { distribution: 'distributing', eps: 5.20, baseCurrency: 'USD', quoteCurrency: 'USD', asOf: ETF_PRESET_DEFAULT_AS_OF, growthA: 4.5, growthB: 5.0, peA: 13.5, peB: 14.5, pe5A: 14.5, pe5B: 15.5, fallbackDiv: 3.7, label: 'FTSE High Div Index-EPS' },
    'VHYL':    { distribution: 'distributing', eps: 5.20, baseCurrency: 'USD', quoteCurrency: 'USD', asOf: ETF_PRESET_DEFAULT_AS_OF, growthA: 4.5, growthB: 5.0, peA: 13.5, peB: 14.5, pe5A: 14.5, pe5B: 15.5, fallbackDiv: 3.7, label: 'FTSE High Div Index-EPS' },

    // Vanguard FTSE All-World (Accumulating / Distributing) - Index in USD
    'VWRA.L':  { distribution: 'accumulating', eps: 9.05, baseCurrency: 'USD', quoteCurrency: 'USD', asOf: ETF_PRESET_DEFAULT_AS_OF, growthA: 8.0, growthB: 8.5, peA: 17.5, peB: 19.0, pe5A: 18.5, pe5B: 20.5, label: 'FTSE All-World Index-EPS' },
    'VWRA.SW': { distribution: 'accumulating', eps: parseFloat((7.60 * ETF_PRESET_BASE_USD_PER_CHF).toFixed(3)), baseCurrency: 'USD', quoteCurrency: 'CHF', asOf: ETF_PRESET_DEFAULT_AS_OF, growthA: 8.0, growthB: 8.5, peA: 17.5, peB: 19.0, pe5A: 18.5, pe5B: 20.5, label: 'FTSE All-World Index-EPS' },
    'VWRA':    { distribution: 'accumulating', eps: 9.05, baseCurrency: 'USD', quoteCurrency: 'USD', asOf: ETF_PRESET_DEFAULT_AS_OF, growthA: 8.0, growthB: 8.5, peA: 17.5, peB: 19.0, pe5A: 18.5, pe5B: 20.5, label: 'FTSE All-World Index-EPS' },
    'VWRL.SW': { distribution: 'distributing', eps: parseFloat((7.35 * ETF_PRESET_BASE_USD_PER_CHF).toFixed(3)), baseCurrency: 'USD', quoteCurrency: 'CHF', asOf: ETF_PRESET_DEFAULT_AS_OF, growthA: 6.5, growthB: 7.0, peA: 17.5, peB: 19.0, pe5A: 18.5, pe5B: 20.5, fallbackDiv: 1.8, label: 'FTSE All-World Index-EPS' },

    // VanEck Morningstar Developed Markets Dividend Leaders (Distributing) - Fondsbasis EUR (TDIV.SW = 3.91 CHF bei 1 CHF = 1.084 EUR -> 4.24 EUR)
    'TDIV.SW': { distribution: 'distributing', eps: parseFloat((3.91 * ETF_PRESET_BASE_EUR_PER_CHF).toFixed(3)), baseCurrency: 'EUR', quoteCurrency: 'CHF', asOf: ETF_PRESET_DEFAULT_AS_OF, growthA: 4.5, growthB: 5.0, peA: 12.0, peB: 13.0, pe5A: 13.0, pe5B: 14.0, fallbackDiv: 3.3, label: 'Dividend Leaders Index-EPS' },
    'TDIV.AS': { distribution: 'distributing', eps: 4.25, baseCurrency: 'EUR', quoteCurrency: 'EUR', asOf: ETF_PRESET_DEFAULT_AS_OF, growthA: 4.5, growthB: 5.0, peA: 12.0, peB: 13.0, pe5A: 13.0, pe5B: 14.0, fallbackDiv: 3.3, label: 'Dividend Leaders Index-EPS' },
    'TDIV':    { distribution: 'distributing', eps: 4.25, baseCurrency: 'EUR', quoteCurrency: 'EUR', asOf: ETF_PRESET_DEFAULT_AS_OF, growthA: 4.5, growthB: 5.0, peA: 12.0, peB: 13.0, pe5A: 13.0, pe5B: 14.0, fallbackDiv: 3.3, label: 'Dividend Leaders Index-EPS' },

    // US Dividend Quality / Aristocrats (Distributing) - Index in USD
    'SCHD':    { distribution: 'distributing', eps: 1.95, baseCurrency: 'USD', quoteCurrency: 'USD', asOf: ETF_PRESET_DEFAULT_AS_OF, growthA: 5.5, growthB: 6.5, peA: 15.0, peB: 16.5, pe5A: 16.0, pe5B: 17.5, fallbackDiv: 3.6, label: 'Dow Jones US Div 100 EPS' },
    'FUSD.SW': { distribution: 'distributing', eps: 0.77, baseCurrency: 'USD', quoteCurrency: 'USD', asOf: ETF_PRESET_DEFAULT_AS_OF, growthA: 6.5, growthB: 7.5, peA: 16.0, peB: 17.5, pe5A: 17.0, pe5B: 18.5, fallbackDiv: 2.3, label: 'US Quality Income Index-EPS' },
    'USDV.SW': { distribution: 'distributing', eps: parseFloat((4.50 * ETF_PRESET_BASE_USD_PER_CHF).toFixed(3)), baseCurrency: 'USD', quoteCurrency: 'CHF', asOf: ETF_PRESET_DEFAULT_AS_OF, growthA: 5.5, growthB: 6.5, peA: 15.0, peB: 16.5, pe5A: 16.0, pe5B: 17.5, fallbackDiv: 2.6, label: 'US Dividend Aristocrats EPS' },

    // L&G Global Quality Dividends (Accumulating) - Index in USD
    'LDGA.SW': { distribution: 'accumulating', eps: 0.75, baseCurrency: 'USD', quoteCurrency: 'USD', asOf: ETF_PRESET_DEFAULT_AS_OF, growthA: 8.0, growthB: 8.5, peA: 14.5, peB: 16.0, pe5A: 15.5, pe5B: 17.0, label: 'Global Quality Div Index-EPS' },
    'LDGL.SW': { distribution: 'accumulating', eps: 0.75, baseCurrency: 'USD', quoteCurrency: 'USD', asOf: ETF_PRESET_DEFAULT_AS_OF, growthA: 8.0, growthB: 8.5, peA: 14.5, peB: 16.0, pe5A: 15.5, pe5B: 17.0, label: 'Global Quality Div Index-EPS' },

    // HSBC MSCI World (Distributing) - Index in USD
    'HMWO.SW': { distribution: 'distributing', eps: 1.80, baseCurrency: 'USD', quoteCurrency: 'CHF', asOf: ETF_PRESET_DEFAULT_AS_OF, growthA: 6.5, growthB: 7.0, peA: 18.0, peB: 19.5, pe5A: 19.0, pe5B: 20.5, fallbackDiv: 1.5, label: 'MSCI World Index-EPS' },
    'HMWO.L':  { distribution: 'distributing', eps: 1.80, baseCurrency: 'USD', quoteCurrency: 'USD', asOf: ETF_PRESET_DEFAULT_AS_OF, growthA: 6.5, growthB: 7.0, peA: 18.0, peB: 19.5, pe5A: 19.0, pe5B: 20.5, fallbackDiv: 1.5, label: 'MSCI World Index-EPS' },

    // iShares World Equity High Income Active (Distributing Option-Income / Covered Call)
    'WINC.AS': { distribution: 'distributing', eps: 0.31, baseCurrency: 'USD', quoteCurrency: 'USD', asOf: ETF_PRESET_DEFAULT_AS_OF, growthA: 1.0, growthB: 1.5, peA: 15.0, peB: 16.0, pe5A: 16.0, pe5B: 17.0, fallbackDiv: 8.5, label: 'Option-Income Portfolio-EPS' },
    'WINC.L':  { distribution: 'distributing', eps: 0.31, baseCurrency: 'USD', quoteCurrency: 'USD', asOf: ETF_PRESET_DEFAULT_AS_OF, growthA: 1.0, growthB: 1.5, peA: 15.0, peB: 16.0, pe5A: 16.0, pe5B: 17.0, fallbackDiv: 8.5, label: 'Option-Income Portfolio-EPS' },

    // iShares Core MSCI World (Accumulating) - Index in USD
    'SWDA.SW': { distribution: 'accumulating', eps: 6.75, baseCurrency: 'USD', quoteCurrency: 'USD', asOf: ETF_PRESET_DEFAULT_AS_OF, growthA: 8.0, growthB: 8.5, peA: 18.0, peB: 19.5, pe5A: 19.0, pe5B: 20.5, label: 'MSCI World Index-EPS' },
    'IWDA.L':  { distribution: 'accumulating', eps: 6.75, baseCurrency: 'USD', quoteCurrency: 'USD', asOf: ETF_PRESET_DEFAULT_AS_OF, growthA: 8.0, growthB: 8.5, peA: 18.0, peB: 19.5, pe5A: 19.0, pe5B: 20.5, label: 'MSCI World Index-EPS' },
    'IWDA.AS': { distribution: 'accumulating', eps: parseFloat((6.75 * (ETF_PRESET_BASE_USD_PER_CHF / ETF_PRESET_BASE_EUR_PER_CHF)).toFixed(3)), baseCurrency: 'USD', quoteCurrency: 'EUR', asOf: ETF_PRESET_DEFAULT_AS_OF, growthA: 8.0, growthB: 8.5, peA: 18.0, peB: 19.5, pe5A: 19.0, pe5B: 20.5, label: 'MSCI World Index-EPS' },
    'SWDA.L':  { distribution: 'accumulating', eps: 6.75, baseCurrency: 'USD', quoteCurrency: 'USD', asOf: ETF_PRESET_DEFAULT_AS_OF, growthA: 8.0, growthB: 8.5, peA: 18.0, peB: 19.5, pe5A: 19.0, pe5B: 20.5, label: 'MSCI World Index-EPS' },

    // iShares S&P 500 Energy Sector (Accumulating) - Index in USD
    'IUES.L':  { distribution: 'accumulating', eps: 0.96, baseCurrency: 'USD', quoteCurrency: 'USD', asOf: ETF_PRESET_DEFAULT_AS_OF, growthA: 7.5, growthB: 8.0, peA: 12.5, peB: 14.0, pe5A: 13.5, pe5B: 15.0, label: 'S&P 500 Energy Mid-Cycle EPS' },
    'IUES.SW': { distribution: 'accumulating', eps: 0.96, baseCurrency: 'USD', quoteCurrency: 'USD', asOf: ETF_PRESET_DEFAULT_AS_OF, growthA: 7.5, growthB: 8.0, peA: 12.5, peB: 14.0, pe5A: 13.5, pe5B: 15.0, label: 'S&P 500 Energy Mid-Cycle EPS' },

    // S&P 500 ETFs (Distributing / Accumulating) - Index in USD
    'VOO':     { distribution: 'distributing', eps: 30.25, baseCurrency: 'USD', quoteCurrency: 'USD', asOf: ETF_PRESET_DEFAULT_AS_OF, growthA: 7.5, growthB: 8.5, peA: 19.0, peB: 20.5, pe5A: 20.0, pe5B: 22.0, fallbackDiv: 1.2, label: 'S&P 500 Index-EPS' },
    'VUSA.SW': { distribution: 'distributing', eps: parseFloat((5.35 * ETF_PRESET_BASE_USD_PER_CHF).toFixed(3)), baseCurrency: 'USD', quoteCurrency: 'CHF', asOf: ETF_PRESET_DEFAULT_AS_OF, growthA: 7.5, growthB: 8.5, peA: 19.0, peB: 20.5, pe5A: 20.0, pe5B: 22.0, fallbackDiv: 1.2, label: 'S&P 500 Index-EPS' },
    'CSSPX.SW':{ distribution: 'accumulating', eps: 36.30, baseCurrency: 'USD', quoteCurrency: 'USD', asOf: ETF_PRESET_DEFAULT_AS_OF, growthA: 8.5, growthB: 9.5, peA: 19.0, peB: 20.5, pe5A: 20.0, pe5B: 22.0, label: 'S&P 500 Index-EPS' },

    // NASDAQ 100 ETFs (Accumulating / Distributing) - Index in USD
    'CSNDX.SW':{ distribution: 'accumulating', eps: 60.25, baseCurrency: 'USD', quoteCurrency: 'USD', asOf: ETF_PRESET_DEFAULT_AS_OF, growthA: 10.5, growthB: 11.5, peA: 20.0, peB: 23.0, pe5A: 22.0, pe5B: 25.0, label: 'NASDAQ-100 Index-EPS' },
    'SXRV.DE': { distribution: 'accumulating', eps: parseFloat((60.25 * (ETF_PRESET_BASE_USD_PER_CHF / ETF_PRESET_BASE_EUR_PER_CHF)).toFixed(3)), baseCurrency: 'USD', quoteCurrency: 'EUR', asOf: ETF_PRESET_DEFAULT_AS_OF, growthA: 10.5, growthB: 11.5, peA: 20.0, peB: 23.0, pe5A: 22.0, pe5B: 25.0, label: 'NASDAQ-100 Index-EPS' },
    'EQQQ.SW': { distribution: 'distributing', eps: 26.75, baseCurrency: 'USD', quoteCurrency: 'USD', asOf: ETF_PRESET_DEFAULT_AS_OF, growthA: 10.0, growthB: 11.0, peA: 20.0, peB: 23.0, pe5A: 22.0, pe5B: 25.0, fallbackDiv: 0.55, label: 'NASDAQ-100 Index-EPS' },
    'EQQQ.DE': { distribution: 'distributing', eps: parseFloat((26.75 * (ETF_PRESET_BASE_USD_PER_CHF / ETF_PRESET_BASE_EUR_PER_CHF)).toFixed(3)), baseCurrency: 'USD', quoteCurrency: 'EUR', asOf: ETF_PRESET_DEFAULT_AS_OF, growthA: 10.0, growthB: 11.0, peA: 20.0, peB: 23.0, pe5A: 22.0, pe5B: 25.0, fallbackDiv: 0.30, label: 'NASDAQ-100 Index-EPS' },
    'QQQ':     { distribution: 'distributing', eps: 25.90, baseCurrency: 'USD', quoteCurrency: 'USD', asOf: ETF_PRESET_DEFAULT_AS_OF, growthA: 10.0, growthB: 11.0, peA: 20.0, peB: 23.0, pe5A: 22.0, pe5B: 25.0, fallbackDiv: 0.55, label: 'NASDAQ-100 Index-EPS' },
    'VWCE.DE': { distribution: 'accumulating', eps: parseFloat((9.05 * (ETF_PRESET_BASE_USD_PER_CHF / ETF_PRESET_BASE_EUR_PER_CHF)).toFixed(3)), baseCurrency: 'USD', quoteCurrency: 'EUR', asOf: ETF_PRESET_DEFAULT_AS_OF, growthA: 8.0, growthB: 8.5, peA: 17.5, peB: 19.0, pe5A: 18.5, pe5B: 20.5, label: 'FTSE All-World Index-EPS' },
};

/**
 * Resolves an ETF preset's EPS dynamically:
 * 1. Applies damped automatic growth (min(growthA, 5% p.a.)), strictly capped at max 12 months since `asOf`.
 * 2. Converts from `baseCurrency` (e.g. USD) to `targetQuoteCurrency` (e.g. CHF) using live CHF-based `rates`.
 * 3. Computes freshness metadata (`asOfLabel`, `ageMonths`, `isStaleWarning >= 6M`, `isGrowthCapped >= 12M`).
 */
export function resolveEtfPresetEps(
    preset: EtfPreset,
    targetQuoteCurrency?: string | null,
    rates?: Record<string, number> | null
): { eps: number; status: EtfPresetStatus } {
    const asOf = preset.asOf || ETF_PRESET_DEFAULT_AS_OF;
    const [yearStr, monthStr] = asOf.split('-');
    const asOfYear = parseInt(yearStr, 10) || 2026;
    const asOfMonth = parseInt(monthStr, 10) || 11;
    const asOfLabel = `Stand ${String(asOfMonth).padStart(2, '0')}.${asOfYear}`;

    const now = new Date();
    const rawMonths = (now.getFullYear() - asOfYear) * 12 + ((now.getMonth() + 1) - asOfMonth);
    const ageMonths = Math.max(0, rawMonths);
    const effectiveGrowthMonths = Math.min(12, ageMonths); // Strictly capped at 12 months!
    const isStaleWarning = ageMonths >= 6;
    const isGrowthCapped = ageMonths >= 12;

    // Conservative damped growth rate for auto-progression (max 5.0% p.a.)
    const dampedAnnualGrowthPct = Math.min(preset.growthA, 5.0);
    const growthFactor = effectiveGrowthMonths > 0
        ? Math.pow(1 + dampedAnnualGrowthPct / 100, effectiveGrowthMonths / 12)
        : 1;

    let workingEps = preset.eps * growthFactor;

    const baseCur = (preset.baseCurrency || 'USD').toUpperCase();
    const rawTarget = (targetQuoteCurrency || preset.quoteCurrency || baseCur).toUpperCase();
    const quoteCur = (rawTarget === 'GBP' || rawTarget === 'GBX') ? 'GBP' : rawTarget;

    // Preserve special HMWO.SW calibration if quote is around ~35 CHF (1.80 was calibrated directly in CHF)
    let fxConverted = false;
    if (baseCur !== quoteCur && !(preset.label === 'MSCI World Index-EPS' && preset.eps === 1.80)) {
        const effectiveRates: Record<string, number> = {
            CHF: 1.0,
            USD: rates?.USD && rates.USD > 0 ? rates.USD : ETF_PRESET_BASE_USD_PER_CHF,
            EUR: rates?.EUR && rates.EUR > 0 ? rates.EUR : ETF_PRESET_BASE_EUR_PER_CHF,
            GBP: rates?.GBP && rates.GBP > 0 ? rates.GBP : 0.90,
        };
        const rBase = effectiveRates[baseCur];
        const rQuote = effectiveRates[quoteCur];
        if (rBase && rQuote && rBase > 0) {
            workingEps = workingEps * (rQuote / rBase);
            fxConverted = true;
        }
    }

    return {
        eps: parseFloat(workingEps.toFixed(2)),
        status: {
            hasPreset: true,
            asOfLabel,
            ageMonths,
            isStaleWarning,
            isGrowthCapped,
            baseCurrency: baseCur,
            quoteCurrency: quoteCur,
            fxConverted
        }
    };
}

const KNOWN_ACC_ETF_PREFIXES = new Set([
    'VWRA', 'VWCE', 'IWDA', 'SWDA', 'EUNL', 'CSPX', 'CSSPX', 'VUAA', 'CSNDX', 'CNDX', 'SXRV', 'LDGA', 'LDGL', 'IUES', 'VHYA'
]);

export function getEtfDistributionType(
    stockObj?: any,
    qData?: any,
    symbolStr?: string | null,
    dividendYield?: number
): EtfDistributionType {
    const symUpper = (symbolStr || stockObj?.symbol || qData?.symbol || '').toUpperCase();
    if (ETF_PRESETS[symUpper]) {
        return ETF_PRESETS[symUpper].distribution;
    }
    const baseSym = symUpper.split('.')[0];
    if (KNOWN_ACC_ETF_PREFIXES.has(baseSym)) {
        return 'accumulating';
    }
    const name = (stockObj?.name || qData?.shortName || qData?.longName || qData?.name || '').toLowerCase();
    if (/\b(acc|accumulating|thesaurierend)\b/.test(name) || name.includes('(acc)')) {
        return 'accumulating';
    }
    if (/\b(dist|distributing|ausschüttend|inc|income)\b/.test(name) || name.includes('(dist)')) {
        return 'distributing';
    }
    const effDiv = dividendYield ?? stockObj?.dividendYield ?? qData?.dividendYield ?? 0;
    return Number(effDiv) > 0.2 ? 'distributing' : 'accumulating';
}

export function isEtfAsset(stockObj?: any, qData?: any, symbolStr?: string | null): boolean {
    if (stockObj?.type === 'etf') return true;
    if (qData?.quoteType === 'ETF' || qData?.type === 'etf') return true;
    const symUpper = (symbolStr || stockObj?.symbol || qData?.symbol || '').toUpperCase();
    if (ETF_PRESETS[symUpper]) return true;
    const name = (stockObj?.name || qData?.name || '').toLowerCase();
    const sym = symUpper.toLowerCase();
    if (/\betf\b/.test(name) || name.includes('ucits') || name.includes('ishares') || name.includes('vanguard ftse')) return true;
    if (/\betf\b/.test(sym)) return true;
    return false;
}

const OIL_ENERGY_SYMBOLS = new Set([
    'BP.L', 'BP', 'SHEL.L', 'SHEL', 'R6C0.DE', 'TTE.PA', 'TTE',
    'XOM', 'CVX', 'PBR', 'PBR-A', 'COP', 'OXY', 'EQNR', 'ENI.MI', 'REP.MC',
    'SLB', 'HAL', 'BKR', 'EOG', 'MPC', 'VLO', 'PSX', 'SU', 'CNQ', 'ENB', 'KMI'
]);

export function isOilEnergyStock(stockObj?: any, qData?: any, symbolStr?: string | null): boolean {
    if (isEtfAsset(stockObj, qData, symbolStr)) return false;
    const symUpper = (symbolStr || stockObj?.symbol || qData?.symbol || '').toUpperCase();
    if (OIL_ENERGY_SYMBOLS.has(symUpper)) return true;
    const sectorStr = (qData?.sector || stockObj?.sector || '').toLowerCase();
    if (sectorStr.includes('energie') || sectorStr.includes('energy') || sectorStr.includes('oil') || sectorStr.includes('erdöl') || sectorStr.includes('petroleum')) {
        return true;
    }
    const nameStr = (stockObj?.name || qData?.shortName || qData?.longName || '').toLowerCase();
    if (
        nameStr.includes('petrobras') ||
        nameStr.includes('totalenergies') ||
        nameStr.includes('exxon') ||
        nameStr.includes('chevron') ||
        nameStr.includes('bp p.l.c') ||
        nameStr.includes('shell plc') ||
        nameStr.includes('conocophillips') ||
        nameStr.includes('equinor') ||
        nameStr.includes('occidental petroleum')
    ) {
        return true;
    }
    return false;
}

export function computeSmartAutoParams(
    qData: any,
    aData: any,
    stockObj: any,
    symbolStr: string,
    valuationMode: 'conservative' | 'quality' = 'conservative',
    fxRates?: Record<string, number> | null
) {
    const symUpper = (symbolStr || '').toUpperCase();
    const nameStr = (stockObj?.name || qData?.shortName || qData?.longName || '').toLowerCase();
    const isEtf = isEtfAsset(stockObj, qData, symbolStr);
    const isWideMoat = WIDE_MOAT_QUALITY.has(symUpper) ||
        nameStr.includes('alphabet') || nameStr.includes('google') ||
        nameStr.includes('microsoft') || (nameStr.includes('apple') && !nameStr.includes('hospitality')) ||
        nameStr.includes('amazon.com') || nameStr.includes('nvidia') || nameStr.includes('meta platforms');
    const isQualityMode = valuationMode === 'quality';
    const price = qData?.price || stockObj?.currentPrice || 0;
    const preset = FUNDAMENTAL_FALLBACKS[symUpper];

    // 1. Dividend Yield (%)
    let autoDiv = 0;
    if (preset?.div !== undefined) {
        autoDiv = preset.div;
    } else if (qData?.dividendYield !== null && qData?.dividendYield !== undefined && Number(qData.dividendYield) > 0) {
        autoDiv = Number(qData.dividendYield);
    } else if (qData?.trailingAnnualDividendYield !== null && qData?.trailingAnnualDividendYield !== undefined && Number(qData.trailingAnnualDividendYield) > 0) {
        autoDiv = Number(qData.trailingAnnualDividendYield);
    } else if (qData?.trailingAnnualDividendRate && price > 0) {
        autoDiv = (Number(qData.trailingAnnualDividendRate) / price) * 100;
    } else if (stockObj?.dividendYield !== undefined && Number(stockObj.dividendYield) > 0) {
        autoDiv = Number(stockObj.dividendYield);
    } else if (stockObj?.dividendAmount && price > 0) {
        autoDiv = (Number(stockObj.dividendAmount) / price) * 100;
    }

    // Handle decimal yield if reported as ratio (e.g. 0.003 -> 0.3%) - only for API quotes, never hardcoded preset.div
    if (preset?.div === undefined && autoDiv > 0.0005 && autoDiv < 0.1) {
        autoDiv = autoDiv * 100;
    }

    // Specific fallback for Alphabet (GOOG / GOOGL) if Yahoo still returned 0: Alphabet pays $0.80/yr ($0.20/qtr) ~ 0.3%
    if (autoDiv === 0 && (symUpper === 'GOOG' || symUpper === 'GOOGL' || symUpper === 'ABEA.DE' || symUpper === 'ABEC.DE')) {
        autoDiv = price > 0 ? parseFloat(((0.80 / price) * 100).toFixed(2)) : 0.3;
    }
    // Specific fallback for Zurich Insurance (CHF 30.00 FY25 dividend paid April 2026)
    if (autoDiv === 0 && (symUpper === 'ZURN.SW' || symUpper === 'ZURN')) {
        autoDiv = price > 0 ? parseFloat(((30.0 / price) * 100).toFixed(2)) : 4.62;
    }

    autoDiv = parseFloat(Math.min(Math.max(autoDiv, 0), 25).toFixed(2));

    // Dedicated ETF Valuation Branch: cleanly separates Distributing vs. Accumulating ETFs
    // and uses stable Index-EPS presets (with base-currency FX conversion + 12M-capped damped growth).
    if (isEtf) {
        const etfPreset = ETF_PRESETS[symUpper];
        const etfDistribution = etfPreset
            ? etfPreset.distribution
            : getEtfDistributionType(stockObj, qData, symbolStr, autoDiv);

        const resolvedDiv = etfDistribution === 'accumulating'
            ? 0
            : (autoDiv > 0 ? autoDiv : (etfPreset?.fallbackDiv ?? 0));

        const etfTrailingPe = qData?.trailingPE || stockObj?.trailingPE || null;
        const etfForwardPe = qData?.forwardPE || aData?.forwardPE || stockObj?.forwardPE || null;
        const validIndexPe = (etfForwardPe && etfForwardPe >= 6 && etfForwardPe <= 45)
            ? Number(etfForwardPe)
            : (etfTrailingPe && etfTrailingPe >= 6 && etfTrailingPe <= 45 ? Number(etfTrailingPe) : null);

        const quoteCurrency = qData?.currency || stockObj?.currency || etfPreset?.quoteCurrency || 'USD';
        const resolvedPreset = etfPreset
            ? resolveEtfPresetEps(etfPreset, quoteCurrency, fxRates)
            : null;

        let etfEps = resolvedPreset ? resolvedPreset.eps : 0;
        let etfEpsLabel = etfPreset
            ? etfPreset.label
            : (validIndexPe ? 'Ohne Preset · Index-KGV abgeleitet' : 'Ohne Preset · Kurs / Index-KGV');
        if (!etfPreset && price > 0) {
            const fallbackIndexPe = validIndexPe
                ?? (resolvedDiv >= 7.0 ? 16.0 : resolvedDiv >= 3.0 ? 15.0 : 19.0);
            etfEps = parseFloat((price / fallbackIndexPe).toFixed(2));
        }

        const etfPresetStatus: EtfPresetStatus = resolvedPreset
            ? resolvedPreset.status
            : { hasPreset: false };

        const etfGrowth = etfPreset
            ? (isQualityMode ? etfPreset.growthB : etfPreset.growthA)
            : etfDistribution === 'accumulating'
                ? (isQualityMode ? 8.5 : 8.0)
                : resolvedDiv >= 7.0
                    ? (isQualityMode ? 1.5 : 1.0)
                    : resolvedDiv >= 3.0
                        ? (isQualityMode ? 5.0 : 4.5)
                        : (isQualityMode ? 7.0 : 6.5);

        const etfPe10 = etfPreset
            ? (isQualityMode ? etfPreset.peB : etfPreset.peA)
            : (resolvedDiv >= 3.0 && resolvedDiv < 7.0)
                ? (isQualityMode ? 14.5 : 13.5)
                : (isQualityMode ? 19.0 : 17.5);

        const etfPe5 = etfPreset
            ? (isQualityMode ? etfPreset.pe5B : etfPreset.pe5A)
            : parseFloat((etfPe10 + 1.0).toFixed(1));

        const etfMos = isQualityMode ? 10 : 15;
        const etfGrowthLabel = etfDistribution === 'accumulating'
            ? 'Total Return inkl. Wiederanlage'
            : (resolvedDiv >= 7.0 ? 'Option-Income Kurswachstum' : 'Kurswachstum ohne Dividende');

        return {
            eps: parseFloat(Number(etfEps).toFixed(2)),
            growthRate: etfGrowth,
            pe: etfPe10,
            pe5: etfPe5,
            pe10: etfPe10,
            peHorizon: '10Y' as const,
            dividendYield: parseFloat(Number(resolvedDiv).toFixed(2)),
            discountRate: 8,
            mos: etfMos,
            epsLabel: etfEpsLabel,
            growthLabel: etfGrowthLabel,
            valuationMode,
            isEtf: true,
            etfDistribution,
            etfPresetStatus,
            isOilEnergy: false
        };
    }

    // 2. Smart EPS (protect against negative/zero or restructuring-depressed GAAP/IFRS TTM EPS)
    let trailingPE = qData?.trailingPE || stockObj?.trailingPE || null;
    let forwardPE = qData?.forwardPE || aData?.forwardPE || stockObj?.forwardPE || null;
    const kcv = qData?.kcv || aData?.kcv || stockObj?.kcv || null;

    let rawEps = qData?.eps ?? aData?.eps ?? stockObj?.eps ?? null;
    let epsCurrencySuspect = false;
    // Fix London Stock Exchange (GBp / Pence) 100x P/E distortion (e.g. 1276.71 -> 12.77)
    if (trailingPE && trailingPE > 150 && (symUpper.endsWith('.L') || (price > 0 && rawEps && rawEps > 0 && (price / rawEps) < 60))) {
        trailingPE = trailingPE / 100;
    }
    if (forwardPE && forwardPE > 150 && (symUpper.endsWith('.L') || (price > 0 && rawEps && rawEps > 0 && (price / rawEps) < 60))) {
        forwardPE = forwardPE / 100;
    }

    let forwardEps = qData?.forwardEps ?? stockObj?.forwardEps ?? (price > 0 && forwardPE && forwardPE > 0 ? price / forwardPE : null);

    // Currency guard: EPS reported in a different currency than the quote (e.g. TSM: EPS in TWD, price in USD)
    // yields absurd P/E values (< 4). In that case derive EPS from a plausible P/E in the quote currency.
    if (!preset && price > 0) {
        const plausiblePe = (pe: any) => (pe && isFinite(pe) && pe >= 4 && pe < 200) ? Number(pe) : null;
        if (forwardEps && forwardEps > 0 && price / forwardEps < 4) {
            forwardEps = null;
        }
        if (rawEps && rawEps > 0 && price / rawEps < 4) {
            const peRef = plausiblePe(trailingPE) ?? plausiblePe(forwardPE);
            rawEps = peRef ? price / peRef : null;
            if (!peRef) {
                trailingPE = null;
                forwardPE = null;
            }
            epsCurrencySuspect = true;
        }
        // Write-off / GAAP distortion guard: if rawEps rounds to 0.00 or implies P/E > 150 (e.g. BP.L 0.0034 after impairments),
        // discard it so we fall through to forward/cashflow/market estimation instead of showing EPS = 0 and Fair Value = dividend only.
        if (rawEps && rawEps > 0 && (Number(rawEps.toFixed(2)) <= 0 || price / rawEps > 150)) {
            rawEps = null;
            if (trailingPE && trailingPE > 150) trailingPE = null;
        }
    }

    let autoEps = 0;
    let epsLabel = qData?.epsSource || 'TTM';

    if (symUpper.startsWith('BRK-') || symUpper.startsWith('BRK.') || symUpper === 'BRK') {
        autoEps = preset?.eps || 25.0;
        epsLabel = 'Look-Through EPS (Buffett)';
    } else if (preset) {
        autoEps = preset.eps;
        epsLabel = preset.label;
    } else if (rawEps && rawEps > 0 && (!forwardEps || rawEps >= forwardEps * 0.88)) {
        autoEps = rawEps;
        epsLabel = qData?.epsSource || 'TTM';
    } else if (forwardEps && forwardEps > 0) {
        autoEps = forwardEps;
        epsLabel = 'Forward / Bereinigt';
    } else if (price > 0 && trailingPE && trailingPE > 0) {
        autoEps = price / trailingPE;
        epsLabel = 'Aus KGV berechnet';
    } else if (price > 0 && kcv && kcv > 0 && !epsCurrencySuspect) {
        autoEps = (price / kcv) * 0.75;
        epsLabel = 'Cashflow-Schätzung';
    } else if (price > 0) {
        const estMultiple = autoDiv >= 4.5 ? 11 : autoDiv >= 2.5 ? 16 : 18;
        autoEps = price / estMultiple;
        epsLabel = 'Markt-Schätzung';
    }

    autoEps = parseFloat(Number(autoEps).toFixed(2));
    if (epsCurrencySuspect && !preset) {
        epsLabel = rawEps ? 'Währungs-korrigiert (aus KGV)' : 'Grobe Schätzung (Yahoo-EPS fehlerhaft) – bitte EPS prüfen';
    }

    // Effective P/E for classification
    const effectivePe = (forwardPE && forwardPE > 0)
        ? forwardPE
        : (trailingPE && trailingPE > 0 && trailingPE < 60)
            ? trailingPE
            : (price > 0 && autoEps > 0 ? price / autoEps : 15);

    // 3. Smart 5Y Growth Rate (%)
    const rawApiGrowth = qData?.growthRate ?? aData?.growthRate ?? null;
    let autoGrowth = 6.0;
    let growthLabel = 'Fundamental-Profil';

    if (symUpper === 'TSLA') {
        autoGrowth = isQualityMode ? 26.0 : 22.0;
        growthLabel = isQualityMode ? 'KI / Robotaxi Wachstums-Szenario' : 'Konsens-Prognose';
    } else if (symUpper === 'SPCX') {
        autoGrowth = isQualityMode ? 30.0 : 25.0;
        growthLabel = isQualityMode ? 'Starlink & AI Compute Szenario' : 'Konsens-Prognose · Hyper-Growth';
    } else if (symUpper === 'ANT') {
        autoGrowth = isQualityMode ? 30.0 : 25.0;
        growthLabel = isQualityMode ? 'Enterprise AI / Claude Szenario' : 'Konsens-Prognose · Hyper-Growth';
    } else if (symUpper === 'NVDA' || symUpper === 'NVD.DE') {
        autoGrowth = isQualityMode ? 24.0 : 18.0;
        growthLabel = isQualityMode ? 'KI / Rechenzentren (Markt-Konsens)' : 'Konservative Abkühlung (5J)';
    } else if (preset) {
        autoGrowth = isQualityMode
            ? parseFloat((preset.growth + (preset.growth <= 3.5 ? 1.0 : preset.growth <= 7.0 ? 0.5 : preset.growth >= 18.0 ? 2.0 : 1.0)).toFixed(1))
            : preset.growth;
        growthLabel = isQualityMode ? 'Qualitäts-/Marktprofil' : 'Qualitäts-/Branchenprofil';
    } else if (rawApiGrowth !== null && rawApiGrowth !== undefined && isFinite(rawApiGrowth) && rawApiGrowth !== 0) {
        let apiPct = rawApiGrowth * 100;
        if (autoDiv >= 4.5 && effectivePe < 14) {
            apiPct = Math.min(Math.max(apiPct, 2.5), isQualityMode ? 5.0 : 4.0);
            growthLabel = isQualityMode ? 'Prognose (Markt)' : 'Prognose (Konservativ)';
        } else if (autoDiv >= 3.0 && effectivePe < 18) {
            apiPct = Math.min(Math.max(apiPct, 3.0), isQualityMode ? 8.5 : 7.0);
            growthLabel = isQualityMode ? 'Analysten-Prognose (Markt)' : 'Analysten-Prognose (5J)';
        } else {
            apiPct = Math.min(Math.max(apiPct, 2.5), isQualityMode ? 16.0 : 14.0);
            growthLabel = isQualityMode ? 'Analysten-Prognose (Markt)' : 'Analysten-Prognose (5J)';
        }
        autoGrowth = parseFloat((Math.round(apiPct * 2) / 2).toFixed(1));
    } else {
        if ((autoDiv >= 4.8 && effectivePe <= 14) || effectivePe <= 11.5) {
            autoGrowth = isQualityMode ? 3.5 : 2.5;
            growthLabel = 'Reifer Dividendenwert';
        } else if (autoDiv >= 3.0 && effectivePe <= 17.5) {
            autoGrowth = isQualityMode ? 6.0 : 5.0;
            growthLabel = 'Klassischer Dividendenwert';
        } else if (autoDiv >= 1.5 && effectivePe <= 23) {
            autoGrowth = isQualityMode ? 7.5 : 6.0;
            growthLabel = 'Qualitäts-/Standardwert';
        } else if (effectivePe > 24 && autoDiv < 1.5) {
            autoGrowth = isWideMoat ? (isQualityMode ? 14.5 : 12.5) : (isQualityMode ? 11.5 : 9.5);
            growthLabel = isWideMoat ? 'Wachstumswert (Wide Moat)' : 'Wachstumswert';
        } else if (isWideMoat && autoDiv < 1.5) {
            autoGrowth = isQualityMode ? 14.0 : 12.0;
            growthLabel = isQualityMode ? 'Qualitäts-Wachstum (Wide Moat)' : 'Konsens-Wachstum (Wide Moat)';
        } else {
            autoGrowth = isQualityMode ? 7.0 : 5.5;
            growthLabel = 'Standard-Profil';
        }
    }

    // 4. Smart Exit P/E (Verkaufs-KGV in 5J)
    let rawExitPe = 15;
    if (preset) {
        rawExitPe = preset.pe;
    } else if (trailingPE && trailingPE > 0 && forwardPE && forwardPE > 0) {
        if (trailingPE > forwardPE * 1.4) {
            rawExitPe = forwardPE;
        } else {
            rawExitPe = (trailingPE + forwardPE) / 2;
        }
    } else if (forwardPE && forwardPE > 0) {
        rawExitPe = forwardPE;
    } else if (trailingPE && trailingPE > 0) {
        rawExitPe = trailingPE;
    } else if (price > 0 && autoEps > 0) {
        rawExitPe = price / autoEps;
    }

    // Determine sector characteristics
    const currencyStr = (qData?.currency || stockObj?.currency || '').toUpperCase();
    const sectorStr = (qData?.sector || stockObj?.sector || '').toLowerCase();
    const isDefensiveSector = sectorStr.includes('konsum') || sectorStr.includes('consumer') || sectorStr.includes('nahrung') || sectorStr.includes('pharma') || sectorStr.includes('gesundheit') || sectorStr.includes('health') || sectorStr.includes('versicherung') || sectorStr.includes('insurance') || sectorStr.includes('rückversicherung') || sectorStr.includes('reinsurance');
    const isCyclicalSector = sectorStr.includes('semi') || sectorStr.includes('halbleiter') || sectorStr.includes('auto') || sectorStr.includes('chemie') || sectorStr.includes('basic materials') || sectorStr.includes('rohstoff') || sectorStr.includes('cyclical') || sectorStr.includes('zyklisch');
    const isSwissBlueChip = symUpper.endsWith('.SW') || currencyStr === 'CHF';

    // Caps
    // Mode A (conservative / safety): capped at 20.0 so Terminal Growth strictly <= 2.0%
    // Mode B (quality / market): allows historical quality multiple premium (e.g. 25 for Big Tech compounders, 18.5 for Nestlé)
    let maxSensibleExitPe = isQualityMode ? 25.0 : 20.0;
    if (symUpper === 'TSLA') {
        maxSensibleExitPe = isQualityMode ? 50.0 : 38.0;
    } else if (symUpper === 'SPCX' || symUpper === 'ANT') {
        maxSensibleExitPe = isQualityMode ? 32.0 : 25.0;
    } else if (isWideMoat) {
        // Wide Moat Quality Champions (e.g. Apple, Microsoft, Novo Nordisk, Eli Lilly, Visa, Mastercard)
        maxSensibleExitPe = isQualityMode ? 25.0 : 20.0;
    } else if (autoDiv >= 4.8) {
        // High dividend / mature value (e.g. Tobacco, Utilities, Kraft Heinz, Swiss Re)
        maxSensibleExitPe = isQualityMode ? 13.5 : Math.min(13.0, Math.max(10.0, effectivePe < 14 ? effectivePe : 12.0));
    } else if (autoDiv >= 3.0) {
        // Classic mature defensive dividend stock (e.g. Nestlé, Roche, Novartis, Coca-Cola)
        maxSensibleExitPe = isQualityMode ? 18.5 : Math.min(17.0, Math.max(14.0, effectivePe < 18 ? effectivePe : 16.5));
    } else if (autoDiv >= 1.5) {
        // Quality dividend compounder (e.g. Pepsi, P&G, McD)
        maxSensibleExitPe = isQualityMode ? 20.0 : Math.min(18.5, Math.max(15.0, effectivePe < 20 ? effectivePe : 18.0));
    } else if (effectivePe > 24 && autoDiv < 1.5) {
        // Quality Tech / Growth (e.g. Microsoft, Amazon, Google, Apple)
        maxSensibleExitPe = isQualityMode ? 25.0 : 20.0;
    } else {
        // Standard profile
        maxSensibleExitPe = isQualityMode ? 20.0 : Math.min(18.0, Math.max(14.0, effectivePe));
    }

    if (isQualityMode) {
        if (preset) {
            if (symUpper === 'AMZN' || symUpper === 'MSFT' || symUpper === 'NVDA' || symUpper === 'NVD.DE' || symUpper === 'NVO' || symUpper === 'NOVO-B.CO') {
                rawExitPe = 25.0;
            } else if (symUpper === 'TSLA') {
                rawExitPe = 48.0;
            } else if (symUpper === 'SPCX' || symUpper === 'ANT') {
                rawExitPe = 30.0;
            } else if (symUpper.startsWith('BRK-') || symUpper.startsWith('BRK.') || symUpper === 'BRK') {
                rawExitPe = 20.0;
            } else if (symUpper === 'NESN.SW' || symUpper === 'NESN') {
                rawExitPe = 18.5;
            } else if (symUpper === 'ROG.SW') {
                rawExitPe = 18.0;
            } else if (symUpper.startsWith('SREN')) {
                rawExitPe = 11.5;
            } else if (symUpper.startsWith('ZURN')) {
                rawExitPe = 15.0;
            } else if (symUpper === 'PBR-A' || symUpper === 'PBR') {
                rawExitPe = 5.5;
            } else if (symUpper === 'BP.L' || symUpper === 'BP') {
                rawExitPe = 10.0;
            } else {
                rawExitPe = Math.min(preset.pe + 2.0, maxSensibleExitPe);
            }
        } else {
            // General stocks without preset:
            // Mode B allows a fair normalized quality multiple (+1.5 to 2.5 PE points)
            const qualityBoost = autoDiv >= 4.5 ? 2.0 : isWideMoat ? 3.0 : 2.0;
            const floorMultiple = (isSwissBlueChip || isDefensiveSector) ? 11.5 : 10.0;
            rawExitPe = Math.min(Math.max(rawExitPe + qualityBoost, floorMultiple), maxSensibleExitPe);
        }
    } else {
        if (preset) {
            rawExitPe = preset.pe;
        }
    }

    const minPeFloor = preset && preset.pe < 8 ? preset.pe : 8;
    const autoPe = parseFloat((Math.round(Math.min(Math.max(rawExitPe, minPeFloor), maxSensibleExitPe) * 2) / 2).toFixed(1));

    // Calculate 10-Year historical mean P/E (Long-term cycle mean):
    let autoPe10 = autoPe;
    if (preset?.pe10) {
        if (isQualityMode) {
            // Quality mode gets a moderate cycle premium over safety 10J, but stays disciplined below 5J
            const cycle10 = preset.pe10 + (isWideMoat ? 3.0 : 1.0);
            const minGap = autoPe >= 22 ? 3.0 : autoPe < 8 ? 0.5 : 1.5;
            autoPe10 = Math.min(cycle10, autoPe - minGap);
        } else {
            autoPe10 = Math.min(preset.pe10, maxSensibleExitPe);
        }
    } else if (autoPe >= 22) {
        autoPe10 = parseFloat((Math.round(autoPe * 0.86 * 2) / 2).toFixed(1));
    } else if (autoDiv >= 4.0 || isCyclicalSector) {
        autoPe10 = parseFloat((Math.max(8.0, Math.round((autoPe - 1.0) * 2) / 2)).toFixed(1));
    } else {
        autoPe10 = parseFloat((Math.max(8.5, Math.round((autoPe - 1.5) * 2) / 2)).toFixed(1));
    }

    // Safety guarantee 1: 10-year mean reversion multiple should never exceed 5-year multiple
    const minPe10Floor = preset?.pe10 && preset.pe10 < 8 ? preset.pe10 : 8.0;
    if (autoPe10 > autoPe) {
        autoPe10 = parseFloat((Math.max(minPe10Floor, autoPe - (autoPe < 8 ? 0.5 : 1.5))).toFixed(1));
    }
    // Safety guarantee 2: Ensure 10-year cycle multiple differs meaningfully from 5-year multiple (at least 1.0 to 3.0 points lower)
    if (autoPe10 >= autoPe && autoPe >= 11) {
        autoPe10 = parseFloat((autoPe - (autoPe >= 22 ? 3.0 : autoPe >= 16 ? 2.0 : 1.0)).toFixed(1));
    }
    autoPe10 = parseFloat(Number(autoPe10).toFixed(1));

    // 5. Smart Margin of Safety (10% for ETFs in Quality, 15% for ETFs in Safety / Swiss / wide-moat bluechips, 20% standard, 25% cyclicals)
    let autoMos = 20;
    if (preset?.mos !== undefined) {
        autoMos = isQualityMode
            ? (isSwissBlueChip || isWideMoat ? 15 : preset.mos)
            : (preset.mos <= 15 ? 15 : Math.max(20, preset.mos));
    } else if (isEtf) {
        // Breit diversifizierte ETFs: 10% in Qualität B (praxisnaher Korrektur-Einstieg), 15% in Sicherheit A (strikter Puffer)
        autoMos = isQualityMode ? 10 : 15;
    } else if (isQualityMode && (isSwissBlueChip || isWideMoat || isDefensiveSector)) {
        // In Quality Mode: Top-tier Swiss bluechips, Wide Moats and defensive leaders have 15% Margin of Safety!
        autoMos = 15;
    } else if (isWideMoat || ((isSwissBlueChip || isDefensiveSector) && autoPe >= 14 && autoDiv >= 1.5 && autoDiv <= 4.8)) {
        autoMos = 15;
    } else if (isCyclicalSector) {
        autoMos = 25;
    } else {
        autoMos = 20;
    }

    const isOilEnergy = isOilEnergyStock(stockObj, qData, symbolStr);
    const defaultHorizon: '5Y' | '10Y' = (isEtf || isOilEnergy) ? '10Y' : '5Y';
    const effectiveDefaultPe = (isEtf || isOilEnergy) ? autoPe10 : autoPe;

    return {
        eps: autoEps,
        growthRate: autoGrowth,
        pe: effectiveDefaultPe,
        pe5: autoPe,
        pe10: autoPe10,
        peHorizon: defaultHorizon,
        dividendYield: autoDiv,
        discountRate: 8,
        mos: autoMos,
        epsLabel,
        growthLabel: isQualityMode ? `${growthLabel} (Markt)` : `${growthLabel} (Sicherheit)`,
        valuationMode,
        isEtf,
        etfDistribution: undefined as EtfDistributionType | undefined,
        etfPresetStatus: undefined as EtfPresetStatus | undefined,
        isOilEnergy
    };
}

export function applyRiskModeParams<T extends { growthRate: number; pe: number; pe5?: number; pe10?: number; mos: number }>(base: T) {
    const rawGrowth = parseFloat((base.growthRate * 0.75).toFixed(1));
    const growthRate = base.growthRate <= 3 ? Math.max(0, rawGrowth) : Math.max(3, rawGrowth);
    const scalePe = (v: number) => {
        const floor = v < 8 ? 3.5 : 8;
        return Math.min(20, Math.max(floor, parseFloat((v * 0.8).toFixed(1))));
    };
    const pe = scalePe(base.pe);
    const pe5 = base.pe5 !== undefined ? scalePe(base.pe5) : pe;
    const pe10 = base.pe10 !== undefined ? scalePe(base.pe10) : pe;
    const mos = Math.max(25, Math.min(50, base.mos + 10));
    return {
        ...base,
        growthRate,
        pe,
        pe5,
        pe10,
        mos
    };
}

export function calculateDcfFairValue(
    params: { eps: number; growthRate: number; pe: number; dividendYield?: number; discountRate?: number; mos?: number },
    currentPrice: number
) {
    const valEps = Number(params.eps) || 0;
    const valGrowth = Number(params.growthRate) || 0;
    const valPe = Number(params.pe) || 0;
    const valDiv = Number(params.dividendYield) || 0;
    const valDisc = Number(params.discountRate) || 8;
    const valMos = Number(params.mos) || 20;

    const futureEps = valEps * Math.pow(1 + valGrowth / 100, 5);
    const futurePrice = futureEps * valPe;

    let totalDiscountedDividends = 0;
    if (valDiv > 0 && currentPrice > 0) {
        const initialAnnualDiv = (valDiv / 100) * currentPrice;
        for (let i = 1; i <= 5; i++) {
            const divInYear = initialAnnualDiv * Math.pow(1 + valGrowth / 100, i);
            totalDiscountedDividends += divInYear / Math.pow(1 + valDisc / 100, i);
        }
    }

    const discountedFuturePrice = futurePrice / Math.pow(1 + valDisc / 100, 5);
    const fairValue = discountedFuturePrice + totalDiscountedDividends;
    const buyPrice = fairValue * (1 - valMos / 100);

    return {
        fairValue,
        buyPrice,
        futurePrice,
        futureEps,
        exitPe: valPe,
        mos: valMos
    };
}

/**
 * Converts EPS values reported in the company's reporting currency (e.g. USD for Logitech/Alcon)
 * into the quote currency (e.g. CHF), using CHF-based exchange rates (units of currency per 1 CHF).
 * Returns the (possibly adjusted) quote/analysis copies; unchanged if no conversion is needed/possible.
 */
export function adjustForReportingCurrency(
    quote: any,
    analysis: any,
    rates: Record<string, number> | undefined,
    symbol?: string
): { quote: any; analysis: any } {
    try {
        if (!quote || !rates) return { quote, analysis };
        const norm = (c: any) => {
            const u = String(c || '').trim();
            if (u === 'GBp' || u === 'GBX') return 'GBP';
            return u.toUpperCase();
        };
        const quoteCurRaw = String(quote.currency || '');
        if (quoteCurRaw === 'GBp' || quoteCurRaw === 'GBX') return { quote, analysis };
        const qc = norm(quote.currency);
        const fc = REPORTING_CURRENCY_OVERRIDES[String(symbol || quote.symbol || '').toUpperCase()] || norm(analysis?.currency);
        if (!qc || !fc || qc === fc) return { quote, analysis };
        if (String(quote.epsSource || '').includes('?')) return { quote, analysis }; // already converted by server
        const rateQ = qc === 'CHF' ? 1 : rates[qc];
        const rateF = fc === 'CHF' ? 1 : rates[fc];
        if (!rateQ || !rateF || !isFinite(rateQ) || !isFinite(rateF)) return { quote, analysis };
        const factor = rateQ / rateF;
        const conv = (v: any) => (typeof v === 'number' && isFinite(v) && v > 0) ? v * factor : v;

        const q2 = { ...quote };
        const a2 = { ...(analysis || {}) };
        const price = Number(quote.price || analysis?.price || 0);
        if (q2.eps) q2.eps = conv(q2.eps);
        if (q2.epsTrailingTwelveMonths) q2.epsTrailingTwelveMonths = conv(q2.epsTrailingTwelveMonths);
        if (q2.forwardEps) q2.forwardEps = conv(q2.forwardEps);
        if (a2.eps) a2.eps = conv(a2.eps);
        if (price > 0 && q2.eps > 0) q2.trailingPE = price / q2.eps;
        q2.epsSource = `${q2.epsSource || 'TTM'} (${fc}?${qc})`;
        return { quote: q2, analysis: a2 };
    } catch {
        return { quote, analysis };
    }
}

// Reporting-currency overrides for EPS conversion. Intentionally empty: Yahoo already delivers CHF-denominated
// EPS for .SW listings (e.g. ALC.SW). Only add symbols here after verifying that Yahoo's EPS is in the reporting currency.
export const REPORTING_CURRENCY_OVERRIDES: Record<string, string> = {};


export interface SupportZone {
    id: 'zone1' | 'zone2' | 'zone3';
    title: string;
    level: string;
    minPrice: number;
    maxPrice: number;
    targetPrice: number;
    distancePct: number;
    status: 'above' | 'in_range' | 'below';
    description: string;
    buttonLabel: string;
    badgeText?: string;
}

export function computeStockSupportZones(params: {
    currentPrice: number;
    dcfSafety?: { fairValue: number; buyPrice: number } | null;
    dcfQuality?: { fairValue: number; buyPrice: number } | null;
    fiftyDayAverage?: number | null;
    twoHundredDayAverage?: number | null;
    fiftyTwoWeekHigh?: number | null;
    fiftyTwoWeekLow?: number | null;
}): SupportZone[] {
    const price = Number(params.currentPrice) || 0;
    if (price <= 0) return [];

    const safetyBuy = params.dcfSafety?.buyPrice && params.dcfSafety.buyPrice > 0 ? params.dcfSafety.buyPrice : 0;
    const safetyFair = params.dcfSafety?.fairValue && params.dcfSafety.fairValue > 0 ? params.dcfSafety.fairValue : 0;
    const qualityBuy = params.dcfQuality?.buyPrice && params.dcfQuality.buyPrice > 0 ? params.dcfQuality.buyPrice : 0;
    const gd50 = params.fiftyDayAverage && params.fiftyDayAverage > 0 ? params.fiftyDayAverage : null;
    const gd200 = params.twoHundredDayAverage && params.twoHundredDayAverage > 0 ? params.twoHundredDayAverage : null;
    const low52 = params.fiftyTwoWeekLow && params.fiftyTwoWeekLow > 0 ? params.fiftyTwoWeekLow : null;

    const roundBand = (val: number) => {
        const clamped = Math.max(0.01, val);
        return price >= 10
            ? Math.round(clamped * 10) / 10
            : Math.round(clamped * 100) / 100;
    };

    // --- ZONE 2: Starke Unterstützung (Nachkauf / 2. Tranche, typisch -10% bis -30%) ---
    // Priorität: GD200 -> 52-Wochen-Tief (sofern nicht tiefer Crash ab -28%) ->
    // Qualität-B-Kauflimit -> Sicherheit-A-Kauflimit (wenn 52W-Tief noch tiefer liegt) -> -20% Rücksetzer
    let anchor2: number;
    let zone2Source: 'gd200' | 'low52' | 'quality' | 'safetyBuy' | 'fallback';
    if (gd200 && gd200 >= price * 0.68 && gd200 <= price * 0.93) {
        anchor2 = gd200;
        zone2Source = 'gd200';
    } else if (low52 && low52 >= price * 0.72 && low52 <= price * 0.89) {
        anchor2 = low52;
        zone2Source = 'low52';
    } else if (qualityBuy > 0 && qualityBuy >= price * 0.68 && qualityBuy <= price * 0.91) {
        anchor2 = qualityBuy;
        zone2Source = 'quality';
    } else if (safetyBuy > 0 && safetyBuy >= price * 0.68 && safetyBuy <= price * 0.88) {
        anchor2 = safetyBuy;
        zone2Source = 'safetyBuy';
    } else {
        anchor2 = price * 0.80;
        zone2Source = 'fallback';
    }

    // --- ZONE 3: Panik- / Crash-Zone (Maximaler Kapitalschutz) ---
    // Basis: Strikte Sicherheit A (falls noch nicht Zone 2 & im Crash-Korridor ab -60%),
    // sonst tiefes 52W-Tief (falls nicht schon Zone 2), sonst Bärenmarkt-Drawdown unter Zone 2.
    let anchor3: number;
    let zone3Source: 'safety' | 'low52' | 'crash_ipo' | 'fallback';
    if (zone2Source !== 'safetyBuy' && safetyBuy > 0 && safetyBuy >= price * 0.40 && safetyBuy <= anchor2 * 0.92) {
        anchor3 = safetyBuy;
        zone3Source = 'safety';
    } else if (zone2Source !== 'low52' && low52 && low52 >= price * 0.40 && low52 <= anchor2 * 0.92) {
        anchor3 = low52;
        zone3Source = 'low52';
    } else {
        anchor3 = Math.min(anchor2 * 0.82, price * 0.68);
        zone3Source = (safetyBuy > 0 && safetyBuy < price * 0.40) ? 'crash_ipo' : 'fallback';
    }

    // Plausibilitätscheck: Zone 3 klar unter Zone 2 und nie über 85% vom Kurs
    if (anchor3 > price * 0.85) {
        anchor3 = Math.min(anchor3, price * 0.82);
    }
    if (anchor3 > anchor2 * 0.92) {
        anchor3 = anchor2 * 0.85;
    }

    // --- ZONE 1: Erste Unterstützung (Moderater Rücksetzer / 1. Tranche) ---
    // Priorität: GD50 -> nahes 52-Wochen-Tief -> Fairer Wert / Kauflimit A im Rücksetzer-Band -> -12% Rücksetzer
    let anchor1: number;
    let zone1Source: 'gd50' | 'low52' | 'fair' | 'safetyBuy' | 'fallback';
    if (gd50 && gd50 > anchor2 * 1.05 && gd50 <= price * 0.98) {
        anchor1 = gd50;
        zone1Source = 'gd50';
    } else if (zone2Source !== 'low52' && low52 && low52 > anchor2 * 1.05 && low52 <= price * 1.02) {
        anchor1 = low52;
        zone1Source = 'low52';
    } else if (safetyFair > 0 && safetyFair > anchor2 * 1.05 && safetyFair <= price * 0.97) {
        anchor1 = safetyFair;
        zone1Source = 'fair';
    } else if (zone2Source !== 'safetyBuy' && safetyBuy > 0 && safetyBuy > anchor2 * 1.05 && safetyBuy <= price * 0.97) {
        anchor1 = safetyBuy;
        zone1Source = 'safetyBuy';
    } else {
        anchor1 = Math.max(anchor2 * 1.08, price * 0.88);
        zone1Source = 'fallback';
    }

    // Sicherheitsabstand zu Zone 2 garantieren
    if (anchor1 <= anchor2 * 1.04) {
        anchor1 = (anchor2 + price) / 2;
    }
    if (zone1Source !== 'low52' && anchor1 > price * 0.98) {
        anchor1 = Math.max(anchor2 * 1.04, (anchor2 + price) / 2);
    }

    // Nahtlose, lückenlose Kaufzonen (Zone 1 → Zone 2 → Zone 3 schließen exakt aneinander an)
    const step = price >= 10 ? 0.1 : 0.01;
    const boundary12 = roundBand((anchor1 + anchor2) / 2);
    const rawBoundary23 = roundBand((anchor2 + anchor3) / 2);
    const boundary23 = Math.max(0.02, Math.min(rawBoundary23, boundary12 - step));

    const max1 = Math.max(roundBand(anchor1 * 1.02), boundary12 + step);
    const min1 = boundary12;
    const target1 = parseFloat(anchor1.toFixed(2));

    const max2 = boundary12;
    const min2 = boundary23;
    const target2 = parseFloat(anchor2.toFixed(2));

    const max3 = boundary23;
    const min3 = Math.max(0.01, Math.min(roundBand(anchor3 * 0.92), boundary23 - step));
    const target3 = parseFloat(anchor3.toFixed(2));

    const zone1Desc = zone1Source === 'gd50'
        ? 'Gesunder Rücksetzer an der GD50. Ideal für eine erste Position oder Trend-Käufe.'
        : zone1Source === 'low52'
            ? 'Erste Chart-Unterstützung rund um das 52-Wochen-Tief. Ideal für eine gestaffelte 1. Tranche.'
            : zone1Source === 'fair'
                ? 'Moderater Rücksetzer in Richtung Fairer Wert Sicherheit A. Solider Bereich für die 1. Tranche.'
                : zone1Source === 'safetyBuy'
                    ? 'Attraktiver Rücksetzer am Kauflimit Sicherheit A. Ideal für die 1. Tranche.'
                    : 'Gesunder Rücksetzer (-10 % bis -15 % oder GD50). Ideal für eine erste Position oder Trend-Käufe.';

    const zone2Desc = zone2Source === 'gd200'
        ? 'Solider Rebound-Bereich an der GD200. Hier greifen Grossanleger und Value-Fonds wieder zu.'
        : zone2Source === 'low52'
            ? 'Solider Rebound-Bereich am 52-Wochen-Tief. Wichtige Chart-Unterstützung für die 2. Tranche.'
            : zone2Source === 'quality'
                ? 'Solider Rebound-Bereich am Kauflimit Qualität B. Hier greifen Grossanleger und Value-Fonds wieder zu.'
                : zone2Source === 'safetyBuy'
                    ? 'Solider Nachkauf-Bereich rund um das Kauflimit Sicherheit A. Attraktive Zone für die 2. Tranche.'
                    : 'Solider Rebound-Bereich (-20 % Korrektur / Mittelwert). Hier greifen Grossanleger und Value-Fonds wieder zu.';

    const zone3Desc = zone3Source === 'safety'
        ? 'Entspricht dem strikten Kauflimit aus Sicherheit A. Historische Ausverkaufs- und Panikpreise.'
        : zone3Source === 'low52'
            ? 'Tiefer Ausverkaufsbereich am 52-Wochen-Tief. Maximaler Kapitalschutz bei stärkeren Marktdellen.'
            : zone3Source === 'crash_ipo'
                ? 'Tiefer Ausverkaufs- und Crash-Bereich unter dem 52W-Tief. Strenges Value-Modell A liegt bei Wachstums-Titeln tiefer.'
                : 'Historischer Bärenmarkt- und Panikbereich (-30 % bis -35 % vom Kurs). Maximaler Kapitalschutz.';

    const buildZone = (
        id: 'zone1' | 'zone2' | 'zone3',
        level: string,
        title: string,
        minP: number,
        maxP: number,
        targetP: number,
        desc: string,
        btnLabel: string
    ): SupportZone => {
        const distPct = parseFloat((((targetP - price) / price) * 100).toFixed(1));
        let status: 'above' | 'in_range' | 'below' = 'above';
        let badgeText: string | undefined;

        if (id === 'zone3') {
            if (price <= maxP && price >= minP) {
                status = 'in_range';
                badgeText = '🟢 Aktuell in dieser Zone!';
            } else if (price < minP) {
                status = 'below';
                badgeText = '⚡ Bereits unterboten (Stark korrigiert)';
            }
        } else {
            if (price > minP && price <= maxP) {
                status = 'in_range';
                badgeText = '🟢 Aktuell in dieser Zone!';
            } else if (price <= minP) {
                status = 'below';
            }
        }

        return {
            id,
            level,
            title,
            minPrice: minP,
            maxPrice: maxP,
            targetPrice: targetP,
            distancePct: distPct,
            status,
            description: desc,
            buttonLabel: btnLabel,
            badgeText
        };
    };

    return [
        buildZone(
            'zone1',
            '1. Erste Unterstützung',
            'Moderater Rücksetzer · 1. Tranche',
            min1,
            max1,
            target1,
            zone1Desc,
            'Als 1. Tranche setzen'
        ),
        buildZone(
            'zone2',
            '2. Starke Unterstützung',
            'Institutionelle Kaufzone · 2. Tranche',
            min2,
            max2,
            target2,
            zone2Desc,
            'Als 2. Tranche setzen'
        ),
        buildZone(
            'zone3',
            '3. Panik- / Crash-Zone',
            'Maximaler Kapitalschutz · Limit',
            min3,
            max3,
            target3,
            zone3Desc,
            'Als Kauflimit setzen'
        )
    ];
}
