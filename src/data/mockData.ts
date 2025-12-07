import type { Stock, Position, Dividend } from '../types';

export const MOCK_STOCKS: Stock[] = [
    {
        id: '1',
        symbol: 'AAPL',
        name: 'Apple Inc.',
        sector: 'Technology',
        currentPrice: 175.50,
        currency: 'USD',
        dividendYield: 0.55,
        logoUrl: 'https://logo.clearbit.com/apple.com'
    },
    {
        id: '2',
        symbol: 'MSFT',
        name: 'Microsoft Corp.',
        sector: 'Technology',
        currentPrice: 380.20,
        currency: 'USD',
        dividendYield: 0.79,
        logoUrl: 'https://logo.clearbit.com/microsoft.com'
    },
    {
        id: '3',
        symbol: 'JNJ',
        name: 'Johnson & Johnson',
        sector: 'Healthcare',
        currentPrice: 155.80,
        currency: 'USD',
        dividendYield: 3.05,
        logoUrl: 'https://logo.clearbit.com/jnj.com'
    },
    {
        id: '4',
        symbol: 'O',
        name: 'Realty Income',
        sector: 'Real Estate',
        currentPrice: 53.40,
        currency: 'USD',
        dividendYield: 5.80,
        logoUrl: 'https://logo.clearbit.com/realtyincome.com'
    },
    {
        id: '5',
        symbol: 'NESN',
        name: 'Nestlé S.A.',
        sector: 'Consumer Staples',
        currentPrice: 98.50,
        currency: 'CHF',
        dividendYield: 3.10,
        logoUrl: 'https://logo.clearbit.com/nestle.com'
    }
];

export const MOCK_POSITIONS: Position[] = [
    { id: 'p1', stockId: '1', shares: 10, buyPriceAvg: 150.00 },
    { id: 'p2', stockId: '2', shares: 5, buyPriceAvg: 300.00 },
    { id: 'p3', stockId: '4', shares: 50, buyPriceAvg: 55.00 },
    { id: 'p4', stockId: '5', shares: 20, buyPriceAvg: 105.00 }
];

// Helper to project basic dividends based on yield (simplified for mock)
export const MOCK_DIVIDENDS: Dividend[] = [
    {
        id: 'd1', stockId: '4', amount: 0.256, currency: 'USD', frequency: 'monthly',
        payDate: '2024-03-15', exDate: '2024-03-01'
    },
    {
        id: 'd2', stockId: '1', amount: 0.24, currency: 'USD', frequency: 'quarterly',
        payDate: '2024-02-15', exDate: '2024-02-10'
    },
    {
        id: 'd3', stockId: '5', amount: 3.00, currency: 'CHF', frequency: 'annually',
        payDate: '2024-04-20', exDate: '2024-04-18'
    }
];
