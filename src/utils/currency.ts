// Currency utilities with live exchange rates support
import { useExchangeRates } from '../context/ExchangeRateContext';

// Static fallback rates (used only if API fails)
export const FALLBACK_EXCHANGE_RATES: Record<string, number> = {
    CHF: 1.0,
    USD: 1.12, // 1 CHF = ~1.12 USD
    EUR: 1.06, // 1 CHF = ~1.06 EUR
    GBP: 0.9365, // 1 CHF = ~1.0678 GBP (Inverse of 1.0678)
    GBp: 93.65, // 1 CHF = ~93.65 GBp (Pence)
};

// Convert any currency to CHF using live rates
export function convertToCHF(amount: number, fromCurrency: string, liveRates?: Record<string, number>): number {
    const rates = liveRates || FALLBACK_EXCHANGE_RATES;

    if (fromCurrency === 'CHF') return amount;

    let rate = rates[fromCurrency];

    // Special handling for GBp (Pence) if not in rates
    if (!rate && fromCurrency === 'GBp' && rates['GBP']) {
        rate = rates['GBP'] * 100;
    }

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
