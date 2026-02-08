import { useState, useEffect, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Search, TriangleAlert, Telescope, X, BookOpen, ExternalLink, Calculator, Check, ChevronDown, ChevronUp } from 'lucide-react';
import { useCurrencyFormatter } from '../utils/currency';
import { cn } from '../utils';
import { usePortfolio } from '../context/PortfolioContext';

import { fetchStockQuote, fetchStockAnalysis, searchStocks } from '../services/yahoo-finance';

// Helper Component for Stock Management List Items (Rich UI mimicking Kauf/Verkauf)
const StockListItem = ({ stock, onClick, subtitle }: { stock: any; onClick: () => void; subtitle?: string }) => (
    <button
        type="button"
        onClick={onClick}
        className="w-full p-3 hover:bg-muted transition-colors text-left flex items-center gap-3 border-b border-border/50 last:border-0"
    >
        {stock.logoUrl ? (
            <div className="size-10 rounded-lg p-1 bg-white border border-border flex items-center justify-center overflow-hidden">
                <img
                    src={stock.logoUrl}
                    alt={stock.name}
                    className="w-full h-full object-contain"
                />
            </div>
        ) : (
            <div className="size-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold border border-primary/20">
                {stock.symbol.slice(0, 2)}
            </div>
        )}
        <div className="flex-1 min-w-0">
            <div className="font-semibold flex items-center gap-2 truncate">
                <span className="truncate">{stock.name}</span>
                {stock.type === 'etf' && <span className="shrink-0 text-xs bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 px-1.5 py-0.5 rounded font-bold">ETF</span>}
            </div>
            <div className="text-xs text-muted-foreground flex items-center gap-2">
                <span className="font-mono">{stock.symbol}</span>
                {subtitle && (
                    <>
                        <span className="text-muted-foreground/30">•</span>
                        <span className="font-medium text-primary/70">{subtitle}</span>
                    </>
                )}
            </div>
        </div>
        <div className="text-right shrink-0">
            <div className="font-medium text-sm">
                {stock.currentPrice?.toLocaleString('de-CH', {
                    style: 'currency',
                    currency: stock.currency === 'GBp' ? 'GBP' : (stock.currency || 'USD')
                }) || '-'}
            </div>
        </div>
    </button>
);

