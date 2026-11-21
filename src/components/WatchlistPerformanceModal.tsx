import { StockName } from './StockName';
import { ArrowLeft, TrendingUp, RefreshCw, ShoppingBag, Trophy, Flame, Target, ChevronUp, ChevronDown, TrendingDown, PieChart, Layers, Telescope, Info, BookOpen, X, Star } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useEffect, useState, useMemo } from 'react';
import { useCurrencyFormatter } from '../utils/currency';
import { cn } from '../utils';
import { Logo } from './Logo';
import { AddToWatchlistModal } from './AddToWatchlistModal';
import { estimateMarketState, hasMarketOpenedToday, isAnyStockMarketActiveToday, getMarketOpeningTimeHint } from '../utils/market';
import { usePortfolio } from '../context/PortfolioContext';
import { fetchMultipleHistoricalCloses, type HistoricalRange } from '../services/yahoo-finance';
import { computeSmartAutoParams, applyRiskModeParams, calculateDcfFairValue, isEtfAsset } from '../utils/fairValue';

export type WatchlistPeriod = '1D' | HistoricalRange | 'BUY';
type SortKey = 'rank' | 'name' | 'dividend' | 'price' | 'gain' | 'dailyChf' | 'fairValue' | 'gap' | 'total';
type OpportunityFilter = 'all' | 'undervalued' | 'limitReached';
const RETURN_STATE_KEY = 'watchlist_perf_return_state_v1';

const PERIOD_CONFIG: { key: WatchlistPeriod; label: string; shortLabel: string; hint: string }[] = [
    { key: '1D', label: 'Heute', shortLabel: 'Heute', hint: 'Live Tag' },
    { key: '1W', label: '1 Woche', shortLabel: '1 W', hint: '7 Tage' },
    { key: '1M', label: '1 Monat', shortLabel: '1 M', hint: '30 Tage' },
    { key: '3M', label: '3 Monate', shortLabel: '3 M', hint: 'Quartal' },
    { key: '6M', label: '6 Monate', shortLabel: '6 M', hint: 'Halbjahr' },
    { key: '1Y', label: '1 Jahr', shortLabel: '1 J', hint: '12 Monate' },
    { key: '3Y', label: '3 Jahre', shortLabel: '3 J', hint: '36 Monate' },
    { key: '5Y', label: '5 Jahre', shortLabel: '5 J', hint: '60 Monate' },
    { key: 'BUY', label: 'Seit Kauf', shortLabel: 'SK', hint: 'Seit Kauf / Ø Kaufpreis' }
];

interface WatchlistPerformanceModalProps {
    isOpen: boolean;
    onClose: () => void;
    activeWatchlistId?: string;
    initialPeriod?: WatchlistPeriod;
    initialAssetFilter?: 'all' | 'stock' | 'etf';
}

