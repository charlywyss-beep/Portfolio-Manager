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
    const { positions: rawPositions, stocks, watchlist } = usePortfolio();
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
        // Separate Stock vs ETF
        const stockPositions = positions.filter(p => !p.stock.type || p.stock.type === 'stock');
        const etfPositions = positions.filter(p => p.stock.type === 'etf');

        const totalValueStockOnly = stockPositions.reduce((sum, p) => sum + convertToCHF(p.currentValue, p.stock.currency, rates), 0);
        const totalValueEtf = etfPositions.reduce((sum, p) => sum + convertToCHF(p.currentValue, p.stock.currency, rates), 0);

        const totalValueStock = positions.reduce((sum, p) => sum + convertToCHF(p.currentValue, p.stock.currency, rates), 0);

        // Cost Basis: Use Historical FX Rate (averageEntryFxRate)
        const totalCostStock = positions.reduce((sum, p) => {
            const entryFxRate = p.averageEntryFxRate ?? 1; // Fallback to 1.0 if missing

            // Normalize GBp Pence to Pounds for CHF Calculation
            const normalizedCostBasis = p.stock.currency === 'GBp' ? p.costBasis / 100 : p.costBasis;

            return sum + (normalizedCostBasis * entryFxRate);
        }, 0);

        const totalGainLossStock = totalValueStock - totalCostStock;

        // Fixed Deposits Totals
        const { fixedDeposits } = usePortfolio();

        const totalValueVorsorge = fixedDeposits?.reduce((sum, fd) => {
            if (fd.accountType === 'vorsorge') {
                return sum + convertToCHF(fd.amount, fd.currency, rates);
            }
            return sum;
        }, 0) || 0;

        const totalValueBank = fixedDeposits?.reduce((sum, fd) => {
            if (fd.accountType !== 'vorsorge') { // Default to bank if undefined
                return sum + convertToCHF(fd.amount, fd.currency, rates);
            }
            return sum;
        }, 0) || 0;

        const totalValueFixed = totalValueBank + totalValueVorsorge;


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

        // NEW: Calculate Daily Performance (Sum of (Price - PrevClose) * Shares)
        const totalDailyGainForStocks = positions.reduce((sum, p) => {
            // Ensure previousClose exists and is valid
            const prevClose = p.stock.previousClose || p.stock.currentPrice; // Fallback to 0 change if missing
            const dailyChangePerShare = p.stock.currentPrice - prevClose;
            const dailyChangeTotal = dailyChangePerShare * p.shares;

            return sum + convertToCHF(dailyChangeTotal, p.stock.currency, rates);
        }, 0);

        // Daily Gain Percent = Daily Gain / (Total Value - Daily Gain) * 100
        // (Total Value - Daily Gain) approximates the "Previous Close Value" of the portfolio
        const previousTotalValueStock = totalValueStock - totalDailyGainForStocks;
        const totalDailyGainPercent = previousTotalValueStock > 0
            ? (totalDailyGainForStocks / previousTotalValueStock) * 100
            : 0;


        return {
            totalValue,
            totalCost,
            gainLoss: totalGainLoss,
            gainLossPercent: totalGainLossPercent,
            projectedYearlyDividends,
            totalProjectedIncome, // Combined Dividends + Interest
            totalValueStock,
            totalCostStock,
            totalValueFixed,
            totalValueBank,      // NEW
            totalValueVorsorge,  // NEW
            totalInterestFixed,
            stockValue: totalValueStockOnly,
            etfValue: totalValueEtf,
            cashValue: totalValueBank,
            vorsorgeValue: totalValueVorsorge, // Also exposing this if needed explicitly
            dailyGain: totalDailyGainForStocks, // NEW
            dailyGainPercent: totalDailyGainPercent // NEW
        };
    }, [positions, rates, usePortfolio().fixedDeposits]);

    // Calculate upcoming dividends from stock dividend data
    const upcomingDividends = useMemo(() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0); // Normalize to start of day

        return positions
            .flatMap(p => {
                let dates: { payDate: string; exDate?: string }[] = [];

                // If we have explicit multiple dates (e.g. quarterly)
                if (p.stock.dividendDates && p.stock.dividendDates.length > 0) {
                    dates = p.stock.dividendDates
                        .filter(d => d.payDate); // Only those with payDate
                }
                // Fallback to legacy single date
                else if (p.stock.dividendPayDate) {
                    dates = [{
                        payDate: p.stock.dividendPayDate,
                        exDate: p.stock.dividendExDate
                    }];
                }

                // Filter for FUTURE dates only and sort
                const futureDates = dates
                    .filter(d => new Date(d.payDate) >= today)
                    .sort((a, b) => new Date(a.payDate).getTime() - new Date(b.payDate).getTime());

                // Return ALL future upcoming dividends within a reasonable horizon (e.g. 2 years) to allow UI filtering
                if (futureDates.length > 0) {
                    return futureDates.map(date => ({
                        stock: p.stock,
                        payDate: date.payDate,
                        exDate: date.exDate,
                        amount: p.stock.dividendAmount ? p.stock.dividendAmount * p.shares : 0,
                        currency: p.stock.dividendCurrency || p.stock.currency
                    }));
                }

                return [];
            })
            // Flatter the array of arrays
            // .flatMap is already used above, but need to ensure it's flattening correctly if map returns array
            // Actually the structure above was returning `[{...}]` for single. Now it returns `[{...}, {...}]`.
            // flatMap handles this perfectly.
            .sort((a, b) => new Date(a.payDate).getTime() - new Date(b.payDate).getTime());
    }, [positions]);


    // NEW: Calculate Bank Risk (Deposit Protection > 100k)
    const bankRisks = useMemo(() => {
        const { fixedDeposits } = usePortfolio();
        if (!fixedDeposits) return [];

        const bankTotals: Record<string, number> = {};

        fixedDeposits.forEach(fd => {
            // Skip Vorsorge (separate protection scheme) and small amounts
            if (fd.accountType === 'vorsorge') return;

            // Normalize bank name to group correctly (simple normalization)
            const bankName = fd.bankName.trim();
            if (!bankTotals[bankName]) bankTotals[bankName] = 0;

            // Convert to CHF for consistent limit check
            bankTotals[bankName] += convertToCHF(fd.amount, fd.currency, rates);
        });

        // Filter for > 100k (Esisuisse Limit)
        return Object.entries(bankTotals)
            .filter(([_, total]) => total > 100000)
            .map(([bankName, total]) => ({
                bankName,
                total,
                excess: total - 100000
            }));
    }, [usePortfolio().fixedDeposits, rates]);

    // NEW: Calculate upcoming watchlist opportunities (Ex-Date relative)
    const upcomingWatchlistDividends = useMemo(() => {
        const watchlistStocks = stocks.filter(s => watchlist.includes(s.id));
        const today = new Date();
        const futureLimit = new Date();
        futureLimit.setDate(today.getDate() + 365); // Look ahead 1 year (filtering happens in UI)

        return watchlistStocks
            .map(stock => {
                let upcomingDates: string[] = [];

                // Check quarterly dates
                if (stock.dividendDates && stock.dividendDates.length > 0) {
                    // Find ALL upcoming Ex-Dates within the next year
                    upcomingDates = stock.dividendDates
                        .filter(d => d.exDate && new Date(d.exDate) >= today && new Date(d.exDate) <= futureLimit)
                        .map(d => d.exDate)
                        .sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
                }
                // Fallback to single date
                else if (stock.dividendExDate) {
                    if (new Date(stock.dividendExDate) >= today && new Date(stock.dividendExDate) <= futureLimit) {
                        upcomingDates = [stock.dividendExDate];
                    }
                }

                if (upcomingDates.length > 0) {
                    return {
                        stock,
                        exDates: upcomingDates // Return array of dates
                    };
                }
                return null;
            })
            .filter((item): item is NonNullable<typeof item> => item !== null)
            .sort((a, b) => new Date(a.exDates[0]).getTime() - new Date(b.exDates[0]).getTime()); // Sort by earliest date
    }, [stocks, watchlist]);

    return {
        positions,
        totals,
        upcomingDividends,
        upcomingWatchlistDividends,
        bankRisks
    };
}
