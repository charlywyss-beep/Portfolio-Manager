import { useMemo, useState, useEffect } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { usePortfolioData } from '../hooks/usePortfolioData';
import { usePortfolio } from '../context/PortfolioContext';
import { useExchangeRates } from '../context/ExchangeRateContext';
import { convertToCHF, useCurrencyFormatter } from '../utils/currency';
import { FALLBACK_ALLOCATIONS } from '../data/fallbackAllocations';
import { normalizeCountry, normalizeSector, resolveStockCountry, resolveStockSector } from '../utils/stockMetadata';

export function AssetAllocationChart() {
    const { positions } = usePortfolioData(); // Use enriched positions
    const { fixedDeposits: contextFixedDeposits, stocks } = usePortfolio(); // Use raw fixed deposits and stocks
    const { rates } = useExchangeRates();
    const { formatCurrency } = useCurrencyFormatter();
    const [activeTab, setActiveTab] = useState<'sector' | 'country' | 'currency'>('sector');
    const [hasMounted, setHasMounted] = useState(false);

    useEffect(() => {
        setHasMounted(true);
    }, []);

    // Aggregate Data
    const data = useMemo(() => {
        const map = new Map<string, { value: number, items: string[] }>();

        // Helper to add to map
        const addToMap = (key: string, val: number, itemName: string) => {
            const entry = map.get(key) || { value: 0, items: [] };
            entry.value += val;
            if (!entry.items.includes(itemName)) {
                entry.items.push(itemName);
            }
            map.set(key, entry);
        };

        // 1. Add Stocks/ETFs
        positions.forEach(pos => {
            const valCHF = convertToCHF(pos.currentValue, pos.stock.currency, rates);

            // FALLBACK LOGIC (View-Time)
            const fallback = FALLBACK_ALLOCATIONS[pos.stock.symbol];
            const effectiveSectorWeights = pos.stock.sectorWeights || fallback?.sectorWeights;
            const effectiveCountryWeights = pos.stock.countryWeights || fallback?.countryWeights;

            if (activeTab === 'sector') {
                if (pos.stock.type === 'etf' && effectiveSectorWeights) {
                    // Distribute ETF value across sectors
                    Object.entries(effectiveSectorWeights).forEach(([rawName, weight]) => {
                        const displayNames: Record<string, string> = {
                            'realestate': 'Immobilien',
                            'healthcare': 'Gesundheitswesen',
                            'basic_materials': 'Rohstoffe',
                            'consumer_cyclical': 'Zykl. Konsumgüter',
                            'financial_services': 'Finanzdienstleistungen',
                            'consumer_defensive': 'Nicht-zykl. Konsum',
                            'technology': 'Technologie',
                            'utilities': 'Versorger',
                            'financial': 'Finanzdienstleistungen',
                            'communication_services': 'Kommunikation',
                            'energy': 'Energie',
                            'industrials': 'Industrie'
                        };
                        const name = rawName.toLowerCase().replace(/\s/g, '_');
                        const displayName = displayNames[name] || normalizeSector(rawName);

                        addToMap(displayName, valCHF * (weight / 100), pos.stock.name);
                    });
                } else {
                    // Regular Stock or ETF without weights
                    let key = pos.stock.sector || resolveStockSector(pos.stock);
                    if (pos.stock.type === 'etf' && !effectiveSectorWeights) {
                        key = 'ETF';
                    }

                    // Normalize stock sector names to match standard German names
                    key = normalizeSector(key);

                    addToMap(key, valCHF, pos.stock.name);
                }
            } else if (activeTab === 'country') {
                const displayNames: Record<string, string> = {
                    'us': 'USA',
                    'uk': 'Grossbritannien',
                    'united_kingdom': 'Grossbritannien',
                    'japan': 'Japan',
                    'china': 'China',
                    'canada': 'Kanada',
                    'france': 'Frankreich',
                    'germany': 'Deutschland',
                    'switzerland': 'Schweiz',
                    'eurozone': 'Eurozone',
                    'asia_developed': 'Asien (Entw.)',
                    'asia_emerging': 'Asien (Schwellen)',
                    'australasia': 'Australien/Ozeanien',
                    'latin_america': 'Lateinamerika',
                    'europe_developed': 'Europa (Entw.)',
                    'europe_emerging': 'Europa (Schwellen)',
                    'north_america': 'Nordamerika',
                    'emerging_markets': 'Schwellenländer',
                    'australia': 'Australien',
                    'taiwan': 'Taiwan',
                    'india': 'Indien',
                    'korea': 'Südkorea',
                    'italy': 'Italien',
                    'sweden': 'Schweden',
                    'denmark': 'Dänemark',
                    'other': 'Andere'
                };

                if (pos.stock.type === 'etf' && effectiveCountryWeights) {
                    // Distribute ETF value across countries
                    Object.entries(effectiveCountryWeights).forEach(([rawName, weight]) => {
                        const name = rawName.toLowerCase().replace(/\s/g, '_');
                        let displayName = displayNames[name] || rawName;
                        displayName = normalizeCountry(displayName);

                        addToMap(displayName, valCHF * (weight / 100), pos.stock.name);
                    });
                } else {
                    // Regular Stock or ETF without weights
                    const rawCountry = pos.stock.country || resolveStockCountry(pos.stock);
                    addToMap(normalizeCountry(rawCountry), valCHF, pos.stock.name);
                }
            } else if (activeTab === 'currency') {
                addToMap(pos.stock.currency, valCHF, pos.stock.name);
            }
        });

        // 2. Add Fixed Deposits (Cash & Vorsorge)
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
                addToMap(key, valCHF, fd.bankName || 'Bankkonto');
            });
        }

        // Convert to array and sort
        return Array.from(map.entries())
            .map(([name, entry]) => {
                return { name, value: entry.value, items: entry.items };
            })
            .sort((a, b) => b.value - a.value);
    }, [positions, contextFixedDeposits, rates, activeTab, stocks]);

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
            const dataItem = payload[0].payload; // Access the full data object
            const itemsToShow = dataItem.items.slice(0, 5); // Show top 5 items
            const remaining = dataItem.items.length - 5;

            return (
                <div className="bg-popover border border-border p-3 rounded-lg shadow-lg max-w-[250px]">
                    <p className="font-bold text-sm mb-1">{dataItem.name}</p>
                    <p className="text-foreground font-bold mb-2">
                        {formatCurrency(dataItem.value, 'CHF')}
                    </p>
                    {/* List items */}
                    <div className="text-xs text-muted-foreground border-t border-border pt-2">
                        <p className="font-semibold mb-1 opacity-75">Enthält:</p>
                        <ul className="list-disc pl-3 space-y-0.5">
                            {itemsToShow.map((item: string, idx: number) => (
                                <li key={idx} className="truncate">{item}</li>
                            ))}
                        </ul>
                        {remaining > 0 && (
                            <p className="mt-1 italic opacity-75">...und {remaining} weitere</p>
                        )}
                    </div>
                </div>
            );
        }
        return null;
    };

    const totalValue = useMemo(() => data.reduce((sum, item) => sum + item.value, 0), [data]);

    return (
        <div className="w-full min-w-0 flex flex-col">
            {/* Tabs */}
            <div className="flex justify-center mb-4">
                <div className="flex p-1 bg-muted/50 rounded-lg">
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
            </div>

            {hasMounted && data.length > 0 ? (
                <div className="flex flex-col sm:flex-row items-center gap-4 w-full h-[320px] sm:h-[300px]">
                    {/* Donut Chart */}
                    <div className="w-full sm:w-[50%] h-[180px] sm:h-full relative shrink-0">
                        <ResponsiveContainer width="100%" height="100%" debounce={100} minWidth={1} minHeight={1}>
                            <PieChart>
                                <Pie
                                    data={data}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius="55%"
                                    outerRadius="88%"
                                    paddingAngle={2}
                                    dataKey="value"
                                    label={({ percent }) => (percent && percent * 100 > 5) ? `${(percent * 100).toFixed(0)}%` : ''}
                                    labelLine={false}
                                >
                                    {data.map((_, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} strokeWidth={0} />
                                    ))}
                                </Pie>
                                <Tooltip content={<CustomTooltip />} />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>

                    {/* Custom Scrollable Legend */}
                    <div className="w-full sm:w-[50%] flex flex-col max-h-[130px] sm:max-h-[290px] overflow-y-auto pr-1.5 space-y-1 text-xs overscroll-contain">
                        {data.map((item, index) => {
                            const percentage = totalValue > 0 ? (item.value / totalValue) * 100 : 0;
                            return (
                                <div
                                    key={item.name}
                                    className="flex items-center justify-between py-1 px-1.5 rounded hover:bg-muted/50 transition-colors group"
                                >
                                    <div className="flex items-center gap-2 min-w-0 flex-1 mr-2">
                                        <span
                                            className="size-2.5 rounded-full shrink-0"
                                            style={{ backgroundColor: COLORS[index % COLORS.length] }}
                                        />
                                        <span className="truncate text-foreground/90 font-medium text-xs" title={item.name}>
                                             {item.name}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-1.5 shrink-0">
                                        <span className="font-bold text-primary text-xs font-mono">
                                            {percentage.toFixed(1)}%
                                        </span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            ) : (
                <div className="h-[300px] flex items-center justify-center text-muted-foreground text-sm">
                    Keine Daten verfügbar
                </div>
            )}
        </div>
    );
}
