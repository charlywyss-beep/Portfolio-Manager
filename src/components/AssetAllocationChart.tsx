import { useMemo, useState, useEffect } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { usePortfolioData } from '../hooks/usePortfolioData';
import { useExchangeRates } from '../context/ExchangeRateContext';
import { convertToCHF, useCurrencyFormatter } from '../utils/currency';

export function AssetAllocationChart() {
    const { positions } = usePortfolioData();
    const [hasMounted, setHasMounted] = useState(false);

    useEffect(() => {
        setHasMounted(true);
    }, []);
    const { rates } = useExchangeRates();
    const { formatCurrency } = useCurrencyFormatter();

    const data = useMemo(() => {
        const sectorMap = new Map<string, number>();

        positions.forEach(pos => {
            const sector = pos.stock.sector || 'Andere';
            const valCHF = convertToCHF(pos.currentValue, pos.stock.currency, rates);
            sectorMap.set(sector, (sectorMap.get(sector) || 0) + valCHF);
        });

        // Convert to array and sort
        return Array.from(sectorMap.entries())
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value);
    }, [positions, rates]);

    const COLORS = [
        '#3b82f6', // blue-500
        '#10b981', // emerald-500
        '#f59e0b', // amber-500
        '#ef4444', // red-500
        '#8b5cf6', // violet-500
        '#ec4899', // pink-500
        '#06b6d4', // cyan-500
        '#6366f1', // indigo-500
    ];

    const CustomTooltip = ({ active, payload }: any) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-popover border border-border p-3 rounded-lg shadow-lg">
                    <p className="font-bold text-sm mb-1">{payload[0].name}</p>
                    <p className="text-foreground font-bold">
                        {formatCurrency(payload[0].value, 'CHF')}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                        {payload[0].payload.percent ? (payload[0].payload.percent * 100).toFixed(1) : ''}%
                    </p>
                </div>
            );
        }
        return null;
    };

    return (
        <div className="h-[300px] w-full min-h-[300px] min-w-0 flex flex-col items-center">
            {hasMounted && data.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%" debounce={100} minWidth={1} minHeight={1}>
                    <PieChart>
                        <Pie
                            data={data}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={80}
                            paddingAngle={5}
                            dataKey="value"
                        >
                            {data.map((_, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} strokeWidth={0} />
                            ))}
                        </Pie>
                        <Tooltip content={<CustomTooltip />} />
                        <Legend
                            layout="vertical"
                            verticalAlign="middle"
                            align="right"
                            wrapperStyle={{ fontSize: '12px', opacity: 0.8 }}
                        />
                    </PieChart>
                </ResponsiveContainer>
            ) : (
                <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
                    Keine Daten verfügbar
                </div>
            )}
        </div>
    );
}
