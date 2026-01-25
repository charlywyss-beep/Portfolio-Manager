
import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { usePortfolio } from '../context/PortfolioContext';

import { useCurrencyFormatter } from '../utils/currency';
import { ArrowLeft, RefreshCw, TrendingUp, Map as MapIcon, Save, Trash2 } from 'lucide-react';
import { useAutoRefresh } from '../hooks/useAutoRefresh';
import { FALLBACK_ALLOCATIONS } from '../data/fallbackAllocations';
import { estimateMarketState } from '../utils/market';
import { PriceHistoryChart } from '../components/PriceHistoryChart';
import { cn } from '../utils';
import { Logo } from '../components/Logo';
import { AddToWatchlistModal } from '../components/AddToWatchlistModal'; // New Import

import { fetchStockHistory, fetchStockQuote, type TimeRange, type ChartDataPoint } from '../services/yahoo-finance';

export function StockDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { stocks, positions, updateStock, updateStockPrice, addQuickLink, removeQuickLink, watchlists } = usePortfolio();
    const { formatCurrency } = useCurrencyFormatter();
    const [isWatchlistModalOpen, setIsWatchlistModalOpen] = useState(false); // Modal State

    const [virtualStock, setVirtualStock] = useState<any>(null);

    // Find stock by ID or Symbol (case-insensitive)
    const stockFromContext = stocks.find(s =>
        s.id.trim() === id?.trim() ||
        s.symbol.toLowerCase() === id?.toLowerCase()
    );

    const stock = stockFromContext || virtualStock;

    // Initialize virtual stock if not found in context (v3.13.44)
    useEffect(() => {
        if (!stockFromContext && id && !virtualStock) {
            setVirtualStock({
                id: id,
                symbol: id.toUpperCase(),
                name: id.toUpperCase(),
                currentPrice: 0,
                currency: 'USD',
                type: 'stock'
            });
        }
    }, [stockFromContext, id, !!virtualStock]);

    const [notes, setNotes] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [timeRange, setTimeRange] = useState<TimeRange>('1D');
    const [chartData, setChartData] = useState<ChartDataPoint[] | null>(null);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
    const [quoteDate, setQuoteDate] = useState<Date | null>(null);
    const [minutesAgo, setMinutesAgo] = useState(0);

    // Update time ago string every minute
    useEffect(() => {
        if (!lastUpdate) return;

        const updateDiff = () => {
            const diff = Math.floor((new Date().getTime() - lastUpdate.getTime()) / 60000);
            setMinutesAgo(diff);
        };

        // Initial update
        updateDiff();

        const interval = setInterval(updateDiff, 5000); // Check every 5 seconds to be precise enough (doesn't hurt performance)
        return () => clearInterval(interval);
    }, [lastUpdate]);

    // Sanity Check for Previous Close (v3.12.111)
    // Fixes WINC.L reporting 0.04 instead of 4.2x in Chart Header AND Sidebar
    const safePreviousClose = (() => {
        let prev = stock?.previousClose;
        if (prev && stock?.currentPrice) {
            const ratio = stock.currentPrice / prev;
            if (ratio > 90 && ratio < 110) prev = prev * 100;
            if (ratio > 0.009 && ratio < 0.011) prev = prev / 100;
        }
        return prev;
    })();

    // Get position to determine buy date
    const position = positions.find(p => p.stockId === stock?.id);

    // Position buy date ref
    const buyDateRef = position?.buyDate;

    // Load data function (memoized for auto-refresh)
    // Use a Ref to always access the LATEST stock state in callbacks without recreating them
    const latestStockRef = useRef(stock);
    useEffect(() => {
        latestStockRef.current = stock;
    }, [stock]);

    // Load data function (memoized for auto-refresh)
    const loadData = useCallback(async () => {
        const currentStock = latestStockRef.current;
        if (!currentStock?.symbol || !currentStock?.id) {
            setChartData(null);
            return;
        }

        const { symbol, trailingPE, forwardPE, eps, dividendYield } = currentStock;

        setIsRefreshing(true);
        // console.log('[StockDetail] Fetching Yahoo Finance data for:', symbol, 'Range:', timeRange);

        let rangeToUse = timeRange;

        // Handle 'BUY' range
        if (timeRange === 'BUY') {
            if (buyDateRef) {
                // If buy date is less than 1 year ago, use 1Y (Daily) instead of 5Y (Weekly)
                const buyDate = new Date(buyDateRef);
                const oneYearAgo = new Date();
                oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

                if (buyDate > oneYearAgo) {
                    rangeToUse = '1Y'; // Daily data
                } else {
                    rangeToUse = '5Y'; // Weekly data
                }
            } else {
                rangeToUse = '5Y'; // Default fallback
            }
        }

        let response = await fetchStockHistory(symbol, rangeToUse);

        // FALLBACK: If 1D data is empty (common for EU stocks), try 1W
        if ((!response.data || response.data.length === 0) && rangeToUse === '1D') {
            console.warn('[StockDetail] 1D data empty, trying fallback to 1W for', symbol);
            response = await fetchStockHistory(symbol, '1W');
        }

        // NEW: Filter for 'BUY' range (Seit Kauf)
        // Ensure we only show data starting from the buy date
        if (timeRange === 'BUY' && buyDateRef && response.data && response.data.length > 0) {
            try {
                let buyDate: Date;
                // Handle "DD.MM.YYYY" format manually if needed, or standard Date
                if (typeof buyDateRef === 'string' && buyDateRef.includes('.')) {
                    const [d, m, y] = buyDateRef.split('.');
                    buyDate = new Date(`${y}-${m}-${d}`);
                } else {
                    buyDate = new Date(buyDateRef);
                }

                if (!isNaN(buyDate.getTime())) {
                    // Set time to 00:00:00 to be inclusive of the buy day
                    buyDate.setHours(0, 0, 0, 0);

                    const filteredData = response.data.filter(point => {
                        const pointDate = new Date(point.date);
                        return pointDate >= buyDate;
                    });

                    // Only apply filter if we have data left
                    if (filteredData.length > 0) {
                        console.log(`[StockDetail] Filtering BUY range: ${filteredData.length} points from ${buyDate.toISOString()}`);
                        response.data = filteredData;
                    } else {
                        console.warn('[StockDetail] BUY range filter resulted in empty data, showing full history.');
                    }
                }
            } catch (e) {
                console.error('[StockDetail] Error filtering BUY range:', e);
            }
        }



        if (response.error) {
            console.warn('[StockDetail] Error from Yahoo:', response.error);
            setChartData(null);
        } else {
            // Price is already normalized by fetchStockHistory (v3.12.72)
            setChartData(response.data);
        }

        // Parallel: Fetch latest Quote (METADATA ONLY)
        // STRICT: Price is handled by Chart Sync (useEffect). Quote is only for PE/EPS/Yield.
        if (timeRange !== 'BUY') {
            const quoteResponse = await fetchStockQuote(symbol);
            if (quoteResponse.price) {
                if (quoteResponse.marketTime) {
                    setQuoteDate(quoteResponse.marketTime);
                }

                // Removed: Logic that updated price from Quote or merged Chart/Quote.
                // Principle: "Chart has the truth for current price."

                const updates: any = {};
                let hasUpdates = false;

                if (quoteResponse.trailingPE !== undefined && quoteResponse.trailingPE !== null && Math.abs((trailingPE || 0) - quoteResponse.trailingPE) > 0.01) {
                    updates.trailingPE = quoteResponse.trailingPE;
                    hasUpdates = true;
                }
                if (quoteResponse.forwardPE !== undefined && quoteResponse.forwardPE !== null && Math.abs((forwardPE || 0) - quoteResponse.forwardPE) > 0.01) {
                    updates.forwardPE = quoteResponse.forwardPE;
                    hasUpdates = true;
                }
                if (quoteResponse.eps !== undefined && quoteResponse.eps !== null && Math.abs((eps || 0) - quoteResponse.eps) > 0.001) {
                    updates.eps = quoteResponse.eps;
                    hasUpdates = true;
                }
                if (quoteResponse.dividendYield !== undefined && quoteResponse.dividendYield !== null && Math.abs((dividendYield || 0) - quoteResponse.dividendYield) > 0.01) {
                    updates.dividendYield = quoteResponse.dividendYield;
                    hasUpdates = true;
                }
                if (quoteResponse.sectorWeights !== undefined && quoteResponse.sectorWeights !== null) {
                    updates.sectorWeights = quoteResponse.sectorWeights;
                    hasUpdates = true;
                }
                if (quoteResponse.countryWeights !== undefined && quoteResponse.countryWeights !== null) {
                    updates.countryWeights = quoteResponse.countryWeights;
                    hasUpdates = true;
                }

                if (quoteResponse.countryWeights !== undefined && quoteResponse.countryWeights !== null) {
                    updates.countryWeights = quoteResponse.countryWeights;
                    hasUpdates = true;
                }

                if (hasUpdates) {
                    if (stockFromContext) {
                        updateStock(stock.id, updates);
                    } else {
                        setVirtualStock((prev: any) => ({ ...prev, ...updates }));
                    }
                }
            }
        }
        setIsRefreshing(false);
        setLastUpdate(new Date());
    }, [timeRange, id, position?.buyDate]); // STABLE: only depend on id string, not stock object

    // Initial load
    useEffect(() => {
        loadData();
    }, [loadData]);

    // Auto-refresh every 5 minutes during trading hours (09:00-22:00)
    useAutoRefresh({
        onRefresh: loadData,
        enabled: !!stock
    });

    // Initialize notes
    useEffect(() => {
        if (stock) {
            setNotes(stock.notes || '');
        }
    }, [stock]);

    // Update Price for Virtual Stock
    useEffect(() => {
        if (timeRange === '1D' && chartData && chartData.length > 0 && stock) {
            const lastPoint = chartData[chartData.length - 1];
            if (lastPoint && lastPoint.value) {
                if (stockFromContext) {
                    // Stable update check happens inside updateStockPrice (v3.12.111)
                    updateStockPrice(stock.id, lastPoint.value, undefined, lastPoint.date);
                } else if (!virtualStock?.currentPrice || Math.abs(virtualStock.currentPrice - lastPoint.value) > 0.001) {
                    setVirtualStock((prev: any) => ({ ...prev, currentPrice: lastPoint.value }));
                }
            }
        }
    }, [chartData, timeRange, id, !!stockFromContext]); // STABLE: only depend on id and flag

    if (!stock) return <div className="p-8">Aktie nicht gefunden.</div>;

    const handleSaveNotes = async () => {
        setIsSaving(true);
        // Simulate small delay for UI feedback
        await new Promise(r => setTimeout(r, 500));
        updateStock(stock.id, { notes });
        setIsSaving(false);
    };

    return (
        <div className="p-2 md:p-8 space-y-4 md:space-y-8 duration-500 pb-16">
            {/* Sticky Header / Navigation */}
            <div className="sticky top-16 -mx-2 md:-mx-8 px-2 md:px-8 py-4 z-50 bg-background border-b border-border shadow-md transition-all -mt-2 md:-mt-8 mb-4 md:mb-6">
                <div className="flex items-center gap-3 mb-4">
                    <button
                        onClick={() => navigate(-1)}
                        className="flex items-center text-xs md:text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors font-medium bg-blue-50 dark:bg-blue-900/10 px-3 py-1.5 rounded-md shadow-sm border border-blue-100 dark:border-blue-900/30 whitespace-nowrap"
                    >
                        <ArrowLeft className="size-3 md:size-4 mr-1.5" />
                        Zurück
                    </button>

                    {/* Button moved to Chart Header */}
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div
                            className={cn(
                                "bg-card rounded-xl",
                                positions.find(p => p.stockId === stock.id) && "cursor-pointer hover:scale-105 transition-transform"
                            )}
                            onClick={() => {
                                if (positions.find(p => p.stockId === stock.id)) {
                                    navigate('/portfolio');
                                }
                            }}
                            title={positions.find(p => p.stockId === stock.id) ? "Zurück zum Portfolio" : undefined}
                        >
                            <Logo
                                url={stock.logoUrl}
                                alt={stock.name}
                                size="size-12 md:size-16"
                                fallback={
                                    <span className="text-xl md:text-2xl">{stock.symbol.slice(0, 2)}</span>
                                }
                                className="text-xl"
                            />
                        </div>
                        <div>
                            <div className="flex items-start gap-2 md:gap-3">
                                <h1 className="text-lg md:text-2xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/70 whitespace-pre-wrap leading-tight">{stock.name}</h1>
                                {(() => {
                                    // User Rule (v3.11.481):
                                    // STRICT Time-Based Logic for the Status Dot.
                                    // - API data can be stale ("REGULAR" from yesterday) -> Causes False Green for US in Morning.
                                    // - API data can be delayed ("CLOSED" while active) -> Causes False Red for EU in Morning.
                                    // SOLUTION: We trust the Clock (estimateMarketState).
                                    // If it's trading hours -> Green. Else -> Red.

                                    const calculatedState = estimateMarketState(stock.symbol, stock.currency);
                                    const isMarketOpen = calculatedState === 'REGULAR';

                                    // For the tooltip label, we can still show what the API thinks if we want, or just the calc state.
                                    // Let's show the calc state to be consistent with the color.
                                    const displayLabel = calculatedState;

                                    return isMarketOpen ? (
                                        <div className="size-2.5 rounded-full bg-green-500 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.5)] cursor-help border border-background" title={`Markt geöffnet (${displayLabel})`} />
                                    ) : (
                                        <div className="size-2.5 rounded-full bg-red-500 cursor-help border border-background" title={`Markt geschlossen (${displayLabel})`} />
                                    );
                                })()}
                                <button
                                    onClick={() => {
                                        const from = searchParams.get('from');
                                        const query = from ? `?from=${from}` : '';
                                        navigate(`/dividends/edit/${stock.id}${query}`);
                                    }}
                                    className="p-1 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
                                    title="Daten bearbeiten"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-pencil"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" /><path d="m15 5 4 4" /></svg>
                                </button>

                                {/* Watchlist Button */}
                                <button
                                    onClick={() => setIsWatchlistModalOpen(true)}
                                    className={cn(
                                        "p-1 rounded-lg transition-colors",
                                        watchlists.some(wl => wl.stockIds.includes(stock.id))
                                            ? "text-yellow-500 hover:text-yellow-600 hover:bg-yellow-50 dark:hover:bg-yellow-900/20"
                                            : "text-muted-foreground hover:text-foreground hover:bg-muted"
                                    )}
                                    title="Zu Watchlist hinzufügen"
                                >
                                    {watchlists.some(wl => wl.stockIds.includes(stock.id)) ? (
                                        <div className="relative">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-star"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>
                                        </div>
                                    ) : (
                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-star"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>
                                    )}
                                </button>
                            </div>
                            <div className="flex items-center gap-2 text-muted-foreground mt-0.5 text-xs md:text-sm">
                                <span className="font-bold text-foreground">{stock.symbol}</span>
                                {stock.sector && stock.sector !== 'Simuliert' && (
                                    <>
                                        <span>•</span>
                                        <span>{stock.sector}</span>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Price Card */}
                    <div className="text-right">
                        <p className="text-[10px] md:text-xs text-muted-foreground font-medium uppercase tracking-wider">Aktueller Kurs</p>
                        <h2 className="text-xl md:text-3xl font-bold tabular-nums tracking-tight">
                            {formatCurrency(stock.currentPrice, stock.currency)}
                        </h2>
                        {stock.distributionPolicy === 'accumulating' ? (
                            <p className="text-xs text-blue-600 dark:text-blue-400 font-medium mt-0.5 bg-blue-50 dark:bg-blue-900/20 px-1.5 py-0.5 rounded inline-block">
                                Thesaurierend
                            </p>
                        ) : stock.dividendYield && (
                            <p className="text-xs text-green-600 dark:text-green-400 font-medium mt-0.5">
                                {stock.dividendYield.toFixed(2)}% Div.Rendite
                            </p>
                        )}

                        {/* Dynamic Position Performance based on Chart Range */}
                        {(() => {
                            const position = positions.find(p => p.stockId === stock.id);
                            if (!position) return null;

                            // Determine start price for the period
                            let referencePrice = stock.previousClose;

                            if (timeRange !== '1D' && chartData && chartData.length > 0) {
                                referencePrice = chartData[0].value;
                            } else if (timeRange === '1D') {
                                referencePrice = stock.previousClose || (chartData && chartData.length > 0 ? chartData[0].value : stock.currentPrice);
                            } else if (chartData && chartData.length > 0) {
                                referencePrice = chartData[0].value;
                            }

                            if (timeRange !== '1D' && (!chartData || chartData.length === 0)) return null;

                            const diffPerShare = stock.currentPrice - referencePrice;
                            const totalDiff = diffPerShare * position.shares;
                            const percentChange = referencePrice > 0 ? (diffPerShare / referencePrice) * 100 : 0;
                            const isPositive = totalDiff >= 0;

                            return (
                                <div className="mt-1 text-right">
                                    <p className={cn(
                                        "text-xs font-bold flex items-center justify-end gap-1 tabular-nums",
                                        isPositive ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
                                    )}>
                                        {isPositive ? <TrendingUp className="size-3" /> : <TrendingUp className="size-3 rotate-180" />}
                                        {isPositive ? '+' : ''}{percentChange.toFixed(2)}% {formatCurrency(totalDiff, stock.currency)}
                                    </p>
                                </div>
                            );
                        })()}
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left Column: Stats & Chart */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Price Chart */}
                    <div className="bg-card border border-border rounded-xl pl-1 pr-1 py-6 shadow-sm min-h-[450px] flex flex-col">
                        <div className="flex items-center justify-between gap-2 mb-4 shrink-0">
                            {/* Left: Title */}
                            <div className="flex items-center gap-2">
                                <TrendingUp className="size-5 text-blue-500" />
                                <h3 className="font-bold text-lg"><span className="md:hidden">Kurs</span><span className="hidden md:inline">Kursverlauf</span></h3>
                            </div>

                            {/* Center+Right: Buttons */}
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => navigate('/?openPerformance=true')}
                                    className="flex items-center text-xs md:text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors font-medium bg-blue-50 dark:bg-blue-900/10 px-2 py-1 rounded-md shadow-sm border border-blue-100 dark:border-blue-900/30 whitespace-nowrap"
                                >
                                    <ArrowLeft className="size-3 md:size-4 mr-1" />
                                    <span className="md:hidden">Zurück</span><span className="hidden md:inline">zur Performance</span>
                                </button>

                                {/* Refresh Button */}
                                <button
                                    onClick={loadData}
                                    disabled={isRefreshing}
                                    className={cn(
                                        "inline-flex items-center gap-1 px-2 py-1 rounded-lg border text-xs font-medium transition-all shadow-sm",
                                        "bg-blue-600 text-white border-blue-700 hover:bg-blue-700 hover:border-blue-800",
                                        "active:scale-95",
                                        isRefreshing && "opacity-50 cursor-not-allowed"
                                    )}
                                    title="Daten aktualisieren"
                                >
                                    <RefreshCw className={cn("size-3.5", isRefreshing && "animate-spin")} />
                                    <span className="whitespace-nowrap">
                                        {isRefreshing ? 'Laden...' : lastUpdate ? `${minutesAgo} Min` : 'Laden'}
                                    </span>
                                </button>
                            </div>
                        </div>
                        {/* Price History Chart */}
                        <div className="flex-1 w-full min-h-0">
                            <PriceHistoryChart
                                currentPrice={stock.currentPrice}
                                currency={stock.currency}
                                trend={stock.dividendYield && stock.dividendYield > 2 ? 'up' : 'neutral'}
                                historyData={chartData}
                                selectedRange={timeRange}
                                onRangeChange={(range) => setTimeRange(range)}
                                isRealtime={true}
                                quoteDate={quoteDate}
                                previousClose={safePreviousClose || 0}
                                isMarketOpen={estimateMarketState(stock.symbol, stock.currency) === 'REGULAR'}
                                purchasePrice={position?.buyPriceAvg}
                            />
                        </div>
                    </div>

                    {/* NEW: ETF Allocation Breakdown */}
                    {stock.type === 'etf' && (() => {
                        // FALLBACK LOGIC (View-Time)
                        const fallback = FALLBACK_ALLOCATIONS[stock.symbol];
                        const effectiveSectorWeights = stock.sectorWeights || fallback?.sectorWeights;
                        const effectiveCountryWeights = stock.countryWeights || fallback?.countryWeights;

                        // Normalize Helper
                        const normalizeCountry = (country: string) => {
                            if (!country) return 'Unbekannt';
                            const c = country.toLowerCase().trim();
                            if (c === 'united states' || c === 'usa' || c === 'us') return 'USA';
                            if (c === 'united kingdom' || c === 'uk') return 'Grossbritannien';
                            if (c === 'switzerland' || c === 'ch') return 'Schweiz';
                            if (c === 'germany' || c === 'de') return 'Deutschland';
                            // Add simple capitalization fallback
                            return country.charAt(0).toUpperCase() + country.slice(1).toLowerCase();
                        };

                        return (
                            <div className="space-y-6">
                                {(!effectiveSectorWeights && !effectiveCountryWeights) && (
                                    <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4 text-xs text-yellow-500 flex items-center gap-2">
                                        <span className="animate-pulse">●</span>
                                        <span>Lade Allokationsdaten von Yahoo... (Versuche ggf. Refresh oder einen US-Ticker wie VOO)</span>
                                    </div>
                                )}

                                {(effectiveSectorWeights || effectiveCountryWeights) && (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        {/* Sector Allocation */}
                                        {effectiveSectorWeights && Object.keys(effectiveSectorWeights).length > 0 && (
                                            <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
                                                <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                                                    <TrendingUp className="size-5 text-purple-500" />
                                                    Branchen Allokation
                                                </h3>
                                                <div className="space-y-3">
                                                    {(Object.entries(effectiveSectorWeights || {}) as [string, number][])
                                                        .sort(([, a]: [string, number], [, b]: [string, number]) => b - a)
                                                        .slice(0, 8)
                                                        .map(([sector, weight]: [string, number]) => {
                                                            const displayNames: Record<string, string> = {
                                                                'realestate': 'Immobilien',
                                                                'healthcare': 'Gesundheitswesen',
                                                                'basic_materials': 'Rohstoffe',
                                                                'consumer_cyclical': 'Zykl. Konsumgüter',
                                                                'financial_services': 'Finanzdienstl.',
                                                                'consumer_defensive': 'Nicht-zykl. Konsum',
                                                                'technology': 'Technologie',
                                                                'utilities': 'Versorger',
                                                                'financial': 'Finanzen',
                                                                'communication_services': 'Kommunikation',
                                                                'energy': 'Energie',
                                                                'industrials': 'Industrie'
                                                            };
                                                            const name = sector.toLowerCase().replace(/\s/g, '_');
                                                            const displayName = displayNames[name] || sector.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

                                                            return (
                                                                <div key={sector} className="flex items-center justify-between text-sm">
                                                                    <span className="text-muted-foreground">{displayName}</span>
                                                                    <div className="flex items-center gap-2">
                                                                        <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                                                                            <div className="h-full bg-purple-500 rounded-full" style={{ width: `${weight}%` }} />
                                                                        </div>
                                                                        <span className="font-mono font-medium">{weight.toFixed(1)}%</span>
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                </div>
                                            </div>
                                        )}

                                        {/* Country Allocation */}
                                        {effectiveCountryWeights && Object.keys(effectiveCountryWeights).length > 0 && (
                                            <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
                                                <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                                                    <MapIcon className="size-5 text-blue-500" />
                                                    Länder Allokation
                                                </h3>
                                                <div className="space-y-3">
                                                    {(Object.entries(effectiveCountryWeights || {}) as [string, number][])
                                                        .sort(([, a]: [string, number], [, b]: [string, number]) => b - a)
                                                        .slice(0, 8)
                                                        .map(([country, weight]: [string, number]) => {
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
                                                                'australia': 'Australien'
                                                            };
                                                            const name = country.toLowerCase().replace(/\s/g, '_');
                                                            const displayName = normalizeCountry(displayNames[name] || country);

                                                            return (
                                                                <div key={country} className="flex items-center justify-between text-sm">
                                                                    <span className="text-muted-foreground">{displayName}</span>
                                                                    <div className="flex items-center gap-2">
                                                                        <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                                                                            <div className="h-full bg-blue-500 rounded-full" style={{ width: `${weight}%` }} />
                                                                        </div>
                                                                        <span className="font-mono font-medium">{weight.toFixed(1)}%</span>
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })()}



                </div>

                {/* Right Column: Stammdaten & Notes */}
                <div className="lg:col-span-1 space-y-6">

                    {/* Kursdaten - Moved to TOP as requested */}
                    <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
                        <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                            Kursdaten
                        </h3>
                        <div className="space-y-3">
                            {/* Kaufpreis (Avg Buy Price) - Only if position exists */}
                            {positions.find(p => p.stockId === stock.id) && (
                                <div className="flex justify-between py-1.5 border-b border-border/50">
                                    <span className="text-muted-foreground text-sm">Kaufpreis Ø</span>
                                    <span className="font-medium text-sm">
                                        {formatCurrency(positions.find(p => p.stockId === stock.id)?.buyPriceAvg || 0, stock.currency, false)}
                                    </span>
                                </div>
                            )}

                            <div className="flex justify-between py-1.5 border-b border-border/50">
                                <span className="text-muted-foreground text-sm">Aktueller Kurs</span>
                                <span className="font-medium text-sm">{formatCurrency(stock.currentPrice, stock.currency, false)}</span>
                            </div>

                            {/* Added Open and Previous Close in one line */}
                            <div className="flex justify-between py-1.5 border-b border-border/50">
                                <span className="text-muted-foreground text-sm">Eröffnung / Vortag</span>
                                <span className="font-medium text-sm text-right">
                                    {stock.open ? formatCurrency(stock.open, stock.currency, false) : '-'} / {formatCurrency(safePreviousClose || 0, stock.currency, false)}
                                </span>
                            </div>

                            <div className="flex justify-between py-1.5 border-b border-border/50">
                                <span className="text-muted-foreground text-sm">Kauflimit</span>
                                <span className="font-medium text-sm">
                                    {stock.targetPrice ? formatCurrency(stock.targetPrice, stock.currency, false) : '-'}
                                </span>
                            </div>
                            <div className="flex justify-between py-1.5 border-b border-border/50">
                                <span className="text-muted-foreground text-sm">Verkaufslimit</span>
                                <span className="font-medium text-sm">
                                    {stock.sellLimit ? formatCurrency(stock.sellLimit, stock.currency, false) : '-'}
                                </span>
                            </div>
                        </div>
                    </div >

                    {/* Stammdaten - Moved below Kursdaten */}
                    <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
                        <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                            <TrendingUp className="size-5 text-blue-500" />
                            Stammdaten
                        </h3>
                        <div className="space-y-3">
                            <div className="flex justify-between py-1.5 border-b border-border/50">
                                <span className="text-muted-foreground text-sm">Name</span>
                                <span className="font-medium text-sm text-right">{stock.name}</span>
                            </div>
                            <div className="flex justify-between py-1.5 border-b border-border/50">
                                <span className="text-muted-foreground text-sm">Symbol</span>
                                <span className="font-medium text-sm font-mono">{stock.symbol}</span>
                            </div>
                            <div className="flex justify-between py-1.5 border-b border-border/50">
                                <span className="text-muted-foreground text-sm">ISIN</span>
                                <span className="font-medium text-sm font-mono">{stock.isin || '-'}</span>
                            </div>
                            <div className="flex justify-between py-1.5 border-b border-border/50">
                                <span className="text-muted-foreground text-sm">Typ</span>
                                <span className="font-medium text-sm capitalize">{stock.type || 'Aktie'}</span>
                            </div>
                            <div className="flex justify-between py-1.5 border-b border-border/50">
                                <span className="text-muted-foreground text-sm">Währung</span>
                                <span className="font-medium text-sm">{stock.currency}</span>
                            </div>
                            <div className="flex justify-between py-1.5 border-b border-border/50">
                                <span className="text-muted-foreground text-sm">KGV (P/E)</span>
                                <span className="font-medium text-sm">
                                    {stock.trailingPE
                                        ? stock.trailingPE.toFixed(2)
                                        : (stock.forwardPE ? `${stock.forwardPE.toFixed(2)} (Fwd)` : (stock.eps && stock.eps > 0 ? (stock.currentPrice / stock.eps).toFixed(2) : '-'))}
                                </span>
                            </div>
                            <div className="flex justify-between py-1.5 border-b border-border/50">
                                <span className="text-muted-foreground text-sm">Div. Frequenz</span>
                                <span className="font-medium text-sm capitalize">
                                    {stock.dividendFrequency ? (
                                        stock.dividendFrequency === 'quarterly' ? 'Quartalsweise' :
                                            stock.dividendFrequency === 'monthly' ? 'Monatlich' :
                                                stock.dividendFrequency === 'semi-annually' ? 'Halbjährlich' : 'Jährlich'
                                    ) : '-'}
                                </span>
                            </div>
                            <div className="flex justify-between py-1.5 border-b border-border/50">
                                <span className="text-muted-foreground text-sm">Div. Rendite</span>
                                <span className="font-medium text-sm">
                                    {stock.dividendYield ? `${stock.dividendYield.toFixed(2)}%` : '-'}
                                </span>
                            </div>
                        </div>
                    </div >
                </div >

                {/* Right Column: Quick Links & Notes (Vertical Stack) */}
                < div className="lg:col-span-3 flex flex-col gap-6" >
                    {/* Quick Links Card */}
                    < div className="bg-card border border-border rounded-xl p-6 shadow-sm flex flex-col" >
                        <h3 className="font-bold text-lg mb-4">Quick Links</h3>
                        <div className="space-y-3 flex-1">
                            {/* Input for adding new links */}
                            <div className="flex gap-2">
                                <input
                                    type="url"
                                    placeholder="URL einfügen oder reinziehen..."
                                    className="flex-1 px-3 py-2 text-sm rounded-lg border border-border bg-background/50 focus:outline-none focus:ring-2 focus:ring-primary/20"
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && stock && e.currentTarget.value.trim()) {
                                            const url = e.currentTarget.value.trim();
                                            addQuickLink(stock.id, url);
                                            e.currentTarget.value = '';
                                        }
                                    }}
                                />
                                <button
                                    onClick={(e) => {
                                        const input = e.currentTarget.previousElementSibling as HTMLInputElement;
                                        if (stock && input.value.trim()) {
                                            addQuickLink(stock.id, input.value.trim());
                                            input.value = '';
                                        }
                                    }}
                                    className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors whitespace-nowrap"
                                >
                                    + Hinzufügen
                                </button>
                            </div>

                            {/* List of saved links */}
                            {stock?.quickLinks && stock.quickLinks.length > 0 && (
                                <div className="space-y-2">
                                    {stock.quickLinks.map((link: any) => (
                                        <div
                                            key={link.id}
                                            className="flex items-center gap-2 p-2 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors group"
                                        >
                                            <a
                                                href={link.url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="flex-1 text-sm text-primary hover:underline truncate"
                                            >
                                                {link.label || link.url}
                                            </a>
                                            <button
                                                onClick={() => removeQuickLink(stock.id, link.id)}
                                                className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md transition-all opacity-70 hover:opacity-100"
                                                title="Link entfernen"
                                            >
                                                <Trash2 className="size-4" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Empty state */}
                            {(!stock?.quickLinks || stock.quickLinks.length === 0) && (
                                <div className="flex-1 flex items-center justify-center text-center p-8">
                                    <p className="text-sm text-muted-foreground">
                                        Keine Links gespeichert.<br />
                                        Füge Chart- oder Finanz-URLs hinzu.
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Notes Card */}
                    <div className="bg-card border border-border rounded-xl p-6 shadow-sm flex flex-col">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-bold text-lg flex items-center gap-2">
                                <Save className="size-5 text-purple-500" />
                                Persönliche Notizen & Analyse
                            </h3>
                            <button
                                onClick={handleSaveNotes}
                                className={cn(
                                    'px-4 py-2 rounded-lg font-medium text-sm transition-all',
                                    isSaving
                                        ? 'bg-green-500 text-white'
                                        : 'bg-primary text-primary-foreground hover:bg-primary/90'
                                )}
                            >
                                {isSaving ? 'Gespeichert!' : 'Speichern'}
                            </button>
                        </div>
                        <textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="Schreiben Sie hier Ihre Gedanken zur Aktie (z.B. Kaufgrund, Burggraben, Risiken)..."
                            className="flex-1 min-h-[300px] w-full p-4 rounded-lg border border-border bg-background/50 resize-y focus:outline-none focus:ring-2 focus:ring-primary/20"
                        />
                        <p className="text-xs text-muted-foreground mt-2">
                            * Notizen werden nur lokal gespeichert.
                        </p>
                    </div>
                </div>
            </div>
            {stock && (
                <AddToWatchlistModal
                    isOpen={isWatchlistModalOpen}
                    onClose={() => setIsWatchlistModalOpen(false)}
                    stockId={stock.id}
                />
            )}
        </div>
    );
}
