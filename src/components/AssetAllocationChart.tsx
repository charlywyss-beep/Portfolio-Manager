import { useMemo, useState, useEffect } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { usePortfolioData } from '../hooks/usePortfolioData';
import { usePortfolio } from '../context/PortfolioContext';
import { useExchangeRates } from '../context/ExchangeRateContext';
import { convertToCHF, useCurrencyFormatter } from '../utils/currency';
import { getFallbackAllocation } from '../data/fallbackAllocations';
import { normalizeCountry, normalizeSector, resolveStockCountry, resolveStockSector } from '../utils/stockMetadata';

interface SliceItem {
    name: string;
    value: number;
}

const RADIAN = Math.PI / 180;

export function AssetAllocationChart() {
    const { positions } = usePortfolioData(); // Use enriched positions
    const { fixedDeposits: contextFixedDeposits, stocks } = usePortfolio(); // Use raw fixed deposits and stocks
    const { rates } = useExchangeRates();
    const { formatCurrency } = useCurrencyFormatter();
    const [activeTab, setActiveTab] = useState<'sector' | 'country' | 'currency'>('sector');
    const [selectedSliceName, setSelectedSliceName] = useState<string | null>(null);
    const [hasMounted, setHasMounted] = useState(false);

    useEffect(() => {
        setHasMounted(true);
    }, []);

    useEffect(() => {
        setSelectedSliceName(null);
    }, [activeTab]);

    // Aggregate Data
    const data = useMemo(() => {
        const map = new Map<string, { value: number; itemMap: Map<string, number> }>();

        // Helper to add to map and accumulate exact CHF contribution per item
        const addToMap = (key: string, val: number, itemName: string) => {
            if (!val || val <= 0) return;
            const cleanName = (itemName || 'Unbenannt').replace(/\s+/g, ' ').trim();
            const entry = map.get(key) || { value: 0, itemMap: new Map<string, number>() };
            entry.value += val;
            entry.itemMap.set(cleanName, (entry.itemMap.get(cleanName) || 0) + val);
            map.set(key, entry);
        };

        // 1. Add Stocks/ETFs
        positions.forEach(pos => {
            const valCHF = convertToCHF(pos.currentValue, pos.stock.currency, rates);
            if (!valCHF || valCHF <= 0) return;

            // FALLBACK LOGIC (View-Time)
            const fallback = getFallbackAllocation(pos.stock);
            const isEtf = pos.stock.type === 'etf' || !!fallback;
            const effectiveSectorWeights = pos.stock.sectorWeights || fallback?.sectorWeights;
            const effectiveCountryWeights = pos.stock.countryWeights || fallback?.countryWeights;

            if (activeTab === 'sector') {
                if (isEtf && effectiveSectorWeights) {
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
                    Object.entries(effectiveSectorWeights).forEach(([rawName, weight]) => {
                        const name = rawName.toLowerCase().replace(/\s/g, '_');
                        const displayName = displayNames[name] || normalizeSector(rawName);
                        addToMap(displayName, valCHF * (weight / 100), pos.stock.name);
                    });
                } else {
                    let key = resolveStockSector(pos.stock);
                    if (isEtf && !effectiveSectorWeights) {
                        key = 'ETF';
                    } else {
                        key = normalizeSector(key);
                    }
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
                    'netherlands': 'Niederlande',
                    'spain': 'Spanien',
                    'other': 'Übrige Länder'
                };

                if (isEtf && effectiveCountryWeights) {
                    Object.entries(effectiveCountryWeights).forEach(([rawName, weight]) => {
                        const name = rawName.toLowerCase().replace(/\s/g, '_');
                        let displayName = displayNames[name] || rawName;
                        displayName = normalizeCountry(displayName);
                        addToMap(displayName, valCHF * (weight / 100), pos.stock.name);
                    });
                } else {
                    // Use authoritative company country (so US stocks bought in EUR on Xetra stay USA)
                    const resolvedCountry = resolveStockCountry(pos.stock);
                    addToMap(normalizeCountry(resolvedCountry), valCHF, pos.stock.name);
                }
            } else if (activeTab === 'currency') {
                const rawCurr = pos.stock.currency || 'CHF';
                const curr = (rawCurr === 'GBp' || rawCurr.toUpperCase() === 'GBP' || rawCurr.toUpperCase() === 'GBX') ? 'GBP' : rawCurr.toUpperCase();
                addToMap(curr, valCHF, pos.stock.name);
            }
        });

        // 2. Add Fixed Deposits (Cash & Vorsorge)
        if (contextFixedDeposits) {
            contextFixedDeposits.forEach(fd => {
                const valCHF = convertToCHF(fd.amount, fd.currency, rates);
                if (!valCHF || valCHF <= 0) return;

                let key = 'Liquidität';
                if (activeTab === 'sector') {
                    key = fd.accountType === 'vorsorge' ? 'Vorsorge' : 'Liquidität';
                } else if (activeTab === 'country') {
                    key = 'Schweiz'; // Default for local accounts
                } else if (activeTab === 'currency') {
                    const rawCurr = fd.currency || 'CHF';
                    key = (rawCurr === 'GBp' || rawCurr.toUpperCase() === 'GBP' || rawCurr.toUpperCase() === 'GBX') ? 'GBP' : rawCurr.toUpperCase();
                }

                const label = fd.accountType === 'vorsorge' && fd.bankName && !fd.bankName.toLowerCase().includes('3a') && !fd.bankName.toLowerCase().includes('vorsorge')
                    ? `${fd.bankName} (Vorsorge)`
                    : (fd.bankName || 'Bankkonto');
                addToMap(key, valCHF, label);
            });
        }

        // Convert to array and sort both slices AND inner items descending by CHF value
        return Array.from(map.entries())
            .filter(([, entry]) => entry.value > 0.01)
            .map(([name, entry]) => {
                const sortedItems: SliceItem[] = Array.from(entry.itemMap.entries())
                    .map(([itemName, itemVal]) => ({ name: itemName, value: itemVal }))
                    .sort((a, b) => b.value - a.value);
                return { name, value: entry.value, items: sortedItems };
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

    // Inside-donut label so percentages are NEVER clipped at 125%-175% browser zoom (only on segments >= 6.5%)
    const renderInsideLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) => {
        if (!percent || percent < 0.065) return null;
        const radius = innerRadius + (outerRadius - innerRadius) * 0.52;
        const x = cx + radius * Math.cos(-midAngle * RADIAN);
        const y = cy + radius * Math.sin(-midAngle * RADIAN);

        return (
            <text
                x={x}
                y={y}
                fill="#ffffff"
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={11}
                fontWeight={700}
                style={{
                    paintOrder: 'stroke',
                    stroke: 'rgba(15, 23, 42, 0.75)',
                    strokeWidth: 2.5,
                    strokeLinecap: 'round',
                    strokeLinejoin: 'round',
                    pointerEvents: 'none'
                }}
            >
                {`${Math.round(percent * 100)}%`}
            </text>
        );
    };

    const CustomTooltip = ({ active, payload }: any) => {
        if (active && payload && payload.length) {
            const dataItem = payload[0].payload as { name: string; value: number; items: SliceItem[] };
            const itemsToShow = dataItem.items.slice(0, 8);
            const remaining = dataItem.items.length - itemsToShow.length;

            return (
                <div className="bg-popover border border-border p-3 rounded-lg shadow-xl min-w-[230px] max-w-[300px] z-50">
                    <div className="flex items-baseline justify-between gap-3 mb-1.5">
                        <p className="font-bold text-sm truncate">{dataItem.name}</p>
                        <p className="text-foreground font-bold text-sm font-mono shrink-0">
                            {formatCurrency(dataItem.value, 'CHF')}
                        </p>
                    </div>
                    <div className="text-xs text-muted-foreground border-t border-border pt-2">
                        <p className="font-semibold mb-1 opacity-75">Enthält (nach Betrag):</p>
                        <ul className="space-y-1">
                            {itemsToShow.map((item, idx) => (
                                <li key={idx} className="flex items-center justify-between gap-2">
                                    <span className="truncate text-foreground/90">{item.name}</span>
                                    <span className="font-mono text-[11px] text-foreground/75 shrink-0">
                                        {formatCurrency(item.value, 'CHF')}
                                    </span>
                                </li>
                            ))}
                        </ul>
                        {remaining > 0 && (
                            <p className="mt-1.5 italic opacity-75">
                                …und {remaining} weitere (Klick für alle)
                            </p>
                        )}
                    </div>
                </div>
            );
        }
        return null;
    };

    const totalValue = useMemo(() => data.reduce((sum, item) => sum + item.value, 0), [data]);
    const selectedSlice = useMemo(
        () => (selectedSliceName ? data.find(d => d.name === selectedSliceName) || null : null),
        [data, selectedSliceName]
    );

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
                <>
                    <div className="flex flex-wrap items-center justify-center gap-4 w-full min-h-[260px]">
                        {/* Donut Chart - wraps cleanly at high zoom (150%-175%) without clipping */}
                        <div className="w-full sm:flex-1 min-w-[195px] h-[210px] sm:h-[260px] relative">
                            <ResponsiveContainer width="100%" height="100%" debounce={100} minWidth={1} minHeight={1}>
                                <PieChart margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
                                    <Pie
                                        data={data}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius="44%"
                                        outerRadius="88%"
                                        paddingAngle={2}
                                        dataKey="value"
                                        label={renderInsideLabel}
                                        labelLine={false}
                                        onClick={(entry) => {
                                            if (entry?.name) {
                                                setSelectedSliceName(prev => prev === entry.name ? null : entry.name);
                                            }
                                        }}
                                        style={{ cursor: 'pointer' }}
                                    >
                                        {data.map((entry, index) => (
                                            <Cell
                                                key={`cell-${index}`}
                                                fill={COLORS[index % COLORS.length]}
                                                strokeWidth={selectedSliceName === entry.name ? 2 : 0}
                                                stroke="hsl(var(--foreground))"
                                                opacity={selectedSliceName && selectedSliceName !== entry.name ? 0.55 : 1}
                                            />
                                        ))}
                                    </Pie>
                                    <Tooltip content={<CustomTooltip />} wrapperStyle={{ zIndex: 50 }} />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>

                        {/* Custom Scrollable Legend (compact width so label & percentage stay close together) */}
                        <div className="w-full sm:w-auto sm:min-w-[180px] max-w-[235px] flex flex-col max-h-[260px] overflow-y-auto pr-1.5 space-y-1 text-xs overscroll-contain">
                            {data.map((item, index) => {
                                const percentage = totalValue > 0 ? (item.value / totalValue) * 100 : 0;
                                const isSelected = selectedSliceName === item.name;
                                return (
                                    <button
                                        type="button"
                                        key={item.name}
                                        onClick={() => setSelectedSliceName(prev => prev === item.name ? null : item.name)}
                                        className={`w-full text-left flex items-center justify-between gap-3 py-1 px-1.5 rounded transition-colors ${isSelected ? 'bg-muted ring-1 ring-primary/40' : 'hover:bg-muted/50'}`}
                                    >
                                        <div className="flex items-center gap-2 min-w-0">
                                            <span
                                                className="size-2.5 rounded-full shrink-0"
                                                style={{ backgroundColor: COLORS[index % COLORS.length] }}
                                            />
                                            <span className="truncate text-foreground/90 font-medium text-xs" title={item.name}>
                                                {item.name}
                                            </span>
                                        </div>
                                        <span className="flex-1 border-b border-dotted border-border/50 min-w-[8px] translate-y-[1px]" />
                                        <div className="flex items-center shrink-0">
                                            <span className="font-bold text-primary text-xs font-mono">
                                                {percentage.toFixed(1)}%
                                            </span>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Expandable Full Breakdown when clicking a slice or legend row */}
                    {selectedSlice && (
                        <div className="mt-3 pt-3 border-t border-border text-xs">
                            <div className="flex items-center justify-between mb-1.5">
                                <span className="font-bold text-foreground">
                                    {selectedSlice.name} – Alle {selectedSlice.items.length} Positionen (nach Betrag)
                                </span>
                                <span className="font-bold font-mono text-primary">
                                    {formatCurrency(selectedSlice.value, 'CHF')}
                                </span>
                            </div>
                            <div className="max-h-[180px] overflow-y-auto pr-1 space-y-1">
                                {selectedSlice.items.map((item, idx) => (
                                    <div key={idx} className="flex items-center justify-between py-0.5 px-1.5 rounded bg-muted/30">
                                        <span className="truncate mr-2 text-foreground/90">{item.name}</span>
                                        <span className="font-mono text-foreground/80 shrink-0">
                                            {formatCurrency(item.value, 'CHF')}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </>
            ) : (
                <div className="h-[260px] flex items-center justify-center text-muted-foreground text-sm">
                    Keine Daten verfügbar
                </div>
            )}
        </div>
    );
}
