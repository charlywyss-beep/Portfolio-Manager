import { StockName } from './StockName';
import { InfoHelp } from './InfoHelp';
import { DelayedDataBadge } from './DelayedDataBadge';
import { Logo } from './Logo';
import { useMemo, useState, useEffect, Fragment, useRef } from 'react';
import { createPortal } from 'react-dom';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine, ReferenceDot } from 'recharts';
import { useCurrencyFormatter } from '../utils/currency';
import { Ruler, X, ArrowLeft, ArrowLeftRight, ArrowUpRight, Maximize2, Minimize2, HelpCircle, ShieldCheck, Sparkles, TriangleAlert, Sliders, RefreshCw, GitCompareArrows, Loader2, Check } from 'lucide-react';
import { cn } from '../utils';
import { type TimeRange, type ChartDataPoint, fetchStockHistory } from '../services/yahoo-finance';
import { useExchangeRates } from '../context/ExchangeRateContext';
import { usePortfolio } from '../context/PortfolioContext';

function isUsEquitySymbol(symbol: string | undefined): boolean {
    const s = (symbol || '').trim().toUpperCase();
    if (!s || s.startsWith('^') || s.includes('=')) return false;
    if (s.includes('.') && !s.endsWith('.US')) return false;
    if (/-(USD|CHF|EUR|GBP)$/.test(s)) return false;
    return true;
}

interface CompareTarget {
    symbol: string;
    name: string;
    currency?: string;
    badge?: string;
    kind?: 'index' | 'etf' | 'stock';
}

const COMPARE_BENCHMARKS: CompareTarget[] = [
    { symbol: '^N225', name: 'Nikkei 225', currency: 'JPY', badge: 'Japan', kind: 'index' },
    { symbol: '2559.T', name: 'All-World Tokio', currency: 'JPY', badge: 'MSCI ACWI', kind: 'etf' },
    { symbol: 'ES=F', name: 'S&P 500 Future', currency: 'USD', badge: 'US Future', kind: 'index' },
    { symbol: 'NQ=F', name: 'Nasdaq 100 Future', currency: 'USD', badge: 'US Future', kind: 'index' },
    { symbol: '^GSPC', name: 'S&P 500', currency: 'USD', badge: 'Index', kind: 'index' },
    { symbol: '^NDX', name: 'Nasdaq 100', currency: 'USD', badge: 'Index', kind: 'index' },
    { symbol: '^SSMI', name: 'SMI', currency: 'CHF', badge: 'Schweiz', kind: 'index' },
    { symbol: '^GDAXI', name: 'DAX', currency: 'EUR', badge: 'Deutschland', kind: 'index' },
    { symbol: 'VWRA.L', name: 'Vanguard FTSE All-World', currency: 'USD', badge: 'ETF', kind: 'etf' },
    { symbol: 'VT', name: 'Vanguard Total World US', currency: 'USD', badge: 'US Vor/Nach', kind: 'etf' },
    { symbol: 'BTC-USD', name: 'Bitcoin', currency: 'USD', badge: '24/7', kind: 'index' },
];

export const COMPARE_SWISS_GUIDE_ITEMS = [
    {
        term: "Schritt 1 · Warum starten beide Linien links bei 0%?",
        text: "Im Vergleichsmodus werden beide Kurven links beim Startpunkt auf **0.00%** normiert (`1D`: Eröffnung **01:00 Uhr MEZ** in Tokio; `1W–5J`: erster sichtbarer Handelstag).\n\n**Wichtig am Montagmorgen bei 2559.T:** Beachte nicht die rote/grüne **Tages-%** ganz oben (sie vergleicht mit Freitag 07:30 Uhr und enthält montags zuerst den kompletten US-Freitag). Entscheidend ist allein, ob die Kurven **nach 01:00 Uhr über oder unter der gestrichelten 0%-Linie** weitersteigen oder fallen."
    },
    {
        term: "Schritt 2 · Welche Linie bedeutet was? (Rot/Grün vs. Hellblau)",
        text: "• **Hauptlinie (Rot/Grün · z. B. All-World Tokio 2559.T):** Echter Welt-ETF (MSCI ACWI, über 2'300 Aktien: ~64% USA, ~15% Europa, ~5% Japan) – praktisch deckungsgleich mit deinem **Vanguard FTSE All-World**.\n\n• **Vergleichslinie (Hellblau · z. B. Nikkei 225 ^N225):** Reiner japanischer Leitindex (100% Japan). Reagiert deutlich stärker auf lokale Japan-News, die Bank of Japan oder den Yen.\n\n• **Tipp:** Über **Vergleichen** kannst du statt Nikkei jederzeit auch **S&P 500 Future (ES=F)** oder **Nasdaq 100 Future (NQ=F)** einblenden – ab Sonntag 24:00 Uhr laufen diese minutengenau parallel zu Tokio (`01:00–07:30 Uhr`)."
    },
    {
        term: "Schritt 3 · Dein Schweizer Morgen-Zeitplan (MEZ / MESZ)",
        text: "• **00:00 Uhr (So→Mo):** US-Futures (`ES=F`, `NQ=F`) öffnen – erste globale Reaktion auf Wochenend-News.\n• **01:00–03:30 Uhr:** Tokio Vormittags-Session (`2559.T` & `^N225` handeln live).\n• **03:30–04:30 Uhr:** Börsen-Mittagspause in Tokio (kurzes Seitwärtslaufen ist völlig normal).\n• **04:30–07:30 Uhr:** Tokio Nachmittags-Session (Nikkei bis 07:45 Uhr). **Beste Ablesezeit für dich in der Schweiz: ca. 06:45–07:30 Uhr.**\n• **08:00 Uhr (ab 08:15 Uhr in der App):** Tradegate & Frankfurt (`*.F`) starten – erste EUR-Indikationen.\n• **09:00 Uhr (ab 09:15 Uhr in der App):** **SIX Swiss Exchange (`*.SW`)**, Xetra (`*.DE`) & London (`*.L`) eröffnen regulär.\n• **10:00 Uhr:** Offizielle US-Vorbörse (`Pre-Market`) in Echtzeit.\n• **14:30 Uhr:** Wichtige US-Wirtschaftsdaten (Inflation/CPI, Arbeitsmarkt, BIP) – oft der stärkste Impuls vor Wall-Street-Start!\n• **15:30 Uhr:** Wall Street (New York) eröffnet – ab hier geben US-Kassakurse den Takt vor."
    },
    {
        term: "Schritt 4 · Die 4 konkreten Szenarien am Morgen (Checkliste)",
        text: "• **Szenario A · Beide Linien über 0% (steigend):** Echter weltweiter Rückenwind aus Asien & Futures. Deine All-World-ETFs und Aktien dürften um 09:00 Uhr an der SIX freundlich eröffnen.\n\n• **Szenario B · Beide Linien klar unter 0% (fallend):** Echter globaler Verkaufsdruck. Keine Panik – prüfe in Ruhe, ob ab 09:00 Uhr an der SIX sinnvolle **Kauflimits** erreicht werden.\n\n• **Szenario C · Nikkei stark im Minus (z. B. -3%), 2559.T viel ruhiger (z. B. -1% oder nahe 0%):** Klassischer Japan-/Yen-Effekt! Der Weltmarkt bleibt stabiler als Japan – dein Schweizer/globaler ETF eröffnet meist deutlich gelassener als der Nikkei vermuten lässt.\n\n• **Szenario D · Ab 05:00–07:30 Uhr drehen beide Linien wieder Richtung 0% hoch:** Intraday-Erholung (Dip wird aufgekauft) – oft ein beruhigendes Signal für eine stabile Europa-Eröffnung um 09:00 Uhr."
    },
    {
        term: "Schritt 5 · Schweizer Franken (CHF) & Yen-Effekt richtig einschätzen",
        text: "Sowohl `2559.T` als auch `^N225` handeln in **Japanischen Yen (JPY)** – dein Depot rechnest du aber in **CHF**:\n\n• **Starker Yen (USD/JPY fällt):** Drückt optisch die JPY-Kurse in Tokio – in **CHF** gerechnet fällt dein Welt-ETF (`VWRA.L` / `VWRL.SW`) dann oft spürbar **weniger stark** als die Yen-Linie anzeigt.\n• **Starker Franken (USD/CHF fällt):** Bremst USD-Positionen für Schweizer Anleger leicht ab.\n• **Praxis-Check:** Ein 5-Sekunden-Blick auf **USD/CHF** in der **Marktübersicht** zeigt dir sofort, ob Währungen zusätzlich drücken oder stützen."
    },
    {
        term: "Schritt 6 · Abstand (Δ) & Mauszeiger richtig ablesen",
        text: "Fahre mit der Maus über jeden beliebigen Zeitpunkt (z. B. `04:50` oder `07:30 Uhr`) – unten links im Chart erscheinen **beide Prozentwerte ab Start**, **beide Originalkurse** und der exakte **Abstand Δ**:\n\n• **Positiver Abstand (z. B. Δ +1.94%):** Deine Hauptkurve (`2559.T`) hält sich um `1.94%` besser als die Vergleichslinie (`Nikkei 225`).\n• **Negativer Abstand (z. B. Δ -0.80%):** Der Weltmarkt bzw. die US-Futures schwächeln stärker als Japan – dann unbedingt auch **E-Mini S&P 500 Future (`ES=F`)** gegenchecken."
    },
    {
        term: "Schritt 7 · Konkrete Handlungsregel für Schweizer Anleger vor 09:00 Uhr",
        text: "• **07:00–07:30 Uhr:** Kurzer Check `2559.T vs. Nikkei 225` (und bei Bedarf `vs. E-Mini S&P 500 Future`) → du weisst vor Börsenstart genau, ob Ruhe, Rückenwind oder Gegenwind ansteht.\n• **09:00–09:15 Uhr (SIX-Eröffnung):** In den ersten 5–10 Minuten sind die Geld-/Brief-Spannen (Spreads) an der SIX oft unnötig breit. **Niemals «Bestens» direkt um 09:00 Uhr handeln** – setze immer eine **Limit-Order** oder warte bis **09:15 Uhr** (bei US-Aktien idealerweise ab **15:30 Uhr**)."
    },
    {
        term: "Schritt 8 · 24h-Praxisregel & ausgeschriebene Ticker-Symbole",
        text: "• **Morgens 01:00–07:30 Uhr (Asien / Frühtendenz):**\n  **MAXIS World Equity MSCI ACWI ETF Tokio (`2559.T`)** ↔ **Nikkei 225 (`^N225`)** / **E-Mini S&P 500 Future (`ES=F`)** / **E-Mini Nasdaq-100 Future (`NQ=F`)**.\n\n• **Tagsüber 10:00–15:30 Uhr (Europa live + US-Vorbörse · Button «10:00–15:30»):**\n  Wenn du in diesem Fenster zu deinem **Vanguard FTSE All-World UCITS ETF (`VWRA.L`)** den echten, flüssigen Taktgeber ohne Treppenstufen sehen willst, wähle statt **Vanguard Total World Stock ETF USA (`VT`)** lieber **E-Mini S&P 500 Future (`ES=F`)** oder **E-Mini Nasdaq-100 Future (`NQ=F`)** – die handeln im Sekundentakt.\n\n• **Abends 15:30–22:00 Uhr + US-Nachbörse bis 02:00 Uhr (Button «Ab 15:30»):**\n  Jetzt ist **Vanguard Total World Stock ETF USA (`VT`)** perfekt – extrem liquide und zeigt dir nach Europa-Schluss (`17:30 Uhr`) exakt, wie dein **Vanguard FTSE All-World (`VWRA.L`)** in den USA weiterläuft!"
    }
];

export interface MeasurePoint {
    date: string;
    value: number;
    label?: string;
    extremumType?: 'high' | 'low';
    purchaseTag?: string;
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
    positionShares?: number;
    averageEntryFxRate?: number;
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
    headerActions?: React.ReactNode;
    extendedHours?: {
        isPre: boolean;
        label: string;
        price?: number | null;
        pct?: number | null;
        time?: number | string | null;
        timeText?: string | null;
    } | null;
    initialCompareTarget?: {
        symbol: string;
        name: string;
        currency?: string;
    } | null;
    onOpenCompareSymbol?: (target: { symbol: string; name: string; currency: string }) => void;
    onReturnToCompare?: () => void;
    returnToCompareLabel?: string;
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
    positionShares,
    averageEntryFxRate,
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
    onToggleFullscreen,
    headerActions,
    extendedHours,
    initialCompareTarget,
    onOpenCompareSymbol,
    onReturnToCompare,
    returnToCompareLabel
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
    const [hoveredData, setHoveredData] = useState<{
        date: string;
        value: number;
        sma200?: number | null;
        session?: 'pre' | 'regular' | 'post';
        plotValue?: number | null;
        comparePlotValue?: number | null;
        compareRawValue?: number | null;
        compareSession?: 'pre' | 'regular' | 'post';
        compareDate?: string | null;
    } | null>(null);
    const [selectedExtremum, setSelectedExtremum] = useState<'high' | 'low' | null>(null);

    // Chart Overlay Comparison State (Variante 1: 1-Chart Normalized % Overlay)
    const { stocks: portfolioStocks, positions: portfolioPositions } = usePortfolio();
    const [compareTarget, setCompareTarget] = useState<CompareTarget | null>(() => initialCompareTarget || null);
    const [compareHistory, setCompareHistory] = useState<ChartDataPoint[] | null>(null);
    const [compareCurrency, setCompareCurrency] = useState<string>(() => initialCompareTarget?.currency || 'USD');
    const [compareTimeMode, setCompareTimeMode] = useState<'sync' | 'pre10_1530' | 'us1530' | 'session'>('sync');
    const [isCompareLoading, setIsCompareLoading] = useState(false);
    const [compareError, setCompareError] = useState<string | null>(null);
    const [showComparePicker, setShowComparePicker] = useState(false);
    const [compareFilterTab, setCompareFilterTab] = useState<'all' | 'index' | 'etf' | 'stock'>('all');
    const [comparePickerPos, setComparePickerPos] = useState<{ top: number; left: number } | null>(null);
    const compareBtnRef = useRef<HTMLButtonElement>(null);
    const comparePopoverRef = useRef<HTMLDivElement>(null);

