const DIVVYDIARY_API_KEY_STORAGE = 'divvydiary_api_key';

export interface DivvyDiaryDividend {
    exDate: string;      // YYYY-MM-DD
    payDate: string;     // YYYY-MM-DD
    amount: number;
    currency?: string;
    forecast: boolean;
}

export interface DivvyDiarySymbolResult {
    isin: string;
    name?: string;
    symbol?: string;
    currency?: string;
    dividendFrequency?: string;
    dividends: DivvyDiaryDividend[];
    error?: string;
    statusCode?: number;
}

export function getDivvyDiaryApiKey(): string {
    try {
        return (localStorage.getItem(DIVVYDIARY_API_KEY_STORAGE) || '').trim();
    } catch {
        return '';
    }
}

export function saveDivvyDiaryApiKey(apiKey: string): void {
    try {
        const cleaned = apiKey.trim();
        if (cleaned) {
            localStorage.setItem(DIVVYDIARY_API_KEY_STORAGE, cleaned);
        } else {
            localStorage.removeItem(DIVVYDIARY_API_KEY_STORAGE);
        }
    } catch {
        // Ignore storage errors
    }
}

function normalizeIsoDate(raw: unknown): string {
    if (typeof raw !== 'string') return '';
    const trimmed = raw.trim();
    const match = trimmed.match(/^(\d{4}-\d{2}-\d{2})/);
    return match ? match[1] : '';
}

function normalizeDivvyFrequency(raw: unknown): string | undefined {
    if (typeof raw !== 'string') return undefined;
    const lower = raw.trim().toLowerCase();
    if (!lower) return undefined;
    if (lower.includes('month')) return 'monthly';
    if (lower.includes('quarter')) return 'quarterly';
    if (lower.includes('semi') || lower.includes('bi') || lower.includes('half')) return 'semi-annually';
    if (lower.includes('annual') || lower.includes('year')) return 'annually';
    return undefined;
}

function parseDivvyDiaryPayload(isin: string, data: any): DivvyDiarySymbolResult {
    const rawList = Array.isArray(data?.dividends) ? data.dividends : [];
    const dividends: DivvyDiaryDividend[] = rawList
        .map((item: any): DivvyDiaryDividend | null => {
            const exDate = normalizeIsoDate(item?.exDate || item?.ex_date);
            const payDate = normalizeIsoDate(item?.payDate || item?.pay_date);
            if (!exDate && !payDate) return null;
            const amount = typeof item?.amount === 'number'
                ? item.amount
                : Number(item?.amount) || 0;
            return {
                exDate: exDate || payDate,
                payDate: payDate || exDate,
                amount,
                currency: typeof item?.currency === 'string' ? item.currency : undefined,
                forecast: Boolean(item?.forecast)
            };
        })
        .filter((x: DivvyDiaryDividend | null): x is DivvyDiaryDividend => Boolean(x))
        .sort((a: DivvyDiaryDividend, b: DivvyDiaryDividend) => a.exDate.localeCompare(b.exDate));

    const dividendCurrency = [...dividends].reverse().find(d => d.currency)?.currency;

    return {
        isin: (typeof data?.isin === 'string' && data.isin) || isin,
        name: typeof data?.name === 'string' ? data.name : undefined,
        symbol: typeof data?.symbol === 'string' ? data.symbol : undefined,
        currency: dividendCurrency || (typeof data?.currency === 'string' ? data.currency : undefined),
        dividendFrequency: normalizeDivvyFrequency(data?.dividendFrequency || data?.frequency || data?.payoutFrequency),
        dividends
    };
}

/**
 * Fetches official & forecasted dividend Ex-Dates and Pay-Dates from DivvyDiary using the user's X-API-Key.
 * Tries the local/Vercel `/api/divvydiary` proxy first, falling back to direct `api.divvydiary.com` on static hosts.
 */
export async function fetchDivvyDiaryDividends(
    isin: string,
    apiKeyOverride?: string
): Promise<DivvyDiarySymbolResult | null> {
    const cleanIsin = (isin || '').trim().toUpperCase();
    const apiKey = (apiKeyOverride !== undefined ? apiKeyOverride : getDivvyDiaryApiKey()).trim();

    if (!cleanIsin || !apiKey) return null;

    const tryRequest = async (url: string): Promise<{ status: number; data: any } | null> => {
        try {
            const res = await fetch(url, {
                headers: {
                    'X-API-Key': apiKey,
                    'Accept': 'application/json'
                }
            });
            let data: any = null;
            try {
                data = await res.json();
            } catch {
                // Non-JSON (e.g. HTML 404 on GitHub Pages for /api/divvydiary)
                return null;
            }
            return { status: res.status, data };
        } catch {
            return null;
        }
    };

    // 1. Local Vite dev middleware or Vercel Serverless Function
    let response = await tryRequest(`/api/divvydiary?isin=${encodeURIComponent(cleanIsin)}&_=${Date.now()}`);

    // 2. Fallback for GitHub Pages / static hosting (direct call with X-API-Key)
    if (!response) {
        response = await tryRequest(`https://api.divvydiary.com/symbols/${encodeURIComponent(cleanIsin)}`);
    }

    if (!response) {
        return {
            isin: cleanIsin,
            dividends: [],
            error: 'DivvyDiary API derzeit nicht erreichbar'
        };
    }

    if (response.status === 401 || response.status === 403) {
        return {
            isin: cleanIsin,
            dividends: [],
            statusCode: response.status,
            error: 'DivvyDiary API-Key ungültig oder abgelaufen'
        };
    }

    if (response.status === 404) {
        return {
            isin: cleanIsin,
            dividends: [],
            statusCode: 404,
            error: `ISIN ${cleanIsin} auf DivvyDiary nicht gefunden`
        };
    }

    if (response.status < 200 || response.status >= 300 || !response.data) {
        return {
            isin: cleanIsin,
            dividends: [],
            statusCode: response.status,
            error: response.data?.message || `DivvyDiary Fehler ${response.status}`
        };
    }

    return parseDivvyDiaryPayload(cleanIsin, response.data);
}

export async function testDivvyDiaryApiKey(apiKey: string): Promise<{ ok: boolean; message: string }> {
    const cleaned = apiKey.trim();
    if (!cleaned) {
        return { ok: false, message: 'Bitte zuerst einen DivvyDiary API-Key eingeben.' };
    }
    // Test with Petrobras ADR ISIN (or Apple if needed)
    const res = await fetchDivvyDiaryDividends('US0378331005', cleaned);
    if (!res) {
        return { ok: false, message: 'Keine Antwort von DivvyDiary erhalten.' };
    }
    if (res.error) {
        return { ok: false, message: res.error };
    }
    if (res.dividends.length === 0) {
        return { ok: false, message: 'Verbindung steht, aber keine Dividenden-Daten zurückerhalten.' };
    }
    return {
        ok: true,
        message: `Verbindung erfolgreich — ${res.dividends.length} Dividenden-Einträge von DivvyDiary geladen.`
    };
}
