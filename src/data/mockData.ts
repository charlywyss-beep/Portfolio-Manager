import type { Stock, Position } from '../types';

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
        type: 'stock',
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
    },
    {
        id: '6',
        symbol: 'SPY',
        name: 'SPDR S&P 500 ETF',
        sector: 'ETF',
        valor: '2950556',
        isin: 'US78462F1030',
        currentPrice: 445.50,
        previousClose: 443.20,
        currency: 'USD',
        type: 'etf',
        dividendYield: 1.45,
    },
    {
        id: '7',
        symbol: 'VWRL',
        name: 'Vanguard FTSE All-World',
        sector: 'ETF',
        valor: '10540823',
        isin: 'IE00B3RBWM25',
        currentPrice: 108.20,
        previousClose: 107.80,
        currency: 'USD',
        type: 'etf',
        dividendYield: 1.92,
    },
    {
        id: '8',
        symbol: 'CS.PA',
        name: 'AXA S.A.',
        sector: 'Financial Services',
        valor: '120628',
        isin: 'FR0000120628',
        currentPrice: 31.27,
        previousClose: 31.10,
        currency: 'EUR',
        type: 'stock',
        dividendYield: 5.40,
        logoUrl: 'https://logo.clearbit.com/axa.com'
    }
];

export const MOCK_POSITIONS: Position[] = [
    { id: 'p1', stockId: '1', shares: 10, buyPriceAvg: 150.00 },
    { id: 'p2', stockId: '2', shares: 5, buyPriceAvg: 300.00 },
    { id: 'p3', stockId: '4', shares: 50, buyPriceAvg: 55.00 },
    { id: 'p4', stockId: '5', shares: 20, buyPriceAvg: 105.00 }
];


