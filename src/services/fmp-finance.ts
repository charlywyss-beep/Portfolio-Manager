
export async function fetchFmpQuote(symbol: string, apiKey: string): Promise<{ price: number | null, currency: string | null, marketTime: Date | null, error?: string }> {
    if (!apiKey) {
        return { price: null, currency: null, marketTime: null, error: 'Kein API Key' };
    }

    try {
        // FMP uses slightly different suffixes often, but usually Yahoo suffixes work or need conversion.
        // FMP: NESN.SW (Yahoo) -> NESN.SW (FMP usually works for major ones)

        const url = `https://financialmodelingprep.com/api/v3/quote/${symbol}?apikey=${apiKey}`;
        const response = await fetch(url);

        if (!response.ok) {
            return { price: null, currency: null, error: `FMP Error: ${response.status}`, marketTime: null };
        }

        const data = await response.json();
        const quote = data[0];

        if (!quote) {
            return { price: null, currency: null, error: 'Keine Daten (FMP)', marketTime: null };
        }

        // FMP returns 'timestamp' in seconds (Unix timestamp)

        return {
            price: quote.price,
            currency: null, // FMP quote endpoint often doesn't explicitly state currency in the simple quote.
            marketTime: quote.timestamp ? new Date(quote.timestamp * 1000) : null
        };

    } catch (error) {
        console.error("FMP Quote Error:", error);
        return { price: null, currency: null, error: 'FMP Netzwerkfehler', marketTime: null };
    }
}
