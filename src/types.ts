export type Currency = 'EUR' | 'USD' | 'CHF' | 'GBp' | 'GBP';


export interface Watchlist {
    id: string;
    name: string;
    stockIds: string[];
    isDefault?: boolean;
}
export interface QuickLink {
    id: string;
    url: string;
    label?: string;
    createdAt: string;
}

export interface PlannedPurchase {
    previousClose: number;
    open?: number;
    shares: number;
    pricePerShare: number;
    currency: Currency;
    volumeNative: number; // Total value in native currency
    volumeCHF: number; // Total value in CHF
    fees: {
        courtage: number;
        stampDuty: number;
        exchangeFee: number;
        fxMarkup: number;
        total: number;
        currency: string; // CHF or NATIVE
    };
    totalInvestmentCHF: number; // Volume + Fees in CHF
    dividendPerShare: number;
    annualDividendCHF?: number;
    netYield?: number; // Percentage
    savedAt: string; // ISO timestamp
}


export interface Stock {
    id: string;
    symbol: string;
    name: string;
    sector: string;
    country?: string; // NEW: Country of the stock
    valor?: string;
    isin?: string;
    currentPrice: number;
    lastQuoteDate?: string; // NEW: ISO timestamp of the quote
    previousClose: number; // For daily performance calculation
    open?: number; // NEW: Opening price
    currency: Currency;
    type?: 'stock' | 'etf';
    dividendYield?: number; // Percentage (e.g., 3.5 for 3.5%)
    dividendAmount?: number; // Amount per share (e.g., 2.80)
    dividendCurrency?: Currency; // Currency of dividend payment
    dividendExDate?: string; // Ex-dividend date (ISO format)
    dividendPayDate?: string; // Payment date (ISO format)
    dividendDates?: { exDate: string; payDate: string }[]; // NEW: Multiple dates support
    dividendFrequency?: 'none' | 'monthly' | 'quarterly' | 'annually' | 'semi-annually';
    withholdingTaxRate?: number; // Quellensteuersatz in % (z.B. 15, 30, 35, 0)
    logoUrl?: string;
    targetPrice?: number; // Desired buy price (Fair Value) -> Buy Limit
    fairValue?: number; // Calculated Intrinsic Value (without Margin of Safety)
    fairValueParams?: {
        eps: number;
        growthRate: number;
        pe: number;
        dividendYield: number;
        discountRate: number;
        mos: number;
        isCustom?: boolean;
        updatedAt?: string;
        valuationMode?: 'conservative' | 'quality' | 'risk';
        customBackup?: {
            eps: number;
            growthRate: number;
            pe: number;
            dividendYield: number;
            discountRate: number;
            mos: number;
            updatedAt?: string;
            valuationMode?: 'conservative' | 'quality' | 'risk';
        };
    };
    sellLimit?: number; // Desired sell price -> Sell Limit
    notes?: string; // Personal notes about the stock
    plannedPurchase?: PlannedPurchase; // Complete planned purchase simulation data
    distributionPolicy?: 'distributing' | 'accumulating'; // Thesaurierend vs Ausschüttend
    trailingPE?: number; // KGV (Price-Earnings Ratio)
    forwardPE?: number; // KGV (Forecast)
    kcv?: number; // Kurs-Cashflow-Verhältnis (Price-to-Cash-Flow)
    eps?: number; // Earnings Per Share (Trailing 12M)
    forwardEps?: number; // Expected Forward EPS
    quickLinks?: QuickLink[]; // NEW: Custom URLs for charts, financial sites, etc.
    fairValueQuickLinks?: QuickLink[]; // Specific custom URLs for Fair Value research/calculation
    marketState?: 'REGULAR' | 'CLOSED' | 'PRE' | 'POST' | 'PREPRE' | 'POSTPOST'; // Yahoo Finance Market State
    sectorWeights?: { [key: string]: number }; // NEW: For ETFs (Sector Allocation)
    countryWeights?: { [key: string]: number }; // NEW: For ETFs (Country Allocation)
}

export interface Position {
    id: string;
    stockId: string;
    shares: number;
    buyPriceAvg: number; // Average buy price
    buyDate?: string; // Date of first purchase (ISO format)
    averageEntryFxRate?: number; // NEW: Weighted Average Exchange Rate at time of purchase
    purchases?: Purchase[]; // NEW: History of individual purchases for this position
    broker?: string; // NEW: Bank / Broker where the position is held
}

export interface Purchase {
    id: string;
    date: string; // ISO format
    shares: number;
    price: number;
    fxRate: number;
}

// Bankguthaben (e.g. Sparkonto / Privatkonto)
export type BankAccountType = 'sparkonto' | 'privatkonto' | 'vorsorge';

