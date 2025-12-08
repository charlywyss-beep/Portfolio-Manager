import { useMemo } from 'react';
import { usePortfolio } from '../context/PortfolioContext';

export function usePortfolioData() {
    const { positions: rawPositions, stocks } = usePortfolio();

    const positions = useMemo(() => {
        return rawPositions.map((pos) => {
            const stock = stocks.find((s) => s.id === pos.stockId);
            if (!stock) return null;

            const currentValue = pos.shares * stock.currentPrice;
            const costBasis = pos.shares * pos.buyPriceAvg;
            const gainLoss = currentValue - costBasis;
            const gainLossPercent = (gainLoss / costBasis) * 100;

            return {
                ...pos,
                stock,
                currentValue,
                costBasis,
                gainLoss,
                gainLossPercent,
            };
        }).filter((p): p is NonNullable<typeof p> => p !== null);
    }, [rawPositions, stocks]);

    const totals = useMemo(() => {
        const totalValue = positions.reduce((sum, p) => sum + p.currentValue, 0);
        const totalCost = positions.reduce((sum, p) => sum + p.costBasis, 0);
        const totalGainLoss = totalValue - totalCost;
        const totalGainLossPercent = totalCost > 0 ? (totalGainLoss / totalCost) * 100 : 0;

        // Calculate projected yearly dividends
        const projectedYearlyDividends = positions.reduce((sum, p) => {
            if (p.stock.dividendAmount) {
                return sum + (p.stock.dividendAmount * p.shares);
            } else if (p.stock.dividendYield) {
                return sum + (p.currentValue * (p.stock.dividendYield / 100));
            }
            return sum;
        }, 0);

        return {
            totalValue,
            totalCost,
            gainLoss: totalGainLoss,
            gainLossPercent: totalGainLossPercent,
            projectedYearlyDividends,
        };
    }, [positions]);

    // Calculate upcoming dividends from stock dividend data
    const upcomingDividends = useMemo(() => {
        return positions
            .filter(p => p.stock.dividendPayDate)
            .map(p => ({
                stock: p.stock,
                payDate: p.stock.dividendPayDate!,
                amount: p.stock.dividendAmount ? p.stock.dividendAmount * p.shares : 0,
                currency: p.stock.dividendCurrency || p.stock.currency
            }))
            .sort((a, b) => new Date(a.payDate).getTime() - new Date(b.payDate).getTime());
    }, [positions]);

    return {
        positions,
        totals,
        upcomingDividends,
    };
}
