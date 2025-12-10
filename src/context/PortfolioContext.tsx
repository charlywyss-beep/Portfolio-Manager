import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import type { Position, Stock } from '../types';
import { MOCK_POSITIONS, MOCK_STOCKS } from '../data/mockData';

interface PortfolioContextType {
    positions: Position[];
    stocks: Stock[];
    fixedDeposits: import('../types').FixedDeposit[];
    addPosition: (position: Omit<Position, 'id'>) => void;
    deletePosition: (id: string) => void;
    updatePosition: (id: string, updates: Partial<Position>) => void;
    addStock: (stock: Omit<Stock, 'id'>) => string;
    updateStockPrice: (stockId: string, newPrice: number) => void;
    updateStockDividendYield: (stockId: string, dividendYield: number) => void;
    updateStockDividend: (stockId: string, dividendData: Partial<Pick<Stock, 'dividendYield' | 'dividendAmount' | 'dividendCurrency' | 'dividendExDate' | 'dividendPayDate' | 'dividendDates' | 'dividendFrequency'>>) => void;
    addFixedDeposit: (deposit: Omit<import('../types').FixedDeposit, 'id'>) => void;
    deleteFixedDeposit: (id: string) => void;
    updateFixedDeposit: (id: string, updates: Partial<import('../types').FixedDeposit>) => void;
    history: import('../types').PortfolioHistoryEntry[];
    addHistoryEntry: (entry: Omit<import('../types').PortfolioHistoryEntry, 'id'>) => void;
    deleteHistoryEntry: (id: string) => void;
    updateHistoryEntry: (id: string, updates: Partial<import('../types').PortfolioHistoryEntry>) => void;
    importData: (data: { positions: Position[], stocks: Stock[], fixedDeposits: import('../types').FixedDeposit[], history: import('../types').PortfolioHistoryEntry[] }) => boolean;
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



    const [fixedDeposits, setFixedDeposits] = useState<any[]>(() => {
        const stored = localStorage.getItem('portfolio_fixed_deposits');
        return stored ? JSON.parse(stored) : [];
    });

    useEffect(() => {
        localStorage.setItem('portfolio_positions', JSON.stringify(positions));
    }, [positions]);

    useEffect(() => {
        localStorage.setItem('portfolio_stocks', JSON.stringify(stocks));
    }, [stocks]);

    useEffect(() => {
        localStorage.setItem('portfolio_fixed_deposits', JSON.stringify(fixedDeposits));
    }, [fixedDeposits]);

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

    // Fixed Deposit Actions
    const addFixedDeposit = (deposit: Omit<import('../types').FixedDeposit, 'id'>) => {
        const newDeposit = {
            ...deposit,
            id: `fd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        };
        setFixedDeposits((prev) => [...prev, newDeposit]);
    };

    const deleteFixedDeposit = (id: string) => {
        setFixedDeposits((prev) => prev.filter((fd) => fd.id !== id));
    };

    const updateFixedDeposit = (id: string, updates: Partial<import('../types').FixedDeposit>) => {
        setFixedDeposits((prev) =>
            prev.map((fd) => (fd.id === id ? { ...fd, ...updates } : fd))
        );
    };

    // History Actions
    const [history, setHistory] = useState<import('../types').PortfolioHistoryEntry[]>(() => {
        const stored = localStorage.getItem('portfolio_history');
        // Sort by date descending by default
        const parsed = stored ? JSON.parse(stored) : [];
        return parsed.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
    });

    useEffect(() => {
        localStorage.setItem('portfolio_history', JSON.stringify(history));
    }, [history]);

    const addHistoryEntry = (entry: Omit<import('../types').PortfolioHistoryEntry, 'id'>) => {
        const newEntry = {
            ...entry,
            id: `hist_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        };
        setHistory((prev) => {
            const updated = [...prev, newEntry];
            return updated.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        });
    };

    const deleteHistoryEntry = (id: string) => {
        setHistory((prev) => prev.filter((h) => h.id !== id));
    };

    const updateHistoryEntry = (id: string, updates: Partial<import('../types').PortfolioHistoryEntry>) => {
        setHistory((prev) => {
            const updated = prev.map((h) => (h.id === id ? { ...h, ...updates } : h));
            return updated.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        });
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

    const updateStockDividend = (stockId: string, dividendData: Partial<Pick<Stock, 'dividendYield' | 'dividendAmount' | 'dividendCurrency' | 'dividendExDate' | 'dividendPayDate' | 'dividendDates' | 'dividendFrequency'>>) => {
        setStocks((prev) =>
            prev.map((s) =>
                s.id === stockId ? { ...s, ...dividendData } : s
            )
        );
    };

    const importData = (data: { positions: Position[], stocks: Stock[], fixedDeposits: any[], history: any[] }) => {
        try {
            if (data.positions) setPositions(data.positions);
            if (data.stocks) setStocks(data.stocks);
            if (data.fixedDeposits) setFixedDeposits(data.fixedDeposits);
            if (data.history) setHistory(data.history);
            return true;
        } catch (e) {
            console.error("Import failed", e);
            return false;
        }
    };

    return (
        <PortfolioContext.Provider
            value={{
                positions,
                stocks,
                fixedDeposits,
                addPosition,
                deletePosition,
                updatePosition,
                addStock,
                updateStockPrice,
                updateStockDividendYield,
                updateStockDividend,
                addFixedDeposit,
                deleteFixedDeposit,
                updateFixedDeposit,
                history,
                addHistoryEntry,
                deleteHistoryEntry,
                updateHistoryEntry,
                importData
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