export function FairValueCalculator() {
    const { positions, stocks, watchlists, updateStock } = usePortfolio();

    // Search State
    const [searchTerm, setSearchTerm] = useState('');
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [isSearching, setIsSearching] = useState(false);

    // Helper to clean names for more accurate external searches (e.g. "Nestle SA" -> "Nestle", "NESN.SW" -> "Nestle")
    // Helper to clean names for more accurate external searches (e.g. "Nestle SA" -> "Nestle", "Shell Plc Reg Shs" -> "Shell")
    const getCleanSearchName = (name: string) => {
        if (!name) return '';

        // 0. Remove newlines and tabs immediately
        let cleaned = name.replace(/[\n\r\t]/g, ' ').replace(/\s+/g, ' ').trim();

        // 1. Only split at dot if it looks like a technical ticker (no spaces, short)
        if (!cleaned.includes(' ') && cleaned.includes('.') && cleaned.length < 10) {
            cleaned = cleaned.split('.')[0];
        }

        // 2. Remove common corporate/technical suffixes (case insensitive)
        const suffixes = [
            'SA', 'AG', 'INC', 'CORP', 'LTD', 'PLC', 'NV', 'SE', 'SPA', 'PTY',
            'LIMITED', 'CORPORATION', 'HOLDINGS', 'HOLDING', 'GROUP', 'GMBH', 'KGAA',
            'SOLUTIONS', 'SYSTEMS', 'INDUSTRIES', 'S\\.A\\.', 'A\\.G\\.', 'N\\.V\\.', 'S\\.E\\.', 'S\\.P\\.A\\.',
            'REG', 'SHS', 'SPON', 'ADR', 'GDR', 'ORD', 'ORDINARY', 'REGISTERED', 'REGS', 'REGD'
        ];

        const suffixPattern = suffixes.join('|');
        const suffixRegex = new RegExp(`\\s+(${suffixPattern})\\.?(?=\\s|$)`, 'gi');

        // Apply multiple times to handle stacked suffixes like "Plc Reg Shs"
        cleaned = cleaned.replace(suffixRegex, ' ').trim();
        cleaned = cleaned.replace(suffixRegex, ' ').trim();
        cleaned = cleaned.replace(suffixRegex, ' ').trim();

        // 3. Remove parentheses content (e.g. "Nestle (NESN)" or "Nestle(NESN)" -> "Nestle")
        cleaned = cleaned.replace(/\s?\(.*\)/g, '');

        return cleaned.trim();
    };
    const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);
    const [showStockList, setShowStockList] = useState(false);
    const searchRef = useRef<HTMLDivElement>(null);

    // Data State
    const [loadingData, setLoadingData] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [quote, setQuote] = useState<any>(null);
    const [analysis, setAnalysis] = useState<any>(null);

    // Calculator Inputs
    const [eps, setEps] = useState<number | string>(0);
    const [growthRate, setGrowthRate] = useState<number | string>(10); // %
    const [pe, setPe] = useState<number | string>(15);
    const [dividendYield, setDividendYield] = useState<number | string>(0);
    const [discountRate, setDiscountRate] = useState<number | string>(11); // % (MARR)
    const [mos, setMos] = useState<number | string>(20); // % Margin of Safety

    // Persistence Ref to avoid cycles
    const isRestoring = useRef(false);
    const [showGuide, setShowGuide] = useState(false);

    // Wachstums-Helfer State
    const [showGrowthHelper, setShowGrowthHelper] = useState(false);
    const [startEps, setStartEps] = useState<number | string>(0);
    const [endEps, setEndEps] = useState<number | string>(0);
    const [periodYears, setPeriodYears] = useState<number | string>(3);

    // Helper for currency
    const { formatCurrency } = useCurrencyFormatter();

    // CAGR Calculation Helper
    const calculatedCagr = useMemo(() => {
        const sEps = typeof startEps === 'string' ? parseFloat(startEps) : startEps;
        const eEps = typeof endEps === 'string' ? parseFloat(endEps) : endEps;
        const pYears = typeof periodYears === 'string' ? parseFloat(periodYears) : periodYears;

        if (!sEps || !eEps || !pYears || sEps <= 0 || eEps <= 0 || pYears <= 0) return 0;
        try {
            const cagr = (Math.pow(eEps / sEps, 1 / pYears) - 1) * 100;
            return isFinite(cagr) ? parseFloat(cagr.toFixed(2)) : 0;
        } catch (e) {
            return 0;
        }
    }, [startEps, endEps, periodYears]);

    // Click-Outside Handler
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
                setShowStockList(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // 1. PERSISTENCE: Load logic on Mount
    useEffect(() => {
        try {
            const savedState = localStorage.getItem('fair_value_state');
            if (savedState) {
                const state = JSON.parse(savedState);
                if (state.symbol) {
                    console.log("Restoring Fair Value Session:", state.symbol);
                    isRestoring.current = true;
                    // Restore Inputs State with rounding to prevent float issues (v3.13.43)
                    setEps(state.eps ? parseFloat(Number(state.eps).toFixed(2)) : 0);
                    setGrowthRate(state.growthRate || 10);
                    setPe(state.pe ? parseFloat(Number(state.pe).toFixed(2)) : 15);
                    setDividendYield(state.dividendYield ? parseFloat(Number(state.dividendYield).toFixed(2)) : 0);
                    setDiscountRate(state.discountRate || 11);
                    setMos(state.mos || 20);

                    loadStockData(state.symbol, state.name || state.symbol, true, state.isin);
                }
            }
        } catch (e) {
            console.error("Failed to restore session", e);
        }
    }, []);

    // 2. PERSISTENCE: Save logic on Change
    useEffect(() => {
        if (!isRestoring.current && selectedSymbol) {
            const state = {
                symbol: selectedSymbol,
                name: quote?.name,
                isin: quote?.isin,
                eps,
                growthRate,
                pe,
                dividendYield,
                discountRate,
                mos
            };
            localStorage.setItem('fair_value_state', JSON.stringify(state));
        }
    }, [selectedSymbol, eps, growthRate, pe, dividendYield, discountRate, mos, quote]);

    // Categorized Suggestions (Holdings & Watchlist)
    const localMatches = useMemo(() => {
        if (!searchTerm) {
            const ownedIds = new Set(positions.map(p => p.stockId));
            const watchlistIds = new Set(watchlists.flatMap(w => w.stockIds));
            const owned = stocks.filter(s => ownedIds.has(s.id));
            const watch = stocks.filter(s => watchlistIds.has(s.id) && !ownedIds.has(s.id));
            return { owned, watch, filtered: [] };
        }

        const term = searchTerm.toLowerCase().trim();
        const isIsinPattern = /^[A-Z]{2}[A-Z0-9]{9}\d$/.test(term.toUpperCase());

        const filtered = stocks.filter(s => {
            const sym = s.symbol.toLowerCase();
            const name = s.name.toLowerCase();
            const isin = (s.isin || '').toLowerCase();
            return sym.includes(term) || name.includes(term) || isin === term || (isIsinPattern && isin.includes(term));
        }).sort((a, b) => {
            // Prioritize Exact ISIN match
            if (a.isin?.toLowerCase() === term) return -1;
            if (b.isin?.toLowerCase() === term) return 1;
            // Prioritize Exact Symbol match
            if (a.symbol.toLowerCase() === term) return -1;
            if (b.symbol.toLowerCase() === term) return 1;
            return 0;
        });

        return { owned: [], watch: [], filtered };
    }, [stocks, positions, watchlists, searchTerm]);

    // 3. SEARCH: Integrated Logic
    useEffect(() => {
        const search = async () => {
            if (searchTerm.length < 1) {
                setSearchResults([]);
                return;
            }
            setIsSearching(true);
            const res = await searchStocks(searchTerm);
            setSearchResults(res || []);
            setIsSearching(false);
        };

        const timeout = setTimeout(search, 400);
        return () => clearTimeout(timeout);
    }, [searchTerm]);



    // Load Data Logic
    const loadStockData = async (symbol: string, initialName?: string, preventReset: boolean = false, initialIsin?: string) => {
        let isinToUse = initialIsin;
        setLoadingData(true);
        setError(null);
        setSearchResults([]);
        setSearchTerm('');
        setSelectedSymbol(symbol);
        setShowStockList(false);

        const existingStock = stocks.find(s => s.symbol.toLowerCase() === symbol.toLowerCase());

        // PRIORITY ISIN: If we have it locally, use it as the primary source
        if (existingStock?.isin && !isinToUse) {
            isinToUse = existingStock.isin;
        }

        if (!preventReset) {
            // Check if we already have this stock in Portfolio/Watchlist to pre-fill known data
            setEps(existingStock?.eps ? parseFloat(existingStock.eps.toFixed(2)) : 0);
            setGrowthRate(10);
            const initialPe = existingStock?.trailingPE || existingStock?.forwardPE || 15;
            setPe(parseFloat(initialPe.toFixed(2)));
            setDividendYield(existingStock?.dividendYield ? parseFloat(existingStock.dividendYield.toFixed(2)) : 0);
        }

        try {
            const [q, a] = await Promise.all([
                fetchStockQuote(symbol, initialName),
                fetchStockAnalysis(symbol)
            ]);

            let finalQuote = q;
            const hasFallbackData = a && (a as any).price > 0;

            // P/E Robustness: Ensure trailingPE is calculated if missing (using Quote or Analysis data)
            const finalEps = q.eps || (a as any).eps;
            const finalPrice = q.price || (a as any).price;
            if (!q.trailingPE && finalPrice && finalEps) {
                q.trailingPE = finalPrice / finalEps;
            }

            if ((q.error || !q.price) && hasFallbackData) {
                const fallbackA = a as any;
                finalQuote = {
                    price: fallbackA.price,
                    currency: fallbackA.currency || 'USD',
                    marketTime: new Date(),
                    trailingPE: fallbackA.eps ? parseFloat((fallbackA.price / fallbackA.eps).toFixed(2)) : null,
                    forwardPE: fallbackA.forwardPE ? parseFloat(fallbackA.forwardPE.toFixed(2)) : null,
                    eps: fallbackA.eps ? parseFloat(fallbackA.eps.toFixed(2)) : null,
                    dividendYield: (fallbackA as any).dividendYield ? parseFloat((fallbackA as any).dividendYield.toFixed(2)) : null,
                    country: (fallbackA as any).country || null,
                    name: initialName || symbol,
                    error: undefined
                };
            }

            if (finalQuote.error || !finalQuote.price) {
                setError('Keine autom. Daten gefunden. Bitte Werte manuell eingeben.');
                finalQuote = {
                    price: 0,
                    currency: 'USD',
                    marketTime: new Date(),
                    trailingPE: 0,
                    forwardPE: 0,
                    eps: 0,
                    dividendYield: 0,
                    country: null,
                    name: initialName || symbol,
                    isin: isinToUse || null,
                    error: finalQuote.error
                };
            }

            // Sync ISIN if provided as hint
            if (isinToUse && !finalQuote.isin) {
                finalQuote.isin = isinToUse;
            }

            // ROBUSTNESS: If ISIN or Proper Name is still missing (e.g. on direct navigation, reload, or ticker-only name)
            // try to fetch it via Search API as a secondary source.
            const nameLooksLikeTicker = !finalQuote.name || finalQuote.name === symbol || finalQuote.name.toUpperCase() === symbol.toUpperCase() || finalQuote.name.includes('.') || finalQuote.name.length < 5;

            if (!finalQuote.isin || nameLooksLikeTicker) {
                try {
                    console.log("[FairValue] Triggering Metadata Lookup (ISIN/Name)...");
                    const searchResults = await searchStocks(symbol);
                    const exactMatch = searchResults.find(r => r.symbol.toLowerCase() === symbol.toLowerCase());
                    if (exactMatch) {
                        if (exactMatch.isin && !finalQuote.isin) {
                            finalQuote.isin = exactMatch.isin;
                        }
                        // If current name is just a ticker or dirty, use the search name
                        if (nameLooksLikeTicker && exactMatch.name && exactMatch.name !== symbol) {
                            finalQuote.name = exactMatch.name;
                        }
                    }
                } catch (e) {
                    console.warn("[FairValue] Metadata Lookup Failed:", e);
                }
            }

            // Final Name Fallback if search failed
            if (!finalQuote.name || finalQuote.name === symbol || finalQuote.name.toUpperCase() === symbol.toUpperCase()) {
                finalQuote.name = initialName || symbol;
            }

            setQuote(finalQuote);
            setAnalysis(a || { growthRate: null });

            if (!preventReset && (finalQuote.price || 0) > 0) {
                if (finalQuote.eps) setEps(parseFloat(finalQuote.eps.toFixed(2)));
                if (a && a.growthRate) {
                    setGrowthRate(parseFloat((a.growthRate * 100).toFixed(2)));
                } else {
                    setGrowthRate(10);
                }
                const initialPe = finalQuote.trailingPE || finalQuote.forwardPE || 15;
                setPe(parseFloat(initialPe.toFixed(2)));

                if (finalQuote.dividendYield || finalQuote.dividendYield === 0) {
                    setDividendYield(parseFloat(finalQuote.dividendYield.toFixed(2)));
                } else {
                    // Fallback to existing stock data if API returns null but we have it in Portfolio
                    const existingStock = stocks.find(s => s.symbol.toLowerCase() === symbol.toLowerCase());
                    if (existingStock?.dividendYield) {
                        setDividendYield(parseFloat(existingStock.dividendYield.toFixed(2)));
                    }
                }
            }

            if (preventReset) {
                isRestoring.current = false;
            }

        } catch (e) {
            console.error(e);
        } finally {
            setLoadingData(false);
        }
    };

    const handleLocalSelect = (stock: any) => {
        loadStockData(stock.symbol, stock.name, false, stock.isin);
    };

    // Calculation Logic
    const calculation = useMemo(() => {
        const valEps = typeof eps === 'string' ? parseFloat(eps) || 0 : eps;
        const valGrowth = typeof growthRate === 'string' ? parseFloat(growthRate) || 0 : growthRate;
        const valPe = typeof pe === 'string' ? parseFloat(pe) || 0 : pe;
        const valDiv = typeof dividendYield === 'string' ? parseFloat(dividendYield) || 0 : dividendYield;
        const valDisc = typeof discountRate === 'string' ? parseFloat(discountRate) || 0 : discountRate;
        const valMos = typeof mos === 'string' ? parseFloat(mos) || 0 : mos;

        const futureEps = valEps * Math.pow(1 + valGrowth / 100, 5);
        const ruleOneLimit = Math.max(20, valGrowth * 2); // Floor of 20 - better for quality stocks like Nestle
        const exitPe = valPe; // Remove hard cap, use user input directly
        const futurePrice = futureEps * exitPe;

        // NEW: DCF including Dividends (v3.13.43)
        // Ignoring dividends leads to under-valuation of quality stocks
        let totalDiscountedDividends = 0;
        const currentPrice = quote?.price || 0;

        if (valDiv > 0 && currentPrice > 0) {
            const initialAnnualDiv = (valDiv / 100) * currentPrice;
            for (let i = 1; i <= 5; i++) {
                // Assume dividends grow with the estimated EPS growth rate
                const divInYear = initialAnnualDiv * Math.pow(1 + valGrowth / 100, i);
                totalDiscountedDividends += divInYear / Math.pow(1 + valDisc / 100, i);
            }
        }

        const discountedFuturePrice = futurePrice / Math.pow(1 + valDisc / 100, 5);
        const fairValue = discountedFuturePrice + totalDiscountedDividends;
        const buyPrice = fairValue * (1 - valMos / 100);

        return {
            futureEps,
            ruleOneLimit,
            exitPe,
            futurePrice,
            fairValue,
            buyPrice,
            totalDiscountedDividends,
            isCorrectionNeeded: valPe > ruleOneLimit
        };
    }, [eps, growthRate, pe, discountRate, mos, dividendYield, quote?.price]);

    // 4. AUTO-SYNC: Save Fair Value to Stock (v3.13.53)
    // When calculation changes, update the stock's fairValue field (but NOT targetPrice!)
    // MOVED here to access 'calculation' (v3.13.53 Fix)
    useEffect(() => {
        if (!selectedSymbol || !calculation || !quote) return;

        // Find stock in portfolio/watchlist
        const existingStock = stocks.find(s => s.symbol === selectedSymbol);
        if (existingStock) {
            // Only update if value changed significantly to avoid loops
            if (!existingStock.fairValue || Math.abs(existingStock.fairValue - calculation.fairValue) > 0.01) {
                // Debounce slightly to avoid rapid updates during typing
                const timer = setTimeout(() => {
                    updateStock(existingStock.id, { fairValue: calculation.fairValue });
                }, 1000);
                return () => clearTimeout(timer);
            }
        }
    }, [selectedSymbol, calculation, stocks, updateStock]);

    // Comparison Logic
    const currentPrice = quote?.price || 0;
    const isUndervalued = currentPrice < calculation.buyPrice;
    const isFair = !isUndervalued && currentPrice <= calculation.fairValue;
    const isYieldGap = ((typeof growthRate === 'string' ? parseFloat(growthRate) || 0 : growthRate) + (typeof dividendYield === 'string' ? parseFloat(dividendYield) || 0 : dividendYield)) < (typeof discountRate === 'string' ? parseFloat(discountRate) || 0 : discountRate);

    return (
        <div className="max-w-6xl mx-auto pl-14 pr-4 py-4 md:p-8 space-y-8 pb-32">
            {/* Guide Modal */}
            {showGuide && (
                <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-card border border-border rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto overflow-x-hidden flex flex-col animate-in zoom-in-95 duration-200">
                        <div className="p-6 border-b border-border flex items-center justify-between sticky top-0 bg-card z-10">
                            <div className="flex items-center gap-3">
                                <div className="size-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                                    <BookOpen className="size-6" />
                                </div>
                                <h2 className="text-xl font-bold">Anleitung: Das Finanzteleskop</h2>
                            </div>
                            <button onClick={() => setShowGuide(false)} className="p-2 hover:bg-muted rounded-full transition-colors">
                                <X className="size-5" />
                            </button>
                        </div>

                        <div className="p-6 space-y-6">
                            <section className="space-y-3">
                                <p className="text-sm leading-relaxed text-muted-foreground">
                                    Dieses Tool berechnet den <strong>inneren Wert</strong> einer Aktie basierend auf der Methode von Phil Town (Rule #1) und einer Dividenden-Barwert-Rechnung. Hier erfährst du, was die Eingaben bedeuten:
                                </p>
                            </section>

                            <div className="grid gap-6">
                                <div className="p-4 rounded-xl bg-muted/30 border border-border/50">
                                    <h3 className="font-bold flex items-center gap-2 mb-2">
                                        <div className="size-2 rounded-full bg-blue-500" />
                                        Gewinn pro Aktie (EPS)
                                    </h3>
                                    <p className="text-xs text-muted-foreground leading-relaxed">
                                        Dies ist der Reingewinn, den die Firma pro Aktie in den letzten 12 Monaten (TTM) erzielt hat. Er ist das Fundament für die gesamte Rechnung.
                                    </p>
                                </div>

                                <div className="p-4 rounded-xl bg-muted/30 border border-border/50">
                                    <h3 className="font-bold flex items-center gap-2 mb-2">
                                        <div className="size-2 rounded-full bg-blue-500" />
                                        Wachstum pro Jahr
                                    </h3>
                                    <p className="text-xs text-muted-foreground leading-relaxed">
                                        Deine Schätzung, wie stark der Gewinn (EPS) in den nächsten 5 Jahren <strong>jährlich</strong> wachsen wird. <br />
                                        <span className="text-primary italic">Tipp: Bluechips wie Nestlé wachsen oft mit 4-7%, starke Wachstumsfirmen mit 15%+. Sei konservativ!</span>
                                    </p>
                                </div>

                                <div className="p-4 rounded-xl bg-muted/30 border border-border/50">
                                    <h3 className="font-bold flex items-center gap-2 mb-2">
                                        <div className="size-2 rounded-full bg-blue-500" />
                                        Dividendenrendite
                                    </h3>
                                    <p className="text-xs text-muted-foreground leading-relaxed">
                                        Gibt an, wie viel Prozent des aktuellen Kurses als Dividende ausgeschüttet werden. Wir rechnen diese Erträge für die nächsten 5 Jahre in den fairen Wert mit ein.
                                    </p>
                                </div>

                                <div className="p-4 rounded-xl bg-muted/30 border border-border/50">
                                    <h3 className="font-bold flex items-center gap-2 mb-2">
                                        <div className="size-2 rounded-full bg-blue-500" />
                                        Verkaufs-KGV (in 5 Jahren)
                                    </h3>
                                    <p className="text-xs text-muted-foreground leading-relaxed">
                                        Das Kurs-Gewinn-Verhältnis, zu dem du die Aktie in 5 Jahren theoretisch verkaufen würdest. <br />
                                        <span className="text-primary italic">Tipp: Nutze das historische Durchschnitts-KGV der Aktie als Anhaltspunkt.</span>
                                    </p>
                                </div>

                                <div className="p-4 rounded-xl bg-muted/30 border border-border/50">
                                    <h3 className="font-bold flex items-center gap-2 mb-2">
                                        <div className="size-2 rounded-full bg-blue-500" />
                                        Zielrendite pro Jahr
                                    </h3>
                                    <p className="text-xs text-muted-foreground leading-relaxed">
                                        Deine gewünschte Gesamtrendite (Kursgewinn + Dividende), die du mit diesem Investment erreichen willst. <br />
                                        <span className="text-primary italic">Tipp: 8-10% ist ein typischer Marktdurchschnitt.</span>
                                    </p>
                                </div>

                                <div className="p-4 rounded-xl bg-primary/5 border border-primary/20">
                                    <h3 className="font-bold flex items-center gap-2 mb-2 text-primary">
                                        <Calculator className="size-4" />
                                        Tipp: Wachstums-Rechner benutzen
                                    </h3>
                                    <p className="text-xs leading-relaxed">
                                        Fällt dir die Schätzung in % schwer? <br />
                                        Nutze den <strong>Wachstums-Rechner</strong> direkt unter dem Eingabefeld. Gib einfach zwei Gewinn-Werte (z.B. 2026 und 2029) aus der Analysten-Tabelle ein. Das Tool rechnet dir die jährliche Rate (CAGR) automatisch aus.
                                    </p>
                                </div>

                                <div className="p-4 rounded-xl bg-muted/30 border border-border/50">
                                    <h3 className="font-bold flex items-center gap-2 mb-2">
                                        <div className="size-2 rounded-full bg-blue-500" />
                                        Tipps für die Suche (Wachstum)
                                    </h3>
                                    <p className="text-xs text-muted-foreground leading-relaxed">
                                        Analysten-Prognosen sind oft unter dem Reiter <strong>&quot;Schätzungen&quot;</strong> (Onvista, Finanzen.net) oder <strong>&quot;Analysen&quot;</strong> (MarketScreener) zu finden. <br />
                                        Suche dort nach dem &quot;Gewinnwachstum&quot; oder schaue dir an, wie sich der geschätzte &quot;Gewinn pro Aktie&quot; über die nächsten 3 Jahre entwickelt.
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="p-6 border-t border-border mt-auto">
                            <button
                                onClick={() => setShowGuide(false)}
                                className="w-full py-3 bg-primary text-primary-foreground rounded-xl font-bold hover:opacity-90 transition-opacity"
                            >
                                Alles klar!
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-2 border-b border-border">
                <div className="flex items-center gap-4">
                    <div className="size-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shadow-inner">
                        <Telescope className="size-7" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">Finanzteleskop Rechner</h1>
                        <p className="text-sm text-muted-foreground font-medium">Ermittlung des fairen Werts nach Rule #1 & DCF Logik</p>
                    </div>
                </div>
                <button
                    onClick={() => setShowGuide(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-secondary/50 hover:bg-secondary text-secondary-foreground rounded-lg transition-all border border-secondary/50 font-medium group"
                >
                    <BookOpen className="size-4 group-hover:scale-110 transition-transform" />
                    Wie funktioniert das? (Anleitung)
                </button>
            </div>

            {/* Search Bar (Rich Version) */}
            <div className="relative z-50">
                {!selectedSymbol || searchTerm ? (
                    <div className="relative" ref={searchRef}>
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                        <input
                            type="text"
                            placeholder="Aktie suchen (Bestände, Watchlist oder Global)..."
                            value={searchTerm}
                            onChange={(e) => {
                                setSearchTerm(e.target.value);
                                setShowStockList(true);
                            }}
                            onFocus={() => setShowStockList(true)}
                            className="w-full pl-9 pr-4 py-3 rounded-xl border border-border bg-card shadow-sm text-base focus:outline-none focus:ring-2 focus:ring-primary/20"
                        />
                        {isSearching && (
                            <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                <div className="size-4 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                            </div>
                        )}

                        {showStockList && (
                            <div className="absolute left-0 right-0 top-full max-h-80 overflow-y-auto border border-border rounded-xl divide-y divide-border bg-card shadow-2xl z-50 mt-2 animate-in fade-in slide-in-from-top-2 duration-200">
                                {searchTerm ? (
                                    // SEARCH RESULTS (Local + Global)
                                    <>
                                        {localMatches.filtered.length > 0 && (
                                            <div className="bg-primary/5 border-b border-border/50">
                                                <div className="px-3 py-2 text-xs font-bold text-primary uppercase tracking-widest flex items-center justify-between">
                                                    <span>Deine Bestände / Watchlist</span>
                                                    <span className="bg-primary/10 px-2 py-0.5 rounded-full">{localMatches.filtered.length}</span>
                                                </div>
                                                {localMatches.filtered.map(stock => (
                                                    <StockListItem
                                                        key={stock.id}
                                                        stock={stock}
                                                        onClick={() => handleLocalSelect(stock)}
                                                        subtitle={positions.some(p => p.stockId === stock.id) ? "Portfolio" : "Watchlist"}
                                                    />
                                                ))}
                                            </div>
                                        )}

                                        {searchResults.length > 0 ? (
                                            <div>
                                                {localMatches.filtered.length > 0 && (
                                                    <div className="px-3 py-2 text-xs font-bold text-muted-foreground uppercase tracking-widest bg-muted/30 border-b border-border/50">
                                                        Globaler Markt
                                                    </div>
                                                )}
                                                {searchResults
                                                    // Filter out items already shown in local results to avoid duplicates
                                                    .filter(res => !localMatches.filtered.some(local => local.symbol.toLowerCase() === res.symbol.toLowerCase()))
                                                    .map((res, idx) => (
                                                        <button
                                                            key={`${res.symbol}-${idx}`}
                                                            onClick={() => loadStockData(res.symbol, res.name || res.shortname, false, res.isin)}
                                                            className="w-full p-3 hover:bg-muted transition-colors text-left flex items-center justify-between group border-b border-border/50 last:border-0"
                                                        >
                                                            <div>
                                                                <div className="font-semibold flex items-center gap-2">
                                                                    <span>{res.symbol}</span>
                                                                    <span className="text-xs text-muted-foreground font-bold border px-1.5 py-0.5 rounded uppercase">{res.exchDisp || res.exch}</span>
                                                                </div>
                                                                <div className="text-sm text-muted-foreground truncate max-w-[200px] md:max-w-md">
                                                                    {res.name || res.shortname || res.longname}
                                                                </div>
                                                            </div>
                                                            <div className="text-right">
                                                                <div className="text-xs font-bold text-primary/70 uppercase tracking-tighter">Yahoo Global</div>
                                                            </div>
                                                        </button>
                                                    ))}
                                            </div>
                                        ) : !isSearching && localMatches.filtered.length === 0 ? (
                                            <div className="p-8 text-center text-muted-foreground italic">Keine Treffer gefunden</div>
                                        ) : null}
                                    </>
                                ) : (
                                    // CATEGORIZED SUGGESTIONS (Holdings & Watchlist - No search term)
                                    localMatches && (
                                        <>
                                            {localMatches.owned.length > 0 && (
                                                <div className="bg-muted/30">
                                                    <div className="px-3 py-2 text-xs font-bold text-muted-foreground uppercase tracking-widest flex items-center justify-between">
                                                        <span>Deine Bestände</span>
                                                        <span className="bg-primary/10 text-primary px-2 py-0.5 rounded-full">{localMatches.owned.length}</span>
                                                    </div>
                                                    {localMatches.owned.map(stock => (
                                                        <StockListItem key={stock.id} stock={stock} onClick={() => handleLocalSelect(stock)} subtitle="Im Portfolio" />
                                                    ))}
                                                </div>
                                            )}
                                            {localMatches.watch.length > 0 && (
                                                <div className="">
                                                    <div className="px-3 py-2 text-xs font-bold text-muted-foreground uppercase tracking-widest flex items-center justify-between border-t border-border/50">
                                                        <span>Watchlist</span>
                                                        <span className="bg-blue-500/10 text-blue-600 px-2 py-0.5 rounded-full">{localMatches.watch.length}</span>
                                                    </div>
                                                    {localMatches.watch.map((stock: any) => (
                                                        <StockListItem key={stock.id} stock={stock} onClick={() => handleLocalSelect(stock)} subtitle="Beobachtet" />
                                                    ))}
                                                </div>
                                            )}
                                            {localMatches.owned.length === 0 && localMatches.watch.length === 0 && (
                                                <div className="p-8 text-center text-muted-foreground">
                                                    Keine Bestände oder Watchlist-Einträge gefunden. Nutze die Suche für neue Titel.
                                                </div>
                                            )}
                                        </>
                                    )
                                )}
                            </div>
                        )}
                    </div>
                ) : (
                    // SELECTED STOCK DISPLAY
                    <div className="flex items-center gap-4 p-4 bg-muted/40 border border-border rounded-xl animate-in fade-in zoom-in-95 group">
                        {quote?.logoUrl || stocks.find(s => s.symbol === selectedSymbol)?.logoUrl ? (
                            <div className="size-14 rounded-xl p-2 bg-white border border-border flex items-center justify-center overflow-hidden">
                                <img
                                    src={quote?.logoUrl || stocks.find(s => s.symbol === selectedSymbol)?.logoUrl}
                                    alt="Logo"
                                    className="w-full h-full object-contain"
                                />
                            </div>
                        ) : (
                            <div className="size-14 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-bold border border-primary/20 text-xl">
                                {selectedSymbol?.slice(0, 2)}
                            </div>
                        )}
                        <div className="flex-1 min-w-0">
                            <Link
                                to={`/stock/${selectedSymbol}`}
                                className="font-bold text-xl truncate hover:text-primary transition-colors block"
                                title="Zur Detailansicht"
                            >
                                {quote?.name || stocks.find(s => s.symbol === selectedSymbol)?.name || selectedSymbol}
                            </Link>
                            <div className="text-sm text-muted-foreground flex items-center gap-2">
                                <span className="font-mono font-medium">{selectedSymbol}</span>
                                <span className="opacity-30">•</span>
                                <span>{quote?.currency || 'USD'}</span>
                            </div>
                        </div>
                        <button
                            onClick={() => {
                                setSelectedSymbol(null);
                                setQuote(null);
                                setAnalysis(null);
                                localStorage.removeItem('fair_value_state');
                            }}
                            className="p-2 text-muted-foreground hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                            title="Aktie entfernen"
                        >
                            <X className="size-6" />
                        </button>
                    </div>
                )}
            </div>

            {
                error && (
                    <div className="p-4 bg-red-50 text-red-600 rounded-xl border border-red-100 flex items-center gap-3 animate-in fade-in">
                        <TriangleAlert className="size-5 shrink-0" />
                        <div>{error}</div>
                    </div>
                )
            }

            {
                loadingData && (
                    <div className="py-12 flex flex-col items-center justify-center text-muted-foreground">
                        <div className="size-8 rounded-full border-2 border-primary border-t-transparent animate-spin mb-4" />
                        <p>Analysiere Fundamentaldaten...</p>
                    </div>
                )
            }

            {
                !selectedSymbol && !loadingData && (
                    <div className="text-center py-20 text-muted-foreground border-2 border-dashed border-border rounded-xl">
                        <Search className="size-10 mx-auto mb-4 opacity-50" />
                        <p className="text-lg font-medium">Suche nach einer Aktie, um zu beginnen</p>
                        <p className="text-sm">Wir laden automatisch EPS, KGV und Wachstumsprognosen.</p>
                    </div>
                )
            }

            {
                quote && !loadingData && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-in slide-in-from-bottom-4 duration-500">

                        {/* INPUTS COLUMN */}
                        <div className="space-y-6">
                            <div className="bg-card border border-border rounded-xl p-6 shadow-sm space-y-6">
                                <div className="flex items-center justify-between pb-4 border-b border-border">
                                    <h2 className="text-lg font-semibold flex items-center gap-2">
                                        <span className="size-2 rounded-full bg-blue-500" />
                                        Parameter
                                    </h2>
                                    <div className="text-right">
                                        <div className="text-xs text-muted-foreground">Aktueller Kurs</div>
                                        <div className="font-mono font-bold text-lg">
                                            {formatCurrency(quote.price || 0, quote.currency || 'USD')}
                                        </div>
                                    </div>
                                </div>

                                {/* EPS */}
                                <div className="space-y-2">
                                    <label className="text-sm font-medium flex justify-between">
                                        Gewinn pro Aktie (EPS)
                                        <span className="text-xs text-muted-foreground font-light">TTM</span>
                                    </label>
                                    <div className="relative">
                                        <input
                                            type="number"
                                            step="0.01"
                                            value={eps}
                                            onChange={(e) => setEps(e.target.value)}
                                            className="w-full p-2 rounded-lg border border-border bg-background font-mono [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none focus:ring-1 focus:ring-primary h-10"
                                        />
                                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">{quote.currency || 'USD'}</span>
                                    </div>
                                    <div className="flex gap-4 mt-1.5">
                                        <a
                                            href={`https://finance.yahoo.com/quote/${selectedSymbol}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-xs text-primary font-medium hover:underline flex items-center gap-1.5"
                                        >
                                            <ExternalLink className="size-3" />
                                            Yahoo Summary
                                        </a>
                                        <a
                                            href={quote?.isin ? `https://www.finanzen.ch/suchergebnisse?_search=${quote.isin}` : `https://www.finanzen.ch/fundamentalanalyse/${getCleanSearchName(quote?.name || selectedSymbol).toLowerCase().replace(/\s+/g, '-')}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-xs text-primary font-medium hover:underline flex items-center gap-1.5"
                                            title={quote?.isin ? "Suche via ISIN" : "Direkt zur Fundamentalanalyse"}
                                        >
                                            <ExternalLink className="size-3" />
                                            finanzen.ch
                                        </a>
                                    </div>
                                </div>

                                {/* GROWTH */}
                                <div className="space-y-2">
                                    <label className="text-sm font-medium flex justify-between">
                                        Wachstum pro Jahr (nächste 5 Jahre)
                                        <span className={cn("text-xs font-light", (analysis?.growthRate || analysis?.growthRate === 0) ? "text-green-600" : "text-amber-600")}>
                                            {(analysis?.growthRate || analysis?.growthRate === 0) ? 'Prognose gefunden' : 'Manuelle Schätzung'}
                                        </span>
                                    </label>
                                    <div className="space-y-3">
                                        <div className="relative">
                                            <input
                                                type="number"
                                                step="0.5"
                                                value={growthRate}
                                                onChange={(e) => setGrowthRate(e.target.value)}
                                                className="w-full p-2 rounded-lg border border-border bg-background font-mono [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none focus:ring-1 focus:ring-primary h-10"
                                            />
                                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">%</span>
                                        </div>

                                        {/* GROWTH HELPER TOGGLE */}
                                        <button
                                            type="button"
                                            onClick={() => setShowGrowthHelper(!showGrowthHelper)}
                                            className={cn(
                                                "flex items-center gap-2 text-xs font-bold uppercase tracking-wider transition-colors",
                                                showGrowthHelper ? "text-primary" : "text-muted-foreground hover:text-primary"
                                            )}
                                        >
                                            <Calculator className="size-3.5" />
                                            Wachstums-Rechner (Zinseszins)
                                            {showGrowthHelper ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
                                        </button>

                                        {/* GROWTH HELPER PANEL */}
                                        {showGrowthHelper && (
                                            <div className="p-4 bg-primary/5 rounded-xl border border-primary/20 space-y-4 animate-in slide-in-from-top-1 duration-200">
                                                <div className="grid grid-cols-3 gap-3">
                                                    <div className="space-y-1.5">
                                                        <label className="text-xs font-bold text-muted-foreground uppercase tracking-tight">Start EPS</label>
                                                        <input
                                                            type="number"
                                                            step="0.01"
                                                            value={startEps || ''}
                                                            onChange={(e) => setStartEps(e.target.value)}
                                                            placeholder="6.67"
                                                            className="w-full p-2 text-sm rounded border border-border bg-background font-mono focus:ring-1 focus:ring-primary h-9 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                                        />
                                                    </div>
                                                    <div className="space-y-1.5">
                                                        <label className="text-xs font-bold text-muted-foreground uppercase tracking-tight">Ende EPS</label>
                                                        <input
                                                            type="number"
                                                            step="0.01"
                                                            value={endEps || ''}
                                                            onChange={(e) => setEndEps(e.target.value)}
                                                            placeholder="12.19"
                                                            className="w-full p-2 text-sm rounded border border-border bg-background font-mono focus:ring-1 focus:ring-primary h-9 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                                        />
                                                    </div>
                                                    <div className="space-y-1.5">
                                                        <label className="text-xs font-bold text-muted-foreground uppercase tracking-tight">Jahre</label>
                                                        <input
                                                            type="number"
                                                            step="1"
                                                            value={periodYears || ''}
                                                            onChange={(e) => setPeriodYears(e.target.value)}
                                                            className="w-full p-2 text-sm rounded border border-border bg-background font-mono focus:ring-1 focus:ring-primary h-9 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                                        />
                                                    </div>
                                                </div>

                                                <div className="flex items-center justify-between pt-2 border-t border-primary/10">
                                                    <div className="text-sm">
                                                        <span className="text-muted-foreground font-medium">Ergebnis: </span>
                                                        <span className="font-bold text-primary font-mono text-base">{calculatedCagr}%</span>
                                                        <span className="text-muted-foreground text-xs ml-1">/ Jahr</span>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setGrowthRate(calculatedCagr);
                                                            setShowGrowthHelper(false);
                                                        }}
                                                        disabled={calculatedCagr <= 0}
                                                        className="flex items-center gap-2 px-4 py-1.5 bg-primary text-white rounded-lg text-xs font-bold hover:bg-primary/90 disabled:opacity-50 transition-all shadow-sm active:scale-95"
                                                    >
                                                        <Check className="size-4" />
                                                        Übernehmen
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex flex-wrap gap-x-5 gap-y-1.5 mt-1.5">
                                        <a
                                            href={`https://finance.yahoo.com/quote/${selectedSymbol}/analysis`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-xs text-primary font-medium hover:underline flex items-center gap-1.5"
                                        >
                                            <ExternalLink className="size-3" />
                                            Yahoo (Analysis)
                                        </a>
                                        <a
                                            href={`https://www.marketscreener.com/search/?q=${encodeURIComponent(quote?.isin || getCleanSearchName(quote?.name || ''))}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-xs text-primary font-medium hover:underline flex items-center gap-1.5"
                                        >
                                            <ExternalLink className="size-3" />
                                            MarketScreener
                                        </a>
                                        <a
                                            href={quote?.isin ? `https://www.onvista.de/aktien/isin/${quote.isin}` : `https://www.onvista.de/suche.html?searchText=${encodeURIComponent(getCleanSearchName(quote?.name || ''))}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-xs text-primary font-medium hover:underline flex items-center gap-1.5"
                                        >
                                            <ExternalLink className="size-3" />
                                            Onvista.de
                                        </a>
                                        <a
                                            href={quote?.isin ? `https://www.finanzen.net/suchergebnis.asp?key=${quote.isin}` : `https://www.finanzen.net/suchergebnisse?_search=${encodeURIComponent(getCleanSearchName(quote?.name || ''))}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-xs text-primary font-medium hover:underline flex items-center gap-1.5"
                                        >
                                            <ExternalLink className="size-3" />
                                            finanzen.net
                                        </a>
                                    </div>
                                </div>

                                {/* DIVIDEND YIELD */}
                                <div className="space-y-2">
                                    <label className="text-sm font-medium flex justify-between">
                                        Dividendenrendite
                                        <span className="text-xs text-muted-foreground font-light">Aktuell (Editierbar)</span>
                                    </label>
                                    <div className="relative">
                                        <input
                                            type="number"
                                            step="0.1"
                                            value={dividendYield}
                                            onChange={(e) => setDividendYield(e.target.value)}
                                            className="w-full p-2 rounded-lg border border-border bg-background font-mono [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none focus:ring-1 focus:ring-primary h-10"
                                        />
                                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">%</span>
                                    </div>
                                </div>

                                {/* PE RATIO */}
                                <div className="space-y-2">
                                    <label className="text-sm font-medium flex justify-between">
                                        Verkaufs-KGV (in 5J)
                                        <span className="text-xs text-muted-foreground font-light">Hist Ø oder Manuell</span>
                                    </label>
                                    <div className="space-y-2 text-xs text-muted-foreground bg-muted/50 p-2 rounded-lg border border-border/50">
                                        <div className="flex justify-between">
                                            <span>Aktuelles KGV:</span>
                                            <span className="font-mono">
                                                {quote.trailingPE ? quote.trailingPE.toFixed(2) :
                                                    (quote.price && eps ? (quote.price / (typeof eps === 'string' ? parseFloat(eps) || 1 : eps)).toFixed(2) : '-')}
                                            </span>
                                        </div>
                                        <div className="flex justify-between font-medium text-foreground">
                                            <span>KGV-Obergrenze (Rule #1):</span>
                                            <span className="font-mono">{calculation.ruleOneLimit.toFixed(2)}</span>
                                        </div>
                                    </div>
                                    <div className="relative">
                                        <input
                                            type="number"
                                            value={pe}
                                            onChange={(e) => setPe(parseFloat(e.target.value) || 0)}
                                            className="w-full p-2 rounded-lg border border-border bg-background font-mono [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none focus:ring-1 focus:ring-primary h-10"
                                        />
                                        {calculation.isCorrectionNeeded && (
                                            <div className="text-xs text-amber-600 mt-2 flex items-center gap-1.5 leading-tight font-medium">
                                                <TriangleAlert className="size-3.5 shrink-0" />
                                                <span>KGV über klassischem Rule #1 Limit (Ref: {calculation.ruleOneLimit.toFixed(1)})</span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="h-px bg-border my-4" />

                                {/* DISCOUNT RATE */}
                                <div className="space-y-2">
                                    <label className="text-sm font-medium flex justify-between">
                                        Zielrendite pro Jahr (Discount Rate)
                                    </label>
                                    <div className="relative">
                                        <input
                                            type="number"
                                            step="0.5"
                                            value={discountRate}
                                            onChange={(e) => setDiscountRate(e.target.value)}
                                            className="w-full p-2 rounded-lg border border-border bg-background font-mono [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none focus:ring-1 focus:ring-primary h-10"
                                        />
                                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">%</span>
                                    </div>
                                </div>

                                {/* MARGIN OF SAFETY */}
                                <div className="space-y-2">
                                    <label className="text-sm font-medium flex justify-between">
                                        Sicherheitsmarge
                                    </label>
                                    <div className="relative">
                                        <input
                                            type="number"
                                            step="5"
                                            value={mos}
                                            onChange={(e) => setMos(e.target.value)}
                                            className="w-full p-2 rounded-lg border border-border bg-background font-mono [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none focus:ring-1 focus:ring-primary h-10"
                                        />
                                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">%</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* RESULTS COLUMN */}
                        <div className="space-y-6">
                            <div className="bg-card border border-border rounded-xl p-6 shadow-sm h-full flex flex-col">
                                <h2 className="text-lg font-semibold flex items-center gap-2 mb-6">
                                    <span className="size-2 rounded-full bg-purple-500" />
                                    Bewertung
                                </h2>

                                {/* Traffic Light */}
                                <div className="flex justify-center mb-8">
                                    <div className={cn(
                                        "relative size-40 rounded-full flex flex-col items-center justify-center border-4 shadow-xl transition-all duration-500 text-center px-2",
                                        isUndervalued
                                            ? "bg-green-100 border-green-500 text-green-700 shadow-green-500/20"
                                            : isFair
                                                ? "bg-yellow-50 border-yellow-500 text-yellow-700 shadow-yellow-500/20"
                                                : "bg-red-50 border-red-500 text-red-700 shadow-red-500/20"
                                    )}>
                                        <div className="text-xs uppercase font-black tracking-widest mb-1 opacity-80">
                                            {isUndervalued ? 'KAUFEN' : isFair ? 'HOLD' : 'TEUER'}
                                        </div>
                                        <div className="text-xl font-bold leading-tight break-words max-w-full">
                                            {formatCurrency(currentPrice, quote.currency, false)}
                                        </div>
                                        {quote.currency !== 'CHF' && (
                                            <div className="text-xs font-bold mt-0.5 whitespace-nowrap">
                                                {formatCurrency(currentPrice, quote.currency).split(' - ')[1]}
                                            </div>
                                        )}
                                        <div className="text-xs mt-2 opacity-60 font-bold">Aktueller Kurs</div>
                                    </div>
                                </div>

                                {/* Value Stack */}
                                <div className="flex-1 space-y-4">
                                    {/* Buy Price */}
                                    <div className={cn(
                                        "p-4 rounded-xl border-2 transition-all",
                                        isUndervalued ? "border-green-500 bg-green-500/5 shadow-sm" : "border-border bg-muted/20 opacity-70"
                                    )}>
                                        <div className="flex justify-between items-end mb-1">
                                            <span className="font-bold text-lg">Kaufpreis</span>
                                            <span className="font-mono text-2xl font-bold text-green-600">
                                                {formatCurrency(calculation.buyPrice, quote.currency)}
                                            </span>
                                        </div>
                                        <p className="text-xs text-muted-foreground">
                                            Maximaler Preis inkl. {mos}% Sicherheitsmarge
                                        </p>
                                    </div>

                                    {/* Fair Value */}
                                    <div className="p-4 rounded-xl border border-border bg-card">
                                        <div className="flex justify-between items-end mb-1">
                                            <span className={cn("font-medium", isYieldGap && "text-red-600 font-bold")}>Fairer Wert</span>
                                            <span className={cn("font-mono text-xl", isYieldGap && "text-red-600 font-bold font-mono")}>
                                                {formatCurrency(calculation.fairValue, quote.currency)}
                                            </span>
                                        </div>
                                        <p className={cn("text-xs", isYieldGap ? "text-red-500/80 font-medium" : "text-muted-foreground")}>
                                            Innerer Wert heute ({discountRate}% Zielrendite + Dividenden)
                                        </p>
                                        {isYieldGap && (
                                            <p className="text-xs text-red-500 mt-2 leading-relaxed italic font-medium">
                                                Achtung: Renditeerwartung ({discountRate}%) ist höher als Ertrag ({growthRate}% + {dividendYield}%).
                                                Rechnung basiert auf steigendem KGV!
                                            </p>
                                        )}
                                    </div>

                                    {/* Future Value */}
                                    <div className="p-4 rounded-xl border border-border bg-muted/10">
                                        <div className="flex justify-between items-end mb-1">
                                            <span className="text-sm font-medium text-muted-foreground">Zielkurs (5 Jahre)</span>
                                            <span className="font-mono text-lg text-muted-foreground">
                                                {formatCurrency(calculation.futurePrice, quote.currency)}
                                            </span>
                                        </div>
                                        <p className="text-xs text-muted-foreground">
                                            Gewinn {calculation.futureEps.toFixed(2)} × KGV {calculation.exitPe.toFixed(1)}
                                        </p>
                                    </div>
                                </div>

                                {/* Overvaluation Warning */}
                                {!isUndervalued && !isFair && (
                                    <div className="mt-6 p-3 bg-red-100/50 text-red-800 rounded-lg flex items-start gap-2 text-sm border border-red-200 animate-in fade-in">
                                        <TriangleAlert className="size-4 shrink-0 mt-0.5" />
                                        <div>
                                            Aktie ist ca. {currentPrice && calculation.fairValue ? Math.round(((currentPrice - calculation.fairValue) / calculation.fairValue) * 100) : '-'}% überbewertet.
                                        </div>
                                    </div>
                                )}

                            </div>
                        </div>

                    </div>
                )
            }
        </div >
    );
}
