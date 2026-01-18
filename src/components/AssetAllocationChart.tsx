import { useMemo, useState, useEffect } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { usePortfolioData } from '../hooks/usePortfolioData';
import { usePortfolio } from '../context/PortfolioContext';
import { useExchangeRates } from '../context/ExchangeRateContext';
import { convertToCHF, useCurrencyFormatter } from '../utils/currency';
import { FALLBACK_ALLOCATIONS } from '../data/fallbackAllocations';

// Helper for Country Normalization
const normalizeCountry = (country?: string): string => {
    if (!country) return 'Unbekannt';
    const c = country.toLowerCase().trim();
    if (c === 'switzerland' || c === 'schweiz' || c === 'ch') return 'Schweiz';
    if (c === 'united states' || c === 'usa' || c === 'us' || c === 'vereinigte staaten') return 'USA';
    if (c === 'germany' || c === 'deutschland' || c === 'de') return 'Deutschland';
    if (c === 'united kingdom' || c === 'uk' || c === 'britain' || c === 'großbritannien' || c === 'grossbritannien') return 'Grossbritannien';
    if (c === 'france' || c === 'frankreich' || c === 'fr') return 'Frankreich';
    if (c === 'ireland' || c === 'irland') return 'Irland';
    if (c === 'netherlands' || c === 'niederlande') return 'Niederlande';
    if (c === 'china' || c === 'cn') return 'China';
    if (c === 'japan' || c === 'jp') return 'Japan';
    if (c === 'world' || c === 'welt' || c === 'global' || c === 'international') return 'Welt';
    if (c === 'australia' || c === 'australien') return 'Australien';
    if (c === 'italy' || c === 'italien') return 'Italien';
    if (c === 'spain' || c === 'spanien') return 'Spanien';
    if (c === 'sweden' || c === 'schweden') return 'Schweden';
    if (c === 'denmark' || c === 'dänemark') return 'Dänemark';
    if (c === 'norway' || c === 'norwegen') return 'Norwegen';
    if (c === 'finland' || c === 'finnland') return 'Finnland';
    if (c === 'india' || c === 'indien') return 'Indien';
    if (c === 'russia' || c === 'russland') return 'Russland';
    if (c === 'brazil' || c === 'brasilien') return 'Brasilien';
    if (c === 'korea' || c === 'südkorea' || c === 'south korea') return 'Südkorea';
    if (c === 'taiwan') return 'Taiwan';
    if (c === 'hong kong' || c === 'hongkong') return 'Hongkong';
    if (c === 'singapore' || c === 'singapur') return 'Singapur';
    if (c === 'south africa' || c === 'südafrika') return 'Südafrika';
    if (c === 'other' || c === 'andere') return 'Andere';

    // Capitalize first letter as fallback
    if (country) {
        return country.charAt(0).toUpperCase() + country.slice(1).toLowerCase();
    }
    return country; // Fallback to original
};

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
            // Find stock for position (enrichment)
            // const stock = stocks.find(s => s.id === pos.stockId);
            // If stock not found in context (rare sync issue), skip or use basic pos data? 
            // Better to rely on the enriched 'pos.stock' if we trust usePortfolioData hook, 
            // BUT usePortfolioData hook might not have the latest weights if they were just patched.
            // Let's rely on 'pos.stock' from the hook as the base, but enrich weights from fallback.

            // Wait, 'pos' in this file comes from 'usePortfolioData()', which merges 'positions' and 'stocks'.
            // So 'pos.stock' IS the stock object.

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
                            'financial': 'Finanzen',
                            'communication_services': 'Kommunikation',
                            'energy': 'Energie',
                            'industrials': 'Industrie'
                        };
                        const name = rawName.toLowerCase().replace(/\s/g, '_');
                        const displayName = displayNames[name] || rawName.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

                        addToMap(displayName, valCHF * (weight / 100), pos.stock.name);
                    });
                } else {
                    // Regular Stock or ETF without weights
                    let key = pos.stock.sector || 'Andere';
                    if (pos.stock.type === 'etf' && !effectiveSectorWeights) {
                        key = 'ETF';
                    }

                    // Normalize stock sector names to match ETF German names
                    const stockSectorMap: Record<string, string> = {
                        'Technology': 'Technologie',
                        'Healthcare': 'Gesundheitswesen',
                        'Real Estate': 'Immobilien',
                        'Financial Services': 'Finanzdienstleistungen',
                        'Consumer Staples': 'Nicht-zykl. Konsum',
                        'Consumer Discretionary': 'Zykl. Konsumgüter',
                        'Industrials': 'Industrie',
                        'Energy': 'Energie',
                        'Utilities': 'Versorger',
                        'Materials': 'Rohstoffe',
                        'Communication Services': 'Kommunikation'
                    };
                    key = stockSectorMap[key] || key;

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
                        // Fix: Handle 'other' or missing keys gracefully
                        let displayName = displayNames[name] || rawName;
                        // Further normalize with helper (handles 'USA' vs 'United States' etc.)
                        displayName = normalizeCountry(displayName);

                        addToMap(displayName, valCHF * (weight / 100), pos.stock.name);
                    });
                } else {
                    // Regular Stock or ETF without weights
                    const country = pos.stock.country || 'Unbekannt';
                    addToMap(normalizeCountry(country), valCHF, pos.stock.name);
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

    const [isMobile, setIsMobile] = useState(false);
    const totalValue = useMemo(() => data.reduce((sum, item) => sum + item.value, 0), [data]);

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
                            label={({ percent }) => (percent && percent * 100 > 4) ? `${(percent * 100).toFixed(0)}%` : ''}
                            labelLine={false}
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
                            formatter={(value: string) => {
                                const item = data.find(d => d.name === value);
                                if (!item || totalValue === 0) return value;
                                const percentage = (item.value / totalValue) * 100;
                                return (
                                    <span className="text-foreground/90 ml-1">
                                        {value} <span className="font-bold text-primary/80 ml-1 text-[10px]">{percentage.toFixed(1)}%</span>
                                    </span>
                                );
                            }}
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
