import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { 
    Globe, 
    RefreshCw, 
    Edit3, 
    Check, 
    Plus, 
    X, 
    ChevronLeft, 
    ChevronRight, 
    RotateCcw, 
    TrendingUp, 
    TrendingDown,
    Wallet
} from 'lucide-react';
import { usePortfolio } from '../context/PortfolioContext';
import { usePortfolioData } from '../hooks/usePortfolioData';
import { useExchangeRates } from '../context/ExchangeRateContext';
import { convertToCHF } from '../utils/currency';
import { cn } from '../utils';

export interface MarketItem {
    id: string;
    symbol: string;
    name: string;
    category: 'indices' | 'commodities' | 'forex' | 'stocks' | 'crypto' | 'asia' | 'portfolio';
    decimals?: number;
}

export interface MarketQuoteData {
    price: number;
    previousClose: number;
    changePercent: number;
    changeAmount: number;
    currency?: string;
    high?: number;
    low?: number;
    lastUpdated?: string;
}

export const DEFAULT_MARKET_ITEMS: MarketItem[] = [
    { id: '1', symbol: 'ZURN.SW', name: 'ZURICH INSURA...', category: 'stocks', decimals: 2 },
    { id: '2', symbol: 'R6C0.DE', name: 'Shell', category: 'stocks', decimals: 2 },
    { id: '3', symbol: 'VWCE.DE', name: 'Vanguard FTSE...', category: 'stocks', decimals: 2 },
    { id: '4', symbol: '^SSMI', name: 'Swiss Market In...', category: 'indices', decimals: 2 },
    { id: '5', symbol: 'SREN.SW', name: 'Swiss Re', category: 'stocks', decimals: 2 },
    { id: '6', symbol: '^NDX', name: 'Nasdaq-100 Ind...', category: 'indices', decimals: 2 },
    { id: 'asia-1', symbol: '^N225', name: 'Nikkei 225 (Japan)', category: 'asia', decimals: 2 },
    { id: 'asia-2', symbol: '^HSI', name: 'Hang Seng (Hongkong)', category: 'asia', decimals: 2 },
    { id: 'asia-3', symbol: '000001.SS', name: 'Shanghai Composite', category: 'asia', decimals: 2 },
    { id: '7', symbol: 'BZ=F', name: 'L&S Brent Oil', category: 'commodities', decimals: 2 },
    { id: '8', symbol: 'GC=F', name: 'Goldpreis (Spot)', category: 'commodities', decimals: 2 },
    { id: '9', symbol: 'SI=F', name: 'Silberpreis (Spot)', category: 'commodities', decimals: 2 },
    { id: '10', symbol: 'CHFGBP=X', name: 'CHF/GBP', category: 'forex', decimals: 4 },
    { id: '11', symbol: 'CHFEUR=X', name: 'CHF/EUR', category: 'forex', decimals: 4 },
    { id: '12', symbol: 'CHFUSD=X', name: 'CHF/USD', category: 'forex', decimals: 4 },
    { id: '13', symbol: 'BTC-CHF', name: 'Bitcoin (CHF)', category: 'crypto', decimals: 0 },
    { id: '14', symbol: 'ETH-CHF', name: 'Ethereum (CHF)', category: 'crypto', decimals: 2 },
    { id: '15', symbol: 'GBPCHF=X', name: 'GBP/CHF', category: 'forex', decimals: 4 },
];

// Fallback baseline prices for offline / GitHub Pages cold start
const DEFAULT_FALLBACK_QUOTES: Record<string, MarketQuoteData> = {
    'ZURN.SW': { price: 664.20, previousClose: 655.40, changePercent: 1.34, changeAmount: 8.80, currency: 'CHF' },
    'R6C0.DE': { price: 46.85, previousClose: 47.41, changePercent: -1.18, changeAmount: -0.56, currency: 'EUR' },
    'VWCE.DE': { price: 170.88, previousClose: 170.44, changePercent: 0.26, changeAmount: 0.44, currency: 'EUR' },
    '^SSMI': { price: 14368.78, previousClose: 14391.77, changePercent: -0.16, changeAmount: -22.99, currency: 'CHF' },
    'SREN.SW': { price: 161.60, previousClose: 160.30, changePercent: 0.81, changeAmount: 1.30, currency: 'CHF' },
    '^NDX': { price: 29529.34, previousClose: 29187.84, changePercent: 1.17, changeAmount: 341.50, currency: 'USD' },
    '^N225': { price: 39180.30, previousClose: 38950.00, changePercent: 0.59, changeAmount: 230.30, currency: 'JPY' },
    '^HSI': { price: 20630.50, previousClose: 20490.20, changePercent: 0.68, changeAmount: 140.30, currency: 'HKD' },
    '000001.SS': { price: 3368.80, previousClose: 3350.10, changePercent: 0.56, changeAmount: 18.70, currency: 'CNY' },
    '000300.SS': { price: 3980.50, previousClose: 3960.20, changePercent: 0.51, changeAmount: 20.30, currency: 'CNY' },
    '^KS11': { price: 2610.40, previousClose: 2605.10, changePercent: 0.20, changeAmount: 5.30, currency: 'KRW' },
    '^TWII': { price: 23250.60, previousClose: 23110.00, changePercent: 0.61, changeAmount: 140.60, currency: 'TWD' },
    '^NSEI': { price: 24860.20, previousClose: 24820.00, changePercent: 0.16, changeAmount: 40.20, currency: 'INR' },
    '^AXJO': { price: 8280.40, previousClose: 8250.00, changePercent: 0.37, changeAmount: 30.40, currency: 'AUD' },
    'BZ=F': { price: 109.23, previousClose: 109.72, changePercent: -0.45, changeAmount: -0.49, currency: 'USD' },
    'GC=F': { price: 4142.60, previousClose: 4131.45, changePercent: 0.27, changeAmount: 11.15, currency: 'USD' },
    'SI=F': { price: 57.42, previousClose: 56.88, changePercent: 0.95, changeAmount: 0.54, currency: 'USD' },
    'CL=F': { price: 98.14, previousClose: 98.54, changePercent: -0.41, changeAmount: -0.40, currency: 'USD' },
    'NG=F': { price: 2.97, previousClose: 3.06, changePercent: -2.94, changeAmount: -0.09, currency: 'USD' },
    'HG=F': { price: 6.61, previousClose: 6.58, changePercent: 0.52, changeAmount: 0.03, currency: 'USD' },
    'CHFGBP=X': { price: 0.9088, previousClose: 0.9081, changePercent: 0.08, changeAmount: 0.0007, currency: 'GBP' },
    'GBPCHF=X': { price: 1.1003, previousClose: 1.0994, changePercent: 0.08, changeAmount: 0.0009, currency: 'CHF' },
    'CHFEUR=X': { price: 1.0789, previousClose: 1.0779, changePercent: 0.09, changeAmount: 0.0010, currency: 'EUR' },
    'CHFUSD=X': { price: 1.2119, previousClose: 1.2088, changePercent: 0.26, changeAmount: 0.0031, currency: 'USD' },
    'BTC-CHF': { price: 68150, previousClose: 67700, changePercent: 0.65, changeAmount: 450, currency: 'CHF' },
    'ETH-CHF': { price: 2018, previousClose: 1985, changePercent: 1.67, changeAmount: 33, currency: 'CHF' }
};

