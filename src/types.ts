export type Currency = 'EUR' | 'USD' | 'CHF' | 'GBp' | 'GBP';



export interface Stock {
    id: string;
    symbol: string;
    name: string;
    sector: string;
    valor?: string;
    isin?: string;
    currentPrice: number;
    previousClose: number; // For daily performance calculation
    currency: Currency;
    type?: 'stock' | 'etf';
    dividendYield?: number; // Percentage (e.g., 3.5 for 3.5%)
    dividendAmount?: number; // Amount per share (e.g., 2.80)
    dividendCurrency?: Currency; // Currency of dividend payment
    dividendExDate?: string; // Ex-dividend date (ISO format)
    dividendPayDate?: string; // Payment date (ISO format)
    dividendDates?: { exDate: string; payDate: string }[]; // NEW: Multiple dates support
    dividendFrequency?: 'monthly' | 'quarterly' | 'annually' | 'semi-annually';
    logoUrl?: string;
    targetPrice?: number; // Desired buy price (Fair Value)
    notes?: string; // Personal notes about the stock
    distributionPolicy?: 'distributing' | 'accumulating'; // Thesaurierend vs Ausschüttend
    trailingPE?: number; // KGV (Price-Earnings Ratio)
}

export interface Position {
    id: string;
    stockId: string;
    shares: number;
    buyPriceAvg: number; // Average buy price
    buyDate?: string; // Date of first purchase (ISO format)
    averageEntryFxRate?: number; // NEW: Weighted Average Exchange Rate at time of purchase
    purchases?: Purchase[]; // NEW: History of individual purchases for this position
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

export interface MortgageData {
    propertyValue: number;
    maintenanceRate: number;
    yearlyAmortization: number;
    tranches: MortgageTranche[];
}