export interface FixedDeposit {
    id: string;
    bankName: string;
    amount: number;
    interestRate: number; // Percentage (e.g. 2.5)
    startDate?: string; // ISO Date (Optional)
    maturityDate?: string; // ISO Date (Optional)
    currency: Currency;
    notes?: string;
    accountType?: BankAccountType; // New field
    logoUrl?: string; // NEW: Logo URL
    currentYearContribution?: number; // NEW: For Vorsorge account progress
    autoContribution?: boolean; // NEW: If true, calculate contribution based on monthly amount
    monthlyContribution?: number; // NEW: Monthly amount to be extrapolated
    lastContributionDate?: string; // NEW: ISO date of last auto-contribution (YYYY-MM format)
    monthlyFee?: number; // NEW: Account fee
    feeFrequency?: 'monthly' | 'quarterly' | 'annually'; // NEW: Frequency of the fee
    iban?: string; // NEW: IBAN / Account Number
}

export interface PortfolioHistoryEntry {
    id: string;
    date: string; // ISO Date (YYYY-MM-DD or YYYY-12-31)
    totalValue: number;
    stockValue?: number; // Value of all positions with type 'stock'
    etfValue?: number;   // Value of all positions with type 'etf'
    cashValue?: number;  // Bankguthaben (Cash + Fixed Deposits)
    investedCapital?: number; // Optional: to calculate true return
    notes?: string;
}


export interface Portfolio {
    id: string;
    positions: Position[];
    fixedDeposits: FixedDeposit[];
    history: PortfolioHistoryEntry[]; // New field
    cash: number;
}

export interface MortgageTranche {
    id: string;
    name: string;
    amount: number;
    rate: number;
}

export interface BudgetEntry {
    id: string;
    name: string;
    amount: number;
    frequency: 'monthly' | 'yearly';
}

export interface OilPurchase {
    id: string;
    date: string;           // ISO date (YYYY-MM-DD)
    liters: number;         // Amount filled (e.g., 3000)
    pricePer100L: number;   // Price per 100L in CHF (e.g., 122)
}

export interface ElectricityTariffConfig {
    // 1. Energie (Rp./kWh)
    energyHT: number;           // z.B. 10.90 Rp./kWh
    energyNT: number;           // z.B. 9.10 Rp./kWh
    // 2. Netznutzung (Rp./kWh & CHF/Monat)
    gridHT: number;             // z.B. 12.90 Rp./kWh
    gridNT: number;             // z.B. 9.10 Rp./kWh
    gridSdl: number;            // Systemdienstleistungen Swissgrid (z.B. 0.27 Rp./kWh)
    gridReserve: number;        // Stromreserve des Bundes (z.B. 0.41 Rp./kWh)
    gridSolidar: number;        // Zuschlag solidarisierte Kosten (z.B. 0.05 Rp./kWh)
    gridBaseFee: number;        // Grundpreis Netznutzung (z.B. CHF 5.00/Monat)
    gridMeasurementFee: number; // Messkosten direkt (z.B. CHF 6.20/Monat)
    // 3. Öffentliche Abgaben (Rp./kWh)
    communityFee: number;       // Konzessionsabgabe an Gemeinde (z.B. 0.85 Rp./kWh)
    federalFee: number;         // Bundesabgaben gemäss Energiegesetz (z.B. 2.30 Rp./kWh)
    // 4. Mehrwertsteuer (%)
    vatRate: number;            // Standard 8.1 %
}

export interface ElectricityTariffProfile {
    id: string;
    name: string;               // z.B. "Eniwa Standard 2026", "Eniwa 2027"
    validFrom: string;          // Gültig ab (YYYY-MM-DD), z.B. "2026-01-01"
    provider?: string;          // z.B. "Eniwa AG"
    tariff: ElectricityTariffConfig;
}

export interface ElectricityReading {
    id: string;
    date: string;               // Ablesedatum / Bis-Datum (YYYY-MM-DD)
    dateFrom?: string;          // Von-Datum (Ablesezeitraum Start, YYYY-MM-DD)
    valueHT: number;            // Stand neu HT (Zählerstand)
    valueNT: number;            // Stand neu NT (Zählerstand)
    standAltHT?: number;        // Stand alt HT
    standAltNT?: number;        // Stand alt NT
    usageHT?: number;           // Verbrauch Wirkenergie HT (kWh)
    usageNT?: number;           // Verbrauch Wirkenergie NT (kWh)
    billingMonths?: number;     // Abrechnungsmonate für Fixkosten (z.B. 1)
    invoiceNumber?: string;     // Optionale Rechnungs-Nr. (z.B. 7 134 488)
    invoiceDate?: string;       // Rechnungsdatum (z.B. 2026-10-31)
    dueDate?: string;           // Zahlbar bis (z.B. 2026-11-30)
    costEnergy?: number;        // Zwischentotal Energie exkl. MwSt
    costGrid?: number;          // Zwischentotal Netznutzung exkl. MwSt
    costFees?: number;          // Zwischentotal Abgaben exkl. MwSt
    costTotalExclVat?: number;  // Zwischentotal Strom exkl. MwSt
    costVat?: number;           // MwSt Betrag
    costTotal?: number;         // Rechnungsbetrag inkl. MwSt
    tariffSnapshot?: ElectricityTariffConfig;
}

