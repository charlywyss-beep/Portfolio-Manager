import { useMemo } from 'react';
import { usePortfolioData } from '../hooks/usePortfolioData';
import { Logo } from './Logo';
import { useCurrencyFormatter } from '../utils/currency';
import { TrendingUp } from 'lucide-react';

export function TopPerformersCard({ className }: { className?: string }) {
    const { positions } = usePortfolioData();
    const { convertToCHF, formatCurrency } = useCurrencyFormatter();

    const stats = useMemo(() => {
        // Helper to calculate gain % and value
        const getPerformance = (p: any) => {
            const currentValue = p.shares * p.stock.currentPrice;
            const purchaseValue = (p.purchases || []).reduce((sum: number, buy: any) => sum + (buy.shares * buy.price), 0);
            const totalGain = currentValue - purchaseValue;
            const gainPercent = purchaseValue > 0 ? (totalGain / purchaseValue) * 100 : 0;
            return {
                ...p,
                totalGain,
                totalGainCHF: convertToCHF(totalGain, p.stock.currency),
                totalGainPercent: gainPercent
            };
        };

        const enriched = positions.map(getPerformance);

        const etfs = enriched
            .filter(p => p.stock.type?.toLowerCase() === 'etf')
            .sort((a, b) => b.totalGainPercent - a.totalGainPercent);

        const stocks = enriched
            .filter(p => !p.stock.type || p.stock.type?.toLowerCase() === 'stock')
            .sort((a, b) => b.totalGainPercent - a.totalGainPercent);

        return {
            topEtf: etfs[0],
            topStock: stocks[0]
        };
    }, [positions, convertToCHF]);

    const renderItem = (label: string, item: any) => {
        if (!item) return (
            <div className="flex flex-col gap-1">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{label}</span>
                <span className="text-sm text-muted-foreground">-</span>
            </div>
        );

        return (
            <div className="flex flex-col gap-1">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{label}</span>
                <div className="flex items-center gap-3">
                    <Logo
                        url={item.stock.logoUrl}
                        alt={item.stock.name}
                        fallback={item.stock.symbol.slice(0, 2)}
                        size="size-10" // Prominent Logo size
                        className="rounded-lg shadow-sm"
                    />
                    <div className="min-w-0">
                        <h4 className="font-bold text-sm truncate max-w-[150px] md:max-w-[200px]" title={item.stock.name}>
                            {item.stock.name}
                        </h4>
                        <p className={`text-xs font-bold ${item.totalGainPercent >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                            {item.totalGainPercent > 0 ? '+' : ''}{item.totalGainPercent.toFixed(2)}%
                            <span className="text-muted-foreground font-normal ml-1">
                                ({formatCurrency(item.totalGainCHF, 'CHF')})
                            </span>
                        </p>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className={`p-6 rounded-xl bg-card border border-border shadow-sm h-full flex flex-col gap-4 ${className || ''}`}>
            <div className="flex items-center gap-2 mb-2">
                <div className="p-2 rounded-lg bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400">
                    <TrendingUp className="size-6" />
                </div>
                {/* <h3 className="font-bold text-lg">Top Performer</h3> */}
            </div>

            <div className="flex flex-col gap-6">
                {renderItem('TOP ETF', stats.topEtf)}
                {renderItem('TOP AKTIE', stats.topStock)}
            </div>
        </div>
    );
}
