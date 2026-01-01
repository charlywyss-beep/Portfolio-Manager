import type { Stock } from '../types';
import { isAfter, isBefore, addDays, parseISO, startOfDay } from 'date-fns';

export type DividendStatus = 'upcoming' | 'ex-dividend' | 'paid' | 'unknown';

export interface CurrentDividendInfo {
    exDate: string | undefined;
    payDate: string | undefined;
    status: DividendStatus;
    periodLabel?: string; // e.g. "Q1", "Q2"
}

// Helper to translate frequency to German
export const translateFrequency = (freq?: string) => {
    switch (freq) {
        case 'quarterly': return 'p.Q.';
        case 'semi-annually': return 'Halbjähr.';
        case 'annually': return 'Jährlich';
        case 'monthly': return 'Monatlich';
        default: return 'Jährlich';
    }
};

export function getCurrentDividendPeriod(stock: Stock): CurrentDividendInfo {
    const today = startOfDay(new Date());

    // 1. If we have multiple dates defined (Preferred)
    if (stock.dividendDates && stock.dividendDates.length > 0) {
        // Find the "current" relevant period based on the rule: 
        // Switch to next period only if (PayDate + 7 days) < Today.

        // Map to preserve original index/label, then sort
        const periods = stock.dividendDates.map((d, i) => ({
            ...d,
            originalIndex: i
        }));

        const sortedDates = periods.sort((a, b) =>
            (a.payDate || '').localeCompare(b.payDate || '')
        );

        for (let i = 0; i < sortedDates.length; i++) {
            const period = sortedDates[i];
            if (!period.payDate) continue;

            const payDate = parseISO(period.payDate);
            const switchDate = addDays(payDate, 7); // Buffer of 7 days

            // If we are BEFORE the switch date, this is our current period to display
            if (isBefore(today, switchDate)) {

                // Determine Status for this period
                let status: DividendStatus = 'upcoming';
                const exDate = period.exDate ? parseISO(period.exDate) : null;

                if (isAfter(today, payDate) || today.getTime() === payDate.getTime()) {
                    status = 'paid';
                } else if (exDate && (isAfter(today, exDate) || today.getTime() === exDate.getTime())) {
                    status = 'ex-dividend';
                }

                // Determine Label based on ORIGINAL index
                let label = '';
                if (stock.dividendFrequency === 'quarterly') label = `Q${period.originalIndex + 1}`;
                else if (stock.dividendFrequency === 'semi-annually') label = `H${period.originalIndex + 1}`;
                else if (stock.dividendFrequency === 'annually') label = 'Jahr';

                return {
                    exDate: period.exDate,
                    payDate: period.payDate,
                    status,
                    periodLabel: label
                };
            }
        }

        // If we fall through here, ALL dates are past the buffer. 
        // We assume the current cycle is done, so we display the start of the NEXT cycle (e.g. Q1).
        // We don't have the new dates yet, so we return undefined dates.
        return {
            exDate: undefined,
            payDate: undefined,
            status: 'upcoming',
            periodLabel: stock.dividendFrequency === 'quarterly' ? 'Q1' : (stock.dividendFrequency === 'semi-annually' ? '' : 'Ende')
        };
    }

    // 2. Fallback to single fields
    return {
        exDate: stock.dividendExDate,
        payDate: stock.dividendPayDate,
        status: getSimpleStatus(stock.dividendExDate, stock.dividendPayDate),
    };
}

function getSimpleStatus(exDateStr?: string, payDateStr?: string): DividendStatus {
    if (!exDateStr && !payDateStr) return 'unknown';

    const today = startOfDay(new Date());
    const payDate = payDateStr ? parseISO(payDateStr) : null;
    const exDate = exDateStr ? parseISO(exDateStr) : null;

    if (payDate && (isAfter(today, payDate) || today.getTime() === payDate.getTime())) {
        return 'paid';
    }
    if (exDate && (isAfter(today, exDate) || today.getTime() === exDate.getTime())) {
        return 'ex-dividend';
    }
    return 'upcoming';
}
