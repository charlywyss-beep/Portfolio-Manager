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

                Object.entries(updates).forEach(([symbol, newPrice]) => {
                    const stock = stocks.find(s => s.symbol === symbol);
                    if (stock && Math.abs(stock.currentPrice - newPrice) > 0.0001) {
                        console.log(`[Global Refresh] Updating ${stock.symbol}: ${stock.currentPrice} -> ${newPrice}`);
                        updateStockPrice(stock.id, newPrice);
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