export function WatchlistPerformanceModal({
    isOpen,
    onClose,
    activeWatchlistId,
    initialPeriod = '1D',
    initialAssetFilter = 'stock'
}: WatchlistPerformanceModalProps) {
    const { convertToCHF, formatCurrency, rates } = useCurrencyFormatter();
    const { stocks, watchlists, positions, orderBook, refreshAllPrices, isGlobalRefreshing, lastGlobalRefresh } = usePortfolio();
    const navigate = useNavigate();

    const [selectedPeriod, setSelectedPeriod] = useState<WatchlistPeriod>(initialPeriod);
    const [periodData, setPeriodData] = useState<Record<string, { baselinePrice: number; gainPercent: number; startDate: string }>>({});
    const [isLoadingPeriod, setIsLoadingPeriod] = useState<boolean>(false);

    // Sorting config
    const [sortConfig, setSortConfig] = useState<{
        key: SortKey;
        direction: 'asc' | 'desc';
    }>({ key: 'gain', direction: 'desc' });

    const [opportunityFilter, setOpportunityFilter] = useState<OpportunityFilter>('all');
    const [showGuide, setShowGuide] = useState(false);
    const [watchlistModalStockId, setWatchlistModalStockId] = useState<string | null>(null);

    useEffect(() => {
        if (!showGuide) return;
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setShowGuide(false);
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [showGuide]);

    // Sync initialPeriod if prop changes
    useEffect(() => {
        if (initialPeriod) {
            setSelectedPeriod(initialPeriod);
        }
    }, [initialPeriod]);

    const [currentWatchlistId, setCurrentWatchlistId] = useState(activeWatchlistId || 'owned');

    useEffect(() => {
        if (activeWatchlistId) {
            setCurrentWatchlistId(activeWatchlistId);
        }
    }, [activeWatchlistId]);

    // Get stock IDs based on the active watchlist
    const activeWatchlist = currentWatchlistId && currentWatchlistId !== 'owned' && currentWatchlistId !== 'orders'
        ? watchlists.find(w => w.id === currentWatchlistId)
        : null;

    const watchlistStockIds = useMemo(() => {
        if (currentWatchlistId === 'owned' || !currentWatchlistId) {
            return stocks
                .filter(s => positions.some(p => String(p.stockId) === String(s.id)))
                .map(s => s.id);
        }
        if (currentWatchlistId === 'orders') {
            const openOrdersList = (orderBook || []).filter(o => o.status === 'open');
            const openOrderSymbols = new Set(openOrdersList.map(o => o.stockSymbol.toLowerCase()));
            const openOrderIds = new Set(openOrdersList.filter(o => o.stockId).map(o => String(o.stockId)));
            const openOrderIsins = new Set(openOrdersList.filter(o => o.stockIsin).map(o => o.stockIsin!.toLowerCase()));
            return stocks
                .filter(s =>
                    openOrderSymbols.has(s.symbol.toLowerCase()) ||
                    openOrderIds.has(String(s.id)) ||
                    (s.isin && openOrderIsins.has(s.isin.toLowerCase()))
                )
                .map(s => s.id);
        }
        if (activeWatchlist) {
            return activeWatchlist.stockIds || [];
        }
        const defaultWatchlist = watchlists.find(w => w.isDefault) || watchlists[0];
        return defaultWatchlist?.stockIds || [];
    }, [currentWatchlistId, activeWatchlist, stocks, positions, watchlists, orderBook]);

    // Determine active tab name for the subtitle
    const activeTabName = currentWatchlistId === 'owned'
        ? 'Bestand'
        : currentWatchlistId === 'orders'
            ? 'Aufträge'
            : activeWatchlist?.name || 'Alle Aktien';

    const orderedModalTabs = useMemo(() => {
        const all: Array<{ id: string; name: string }> = [
            { id: 'owned', name: 'Bestand' },
            { id: 'orders', name: 'Aufträge' },
            ...watchlists.map(w => ({ id: w.id, name: w.name }))
        ];
        try {
            const saved = localStorage.getItem('watchlist_tab_order_v1');
            if (saved) {
                const parsed = JSON.parse(saved);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    const map = new Map(all.map(t => [t.id, t]));
                    const res: Array<{ id: string; name: string }> = [];
                    parsed.forEach(id => {
                        const it = map.get(id);
                        if (it) {
                            res.push(it);
                            map.delete(id);
                        }
                    });
                    if (map.has('orders')) {
                        const oIdx = res.findIndex(t => t.id === 'owned');
                        const oItem = map.get('orders')!;
                        map.delete('orders');
                        if (oIdx !== -1) res.splice(oIdx + 1, 0, oItem);
                        else res.push(oItem);
                    }
                    map.forEach(it => res.push(it));
                    return res;
                }
            }
        } catch (e) {
            console.error('Error loading tab order in modal', e);
        }
        return [
            { id: 'owned', name: 'Bestand' },
            { id: 'orders', name: 'Aufträge' },
            ...watchlists.filter(w => !w.isDefault).map(w => ({ id: w.id, name: w.name })),
            ...watchlists.filter(w => w.isDefault).map(w => ({ id: w.id, name: w.name }))
        ];
    }, [watchlists]);

    const isAnyActiveToday = isAnyStockMarketActiveToday(
        stocks.map(s => ({ symbol: s.symbol, currency: s.currency }))
    );

    const relevantStocks = useMemo(() => {
        const idSet = new Set(watchlistStockIds);
        return stocks.filter(s => idSet.has(s.id));
    }, [stocks, watchlistStockIds]);

    const relevantSymbolsKey = useMemo(() => {
        return relevantStocks.map(s => s.symbol).sort().join(',');
    }, [relevantStocks]);

    const [assetFilter, setAssetFilter] = useState<'all' | 'stock' | 'etf'>(() => initialAssetFilter);

    useEffect(() => {
        if (initialAssetFilter) {
            setAssetFilter(initialAssetFilter);
        }
    }, [initialAssetFilter]);

    // Restore tab, period & filters when returning from StockDetail or FairValueCalculator
    useEffect(() => {
        if (!isOpen) return;
        try {
            const raw = sessionStorage.getItem(RETURN_STATE_KEY);
            if (raw) {
                sessionStorage.removeItem(RETURN_STATE_KEY);
                const parsed = JSON.parse(raw);
                if (parsed.tab) setCurrentWatchlistId(parsed.tab);
                if (parsed.period) setSelectedPeriod(parsed.period);
                if (parsed.assetFilter) setAssetFilter(parsed.assetFilter);
                if (parsed.opportunityFilter) setOpportunityFilter(parsed.opportunityFilter);
            }
        } catch {
            // ignore
        }
    }, [isOpen]);

    const stockCount = useMemo(() => relevantStocks.filter(s => !s.type || s.type === 'stock').length, [relevantStocks]);
    const etfCount = useMemo(() => relevantStocks.filter(s => s.type === 'etf').length, [relevantStocks]);

    // Filter stocks based on assetFilter
    const filteredStocks = useMemo(() => {
        if (stockCount > 0 && etfCount > 0) {
            if (assetFilter === 'stock') {
                return relevantStocks.filter(s => !s.type || s.type === 'stock');
            }
            if (assetFilter === 'etf') {
                return relevantStocks.filter(s => s.type === 'etf');
            }
        }
        return relevantStocks;
    }, [relevantStocks, assetFilter, stockCount, etfCount]);

    // Fetch historical data for periods other than '1D' and 'BUY'
    useEffect(() => {
        if (!isOpen || selectedPeriod === '1D' || selectedPeriod === 'BUY' || relevantStocks.length === 0) {
            setIsLoadingPeriod(false);
            return;
        }

        let isCancelled = false;

        async function loadHistoricalData() {
            setIsLoadingPeriod(true);
            setPeriodData({});
            try {
                const symbols = relevantStocks.map(s => s.symbol).filter(Boolean);
                const range = selectedPeriod as HistoricalRange;
                const histMap = await fetchMultipleHistoricalCloses(symbols, range);

                if (isCancelled) return;

                const newMap: Record<string, { baselinePrice: number; gainPercent: number; startDate: string }> = {};

                for (const stock of relevantStocks) {
                    const h = histMap[stock.symbol.toUpperCase()];
                    if (h && h.close > 0) {
                        const cur = stock.currentPrice || h.close;
                        const gainPct = ((cur - h.close) / h.close) * 100;
                        newMap[stock.id] = {
                            baselinePrice: h.close,
                            gainPercent: gainPct,
                            startDate: h.startDate
                        };
                    }
                }

                setPeriodData(newMap);
            } catch (err) {
                console.error('[WatchlistPerformanceModal] Error loading period data:', err);
            } finally {
                if (!isCancelled) {
                    setIsLoadingPeriod(false);
                }
            }
        }

        loadHistoricalData();

        return () => {
            isCancelled = true;
        };
    }, [isOpen, selectedPeriod, relevantSymbolsKey]);

    // Enrich stock data
    const enrichedData = useMemo(() => {
        let fvMap: Record<string, any> = {};
        try {
            const raw = localStorage.getItem('fair_value_params_map');
            if (raw) fvMap = JSON.parse(raw);
        } catch {
            // ignore
        }

        return filteredStocks.map(stock => {
            const directPos = positions.find(p => String(p.stockId) === String(stock.id));
            const matchedPos = directPos || positions.find(p => {
                const pStock = stocks.find(s => String(s.id) === String(p.stockId));
                if (!pStock) return false;
                if (stock.isin && pStock.isin && stock.isin.trim().toUpperCase() === pStock.isin.trim().toUpperCase()) {
                    return true;
                }
                if (isEtfAsset(stock) && isEtfAsset(pStock) && stock.symbol && pStock.symbol) {
                    return stock.symbol.split('.')[0].toUpperCase() === pStock.symbol.split('.')[0].toUpperCase();
                }
                return false;
            });
            const pos = matchedPos;
            const posStock = pos
                ? (stocks.find(s => String(s.id) === String(pos.stockId)) || stock)
                : stock;
            const matchedViaSymbol = (pos && !directPos) ? posStock.symbol : undefined;

            const hasOpenedToday = hasMarketOpenedToday(stock.symbol, stock.currency);
            const shouldCalcDaily = !isAnyActiveToday || hasOpenedToday;

            // Daily 1D
            let dailyChange = 0;
            let dailyGainPercent = 0;
            let dailyGainCHF = 0;

            if (shouldCalcDaily) {
                dailyChange = stock.currentPrice - (stock.previousClose || stock.currentPrice);
                dailyGainPercent = stock.previousClose ? (dailyChange / stock.previousClose) * 100 : 0;
                const posDailyChange = posStock.currentPrice - (posStock.previousClose || posStock.currentPrice);
                dailyGainCHF = pos ? posDailyChange * pos.shares : 0;
            }

            // Period Data (1W, 1M, 3M, 6M, 1Y, 3Y, 5Y, BUY)
            const pData = periodData[stock.id];
            const isPeriod = selectedPeriod !== '1D';
            const isBuyMode = selectedPeriod === 'BUY';

            const earliestPurchaseDate = (() => {
                if (!pos) return undefined;
                const dates = (pos.purchases || [])
                    .map((p: any) => p.date)
                    .filter(Boolean)
                    .sort((a: string, b: string) => new Date(a).getTime() - new Date(b).getTime());
                return dates[0] || pos.buyDate;
            })();

            const buyPriceAvg = pos?.buyPriceAvg && pos.buyPriceAvg > 0 ? pos.buyPriceAvg : 0;
            const buyModeGainPercent = (buyPriceAvg > 0 && posStock.currentPrice > 0)
                ? ((posStock.currentPrice - buyPriceAvg) / buyPriceAvg) * 100
                : 0;

            const effectiveGainPercent = isBuyMode
                ? buyModeGainPercent
                : isPeriod
                    ? (pData?.gainPercent ?? 0)
                    : dailyGainPercent;
            const baselinePrice = isBuyMode
                ? (buyPriceAvg || posStock.currentPrice)
                : isPeriod
                    ? (pData?.baselinePrice ?? stock.currentPrice)
                    : (stock.previousClose || stock.currentPrice);
            const resolvedStartDate = isBuyMode ? earliestPurchaseDate : pData?.startDate;

            // Total Performance if owned (FX-aware, always using the actual held posStock)
            let totalGainPercent = 0;
            let totalGainCHF = 0;
            if (pos) {
                const currentValue = pos.shares * posStock.currentPrice;
                const purchaseValue = (pos.purchases && pos.purchases.length > 0)
                    ? pos.purchases.reduce((sum: number, purchase: any) => sum + (purchase.shares * purchase.price), 0)
                    : (pos.shares * (pos.buyPriceAvg || 0));
                const currentValueCHF = convertToCHF(currentValue, posStock.currency);
                const entryFxRate = pos.averageEntryFxRate || 1;
                const purchaseValueCHF = posStock.currency !== 'CHF'
                    ? purchaseValue * entryFxRate
                    : purchaseValue;
                totalGainCHF = currentValueCHF - purchaseValueCHF;
                totalGainPercent = purchaseValueCHF > 0 ? (totalGainCHF / purchaseValueCHF) * 100 : 0;
            }

            // Fair Value & Mode (A / B / C / Manuell) - aligned with StockDetail.tsx
            const symKey = (stock.symbol || '').toUpperCase();
            const localParams = symKey ? fvMap[symKey] : null;
            const stockParams = stock.fairValueParams;
            let activeParams = stockParams || localParams;
            if (localParams && stockParams) {
                const localTime = localParams.updatedAt ? new Date(localParams.updatedAt).getTime() : 0;
                const stockTime = stockParams.updatedAt ? new Date(stockParams.updatedAt).getTime() : 0;
                activeParams = localTime >= stockTime ? localParams : stockParams;
            }

            const effectivePrice = stock.currentPrice || 1;
            const smartConservative = computeSmartAutoParams(
                { price: effectivePrice, dividendYield: stock.dividendYield },
                null,
                stock,
                symKey,
                'conservative',
                rates
            );
            const smartQuality = computeSmartAutoParams(
                { price: effectivePrice, dividendYield: stock.dividendYield },
                null,
                stock,
                symKey,
                'quality',
                rates
            );
            const smartRisk = applyRiskModeParams(smartConservative);

            const savedTargetPriceType = stock.targetPriceType;
            let fairValueMode: 'conservative' | 'quality' | 'risk' | 'manual' = 'conservative';
            if (activeParams?.valuationMode === 'quality') {
                fairValueMode = 'quality';
            } else if (activeParams?.valuationMode === 'risk') {
                fairValueMode = 'risk';
            } else if (activeParams?.valuationMode === 'conservative') {
                fairValueMode = 'conservative';
            } else if (activeParams?.valuationMode === 'manual' || activeParams?.isCustom) {
                fairValueMode = 'manual';
            } else if (savedTargetPriceType === 'quality' || savedTargetPriceType === 'risk' || savedTargetPriceType === 'conservative') {
                fairValueMode = savedTargetPriceType;
            } else if (savedTargetPriceType === 'manual') {
                fairValueMode = 'manual';
            }

            const isEtfItem = Boolean(smartConservative.isEtf);
            const withHorizon = <T extends { pe: number; pe5?: number; pe10?: number }>(smart: T): T =>
                activeParams?.peHorizon === '5Y' && smart.pe5
                    ? { ...smart, pe: smart.pe5 }
                    : smart;

            let fairValue = 0;
            if (fairValueMode === 'manual') {
                const manualDcf = (activeParams && Number(activeParams.eps) > 0)
                    ? calculateDcfFairValue(activeParams, effectivePrice)
                    : null;
                fairValue = (activeParams?.manualFairValue && Number(activeParams.manualFairValue) > 0)
                    ? Number(activeParams.manualFairValue)
                    : (manualDcf ? manualDcf.fairValue : (stock.fairValue || 0));
            } else if (fairValueMode === 'quality') {
                const qParams = (!isEtfItem && activeParams?.valuationMode === 'quality' && !activeParams?.isCustom && Number(activeParams?.eps) > 0)
                    ? activeParams
                    : withHorizon(smartQuality);
                fairValue = calculateDcfFairValue(qParams, effectivePrice).fairValue;
            } else if (fairValueMode === 'risk') {
                const rParams = (!isEtfItem && activeParams?.valuationMode === 'risk' && !activeParams?.isCustom && Number(activeParams?.eps) > 0)
                    ? activeParams
                    : withHorizon(smartRisk);
                fairValue = calculateDcfFairValue(rParams, effectivePrice).fairValue;
            } else {
                const cParams = (!isEtfItem && activeParams?.valuationMode === 'conservative' && !activeParams?.isCustom && Number(activeParams?.eps) > 0)
                    ? activeParams
                    : withHorizon(smartConservative);
                fairValue = calculateDcfFairValue(cParams, effectivePrice).fairValue;
            }

            const fairValueGap = (fairValue > 0 && stock.currentPrice > 0)
                ? ((stock.currentPrice - fairValue) / fairValue) * 100
                : null;
            const isUndervalued = fairValueGap !== null && fairValueGap <= 0;

            const targetPrice = stock.targetPrice;
            const targetPriceMode: 'conservative' | 'quality' | 'risk' | 'manual' | 'fairValue' =
                savedTargetPriceType || fairValueMode;
            const buyGap = targetPrice ? ((stock.currentPrice - targetPrice) / targetPrice * 100) : null;
            const isLimitReached = buyGap !== null && buyGap <= 0;
            const isNearLimit = buyGap !== null && buyGap > 0 && buyGap <= 5;

            // Dividend yield (%) with CHF-converted fallback from dividendAmount
            const freqFactor = stock.dividendFrequency === 'quarterly'
                ? 4
                : stock.dividendFrequency === 'semi-annually'
                    ? 2
                    : stock.dividendFrequency === 'monthly'
                        ? 12
                        : stock.dividendFrequency === 'none'
                            ? 0
                            : 1;
            const annualPayout = (stock.dividendAmount && stock.dividendAmount > 0 && freqFactor > 0)
                ? stock.dividendAmount * freqFactor
                : 0;
            const divCurrency = stock.dividendCurrency || stock.currency;
            const annualPayoutCHF = annualPayout > 0 ? convertToCHF(annualPayout, divCurrency) : 0;
            const priceCHF = stock.currentPrice > 0 ? convertToCHF(stock.currentPrice, stock.currency) : 0;
            const computedDividendYield = (annualPayoutCHF > 0 && priceCHF > 0)
                ? (annualPayoutCHF / priceCHF) * 100
                : 0;
            const dividendYield = (stock.dividendYield && stock.dividendYield > 0)
                ? stock.dividendYield
                : computedDividendYield;

            const dailyGainChfConverted = pos ? convertToCHF(dailyGainCHF, posStock.currency) : null;
            const hasPeriodData = !isPeriod || isBuyMode || Boolean(pData);
            const periodGainChfConverted = (() => {
                if (!pos) return null;
                if (isBuyMode) return totalGainCHF;
                if (!isPeriod) return dailyGainChfConverted;
                if (!pData) return null;
                return convertToCHF((stock.currentPrice - baselinePrice) * pos.shares, stock.currency);
            })();

            return {
                stock,
                pos,
                isOwned: !!pos,
                matchedViaSymbol,
                dailyChange,
                dailyGainPercent,
                dailyGainCHF,
                dailyGainChfConverted,
                periodGainChfConverted,
                baselinePrice,
                baselineCurrency: isBuyMode ? posStock.currency : stock.currency,
                effectiveGainPercent,
                hasPeriodData,
                periodStartDate: resolvedStartDate,
                totalGainPercent,
                totalGainCHF,
                dividendYield,
                fairValue,
                fairValueMode,
                fairValueGap,
                isUndervalued,
                targetPrice,
                targetPriceMode,
                buyGap,
                isLimitReached,
                isNearLimit
            };
        });
    }, [filteredStocks, stocks, positions, periodData, selectedPeriod, isAnyActiveToday, convertToCHF]);

    const hasAnyOwnedInTab = useMemo(
        () => enrichedData.some(d => d.isOwned),
        [enrichedData]
    );

    // Reset 'BUY' (Seit Kauf) period if the active tab has no owned stocks/ETFs
    useEffect(() => {
        if (currentWatchlistId !== 'owned' && !hasAnyOwnedInTab && selectedPeriod === 'BUY') {
            setSelectedPeriod('1M');
        }
    }, [currentWatchlistId, hasAnyOwnedInTab, selectedPeriod]);

    const undervaluedCount = useMemo(
        () => enrichedData.filter(d => d.isUndervalued).length,
        [enrichedData]
    );
    const limitReachedCount = useMemo(
        () => enrichedData.filter(d => d.isLimitReached).length,
        [enrichedData]
    );

    const displayData = useMemo(() => {
        if (opportunityFilter === 'undervalued') {
            return enrichedData.filter(d => d.isUndervalued);
        }
        if (opportunityFilter === 'limitReached') {
            return enrichedData.filter(d => d.isLimitReached);
        }
        return enrichedData;
    }, [enrichedData, opportunityFilter]);

    // Sorting
    const sortedData = useMemo(() => {
        const groupOpenFirst = selectedPeriod === '1D' && (sortConfig.key === 'gain' || sortConfig.key === 'rank');
        return [...displayData].sort((a, b) => {
            if (groupOpenFirst) {
                const stateA = estimateMarketState(a.stock.symbol, a.stock.currency);
                const stateB = estimateMarketState(b.stock.symbol, b.stock.currency);
                const isOpenA = stateA === 'REGULAR';
                const isOpenB = stateB === 'REGULAR';

                if (isOpenA !== isOpenB) {
                    return isOpenA ? -1 : 1;
                }
            }

            const dir = sortConfig.direction === 'desc' ? -1 : 1;
            if (sortConfig.key === 'gain' || sortConfig.key === 'rank') {
                if (selectedPeriod === 'BUY') {
                    if (!a.isOwned && !b.isOwned) return a.stock.name.localeCompare(b.stock.name);
                    if (!a.isOwned) return 1;
                    if (!b.isOwned) return -1;
                }
                return (a.effectiveGainPercent - b.effectiveGainPercent) * dir;
            }
            if (sortConfig.key === 'dailyChf') {
                if (a.dailyGainChfConverted === null && b.dailyGainChfConverted === null) return 0;
                if (a.dailyGainChfConverted === null) return 1;
                if (b.dailyGainChfConverted === null) return -1;
                return (a.dailyGainChfConverted - b.dailyGainChfConverted) * dir;
            }
            if (sortConfig.key === 'dividend') {
                const aHas = a.dividendYield > 0;
                const bHas = b.dividendYield > 0;
                if (!aHas && !bHas) return 0;
                if (!aHas) return 1;
                if (!bHas) return -1;
                return (a.dividendYield - b.dividendYield) * dir;
            }
            if (sortConfig.key === 'price') {
                return (a.stock.currentPrice - b.stock.currentPrice) * dir;
            }
            if (sortConfig.key === 'name') {
                return a.stock.name.localeCompare(b.stock.name) * dir;
            }
            if (sortConfig.key === 'fairValue') {
                if (a.fairValueGap === null && b.fairValueGap === null) return 0;
                if (a.fairValueGap === null) return 1;
                if (b.fairValueGap === null) return -1;
                return (a.fairValueGap - b.fairValueGap) * dir;
            }
            if (sortConfig.key === 'gap') {
                if (a.buyGap === null && b.buyGap === null) return 0;
                if (a.buyGap === null) return 1;
                if (b.buyGap === null) return -1;
                return (a.buyGap - b.buyGap) * dir;
            }
            if (sortConfig.key === 'total') {
                if (!a.isOwned && !b.isOwned) return 0;
                if (!a.isOwned) return 1;
                if (!b.isOwned) return -1;
                return (a.totalGainPercent - b.totalGainPercent) * dir;
            }
            return (a.effectiveGainPercent - b.effectiveGainPercent) * dir;
        });
    }, [displayData, sortConfig, selectedPeriod]);

    // Key statistics for the selected period
    const stats = useMemo(() => {
        const statsSource = selectedPeriod === 'BUY'
            ? displayData.filter(d => d.isOwned)
            : displayData;
        if (statsSource.length === 0) return null;

        const sortedByGain = [...statsSource].sort((a, b) => b.effectiveGainPercent - a.effectiveGainPercent);
        const best = sortedByGain[0];
        const worst = sortedByGain[sortedByGain.length - 1];

        const sumGains = statsSource.reduce((sum, d) => sum + d.effectiveGainPercent, 0);
        const avgGain = sumGains / statsSource.length;
        const winners = statsSource.filter(d => d.effectiveGainPercent > 0.005).length;
        const losers = statsSource.filter(d => d.effectiveGainPercent < -0.005).length;

        const ownedItems = displayData.filter(d => d.isOwned && d.periodGainChfConverted !== null);
        const ownedCount = ownedItems.length;
        const totalPeriodChf = ownedItems.reduce((sum, d) => sum + (d.periodGainChfConverted || 0), 0);

        // Max abs gain for relative visual progress bar
        const maxAbsGain = Math.max(
            ...statsSource.map(d => Math.abs(d.effectiveGainPercent)),
            1
        );

        return {
            best,
            worst,
            avgGain,
            winners,
            losers,
            maxAbsGain,
            ownedCount,
            totalPeriodChf
        };
    }, [displayData, selectedPeriod]);

    const handleSort = (key: SortKey) => {
        setSortConfig(prev => {
            if (prev.key === key) {
                return { key, direction: prev.direction === 'desc' ? 'asc' : 'desc' };
            }
            const defaultAsc = key === 'name' || key === 'fairValue' || key === 'gap';
            return { key, direction: defaultAsc ? 'asc' : 'desc' };
        });
    };

    const saveReturnState = () => {
        try {
            sessionStorage.setItem(RETURN_STATE_KEY, JSON.stringify({
                tab: currentWatchlistId,
                period: selectedPeriod,
                assetFilter,
                opportunityFilter
            }));
        } catch {
            // ignore
        }
    };

    const handleRowClick = (stockId: string) => {
        saveReturnState();
        navigate(`/stock/${stockId}?from=watchlist-performance`);
        onClose();
    };

    const handleFairValueClick = (e: React.MouseEvent, stock: { id: string; symbol?: string }) => {
        e.stopPropagation();
        saveReturnState();
        navigate(`/fair-value?stock=${encodeURIComponent(String(stock.symbol || stock.id))}&from=watchlist-performance`);
        onClose();
    };

    if (!isOpen) return null;

    const isPeriodMode = selectedPeriod !== '1D';
    const activePeriodMeta = PERIOD_CONFIG.find(p => p.key === selectedPeriod) || PERIOD_CONFIG[0];

    return (
        <>
        {/* Anleitung & Info Modal */}
        {showGuide && (
            <div
                className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in"
                onClick={() => setShowGuide(false)}
            >
                <div
                    className="bg-card border border-border rounded-2xl shadow-2xl max-w-2xl w-full max-h-[88vh] overflow-y-auto overflow-x-hidden flex flex-col animate-in zoom-in-95 duration-200"
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="p-5 border-b border-border flex items-center justify-between sticky top-0 bg-card z-10">
                        <div className="flex items-center gap-3">
                            <div className="size-10 rounded-xl bg-blue-500/15 border border-blue-500/25 flex items-center justify-center text-blue-500 shrink-0">
                                <BookOpen className="size-5" />
                            </div>
                            <div>
                                <h2 className="text-lg font-bold text-foreground">Anleitung · Watchlist Performance</h2>
                                <p className="text-xs text-muted-foreground">Erklärung zu Zeiträumen, Badges, Farben, Filtern & Navigation</p>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={() => setShowGuide(false)}
                            className="p-2 hover:bg-muted rounded-full transition-colors text-muted-foreground hover:text-foreground cursor-pointer"
                            aria-label="Schliessen"
                        >
                            <X className="size-5" />
                        </button>
                    </div>

                    <div className="p-5 space-y-4 text-xs leading-relaxed">
                        {/* 1. Zeiträume & Startkurs */}
                        <div className="p-4 rounded-xl bg-muted/30 border border-border/60 space-y-2">
                            <h3 className="font-bold text-sm text-foreground flex items-center gap-2">
                                <TrendingUp className="size-4 text-blue-500 shrink-0" />
                                Zeiträume, Startkurs & Depot-Summe
                            </h3>
                            <ul className="space-y-1.5 text-muted-foreground">
                                <li><strong className="text-foreground">Heute:</strong> Zeigt Live-Tagesveränderung in <strong className="text-foreground">Tag %</strong> und für eigene Positionen zusätzlich <strong className="text-foreground">Tag CHF</strong>.</li>
                                <li><strong className="text-foreground">1 Woche bis 5 Jahre:</strong> Berechnet die Rendite ab dem eingeblendeten <strong className="text-foreground">Startkurs</strong> inkl. Startdatum darunter. 1 Woche und 1 Monat verwenden 15-Minuten-Daten, identisch zum Kurschart.</li>
                                <li><strong className="text-foreground">Seit Kauf · SK</strong> <span className="text-foreground/75">nur im Tab Bestand</span>: Vergleicht den aktuellen Kurs mit deinem gewichteten <strong className="text-foreground">Ø Kaufpreis</strong> inkl. erstem Kaufdatum.</li>
                                <li><strong className="text-foreground">KPI-Balken oben:</strong> Zeigt 1. Platz, Durchschnitt, Gewinner/Verlierer und Schlusslicht. Im Tab <strong className="text-foreground">Bestand</strong> steht neben dem %-Durchschnitt zusätzlich die echte <strong className="text-foreground">Summe in CHF</strong> für den gewählten Zeitraum.</li>
                            </ul>
                        </div>

                        {/* 2. Bewertungs-Badges */}
                        <div className="p-4 rounded-xl bg-primary/5 border border-primary/20 space-y-2.5">
                            <h3 className="font-bold text-sm text-foreground flex items-center gap-2">
                                <Telescope className="size-4 text-blue-500 shrink-0" />
                                Bewertungs-Badges · Fairer Wert & Kauflimit
                            </h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-muted-foreground">
                                <div className="flex items-start gap-2">
                                    <span className="inline-flex items-center justify-center w-[22px] h-4 mt-0.5 text-[10px] font-bold leading-none rounded border shrink-0 bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/35">A</span>
                                    <span><strong className="text-foreground">Sicherheit A:</strong> Konservative Value-Bewertung mit Sicherheitsmarge.</span>
                                </div>
                                <div className="flex items-start gap-2">
                                    <span className="inline-flex items-center justify-center w-[22px] h-4 mt-0.5 text-[10px] font-bold leading-none rounded border shrink-0 bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/35">B</span>
                                    <span><strong className="text-foreground">Qualität B:</strong> Qualitäts-Bewertung für starke Burggraben-Titel.</span>
                                </div>
                                <div className="flex items-start gap-2">
                                    <span className="inline-flex items-center justify-center w-[22px] h-4 mt-0.5 text-[10px] font-bold leading-none rounded border shrink-0 bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/35">C</span>
                                    <span><strong className="text-foreground">Risiko-Abschlag C:</strong> Zusätzlicher Risiko-Abschlag für zyklische oder riskantere Titel.</span>
                                </div>
                                <div className="flex items-start gap-2">
                                    <span className="inline-flex items-center justify-center w-[22px] h-4 mt-0.5 text-[10px] font-bold leading-none rounded border shrink-0 bg-pink-500/15 text-pink-700 dark:text-pink-300 border-pink-500/35">M</span>
                                    <span><strong className="text-foreground">Manuell:</strong> Eigene gespeicherte Bewertung oder eigenes Kauflimit.</span>
                                </div>
                                <div className="flex items-start gap-2 sm:col-span-2">
                                    <span className="inline-flex items-center justify-center w-[22px] h-4 mt-0.5 text-[10px] font-bold leading-none rounded border shrink-0 bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/35">FW</span>
                                    <span><strong className="text-foreground">Kauflimit Fairer Wert:</strong> Das Kauflimit entspricht direkt dem berechneten Fairen Wert.</span>
                                </div>
                            </div>
                        </div>

                        {/* 3. Ampel-Farben bei Gaps */}
                        <div className="p-4 rounded-xl bg-muted/30 border border-border/60 space-y-2">
                            <h3 className="font-bold text-sm text-foreground flex items-center gap-2">
                                <Target className="size-4 text-emerald-500 shrink-0" />
                                Farben bei Fairer Wert & Kauflimit-Gap
                            </h3>
                            <ul className="space-y-1.5 text-muted-foreground">
                                <li><strong className="text-green-600 dark:text-green-400">Grün · ≤ 0.0%:</strong> Kurs liegt unter dem Fairen Wert bzw. hat dein Kauflimit erreicht <span className="inline-flex items-center align-middle text-green-600 dark:text-green-400"><ShoppingBag className="size-3.5 mx-0.5" /></span>.</li>
                                <li><strong className="text-amber-500 dark:text-amber-400">Amber / Orange · +0.1% bis +5.0%:</strong> Nah am Kauflimit — nur noch knapp über deinem gewünschten Einstiegskurs.</li>
                                <li><strong className="text-red-600 dark:text-red-400">Rot · &gt; 0% bzw. &gt; 5%:</strong> Kurs liegt über dem Fairen Wert bzw. noch weiter vom Kauflimit entfernt.</li>
                            </ul>
                        </div>

                        {/* 4. Filter, Sortierung & Klick-Aktionen */}
                        <div className="p-4 rounded-xl bg-muted/30 border border-border/60 space-y-2">
                            <h3 className="font-bold text-sm text-foreground flex items-center gap-2">
                                <Layers className="size-4 text-purple-500 shrink-0" />
                                Schnell-Filter, Sortierung & Direkt-Klicks
                            </h3>
                            <ul className="space-y-1.5 text-muted-foreground">
                                <li><strong className="text-foreground">Kaufchancen-Filter:</strong> Mit <strong className="text-emerald-600 dark:text-emerald-400">Unter Fairer Wert</strong> oder <strong className="text-green-600 dark:text-green-400">Limit erreicht</strong> filterst du jede Liste mit 1 Klick. Erneuter Klick zeigt wieder alle Titel.</li>
                                <li><strong className="text-foreground">Sortieren:</strong> Klick auf jeden Spaltentitel inkl. <strong className="text-foreground">Dividende %</strong> und <strong className="text-foreground">Tag CHF</strong> sortiert die Tabelle. Einträge ohne Wert bleiben immer unten.</li>
                                <li><strong className="text-foreground">Klick auf Zeile:</strong> Öffnet die Aktien-Detailanalyse.</li>
                                <li><strong className="text-foreground">Klick auf Spalte Fairer Wert:</strong> Springt direkt in den <strong className="text-foreground">Fairer-Wert-Rechner</strong> dieser Aktie. Der Zurück-Pfeil <strong className="text-foreground">←</strong> bringt dich genau auf diesen Tab, Zeitraum und Filter zurück.</li>
                            </ul>
                        </div>

                        {/* 5. Marktstatus-Punkt */}
                        <div className="p-4 rounded-xl bg-muted/30 border border-border/60 space-y-1.5">
                            <h3 className="font-bold text-sm text-foreground">Marktstatus-Punkt neben dem Aktiennamen</h3>
                            <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-muted-foreground">
                                <span className="inline-flex items-center gap-1.5">
                                    <span className="size-2 rounded-full bg-green-500 inline-block" />
                                    <strong className="text-foreground">Grün pulsierend:</strong> Börse geöffnet · im Heute-Modus oben gruppiert
                                </span>
                                <span className="inline-flex items-center gap-1.5">
                                    <span className="size-2 rounded-full bg-red-500 inline-block" />
                                    <strong className="text-foreground">Rot:</strong> Börse geschlossen · Tooltip zeigt nächste Öffnung
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="p-4 border-t border-border bg-muted/20 sticky bottom-0 flex justify-end">
                        <button
                            type="button"
                            onClick={() => setShowGuide(false)}
                            className="px-5 py-2 bg-primary text-primary-foreground hover:bg-primary/90 font-semibold text-xs rounded-xl shadow-xs transition-colors cursor-pointer"
                        >
                            Verstanden
                        </button>
                    </div>
                </div>
            </div>
        )}

        <div className="flex-1 min-h-0 flex flex-col rounded-xl border border-border bg-card shadow-sm overflow-hidden w-full h-full animate-in fade-in duration-150">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 sm:p-4 border-b border-border bg-card z-10 gap-3 pl-14 xl:pl-4">
                    <div className="flex items-center gap-2.5 min-w-0">
                        <button
                            type="button"
                            onClick={onClose}
                            className="iphone-landscape-back-btn inline-flex items-center justify-center size-8 rounded-lg bg-secondary/90 hover:bg-secondary text-foreground border border-foreground/40 hover:border-foreground/75 shadow-sm shrink-0 transition-all active:scale-95 cursor-pointer"
                            title="Zurück zur Watchlist"
                            aria-label="Zurück zur Watchlist"
                        >
                            <ArrowLeft className="size-4" />
                        </button>
                        <div className="p-2 rounded-xl bg-gradient-to-br from-blue-500/20 to-indigo-500/20 text-blue-600 dark:text-blue-400 shrink-0 iphone-landscape-portfolio-icon">
                            <TrendingUp className="size-5" />
                        </div>
                        <div className="min-w-0">
                            <h2 className="text-base sm:text-lg font-bold truncate flex items-center gap-2">
                                <span>Watchlist Performance</span>
                                <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-primary/10 text-primary border border-primary/20 truncate">
                                    {activeTabName}
                                </span>
                            </h2>
                            <p className="text-xs text-muted-foreground hidden md:block">
                                Rangliste & Performance-Vergleich deiner beobachteten Titel
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0 flex-wrap">
                        {/* Period Selector Pills */}
                        <div className="inline-flex items-center rounded-lg border border-border bg-muted/60 p-0.5 gap-0.5 shadow-2xs">
                            {PERIOD_CONFIG.filter(p => p.key !== 'BUY' || currentWatchlistId === 'owned' || hasAnyOwnedInTab).map(p => {
                                const isSelected = selectedPeriod === p.key;
                                return (
                                    <button
                                        key={p.key}
                                        type="button"
                                        onClick={() => {
                                            setSelectedPeriod(p.key);
                                            if (p.key !== '1D') {
                                                setSortConfig({ key: 'gain', direction: 'desc' });
                                            }
                                        }}
                                        className={cn(
                                            "h-7 inline-flex items-center justify-center leading-none px-2 sm:px-2.5 py-0 text-xs font-bold rounded-md transition-all cursor-pointer whitespace-nowrap",
                                            isSelected
                                                ? "bg-blue-600 text-white shadow-xs"
                                                : "text-muted-foreground hover:text-foreground hover:bg-card/70"
                                        )}
                                        title={p.key === 'BUY' ? 'Seit Kauf · Ø Kaufpreis' : `${p.label} · ${p.hint}`}
                                    >
                                        {p.key === 'BUY' ? (
                                            <>
                                                <span className="hidden xl:inline">{p.label}</span>
                                                <span className="xl:hidden">{p.shortLabel}</span>
                                            </>
                                        ) : (
                                            <span>{p.label}</span>
                                        )}
                                    </button>
                                );
                            })}
                        </div>

                        {/* Info / Anleitung Button */}
                        <button
                            type="button"
                            onClick={() => setShowGuide(true)}
                            className={cn(
                                "h-7 inline-flex items-center justify-center leading-none gap-1.5 px-2.5 py-0 rounded-lg border text-xs font-medium transition-all shadow-sm shrink-0 whitespace-nowrap",
                                "bg-card hover:bg-muted text-foreground border-border",
                                "active:scale-95 cursor-pointer"
                            )}
                            title="Anleitung & Info zu Spalten, Farben und Filtern"
                            aria-label="Anleitung und Info öffnen"
                        >
                            <Info className="size-3.5 text-blue-500 shrink-0" />
                            <span className="hidden lg:inline">Info</span>
                        </button>

                        {/* Refresh Button */}
                        <button
                            onClick={() => refreshAllPrices(true)}
                            disabled={isGlobalRefreshing}
                            className={cn(
                                "h-7 inline-flex items-center justify-center leading-none gap-1.5 px-2.5 sm:px-3 py-0 rounded-lg border text-xs font-medium transition-all shadow-sm shrink-0 whitespace-nowrap",
                                "bg-card hover:bg-muted text-foreground border-border",
                                "active:scale-95 disabled:opacity-50 cursor-pointer"
                            )}
                            title="Preise aktualisieren"
                        >
                            <RefreshCw className={cn("size-3.5", (isGlobalRefreshing || isLoadingPeriod) && "animate-spin text-blue-500")} />
                            <span className="hidden lg:inline">
                                {isGlobalRefreshing || isLoadingPeriod
                                    ? 'Lädt...'
                                    : lastGlobalRefresh
                                        ? `${Math.floor((new Date().getTime() - lastGlobalRefresh.getTime()) / 60000)} Min`
                                        : 'Update'}
                            </span>
                        </button>
                    </div>
                </div>

                {/* Watchlist Tabs Bar */}
            <div className="px-3 sm:px-4 py-2 border-b border-border/70 bg-muted/20 flex items-center gap-1.5 overflow-x-auto scroller-none shrink-0 pl-14 xl:pl-4">
                {orderedModalTabs.map(tab => (
                    <button
                        key={tab.id}
                        type="button"
                        onClick={() => {
                            setCurrentWatchlistId(tab.id);
                            setOpportunityFilter('all');
                        }}
                        className={cn(
                            "h-7 inline-flex items-center justify-center leading-none px-3 py-0 rounded-full text-xs font-semibold transition-all border shrink-0 cursor-pointer whitespace-nowrap",
                            currentWatchlistId === tab.id
                                ? "bg-primary text-primary-foreground border-primary shadow-xs"
                                : "bg-card text-muted-foreground border-border hover:bg-muted hover:text-foreground"
                        )}
                    >
                        {tab.name}
                    </button>
                ))}
            </div>

            {/* Sub-Tabs: Asset-Filter (Aktien / ETFs / Alle) & Schnell-Filter Kaufchancen */}
            {((stockCount > 0 && etfCount > 0) || undervaluedCount > 0 || limitReachedCount > 0 || opportunityFilter !== 'all') && (
                <div className="px-3 sm:px-4 py-1.5 border-b border-border/70 bg-card/60 flex items-center gap-2 overflow-x-auto scroller-none shrink-0 pl-14 xl:pl-4">
                    {stockCount > 0 && etfCount > 0 && (
                        <>
                            <button
                                type="button"
                                onClick={() => setAssetFilter('stock')}
                                className={cn(
                                    "h-7 inline-flex items-center justify-center leading-none gap-1.5 px-3 py-0 rounded-lg text-xs font-semibold transition-all border shadow-2xs shrink-0 cursor-pointer whitespace-nowrap",
                                    assetFilter === 'stock'
                                        ? "bg-primary text-primary-foreground border-primary"
                                        : "bg-card text-muted-foreground border-border hover:bg-muted hover:text-foreground"
                                )}
                            >
                                <ShoppingBag className="size-3.5 shrink-0" />
                                <span>Aktien</span>
                                <span className={cn(
                                    "inline-flex items-center justify-center h-4 min-w-[18px] px-1 text-[10px] rounded-full font-mono leading-none",
                                    assetFilter === 'stock' ? "bg-primary-foreground/20 text-primary-foreground" : "bg-muted text-muted-foreground"
                                )}>
                                    {stockCount}
                                </span>
                            </button>

                            <button
                                type="button"
                                onClick={() => setAssetFilter('etf')}
                                className={cn(
                                    "h-7 inline-flex items-center justify-center leading-none gap-1.5 px-3 py-0 rounded-lg text-xs font-semibold transition-all border shadow-2xs shrink-0 cursor-pointer whitespace-nowrap",
                                    assetFilter === 'etf'
                                        ? "bg-primary text-primary-foreground border-primary"
                                        : "bg-card text-muted-foreground border-border hover:bg-muted hover:text-foreground"
                                )}
                            >
                                <PieChart className="size-3.5 shrink-0" />
                                <span>ETFs</span>
                                <span className={cn(
                                    "inline-flex items-center justify-center h-4 min-w-[18px] px-1 text-[10px] rounded-full font-mono leading-none",
                                    assetFilter === 'etf' ? "bg-primary-foreground/20 text-primary-foreground" : "bg-muted text-muted-foreground"
                                )}>
                                    {etfCount}
                                </span>
                            </button>

                            <button
                                type="button"
                                onClick={() => setAssetFilter('all')}
                                className={cn(
                                    "h-7 inline-flex items-center justify-center leading-none gap-1.5 px-3 py-0 rounded-lg text-xs font-semibold transition-all border shadow-2xs shrink-0 cursor-pointer whitespace-nowrap",
                                    assetFilter === 'all'
                                        ? "bg-primary text-primary-foreground border-primary"
                                        : "bg-card text-muted-foreground border-border hover:bg-muted hover:text-foreground"
                                )}
                            >
                                <Layers className="size-3.5 shrink-0" />
                                <span>Alle</span>
                                <span className={cn(
                                    "inline-flex items-center justify-center h-4 min-w-[18px] px-1 text-[10px] rounded-full font-mono leading-none",
                                    assetFilter === 'all' ? "bg-primary-foreground/20 text-primary-foreground" : "bg-muted text-muted-foreground"
                                )}>
                                    {relevantStocks.length}
                                </span>
                            </button>

                            {(undervaluedCount > 0 || limitReachedCount > 0 || opportunityFilter !== 'all') && (
                                <div className="h-4 w-px bg-border/80 mx-0.5 shrink-0" />
                            )}
                        </>
                    )}

                    {(undervaluedCount > 0 || opportunityFilter === 'undervalued') && (
                        <button
                            type="button"
                            onClick={() => setOpportunityFilter(prev => prev === 'undervalued' ? 'all' : 'undervalued')}
                            className={cn(
                                "h-7 inline-flex items-center justify-center leading-none gap-1.5 px-3 py-0 rounded-lg text-xs font-semibold transition-all border shadow-2xs shrink-0 cursor-pointer whitespace-nowrap",
                                opportunityFilter === 'undervalued'
                                    ? "bg-emerald-600 text-white border-emerald-600 shadow-xs"
                                    : "bg-card text-emerald-600 dark:text-emerald-400 border-emerald-500/35 hover:bg-emerald-500/10"
                            )}
                            title="Nur Titel unter dem Fairen Wert anzeigen"
                        >
                            <Telescope className="size-3.5 shrink-0" />
                            <span>Unter Fairer Wert</span>
                            <span className={cn(
                                "inline-flex items-center justify-center h-4 min-w-[18px] px-1 text-[10px] rounded-full font-mono leading-none",
                                opportunityFilter === 'undervalued'
                                    ? "bg-white/20 text-white"
                                    : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                            )}>
                                {undervaluedCount}
                            </span>
                        </button>
                    )}

                    {(limitReachedCount > 0 || opportunityFilter === 'limitReached') && (
                        <button
                            type="button"
                            onClick={() => setOpportunityFilter(prev => prev === 'limitReached' ? 'all' : 'limitReached')}
                            className={cn(
                                "h-7 inline-flex items-center justify-center leading-none gap-1.5 px-3 py-0 rounded-lg text-xs font-semibold transition-all border shadow-2xs shrink-0 cursor-pointer whitespace-nowrap",
                                opportunityFilter === 'limitReached'
                                    ? "bg-green-600 text-white border-green-600 shadow-xs"
                                    : "bg-card text-green-600 dark:text-green-400 border-green-500/35 hover:bg-green-500/10"
                            )}
                            title="Nur Titel mit erreichtem Kauflimit anzeigen"
                        >
                            <ShoppingBag className="size-3.5 shrink-0" />
                            <span>Limit erreicht</span>
                            <span className={cn(
                                "inline-flex items-center justify-center h-4 min-w-[18px] px-1 text-[10px] rounded-full font-mono leading-none",
                                opportunityFilter === 'limitReached'
                                    ? "bg-white/20 text-white"
                                    : "bg-green-500/15 text-green-700 dark:text-green-300"
                            )}>
                                {limitReachedCount}
                            </span>
                        </button>
                    )}
                </div>
            )}

            {/* KPI Highlight Strip */}
                {stats && (
                    <div className="px-4 py-2.5 bg-muted/30 border-b border-border/70 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs shrink-0">
                        <div className="flex items-center gap-2 p-1.5 rounded-lg bg-card/60 border border-border/50">
                            <Trophy className="size-4 text-amber-400 shrink-0" />
                            <div className="min-w-0">
                                <div className="text-[10px] text-muted-foreground uppercase font-semibold flex items-center gap-2">
                                    <span>1. Platz</span>
                                    <span className="text-foreground/75">{activePeriodMeta.label}</span>
                                </div>
                                <div className="font-bold truncate text-foreground flex items-center gap-1">
                                    <span className="truncate">{stats.best.stock.name.replace(/\r?\n/g, ' ')}</span>
                                    <span className={cn("font-mono font-bold text-xs shrink-0", stats.best.effectiveGainPercent >= 0 ? "text-green-500" : "text-red-500")}>
                                        {stats.best.effectiveGainPercent >= 0 ? '+' : ''}{stats.best.effectiveGainPercent.toFixed(1)}%
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-2 p-1.5 rounded-lg bg-card/60 border border-border/50">
                            <Flame className="size-4 text-blue-400 shrink-0" />
                            <div className="min-w-0">
                                <div className="text-[10px] text-muted-foreground uppercase font-semibold flex items-center gap-2">
                                    <span>Durchschnitt</span>
                                    <span className="text-foreground/75">{activePeriodMeta.label}</span>
                                </div>
                                <div className="flex items-baseline flex-wrap gap-x-2 gap-y-0.5 font-mono font-bold tabular-nums">
                                    <span className={cn("text-sm", stats.avgGain >= 0 ? "text-green-500" : "text-red-500")}>
                                        {isPeriodMode && isLoadingPeriod
                                            ? '...'
                                            : `${stats.avgGain >= 0 ? '+' : ''}${stats.avgGain.toFixed(2)}%`}
                                    </span>
                                    {(currentWatchlistId === 'owned' || selectedPeriod === 'BUY') && stats.ownedCount > 0 && !(isPeriodMode && isLoadingPeriod) && (
                                        <span
                                            className={cn(
                                                "text-xs",
                                                stats.totalPeriodChf >= 0 ? "text-green-500/90" : "text-red-500/90"
                                            )}
                                            title={`Summe Bestand ${activePeriodMeta.label} in CHF`}
                                        >
                                            {stats.totalPeriodChf >= 0 ? '+' : ''}{formatCurrency(stats.totalPeriodChf, 'CHF', false)}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-2 p-1.5 rounded-lg bg-card/60 border border-border/50">
                            <Target className="size-4 text-purple-400 shrink-0" />
                            <div className="min-w-0">
                                <div className="text-[10px] text-muted-foreground uppercase font-semibold">Gewinner / Verlierer</div>
                                <div className="font-mono font-bold text-xs text-foreground">
                                    <span className="text-green-500">{stats.winners} Plus</span>
                                    <span className="text-muted-foreground mx-1">/</span>
                                    <span className="text-red-500">{stats.losers} Minus</span>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-2 p-1.5 rounded-lg bg-card/60 border border-border/50">
                            <TrendingDown className="size-4 text-red-400 shrink-0" />
                            <div className="min-w-0">
                                <div className="text-[10px] text-muted-foreground uppercase font-semibold flex items-center gap-2">
                                    <span>Schlusslicht</span>
                                    <span className="text-foreground/75">{activePeriodMeta.label}</span>
                                </div>
                                <div className="font-bold truncate text-foreground flex items-center gap-1">
                                    <span className="truncate">{stats.worst.stock.name.replace(/\r?\n/g, ' ')}</span>
                                    <span className={cn("font-mono font-bold text-xs shrink-0", stats.worst.effectiveGainPercent >= 0 ? "text-green-500" : "text-red-500")}>
                                        {stats.worst.effectiveGainPercent >= 0 ? '+' : ''}{stats.worst.effectiveGainPercent.toFixed(1)}%
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Table Body */}
                <div className="flex flex-col flex-1 min-h-0 overflow-hidden iphone-modal-body-card iphone-modal-body-flush">
                    <div className="overflow-auto p-0 flex-1">
                        <table className="w-full text-xs md:text-sm border-collapse">
                            <thead>
                                <tr className="border-b border-border bg-muted/20">
                                    <th
                                        onClick={() => handleSort('gain')}
                                        className="text-center py-3 px-2 font-semibold text-muted-foreground uppercase tracking-wider sticky top-0 z-30 bg-card align-middle cursor-pointer hover:text-foreground w-12"
                                        title="Nach Rang sortieren"
                                    >
                                        <div className="flex items-center justify-center gap-0.5">
                                            <span>Rang</span>
                                            {sortConfig.key === 'gain' && (
                                                sortConfig.direction === 'desc' ? <ChevronDown className="size-3 text-primary" /> : <ChevronUp className="size-3 text-primary" />
                                            )}
                                        </div>
                                    </th>

                                    <th
                                        onClick={() => handleSort('name')}
                                        className="text-left py-3 px-4 font-semibold text-muted-foreground uppercase tracking-wider sticky top-0 z-30 bg-card align-middle cursor-pointer hover:text-foreground min-w-[200px] lg:min-w-[240px]"
                                    >
                                        <div className="flex items-center gap-1">
                                            <span>Aktie</span>
                                            {sortConfig.key === 'name' && (
                                                sortConfig.direction === 'desc' ? <ChevronDown className="size-3 text-primary" /> : <ChevronUp className="size-3 text-primary" />
                                            )}
                                        </div>
                                    </th>

                                    <th
                                        onClick={() => handleSort('dividend')}
                                        className="text-right py-3 px-3 font-semibold text-muted-foreground uppercase tracking-wider sticky top-0 z-30 bg-card align-middle cursor-pointer hover:text-foreground whitespace-nowrap"
                                        title="Nach Dividendenrendite sortieren"
                                    >
                                        <div className="flex items-center justify-end gap-1">
                                            <span>Dividende %</span>
                                            {sortConfig.key === 'dividend' && (
                                                sortConfig.direction === 'desc' ? <ChevronDown className="size-3 text-primary" /> : <ChevronUp className="size-3 text-primary" />
                                            )}
                                        </div>
                                    </th>

                                    {isPeriodMode && (
                                        <th className="text-right py-3 px-2 font-semibold text-muted-foreground uppercase tracking-wider sticky top-0 z-30 bg-card align-middle whitespace-nowrap">
                                            {selectedPeriod === 'BUY' ? 'Kaufpreis Ø' : 'Startkurs'}
                                        </th>
                                    )}

                                    <th
                                        onClick={() => handleSort('price')}
                                        className="text-right py-3 px-2 font-semibold text-muted-foreground uppercase tracking-wider sticky top-0 z-30 bg-card align-middle cursor-pointer hover:text-foreground whitespace-nowrap"
                                    >
                                        <div className="flex items-center justify-end gap-1">
                                            <span>Aktueller Kurs</span>
                                            {sortConfig.key === 'price' && (
                                                sortConfig.direction === 'desc' ? <ChevronDown className="size-3 text-primary" /> : <ChevronUp className="size-3 text-primary" />
                                            )}
                                        </div>
                                    </th>

                                    <th
                                        onClick={() => handleSort('gain')}
                                        className="text-right py-3 px-4 font-semibold text-muted-foreground uppercase tracking-wider sticky top-0 z-30 bg-card align-middle cursor-pointer hover:text-foreground whitespace-nowrap min-w-[140px]"
                                    >
                                        <div className="flex flex-nowrap items-center justify-end gap-1.5 whitespace-nowrap">
                                            {isPeriodMode ? (
                                                <>
                                                    <span className="whitespace-nowrap">Rendite</span>
                                                    <span className="text-foreground/80 whitespace-nowrap">{activePeriodMeta.shortLabel}</span>
                                                </>
                                            ) : (
                                                <span className="whitespace-nowrap">Tag %</span>
                                            )}
                                            {sortConfig.key === 'gain' && (
                                                sortConfig.direction === 'desc' ? <ChevronDown className="size-3 text-primary shrink-0" /> : <ChevronUp className="size-3 text-primary shrink-0" />
                                            )}
                                        </div>
                                    </th>

                                    {!isPeriodMode && (
                                        <th
                                            onClick={() => handleSort('dailyChf')}
                                            className="text-right py-3 px-2 font-semibold text-muted-foreground uppercase tracking-wider sticky top-0 z-30 bg-card align-middle cursor-pointer hover:text-foreground whitespace-nowrap"
                                            title="Nach Tagesgewinn/-verlust in CHF sortieren"
                                        >
                                            <div className="flex items-center justify-end gap-1">
                                                <span>Tag CHF</span>
                                                {sortConfig.key === 'dailyChf' && (
                                                    sortConfig.direction === 'desc' ? <ChevronDown className="size-3 text-primary" /> : <ChevronUp className="size-3 text-primary" />
                                                )}
                                            </div>
                                        </th>
                                    )}

                                    <th
                                        onClick={() => handleSort('fairValue')}
                                        className="text-right py-3 px-3 font-semibold text-muted-foreground uppercase tracking-wider border-l border-border/50 sticky top-0 z-30 bg-card align-middle cursor-pointer hover:text-foreground whitespace-nowrap"
                                        title="Nach Abstand zum Fairen Wert sortieren"
                                    >
                                        <div className="flex items-center justify-end gap-1">
                                            <span>Fairer Wert</span>
                                            {sortConfig.key === 'fairValue' && (
                                                sortConfig.direction === 'desc' ? <ChevronDown className="size-3 text-primary" /> : <ChevronUp className="size-3 text-primary" />
                                            )}
                                        </div>
                                    </th>

                                    <th
                                        onClick={() => handleSort('gap')}
                                        className="text-right py-3 px-3 font-semibold text-muted-foreground uppercase tracking-wider border-l border-border/50 sticky top-0 z-30 bg-card align-middle cursor-pointer hover:text-foreground whitespace-nowrap"
                                    >
                                        <div className="flex items-center justify-end gap-1">
                                            <span>Kauflimit & Gap</span>
                                            {sortConfig.key === 'gap' && (
                                                sortConfig.direction === 'desc' ? <ChevronDown className="size-3 text-primary" /> : <ChevronUp className="size-3 text-primary" />
                                            )}
                                        </div>
                                    </th>

                                    <th
                                        onClick={() => handleSort('total')}
                                        className="text-right py-3 px-4 font-semibold text-muted-foreground uppercase tracking-wider sticky top-0 z-30 bg-card align-middle cursor-pointer hover:text-foreground"
                                    >
                                        <div className="flex items-center justify-end gap-1">
                                            <span>Portfolio</span>
                                            {sortConfig.key === 'total' && (
                                                sortConfig.direction === 'desc' ? <ChevronDown className="size-3 text-primary" /> : <ChevronUp className="size-3 text-primary" />
                                            )}
                                        </div>
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border/50">
                                {sortedData.length === 0 ? (
                                    <tr>
                                        <td colSpan={9} className="py-12 px-4 text-center text-muted-foreground">
                                            <div className="flex flex-col items-center gap-2">
                                                <span className="text-sm font-medium">Keine Titel für diesen Filter gefunden.</span>
                                                {opportunityFilter !== 'all' && (
                                                    <button
                                                        type="button"
                                                        onClick={() => setOpportunityFilter('all')}
                                                        className="h-7 inline-flex items-center justify-center leading-none px-3 py-0 rounded-lg border border-border bg-card hover:bg-muted text-foreground text-xs font-semibold cursor-pointer transition-colors"
                                                    >
                                                        Filter zurücksetzen
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ) : sortedData.map((item, idx) => {
                                    const {
                                        stock,
                                        isOwned,
                                        matchedViaSymbol,
                                        pos,
                                        dailyGainPercent,
                                        dailyGainChfConverted,
                                        baselinePrice,
                                        baselineCurrency,
                                        periodStartDate,
                                        effectiveGainPercent,
                                        totalGainPercent,
                                        totalGainCHF,
                                        dividendYield,
                                        fairValue,
                                        fairValueMode,
                                        fairValueGap,
                                        targetPrice,
                                        targetPriceMode,
                                        buyGap,
                                        isLimitReached,
                                        isNearLimit
                                    } = item;

                                    const calcState = estimateMarketState(stock.symbol, stock.currency);
                                    const isMarketOpen = calcState === 'REGULAR';
                                    const hasOpenedToday = hasMarketOpenedToday(stock.symbol, stock.currency);
                                    const isWaitingForOpen = isAnyActiveToday && !hasOpenedToday;
                                    const openingHint = getMarketOpeningTimeHint(stock.symbol, stock.currency);

                                    const isPos = effectiveGainPercent > 0.005;
                                    const isNeg = effectiveGainPercent < -0.005;
                                    const isZero = !isPos && !isNeg;

                                    // Medal for rank
                                    const rankNumber = idx + 1;
                                    const rankBadge = rankNumber === 1
                                        ? (
                                            <div
                                                className={cn(
                                                    "size-6 sm:size-7 rounded-full border flex items-center justify-center text-sm shadow-xs",
                                                    isNeg
                                                        ? "bg-red-500/15 border-red-500/40 text-red-400"
                                                        : "bg-gradient-to-br from-amber-400/25 to-yellow-600/15 border-amber-400/40"
                                                )}
                                                title="1. Platz"
                                            >
                                                🥇
                                            </div>
                                        )
                                        : rankNumber === 2
                                            ? (
                                                <div
                                                    className={cn(
                                                        "size-6 sm:size-7 rounded-full border flex items-center justify-center text-sm shadow-xs",
                                                        isNeg
                                                            ? "bg-red-500/15 border-red-500/40 text-red-400"
                                                            : "bg-gradient-to-br from-slate-300/25 to-slate-500/15 border-slate-300/40"
                                                    )}
                                                    title="2. Platz"
                                                >
                                                    🥈
                                                </div>
                                            )
                                            : rankNumber === 3
                                                ? (
                                                    <div
                                                        className={cn(
                                                            "size-6 sm:size-7 rounded-full border flex items-center justify-center text-sm shadow-xs",
                                                            isNeg
                                                                ? "bg-red-500/15 border-red-500/40 text-red-400"
                                                                : "bg-gradient-to-br from-amber-700/25 to-amber-900/15 border-amber-600/40"
                                                        )}
                                                        title="3. Platz"
                                                    >
                                                        🥉
                                                    </div>
                                                )
                                                : (
                                                    <div
                                                        className={cn(
                                                            "size-6 sm:size-7 rounded-full font-mono font-bold text-xs flex items-center justify-center shadow-2xs border transition-colors",
                                                            isPos
                                                                ? "bg-green-500/15 border-green-500/35 text-green-600 dark:text-green-400"
                                                                : isNeg
                                                                    ? "bg-red-500/15 border-red-500/35 text-red-600 dark:text-red-400"
                                                                    : "bg-muted/70 border-border/80 text-muted-foreground"
                                                        )}
                                                        title={`${rankNumber}. Platz (${isPos ? 'Im Plus' : isNeg ? 'Im Minus' : 'Neutral'})`}
                                                    >
                                                        {rankNumber}
                                                    </div>
                                                );

                                    // Bar calculation relative to maximum absolute gain
                                    const barWidth = stats?.maxAbsGain
                                        ? Math.min(100, Math.max(6, (Math.abs(effectiveGainPercent) / stats.maxAbsGain) * 100))
                                        : 0;

                                    const divFreqLabel = stock.dividendFrequency === 'quarterly'
                                        ? 'Quartalsweise'
                                        : stock.dividendFrequency === 'monthly'
                                            ? 'Monatlich'
                                            : stock.dividendFrequency === 'semi-annually'
                                                ? 'Halbjährlich'
                                                : stock.dividendFrequency === 'annually'
                                                    ? 'Jährlich'
                                                    : '';

                                    return (
                                        <tr
                                            key={stock.id}
                                            onClick={() => handleRowClick(stock.id)}
                                            className="hover:bg-muted/30 transition-colors cursor-pointer group"
                                        >
                                            {/* Rank */}
                                            <td className="py-2.5 sm:py-3 px-2 text-center bg-card group-hover:bg-muted/30 transition-colors w-12">
                                                <div className="flex items-center justify-center">
                                                    {rankBadge}
                                                </div>
                                            </td>

                                            {/* Stock Info */}
                                            <td className="py-2.5 sm:py-3 px-3 sm:px-4 bg-card group-hover:bg-muted/30 transition-colors min-w-[200px] lg:min-w-[240px]">
                                                <div className="flex items-center gap-2.5 sm:gap-3">
                                                    <Logo
                                                        url={stock.logoUrl}
                                                        alt={stock.name}
                                                        fallback={stock.symbol.slice(0, 2)}
                                                        size="size-8 sm:size-9"
                                                    />
                                                    <div className="flex flex-col min-w-0 flex-1">
                                                        <div className="flex items-start gap-1.5">
                                                            <StockName name={stock.name} className="font-bold text-xs sm:text-sm group-hover:text-primary transition-colors" />
                                                            {isMarketOpen ? (
                                                                <div className="size-2 rounded-full bg-green-500 animate-pulse shrink-0 mt-1 border border-background shadow-[0_0_8px_rgba(34,197,94,0.4)]" title="Markt geöffnet" />
                                                            ) : (
                                                                <div className="size-2 rounded-full bg-red-500 shrink-0 mt-1 border border-background" title={isWaitingForOpen ? `${openingHint} (${calcState})` : `Markt geschlossen (${calcState})`} />
                                                            )}
                                                            {(() => {
                                                                const memberLists = watchlists.filter(w => w.stockIds.includes(stock.id));
                                                                const isInAnyList = memberLists.length > 0;
                                                                return (
                                                                    <button
                                                                        type="button"
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            setWatchlistModalStockId(stock.id);
                                                                        }}
                                                                        className={cn(
                                                                            "inline-flex items-center justify-center p-0.5 rounded transition-colors cursor-pointer shrink-0 mt-0.5",
                                                                            isInAnyList
                                                                                ? "text-amber-400 hover:bg-amber-500/15"
                                                                                : "text-muted-foreground/45 hover:text-amber-400 hover:bg-muted"
                                                                        )}
                                                                        title={isInAnyList
                                                                            ? `In Watchlists: ${memberLists.map(w => w.name).join(', ')} · Klick zum Zuordnen`
                                                                            : 'In andere Watchlists aufnehmen zum Vergleichen'}
                                                                        aria-label="Watchlists zuordnen"
                                                                    >
                                                                        <Star className={cn("size-3.5", isInAnyList && "fill-amber-400")} />
                                                                    </button>
                                                                );
                                                            })()}
                                                        </div>
                                                        <div className="flex items-center gap-1.5 sm:gap-2 text-[10px] text-muted-foreground font-mono mt-0.5">
                                                            <span className="shrink-0">{stock.symbol}</span>
                                                            {stock.sector && (
                                                                <>
                                                                    <span>•</span>
                                                                    <span className="truncate max-w-[140px]">{stock.sector}</span>
                                                                </>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>

                                            {/* Dividende % */}
                                            <td
                                                className="py-3 px-3 text-right font-mono tabular-nums whitespace-nowrap"
                                                title={dividendYield > 0 ? (divFreqLabel ? `Dividendenrendite · ${divFreqLabel}` : 'Dividendenrendite') : 'Keine Dividende'}
                                            >
                                                {dividendYield > 0 ? (
                                                    <span className="text-xs sm:text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                                                        {dividendYield.toFixed(2)}%
                                                    </span>
                                                ) : (
                                                    <span className="text-muted-foreground/35 text-xs">-</span>
                                                )}
                                            </td>

                                            {/* Start Price (Period Mode) */}
                                            {isPeriodMode && (
                                                <td className="py-3 px-2 text-right font-mono tabular-nums text-muted-foreground whitespace-nowrap">
                                                    {isLoadingPeriod ? (
                                                        <span className="animate-pulse">...</span>
                                                    ) : selectedPeriod === 'BUY' && !isOwned ? (
                                                        <span className="text-muted-foreground/35 text-xs">-</span>
                                                    ) : (
                                                        <div className="flex flex-col items-end leading-tight">
                                                            <span>{formatCurrency(baselinePrice, baselineCurrency, false)}</span>
                                                            {periodStartDate && (
                                                                <span className="text-[10px] text-muted-foreground/70 mt-0.5">
                                                                    {new Date(periodStartDate).toLocaleDateString('de-CH', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                                                                </span>
                                                            )}
                                                        </div>
                                                    )}
                                                </td>
                                            )}

                                            {/* Current Price */}
                                            <td className="py-3 px-2 text-right font-bold font-mono tabular-nums whitespace-nowrap">
                                                {formatCurrency(stock.currentPrice, stock.currency, false)}
                                            </td>

                                            {/* Gain / Performance */}
                                            <td className="py-3 px-4 text-right whitespace-nowrap min-w-[140px]">
                                                {isPeriodMode ? (
                                                    isLoadingPeriod ? (
                                                        <div className="font-mono text-xs text-muted-foreground animate-pulse">Lade...</div>
                                                    ) : selectedPeriod === 'BUY' && !isOwned ? (
                                                        <span className="text-muted-foreground/35 text-xs font-mono">-</span>
                                                    ) : (
                                                        <div className="flex flex-col items-end gap-1">
                                                            <div className={cn(
                                                                "font-mono tabular-nums font-bold text-sm sm:text-base",
                                                                isZero
                                                                    ? "text-muted-foreground"
                                                                    : isPos
                                                                        ? "text-green-600 dark:text-green-400"
                                                                        : "text-red-600 dark:text-red-400"
                                                            )}>
                                                                {isZero ? '0.00%' : `${isPos ? '+' : ''}${effectiveGainPercent.toFixed(2)}%`}
                                                            </div>
                                                            {/* Mini Visual Bar */}
                                                            <div className="w-24 h-1.5 bg-muted rounded-full overflow-hidden flex justify-start">
                                                                <div
                                                                    className={cn(
                                                                        "h-full rounded-full transition-all duration-500",
                                                                        isPos ? "bg-green-500" : "bg-red-500"
                                                                    )}
                                                                    style={{ width: `${barWidth}%` }}
                                                                />
                                                            </div>
                                                        </div>
                                                    )
                                                ) : (
                                                    <div className={cn(
                                                        "font-mono tabular-nums font-bold text-sm",
                                                        isWaitingForOpen
                                                            ? "text-muted-foreground/60"
                                                            : isDailyZero(dailyGainPercent)
                                                                ? "text-muted-foreground"
                                                                : dailyGainPercent >= 0
                                                                    ? "text-green-600 dark:text-green-400"
                                                                    : "text-red-600 dark:text-red-400"
                                                    )}>
                                                        {isWaitingForOpen || isDailyZero(dailyGainPercent) ? '0.00%' : `${dailyGainPercent >= 0 ? '+' : ''}${dailyGainPercent.toFixed(2)}%`}
                                                    </div>
                                                )}
                                            </td>

                                            {/* Tag CHF (only 1D mode) */}
                                            {!isPeriodMode && (
                                                <td className="py-3 px-2 text-right font-semibold font-mono tabular-nums whitespace-nowrap opacity-85">
                                                    {isOwned && dailyGainChfConverted !== null ? (
                                                        <span className={cn(dailyGainPercent >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400")}>
                                                            {dailyGainPercent >= 0 ? '+' : ''}{formatCurrency(dailyGainChfConverted, 'CHF').replace('CHF', '').trim()}
                                                        </span>
                                                    ) : (
                                                        <span className="text-muted-foreground/30">-</span>
                                                    )}
                                                </td>
                                            )}

                                            {/* Fairer Wert & Modus (A / B / C / M) - Direkt-Klick öffnet Rechner */}
                                            <td
                                                onClick={(e) => handleFairValueClick(e, stock)}
                                                className="py-3 px-3 text-right border-l border-border/50 whitespace-nowrap hover:bg-primary/10 transition-colors cursor-pointer"
                                                title="Fairer Wert im Rechner öffnen"
                                            >
                                                {fairValue > 0 ? (() => {
                                                    const modeStyle = fairValueMode === 'manual'
                                                        ? {
                                                            label: 'M',
                                                            title: 'Manuell · Klick öffnet Rechner',
                                                            text: 'text-pink-600 dark:text-pink-400',
                                                            badge: 'bg-pink-500/15 text-pink-700 dark:text-pink-300 border-pink-500/35'
                                                        }
                                                        : fairValueMode === 'risk'
                                                            ? {
                                                                label: 'C',
                                                                title: 'Risiko-Abschlag C · Klick öffnet Rechner',
                                                                text: 'text-amber-600 dark:text-amber-400',
                                                                badge: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/35'
                                                            }
                                                            : fairValueMode === 'quality'
                                                                ? {
                                                                    label: 'B',
                                                                    title: 'Qualität B · Klick öffnet Rechner',
                                                                    text: 'text-purple-600 dark:text-purple-400',
                                                                    badge: 'bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/35'
                                                                }
                                                                : {
                                                                    label: 'A',
                                                                    title: 'Sicherheit A · Klick öffnet Rechner',
                                                                    text: 'text-blue-600 dark:text-blue-400',
                                                                    badge: 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/35'
                                                                };
                                                    const isUndervalued = fairValueGap !== null && fairValueGap <= 0;
                                                    return (
                                                        <div className="flex flex-col items-end">
                                                            <div className="inline-flex items-center justify-end gap-2">
                                                                <span
                                                                    className={cn(
                                                                        "inline-flex items-center justify-center w-[22px] h-4 text-[10px] font-bold leading-none rounded border shrink-0",
                                                                        modeStyle.badge
                                                                    )}
                                                                    title={modeStyle.title}
                                                                >
                                                                    {modeStyle.label}
                                                                </span>
                                                                <span className={cn("font-mono tabular-nums text-xs sm:text-sm font-semibold min-w-[88px] sm:min-w-[98px] text-right", modeStyle.text)}>
                                                                    {formatCurrency(fairValue, stock.currency, false)}
                                                                </span>
                                                            </div>
                                                            <div className={cn(
                                                                "font-mono tabular-nums text-xs sm:text-[13px] font-bold mt-0.5",
                                                                fairValueGap === null
                                                                    ? "text-muted-foreground"
                                                                    : isUndervalued
                                                                        ? "text-green-600 dark:text-green-400"
                                                                        : "text-red-600 dark:text-red-400"
                                                            )}>
                                                                {fairValueGap !== null ? `${fairValueGap > 0 ? '+' : ''}${fairValueGap.toFixed(1)}%` : '-'}
                                                            </div>
                                                        </div>
                                                    );
                                                })() : (
                                                    <span className="text-muted-foreground/40 text-xs">-</span>
                                                )}
                                            </td>

                                            {/* Kauflimit & Gap */}
                                            <td className="py-3 px-3 text-right border-l border-border/50 whitespace-nowrap">
                                                {targetPrice ? (() => {
                                                    const limitBadge = targetPriceMode === 'manual'
                                                        ? { label: 'M', title: 'Kauflimit Manuell', cls: 'bg-pink-500/15 text-pink-700 dark:text-pink-300 border-pink-500/35' }
                                                        : targetPriceMode === 'risk'
                                                            ? { label: 'C', title: 'Kauflimit Risiko-Abschlag C', cls: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/35' }
                                                            : targetPriceMode === 'quality'
                                                                ? { label: 'B', title: 'Kauflimit Qualität B', cls: 'bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/35' }
                                                                : targetPriceMode === 'fairValue'
                                                                    ? { label: 'FW', title: 'Kauflimit Fairer Wert', cls: 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/35' }
                                                                    : { label: 'A', title: 'Kauflimit Sicherheit A', cls: 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/35' };
                                                    return (
                                                        <div className="flex flex-col items-end">
                                                            <div className="inline-flex items-center justify-end gap-2">
                                                                <span
                                                                    className={cn(
                                                                        "inline-flex items-center justify-center w-[22px] h-4 text-[10px] font-bold leading-none rounded border shrink-0",
                                                                        limitBadge.cls
                                                                    )}
                                                                    title={limitBadge.title}
                                                                >
                                                                    {limitBadge.label}
                                                                </span>
                                                                <span className="font-mono tabular-nums text-xs sm:text-sm font-medium text-foreground min-w-[88px] sm:min-w-[98px] text-right">
                                                                    {formatCurrency(targetPrice, stock.currency, false)}
                                                                </span>
                                                            </div>
                                                            <div
                                                                className={cn(
                                                                    "font-mono tabular-nums text-xs sm:text-[13px] font-bold flex items-center gap-0.5 mt-0.5",
                                                                    buyGap === null
                                                                        ? "text-muted-foreground"
                                                                        : isLimitReached
                                                                            ? "text-green-600 dark:text-green-400 font-black animate-pulse"
                                                                            : isNearLimit
                                                                                ? "text-amber-500 dark:text-amber-400"
                                                                                : "text-red-600 dark:text-red-400"
                                                                )}
                                                                title={isLimitReached ? 'Kauflimit erreicht' : isNearLimit ? 'Nah am Kauflimit ≤ 5%' : undefined}
                                                            >
                                                                {buyGap !== null ? `${buyGap > 0 ? '+' : ''}${buyGap.toFixed(1)}%` : '-'}
                                                                {isLimitReached && <ShoppingBag className="size-3.5 inline-block ml-0.5" />}
                                                            </div>
                                                        </div>
                                                    );
                                                })() : (
                                                    <span className="text-muted-foreground/40 text-xs">Kein Limit</span>
                                                )}
                                            </td>

                                            {/* Portfolio Status */}
                                            <td className="py-3 px-4 bg-muted/10 whitespace-nowrap">
                                                {isOwned && pos ? (
                                                    <div
                                                        className="flex flex-col items-end"
                                                        title={matchedViaSymbol ? `Im Depot über ${matchedViaSymbol}` : undefined}
                                                    >
                                                        <div className="text-[10px] text-muted-foreground font-semibold">
                                                            {pos.shares} Stk. im Depot{matchedViaSymbol ? ` · ${matchedViaSymbol}` : ''}
                                                        </div>
                                                        <div className={cn(
                                                            "inline-flex items-baseline justify-end gap-2 font-bold text-xs font-mono tabular-nums",
                                                            totalGainPercent >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
                                                        )}>
                                                            <span className="text-right">
                                                                {totalGainPercent >= 0 ? '+' : ''}{totalGainPercent.toFixed(1)}%
                                                            </span>
                                                            <span className="min-w-[88px] sm:min-w-[96px] text-right">
                                                                {totalGainCHF > 0 ? '+' : ''}{formatCurrency(totalGainCHF, 'CHF', false)}
                                                            </span>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="text-right">
                                                        <span className="text-[10px] text-muted-foreground/50 uppercase tracking-wider font-semibold">
                                                            Watchlist
                                                        </span>
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    {/* Footer */}
                    <div className="p-3 bg-muted/20 border-t border-border text-[10px] text-muted-foreground flex justify-between items-center flex-wrap gap-2">
                        <div>
                            {opportunityFilter !== 'all'
                                ? `${displayData.length} von ${enrichedData.length} Titel`
                                : `${displayData.length} Titel`}{' '}
                            in <strong className="text-foreground">{activeTabName}</strong>
                            {stockCount > 0 && etfCount > 0 && assetFilter !== 'all' ? ` · ${assetFilter === 'stock' ? 'Aktien' : 'ETFs'}` : ''}
                            {opportunityFilter === 'undervalued' ? ' · Unter Fairer Wert' : opportunityFilter === 'limitReached' ? ' · Limit erreicht' : ''}
                        </div>
                        <div className="flex items-center gap-2">
                            <span>Klick auf Zeile öffnet Details · Fairer Wert öffnet Rechner · ★ ordnet Watchlists zu</span>
                        </div>
                    </div>
                </div>
        </div>
        <AddToWatchlistModal
            isOpen={Boolean(watchlistModalStockId)}
            onClose={() => setWatchlistModalStockId(null)}
            stockId={watchlistModalStockId || ''}
        />
        </>
    );
}

function isDailyZero(val: number): boolean {
    return Math.abs(val) < 0.005;
}
