
import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { usePortfolio } from '../context/PortfolioContext';

import { useCurrencyFormatter } from '../utils/currency';
import { ArrowLeft, RefreshCw, TrendingUp, Map as MapIcon, Save, Trash2, Calculator, BarChart2, ShieldCheck, Sparkles, Sliders, Pencil } from 'lucide-react';
import { useAutoRefresh } from '../hooks/useAutoRefresh';
import { FALLBACK_ALLOCATIONS } from '../data/fallbackAllocations';
import { estimateMarketState } from '../utils/market';
import { PriceHistoryChart } from '../components/PriceHistoryChart';
import { cn } from '../utils';
import { computeSmartAutoParams, calculateDcfFairValue } from '../utils/fairValue';
import { translateSector } from '../utils/sectorTranslation';
import { Logo } from '../components/Logo';
import { AddToWatchlistModal } from '../components/AddToWatchlistModal'; // New Import

import { fetchStockHistory, fetchStockQuote, type TimeRange, type ChartDataPoint } from '../services/yahoo-finance';

export function StockDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { stocks, positions, updateStock, updateStockPrice, addQuickLink, removeQuickLink, watchlists } = usePortfolio();
    const { formatCurrency, convertToCHF } = useCurrencyFormatter();
    const [isWatchlistModalOpen, setIsWatchlistModalOpen] = useState(false); // Modal State

    // Find stock by ID or Symbol (case-insensitive)
    const stockFromContext = stocks.find(s =>
        s.id.trim() === id?.trim() ||
        s.symbol.toLowerCase() === id?.toLowerCase()
    );

    // Initialize virtual stock if not found in context (v3.13.44)
    const [virtualStock, setVirtualStock] = useState<any>(() => {
        if (!stockFromContext && id) {
            const paramName = searchParams.get('name');
            const paramCurrency = searchParams.get('currency');
            return {
                id: id,
                symbol: id.toUpperCase(),
                name: paramName ? decodeURIComponent(paramName) : id.toUpperCase(),
                currentPrice: 0,
                currency: paramCurrency ? decodeURIComponent(paramCurrency) : 'USD',
                type: 'stock'
            };
        }
        return null;
    });

    const stock = stockFromContext || virtualStock;

    useEffect(() => {
        if (!stockFromContext && id && !virtualStock) {
            const paramName = searchParams.get('name');
            const paramCurrency = searchParams.get('currency');
            setVirtualStock({
                id: id,
                symbol: id.toUpperCase(),
                name: paramName ? decodeURIComponent(paramName) : id.toUpperCase(),
                currentPrice: 0,
                currency: paramCurrency ? decodeURIComponent(paramCurrency) : 'USD',
                type: 'stock'
            });
        }
    }, [stockFromContext, id, !!virtualStock, searchParams]);

    const [notes, setNotes] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [timeRange, setTimeRange] = useState<TimeRange>('1D');
    const [chartData, setChartData] = useState<ChartDataPoint[] | null>(null);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
    const [quoteDate, setQuoteDate] = useState<Date | null>(null);
    const [minutesAgo, setMinutesAgo] = useState(0);
    const [fvModeTick, setFvModeTick] = useState(0);

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

            // Sync Open & PreviousClose from 1D Chart so "Eröffnung / Vortag" is always current
            if (rangeToUse === '1D' && response.data && response.data.length > 0) {
                const chartUpdates: any = {};
                const derivedOpen = (response as any).open || response.data[0].value;
                if (derivedOpen && Math.abs((currentStock.open || 0) - derivedOpen) > 0.001) {
                    chartUpdates.open = derivedOpen;
                }
                if (response.previousClose && Math.abs((currentStock.previousClose || 0) - response.previousClose) > 0.001) {
                    chartUpdates.previousClose = response.previousClose;
                }
                if (Object.keys(chartUpdates).length > 0) {
                    if (stockFromContext) {
                        updateStock(currentStock.id, chartUpdates);
                    } else {
                        setVirtualStock((prev: any) => ({ ...prev, ...chartUpdates }));
                    }
                }
            }
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

                if (quoteResponse.open !== undefined && quoteResponse.open !== null && rangeToUse !== '1D' && Math.abs((currentStock.open || 0) - quoteResponse.open) > 0.01) {
                    updates.open = quoteResponse.open;
                    hasUpdates = true;
                }
                if (quoteResponse.previousClose !== undefined && quoteResponse.previousClose !== null && rangeToUse !== '1D' && Math.abs((currentStock.previousClose || 0) - quoteResponse.previousClose) > 0.01) {
                    updates.previousClose = quoteResponse.previousClose;
                    hasUpdates = true;
                }
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

                if (quoteResponse.sector && (!currentStock.sector || currentStock.sector === 'Simuliert')) {
                    updates.sector = quoteResponse.sector;
                    hasUpdates = true;
                }
                
                if (quoteResponse.kcv !== undefined && quoteResponse.kcv !== null && Math.abs((stockFromContext?.kcv || virtualStock?.kcv || 0) - quoteResponse.kcv) > 0.01) {
                    updates.kcv = quoteResponse.kcv;
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

    // Helper for KGV/KCV Coloring
    let calculatedKgv = stock.trailingPE || stock.forwardPE || null;
    if (!calculatedKgv && stock.eps && stock.eps > 0 && stock.currentPrice) {
        calculatedKgv = stock.currentPrice / stock.eps;
    }

    const kcvColorClass = (stock.kcv && calculatedKgv) 
        ? (stock.kcv < calculatedKgv ? 'text-green-500' : 'text-red-500') 
        : '';

    return (
        <div className="p-2 md:p-8 space-y-4 md:space-y-8 duration-500 pb-16">
            {/* Sticky Header in Portrait, Normal Scrollable (not sticky) in Landscape */}
            <div className="sticky top-0 landscape:static landscape:top-auto -mx-2 md:-mx-8 landscape:mx-0 px-3 py-2 md:px-8 md:py-4 landscape:py-1.5 landscape:px-3 z-50 bg-background border-b border-border shadow-md transition-all -mt-2 md:-mt-8 mb-3 md:mb-6 landscape:mb-2">
                <div className="flex items-center gap-2 mb-2 md:mb-4 landscape:mb-1 pl-10 xl:pl-0 landscape:pl-0">
                    <button
                        onClick={() => {
                            const from = searchParams.get('from');
                            if (from === 'watchlist') {
                                navigate('/watchlist');
                            } else if (from === 'portfolio') {
                                navigate('/portfolio');
                            } else if (from === 'market-overview') {
                                const tab = searchParams.get('tab') || sessionStorage.getItem('portfolio_market_overview_tab');
                                navigate(tab && tab !== 'all' ? `/market-overview?tab=${encodeURIComponent(tab)}` : '/market-overview');
                            } else {
                                navigate(-1);
                            }
                        }}
                        className="flex items-center justify-center gap-1 bg-white text-blue-600 hover:bg-blue-50 transition-all font-semibold rounded-lg shadow-sm border border-blue-200 py-1 px-2.5 text-xs group active:scale-95"
                        title={searchParams.get('from') === 'market-overview' ? "Zurück zur Marktübersicht" : "Zurück"}
                    >
                        <ArrowLeft className="size-3.5 transition-transform group-hover:-translate-x-0.5" />
                        <span>
                            {searchParams.get('from') === 'market-overview' ? 'Marktübersicht' : 'Zurück'}
                        </span>
                    </button>

                    {/* Saisonalität Button */}
                    <button
                        onClick={() => navigate(`/seasonality/${stock.symbol}`)}
                        className="flex items-center justify-center gap-1.5 bg-white dark:bg-card text-violet-600 dark:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-950/30 transition-all font-semibold rounded-lg shadow-sm border border-violet-200 dark:border-violet-800 py-1 px-2.5 text-xs group active:scale-95 whitespace-nowrap"
                        title="Saisonalitätsanalyse"
                    >
                        <BarChart2 className="size-3.5" />
                        <span>Saisonalität</span>
                    </button>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 md:gap-4 landscape:flex-row landscape:items-center landscape:gap-3">
                    <div className="flex items-center gap-2.5 md:gap-4 min-w-0">
                        <div
                            className={cn(
                                "bg-card rounded-xl shrink-0",
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
                                size="size-10 md:size-16 landscape:size-8"
                                fallback={
                                    <span className="text-lg md:text-2xl landscape:text-sm">{stock.symbol.slice(0, 2)}</span>
                                }
                                className="text-xl"
                            />
                        </div>
                        <div className="min-w-0 flex-1">
                            <div className="flex items-center flex-wrap gap-1.5 md:gap-2.5">
                                <h1 className="text-base md:text-2xl landscape:text-sm font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/70 leading-tight truncate max-w-[200px] sm:max-w-md">{stock.name}</h1>
                                {(() => {
                                    const calculatedState = estimateMarketState(stock.symbol, stock.currency);
                                    const isMarketOpen = calculatedState === 'REGULAR';
                                    const displayLabel = calculatedState;

                                    return isMarketOpen ? (
                                        <div className="size-2 md:size-2.5 rounded-full bg-green-500 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.5)] cursor-help border border-background shrink-0" title={`Markt geöffnet (${displayLabel})`} />
                                    ) : (
                                        <div className="size-2 md:size-2.5 rounded-full bg-red-500 cursor-help border border-background shrink-0" title={`Markt geschlossen (${displayLabel})`} />
                                    );
                                })()}
                                <div className="flex items-center gap-1 ml-auto sm:ml-0">
                                    <button
                                        onClick={() => navigate(`/calculator?stock=${stock.id}&mode=buy`)}
                                        className="p-1 md:p-1.5 landscape:p-1 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
                                        title="Aktie handeln (Kaufen / Verkaufen)"
                                    >
                                        <Calculator className="size-3.5 md:size-4" />
                                    </button>
                                    <button
                                        onClick={() => {
                                            const from = searchParams.get('from') || 'dividends';
                                            const query = from ? `?from=${from}` : '';
                                            const targetId = stockFromContext?.id || stock?.id || stock?.symbol || id;
                                            navigate(`/dividends/edit/${encodeURIComponent(String(targetId))}${query}`);
                                        }}
                                        className="p-1 md:p-1.5 landscape:p-1 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
                                        title="Daten bearbeiten"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-pencil"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" /><path d="m15 5 4 4" /></svg>
                                    </button>

                                    {/* Watchlist Button */}
                                    <button
                                        onClick={() => setIsWatchlistModalOpen(true)}
                                        className={cn(
                                            "p-1 md:p-1.5 landscape:p-1 rounded-lg transition-colors",
                                            watchlists.some(wl => wl.stockIds.includes(stock.id))
                                                ? "text-yellow-500 hover:text-yellow-600 hover:bg-yellow-50 dark:hover:bg-yellow-900/20"
                                                : "text-muted-foreground hover:text-foreground hover:bg-muted"
                                        )}
                                        title="Zu Watchlist hinzufügen"
                                    >
                                        {watchlists.some(wl => wl.stockIds.includes(stock.id)) ? (
                                            <div className="relative">
                                                <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-star"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>
                                            </div>
                                        ) : (
                                            <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-star"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>
                                        )}
                                    </button>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 text-muted-foreground mt-0.5 landscape:mt-0 text-xs md:text-sm landscape:text-[11px]">
                                <span className="font-bold text-foreground">{stock.symbol}</span>
                                {stock.sector && stock.sector !== 'Simuliert' && (
                                    <>
                                        <span>•</span>
                                        <span className="truncate max-w-[120px] sm:max-w-none">{translateSector(stock.sector)}</span>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Price Card */}
                    <div className="w-full sm:w-auto pt-1 sm:pt-0 landscape:pt-0 border-t border-border/50 sm:border-none landscape:border-none flex items-center justify-between sm:block sm:text-right landscape:flex landscape:items-center landscape:gap-3 gap-x-4">
                        <div className="flex items-baseline gap-1.5 sm:block">
                            <span className="text-[10px] md:text-xs text-muted-foreground font-medium uppercase tracking-wider landscape:hidden sm:block">Kurs:</span>
                            <h2 className="text-base sm:text-3xl landscape:text-base font-bold tabular-nums tracking-tight whitespace-nowrap">
                                {formatCurrency(stock.currentPrice, stock.currency)}
                            </h2>
                        </div>
                        <div className="text-right ml-auto landscape:ml-0 flex flex-col items-end sm:block">
                            {stock.distributionPolicy === 'accumulating' ? (
                                <p className="text-xs sm:text-sm landscape:text-xs text-blue-600 dark:text-blue-400 font-medium sm:mt-0.5 bg-blue-50 dark:bg-blue-900/20 px-1.5 py-0.5 rounded inline-block">
                                    Thesaurierend
                                </p>
                            ) : (() => {
                                const pos = positions.find(p => p.stockId === stock.id);
                                const freqFactor = stock.dividendFrequency === 'quarterly' ? 4 : stock.dividendFrequency === 'semi-annually' ? 2 : stock.dividendFrequency === 'monthly' ? 12 : 1;
                                const annualPayout = (stock.dividendAmount && stock.dividendAmount > 0) ? stock.dividendAmount * freqFactor : 0;
                                const yieldCost = (annualPayout > 0 && pos && pos.buyPriceAvg > 0) ? (annualPayout / pos.buyPriceAvg) * 100 : null;
                                const marketYield = (annualPayout > 0 && stock.currentPrice > 0) ? (annualPayout / stock.currentPrice) * 100 : (stock.dividendYield || null);

                                if (!marketYield && !yieldCost) return null;

                                return (
                                    <div className="flex flex-col items-end sm:mt-0.5 leading-tight">
                                        <p className="text-xs sm:text-sm landscape:text-xs text-green-600 dark:text-green-400 font-bold whitespace-nowrap">
                                            {yieldCost !== null ? `${yieldCost.toFixed(2)}% Rendite (Käufe)` : `${marketYield?.toFixed(2)}% Div.Rendite`}
                                        </p>
                                        {yieldCost !== null && marketYield !== null && Math.abs(yieldCost - marketYield) > 0.01 && (
                                            <p className="text-[10px] text-muted-foreground whitespace-nowrap landscape:hidden sm:landscape:block">
                                                Aktueller Kurs: {marketYield.toFixed(2)}%
                                            </p>
                                        )}
                                    </div>
                                );
                            })()}

                            {/* Dynamic Position Performance based on Chart Range */}
                            {(() => {
                                const position = positions.find(p => p.stockId === stock.id);
                                if (!position) return null;

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
                                    <div className="mt-0.5 sm:mt-1 text-right">
                                        <p className={cn(
                                            "text-xs sm:text-sm landscape:text-xs font-bold flex items-center justify-end gap-1.5 tabular-nums whitespace-nowrap",
                                            isPositive ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
                                        )}>
                                            <span className="text-muted-foreground font-medium landscape:hidden sm:landscape:inline">
                                                {timeRange === '1D' ? 'Tages Performance:' : `Performance (${timeRange}):`}
                                            </span>
                                            <span>
                                                {isPositive ? '+' : ''}{percentChange.toFixed(2)}% {formatCurrency(totalDiff, stock.currency)}
                                            </span>
                                        </p>
                                    </div>
                                );
                            })()}
                        </div>
                    </div>
                </div>
            </div>

            {/* Price Chart (Kursverlauf) - Über ganze Breite */}
            <div className="bg-card border border-border rounded-xl pl-1 pr-1 py-4 md:py-6 landscape:py-1.5 shadow-sm min-h-[360px] landscape:min-h-0 landscape:h-[295px] flex flex-col w-full mb-6 overflow-hidden">
                <div className="flex items-center justify-between gap-2 mb-2 md:mb-4 landscape:mb-1.5 shrink-0 px-2 md:px-4">
                    {/* Left: Title */}
                    <div className="flex items-center gap-2">
                        <TrendingUp className="size-5 text-blue-500" />
                        <h3 className="font-bold text-lg"><span className="md:hidden">Kurs</span><span className="hidden md:inline">Kursverlauf</span></h3>
                    </div>

                    {/* Center: Performance Button (Only if in Portfolio) */}
                    {positions.find(p => p.stockId === stock.id) && (
                        <button
                            onClick={() => navigate('/?openPerformance=true')}
                            className="flex items-center text-xs md:text-sm text-blue-600 hover:text-blue-700 transition-colors font-medium bg-white px-3 py-1.5 rounded-xl shadow border border-blue-100 whitespace-nowrap hover:scale-105"
                        >
                            <span className="md:hidden">Zurück</span><span className="hidden md:inline">zur Performance</span>
                        </button>
                    )}


                    {/* Right: Refresh Button */}
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
                        sellLimit={stock.sellLimit}
                        stockName={stock.name}
                        stockSymbol={stock.symbol}
                    />
                </div>
            </div>

            {/* Kursdaten & Stammdaten - Darunter nebeneinander */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 landscape:gap-3 items-stretch">
                {/* Kursdaten */}
                <div
                    onClick={() => {
                        const from = searchParams.get('from') || 'dividends';
                        const query = from ? `?from=${from}` : '';
                        const targetId = stockFromContext?.id || stock?.id || stock?.symbol || id;
                        navigate(`/dividends/edit/${encodeURIComponent(String(targetId))}${query}`);
                    }}
                    className="bg-card border border-border hover:border-primary/50 rounded-xl p-4 md:p-6 landscape:p-2.5 landscape:py-2 shadow-sm cursor-pointer transition-colors group flex flex-col justify-between landscape:h-[295px] overflow-hidden"
                    title="Daten bearbeiten"
                >
                    <div className="flex items-center justify-between gap-2 mb-2 md:mb-4 landscape:mb-1">
                        <div className="flex items-center gap-1.5 md:gap-2 group-hover:text-primary transition-colors">
                            <h3 className="font-bold text-base md:text-lg landscape:text-xs">Kursdaten</h3>
                            <Pencil className="size-3 md:size-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
                        </div>
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/calculator?stock=${encodeURIComponent(String(stock.id))}`);
                            }}
                            className="flex items-center gap-1 text-xs landscape:text-[10px] font-semibold px-2.5 py-1 landscape:py-0.5 landscape:px-1.5 rounded-lg bg-blue-600/20 hover:bg-blue-600/35 text-blue-300 border border-blue-400/30 transition-colors shadow-sm"
                            title="Aktie direkt in Kauf / Verkauf öffnen"
                        >
                            <Calculator className="size-3.5 landscape:size-3" />
                            <span>Kauf / Verkauf</span>
                        </button>
                    </div>
                    {positions.find(p => p.stockId === stock.id) && (() => {
                        const pos = positions.find(p => p.stockId === stock.id)!;

                        // Native Calculation
                        const diffNative = stock.currentPrice - pos.buyPriceAvg;
                        const totalDiffNative = diffNative * pos.shares;
                        const percentChangeNative = pos.buyPriceAvg > 0 ? (diffNative / pos.buyPriceAvg) * 100 : 0;
                        const isPositiveNative = totalDiffNative >= 0;

                        // CHF Calculation
                        // 1. Total Cost in CHF (Historical)
                        const totalCostCHF = pos.shares * pos.buyPriceAvg * (pos.averageEntryFxRate || 1);
                        // 2. Current Value in CHF (Live)
                        const currentValueCHF = convertToCHF(stock.currentPrice * pos.shares, stock.currency);
                        // 3. Diff and Percent
                        const totalDiffCHF = currentValueCHF - totalCostCHF;
                        const percentChangeCHF = totalCostCHF > 0 ? (totalDiffCHF / totalCostCHF) * 100 : 0;
                        const isPositiveCHF = totalDiffCHF >= 0;

                        const isForeign = stock.currency !== 'CHF';

                        return (
                            <>
                                <div className="flex justify-between py-1 md:py-1.5 landscape:py-0.5 border-b border-border/50 text-xs sm:text-sm landscape:text-[11px]">
                                    <span className="text-muted-foreground">Kaufpreis Ø</span>
                                    <div className="text-right flex flex-col items-end landscape:flex-row landscape:items-baseline landscape:gap-1.5">
                                        <span className="font-medium tabular-nums">
                                            {formatCurrency(pos.buyPriceAvg, stock.currency, false)}
                                        </span>
                                        {isForeign && (
                                            <span className="text-[10px] text-muted-foreground tabular-nums">
                                                (Ø {formatCurrency(totalCostCHF / pos.shares, 'CHF', false)})
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <div className="flex justify-between py-1 md:py-1.5 landscape:py-0.5 border-b border-border/50 text-xs sm:text-sm landscape:text-[11px]">
                                    <span className="text-muted-foreground">Gewinn/Verlust</span>
                                    <div className="text-right flex flex-col items-end landscape:flex-row landscape:items-baseline landscape:gap-1.5">
                                        {/* Native Gain */}
                                        <span className={cn(
                                            "font-bold tabular-nums",
                                            isPositiveNative ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
                                        )}>
                                            {isPositiveNative ? '+' : ''}{percentChangeNative.toFixed(2)}% ({formatCurrency(totalDiffNative, stock.currency, false)})
                                        </span>

                                        {/* CHF Gain (only if foreign) */}
                                        {isForeign && (
                                            <span className={cn(
                                                "text-[10px] font-medium tabular-nums mt-0.5 landscape:mt-0",
                                                isPositiveCHF ? "text-emerald-600/80 dark:text-emerald-400/80" : "text-rose-600/80 dark:text-rose-400/80"
                                            )}>
                                                (CHF: {isPositiveCHF ? '+' : ''}{percentChangeCHF.toFixed(2)}%)
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </>
                        );
                    })()}

                    <div className="flex justify-between py-1 md:py-1.5 landscape:py-0.5 border-b border-border/50 text-xs sm:text-sm landscape:text-[11px]">
                        <span className="text-muted-foreground">Aktueller Kurs</span>
                        <span className="font-medium tabular-nums">{formatCurrency(stock.currentPrice, stock.currency, false)}</span>
                    </div>

                    {/* Added Open and Previous Close in one line */}
                    <div className="flex justify-between py-1 md:py-1.5 landscape:py-0.5 border-b border-border/50 text-xs sm:text-sm landscape:text-[11px]">
                        <span className="text-muted-foreground">Eröffnung / Vortag</span>
                        <span className="font-medium tabular-nums text-right">
                            {stock.open ? formatCurrency(stock.open, stock.currency, false) : '-'} / {formatCurrency(safePreviousClose || 0, stock.currency, false)}
                        </span>
                    </div>

                    <div className="flex justify-between py-1 md:py-1.5 landscape:py-0.5 border-b border-border/50 text-xs sm:text-sm landscape:text-[11px]">
                        <span className="text-muted-foreground">Kauflimit</span>
                        <span className="font-medium tabular-nums">
                            {stock.targetPrice ? formatCurrency(stock.targetPrice, stock.currency, false) : '-'}
                        </span>
                    </div>
                    <div className="flex justify-between py-1 md:py-1.5 landscape:py-0.5 border-b border-border/50 text-xs sm:text-sm landscape:text-[11px]">
                        <span className="text-muted-foreground">Verkaufslimit</span>
                        <span className="font-medium tabular-nums">
                            {stock.sellLimit ? formatCurrency(stock.sellLimit, stock.currency, false) : '-'}
                        </span>
                    </div>
                    {(() => {
                        void fvModeTick;
                        const symKey = (stock.symbol || '').toUpperCase();
                        let localParams: any = null;
                        try {
                            const mapRaw = localStorage.getItem('fair_value_params_map');
                            if (symKey && mapRaw) {
                                const map = JSON.parse(mapRaw);
                                if (map[symKey]) localParams = map[symKey];
                            }
                        } catch {
                            // ignore
                        }
                        const stockParams = stock.fairValueParams;
                        let activeParams = stockParams || localParams;
                        if (localParams && stockParams) {
                            const localTime = localParams.updatedAt ? new Date(localParams.updatedAt).getTime() : 0;
                            const stockTime = stockParams.updatedAt ? new Date(stockParams.updatedAt).getTime() : 0;
                            activeParams = localTime >= stockTime ? localParams : stockParams;
                        }

                        const effectivePrice = stock.currentPrice || 0;
                        const smartAutoConservative = computeSmartAutoParams(
                            { price: effectivePrice, dividendYield: stock.dividendYield },
                            null,
                            stock,
                            symKey,
                            'conservative'
                        );
                        const smartAutoQuality = computeSmartAutoParams(
                            { price: effectivePrice, dividendYield: stock.dividendYield },
                            null,
                            stock,
                            symKey,
                            'quality'
                        );

                        const isManualFv = Boolean(activeParams?.isCustom);
                        const currentValuationMode: 'conservative' | 'quality' = activeParams?.valuationMode === 'quality' ? 'quality' : 'conservative';
                        const currentMode: 'conservative' | 'quality' | 'manual' = isManualFv ? 'manual' : currentValuationMode;

                        let effectiveFairValue = 0;
                        let calcBuyPrice: number | null = null;
                        let mosPct = 20;

                        if (currentMode === 'manual') {
                            mosPct = activeParams?.mos ?? smartAutoConservative.mos ?? 20;
                            effectiveFairValue = (activeParams?.manualFairValue && Number(activeParams.manualFairValue) > 0)
                                ? Number(activeParams.manualFairValue)
                                : (activeParams?.eps > 0 ? calculateDcfFairValue(activeParams, effectivePrice).fairValue : (stock.fairValue || 0));
                            calcBuyPrice = effectiveFairValue > 0 ? effectiveFairValue * (1 - mosPct / 100) : null;
                        } else if (currentMode === 'quality') {
                            const qParams = (activeParams?.valuationMode === 'quality' && !activeParams?.isCustom && activeParams?.eps > 0) ? activeParams : smartAutoQuality;
                            const dcf = calculateDcfFairValue(qParams, effectivePrice);
                            effectiveFairValue = dcf.fairValue;
                            calcBuyPrice = dcf.buyPrice;
                            mosPct = dcf.mos;
                        } else {
                            // 'conservative'
                            const cParams = (activeParams?.valuationMode === 'conservative' && !activeParams?.isCustom && activeParams?.eps > 0) ? activeParams : smartAutoConservative;
                            const dcf = calculateDcfFairValue(cParams, effectivePrice);
                            effectiveFairValue = dcf.fairValue;
                            calcBuyPrice = dcf.buyPrice;
                            mosPct = dcf.mos;
                        }

                        const handleToggleFvMode = (e: React.MouseEvent) => {
                            e.stopPropagation();
                            if (!symKey) return;
                            const now = new Date().toISOString();
                            let map: Record<string, any> = {};
                            try {
                                const mapRaw = localStorage.getItem('fair_value_params_map');
                                if (mapRaw) map = JSON.parse(mapRaw);
                            } catch {
                                // ignore
                            }
                            const existingLocal = map[symKey] || {};
                            const existingBackup = existingLocal.customBackup || stockParams?.customBackup || (activeParams?.isCustom ? activeParams : null);

                            if (currentMode === 'conservative') {
                                // Switch to Qualität (B)
                                const dcfQuality = calculateDcfFairValue(smartAutoQuality, effectivePrice);
                                const newFv = parseFloat(dcfQuality.fairValue.toFixed(2));
                                const nextEntry = {
                                    ...smartAutoQuality,
                                    isCustom: false,
                                    valuationMode: 'quality' as const,
                                    ...(existingBackup ? { customBackup: existingBackup } : {}),
                                    updatedAt: now
                                };
                                map[symKey] = nextEntry;
                                try {
                                    localStorage.setItem('fair_value_params_map', JSON.stringify(map));
                                } catch {
                                    // ignore
                                }
                                if (stockFromContext) {
                                    updateStock(stock.id, {
                                        ...(newFv > 0 ? { fairValue: newFv } : {}),
                                        fairValueParams: nextEntry
                                    });
                                } else {
                                    setVirtualStock((prev: any) => ({
                                        ...prev,
                                        ...(newFv > 0 ? { fairValue: newFv } : {}),
                                        fairValueParams: nextEntry
                                    }));
                                }
                            } else if (currentMode === 'quality') {
                                // Switch to Manuell
                                const backupToRestore = existingBackup || {
                                    ...(activeParams || smartAutoQuality),
                                    ...(effectiveFairValue > 0 ? { manualFairValue: effectiveFairValue } : {})
                                };
                                const restoredDcf = calculateDcfFairValue(backupToRestore, effectivePrice);
                                const newManualFv = (backupToRestore.manualFairValue && Number(backupToRestore.manualFairValue) > 0)
                                    ? parseFloat(Number(backupToRestore.manualFairValue).toFixed(2))
                                    : parseFloat(restoredDcf.fairValue.toFixed(2));
                                const nextEntry = {
                                    ...backupToRestore,
                                    isCustom: true,
                                    customBackup: backupToRestore,
                                    updatedAt: now
                                };
                                map[symKey] = nextEntry;
                                try {
                                    localStorage.setItem('fair_value_params_map', JSON.stringify(map));
                                } catch {
                                    // ignore
                                }
                                if (stockFromContext) {
                                    updateStock(stock.id, {
                                        ...(newManualFv > 0 ? { fairValue: newManualFv } : {}),
                                        fairValueParams: nextEntry
                                    });
                                } else {
                                    setVirtualStock((prev: any) => ({
                                        ...prev,
                                        ...(newManualFv > 0 ? { fairValue: newManualFv } : {}),
                                        fairValueParams: nextEntry
                                    }));
                                }
                            } else {
                                // Switch from Manuell to Sicherheit (A)
                                const manualBackupToSave = {
                                    ...(existingBackup || activeParams || smartAutoConservative),
                                    ...(effectiveFairValue > 0 ? { manualFairValue: effectiveFairValue } : {}),
                                    updatedAt: now
                                };
                                const dcfConservative = calculateDcfFairValue(smartAutoConservative, effectivePrice);
                                const newAutoFv = parseFloat(dcfConservative.fairValue.toFixed(2));
                                const nextEntry = {
                                    ...smartAutoConservative,
                                    isCustom: false,
                                    valuationMode: 'conservative' as const,
                                    customBackup: manualBackupToSave,
                                    updatedAt: now
                                };
                                map[symKey] = nextEntry;
                                try {
                                    localStorage.setItem('fair_value_params_map', JSON.stringify(map));
                                } catch {
                                    // ignore
                                }
                                if (stockFromContext) {
                                    updateStock(stock.id, {
                                        ...(newAutoFv > 0 ? { fairValue: newAutoFv } : {}),
                                        fairValueParams: nextEntry
                                    });
                                } else {
                                    setVirtualStock((prev: any) => ({
                                        ...prev,
                                        ...(newAutoFv > 0 ? { fairValue: newAutoFv } : {}),
                                        fairValueParams: nextEntry
                                    }));
                                }
                            }
                            setFvModeTick(t => t + 1);
                        };

                        return (
                            <>
                                <div className="flex items-center justify-between py-1 md:py-1.5 landscape:py-0.5 border-b border-border/50 text-xs sm:text-sm landscape:text-[11px]">
                                    <button
                                        type="button"
                                        onClick={handleToggleFvMode}
                                        className={cn(
                                            "flex items-center gap-1 text-[11px] sm:text-xs landscape:text-[10px] font-semibold px-1.5 py-0.5 landscape:py-0 landscape:px-1 rounded border transition-colors cursor-pointer",
                                            currentMode === 'manual'
                                                ? "text-emerald-400 bg-emerald-500/15 hover:bg-emerald-500/25 border-emerald-500/40"
                                                : currentMode === 'quality'
                                                    ? "text-purple-400 bg-purple-500/15 hover:bg-purple-500/25 border-purple-500/40"
                                                    : "text-blue-400 bg-blue-500/15 hover:bg-blue-500/25 border-blue-500/40"
                                        )}
                                        title={
                                            currentMode === 'conservative'
                                                ? "Sicherheit (A): Klick für Wechsel zu Qualität (B)"
                                                : currentMode === 'quality'
                                                    ? "Qualität (B): Klick für Wechsel zu Manuell"
                                                    : "Manuell: Klick für Wechsel zu Sicherheit (A)"
                                        }
                                    >
                                        {currentMode === 'conservative' && <ShieldCheck className="size-3 shrink-0" />}
                                        {currentMode === 'quality' && <Sparkles className="size-3 shrink-0" />}
                                        {currentMode === 'manual' && <Sliders className="size-3 shrink-0" />}
                                        <span>
                                            {currentMode === 'manual'
                                                ? 'Kaufpreis (Manuell)'
                                                : currentMode === 'quality'
                                                    ? 'Kaufpreis (Qualität B)'
                                                    : 'Kaufpreis (Sicherheit A)'}
                                        </span>
                                    </button>
                                    <span className={cn(
                                        "font-medium tabular-nums",
                                        calcBuyPrice !== null
                                            ? currentMode === 'manual'
                                                ? "text-emerald-400"
                                                : currentMode === 'quality'
                                                    ? "text-purple-400"
                                                    : "text-blue-400"
                                            : ""
                                    )}>
                                        {calcBuyPrice !== null ? formatCurrency(calcBuyPrice, stock.currency, false) : '-'}
                                    </span>
                                </div>
                                <div className="flex justify-between py-1 md:py-1.5 landscape:py-0.5 border-b border-border/50 text-xs sm:text-sm landscape:text-[11px]">
                                    <span className="text-muted-foreground">Fairer Wert</span>
                                    <span className={cn(
                                        "font-medium tabular-nums",
                                        effectiveFairValue > 0
                                            ? currentMode === 'manual'
                                                ? "text-emerald-400"
                                                : currentMode === 'quality'
                                                    ? "text-purple-400"
                                                    : "text-blue-400"
                                            : ""
                                    )}>
                                        {effectiveFairValue > 0 ? formatCurrency(effectiveFairValue, stock.currency, false) : '-'}
                                    </span>
                                </div>
                            </>
                        );
                    })()}
                </div>

                {/* Stammdaten */}
                <div className="bg-card border border-border rounded-xl p-4 md:p-6 landscape:p-2.5 landscape:py-2 shadow-sm flex flex-col justify-between landscape:h-[295px] overflow-hidden">
                    <h3 className="font-bold text-base md:text-lg landscape:text-xs mb-2 md:mb-4 landscape:mb-1 flex items-center gap-1.5 md:gap-2">
                        <TrendingUp className="size-4 md:size-5 text-blue-500" />
                        Stammdaten
                    </h3>
                    <div className="space-y-1.5 md:space-y-3 landscape:space-y-0">
                        <div className="flex justify-between py-1 md:py-1.5 landscape:py-0.5 border-b border-border/50 text-xs sm:text-sm landscape:text-[11px]">
                            <span className="text-muted-foreground">Name</span>
                            <span className="font-medium text-right truncate max-w-[180px] sm:max-w-[240px]">{stock.name}</span>
                        </div>
                        <div className="flex justify-between py-1 md:py-1.5 landscape:py-0.5 border-b border-border/50 text-xs sm:text-sm landscape:text-[11px]">
                            <span className="text-muted-foreground">Symbol</span>
                            <span className="font-medium font-mono">{stock.symbol}</span>
                        </div>
                        <div className="flex justify-between py-1 md:py-1.5 landscape:py-0.5 border-b border-border/50 text-xs sm:text-sm landscape:text-[11px]">
                            <span className="text-muted-foreground">ISIN</span>
                            <span className="font-medium font-mono">{stock.isin || '-'}</span>
                        </div>
                        <div className="flex justify-between py-1 md:py-1.5 landscape:py-0.5 border-b border-border/50 text-xs sm:text-sm landscape:text-[11px]">
                            <span className="text-muted-foreground">Typ</span>
                            <span className="font-medium capitalize">{stock.type || 'Aktie'}</span>
                        </div>
                        <div className="flex justify-between py-1 md:py-1.5 landscape:py-0.5 border-b border-border/50 text-xs sm:text-sm landscape:text-[11px]">
                            <span className="text-muted-foreground">Währung</span>
                            <span className="font-medium">{stock.currency}</span>
                        </div>
                        <div className="flex justify-between py-1 md:py-1.5 landscape:py-0.5 border-b border-border/50 text-xs sm:text-sm landscape:text-[11px]">
                            <span className="text-muted-foreground">KGV (P/E)</span>
                            <span className="font-medium">
                                {stock.trailingPE
                                    ? stock.trailingPE.toFixed(2)
                                    : (stock.forwardPE ? `${stock.forwardPE.toFixed(2)} (Fwd)` : (stock.eps && stock.eps > 0 ? (stock.currentPrice / stock.eps).toFixed(2) : '-'))}
                            </span>
                        </div>
                        <div className="flex justify-between py-1 md:py-1.5 landscape:py-0.5 border-b border-border/50 text-xs sm:text-sm landscape:text-[11px]">
                            <span className="text-muted-foreground">KCV (P/CF)</span>
                            <span className={`font-medium ${kcvColorClass}`}>
                                {stock.kcv ? stock.kcv.toFixed(2) : '-'}
                            </span>
                        </div>
                        <div className="flex justify-between py-1 md:py-1.5 landscape:py-0.5 border-b border-border/50 text-xs sm:text-sm landscape:text-[11px]">
                            <span className="text-muted-foreground">Div. Frequenz</span>
                            <span className="font-medium capitalize">
                                {stock.dividendFrequency ? (
                                    stock.dividendFrequency === 'quarterly' ? 'Quartalsweise' :
                                        stock.dividendFrequency === 'monthly' ? 'Monatlich' :
                                            stock.dividendFrequency === 'semi-annually' ? 'Halbjährlich' : 'Jährlich'
                                ) : '-'}
                            </span>
                        </div>
                        <div className="flex justify-between py-1 md:py-1.5 landscape:py-0.5 border-b border-border/50 text-xs sm:text-sm landscape:text-[11px]">
                            <span className="text-muted-foreground">Div. Rendite</span>
                            <span className="font-medium text-right">
                                {(() => {
                                    const pos = positions.find(p => p.stockId === stock.id);
                                    const freqFactor = stock.dividendFrequency === 'quarterly' ? 4 : stock.dividendFrequency === 'semi-annually' ? 2 : stock.dividendFrequency === 'monthly' ? 12 : 1;
                                    const annualPayout = (stock.dividendAmount && stock.dividendAmount > 0) ? stock.dividendAmount * freqFactor : 0;
                                    const yieldCost = (annualPayout > 0 && pos && pos.buyPriceAvg > 0) ? (annualPayout / pos.buyPriceAvg) * 100 : null;
                                    const marketYield = (annualPayout > 0 && stock.currentPrice > 0) ? (annualPayout / stock.currentPrice) * 100 : (stock.dividendYield || null);

                                    if (!marketYield && !yieldCost) return '-';

                                    if (yieldCost !== null && marketYield !== null && Math.abs(yieldCost - marketYield) > 0.01) {
                                        return (
                                            <div className="flex flex-col items-end leading-tight">
                                                <span className="font-bold text-green-600 dark:text-green-400">{yieldCost.toFixed(2)}% (Käufe)</span>
                                                <span className="text-[10px] text-muted-foreground">Kurs: {marketYield.toFixed(2)}%</span>
                                            </div>
                                        );
                                    }
                                    return `${(yieldCost ?? marketYield)?.toFixed(2)}%`;
                                })()}
                            </span>
                        </div>
                    </div>
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
                            <div className="bg-muted/40 border border-border/60 rounded-xl p-4 text-xs text-muted-foreground flex items-center gap-2.5">
                                <span className="text-amber-500 text-sm font-bold">ℹ</span>
                                <span>Für diesen ETF stellt Yahoo Finance keine automatischen Allokationsdaten (Branchen- / Länderaufteilung) bereit.</span>
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
                                                        'australia': 'Australien',
                                                        'italy': 'Italien',
                                                        'spain': 'Spanien',
                                                        'finland': 'Finnland',
                                                        'netherlands': 'Niederlande',
                                                        'belgium': 'Belgien',
                                                        'austria': 'Österreich',
                                                        'portugal': 'Portugal',
                                                        'other': 'Andere'
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

            {/* Quick Links & Notes (Vertical Stack) */}
            <div className="flex flex-col gap-6">
                {/* Quick Links Card */}
                <div className="bg-card border border-border rounded-xl p-6 shadow-sm flex flex-col">
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
            {
                stock && (
                    <AddToWatchlistModal
                        isOpen={isWatchlistModalOpen}
                        onClose={() => setIsWatchlistModalOpen(false)}
                        stockId={stock.id}
                    />
                )
            }
        </div >
    );
}
