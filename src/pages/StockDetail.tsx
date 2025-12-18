
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { usePortfolio } from '../context/PortfolioContext';

import { useCurrencyFormatter } from '../utils/currency';
import { ArrowLeft, Save, TrendingUp } from 'lucide-react';
import { PriceHistoryChart } from '../components/PriceHistoryChart';
import { cn } from '../utils';
import { Logo } from '../components/Logo';

import { fetchStockHistory, type TimeRange, type ChartDataPoint } from '../services/finnhub';

export function StockDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { stocks, updateStock, updateStockPrice } = usePortfolio();
    const { formatCurrency } = useCurrencyFormatter();

    // Find stock
    const stock = stocks.find(s => s.id === id);

    const [notes, setNotes] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [timeRange, setTimeRange] = useState<TimeRange>('1D');
    const [chartData, setChartData] = useState<ChartDataPoint[] | null>(null);

    // Fetch History Effect - Now using Yahoo Finance
    useEffect(() => {
        if (!stock) {
            setChartData(null);
            return;
        }

        const loadData = async () => {
            console.log('[StockDetail] Fetching Yahoo Finance data for:', stock.symbol, 'Range:', timeRange);
            const response = await fetchStockHistory(stock.symbol, timeRange);
            console.log('[Stock Detail] Yahoo Response:', response);

            if (response.error) {
                console.warn('[StockDetail] Error from Yahoo:', response.error);
                setChartData(null); // Fallback to simulation
            } else {
                console.log('[StockDetail] Success! Data points:', response.data?.length || 0);
                setChartData(response.data);

                // Sync current price with latest chart data
                if (response.data && response.data.length > 0) {
                    const latestPrice = response.data[response.data.length - 1].value;
                    if (Math.abs(stock.currentPrice - latestPrice) > 0.01) {
                        // Update price but don't trigger re-fetch (dependency is stock.symbol)
                        updateStockPrice(stock.id, latestPrice);
                    }
                }
            }
        };

        loadData();
    }, [stock?.symbol, timeRange]);

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
                        {stock.dividendYield && (
                            <p className="text-sm text-green-600 dark:text-green-400 font-medium mt-1">
                                {stock.dividendYield.toFixed(2)}% Div.Rendite
                            </p>
                        )}
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left Column: Stats & Chart */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Price Chart */}
                    <div className="bg-card border border-border rounded-xl p-6 shadow-sm min-h-[450px] flex flex-col">
                        <div className="flex items-center gap-2 mb-4 shrink-0">
                            <TrendingUp className="size-5 text-blue-500" />
                            <h3 className="font-bold text-lg">Kursverlauf</h3>
                        </div>
                        <div className="flex-1 w-full min-h-0">
                            <PriceHistoryChart
                                currentPrice={stock.currentPrice}
                                currency={stock.currency}
                                trend={stock.dividendYield && stock.dividendYield > 2 ? 'up' : 'neutral'}
                                historyData={chartData}
                                selectedRange={timeRange}
                                onRangeChange={(range) => setTimeRange(range)}
                            />
                        </div>
                    </div>

                    <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
                        <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                            <TrendingUp className="size-5 text-blue-500" />
                            Stammdaten
                        </h3>
                        <div className="space-y-4">
                            <div className="flex justify-between py-2 border-b border-border/50">
                                <span className="text-muted-foreground text-sm">ISIN</span>
                                <span className="font-medium text-sm font-mono">{stock.isin || '-'}</span>
                            </div>
                            <div className="flex justify-between py-2 border-b border-border/50">
                                <span className="text-muted-foreground text-sm">Währung</span>
                                <span className="font-medium text-sm">{stock.currency}</span>
                            </div>
                            <div className="flex justify-between py-2 border-b border-border/50">
                                <span className="text-muted-foreground text-sm">Typ</span>
                                <span className="font-medium text-sm capitalize">{stock.type || 'Aktie'}</span>
                            </div>
                            <div className="flex justify-between py-2 border-b border-border/50">
                                <span className="text-muted-foreground text-sm">Frequenz</span>
                                <span className="font-medium text-sm capitalize">
                                    {stock.dividendFrequency === 'quarterly' ? 'Quartalsweise' :
                                        stock.dividendFrequency === 'monthly' ? 'Monatlich' :
                                            stock.dividendFrequency === 'semi-annually' ? 'Halbjährlich' : 'Jährlich'}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Column: Notes & Research */}
                <div className="lg:col-span-1 space-y-6">
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
        </div>
    );
}