    // Sync / reset comparison when navigating to another symbol or opening with a preselected compare target
    const initialCompareKey = initialCompareTarget ? `${initialCompareTarget.symbol}|${initialCompareTarget.name}|${initialCompareTarget.currency || ''}` : '';
    useEffect(() => {
        if (initialCompareTarget && initialCompareTarget.symbol.toUpperCase() !== (stockSymbol || '').toUpperCase()) {
            setCompareTarget(initialCompareTarget);
            setCompareCurrency(initialCompareTarget.currency || 'USD');
        } else {
            setCompareTarget(null);
            setCompareHistory(null);
        }
        setCompareTimeMode('sync');
        setCompareError(null);
        setShowComparePicker(false);
        setHoveredData(null);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [stockSymbol, initialCompareKey]);

    // Position the comparison picker popover cleanly beneath the button (via portal so overflow-x-auto never clips it)
    useEffect(() => {
        if (!showComparePicker) return;
        const updatePosition = () => {
            const btn = compareBtnRef.current;
            if (!btn) return;
            const rect = btn.getBoundingClientRect();
            const popWidth = Math.min(320, window.innerWidth - 16);
            const left = Math.max(8, Math.min(rect.left, window.innerWidth - popWidth - 8));
            const top = Math.min(rect.bottom + 6, window.innerHeight - 360);
            setComparePickerPos({ top: Math.max(8, top), left });
        };
        updatePosition();
        window.addEventListener('resize', updatePosition);
        window.addEventListener('scroll', updatePosition, true);
        return () => {
            window.removeEventListener('resize', updatePosition);
            window.removeEventListener('scroll', updatePosition, true);
        };
    }, [showComparePicker, isFullscreen]);

    // Close compare picker on outside click or Escape
    useEffect(() => {
        if (!showComparePicker) return;
        const handleOutside = (e: PointerEvent) => {
            const target = e.target as Node | null;
            if (
                compareBtnRef.current?.contains(target) ||
                comparePopoverRef.current?.contains(target)
            ) {
                return;
            }
            setShowComparePicker(false);
        };
        const handleKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                e.stopPropagation();
                setShowComparePicker(false);
            }
        };
        document.addEventListener('pointerdown', handleOutside);
        window.addEventListener('keydown', handleKey, true);
        return () => {
            document.removeEventListener('pointerdown', handleOutside);
            window.removeEventListener('keydown', handleKey, true);
        };
    }, [showComparePicker]);

    // Context-smart benchmark presets (e.g. viewing 2559.T puts Nikkei 225 first, viewing ^N225 puts All-World Tokio first)
    const { compareBenchmarks, comparePortfolioItems } = useMemo(() => {
        const currentSym = (stockSymbol || '').trim().toUpperCase();
        const priorityBySymbol: Record<string, string[]> = {
            '2559.T': ['^N225', 'ES=F', 'NQ=F', 'VWRA.L', 'VT', '^GSPC', '^SSMI', 'BTC-USD'],
            '^N225': ['2559.T', 'ES=F', 'NQ=F', '^GSPC', 'VWRA.L', 'VT', '^SSMI', 'BTC-USD'],
            'ES=F': ['NQ=F', '2559.T', '^N225', 'VT', '^GSPC', '^SSMI', 'BTC-USD'],
            'NQ=F': ['ES=F', '2559.T', '^N225', 'VT', '^NDX', '^GSPC', 'BTC-USD'],
            'VWRA.L': ['VT', '2559.T', 'ES=F', 'NQ=F', '^N225', '^GSPC', '^SSMI'],
            'VT': ['VWRA.L', '2559.T', 'ES=F', 'NQ=F', '^N225', '^GSPC', '^SSMI'],
        };
        const preferredOrder = priorityBySymbol[currentSym]
            || (currentSym.endsWith('.SW') ? ['^SSMI', '^GSPC', 'VWRA.L', '2559.T', '^N225', 'ES=F'] : []);

        const filteredBenchmarks = COMPARE_BENCHMARKS
            .filter(b => b.symbol.toUpperCase() !== currentSym)
            .sort((a, b) => {
                const ia = preferredOrder.indexOf(a.symbol);
                const ib = preferredOrder.indexOf(b.symbol);
                if (ia !== -1 && ib !== -1) return ia - ib;
                if (ia !== -1) return -1;
                if (ib !== -1) return 1;
                return 0;
            });

        const ownedIds = new Set(portfolioPositions.filter(p => p.shares > 0).map(p => p.stockId));
        const benchmarkSymbols = new Set(filteredBenchmarks.map(b => b.symbol.toUpperCase()));
        const seenSymbols = new Set<string>([currentSym]);
        const ownedList: CompareTarget[] = [];
        const watchList: CompareTarget[] = [];

        for (const s of portfolioStocks) {
            const symUpper = (s.symbol || '').trim().toUpperCase();
            if (!symUpper || seenSymbols.has(symUpper) || benchmarkSymbols.has(symUpper)) continue;
            seenSymbols.add(symUpper);
            const item: CompareTarget = {
                symbol: s.symbol,
                name: s.name || s.symbol,
                currency: s.currency,
                badge: ownedIds.has(s.id) ? 'Depot' : 'Watchlist',
                kind: s.type === 'etf' ? 'etf' : 'stock',
            };
            if (ownedIds.has(s.id)) ownedList.push(item);
            else watchList.push(item);
        }

        ownedList.sort((a, b) => a.name.localeCompare(b.name, 'de'));
        watchList.sort((a, b) => a.name.localeCompare(b.name, 'de'));

        return {
            compareBenchmarks: filteredBenchmarks,
            comparePortfolioItems: [...ownedList, ...watchList],
        };
    }, [stockSymbol, portfolioStocks, portfolioPositions]);

    const handleSelectCompareTarget = (target: CompareTarget) => {
        setCompareTarget(target);
        setCompareCurrency(target.currency || 'USD');
        setCompareTimeMode('sync');
        setCompareError(null);
        setShowComparePicker(false);
        // Turn off currency-level tools while % comparison overlay is active
        setIsMeasureMode(false);
        setMeasurePoints([]);
        setShowFibonacci(false);
        setSelectedExtremum(null);
    };

    const handleClearCompare = () => {
        setCompareTarget(null);
        setCompareHistory(null);
        setCompareTimeMode('sync');
        setCompareError(null);
        setIsCompareLoading(false);
    };

    // Lock body scrolling and listen for Escape key when in fullscreen
    useEffect(() => {
        if (!isFullscreen) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && !showComparePicker) {
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
    }, [isFullscreen, showComparePicker]);

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

    // Position / Bestand metrics for owned stocks & ETFs (reacts to selectedRange and CHF toggle)
    const positionMetrics = useMemo(() => {
        if (!positionShares || positionShares <= 0) return null;
        const unitPrice = effectiveCurrentPrice > 0 ? effectiveCurrentPrice : endPrice;
        if (!unitPrice || unitPrice <= 0) return null;

        const positionValue = unitPrice * positionShares;
        const hasBuyCost = Boolean(purchasePrice && purchasePrice > 0);
        const purchaseCostNative = hasBuyCost ? purchasePrice! * positionShares : 0;
        const entryFx = (showInCHF && currency !== 'CHF' && averageEntryFxRate && averageEntryFxRate > 0)
            ? averageEntryFxRate
            : conversionRate;
        const purchaseCostDisplay = purchaseCostNative * entryFx;

        const totalGain = hasBuyCost ? (positionValue - purchaseCostDisplay) : null;
        const totalGainPct = (hasBuyCost && purchaseCostDisplay > 0 && totalGain !== null)
            ? (totalGain / purchaseCostDisplay) * 100
            : null;

        const isBuyRange = selectedRange === 'BUY';
        const periodGain = isBuyRange && totalGain !== null
            ? totalGain
            : diffNative * positionShares;
        const periodGainPct = isBuyRange && totalGainPct !== null
            ? totalGainPct
            : performance;

        const formattedShares = Number.isInteger(positionShares)
            ? positionShares.toLocaleString('de-CH')
            : positionShares.toLocaleString('de-CH', { maximumFractionDigits: 4 });

        return {
            formattedShares,
            positionValue,
            periodGain,
            periodGainPct,
            totalGain,
            totalGainPct,
            isBuyRange
        };
    }, [positionShares, effectiveCurrentPrice, endPrice, purchasePrice, showInCHF, currency, averageEntryFxRate, conversionRate, selectedRange, diffNative, performance]);

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
    // On 1D (Tagesverlauf) and 1W (Wochenverlauf), keep the Y-axis tightly zoomed to the actual price range so short-term movements are clearly visible (like Yahoo Finance 1T / 5T).
    // On longer timeframes (1M+), expand domain to accommodate active strategy lines so they remain visible.
    if (selectedRange !== '1D' && selectedRange !== '1W') {
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
            // Expand for purchase price if it's within a reasonable distance (so it doesn't compress charts too much)
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
    }

    const range = calcMax - calcMin;
    const padding = range === 0 ? calcMax * 0.05 : range * 0.05;
    const rawDomainMin = Math.max(0, calcMin - padding);
    const rawDomainMax = calcMax + padding;

    // Generate clean, round "nice" ticks (integers where possible) for the Y-axis so the scale never has ugly fractional ticks like 614.78
    const yAxisInfo = useMemo(() => {
        if (rawDomainMax <= rawDomainMin || isNaN(rawDomainMin) || isNaN(rawDomainMax)) {
            return {
                ticks: undefined,
                domain: [rawDomainMin, rawDomainMax] as [number, number],
                step: 1,
            };
        }
        const span = rawDomainMax - rawDomainMin;
        const rawStep = span / 4;
        const power = Math.pow(10, Math.floor(Math.log10(rawStep)));
        const fraction = rawStep / power;

        let step: number;
        if (power < 1) {
            if (fraction < 1.4) step = 1 * power;
            else if (fraction < 3.0) step = 2 * power;
            else if (fraction < 7.0) step = 5 * power;
            else step = 10 * power;
        } else {
            if (fraction < 1.5) step = 1 * power;
            else if (fraction < 3.5) step = 2 * power;
            else if (fraction < 7.5) step = 5 * power;
            else step = 10 * power;
            step = Math.round(step);
        }

        let niceMin = Math.max(0, Math.floor(rawDomainMin / step) * step);
        let niceMax = Math.ceil(rawDomainMax / step) * step;
        let ticks: number[] = [];
        for (let t = niceMin; t <= niceMax + step * 0.001; t += step) {
            ticks.push(Number(t.toFixed(4)));
        }

        // Keep tick count reasonable (between 3 and 7 ticks)
        if (ticks.length > 7) {
            step = step * 2;
            niceMin = Math.max(0, Math.floor(rawDomainMin / step) * step);
            niceMax = Math.ceil(rawDomainMax / step) * step;
            ticks = [];
            for (let t = niceMin; t <= niceMax + step * 0.001; t += step) {
                ticks.push(Number(t.toFixed(4)));
            }
        }

        const domainLow = ticks.length > 0 ? ticks[0] : rawDomainMin;
        const domainHigh = ticks.length > 0 ? ticks[ticks.length - 1] : rawDomainMax;

        return {
            ticks: ticks.length >= 3 ? ticks : undefined,
            domain: [domainLow, domainHigh] as [number, number],
            step,
        };
    }, [rawDomainMin, rawDomainMax]);

    const domainMin = yAxisInfo.domain[0];
    const domainMax = yAxisInfo.domain[1];

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

    const effectiveExtendedHours = useMemo(() => {
        if (selectedRange !== '1D') return null;

        const propPrice = (extendedHours && extendedHours.price && extendedHours.price > 0)
            ? extendedHours.price * conversionRate
            : undefined;
        const propDiff = (propPrice && effectiveCurrentPrice > 0)
            ? (propPrice - effectiveCurrentPrice)
            : undefined;

        // 1. If 1D range and chart data contains pre or post session points
        if (displayData && displayData.length > 0) {
            const lastPoint = displayData[displayData.length - 1];
            if (lastPoint && (lastPoint.session === 'post' || lastPoint.session === 'pre')) {
                const isPre = lastPoint.session === 'pre';
                const price = lastPoint.value; // already converted by conversionRate
                const lastReg = [...displayData].reverse().find(p => !p.session || p.session === 'regular') || displayData[0];
                const base = (effectiveCurrentPrice > 0 ? effectiveCurrentPrice : lastReg?.value) || 1;
                const diff = price - base;
                const pct = base > 0 ? (diff / base) * 100 : 0;
                const d = new Date(lastPoint.date);
                const timeText = !isNaN(d.getTime()) ? d.toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit' }) : '';
                return {
                    isPre,
                    label: isPre ? 'US Vorbörse' : 'US Nachbörse',
                    price,
                    pct,
                    diff,
                    timeText: extendedHours?.timeText || timeText
                };
            }
        }

        // 2. Fallback to prop if available (even before chart points load or when showPrePost is false)
        if (extendedHours && propPrice && propPrice > 0) {
            const base = (effectiveCurrentPrice > 0 ? effectiveCurrentPrice : 0) || 1;
            const diff = propDiff !== undefined ? propDiff : (propPrice - base);
            const pct = (extendedHours.pct !== undefined && extendedHours.pct !== null) ? extendedHours.pct : (base > 0 ? (diff / base) * 100 : 0);
            return {
                isPre: extendedHours.isPre,
                label: extendedHours.label || (extendedHours.isPre ? 'US Vorbörse' : 'US Nachbörse'),
                price: propPrice,
                pct,
                diff,
                timeText: extendedHours.timeText
            };
        }

        return null;
    }, [extendedHours, displayData, selectedRange, conversionRate, effectiveCurrentPrice]);

    const totalDurationDays = useMemo(() => {
        if (!displayData || displayData.length < 2) return 0;
        const start = new Date(displayData[0].date).getTime();
        const end = new Date(displayData[displayData.length - 1].date).getTime();
        return Math.max(0, (end - start) / (1000 * 60 * 60 * 24));
    }, [displayData]);

    // Fetch historical series for active comparison symbol whenever symbol / timeframe / pre-post changes
    const compareFetchRange = useMemo<TimeRange>(() => {
        if (selectedRange !== 'BUY') return selectedRange;
        if (totalDurationDays > 1100) return '5Y';
        if (totalDurationDays > 365) return '3Y';
        if (totalDurationDays > 180) return '1Y';
        if (totalDurationDays > 90) return '6M';
        return '3M';
    }, [selectedRange, totalDurationDays]);

    useEffect(() => {
        if (!compareTarget) {
            setCompareHistory(null);
            setIsCompareLoading(false);
            setCompareError(null);
            return;
        }

        let cancelled = false;
        setIsCompareLoading(true);
        setCompareError(null);

        // Only request US pre/post-market hours when the comparison symbol itself is a US stock/ETF (incl. PBR-A / BRK-B, never .L / .SW / .T!)
        const isCompareUsEquity = isUsEquitySymbol(compareTarget.symbol);
        const isPrimaryNonUs = !isUsEquitySymbol(stockSymbol);
        const shouldIncludePrePost = selectedRange === '1D' && isCompareUsEquity && (showPrePost || isPrimaryNonUs);

        fetchStockHistory(compareTarget.symbol, compareFetchRange, undefined, {
            includePrePost: shouldIncludePrePost,
        })
            .then((res) => {
                if (cancelled) return;
                if (res.data && res.data.length > 0) {
                    setCompareHistory(res.data);
                    if (res.currency) setCompareCurrency(res.currency);
                    setCompareError(null);
                } else {
                    setCompareHistory(null);
                    setCompareError(res.error || 'Keine Kursdaten für diesen Zeitraum');
                }
            })
            .catch(() => {
                if (cancelled) return;
                setCompareHistory(null);
                setCompareError('Vergleichsdaten konnten nicht geladen werden');
            })
            .finally(() => {
                if (!cancelled) setIsCompareLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, [compareTarget, compareFetchRange, selectedRange, showPrePost]);

    // Align comparison series with primary series and normalize both to 0.00% at visible chart start
    const compareOverlay = useMemo(() => {
        const buildInactive = () => ({
            isActive: false,
            chartData: displayData.map(p => ({
                ...p,
                plotValue: p.value as number | null,
                comparePlotValue: null as number | null,
                compareRawValue: null as number | null,
                compareSession: undefined as 'pre' | 'regular' | 'post' | undefined,
                compareDate: null as string | null,
            })),
            yAxis: yAxisInfo,
            summary: null as null | {
                primaryLastPct: number;
                compareLastPct: number;
                compareLastRaw: number;
                spreadPct: number;
                primaryLastPoint: { date: string; plotValue: number } | null;
                lastComparePoint: { date: string; comparePlotValue: number } | null;
                primaryCloseDate: string | null;
                comparePostStartDate: string | null;
                usedSessionFallback: boolean;
                hasPre10_1530Overlap: boolean;
                hasUs1530Overlap: boolean;
                activeTimeMode: 'sync' | 'pre10_1530' | 'us1530' | 'session';
            },
        });

        if (!compareTarget || !compareHistory || compareHistory.length === 0 || displayData.length === 0) {
            return buildInactive();
        }

        const allSortedCmp = compareHistory
            .map(p => ({
                date: p.date,
                ms: new Date(p.date).getTime(),
                dayKey: new Date(p.date).toISOString().slice(0, 10),
                value: p.value,
                session: p.session,
            }))
            .filter(p => !isNaN(p.ms) && Number.isFinite(p.value) && p.value > 0)
            .sort((a, b) => a.ms - b.ms);

        if (allSortedCmp.length === 0) {
            return buildInactive();
        }

        // Check whether both 1D series overlap in:
        // 1) US Pre-Market window (10:00–15:30 CET while Europe is live)
        // 2) Wall Street live window (from 15:30 CET onward)
        let hasPre10_1530Overlap = false;
        let pre10StartMs = 0;
        let pre1530EndMs = 0;
        let hasUs1530Overlap = false;
        let us1530CutoffMs = 0;
        if (selectedRange === '1D' && displayData.length > 0) {
            const firstDate = new Date(displayData[0].date);
            if (!isNaN(firstDate.getTime())) {
                const y = firstDate.getFullYear();
                const m = firstDate.getMonth();
                const d = firstDate.getDate();
                pre10StartMs = new Date(y, m, d, 9, 58, 0, 0).getTime();
                pre1530EndMs = new Date(y, m, d, 15, 32, 0, 0).getTime();
                us1530CutoffMs = new Date(y, m, d, 15, 25, 0, 0).getTime();

                const primaryPre = displayData.filter(p => {
                    const t = new Date(p.date).getTime();
                    return t >= pre10StartMs && t <= pre1530EndMs;
                });
                const cmpPre = allSortedCmp.filter(p => p.ms >= pre10StartMs && p.ms <= pre1530EndMs);
                hasPre10_1530Overlap = primaryPre.length >= 2 && cmpPre.length >= 2;

                const primaryAfter = displayData.filter(p => new Date(p.date).getTime() >= us1530CutoffMs);
                const cmpAfter = allSortedCmp.filter(p => p.ms >= us1530CutoffMs);
                hasUs1530Overlap = primaryAfter.length >= 2 && cmpAfter.length >= 2;
            }
        }

        const effectiveMode: 'sync' | 'pre10_1530' | 'us1530' | 'session' =
            selectedRange !== '1D'
                ? 'sync'
                : compareTimeMode === 'pre10_1530' && !hasPre10_1530Overlap
                    ? 'sync'
                    : compareTimeMode === 'us1530' && !hasUs1530Overlap
                        ? 'sync'
                        : compareTimeMode;

        // Slice working datasets depending on 1D compareTimeMode
        let workingPrimary = displayData;
        let sortedCmp = allSortedCmp;

        if (selectedRange === '1D' && effectiveMode === 'pre10_1530' && pre10StartMs > 0) {
            workingPrimary = displayData.filter(p => {
                const t = new Date(p.date).getTime();
                return t >= pre10StartMs && t <= pre1530EndMs;
            });
            sortedCmp = allSortedCmp.filter(p => p.ms >= pre10StartMs && p.ms <= pre1530EndMs);
        } else if (selectedRange === '1D' && effectiveMode === 'us1530' && us1530CutoffMs > 0) {
            workingPrimary = displayData.filter(p => new Date(p.date).getTime() >= us1530CutoffMs);
            sortedCmp = allSortedCmp.filter(p => p.ms >= us1530CutoffMs);
        } else if (selectedRange === '1D' && effectiveMode === 'session') {
            // Unsynced session overlay: strip pre/post hours so both regular market opens align at 0% on the left!
            const regPrimary = displayData.filter(p => !p.session || p.session === 'regular');
            if (regPrimary.length >= 2) workingPrimary = regPrimary;
            const regCmp = allSortedCmp.filter(p => !p.session || p.session === 'regular');
            if (regCmp.length >= 2) sortedCmp = regCmp;
        }

        if (workingPrimary.length === 0 || sortedCmp.length === 0) {
            return buildInactive();
        }

        const primaryBase = workingPrimary.find(p => Number.isFinite(p.value) && p.value > 0)?.value ?? 0;
        if (primaryBase <= 0) {
            return buildInactive();
        }

        const isIntraday = selectedRange === '1D' || selectedRange === '1W';
        let matchedRaw: (number | null)[] = new Array(workingPrimary.length).fill(null);
        const matchedSession: ('pre' | 'regular' | 'post' | undefined)[] = new Array(workingPrimary.length).fill(undefined);
        const matchedDate: (string | null)[] = new Array(workingPrimary.length).fill(null);
        let usedSessionFallback = false;

        if (selectedRange === '1D' && effectiveMode === 'session') {
            // Explicit unsynced mode: align both regular sessions from open (0%) to close
            usedSessionFallback = true;
            const n = workingPrimary.length;
            const m = sortedCmp.length;
            matchedRaw = workingPrimary.map((_, idx) => {
                const cmpIdx = n <= 1 ? m - 1 : Math.round((idx / (n - 1)) * (m - 1));
                const picked = sortedCmp[Math.min(m - 1, Math.max(0, cmpIdx))];
                matchedSession[idx] = picked.session;
                matchedDate[idx] = picked.date;
                return picked.value;
            });
        } else if (isIntraday) {
            const maxGapMs = selectedRange === '1D' ? 95 * 60 * 1000 : 12 * 60 * 60 * 1000;
            const forwardToleranceMs = 3 * 60 * 1000;
            const firstCmpMs = sortedCmp[0].ms;
            const lastCmpMs = sortedCmp[sortedCmp.length - 1].ms;
            const endCarryMs = selectedRange === '1D' ? 6 * 60 * 1000 : 30 * 60 * 1000;
            let j = 0;

            for (let i = 0; i < workingPrimary.length; i++) {
                const t = new Date(workingPrimary[i].date).getTime();
                if (isNaN(t)) continue;
                // Stop cleanly before comparison open or after comparison market close (no flat horizontal tail after 17:30!)
                if (t < firstCmpMs - endCarryMs || t > lastCmpMs + endCarryMs) continue;
                while (j + 1 < sortedCmp.length && sortedCmp[j + 1].ms <= t + forwardToleranceMs) {
                    j++;
                }
                // Pick the closer of j and j+1 when within tolerance
                let bestIdx = j;
                if (j + 1 < sortedCmp.length && Math.abs(sortedCmp[j + 1].ms - t) < Math.abs(sortedCmp[j].ms - t) && Math.abs(sortedCmp[j + 1].ms - t) <= forwardToleranceMs) {
                    bestIdx = j + 1;
                }
                const diff = Math.abs(sortedCmp[bestIdx].ms - t);
                if (diff <= maxGapMs) {
                    matchedRaw[i] = sortedCmp[bestIdx].value;
                    matchedSession[i] = sortedCmp[bestIdx].session;
                    matchedDate[i] = sortedCmp[bestIdx].date;
                }
            }

            const matchedCount = matchedRaw.filter(v => v !== null).length;
            // Fallback for 1D cross-timezone comparisons (e.g. Tokyo 01:00–07:30 vs US 15:30–22:00):
            // align by relative session progress so both curves remain directly comparable
            if (selectedRange === '1D' && matchedCount < 2 && sortedCmp.length >= 2) {
                usedSessionFallback = true;
                const n = workingPrimary.length;
                const m = sortedCmp.length;
                matchedRaw = workingPrimary.map((_, idx) => {
                    const cmpIdx = n <= 1 ? m - 1 : Math.round((idx / (n - 1)) * (m - 1));
                    const picked = sortedCmp[Math.min(m - 1, Math.max(0, cmpIdx))];
                    matchedSession[idx] = picked.session;
                    matchedDate[idx] = picked.date;
                    return picked.value;
                });
            }
        } else {
            // Daily / weekly alignment by YYYY-MM-DD with holiday carry-forward
            let j = 0;
            const firstPrimaryMs = new Date(workingPrimary[0].date).getTime();
            for (let i = 0; i < workingPrimary.length; i++) {
                const d = new Date(workingPrimary[i].date);
                const t = d.getTime();
                if (isNaN(t)) continue;
                const pKey = d.toISOString().slice(0, 10);
                while (j + 1 < sortedCmp.length && sortedCmp[j + 1].dayKey <= pKey) {
                    j++;
                }
                if (sortedCmp[j].dayKey <= pKey) {
                    matchedRaw[i] = sortedCmp[j].value;
                    matchedDate[i] = sortedCmp[j].date;
                } else if (i === 0 && Math.abs(sortedCmp[0].ms - firstPrimaryMs) <= 5 * 86400000) {
                    matchedRaw[i] = sortedCmp[0].value;
                    matchedDate[i] = sortedCmp[0].date;
                }
            }
        }

        const compareBase = matchedRaw.find((v): v is number => v !== null && v > 0) ?? 0;
        const validMatches = matchedRaw.filter(v => v !== null).length;

        if (compareBase <= 0 || validMatches < 2) {
            return buildInactive();
        }

        let minPct = 0;
        let maxPct = 0;
        let lastComparePoint: { date: string; comparePlotValue: number } | null = null;
        let compareLastPct = 0;
        let compareLastRaw = compareBase;

        const chartData: Array<
            (typeof displayData)[number] & {
                plotValue: number | null;
                comparePlotValue: number | null;
                compareRawValue: number | null;
                compareSession?: 'pre' | 'regular' | 'post';
                compareDate?: string | null;
            }
        > = workingPrimary.map((p, idx) => {
            const plotValue = ((p.value - primaryBase) / primaryBase) * 100;
            const rawCmp = matchedRaw[idx];
            const comparePlotValue = rawCmp !== null ? ((rawCmp - compareBase) / compareBase) * 100 : null;

            if (Number.isFinite(plotValue)) {
                minPct = Math.min(minPct, plotValue);
                maxPct = Math.max(maxPct, plotValue);
            }
            if (comparePlotValue !== null && Number.isFinite(comparePlotValue)) {
                minPct = Math.min(minPct, comparePlotValue);
                maxPct = Math.max(maxPct, comparePlotValue);
                compareLastPct = comparePlotValue;
                compareLastRaw = rawCmp!;
                lastComparePoint = { date: p.date, comparePlotValue };
            }

            return {
                ...p,
                plotValue,
                comparePlotValue,
                compareRawValue: rawCmp,
                compareSession: matchedSession[idx],
                compareDate: matchedDate[idx],
            };
        });

        const lastPrimaryItem = chartData[chartData.length - 1];
        const primaryLastPct = lastPrimaryItem?.plotValue ?? 0;
        const primaryLastPoint = lastPrimaryItem && lastPrimaryItem.plotValue !== null
            ? { date: lastPrimaryItem.date, plotValue: lastPrimaryItem.plotValue }
            : null;

        // Extend 1D timeline past European close (e.g. VWRA.L / *.SW closing at 17:30) when comparing with a US ETF/stock (e.g. VT, SPY, QQQ)
        // in synchronized modes ('sync' or 'us1530') so the US regular session up to 22:00 CET and US after-hours remain visible!
        let primaryCloseDate: string | null = null;
        let comparePostStartDate: string | null = null;
        const isCompareUsEquity = isUsEquitySymbol(compareTarget.symbol);
        if (selectedRange === '1D' && !usedSessionFallback && effectiveMode !== 'pre10_1530' && isCompareUsEquity && lastPrimaryItem) {
            const lastPrimaryMs = new Date(lastPrimaryItem.date).getTime();
            const tailPoints = sortedCmp.filter(
                c => c.ms > lastPrimaryMs + 60 * 1000 && c.ms <= lastPrimaryMs + 9 * 60 * 60 * 1000
            );
            if (tailPoints.length >= 2) {
                primaryCloseDate = lastPrimaryItem.date;
                for (const tp of tailPoints) {
                    const comparePlotValue = ((tp.value - compareBase) / compareBase) * 100;
                    if (Number.isFinite(comparePlotValue)) {
                        minPct = Math.min(minPct, comparePlotValue);
                        maxPct = Math.max(maxPct, comparePlotValue);
                        compareLastPct = comparePlotValue;
                        compareLastRaw = tp.value;
                        lastComparePoint = { date: tp.date, comparePlotValue };
                        if (!comparePostStartDate && tp.session === 'post') {
                            comparePostStartDate = tp.date;
                        }
                        chartData.push({
                            date: tp.date,
                            value: lastPrimaryItem.value,
                            sma200: null,
                            plotValue: null,
                            comparePlotValue,
                            compareRawValue: tp.value,
                            compareSession: tp.session,
                            compareDate: tp.date,
                        });
                    }
                }
            }
        }

        // Build clean % Y-axis ticks covering both curves and 0%
        const span = Math.max(0.4, maxPct - minPct);
        const pad = span * 0.1;
        const rawMin = minPct - pad;
        const rawMax = maxPct + pad;
        const rawStep = (rawMax - rawMin) / 4;
        const power = Math.pow(10, Math.floor(Math.log10(rawStep)));
        const frac = rawStep / power;
        let step: number;
        if (frac < 1.4) step = 1 * power;
        else if (frac < 2.8) step = 2 * power;
        else if (frac < 6.5) step = 5 * power;
        else step = 10 * power;

        let niceMin = Math.floor(rawMin / step) * step;
        let niceMax = Math.ceil(rawMax / step) * step;
        let ticks: number[] = [];
        for (let t = niceMin; t <= niceMax + step * 0.001; t += step) {
            const rounded = Math.abs(t) < 1e-6 ? 0 : Number(t.toFixed(4));
            ticks.push(rounded);
        }
        if (ticks.length > 7) {
            step = step * 2;
            niceMin = Math.floor(rawMin / step) * step;
            niceMax = Math.ceil(rawMax / step) * step;
            ticks = [];
            for (let t = niceMin; t <= niceMax + step * 0.001; t += step) {
                const rounded = Math.abs(t) < 1e-6 ? 0 : Number(t.toFixed(4));
                ticks.push(rounded);
            }
        }

        const cmpYAxis = {
            ticks: ticks.length >= 3 ? ticks : undefined,
            domain: [
                ticks.length > 0 ? ticks[0] : rawMin,
                ticks.length > 0 ? ticks[ticks.length - 1] : rawMax,
            ] as [number, number],
            step,
        };

        return {
            isActive: true,
            chartData,
            yAxis: cmpYAxis,
            summary: {
                primaryLastPct,
                compareLastPct,
                compareLastRaw,
                spreadPct: primaryLastPct - compareLastPct,
                primaryLastPoint,
                lastComparePoint,
                primaryCloseDate,
                comparePostStartDate,
                usedSessionFallback,
                hasPre10_1530Overlap,
                hasUs1530Overlap,
                activeTimeMode: effectiveMode,
            },
        };
    }, [compareTarget, compareHistory, displayData, selectedRange, yAxisInfo, compareTimeMode]);

    const isCompareActive = compareOverlay.isActive;
    const chartDisplayData = compareOverlay.chartData;
    const activeYAxisInfo = compareOverlay.yAxis;
    const activeDomainMin = activeYAxisInfo.domain[0];
    const activeDomainMax = activeYAxisInfo.domain[1];

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

    const handlePurchaseMeasure = (marker: (typeof purchaseMarkers)[number]) => {
        const tag = purchaseMarkers.length > 1 ? `K${marker.index + 1}` : 'K';
        const newPt: MeasurePoint = {
            date: marker.dateKey,
            value: marker.effectivePrice,
            label: purchaseMarkers.length > 1 ? `Kauf ${marker.index + 1}` : 'Kauf',
            purchaseTag: tag
        };
        setSelectedExtremum(null);
        setMeasurePoints(prev => {
            if (prev.length >= 2) {
                return [newPt];
            }
            if (prev.length === 1 && prev[0].purchaseTag === tag && prev[0].date === newPt.date) {
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
                ? "fixed inset-0 z-[9999] bg-background dark:bg-[#080d1a] pt-[max(env(safe-area-inset-top,0px),0.75rem)] pb-[max(env(safe-area-inset-bottom,0px),0.75rem)] pl-[max(env(safe-area-inset-left,0px),0.75rem)] pr-[max(env(safe-area-inset-right,0px),0.75rem)] landscape:pt-[max(env(safe-area-inset-top,0px),0.35rem)] landscape:pb-[max(env(safe-area-inset-bottom,0px),0.35rem)] landscape:pl-[max(env(safe-area-inset-left,0px),0.5rem)] landscape:pr-[max(env(safe-area-inset-right,0px),0.5rem)] sm:portrait:p-6 lg:portrait:p-8 flex flex-col w-screen h-screen overflow-hidden chart-fullscreen-container"
                : "min-h-[340px] landscape:min-h-0 h-auto flex-1 pb-0 landscape:pb-0"
        )}>
            <div className={cn(
                "flex justify-between gap-2 relative w-full",
                isFullscreen
                    ? "flex-wrap items-start gap-y-1.5 mb-1.5"
                    : "flex-wrap items-start mb-2 md:mb-3 landscape:mb-1.5"
            )}>
                <div className={cn(
                    "flex flex-1 min-w-0 pr-1 sm:pr-2",
                    isFullscreen
                        ? "flex-wrap items-center gap-x-2.5 gap-y-1"
                        : "flex-col gap-0.5"
                )}>
                    <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                        {isFullscreen && onReturnToCompare && (
                            <button
                                type="button"
                                onClick={onReturnToCompare}
                                className={cn(
                                    "h-7 inline-flex items-center justify-center leading-none rounded-lg border shadow-sm transition-all group active:scale-95 shrink-0 cursor-pointer",
                                    returnToCompareLabel
                                        ? "gap-1.5 px-2.5 py-0 text-xs font-bold bg-sky-500/15 dark:bg-sky-500/20 text-sky-600 dark:text-sky-300 border-sky-500/40 hover:bg-sky-600 hover:text-white hover:border-sky-500 whitespace-nowrap"
                                        : "w-7 p-0 bg-secondary/90 hover:bg-secondary text-foreground border-foreground/40 hover:border-foreground/75"
                                )}
                                title={returnToCompareLabel ? `Zurück zum Vergleich ${returnToCompareLabel}` : 'Zurück'}
                                aria-label={returnToCompareLabel ? `Zurück zum Vergleich ${returnToCompareLabel}` : 'Zurück'}
                            >
                                <ArrowLeft className="size-4 shrink-0 group-hover:-translate-x-0.5 transition-transform" />
                                {returnToCompareLabel && <span>Zurück zum Vergleich</span>}
                            </button>
                        )}
                        {stockLogoUrl && isFullscreen && (
                            <div className="shrink-0 flex items-center justify-center">
                                <Logo
                                    url={stockLogoUrl}
                                    alt={stockName || 'Aktie'}
                                    size="size-8 sm:size-12 landscape:size-7"
                                    fallback={
                                        <span className="text-xs sm:text-base font-bold">
                                            {(stockSymbol || stockName || '').slice(0, 2).toUpperCase()}
                                        </span>
                                    }
                                />
                            </div>
                        )}
                        <div className="flex flex-col gap-0.5 min-w-0">
                            {stockName && (
                                <div className="flex items-center gap-1.5 sm:gap-2 mb-0.5 landscape:mb-0">
                                    <h4 className={cn(
                                        "font-black tracking-tighter text-foreground drop-shadow-sm whitespace-nowrap",
                                        isFullscreen
                                            ? "text-base sm:text-2xl landscape:text-sm"
                                            : "text-base sm:text-2xl landscape:text-lg"
                                    )}>
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
                                        <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest hidden sm:inline landscape:inline">
                                            {stockSymbol}
                                        </span>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Performance, Kurs, Extended Hours & Hoch/Tief mit exakter Linksbündigkeit bei H: */}
                    <div className={cn(
                        "relative flex flex-wrap gap-x-3 sm:gap-x-4 gap-y-1 mt-0.5 min-h-[32px] sm:min-h-0",
                        isFullscreen
                            ? "items-center landscape:mt-0"
                            : "items-end"
                    )}>
                        {/* Spalte 1 (Links): Performance-Untertitel & Kurs-Zeile */}
                        <div className={cn(
                            "flex min-w-0",
                            isFullscreen
                                ? "flex-col landscape:flex-row landscape:items-center gap-0.5 sm:gap-1 landscape:gap-2"
                                : "flex-col gap-0.5 sm:gap-1"
                        )}>
                            <div className={cn(
                                "flex items-center gap-1.5 sm:gap-2 flex-wrap",
                                isFullscreen && "landscape:hidden"
                            )}>
                                <p className="text-xs sm:text-sm text-muted-foreground">Performance · {formatRangeLabel(selectedRange)}</p>
                                <span className="text-[11px] sm:text-xs text-muted-foreground italic select-none hidden sm:inline">
                                    · {historyData && historyData.length > 0 ? 'Marktdaten Yahoo Finance' : 'Demo-Modus'}
                                </span>
                            </div>
                            <div className="flex flex-wrap items-center gap-x-2 sm:gap-x-3 gap-y-1">
                                {/* Current Price, Date & Performance Diff */}
                        <div className="flex items-baseline gap-1.5 sm:gap-2.5 shrink-0">
                            {(effectiveCurrentPrice > 0 || endPrice > 0) && (
                                <span className={cn(
                                    "font-black tabular-nums text-foreground tracking-tight",
                                    isFullscreen ? "text-xl sm:text-2xl landscape:text-base" : "text-xl sm:text-2xl landscape:text-xl"
                                )}>
                                    {formatCurrency(effectiveCurrentPrice > 0 ? effectiveCurrentPrice : endPrice, displayCurrency, false)}
                                </span>
                            )}
                            {effectiveDateStr && (
                                <span className={cn(
                                    "text-xs sm:text-sm font-semibold text-muted-foreground tabular-nums whitespace-nowrap",
                                    isFullscreen ? "landscape:hidden xl:landscape:inline text-xs" : "landscape:text-xs"
                                )}>
                                    {effectiveDateStr}
                                </span>
                            )}
                            <div className={cn(
                                "font-bold flex items-baseline gap-1 tabular-nums",
                                isFullscreen ? "text-base sm:text-xl landscape:text-xs" : "text-base sm:text-xl",
                                isPositive ? "text-green-600 dark:text-green-400" : "text-red-500"
                            )}>
                                <span>{performance > 0 ? '+' : ''}{performance.toFixed(2)}%</span>
                                <span className={cn(
                                    "ml-1 opacity-90",
                                    isFullscreen ? "text-sm sm:text-lg landscape:hidden xl:landscape:inline" : "text-sm sm:text-lg"
                                )}>{diffNativeFormatted}</span>
                            </div>
                        </div>

                        {/* Extended Hours Badge (US Vorbörse / US Nachbörse) */}
                        {effectiveExtendedHours && effectiveExtendedHours.price && effectiveExtendedHours.price > 0 && (
                            <div
                                className={cn(
                                    "h-7 inline-flex items-center gap-1.5 px-2 sm:px-2.5 py-0 rounded-lg border text-xs sm:text-sm font-bold tabular-nums shrink-0 transition-all select-none shadow-sm leading-none",
                                    effectiveExtendedHours.isPre
                                        ? "bg-amber-500/15 border-amber-500/40 text-amber-500 dark:text-amber-300"
                                        : "bg-indigo-500/15 border-indigo-500/40 text-indigo-400 dark:text-indigo-300"
                                )}
                                title={`${effectiveExtendedHours.label} ${effectiveExtendedHours.timeText ? `· ${effectiveExtendedHours.timeText}` : ''}`}
                            >
                                <span className="uppercase tracking-wider text-[10px] sm:text-xs font-black opacity-90">
                                    <span className="hidden sm:inline">US </span>{effectiveExtendedHours.isPre ? 'Vorbörse' : 'Nachbörse'}
                                </span>
                                <span className="font-extrabold text-foreground">
                                    {formatCurrency(effectiveExtendedHours.price, displayCurrency, false)}
                                </span>
                                {effectiveExtendedHours.pct !== undefined && effectiveExtendedHours.pct !== null && (
                                    <span className={cn(
                                        "font-bold text-[11px] sm:text-xs",
                                        effectiveExtendedHours.pct >= 0 ? "text-emerald-500 dark:text-emerald-400" : "text-rose-500"
                                    )}>
                                        {effectiveExtendedHours.pct >= 0 ? '+' : ''}{effectiveExtendedHours.pct.toFixed(2)}%
                                    </span>
                                )}
                                {effectiveExtendedHours.diff !== undefined && effectiveExtendedHours.diff !== null && (
                                    <span className={cn(
                                        "font-medium text-[10px] sm:text-xs opacity-80 hidden sm:inline",
                                        effectiveExtendedHours.diff >= 0 ? "text-emerald-500 dark:text-emerald-400" : "text-rose-500"
                                    )}>
                                        {effectiveExtendedHours.diff >= 0 ? '+' : ''}{formatCurrency(effectiveExtendedHours.diff, displayCurrency, false)}
                                    </span>
                                )}
                                {effectiveExtendedHours.timeText && (
                                    <span className="text-[10px] text-muted-foreground opacity-75 hidden md:inline ml-0.5 font-normal">
                                        · {effectiveExtendedHours.timeText}
                                    </span>
                                )}
                            </div>
                        )}
                            </div>
                        </div>

                        {/* Spalte 2 (Rechts): Beginn des Feldes startet exakt bei H: */}
                        <div className={cn(
                            "flex items-start sm:border-l sm:border-border/60 sm:pl-3.5",
                            isFullscreen
                                ? "flex-col landscape:flex-row landscape:items-center gap-1 landscape:gap-2 landscape:border-l landscape:border-border/60 landscape:pl-2.5"
                                : "flex-col gap-1.5"
                        )}>
                            {/* Obere Zeile: Live-Kurs / Schlusskurs (Vollbild) ODER Performance Details & Position (Normalansicht) */}
                            {((isFullscreen && !isMeasureMode) || (!isFullscreen && headerActions)) && (
                                <div className="h-7 inline-flex items-center gap-2">
                                    {isFullscreen && !isMeasureMode && (
                                        <div className="landscape:hidden xl:landscape:inline-flex">
                                            <DelayedDataBadge
                                                quoteDate={quoteDate}
                                                lastDataDate={data && data.length > 0 ? new Date(data[data.length - 1].date) : null}
                                                isMarketOpen={isMarketOpen}
                                            />
                                        </div>
                                    )}
                                    {!isFullscreen && headerActions && (
                                        <div className="inline-flex items-center gap-1.5 sm:gap-2">
                                            {headerActions}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Untere Zeile: Hoch / Tief Indikatoren (H: und T:) & CHF-Umschalter in Zeile USD */}
                            <div className={cn(
                                "flex flex-nowrap items-center gap-1.5 sm:gap-3 text-sm sm:text-lg font-bold text-foreground transition-opacity duration-150 select-none whitespace-nowrap",
                                isFullscreen ? "landscape:text-sm md:landscape:text-lg" : "landscape:text-sm md:landscape:text-base",
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
                                        "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg transition-all cursor-pointer active:scale-95 border text-sm sm:text-lg landscape:text-sm md:landscape:text-lg font-bold whitespace-nowrap shrink-0",
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
                                        {isFullscreen ? (
                                            <>
                                                <span className="landscape:hidden xl:landscape:inline">{formatCurrency(maxPrice, displayCurrency, false)}</span>
                                                <span className="hidden landscape:inline xl:landscape:hidden">
                                                    {new Intl.NumberFormat('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(maxPrice)}
                                                </span>
                                            </>
                                        ) : formatCurrency(maxPrice, displayCurrency, false)}
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
                                        "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg transition-all cursor-pointer active:scale-95 border text-sm sm:text-lg landscape:text-sm md:landscape:text-lg font-bold whitespace-nowrap shrink-0",
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
                                        {isFullscreen ? (
                                            <>
                                                <span className="landscape:hidden xl:landscape:inline">{formatCurrency(minPrice, displayCurrency, false)}</span>
                                                <span className="hidden landscape:inline xl:landscape:hidden">
                                                    {new Intl.NumberFormat('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(minPrice)}
                                                </span>
                                            </>
                                        ) : formatCurrency(minPrice, displayCurrency, false)}
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

                            {/* CHF Umschalt-Button in Zeile USD, mittig über Manuell */}
                            {canConvert && (
                                <button
                                    type="button"
                                    onClick={() => setShowInCHF(!showInCHF)}
                                    className={cn(
                                        "h-7 inline-flex items-center justify-center px-2.5 sm:px-3 py-0 rounded-lg border text-xs font-bold leading-none transition-all shadow-sm whitespace-nowrap cursor-pointer active:scale-95 ml-0.5 sm:ml-1 shrink-0",
                                        showInCHF
                                            ? "bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-700 shadow-sm"
                                            : "bg-emerald-50 dark:bg-emerald-950/25 text-emerald-600 dark:text-emerald-400 border-emerald-400/60 dark:border-emerald-500/50 hover:bg-emerald-100 dark:hover:bg-emerald-900/35 shadow-2xs"
                                    )}
                                    title="Währung in CHF umschalten"
                                >
                                    <span className={cn(
                                        "text-[10px] sm:text-xs font-black leading-none",
                                        showInCHF ? "text-white" : "text-emerald-600 dark:text-emerald-400"
                                    )}>
                                        CHF
                                    </span>
                                </button>
                            )}
                            </div>
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
                                {isCompareActive && compareTarget ? (
                                    <>
                                        <div className="flex flex-col items-end leading-tight">
                                            <div className="flex items-center gap-1.5">
                                                <div className={cn("size-2 rounded-full shrink-0 shadow-sm", isPositive ? "bg-green-500" : "bg-red-500")} />
                                                <span className="font-bold text-xs tabular-nums text-foreground whitespace-nowrap">
                                                    {hoveredData.plotValue !== undefined && hoveredData.plotValue !== null
                                                        ? `${hoveredData.plotValue >= 0 ? '+' : ''}${hoveredData.plotValue.toFixed(2)}%`
                                                        : 'Geschlossen'}
                                                </span>
                                            </div>
                                            <span className="text-xs text-muted-foreground truncate max-w-[96px]">
                                                {stockSymbol || 'Kurs'}
                                            </span>
                                        </div>
                                        {hoveredData.comparePlotValue !== undefined && hoveredData.comparePlotValue !== null && (
                                            <>
                                                <div className="h-7 w-px bg-border shrink-0" />
                                                <div className="flex flex-col items-end leading-tight">
                                                    <div className="flex items-center gap-1.5">
                                                        <div className="size-2 rounded-full bg-sky-400 shrink-0 shadow-sm" />
                                                        <span className="font-bold text-xs tabular-nums text-sky-400 whitespace-nowrap">
                                                            {hoveredData.comparePlotValue >= 0 ? '+' : ''}{hoveredData.comparePlotValue.toFixed(2)}%
                                                        </span>
                                                    </div>
                                                    <span className="text-xs text-muted-foreground truncate max-w-[96px]">
                                                        {compareTarget.name}
                                                    </span>
                                                </div>
                                            </>
                                        )}
                                    </>
                                ) : (
                                    <>
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
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                </div>
                {isFullscreen && (
                    <div className="flex flex-col landscape:flex-row items-end landscape:items-center justify-between landscape:justify-end gap-2.5 sm:gap-3.5 landscape:gap-2 shrink-0 ml-auto self-stretch landscape:self-auto z-10 pb-0.5 landscape:pb-0">
                        {onRefresh && !isMeasureMode ? (
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
                                    {isRefreshing ? 'Laden...' : typeof minutesAgo === 'number' ? `${minutesAgo} Min` : 'Laden'}
                                </span>
                            </button>
                        ) : null}
                        <button
                            type="button"
                            onClick={handleToggleFullscreen}
                            className="h-7 inline-flex items-center justify-center gap-1.5 px-2 sm:px-3 py-0 rounded-lg border text-xs font-bold leading-none py-0 transition-all shadow-2xs bg-amber-500/15 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/40 dark:border-amber-400/50 hover:bg-amber-500 hover:text-white dark:hover:bg-amber-500 dark:hover:text-white hover:border-amber-400 active:scale-95 cursor-pointer shrink-0 mt-auto landscape:mt-0 whitespace-nowrap"
                            title="Großansicht schließen (Esc)"
                        >
                            <Minimize2 className="size-3.5 shrink-0" />
                            <span className="hidden sm:inline landscape:inline">Verkleinern</span>
                            <span className="text-[9px] font-mono opacity-80 hidden md:inline ml-0.5">Esc</span>
                        </button>
                    </div>
                )}
            </div>

            <div className="flex flex-wrap items-center gap-2 mb-2 md:mb-4 landscape:mb-1 min-h-[38px] landscape:min-h-0">
                {(() => {
                    const toolbarToggleClass = "h-7 inline-flex items-center justify-center gap-1.5 px-2.5 sm:px-3 py-0 rounded-lg border text-[11px] sm:text-xs font-bold leading-none transition-all shadow-sm whitespace-nowrap cursor-pointer";
                    return (
                        <div className="flex flex-wrap items-center gap-2 gap-y-1.5 w-full">
                            {/* Group 1: Time range segmented bar */}
                            <div className="flex w-full sm:w-auto bg-muted/50 p-0.5 rounded-lg items-center gap-0.5 overflow-x-auto scroller-none shrink-0">
                                {(['1D', '1W', '1M', '3M', '6M', '1Y', '3Y', '5Y', 'BUY'] as TimeRange[]).map((range) => (
                                    <button
                                        key={range}
                                        onClick={() => handleRangeChange(range)}
                                        className={cn(
                                            "h-7 flex-1 sm:flex-initial inline-flex items-center justify-center px-1 sm:px-3 py-0 text-xs font-medium leading-none rounded-md border transition-all whitespace-nowrap",
                                            selectedRange === range
                                                ? "bg-background border-slate-300/80 dark:border-slate-500/50 shadow-sm text-foreground"
                                                : "border-transparent text-muted-foreground hover:text-foreground hover:bg-background/70"
                                        )}
                                    >
                                        {range === 'BUY' ? <><span className="lg:hidden">SK</span><span className="hidden lg:inline">Seit Kauf</span></> : formatRangeLabel(range)}
                                    </button>
                                ))}
                            </div>

                            {/* Group 2: Pre/Post Market */}
                            {selectedRange === '1D' && onTogglePrePost && (
                                <div className="flex items-center gap-1.5 shrink-0">
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
                                        <span className={cn("text-[10px] sm:text-xs font-bold leading-none", showPrePost ? "text-white" : "")}>
                                            <span className="hidden sm:inline">Vor-/Nachbörse</span>
                                            <span className="sm:hidden">Vor/Nach</span>
                                        </span>
                                    </button>
                                </div>
                            )}

                            {/* Group 3: Analysis Tools, Valuation Mode & Fullscreen */}
                            <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                                <div className="inline-flex items-center gap-1 shrink-0">
                                    <button
                                        ref={compareBtnRef}
                                        type="button"
                                        onClick={() => setShowComparePicker(prev => !prev)}
                                        className={cn(
                                            toolbarToggleClass,
                                            compareTarget
                                                ? "bg-sky-600 hover:bg-sky-500 text-white border-sky-700 ring-1 ring-sky-400/50"
                                                : "bg-sky-50 dark:bg-sky-900/15 text-sky-600 dark:text-sky-400 border-sky-200 dark:border-sky-500/40 hover:bg-sky-100 dark:hover:bg-sky-900/25"
                                        )}
                                        title={compareTarget ? `Vergleich aktiv: ${compareTarget.name} · Klick zum Wechseln` : 'Zweite Linie zum direkten Prozent-Vergleich im Chart einblenden'}
                                    >
                                        {isCompareLoading ? (
                                            <Loader2 className="size-3.5 shrink-0 animate-spin" />
                                        ) : (
                                            <GitCompareArrows className="size-3.5 shrink-0" />
                                        )}
                                        <span className="text-xs font-bold leading-normal hidden sm:inline max-w-[140px] truncate">
                                            {compareTarget ? `vs. ${compareTarget.name}` : 'Vergleichen'}
                                        </span>
                                    </button>
                                    {compareTarget && (
                                        <button
                                            type="button"
                                            onClick={handleClearCompare}
                                            className="h-7 w-7 inline-flex items-center justify-center rounded-lg border border-sky-500/50 bg-sky-500/15 text-sky-600 dark:text-sky-300 hover:bg-rose-500/20 hover:text-rose-500 hover:border-rose-500/50 transition-all shadow-sm cursor-pointer shrink-0 leading-none py-0"
                                            title="Vergleich beenden"
                                        >
                                            <X className="size-3.5 shrink-0" />
                                        </button>
                                    )}
                                    <InfoHelp
                                        title="Prozent-Vergleich · Schritt-für-Schritt-Anleitung für Schweizer Anleger"
                                        items={COMPARE_SWISS_GUIDE_ITEMS}
                                        buttonClassName="h-7 w-7 inline-flex items-center justify-center rounded-lg border border-sky-300 dark:border-sky-500/40 bg-sky-50 dark:bg-sky-900/15 text-sky-600 dark:text-sky-400 hover:bg-sky-100 dark:hover:bg-sky-900/30 transition-all shadow-2xs cursor-pointer shrink-0"
                                        trigger={<HelpCircle className="size-3.5 shrink-0" />}
                                        footer={
                                            <div className="p-3 rounded-lg bg-sky-500/10 border border-sky-500/25 text-xs">
                                                <p className="font-bold text-sky-700 dark:text-sky-300 mb-0.5">
                                                    10-Sekunden-Kurzformel am Morgen (Schweiz):
                                                </p>
                                                <p className="text-muted-foreground">
                                                    <strong>1.</strong> 0%-Linie prüfen (Tages-% ignorieren) → <strong>2.</strong> 2559.T (Welt) mit Nikkei 225 (Japan) &amp; ES=F (US-Future) vergleichen → <strong>3.</strong> Abstand Δ &amp; USD/CHF einordnen → <strong>4.</strong> An der SIX ab 09:15 Uhr ruhig und nur mit Limit handeln.
                                                </p>
                                            </div>
                                        }
                                    />
                                </div>
                                <button
                                    onClick={() => {
                                        setIsMeasureMode(prev => {
                                            const next = !prev;
                                            setMeasurePoints([]);
                                            if (next) {
                                                setSelectedExtremum(null);
                                                handleClearCompare();
                                            }
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
                                <div className="inline-flex items-center gap-1 shrink-0">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setShowFibonacci(prev => {
                                                const next = !prev;
                                                if (next) {
                                                    handleClearCompare();
                                                    if (!isFullscreen) handleToggleFullscreen();
                                                    handleRangeChange('3M');
                                                }
                                                return next;
                                            });
                                        }}
                                        className={cn(
                                            toolbarToggleClass,
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
                                        buttonClassName="h-7 w-7 inline-flex items-center justify-center rounded-lg border border-purple-300 dark:border-purple-500/40 bg-purple-50 dark:bg-purple-900/10 text-purple-600 dark:text-purple-400 hover:bg-purple-100 dark:hover:bg-purple-900/25 transition-all shadow-2xs cursor-pointer shrink-0"
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

                            {/* Group 4: Bestand & Gewinn/Verlust auf Bestand (nur für Bestandes-Aktien / ETFs) */}
                            {positionMetrics && (
                                <div
                                    className="h-7 inline-flex items-center leading-none py-0 px-2.5 sm:px-3 rounded-lg border border-border/80 bg-muted/40 text-[11px] sm:text-xs font-mono tabular-nums shrink-0 whitespace-nowrap gap-2 sm:gap-2.5 sm:ml-auto shadow-2xs"
                                    title={(() => {
                                        const periodLabel = positionMetrics.periodGain >= 0 ? 'Gewinn' : 'Verlust';
                                        const parts = [
                                            `Bestand: ${positionMetrics.formattedShares} Stk. · ${formatCurrency(positionMetrics.positionValue, displayCurrency, false)}`,
                                            `${periodLabel} ${formatRangeLabel(selectedRange)}: ${positionMetrics.periodGain >= 0 ? '+' : ''}${formatCurrency(positionMetrics.periodGain, displayCurrency, false)}`
                                        ];
                                        if (!positionMetrics.isBuyRange && positionMetrics.totalGain !== null && positionMetrics.totalGainPct !== null) {
                                            const totalLabel = positionMetrics.totalGain >= 0 ? 'Gewinn' : 'Verlust';
                                            parts.push(`${totalLabel} Gesamt: ${positionMetrics.totalGainPct >= 0 ? '+' : ''}${positionMetrics.totalGainPct.toFixed(1)}% · ${positionMetrics.totalGain >= 0 ? '+' : ''}${formatCurrency(positionMetrics.totalGain, displayCurrency, false)}`);
                                        }
                                        return parts.join(' | ');
                                    })()}
                                >
                                    <div className="inline-flex items-center gap-1.5 leading-none">
                                        <span className="font-sans font-semibold text-muted-foreground hidden md:inline">Bestand</span>
                                        <span className="font-bold text-foreground">{positionMetrics.formattedShares} Stk.</span>
                                        <span className="text-muted-foreground/60">·</span>
                                        <span className="font-bold text-foreground">
                                            {formatCurrency(positionMetrics.positionValue, displayCurrency, false)}
                                        </span>
                                    </div>
                                    <span className="h-3.5 w-px bg-border/80 shrink-0" />
                                    <div className="inline-flex items-center gap-1.5 leading-none">
                                        <span className={cn(
                                            "font-sans font-bold",
                                            positionMetrics.periodGain >= 0 ? "text-green-600 dark:text-green-400" : "text-red-500"
                                        )}>
                                            {positionMetrics.periodGain >= 0 ? 'Gewinn' : 'Verlust'}
                                        </span>
                                        <span className="font-sans font-semibold text-muted-foreground">
                                            {formatRangeLabel(selectedRange)}
                                        </span>
                                        {positionMetrics.isBuyRange && positionMetrics.periodGainPct !== null && (
                                            <span className={cn(
                                                "font-bold",
                                                positionMetrics.periodGain >= 0 ? "text-green-600 dark:text-green-400" : "text-red-500"
                                            )}>
                                                {positionMetrics.periodGainPct >= 0 ? '+' : ''}{positionMetrics.periodGainPct.toFixed(1)}%
                                            </span>
                                        )}
                                        <span className={cn(
                                            "font-bold",
                                            positionMetrics.periodGain >= 0 ? "text-green-600 dark:text-green-400" : "text-red-500"
                                        )}>
                                            {positionMetrics.periodGain >= 0 ? '+' : ''}{formatCurrency(positionMetrics.periodGain, displayCurrency, false)}
                                        </span>
                                    </div>
                                    {!positionMetrics.isBuyRange && positionMetrics.totalGain !== null && positionMetrics.totalGainPct !== null && (
                                        <>
                                            <span className="hidden xl:inline-block h-3.5 w-px bg-border/80 shrink-0" />
                                            <div className="hidden xl:inline-flex items-center gap-1.5 leading-none">
                                                <span className={cn(
                                                    "font-sans font-bold",
                                                    positionMetrics.totalGain >= 0 ? "text-green-600 dark:text-green-400" : "text-red-500"
                                                )}>
                                                    {positionMetrics.totalGain >= 0 ? 'Gewinn' : 'Verlust'}
                                                </span>
                                                <span className="font-sans font-semibold text-muted-foreground">Gesamt</span>
                                                <span className={cn(
                                                    "font-bold",
                                                    positionMetrics.totalGain >= 0 ? "text-green-600 dark:text-green-400" : "text-red-500"
                                                )}>
                                                    {positionMetrics.totalGainPct >= 0 ? '+' : ''}{positionMetrics.totalGainPct.toFixed(1)}%
                                                </span>
                                                <span className={cn(
                                                    "font-bold",
                                                    positionMetrics.totalGain >= 0 ? "text-green-600 dark:text-green-400" : "text-red-500"
                                                )}>
                                                    {positionMetrics.totalGain >= 0 ? '+' : ''}{formatCurrency(positionMetrics.totalGain, displayCurrency, false)}
                                                </span>
                                            </div>
                                        </>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })()}
            </div>

            {isMeasureMode && (
                <div className={cn(
                    "w-full sm:w-auto relative sm:absolute z-20 my-2 sm:my-0 animate-in fade-in max-w-full",
                    isFullscreen
                        ? "sm:top-1.5 sm:left-[54%] sm:right-auto sm:max-w-[calc(46%-140px)] slide-in-from-top-1"
                        : "sm:top-2 sm:right-2 slide-in-from-right-2"
                )}>
                    <div className="bg-blue-600 dark:bg-blue-500 text-white px-2.5 sm:px-3 py-1.5 rounded-xl shadow-2xl border border-blue-400/30 flex items-center justify-between sm:justify-start gap-1.5 sm:gap-2 text-xs overflow-x-auto scroller-none">
                        {measurement ? (
                            <div className="flex items-center gap-1.5 sm:gap-2">
                                <div className={cn(
                                    "flex flex-col items-center leading-tight px-2 py-0.5 rounded-lg border shadow-sm",
                                    measurement.percent > 0
                                        ? "bg-emerald-600 text-white border-emerald-500"
                                        : measurement.percent < 0
                                            ? "bg-rose-600 text-white border-rose-500"
                                            : "bg-white/20 text-white border-white/30"
                                )}>
                                    <span className="text-sm sm:text-base font-black whitespace-nowrap text-white">
                                        {measurement.percent > 0 ? '+' : ''}{measurement.percent.toFixed(2)}%
                                    </span>
                                    <span className="text-xs font-bold text-white/95 whitespace-nowrap">
                                        {measurement.diff > 0 ? '+' : ''}{formatCurrency(measurement.diff, displayCurrency, false)}
                                    </span>
                                </div>
                                <div className="h-7 w-px bg-white/20" />
                                <div className="flex flex-col text-xs text-white font-medium leading-tight gap-0.5">
                                    <div className="flex justify-between items-center gap-1.5 sm:gap-2">
                                        <span className="font-bold text-blue-100 flex items-center gap-1">
                                            <span className="w-6 shrink-0">Von:</span>
                                            {measurement.p1.extremumType === 'high' ? (
                                                <span className="bg-emerald-600 text-white text-xs px-1 h-4 flex items-center justify-center rounded font-black shrink-0 border border-emerald-500 shadow-sm">H</span>
                                            ) : measurement.p1.extremumType === 'low' ? (
                                                <span className="bg-rose-600 text-white text-xs px-1 h-4 flex items-center justify-center rounded font-black shrink-0 border border-rose-500 shadow-sm">T</span>
                                            ) : measurement.p1.purchaseTag ? (
                                                <span className="bg-amber-500 text-white text-xs px-1 h-4 flex items-center justify-center rounded font-black shrink-0 border border-amber-400 shadow-sm">{measurement.p1.purchaseTag}</span>
                                            ) : (
                                                <span className="w-4 shrink-0" />
                                            )}
                                        </span>
                                        <span className="tabular-nums text-white font-bold whitespace-nowrap">
                                            {formatCurrency(measurement.p1.value, displayCurrency, false)}
                                            <span className="ml-1 text-xs text-blue-200 font-normal">
                                                {formatPointDate(measurement.p1.date)}
                                            </span>
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-center gap-1.5 sm:gap-2">
                                        <span className="font-bold text-blue-100 flex items-center gap-1">
                                            <span className="w-6 shrink-0">Bis:</span>
                                            {measurement.p2.extremumType === 'high' ? (
                                                <span className="bg-emerald-600 text-white text-xs px-1 h-4 flex items-center justify-center rounded font-black shrink-0 border border-emerald-500 shadow-sm">H</span>
                                            ) : measurement.p2.extremumType === 'low' ? (
                                                <span className="bg-rose-600 text-white text-xs px-1 h-4 flex items-center justify-center rounded font-black shrink-0 border border-rose-500 shadow-sm">T</span>
                                            ) : measurement.p2.purchaseTag ? (
                                                <span className="bg-amber-500 text-white text-xs px-1 h-4 flex items-center justify-center rounded font-black shrink-0 border border-amber-400 shadow-sm">{measurement.p2.purchaseTag}</span>
                                            ) : (
                                                <span className="w-4 shrink-0" />
                                            )}
                                        </span>
                                        <span className="tabular-nums text-white font-bold whitespace-nowrap">
                                            {formatCurrency(measurement.p2.value, displayCurrency, false)}
                                            <span className="ml-1 text-xs text-blue-200 font-normal">
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
                                    className="bg-white/20 hover:bg-white/30 p-1.5 rounded-lg transition-colors flex items-center justify-center text-white shrink-0 cursor-pointer"
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
                                            <span className="bg-emerald-600 text-white text-xs px-1 h-4 flex items-center justify-center rounded font-black shrink-0 border border-emerald-500 shadow-sm">H</span>
                                        ) : measurePoints[0].extremumType === 'low' ? (
                                            <span className="bg-rose-600 text-white text-xs px-1 h-4 flex items-center justify-center rounded font-black shrink-0 border border-rose-500 shadow-sm">T</span>
                                        ) : measurePoints[0].purchaseTag ? (
                                            <span className="bg-amber-500 text-white text-xs px-1 h-4 flex items-center justify-center rounded font-black shrink-0 border border-amber-400 shadow-sm">{measurePoints[0].purchaseTag}</span>
                                        ) : null}
                                        <span className="tabular-nums text-white font-bold">{formatCurrency(measurePoints[0].value, displayCurrency, false)}</span>
                                    </span>
                                    <span className="text-xs text-blue-100">2. Punkt wählen: H, T, Kauf oder im Chart</span>
                                </div>
                            </div>
                        ) : (
                            <div className="flex items-center gap-2">
                                <Ruler className="size-4 text-blue-200 shrink-0" />
                                <div className="flex flex-col leading-tight">
                                    <span className="text-xs font-bold whitespace-nowrap">Messmodus aktiv</span>
                                    <span className="text-xs text-blue-100">1. Punkt wählen: H, T, Kauf oder im Chart</span>
                                </div>
                            </div>
                        )}

                        {/* Quick H / T selection buttons in toolbar (untereinander ausgerichtet) */}
                        <div className="flex flex-col gap-1 pl-1.5 border-l border-white/20 justify-center shrink-0">
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleExtremumMeasure('high');
                                }}
                                className={cn(
                                    "px-2 py-0.5 rounded text-xs font-bold transition-all flex items-center justify-between gap-1.5 border min-w-[58px] cursor-pointer leading-none",
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
                                    <span className="bg-black/30 text-white px-1 rounded text-xs font-bold leading-none">P{highMeasureIdx + 1}</span>
                                ) : (
                                    <span className="text-xs text-white/60 font-bold leading-none">H</span>
                                )}
                            </button>

                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleExtremumMeasure('low');
                                }}
                                className={cn(
                                    "px-2 py-0.5 rounded text-xs font-bold transition-all flex items-center justify-between gap-1.5 border min-w-[58px] cursor-pointer leading-none",
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
                                    <span className="bg-black/30 text-white px-1 rounded text-xs font-bold leading-none">P{lowMeasureIdx + 1}</span>
                                ) : (
                                    <span className="text-xs text-white/60 font-bold leading-none">T</span>
                                )}
                            </button>
                        </div>

                        {/* Quick Kauf 1 / Kauf 2 ... buttons in toolbar */}
                        {selectedRange !== '1D' && purchaseMarkers.length > 0 && (
                            <div className={cn(
                                "pl-1.5 border-l border-white/20 shrink-0",
                                purchaseMarkers.length > 1 ? "grid grid-rows-2 grid-flow-col gap-1" : "flex flex-col justify-center"
                            )}>
                                {purchaseMarkers.map((marker) => {
                                    const tag = purchaseMarkers.length > 1 ? `K${marker.index + 1}` : 'Kauf';
                                    const matchTag = purchaseMarkers.length > 1 ? `K${marker.index + 1}` : 'K';
                                    const mIdx = measurePoints.findIndex(p => p.purchaseTag === matchTag && p.date === marker.dateKey);
                                    return (
                                        <button
                                            key={marker.id}
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handlePurchaseMeasure(marker);
                                            }}
                                            className={cn(
                                                "px-2 py-0.5 rounded text-xs font-bold transition-all flex items-center justify-between gap-1 border cursor-pointer leading-none whitespace-nowrap",
                                                mIdx >= 0
                                                    ? "bg-amber-500 text-white border-white/40 shadow-sm"
                                                    : "bg-white/20 hover:bg-white/30 text-white border-white/20"
                                            )}
                                            title={`${marker.tooltipText} als Messpunkt wählen`}
                                        >
                                            <span>{tag}</span>
                                            {mIdx >= 0 && (
                                                <span className="bg-black/30 text-white px-1 rounded text-xs font-bold leading-none">P{mIdx + 1}</span>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        )}

                        <div className="flex items-center gap-1 pl-1.5 border-l border-white/20 shrink-0">
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setShowFibonacci(prev => {
                                        const next = !prev;
                                        if (next && measurePoints.length < 2 && selectedRange === '1D') {
                                            if (!isFullscreen) handleToggleFullscreen();
                                            handleRangeChange('3M');
                                        }
                                        return next;
                                    });
                                }}
                                className={cn(
                                    "h-7 px-2 rounded text-xs font-bold transition-all inline-flex items-center justify-center leading-none gap-1 cursor-pointer",
                                    showFibonacci
                                        ? "bg-purple-500 text-white shadow-sm"
                                        : "bg-white/20 hover:bg-white/30 text-white"
                                )}
                                title="Fibonacci-Linien speziell für diesen 2-Punkte-Messbereich ein-/ausblenden"
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
                                    className="h-7 bg-white/20 hover:bg-white/30 px-2 rounded text-xs font-bold inline-flex items-center justify-center leading-none transition-colors cursor-pointer"
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
                                className="h-7 w-7 bg-white/20 hover:bg-white/40 rounded-full inline-flex items-center justify-center transition-colors cursor-pointer"
                                title="Messen beenden"
                            >
                                <X className="size-3.5" />
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Active Compare Legend Strip */}
            {compareTarget && (
                <div className="mb-2 px-2.5 py-1.5 rounded-lg border border-sky-500/30 bg-sky-500/10 dark:bg-sky-950/30 flex flex-wrap items-center justify-between gap-x-2 gap-y-1.5 text-xs">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 min-w-0">
                        <div className="inline-flex items-center gap-1.5 font-bold text-foreground">
                            <span className={cn("size-2.5 rounded-full shrink-0", isPositive ? "bg-green-500" : "bg-red-500")} />
                            <span className="truncate max-w-[130px] 2xl:max-w-[180px] leading-normal">{stockName || stockSymbol || 'Aktueller Titel'}</span>
                            {isCompareActive && compareOverlay.summary && (
                                <span className={cn(
                                    "tabular-nums font-extrabold",
                                    compareOverlay.summary.primaryLastPct >= 0 ? "text-green-600 dark:text-green-400" : "text-rose-500"
                                )}>
                                    {compareOverlay.summary.primaryLastPct >= 0 ? '+' : ''}{compareOverlay.summary.primaryLastPct.toFixed(2)}%
                                </span>
                            )}
                        </div>
                        <span className="text-muted-foreground font-semibold">vs.</span>
                        <div className="inline-flex items-center gap-1.5 font-bold text-sky-600 dark:text-sky-300">
                            {onOpenCompareSymbol ? (
                                <button
                                    type="button"
                                    onClick={() => onOpenCompareSymbol({
                                        symbol: compareTarget.symbol,
                                        name: compareTarget.name,
                                        currency: compareCurrency || compareTarget.currency || 'USD',
                                    })}
                                    className="inline-flex items-center gap-1 font-bold text-sky-600 dark:text-sky-300 hover:text-sky-500 dark:hover:text-sky-200 hover:underline underline-offset-2 transition-colors cursor-pointer group"
                                    title={`${compareTarget.name} (${compareTarget.symbol}) direkt im Chart öffnen`}
                                >
                                    <span className="size-2.5 rounded-full bg-sky-400 shrink-0" />
                                    <span className="truncate max-w-[135px] 2xl:max-w-[180px] leading-normal">{compareTarget.name}</span>
                                    <span className="hidden 2xl:inline text-xs font-mono text-muted-foreground">{compareTarget.symbol}</span>
                                    <ArrowUpRight className="size-3.5 shrink-0 opacity-75 group-hover:opacity-100 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                                </button>
                            ) : (
                                <>
                                    <span className="size-2.5 rounded-full bg-sky-400 shrink-0" />
                                    <span className="truncate max-w-[135px] 2xl:max-w-[180px] leading-normal">{compareTarget.name}</span>
                                    <span className="hidden 2xl:inline text-xs font-mono text-muted-foreground">{compareTarget.symbol}</span>
                                </>
                            )}
                            {isCompareLoading ? (
                                <span className="inline-flex items-center gap-1 text-muted-foreground font-medium">
                                    <Loader2 className="size-3 animate-spin" />
                                    Lädt…
                                </span>
                            ) : compareError ? (
                                <span className="text-rose-500 font-semibold">{compareError}</span>
                            ) : isCompareActive && compareOverlay.summary ? (
                                <span className="tabular-nums font-extrabold text-sky-600 dark:text-sky-300">
                                    {compareOverlay.summary.compareLastPct >= 0 ? '+' : ''}{compareOverlay.summary.compareLastPct.toFixed(2)}%
                                </span>
                            ) : null}
                        </div>
                        {isCompareActive && compareOverlay.summary && (
                            <span
                                className={cn(
                                    "h-7 inline-flex items-center justify-center gap-1 px-2 py-0 rounded-md border font-bold tabular-nums leading-none whitespace-nowrap",
                                    compareOverlay.summary.spreadPct >= 0
                                        ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-600 dark:text-emerald-400"
                                        : "bg-rose-500/15 border-rose-500/30 text-rose-600 dark:text-rose-400"
                                )}
                                title={`Abstand: ${compareOverlay.summary.spreadPct >= 0 ? '+' : ''}${compareOverlay.summary.spreadPct.toFixed(2)}%`}
                            >
                                <span className="hidden 2xl:inline">Abstand</span>
                                <span className="2xl:hidden">Δ</span>
                                <span>{compareOverlay.summary.spreadPct >= 0 ? '+' : ''}{compareOverlay.summary.spreadPct.toFixed(2)}%</span>
                            </span>
                        )}
                    </div>
                    <div className="flex flex-wrap items-center justify-between sm:justify-end gap-1.5 w-full sm:w-auto sm:shrink-0 sm:ml-auto min-w-0 max-w-full">
                        {selectedRange === '1D' && isCompareActive && compareOverlay.summary && (
                            <div
                                className="h-7 inline-flex items-center p-0.5 rounded-md border border-border/80 bg-background/70 min-w-0 max-w-full overflow-x-auto no-scrollbar"
                                title="Zeitachsen-Synchronisierung im 1D-Vergleich umschalten"
                            >
                                <button
                                    type="button"
                                    onClick={() => setCompareTimeMode('sync')}
                                    className={cn(
                                        "h-6 inline-flex items-center justify-center px-1 sm:px-1.5 2xl:px-2 py-0 rounded text-xs font-bold leading-none transition-colors cursor-pointer whitespace-nowrap",
                                        compareOverlay.summary.activeTimeMode === 'sync'
                                            ? "bg-sky-600 text-white shadow-sm"
                                            : "text-muted-foreground hover:text-foreground"
                                    )}
                                    title="Echte Schweizer Uhrzeit synchronisiert (ganzer Tag inkl. US-Vorbörse & US-Abend)"
                                >
                                    Zeit-Sync
                                </button>
                                <button
                                    type="button"
                                    disabled={!compareOverlay.summary.hasPre10_1530Overlap}
                                    onClick={() => compareOverlay.summary?.hasPre10_1530Overlap && setCompareTimeMode('pre10_1530')}
                                    className={cn(
                                        "h-6 inline-flex items-center justify-center px-1 sm:px-1.5 2xl:px-2 py-0 rounded text-xs font-bold leading-none transition-colors whitespace-nowrap",
                                        !compareOverlay.summary.hasPre10_1530Overlap
                                            ? "opacity-40 cursor-not-allowed text-muted-foreground"
                                            : compareOverlay.summary.activeTimeMode === 'pre10_1530'
                                                ? "bg-sky-600 text-white shadow-sm cursor-pointer"
                                                : "text-muted-foreground hover:text-foreground cursor-pointer"
                                    )}
                                    title={
                                        compareOverlay.summary.hasPre10_1530Overlap
                                            ? "Fokus US-Vorbörse 10:00 bis 15:30 Uhr gegen laufenden Europa-Chart · beide starten um 10:00 Uhr bei 0%"
                                            : "Keine gemeinsamen Kursdaten zwischen 10:00 und 15:30 Uhr verfügbar"
                                    }
                                >
                                    10:00–15:30
                                </button>
                                <button
                                    type="button"
                                    disabled={!compareOverlay.summary.hasUs1530Overlap}
                                    onClick={() => compareOverlay.summary?.hasUs1530Overlap && setCompareTimeMode('us1530')}
                                    className={cn(
                                        "h-6 inline-flex items-center justify-center px-1 sm:px-1.5 2xl:px-2 py-0 rounded text-xs font-bold leading-none transition-colors whitespace-nowrap",
                                        !compareOverlay.summary.hasUs1530Overlap
                                            ? "opacity-40 cursor-not-allowed text-muted-foreground"
                                            : compareOverlay.summary.activeTimeMode === 'us1530'
                                                ? "bg-sky-600 text-white shadow-sm cursor-pointer"
                                                : "text-muted-foreground hover:text-foreground cursor-pointer"
                                    )}
                                    title={
                                        compareOverlay.summary.hasUs1530Overlap
                                            ? "Startet exakt um 15:30 Uhr bei 0% · Fokus auf Live-Handel Europa + USA 15:30–17:30 Uhr"
                                            : "Keine gemeinsamen Kursdaten ab 15:30 Uhr verfügbar"
                                    }
                                >
                                    Ab 15:30
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setCompareTimeMode('session')}
                                    className={cn(
                                        "h-6 inline-flex items-center justify-center px-1 sm:px-1.5 2xl:px-2 py-0 rounded text-xs font-bold leading-none transition-colors cursor-pointer whitespace-nowrap",
                                        compareOverlay.summary.activeTimeMode === 'session'
                                            ? "bg-sky-600 text-white shadow-sm"
                                            : "text-muted-foreground hover:text-foreground"
                                    )}
                                    title="Zeitachsen-Sync aus · legt beide regulären Börsenstarts links auf 0% übereinander"
                                >
                                    Ohne Sync
                                </button>
                            </div>
                        )}
                        {selectedRange !== '1D' && isCompareActive && compareOverlay.summary && (
                            <span className="text-xs text-muted-foreground hidden md:inline">
                                Normiert ab Start 0%
                            </span>
                        )}
                        <InfoHelp
                            title="Prozent-Vergleich · Schritt-für-Schritt-Anleitung für Schweizer Anleger"
                            items={COMPARE_SWISS_GUIDE_ITEMS}
                            buttonClassName="h-7 inline-flex items-center justify-center gap-1 px-2 py-0 rounded-md border border-sky-500/40 bg-sky-500/15 hover:bg-sky-500/25 text-xs font-bold leading-none text-sky-600 dark:text-sky-300 transition-colors cursor-pointer shrink-0 whitespace-nowrap"
                            trigger={
                                <>
                                    <HelpCircle className="size-3.5 shrink-0" />
                                    <span className="hidden sm:inline">Anleitung</span>
                                </>
                            }
                            footer={
                                <div className="p-3 rounded-lg bg-sky-500/10 border border-sky-500/25 text-xs">
                                    <p className="font-bold text-sky-700 dark:text-sky-300 mb-0.5">
                                        10-Sekunden-Kurzformel am Morgen (Schweiz):
                                    </p>
                                    <p className="text-muted-foreground">
                                        <strong>1.</strong> 0%-Linie prüfen (Tages-% ignorieren) → <strong>2.</strong> 2559.T (Welt) mit Nikkei 225 (Japan) &amp; ES=F (US-Future) vergleichen → <strong>3.</strong> Abstand Δ &amp; USD/CHF einordnen → <strong>4.</strong> An der SIX ab 09:15 Uhr ruhig und nur mit Limit handeln.
                                    </p>
                                </div>
                            }
                        />
                        <button
                            type="button"
                            onClick={handleClearCompare}
                            className="h-7 inline-flex items-center justify-center gap-1 px-2 2xl:px-2.5 py-0 rounded-md border border-border/80 bg-background/80 hover:bg-rose-500/15 hover:text-rose-500 hover:border-rose-500/40 text-xs font-semibold leading-none text-muted-foreground transition-colors cursor-pointer shrink-0 whitespace-nowrap"
                            title="Vergleich ausblenden"
                        >
                            <X className="size-3.5 shrink-0" />
                            <span className="hidden 2xl:inline">Schliessen</span>
                        </button>
                    </div>
                </div>
            )}

            <div className={cn(
                "relative w-full min-w-0",
                isFullscreen
                    ? "flex-1 w-full min-h-0 min-w-0"
                    : "h-[320px] sm:h-[410px] landscape:h-[190px] min-h-[180px]"
            )}>
                {/* Desktop Dynamic Hover Overlay (Fixed position inside chart - zero layout shift / zero flicker) */}
                {hoveredData && (
                    <div className="hidden sm:flex items-center gap-3.5 text-sm z-20 pointer-events-none absolute bottom-7 left-2 bg-background/50 dark:bg-slate-950/50 backdrop-blur-[1px] border border-border/50 rounded-lg px-3 py-1.5 shadow-sm">
                        <div className="flex flex-col items-start leading-tight">
                            <span className="font-bold text-sm text-foreground whitespace-nowrap">
                                {(() => {
                                    const d = new Date(hoveredData.date);
                                    const weekday = d.toLocaleDateString('de-DE', { weekday: 'short' });
                                    const dateStr = d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' });
                                    return `${weekday} ${dateStr}`;
                                })()}
                            </span>
                            <span className="text-xs font-semibold text-muted-foreground">
                                {new Date(hoveredData.date).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                        </div>
                        <div className="h-7 w-px bg-border" />
                        {isCompareActive && compareTarget ? (
                            <>
                                <div className="flex flex-col items-start leading-tight">
                                    {hoveredData.plotValue !== undefined && hoveredData.plotValue !== null ? (
                                        <>
                                            <div className="flex items-center gap-1.5">
                                                <div className={cn("size-2 rounded-full shrink-0 shadow-sm", isPositive ? "bg-green-500" : "bg-red-500")} />
                                                <span className={cn(
                                                    "font-bold text-sm tabular-nums whitespace-nowrap",
                                                    hoveredData.plotValue >= 0 ? "text-green-600 dark:text-green-400" : "text-rose-500"
                                                )}>
                                                    {hoveredData.plotValue >= 0 ? '+' : ''}{hoveredData.plotValue.toFixed(2)}%
                                                </span>
                                                <span className="text-xs font-semibold tabular-nums text-muted-foreground whitespace-nowrap">
                                                    · {formatCurrency(hoveredData.value, displayCurrency, false)}
                                                </span>
                                            </div>
                                            <span className="text-xs font-semibold text-muted-foreground truncate max-w-[180px]">
                                                {stockSymbol || stockName || 'Kurs'}
                                            </span>
                                        </>
                                    ) : (
                                        <>
                                            <div className="flex items-center gap-1.5">
                                                <div className="size-2 rounded-full bg-slate-400 shrink-0" />
                                                <span className="font-bold text-xs text-muted-foreground whitespace-nowrap">
                                                    Börsenschluss
                                                </span>
                                            </div>
                                            <span className="text-xs font-semibold text-muted-foreground truncate max-w-[180px]">
                                                {stockSymbol || stockName || 'Kurs'}
                                            </span>
                                        </>
                                    )}
                                </div>
                                {hoveredData.comparePlotValue !== undefined && hoveredData.comparePlotValue !== null && (
                                    <>
                                        <div className="h-7 w-px bg-border" />
                                        <div className="flex flex-col items-start leading-tight">
                                            <div className="flex items-center gap-1.5">
                                                <div className="size-2 rounded-full bg-sky-400 shrink-0 shadow-sm" />
                                                <span className="font-bold text-sm tabular-nums text-sky-500 dark:text-sky-300 whitespace-nowrap">
                                                    {hoveredData.comparePlotValue >= 0 ? '+' : ''}{hoveredData.comparePlotValue.toFixed(2)}%
                                                </span>
                                                {hoveredData.compareRawValue !== undefined && hoveredData.compareRawValue !== null && (
                                                    <span className="text-xs font-semibold tabular-nums text-muted-foreground whitespace-nowrap">
                                                        · {formatCurrency(hoveredData.compareRawValue, compareCurrency, false)}
                                                    </span>
                                                )}
                                            </div>
                                            <span className="text-xs font-semibold text-sky-600 dark:text-sky-400 truncate max-w-[230px]">
                                                {compareTarget.name}
                                                {compareOverlay.summary?.usedSessionFallback && hoveredData.compareDate
                                                    ? ` · ${new Date(hoveredData.compareDate).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}`
                                                    : hoveredData.compareSession === 'pre'
                                                        ? ' · US-Vorbörse'
                                                        : hoveredData.compareSession === 'post'
                                                            ? ' · US-Nachbörse'
                                                            : ''}
                                            </span>
                                        </div>
                                        {hoveredData.plotValue !== undefined && hoveredData.plotValue !== null && (
                                            <>
                                                <div className="h-7 w-px bg-border" />
                                                <div className="flex flex-col items-start leading-tight">
                                                    {(() => {
                                                        const spread = hoveredData.plotValue - hoveredData.comparePlotValue;
                                                        return (
                                                            <span className={cn(
                                                                "font-bold text-sm tabular-nums whitespace-nowrap",
                                                                spread >= 0 ? "text-emerald-500" : "text-rose-500"
                                                            )}>
                                                                Δ {spread >= 0 ? '+' : ''}{spread.toFixed(2)}%
                                                            </span>
                                                        );
                                                    })()}
                                                    <span className="text-xs font-semibold text-muted-foreground">Abstand</span>
                                                </div>
                                            </>
                                        )}
                                    </>
                                )}
                            </>
                        ) : (
                            <>
                                <div className="flex flex-col items-start leading-tight">
                                    <div className="flex items-center gap-1.5">
                                        <div className={cn("size-2 rounded-full shrink-0 shadow-sm", isPositive ? "bg-green-500" : "bg-red-500")} />
                                        <span className="font-bold text-sm tabular-nums text-foreground whitespace-nowrap">
                                            {formatCurrency(hoveredData.value, displayCurrency, false)}
                                        </span>
                                    </div>
                                    <span className="text-xs font-semibold text-muted-foreground">
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
                            </>
                        )}
                    </div>
                )}
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
                            data={chartDisplayData}
                            margin={{
                                top: (selectedRange === '1D' && showPrePost && hasPrePostData)
                                    || (isCompareActive && Boolean(compareOverlay.summary?.primaryCloseDate || compareOverlay.summary?.comparePostStartDate))
                                    ? 26
                                    : 14,
                                right: 0,
                                left: 0,
                                bottom: 4
                            }}
                            onMouseMove={(data: any) => {
                                if (data?.activePayload?.[0]?.payload) {
                                    setHoveredData(data.activePayload[0].payload);
                                } else if (data?.activeLabel) {
                                    // Fallback if activePayload is missing but we have a label (date)
                                    // This can happen when moving fast
                                    const point = chartDisplayData.find(d => d.date === data.activeLabel);
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
                                padding={{ left: 16, right: 8 }}
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
                                    if (chartDisplayData.length === 0) return undefined;

                                    // 1D extended comparison (e.g. VWRA.L 09:05–17:30 + VT 17:30–22:00/02:00):
                                    // guarantee key session boundary timestamps (17:30 Börsenschluss, 22:00 US-Schluss, last point) appear cleanly on X-axis
                                    if (selectedRange === '1D' && isCompareActive && compareOverlay.summary?.primaryCloseDate) {
                                        const keyDates = [
                                            chartDisplayData[0].date,
                                            compareOverlay.summary.primaryCloseDate,
                                            compareOverlay.summary.comparePostStartDate,
                                            chartDisplayData[chartDisplayData.length - 1].date,
                                        ].filter((d): d is string => Boolean(d));

                                        const targetCount = isNarrowPortrait ? 6 : (isFullscreen ? 14 : 9);
                                        const stepIdx = Math.max(1, Math.floor(chartDisplayData.length / targetCount));
                                        const picked = new Set<string>(keyDates);
                                        const minGapMs = (isNarrowPortrait ? 75 : 42) * 60 * 1000;
                                        const keyMs = keyDates.map(d => new Date(d).getTime());

                                        for (let i = stepIdx; i < chartDisplayData.length - 1; i += stepIdx) {
                                            const dStr = chartDisplayData[i].date;
                                            const t = new Date(dStr).getTime();
                                            const tooCloseToKey = keyMs.some(km => Math.abs(t - km) < minGapMs);
                                            if (!tooCloseToKey) {
                                                picked.add(dStr);
                                            }
                                        }

                                        return Array.from(picked).sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
                                    }

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
                                minTickGap={['1W', '1M', '3M', '6M', '1Y', '3Y', '5Y', 'BUY'].includes(selectedRange) || (selectedRange === '1D' && isCompareActive && Boolean(compareOverlay.summary?.primaryCloseDate)) ? 0 : 30}
                                interval={['1W', '1M', '3M', '6M', '1Y', '3Y', '5Y', 'BUY'].includes(selectedRange) || (selectedRange === '1D' && isCompareActive && Boolean(compareOverlay.summary?.primaryCloseDate)) ? 0 : 'preserveStartEnd'}
                            />
                            <YAxis
                                domain={[activeDomainMin, activeDomainMax]}
                                ticks={activeYAxisInfo.ticks}
                                hide={false}
                                orientation="right"
                                tick={{ fontSize: 12, fill: '#e2e8f0' }}
                                tickFormatter={(val) => {
                                    if (isCompareActive) {
                                        const decimals = activeYAxisInfo.step >= 1 ? 0 : activeYAxisInfo.step >= 0.1 ? 1 : 2;
                                        const sign = val > 0 ? '+' : '';
                                        const formatted = new Intl.NumberFormat('de-CH', {
                                            minimumFractionDigits: decimals,
                                            maximumFractionDigits: decimals,
                                        }).format(val);
                                        return `${sign}${formatted}%`;
                                    }
                                    if (activeYAxisInfo.step >= 1 && (Number.isInteger(val) || Math.abs(val - Math.round(val)) < 1e-4)) {
                                        return Math.round(val).toString();
                                    }
                                    const decimals = activeYAxisInfo.step >= 1 ? 0 : activeYAxisInfo.step >= 0.1 ? 1 : activeYAxisInfo.step >= 0.01 ? 2 : 3;
                                    return new Intl.NumberFormat('de-CH', {
                                        minimumFractionDigits: decimals,
                                        maximumFractionDigits: decimals,
                                    }).format(val);
                                }}
                                axisLine={false}
                                tickLine={false}
                                width={isCompareActive ? 54 : 44}
                                mirror={false}
                            />
                            {/* Zero baseline when normalized % comparison overlay is active */}
                            {isCompareActive && (
                                <ReferenceLine
                                    y={0}
                                    stroke="#64748b"
                                    strokeWidth={1.25}
                                    strokeDasharray="4 4"
                                    strokeOpacity={0.85}
                                />
                            )}
                            {/* Session boundary dividers on extended 1D comparison (e.g. Börsenschluss 17:30 + US-Schluss 22:00 → Nachbörse) */}
                            {isCompareActive && selectedRange === '1D' && compareOverlay.summary?.primaryCloseDate && (() => {
                                const closeDate = compareOverlay.summary.primaryCloseDate!;
                                const closeTimeStr = new Date(closeDate).toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit' });
                                const postDate = compareOverlay.summary.comparePostStartDate;
                                const postTimeStr = postDate ? new Date(postDate).toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit' }) : '';
                                const postIdx = postDate ? chartDisplayData.findIndex(p => p.date === postDate) : -1;
                                const postNearRightEdge = postIdx >= 0 && chartDisplayData.length > 5 && ((chartDisplayData.length - 1 - postIdx) / chartDisplayData.length) < 0.16;
                                return (
                                    <>
                                        <ReferenceLine
                                            x={closeDate}
                                            stroke="#f59e0b"
                                            strokeWidth={1.5}
                                            strokeDasharray="4 3"
                                            strokeOpacity={0.85}
                                            label={(props: any) => {
                                                const { viewBox } = props || {};
                                                if (!viewBox) return <g />;
                                                const { x, y } = viewBox;
                                                return (
                                                    <text
                                                        x={x - 6}
                                                        y={y - 8}
                                                        textAnchor="end"
                                                        fill="#fbbf24"
                                                        fontSize={12}
                                                        fontWeight={700}
                                                    >
                                                        ← Börsenschluss {closeTimeStr}
                                                    </text>
                                                );
                                            }}
                                        />
                                        {postDate && (
                                            <ReferenceLine
                                                x={postDate}
                                                stroke="#818cf8"
                                                strokeWidth={1.5}
                                                strokeDasharray="4 3"
                                                strokeOpacity={0.85}
                                                label={(props: any) => {
                                                    const { viewBox } = props || {};
                                                    if (!viewBox) return <g />;
                                                    const { x, y } = viewBox;
                                                    return (
                                                        <text
                                                            x={postNearRightEdge ? x - 6 : x + 6}
                                                            y={y - 8}
                                                            textAnchor={postNearRightEdge ? 'end' : 'start'}
                                                            fill="#a5b4fc"
                                                            fontSize={12}
                                                            fontWeight={700}
                                                        >
                                                            {postNearRightEdge ? `← US-Schluss ${postTimeStr}` : `US-Schluss ${postTimeStr} · Nachbörse →`}
                                                        </text>
                                                    );
                                                }}
                                            />
                                        )}
                                    </>
                                );
                            })()}
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
                            {!isCompareActive && (
                                <>
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

                            {/* 5. Vorbörse / Nachbörse Referenzlinie (1D wenn Vor-/Nachbörse aktiv) */}
                            {selectedRange === '1D' && showPrePost && effectiveExtendedHours && effectiveExtendedHours.price && effectiveExtendedHours.price >= domainMin && effectiveExtendedHours.price <= domainMax && (
                                <ReferenceLine
                                    y={effectiveExtendedHours.price}
                                    stroke={effectiveExtendedHours.isPre ? "#f59e0b" : "#818cf8"}
                                    strokeWidth={1.8}
                                    strokeDasharray="4 3"
                                    strokeOpacity={0.95}
                                    label={(props: any) => {
                                        const { viewBox } = props || {};
                                        if (!viewBox) return <g />;
                                        const { x, y, width } = viewBox;
                                        const rightEdge = x + width - 6;
                                        const yOffset = getRightLabelYOffset(effectiveExtendedHours.price!, [effectivePurchasePrice, effectiveBuyLimit, effectiveModelBuyPrice, effectiveFairValue]);
                                        const color = effectiveExtendedHours.isPre ? "#fbbf24" : "#a5b4fc";
                                        return (
                                            <g className="select-none pointer-events-none">
                                                <text
                                                    x={rightEdge}
                                                    y={y + yOffset}
                                                    textAnchor="end"
                                                    fill={color}
                                                    stroke="#0f172a"
                                                    strokeWidth={2.5}
                                                    paintOrder="stroke fill"
                                                    fontSize={isFullscreen ? 11 : 9.5}
                                                    fontWeight={700}
                                                >
                                                    {effectiveExtendedHours.label} · {formatCurrency(effectiveExtendedHours.price!, displayCurrency, false)}
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
                            </>
                            )}
                            <Tooltip
                                content={() => null}
                                cursor={{ stroke: 'var(--primary)', strokeWidth: 1, strokeDasharray: '4 4' }}
                                isAnimationActive={false}
                            />
                            <Area
                                type="monotone"
                                dataKey={isCompareActive ? "plotValue" : "value"}
                                stroke={isPositive ? "#22c55e" : "#ef4444"}
                                strokeWidth={2}
                                fillOpacity={isCompareActive ? 0.5 : 1}
                                fill="url(#colorValue)"
                                isAnimationActive={false}
                            />
                            {/* Normalized Comparison Overlay Line */}
                            {isCompareActive && (
                                <Area
                                    type="monotone"
                                    dataKey="comparePlotValue"
                                    stroke="#38bdf8"
                                    strokeWidth={2.25}
                                    fill="none"
                                    fillOpacity={0}
                                    dot={false}
                                    connectNulls
                                    isAnimationActive={false}
                                    activeDot={{ r: 4.5, fill: '#38bdf8', stroke: '#ffffff', strokeWidth: 1.5 }}
                                />
                            )}
                            {/* SMA 200 Line (hidden during normalized % comparison) */}
                            {!isCompareActive && (
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
                            )}
                            {/* Live End-Point Dot on current price (like Yahoo Finance) */}
                            {chartDisplayData.length > 0 && (() => {
                                if (isCompareActive && compareOverlay.summary?.primaryLastPoint) {
                                    const pt = compareOverlay.summary.primaryLastPoint;
                                    const liveDotColor = isPositive ? '#22c55e' : '#ef4444';
                                    return (
                                        <ReferenceDot
                                            key={`live-endpoint-${pt.date}-pct`}
                                            x={pt.date}
                                            y={pt.plotValue}
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
                                }
                                const lastPoint = chartDisplayData[chartDisplayData.length - 1];
                                const liveDotColor = lastPoint.session === 'post' ? '#818cf8' : lastPoint.session === 'pre' ? '#f59e0b' : (isPositive ? '#22c55e' : '#ef4444');
                                return (
                                    <ReferenceDot
                                        key={`live-endpoint-${lastPoint.date}-px`}
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
                            {/* Live End-Point Dot on comparison overlay */}
                            {isCompareActive && compareOverlay.summary?.lastComparePoint && (
                                <ReferenceDot
                                    key={`compare-endpoint-${compareOverlay.summary.lastComparePoint.date}`}
                                    x={compareOverlay.summary.lastComparePoint.date}
                                    y={compareOverlay.summary.lastComparePoint.comparePlotValue}
                                    r={5}
                                    shape={(props: any) => {
                                        const { cx, cy } = props;
                                        if (typeof cx !== 'number' || typeof cy !== 'number') return <g />;
                                        return (
                                            <g className="pointer-events-none select-none" style={{ outline: 'none' }} tabIndex={-1}>
                                                <circle cx={cx} cy={cy} r={8} fill="#38bdf8" fillOpacity={0.25} />
                                                <circle cx={cx} cy={cy} r={4} fill="#38bdf8" stroke="#ffffff" strokeWidth={1.5} />
                                            </g>
                                        );
                                    }}
                                />
                            )}
                        </AreaChart>
                    </ResponsiveContainer>
                )}
            </div>
        </div>
    );

    // Custom app-themed comparison picker popover rendered via portal so overflow-x-auto / fullscreen never clip it
    const comparePickerPortal = (showComparePicker && comparePickerPos && typeof document !== 'undefined') ? createPortal(
        (() => {
            const matchesFilter = (item: CompareTarget) => {
                return compareFilterTab === 'all' || item.kind === compareFilterTab;
            };
            const filteredBenchmarks = compareBenchmarks.filter(matchesFilter);
            const filteredPortfolio = comparePortfolioItems.filter(matchesFilter);

            const etfCount = compareBenchmarks.filter(i => i.kind === 'etf').length + comparePortfolioItems.filter(i => i.kind === 'etf').length;
            const stockCount = comparePortfolioItems.filter(i => i.kind === 'stock').length;

            return (
                <div
                    ref={comparePopoverRef}
                    style={{ top: comparePickerPos.top, left: comparePickerPos.left }}
                    className="fixed z-[10050] w-[min(340px,calc(100vw-16px))] bg-card border border-border rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
                >
                    <div className="p-2.5 border-b border-border bg-muted/30 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-bold text-foreground">Vergleichs-Titel wählen</span>
                            {compareTarget && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        handleClearCompare();
                                        setShowComparePicker(false);
                                    }}
                                    className="text-xs font-semibold text-rose-500 hover:text-rose-400 cursor-pointer"
                                >
                                    Entfernen
                                </button>
                            )}
                        </div>
                        {/* Vorauswahl-Filter: Alle / Indizes / ETFs / Aktien (ohne Eingabefeld -> kein Passwort-Manager-Popup) */}
                        <div className="h-7 grid grid-cols-4 gap-0.5 p-0.5 rounded-lg bg-background/80 border border-border/80">
                            {([
                                { id: 'all', label: 'Alle' },
                                { id: 'index', label: 'Indizes' },
                                { id: 'etf', label: `ETFs ${etfCount}` },
                                { id: 'stock', label: `Aktien ${stockCount}` },
                            ] as const).map((tab) => (
                                <button
                                    key={tab.id}
                                    type="button"
                                    onClick={() => setCompareFilterTab(tab.id)}
                                    className={cn(
                                        "h-6 inline-flex items-center justify-center px-1 py-0 rounded-md text-xs font-bold leading-none transition-colors cursor-pointer whitespace-nowrap",
                                        compareFilterTab === tab.id
                                            ? "bg-sky-600 text-white shadow-sm"
                                            : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                                    )}
                                >
                                    {tab.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="max-h-[300px] overflow-y-auto p-1.5 space-y-2">
                        {filteredBenchmarks.length > 0 && (
                            <div>
                                <div className="px-2 py-1 text-xs font-semibold text-muted-foreground">
                                    {compareFilterTab === 'etf'
                                        ? 'Empfohlen · Welt-ETFs'
                                        : compareFilterTab === 'index'
                                            ? 'Märkte, Indizes & Futures'
                                            : 'Empfohlen · Märkte & Indizes'}
                                </div>
                                <div className="space-y-0.5">
                                    {filteredBenchmarks.map((item) => {
                                        const isSelected = compareTarget?.symbol.toUpperCase() === item.symbol.toUpperCase();
                                        return (
                                            <button
                                                key={`bench-${item.symbol}`}
                                                type="button"
                                                onClick={() => handleSelectCompareTarget(item)}
                                                className={cn(
                                                    "w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg text-left text-xs transition-colors cursor-pointer",
                                                    isSelected
                                                        ? "bg-sky-500/20 text-sky-600 dark:text-sky-300 font-bold"
                                                        : "hover:bg-muted/70 text-foreground"
                                                )}
                                            >
                                                <div className="min-w-0 flex-1">
                                                    <div className="font-semibold truncate">{item.name}</div>
                                                    <div className="text-xs text-muted-foreground font-mono truncate">{item.symbol}</div>
                                                </div>
                                                <div className="flex items-center gap-1.5 shrink-0">
                                                    {item.badge && (
                                                        <span className="px-1.5 py-0.5 rounded bg-muted text-muted-foreground text-xs font-medium">
                                                            {item.badge}
                                                        </span>
                                                    )}
                                                    {isSelected && <Check className="size-3.5 text-sky-500 shrink-0" />}
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {filteredPortfolio.length > 0 && (
                            <div>
                                <div className={cn(
                                    "px-2 py-1 text-xs font-semibold text-muted-foreground",
                                    filteredBenchmarks.length > 0 && "border-t border-border/60 pt-2"
                                )}>
                                    {compareFilterTab === 'etf'
                                        ? 'Depot & Watchlist · ETFs'
                                        : compareFilterTab === 'stock'
                                            ? 'Depot & Watchlist · Aktien'
                                            : 'Depot & Watchlist'}
                                </div>
                                <div className="space-y-0.5">
                                    {filteredPortfolio.map((item) => {
                                        const isSelected = compareTarget?.symbol.toUpperCase() === item.symbol.toUpperCase();
                                        return (
                                            <button
                                                key={`port-${item.symbol}`}
                                                type="button"
                                                onClick={() => handleSelectCompareTarget(item)}
                                                className={cn(
                                                    "w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg text-left text-xs transition-colors cursor-pointer",
                                                    isSelected
                                                        ? "bg-sky-500/20 text-sky-600 dark:text-sky-300 font-bold"
                                                        : "hover:bg-muted/70 text-foreground"
                                                )}
                                            >
                                                <div className="min-w-0 flex-1">
                                                    <div className="font-semibold truncate">{item.name}</div>
                                                    <div className="text-xs text-muted-foreground font-mono truncate">{item.symbol}</div>
                                                </div>
                                                <div className="flex items-center gap-1.5 shrink-0">
                                                    {item.badge && (
                                                        <span className={cn(
                                                            "px-1.5 py-0.5 rounded text-xs font-medium",
                                                            item.badge === 'Depot'
                                                                ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                                                                : "bg-muted text-muted-foreground"
                                                        )}>
                                                            {item.badge}
                                                        </span>
                                                    )}
                                                    {isSelected && <Check className="size-3.5 text-sky-500 shrink-0" />}
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {filteredBenchmarks.length === 0 && filteredPortfolio.length === 0 && (
                            <div className="px-3 py-4 text-center text-xs text-muted-foreground">
                                Keine passenden Titel gefunden
                            </div>
                        )}
                    </div>
                </div>
            );
        })(),
        document.body
    ) : null;

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
                {comparePickerPortal}
            </>
        );
    }

    return (
        <>
            {chartContent}
            {comparePickerPortal}
        </>
    );
}
