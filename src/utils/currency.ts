// Currency utilities with live exchange rates support
import { useExchangeRates } from '../context/ExchangeRateContext';

// Static fallback rates (used only if API fails)
export const FALLBACK_EXCHANGE_RATES: Record<string, number> = {
    CHF: 1.0,
    USD: 1.12, // 1 CHF = ~1.12 USD
    EUR: 1.06, // 1 CHF = ~1.06 EUR
    GBP: 0.9365, // 1 CHF = ~1.0678 GBP
    GBp: 0.9365, // User Override: Treat GBp exactly like GBP (Pounds)
};

// Convert any currency to CHF using live rates
export function convertToCHF(amount: number, fromCurrency: string, liveRates?: Record<string, number>): number {
    const rates = liveRates || FALLBACK_EXCHANGE_RATES;

    if (fromCurrency === 'CHF') return amount;

    let rate = rates[fromCurrency];

    // Override: Use GBP rate for GBp input if user inputs Pounds
    if (fromCurrency === 'GBp' && rates['GBP']) {
        rate = rates['GBP']; // Use Pound rate, not Pence rate
    }

    if (!rate) return amount; // Unknown currency, return as-is

    return amount / rate; // Convert to CHF
}

// Format currency with optional CHF conversion
export function formatCurrency(amount: number, currency: string, showCHF: boolean = true, liveRates?: Record<string, number>): string {
    let formatted: string;

    // User Request: Always display "GBP" even for "GBp" codes
    const displayCurrency = currency === 'GBp' ? 'GBP' : currency;

    formatted = amount.toLocaleString('de-DE', {
        style: 'currency',
        currency: displayCurrency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });

    if (showCHF && currency !== 'CHF') {
        const chfAmount = convertToCHF(amount, currency, liveRates);
        const chfFormatted = chfAmount.toLocaleString('de-CH', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        }) + ' CHF';
        return `${formatted}\u00A0\u00A0\u00A0-\u00A0\u00A0\u00A0${chfFormatted}`;
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
