import { StockName } from './StockName';
import { InfoHelp } from './InfoHelp';
import { DelayedDataBadge } from './DelayedDataBadge';
import { Logo } from './Logo';
import { useMemo, useState, useEffect, Fragment, useRef } from 'react';
import { createPortal } from 'react-dom';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine, ReferenceDot } from 'recharts';
import { useCurrencyFormatter } from '../utils/currency';
import { Ruler, X, ArrowLeftRight, Maximize2, Minimize2, HelpCircle, ShieldCheck, Sparkles, TriangleAlert, Sliders, RefreshCw } from 'lucide-react';
import { cn } from '../utils';
import { type TimeRange, type ChartDataPoint } from '../services/yahoo-finance';
import { useExchangeRates } from '../context/ExchangeRateContext';

export interface MeasurePoint {
    date: string;
    value: number;
    label?: string;
    extremumType?: 'high' | 'low';
}


export function formatRangeLabel(range: string): string {
    if (range === '1Y') return '1J';
    if (range === '3Y') return '3J';
    if (range === '5Y') return '5J';
    if (range === 'BUY') return 'Seit Kauf';
    return range;
}

export const FIBONACCI_INFO_ITEMS = [
    {
        term: "1. Was sind Fibonacci-Retracements?",
        text: "Nach einer Kursbewegung korrigiert eine Aktie selten in einer geraden Linie. Fibonacci-Retracements teilen die Spanne zwischen Hoch (0.0%) und Tief (100.0%) in mathematische Natur-Verhältnisse ein, an denen Kurse erfahrungsgemäss Unterstützung finden und wieder nach oben drehen."
    },
    {
        term: "2. Die Schlüssel-Level & ihre Bedeutung",
        text: "• **61.8% • Goldener Schnitt (Golden Ratio):** Die mit Abstand wichtigste Marke an den weltweiten Finanzmärkten. Dreht der Kurs oberhalb oder genau am Goldenen Schnitt, gilt der übergeordnete Aufwärtstrend als intakt und bestätigt.\n\n• **50.0% • Mitte:** Psychologische Schlüsselmarke für gesunde Standard-Korrekturen (Halbierung der vorherigen Gewinne).\n\n• **78.6% • Letzter Support:** Die letzte Bastion vor einem vollständigen Trendbruch (100.0% Tief).\n\n• **23.6% & 38.2%:** Flache Konsolidierungen in extrem dynamischen Bullenmärkten."
    },
    {
        term: "3. Auf welchen Zeitraum schauen Profis? (Multi-Timeframe)",
        text: "Profis nutzen den **Top-Down-Ansatz (vom Großen ins Kleine)**:\n\n• **1 Jahr (1J) • Die Haupt-Referenz (80% aller Profis):** Misst das 52-Wochen-Hoch/-Tief. Der 1J-Goldene Schnitt ist der weltweite Standard zur Beurteilung, ob eine Jahresrallye noch intakt ist.\n\n• **3 Jahre (3J) • Der Makro-Boden:** Bestätigt mehrjährige Trendzyklen. Liegen der 1J- und 3J-Goldene Schnitt eng beieinander, bildet sich eine extrem starke **Cluster-Zone**.\n\n• **3 Monate (3M) • Timing für Einstiege:** Dient kurzfristigen Swing-Tradern, um temporäre Quartals-Dips gezielt abzupassen."
    },
    {
        term: "4. Das Profi-Geheimnis: Konfluenz & Cluster",
        text: "Ein Fibo-Level gewinnt massiv an Trefferquote, wenn mehrere Signale auf derselben Kurshöhe zusammentreffen:\n\n• **200-Tage-Linie (SMA 200)** verläuft in unmittelbarer Nähe\n• **Dein Kauflimit** oder der **Faire Wert** liegen in der Fibo-Zone\n• **Frühere Höchst-/Tiefstkurse** dienen als horizontale Unterstützung"
    },
    {
        term: "5. Tipp: Kombination mit dem Messwerkzeug",
        text: "Klicke in der Menüleiste auf **`Messen`** und wähle zwei beliebige Punkte im Chart aus. Bei aktivem **`Φ Fibonacci`** berechnet die App die Fibo-Linien sofort millimetergenau für deinen individuellen Messbereich!"
    }
];

interface PriceHistoryChartProps {
    currentPrice: number;
    currency: string;
    volatility?: number;
    trend?: 'up' | 'down' | 'neutral';
    historyData?: ChartDataPoint[] | null;
    selectedRange?: TimeRange;
    onRangeChange?: (range: TimeRange) => void;
    showPrePost?: boolean;
    onTogglePrePost?: () => void;
    isRealtime?: boolean;
    quoteDate?: Date | null;
    previousClose?: number;
    isMarketOpen?: boolean;
    purchasePrice?: number;
    purchaseDate?: string;
    purchases?: Array<{
        id?: string;
        date: string;
        shares?: number;
        price: number;
    }>;
    sellLimit?: number;
    buyLimit?: number;
    modelBuyPrice?: number;
    fairValue?: number;
    valuationMode?: 'conservative' | 'quality' | 'risk' | 'manual';
    buyLimitType?: 'conservative' | 'quality' | 'risk' | 'manual' | 'fairValue';
    onToggleValuationMode?: () => void;
    stockName?: string;
    stockSymbol?: string;
    stockLogoUrl?: string;
    stockDate?: string;
    onRefresh?: () => void;
    isRefreshing?: boolean;
    minutesAgo?: number;
    isFullscreen?: boolean;
    onToggleFullscreen?: (fullscreen: boolean) => void;
}

