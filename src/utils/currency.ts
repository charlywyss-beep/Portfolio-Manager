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

    // GBp (Pence) handling: Redundant logic removed. 
    // Prices are now centrally normalized at the API edge (yahoo-finance.ts).
    if (fromCurrency === 'GBp') {
        rate = rates['GBP'];
    }

    if (!rate) return amount; // Unknown currency

    return workingAmount / rate;
}

// Format currency with optional CHF conversion
export function formatCurrency(amount: number, currency: string, showCHF: boolean = true, liveRates?: Record<string, number>): string {
    if (amount === undefined || amount === null || isNaN(amount)) {
        return '0.00 ' + (currency === 'GBp' ? 'GBP' : currency);
    }

    let displayAmount = amount;
    let displayCurrency = currency;

    if (currency === 'GBp') {
        displayCurrency = 'GBP';
    }

    // Custom Suffix Formatting for all currencies (e.g. 420.50 EUR)
    const formatted = displayAmount.toLocaleString('de-CH', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }) + ' ' + displayCurrency;

    if (showCHF && currency !== 'CHF') {
        const chfAmount = convertToCHF(amount, currency, liveRates);
        const chfFormatted = chfAmount.toLocaleString('de-CH', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        }) + ' CHF';

        // On mobile we might want a line break, but for now standard string
        return `${formatted} - ${chfFormatted}`;
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
