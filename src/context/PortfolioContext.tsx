import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import type { Position, Stock, Dividend } from '../types';
import { MOCK_POSITIONS, MOCK_STOCKS } from '../data/mockData';

interface PortfolioContextType {
    positions: Position[];
    stocks: Stock[];
    dividends: Dividend[];
    addPosition: (position: Omit<Position, 'id'>) => void;
    deletePosition: (id: string) => void;
    updatePosition: (id: string, updates: Partial<Position>) => void;
    addStock: (stock: Omit<Stock, 'id'>) => string;
    updateStockPrice: (stockId: string, newPrice: number) => void;
    updateStockDividendYield: (stockId: string, dividendYield: number) => void;
    addDividend: (dividend: Omit<Dividend, 'id'>) => void;
    updateDividend: (id: string, updates: Partial<Dividend>) => void;
    deleteDividend: (id: string) => void;
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

    const [dividends, setDividends] = useState<Dividend[]>(() => {
        const stored = localStorage.getItem('portfolio_dividends');
        return stored ? JSON.parse(stored) : [];
    });

    useEffect(() => {
        localStorage.setItem('portfolio_positions', JSON.stringify(positions));
    }, [positions]);

    useEffect(() => {
        localStorage.setItem('portfolio_stocks', JSON.stringify(stocks));
    }, [stocks]);

    useEffect(() => {
        localStorage.setItem('portfolio_dividends', JSON.stringify(dividends));
    }, [dividends]);

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

    const addDividend = (dividend: Omit<Dividend, 'id'>) => {
        const newDividend: Dividend = {
            ...dividend,
            id: `div_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        };
        setDividends((prev) => [...prev, newDividend]);
    };

    const updateDividend = (id: string, updates: Partial<Dividend>) => {
        setDividends((prev) =>
            prev.map((d) => (d.id === id ? { ...d, ...updates } : d))
        );
    };

    const deleteDividend = (id: string) => {
        setDividends((prev) => prev.filter((d) => d.id !== id));
    };

    return (
        <PortfolioContext.Provider
            value={{
                positions,
                stocks,
                dividends,
                addPosition,
                deletePosition,
                updatePosition,
                addStock,
                updateStockPrice,
                updateStockDividendYield,
                addDividend,
                updateDividend,
                deleteDividend
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
