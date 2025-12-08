import { useMemo } from 'react';
import { usePortfolio } from '../context/PortfolioContext';
import { MOCK_DIVIDENDS } from '../data/mockData';
import type { Position, Stock } from '../types';

export function usePortfolioData() {
    const { positions: rawPositions, stocks } = usePortfolio();

    // Merge positions with stock data
    const portfolioPositions = useMemo(() => {
        return rawPositions.map(pos => {
            const stock = stocks.find(s => s.id === pos.stockId);
            if (!stock) return null;

            const currentValue = pos.shares * stock.currentPrice;
            const investValue = pos.shares * pos.buyPriceAvg;
            const gainLoss = currentValue - investValue;
            const gainLossPercent = investValue !== 0 ? (gainLoss / investValue) * 100 : 0;

            // Project yearly dividend
            const yearlyDividend = stock.dividendYield ? (currentValue * (stock.dividendYield / 100)) : 0;

            return {
                ...pos,
                stock,
                currentValue,
                gainLoss,
                gainLossPercent,
                yearlyDividend
            };
        }).filter((p): p is (Position & { stock: Stock, currentValue: number, gainLoss: number, gainLossPercent: number, yearlyDividend: number }) => p !== null);
    }, [rawPositions, stocks]);

    const totals = useMemo(() => {
        return portfolioPositions.reduce((acc, pos) => {
            acc.totalValue += pos.currentValue;
            acc.totalInvested += (pos.shares * pos.buyPriceAvg);
            acc.projectedYearlyDividends += pos.yearlyDividend;
            return acc;
        }, { totalValue: 0, totalInvested: 0, projectedYearlyDividends: 0 });
    }, [portfolioPositions]);

    const upcomingDividends = useMemo(() => {
        // Simple mock logic: just take the mock dividends and add stock info
        return MOCK_DIVIDENDS.map(div => {
            const stock = stocks.find(s => s.id === div.stockId);
            return { ...div, stock };
        }).sort((a, b) => new Date(a.payDate).getTime() - new Date(b.payDate).getTime());
    }, [stocks]);

    return {
        positions: portfolioPositions,
        totals: {
            ...totals,
            gainLoss: totals.totalValue - totals.totalInvested,
            gainLossPercent: totals.totalInvested ? ((totals.totalValue - totals.totalInvested) / totals.totalInvested) * 100 : 0
        },
        upcomingDividends
    };
}
