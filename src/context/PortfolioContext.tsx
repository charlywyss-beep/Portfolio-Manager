import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import type { Position, Stock } from '../types';
import { MOCK_POSITIONS, MOCK_STOCKS } from '../data/mockData';

interface PortfolioContextType {
    positions: Position[];
    stocks: Stock[];
    addPosition: (position: Omit<Position, 'id'>) => void;
    deletePosition: (id: string) => void;
    updatePosition: (id: string, updates: Partial<Position>) => void;
    addStock: (stock: Omit<Stock, 'id'>) => string;
    updateStockPrice: (stockId: string, newPrice: number) => void;
    updateStockDividendYield: (stockId: string, dividendYield: number) => void;
    updateStockDividend: (stockId: string, dividendData: Partial<Pick<Stock, 'dividendYield' | 'dividendAmount' | 'dividendCurrency' | 'dividendExDate' | 'dividendPayDate' | 'dividendFrequency'>>) => void;
}

const PortfolioContext = createContext<PortfolioContextType | undefined>(undefined);

export function PortfolioProvider({ children }: { children: ReactNode }) {
    const [positions, setPositions] = useState<Position[]>(() => {
        const stored = localStorage.getItem('portfolio_positions');
        return stored ? JSON.parse(stored) : MOCK_POSITIONS;
    });

    const [stocks, setStocks] = useState<Stock[]>(() => {
        const stored = localStorage.getItem('portfolio_stocks');
        return stored ? JSON.parse(stored) : MOCK_STOCKS;
    });



    useEffect(() => {
        localStorage.setItem('portfolio_positions', JSON.stringify(positions));
    }, [positions]);

    useEffect(() => {
        localStorage.setItem('portfolio_stocks', JSON.stringify(stocks));
    }, [stocks]);



    const addStock = (stockData: Omit<Stock, 'id'>) => {
        const newId = `stock_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const newStock: Stock = {
            ...stockData,
            id: newId,
        };
        setStocks(prev => [...prev, newStock]);
        return newId;
    };

    const addPosition = (position: Omit<Position, 'id'>) => {
        const newPosition: Position = {
            ...position,
            id: `pos_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        };
        setPositions((prev) => [...prev, newPosition]);
    };

    const deletePosition = (id: string) => {
        setPositions((prev) => prev.filter((p) => p.id !== id));
    };

    const updatePosition = (id: string, updates: Partial<Position>) => {
        setPositions((prev) =>
            prev.map((p) => (p.id === id ? { ...p, ...updates } : p))
        );
    };

    const updateStockPrice = (stockId: string, newPrice: number) => {
        setStocks((prev) =>
            prev.map((s) =>
                s.id === stockId
                    ? { ...s, currentPrice: newPrice, previousClose: s.currentPrice }
                    : s
            )
        );
    };

    const updateStockDividendYield = (stockId: string, dividendYield: number) => {
        setStocks((prev) =>
            prev.map((s) =>
                s.id === stockId ? { ...s, dividendYield } : s
            )
        );
    };

    const updateStockDividend = (stockId: string, dividendData: Partial<Pick<Stock, 'dividendYield' | 'dividendAmount' | 'dividendCurrency' | 'dividendExDate' | 'dividendPayDate' | 'dividendFrequency'>>) => {
        setStocks((prev) =>
            prev.map((s) =>
                s.id === stockId ? { ...s, ...dividendData } : s
            )
        );
    };

    return (
        <PortfolioContext.Provider
            value={{
                positions,
                stocks,
                addPosition,
                deletePosition,
                updatePosition,
                addStock,
                updateStockPrice,
                updateStockDividendYield,
                updateStockDividend
            }}
        >
            {children}
        </PortfolioContext.Provider>
    );
}

export function usePortfolio() {
    const context = useContext(PortfolioContext);
    if (!context) {
        throw new Error('usePortfolio must be used within PortfolioProvider');
    }
    return context;
}