export function PriceHistoryChart({
    currentPrice,
    currency,
    volatility = 0.02,
    trend = 'up',
    historyData,
    selectedRange = '1Y',
    onRangeChange,
    showPrePost = false,
    onTogglePrePost,
    quoteDate,
    previousClose,
    isMarketOpen = true,
    purchasePrice,
    purchaseDate,
    purchases,
    sellLimit,
    buyLimit,
    modelBuyPrice,
    fairValue,
    valuationMode,
    buyLimitType,
    onToggleValuationMode,
    stockName,
    stockSymbol,
    stockLogoUrl,
    stockDate,
    onRefresh,
    isRefreshing,
    minutesAgo,
    isFullscreen: controlledFullscreen,
    onToggleFullscreen
}: PriceHistoryChartProps) {
    const [hasMounted, setHasMounted] = useState(false);
    const [isNarrowPortrait, setIsNarrowPortrait] = useState(() =>
        typeof window !== 'undefined' ? (window.innerWidth < 520 && window.innerHeight > window.innerWidth) : false
    );

    useEffect(() => {
        const handleResize = () => {
            setIsNarrowPortrait(window.innerWidth < 520 && window.innerHeight > window.innerWidth);
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);
    const [isMeasureMode, setIsMeasureMode] = useState(false);
    const [showFibonacci, setShowFibonacci] = useState(false);
    const [internalFullscreen, setInternalFullscreen] = useState(false);
    const isFullscreen = controlledFullscreen !== undefined ? controlledFullscreen : internalFullscreen;

    const handleToggleFullscreen = () => {
        const next = !isFullscreen;
        if (onToggleFullscreen) {
            onToggleFullscreen(next);
        } else {
            setInternalFullscreen(next);
        }
        if (!next) {
            setShowFibonacci(false);
        }
    };
    const [measurePoints, setMeasurePoints] = useState<MeasurePoint[]>([]);
    const lastMeasureClickRef = useRef(0);
    const [hoveredData, setHoveredData] = useState<{ date: string; value: number; sma200?: number | null; session?: 'pre' | 'regular' | 'post' } | null>(null);
    const [selectedExtremum, setSelectedExtremum] = useState<'high' | 'low' | null>(null);

    // Lock body scrolling and listen for Escape key when in fullscreen
    useEffect(() => {
        if (!isFullscreen) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                handleToggleFullscreen();
            }
        };
        const prevOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        window.addEventListener('keydown', handleKeyDown);
        return () => {
            document.body.style.overflow = prevOverflow;
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [isFullscreen]);

    useEffect(() => {
        if (!selectedExtremum) return;
        const handleOutsidePointerDown = (e: PointerEvent) => {
            const target = e.target as HTMLElement | null;
            if (!target?.closest('[data-extremum-btn="true"]')) {
                setSelectedExtremum(null);
            }
        };
        document.addEventListener('pointerdown', handleOutsidePointerDown);
        return () => document.removeEventListener('pointerdown', handleOutsidePointerDown);
    }, [selectedExtremum]);

    // Clear hoveredData immediately when scrolling so it never shows through headers
    useEffect(() => {
        const handleScroll = () => {
            if (hoveredData) {
                setHoveredData(null);
            }
        };
        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => window.removeEventListener('scroll', handleScroll);
    }, [hoveredData]);

    // Currency Conversion State
    const { rates } = useExchangeRates();
    const [showInCHF, setShowInCHF] = useState(false);
    const canConvert = currency !== 'CHF';

    // Auto-reset if currency changes to CHF
    useEffect(() => {
        if (!canConvert) setShowInCHF(false);
    }, [canConvert]);

    const conversionRate = useMemo(() => {
        if (!showInCHF || !canConvert) return 1;
        // rates are CHF-based (e.g. USD=1.12 means 1 CHF = 1.12 USD)
        // To convert USD to CHF: Value / 1.12
        const rate = rates[currency];
        return rate ? 1 / rate : 1;
    }, [showInCHF, canConvert, currency, rates]);

    const displayCurrency = showInCHF ? 'CHF' : currency;

    useEffect(() => {
        setHasMounted(true);
    }, []);

    // Reset measure points when mode is toggled or range changes
    useEffect(() => {
        setMeasurePoints([]);
    }, [isMeasureMode, selectedRange]);
    const { formatCurrency } = useCurrencyFormatter();

    const handleRangeChange = (range: TimeRange) => {
        if (onRangeChange) onRangeChange(range);
    };

    // Use simulated data if no historyData is provided
    const rawData = useMemo(() => {
        if (historyData && historyData.length > 0) {
            // Check if we should append the currentPrice (Live connection)
            // Only during active regular market session (avoids flat tail at 08:54 on weekends/closed hours)
            const hasPostInHistory = historyData.some(p => p.session === 'post');
            if (selectedRange === '1D' && isMarketOpen && (!showPrePost || !hasPostInHistory) && currentPrice > 0) {
                const lastPoint = historyData[historyData.length - 1];
                const lastDate = new Date(lastPoint.date).getTime();
                const liveDate = quoteDate ? quoteDate.getTime() : Date.now();

                // If live date is significantly newer (> 5 min) than last history point
                if (liveDate > lastDate + 5 * 60 * 1000) {
                    return [
                        ...historyData,
                        {
                            date: new Date(liveDate).toISOString(),
                            value: currentPrice
                        }
                    ];
                }
            }
            return historyData;
        }

        const points: ChartDataPoint[] = [];
        const now = new Date();
        let days = 30; // default for loops
        let intervalHours = 24; // default for loops

        switch (selectedRange) {
            case '1D': days = 1; intervalHours = 0.5; break; // 30 min intervals
            case '1W': days = 7; intervalHours = 4; break; // 4h intervals simulates week well roughly
            case '1M': days = 30; intervalHours = 24; break;
            case '3M': days = 90; intervalHours = 24; break;
            case '6M': days = 180; intervalHours = 24; break;
            case '1Y': days = 365; intervalHours = 24; break;
            case '3Y': days = 365 * 3; intervalHours = 24 * 3; break;
            case '5Y': days = 365 * 5; intervalHours = 24 * 7; break; // Weekly
        }

        // Generate mock data backwards from today
        let price = currentPrice;

        // Count iterations based on days and interval
        const hoursTotal = days * 24;
        const iterations = Math.ceil(hoursTotal / intervalHours);

        for (let i = 0; i < iterations; i++) {
            const date = new Date(now);
            date.setTime(date.getTime() - (i * intervalHours * 60 * 60 * 1000));

            // Skip weekends for daily data if interval is >= 24h
            if (intervalHours >= 24) {
                if (date.getDay() === 0 || date.getDay() === 6) continue;
            }

            // Random walk
            const change = 1 + (Math.random() * volatility * 2 - volatility);

            let bias = 0;
            if (trend === 'up') bias = -0.0005;
            if (trend === 'down') bias = 0.0005;

            price = price * (change + bias);

            points.push({
                date: date.toISOString(),
                value: price,
            });
        }

        return points.reverse();
    }, [currentPrice, selectedRange, volatility, trend, historyData, isMarketOpen, showPrePost, quoteDate]);

    const data = useMemo(() => {
        if (conversionRate === 1) return rawData;
        return rawData.map(d => ({
            ...d,
            value: d.value * conversionRate,
            sma200: (d.sma200 !== undefined && d.sma200 !== null) ? d.sma200 * conversionRate : d.sma200
        }));
    }, [rawData, conversionRate]);

    // Apply conversion to props
    const effectiveCurrentPrice = currentPrice * conversionRate;
    const effectivePreviousClose = previousClose ? previousClose * conversionRate : undefined;
    const effectivePurchasePrice = purchasePrice ? purchasePrice * conversionRate : undefined;
    const effectiveBuyLimit = buyLimit && buyLimit > 0 ? buyLimit * conversionRate : undefined;
    const effectiveModelBuyPrice = modelBuyPrice && modelBuyPrice > 0 ? modelBuyPrice * conversionRate : undefined;
    const effectiveFairValue = fairValue && fairValue > 0 ? fairValue * conversionRate : undefined;
    const effectiveSellLimit = sellLimit ? sellLimit * conversionRate : undefined;

    // Strategy line themes based on valuationMode
    const fvTheme = useMemo(() => {
        switch (valuationMode) {
            case 'quality':
                return {
                    stroke: '#a855f7', // Purple-500
                    fill: '#d8b4fe',   // Purple-300
                    badge: 'B',
                    labelPrefix: 'Fairer Wert B',
                    modelBuyLabel: 'Kaufpreis Qualität B'
                };
            case 'risk':
                return {
                    stroke: '#f59e0b', // Amber-500
                    fill: '#fde047',   // Amber-300
                    badge: 'C',
                    labelPrefix: 'Fairer Wert C',
                    modelBuyLabel: 'Kaufpreis Risiko C'
                };
            case 'manual':
                return {
                    stroke: '#ec4899', // Pink-500
                    fill: '#f472b6',   // Pink-400
                    badge: 'Manuell',
                    labelPrefix: 'Fairer Wert Manuell',
                    modelBuyLabel: 'Kaufpreis Manuell'
                };
            case 'conservative':
            default:
                return {
                    stroke: '#3b82f6', // Blue-500
                    fill: '#93c5fd',   // Blue-300
                    badge: 'A',
                    labelPrefix: 'Fairer Wert A',
                    modelBuyLabel: 'Kaufpreis Sicherheit A'
                };
        }
    }, [valuationMode]);

    const buyLimitTheme = useMemo(() => {
        const mode = buyLimitType || valuationMode;
        switch (mode) {
            case 'quality':
                return {
                    stroke: '#a855f7',
                    fill: '#d8b4fe',
                    labelPrefix: 'Kauflimit B'
                };
            case 'risk':
                return {
                    stroke: '#f59e0b',
                    fill: '#fde047',
                    labelPrefix: 'Kauflimit C'
                };
            case 'manual':
                return {
                    stroke: '#ec4899',
                    fill: '#f472b6',
                    labelPrefix: 'Kauflimit Manuell'
                };
            case 'conservative':
                return {
                    stroke: '#3b82f6',
                    fill: '#93c5fd',
                    labelPrefix: 'Kauflimit A'
                };
            case 'fairValue':
                return {
                    stroke: fvTheme.stroke,
                    fill: fvTheme.fill,
                    labelPrefix: 'Kauflimit Fairer Wert'
                };
            default:
                return {
                    stroke: '#3b82f6',
                    fill: '#93c5fd',
                    labelPrefix: 'Kauflimit'
                };
        }
    }, [buyLimitType, valuationMode, fvTheme]);


    // Calculate performance for the selected range
    let startPrice = data[0]?.value || 0;

    // For 1D, force startPrice to be Previous Close if available, to match "Daily Change" logic
    if (selectedRange === '1D' && effectivePreviousClose && effectivePreviousClose > 0) {
        startPrice = effectivePreviousClose;
    }

    // For BUY, use the actual purchase price for accurate performance (vs Portfolio)
    if (selectedRange === 'BUY' && effectivePurchasePrice && effectivePurchasePrice > 0) {
        startPrice = effectivePurchasePrice;
    }

    let endPrice = data[data.length - 1]?.value || 0;
    // For 1D, force endPrice to be currentPrice to match the List/Quote (avoid chart data lag)
    if (selectedRange === '1D' && effectiveCurrentPrice > 0) {
        endPrice = effectiveCurrentPrice;
    }

    const performance = startPrice !== 0 ? ((endPrice - startPrice) / startPrice) * 100 : 0;
    const isPositive = performance >= 0;

    // Calculate Difference (Native)
    const diffNative = endPrice - startPrice;

    // Format native difference
    const diffNativeFormatted = (diffNative > 0 ? '+' : '') + formatCurrency(diffNative, displayCurrency, false);

    const effectiveDateStr = useMemo(() => {
        if (stockDate) return stockDate;
        const validQuoteDate = quoteDate && !isNaN(quoteDate.getTime()) ? quoteDate : null;
        const lastDataDate = (historyData && historyData.length > 0)
            ? new Date(historyData[historyData.length - 1].date)
            : (data && data.length > 0 ? new Date(data[data.length - 1].date) : null);
        const validLastDataDate = lastDataDate && !isNaN(lastDataDate.getTime()) ? lastDataDate : null;
        const targetDate = (!isMarketOpen && (validQuoteDate || validLastDataDate))
            ? (validQuoteDate || validLastDataDate)
            : (validQuoteDate || validLastDataDate || new Date());
        if (!targetDate || isNaN(targetDate.getTime())) return null;
        return targetDate.toLocaleDateString('de-CH', { day: '2-digit', month: '2-digit', year: '2-digit' });
    }, [stockDate, quoteDate, historyData, data, isMarketOpen]);

    // Calculate Min/Max for the current range
    const prices = data.map(d => d.value);
    const minPrice = prices.length > 0 ? Math.min(...prices) : 0;
    const maxPrice = prices.length > 0 ? Math.max(...prices) : 0;

    // Calculate Domain
    let calcMin = minPrice;
    let calcMax = maxPrice;

    // Smart Scaling for 'Seit Kauf':
    // Only expand to show purchasePrice if it doesn't compress the data too much.
    // If the data range becomes < 15% of the total range (due to a far-away purchase price),
    // we prioritize showing the curve details over the purchase line.
    if (selectedRange === 'BUY' && effectivePurchasePrice && effectivePurchasePrice > 0) {
        const potentialMin = Math.min(calcMin, effectivePurchasePrice);
        const potentialMax = Math.max(calcMax, effectivePurchasePrice);

        const dataRange = calcMax - calcMin;
        const potentialRange = potentialMax - potentialMin;

        if (dataRange === 0 || (dataRange / potentialRange) > 0.15) {
            calcMin = potentialMin;
            calcMax = potentialMax;
        }
    }

    // Smart Domain Expansion for Strategy Lines (Ø Kauf, Kauflimit, Fairer Wert, Modell-Kaufpreis):
    // Always expand domain to accommodate active strategy lines (Kauflimit, Fairer Wert & Modell-Kaufpreis) so they are NEVER hidden on any timeframe!
    if (effectiveBuyLimit && effectiveBuyLimit > 0) {
        calcMin = Math.min(calcMin, effectiveBuyLimit);
        calcMax = Math.max(calcMax, effectiveBuyLimit);
    }
    if (effectiveModelBuyPrice && effectiveModelBuyPrice > 0) {
        calcMin = Math.min(calcMin, effectiveModelBuyPrice);
        calcMax = Math.max(calcMax, effectiveModelBuyPrice);
    }
    if (effectiveFairValue && effectiveFairValue > 0) {
        calcMin = Math.min(calcMin, effectiveFairValue);
        calcMax = Math.max(calcMax, effectiveFairValue);
    }
    if (effectivePurchasePrice && effectivePurchasePrice > 0) {
        // Expand for purchase price if it's within a reasonable distance (so it doesn't compress intraday charts too much)
        const activeSpan = calcMax - calcMin;
        if (activeSpan > 0) {
            if (effectivePurchasePrice >= calcMin - activeSpan * 0.8 && effectivePurchasePrice <= calcMax + activeSpan * 0.8) {
                calcMin = Math.min(calcMin, effectivePurchasePrice);
                calcMax = Math.max(calcMax, effectivePurchasePrice);
            }
        } else {
            calcMin = Math.min(calcMin, effectivePurchasePrice);
            calcMax = Math.max(calcMax, effectivePurchasePrice);
        }
    }

    const range = calcMax - calcMin;
    const padding = range === 0 ? calcMax * 0.05 : range * 0.05;
    const domainMin = Math.max(0, calcMin - padding);
    const domainMax = calcMax + padding;

    // Helper: Offset Y for right-side labels so they never collide if two lines are very close
    const getRightLabelYOffset = (val: number, otherVals: (number | undefined)[]) => {
        const chartSpan = domainMax - domainMin;
        if (chartSpan <= 0) return -4;
        for (const other of otherVals) {
            if (other && Math.abs(val - other) / chartSpan < 0.038) {
                return val < other ? 11 : -5;
            }
        }
        return -4;
    };

    // SMA calculation logic
    const sma200Data = useMemo(() => {
        // Do not display 200-day line on intraday or short ranges (1D, 1W, 1M)
        // 3M, 6M, 1Y, 3Y, 5Y and BUY display the accurate 200-day moving average
        if (['1D', '1W', '1M'].includes(selectedRange)) return null;

        if (!data || data.length === 0) return null;

        // 1. If data already has precomputed 200-day moving average from yahoo-finance service, use it!
        const hasPrecomputed = data.some(d => d.sma200 !== undefined && d.sma200 !== null);
        if (hasPrecomputed) {
            // Find the first valid calculated SMA value to backfill any leading nulls
            // so the line starts at Day 1 (index 0) and spans 100% of the visible chart (all 365 days / 3 years / 5 years)
            const firstValidSma = data.find(d => typeof d.sma200 === 'number' && !isNaN(d.sma200))?.sma200 ?? null;
            return data.map(d => ({
                date: d.date,
                value: (d.sma200 !== undefined && d.sma200 !== null) ? d.sma200 : firstValidSma
            }));
        }

        // 2. Fallback for mock/demo data:
        // For weekly data (5Y, BUY), 200 trading days is 40 weeks (40 * 5 = 200):
        const windowSize = (selectedRange === '5Y' || selectedRange === 'BUY') ? 40 : 200;

        // Compute rolling SMA, backfilling initial points so the line spans across the ENTIRE chart from day 1
        const smaPoints: { date: string; value: number | null }[] = [];
        let firstCalculatedSma: number | null = null;
        if (data.length >= windowSize) {
            const initialSlice = data.slice(0, windowSize);
            firstCalculatedSma = initialSlice.reduce((acc, curr) => acc + curr.value, 0) / windowSize;
        } else {
            firstCalculatedSma = data.reduce((acc, curr) => acc + curr.value, 0) / data.length;
        }

        for (let i = 0; i < data.length; i++) {
            if (i >= windowSize - 1) {
                const slice = data.slice(i - windowSize + 1, i + 1);
                const sum = slice.reduce((acc, curr) => acc + curr.value, 0);
                smaPoints.push({ date: data[i].date, value: sum / windowSize });
            } else {
                smaPoints.push({ date: data[i].date, value: firstCalculatedSma });
            }
        }
        return smaPoints;
    }, [data, selectedRange]);

    // Filter display data based on selectedRange (Client-Side Slicing)
    const displayData = useMemo(() => {
        let displayPoints = [...data];

        // Merge SMA
        if (sma200Data) {
            const smaMap = new Map(sma200Data.map(s => [s.date, s.value]));
            return displayPoints.map(p => ({
                ...p,
                sma200: smaMap.has(p.date) ? (smaMap.get(p.date) ?? null) : null
            }));
        }
        return displayPoints;
    }, [data, selectedRange, sma200Data]);

    const hasPre = useMemo(() => (displayData || []).some(p => p.session === 'pre'), [displayData]);
    const hasPost = useMemo(() => (displayData || []).some(p => p.session === 'post'), [displayData]);
    const hasPrePostData = hasPre || hasPost;

    const totalDurationDays = useMemo(() => {
        if (!displayData || displayData.length < 2) return 0;
        const start = new Date(displayData[0].date).getTime();
        const end = new Date(displayData[displayData.length - 1].date).getTime();
        return Math.max(0, (end - start) / (1000 * 60 * 60 * 24));
    }, [displayData]);

    const purchaseMarkers = useMemo(() => {
        if (!displayData || displayData.length === 0) return [];

        const parseDate = (dStr: string | undefined): number | null => {
            if (!dStr) return null;
            try {
                if (typeof dStr === 'string' && dStr.includes('.')) {
                    const parts = dStr.trim().split('.');
                    if (parts.length === 3) {
                        const d = parseInt(parts[0], 10);
                        const m = parseInt(parts[1], 10);
                        let y = parseInt(parts[2], 10);
                        if (y < 100) y += 2000;
                        const dt = new Date(y, m - 1, d);
                        return isNaN(dt.getTime()) ? null : dt.getTime();
                    }
                }
                const dt = new Date(dStr);
                return isNaN(dt.getTime()) ? null : dt.getTime();
            } catch {
                return null;
            }
        };

        const rawList = (purchases && purchases.length > 0)
            ? purchases
            : (purchasePrice ? [{ id: 'single', date: purchaseDate || '', price: purchasePrice, shares: undefined }] : []);

        if (rawList.length === 0) return [];

        const chartStart = new Date(displayData[0].date).getTime();
        const chartEnd = new Date(displayData[displayData.length - 1].date).getTime();
        const oneDay = 86400000;

        const validList = rawList
            .map(p => ({ ...p, time: parseDate(p.date) }))
            .filter((p): p is typeof p & { time: number } => p.time !== null)
            .sort((a, b) => a.time - b.time);

        const isMulti = validList.length > 1;

        return validList.map((p, index) => {
            if (p.time < (chartStart - oneDay) || p.time > (chartEnd + oneDay)) {
                return null;
            }

            let closest = displayData[0];
            let minDiff = Math.abs(new Date(closest.date).getTime() - p.time);
            for (let i = 1; i < displayData.length; i++) {
                const diff = Math.abs(new Date(displayData[i].date).getTime() - p.time);
                if (diff < minDiff) {
                    minDiff = diff;
                    closest = displayData[i];
                }
            }

            const formattedDate = new Date(p.time).toLocaleDateString('de-CH', {
                day: '2-digit',
                month: '2-digit',
                year: '2-digit'
            });

            const effectivePrice = p.price * conversionRate;
            const priceFormatted = formatCurrency(effectivePrice, displayCurrency, false);

            const labelText = isMulti
                ? `Kauf ${index + 1}: ${formattedDate} (${priceFormatted})`
                : `Kauf: ${formattedDate}`;

            const tooltipText = isMulti
                ? `Kauf ${index + 1}: ${formattedDate}${p.shares ? ` · ${p.shares.toLocaleString('de-CH')} Stk.` : ''} @ ${priceFormatted}`
                : `Kauf: ${formattedDate}${p.shares ? ` · ${p.shares.toLocaleString('de-CH')} Stk.` : ''} @ ${priceFormatted}`;

            return {
                id: p.id || `purchase-${index}`,
                dateKey: closest.date,
                effectivePrice,
                labelText,
                tooltipText,
                shares: p.shares,
                index
            };
        }).filter((m): m is NonNullable<typeof m> => m !== null);
    }, [purchases, purchasePrice, purchaseDate, displayData, conversionRate, displayCurrency, formatCurrency]);

    const { minPoint, maxPoint } = useMemo(() => {
        if (!displayData || displayData.length === 0) {
            return { minPoint: null, maxPoint: null };
        }
        let minP = displayData[0];
        let maxP = displayData[0];
        displayData.forEach((p) => {
            if (p.value < minP.value) minP = p;
            if (p.value > maxP.value) maxP = p;
        });
        return { minPoint: minP, maxPoint: maxP };
    }, [displayData]);

    const highMeasureIdx = useMemo(() => {
        if (!maxPoint) return -1;
        return measurePoints.findIndex(p => p.extremumType === 'high' || (p.date === maxPoint.date && Math.abs(p.value - maxPoint.value) < 0.0001));
    }, [measurePoints, maxPoint]);

    const lowMeasureIdx = useMemo(() => {
        if (!minPoint) return -1;
        return measurePoints.findIndex(p => p.extremumType === 'low' || (p.date === minPoint.date && Math.abs(p.value - minPoint.value) < 0.0001));
    }, [measurePoints, minPoint]);

    const handleExtremumMeasure = (type: 'high' | 'low') => {
        const pt = type === 'high' ? maxPoint : minPoint;
        if (!pt) return;

        setSelectedExtremum(null);

        const newPt: MeasurePoint = {
            date: pt.date,
            value: pt.value,
            label: type === 'high' ? 'Hoch (H)' : 'Tief (T)',
            extremumType: type
        };

        setMeasurePoints(prev => {
            if (prev.length >= 2) {
                return [newPt];
            }
            if (prev.length === 1 && (prev[0].extremumType === type || (prev[0].date === newPt.date && Math.abs(prev[0].value - newPt.value) < 0.0001))) {
                return [];
            }
            return [...prev, newPt];
        });
    };

    const formatPointDate = (dateStr: string) => {
        try {
            const d = new Date(dateStr);
            if (selectedRange === '1D') {
                return d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) + (isNarrowPortrait ? '' : ' Uhr');
            }
            if (selectedRange === '1W') {
                const weekday = d.toLocaleDateString('de-DE', { weekday: 'short' });
                const date = d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
                return isNarrowPortrait ? date : `${weekday} ${date}`;
            }
            return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' });
        } catch {
            return dateStr;
        }
    };

    const measurement = useMemo(() => {
        if (measurePoints.length !== 2) return null;
        const p1 = measurePoints[0];
        const p2 = measurePoints[1];
        const diff = p2.value - p1.value;
        const percent = p1.value !== 0 ? (diff / p1.value) * 100 : 0;
        return { p1, p2, diff, percent };
    }, [measurePoints]);

    const fibonacciData = useMemo(() => {
        if (!showFibonacci || !isFullscreen) return null;

        let highVal: number | null = null;
        let lowVal: number | null = null;

        if (measurement) {
            highVal = Math.max(measurement.p1.value, measurement.p2.value);
            lowVal = Math.min(measurement.p1.value, measurement.p2.value);
        } else if (maxPoint && minPoint && maxPoint.value > minPoint.value) {
            highVal = maxPoint.value;
            lowVal = minPoint.value;
        }

        if (highVal === null || lowVal === null || highVal <= lowVal) {
            return null;
        }

        const delta = highVal - lowVal;

        const ratios = [
            { ratio: 0.000, label: '0.0%', name: 'Hoch', color: '#10b981', dash: '3 3' },
            { ratio: 0.236, label: '23.6%', name: '', color: '#06b6d4', dash: '2 2' },
            { ratio: 0.382, label: '38.2%', name: '', color: '#38bdf8', dash: '2 2' },
            { ratio: 0.500, label: '50.0%', name: 'Mitte', color: '#a855f7', dash: '3 3' },
            { ratio: 0.618, label: '61.8%', name: 'Goldener Schnitt', color: '#eab308', dash: '2 2' },
            { ratio: 0.786, label: '78.6%', name: 'Support', color: '#f472b6', dash: '2 2' },
            { ratio: 1.000, label: '100.0%', name: 'Tief', color: '#f87171', dash: '3 3' }
        ];

        const levels = ratios.map(r => {
            const price = highVal! - (r.ratio * delta);
            return {
                ...r,
                price,
                formattedPrice: formatCurrency(price, displayCurrency, false)
            };
        });

        return {
            highVal,
            lowVal,
            delta,
            levels,
            isFromMeasurement: !!measurement
        };
    }, [showFibonacci, isFullscreen, measurement, maxPoint, minPoint, formatCurrency, displayCurrency]);

    const chartContent = (
        <div className={cn(
            "w-full flex flex-col relative transition-all duration-300 select-none",
            isFullscreen
                ? "fixed inset-0 z-[9999] bg-background dark:bg-[#080d1a] p-3 sm:p-6 lg:p-8 flex flex-col w-screen h-screen overflow-hidden"
                : "min-h-[340px] landscape:min-h-0 h-auto flex-1 pb-0 landscape:pb-0"
        )}>
            <div className="flex flex-wrap items-center justify-between mb-2 md:mb-3 landscape:mb-1.5 gap-2 relative">
                <div className="flex flex-col gap-0.5 w-full sm:w-auto">
                    <div className="flex items-center gap-2.5 sm:gap-3">
                        {stockLogoUrl && isFullscreen && (
                            <div className="shrink-0 flex items-center justify-center">
                                <Logo
                                    url={stockLogoUrl}
                                    alt={stockName || 'Aktie'}
                                    size="size-10 sm:size-12"
                                    fallback={
                                        <span className="text-sm sm:text-base font-bold">
                                            {(stockSymbol || stockName || '').slice(0, 2).toUpperCase()}
                                        </span>
                                    }
                                />
                            </div>
                        )}
                        <div className="flex flex-col gap-0.5 min-w-0">
                            {stockName && (
                                <div className="flex items-center gap-2 mb-0.5 landscape:mb-0.5">
                                    <h4 className="text-base sm:text-2xl landscape:text-lg font-black tracking-tighter text-foreground drop-shadow-sm">
                                        <StockName name={stockName} />
                                    </h4>
                                    {isMarketOpen ? (
                                        <div 
                                            className="size-2 md:size-2.5 rounded-full bg-green-500 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.5)] cursor-help border border-background shrink-0" 
                                            title="Markt geöffnet (Live)" 
                                        />
                                    ) : (
                                        <div 
                                            className="size-2 md:size-2.5 rounded-full bg-red-500 cursor-help border border-background shrink-0" 
                                            title="Markt geschlossen" 
                                        />
                                    )}
                                    {stockSymbol && (
                                        <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                                            {stockSymbol}
                                        </span>
                                    )}
                                </div>
                            )}
                            <div className="flex items-center gap-2 flex-wrap">
                                <p className="text-sm landscape:text-xs text-muted-foreground">Performance · {formatRangeLabel(selectedRange)}</p>
                                <span className="text-xs text-muted-foreground italic select-none">
                                    · {historyData && historyData.length > 0 ? 'Marktdaten Yahoo Finance' : 'Demo-Modus'}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Price, Performance & Hoch/Tief in a Single Unified Row */}
                    <div className="relative flex flex-wrap items-center gap-x-3.5 sm:gap-x-4 gap-y-1.5 mt-0.5 min-h-[32px] sm:min-h-0">
                        {/* Current Price, Date & Performance Diff */}
                        <div className="flex items-baseline gap-2 sm:gap-2.5 shrink-0">
                            {(effectiveCurrentPrice > 0 || endPrice > 0) && (
                                <span className="text-xl sm:text-2xl landscape:text-lg font-black tabular-nums text-foreground tracking-tight">
                                    {formatCurrency(effectiveCurrentPrice > 0 ? effectiveCurrentPrice : endPrice, displayCurrency, false)}
                                </span>
                            )}
                            {effectiveDateStr && (
                                <span className="text-xs sm:text-sm font-semibold text-muted-foreground tabular-nums whitespace-nowrap">
                                    {effectiveDateStr}
                                </span>
                            )}
                            <div className={cn("font-bold flex items-baseline gap-1 text-base sm:text-xl landscape:text-base tabular-nums", isPositive ? "text-green-600 dark:text-green-400" : "text-red-500")}>
                                <span>{performance > 0 ? '+' : ''}{performance.toFixed(2)}%</span>
                                <span className="ml-1.5 opacity-90 text-sm sm:text-lg landscape:text-xs">{diffNativeFormatted}</span>
                            </div>
                        </div>

                        {/* Hoch / Tief Indicators (H / T) beside Current Price */}
                        <div className={cn(
                            "flex flex-wrap items-center gap-2 sm:gap-3 text-sm sm:text-lg landscape:text-sm md:landscape:text-lg font-bold text-foreground transition-opacity duration-150 select-none sm:border-l sm:border-border/60 sm:pl-3.5",
                            hoveredData && "opacity-0 sm:opacity-100"
                        )}>
                            <div className="flex items-center gap-1">
                                <button
                                    type="button"
                                    data-extremum-btn="true"
                                    onClick={() => {
                                        if (isMeasureMode) {
                                            handleExtremumMeasure('high');
                                        } else {
                                            setSelectedExtremum(prev => prev === 'high' ? null : 'high');
                                        }
                                    }}
                                    className={cn(
                                        "inline-flex items-center gap-1.5 px-2 py-0.5 -mx-1 rounded-lg transition-all cursor-pointer active:scale-95 border text-sm sm:text-lg landscape:text-sm md:landscape:text-lg font-bold",
                                        isMeasureMode
                                            ? highMeasureIdx >= 0
                                                ? "bg-emerald-600 text-white border-emerald-500 shadow-md ring-2 ring-emerald-400/50"
                                                : "border-blue-400/60 bg-blue-500/10 hover:bg-blue-500/20 text-foreground"
                                            : selectedExtremum === 'high'
                                                ? "bg-emerald-500/20 border-emerald-500 text-foreground shadow-sm"
                                                : "border-transparent hover:bg-muted/60 text-foreground"
                                    )}
                                    title={
                                        isMeasureMode
                                            ? highMeasureIdx >= 0
                                                ? `Hoch ist Messpunkt ${highMeasureIdx + 1} (Klicken zum Entfernen)`
                                                : measurePoints.length === 0
                                                    ? "Hoch als 1. Messpunkt wählen"
                                                    : "Hoch als 2. Messpunkt wählen"
                                            : "Klicken, um das Hoch im Chart zu markieren"
                                    }
                                >
                                    <span className={cn(
                                        "font-extrabold",
                                        isMeasureMode && highMeasureIdx >= 0 ? "text-white" : "text-emerald-500 dark:text-emerald-400"
                                    )}>H:</span>
                                    <span className={cn("font-bold", isMeasureMode && highMeasureIdx >= 0 ? "text-white" : "text-foreground")}>
                                        {formatCurrency(maxPrice, displayCurrency, false)}
                                    </span>
                                    {isMeasureMode && (
                                        <span className={cn(
                                            "text-[10px] px-1.5 py-0.5 rounded font-bold ml-0.5 leading-none",
                                            highMeasureIdx >= 0
                                                ? "bg-black/30 text-white shadow-sm"
                                                : "bg-blue-500/20 text-blue-400 border border-blue-400/40"
                                        )}>
                                            {highMeasureIdx >= 0 ? `P${highMeasureIdx + 1}` : 'Messpunkt'}
                                        </span>
                                    )}
                                </button>
                            </div>
                            <div className="flex items-center gap-1">
                                <button
                                    type="button"
                                    data-extremum-btn="true"
                                    onClick={() => {
                                        if (isMeasureMode) {
                                            handleExtremumMeasure('low');
                                        } else {
                                            setSelectedExtremum(prev => prev === 'low' ? null : 'low');
                                        }
                                    }}
                                    className={cn(
                                        "inline-flex items-center gap-1.5 px-2 py-0.5 -mx-1 rounded-lg transition-all cursor-pointer active:scale-95 border text-sm sm:text-lg landscape:text-sm md:landscape:text-lg font-bold",
                                        isMeasureMode
                                            ? lowMeasureIdx >= 0
                                                ? "bg-rose-600 text-white border-rose-500 shadow-md ring-2 ring-rose-400/50"
                                                : "border-blue-400/60 bg-blue-500/10 hover:bg-blue-500/20 text-foreground"
                                            : selectedExtremum === 'low'
                                                ? "bg-rose-500/20 border-rose-500 text-foreground shadow-sm"
                                                : "border-transparent hover:bg-muted/60 text-foreground"
                                    )}
                                    title={
                                        isMeasureMode
                                            ? lowMeasureIdx >= 0
                                                ? `Tief ist Messpunkt ${lowMeasureIdx + 1} (Klicken zum Entfernen)`
                                                : measurePoints.length === 0
                                                    ? "Tief als 1. Messpunkt wählen"
                                                    : "Tief als 2. Messpunkt wählen"
                                            : "Klicken, um das Tief im Chart zu markieren"
                                    }
                                >
                                    <span className={cn(
                                        "font-extrabold",
                                        isMeasureMode && lowMeasureIdx >= 0 ? "text-white" : "text-rose-500 dark:text-rose-400"
                                    )}>T:</span>
                                    <span className={cn("font-bold", isMeasureMode && lowMeasureIdx >= 0 ? "text-white" : "text-foreground")}>
                                        {formatCurrency(minPrice, displayCurrency, false)}
                                    </span>
                                    {isMeasureMode && (
                                        <span className={cn(
                                            "text-[10px] px-1.5 py-0.5 rounded font-bold ml-0.5 leading-none",
                                            lowMeasureIdx >= 0
                                                ? "bg-black/30 text-white shadow-sm"
                                                : "bg-blue-500/20 text-blue-400 border border-blue-400/40"
                                        )}>
                                            {lowMeasureIdx >= 0 ? `P${lowMeasureIdx + 1}` : 'Messpunkt'}
                                        </span>
                                    )}
                                </button>
                            </div>
                            {/* Selected Extremum Date & Time Tag (relocated from bottom) */}
                            {selectedExtremum && (selectedExtremum === 'high' ? maxPoint : minPoint) && (() => {
                                const pt = (selectedExtremum === 'high' ? maxPoint : minPoint)!;
                                const d = new Date(pt.date);
                                const dateTimeStr = selectedRange === '1D'
                                    ? `${d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })} • ${d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}`
                                    : ['1W', '1M', '3M', '6M'].includes(selectedRange)
                                        ? `${d.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' })} • ${d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}`
                                        : d.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' });
                                return (
                                    <div className={cn(
                                        "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg border text-xs font-bold text-foreground shadow-sm animate-in fade-in duration-150 ml-1 select-none",
                                        selectedExtremum === 'high'
                                            ? "bg-emerald-500/15 border-emerald-500/70 text-emerald-600 dark:text-emerald-400"
                                            : "bg-rose-500/15 border-rose-500/70 text-rose-600 dark:text-rose-400"
                                    )}>
                                        <span className={cn("size-2 rounded-full shrink-0", selectedExtremum === 'high' ? "bg-emerald-500" : "bg-rose-500")} />
                                        <span>{dateTimeStr}</span>
                                    </div>
                                );
                            })()}
                        </div>

                        {/* Mobile-Only Hover Info (Directly over H/T & Price on touch) */}
                        {hoveredData && (
                            <div className="flex sm:hidden justify-between items-center gap-2 text-sm animate-in fade-in duration-150 z-20 bg-card px-3 py-1.5 rounded-xl border border-border shadow-lg absolute inset-x-0 -top-0.5">
                                <div className="flex flex-col items-start leading-tight">
                                    <span className="font-bold text-sm text-foreground whitespace-nowrap">
                                        {(() => {
                                            const d = new Date(hoveredData.date);
                                            const weekday = d.toLocaleDateString('de-DE', { weekday: 'short' });
                                            const dateStr = d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' });
                                            return `${weekday} ${dateStr}`;
                                        })()}
                                    </span>
                                    <span className="text-xs font-semibold text-foreground">
                                        {new Date(hoveredData.date).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                </div>
                                <div className="h-7 w-px bg-border shrink-0" />
                                <div className="flex flex-col items-end leading-tight">
                                    <div className="flex items-center gap-1.5">
                                        <div className={cn("size-2 rounded-full shrink-0 shadow-sm", isPositive ? "bg-green-500" : "bg-red-500")} />
                                        <span className="font-bold text-sm tabular-nums text-foreground whitespace-nowrap">
                                            {formatCurrency(hoveredData.value, displayCurrency, false)}
                                        </span>
                                    </div>
                                    <span className="text-xs font-semibold text-foreground">Kurs</span>
                                </div>
                                {hoveredData.sma200 && (
                                    <>
                                        <div className="h-8 w-px bg-border shrink-0" />
                                        <div className="flex flex-col items-end leading-snug">
                                            <div className="flex items-center gap-1.5">
                                                <div className="size-2 rounded-full bg-amber-500 shadow-sm shrink-0" />
                                                <span className="font-bold text-xs tabular-nums text-foreground whitespace-nowrap">
                                                    {formatCurrency(hoveredData.sma200, displayCurrency, false)}
                                                </span>
                                                {(() => {
                                                    const diff = ((hoveredData.value - hoveredData.sma200) / hoveredData.sma200) * 100;
                                                    return (
                                                        <span className={cn(
                                                            "font-bold text-xs tabular-nums",
                                                            diff >= 0 ? "text-green-500" : "text-red-500"
                                                        )}>
                                                            {diff > 0 ? '+' : ''}{diff.toFixed(2)}%
                                                        </span>
                                                    );
                                                })()}
                                            </div>
                                            <span className="text-xs text-amber-500 font-bold">SMA 200</span>
                                        </div>
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                </div>
                {isFullscreen && (
                    <div className="flex flex-col items-end gap-1.5 shrink-0 ml-auto self-start">
                        <button
                            type="button"
                            onClick={handleToggleFullscreen}
                            className="h-7 inline-flex items-center justify-center gap-1.5 px-2.5 rounded-lg border text-xs font-semibold leading-none py-0 transition-all shadow-2xs bg-amber-500/15 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/40 dark:border-amber-400/50 hover:bg-amber-500 hover:text-white dark:hover:bg-amber-500 dark:hover:text-white hover:border-amber-400 active:scale-95 cursor-pointer shrink-0"
                            title="Großansicht schließen (Esc)"
                        >
                            <Minimize2 className="size-3.5 shrink-0" />
                            <span>Verkleinern</span>
                            <span className="text-[9px] font-mono opacity-80 hidden md:inline ml-0.5">Esc</span>
                        </button>
                        {(!isMeasureMode || onRefresh) && (
                            <div className="flex items-center gap-2">
                                {!isMeasureMode && (
                                    <DelayedDataBadge
                                        quoteDate={quoteDate}
                                        lastDataDate={data && data.length > 0 ? new Date(data[data.length - 1].date) : null}
                                        isMarketOpen={isMarketOpen}
                                    />
                                )}
                                {onRefresh && !isMeasureMode && (
                                    <button
                                        type="button"
                                        onClick={onRefresh}
                                        disabled={isRefreshing}
                                        className={cn(
                                            "h-7 inline-flex items-center gap-1.5 px-2.5 rounded-lg border text-xs font-semibold leading-none py-0 transition-all shadow-sm",
                                            "bg-blue-600 text-white border-blue-700 hover:bg-blue-700 hover:border-blue-800",
                                            "active:scale-95 shrink-0 cursor-pointer",
                                            isRefreshing && "opacity-50 cursor-not-allowed"
                                        )}
                                        title={typeof minutesAgo === 'number' ? `Zuletzt aktualisiert: Vor ${minutesAgo} Min. Klick zum Aktualisieren.` : 'Kursdaten aktualisieren'}
                                    >
                                        <RefreshCw className={cn("size-3.5 shrink-0", isRefreshing && "animate-spin")} />
                                        <span className="whitespace-nowrap font-bold">
                                            {isRefreshing ? 'Laden...' : typeof minutesAgo === 'number' ? `Vor ${minutesAgo} Min` : 'Laden'}
                                        </span>
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>

            <div className="flex flex-wrap items-center gap-2 mb-2 md:mb-4 landscape:mb-1.5 min-h-[38px]">
                {(() => {
                    const toolbarToggleClass = "h-7 inline-flex items-center justify-center gap-1.5 px-2.5 sm:px-3 py-0 rounded-lg border text-[11px] sm:text-xs font-bold leading-none transition-all shadow-sm whitespace-nowrap cursor-pointer";
                    return (
                        <div className="flex flex-wrap items-center gap-2 max-w-full">
                            {/* Group 1: Time range segmented bar */}
                            <div className="flex bg-muted/50 p-0.5 rounded-lg items-center gap-0.5 overflow-x-auto scroller-none shrink-0">
                                {(['1D', '1W', '1M', '3M', '6M', '1Y', '3Y', '5Y', 'BUY'] as TimeRange[]).map((range) => (
                                    <button
                                        key={range}
                                        onClick={() => handleRangeChange(range)}
                                        className={cn(
                                            "h-7 inline-flex items-center justify-center px-2 sm:px-3 py-0 text-xs font-medium leading-none rounded-md border transition-all whitespace-nowrap",
                                            selectedRange === range
                                                ? "bg-background border-slate-300/80 dark:border-slate-500/50 shadow-sm text-foreground"
                                                : "border-transparent text-muted-foreground hover:text-foreground hover:bg-background/70"
                                        )}
                                    >
                                        {range === 'BUY' ? <><span className="sm:hidden">SK</span><span className="hidden sm:inline">Seit Kauf</span></> : formatRangeLabel(range)}
                                    </button>
                                ))}
                            </div>

                            {/* Group 2: Currency & Pre/Post */}
                            {(canConvert || (selectedRange === '1D' && onTogglePrePost)) && (
                                <div className="flex items-center gap-1.5 shrink-0">
                                    {canConvert && (
                                        <button
                                            onClick={() => setShowInCHF(!showInCHF)}
                                            className={cn(
                                                toolbarToggleClass,
                                                showInCHF
                                                    ? "bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-700"
                                                    : "bg-background text-muted-foreground border-slate-300/80 dark:border-slate-500/50 hover:bg-emerald-500/15 hover:text-emerald-600 dark:hover:text-emerald-400 hover:border-emerald-500/50"
                                            )}
                                            title="Währung in CHF umschalten"
                                        >
                                            <span className={cn("text-[10px] sm:text-xs font-bold leading-none", showInCHF ? "text-white" : "")}>CHF</span>
                                        </button>
                                    )}

                                    {selectedRange === '1D' && onTogglePrePost && (
                                        <button
                                            type="button"
                                            onClick={onTogglePrePost}
                                            className={cn(
                                                toolbarToggleClass,
                                                showPrePost
                                                    ? "bg-indigo-600 hover:bg-indigo-500 text-white border-indigo-700"
                                                    : "bg-background text-muted-foreground border-slate-300/80 dark:border-slate-500/50 hover:bg-indigo-500/15 hover:text-indigo-600 dark:hover:text-indigo-400 hover:border-indigo-500/50"
                                            )}
                                            title="Vor- und nachbörsliche Kurse (Pre-Market / After-Hours) im 1D-Chart ein-/ausblenden"
                                        >
                                            <span className={cn("text-[10px] sm:text-xs font-bold leading-none", showPrePost ? "text-white" : "")}>Vor-/Nachbörse</span>
                                        </button>
                                    )}
                                </div>
                            )}

                            {/* Group 3: Analysis Tools, Valuation Mode & Fullscreen */}
                            <div className="flex flex-wrap items-center gap-1.5">
                                <button
                                    onClick={() => {
                                        setIsMeasureMode(prev => {
                                            const next = !prev;
                                            setMeasurePoints([]);
                                            if (next) setSelectedExtremum(null);
                                            return next;
                                        });
                                    }}
                                    className={cn(
                                        toolbarToggleClass,
                                        isMeasureMode
                                            ? "bg-blue-600 hover:bg-blue-500 text-white border-blue-700 ring-1 ring-blue-400/50"
                                            : "bg-blue-50 dark:bg-blue-900/10 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-500/40 hover:bg-blue-100 dark:hover:bg-blue-900/25"
                                    )}
                                    title="Messmodus: Punkte im Chart anklicken oder Hoch (H) / Tief (T) wählen"
                                >
                                    <Ruler className="size-3.5 shrink-0" />
                                    <span className="text-[10px] sm:text-xs font-bold leading-none hidden sm:inline">Messen</span>
                                </button>
                                <div className="inline-flex items-center">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setShowFibonacci(prev => {
                                                const next = !prev;
                                                if (next) {
                                                    if (!isFullscreen) handleToggleFullscreen();
                                                    handleRangeChange('3M');
                                                }
                                                return next;
                                            });
                                        }}
                                        className={cn(
                                            toolbarToggleClass,
                                            "rounded-r-none border-r-0",
                                            showFibonacci
                                                ? "bg-purple-600 hover:bg-purple-500 text-white border-purple-700 ring-1 ring-purple-400/50"
                                                : "bg-purple-50 dark:bg-purple-900/10 text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-500/40 hover:bg-purple-100 dark:hover:bg-purple-900/25"
                                        )}
                                        title="Fibonacci-Retracements im Chart anzeigen (öffnet Großansicht)"
                                    >
                                        <span className="font-serif font-black text-xs leading-none">Φ</span>
                                        <span className="text-[10px] sm:text-xs font-bold leading-none hidden sm:inline">Fibonacci</span>
                                    </button>
                                    <InfoHelp
                                        title="Fibonacci-Anwendung & Goldener Schnitt"
                                        items={FIBONACCI_INFO_ITEMS}
                                        buttonClassName={cn(
                                            "h-7 w-7 inline-flex items-center justify-center rounded-r-lg border text-xs font-bold leading-none transition-all shadow-sm cursor-pointer shrink-0",
                                            showFibonacci
                                                ? "bg-purple-600 text-white border-purple-700 hover:bg-purple-500"
                                                : "bg-purple-50 dark:bg-purple-900/10 text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-500/40 hover:bg-purple-100 dark:hover:bg-purple-900/25"
                                        )}
                                        trigger={<HelpCircle className="size-3.5 shrink-0" />}
                                        footer={
                                            <div className="p-3 rounded-lg bg-purple-500/10 border border-purple-500/20 text-xs">
                                                <p className="font-bold text-purple-700 dark:text-purple-300 mb-0.5">
                                                    Praxis-Tipp für dein Portfolio:
                                                </p>
                                                <p className="text-muted-foreground">
                                                    Achte vor allem auf den <strong>1J- und 3J-Goldenen Schnitt</strong> (61.8%). Wenn der Kurs dort ankommt und zugleich dein <strong>Fairer Wert</strong>, <strong>Kauflimit</strong> oder die <strong>200-Tage-Linie</strong> in der Nähe liegen, ist das eine der stärksten Kauf- und Unterstützungszonen überhaupt!
                                                </p>
                                            </div>
                                        }
                                    />
                                </div>
                                {onToggleValuationMode && valuationMode && (
                                    <button
                                        type="button"
                                        onClick={onToggleValuationMode}
                                        className={cn(
                                            toolbarToggleClass,
                                            valuationMode === 'conservative'
                                                ? "bg-blue-50 dark:bg-blue-900/15 text-blue-600 dark:text-blue-400 border-blue-300 dark:border-blue-500/40 hover:bg-blue-100 dark:hover:bg-blue-900/30"
                                                : valuationMode === 'quality'
                                                    ? "bg-purple-50 dark:bg-purple-900/15 text-purple-600 dark:text-purple-400 border-purple-300 dark:border-purple-500/40 hover:bg-purple-100 dark:hover:bg-purple-900/30"
                                                    : valuationMode === 'risk'
                                                        ? "bg-amber-50 dark:bg-amber-900/15 text-amber-600 dark:text-amber-400 border-amber-300 dark:border-amber-500/40 hover:bg-amber-100 dark:hover:bg-amber-900/30"
                                                        : "bg-pink-50 dark:bg-pink-900/15 text-pink-600 dark:text-pink-400 border-pink-300 dark:border-pink-500/40 hover:bg-pink-100 dark:hover:bg-pink-900/30"
                                        )}
                                        title={
                                            valuationMode === 'conservative'
                                                ? "Sichtweise Sicherheit A: Klick wechselt zu Qualität B"
                                                : valuationMode === 'quality'
                                                    ? "Sichtweise Qualität B: Klick wechselt zu Risiko C"
                                                    : valuationMode === 'risk'
                                                        ? "Sichtweise Risiko C: Klick wechselt zu Manuell"
                                                        : "Sichtweise Manuell: Klick wechselt zu Sicherheit A"
                                        }
                                    >
                                        {valuationMode === 'conservative' && <ShieldCheck className="size-3.5 shrink-0 text-blue-500" />}
                                        {valuationMode === 'quality' && <Sparkles className="size-3.5 shrink-0 text-purple-500" />}
                                        {valuationMode === 'risk' && <TriangleAlert className="size-3.5 shrink-0 text-amber-500" />}
                                        {valuationMode === 'manual' && <Sliders className="size-3.5 shrink-0 text-pink-500" />}
                                        <span className="text-[10px] sm:text-xs font-bold leading-none hidden sm:inline">
                                            {valuationMode === 'conservative'
                                                ? 'Sicherheit A'
                                                : valuationMode === 'quality'
                                                    ? 'Qualität B'
                                                    : valuationMode === 'risk'
                                                        ? 'Risiko C'
                                                        : 'Manuell'}
                                        </span>
                                        <span className="text-[10px] font-bold leading-none sm:hidden">
                                            {valuationMode === 'conservative' ? 'A' : valuationMode === 'quality' ? 'B' : valuationMode === 'risk' ? 'C' : 'Manuell'}
                                        </span>
                                    </button>
                                )}
                            </div>
                        </div>
                    );
                })()}

                {/* Desktop Dynamic Header Info (Replaces Tooltip) */}
                {hoveredData && (
                    <div className="hidden sm:flex items-center gap-4 text-sm animate-in fade-in duration-150 z-10 border-l border-border/50 pl-3 sm:pl-5">
                        <div className="flex flex-col items-start leading-tight">
                            <span className="font-bold text-sm text-foreground whitespace-nowrap">
                                {(() => {
                                    const d = new Date(hoveredData.date);
                                    const weekday = d.toLocaleDateString('de-DE', { weekday: 'short' });
                                    const dateStr = d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' });
                                    return `${weekday} ${dateStr}`;
                                })()}
                            </span>
                            <span className="text-xs font-semibold text-foreground">
                                {new Date(hoveredData.date).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                        </div>
                        <div className="h-7 w-px bg-border" />
                        <div className="flex flex-col items-start leading-tight">
                            <div className="flex items-center gap-1.5">
                                <div className={cn("size-2 rounded-full shrink-0 shadow-sm", isPositive ? "bg-green-500" : "bg-red-500")} />
                                <span className="font-bold text-sm tabular-nums text-foreground whitespace-nowrap">
                                    {formatCurrency(hoveredData.value, displayCurrency, false)}
                                </span>
                            </div>
                            <span className="text-xs font-semibold text-foreground">
                                {hoveredData.session === 'pre'
                                    ? 'Kurs · Vorbörse'
                                    : hoveredData.session === 'post'
                                        ? 'Kurs · Nachbörse'
                                        : 'Kurs'}
                            </span>
                        </div>
                        {hoveredData.sma200 && (
                            <>
                                <div className="h-7 w-px bg-border" />
                                <div className="flex flex-col items-start leading-tight">
                                    <div className="flex items-center gap-1.5">
                                        <div className="size-2 rounded-full bg-amber-500 shadow-sm shrink-0" />
                                        <span className="font-bold text-sm tabular-nums text-foreground whitespace-nowrap">
                                            {formatCurrency(hoveredData.sma200, displayCurrency, false)}
                                        </span>
                                        {(() => {
                                            const diff = ((hoveredData.value - hoveredData.sma200) / hoveredData.sma200) * 100;
                                            return (
                                                <span className={cn(
                                                    "font-bold text-sm tabular-nums",
                                                    diff >= 0 ? "text-green-500" : "text-red-500"
                                                )}>
                                                    {diff > 0 ? '+' : ''}{diff.toFixed(2)}%
                                                </span>
                                            );
                                        })()}
                                    </div>
                                    <span className="text-xs text-amber-500 font-bold">SMA 200</span>
                                </div>
                            </>
                        )}
                    </div>
                )}
            </div>

            {isMeasureMode && (
                <div className="w-full sm:w-auto relative sm:absolute sm:top-2 sm:right-2 z-20 my-2 sm:my-0 animate-in fade-in slide-in-from-right-2 max-w-full sm:max-w-none">
                    <div className="bg-blue-600 dark:bg-blue-500 text-white px-2.5 sm:px-4 py-1.5 sm:py-2.5 rounded-xl shadow-2xl border border-blue-400/30 flex items-center justify-between sm:justify-start gap-1.5 sm:gap-3 text-xs sm:text-sm overflow-x-auto scroller-none">
                        {measurement ? (
                            <div className="flex items-center gap-2 sm:gap-3">
                                <div className={cn(
                                    "flex flex-col items-center leading-tight px-2.5 py-1 rounded-lg border shadow-sm",
                                    measurement.percent > 0
                                        ? "bg-emerald-600 text-white border-emerald-500"
                                        : measurement.percent < 0
                                            ? "bg-rose-600 text-white border-rose-500"
                                            : "bg-white/20 text-white border-white/30"
                                )}>
                                    <span className="text-base sm:text-lg font-black whitespace-nowrap text-white">
                                        {measurement.percent > 0 ? '+' : ''}{measurement.percent.toFixed(2)}%
                                    </span>
                                    <span className="text-[11px] sm:text-xs font-bold text-white/95 whitespace-nowrap">
                                        {measurement.diff > 0 ? '+' : ''}{formatCurrency(measurement.diff, displayCurrency, false)}
                                    </span>
                                </div>
                                <div className="h-7 w-px bg-white/20" />
                                <div className="flex flex-col text-[10px] sm:text-xs text-white font-medium leading-tight gap-0.5">
                                    <div className="flex justify-between items-center gap-2 sm:gap-3">
                                        <span className="font-bold text-blue-100 flex items-center gap-1.5">
                                            <span className="w-7 shrink-0">Von:</span>
                                            {measurement.p1.extremumType === 'high' ? (
                                                <span className="bg-emerald-600 text-white text-[9.5px] px-1.5 h-4 flex items-center justify-center rounded font-black shrink-0 border border-emerald-500 shadow-sm">H</span>
                                            ) : measurement.p1.extremumType === 'low' ? (
                                                <span className="bg-rose-600 text-white text-[9.5px] px-1.5 h-4 flex items-center justify-center rounded font-black shrink-0 border border-rose-500 shadow-sm">T</span>
                                            ) : (
                                                <span className="w-4 shrink-0" />
                                            )}
                                        </span>
                                        <span className="tabular-nums text-white font-bold">
                                            {formatCurrency(measurement.p1.value, displayCurrency, false)}
                                            <span className="ml-1 text-[10px] sm:text-[11px] text-blue-200 font-normal">
                                                {formatPointDate(measurement.p1.date)}
                                            </span>
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-center gap-2 sm:gap-3">
                                        <span className="font-bold text-blue-100 flex items-center gap-1.5">
                                            <span className="w-7 shrink-0">Bis:</span>
                                            {measurement.p2.extremumType === 'high' ? (
                                                <span className="bg-emerald-600 text-white text-[9.5px] px-1.5 h-4 flex items-center justify-center rounded font-black shrink-0 border border-emerald-500 shadow-sm">H</span>
                                            ) : measurement.p2.extremumType === 'low' ? (
                                                <span className="bg-rose-600 text-white text-[9.5px] px-1.5 h-4 flex items-center justify-center rounded font-black shrink-0 border border-rose-500 shadow-sm">T</span>
                                            ) : (
                                                <span className="w-4 shrink-0" />
                                            )}
                                        </span>
                                        <span className="tabular-nums text-white font-bold">
                                            {formatCurrency(measurement.p2.value, displayCurrency, false)}
                                            <span className="ml-1 text-[10px] sm:text-[11px] text-blue-200 font-normal">
                                                {formatPointDate(measurement.p2.date)}
                                            </span>
                                        </span>
                                    </div>
                                </div>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setMeasurePoints(prev => [prev[1], prev[0]]);
                                    }}
                                    className="bg-white/20 hover:bg-white/30 p-1.5 rounded-lg transition-colors flex items-center justify-center text-white shrink-0"
                                    title="Richtung umkehren (Start ⇄ Ziel)"
                                >
                                    <ArrowLeftRight className="size-3.5" />
                                </button>
                            </div>
                        ) : measurePoints.length === 1 ? (
                            <div className="flex items-center gap-2">
                                <div className="size-2 rounded-full bg-amber-300 animate-pulse shrink-0" />
                                <div className="flex flex-col leading-tight">
                                    <span className="text-xs font-bold whitespace-nowrap flex items-center gap-1.5 text-white">
                                        <span>1. Punkt:</span>
                                        {measurePoints[0].extremumType === 'high' ? (
                                            <span className="bg-emerald-600 text-white text-[9.5px] px-1.5 h-4 flex items-center justify-center rounded font-black shrink-0 border border-emerald-500 shadow-sm">H</span>
                                        ) : measurePoints[0].extremumType === 'low' ? (
                                            <span className="bg-rose-600 text-white text-[9.5px] px-1.5 h-4 flex items-center justify-center rounded font-black shrink-0 border border-rose-500 shadow-sm">T</span>
                                        ) : null}
                                        <span className="tabular-nums text-white font-bold">{formatCurrency(measurePoints[0].value, displayCurrency, false)}</span>
                                    </span>
                                    <span className="text-[10px] text-blue-100">Jetzt 2. Punkt wählen: [H], [T] oder im Chart</span>
                                </div>
                            </div>
                        ) : (
                            <div className="flex items-center gap-2">
                                <Ruler className="size-4 text-blue-200 shrink-0" />
                                <div className="flex flex-col leading-tight">
                                    <span className="text-xs font-bold whitespace-nowrap">Messmodus aktiv</span>
                                    <span className="text-[10px] text-blue-100">1. Punkt wählen: [H], [T] oder im Chart</span>
                                </div>
                            </div>
                        )}

                        {/* Quick H / T selection buttons in toolbar (untereinander ausgerichtet) */}
                        <div className="flex flex-col gap-1 pl-1.5 sm:pl-2 border-l border-white/20 justify-center">
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleExtremumMeasure('high');
                                }}
                                className={cn(
                                    "px-2 py-0.5 rounded text-[10px] font-bold transition-all flex items-center justify-between gap-1.5 border min-w-[62px]",
                                    highMeasureIdx >= 0
                                        ? "bg-emerald-600 text-white border-white/40 shadow-sm"
                                        : "bg-white/20 hover:bg-white/30 text-white border-white/20"
                                )}
                                title={
                                    highMeasureIdx >= 0
                                        ? `Hoch ist Messpunkt ${highMeasureIdx + 1}`
                                        : measurePoints.length === 0
                                            ? "Hoch als 1. Messpunkt wählen"
                                            : "Hoch als 2. Messpunkt wählen"
                                }
                            >
                                <span className="text-white">Hoch</span>
                                {highMeasureIdx >= 0 ? (
                                    <span className="bg-black/30 text-white px-1 rounded text-[8.5px] font-bold leading-none py-0.5">P{highMeasureIdx + 1}</span>
                                ) : (
                                    <span className="text-[9px] text-white/50 font-bold leading-none">H</span>
                                )}
                            </button>

                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleExtremumMeasure('low');
                                }}
                                className={cn(
                                    "px-2 py-0.5 rounded text-[10px] font-bold transition-all flex items-center justify-between gap-1.5 border min-w-[62px]",
                                    lowMeasureIdx >= 0
                                        ? "bg-rose-600 text-white border-white/40 shadow-sm"
                                        : "bg-white/20 hover:bg-white/30 text-white border-white/20"
                                )}
                                title={
                                    lowMeasureIdx >= 0
                                        ? `Tief ist Messpunkt ${lowMeasureIdx + 1}`
                                        : measurePoints.length === 0
                                            ? "Tief als 1. Messpunkt wählen"
                                            : "Tief als 2. Messpunkt wählen"
                                }
                            >
                                <span className="text-white">Tief</span>
                                {lowMeasureIdx >= 0 ? (
                                    <span className="bg-black/30 text-white px-1 rounded text-[8.5px] font-bold leading-none py-0.5">P{lowMeasureIdx + 1}</span>
                                ) : (
                                    <span className="text-[9px] text-white/50 font-bold leading-none">T</span>
                                )}
                            </button>
                        </div>

                        <div className="flex items-center gap-1 pl-1.5 sm:pl-2 border-l border-white/20">
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setShowFibonacci(prev => {
                                        const next = !prev;
                                        if (next) {
                                            if (!isFullscreen) handleToggleFullscreen();
                                            handleRangeChange('3M');
                                        }
                                        return next;
                                    });
                                }}
                                className={cn(
                                    "px-2 py-1 rounded text-[10px] font-bold transition-all flex items-center gap-1 cursor-pointer",
                                    showFibonacci
                                        ? "bg-purple-500 text-white shadow-sm"
                                        : "bg-white/20 hover:bg-white/30 text-white"
                                )}
                                title="Fibonacci-Linien für diesen Messbereich ein-/ausblenden"
                            >
                                <span className="font-serif font-black text-xs">Φ</span>
                                <span>Fibo</span>
                            </button>
                            {measurePoints.length > 0 && (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setMeasurePoints([]);
                                    }}
                                    className="bg-white/20 hover:bg-white/30 px-2 py-1 rounded text-[10px] font-bold transition-colors cursor-pointer"
                                    title="Messung zurücksetzen"
                                >
                                    Neu
                                </button>
                            )}
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setIsMeasureMode(false);
                                    setMeasurePoints([]);
                                }}
                                className="bg-white/20 hover:bg-white/40 p-1.5 rounded-full transition-colors cursor-pointer"
                                title="Messen beenden"
                            >
                                <X className="size-3.5" />
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Fibonacci Level Overview Bar */}
            {fibonacciData && (
                <div className="w-full flex flex-wrap items-center justify-between gap-2 py-1.5 px-2.5 sm:px-3 mb-2 rounded-xl bg-purple-500/10 border border-purple-500/25 text-xs animate-in fade-in duration-150">
                    <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                        <span className="font-bold text-purple-600 dark:text-purple-400 shrink-0 flex items-center gap-1 text-xs mr-0.5">
                            <span className="font-serif font-black text-sm">Φ</span>
                            <span>Fibonacci:</span>
                        </span>
                        {fibonacciData.levels.map(lvl => (
                            <span
                                key={lvl.label}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-mono font-bold bg-card border border-border shadow-2xs whitespace-nowrap"
                                style={{ color: lvl.color }}
                                title={`${lvl.label} ${lvl.name || ''}: ${lvl.formattedPrice}`}
                            >
                                <span>{lvl.label}</span>
                                <span>{lvl.formattedPrice}</span>
                                {lvl.name && <span className="text-[10px] font-sans font-bold ml-0.5">· {lvl.name}</span>}
                            </span>
                        ))}
                    </div>
                    {/* Fibonacci Infobox */}
                    <div className="shrink-0 flex items-center pl-1 border-l border-purple-500/20 ml-auto">
                        <InfoHelp
                            title="Fibonacci-Anwendung & Goldener Schnitt"
                            items={FIBONACCI_INFO_ITEMS}
                            trigger={
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-purple-500/20 hover:bg-purple-500/35 text-purple-700 dark:text-purple-300 border border-purple-500/40 transition-all cursor-pointer whitespace-nowrap shadow-2xs">
                                    <HelpCircle className="size-3 text-purple-500" />
                                    <span>Infobox</span>
                                </span>
                            }
                            footer={
                                <div className="p-3 rounded-lg bg-purple-500/10 border border-purple-500/20 text-xs">
                                    <p className="font-bold text-purple-700 dark:text-purple-300 mb-0.5">
                                        Praxis-Tipp für dein Portfolio:
                                    </p>
                                    <p className="text-muted-foreground">
                                        Achte vor allem auf den <strong>1J- und 3J-Goldenen Schnitt</strong> (61.8%). Wenn der Kurs dort ankommt und zugleich dein <strong>Fairer Wert</strong>, <strong>Kauflimit</strong> oder die <strong>200-Tage-Linie</strong> in der Nähe liegen, ist das eine der stärksten Kauf- und Unterstützungszonen überhaupt!
                                    </p>
                                </div>
                            }
                        />
                    </div>
                </div>
            )}

            <div className={cn(
                "w-full min-w-0 transition-all",
                isFullscreen
                    ? "flex-1 w-full min-h-0 min-w-0"
                    : "h-[320px] sm:h-[410px] landscape:h-[190px] min-h-[180px]"
            )}>
                {hasMounted && (
                    <ResponsiveContainer
                        key={isFullscreen ? 'fullscreen' : 'normal'}
                        width="100%"
                        height="100%"
                        debounce={50}
                        minWidth={1}
                        minHeight={1}
                    >
                        <AreaChart
                            data={displayData}
                            margin={{ top: selectedRange === '1D' && showPrePost && hasPrePostData ? 26 : 14, right: 20, left: 0, bottom: 4 }}
                            onMouseMove={(data: any) => {
                                if (data?.activePayload?.[0]?.payload) {
                                    setHoveredData(data.activePayload[0].payload);
                                } else if (data?.activeLabel) {
                                    // Fallback if activePayload is missing but we have a label (date)
                                    // This can happen when moving fast
                                    const point = displayData.find(d => d.date === data.activeLabel);
                                    if (point) setHoveredData(point);
                                }
                            }}
                            onMouseLeave={() => setHoveredData(null)}
                            onClick={(data: any) => {
                                if (!isMeasureMode) return;
                                const now = Date.now();
                                if (now - lastMeasureClickRef.current < 150) return;
                                lastMeasureClickRef.current = now;

                                let point = data?.activePayload?.[0]?.payload;
                                if (!point && data?.activeLabel) {
                                    point = displayData.find(d => d.date === data.activeLabel);
                                }
                                if (!point && hoveredData) {
                                    point = displayData.find(d => d.date === hoveredData.date) || hoveredData;
                                }

                                if (point) {
                                    const isHigh = maxPoint && point.date === maxPoint.date && Math.abs(point.value - maxPoint.value) < 0.0001;
                                    const isLow = minPoint && point.date === minPoint.date && Math.abs(point.value - minPoint.value) < 0.0001;
                                    const newPoint: MeasurePoint = {
                                        date: point.date,
                                        value: point.value,
                                        extremumType: isHigh ? 'high' : isLow ? 'low' : undefined,
                                        label: isHigh ? 'Hoch (H)' : isLow ? 'Tief (T)' : undefined
                                    };
                                    setMeasurePoints(prev => {
                                        if (prev.length >= 2) return [newPoint];
                                        return [...prev, newPoint];
                                    });
                                }
                            }}
                            onMouseDown={(data: any) => {
                                if (!isMeasureMode) return;
                                const now = Date.now();
                                if (now - lastMeasureClickRef.current < 150) return;
                                lastMeasureClickRef.current = now;

                                let point = data?.activePayload?.[0]?.payload;
                                if (!point && data?.activeLabel) {
                                    point = displayData.find(d => d.date === data.activeLabel);
                                }
                                if (!point && hoveredData) {
                                    point = displayData.find(d => d.date === hoveredData.date) || hoveredData;
                                }

                                if (point) {
                                    setMeasurePoints(prev => {
                                        if (prev.length >= 2) return [point];
                                        return [...prev, point];
                                    });
                                }
                            }}
                            style={{ cursor: isMeasureMode ? 'crosshair' : 'default' }}
                        >
                            <defs>
                                <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor={isPositive ? "#22c55e" : "#ef4444"} stopOpacity={0.1} />
                                    <stop offset="95%" stopColor={isPositive ? "#22c55e" : "#ef4444"} stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={true} opacity={0.1} />
                            <XAxis
                                dataKey="date"
                                height={20}
                                hide={false}
                                tick={{ fontSize: 10, fill: '#e2e8f0' }}
                                tickLine={{ stroke: '#475569', strokeWidth: 1 }}
                                axisLine={{ stroke: '#475569', strokeWidth: 1 }}
                                padding={{ left: 16, right: 28 }}
                                tickFormatter={(str) => {
                                    const date = new Date(str);
                                    const weekdayShort = date.toLocaleDateString('de-DE', { weekday: 'short' });

                                    if (selectedRange === '1D') {
                                        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                                    } else if (selectedRange === '1W' || selectedRange === '1M' || selectedRange === '3M' || selectedRange === '6M' || (selectedRange === 'BUY' && totalDurationDays <= 120)) {
                                        // Show weekday + date (e.g. "Fr 06.02" or "Di 17.11")
                                        const dayMonth = `${date.getDate().toString().padStart(2, '0')}.${(date.getMonth() + 1).toString().padStart(2, '0')}`;
                                        return `${weekdayShort} ${dayMonth}`;
                                    } else if (selectedRange === '1Y' || selectedRange === '3Y' || selectedRange === '5Y' || selectedRange === 'BUY') {
                                        // For yearly views, just show month/year (e.g. "02.25") - no weekday
                                        return `${(date.getMonth() + 1).toString().padStart(2, '0')}.${date.getFullYear().toString().slice(-2)}`;
                                    }
                                    return date.toLocaleDateString([], { day: '2-digit', month: '2-digit' });
                                }}
                                ticks={(() => {
                                    if (displayData.length === 0) return undefined;

                                    const lastPoint = displayData[displayData.length - 1];
                                    const ensureLastPoint = (list: string[], minDaysDiff = 3) => {
                                        if (!lastPoint || list.length === 0) return list;
                                        const lastDayKey = new Date(lastPoint.date).toISOString().slice(0, 10);
                                        const alreadyHasLast = list.some(d => new Date(d).toISOString().slice(0, 10) === lastDayKey);
                                        if (alreadyHasLast) return list;

                                        const lastTickTime = new Date(list[list.length - 1]).getTime();
                                        const diffDays = (new Date(lastPoint.date).getTime() - lastTickTime) / (1000 * 60 * 60 * 24);
                                        if (diffDays >= minDaysDiff) {
                                            return [...list, lastPoint.date];
                                        } else {
                                            const copy = [...list];
                                            copy[copy.length - 1] = lastPoint.date;
                                            return copy;
                                        }
                                    };

                                    // 1W: One tick per day
                                    if (selectedRange === '1W') {
                                        const ticks: string[] = [];
                                        const seenDays = new Set<string>();
                                        for (const point of displayData) {
                                            const date = new Date(point.date);
                                            const dayKey = date.toISOString().slice(0, 10);
                                            if (!seenDays.has(dayKey)) {
                                                seenDays.add(dayKey);
                                                ticks.push(point.date);
                                            }
                                        }
                                        if (isNarrowPortrait && ticks.length > 5) {
                                            const step = Math.ceil(ticks.length / 4);
                                            const filtered: string[] = [];
                                            for (let i = ticks.length - 1; i >= 0; i -= step) {
                                                filtered.unshift(ticks[i]);
                                            }
                                            return ensureLastPoint(filtered, 1);
                                        }
                                        return ensureLastPoint(ticks, 1);
                                    }

                                    // 1M: Every Friday (5) - one tick per day (also BUY if <= 35 days)
                                    if (selectedRange === '1M' || (selectedRange === 'BUY' && totalDurationDays <= 35)) {
                                        const ticks: string[] = [];
                                        const seenDays = new Set<string>();
                                        for (const point of displayData) {
                                            const date = new Date(point.date);
                                            const dayKey = date.toISOString().slice(0, 10);
                                            const dayOfWeek = date.getDay();

                                            if (dayOfWeek === 5 && !seenDays.has(dayKey)) {
                                                seenDays.add(dayKey);
                                                ticks.push(point.date);
                                            }
                                        }
                                        if (isNarrowPortrait && ticks.length > 5) {
                                            const step = Math.ceil(ticks.length / 4);
                                            const filtered: string[] = [];
                                            for (let i = ticks.length - 1; i >= 0; i -= step) {
                                                filtered.unshift(ticks[i]);
                                            }
                                            return ensureLastPoint(filtered, 2);
                                        }
                                        return ensureLastPoint(ticks, 2);
                                    }

                                    // 3M: Every Friday (5) - one tick per day (also BUY if 35 < duration <= 120 days)
                                    if (selectedRange === '3M' || (selectedRange === 'BUY' && totalDurationDays > 35 && totalDurationDays <= 120)) {
                                        const ticks: string[] = [];
                                        const seenDays = new Set<string>();
                                        for (const point of displayData) {
                                            const date = new Date(point.date);
                                            const dayKey = date.toISOString().slice(0, 10);

                                            if (date.getDay() === 5 && !seenDays.has(dayKey)) {
                                                seenDays.add(dayKey);
                                                ticks.push(point.date);
                                            }
                                        }
                                        if (isNarrowPortrait && ticks.length > 5) {
                                            const step = Math.ceil(ticks.length / 4);
                                            const filtered: string[] = [];
                                            for (let i = ticks.length - 1; i >= 0; i -= step) {
                                                filtered.unshift(ticks[i]);
                                            }
                                            return ensureLastPoint(filtered, 3);
                                        }
                                        return ensureLastPoint(ticks, 3);
                                    }

                                    // 6M: Bi-weekly Fridays (every 2nd Friday)
                                    if (selectedRange === '6M') {
                                        const ticks: string[] = [];
                                        const seenDays = new Set<string>();
                                        let fridayCount = 0;

                                        // Go through data in REVERSE (newest first)
                                        for (let i = displayData.length - 1; i >= 0; i--) {
                                            const point = displayData[i];
                                            const date = new Date(point.date);
                                            const dayKey = date.toISOString().slice(0, 10);

                                            if (date.getDay() === 5 && !seenDays.has(dayKey)) {
                                                seenDays.add(dayKey);
                                                // Only take every 2nd Friday
                                                if (fridayCount % (isNarrowPortrait ? 5 : 2) === 0) {
                                                    ticks.unshift(point.date); // Add to front to keep order
                                                }
                                                fridayCount++;
                                            }
                                        }
                                        return ensureLastPoint(ticks, 5);
                                    }

                                    // 1Y / 5Y / BUY: Monthly first-trading-day points
                                    if (['1Y', '3Y', '5Y', 'BUY'].includes(selectedRange)) {
                                        const monthlyFirstPoints: string[] = [];
                                        let currentMonth = -1;
                                        for (const point of displayData) {
                                            const d = new Date(point.date);
                                            const m = d.getMonth();
                                            if (m !== currentMonth) {
                                                monthlyFirstPoints.push(point.date);
                                                currentMonth = m;
                                            }
                                        }

                                        if (selectedRange === '1Y' && !isNarrowPortrait) return ensureLastPoint(monthlyFirstPoints, 12);

                                        // For 3Y/5Y/BUY: Every 3rd month (or 4th for 5Y desktop), backtracking from the end
                                        const result: string[] = [];
                                        const gap = isNarrowPortrait
                                            ? Math.max(2, Math.ceil(monthlyFirstPoints.length / 5))
                                            : (selectedRange === '5Y' ? 4 : 3);
                                        for (let i = monthlyFirstPoints.length - 1; i >= 0; i -= gap) {
                                            result.unshift(monthlyFirstPoints[i]);
                                        }
                                        return ensureLastPoint(result, 15);
                                    }

                                    return undefined;
                                })()}
                                minTickGap={['1W', '1M', '3M', '6M', '1Y', '3Y', '5Y', 'BUY'].includes(selectedRange) ? 0 : 30}
                                interval={['1W', '1M', '3M', '6M', '1Y', '3Y', '5Y', 'BUY'].includes(selectedRange) ? 0 : 'preserveStartEnd'}
                            />
                            <YAxis
                                domain={[domainMin, domainMax]}
                                hide={false}
                                orientation="right"
                                tick={{ fontSize: 10, fill: '#e2e8f0' }}
                                tickFormatter={(val) => {
                                    return new Intl.NumberFormat('de-CH', {
                                        minimumFractionDigits: 2,
                                        maximumFractionDigits: 2,
                                    }).format(val);
                                }}
                                axisLine={false}
                                tickLine={false}
                                width={46}
                                mirror={false}
                            />
                            {/* Extended Hours Session Dividers (1D when Vor-/Nachbörse active) */}
                            {selectedRange === '1D' && showPrePost && hasPrePostData && (() => {
                                const firstReg = hasPre ? displayData.find(p => p.session === 'regular') : null;
                                const firstPost = hasPost ? displayData.find(p => p.session === 'post') : null;
                                return (
                                    <>
                                        {firstReg && (
                                            <ReferenceLine
                                                x={firstReg.date}
                                                stroke="#64748b"
                                                strokeDasharray="3 3"
                                                strokeOpacity={0.8}
                                                label={(props: any) => {
                                                    const { viewBox } = props || {};
                                                    if (!viewBox) return <g />;
                                                    const { x, y } = viewBox;
                                                    return (
                                                        <g>
                                                            <text
                                                                x={x - 6}
                                                                y={y - 8}
                                                                textAnchor="end"
                                                                fill="#fbbf24"
                                                                fontSize={10}
                                                                fontWeight={600}
                                                            >
                                                                ← Vorbörse
                                                            </text>
                                                            <text
                                                                x={x + 6}
                                                                y={y - 8}
                                                                textAnchor="start"
                                                                fill="#94a3b8"
                                                                fontSize={10}
                                                                fontWeight={600}
                                                            >
                                                                Handelsstart →
                                                            </text>
                                                        </g>
                                                    );
                                                }}
                                            />
                                        )}
                                        {firstPost && (() => {
                                            const firstPostIdx = displayData.indexOf(firstPost);
                                            const nearRightEdge = firstPostIdx >= 0 && displayData.length > 5 && ((displayData.length - 1 - firstPostIdx) / displayData.length) < 0.14;
                                            return (
                                                <ReferenceLine
                                                    x={firstPost.date}
                                                    stroke="#818cf8"
                                                    strokeDasharray="3 3"
                                                    strokeOpacity={0.85}
                                                    label={(props: any) => {
                                                        const { viewBox } = props || {};
                                                        if (!viewBox) return <g />;
                                                        const { x, y } = viewBox;
                                                        return (
                                                            <text
                                                                x={nearRightEdge ? x - 6 : x + 6}
                                                                y={y - 8}
                                                                textAnchor={nearRightEdge ? 'end' : 'start'}
                                                                fill="#818cf8"
                                                                fontSize={10}
                                                                fontWeight={700}
                                                            >
                                                                Nachbörse →
                                                            </text>
                                                        );
                                                    }}
                                                />
                                            );
                                        })()}
                                    </>
                                );
                            })()}
                            {/* 1. Kaufpreis (Ø Kauf) - Prominent in Weiß (neutral & unabhängig von Bewertung) */}
                            {effectivePurchasePrice && effectivePurchasePrice >= domainMin && effectivePurchasePrice <= domainMax && (
                                <ReferenceLine
                                    y={effectivePurchasePrice}
                                    stroke="#ffffff"
                                    strokeWidth={2}
                                    strokeDasharray="6 4"
                                    strokeOpacity={0.95}
                                    label={(props: any) => {
                                        const { viewBox } = props || {};
                                        if (!viewBox) return <g />;
                                        const { x, y, width } = viewBox;
                                        const rightEdge = x + width - 6;
                                        const yOffset = getRightLabelYOffset(effectivePurchasePrice, [effectiveBuyLimit, effectiveModelBuyPrice, effectiveFairValue]);
                                        return (
                                            <g className="select-none pointer-events-none">
                                                <text
                                                    x={rightEdge}
                                                    y={y + yOffset}
                                                    textAnchor="end"
                                                    fill="#ffffff"
                                                    stroke="#0f172a"
                                                    strokeWidth={2.5}
                                                    paintOrder="stroke fill"
                                                    fontSize={isFullscreen ? 11 : 9.5}
                                                    fontWeight={700}
                                                >
                                                    Ø Kauf · {formatCurrency(effectivePurchasePrice, displayCurrency, false)}
                                                </text>
                                            </g>
                                        );
                                    }}
                                />
                            )}

                            {/* 2. Kauflimit (Buy Limit) - Passt sich dynamisch der gewählten Sichtweise an */}
                            {effectiveBuyLimit && effectiveBuyLimit >= domainMin && effectiveBuyLimit <= domainMax && (
                                <ReferenceLine
                                    y={effectiveBuyLimit}
                                    stroke={buyLimitTheme.stroke}
                                    strokeWidth={2}
                                    strokeDasharray="5 3"
                                    strokeOpacity={0.95}
                                    label={(props: any) => {
                                        const { viewBox } = props || {};
                                        if (!viewBox) return <g />;
                                        const { x, y, width } = viewBox;
                                        const rightEdge = x + width - 6;
                                        const yOffset = getRightLabelYOffset(effectiveBuyLimit, [effectivePurchasePrice, effectiveModelBuyPrice, effectiveFairValue]);
                                        return (
                                            <g className="select-none pointer-events-none">
                                                <text
                                                    x={rightEdge}
                                                    y={y + yOffset}
                                                    textAnchor="end"
                                                    fill={buyLimitTheme.fill}
                                                    stroke="#0f172a"
                                                    strokeWidth={2.5}
                                                    paintOrder="stroke fill"
                                                    fontSize={isFullscreen ? 11 : 9.5}
                                                    fontWeight={700}
                                                >
                                                    {buyLimitTheme.labelPrefix} · {formatCurrency(effectiveBuyLimit, displayCurrency, false)}
                                                </text>
                                            </g>
                                        );
                                    }}
                                />
                            )}

                            {/* 3. Modell-Kaufpreis (z. B. Kaufpreis Sicherheit A) - Passt sich dynamisch an, wenn ein manuelles Kauflimit aktiv ist */}
                            {effectiveModelBuyPrice && effectiveModelBuyPrice >= domainMin && effectiveModelBuyPrice <= domainMax && (!effectiveBuyLimit || Math.abs(effectiveModelBuyPrice - effectiveBuyLimit) > 0.05) && (
                                <ReferenceLine
                                    y={effectiveModelBuyPrice}
                                    stroke={fvTheme.stroke}
                                    strokeWidth={1.8}
                                    strokeDasharray="4 3"
                                    strokeOpacity={0.9}
                                    label={(props: any) => {
                                        const { viewBox } = props || {};
                                        if (!viewBox) return <g />;
                                        const { x, y, width } = viewBox;
                                        const rightEdge = x + width - 6;
                                        const yOffset = getRightLabelYOffset(effectiveModelBuyPrice, [effectivePurchasePrice, effectiveBuyLimit, effectiveFairValue]);
                                        return (
                                            <g className="select-none pointer-events-none">
                                                <text
                                                    x={rightEdge}
                                                    y={y + yOffset}
                                                    textAnchor="end"
                                                    fill={fvTheme.fill}
                                                    stroke="#0f172a"
                                                    strokeWidth={2.5}
                                                    paintOrder="stroke fill"
                                                    fontSize={isFullscreen ? 11 : 9.5}
                                                    fontWeight={700}
                                                >
                                                    {fvTheme.modelBuyLabel} · {formatCurrency(effectiveModelBuyPrice, displayCurrency, false)}
                                                </text>
                                            </g>
                                        );
                                    }}
                                />
                            )}

                            {/* 4. Fairer Wert (Fair Value) - Passt sich dynamisch der gewählten Sichtweise an */}
                            {effectiveFairValue && effectiveFairValue >= domainMin && effectiveFairValue <= domainMax && (
                                <ReferenceLine
                                    y={effectiveFairValue}
                                    stroke={fvTheme.stroke}
                                    strokeWidth={1.8}
                                    strokeDasharray="4 4"
                                    strokeOpacity={0.95}
                                    label={(props: any) => {
                                        const { viewBox } = props || {};
                                        if (!viewBox) return <g />;
                                        const { x, y, width } = viewBox;
                                        const rightEdge = x + width - 6;
                                        const yOffset = getRightLabelYOffset(effectiveFairValue, [effectivePurchasePrice, effectiveBuyLimit, effectiveModelBuyPrice]);
                                        return (
                                            <g className="select-none pointer-events-none">
                                                <text
                                                    x={rightEdge}
                                                    y={y + yOffset}
                                                    textAnchor="end"
                                                    fill={fvTheme.fill}
                                                    stroke="#0f172a"
                                                    strokeWidth={2.5}
                                                    paintOrder="stroke fill"
                                                    fontSize={isFullscreen ? 11 : 9.5}
                                                    fontWeight={700}
                                                >
                                                    {fvTheme.labelPrefix} · {formatCurrency(effectiveFairValue, displayCurrency, false)}
                                                </text>
                                            </g>
                                        );
                                    }}
                                />
                            )}
                            {/* Individual Purchase Markers (Vertical dashed line + blue dot at bottom baseline) */}
                            {selectedRange !== '1D' && purchaseMarkers.map((marker) => (
                                <Fragment key={marker.id}>
                                    <ReferenceLine
                                        x={marker.dateKey}
                                        stroke="#3b82f6"
                                        strokeWidth={1.5}
                                        strokeDasharray="3 3"
                                    />
                                    <ReferenceDot
                                        x={marker.dateKey}
                                        y={domainMin}
                                        r={6}
                                        shape={(props: any) => {
                                            const { cx, cy } = props;
                                            if (typeof cx !== 'number' || typeof cy !== 'number') return <g />;
                                            return (
                                                <g
                                                    className="cursor-pointer select-none focus:outline-none"
                                                    style={{ outline: 'none', WebkitTapHighlightColor: 'transparent' }}
                                                    tabIndex={-1}
                                                    onMouseDown={(e) => e.preventDefault()}
                                                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
                                                >
                                                    <title>{marker.tooltipText}</title>
                                                    {/* Invisible larger hit area for easy hover/tap */}
                                                    <circle cx={cx} cy={cy - 6} r={14} fill="transparent" />
                                                    {/* Outer glow halo */}
                                                    <circle cx={cx} cy={cy - 6} r={8.5} fill="#3b82f6" fillOpacity={0.25} />
                                                    {/* Core dot */}
                                                    <circle cx={cx} cy={cy - 6} r={4.5} fill="#3b82f6" stroke="#ffffff" strokeWidth={2} />
                                                </g>
                                            );
                                        }}
                                    />
                                </Fragment>
                            ))}
                            {effectiveSellLimit && (
                                <ReferenceLine
                                    y={effectiveSellLimit}
                                    stroke="#dc2626"
                                    strokeDasharray="3 3"
                                    label={{
                                        position: 'right',
                                        value: 'Stop',
                                        fill: '#dc2626',
                                        fontSize: 12,
                                        fontWeight: 700
                                    }}
                                />
                            )}

                            {/* High / Low Extremum Marker (when H: or T: is clicked) */}
                            {selectedExtremum && (() => {
                                const pt = selectedExtremum === 'high' ? maxPoint : minPoint;
                                if (!pt) return null;
                                const color = selectedExtremum === 'high' ? '#10b981' : '#f43f5e';

                                return (
                                    <>
                                        <ReferenceLine
                                            y={pt.value}
                                            stroke={color}
                                            strokeWidth={1.5}
                                            strokeDasharray="4 4"
                                            strokeOpacity={0.85}
                                        />
                                        <ReferenceLine
                                            x={pt.date}
                                            stroke={color}
                                            strokeWidth={1.5}
                                            strokeDasharray="4 4"
                                            strokeOpacity={0.85}
                                        />
                                        <ReferenceDot
                                            x={pt.date}
                                            y={pt.value}
                                            r={6}
                                            shape={(props: any) => {
                                                const { cx, cy } = props;
                                                if (typeof cx !== 'number' || typeof cy !== 'number') return <g />;
                                                return (
                                                    <g
                                                        className="pointer-events-none select-none focus:outline-none"
                                                        style={{ outline: 'none' }}
                                                        tabIndex={-1}
                                                    >
                                                        <circle cx={cx} cy={cy} r={12} fill={color} fillOpacity={0.28} />
                                                        <circle cx={cx} cy={cy} r={6.5} fill={color} stroke="#ffffff" strokeWidth={2.5} />
                                                    </g>
                                                );
                                            }}
                                        />
                                    </>
                                );
                            })()}

                            {/* Measurement Reference Lines & Dots */}
                            {measurePoints.map((p, i) => {
                                const dotColor = p.extremumType === 'high' ? '#10b981' : p.extremumType === 'low' ? '#f43f5e' : '#3b82f6';
                                return (
                                    <Fragment key={`measure-pt-${i}-${p.date}`}>
                                        <ReferenceLine
                                            x={p.date}
                                            stroke={dotColor}
                                            strokeWidth={2}
                                            strokeDasharray={p.extremumType ? '3 3' : undefined}
                                            strokeOpacity={0.9}
                                        />
                                        <ReferenceDot
                                            x={p.date}
                                            y={p.value}
                                            r={6}
                                            shape={(props: any) => {
                                                const { cx, cy } = props;
                                                if (typeof cx !== 'number' || typeof cy !== 'number') return <g />;
                                                return (
                                                    <g className="pointer-events-none select-none" style={{ outline: 'none' }} tabIndex={-1}>
                                                        <circle cx={cx} cy={cy} r={12} fill={dotColor} fillOpacity={0.25} />
                                                        <circle cx={cx} cy={cy} r={6} fill={dotColor} stroke="#ffffff" strokeWidth={2} />
                                                    </g>
                                                );
                                            }}
                                        />
                                    </Fragment>
                                );
                            })}
                            {measurement && (
                                <ReferenceLine
                                    y={measurement.p1.value}
                                    stroke={measurement.p1.extremumType === 'high' ? '#10b981' : measurement.p1.extremumType === 'low' ? '#f43f5e' : '#3b82f6'}
                                    strokeDasharray="4 4"
                                    strokeOpacity={0.7}
                                />
                            )}
                            {measurement && (
                                <ReferenceLine
                                    y={measurement.p2.value}
                                    stroke={measurement.p2.extremumType === 'high' ? '#10b981' : measurement.p2.extremumType === 'low' ? '#f43f5e' : '#3b82f6'}
                                    strokeDasharray="4 4"
                                    strokeOpacity={0.7}
                                />
                            )}
                            {/* Fibonacci Retracements */}
                            {fibonacciData && fibonacciData.levels.map((level) => (
                                <ReferenceLine
                                    key={`fibo-${level.label}`}
                                    y={level.price}
                                    stroke={level.color}
                                    strokeDasharray={level.dash}
                                    strokeWidth={level.ratio === 0.618 || level.ratio === 0.786 ? 1.5 : 1}
                                    strokeOpacity={0.85}
                                    label={(props: any) => {
                                        const { viewBox } = props || {};
                                        if (!viewBox) return <g />;
                                        const { x, y } = viewBox;
                                        return (
                                            <g className="select-none pointer-events-none">
                                                <text
                                                    x={x + 6}
                                                    y={y - 3}
                                                    fill={level.color}
                                                    stroke="#0f172a"
                                                    strokeWidth={2.5}
                                                    paintOrder="stroke fill"
                                                    fontSize={isFullscreen ? 11 : 9.5}
                                                    fontWeight={700}
                                                >
                                                    Fibo {level.label}{level.name ? ` ${level.name}` : ''} · {level.formattedPrice}
                                                </text>
                                            </g>
                                        );
                                    }}
                                />
                            ))}
                            <Tooltip
                                content={() => null}
                                cursor={{ stroke: 'var(--primary)', strokeWidth: 1, strokeDasharray: '4 4' }}
                                isAnimationActive={false}
                            />
                            <Area
                                type="monotone"
                                dataKey="value"
                                stroke={isPositive ? "#22c55e" : "#ef4444"}
                                strokeWidth={2}
                                fillOpacity={1}
                                fill="url(#colorValue)"
                            />
                            {/* SMA 200 Line */}
                            <Area
                                type="monotone"
                                dataKey="sma200"
                                stroke="#fbbf24" // Amber-400
                                strokeWidth={2}
                                strokeDasharray="5 5"
                                fill="none"
                                connectNulls
                                isAnimationActive={false}
                                activeDot={{ r: 4, fill: '#fbbf24' }}
                            />
                            {/* Live End-Point Dot on current price (like Yahoo Finance) */}
                            {displayData.length > 0 && (() => {
                                const lastPoint = displayData[displayData.length - 1];
                                const liveDotColor = isPositive ? '#22c55e' : '#ef4444';
                                return (
                                    <ReferenceDot
                                        key={`live-endpoint-${lastPoint.date}`}
                                        x={lastPoint.date}
                                        y={lastPoint.value}
                                        r={5}
                                        shape={(props: any) => {
                                            const { cx, cy } = props;
                                            if (typeof cx !== 'number' || typeof cy !== 'number') return <g />;
                                            return (
                                                <g className="pointer-events-none select-none" style={{ outline: 'none' }} tabIndex={-1}>
                                                    <circle cx={cx} cy={cy} r={8} fill={liveDotColor} fillOpacity={0.25} />
                                                    <circle cx={cx} cy={cy} r={4} fill={liveDotColor} stroke="#ffffff" strokeWidth={1.5} />
                                                </g>
                                            );
                                        }}
                                    />
                                );
                            })()}
                        </AreaChart>
                    </ResponsiveContainer>
                )}
            </div>
        </div>
    );

    if (isFullscreen && typeof document !== 'undefined') {
        return (
            <>
                <div className="w-full h-[280px] sm:h-[320px] border border-dashed border-border/60 rounded-xl flex flex-col items-center justify-center gap-2.5 text-muted-foreground bg-muted/10 p-4">
                    <div className="flex items-center gap-2 text-primary">
                        <Maximize2 className="size-5" />
                        <span className="text-sm font-bold text-foreground">Chart in Großansicht geöffnet</span>
                    </div>
                    <p className="text-xs text-muted-foreground text-center max-w-sm">
                        {showFibonacci ? 'Fibonacci-Retracements im Vollbild-Modus aktiv.' : 'Großansicht des Kursverlaufs aktiv.'}
                    </p>
                    <button
                        type="button"
                        onClick={handleToggleFullscreen}
                        className="px-3 py-1 rounded-lg border border-border bg-card hover:bg-muted text-xs font-semibold text-foreground transition-all shadow-sm cursor-pointer"
                    >
                        Großansicht verkleinern (Esc)
                    </button>
                </div>
                {createPortal(chartContent, document.body)}
            </>
        );
    }

    return chartContent;
}
