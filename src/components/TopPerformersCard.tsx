import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePortfolioData } from '../hooks/usePortfolioData';
import { Logo } from './Logo';
import { useCurrencyFormatter } from '../utils/currency';
import { isLikelyEtf } from '../utils/stockMetadata';
import { TrendingUp } from 'lucide-react';
import { cn } from '../utils';

export function TopPerformersCard({ className }: { className?: string }) {
    const navigate = useNavigate();
    const { positions } = usePortfolioData();
    const { convertToCHF, formatCurrency } = useCurrencyFormatter();

    const stats = useMemo(() => {
        // Helper to calculate gain % and value
        const getPerformance = (p: any) => {
            const currentValue = p.shares * p.stock.currentPrice;
            const purchaseValue = (p.purchases || []).reduce((sum: number, buy: any) => sum + (buy.shares * buy.price), 0);
            // FX-aware CHF calculation
            const currentValueCHF = convertToCHF(currentValue, p.stock.currency);
            const entryFxRate = p.averageEntryFxRate || 1;
            const purchaseValueCHF = p.stock.currency !== 'CHF'
                ? purchaseValue * entryFxRate
                : purchaseValue;
            const totalGainCHF = currentValueCHF - purchaseValueCHF;
            const gainPercent = purchaseValueCHF > 0 ? (totalGainCHF / purchaseValueCHF) * 100 : 0;
            return {
                ...p,
                totalGain: currentValue - purchaseValue,
                totalGainCHF,
                totalGainPercent: gainPercent
            };
        };

        const enriched = positions.map(getPerformance);

        const etfs = enriched
            .filter(p => p.stock.type?.toLowerCase() === 'etf' || isLikelyEtf(p.stock))
            .sort((a, b) => b.totalGainPercent - a.totalGainPercent);

        const stocks = enriched
            .filter(p => !p.stock.type || (p.stock.type?.toLowerCase() === 'stock' && !isLikelyEtf(p.stock)))
            .sort((a, b) => b.totalGainPercent - a.totalGainPercent);

        return {
            topEtfs: etfs.slice(0, 2),
            topStocks: stocks.slice(0, 2)
        };
    }, [positions, convertToCHF]);

    const renderItem = (item: any) => {
        if (!item) return null;
        const isPositive = item.totalGainPercent >= 0;
        const colorClass = isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400';

        return (
            <div
                key={item.stock.symbol || item.stock.id}
                onClick={() => item.stock?.symbol && navigate(`/stock/${item.stock.symbol}`)}
                className="flex items-center gap-3 p-1.5 -mx-1.5 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer group active:scale-[0.99]"
                title={`${item.stock.name} Details ansehen`}
            >
                <Logo
                    url={item.stock.logoUrl}
                    alt={item.stock.name}
                    fallback={item.stock.symbol?.slice(0, 2) || 'ST'}
                    size="size-9"
                    className="rounded-lg shadow-sm shrink-0 group-hover:scale-105 transition-transform"
                />
                <div className="min-w-0 flex-1">
                    <h4 className="font-bold text-sm truncate text-foreground group-hover:text-primary transition-colors" title={item.stock.name}>
                        {item.stock.name}
                    </h4>
                    <p className={cn("text-xs font-semibold truncate", colorClass)}>
                        {isPositive ? '+' : ''}{item.totalGainPercent.toFixed(2)}%
                        <span className="text-muted-foreground mx-1 font-normal">•</span>
                        {item.totalGainCHF >= 0 ? '+' : ''}{formatCurrency(item.totalGainCHF, 'CHF')}
                    </p>
                </div>
            </div>
        );
    };

    return (
        <div className={cn("p-5 rounded-xl bg-card border border-border shadow-sm h-full flex flex-col justify-between", className)}>
            <div>
                {/* Header: Icon + Title side-by-side */}
                <div className="flex items-center gap-2.5 mb-4">
                    <div className="p-2 rounded-lg bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400 shrink-0">
                        <TrendingUp className="size-5" />
                    </div>
                    <h3 className="font-bold text-base text-foreground tracking-tight">Top Performer</h3>
                </div>

                {/* TOP ETF Section (Top 2) */}
                <div className="space-y-1 mb-4">
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold block mb-0.5">TOP ETF</span>
                    <div className="space-y-1">
                        {stats.topEtfs.map(etf => renderItem(etf))}
                        {stats.topEtfs.length === 0 && <span className="text-xs text-muted-foreground italic">Keine ETFs im Portfolio</span>}
                    </div>
                </div>

                {/* TOP AKTIE Section (Top 2) */}
                <div className="space-y-1">
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold block mb-0.5">TOP AKTIE</span>
                    <div className="space-y-1">
                        {stats.topStocks.map(stock => renderItem(stock))}
                        {stats.topStocks.length === 0 && <span className="text-xs text-muted-foreground italic">Keine Aktien im Portfolio</span>}
                    </div>
                </div>
            </div>
        </div>
    );
}
