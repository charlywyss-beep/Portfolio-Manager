import { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid } from 'recharts';
import { usePortfolioData } from '../hooks/usePortfolioData';
import { useCurrencyFormatter } from '../utils/currency';
import { useExchangeRates } from '../context/ExchangeRateContext';
import { convertToCHF } from '../utils/currency';

export function DividendCalendarChart() {
    const { positions } = usePortfolioData();
    const { rates } = useExchangeRates();
    const { formatCurrency } = useCurrencyFormatter();

    const monthlyData = useMemo(() => {
        const months = [
            'Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun',
            'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'
        ];

        // Initialize outcome array with 0s
        const data = months.map(name => ({ name, value: 0 }));

        positions.forEach(pos => {
            const stock = pos.stock;
            if (!stock.dividendAmount && !stock.dividendYield) return;

            // Determine monthly payout amount in CHF
            let annualAmountCHF = 0;
            if (stock.dividendAmount) {
                annualAmountCHF = convertToCHF(stock.dividendAmount * pos.shares, stock.dividendCurrency || stock.currency, rates);
            } else if (stock.dividendYield) {
                // Yield is percentage of current value
                // Typically used for ETFs where amount isn't fixed per share efficiently in this model
                // We'll estimate based on yield
                const valueCHF = convertToCHF(pos.currentValue, stock.currency, rates);
                annualAmountCHF = valueCHF * (stock.dividendYield / 100);
            }

            // Distribute based on frequency/dates
            const payMonths: number[] = [];

            if (stock.dividendFrequency === 'monthly') {
                for (let i = 0; i < 12; i++) payMonths.push(i);
            } else if (stock.dividendDates && stock.dividendDates.length > 0) {
                // Use explicit dates if available
                stock.dividendDates.forEach(d => {
                    if (d.payDate) {
                        payMonths.push(new Date(d.payDate).getMonth());
                    } else if (d.exDate) {
                        // Fallback to exDate + 1 month roughly if no paydate
                        const exMonth = new Date(d.exDate).getMonth();
                        payMonths.push((exMonth + 1) % 12);
                    }
                });
            } else if (stock.dividendPayDate) {
                // Single date
                payMonths.push(new Date(stock.dividendPayDate).getMonth());
                if (stock.dividendFrequency === 'semi-annually') {
                    payMonths.push((new Date(stock.dividendPayDate).getMonth() + 6) % 12);
                } else if (stock.dividendFrequency === 'quarterly') {
                    const m = new Date(stock.dividendPayDate).getMonth();
                    payMonths.push(m, (m + 3) % 12, (m + 6) % 12, (m + 9) % 12);
                }
            } else {
                // No date known? Evenly distribute if annual amount > 0? 
                // Or skip. Let's skip to avoid noise.
            }

            // Prevent division by zero
            if (payMonths.length > 0) {

                // WAIT. Logic check:
                // If I calculated 'annualAmountCHF' correctly above, simply dividing by frequency factor would be 'amount per payment'.
                // But specifically for 'dividendAmount' (per share), that is usually 'per payment' or 'per year'? 
                // Usually 'dividendAmount' in API is 'last dividend'. 
                // Let's assume stock.dividendAmount is PER PAYMENT for simplicity in this model, 
                // UNLESS frequency is handled elsewhere.
                // In `usePortfolioData`, projected dividends uses `getFrequencyFactor`.
                // So `dividendAmount` is PER PAYMENT.

                let paymentAmountCHF = 0;
                if (stock.dividendAmount) {
                    paymentAmountCHF = convertToCHF(stock.dividendAmount * pos.shares, stock.dividendCurrency || stock.currency, rates);
                } else {
                    // Yield based is annual
                    paymentAmountCHF = annualAmountCHF / (stock.dividendFrequency === 'monthly' ? 12 : stock.dividendFrequency === 'quarterly' ? 4 : stock.dividendFrequency === 'semi-annually' ? 2 : 1);
                }

                payMonths.forEach(monthIndex => {
                    data[monthIndex].value += paymentAmountCHF;
                });
            }
        });

        return data;
    }, [positions, rates]);

    const CustomTooltip = ({ active, payload, label }: any) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-popover border border-border p-3 rounded-lg shadow-lg">
                    <p className="font-bold text-base mb-1">{label}</p>
                    <p className="text-primary font-bold">
                        {formatCurrency(payload[0].value, 'CHF')}
                    </p>
                </div>
            );
        }
        return null;
    };

    return (
        <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%" debounce={100}>
                <BarChart data={monthlyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" opacity={0.1} />
                    <XAxis
                        dataKey="name"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: 'currentColor', fontSize: 12, opacity: 0.7 }}
                        dy={10}
                    />
                    <YAxis
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: 'currentColor', fontSize: 12, opacity: 0.7 }}
                        tickFormatter={(val) => val >= 1000 ? `${(val / 1000).toFixed(1)}k` : val}
                    />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: 'currentColor', opacity: 0.05 }} />
                    <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                        {monthlyData.map((_, index) => (
                            <Cell key={`cell-${index}`} fill="hsl(var(--primary))" opacity={0.8} />
                        ))}
                    </Bar>
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
}
