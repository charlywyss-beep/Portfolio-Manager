export type Currency = 'EUR' | 'USD' | 'CHF';



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
    dividendFrequency?: 'monthly' | 'quarterly' | 'annually' | 'semi-annually';
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