export const PRESET_OPTIONS: Omit<MarketItem, 'id'>[] = [
    // Asiatische Indizes (Morgen-Check)
    { symbol: '^N225', name: 'Nikkei 225 (Japan)', category: 'asia', decimals: 2 },
    { symbol: '^HSI', name: 'Hang Seng (Hongkong)', category: 'asia', decimals: 2 },
    { symbol: '000001.SS', name: 'Shanghai Composite (China)', category: 'asia', decimals: 2 },
    { symbol: '000300.SS', name: 'CSI 300 (China)', category: 'asia', decimals: 2 },
    { symbol: '^KS11', name: 'Kospi (Südkorea)', category: 'asia', decimals: 2 },
    { symbol: '^TWII', name: 'Taiwan Weighted (Taiex)', category: 'asia', decimals: 2 },
    { symbol: '^NSEI', name: 'Nifty 50 (Indien)', category: 'asia', decimals: 2 },
    { symbol: '^AXJO', name: 'ASX 200 (Australien)', category: 'asia', decimals: 2 },
    // Indizes (Westen)
    { symbol: '^SSMI', name: 'Swiss Market Index (SMI)', category: 'indices', decimals: 2 },
    { symbol: '^NDX', name: 'Nasdaq-100 Index', category: 'indices', decimals: 2 },
    { symbol: '^GSPC', name: 'S&P 500 Index', category: 'indices', decimals: 2 },
    { symbol: '^GDAXI', name: 'DAX (Deutschland)', category: 'indices', decimals: 2 },
    { symbol: '^DJI', name: 'Dow Jones Industrial', category: 'indices', decimals: 2 },
    { symbol: '^STOXX50E', name: 'Euro Stoxx 50', category: 'indices', decimals: 2 },
    // Rohstoffe
    { symbol: 'GC=F', name: 'Goldpreis (Spot)', category: 'commodities', decimals: 2 },
    { symbol: 'SI=F', name: 'Silberpreis (Spot)', category: 'commodities', decimals: 2 },
    { symbol: 'BZ=F', name: 'L&S Brent Oil', category: 'commodities', decimals: 2 },
    { symbol: 'CL=F', name: 'WTI Crude Oil', category: 'commodities', decimals: 2 },
    { symbol: 'HG=F', name: 'Kupfer (Copper)', category: 'commodities', decimals: 2 },
    { symbol: 'NG=F', name: 'Erdgas (Natural Gas)', category: 'commodities', decimals: 2 },
    { symbol: 'PL=F', name: 'Platin', category: 'commodities', decimals: 2 },
    // Währungen
    { symbol: 'GBPCHF=X', name: 'GBP/CHF', category: 'forex', decimals: 4 },
    { symbol: 'CHFEUR=X', name: 'CHF/EUR', category: 'forex', decimals: 4 },
    { symbol: 'CHFUSD=X', name: 'CHF/USD', category: 'forex', decimals: 4 },
    { symbol: 'CHFGBP=X', name: 'CHF/GBP', category: 'forex', decimals: 4 },
    { symbol: 'EURCHF=X', name: 'EUR/CHF', category: 'forex', decimals: 4 },
    { symbol: 'USDCHF=X', name: 'USD/CHF', category: 'forex', decimals: 4 },
    { symbol: 'EURUSD=X', name: 'EUR/USD', category: 'forex', decimals: 4 },
    { symbol: 'GBPUSD=X', name: 'GBP/USD', category: 'forex', decimals: 4 },
    // Krypto
    { symbol: 'BTC-CHF', name: 'Bitcoin (CHF)', category: 'crypto', decimals: 0 },
    { symbol: 'ETH-CHF', name: 'Ethereum (CHF)', category: 'crypto', decimals: 2 },
    { symbol: 'BTC-USD', name: 'Bitcoin (USD)', category: 'crypto', decimals: 0 },
    { symbol: 'ETH-USD', name: 'Ethereum (USD)', category: 'crypto', decimals: 2 },
    { symbol: 'SOL-USD', name: 'Solana (USD)', category: 'crypto', decimals: 2 },
];

