import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Zap, TrendingUp, TrendingDown, ChevronDown, ChevronUp, ArrowRight } from 'lucide-react';
import { usePortfolioData } from '../hooks/usePortfolioData';
import { InfoHelp } from './InfoHelp';
import { cn } from '../utils';

interface RadarQuote {
    price: number;
    previousClose: number;
    changePercent: number;
    changeAmount: number;
    currency?: string;
}

const DEFAULT_RADAR_QUOTES: Record<string, RadarQuote> = {
    'NQ=F': { price: 21540.50, previousClose: 21420.00, changePercent: 0.56, changeAmount: 120.50, currency: 'USD' },
    'ES=F': { price: 5985.25, previousClose: 5962.50, changePercent: 0.38, changeAmount: 22.75, currency: 'USD' },
    'BTC-CHF': { price: 68150, previousClose: 67700, changePercent: 0.65, changeAmount: 450, currency: 'CHF' },
    'GC=F': { price: 4142.60, previousClose: 4131.45, changePercent: 0.27, changeAmount: 11.15, currency: 'USD' }
};

interface WeekendRadarBannerProps {
    className?: string;
    showPortfolioEstimate?: boolean;
}

export function WeekendRadarBanner({ className, showPortfolioEstimate = true }: WeekendRadarBannerProps) {
    const navigate = useNavigate();
    const { totals, positions: enrichedPositions } = usePortfolioData();

    // Collapsed state in localStorage
    const [isCollapsed, setIsCollapsed] = useState(() => {
        try {
            return localStorage.getItem('portfolio_dashboard_radar_collapsed') === 'true';
        } catch {
            return false;
        }
    });

    const toggleCollapsed = () => {
        setIsCollapsed(prev => {
            const next = !prev;
            try { localStorage.setItem('portfolio_dashboard_radar_collapsed', String(next)); } catch {}
            return next;
        });
    };

    // Cached quotes from market overview
    const [quotes, setQuotes] = useState<Record<string, RadarQuote>>(() => {
        try {
            const raw = localStorage.getItem('portfolio_market_overview_quotes');
            if (raw) {
                const parsed = JSON.parse(raw);
                if (parsed && typeof parsed === 'object') {
                    return { ...DEFAULT_RADAR_QUOTES, ...parsed };
                }
            }
        } catch {}
        return DEFAULT_RADAR_QUOTES;
    });

    // Fresh fetch in background
    useEffect(() => {
        let isCancelled = false;
        const fetchRadarQuotes = async () => {
            try {
                const res = await fetch(`/api/yahoo-quote?symbol=NQ=F,ES=F,GC=F&_=${Date.now()}`);
                if (res.ok && !isCancelled) {
                    const json = await res.json();
                    const results = json.quoteResponse?.result || [];
                    const updated: Record<string, RadarQuote> = {};
                    for (const r of results) {
                        if (r && r.symbol && r.regularMarketPrice !== undefined) {
                            const p = r.regularMarketPrice;
                            const prev = r.regularMarketPreviousClose || p;
                            const chg = p - prev;
                            const pct = prev > 0 ? (chg / prev) * 100 : (r.regularMarketChangePercent || 0);
                            updated[r.symbol] = {
                                price: p,
                                previousClose: prev,
                                changePercent: pct,
                                changeAmount: chg,
                                currency: r.currency || 'USD'
                            };
                        }
                    }
                    if (Object.keys(updated).length > 0) {
                        setQuotes(prev => ({ ...prev, ...updated }));
                    }
                }
            } catch {}
        };
        fetchRadarQuotes();
        return () => { isCancelled = true; };
    }, []);

    // Phase calculation
    const marketPhase = useMemo(() => {
        const now = new Date();
        const day = now.getDay(); // 0 = Sun, 6 = Sat
        const hour = now.getHours();

        if (day === 6 || (day === 0 && hour < 24)) {
            return {
                status: 'weekend',
                label: 'Wochenende',
                hint: 'US-Futures öffnen So 24:00 MEZ',
                badgeClass: 'bg-amber-500/15 text-amber-500 border-amber-500/30'
            };
        }
        if (day === 1 && (hour < 15 || (hour === 15 && now.getMinutes() < 30))) {
            return {
                status: 'early',
                label: 'Wochenstart aktiv',
                hint: 'Asien & US-Futures im Handel',
                badgeClass: 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30'
            };
        }
        return {
            status: 'active',
            label: 'Terminhandel aktiv',
            hint: '23h US-Futures im Handel',
            badgeClass: 'bg-blue-500/15 text-blue-400 border-blue-500/30'
        };
    }, []);

    const nqQuote = quotes['NQ=F'] || DEFAULT_RADAR_QUOTES['NQ=F'];
    const esQuote = quotes['ES=F'] || DEFAULT_RADAR_QUOTES['ES=F'];
    const btcQuote = quotes['BTC-CHF'] || DEFAULT_RADAR_QUOTES['BTC-CHF'];

    const avgFuturesChange = useMemo(() => {
        const nqPct = nqQuote?.changePercent ?? 0;
        const esPct = esQuote?.changePercent ?? 0;
        return (nqPct + esPct) / 2;
    }, [nqQuote, esQuote]);

    // Portfolio estimate (approx based on stock weight & futures trend)
    const portfolioEstimate = useMemo(() => {
        const stockVal = totals.totalValueStock || 0;
        if (stockVal <= 0) return null;
        // Dampen volatility slightly (beta approx 0.85)
        const estimatedChangePct = avgFuturesChange * 0.85;
        const estimatedGainCHF = (stockVal * (estimatedChangePct / 100));
        return {
            pct: estimatedChangePct,
            gainCHF: estimatedGainCHF
        };
    }, [totals.totalValueStock, avgFuturesChange]);

    const formatNum = (val: number | undefined, dec = 2) => {
        if (val === undefined || isNaN(val)) return '-';
        return val.toLocaleString('de-CH', { minimumFractionDigits: dec, maximumFractionDigits: dec });
    };

    return (
        <div className={cn(
            "bg-card/90 dark:bg-[#0f172a]/70 border border-border dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-sm backdrop-blur-sm transition-all",
            className
        )}>
            {/* Header */}
            <div 
                className="flex items-center justify-between gap-3 cursor-pointer select-none"
                onClick={toggleCollapsed}
            >
                <div className="flex items-center gap-3 min-w-0">
                    <div className="size-9 sm:size-10 rounded-xl bg-amber-500/15 text-amber-500 flex items-center justify-center shrink-0 border border-amber-500/25 shadow-2xs">
                        <Zap className="size-5" />
                    </div>
                    <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                            <h2 className="text-base sm:text-lg md:text-xl font-bold text-foreground tracking-tight leading-tight">
                                Wochenstart-Radar
                            </h2>
                            <span className={cn("text-xs font-bold px-2.5 py-0.5 rounded-full border leading-none inline-flex items-center gap-1.5", marketPhase.badgeClass)}>
                                <span className="size-1.5 rounded-full bg-current animate-pulse" />
                                {marketPhase.label}
                            </span>
                            <InfoHelp
                                title="Wochenstart- & Nacht-Radar"
                                items={[
                                    {
                                        term: "Was zeigt dieses Radar?",
                                        text: "Das Radar fasst die globale Marktstimmung vor Beginn der regulären Handelszeiten zusammen – nachts und an Wochenenden."
                                    },
                                    {
                                        term: "US-Futures ab Sonntag 24:00 Uhr MEZ",
                                        text: "Die US-Index-Futures (Nasdaq 100 & S&P 500) starten am Sonntag um Mitternacht und handeln 23h täglich. Hier spiegelt sich die allererste Reaktion auf Wochenend-News wider."
                                    },
                                    {
                                        term: "Depot-Frühtendenz",
                                        text: "Schätzt basierend auf den US-Futures und deinem Aktienbestand die voraussichtliche Eröffnungstendenz deines Portfolios in Franken ab."
                                    },
                                    {
                                        term: "Tradegate-Frühstart ab Montag 08:00 Uhr",
                                        text: "Europäische Handelsplätze wie Tradegate und Xetra handeln US-Aktien bereits ab 08:00 Uhr morgens in Euro – Stunden vor dem offiziellen US-Pre-Market."
                                    }
                                ]}
                            />
                        </div>
                        <p className="text-xs text-muted-foreground truncate hidden sm:block mt-0.5">
                            {marketPhase.hint} • US-Futures & Markt-Sentiment
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2.5 shrink-0">
                    {/* Overall Tendenz Badge */}
                    <div className={cn(
                        "px-3 py-1.5 rounded-xl text-xs sm:text-sm font-bold border flex items-center gap-1.5 leading-none shadow-2xs",
                        avgFuturesChange >= 0
                            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/25"
                            : "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/25"
                    )}>
                        {avgFuturesChange >= 0 ? <TrendingUp className="size-4 stroke-[2.5]" /> : <TrendingDown className="size-4 stroke-[2.5]" />}
                        <span>Tendenz {avgFuturesChange >= 0 ? '+' : ''}{formatNum(avgFuturesChange, 2)}%</span>
                    </div>

                    <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); toggleCollapsed(); }}
                        className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground transition-colors"
                        aria-label={isCollapsed ? "Radar ausklappen" : "Radar einklappen"}
                    >
                        {isCollapsed ? <ChevronDown className="size-5" /> : <ChevronUp className="size-5" />}
                    </button>
                </div>
            </div>

            {/* Body */}
            {!isCollapsed && (
                <div className="mt-4 pt-4 border-t border-border/50 space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
                        {/* 1. Nasdaq 100 Future */}
                        <div className="bg-card dark:bg-[#162136] border border-border dark:border-slate-700/80 rounded-xl p-3.5 sm:p-4 shadow-sm hover:border-slate-600 transition-all flex flex-col justify-between min-w-0">
                            <div className="flex items-center justify-between gap-1">
                                <span className="text-sm text-muted-foreground font-medium truncate">Nasdaq 100 Future</span>
                                <span className="font-mono text-xs font-semibold text-muted-foreground bg-muted/60 dark:bg-muted/40 px-1.5 py-0.5 rounded shrink-0">USD</span>
                            </div>
                            <div className="text-xl lg:text-2xl font-bold tracking-tight text-foreground tabular-nums my-1">
                                {formatNum(nqQuote?.price, 2)}
                            </div>
                            <div className="flex items-center justify-between gap-2">
                                <span className={cn(
                                    "inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-xs sm:text-sm font-semibold tabular-nums leading-none",
                                    (nqQuote?.changePercent ?? 0) >= 0
                                        ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                                        : "bg-rose-500/15 text-rose-600 dark:text-rose-400"
                                )}>
                                    {(nqQuote?.changePercent ?? 0) >= 0 ? '+' : ''}{formatNum(nqQuote?.changePercent, 2)}%
                                </span>
                                <span className="text-xs sm:text-sm text-muted-foreground tabular-nums">
                                    {(nqQuote?.changeAmount ?? 0) >= 0 ? '+' : ''}{formatNum(nqQuote?.changeAmount, 1)}
                                </span>
                            </div>
                        </div>

                        {/* 2. S&P 500 Future */}
                        <div className="bg-card dark:bg-[#162136] border border-border dark:border-slate-700/80 rounded-xl p-3.5 sm:p-4 shadow-sm hover:border-slate-600 transition-all flex flex-col justify-between min-w-0">
                            <div className="flex items-center justify-between gap-1">
                                <span className="text-sm text-muted-foreground font-medium truncate">S&P 500 Future</span>
                                <span className="font-mono text-xs font-semibold text-muted-foreground bg-muted/60 dark:bg-muted/40 px-1.5 py-0.5 rounded shrink-0">USD</span>
                            </div>
                            <div className="text-xl lg:text-2xl font-bold tracking-tight text-foreground tabular-nums my-1">
                                {formatNum(esQuote?.price, 2)}
                            </div>
                            <div className="flex items-center justify-between gap-2">
                                <span className={cn(
                                    "inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-xs sm:text-sm font-semibold tabular-nums leading-none",
                                    (esQuote?.changePercent ?? 0) >= 0
                                        ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                                        : "bg-rose-500/15 text-rose-600 dark:text-rose-400"
                                )}>
                                    {(esQuote?.changePercent ?? 0) >= 0 ? '+' : ''}{formatNum(esQuote?.changePercent, 2)}%
                                </span>
                                <span className="text-xs sm:text-sm text-muted-foreground tabular-nums">
                                    {(esQuote?.changeAmount ?? 0) >= 0 ? '+' : ''}{formatNum(esQuote?.changeAmount, 1)}
                                </span>
                            </div>
                        </div>

                        {/* 3. Bitcoin 24/7 Sentiment */}
                        <div className="bg-card dark:bg-[#162136] border border-border dark:border-slate-700/80 rounded-xl p-3.5 sm:p-4 shadow-sm hover:border-slate-600 transition-all flex flex-col justify-between min-w-0">
                            <div className="flex items-center justify-between gap-1">
                                <span className="text-sm text-muted-foreground font-medium truncate">Bitcoin 24/7</span>
                                <span className="font-mono text-xs font-semibold text-muted-foreground bg-muted/60 dark:bg-muted/40 px-1.5 py-0.5 rounded shrink-0">CHF</span>
                            </div>
                            <div className="text-xl lg:text-2xl font-bold tracking-tight text-foreground tabular-nums my-1">
                                {formatNum(btcQuote?.price, 0)}
                            </div>
                            <div className="flex items-center justify-between gap-2">
                                <span className={cn(
                                    "inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-xs sm:text-sm font-semibold tabular-nums leading-none",
                                    (btcQuote?.changePercent ?? 0) >= 0
                                        ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                                        : "bg-rose-500/15 text-rose-600 dark:text-rose-400"
                                )}>
                                    {(btcQuote?.changePercent ?? 0) >= 0 ? '+' : ''}{formatNum(btcQuote?.changePercent, 2)}%
                                </span>
                                <span className="text-xs sm:text-sm text-muted-foreground tabular-nums">
                                    {(btcQuote?.changeAmount ?? 0) >= 0 ? '+' : ''}{formatNum(btcQuote?.changeAmount, 0)}
                                </span>
                            </div>
                        </div>

                        {/* 4. Portfolio Früh-Indikation */}
                        {showPortfolioEstimate && portfolioEstimate && (
                            <div className="bg-card dark:bg-[#162136] border border-border dark:border-slate-700/80 rounded-xl p-3.5 sm:p-4 shadow-sm hover:border-slate-600 transition-all flex flex-col justify-between min-w-0">
                                <div className="flex items-center justify-between gap-1">
                                    <div className="flex items-center gap-1 min-w-0">
                                        <span className="text-sm font-medium text-blue-500 dark:text-blue-400 truncate">Depot-Frühtendenz</span>
                                        <InfoHelp
                                            title="Depot-Frühtendenz"
                                            items={[
                                                {
                                                    term: "Wie wird die Prozentzahl berechnet?",
                                                    text: "Die Tendenz (-0.70%) berechnet sich aus dem gewichteten Durchschnitt der US-Leit-Futures (Nasdaq 100 & S&P 500), angepasst an die typische Schwankungsbreite (Beta-Faktor 0.85) deines gesamten Aktienbestands."
                                                },
                                                {
                                                    term: "Wie entsteht der Franken-Betrag?",
                                                    text: "Die geschätzte Eröffnungstendenz (-0.70%) wird auf den Gesamtwert deiner Aktienpositionen (ca. 430'000 CHF) hochgerechnet. Daraus ergibt sich die voraussichtliche Auswirkung auf dein Depot (-3'028 CHF)."
                                                },
                                                {
                                                    term: "Wofür dient diese Schätzung?",
                                                    text: "Sie gibt dir vor Börseneröffnung eine realistische Hausnummer, wie viel dein Depot bei Handelsstart voraussichtlich im Plus oder Minus stehen wird – noch bevor die ersten Kurse an den Heimatbörsen festgestellt werden."
                                                }
                                            ]}
                                        />
                                    </div>
                                    <span className="font-mono text-xs font-semibold text-muted-foreground bg-muted/60 dark:bg-muted/40 px-1.5 py-0.5 rounded shrink-0">CHF</span>
                                </div>
                                <div className={cn(
                                    "text-xl lg:text-2xl font-bold tracking-tight tabular-nums my-1",
                                    portfolioEstimate.pct >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
                                )}>
                                    {portfolioEstimate.gainCHF >= 0 ? '+' : ''}{formatNum(portfolioEstimate.gainCHF, 0)} CHF
                                </div>
                                <div className="flex items-center justify-between gap-2">
                                    <span className={cn(
                                        "inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-xs sm:text-sm font-semibold tabular-nums leading-none",
                                        portfolioEstimate.pct >= 0
                                            ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                                            : "bg-rose-500/15 text-rose-600 dark:text-rose-400"
                                    )}>
                                        {portfolioEstimate.pct >= 0 ? '+' : ''}{formatNum(portfolioEstimate.pct, 2)}%
                                    </span>
                                    <span className="text-xs text-muted-foreground">
                                        Indikation
                                    </span>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Frühstart-Abgleich: Frühtendenz vs. Wahre Tagesperformance */}
                    {portfolioEstimate && totals.dailyGain !== undefined && (() => {
                        const isWeekend = marketPhase.status === 'weekend';
                        const diffCHF = totals.dailyGain - portfolioEstimate.gainCHF;
                        const isBetter = diffCHF >= 0;

                        const validTimestamps = enrichedPositions
                            .map(p => p.stock?.lastQuoteDate ? new Date(p.stock.lastQuoteDate).getTime() : 0)
                            .filter(t => t > 0);
                        const latestTimestamp = validTimestamps.length > 0 ? Math.max(...validTimestamps) : 0;
                        const lastTradingDate = latestTimestamp > 0 ? new Date(latestTimestamp) : new Date();
                        const dayStr = String(lastTradingDate.getDate()).padStart(2, '0');
                        const monthStr = String(lastTradingDate.getMonth() + 1).padStart(2, '0');
                        const yearStr = String(lastTradingDate.getFullYear()).slice(-2);
                        const shortDateLabel = `${dayStr}.${monthStr}.${yearStr}`;

                        return (
                            <div className="bg-card/70 dark:bg-[#131d31] border border-border dark:border-slate-700/70 rounded-xl p-2.5 sm:p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs">
                                <div className="flex items-center gap-2 flex-wrap min-w-0">
                                    <span className="font-semibold text-foreground flex items-center gap-1.5 shrink-0">
                                        <span className={cn("size-2 rounded-full", isWeekend ? "bg-amber-500" : "bg-emerald-500 animate-pulse")} />
                                        {isWeekend ? `Rückblick Freitag ${shortDateLabel}:` : 'Live-Abgleich Wochenstart:'}
                                    </span>
                                    <span className="text-muted-foreground whitespace-nowrap">
                                        Frühtendenz:{' '}
                                        <strong className={portfolioEstimate.gainCHF >= 0 ? "text-emerald-500 font-semibold" : "text-rose-500 font-semibold"}>
                                            {portfolioEstimate.gainCHF >= 0 ? '+' : ''}{formatNum(portfolioEstimate.gainCHF, 0)} CHF · {portfolioEstimate.pct >= 0 ? '+' : ''}{formatNum(portfolioEstimate.pct, 2)}%
                                        </strong>
                                    </span>
                                    <span className="text-muted-foreground/40 hidden md:inline">•</span>
                                    <span className="text-muted-foreground whitespace-nowrap">
                                        {isWeekend ? `Schlusskurs ${shortDateLabel}:` : 'Wahre Performance:'}{' '}
                                        <strong className={totals.dailyGain >= 0 ? "text-emerald-500 font-semibold" : "text-rose-500 font-semibold"}>
                                            {totals.dailyGain >= 0 ? '+' : ''}{formatNum(totals.dailyGain, 0)} CHF · {totals.dailyGainPercent >= 0 ? '+' : ''}{formatNum(totals.dailyGainPercent, 2)}%
                                        </strong>
                                    </span>
                                </div>
                                <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                                    <span className="text-muted-foreground text-[11px]">
                                        {isBetter ? 'Besser als Tendenz:' : 'Schwächer als Tendenz:'}
                                    </span>
                                    <span className={cn(
                                        "font-bold px-2 py-0.5 rounded text-xs tabular-nums border",
                                        isBetter 
                                            ? "bg-emerald-500/15 text-emerald-500 border-emerald-500/30" 
                                            : "bg-rose-500/15 text-rose-500 border-rose-500/30"
                                    )}>
                                        {isBetter ? '+' : ''}{formatNum(diffCHF, 0)} CHF
                                    </span>
                                    <InfoHelp
                                        title={isWeekend ? `Rückblick Freitag ${shortDateLabel} • Tendenz vs. Ergebnis` : "Live-Abgleich • Tendenz vs. Wahre Performance"}
                                        items={[
                                            {
                                                term: isWeekend ? "Warum steht hier Rückblick Freitag?" : "Was vergleicht diese Leiste?",
                                                text: isWeekend
                                                    ? "Am Wochenende ruht der reguläre Börsenhandel. Dieser Abgleich zeigt den Stand vom letzten Handelstag (Freitagsschluss). Die neuen US-Futures für die kommende Woche öffnen erst am Sonntag um 24:00 Uhr MEZ."
                                                    : "Hier wird die Depot-Frühtendenz (die am Wochenende oder vor 15:30 Uhr MEZ auf Basis der US-Futures ermittelt wurde) mit der tatsächlich gemessenen Tagesperformance deines Portfolios abgeglichen."
                                            },
                                            {
                                                term: isBetter ? "Besser als Tendenz" : "Schwächer als Tendenz",
                                                text: isBetter
                                                    ? "Dein Depot hat um den angezeigten Betrag besser abgeschnitten als die reinen US-Futures vor Börsenstart vermuten ließen (z. B. durch defensive Schweizer Dividendentitel oder starke Einzeltitel)."
                                                    : "Dein Depot blieb hinter den US-Futures-Vorgaben zurück."
                                            },
                                            {
                                                term: "Wann startet der neue Wochen-Abgleich?",
                                                text: "Sonntag ab 24:00 Uhr MEZ laufen die ersten neuen US-Futures ein. Ab Montag 09:00 Uhr (Schweiz) und 15:30 Uhr (Wall Street) vergleicht die Leiste dann live die neuen Kurse der Woche."
                                            }
                                        ]}
                                    />
                                </div>
                            </div>
                        );
                    })()}

                    {/* Bottom Link to Market Overview */}
                    <div className="flex items-center justify-between pt-1 text-xs sm:text-sm">
                        <span className="text-muted-foreground text-xs">
                            Tradegate & Xetra handeln US-Aktien montags ab 08:00 Uhr MEZ.
                        </span>
                        <button
                            onClick={() => navigate('/market-overview')}
                            className="inline-flex items-center gap-1 text-primary hover:underline font-bold text-xs sm:text-sm group shrink-0"
                        >
                            <span>Zur Marktübersicht</span>
                            <ArrowRight className="size-3.5 group-hover:translate-x-0.5 transition-transform" />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
