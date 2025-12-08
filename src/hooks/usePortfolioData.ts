import { useMemo } from 'react';
import { usePortfolio } from '../context/PortfolioContext';
import { useExchangeRates } from '../context/ExchangeRateContext';
import { convertToCHF } from '../utils/currency';

// Helper to get frequency multiplication factor
const getFrequencyFactor = (freq?: string) => {
    switch (freq) {
        case 'monthly': return 12;
        case 'quarterly': return 4;
        case 'semi-annually': return 2;
        case 'annually': return 1;
        default: return 1;
    }
};

export function usePortfolioData() {
    const { positions: rawPositions, stocks } = usePortfolio();
    const { rates } = useExchangeRates();

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
        const totalValueStock = positions.reduce((sum, p) => sum + convertToCHF(p.currentValue, p.stock.currency, rates), 0);
        const totalCostStock = positions.reduce((sum, p) => sum + convertToCHF(p.costBasis, p.stock.currency, rates), 0);
        const totalGainLossStock = totalValueStock - totalCostStock;

        // Fixed Deposits Totals
        const { fixedDeposits } = usePortfolio();
        const totalValueFixed = fixedDeposits?.reduce((sum, fd) => sum + convertToCHF(fd.amount, fd.currency, rates), 0) || 0;
        const totalInterestFixed = fixedDeposits?.reduce((sum, fd) => {
            const interest = fd.amount * (fd.interestRate / 100);
            return sum + convertToCHF(interest, fd.currency, rates);
        }, 0) || 0;

        const totalValue = totalValueStock + totalValueFixed;
        const totalCost = totalCostStock + totalValueFixed; // Treat FD amount as cost basis
        const totalGainLoss = totalGainLossStock; // FDs don't have capital gains in this simple model, only interest
        const totalGainLossPercent = totalCost > 0 ? (totalGainLoss / totalCost) * 100 : 0;

        // Calculate projected yearly dividends (Converted to CHF)
        const projectedYearlyDividends = positions.reduce((sum, p) => {
            let dividendValue = 0;
            if (p.stock.dividendAmount) {
                // Annualize based on frequency
                const factor = getFrequencyFactor(p.stock.dividendFrequency);
                dividendValue = p.stock.dividendAmount * p.shares * factor;
            } else if (p.stock.dividendYield) {
                dividendValue = p.currentValue * (p.stock.dividendYield / 100);
            }
            // Convert dividend value to CHF
            // Note: dividendCurrency might differ from stock currency, but fallback to stock currency
            const currency = p.stock.dividendCurrency || p.stock.currency;
            return sum + convertToCHF(dividendValue, currency, rates);
        }, 0);

        const totalProjectedIncome = projectedYearlyDividends + totalInterestFixed;

        return {
            totalValue,
            totalCost,
            gainLoss: totalGainLoss,
            gainLossPercent: totalGainLossPercent,
            projectedYearlyDividends,
            totalProjectedIncome, // Combined Dividends + Interest
            totalValueStock,
            totalValueFixed,
            totalInterestFixed
        };
    }, [positions, rates, usePortfolio().fixedDeposits]);

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
