
import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { usePortfolio } from '../context/PortfolioContext';

import { useCurrencyFormatter } from '../utils/currency';
import { ArrowLeft, Save, TrendingUp, RefreshCw, Trash2 } from 'lucide-react';
import { useAutoRefresh } from '../hooks/useAutoRefresh';
import { estimateMarketState } from '../utils/market';
import { PriceHistoryChart } from '../components/PriceHistoryChart';
import { cn } from '../utils';
import { Logo } from '../components/Logo';

import { fetchStockHistory, fetchStockQuote, type TimeRange, type ChartDataPoint } from '../services/yahoo-finance';

export function StockDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    // const [searchParams] = useSearchParams();
    const { stocks, positions, updateStock, updateStockPrice, addQuickLink, removeQuickLink } = usePortfolio();
    const { formatCurrency } = useCurrencyFormatter();

    // Find stock by ID or Symbol (case-insensitive)
    const stock = stocks.find(s =>
        s.id === id ||
        s.symbol.toLowerCase() === id?.toLowerCase()
    );

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

        const { symbol, id, currency, isin, trailingPE, forwardPE, eps, dividendYield, previousClose: currentPreviousClose } = currentStock;

        setIsRefreshing(true);
        // console.log('[StockDetail] Fetching Yahoo Finance data for:', symbol, 'Range:', timeRange);

        let rangeToUse = timeRange;

        // Handle 'BUY' range
        if (timeRange === 'BUY') {
            if (buyDateRef) {
                rangeToUse = '5Y';
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

        if (response.error) {
            console.warn('[StockDetail] Error from Yahoo:', response.error);
            setChartData(null);
        } else {
            setChartData(response.data);

            // Sync current price with latest chart data
            if (response.data && response.data.length > 0) {
                let chartData = response.data;

                // Auto-detect GBp (Pence) to GBP (Pound) conversion
                const latestPriceRaw = chartData[chartData.length - 1].value;
                const isGBP = currency === 'GBP';

                if (isGBP) {
                    const isLSE = symbol.toUpperCase().endsWith('.L') || isin?.startsWith('GB');
                    if (isLSE && latestPriceRaw > 50) {
                        chartData = chartData.map(d => ({
                            ...d,
                            value: d.value / 100
                        }));
                    }
                }

                const latestPrice = chartData[chartData.length - 1].value;

                // Filter for 'BUY' range if needed
                if (timeRange === 'BUY' && buyDateRef) {
                    const buyDate = new Date(buyDateRef).getTime();
                    const filteredData = chartData.filter(d => new Date(d.date).getTime() >= buyDate);
                    if (filteredData.length > 0) {
                        setChartData(filteredData);
                    } else {
                        setChartData(chartData);
                    }
                } else {
                    setChartData(chartData);
                }

                if (currentStock.currentPrice !== undefined && Math.abs(currentStock.currentPrice - latestPrice) > 0.0001) {
                    updateStockPrice(id, latestPrice);
                }
            }
        }

        // Parallel: Fetch latest Quote
        if (timeRange !== 'BUY') {
            const quoteResponse = await fetchStockQuote(symbol);
            if (quoteResponse.price) {
                if (quoteResponse.marketTime) {
                    setQuoteDate(quoteResponse.marketTime);
                }

                let finalPrice = quoteResponse.price;
                if (currency === 'GBP' && finalPrice > 50) {
                    if (symbol.toUpperCase().endsWith('.L')) {
                        finalPrice = finalPrice / 100;
                    }
                }

                if (currentStock.currentPrice !== undefined && Math.abs(currentStock.currentPrice - finalPrice) > 0.0001) {
                    updateStockPrice(id, finalPrice, undefined, quoteResponse.marketTime ? new Date(quoteResponse.marketTime).toISOString() : undefined);
                }

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

                // FIX: Update open and previousClose if changed
                if (quoteResponse.open !== undefined && quoteResponse.open !== null && Math.abs((currentStock.open || 0) - quoteResponse.open) > 0.0001) {
                    updates.open = quoteResponse.open;
                    hasUpdates = true;
                }

                // CRITICAL FIX: Only update previousClose if we DON'T have one yet.
                // This prevents the Detail view (Single Quote) from overwriting the List view (Batch Quote).
                // Batch Quote is generally more stable for the Portfolio Overview.
                const weHaveValidPrevClose = currentPreviousClose && currentPreviousClose > 0;

                if (quoteResponse.previousClose !== undefined && quoteResponse.previousClose !== null) {
                    // Check if we strictly need to update
                    if (!weHaveValidPrevClose) {
                        updates.previousClose = quoteResponse.previousClose;
                        hasUpdates = true;
                        console.log(`[StockDetail] Accepting previousClose from Single Quote (was missing): ${quoteResponse.previousClose}`);
                    } else {
                        // Log usage of existing
                        // console.log(`[StockDetail] Ignoring previousClose from Single Quote (${quoteResponse.previousClose}) because we have valid: ${currentPreviousClose}`);
                    }
                }

                if (hasUpdates) {
                    updateStock(id, updates);
                }
            }
        }
        setIsRefreshing(false);
        setLastUpdate(new Date());
    }, [timeRange, position?.buyDate]); // removed stock dependencies to avoid recreation loop, relies on Ref

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

    if (!stock) return <div className="p-8">Aktie nicht gefunden.</div>;

    const handleSaveNotes = async () => {
        setIsSaving(true);
        // Simulate small delay for UI feedback
        await new Promise(r => setTimeout(r, 500));
        updateStock(stock.id, { notes });
        setIsSaving(false);
    };

    return (
        <div className="p-6 md:p-8 space-y-8 animate-in fade-in duration-500 pb-16">
            {/* Sticky Header / Navigation */}
            <div className="sticky top-0 -mx-6 md:-mx-8 px-6 md:px-8 py-4 z-41 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border/50 shadow-sm transition-all -mt-6 md:-mt-8 mb-6">
                <div className="flex items-center gap-3 mb-4">
                    <button
                        onClick={() => navigate(-1)}
                        className="flex items-center text-muted-foreground hover:text-foreground transition-colors"
                    >
                        <ArrowLeft className="size-4 mr-1" />
                        Zurück
                    </button>

                    {/* Button moved to Chart Header */}
                </div>

                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div
                            className="cursor-pointer hover:scale-105 transition-transform"
                            onClick={() => navigate('/portfolio')}
                            title="Zurück zum Portfolio"
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
                            <div className="flex items-center gap-2 md:gap-3">
                                <h1 className="text-lg md:text-2xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/70">{stock.name}</h1>
                                {(() => {
                                    const displayState = stock.marketState || estimateMarketState(stock.symbol, stock.currency);
                                    return displayState === 'REGULAR' ? (
                                        <div className="size-2.5 rounded-full bg-green-500 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.5)] cursor-help border border-background" title="Markt geöffnet" />
                                    ) : (
                                        <div className="size-2.5 rounded-full bg-red-500 cursor-help border border-background" title={`Markt geschlossen (${displayState})`} />
                                    );
                                })()}
                                <button
                                    onClick={() => navigate(`/dividends/edit/${stock.id}`)}
                                    className="p-1 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
                                    title="Daten bearbeiten"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-pencil"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" /><path d="m15 5 4 4" /></svg>
                                </button>
                            </div>
                            <div className="flex items-center gap-2 text-muted-foreground mt-0.5 text-xs md:text-sm">
                                <span className="font-bold text-foreground">{stock.symbol}</span>
                                <span>•</span>
                                <span>{stock.sector || 'Sektor unbekannt'}</span>
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
                    <div className="bg-card border border-border rounded-xl p-6 shadow-sm min-h-[450px] flex flex-col">
                        <div className="grid grid-cols-3 items-center mb-4 shrink-0">
                            {/* Left: Title */}
                            <div className="justify-self-start flex items-center gap-2">
                                <TrendingUp className="size-5 text-blue-500" />
                                <h3 className="font-bold text-lg">Kursverlauf</h3>
                            </div>

                            {/* Center: Back Button (Absolute Center) */}
                            <div className="justify-self-center w-full flex justify-center">
                                <button
                                    onClick={() => navigate('/?openPerformance=true')}
                                    className="flex items-center text-xs md:text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors font-medium bg-blue-50 dark:bg-blue-900/10 px-3 py-1.5 rounded-md shadow-sm border border-blue-100 dark:border-blue-900/30 whitespace-nowrap"
                                >
                                    <ArrowLeft className="size-3 md:size-4 mr-1.5" />
                                    Zurück zur Performance
                                </button>
                            </div>

                            {/* Right: Refresh Button */}
                            <div className="justify-self-end">
                                <button
                                    onClick={loadData}
                                    disabled={isRefreshing}
                                    className={cn(
                                        "inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all shadow-sm",
                                        "bg-blue-600 text-white border-blue-700 hover:bg-blue-700 hover:border-blue-800",
                                        "active:scale-95",
                                        isRefreshing && "opacity-50 cursor-not-allowed"
                                    )}
                                    title="Daten aktualisieren"
                                >
                                    <RefreshCw className={cn("size-3.5", isRefreshing && "animate-spin")} />
                                    <span>
                                        {isRefreshing ? 'Lade Daten...' : lastUpdate ? `Abfrage vor ${minutesAgo} Min` : 'Daten laden'}
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
                                previousClose={stock.previousClose}
                                isMarketOpen={(stock.marketState || estimateMarketState(stock.symbol, stock.currency)) === 'REGULAR'}
                            />
                        </div>
                    </div>
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
                                    {stock.open ? formatCurrency(stock.open, stock.currency, false) : '-'} / {formatCurrency(stock.previousClose, stock.currency, false)}
                                </span>
                            </div>

                            <div className="flex justify-between py-1.5 border-b border-border/50">
                                <span className="text-muted-foreground text-sm">Kauflimit</span>
                                <span className="font-medium text-sm">
                                    {stock.targetPrice ? formatCurrency(stock.targetPrice, stock.currency, false) : '-'}
                                </span>
                            </div>
                        </div>
                    </div>

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
                    </div>
                </div>

                {/* Right Column: Quick Links & Notes (Vertical Stack) */}
                <div className="lg:col-span-3 flex flex-col gap-6">
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
                                    {stock.quickLinks.map((link) => (
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
        </div>
    );
}
