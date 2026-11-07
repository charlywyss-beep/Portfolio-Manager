import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePortfolioData } from '../hooks/usePortfolioData';
import { Logo } from './Logo';
import { useCurrencyFormatter } from '../utils/currency';
import { TrendingUp } from 'lucide-react';

export function TopPerformersCard({ className }: { className?: string }) {
    const navigate = useNavigate();
    const { positions } = usePortfolioData();
    const { convertToCHF, formatCurrency } = useCurrencyFormatter();

    const stats = useMemo(() => {
        const getPerformance = (p: any) => {
            const currentValue = p.shares * p.stock.currentPrice;
            const purchaseValue = (p.purchases || []).reduce((sum: number, buy: any) => sum + (buy.shares * buy.price), 0);
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
            .filter(p => p.stock.type?.toLowerCase() === 'etf')
            .sort((a, b) => b.totalGainPercent - a.totalGainPercent);

        const stocks = enriched
            .filter(p => !p.stock.type || p.stock.type?.toLowerCase() === 'stock')
            .sort((a, b) => b.totalGainPercent - a.totalGainPercent);

        return {
            topEtfs: etfs.slice(0, 2),
            topStocks: stocks.slice(0, 2)
        };
    }, [positions, convertToCHF]);

    const renderGroup = (label: string, items: any[]) => {
        if (!items || items.length === 0) {
            return (
                <div className="flex flex-col gap-1">
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{label}</span>
                    <span className="text-sm text-muted-foreground">-</span>
                </div>
            );
        }

        return (
            <div className="flex flex-col gap-1.5 min-w-0">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{label}</span>
                <div className="flex flex-col gap-1.5 min-w-0">
                    {items.map((item) => {
                        const isPositive = item.totalGainPercent >= 0;
                        const isChfPositive = item.totalGainCHF >= 0;
                        const colorClass = isPositive
                            ? 'text-green-600 dark:text-green-400'
                            : 'text-red-600 dark:text-red-400';
                        const chfColorClass = isChfPositive
                            ? 'text-green-600 dark:text-green-400'
                            : 'text-red-600 dark:text-red-400';

                        return (
                            <div
                                key={item.id || item.stock.symbol}
                                onClick={() => item.stock?.symbol && navigate(`/stock/${item.stock.symbol}`)}
                                className="flex items-center gap-2.5 min-w-0 p-1 -mx-1 rounded-lg hover:bg-muted/60 transition-all cursor-pointer group active:scale-[0.99]"
                            >
                                <Logo
                                    url={item.stock.logoUrl}
                                    alt={item.stock.name}
                                    fallback={item.stock.symbol.slice(0, 2)}
                                    size="size-8"
                                    className="rounded-lg shadow-sm shrink-0 group-hover:scale-105 transition-transform"
                                />
                                <div className="min-w-0 flex-1">
                                    <h4 className="font-bold text-xs sm:text-sm leading-tight truncate group-hover:text-primary transition-colors" title={item.stock.name}>
                                        {item.stock.name}
                                    </h4>
                                    <p className="text-xs font-bold truncate flex items-center gap-1.5 mt-0.5">
                                        <span className={colorClass}>
                                            {item.totalGainPercent > 0 ? '+' : ''}{item.totalGainPercent.toFixed(2)}%
                                        </span>
                                        <span className="text-muted-foreground/50">·</span>
                                        <span className={`${chfColorClass} whitespace-nowrap`}>
                                            {item.totalGainCHF > 0 ? '+' : ''}{formatCurrency(item.totalGainCHF, 'CHF')}
                                        </span>
                                    </p>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    };

    return (
        <div className={`p-5 sm:p-6 rounded-xl bg-card border border-border shadow-sm h-full flex flex-col justify-between ${className || ''}`}>
            <div className="flex items-center gap-2.5 mb-3">
                <div className="p-2 rounded-lg bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400 shrink-0">
                    <TrendingUp className="size-5" />
                </div>
                <p className="text-sm text-muted-foreground font-medium">Top Performer</p>
            </div>

            <div className="flex flex-col gap-3 flex-1 justify-between">
                {renderGroup('TOP ETF', stats.topEtfs)}
                <div className="border-t border-border/60" />
                {renderGroup('TOP AKTIE', stats.topStocks)}
            </div>
        </div>
    );
}
