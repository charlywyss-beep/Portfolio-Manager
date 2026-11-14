import { StockName } from '../components/StockName';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { usePortfolio } from '../context/PortfolioContext';

import { useCurrencyFormatter } from '../utils/currency';
import { ArrowLeft, ArrowRight, RefreshCw, TrendingUp, Map as MapIcon, Save, Trash2, Calculator, BarChart2, ShieldCheck, Sparkles, Sliders, TriangleAlert, Pencil, Edit, Landmark, Activity, BarChart3, Calendar, Layers, Link2, ClipboardList, Info } from 'lucide-react';
import { createPortal } from 'react-dom';
import { InfoHelp } from '../components/InfoHelp';
import { useAutoRefresh } from '../hooks/useAutoRefresh';
import { FALLBACK_ALLOCATIONS } from '../data/fallbackAllocations';
import { estimateMarketState } from '../utils/market';
import { PriceHistoryChart } from '../components/PriceHistoryChart';
import { cn } from '../utils';
import { computeSmartAutoParams, calculateDcfFairValue } from '../utils/fairValue';
import { translateSector } from '../utils/sectorTranslation';
import { useExchangeRates } from '../context/ExchangeRateContext';
import { getEuropeanTicker, type EuropeanIndicationQuote } from '../utils/europeanMarket';
import { Logo } from '../components/Logo';
import { AddToWatchlistModal } from '../components/AddToWatchlistModal'; // New Import
import { EditPositionModal } from '../components/EditPositionModal';

import { fetchStockHistory, fetchStockQuote, type TimeRange, type ChartDataPoint } from '../services/yahoo-finance';

function parseBuyDate(dateStr?: string | null): Date | null {
    if (!dateStr) return null;
    try {
        if (typeof dateStr === 'string' && dateStr.includes('.')) {
            const parts = dateStr.trim().split('.');
            if (parts.length === 3) {
                const d = parseInt(parts[0], 10);
                const m = parseInt(parts[1], 10);
                let y = parseInt(parts[2], 10);
                if (y < 100) y += 2000;
                const dt = new Date(y, m - 1, d);
                return isNaN(dt.getTime()) ? null : dt;
            }
        }
        const dt = new Date(dateStr);
        return isNaN(dt.getTime()) ? null : dt;
    } catch {
        return null;
    }
}

interface ExtendedHoursSource {
    marketState?: string | null;
    preMarketPrice?: number | null;
    preMarketChangePercent?: number | null;
    preMarketTime?: number | null;
    postMarketPrice?: number | null;
    postMarketChangePercent?: number | null;
    postMarketTime?: number | null;
}

function getExtendedHoursInfo(stock: ExtendedHoursSource | null | undefined) {
    if (!stock) return null;
    const st = stock.marketState;
    const isPre = st === 'PRE' || st === 'PREPRE';
    const isPost = st === 'POST' || st === 'POSTPOST' || st === 'CLOSED';
    const ext = isPre
        ? { isPre: true, label: 'Vorbörse', price: stock.preMarketPrice, pct: stock.preMarketChangePercent, time: stock.preMarketTime }
        : isPost
            ? { isPre: false, label: 'Nachbörse', price: stock.postMarketPrice, pct: stock.postMarketChangePercent, time: stock.postMarketTime }
            : null;
    if (!ext || !ext.price) return null;
    const timeText = ext.time ? (() => {
        const d = new Date(ext.time * 1000);
        const hm = d.toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit' });
        return d.toDateString() === new Date().toDateString()
            ? hm
            : `${d.toLocaleDateString('de-CH', { day: '2-digit', month: '2-digit' })} ${hm}`;
    })() : '';
    return { ...ext, timeText };
}

