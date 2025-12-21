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
    let workingAmount = amount;

    // Handle GBp (Pence) -> GBP (Pound) conversion
    // Rate is usually for GBP. So convert Pence to Pounds first ( / 100)
    // Then use GBP rate.
    if (fromCurrency === 'GBp') {
        workingAmount = amount / 100;
        rate = rates['GBP'];
    }

    if (!rate) return amount; // Unknown currency

    return workingAmount / rate;
}

// Format currency with optional CHF conversion
export function formatCurrency(amount: number, currency: string, showCHF: boolean = true, liveRates?: Record<string, number>): string {
    let formatted: string;
    let displayAmount = amount;

    // User Request: Always display "GBP" (Pounds) even for "GBp" (Pence) codes
    // But MUST scale down by 100 if it is Pence!
    let displayCurrency = currency;

    if (currency === 'GBp') {
        displayCurrency = 'GBP';
        displayAmount = amount / 100;
    }

    formatted = displayAmount.toLocaleString('de-CH', {
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