export interface MortgageData {
    propertyValue: number;
    maintenanceRate: number; // in %
    yearlyAmortization: number;
    tranches: MortgageTranche[];
    budgetItems: BudgetEntry[]; // Monthly/Yearly expenses
    incomeItems: BudgetEntry[]; // Monthly/Yearly income
    autoCosts: BudgetEntry[]; // Auto expenses

    // Fahrkosten Rechner Variables
    fuelPricePerLiter?: number;
    consumptionPer100km?: number;
    dailyKm?: number;
    workingDaysPerMonth?: number;

    // Heizöl Variable
    oilTankCapacity?: number;
    oilPurchases?: OilPurchase[];

    // Strom Variable
    electricityPriceHT?: number; // Rp. / kWh (Total)
    electricityPriceNT?: number; // Rp. / kWh (Total)
    electricityReadings?: ElectricityReading[];
    electricityCustomerNumber?: string;
    electricityContractNumber?: string;
    electricityMeterNumber?: string;
    electricityProvider?: string;
    electricityTariff?: ElectricityTariffConfig;
    electricityTariffProfiles?: ElectricityTariffProfile[];
    electricityCalculationMode?: 'detailed' | 'simple';

    // Wasser (Vereinfachtes Modell)
    waterHistory?: WaterYearlyEntry[];
    waterCustomerNumber?: string;
    waterMeterNumber?: string;

    // Pensions-Tragbarkeit & Zins-Stresstest
    ahvPensionIncome?: number;
    pkPensionIncome?: number;
    pensionIncome?: number;
    pensionIncomeFrequency?: 'monthly' | 'yearly';
    stressTestRate?: number;
}

export interface WaterYearlyEntry {
    id: string;
    year: number;
    date: string; // z.B. "2023-12-31"
    messpunkt: string; // Zählerstand
    usage: number; // Verbrauch m3
    costFresh: number; // Trinkwasser Kosten
    costWaste: number; // Abwasser Kosten
    costTotal: number; // Totalbetrag
}

export interface WaterReading { // Deprecated but keeping for type safety during migration if needed, though strictly unused now
    id: string;
    date: string;
    value: number;
}


export interface SavedSimulation {
    id: string;
    createdAt: string;
    mode: 'buy' | 'sell';
    stockId?: string;
    stockName: string;
    stockSymbol: string;
    stockIsin?: string;
    shares: number;
    price: number;
    currency: string;
    volumeNative: number;
    volumeCHF: number;
    totalFeesCHF: number;
    totalInvestOrProceedsCHF: number;
    dividendPerShare?: number;
    dividendFrequency?: 'annually' | 'semi-annually' | 'quarterly' | 'monthly';
    distributionPolicy?: 'distributing' | 'accumulating';
    grossYield?: number;
    netYield?: number;
    taxRate?: number;
    annualDividendCHF?: number;
    annualDividendNative?: number;
    feesConfig?: any;
}

export interface OrderBookEntry {
    id: string;
    createdAt: string;
    validUntil: string; // YYYY-MM-DD
    mode: 'buy' | 'sell';
    stockId?: string;
    stockName: string;
    stockSymbol: string;
    stockIsin?: string;
    shares: number;
    limitPrice: number;
    currency: string;
    volumeNative: number;
    volumeCHF: number;
    totalFeesCHF: number;
    totalInvestOrProceedsCHF: number;
    status: 'open' | 'executed' | 'expired';
    executedAt?: string;
    executedPrice?: number;
    executedShares?: number;
    executedTotalCHF?: number;
    executedFxRate?: number;
    executedBroker?: string;
    dividendPerShare?: number;
    dividendFrequency?: 'annually' | 'semi-annually' | 'quarterly' | 'monthly';
    distributionPolicy?: 'distributing' | 'accumulating';
    grossYield?: number;
    netYield?: number;
    taxRate?: number;
    annualDividendCHF?: number;
    annualDividendNative?: number;
    feesConfig?: any;
    exchange?: string;
    note?: string;
}

export interface ExecuteOrderParams {
    executedPrice: number;
    shares?: number;
    executedDate?: string;
    totalAmountCHF?: number;
    feesCHF?: number;
    fxRate?: number;
    effectiveBuyPrice?: number;
    broker?: string;
}

