// Currency utilities with live exchange rates support
import { useExchangeRates } from '../context/ExchangeRateContext';

// Static fallback rates (used only if API fails)
export const FALLBACK_EXCHANGE_RATES: Record<string, number> = {
    CHF: 1.0,
    USD: 0.88,
    EUR: 0.94,
    GBP: 1.10,
    GBp: 0.011,  // British Pence = 1/100 of GBP = ~0.011 CHF per pence
};

// Convert any currency to CHF using live rates
export function convertToCHF(amount: number, fromCurrency: string, liveRates?: Record<string, number>): number {
    const rates = liveRates || FALLBACK_EXCHANGE_RATES;

    if (fromCurrency === 'CHF') return amount;

    // Frankfurter returns rates FROM CHF, so we need to invert
    const rate = rates[fromCurrency];
    if (!rate) return amount; // Unknown currency, return as-is

    return amount / rate; // Convert to CHF
}

// Format currency with optional CHF conversion
export function formatCurrency(amount: number, currency: string, showCHF: boolean = true, liveRates?: Record<string, number>): string {
    // Special handling for GBp (not a standard ISO currency code)
    let formatted: string;
    if (currency === 'GBp') {
        formatted = `${amount.toFixed(3)} GBp`;
    } else {
        formatted = amount.toLocaleString('de-DE', {
            style: 'currency',
            currency,
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        });
    }

    if (showCHF && currency !== 'CHF') {
        const chfAmount = convertToCHF(amount, currency, liveRates);
        const chfFormatted = chfAmount.toLocaleString('de-DE', {
            style: 'currency',
            currency: 'CHF',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        });
        return `${formatted} (${chfFormatted})`;
    }

    return formatted;
}

// Hook to use currency formatting with live rates
export function useCurrencyFormatter() {
    const { rates } = useExchangeRates();

    return {
        formatCurrency: (amount: number, currency: string, showCHF: boolean = true) =>
            formatCurrency(amount, currency, showCHF, rates),
        convertToCHF: (amount: number, fromCurrency: string) =>
            convertToCHF(amount, fromCurrency, rates),
        rates,
    };
}
