// Exchange rates to CHF (Swiss Franc)
export const EXCHANGE_RATES: Record<string, number> = {
    CHF: 1.0,
    USD: 0.88,  // 1 USD = 0.88 CHF (example rate)
    EUR: 0.94,  // 1 EUR = 0.94 CHF (example rate)
    GBP: 1.10,  // 1 GBP = 1.10 CHF (example rate)
};

export function convertToCHF(amount: number, fromCurrency: string): number {
    const rate = EXCHANGE_RATES[fromCurrency] || 1;
    return amount * rate;
}

export function formatCurrency(amount: number, currency: string, showCHF: boolean = true): string {
    const formatted = amount.toLocaleString('de-DE', { style: 'currency', currency });

    if (showCHF && currency !== 'CHF') {
        const chfAmount = convertToCHF(amount, currency);
        const chfFormatted = chfAmount.toLocaleString('de-DE', { style: 'currency', currency: 'CHF' });
        return `${formatted} (${chfFormatted})`;
    }

    return formatted;
}
