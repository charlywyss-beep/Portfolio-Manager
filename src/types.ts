export type Currency = 'EUR' | 'USD' | 'CHF';

export interface Dividend {
    id: string;
    stockId: string;
    amount: number; // Amount per share
    currency: Currency;
    payDate: string; // ISO Date
    exDate: string; // ISO Date
    frequency: 'monthly' | 'quarterly' | 'annually' | 'semi-annually';
}

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
    logoUrl?: string;
}

export interface Position {
    id: string;
    stockId: string;
    shares: number;
    buyPriceAvg: number; // Average buy price
}

export interface Portfolio {
    id: string;
    positions: Position[];
    cash: number;
}
