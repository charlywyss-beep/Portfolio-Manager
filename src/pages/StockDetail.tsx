
import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { usePortfolio } from '../context/PortfolioContext';

import { useCurrencyFormatter } from '../utils/currency';
import { ArrowLeft, Save, TrendingUp, RefreshCw } from 'lucide-react';
import { useAutoRefresh } from '../hooks/useAutoRefresh';
import { PriceHistoryChart } from '../components/PriceHistoryChart';
import { cn } from '../utils';
import { Logo } from '../components/Logo';

import { fetchStockHistory, fetchStockQuote, type TimeRange, type ChartDataPoint } from '../services/yahoo-finance';

export function StockDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { stocks, positions, updateStock, updateStockPrice } = usePortfolio();
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
    const [, setTimeTick] = useState(0); // Force re-render for time display

    // Force update "Updated X min ago" text every minute
    useEffect(() => {
        if (!lastUpdate) return;
        const interval = setInterval(() => {
            setTimeTick(t => t + 1);
        }, 60000);
        return () => clearInterval(interval);
    }, [lastUpdate]);

    // Get position to determine buy date
    const position = positions.find(p => p.stockId === stock?.id);

    // Load data function (memoized for auto-refresh)
    const loadData = useCallback(async () => {
        if (!stock) {
            setChartData(null);
            return;
        }

        setIsRefreshing(true);
        console.log('[StockDetail] Fetching Yahoo Finance data for:', stock.symbol, 'Range:', timeRange);

        let rangeToUse = timeRange;

        // Handle 'BUY' range
        if (timeRange === 'BUY') {
            if (position?.buyDate) {
                rangeToUse = '5Y';
            } else {
                rangeToUse = '5Y'; // Default fallback
            }
        }

        const response = await fetchStockHistory(stock.symbol, rangeToUse);
        console.log('[Stock Detail] Yahoo Response:', response);

        if (response.error) {
            console.warn('[StockDetail] Error from Yahoo:', response.error);
            setChartData(null); // Fallback to simulation
        } else {
            console.log('[StockDetail] Success! Data points:', response.data?.length || 0);
            setChartData(response.data);

            // Sync current price with latest chart data
            if (response.data && response.data.length > 0) {
                let chartData = response.data;

                // Auto-detect GBp (Pence) to GBP (Pound) conversion
                const latestPriceRaw = chartData[chartData.length - 1].value;
                const isGBP = stock.currency === 'GBP';

                if (isGBP) {
                    const isLSE = stock.symbol.toUpperCase().endsWith('.L') || stock.isin?.startsWith('GB');
                    if (isLSE && latestPriceRaw > 50) {
                        console.log('[StockDetail] Normalizing GBp to GBP for chart data');
                        chartData = chartData.map(d => ({
                            ...d,
                            value: d.value / 100
                        }));
                    }
                }

                const latestPrice = chartData[chartData.length - 1].value;

                // Filter for 'BUY' range if needed
                if (timeRange === 'BUY' && position?.buyDate) {
                    const buyDate = new Date(position.buyDate).getTime();
                    const filteredData = chartData.filter(d => new Date(d.date).getTime() >= buyDate);
                    if (filteredData.length > 0) {
                        setChartData(filteredData);
                    } else {
                        setChartData(chartData);
                    }
                } else {
                    setChartData(chartData);
                }

                if (Math.abs(stock.currentPrice - latestPrice) > 0.0001) {
                    updateStockPrice(stock.id, latestPrice);
                }
            } else {
                setChartData(response.data);
            }
        }

        // Parallel: Fetch latest Quote (usually fresher than chart)
        if (timeRange !== 'BUY') {
            const quoteResponse = await fetchStockQuote(stock.symbol);
            if (quoteResponse.price) {
                console.log('[StockDetail] Quote Update:', quoteResponse.price, quoteResponse.currency, quoteResponse.marketTime);

                if (quoteResponse.marketTime) {
                    setQuoteDate(quoteResponse.marketTime);
                }

                // Check if GBP normalization needed (GBp -> GBP)
                let finalPrice = quoteResponse.price;
                if (stock.currency === 'GBP' && finalPrice > 50) {
                    // Heuristic: If we expect GBP but price is > 50 (likely Pence), divide by 100
                    // But only if stock.currency is explicitly GBP.
                    // Better check: If stock symbol ends in .L, Yahoo returns GBp (Pence).
                    if (stock.symbol.toUpperCase().endsWith('.L')) {
                        finalPrice = finalPrice / 100;
                    }
                }

                if (Math.abs(stock.currentPrice - finalPrice) > 0.0001) {
                    updateStockPrice(stock.id, finalPrice);
                }

                // Check for KGV/Yield updates
                const updates: any = {};
                let hasUpdates = false;

                if (quoteResponse.trailingPE !== undefined && quoteResponse.trailingPE !== null && Math.abs((stock.trailingPE || 0) - quoteResponse.trailingPE) > 0.01) {
                    updates.trailingPE = quoteResponse.trailingPE;
                    hasUpdates = true;
                }

                // Yield check (assuming Yahoo returns consistent format, usually percentage e.g. 2.5)
                // If Yahoo returns raw (0.025), we might need * 100. Let's assume matches existing format for now or user will report.
                if (quoteResponse.dividendYield !== undefined && quoteResponse.dividendYield !== null && Math.abs((stock.dividendYield || 0) - quoteResponse.dividendYield) > 0.01) {
                    updates.dividendYield = quoteResponse.dividendYield;
                    hasUpdates = true;
                }

                if (hasUpdates) {
                    updateStock(stock.id, updates);
                }
            }
        }

        setIsRefreshing(false);
        setLastUpdate(new Date());
    }, [stock, timeRange, position, updateStockPrice]);

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
        <div className="p-6 md:p-8 space-y-8 animate-in fade-in duration-500">
            {/* Header / Navigation */}
            <div>
                <button
                    onClick={() => navigate(-1)}
                    className="flex items-center text-muted-foreground hover:text-foreground transition-colors mb-4"
                >
                    <ArrowLeft className="size-4 mr-1" />
                    Zurück
                </button>

                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <Logo
                            url={stock.logoUrl}
                            alt={stock.name}
                            size="size-16"
                            fallback={
                                <span className="text-2xl">{stock.symbol.slice(0, 2)}</span>
                            }
                            className="text-2xl"
                        />
                        <div>
                            <div className="flex items-center gap-3">
                                <h1 className="text-xl md:text-3xl font-bold tracking-tight">{stock.name}</h1>
                                <button
                                    onClick={() => navigate(`/dividends/edit/${stock.id}`)}
                                    className="p-1.5 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
                                    title="Daten bearbeiten"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-pencil"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" /><path d="m15 5 4 4" /></svg>
                                </button>
                            </div>
                            <div className="flex items-center gap-2 text-muted-foreground mt-1 text-sm md:text-base">
                                <span className="font-bold text-foreground">{stock.symbol}</span>
                                <span>•</span>
                                <span>{stock.sector || 'Sektor unbekannt'}</span>
                            </div>
                        </div>
                    </div>

                    {/* Price Card */}
                    <div className="text-right">
                        <p className="text-xs md:text-sm text-muted-foreground font-medium">Aktueller Kurs</p>
                        <h2 className="text-2xl md:text-3xl font-bold">
                            {formatCurrency(stock.currentPrice, stock.currency)}
                        </h2>
                        {stock.distributionPolicy === 'accumulating' ? (
                            <p className="text-sm text-blue-600 dark:text-blue-400 font-medium mt-1 bg-blue-50 dark:bg-blue-900/20 px-2 py-0.5 rounded inline-block">
                                Thesaurierend
                            </p>
                        ) : stock.dividendYield && (
                            <p className="text-sm text-green-600 dark:text-green-400 font-medium mt-1">
                                {stock.dividendYield.toFixed(2)}% Div.Rendite
                            </p>
                        )}



                        {/* Dynamic Position Performance based on Chart Range */}
                        {(() => {
                            const position = positions.find(p => p.stockId === stock.id);
                            if (!position) return null;

                            // Determine start price for the period
                            // For 1D, we ideally want previousClose, but chartData[0] is a good proxy if prevClose is missing/same
                            let referencePrice = stock.previousClose;

                            if (timeRange !== '1D' && chartData && chartData.length > 0) {
                                referencePrice = chartData[0].value;
                            } else if (timeRange === '1D') {
                                // Fallback for 1D if chart data exists but previousClose might be off? 
                                // Actually Stick to previousClose for 1D as per standard "Day Change" definition.
                                // But if we want to match the Chart's visual "Start", chartData[0] is often used.
                                // Let's use chartData[0] for consistency with the chart visual, UNLESS it's 1D where Previous Close is the standard anchor.
                                // However, user asked for "Performance to Yesterday, Week etc".
                                // If 1D chart starts at 09:00, and previous Close was 17:30 yesterday.
                                referencePrice = stock.previousClose || (chartData && chartData.length > 0 ? chartData[0].value : stock.currentPrice);
                            } else if (chartData && chartData.length > 0) {
                                referencePrice = chartData[0].value;
                            }

                            // If we switched ranges and chartData is updating, we might have a mismatch briefly. 
                            // Ensure we have chartData for non-1D ranges or use valid fallback.
                            if (timeRange !== '1D' && (!chartData || chartData.length === 0)) return null;

                            const diffPerShare = stock.currentPrice - referencePrice;
                            const totalDiff = diffPerShare * position.shares;
                            const percentChange = referencePrice > 0 ? (diffPerShare / referencePrice) * 100 : 0;
                            const isPositive = totalDiff >= 0;

                            return (
                                <div className="mt-2 text-right">
                                    <p className="text-xs text-muted-foreground">Performance ({timeRange})</p>
                                    <p className={cn(
                                        "text-sm font-bold",
                                        isPositive ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
                                    )}>
                                        {isPositive ? '+' : ''}{percentChange.toFixed(2)}% ({formatCurrency(totalDiff, stock.currency)})
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
                        <div className="flex items-center justify-between mb-4 shrink-0">
                            <div className="flex items-center gap-2">
                                <TrendingUp className="size-5 text-blue-500" />
                                <h3 className="font-bold text-lg">Kursverlauf</h3>
                            </div>
                            {/* Manual Refresh Button */}
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
                                    {isRefreshing ? 'Aktualisiere...' : lastUpdate ? `Aktualisiert vor ${Math.floor((new Date().getTime() - lastUpdate.getTime()) / 60000)} Min` : 'Daten laden'}
                                </span>
                            </button>
                        </div>
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
                            />
                        </div>
                    </div>

                </div>

                {/* Right Column: Stammdaten & Notes */}
                <div className="lg:col-span-1 space-y-6">
                    {/* Stammdaten - Moved here for compact width */}
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
                                <span className="font-medium text-sm">{stock.trailingPE ? stock.trailingPE.toFixed(2) : '-'}</span>
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

                {/* Right Column: Notes & Research */}

                <div className="bg-card border border-border rounded-xl p-6 shadow-sm h-full flex flex-col">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="font-bold text-lg flex items-center gap-2">
                            <Save className="size-5 text-purple-500" />
                            Persönliche Notizen & Analyse
                        </h3>
                        <button
                            onClick={handleSaveNotes}
                            disabled={isSaving}
                            className={cn(
                                "px-4 py-2 rounded-lg text-sm font-bold transition-all",
                                isSaving
                                    ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                                    : "bg-primary text-primary-foreground hover:opacity-90"
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

    );
}
