import { useMemo, useState, useEffect } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { usePortfolioData } from '../hooks/usePortfolioData';
import { usePortfolio } from '../context/PortfolioContext';
import { useExchangeRates } from '../context/ExchangeRateContext';
import { convertToCHF, useCurrencyFormatter } from '../utils/currency';

export function AssetAllocationChart() {
    const { positions } = usePortfolioData(); // Use enriched positions
    const { fixedDeposits: contextFixedDeposits } = usePortfolio(); // Use raw fixed deposits
    const { rates } = useExchangeRates();
    const { formatCurrency } = useCurrencyFormatter();
    const [activeTab, setActiveTab] = useState<'sector' | 'country' | 'currency'>('sector');
    const [hasMounted, setHasMounted] = useState(false);

    useEffect(() => {
        setHasMounted(true);
    }, []);

    const data = useMemo(() => {
        const map = new Map<string, number>();

        // 1. Add Stocks/ETFs
        positions.forEach(pos => {
            let key = 'Andere';
            if (activeTab === 'sector') key = pos.stock.sector || 'Andere';
            else if (activeTab === 'country') key = pos.stock.country || 'Unbekannt';
            else if (activeTab === 'currency') key = pos.stock.currency;

            const valCHF = convertToCHF(pos.currentValue, pos.stock.currency, rates);
            map.set(key, (map.get(key) || 0) + valCHF);
        });

        // 2. Add Fixed Deposits (Cash & Vorsorge)
        // Only relevant for Sector (Liquidität/Vorsorge) and Currency
        // For Country, we assume "Switzerland" for now as default for local bank accounts? 
        // Or "Cash"? Let's stick to "Schweiz" for simplicity as standard.
        if (contextFixedDeposits) {
            contextFixedDeposits.forEach(fd => {
                let key = 'Liquidität';
                if (activeTab === 'sector') {
                    key = fd.accountType === 'vorsorge' ? 'Vorsorge' : 'Liquidität';
                } else if (activeTab === 'country') {
                    key = 'Schweiz'; // Default for local accounts
                } else if (activeTab === 'currency') {
                    key = fd.currency;
                }

                const valCHF = convertToCHF(fd.amount, fd.currency, rates);
                map.set(key, (map.get(key) || 0) + valCHF);
            });
        }

        // Convert to array and sort
        return Array.from(map.entries())
            .map(([name, value]) => {
                // Determine color key for consistent coloring if possible
                return { name, value };
            })
            .sort((a, b) => b.value - a.value);
    }, [positions, contextFixedDeposits, rates, activeTab]);

    // Enhanced Color Palette
    const COLORS = [
        '#3b82f6', // blue-500
        '#10b981', // emerald-500
        '#f59e0b', // amber-500
        '#ef4444', // red-500
        '#8b5cf6', // violet-500
        '#ec4899', // pink-500
        '#06b6d4', // cyan-500
        '#6366f1', // indigo-500
        '#84cc16', // lime-500
        '#14b8a6', // teal-500
        '#f43f5e', // rose-500
        '#d946ef', // fuchsia-500
    ];

    const CustomTooltip = ({ active, payload }: any) => {
        if (active && payload && payload.length) {
            // Recharts Pie Custom Tooltip gets raw payload
            return (
                <div className="bg-popover border border-border p-3 rounded-lg shadow-lg">
                    <p className="font-bold text-sm mb-1">{payload[0].name}</p>
                    <p className="text-foreground font-bold">
                        {formatCurrency(payload[0].value, 'CHF')}
                    </p>
                </div>
            );
        }
        return null;
    };

    const [isMobile, setIsMobile] = useState(false);

    useEffect(() => {
        const checkMobile = () => {
            setIsMobile(window.innerWidth < 768);
        };

        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    return (
        <div className="h-[450px] w-full min-h-[300px] min-w-0 flex flex-col items-center">
            {/* Tabs */}
            <div className="flex p-1 bg-muted/50 rounded-lg mb-4">
                <button
                    onClick={() => setActiveTab('sector')}
                    className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${activeTab === 'sector' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                >
                    Sektor
                </button>
                <button
                    onClick={() => setActiveTab('country')}
                    className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${activeTab === 'country' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                >
                    Land
                </button>
                <button
                    onClick={() => setActiveTab('currency')}
                    className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${activeTab === 'currency' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                >
                    Währung
                </button>
            </div>

            {hasMounted && data.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%" debounce={100} minWidth={1} minHeight={1}>
                    <PieChart>
                        <Pie
                            data={data}
                            cx={isMobile ? "50%" : "50%"}
                            cy="45%"
                            innerRadius="50%"
                            outerRadius="90%"
                            paddingAngle={2}
                            dataKey="value"
                        >
                            {data.map((_, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} strokeWidth={0} />
                            ))}
                        </Pie>
                        <Tooltip content={<CustomTooltip />} />
                        <Legend
                            layout={isMobile ? "horizontal" : "vertical"}
                            verticalAlign={isMobile ? "bottom" : "middle"}
                            align={isMobile ? "center" : "right"}
                            wrapperStyle={isMobile ? { fontSize: '11px', paddingTop: '20px', width: '100%' } : { fontSize: '12px', opacity: 0.9, paddingLeft: '20px', maxWidth: '40%' }}
                            iconSize={isMobile ? 10 : 12}
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