export function MarketOverviewPage() {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const { stocks, positions } = usePortfolio();
    const { totals } = usePortfolioData();
    const { rates } = useExchangeRates();

    const portfolioDailyGain = totals.dailyGain || 0;
    const portfolioDailyGainPercent = totals.dailyGainPercent || 0;
    const isPortfolioPositive = portfolioDailyGain >= 0;

    // Tab types
    const VALID_TABS = useMemo(() => ['all', 'portfolio', 'indices', 'asia', 'commodities', 'forex', 'stocks', 'crypto'] as const, []);
    type TabType = typeof VALID_TABS[number];

    // Extract all owned stocks and ETFs from the portfolio holdings
    const portfolioStocks = useMemo(() => {
        const ownedMap = new Map<string, typeof stocks[0] & { shares: number; totalCost: number }>();
        (positions || []).forEach(pos => {
            if (pos.shares > 0) {
                const stock = stocks.find(s => s.id === pos.stockId);
                if (stock) {
                    const key = stock.symbol.toUpperCase();
                    const existing = ownedMap.get(key);
                    if (existing) {
                        existing.shares += pos.shares;
                        existing.totalCost += pos.shares * (pos.buyPriceAvg || 0);
                    } else {
                        ownedMap.set(key, {
                            ...stock,
                            shares: pos.shares,
                            totalCost: pos.shares * (pos.buyPriceAvg || 0)
                        });
                    }
                }
            }
        });
        return Array.from(ownedMap.values());
    }, [positions, stocks]);

    // Convert owned stocks/ETFs into MarketItems for the Bestand tile set
    const portfolioMarketItems = useMemo<MarketItem[]>(() => {
        return portfolioStocks.map(stock => ({
            id: `portfolio-${stock.id || stock.symbol}`,
            symbol: stock.symbol,
            name: stock.name,
            category: 'stocks',
            decimals: 2
        }));
    }, [portfolioStocks]);

    // Read initial tab from URL param or sessionStorage so returning from detail keeps the exact tab
    const [activeFilter, setActiveFilter] = useState<TabType>(() => {
        const urlTab = searchParams.get('tab') as TabType | null;
        if (urlTab && VALID_TABS.includes(urlTab)) return urlTab;
        try {
            const saved = sessionStorage.getItem('portfolio_market_overview_tab') as TabType | null;
            if (saved && VALID_TABS.includes(saved)) return saved;
        } catch {
            // ignore
        }
        return 'all';
    });

    const handleTabChange = useCallback((newTab: TabType) => {
        setActiveFilter(newTab);
        try {
            sessionStorage.setItem('portfolio_market_overview_tab', newTab);
            setSearchParams(newTab !== 'all' ? { tab: newTab } : {}, { replace: true });
        } catch {
            // ignore
        }
    }, [setSearchParams]);

    // Keep activeFilter in sync if URL search param changes (e.g. browser back/forward)
    useEffect(() => {
        const urlTab = searchParams.get('tab') as TabType | null;
        if (urlTab && VALID_TABS.includes(urlTab)) {
            if (urlTab !== activeFilter) setActiveFilter(urlTab);
        } else if (!urlTab && activeFilter !== 'all') {
            const saved = sessionStorage.getItem('portfolio_market_overview_tab') as TabType | null;
            if (saved && VALID_TABS.includes(saved) && saved !== activeFilter) {
                setActiveFilter(saved);
            }
        }
    }, [searchParams, activeFilter, VALID_TABS]);

    // Stored items
    const [items, setItems] = useState<MarketItem[]>(() => {
        try {
            const raw = localStorage.getItem('portfolio_market_overview_items');
            if (raw) {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    // Automatically append major Asian indices if user hasn't added them yet
                    const hasAsia = parsed.some((it: MarketItem) => it.symbol === '^N225' || it.symbol === '^HSI' || it.category === 'asia');
                    if (!hasAsia) {
                        const asianDefaults: MarketItem[] = [
                            { id: 'asia-1', symbol: '^N225', name: 'Nikkei 225 (Japan)', category: 'asia', decimals: 2 },
                            { id: 'asia-2', symbol: '^HSI', name: 'Hang Seng (Hongkong)', category: 'asia', decimals: 2 },
                            { id: 'asia-3', symbol: '000001.SS', name: 'Shanghai Composite', category: 'asia', decimals: 2 },
                        ];
                        const merged = [...parsed, ...asianDefaults];
                        localStorage.setItem('portfolio_market_overview_items', JSON.stringify(merged));
                        return merged;
                    }
                    return parsed;
                }
            }
        } catch (e) {
            console.warn('Failed to load market items', e);
        }
        return DEFAULT_MARKET_ITEMS;
    });

    // Cached quotes (starts with localStorage, falls back to baseline, never empty!)
    const [quotes, setQuotes] = useState<Record<string, MarketQuoteData>>(() => {
        try {
            const raw = localStorage.getItem('portfolio_market_overview_quotes');
            if (raw) {
                const parsed = JSON.parse(raw);
                if (parsed && typeof parsed === 'object') {
                    return { ...DEFAULT_FALLBACK_QUOTES, ...parsed };
                }
            }
        } catch (e) {
            console.warn('Failed to load cached market quotes', e);
        }
        return DEFAULT_FALLBACK_QUOTES;
    });

    const [loading, setLoading] = useState(false);
    const [lastRefresh, setLastRefresh] = useState<Date | null>(() => new Date());
    const [isEditMode, setIsEditMode] = useState(false);

    // Add modal state
    const [showAddModal, setShowAddModal] = useState(false);
    const [searchSymbol, setSearchSymbol] = useState('');
    const [customName, setCustomName] = useState('');
    const [customCategory, setCustomCategory] = useState<MarketItem['category']>('stocks');

    // Save items to localStorage
    useEffect(() => {
        try {
            localStorage.setItem('portfolio_market_overview_items', JSON.stringify(items));
        } catch (e) {
            console.warn('Failed to save market items', e);
        }
    }, [items]);

    // Save quotes to localStorage
    useEffect(() => {
        try {
            if (Object.keys(quotes).length > 0) {
                localStorage.setItem('portfolio_market_overview_quotes', JSON.stringify(quotes));
            }
        } catch (e) {
            console.warn('Failed to save market quotes', e);
        }
    }, [quotes]);

    // Keep quotes in ref to avoid infinite re-render loops in fetchQuotes
    const quotesRef = useRef(quotes);
    useEffect(() => {
        quotesRef.current = quotes;
    }, [quotes]);

    // Fetch live quotes for all symbols
    const fetchQuotes = useCallback(async () => {
        if (items.length === 0) return;
        setLoading(true);

        const newQuotes: Record<string, MarketQuoteData> = {};

        // 1. Instantly use any quotes from stocks in Portfolio / Watchlist
        if (stocks && stocks.length > 0) {
            stocks.forEach(matchedStock => {
                if (matchedStock && matchedStock.currentPrice > 0) {
                    const price = matchedStock.currentPrice;
                    const prev = matchedStock.previousClose || price;
                    const changeAmount = price - prev;
                    const changePercent = prev > 0 ? (changeAmount / prev) * 100 : 0;
                    newQuotes[matchedStock.symbol] = {
                        price,
                        previousClose: prev,
                        changePercent,
                        changeAmount,
                        currency: matchedStock.currency,
                        lastUpdated: new Date().toISOString()
                    };
                }
            });
        }

        // 2. Fetch live CHF currencies directly via open.er-api.com (Works 100% on GitHub Pages without CORS block!)
        try {
            const res = await fetch('https://open.er-api.com/v6/latest/CHF');
            if (res.ok) {
                const json = await res.json();
                const rates = json.rates || {};
                const nowIso = new Date().toISOString();

                if (rates.GBP) {
                    const p = rates.GBP;
                    const prev = quotesRef.current['CHFGBP=X']?.previousClose || 0.9081;
                    newQuotes['CHFGBP=X'] = {
                        price: p,
                        previousClose: prev,
                        changePercent: prev > 0 ? ((p - prev) / prev) * 100 : 0.08,
                        changeAmount: p - prev,
                        currency: 'GBP',
                        lastUpdated: nowIso
                    };

                    // Live GBP/CHF rate (1 GBP in CHF)
                    const pGbpChf = Number((1 / p).toFixed(4));
                    const prevGbpChf = quotesRef.current['GBPCHF=X']?.previousClose || Number((1 / prev).toFixed(4));
                    const chgGbpChf = pGbpChf - prevGbpChf;
                    newQuotes['GBPCHF=X'] = {
                        price: pGbpChf,
                        previousClose: prevGbpChf,
                        changePercent: prevGbpChf > 0 ? (chgGbpChf / prevGbpChf) * 100 : -0.08,
                        changeAmount: chgGbpChf,
                        currency: 'CHF',
                        lastUpdated: nowIso
                    };
                }
                if (rates.EUR) {
                    const p = rates.EUR;
                    const prev = quotesRef.current['CHFEUR=X']?.previousClose || 1.0779;
                    newQuotes['CHFEUR=X'] = {
                        price: p,
                        previousClose: prev,
                        changePercent: prev > 0 ? ((p - prev) / prev) * 100 : 0.09,
                        changeAmount: p - prev,
                        currency: 'EUR',
                        lastUpdated: nowIso
                    };

                    // Live EUR/CHF rate (1 EUR in CHF)
                    const pEurChf = Number((1 / p).toFixed(4));
                    const prevEurChf = quotesRef.current['EURCHF=X']?.previousClose || Number((1 / prev).toFixed(4));
                    const chgEurChf = pEurChf - prevEurChf;
                    newQuotes['EURCHF=X'] = {
                        price: pEurChf,
                        previousClose: prevEurChf,
                        changePercent: prevEurChf > 0 ? (chgEurChf / prevEurChf) * 100 : -0.09,
                        changeAmount: chgEurChf,
                        currency: 'CHF',
                        lastUpdated: nowIso
                    };
                }
                if (rates.USD) {
                    const p = rates.USD;
                    const prev = quotesRef.current['CHFUSD=X']?.previousClose || 1.2088;
                    newQuotes['CHFUSD=X'] = {
                        price: p,
                        previousClose: prev,
                        changePercent: prev > 0 ? ((p - prev) / prev) * 100 : 0.26,
                        changeAmount: p - prev,
                        currency: 'USD',
                        lastUpdated: nowIso
                    };

                    // Live USD/CHF rate (1 USD in CHF)
                    const pUsdChf = Number((1 / p).toFixed(4));
                    const prevUsdChf = quotesRef.current['USDCHF=X']?.previousClose || Number((1 / prev).toFixed(4));
                    const chgUsdChf = pUsdChf - prevUsdChf;
                    newQuotes['USDCHF=X'] = {
                        price: pUsdChf,
                        previousClose: prevUsdChf,
                        changePercent: prevUsdChf > 0 ? (chgUsdChf / prevUsdChf) * 100 : -0.26,
                        changeAmount: chgUsdChf,
                        currency: 'CHF',
                        lastUpdated: nowIso
                    };
                }
            }
        } catch (e) {
            console.warn('Currency live fetch fallback skipped:', e);
        }

        // 2b. Fetch live Cryptos via CoinGecko public API (Supports CHF & USD natively without CORS block on GitHub Pages!)
        try {
            const hasCrypto = items.some(i => i.category === 'crypto' || i.symbol.startsWith('BTC') || i.symbol.startsWith('ETH') || i.symbol.startsWith('SOL'));
            if (hasCrypto) {
                const cgRes = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana&vs_currencies=chf,usd&include_24hr_change=true');
                if (cgRes.ok) {
                    const cg = await cgRes.json();
                    const nowIso = new Date().toISOString();

                    if (cg.bitcoin) {
                        if (cg.bitcoin.chf !== undefined) {
                            const price = cg.bitcoin.chf;
                            const changePct = cg.bitcoin.chf_24h_change || 0;
                            const prev = price / (1 + changePct / 100);
                            newQuotes['BTC-CHF'] = {
                                price,
                                previousClose: prev,
                                changePercent: changePct,
                                changeAmount: price - prev,
                                currency: 'CHF',
                                lastUpdated: nowIso
                            };
                        }
                        if (cg.bitcoin.usd !== undefined) {
                            const price = cg.bitcoin.usd;
                            const changePct = cg.bitcoin.usd_24h_change || 0;
                            const prev = price / (1 + changePct / 100);
                            newQuotes['BTC-USD'] = {
                                price,
                                previousClose: prev,
                                changePercent: changePct,
                                changeAmount: price - prev,
                                currency: 'USD',
                                lastUpdated: nowIso
                            };
                        }
                    }

                    if (cg.ethereum) {
                        if (cg.ethereum.chf !== undefined) {
                            const price = cg.ethereum.chf;
                            const changePct = cg.ethereum.chf_24h_change || 0;
                            const prev = price / (1 + changePct / 100);
                            newQuotes['ETH-CHF'] = {
                                price,
                                previousClose: prev,
                                changePercent: changePct,
                                changeAmount: price - prev,
                                currency: 'CHF',
                                lastUpdated: nowIso
                            };
                        }
                        if (cg.ethereum.usd !== undefined) {
                            const price = cg.ethereum.usd;
                            const changePct = cg.ethereum.usd_24h_change || 0;
                            const prev = price / (1 + changePct / 100);
                            newQuotes['ETH-USD'] = {
                                price,
                                previousClose: prev,
                                changePercent: changePct,
                                changeAmount: price - prev,
                                currency: 'USD',
                                lastUpdated: nowIso
                            };
                        }
                    }

                    if (cg.solana) {
                        if (cg.solana.chf !== undefined) {
                            const price = cg.solana.chf;
                            const changePct = cg.solana.chf_24h_change || 0;
                            const prev = price / (1 + changePct / 100);
                            newQuotes['SOL-CHF'] = {
                                price,
                                previousClose: prev,
                                changePercent: changePct,
                                changeAmount: price - prev,
                                currency: 'CHF',
                                lastUpdated: nowIso
                            };
                        }
                        if (cg.solana.usd !== undefined) {
                            const price = cg.solana.usd;
                            const changePct = cg.solana.usd_24h_change || 0;
                            const prev = price / (1 + changePct / 100);
                            newQuotes['SOL-USD'] = {
                                price,
                                previousClose: prev,
                                changePercent: changePct,
                                changeAmount: price - prev,
                                currency: 'USD',
                                lastUpdated: nowIso
                            };
                        }
                    }
                }
            }
        } catch (e) {
            console.warn('CoinGecko live fetch fallback skipped:', e);
        }

        // 3. Try batch query via local Yahoo API proxy (Works in local dev server / localhost / PC)
        try {
            const symList = Array.from(new Set([
                ...items.map(i => i.symbol),
                ...stocks.map(s => s.symbol)
            ]));
            const res = await fetch(`/api/yahoo-quote?symbol=${symList.join(',')}&_=${Date.now()}`);
            if (res.ok) {
                const json = await res.json();
                const results = json.quoteResponse?.result || [];
                for (const r of results) {
                    if (r && r.symbol && r.regularMarketPrice !== undefined) {
                        const price = r.regularMarketPrice;
                        const previousClose = r.regularMarketPreviousClose || r.regularMarketOpen || price;
                        const changeAmount = price - previousClose;
                        const changePercent = previousClose > 0 ? (changeAmount / previousClose) * 100 : (r.regularMarketChangePercent || 0);

                        newQuotes[r.symbol] = {
                            price,
                            previousClose,
                            changePercent,
                            changeAmount,
                            currency: r.currency,
                            high: r.regularMarketDayHigh,
                            low: r.regularMarketDayLow,
                            lastUpdated: new Date().toISOString()
                        };
                    }
                }
            }
        } catch {
            // Handled gracefully: offline / GitHub Pages
        }

        // 4. Merge with existing quotes so no item ever vanishes or flickers
        setQuotes(prev => ({
            ...DEFAULT_FALLBACK_QUOTES,
            ...prev,
            ...newQuotes
        }));

        setLastRefresh(new Date());
        setLoading(false);
    }, [items, stocks]);

    // Initial and periodic fetch
    useEffect(() => {
        fetchQuotes();
        const timer = setInterval(() => {
            fetchQuotes();
        }, 60000); // Auto-refresh every 60s
        return () => clearInterval(timer);
    }, [fetchQuotes]);

    // Filter items
    const filteredItems = useMemo(() => {
        if (activeFilter === 'portfolio') {
            return portfolioMarketItems;
        }
        if (activeFilter === 'all') {
            const existingSymbols = new Set(items.map(i => i.symbol.toUpperCase()));
            const missingPortfolioItems = portfolioMarketItems.filter(p => !existingSymbols.has(p.symbol.toUpperCase()));
            return [...items, ...missingPortfolioItems];
        }
        if (activeFilter === 'asia') {
            const asianSymbols = ['^N225', '^HSI', '000001.SS', '000300.SS', '^KS11', '^TWII', '^NSEI', '^BSESN', '^AXJO'];
            return items.filter(it => it.category === 'asia' || asianSymbols.includes(it.symbol) || it.name.toLowerCase().includes('japan') || it.name.toLowerCase().includes('china') || it.name.toLowerCase().includes('hongkong') || it.name.toLowerCase().includes('nikkei'));
        }
        if (activeFilter === 'indices') {
            return items.filter(it => it.category === 'indices' || it.category === 'asia');
        }
        if (activeFilter === 'stocks') {
            const existingSymbols = new Set(items.map(i => i.symbol.toUpperCase()));
            const missingPortfolioItems = portfolioMarketItems.filter(p => !existingSymbols.has(p.symbol.toUpperCase()));
            return [...items.filter(it => it.category === 'stocks'), ...missingPortfolioItems];
        }
        return items.filter(it => it.category === activeFilter);
    }, [items, activeFilter, portfolioMarketItems]);

    // Number format helper (German/Swiss style: 14.368,78)
    const formatNumber = (num: number | undefined, decimals = 2) => {
        if (num === undefined || isNaN(num)) return '-';
        return num.toLocaleString('de-DE', {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals
        });
    };

    // Reorder items
    const moveItem = (itemId: string, direction: 'left' | 'right') => {
        const itemIndex = items.findIndex(i => i.id === itemId);
        if (itemIndex === -1) return;
        const targetIndex = direction === 'left' ? itemIndex - 1 : itemIndex + 1;
        if (targetIndex < 0 || targetIndex >= items.length) return;
        const newArr = [...items];
        const [moved] = newArr.splice(itemIndex, 1);
        newArr.splice(targetIndex, 0, moved);
        setItems(newArr);
    };

    // Remove item
    const removeItem = (id: string) => {
        setItems(prev => prev.filter(i => i.id !== id));
    };

    // Add item
    const addItem = (item: Omit<MarketItem, 'id'>) => {
        const newItem: MarketItem = {
            id: crypto.randomUUID(),
            ...item
        };
        setItems(prev => [...prev, newItem]);
        setShowAddModal(false);
        setSearchSymbol('');
        setCustomName('');
    };

    // Reset to default
    const resetToDefault = () => {
        if (window.confirm('Marktübersicht auf Standard-Kacheln zurücksetzen?')) {
            setItems(DEFAULT_MARKET_ITEMS);
            setQuotes(DEFAULT_FALLBACK_QUOTES);
        }
    };

    return (
        <div className="w-full max-w-7xl mx-auto pb-32">
            {/* Sticky Header Section: Title, Action Buttons & Category Filter Tabs */}
            <div className="sticky top-0 z-30 bg-background/95 backdrop-blur-md px-3 sm:px-4 md:px-6 pt-2.5 sm:pt-4 pb-2 sm:pb-3 border-b border-border shadow-xs space-y-2 sm:space-y-3 mb-3 sm:mb-5 w-full">
                {/* Top Row: Title + Action Buttons */}
                <div className="flex items-center justify-between gap-2 w-full">
                    <div className="flex items-center gap-2 pl-11 xl:pl-0 min-w-0">
                        <div className="size-8 sm:size-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary shadow-inner shrink-0">
                            <Globe className="size-4 sm:size-6" />
                        </div>
                        <div className="min-w-0">
                            <h1 className="text-base sm:text-2xl md:text-3xl font-extrabold tracking-tight text-foreground truncate">
                                Marktübersicht
                            </h1>
                            <p className="text-[11px] sm:text-xs text-muted-foreground font-medium hidden md:block">
                                Rohstoffe, Währungen, Indizes &amp; Top-Märkte auf einen Blick
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                        {/* Refresh Button */}
                        <button
                            onClick={fetchQuotes}
                            disabled={loading}
                            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-xl bg-card hover:bg-muted border border-border text-xs font-semibold text-foreground transition-all shadow-xs shrink-0"
                            title="Kurse jetzt aktualisieren"
                        >
                            <RefreshCw className={cn("size-3.5 shrink-0", loading && "animate-spin text-primary")} />
                            <span className="hidden sm:inline">Aktualisieren</span>
                        </button>

                        {/* Edit Mode Toggle Button */}
                        <button
                            onClick={() => setIsEditMode(!isEditMode)}
                            className={cn(
                                "flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-xl text-xs font-bold transition-all shadow-xs border shrink-0",
                                isEditMode
                                    ? "bg-primary text-primary-foreground border-primary"
                                    : "bg-card hover:bg-muted text-foreground border-border"
                            )}
                        >
                            {isEditMode ? (
                                <>
                                    <Check className="size-3.5 shrink-0" />
                                    <span>Fertig</span>
                                </>
                            ) : (
                                <>
                                    <Edit3 className="size-3.5 shrink-0" />
                                    <span className="hidden xs:inline">Bearbeiten</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>

                {/* Second Row: Category Filter Pills & Edit Actions (Sticky with header!) */}
                <div className="flex items-center justify-between gap-2 w-full min-w-0">
                    <div className="w-full min-w-0 overflow-x-auto scroller-none py-0.5">
                        <div className="flex items-center gap-1 bg-muted/50 p-1 rounded-xl border border-border/50 w-fit">
                            {[
                                { id: 'all', label: 'Alle' },
                                { id: 'portfolio', label: `💼 Bestand (${portfolioStocks.length})` },
                                { id: 'indices', label: 'Indizes' },
                                { id: 'asia', label: '🌏 Asien' },
                                { id: 'commodities', label: 'Rohstoffe' },
                                { id: 'forex', label: 'Währungen' },
                                { id: 'stocks', label: 'Aktien / ETFs' },
                                { id: 'crypto', label: 'Krypto' },
                            ].map(tab => (
                                <button
                                    key={tab.id}
                                    onClick={() => handleTabChange(tab.id as any)}
                                    className={cn(
                                        "px-2 sm:px-3 py-1 sm:py-1.5 text-xs font-semibold rounded-lg transition-all whitespace-nowrap shrink-0",
                                        activeFilter === tab.id
                                            ? "bg-background text-foreground shadow-xs font-bold"
                                            : "text-muted-foreground hover:text-foreground hover:bg-background/40"
                                    )}
                                >
                                    {tab.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {isEditMode && (
                        <div className="flex items-center gap-1.5 shrink-0 pl-1">
                            <button
                                onClick={resetToDefault}
                                className="flex items-center gap-1 px-2 py-1 rounded-lg border border-border bg-card hover:bg-muted text-[11px] font-medium text-muted-foreground transition-colors shrink-0"
                                title="Standard-Kacheln wiederherstellen"
                            >
                                <RotateCcw className="size-3" />
                                <span className="hidden sm:inline">Standard</span>
                            </button>
                            <button
                                onClick={() => setShowAddModal(true)}
                                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-primary text-primary-foreground text-[11px] font-bold hover:bg-primary/90 transition-all shadow-xs shrink-0"
                            >
                                <Plus className="size-3" />
                                <span>Kachel hinzufügen</span>
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Padded Container for Grid and Content */}
            <div className="px-3 sm:px-4 md:px-6 space-y-4">
                {/* The Market Tiles Grid (Optimized 2 columns on iPhone & mobile, 3 columns on tablet/desktop) */}
                <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 gap-2 sm:gap-4 md:gap-5 w-full">
                    {/* Headline-Kachel: Gesamte Tagesperformance Portfolio in CHF */}
                    {(activeFilter === 'portfolio' || activeFilter === 'all') && portfolioStocks.length > 0 && (
                        <div
                            onClick={() => {
                                if (!isEditMode) navigate('/portfolio');
                            }}
                            className={cn(
                                "relative rounded-xl sm:rounded-2xl p-2 sm:p-4 md:p-5 transition-all shadow-md flex flex-col justify-between select-none overflow-hidden group min-h-[105px] sm:min-h-[150px] md:min-h-[160px] w-full min-w-0 border-2",
                                !isEditMode && "cursor-pointer hover:shadow-lg hover:brightness-105 active:scale-[0.99]",
                                isPortfolioPositive
                                    ? "bg-[#3fb78f] text-slate-950 border-emerald-700/40 shadow-emerald-950/15"
                                    : "bg-[#eb6a59] text-slate-950 border-rose-700/40 shadow-rose-950/15"
                            )}
                            title="Portfolio Tagesperformance – Klick für Positionsübersicht"
                        >
                            {/* Top: Name & CHF badge */}
                            <div className="flex items-start justify-between gap-1 min-w-0">
                                <div className="min-w-0 flex-1 flex items-center gap-1.5">
                                    <div className="size-5 sm:size-6 rounded-md bg-black/15 flex items-center justify-center shrink-0">
                                        <Wallet className="size-3 sm:size-3.5 text-slate-950" />
                                    </div>
                                    <h3 className="font-black text-[11px] sm:text-base md:text-lg tracking-tight truncate drop-shadow-xs text-slate-950 leading-tight">
                                        Tagesperformance
                                    </h3>
                                </div>
                                <span className="text-[9px] sm:text-[11px] uppercase font-black tracking-wider px-1 sm:px-1.5 py-0.5 rounded bg-black/15 text-slate-950 shrink-0 font-mono leading-none">
                                    CHF
                                </span>
                            </div>

                            {/* Center: CHF amount & total portfolio value */}
                            <div className="my-0.5 sm:my-1 text-center">
                                <div className="text-base sm:text-2xl md:text-3xl font-black tracking-tight drop-shadow-xs tabular-nums text-slate-950 leading-tight">
                                    {isPortfolioPositive ? '+' : ''}{formatNumber(portfolioDailyGain, 2)} CHF
                                </div>
                                <div className="text-xs sm:text-sm md:text-base font-bold text-slate-950/90 truncate mt-0.5 sm:mt-1">
                                    Bestand: {formatNumber(totals.totalValueStock || 0, 0)} CHF
                                </div>
                            </div>

                            {/* Bottom: % performance */}
                            <div className="flex items-center justify-center gap-1 font-black text-sm sm:text-lg md:text-xl drop-shadow-xs tabular-nums text-slate-950 leading-tight">
                                {isPortfolioPositive ? (
                                    <TrendingUp className="size-3.5 sm:size-5 shrink-0" />
                                ) : (
                                    <TrendingDown className="size-3.5 sm:size-5 shrink-0" />
                                )}
                                <span>
                                    {isPortfolioPositive ? '+' : ''}{portfolioDailyGainPercent.toFixed(2)}%
                                </span>
                            </div>
                        </div>
                    )}

                    {filteredItems.map((item) => {
                        const q = quotes[item.symbol];
                        const changePct = q?.changePercent ?? 0;
                        const isPositive = changePct >= 0;
                        const decimals = item.decimals ?? (item.symbol.includes('=X') ? 4 : 2);
                        const itemIndex = items.findIndex(i => i.id === item.id);
                        const canMoveLeft = itemIndex > 0;
                        const canMoveRight = itemIndex < items.length - 1;
                        const matchedStock = portfolioStocks.find(s => s.symbol.toUpperCase() === item.symbol.toUpperCase()) ||
                                             stocks.find(s => s.symbol.toUpperCase() === item.symbol.toUpperCase());
                        const hasShares = matchedStock && (matchedStock as any).shares > 0;
                        const shares = hasShares ? (matchedStock as any).shares : 0;
                        const changeAmountPerShare = q ? (q.changeAmount !== undefined ? q.changeAmount : (q.price - q.previousClose)) : 0;
                        const totalDayChangeNative = shares * changeAmountPerShare;
                        const currency = q?.currency || matchedStock?.currency || (
                            item.symbol.endsWith('.SW') ? 'CHF' :
                            item.symbol.endsWith('.DE') ? 'EUR' :
                            item.symbol.includes('CHF') ? 'CHF' :
                            item.symbol === '^N225' ? 'JPY' :
                            item.symbol === '^HSI' ? 'HKD' :
                            item.symbol.endsWith('.SS') || item.symbol.endsWith('.SZ') ? 'CNY' :
                            item.symbol === '^KS11' ? 'KRW' :
                            item.symbol === '^TWII' ? 'TWD' :
                            item.symbol === '^NSEI' || item.symbol === '^BSESN' ? 'INR' :
                            item.symbol === '^AXJO' ? 'AUD' :
                            item.category === 'commodities' ? 'USD' :
                            (item.symbol.startsWith('^NDX') || item.symbol.startsWith('^GSPC') || item.symbol.startsWith('^DJI')) ? 'USD' : ''
                        );
                        const totalDayChangeCHF = convertToCHF(totalDayChangeNative, currency || 'USD', rates);

                        return (
                            <div
                                key={item.id}
                                onClick={() => {
                                    if (!isEditMode) {
                                        navigate(`/stock/${encodeURIComponent(item.symbol)}?from=market-overview&tab=${encodeURIComponent(activeFilter)}&name=${encodeURIComponent(item.name)}&currency=${encodeURIComponent(currency || 'USD')}`);
                                    }
                                }}
                                className={cn(
                                    "relative rounded-xl sm:rounded-2xl p-2 sm:p-4 md:p-5 transition-all shadow-md flex flex-col justify-between select-none overflow-hidden group min-h-[105px] sm:min-h-[150px] md:min-h-[160px] w-full min-w-0",
                                    !isEditMode && "cursor-pointer hover:shadow-lg hover:brightness-105 active:scale-[0.99]",
                                    isPositive
                                        ? "bg-[#3fb78f] text-slate-950 border border-emerald-600/30 shadow-emerald-950/10"
                                        : "bg-[#eb6a59] text-slate-950 border border-rose-600/30 shadow-rose-950/10"
                                )}
                                title={isEditMode ? undefined : `${item.name} – Klick für interaktiven Chart`}
                            >
                                {/* Top: Name & Badge or Edit Buttons */}
                                <div className="flex items-start justify-between gap-1 min-w-0">
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-1 min-w-0">
                                            <h3 
                                                className="font-extrabold text-[11px] sm:text-base md:text-lg tracking-tight truncate drop-shadow-xs text-slate-950 leading-tight" 
                                                title={item.name}
                                            >
                                                {item.name}
                                            </h3>
                                            {matchedStock?.type === 'etf' && (
                                                <span className="text-[8px] sm:text-[9px] font-black uppercase tracking-wider px-1 py-0.5 rounded bg-black/20 text-slate-950 shrink-0 leading-tight">
                                                    ETF
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {isEditMode && activeFilter !== 'portfolio' ? (
                                        <div className="flex items-center gap-0.5 bg-black/65 backdrop-blur-md px-1 py-0.5 rounded-md shrink-0 shadow-xs border border-white/10">
                                            {canMoveLeft && (
                                                <button
                                                    type="button"
                                                    onClick={(e) => { e.stopPropagation(); moveItem(item.id, 'left'); }}
                                                    className="p-0.5 hover:bg-white/20 active:scale-95 rounded text-white transition-all"
                                                    title="Nach links"
                                                >
                                                    <ChevronLeft className="size-3" />
                                                </button>
                                            )}
                                            {canMoveRight && (
                                                <button
                                                    type="button"
                                                    onClick={(e) => { e.stopPropagation(); moveItem(item.id, 'right'); }}
                                                    className="p-0.5 hover:bg-white/20 active:scale-95 rounded text-white transition-all"
                                                    title="Nach rechts"
                                                >
                                                    <ChevronRight className="size-3" />
                                                </button>
                                            )}
                                            <button
                                                type="button"
                                                onClick={(e) => { e.stopPropagation(); removeItem(item.id); }}
                                                className="p-0.5 hover:bg-rose-600 active:scale-95 rounded text-rose-200 hover:text-white transition-all"
                                                title="Entfernen"
                                            >
                                                <X className="size-3" />
                                            </button>
                                        </div>
                                    ) : (
                                        currency ? (
                                            <span className="text-[9px] sm:text-[11px] uppercase font-black tracking-wider px-1 sm:px-1.5 py-0.5 rounded bg-black/15 text-slate-950 shrink-0 font-mono leading-none">
                                                {currency}
                                            </span>
                                        ) : null
                                    )}
                                </div>

                                {/* Center: Price */}
                                <div className="my-0.5 sm:my-1 text-center">
                                    <div className="text-base sm:text-2xl md:text-3xl font-black tracking-tight drop-shadow-xs tabular-nums text-slate-950 leading-tight">
                                        {q ? formatNumber(q.price, decimals) : (
                                            <span className="opacity-40 animate-pulse text-xs sm:text-xl">Laden...</span>
                                        )}
                                    </div>
                                    {hasShares && (
                                        <div className="text-xs sm:text-sm md:text-base font-bold text-slate-950/90 truncate mt-0.5 sm:mt-1">
                                            {shares} Stk.{q ? ` • ${formatNumber(shares * q.price, 0)} ${currency}` : ''}
                                        </div>
                                    )}
                                </div>

                                {/* Bottom: Change % & Daily Gain */}
                                <div className="flex flex-col items-center justify-center gap-0.5 font-black text-slate-950 leading-tight">
                                    <div className="flex items-center justify-center gap-0.5 sm:gap-1 text-sm sm:text-lg md:text-xl drop-shadow-xs tabular-nums">
                                        {q && (
                                            <>
                                                {isPositive ? (
                                                    <TrendingUp className="size-3.5 sm:size-5 shrink-0" />
                                                ) : (
                                                    <TrendingDown className="size-3.5 sm:size-5 shrink-0" />
                                                )}
                                                <span>
                                                    {isPositive ? '+' : ''}{changePct.toFixed(2)}%
                                                </span>
                                            </>
                                        )}
                                    </div>
                                    {hasShares && q && (
                                        <div className="text-[11px] sm:text-sm md:text-base font-black tracking-tight text-slate-950 truncate drop-shadow-2xs mt-0.5">
                                            {currency === 'CHF' ? (
                                                <span>{totalDayChangeNative >= 0 ? '+' : ''}{formatNumber(totalDayChangeNative, 2)} CHF</span>
                                            ) : (
                                                <span>
                                                    {totalDayChangeNative >= 0 ? '+' : ''}{formatNumber(totalDayChangeNative, 2)} {currency}
                                                    {' / '}
                                                    {totalDayChangeCHF >= 0 ? '+' : ''}{formatNumber(totalDayChangeCHF, 2)} CHF
                                                </span>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Empty State */}
                {filteredItems.length === 0 && (
                    <div className="p-8 sm:p-12 text-center rounded-2xl border border-dashed border-border/80 bg-card/40 space-y-3">
                        <p className="text-xs sm:text-sm text-muted-foreground">
                            {activeFilter === 'portfolio'
                                ? 'Noch keine Positionen im Bestand. Füge Aktien oder ETFs im Menü "Positionen" hinzu.'
                                : 'Keine Kacheln in dieser Kategorie vorhanden.'}
                        </p>
                        {activeFilter !== 'portfolio' && (
                            <button
                                onClick={() => setShowAddModal(true)}
                                className="px-4 py-2 bg-primary text-primary-foreground text-xs font-bold rounded-lg hover:bg-primary/90 transition-all"
                            >
                                + Kachel hinzufügen
                            </button>
                        )}
                    </div>
                )}

                {/* Last updated footer info */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-[11px] sm:text-xs text-muted-foreground pt-3 sm:pt-4 border-t border-border/40">
                    <span className="flex items-center gap-1.5">
                        <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
                        Live &bull; Automatische Synchronisation aktiv
                    </span>
                    {lastRefresh && (
                        <span>
                            Zuletzt aktualisiert: {lastRefresh.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </span>
                    )}
                </div>
            </div>

            {/* Add Item Modal */}
            {showAddModal && (
                <div className="fixed inset-0 z-[2100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-card border border-border rounded-2xl shadow-2xl max-w-lg w-full p-4 sm:p-5 space-y-4 animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between border-b border-border pb-3">
                            <h3 className="font-bold text-base flex items-center gap-2 text-foreground">
                                <Plus className="size-4 text-primary" />
                                Markt-Kachel hinzufügen
                            </h3>
                            <button
                                onClick={() => setShowAddModal(false)}
                                className="p-1.5 hover:bg-muted rounded-full transition-colors text-muted-foreground"
                            >
                                <X className="size-4" />
                            </button>
                        </div>

                        {/* Presets selection */}
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                                Beliebte Märkte &amp; Rohstoffe
                            </label>
                            <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto p-1 border border-border/60 rounded-xl bg-background/50">
                                {PRESET_OPTIONS.filter(p => !items.some(i => i.symbol === p.symbol)).map(preset => (
                                    <button
                                        key={preset.symbol}
                                        type="button"
                                        onClick={() => addItem(preset)}
                                        className="text-left p-2 rounded-lg bg-card hover:bg-primary/10 border border-border/60 hover:border-primary/40 transition-colors group flex flex-col"
                                    >
                                        <span className="text-xs font-bold text-foreground group-hover:text-primary truncate">
                                            {preset.name}
                                        </span>
                                        <span className="text-[10px] font-mono text-muted-foreground">
                                            {preset.symbol}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Portfolio / Watchlist Stocks */}
                        {stocks && stocks.length > 0 && (
                            <div className="space-y-2 pt-2 border-t border-border/60">
                                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                                    Aus deinem Portfolio / Watchlist
                                </label>
                                <div className="grid grid-cols-2 gap-2 max-h-36 overflow-y-auto p-1 border border-border/60 rounded-xl bg-background/50">
                                    {stocks.filter(s => !items.some(i => i.symbol === s.symbol)).map(stock => (
                                        <button
                                            key={stock.id}
                                            type="button"
                                            onClick={() => addItem({
                                                symbol: stock.symbol,
                                                name: stock.name,
                                                category: 'stocks',
                                                decimals: 2
                                            })}
                                            className="text-left p-2 rounded-lg bg-card hover:bg-primary/10 border border-border/60 hover:border-primary/40 transition-colors group flex flex-col"
                                        >
                                            <span className="text-xs font-bold text-foreground group-hover:text-primary truncate">
                                                {stock.name}
                                            </span>
                                            <span className="text-[10px] font-mono text-muted-foreground">
                                                {stock.symbol}
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Custom Symbol Form */}
                        <div className="space-y-3 pt-2 border-t border-border/60">
                            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                                Eigenes Symbol eingeben
                            </label>
                            <div className="grid grid-cols-2 gap-2">
                                <div className="space-y-1">
                                    <label className="text-[11px] font-semibold text-muted-foreground">Yahoo Symbol*</label>
                                    <input
                                        type="text"
                                        placeholder="z.B. AAPL, ^GDAXI, CL=F..."
                                        value={searchSymbol}
                                        onChange={(e) => setSearchSymbol(e.target.value.toUpperCase())}
                                        className="w-full p-2 rounded-lg border border-border bg-background text-xs font-mono focus:ring-1 focus:ring-primary uppercase"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[11px] font-semibold text-muted-foreground">Name / Label (optional)</label>
                                    <input
                                        type="text"
                                        placeholder="z.B. Apple, DAX..."
                                        value={customName}
                                        onChange={(e) => setCustomName(e.target.value)}
                                        className="w-full p-2 rounded-lg border border-border bg-background text-xs focus:ring-1 focus:ring-primary"
                                    />
                                </div>
                            </div>
                            <div className="space-y-1">
                                <label className="text-[11px] font-semibold text-muted-foreground">Kategorie</label>
                                <select
                                    value={customCategory}
                                    onChange={(e) => setCustomCategory(e.target.value as any)}
                                    className="w-full p-2 rounded-lg border border-border bg-background text-xs focus:ring-1 focus:ring-primary"
                                >
                                    <option value="indices">Indizes</option>
                                    <option value="asia">Asien (Asiatische Märkte)</option>
                                    <option value="commodities">Rohstoffe</option>
                                    <option value="forex">Währungen</option>
                                    <option value="stocks">Aktien / ETFs</option>
                                    <option value="crypto">Krypto</option>
                                </select>
                            </div>
                        </div>

                        <div className="flex justify-end gap-2 pt-2 border-t border-border">
                            <button
                                type="button"
                                onClick={() => setShowAddModal(false)}
                                className="px-4 py-2 text-xs font-medium text-muted-foreground hover:bg-muted rounded-lg transition-colors"
                            >
                                Schließen
                            </button>
                            <button
                                type="button"
                                disabled={!searchSymbol.trim()}
                                onClick={() => {
                                    if (searchSymbol.trim()) {
                                        let sym = searchSymbol.trim().toUpperCase();
                                        let cat = customCategory;
                                        let name = customName.trim();
                                        let dec = cat === 'forex' || sym.includes('=X') ? 4 : 2;

                                        // Auto-normalize crypto abbreviations to CHF
                                        if (sym === 'BTC' || sym === 'BITCOIN') {
                                            sym = 'BTC-CHF';
                                            cat = 'crypto';
                                            dec = 0;
                                            if (!name) name = 'Bitcoin (CHF)';
                                        } else if (sym === 'ETH' || sym === 'ETHEREUM' || sym === 'EUTERIUM' || sym === 'ETHERIUM') {
                                            sym = 'ETH-CHF';
                                            cat = 'crypto';
                                            dec = 2;
                                            if (!name) name = 'Ethereum (CHF)';
                                        } else if (sym === 'SOL' || sym === 'SOLANA') {
                                            sym = 'SOL-USD';
                                            cat = 'crypto';
                                            dec = 2;
                                            if (!name) name = 'Solana (USD)';
                                        }

                                        // Auto-normalize forex pairs (e.g. GBP/CHF, EUR/CHF, etc.)
                                        const cleanForex = sym.replace(/[\/\-\s]/g, '');
                                        if (cleanForex === 'GBPCHF') {
                                            sym = 'GBPCHF=X';
                                            cat = 'forex';
                                            dec = 4;
                                            if (!name) name = 'GBP/CHF';
                                        } else if (cleanForex === 'CHFGBP') {
                                            sym = 'CHFGBP=X';
                                            cat = 'forex';
                                            dec = 4;
                                            if (!name) name = 'CHF/GBP';
                                        } else if (cleanForex === 'EURCHF') {
                                            sym = 'EURCHF=X';
                                            cat = 'forex';
                                            dec = 4;
                                            if (!name) name = 'EUR/CHF';
                                        } else if (cleanForex === 'CHFEUR') {
                                            sym = 'CHFEUR=X';
                                            cat = 'forex';
                                            dec = 4;
                                            if (!name) name = 'CHF/EUR';
                                        } else if (cleanForex === 'USDCHF') {
                                            sym = 'USDCHF=X';
                                            cat = 'forex';
                                            dec = 4;
                                            if (!name) name = 'USD/CHF';
                                        } else if (cleanForex === 'CHFUSD') {
                                            sym = 'CHFUSD=X';
                                            cat = 'forex';
                                            dec = 4;
                                            if (!name) name = 'CHF/USD';
                                        }

                                        addItem({
                                            symbol: sym,
                                            name: name || sym,
                                            category: cat,
                                            decimals: dec
                                        });
                                    }
                                }}
                                className="px-4 py-2 text-xs font-bold bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors shadow-sm"
                            >
                                Hinzufügen
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