export function StockDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { stocks, positions, updateStock, updateStockPrice, addQuickLink, removeQuickLink, watchlists, updatePosition, deletePosition, orderBook } = usePortfolio();
    const { formatCurrency, convertToCHF } = useCurrencyFormatter();
    const { rates } = useExchangeRates();
    const [isWatchlistModalOpen, setIsWatchlistModalOpen] = useState(false); // Modal State
    const [isEditPositionModalOpen, setIsEditPositionModalOpen] = useState(false);

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

    const activeOrder = useMemo(() => {
        if (!stock) return null;
        return (orderBook || []).find(o => 
            o.status === 'open' && (
                o.stockId === stock.id || 
                (stock.symbol && o.stockSymbol?.toLowerCase() === stock.symbol.toLowerCase())
            )
        );
    }, [orderBook, stock]);

    const [notes, setNotes] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [timeRange, setTimeRange] = useState<TimeRange>('1D');
    const [chartData, setChartData] = useState<ChartDataPoint[] | null>(null);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
    const [quoteDate, setQuoteDate] = useState<Date | null>(null);
    const [minutesAgo, setMinutesAgo] = useState(0);
    const [fvModeTick, setFvModeTick] = useState(0);
    const [showKursInfo, setShowKursInfo] = useState(false);
    const [showPrePost, setShowPrePost] = useState<boolean>(() => {
        return localStorage.getItem('chart_show_prepost') !== 'false';
    });

    // European Indication Quote (Tradegate / Xetra early market)
    const [europeanQuote, setEuropeanQuote] = useState<EuropeanIndicationQuote | null>(null);

    const euTickerInfo = useMemo(() => {
        return stock ? getEuropeanTicker(stock.symbol, (stock as any).europeanSymbol) : null;
    }, [stock?.symbol, (stock as any)?.europeanSymbol]);

    useEffect(() => {
        if (!euTickerInfo?.symbol) {
            setEuropeanQuote(null);
            return;
        }
        let cancelled = false;
        const fetchEuQuote = async () => {
            try {
                const sym = euTickerInfo.symbol;
                const res = await fetch(`/api/yahoo-quote?symbol=${encodeURIComponent(sym)}&_=${Date.now()}`);
                if (!res.ok) return;
                const json = await res.json();
                const result = json.quoteResponse?.result?.[0];
                if (result && result.regularMarketPrice && !cancelled) {
                    const priceEUR = result.regularMarketPrice;
                    const prevCloseEUR = result.regularMarketPreviousClose || priceEUR;
                    const changeAmount = priceEUR - prevCloseEUR;
                    const changePercent = prevCloseEUR > 0 ? (changeAmount / prevCloseEUR) * 100 : (result.regularMarketChangePercent || 0);
                    const time = result.regularMarketTime;

                    const timeText = time ? (() => {
                        const d = new Date(time * 1000);
                        const hm = d.toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit' });
                        return d.toDateString() === new Date().toDateString()
                            ? hm
                            : `${d.toLocaleDateString('de-CH', { day: '2-digit', month: '2-digit' })} ${hm}`;
                    })() : undefined;

                    let impliedTargetPrice: number | undefined;
                    let impliedDeltaPercent: number | undefined;

                    const eurRate = rates['EUR'] || 1.06;
                    const targetRate = rates[stock?.currency || 'USD'] || 1.12;
                    if (eurRate > 0 && targetRate > 0) {
                        const eurToTarget = targetRate / eurRate;
                        impliedTargetPrice = priceEUR * eurToTarget;
                        if (stock && stock.currentPrice > 0) {
                            impliedDeltaPercent = ((impliedTargetPrice - stock.currentPrice) / stock.currentPrice) * 100;
                        }
                    }

                    setEuropeanQuote({
                        symbol: sym,
                        priceEUR,
                        previousCloseEUR: prevCloseEUR,
                        changePercent,
                        changeAmount,
                        time,
                        timeText,
                        impliedTargetPrice,
                        impliedTargetCurrency: stock?.currency || 'USD',
                        impliedDeltaPercent
                    });
                }
            } catch (e) {
                console.warn('[StockDetail] European quote fetch skipped:', e);
            }
        };
        fetchEuQuote();
        return () => { cancelled = true; };
    }, [euTickerInfo?.symbol, stock?.currency, stock?.currentPrice, rates]);

    useEffect(() => {
        localStorage.setItem('chart_show_prepost', String(showPrePost));
    }, [showPrePost]);

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

    // Navigation directly to edit section
    const navigateToEditSection = (section: 'stammdaten' | 'kursdaten' | 'termine') => {
        const from = searchParams.get('from') || 'dividends';
        const query = from ? `?from=${from}&section=${section}` : `?section=${section}`;
        const targetId = stockFromContext?.id || stock?.id || stock?.symbol || id;
        navigate(`/dividends/edit/${encodeURIComponent(String(targetId))}${query}`);
    };

    // Next Ex-Date and Payment Date calculation
    const upcomingDividendDates = useMemo(() => {
        if (!stock) return { exDate: '-', payDate: '-' };
        const now = new Date();
        now.setHours(0, 0, 0, 0);

        const pairs: { exDate?: string; payDate?: string }[] = [];
        if (stock.dividendDates && Array.isArray(stock.dividendDates)) {
            pairs.push(...stock.dividendDates);
        }
        if (stock.dividendExDate || stock.dividendPayDate) {
            pairs.push({ exDate: stock.dividendExDate, payDate: stock.dividendPayDate });
        }

        let nextPair: { exDate?: string; payDate?: string } | null = null;
        let minFutureDiff = Infinity;

        for (const p of pairs) {
            const exTime = p.exDate ? new Date(p.exDate).getTime() : NaN;
            const payTime = p.payDate ? new Date(p.payDate).getTime() : NaN;
            const targetTime = !isNaN(exTime) ? exTime : payTime;

            if (!isNaN(targetTime)) {
                const diff = targetTime - now.getTime();
                if (diff >= 0 && diff < minFutureDiff) {
                    minFutureDiff = diff;
                    nextPair = p;
                }
            }
        }

        if (!nextPair && pairs.length > 0) {
            nextPair = pairs.filter(p => p.exDate || p.payDate).pop() || null;
        }

        const fmt = (d?: string) => {
            if (!d) return '-';
            try {
                const parts = d.split('-');
                if (parts.length === 3) {
                    return `${parts[2]}.${parts[1]}.${parts[0]}`;
                }
                return new Date(d).toLocaleDateString('de-CH');
            } catch {
                return d;
            }
        };

        return {
            exDate: fmt(nextPair?.exDate),
            payDate: fmt(nextPair?.payDate)
        };
    }, [stock]);

    // Get position to determine buy date
    const position = positions.find(p => p.stockId === stock?.id);

    // Position buy date ref
    const buyDateRef = (() => {
        if (position?.purchases && position.purchases.length > 0) {
            const sorted = [...position.purchases].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
            return sorted[0].date;
        }
        return position?.buyDate;
    })();

    const handleUpdatePosition = (posId: string, newShares: number, newAvgPrice?: number, newBuyDate?: string, newFxRate?: number, newPurchases?: any[], newBroker?: string) => {
        const updates: any = { shares: newShares };
        if (newAvgPrice !== undefined) updates.buyPriceAvg = newAvgPrice;
        if (newBuyDate !== undefined) updates.buyDate = newBuyDate;
        if (newFxRate !== undefined) updates.averageEntryFxRate = newFxRate;
        if (newPurchases !== undefined) updates.purchases = newPurchases;
        if (newBroker !== undefined) updates.broker = newBroker;
        updatePosition(posId, updates);
    };

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

        // Handle 'BUY' range (Seit Kauf)
        if (timeRange === 'BUY') {
            const buyDate = parseBuyDate(buyDateRef);
            if (buyDate) {
                buyDate.setHours(0, 0, 0, 0);
                const now = new Date();
                const elapsedMs = Math.max(0, now.getTime() - buyDate.getTime());
                const elapsedDays = elapsedMs / (1000 * 60 * 60 * 24);

                let bufferDays = 28;
                if (elapsedDays < 14) {
                    bufferDays = 28;
                } else if (elapsedDays <= 180) {
                    bufferDays = Math.max(21, Math.round(elapsedDays * 0.4));
                } else {
                    bufferDays = Math.min(90, Math.max(45, Math.round(elapsedDays * 0.15)));
                }

                const bufferDate = new Date(buyDate);
                bufferDate.setDate(bufferDate.getDate() - bufferDays);

                const oneYearAgo = new Date();
                oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
                const threeYearsAgo = new Date();
                threeYearsAgo.setFullYear(threeYearsAgo.getFullYear() - 3);

                if (bufferDate > oneYearAgo) {
                    rangeToUse = '1Y'; // Daily data
                } else if (bufferDate > threeYearsAgo) {
                    rangeToUse = '3Y'; // Daily data (3 years)
                } else {
                    rangeToUse = '5Y'; // Weekly data
                }
            } else {
                rangeToUse = '5Y'; // Default fallback
            }
        }

        let response = await fetchStockHistory(
            symbol,
            rangeToUse,
            undefined,
            rangeToUse === '1D' ? { includePrePost: showPrePost } : undefined
        );

        // FALLBACK: If 1D data is empty (common for EU stocks), try 1W
        if ((!response.data || response.data.length === 0) && rangeToUse === '1D') {
            console.warn('[StockDetail] 1D data empty, trying fallback to 1W for', symbol);
            response = await fetchStockHistory(symbol, '1W');
        }

        // Filter for 'BUY' range (Seit Kauf)
        // Include context buffer before buy date so buy date is well visible and not cut off
        if (timeRange === 'BUY' && buyDateRef && response.data && response.data.length > 0) {
            try {
                const buyDate = parseBuyDate(buyDateRef);
                if (buyDate) {
                    buyDate.setHours(0, 0, 0, 0);
                    const now = new Date();
                    const elapsedMs = Math.max(0, now.getTime() - buyDate.getTime());
                    const elapsedDays = elapsedMs / (1000 * 60 * 60 * 24);

                    let bufferDays = 28;
                    if (elapsedDays < 14) {
                        bufferDays = 28;
                    } else if (elapsedDays <= 180) {
                        bufferDays = Math.max(21, Math.round(elapsedDays * 0.4));
                    } else {
                        bufferDays = Math.min(90, Math.max(45, Math.round(elapsedDays * 0.15)));
                    }

                    const bufferDate = new Date(buyDate);
                    bufferDate.setDate(bufferDate.getDate() - bufferDays);

                    const filteredData = response.data.filter(point => {
                        const pointDate = new Date(point.date);
                        return pointDate >= bufferDate;
                    });

                    if (filteredData.length > 0) {
                        console.log(`[StockDetail] Filtering BUY range with ${bufferDays}d buffer: ${filteredData.length} points from ${bufferDate.toISOString()}`);
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

            // Sync regular market price & Open & PreviousClose from 1D Chart (never overwrite with Pre/Post price)
            if (rangeToUse === '1D' && response.data && response.data.length > 0) {
                const lastRegularPoint = [...response.data].reverse().find(p => p.session === 'regular')
                    || (!showPrePost ? response.data[response.data.length - 1] : undefined);
                const regPrice = response.regularMarketPrice ?? lastRegularPoint?.value;
                const regDateStr = (response.regularMarketTime || (lastRegularPoint ? new Date(lastRegularPoint.date) : undefined))?.toISOString();
                if (regPrice && regPrice > 0) {
                    if (stockFromContext) {
                        updateStockPrice(currentStock.id, regPrice, undefined, regDateStr, true);
                    } else if (!currentStock.currentPrice || Math.abs(currentStock.currentPrice - regPrice) > 0.001) {
                        setVirtualStock((prev: any) => ({ ...prev, currentPrice: regPrice, ...(regDateStr ? { lastQuoteDate: regDateStr } : {}) }));
                    }
                }

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

                // Pre-Market / After-Hours Indikation (immer synchronisieren, auch zum Zuruecksetzen)
                const extKeys = ['marketState', 'preMarketPrice', 'preMarketChangePercent', 'postMarketPrice', 'postMarketChangePercent', 'preMarketTime', 'postMarketTime'] as const;
                for (const key of extKeys) {
                    const nv = (quoteResponse as any)[key] ?? undefined;
                    if (nv !== ((currentStock as any)[key] ?? undefined)) {
                        updates[key] = nv;
                        hasUpdates = true;
                    }
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
    }, [timeRange, id, position?.buyDate, showPrePost]); // STABLE: only depend on id string, not stock object

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

    // Keep regular session close/price synced safely when regular-only chartData updates
    useEffect(() => {
        if (timeRange === '1D' && !showPrePost && chartData && chartData.length > 0 && stock) {
            const lastRegularPoint = [...chartData].reverse().find(p => !p.session || p.session === 'regular');
            if (lastRegularPoint && lastRegularPoint.value) {
                if (stockFromContext) {
                    updateStockPrice(stock.id, lastRegularPoint.value, undefined, lastRegularPoint.date, true);
                } else if (!virtualStock?.currentPrice || Math.abs(virtualStock.currentPrice - lastRegularPoint.value) > 0.001) {
                    setVirtualStock((prev: any) => ({ ...prev, currentPrice: lastRegularPoint.value }));
                }
            }
        }
    }, [chartData, timeRange, showPrePost, id, !!stockFromContext]); // STABLE: only depend on id and flag

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

    return (
        <div className="stock-detail-page p-2 md:p-8 space-y-4 md:space-y-8 duration-500 pb-16 landscape:pb-10">
            {/* Sticky Header on Desktop and Mobile */}
            <div className="stock-detail-sticky-header sticky top-0 -mx-2 lg:-mx-8 px-3 py-2 lg:px-8 lg:py-3.5 z-50 bg-background border-b border-border shadow-md transition-all -mt-2 lg:-mt-8 mb-3 md:mb-6">
                <div className="stock-detail-top-actions flex items-center justify-between gap-2 mb-3.5 md:mb-4 landscape:mb-1 pl-12 xl:pl-0">
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => {
                                const from = searchParams.get('from');
                                if (from === 'orderbook') {
                                    navigate('/calculator?orderbook=true');
                                } else if (from === 'watchlist') {
                                    navigate('/watchlist');
                                } else if (from === 'portfolio') {
                                    navigate('/portfolio');
                                } else if (from === 'market-overview') {
                                    const tab = searchParams.get('tab') || sessionStorage.getItem('portfolio_market_overview_tab');
                                    navigate(tab && tab !== 'all' ? `/market-overview?tab=${encodeURIComponent(tab)}` : '/market-overview');
                                } else {
                                    navigate('/');
                                }
                            }}
                            className="flex items-center justify-center gap-1.5 bg-white dark:bg-card text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/30 transition-all font-semibold rounded-lg shadow-sm border border-blue-200 dark:border-blue-800/60 py-1 px-2.5 text-xs group active:scale-95"
                            title={
                                searchParams.get('from') === 'orderbook'
                                    ? "Zurück zum Auftragsbuch"
                                    : searchParams.get('from') === 'market-overview'
                                        ? "Zurück zur Marktübersicht"
                                        : searchParams.get('from') === 'portfolio'
                                            ? "Zurück zu Positionen"
                                            : searchParams.get('from') === 'watchlist'
                                                ? "Zurück zur Watchlist"
                                                : "Zurück zur Übersicht"
                            }
                        >
                            {searchParams.get('from') === 'orderbook' ? (
                                <ClipboardList className="size-3.5 text-blue-600 dark:text-blue-400" />
                            ) : (
                                <ArrowLeft className="size-3.5 transition-transform group-hover:-translate-x-0.5" />
                            )}
                            <span>
                                {searchParams.get('from') === 'orderbook'
                                    ? (activeOrder
                                        ? `Auftragsbuch: ${activeOrder.mode === 'buy' ? 'Kauf' : 'Verkauf'} ${activeOrder.shares} Stk. à ${activeOrder.limitPrice.toFixed(2)} ${activeOrder.currency}`
                                        : 'Auftragsbuch')
                                    : searchParams.get('from') === 'market-overview'
                                        ? 'Marktübersicht'
                                        : searchParams.get('from') === 'portfolio'
                                            ? 'Positionen'
                                            : searchParams.get('from') === 'watchlist'
                                                ? 'Watchlist'
                                                : 'Übersicht'}
                            </span>
                        </button>

                        {/* Direct Auftragsbuch Button if active order exists and not coming from orderbook */}
                        {activeOrder && searchParams.get('from') !== 'orderbook' && (
                            <button
                                onClick={() => navigate('/calculator?orderbook=true')}
                                className="flex items-center justify-center gap-1.5 bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 transition-all font-semibold rounded-lg shadow-sm border border-amber-500/30 py-1 px-2.5 text-xs group active:scale-95 whitespace-nowrap"
                                title="Zum Auftragsbuch wechseln"
                            >
                                <ClipboardList className="size-3.5 text-amber-500" />
                                <span>Auftrag: {activeOrder.mode === 'buy' ? 'Kauf' : 'Verkauf'} {activeOrder.shares} Stk. à {activeOrder.limitPrice.toFixed(2)} {activeOrder.currency}</span>
                            </button>
                        )}

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

                    {/* Aktualisierung Button oben rechts außerhalb des Chart-Headers */}
                    <button
                        onClick={loadData}
                        disabled={isRefreshing}
                        className={cn(
                            "inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border text-xs font-semibold transition-all shadow-sm",
                            "bg-blue-600 text-white border-blue-700 hover:bg-blue-700 hover:border-blue-800",
                            "active:scale-95 shrink-0",
                            isRefreshing && "opacity-50 cursor-not-allowed"
                        )}
                        title="Kursdaten aktualisieren"
                    >
                        <RefreshCw className={cn("size-3.5", isRefreshing && "animate-spin")} />
                        <span className="whitespace-nowrap">
                            {isRefreshing ? 'Laden...' : lastUpdate ? `${minutesAgo} Min` : 'Laden'}
                        </span>
                    </button>
                </div>

                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 md:gap-4 md:pl-12 xl:pl-0">
                    {/* Left: Stock Info */}
                    <div className="flex items-center gap-2.5 md:gap-4 min-w-0 md:flex-1">
                        <div
                            className={cn(
                                "stock-detail-logo-wrap bg-card rounded-xl shrink-0 flex items-center justify-center",
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
                                <h1 className="text-base md:text-2xl landscape:text-sm font-bold tracking-tight text-foreground leading-snug">
                                    <StockName name={stock.name} />
                                </h1>
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

                    {/* Center: Prominenter Kurs (Mittig) + Performance darunter (Mittig) */}
                    <div className="flex flex-col items-center justify-center text-center py-1 sm:py-0 px-2 sm:px-4 md:flex-1 shrink-0">
                        {(() => {
                            const position = positions.find(p => p.stockId === stock.id);

                            let referencePrice = stock.previousClose;
                            if (timeRange === 'BUY' && position?.buyPriceAvg && position.buyPriceAvg > 0) {
                                referencePrice = position.buyPriceAvg;
                            } else if (timeRange !== '1D' && chartData && chartData.length > 0) {
                                referencePrice = chartData[0].value;
                            } else if (timeRange === '1D') {
                                referencePrice = stock.previousClose || (chartData && chartData.length > 0 ? chartData[0].value : stock.currentPrice);
                            } else if (chartData && chartData.length > 0) {
                                referencePrice = chartData[0].value;
                            }

                            // Determine if we have performance data
                            const hasPerf = (timeRange === '1D' && referencePrice && referencePrice > 0) ||
                                            (timeRange === 'BUY' && position?.buyPriceAvg && position.buyPriceAvg > 0) ||
                                            (chartData && chartData.length > 0 && referencePrice && referencePrice > 0);

                            const diffPerShare = (hasPerf && referencePrice) ? (stock.currentPrice - referencePrice) : 0;
                            const percentChange = (hasPerf && referencePrice && referencePrice > 0) ? (diffPerShare / referencePrice) * 100 : 0;

                            const isBuyView = timeRange === 'BUY' && position && position.shares > 0;

                            let origDiffStr = '';
                            let isPositive = diffPerShare >= 0;

                            if (hasPerf) {
                                if (isBuyView) {
                                    // Seit Kauf: Calculated strictly on total portfolio holding (matches Positionen table)
                                    const totalDiff = diffPerShare * position.shares;
                                    isPositive = totalDiff >= 0;
                                    origDiffStr = (totalDiff > 0 ? '+' : '') + formatCurrency(totalDiff, stock.currency, false);
                                } else {
                                    // Standard timeframes (1D, 1W, 1M, 3M, 6M, 1Y, 5Y):
                                    // Per-share price performance of the stock (NOT multiplied by shares, native currency only)
                                    isPositive = diffPerShare >= 0;
                                    origDiffStr = (diffPerShare > 0 ? '+' : '') + formatCurrency(diffPerShare, stock.currency, false);
                                }
                            }

                            const isStockMarketOpen = estimateMarketState(stock.symbol, stock.currency) === 'REGULAR';
                            const quoteTimestamp = stock.lastQuoteDate ? new Date(stock.lastQuoteDate).getTime() : 0;
                            const effectiveStockDate = (!isStockMarketOpen && quoteTimestamp > 0) ? new Date(quoteTimestamp) : new Date();
                            const stockDateStr = effectiveStockDate.toLocaleDateString('de-CH', { day: '2-digit', month: '2-digit', year: '2-digit' });

                            const rangeFormatted = timeRange === '1Y' ? '1J' : timeRange === '3Y' ? '3J' : timeRange === '5Y' ? '5J' : timeRange;
                            const perfLabel = timeRange === 'BUY'
                                ? 'Performance Seit Kauf'
                                : timeRange === '1D'
                                    ? 'Tages Performance'
                                    : `Performance ${rangeFormatted}`;

                            return (
                                <div className="flex flex-col items-center justify-center text-center max-w-full">
                                    {/* Row 1: Stock Price (Centered) + Date (Anchored to right of price, outside center flow) */}
                                    <div className="relative inline-flex items-baseline justify-center">
                                        <span className="stock-detail-price-main text-xl sm:text-2xl lg:text-3xl xl:text-4xl font-black tracking-tight tabular-nums text-foreground whitespace-nowrap drop-shadow-sm">
                                            {formatCurrency(stock.currentPrice, stock.currency, false)}
                                        </span>
                                        <span className="absolute left-full ml-2 sm:ml-3 bottom-0.5 sm:bottom-1 text-xs sm:text-sm font-semibold text-muted-foreground tabular-nums whitespace-nowrap">
                                            {stockDateStr}
                                        </span>
                                    </div>

                                    {/* Row 2: Performance Label (Centered directly under price) */}
                                    {hasPerf && (
                                        <div className="stock-detail-perf-meta text-[11px] sm:text-xs text-muted-foreground font-medium mt-1 sm:mt-1.5 whitespace-nowrap text-center">
                                            {perfLabel}
                                        </div>
                                    )}

                                    {/* Row 3: Performance Numbers (Centered directly under label) */}
                                    {hasPerf && (
                                        <div className={cn(
                                            "stock-detail-perf-values text-sm sm:text-base lg:text-lg font-bold flex items-baseline justify-center gap-3 sm:gap-4 tabular-nums whitespace-nowrap mt-0.5",
                                            isPositive ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
                                        )}>
                                            <span>{isPositive ? '+' : ''}{percentChange.toFixed(2)}%</span>
                                            <span>{origDiffStr}</span>
                                        </div>
                                    )}

                                    {/* Row 4: Extended Hours (Pre-Market / After-Hours) */}
                                    {(() => {
                                        const ext = getExtendedHoursInfo(stock);
                                        if (!ext) return null;
                                        const pct = ext.pct ?? 0;
                                        return (
                                            <div className={cn(
                                                "mt-1.5 inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full border text-xs font-semibold tabular-nums whitespace-nowrap",
                                                ext.isPre
                                                    ? "bg-amber-500/15 border-amber-500/35"
                                                    : "bg-indigo-500/10 border-indigo-500/30"
                                            )}>
                                                <span className={ext.isPre ? "text-amber-600 dark:text-amber-400" : "text-indigo-500 dark:text-indigo-400"}>
                                                    {ext.label}{ext.timeText ? ` · ${ext.timeText}` : ''}
                                                </span>
                                                <span className="font-bold text-foreground">
                                                    {formatCurrency(ext.price!, stock.currency, false)}
                                                </span>
                                                {ext.pct !== null && ext.pct !== undefined && (
                                                    <span className={cn("font-bold", pct >= 0 ? "text-green-500" : "text-red-500")}>
                                                        {pct >= 0 ? '+' : ''}{pct.toFixed(2)}%
                                                    </span>
                                                )}
                                            </div>
                                        );
                                    })()}

                                    {/* Row 5: European Pre-Trading Indication (Tradegate / Xetra in EUR) */}
                                    {europeanQuote && (
                                        <div className="mt-1.5 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border border-blue-500/35 bg-blue-500/10 text-xs font-semibold tabular-nums whitespace-nowrap">
                                            <span className="text-blue-600 dark:text-blue-400 font-bold flex items-center gap-1">
                                                <span>🇪🇺 Europa / Tradegate</span>
                                                {europeanQuote.timeText && <span className="opacity-80 font-normal">· {europeanQuote.timeText}</span>}
                                            </span>
                                            <span className="font-bold text-foreground">
                                                {europeanQuote.priceEUR.toLocaleString('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} EUR
                                            </span>
                                            {europeanQuote.impliedTargetPrice && (
                                                <span className="text-muted-foreground text-[11px]">
                                                    ≈ {formatCurrency(europeanQuote.impliedTargetPrice, stock.currency, false)}
                                                </span>
                                            )}
                                            {europeanQuote.impliedDeltaPercent !== undefined && (
                                                <span className={cn("font-bold", europeanQuote.impliedDeltaPercent >= 0 ? "text-green-500" : "text-red-500")}>
                                                    {europeanQuote.impliedDeltaPercent >= 0 ? '+' : ''}{europeanQuote.impliedDeltaPercent.toFixed(2)}%
                                                </span>
                                            )}
                                            <InfoHelp
                                                title="Europa-Frühstart • Tradegate & Xetra"
                                                items={[
                                                    {
                                                        term: "Warum vorne Euro und hinten Dollar?",
                                                        text: "Tradegate ist eine deutsche Börse, dort wird in Euro bezahlt (z. B. 31.02 EUR). Um den Kurs direkt mit deiner Aktie zu vergleichen, rechnet die App den Betrag über den aktuellen Wechselkurs automatisch in Dollar um (≈ 34.23 USD)."
                                                    },
                                                    {
                                                        term: "Was zeigt die Prozentzahl?",
                                                        text: "Sie zeigt dir auf einen Blick, ob die Aktie in Europa gerade höher (grün) oder tiefer (rot) gehandelt wird als zum letzten offiziellen New Yorker Schlusskurs."
                                                    },
                                                    {
                                                        term: "Dein Vorteil (7,5 Stunden Frühwarnsystem)",
                                                        text: "Deutsche Börsen handeln US-Aktien montags bereits ab 08:00 Uhr morgens – die Wall Street in New York öffnet erst um 15:30 Uhr. Wenn am Wochenende wichtige Neuigkeiten zu einer Firma bekannt werden, siehst du hier schon morgens beim Kaffee, wie die Anleger reagieren und wohin die Reise geht – volle 7,5 Stunden bevor die US-Börsen überhaupt aufwachen."
                                                    }
                                                ]}
                                            />
                                        </div>
                                    )}
                                </div>
                            );
                        })()}
                    </div>

                    {/* Right spacer on desktop to keep center perfectly centered */}
                    <div className="hidden md:flex md:flex-1 justify-end items-center" />
                </div>
            </div>

            {/* Price Chart (Kursverlauf) - Über ganze Breite */}
            <div className="stock-detail-chart-card bg-card border border-border rounded-xl pl-1 pr-1 py-4 md:py-6 landscape:py-1.5 shadow-sm min-h-[360px] landscape:min-h-0 h-auto flex flex-col w-full mb-6 overflow-hidden isolate relative z-0">
                <div className="flex items-center justify-between gap-2 mb-2 md:mb-4 landscape:mb-1.5 shrink-0 px-2 md:px-4">
                    {/* Left: Title */}
                    <div className="flex items-center gap-2">
                        <TrendingUp className="size-5 text-blue-500 shrink-0" />
                        <h3 className="font-bold text-lg whitespace-nowrap"><span className="md:hidden">Kurs</span><span className="hidden md:inline">Kursverlauf</span></h3>
                        <InfoHelp title="Kursverlauf" items={[{ term: "Zeiträume (1D bis 5J)", text: "Wählt die Zeitspanne des Charts. 1D ist der heutige Handelstag, 1W eine Woche, 1M ein Monat, 3M und 6M drei und sechs Monate, 1J, 3J und 5J ein, drei und fünf Jahre." }, { term: "Seit Kauf", text: "Zeigt den Verlauf ab etwa deinem Kaufdatum (mit kurzem Vorlauf). Erscheint nur, wenn du die Aktie besitzt." }, { term: "Performance", text: "Veränderung im gewählten Zeitraum in Prozent und als Betrag. Bei 1D wird gegen den Schlusskurs des Vortages gerechnet." }, { term: "H und T", text: "Höchster (H) und tiefster (T) Kurs im gewählten Zeitraum." }, { term: "CHF", text: "Rechnet die Kurse in Schweizer Franken um. Der Schalter erscheint nur bei Aktien in Fremdwährung." }, { term: "Messen", text: "Messmodus: Klicke zwei Punkte im Chart an oder wähle Hoch (H) oder Tief (T). Die App zeigt dann die Veränderung dazwischen. Mit dem Pfeil kannst du Start und Ziel vertauschen." }, { term: "Hinweis zur Datenaktualität", text: "Das Schild oben rechts im Chart zeigt, wie aktuell die Daten sind: Live-Kurs, Verzögerte Daten (die Börse liefert den Kurs mit Verspätung) oder Schlusskurs mit Datum und Uhrzeit, wenn die Börse geschlossen ist." }]} />
                    </div>

                    {/* Right: Action Buttons (Performance Details & Position bearbeiten) */}
                    {position && (
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => navigate('/?openPerformance=true')}
                                className="flex items-center justify-center gap-1 bg-white text-blue-600 hover:bg-blue-50 transition-all font-semibold rounded-lg shadow-sm border border-blue-200 py-1 px-2.5 text-xs group active:scale-95 whitespace-nowrap"
                                title="Performance Details aller Positionen öffnen"
                            >
                                <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
                                <span>Performance Details</span>
                            </button>
                            <button
                                onClick={() => setIsEditPositionModalOpen(true)}
                                className="flex items-center justify-center gap-1 bg-white text-blue-600 hover:bg-blue-50 transition-all font-semibold rounded-lg shadow-sm border border-blue-200 py-1 px-2.5 text-xs group active:scale-95 whitespace-nowrap"
                                title="Position bearbeiten (Käufe, Stückzahl, Kaufpreise)"
                            >
                                <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
                                <span>Position</span>
                            </button>
                        </div>
                    )}
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
                        showPrePost={showPrePost}
                        onTogglePrePost={() => setShowPrePost(prev => !prev)}
                        isRealtime={true}
                        quoteDate={quoteDate}
                        previousClose={safePreviousClose || 0}
                        isMarketOpen={estimateMarketState(stock.symbol, stock.currency) === 'REGULAR'}
                        purchasePrice={position?.buyPriceAvg}
                        purchaseDate={buyDateRef}
                        purchases={position?.purchases}
                        sellLimit={stock.sellLimit}
                        stockName={stock.name}
                        stockSymbol={stock.symbol}
                    />
                </div>
            </div>

            {/* Kursdaten, Stammdaten, Quick Links & Notizen - Harmonisches 2-Spalten-Layout mit nachrückenden Feldern */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 landscape:gap-3 items-start iphone-landscape-section">
                {/* Linke Spalte: Kursdaten & nachrückendes Quick-Links-Feld (kein Loch darunter!) */}
                <div className="contents md:flex md:flex-col md:gap-4 md:gap-6 landscape:gap-3">
                    <div className="order-1 md:order-none">
                        {/* Kursdaten */}
                        <div
                    onClick={() => {
                        const from = searchParams.get('from') || 'dividends';
                        const query = from ? `?from=${from}` : '';
                        const targetId = stockFromContext?.id || stock?.id || stock?.symbol || id;
                        navigate(`/dividends/edit/${encodeURIComponent(String(targetId))}${query}`);
                    }}
                    className="bg-card border border-border hover:border-primary/50 rounded-xl p-4 md:p-6 landscape:p-3 landscape:py-2.5 shadow-sm cursor-pointer transition-colors group flex flex-col justify-start overflow-hidden"
                    title="Daten bearbeiten"
                >
                    <div className="flex items-center justify-between gap-2 mb-2 md:mb-4 landscape:mb-1">
                        <div className="flex items-center gap-1.5 md:gap-2 group-hover:text-primary transition-colors">
                            <Activity className="size-4 md:size-5 text-blue-500 shrink-0" />
                            <h3 className="font-bold text-base md:text-lg landscape:text-xs">Kursdaten</h3>
                            <Pencil className="size-3 md:size-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
                            <button
                                type="button"
                                onClick={(ev) => { ev.stopPropagation(); setShowKursInfo(true); }}
                                className="p-0.5 rounded-full text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                                title="Erklärung zu den Kursdaten"
                                aria-label="Erklärung zu den Kursdaten"
                            >
                                <Info className="size-4 md:size-[18px]" />
                            </button>
                            {showKursInfo && createPortal(
                                <div
                                    className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4"
                                    onClick={(ev) => { ev.stopPropagation(); setShowKursInfo(false); }}
                                >
                                    <div
                                        className="bg-card text-foreground border border-border rounded-xl shadow-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto p-5 cursor-default"
                                        onClick={(ev) => ev.stopPropagation()}
                                    >
                                        <div className="flex items-center justify-between mb-3">
                                            <h4 className="font-bold text-lg flex items-center gap-2"><Info className="size-5 text-blue-500" /> Erklärung: Kursdaten</h4>
                                            <button type="button" onClick={() => setShowKursInfo(false)} className="px-2.5 py-1 rounded-lg text-sm font-semibold bg-muted hover:bg-muted/70">Schliessen</button>
                                        </div>
                                        <dl className="space-y-2.5 text-sm">
                                            {[
                                                ['Bestand', 'Anzahl Aktien, die du aktuell besitzt.'],
                                                ['Kaufpreis Ø', 'Durchschnittlicher Einstandskurs über alle Käufe (inkl. Nachkäufe).'],
                                                ['Gewinn/Verlust', 'Aktueller Kurs gegenüber Kaufpreis Ø, in Prozent und als Betrag. Noch nicht realisiert, also nur auf dem Papier.'],
                                                ['Aktueller Kurs', 'Letzter Kurs der Börse. Ausserhalb der Handelszeit ist das der Schlusskurs.'],
                                                ['Eröffnung / Vortag', 'Erster Kurs des heutigen Handelstages / Schlusskurs des Vortages. Die Tagesperformance rechnet gegen den Vortag.'],
                                                ['Pre-Market', 'Handel vor der Börseneröffnung (nur US-Aktien). Der Kurs ist nur eine Indikation und kann sich bis zur Eröffnung stark ändern.'],
                                                ['After-Hours', 'Handel nach Börsenschluss (nur US-Aktien). Gibt einen Hinweis, wie die Eröffnung am nächsten Tag ausfallen könnte. Die Uhrzeit hinter dem Namen zeigt, wann der Kurs zuletzt gehandelt wurde.'],
                                                ['Kauflimit', 'Preis, bis zu dem du kaufen oder nachkaufen willst. Das Etikett zeigt die Herkunft: Sicherheit (A), Qualität (B), Risiko-Abschlag (C), Fairer Wert oder Manuell.'],
                                                ['Verkaufslimit', 'Preis, ab dem du verkaufen willst.'],
                                                ['Kaufpreis (A / B / C)', 'Aus dem Fairen-Wert-Rechner berechneter Kaufpreis (Fairer Wert minus Sicherheitsmarge). Ein Klick auf die Beschriftung wechselt zwischen Sicherheit (A), Qualität (B) und Risiko-Abschlag (C).'],
                                                ['Fairer Wert', 'Innerer Wert der Aktie heute laut deinen Parametern im Fairen-Wert-Rechner (Zielrendite und Dividenden).'],
                                                ['Zielkurs (5J)', 'Erwarteter Kurs in 5 Jahren laut deinen Parametern im Fairen-Wert-Rechner (Wachstum und Verkaufs-KGV).'],
                                                ['Gewinn 5J (Bestand)', 'Erwarteter Gewinn deines aktuellen Bestands bis zum Zielkurs. Darunter steht die Rendite pro Jahr ab heute.'],
                                            ].map(([t, d]) => (
                                                <div key={t}>
                                                    <dt className="font-semibold text-foreground">{t}</dt>
                                                    <dd className="text-muted-foreground">{d}</dd>
                                                </div>
                                            ))}
                                        </dl>
                                        <div className="mt-4 pt-3 border-t border-border text-sm">
                                            <div className="font-semibold mb-1">US-Handelszeiten in deiner Zeit (MEZ)</div>
                                            <table className="w-full text-sm">
                                                <thead><tr className="text-muted-foreground text-left"><th className="py-0.5 font-medium">Phase</th><th className="py-0.5 font-medium">US-Zeit (ET)</th><th className="py-0.5 font-medium">Deine Zeit</th></tr></thead>
                                                <tbody>
                                                    <tr><td className="py-0.5">Pre-Market</td><td>04:00 – 09:30</td><td>10:00 – 15:30</td></tr>
                                                    <tr><td className="py-0.5">Regulärer Handel</td><td>09:30 – 16:00</td><td>15:30 – 22:00</td></tr>
                                                    <tr><td className="py-0.5">After-Hours</td><td>16:00 – 20:00</td><td>22:00 – 02:00</td></tr>
                                                </tbody>
                                            </table>
                                            <p className="text-muted-foreground mt-2">In den Wochen, in denen USA und Europa nicht am selben Tag auf Sommer- oder Winterzeit umstellen, verschiebt sich der Unterschied um eine Stunde. Für Aktien aus der Schweiz, Deutschland oder Grossbritannien gibt es keine Pre-Market- und After-Hours-Werte.</p>
                                        </div>
                                    </div>
                                </div>,
                                document.body
                            )}
                        </div>
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/calculator?stock=${encodeURIComponent(String(stock.id))}`);
                            }}
                            className="flex items-center gap-1 text-xs landscape:text-[10px] font-semibold px-2.5 py-1 landscape:py-0.5 landscape:px-1.5 rounded-lg bg-blue-500/15 hover:bg-blue-500/25 text-blue-700 dark:text-blue-300 border border-blue-500/30 transition-colors shadow-sm"
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

                        return (
                            <>
                                <div className="flex justify-between py-1 md:py-1.5 landscape:py-0.5 border-b border-border/50 text-xs sm:text-sm landscape:text-[11px]">
                                    <span className="text-muted-foreground">Bestand</span>
                                    <div className="text-right flex items-center">
                                        <span className="font-semibold text-foreground tabular-nums">
                                            {pos.shares.toLocaleString('de-CH')} Stk.
                                        </span>
                                    </div>
                                </div>
                                <div className="flex justify-between py-1 md:py-1.5 landscape:py-0.5 border-b border-border/50 text-xs sm:text-sm landscape:text-[11px]">
                                    <span className="text-muted-foreground">Kaufpreis Ø</span>
                                    <div className="text-right flex items-center">
                                        <span className="font-medium tabular-nums">
                                            {formatCurrency(pos.buyPriceAvg, stock.currency, false)}
                                        </span>
                                    </div>
                                </div>
                                <div className="flex justify-between py-1 md:py-1.5 landscape:py-0.5 border-b border-border/50 text-xs sm:text-sm landscape:text-[11px]">
                                    <span className="text-muted-foreground">Gewinn/Verlust</span>
                                    <div className="text-right flex items-center gap-2">
                                        <span className={cn(
                                            "font-bold tabular-nums",
                                            isPositiveNative ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
                                        )}>
                                            {isPositiveNative ? '+' : ''}{percentChangeNative.toFixed(2)}%
                                        </span>
                                        <span className={cn(
                                            "font-medium tabular-nums",
                                            isPositiveNative ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
                                        )}>
                                            {isPositiveNative ? '+' : ''}{formatCurrency(totalDiffNative, stock.currency, false)}
                                        </span>
                                    </div>
                                </div>
                                <div 
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setIsEditPositionModalOpen(true);
                                        setTimeout(() => {
                                            const el = document.getElementById('position-broker-input');
                                            if (el) {
                                                el.focus();
                                                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                            }
                                        }, 120);
                                    }}
                                    className="flex justify-between items-center py-1 md:py-1.5 landscape:py-0.5 border-b border-border/50 text-xs sm:text-sm landscape:text-[11px] gap-2 cursor-pointer hover:bg-muted/40 px-1 -mx-1 rounded transition-colors group"
                                    title="Bank / Broker bearbeiten (Klicken zum Ändern)"
                                >
                                    <span className="text-muted-foreground flex items-center gap-1.5 shrink-0 group-hover:text-primary transition-colors">
                                        <Landmark className="size-3.5 text-primary shrink-0" />
                                        Bank / Broker
                                    </span>
                                    <span className="font-medium text-foreground text-right truncate max-w-[200px] sm:max-w-[280px] flex items-center gap-1.5" title={pos.broker || 'Klicken zum Festlegen'}>
                                        <span className="group-hover:text-primary transition-colors underline decoration-dotted decoration-muted-foreground/60 underline-offset-2">{pos.broker || '-'}</span>
                                        <Edit className="size-3 text-muted-foreground/60 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                                    </span>
                                </div>
                            </>
                        );
                    })()}

                    {/* Trenner 1: Zwischen Mein Depot und Börsenkursen */}
                    <div className="my-2.5 h-px bg-border" />

                    {/* Eröffnung und Vortag vor Aktuellem Kurs */}
                    <div className="flex justify-between py-1 md:py-1.5 landscape:py-0.5 border-b border-border/50 text-xs sm:text-sm landscape:text-[11px]">
                        <span className="text-muted-foreground">Eröffnung / Vortag</span>
                        <span className="font-medium tabular-nums text-right">
                            {stock.open ? formatCurrency(stock.open, stock.currency, false) : '-'} / {formatCurrency(safePreviousClose || 0, stock.currency, false)}
                        </span>
                    </div>

                    <div className="flex justify-between py-1 md:py-1.5 landscape:py-0.5 border-b border-border/50 text-xs sm:text-sm landscape:text-[11px]">
                        <span className="text-muted-foreground">Aktueller Kurs</span>
                        <span className="font-medium tabular-nums text-right">
                            <span>{formatCurrency(stock.currentPrice, stock.currency, false)}</span>
                            {safePreviousClose && safePreviousClose > 0 && stock.currentPrice > 0 && (() => {
                                const diff = stock.currentPrice - safePreviousClose;
                                const pct = (diff / safePreviousClose) * 100;
                                return (
                                    <span className={cn("ml-2 font-bold", diff >= 0 ? "text-green-500" : "text-red-500")}>
                                        {diff >= 0 ? '+' : ''}{pct.toFixed(2)}%
                                    </span>
                                );
                            })()}
                        </span>
                    </div>

                    {/* Vorbörse / Nachbörse Indikation (Yahoo) */}
                    {(() => {
                        const ext = getExtendedHoursInfo(stock);
                        if (!ext) return null;
                        const pct = ext.pct ?? 0;
                        return (
                            <div className={cn(
                                "flex justify-between items-center py-1 md:py-1.5 landscape:py-0.5 border-b border-border/50 text-xs sm:text-sm landscape:text-[11px] transition-colors",
                                showPrePost && (ext.isPre
                                    ? "bg-amber-500/15 -mx-2 px-2 rounded-md border-amber-500/35"
                                    : "bg-indigo-500/10 -mx-2 px-2 rounded-md border-indigo-500/30")
                            )}>
                                <span className={cn(
                                    "inline-flex items-center gap-1.5",
                                    showPrePost
                                        ? (ext.isPre ? "text-amber-600 dark:text-amber-400 font-semibold" : "text-indigo-600 dark:text-indigo-400 font-semibold")
                                        : "text-muted-foreground"
                                )}>
                                    {showPrePost && <span className={cn("size-1.5 rounded-full shrink-0", ext.isPre ? "bg-amber-500 dark:bg-amber-400" : "bg-indigo-500 dark:bg-indigo-400")} />}
                                    <span>{ext.label}{ext.timeText ? ` · ${ext.timeText}` : ''}</span>
                                </span>
                                <span className="font-medium tabular-nums text-right">
                                    <span className={showPrePost ? (ext.isPre ? "font-bold text-amber-700 dark:text-amber-300" : "font-bold text-indigo-700 dark:text-indigo-300") : ""}>
                                        {formatCurrency(ext.price!, stock.currency, false)}
                                    </span>
                                    {ext.pct !== null && ext.pct !== undefined && (
                                        <span className={`ml-2 ${pct >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                            {pct >= 0 ? '+' : ''}{pct.toFixed(2)}%
                                        </span>
                                    )}
                                </span>
                            </div>
                        );
                    })()}

                    {/* Europa-Frühstart Indikation (Tradegate / Xetra in EUR) */}
                    {europeanQuote && (
                        <div className="flex justify-between items-center py-1 md:py-1.5 landscape:py-0.5 border-b border-border/50 text-xs sm:text-sm landscape:text-[11px] transition-colors">
                            <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                                <span className="text-blue-600 dark:text-blue-400 font-semibold">🇪🇺 Europa / Tradegate</span>
                                {europeanQuote.timeText && <span className="text-[11px]">· {europeanQuote.timeText}</span>}
                                <InfoHelp
                                    title="Europa-Frühstart • Tradegate & Xetra"
                                    items={[
                                        {
                                            term: "Warum vorne Euro und hinten Dollar?",
                                            text: "Tradegate ist eine deutsche Börse, dort wird in Euro bezahlt (z. B. 31.02 EUR). Um den Kurs direkt mit deiner Aktie zu vergleichen, rechnet die App den Betrag über den aktuellen Wechselkurs automatisch in Dollar um (≈ 34.23 USD)."
                                        },
                                        {
                                            term: "Was zeigt die Prozentzahl?",
                                            text: "Sie zeigt dir auf einen Blick, ob die Aktie in Europa gerade höher (grün) oder tiefer (rot) gehandelt wird als zum letzten offiziellen New Yorker Schlusskurs."
                                        },
                                        {
                                            term: "Dein Vorteil (7,5 Stunden Frühwarnsystem)",
                                            text: "Deutsche Börsen handeln US-Aktien montags bereits ab 08:00 Uhr morgens – die Wall Street in New York öffnet erst um 15:30 Uhr. Wenn am Wochenende wichtige Neuigkeiten zu einer Firma bekannt werden, siehst du hier schon morgens beim Kaffee, wie die Anleger reagieren und wohin die Reise geht – volle 7,5 Stunden bevor die US-Börsen überhaupt aufwachen."
                                        }
                                    ]}
                                />
                            </span>
                            <span className="font-medium tabular-nums text-right">
                                <span className="font-bold text-foreground">
                                    {europeanQuote.priceEUR.toLocaleString('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} EUR
                                </span>
                                {europeanQuote.impliedTargetPrice && (
                                    <span className="text-muted-foreground text-xs ml-1.5">
                                        ≈ {formatCurrency(europeanQuote.impliedTargetPrice, stock.currency, false)}
                                    </span>
                                )}
                                {europeanQuote.impliedDeltaPercent !== undefined && (
                                    <span className={cn("ml-2 font-bold", europeanQuote.impliedDeltaPercent >= 0 ? "text-green-500" : "text-red-500")}>
                                        {europeanQuote.impliedDeltaPercent >= 0 ? '+' : ''}{europeanQuote.impliedDeltaPercent.toFixed(2)}%
                                    </span>
                                )}
                            </span>
                        </div>
                    )}

                    {/* Trenner 2: Zwischen Börsenkursen und Bewertung/Limits */}
                    <div className="my-2.5 h-px bg-border" />

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
                        // Ignore saved params with currency-distorted EPS (implausible P/E < 2.5)
                        if (activeParams && effectivePrice > 0 && Number(activeParams.eps) > 0 && effectivePrice / Number(activeParams.eps) < 2.5) {
                            activeParams = null;
                        }
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
                        const smartAutoRisk = {
                            ...smartAutoConservative,
                            growthRate: Math.max(3, parseFloat((smartAutoConservative.growthRate * 0.75).toFixed(1))),
                            pe: Math.min(20, Math.max(8, parseFloat((smartAutoConservative.pe * 0.8).toFixed(1)))),
                            mos: Math.max(25, Math.min(50, smartAutoConservative.mos + 10))
                        };

                        const isManualFv = Boolean(activeParams?.isCustom);
                        const currentValuationMode: 'conservative' | 'quality' | 'risk' =
                            activeParams?.valuationMode === 'risk'
                                ? 'risk'
                                : activeParams?.valuationMode === 'quality'
                                    ? 'quality'
                                    : 'conservative';
                        const currentMode: 'conservative' | 'quality' | 'risk' | 'manual' = isManualFv ? 'manual' : currentValuationMode;

                        let effectiveFairValue = 0;
                        let calcBuyPrice: number | null = null;
                        let calcFuturePrice: number | null = null;
                        let mosPct = 20;

                        if (currentMode === 'manual') {
                            mosPct = activeParams?.mos ?? smartAutoConservative.mos ?? 20;
                            const manualDcf = (activeParams && Number(activeParams.eps) > 0)
                                ? calculateDcfFairValue(activeParams, effectivePrice)
                                : null;
                            effectiveFairValue = (activeParams?.manualFairValue && Number(activeParams.manualFairValue) > 0)
                                ? Number(activeParams.manualFairValue)
                                : (manualDcf ? manualDcf.fairValue : (stock.fairValue || 0));
                            calcBuyPrice = effectiveFairValue > 0 ? effectiveFairValue * (1 - mosPct / 100) : null;
                            calcFuturePrice = (manualDcf as any)?.futurePrice
                                ?? ((activeParams && Number(activeParams.eps) > 0 && Number(activeParams.pe) > 0)
                                    ? (Number(activeParams.eps) * Math.pow(1 + (Number(activeParams.growthRate) || 0) / 100, 5) * Number(activeParams.pe))
                                    : null);
                        } else if (currentMode === 'quality') {
                            const qParams = (activeParams?.valuationMode === 'quality' && !activeParams?.isCustom && activeParams?.eps > 0) ? activeParams : smartAutoQuality;
                            const dcf = calculateDcfFairValue(qParams, effectivePrice);
                            effectiveFairValue = dcf.fairValue;
                            calcBuyPrice = dcf.buyPrice;
                            calcFuturePrice = (dcf as any)?.futurePrice ?? null;
                            mosPct = dcf.mos;
                        } else if (currentMode === 'risk') {
                            const rParams = (activeParams?.valuationMode === 'risk' && !activeParams?.isCustom && activeParams?.eps > 0) ? activeParams : smartAutoRisk;
                            const dcf = calculateDcfFairValue(rParams, effectivePrice);
                            effectiveFairValue = dcf.fairValue;
                            calcBuyPrice = dcf.buyPrice;
                            calcFuturePrice = (dcf as any)?.futurePrice ?? null;
                            mosPct = dcf.mos;
                        } else {
                            // 'conservative'
                            const cParams = (activeParams?.valuationMode === 'conservative' && !activeParams?.isCustom && activeParams?.eps > 0) ? activeParams : smartAutoConservative;
                            const dcf = calculateDcfFairValue(cParams, effectivePrice);
                            effectiveFairValue = dcf.fairValue;
                            calcBuyPrice = dcf.buyPrice;
                            calcFuturePrice = (dcf as any)?.futurePrice ?? null;
                            mosPct = dcf.mos;
                        }

                        const dcfRisk = calculateDcfFairValue(smartAutoRisk, effectivePrice);
                        const dcfQuality = calculateDcfFairValue(smartAutoQuality, effectivePrice);
                        const dcfCons = calculateDcfFairValue(smartAutoConservative, effectivePrice);

                        const savedTargetPriceType = (stock as any).targetPriceType;
                        let resolvedTargetType: 'conservative' | 'quality' | 'risk' | 'fairValue' | 'manual' = 'manual';
                        if (savedTargetPriceType) {
                            resolvedTargetType = savedTargetPriceType;
                        } else if (stock.targetPrice && stock.targetPrice > 0) {
                            if (Math.abs(stock.targetPrice - dcfRisk.buyPrice) < 0.05) {
                                resolvedTargetType = 'risk';
                            } else if (Math.abs(stock.targetPrice - dcfQuality.buyPrice) < 0.05) {
                                resolvedTargetType = 'quality';
                            } else if (Math.abs(stock.targetPrice - dcfCons.buyPrice) < 0.05) {
                                resolvedTargetType = 'conservative';
                            } else if (effectiveFairValue > 0 && Math.abs(stock.targetPrice - effectiveFairValue) < 0.05) {
                                resolvedTargetType = 'fairValue';
                            } else {
                                resolvedTargetType = 'manual';
                            }
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

                            const nextMode: 'conservative' | 'quality' | 'risk' =
                                currentMode === 'conservative'
                                    ? 'quality'
                                    : currentMode === 'quality'
                                        ? 'risk'
                                        : 'conservative';

                            const targetSmartParams =
                                nextMode === 'quality'
                                    ? smartAutoQuality
                                    : nextMode === 'risk'
                                        ? smartAutoRisk
                                        : smartAutoConservative;

                            const manualBackupToSave = currentMode === 'manual' ? {
                                ...(existingBackup || activeParams || smartAutoConservative),
                                ...(effectiveFairValue > 0 ? { manualFairValue: effectiveFairValue } : {}),
                                updatedAt: now
                            } : existingBackup;

                            const dcfNext = calculateDcfFairValue(targetSmartParams, effectivePrice);
                            const newFv = parseFloat(dcfNext.fairValue.toFixed(2));
                            const nextEntry = {
                                ...targetSmartParams,
                                isCustom: false,
                                valuationMode: nextMode,
                                ...(manualBackupToSave ? { customBackup: manualBackupToSave } : {}),
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
                            setFvModeTick(t => t + 1);
                        };

                        return (
                            <>
                                <div className="flex justify-between items-center py-1 md:py-1.5 landscape:py-0.5 border-b border-border/50 text-xs sm:text-sm landscape:text-[11px]">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                        <span className="text-muted-foreground">Kauflimit</span>
                                        {stock.targetPrice ? (
                                            <span className={cn(
                                                "inline-flex items-center text-[11px] sm:text-xs landscape:text-[10px] leading-4 font-semibold px-1.5 py-0.5 landscape:py-0 landscape:px-1 rounded border shadow-xs",
                                                resolvedTargetType === 'risk'
                                                    ? "text-amber-800 dark:text-amber-300 bg-amber-500/15 border-amber-500/30"
                                                    : resolvedTargetType === 'quality'
                                                        ? "text-purple-800 dark:text-purple-300 bg-purple-500/15 border-purple-500/30"
                                                        : resolvedTargetType === 'conservative'
                                                            ? "text-blue-800 dark:text-blue-300 bg-blue-500/15 border-blue-500/30"
                                                            : resolvedTargetType === 'fairValue'
                                                                ? "text-blue-800 dark:text-blue-300 bg-blue-500/15 border-blue-500/30"
                                                                : "text-pink-800 dark:text-pink-300 bg-pink-500/15 border-pink-500/30"
                                            )}>
                                                {resolvedTargetType === 'risk'
                                                    ? 'Risiko-Abschlag C'
                                                    : resolvedTargetType === 'quality'
                                                        ? 'Qualität B'
                                                        : resolvedTargetType === 'conservative'
                                                            ? 'Sicherheit A'
                                                            : resolvedTargetType === 'fairValue'
                                                                ? 'Fairer Wert'
                                                                : 'Manuell'}
                                            </span>
                                        ) : null}
                                    </div>
                                    <span className={cn(
                                        "font-medium tabular-nums",
                                        resolvedTargetType === 'risk'
                                            ? "text-amber-700 dark:text-amber-400 font-semibold"
                                            : resolvedTargetType === 'quality'
                                                ? "text-purple-700 dark:text-purple-400 font-semibold"
                                                : resolvedTargetType === 'conservative'
                                                    ? "text-blue-700 dark:text-blue-400 font-semibold"
                                                    : resolvedTargetType === 'fairValue'
                                                        ? "text-blue-700 dark:text-blue-400 font-semibold"
                                                        : "text-pink-700 dark:text-pink-400 font-semibold"
                                    )}>
                                        {stock.targetPrice ? formatCurrency(stock.targetPrice, stock.currency, false) : '-'}
                                    </span>
                                </div>
                                <div className="flex justify-between py-1 md:py-1.5 landscape:py-0.5 border-b border-border/50 text-xs sm:text-sm landscape:text-[11px]">
                                    <span className="text-muted-foreground">Verkaufslimit</span>
                                    <span className="font-medium tabular-nums">
                                        {stock.sellLimit ? formatCurrency(stock.sellLimit, stock.currency, false) : '-'}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between py-1 md:py-1.5 landscape:py-0.5 border-b border-border/50 text-xs sm:text-sm landscape:text-[11px]">
                                    <button
                                        type="button"
                                        onClick={handleToggleFvMode}
                                        className={cn(
                                            "flex items-center gap-1 text-[11px] sm:text-xs landscape:text-[10px] leading-4 font-semibold px-1.5 py-0.5 landscape:py-0 landscape:px-1 rounded border transition-colors cursor-pointer",
                                            currentMode === 'manual'
                                                ? "text-pink-800 dark:text-pink-300 bg-pink-500/15 hover:bg-pink-500/25 border-pink-500/30 dark:border-pink-500/40"
                                                : currentMode === 'risk'
                                                    ? "text-amber-800 dark:text-amber-300 bg-amber-500/15 hover:bg-amber-500/25 border-amber-500/30 dark:border-amber-500/40"
                                                    : currentMode === 'quality'
                                                        ? "text-purple-800 dark:text-purple-300 bg-purple-500/15 hover:bg-purple-500/25 border-purple-500/30 dark:border-purple-500/40"
                                                        : "text-blue-800 dark:text-blue-300 bg-blue-500/15 hover:bg-blue-500/25 border-blue-500/30 dark:border-blue-500/40"
                                        )}
                                        title={
                                            currentMode === 'conservative'
                                                ? "Sicherheit (A): Klick für Wechsel zu Qualität (B)"
                                                : currentMode === 'quality'
                                                    ? "Qualität (B): Klick für Wechsel zu Risiko-Abschlag (C)"
                                                    : currentMode === 'risk'
                                                        ? "Risiko-Abschlag (C): Klick für Wechsel zu Sicherheit (A)"
                                                        : "Manuell: Klick für Wechsel zu Sicherheit (A)"
                                        }
                                    >
                                        {currentMode === 'conservative' && <ShieldCheck className="size-3 shrink-0" />}
                                        {currentMode === 'quality' && <Sparkles className="size-3 shrink-0" />}
                                        {currentMode === 'risk' && <TriangleAlert className="size-3 shrink-0" />}
                                        {currentMode === 'manual' && <Sliders className="size-3 shrink-0" />}
                                        <span>
                                            {currentMode === 'manual'
                                                ? 'Kaufpreis Manuell'
                                                : currentMode === 'risk'
                                                    ? 'Kaufpreis Risiko C'
                                                    : currentMode === 'quality'
                                                        ? 'Kaufpreis Qualität B'
                                                        : 'Kaufpreis Sicherheit A'}
                                        </span>
                                    </button>
                                    <span className={cn(
                                        "font-medium tabular-nums",
                                        calcBuyPrice !== null
                                            ? currentMode === 'manual'
                                                ? "text-pink-700 dark:text-pink-400 font-semibold"
                                                : currentMode === 'risk'
                                                    ? "text-amber-700 dark:text-amber-400 font-semibold"
                                                    : currentMode === 'quality'
                                                        ? "text-purple-700 dark:text-purple-400 font-semibold"
                                                        : "text-blue-700 dark:text-blue-400 font-semibold"
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
                                                ? "text-pink-700 dark:text-pink-400 font-semibold"
                                                : currentMode === 'risk'
                                                    ? "text-amber-700 dark:text-amber-400 font-semibold"
                                                    : currentMode === 'quality'
                                                        ? "text-purple-700 dark:text-purple-400 font-semibold"
                                                        : "text-blue-700 dark:text-blue-400 font-semibold"
                                            : ""
                                    )}>
                                        {effectiveFairValue > 0 ? formatCurrency(effectiveFairValue, stock.currency, false) : '-'}
                                    </span>
                                </div>
                                <div className="flex justify-between py-1 md:py-1.5 landscape:py-0.5 border-b border-border/50 text-xs sm:text-sm landscape:text-[11px]">
                                    <span className="text-muted-foreground">Zielkurs 5 J</span>
                                    <span className="font-medium tabular-nums text-foreground">
                                        {calcFuturePrice !== null && calcFuturePrice > 0 ? formatCurrency(calcFuturePrice, stock.currency, false) : '-'}
                                    </span>
                                </div>
                                {position && position.shares > 0 && calcFuturePrice !== null && calcFuturePrice > 0 && (() => {
                                    const invested = position.shares * position.buyPriceAvg;
                                    const expectedVal = position.shares * calcFuturePrice;
                                    const expectedGain = expectedVal - invested;
                                    const gainPct = invested > 0 ? (expectedGain / invested) * 100 : 0;
                                    const curPrice = stock.currentPrice || 0;
                                    const cagr = (curPrice > 0 && calcFuturePrice > 0)
                                        ? (Math.pow(calcFuturePrice / curPrice, 0.2) - 1) * 100
                                        : 0;

                                    return (
                                        <div className="flex justify-between items-center py-1.5 md:py-2 landscape:py-1 border border-emerald-500/30 dark:border-emerald-500/20 text-xs sm:text-sm landscape:text-[11px] bg-emerald-500/15 dark:bg-emerald-500/10 px-2.5 rounded-lg mt-1 shadow-2xs">
                                            <div className="flex flex-col">
                                                <span className="text-emerald-900 dark:text-emerald-300 font-bold text-[11px] sm:text-xs">Gewinn 5 J Bestand</span>
                                                <span className="text-[10px] text-emerald-800/80 dark:text-muted-foreground">~{cagr.toFixed(1)}% p.a. ab heute</span>
                                            </div>
                                            <div className="text-right">
                                                <span className="font-bold text-emerald-800 dark:text-emerald-400 font-mono text-xs sm:text-sm">
                                                    {expectedGain >= 0 ? '+' : ''}{formatCurrency(expectedGain, stock.currency, false)}
                                                </span>
                                                <span className="block text-[10px] text-emerald-700 dark:text-emerald-400/90 font-semibold font-mono">
                                                    {gainPct >= 0 ? '+' : ''}{gainPct.toFixed(1)}%
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })()}
                            </>
                        );
                    })()}
                </div>
            </div>

            {/* Quick Links Card - rückt in der linken Spalte direkt unter Kursdaten nach! */}
            <div className="order-3 md:order-none">
                <div className="bg-card border border-border rounded-xl p-4 md:p-6 landscape:p-3 landscape:py-2.5 shadow-sm flex flex-col justify-start overflow-hidden">
                    <h3 className="font-bold text-base md:text-lg landscape:text-xs mb-2 md:mb-4 landscape:mb-1 flex items-center gap-1.5 md:gap-2">
                        <Link2 className="size-4 md:size-5 text-blue-500 shrink-0" />
                        Quick Links
                    </h3>
                    <div className="space-y-3">
                        {/* Input for adding new links */}
                        <div className="flex gap-2">
                            <input
                                type="url"
                                placeholder="URL einfügen oder reinziehen..."
                                className="flex-1 px-3 py-2 text-xs sm:text-sm rounded-lg border border-border bg-background/50 focus:outline-none focus:ring-2 focus:ring-primary/20"
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
                                className="px-3 md:px-4 py-2 text-xs sm:text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors whitespace-nowrap"
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
                                            className="flex-1 text-xs sm:text-sm text-primary hover:underline truncate"
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
                            <div className="flex items-center justify-center text-center py-6 px-4">
                                <p className="text-xs sm:text-sm text-muted-foreground">
                                    Keine Links gespeichert.<br />
                                    Füge Chart- oder Finanz-URLs hinzu.
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>

        {/* Rechte Spalte: Stammdaten & nachrückendes Notizen-Feld */}
        <div className="contents md:flex md:flex-col md:gap-4 md:gap-6 landscape:gap-3">
            <div className="order-2 md:order-none">
                {/* Stammdaten */}
                <div className="bg-card border border-border rounded-xl p-4 md:p-6 landscape:p-3 landscape:py-2.5 shadow-sm flex flex-col justify-start overflow-hidden space-y-2.5">
                    <div className="flex items-center justify-between gap-2 mb-2 md:mb-4 landscape:mb-1">
                        <div className="flex items-center gap-1.5 md:gap-2">
                            <Layers className="size-4 md:size-5 text-blue-500 shrink-0" />
                            <h3 className="font-bold text-base md:text-lg landscape:text-xs">Stammdaten</h3>
                        </div>
                    </div>

                    {/* Bereich 1: Basisdaten */}
                    <div
                        onClick={() => navigateToEditSection('stammdaten')}
                        className="group/sec cursor-pointer transition-colors"
                        title="Basisdaten bearbeiten (Öffnet Stammdaten)"
                    >
                        <div className="flex items-center justify-between pb-1 mb-1 border-b border-border/70 group-hover/sec:border-primary/50 transition-colors">
                            <span className="text-xs sm:text-sm font-semibold text-primary flex items-center gap-1.5 transition-colors">
                                <TrendingUp className="size-3.5 text-blue-400 shrink-0" />
                                Basisdaten
                            </span>
                            <Pencil className="size-3 text-muted-foreground group-hover/sec:text-primary transition-colors opacity-60 group-hover/sec:opacity-100" />
                        </div>
                        <div>
                            <div className="flex justify-between py-1 md:py-1.5 landscape:py-0.5 border-b border-border/50 text-xs sm:text-sm landscape:text-[11px]">
                                <span className="text-muted-foreground">Name</span>
                                <span className="font-medium text-foreground text-right truncate max-w-[180px] sm:max-w-[240px]">{stock.name}</span>
                            </div>
                            <div className="flex justify-between py-1 md:py-1.5 landscape:py-0.5 border-b border-border/50 text-xs sm:text-sm landscape:text-[11px]">
                                <span className="text-muted-foreground">Symbol</span>
                                <span className="font-medium font-mono text-foreground">{stock.symbol}</span>
                            </div>
                            <div className="flex justify-between py-1 md:py-1.5 landscape:py-0.5 border-b border-border/50 text-xs sm:text-sm landscape:text-[11px]">
                                <span className="text-muted-foreground">ISIN</span>
                                <span className="font-medium font-mono text-foreground">{stock.isin || '-'}</span>
                            </div>
                            <div className="flex justify-between py-1 md:py-1.5 landscape:py-0.5 border-b border-border/50 text-xs sm:text-sm landscape:text-[11px]">
                                <span className="text-muted-foreground">Typ</span>
                                <span className="font-medium capitalize text-foreground">{stock.type || 'Aktie'}</span>
                            </div>
                            <div className="flex justify-between py-1 md:py-1.5 landscape:py-0.5 border-b border-border/50 text-xs sm:text-sm landscape:text-[11px]">
                                <span className="text-muted-foreground">Währung</span>
                                <span className="font-medium text-foreground">{stock.currency}</span>
                            </div>
                        </div>
                    </div>

                    {/* Bereich 2: Bewertung & Kennzahlen */}
                    <div
                        onClick={() => navigateToEditSection('kursdaten')}
                        className="group/sec cursor-pointer transition-colors"
                        title="Bewertung & Kennzahlen bearbeiten (Öffnet Kursdaten)"
                    >
                        <div className="flex items-center justify-between pb-1 mb-1 border-b border-border/70 group-hover/sec:border-primary/50 transition-colors">
                            <span className="text-xs sm:text-sm font-semibold text-primary flex items-center gap-1.5 transition-colors">
                                <BarChart3 className="size-3.5 text-blue-400 shrink-0" />
                                Bewertung & Kennzahlen
                                <InfoHelp title="Bewertung & Kennzahlen" items={[{ term: "KGV (P/E)", text: "Kurs-Gewinn-Verhältnis: Kurs geteilt durch den Gewinn pro Aktie der letzten 12 Monate. Niedrig bedeutet günstiger bewertet, hoch bedeutet, dass der Markt starkes Wachstum erwartet. Steht \"(Fwd)\" dahinter, ist es das erwartete KGV auf Basis der Gewinnschätzung fürs nächste Jahr." }, { term: "KCV (P/CF)", text: "Kurs-Cashflow-Verhältnis: Marktwert geteilt durch den operativen Cashflow. Funktioniert wie das KGV, ist aber weniger anfällig für Buchhaltungseffekte. Auch hier gilt: niedriger heisst günstiger." }, { term: "Einordnung", text: "Vergleiche Kennzahlen nur innerhalb derselben Branche und immer zusammen mit dem Wachstum. Forward-KGV und PEG findest du im Fairen-Wert-Rechner." }]} />
                            </span>
                            <Pencil className="size-3 text-muted-foreground group-hover/sec:text-primary transition-colors opacity-60 group-hover/sec:opacity-100" />
                        </div>
                        <div>
                            <div className="flex justify-between py-1 md:py-1.5 landscape:py-0.5 border-b border-border/50 text-xs sm:text-sm landscape:text-[11px]">
                                <span className="text-muted-foreground">KGV (P/E)</span>
                                <span className="font-medium text-foreground tabular-nums">
                                    {stock.trailingPE
                                        ? stock.trailingPE.toFixed(2)
                                        : (stock.forwardPE ? `${stock.forwardPE.toFixed(2)} (Fwd)` : (stock.eps && stock.eps > 0 ? (stock.currentPrice / stock.eps).toFixed(2) : '-'))}
                                </span>
                            </div>
                            <div className="flex justify-between py-1 md:py-1.5 landscape:py-0.5 border-b border-border/50 text-xs sm:text-sm landscape:text-[11px]">
                                <span className="text-muted-foreground">KCV (P/CF)</span>
                                <span className="font-medium text-foreground tabular-nums">
                                    {stock.kcv ? stock.kcv.toFixed(2) : '-'}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Bereich 3: Dividenden & Termine */}
                    <div
                        onClick={() => navigateToEditSection('termine')}
                        className="group/sec cursor-pointer transition-colors"
                        title="Dividenden & Termine bearbeiten (Öffnet direkt auf Höhe von Terminen)"
                    >
                        <div className="flex items-center justify-between pb-1 mb-1 border-b border-border/70 group-hover/sec:border-primary/50 transition-colors">
                            <span className="text-xs sm:text-sm font-semibold text-primary flex items-center gap-1.5 transition-colors">
                                <Calendar className="size-3.5 text-blue-400 shrink-0" />
                                Dividenden & Termine
                                <InfoHelp title="Dividenden & Termine" items={[{ term: "Div. Frequenz", text: "Wie oft die Dividende ausgezahlt wird: monatlich, quartalsweise, halbjährlich oder jährlich." }, { term: "Div. Rendite", text: "Jahresdividende im Verhältnis zum Kurs. \"% Kurs\" bezieht sich auf den aktuellen Kurs. \"% Käufe\" bezieht sich auf deinen durchschnittlichen Kaufpreis. Der CHF-Betrag ist die erwartete Jahresdividende für deinen Bestand in Franken, ohne Abzug von Steuern." }, { term: "Nächster Ex-Tag", text: "Ab diesem Tag wird die Aktie ohne die nächste Dividende gehandelt. Die Dividende bekommt, wer die Aktie vor dem Ex-Tag besitzt." }, { term: "Nächster Zahltag", text: "Tag, an dem die Dividende ausgezahlt wird. Auf deinem Konto kann sie beim Broker einige Tage später erscheinen." }]} />
                            </span>
                            <Pencil className="size-3 text-muted-foreground group-hover/sec:text-primary transition-colors opacity-60 group-hover/sec:opacity-100" />
                        </div>
                        <div>
                            <div className="flex justify-between py-1 md:py-1.5 landscape:py-0.5 border-b border-border/50 text-xs sm:text-sm landscape:text-[11px]">
                                <span className="text-muted-foreground">Div. Frequenz</span>
                                <span className="font-medium capitalize text-foreground">
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

                                        let annualDividendNative = 0;
                                        if (pos && pos.shares > 0) {
                                            if (annualPayout > 0) {
                                                annualDividendNative = annualPayout * pos.shares;
                                            } else if (marketYield) {
                                                annualDividendNative = pos.shares * stock.currentPrice * (marketYield / 100);
                                            }
                                        }
                                        const divCurrency = stock.dividendCurrency || stock.currency;
                                        const annualDividendCHF = annualDividendNative > 0 ? convertToCHF(annualDividendNative, divCurrency) : 0;

                                        if (!marketYield && !yieldCost && annualDividendCHF === 0) return '-';

                                        if (yieldCost !== null && marketYield !== null && Math.abs(yieldCost - marketYield) > 0.01) {
                                            return (
                                                <div className="flex flex-col items-end leading-tight gap-0.5">
                                                    <span className="font-medium text-xs sm:text-sm text-foreground/80 tabular-nums">{marketYield.toFixed(2)}% Kurs</span>
                                                    <span className="font-bold text-xs sm:text-sm text-green-600 dark:text-green-400 tabular-nums">{yieldCost.toFixed(2)}% Käufe</span>
                                                    {annualDividendCHF > 0 && (
                                                        <span className="font-bold text-xs sm:text-sm text-green-600 dark:text-green-400 tabular-nums" title={`Erwartete Jahresdividende für ${pos?.shares} Stk.: ${annualDividendCHF.toFixed(2)} CHF`}>
                                                            {annualDividendCHF.toLocaleString('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} CHF
                                                        </span>
                                                    )}
                                                </div>
                                            );
                                        }

                                        return (
                                            <div className="flex flex-col items-end leading-tight gap-0.5">
                                                <span className="font-medium text-xs sm:text-sm text-foreground/80 tabular-nums">{(marketYield ?? yieldCost)?.toFixed(2)}% Kurs</span>
                                                {annualDividendCHF > 0 && (
                                                    <span className="font-bold text-xs sm:text-sm text-green-600 dark:text-green-400 tabular-nums" title={`Erwartete Jahresdividende für ${pos?.shares} Stk.: ${annualDividendCHF.toFixed(2)} CHF`}>
                                                        {annualDividendCHF.toLocaleString('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} CHF
                                                    </span>
                                                )}
                                            </div>
                                        );
                                    })()}
                                </span>
                            </div>
                            <div className="flex justify-between py-1 md:py-1.5 landscape:py-0.5 border-b border-border/50 text-xs sm:text-sm landscape:text-[11px]">
                                <span className="text-muted-foreground">Nächster Ex-Tag</span>
                                <span className="font-medium font-mono text-foreground tabular-nums">{upcomingDividendDates.exDate}</span>
                            </div>
                            <div className="flex justify-between py-1 md:py-1.5 landscape:py-0.5 text-xs sm:text-sm landscape:text-[11px]">
                                <span className="text-muted-foreground">Nächster Zahltag</span>
                                <span className="font-medium font-mono text-emerald-400 tabular-nums">{upcomingDividendDates.payDate}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Notes Card - rückt in der rechten Spalte direkt unter Stammdaten nach! */}
            <div className="order-4 md:order-none">
                <div className="bg-card border border-border rounded-xl p-4 md:p-6 landscape:p-3 landscape:py-2.5 shadow-sm flex flex-col justify-start overflow-hidden">
                    <div className="flex items-center justify-between mb-2 md:mb-4 landscape:mb-1">
                        <h3 className="font-bold text-base md:text-lg landscape:text-xs flex items-center gap-1.5 md:gap-2">
                            <Save className="size-4 md:size-5 text-purple-500 shrink-0" />
                            Persönliche Notizen & Analyse
                        </h3>
                        <button
                            onClick={handleSaveNotes}
                            className={cn(
                                'px-3 py-1.5 md:px-4 md:py-2 rounded-lg font-medium text-xs sm:text-sm transition-all',
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
                        className="min-h-[160px] md:min-h-[220px] landscape:min-h-0 w-full p-2.5 md:p-4 text-xs sm:text-sm rounded-lg border border-border bg-background/50 resize-none focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                    <p className="text-[10px] md:text-xs text-muted-foreground mt-1 landscape:mt-0.5">
                        * Notizen werden nur lokal gespeichert.
                    </p>
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
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 landscape:gap-3 items-stretch iphone-landscape-section">
                                {/* Sector Allocation */}
                                {effectiveSectorWeights && Object.keys(effectiveSectorWeights).length > 0 && (
                                    <div className="bg-card border border-border rounded-xl p-4 md:p-6 landscape:p-3 landscape:py-2.5 shadow-sm flex flex-col justify-between h-full overflow-hidden">
                                        <h3 className="font-bold text-base md:text-lg landscape:text-xs mb-2 md:mb-4 landscape:mb-1 flex items-center gap-1.5 md:gap-2">
                                            <TrendingUp className="size-4 md:size-5 text-purple-500" />
                                            Branchen Allokation
                                        </h3>
                                        <div className="space-y-1.5 md:space-y-3 landscape:space-y-0 flex-1 flex flex-col justify-between">
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
                                                        <div key={sector} className="flex items-center justify-between text-xs sm:text-sm landscape:text-[11px] py-0.5 border-b border-border/40">
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
                                    <div className="bg-card border border-border rounded-xl p-4 md:p-6 landscape:p-3 landscape:py-2.5 shadow-sm flex flex-col justify-between h-full overflow-hidden">
                                        <h3 className="font-bold text-base md:text-lg landscape:text-xs mb-2 md:mb-4 landscape:mb-1 flex items-center gap-1.5 md:gap-2">
                                            <MapIcon className="size-4 md:size-5 text-blue-500" />
                                            Länder Allokation
                                        </h3>
                                        <div className="space-y-1.5 md:space-y-3 landscape:space-y-0 flex-1 flex flex-col justify-between">
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
                                                        <div key={country} className="flex items-center justify-between text-xs sm:text-sm landscape:text-[11px] py-0.5 border-b border-border/40">
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


            {
                stock && (
                    <AddToWatchlistModal
                        isOpen={isWatchlistModalOpen}
                        onClose={() => setIsWatchlistModalOpen(false)}
                        stockId={stock.id}
                    />
                )
            }
            {position && (
                <EditPositionModal
                    isOpen={isEditPositionModalOpen}
                    onClose={() => setIsEditPositionModalOpen(false)}
                    position={{
                        ...position,
                        stock: stockFromContext || stock
                    }}
                    onUpdate={handleUpdatePosition}
                    onDelete={(posId) => {
                        deletePosition(posId);
                        setIsEditPositionModalOpen(false);
                    }}
                />
            )}
        </div >
    );
}
