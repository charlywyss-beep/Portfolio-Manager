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
    updateStock: (id: string, updates: Partial<Stock>) => void;
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
    importData: (data: { positions: Position[], stocks: Stock[], fixedDeposits: import('../types').FixedDeposit[], history: import('../types').PortfolioHistoryEntry[], watchlist: string[] }) => boolean;
    watchlist: string[];
    addToWatchlist: (stockId: string) => void;
    removeFromWatchlist: (stockId: string) => void;

    // Simulator Persistence
    simulatorState: {
        shares: number;
        price: number;
        dividend: number;
        selectedStockId: string;
        simName: string;
        simSymbol: string;
        fees: {
            courtagePercent: number;
            courtageMin: number;
            stampDutyPercent: number;
            exchangeFee: number;
            showAdvanced: boolean;
        }
    };
    updateSimulatorState: (newState: Partial<PortfolioContextType['simulatorState']>) => void;
    finnhubApiKey: string;
    setFinnhubApiKey: (key: string) => void;
}

const defaultSimulatorState = {
    shares: 150,
    price: 90.50,
    dividend: 3.05,
    selectedStockId: '',
    simName: '',
    simSymbol: '',
    fees: {
        courtagePercent: 0.5,
        courtageMin: 40,
        stampDutyPercent: 0.075,
        exchangeFee: 2.00,
        showAdvanced: true
    }
};

const PortfolioContext = createContext<PortfolioContextType | undefined>(undefined);

// Helper to load simulator default
const getInitialSimulatorState = () => {
    try {
        const stored = localStorage.getItem('portfolio_simulator_state');
        if (stored) {
            const parsed = JSON.parse(stored);
            // Merge with default to ensure new fields (like fees) exist
            return {
                ...defaultSimulatorState,
                ...parsed,
                fees: { ...defaultSimulatorState.fees, ...parsed.fees }
            };
        }
    } catch (e) {
        console.error("Failed to load simulator state", e);
    }
    return defaultSimulatorState;
};

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

    const [watchlist, setWatchlist] = useState<string[]>(() => {
        const stored = localStorage.getItem('portfolio_watchlist');
        return stored ? JSON.parse(stored) : [];
    });

    const [finnhubApiKey, setFinnhubApiKey] = useState<string>(() => {
        const stored = localStorage.getItem('portfolio_finnhub_api_key');
        return stored || 'd4uufa9r01qnm7pobnt0d4uufa9r01qnm7pobntg';
    });

    useEffect(() => {
        localStorage.setItem('portfolio_positions', JSON.stringify(positions));
    }, [positions]);

    useEffect(() => {
        localStorage.setItem('portfolio_finnhub_api_key', finnhubApiKey);
    }, [finnhubApiKey]);

    // Auto-migrate old invalid key to new valid key if found
    useEffect(() => {
        if (finnhubApiKey === 'd4u68uhr01qu53ud2c80d4u68uhr01qu53ud2c8g') {
            setFinnhubApiKey('d4uufa9r01qnm7pobnt0d4uufa9r01qnm7pobntg');
        }
    }, [finnhubApiKey]);

    useEffect(() => {
        localStorage.setItem('portfolio_stocks', JSON.stringify(stocks));
    }, [stocks]);

    useEffect(() => {
        localStorage.setItem('portfolio_fixed_deposits', JSON.stringify(fixedDeposits));
    }, [fixedDeposits]);

    useEffect(() => {
        localStorage.setItem('portfolio_watchlist', JSON.stringify(watchlist));
    }, [watchlist]);

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
        setPositions((prev) => {
            const existingPosition = prev.find(p => p.stockId === position.stockId);

            if (existingPosition) {
                // Merge with existing position (Calculate weighted average price)
                const totalShares = existingPosition.shares + position.shares;
                const totalCost = (existingPosition.shares * existingPosition.buyPriceAvg) + (position.shares * position.buyPriceAvg);
                const newAvgPrice = totalCost / totalShares;

                return prev.map(p => p.id === existingPosition.id
                    ? { ...p, shares: totalShares, buyPriceAvg: newAvgPrice }
                    : p
                );
            }

            // Create new position
            const newPosition: Position = {
                ...position,
                id: `pos_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            };
            return [...prev, newPosition];
        });
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


    const addToWatchlist = (stockId: string) => {
        setWatchlist((prev) => {
            if (prev.includes(stockId)) return prev;
            return [...prev, stockId];
        });
    };

    const removeFromWatchlist = (stockId: string) => {
        setWatchlist((prev) => prev.filter((id) => id !== stockId));
    };

    const updateStock = (id: string, updates: Partial<Stock>) => {
        setStocks(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
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

    const importData = (data: { positions: Position[], stocks: Stock[], fixedDeposits: any[], history: any[], watchlist?: string[] }) => {
        try {
            if (data.positions) setPositions(data.positions);
            if (data.stocks) setStocks(data.stocks);
            if (data.fixedDeposits) setFixedDeposits(data.fixedDeposits);
            if (data.history) setHistory(data.history);
            if (data.watchlist) setWatchlist(data.watchlist);
            return true;
        } catch (e) {
            console.error("Import failed", e);
            return false;
        }
    };

    const [simulatorState, setSimulatorState] = useState<PortfolioContextType['simulatorState']>(getInitialSimulatorState);

    useEffect(() => {
        localStorage.setItem('portfolio_simulator_state', JSON.stringify(simulatorState));
    }, [simulatorState]);

    const updateSimulatorState = (newState: Partial<PortfolioContextType['simulatorState']>) => {
        setSimulatorState(prev => ({
            ...prev,
            ...newState,
            fees: {
                ...prev.fees,
                ...(newState.fees || {})
            }
        }));
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
                updateStock,
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
                importData,
                watchlist,
                addToWatchlist,
                removeFromWatchlist,
                finnhubApiKey,
                setFinnhubApiKey,
                simulatorState,
                updateSimulatorState
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
