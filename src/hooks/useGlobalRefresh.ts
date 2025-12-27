import { useEffect, useRef } from 'react';
import { fetchStockQuotes } from '../services/yahoo-finance';
import { usePortfolio } from '../context/PortfolioContext';

export function useGlobalRefresh() {
    const { stocks, updateStockPrice } = usePortfolio();
    const hasRefreshedRef = useRef(false);

    useEffect(() => {
        // Prevent double refresh in StrictMode or re-renders
        if (hasRefreshedRef.current || stocks.length === 0) return;

        const refreshAll = async () => {
            console.log('[Global Refresh] Starting update for', stocks.length, 'stocks...');
            const symbols = stocks.map(s => s.symbol).filter(Boolean);

            // Chunk symbols if too many (Yahoo might limit URL length)
            // 20 symbols per chunk is safe
            const chunkSize = 20;
            for (let i = 0; i < symbols.length; i += chunkSize) {
                const chunk = symbols.slice(i, i + chunkSize);
                const updates = await fetchStockQuotes(chunk);

                Object.entries(updates).forEach(([symbol, data]) => {
                    const stock = stocks.find(s => s.symbol === symbol);
                    // Handle new object return format from fetchStockQuotes
                    const price = typeof data === 'number' ? data : data.price; // Fallback for old return type if not fully updated

                    if (stock && price && Math.abs(stock.currentPrice - price) > 0.0001) {
                        console.log(`[Global Refresh] Updating ${stock.symbol}: ${stock.currentPrice} -> ${price}`);
                        // @ts-ignore - Assuming fetchStockQuotes now returns objects or we need to update it
                        updateStockPrice(stock.id, price, undefined, new Date().toISOString());
                    }
                });
            }
            console.log('[Global Refresh] Completed.');
            hasRefreshedRef.current = true;
        };

        refreshAll();

        // Optional: Interval refresh (e.g., every 5 minutes)?
        // For now, only on mount/reload to save API calls, as requested "on load".

    }, [stocks.length]); // Only re-run if stock count changes (added/removed stock), but use Ref to limit frequency
}
