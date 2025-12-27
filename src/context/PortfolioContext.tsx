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
    updateStockPrice: (stockId: string, newPrice: number, newPreviousClose?: number, lastQuoteDate?: string) => void;
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
        simIsin: string;
        simCurrency: string;
        simType: 'stock' | 'etf';
        simSector: string;
        simValor: string;
        mode: 'buy' | 'sell';
        fees: {
            courtagePercent: number;
            courtageMin: number;
            stampDutyPercent: number;
            exchangeFee: number;
            showAdvanced: boolean;
            fxMarkupPercent?: number; // New FX Margin
            feeCurrency: 'CHF' | 'NATIVE'; // New: Fee Currency Toggle
        }
    };
    updateSimulatorState: (newState: Partial<PortfolioContextType['simulatorState']>) => void;
    finnhubApiKey: string;
    setFinnhubApiKey: (key: string) => void;

    // Mortgage Persistence
    mortgageData: import('../types').MortgageData;
    updateMortgageData: (data: Partial<import('../types').MortgageData>) => void;
}

const defaultSimulatorState = {
    shares: 150,
    price: 90.50,
    dividend: 3.05,
    selectedStockId: '',
    simName: '',
    simSymbol: '',
    simIsin: '',
    simCurrency: 'CHF',
    simType: 'stock',
    simSector: '',
    simValor: '',
    mode: 'buy',
    fees: {
        courtagePercent: 0.5,
        courtageMin: 40,
        stampDutyPercent: 0.075,
        exchangeFee: 2.00,
        showAdvanced: true,
        fxMarkupPercent: 1.5,
        feeCurrency: 'CHF'
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

            // Construct new purchase entry from the incoming addition
            const newPurchaseEntry: import('../types').Purchase = {
                id: crypto.randomUUID(),
                date: position.buyDate || new Date().toISOString().split('T')[0],
                shares: position.shares,
                price: position.buyPriceAvg,
                fxRate: position.averageEntryFxRate || 1
            };

            // Incoming purchases (if any exist, e.g. from bulk import or migration)
            // If the incoming position HAS a history array, use that instead of creating a single entry
            const incomingPurchases = position.purchases && position.purchases.length > 0
                ? position.purchases
                : [newPurchaseEntry];

            if (existingPosition) {
                // Merge with existing position (Calculate weighted average price AND FX rate)
                const totalShares = existingPosition.shares + position.shares;
                const oldCostNative = existingPosition.shares * existingPosition.buyPriceAvg;
                const newCostNative = position.shares * position.buyPriceAvg;
                const totalCostNative = oldCostNative + newCostNative;

                const newAvgPrice = totalShares > 0 ? totalCostNative / totalShares : 0;

                // Weighted FX Rate Calculation
                // If old position doesn't have FX rate, assume 1.0 (best guess fallback) until corrected
                const oldFx = existingPosition.averageEntryFxRate || 1;
                const newFx = position.averageEntryFxRate || 1;

                const totalCostCHF = (oldCostNative * oldFx) + (newCostNative * newFx);
                const newAvgFx = totalCostNative > 0 ? totalCostCHF / totalCostNative : 1.0;

                // Merge History
                const existingPurchases = existingPosition.purchases || [];
                // If existing position has no history (legacy data), create a synthetic entry for the "rest"
                let mergedPurchases = [...existingPurchases];
                if (existingPurchases.length === 0 && existingPosition.shares > 0) {
                    mergedPurchases.push({
                        id: crypto.randomUUID(),
                        date: existingPosition.buyDate || new Date().toISOString().split('T')[0],
                        shares: existingPosition.shares,
                        price: existingPosition.buyPriceAvg,
                        fxRate: existingPosition.averageEntryFxRate || 1
                    });
                }
                mergedPurchases = [...mergedPurchases, ...incomingPurchases];


                return prev.map(p => p.id === existingPosition.id
                    ? {
                        ...p,
                        shares: totalShares,
                        buyPriceAvg: newAvgPrice,
                        averageEntryFxRate: newAvgFx,
                        purchases: mergedPurchases
                    }
                    : p
                );
            }

            // Create new position
            const newPosition: Position = {
                ...position,
                id: `pos_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                // Ensure new position gets the FX rate (or 1 as default if somehow missing)
                averageEntryFxRate: position.averageEntryFxRate || 1,
                purchases: incomingPurchases
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

    const updateStockPrice = (id: string, newPrice: number, newPreviousClose?: number) => {
        setStocks(stocks.map(s => {
            if (s.id === id) {
                return {
                    ...s,
                    currentPrice: newPrice,
                    // If newPreviousClose provided, use it. Else fall back to OLD currentPrice (legacy behavior)
                    previousClose: newPreviousClose !== undefined ? newPreviousClose : s.currentPrice
                };
            }
            return s;
        }));
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

    const [mortgageData, setMortgageData] = useState<import('../types').MortgageData>(() => {
        const stored = localStorage.getItem('portfolio_mortgage_data');
        return stored ? JSON.parse(stored) : {
            propertyValue: 1000000,
            maintenanceRate: 0.7,
            yearlyAmortization: 10000,
            tranches: [
                { id: '1', name: 'Festhypothek 5 Jahre', amount: 400000, rate: 1.5 },
                { id: '2', name: 'SARON Indikativ', amount: 200000, rate: 2.1 },
            ]
        };
    });

    useEffect(() => {
        localStorage.setItem('portfolio_mortgage_data', JSON.stringify(mortgageData));
    }, [mortgageData]);

    const updateMortgageData = (newData: Partial<import('../types').MortgageData>) => {
        setMortgageData(prev => ({ ...prev, ...newData }));
    };

    const importData = (data: { positions: Position[], stocks: Stock[], fixedDeposits: any[], history: any[], watchlist?: string[], mortgageData?: import('../types').MortgageData }) => {
        try {
            if (data.positions) setPositions(data.positions);
            if (data.stocks) setStocks(data.stocks);
            if (data.fixedDeposits) setFixedDeposits(data.fixedDeposits);
            if (data.history) setHistory(data.history);
            if (data.watchlist) setWatchlist(data.watchlist);
            if (data.mortgageData) setMortgageData(data.mortgageData);
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
                updateSimulatorState,
                mortgageData,
                updateMortgageData
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
