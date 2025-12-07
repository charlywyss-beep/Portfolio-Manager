import type { Stock, Position, Dividend } from '../types';

export const MOCK_STOCKS: Stock[] = [
    {
        id: '1',
        symbol: 'AAPL',
        name: 'Apple Inc.',
        sector: 'Technology',
        valor: '908440',
        isin: 'US0378331005',
        currentPrice: 175.50,
        previousClose: 174.20,
        currency: 'USD',
        dividendYield: 0.55,
        logoUrl: 'https://logo.clearbit.com/apple.com'
    },
    {
        id: '2',
        symbol: 'MSFT',
        name: 'Microsoft Corp.',
        sector: 'Technology',
        valor: '951692',
        isin: 'US5949181045',
        currentPrice: 380.20,
        previousClose: 378.50,
        currency: 'USD',
        dividendYield: 0.79,
        logoUrl: 'https://logo.clearbit.com/microsoft.com'
    },
    {
        id: '3',
        symbol: 'JNJ',
        name: 'Johnson & Johnson',
        sector: 'Healthcare',
        valor: '853260',
        isin: 'US4781601046',
        currentPrice: 155.80,
        previousClose: 156.90,
        currency: 'USD',
        dividendYield: 3.05,
        logoUrl: 'https://logo.clearbit.com/jnj.com'
    },
    {
        id: '4',
        symbol: 'O',
        name: 'Realty Income',
        sector: 'Real Estate',
        valor: '881925',
        isin: 'US7561091049',
        currentPrice: 53.40,
        previousClose: 53.20,
        currency: 'USD',
        dividendYield: 5.80,
        logoUrl: 'https://logo.clearbit.com/realtyincome.com'
    },
    {
        id: '5',
        symbol: 'NESN',
        name: 'Nestlé S.A.',
        sector: 'Consumer Staples',
        valor: '3886335',
        isin: 'CH0038863350',
        currentPrice: 98.50,
        previousClose: 99.20,
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
