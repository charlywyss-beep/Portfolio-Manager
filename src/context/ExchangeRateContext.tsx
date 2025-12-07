// Exchange rates context for live currency conversion
import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';

interface ExchangeRates {
    [key: string]: number;
}

interface ExchangeRateContextType {
    rates: ExchangeRates;
    lastUpdated: Date | null;
    isLoading: boolean;
}

const ExchangeRateContext = createContext<ExchangeRateContextType | undefined>(undefined);

const API_URL = 'https://api.frankfurter.app/latest?from=CHF';

export function ExchangeRateProvider({ children }: { children: ReactNode }) {
    const [rates, setRates] = useState<ExchangeRates>({
        CHF: 1.0,
        USD: 0.88,  // Fallback values
        EUR: 0.94,
        GBP: 1.10,
    });
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchRates = async () => {
            try {
                const response = await fetch(API_URL);
                const data = await response.json();

                // Frankfurter.app returns rates FROM CHF to other currencies
                // We already have CHF as base, so we can use directly
                setRates({
                    CHF: 1.0,
                    ...data.rates,
                });
                setLastUpdated(new Date());
                setIsLoading(false);
            } catch (error) {
                console.error('Failed to fetch exchange rates:', error);
                // Keep fallback rates
                setIsLoading(false);
            }
        };

        fetchRates();

        // Update every 24 hours
        const interval = setInterval(fetchRates, 24 * 60 * 60 * 1000);

        return () => clearInterval(interval);
    }, []);

    return (
        <ExchangeRateContext.Provider value={{ rates, lastUpdated, isLoading }}>
            {children}
        </ExchangeRateContext.Provider>
    );
}

export function useExchangeRates() {
    const context = useContext(ExchangeRateContext);
    if (!context) {
        throw new Error('useExchangeRates must be used within ExchangeRateProvider');
    }
    return context;
}
