export type Currency = 'EUR' | 'USD' | 'CHF' | 'GBp';



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
}

export interface Position {
    id: string;
    stockId: string;
    shares: number;
    buyPriceAvg: number; // Average buy price
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
