import type { OrderBookEntry, Position, Stock, Watchlist } from '../types';
import {
    applyRiskModeParams,
    calculateDcfFairValue,
    computeSmartAutoParams,
    computeStockSupportZones,
    isEtfAsset,
    type SupportZone
} from './fairValue';

export type RadarCategory =
    | 'all_signals'
    | 'buy_limit'
    | 'zone1'
    | 'zone2'
    | 'zone3'
    | 'below_sma200'
    | 'sell_approaching'
    | 'sell_reached'
    | 'all_assets';

export type RadarBuyZone = 1 | 2 | 3 | null;
export type RadarSellStatus = 'approaching' | 'reached' | null;
export type RadarProfileMode = 'conservative' | 'quality' | 'risk' | 'manual';

export interface RadarViewSnapshot {
    mode: 'buy' | 'sell';
    sourceFilter: string;
    category: RadarCategory;
    highlightSymbol?: string;
}

export function buildRadarReturnUrl(basePath: string, snapshot: RadarViewSnapshot): string {
    const cleanBase = basePath && basePath.startsWith('/') ? basePath.split('?')[0] : '/calculator';
    const params = new URLSearchParams();
    params.set('radar', 'true');
    params.set('radarMode', snapshot.mode);
    if (snapshot.sourceFilter) params.set('radarSource', snapshot.sourceFilter);
    if (snapshot.category) params.set('radarCategory', snapshot.category);
    if (snapshot.highlightSymbol) params.set('radarHighlight', snapshot.highlightSymbol);
    return `${cleanBase}?${params.toString()}`;
}

export function parseRadarReturnParams(searchParams: URLSearchParams): RadarViewSnapshot | null {
    if (searchParams.get('radar') !== 'true') return null;
    const rawMode = searchParams.get('radarMode');
    const mode: 'buy' | 'sell' = rawMode === 'sell' ? 'sell' : 'buy';
    const sourceFilter = searchParams.get('radarSource') || (mode === 'sell' ? 'portfolio_all' : 'all');
    const rawCat = searchParams.get('radarCategory') as RadarCategory | null;
    const category: RadarCategory = rawCat || 'all_assets';
    const highlightSymbol = searchParams.get('radarHighlight') || undefined;
    return { mode, sourceFilter, category, highlightSymbol };
}

export interface TradeRadarItem {
    stock: Stock;
    assetType: 'stock' | 'etf';
    etfDistribution?: 'accumulating' | 'distributing';
    inPortfolio: boolean;
    shares: number;
    buyPriceAvg: number | null;
    positionGainPct: number | null;
    watchlistIds: string[];
    watchlistNames: string[];
    currentPrice: number;
    displayCurrency: string;
    dayChangePct: number;

    // Valuation & Limits
    fairValue: number;
    fairValueMode: RadarProfileMode;
    fairValueGapPct: number | null;
    effectiveBuyLimit: number | null;
    buyLimitType: 'conservative' | 'quality' | 'risk' | 'fairValue' | 'manual' | 'order' | null;
    buyLimitColorMode: RadarProfileMode;
    buyGapPct: number | null;
    effectiveSellLimit: number | null;
    sellLimitType: 'conservative' | 'quality' | 'risk' | 'manual' | 'order' | null;
    hasExplicitSellLimit: boolean;
    sellGapPct: number | null;

    // Technicals & Zones
    drawdownFrom52wHighPct: number | null;
    fiftyTwoWeekHigh: number | null;
    fiftyTwoWeekLow: number | null;
    fiftyDayAverage: number | null;
    twoHundredDayAverage: number | null;
    supportZones: SupportZone[];

    // Radar Classifications
    isBuyLimitReached: boolean;
    buyLimitReason: string | null;
    buyZone: RadarBuyZone;
    buyZoneReason: string | null;
    isBelowSma200: boolean;
    sma200GapPct: number | null;
    sma200Reason: string | null;
    sellStatus: RadarSellStatus;
    sellSource: 'limit' | 'valuation' | null;
    sellReason: string | null;
    isOvervaluedWatchlist: boolean;
    hasAnySignal: boolean;
    urgencyScore: number;
}

export interface TradeRadarSummary {
    items: TradeRadarItem[];
    counts: {
        allSignals: number;
        buyLimit: number;
        zone1: number;
        zone2: number;
        zone3: number;
        belowSma200: number;
        sellApproaching: number;
        sellReached: number;
        allAssets: number;
    };
}

function readLocalFairValueMap(): Record<string, any> {
    try {
        const raw = localStorage.getItem('fair_value_params_map');
        return raw ? JSON.parse(raw) : {};
    } catch {
        return {};
    }
}

export function buildTradeRadar(params: {
    stocks: Stock[];
    positions: Position[];
    watchlists: Watchlist[];
    orderBook?: OrderBookEntry[];
    fxRates?: Record<string, number> | null;
    includeStockIds?: string[];
}): TradeRadarSummary {
    const { stocks, positions, watchlists, orderBook = [], fxRates, includeStockIds } = params;
    const forcedIds = includeStockIds && includeStockIds.length > 0 ? new Set(includeStockIds.map(String)) : null;

    const posByStockId = new Map<string, Position>();
    for (const p of positions) {
        if (p.shares > 0) {
            posByStockId.set(String(p.stockId), p);
        }
    }

    const watchlistsByStockId = new Map<string, { ids: string[]; names: string[] }>();
    for (const wl of watchlists) {
        for (const sid of wl.stockIds || []) {
            const key = String(sid);
            const entry = watchlistsByStockId.get(key) || { ids: [], names: [] };
            if (!entry.ids.includes(wl.id)) {
                entry.ids.push(wl.id);
                entry.names.push(wl.name);
            }
            watchlistsByStockId.set(key, entry);
        }
    }

    const openOrders = orderBook.filter(o => o.status === 'open');
    const fvMap = readLocalFairValueMap();

    // Deduplicate stocks that share the exact same ticker symbol across multiple watchlists
    // (e.g. CSNDX.SW saved under multiple stock IDs): merge portfolio & watchlist memberships
    // and pick the richest stock record (inPortfolio > has target/sell limit > has logo).
    const groupedBySymbol = new Map<string, {
        primary: Stock;
        pos: Position | undefined;
        watchlistIds: string[];
        watchlistNames: string[];
        allIds: Set<string>;
    }>();

    const recordScore = (s: Stock, hasPos: boolean) => {
        let score = 0;
        if (hasPos) score += 100;
        if (s.targetPrice && s.targetPrice > 0) score += 30;
        if (s.sellLimit && s.sellLimit > 0) score += 25;
        if (s.fairValueParams?.eps && s.fairValueParams.eps > 0) score += 15;
        if (s.logoUrl) score += 10;
        if (s.fiftyTwoWeekHigh && s.fiftyTwoWeekLow) score += 8;
        if (s.isin) score += 4;
        return score;
    };

    for (const stock of stocks) {
        const stockIdKey = String(stock.id);
        const pos = posByStockId.get(stockIdKey);
        const wlInfo = watchlistsByStockId.get(stockIdKey);
        const hasOpenOrderForId = openOrders.some(
            o =>
                (o.stockId && String(o.stockId) === stockIdKey) ||
                (o.stockSymbol && o.stockSymbol.toLowerCase() === (stock.symbol || '').toLowerCase())
        );

        const inPortfolio = Boolean(pos && pos.shares > 0);
        const inWatchlist = Boolean(wlInfo && wlInfo.ids.length > 0);
        const isForced = Boolean(forcedIds && forcedIds.has(stockIdKey));
        if (!inPortfolio && !inWatchlist && !hasOpenOrderForId && !isForced) continue;

        const curPrice = Number(stock.currentPrice) || 0;
        if (curPrice <= 0) continue;

        const symKey = (stock.symbol || stockIdKey).trim().toUpperCase();
        const existing = groupedBySymbol.get(symKey);

        if (!existing) {
            groupedBySymbol.set(symKey, {
                primary: stock,
                pos,
                watchlistIds: wlInfo ? [...wlInfo.ids] : [],
                watchlistNames: wlInfo ? [...wlInfo.names] : [],
                allIds: new Set([stockIdKey])
            });
        } else {
            existing.allIds.add(stockIdKey);
            if (wlInfo) {
                for (let idx = 0; idx < wlInfo.ids.length; idx++) {
                    if (!existing.watchlistIds.includes(wlInfo.ids[idx])) {
                        existing.watchlistIds.push(wlInfo.ids[idx]);
                        existing.watchlistNames.push(wlInfo.names[idx]);
                    }
                }
            }
            if (!existing.pos && pos) {
                existing.pos = pos;
            }
            const curHasPos = Boolean(existing.pos && String(existing.pos.stockId) === String(existing.primary.id));
            if (recordScore(stock, inPortfolio) > recordScore(existing.primary, curHasPos)) {
                // Preserve limits/logo from previous candidate if missing on the new primary
                existing.primary = {
                    ...existing.primary,
                    ...stock,
                    targetPrice: stock.targetPrice || existing.primary.targetPrice,
                    targetPriceType: stock.targetPrice ? stock.targetPriceType : existing.primary.targetPriceType,
                    sellLimit: stock.sellLimit || existing.primary.sellLimit,
                    sellLimitType: stock.sellLimit ? (stock.sellLimitType || stock.fairValueParams?.sellLimitType) : (existing.primary.sellLimitType || existing.primary.fairValueParams?.sellLimitType),
                    logoUrl: stock.logoUrl || existing.primary.logoUrl,
                    fiftyDayAverage: stock.fiftyDayAverage || existing.primary.fiftyDayAverage,
                    twoHundredDayAverage: stock.twoHundredDayAverage || existing.primary.twoHundredDayAverage,
                    fiftyTwoWeekHigh: stock.fiftyTwoWeekHigh || existing.primary.fiftyTwoWeekHigh,
                    fiftyTwoWeekLow: stock.fiftyTwoWeekLow || existing.primary.fiftyTwoWeekLow
                };
            } else {
                // Enrich existing primary with any limits/technicals from the duplicate record
                existing.primary = {
                    ...existing.primary,
                    targetPrice: existing.primary.targetPrice || stock.targetPrice,
                    targetPriceType: existing.primary.targetPrice ? existing.primary.targetPriceType : stock.targetPriceType,
                    sellLimit: existing.primary.sellLimit || stock.sellLimit,
                    sellLimitType: existing.primary.sellLimit ? (existing.primary.sellLimitType || existing.primary.fairValueParams?.sellLimitType) : (stock.sellLimitType || stock.fairValueParams?.sellLimitType),
                    logoUrl: existing.primary.logoUrl || stock.logoUrl,
                    fiftyDayAverage: existing.primary.fiftyDayAverage || stock.fiftyDayAverage,
                    twoHundredDayAverage: existing.primary.twoHundredDayAverage || stock.twoHundredDayAverage,
                    fiftyTwoWeekHigh: existing.primary.fiftyTwoWeekHigh || stock.fiftyTwoWeekHigh,
                    fiftyTwoWeekLow: existing.primary.fiftyTwoWeekLow || stock.fiftyTwoWeekLow
                };
            }
        }
    }

    const items: TradeRadarItem[] = [];

    for (const [, group] of groupedBySymbol) {
        const stock = group.primary;
        const pos = group.pos;
        const wlInfo = { ids: group.watchlistIds, names: group.watchlistNames };

        const matchingBuyOrder = openOrders.find(
            o =>
                o.mode === 'buy' &&
                ((o.stockId && group.allIds.has(String(o.stockId))) ||
                    (o.stockSymbol && o.stockSymbol.toLowerCase() === stock.symbol.toLowerCase()))
        );
        const matchingSellOrder = openOrders.find(
            o =>
                o.mode === 'sell' &&
                ((o.stockId && group.allIds.has(String(o.stockId))) ||
                    (o.stockSymbol && o.stockSymbol.toLowerCase() === stock.symbol.toLowerCase()))
        );

        const inPortfolio = Boolean(pos && pos.shares > 0);
        const curPrice = Number(stock.currentPrice) || 0;
        if (curPrice <= 0) continue;

        const symKey = (stock.symbol || '').trim().toUpperCase();
        const displayCurrency = stock.currency === 'GBp' ? 'GBP' : (stock.currency || 'USD');
        const prevClose = Number(stock.previousClose) || 0;
        const dayChangePct = prevClose > 0 ? ((curPrice - prevClose) / prevClose) * 100 : 0;

        // Resolve Fair Value parameters identically to StockDetail & WatchlistPerformanceModal
        const localSaved = symKey ? fvMap[symKey] : null;
        const stockSaved = stock.fairValueParams || null;
        let activeParams = stockSaved || localSaved;
        if (localSaved && stockSaved) {
            const localTime = localSaved.updatedAt ? new Date(localSaved.updatedAt).getTime() : 0;
            const stockTime = stockSaved.updatedAt ? new Date(stockSaved.updatedAt).getTime() : 0;
            activeParams = localTime >= stockTime ? localSaved : stockSaved;
        }

        const qStub = {
            price: curPrice,
            dividendYield: stock.dividendYield,
            eps: stock.eps,
            forwardEps: stock.forwardEps,
            trailingPE: stock.trailingPE,
            forwardPE: stock.forwardPE,
            kcv: stock.kcv,
            sector: stock.sector,
            currency: stock.currency
        };

        const smartConservative = computeSmartAutoParams(qStub, null, stock, symKey, 'conservative', fxRates);
        const smartQuality = computeSmartAutoParams(qStub, null, stock, symKey, 'quality', fxRates);
        const smartRisk = applyRiskModeParams(smartConservative);

        const isEtfItem = Boolean(smartConservative.isEtf) || isEtfAsset(stock, null, symKey);
        const assetType: 'stock' | 'etf' = isEtfItem ? 'etf' : 'stock';

        const savedTargetType = stock.targetPriceType;
        let fairValueMode: RadarProfileMode = 'conservative';
        if (activeParams?.valuationMode === 'quality') {
            fairValueMode = 'quality';
        } else if (activeParams?.valuationMode === 'risk') {
            fairValueMode = 'risk';
        } else if (activeParams?.valuationMode === 'conservative') {
            fairValueMode = 'conservative';
        } else if (activeParams?.valuationMode === 'manual' || activeParams?.isCustom) {
            fairValueMode = 'manual';
        } else if (savedTargetType === 'quality' || savedTargetType === 'risk' || savedTargetType === 'conservative') {
            fairValueMode = savedTargetType;
        } else if (savedTargetType === 'manual') {
            fairValueMode = 'manual';
        }

        const withHorizon = <T extends { pe: number; pe5?: number; pe10?: number }>(smart: T): T =>
            activeParams?.peHorizon === '5Y' && smart.pe5 ? { ...smart, pe: smart.pe5 } : smart;

        const dcfSafety = calculateDcfFairValue(withHorizon(smartConservative), curPrice);
        const dcfQuality = calculateDcfFairValue(withHorizon(smartQuality), curPrice);

        let fairValue = 0;
        if (fairValueMode === 'manual') {
            const manualDcf =
                activeParams && Number(activeParams.eps) > 0
                    ? calculateDcfFairValue(activeParams, curPrice)
                    : null;
            fairValue =
                activeParams?.manualFairValue && Number(activeParams.manualFairValue) > 0
                    ? Number(activeParams.manualFairValue)
                    : manualDcf
                        ? manualDcf.fairValue
                        : stock.fairValue || 0;
        } else if (fairValueMode === 'quality') {
            const qParams =
                !isEtfItem && activeParams?.valuationMode === 'quality' && !activeParams?.isCustom && Number(activeParams?.eps) > 0
                    ? activeParams
                    : withHorizon(smartQuality);
            fairValue = calculateDcfFairValue(qParams, curPrice).fairValue;
        } else if (fairValueMode === 'risk') {
            const rParams =
                !isEtfItem && activeParams?.valuationMode === 'risk' && !activeParams?.isCustom && Number(activeParams?.eps) > 0
                    ? activeParams
                    : withHorizon(smartRisk);
            fairValue = calculateDcfFairValue(rParams, curPrice).fairValue;
        } else {
            const cParams =
                !isEtfItem && activeParams?.valuationMode === 'conservative' && !activeParams?.isCustom && Number(activeParams?.eps) > 0
                    ? activeParams
                    : withHorizon(smartConservative);
            fairValue = calculateDcfFairValue(cParams, curPrice).fairValue;
        }

        const fairValueGapPct = fairValue > 0 ? ((curPrice - fairValue) / fairValue) * 100 : null;

        // Effective Buy Limit & Color Mode
        const explicitTarget = stock.targetPrice && stock.targetPrice > 0 ? stock.targetPrice : null;
        const effectiveBuyLimit = explicitTarget ?? (matchingBuyOrder && matchingBuyOrder.limitPrice > 0 ? matchingBuyOrder.limitPrice : null);
        const buyLimitType: TradeRadarItem['buyLimitType'] = explicitTarget
            ? (savedTargetType || fairValueMode)
            : matchingBuyOrder
                ? 'order'
                : null;
        const buyLimitColorMode: RadarProfileMode =
            buyLimitType === 'fairValue'
                ? fairValueMode
                : buyLimitType === 'quality' || buyLimitType === 'risk' || buyLimitType === 'conservative' || buyLimitType === 'manual'
                    ? buyLimitType
                    : 'manual';

        const buyGapPct = effectiveBuyLimit && effectiveBuyLimit > 0
            ? ((curPrice - effectiveBuyLimit) / effectiveBuyLimit) * 100
            : null;

        // Effective Sell Limit
        const explicitSell = stock.sellLimit && stock.sellLimit > 0 ? stock.sellLimit : null;
        const effectiveSellLimit = explicitSell ?? (matchingSellOrder && matchingSellOrder.limitPrice > 0 ? matchingSellOrder.limitPrice : null);
        const savedSellLimitType = stock.sellLimitType || stock.fairValueParams?.sellLimitType || (activeParams as any)?.sellLimitType || null;
        const sellLimitType: TradeRadarItem['sellLimitType'] = explicitSell
            ? (savedSellLimitType || 'manual')
            : matchingSellOrder
                ? 'order'
                : null;
        const hasExplicitSellLimit = Boolean(effectiveSellLimit && effectiveSellLimit > 0);
        const sellGapPct = effectiveSellLimit && effectiveSellLimit > 0
            ? ((curPrice - effectiveSellLimit) / effectiveSellLimit) * 100
            : null;

        // Technical levels
        const gd50 = typeof stock.fiftyDayAverage === 'number' && stock.fiftyDayAverage > 0 ? stock.fiftyDayAverage : null;
        const gd200 = typeof stock.twoHundredDayAverage === 'number' && stock.twoHundredDayAverage > 0 ? stock.twoHundredDayAverage : null;
        const high52 = typeof stock.fiftyTwoWeekHigh === 'number' && stock.fiftyTwoWeekHigh > 0 ? stock.fiftyTwoWeekHigh : null;
        const low52 = typeof stock.fiftyTwoWeekLow === 'number' && stock.fiftyTwoWeekLow > 0 ? stock.fiftyTwoWeekLow : null;
        const drawdownFrom52wHighPct = high52 ? ((curPrice - high52) / high52) * 100 : null;

        const supportZones = computeStockSupportZones({
            currentPrice: curPrice,
            dcfSafety,
            dcfQuality,
            fiftyDayAverage: gd50,
            twoHundredDayAverage: gd200,
            fiftyTwoWeekHigh: high52,
            fiftyTwoWeekLow: low52
        });

        // Position stats
        const shares = pos ? pos.shares : 0;
        const buyPriceAvg = pos && pos.buyPriceAvg > 0 ? pos.buyPriceAvg : null;
        const positionGainPct = buyPriceAvg ? ((curPrice - buyPriceAvg) / buyPriceAvg) * 100 : null;

        // 1. Kauflimit erreicht
        const isBuyLimitReached = Boolean(effectiveBuyLimit && curPrice <= effectiveBuyLimit);
        const buyLimitLabelShort =
            buyLimitType === 'quality'
                ? 'Limit B'
                : buyLimitType === 'risk'
                    ? 'Limit C'
                    : buyLimitType === 'fairValue'
                        ? 'Fairer Wert'
                        : buyLimitType === 'manual'
                            ? 'Manuell'
                            : buyLimitType === 'order'
                                ? 'Kaufauftrag'
                                : 'Limit A';
        const buyLimitReason = isBuyLimitReached && buyGapPct !== null
            ? `Kurs ≤ ${buyLimitLabelShort} · ${buyGapPct <= -0.05 ? `${buyGapPct.toFixed(1)} %` : 'erreicht'}`
            : null;

        // 2. Kaufzone 1 / 2 / 3 (rein echte Korrektur- & Unterstützungszonen — keine Geister-Treffer am 52W-Hoch!)
        let buyZone: RadarBuyZone = null;
        let buyZoneReason: string | null = null;

        const hasMeaningfulRange = Boolean(low52 && high52 && high52 / low52 >= 1.15);

        // Kaufzone 3 (Crash): ab -30 % vom 52W-Hoch ODER mind. -15 % unter GD 200
        const isCrashDrawdown = Boolean(
            drawdownFrom52wHighPct !== null &&
            drawdownFrom52wHighPct <= -30
        );
        const isDeepBelowGd200 = Boolean(
            gd200 && curPrice <= gd200 * 0.85
        );

        // Kaufzone 2 (Nachkauf): -20 % bis -30 % vom 52W-Hoch, direkt am 52W-Tief oder GD200-Test im Rücksetzer (ab -12 %)
        const isZone2Drawdown = Boolean(
            drawdownFrom52wHighPct !== null &&
            drawdownFrom52wHighPct <= -20 &&
            drawdownFrom52wHighPct > -30
        );
        const isNear52wLow = Boolean(hasMeaningfulRange && low52 && curPrice <= low52 * 1.04);
        const isAtGd200Support = Boolean(
            gd200 &&
            curPrice <= gd200 * 1.015 &&
            drawdownFrom52wHighPct !== null &&
            drawdownFrom52wHighPct <= -12
        );

        // Kaufzone 1 (Einstieg): knapp vor deinem Kauflimit (≤ 4 %), oder moderater Rücksetzer (-10 % bis -20 %) an GD50 / unter Fairem Wert
        const isApproachingBuyLimit = buyGapPct !== null && buyGapPct > 0 && buyGapPct <= 4.0;
        const isUnderFairValuePullback = Boolean(
            fairValue > 0 &&
            curPrice <= fairValue &&
            drawdownFrom52wHighPct !== null &&
            drawdownFrom52wHighPct <= -10
        );
        const isAtGd50Pullback = Boolean(
            gd50 &&
            curPrice <= gd50 * 1.01 &&
            drawdownFrom52wHighPct !== null &&
            drawdownFrom52wHighPct <= -10
        );

        if (isCrashDrawdown) {
            buyZone = 3;
            buyZoneReason = `Abverkauf ${drawdownFrom52wHighPct!.toFixed(1)} % vom 52W-Hoch`;
        } else if (isDeepBelowGd200) {
            buyZone = 3;
            buyZoneReason = `Stark unter GD 200 (${(((curPrice - gd200!) / gd200!) * 100).toFixed(1)} %)`;
        } else if (isZone2Drawdown) {
            buyZone = 2;
            buyZoneReason = `Rücksetzer ${drawdownFrom52wHighPct!.toFixed(1)} % vom 52W-Hoch`;
        } else if (isNear52wLow) {
            buyZone = 2;
            buyZoneReason = 'Direkt am 52-Wochen-Tief';
        } else if (isAtGd200Support) {
            buyZone = 2;
            buyZoneReason = 'Unterstützungstest an der GD 200';
        } else if (isApproachingBuyLimit) {
            buyZone = 1;
            buyZoneReason = `Noch +${buyGapPct!.toFixed(1)} % bis ${buyLimitLabelShort}`;
        } else if (isUnderFairValuePullback) {
            buyZone = 1;
            buyZoneReason =
                fairValueGapPct !== null && fairValueGapPct < -0.5
                    ? `${Math.abs(fairValueGapPct).toFixed(1)} % unter Fairem Wert im Rücksetzer`
                    : 'Am Fairen Wert im Rücksetzer';
        } else if (isAtGd50Pullback) {
            buyZone = 1;
            buyZoneReason = `GD50-Test · ${drawdownFrom52wHighPct!.toFixed(1)} % vom 52W-Hoch`;
        }

        // 2b. 200-Tage-Linie (GD 200) unterschritten
        const isBelowSma200 = Boolean(gd200 && curPrice < gd200);
        const sma200GapPct = gd200 && gd200 > 0 ? ((curPrice - gd200) / gd200) * 100 : null;
        const sma200Reason = isBelowSma200 && gd200 && sma200GapPct !== null
            ? `${sma200GapPct.toFixed(1)} % unter GD 200 · ${gd200.toLocaleString('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${displayCurrency}`
            : null;

        // 3. Verkaufszone Anlauf / erreicht — STRIKT nur für Titel im Bestand!
        // (Reine Watchlist-Titel ohne Bestand können nicht verkauft werden.)
        let sellStatus: RadarSellStatus = null;
        let sellSource: 'limit' | 'valuation' | null = null;
        let sellReason: string | null = null;

        if (inPortfolio) {
            if (hasExplicitSellLimit && effectiveSellLimit && sellGapPct !== null) {
                if (curPrice >= effectiveSellLimit) {
                    sellStatus = 'reached';
                    sellSource = 'limit';
                    sellReason = sellGapPct >= 0.1
                        ? `Verkaufslimit erreicht · +${sellGapPct.toFixed(1)} %`
                        : 'Verkaufslimit erreicht';
                } else if (curPrice >= effectiveSellLimit * 0.93) {
                    sellStatus = 'approaching';
                    sellSource = 'limit';
                    sellReason = `Noch ${Math.abs(sellGapPct).toFixed(1)} % bis Verkaufslimit`;
                }
            } else {
                // Automatische Gewinnmitnahme-/Überbewertungs-Zone nur für echte Bestandspositionen ohne manuelles VK-Limit
                const notInPullback =
                    buyZone === null &&
                    !isBuyLimitReached &&
                    (drawdownFrom52wHighPct === null || drawdownFrom52wHighPct > -10);

                if (notInPullback) {
                    if (assetType === 'etf') {
                        // Breite ETFs steigen langfristig immer wieder auf neue Hochs:
                        // Ohne manuelles VK-Limit kein Fehlalarm wegen Buchgewinn am 52W-Hoch, sondern erst bei echter Index-Überhitzung
                        if (fairValueGapPct !== null && fairValueGapPct >= 45) {
                            sellStatus = 'reached';
                            sellSource = 'valuation';
                            sellReason = `ETF stark überhitzt · +${fairValueGapPct.toFixed(0)} % über FW · Rebalancing prüfen`;
                        } else if (fairValueGapPct !== null && fairValueGapPct >= 30) {
                            sellStatus = 'approaching';
                            sellSource = 'valuation';
                            sellReason = `ETF überhitzt · +${fairValueGapPct.toFixed(0)} % über FW · Rebalancing prüfen`;
                        }
                    } else if (fairValueGapPct !== null && fairValueGapPct >= 45) {
                        sellStatus = 'reached';
                        sellSource = 'valuation';
                        sellReason = `Stark überbewertet · +${fairValueGapPct.toFixed(0)} % über Fairer Wert`;
                    } else if (
                        positionGainPct !== null &&
                        positionGainPct >= 25 &&
                        high52 &&
                        curPrice >= high52 * 0.98 &&
                        fairValueGapPct !== null &&
                        fairValueGapPct >= 20
                    ) {
                        sellStatus = 'reached';
                        sellSource = 'valuation';
                        sellReason = `Am 52W-Hoch · +${positionGainPct.toFixed(0)} % im Plus`;
                    } else if (fairValueGapPct !== null && fairValueGapPct >= 25) {
                        sellStatus = 'approaching';
                        sellSource = 'valuation';
                        sellReason = `Läuft in Überbewertung · +${fairValueGapPct.toFixed(0)} % über Fairer Wert`;
                    } else if (
                        positionGainPct !== null &&
                        positionGainPct >= 15 &&
                        high52 &&
                        curPrice >= high52 * 0.96 &&
                        fairValueGapPct !== null &&
                        fairValueGapPct >= 12
                    ) {
                        sellStatus = 'approaching';
                        sellSource = 'valuation';
                        sellReason = `Nahe 52W-Hoch · +${positionGainPct.toFixed(0)} % im Plus`;
                    }
                }
            }
        }

        const isOvervaluedWatchlist = Boolean(
            !inPortfolio &&
            !hasExplicitSellLimit &&
            buyZone === null &&
            !isBuyLimitReached &&
            fairValueGapPct !== null &&
            fairValueGapPct >= 45
        );

        const hasAnySignal = Boolean(isBuyLimitReached || buyZone !== null || isBelowSma200 || sellStatus !== null);

        // Priority sort score (highest urgency first)
        let urgencyScore = 0;
        if (sellStatus === 'reached' && sellSource === 'limit') urgencyScore += 120;
        else if (isBuyLimitReached) urgencyScore += 110;
        else if (sellStatus === 'reached') urgencyScore += 95;
        else if (buyZone === 3) urgencyScore += 85;
        else if (sellStatus === 'approaching' && sellSource === 'limit') urgencyScore += 80;
        else if (buyZone === 2) urgencyScore += 70;
        else if (sellStatus === 'approaching') urgencyScore += 55;
        else if (buyZone === 1) urgencyScore += 45;
        else if (isBelowSma200) urgencyScore += 35;
        if (inPortfolio) urgencyScore += 5;

        items.push({
            stock,
            assetType,
            etfDistribution: isEtfItem ? (smartConservative as any).etfDistribution : undefined,
            inPortfolio,
            shares,
            buyPriceAvg,
            positionGainPct,
            watchlistIds: wlInfo?.ids || [],
            watchlistNames: wlInfo?.names || [],
            currentPrice: curPrice,
            displayCurrency,
            dayChangePct,
            fairValue,
            fairValueMode,
            fairValueGapPct,
            effectiveBuyLimit,
            buyLimitType,
            buyLimitColorMode,
            buyGapPct,
            effectiveSellLimit,
            sellLimitType,
            hasExplicitSellLimit,
            sellGapPct,
            drawdownFrom52wHighPct,
            fiftyTwoWeekHigh: high52,
            fiftyTwoWeekLow: low52,
            fiftyDayAverage: gd50,
            twoHundredDayAverage: gd200,
            supportZones,
            isBuyLimitReached,
            buyLimitReason,
            buyZone,
            buyZoneReason,
            isBelowSma200,
            sma200GapPct,
            sma200Reason,
            sellStatus,
            sellSource,
            sellReason,
            isOvervaluedWatchlist,
            hasAnySignal,
            urgencyScore
        });
    }

    // Sort by urgency descending, then name ascending
    items.sort((a, b) => {
        if (b.urgencyScore !== a.urgencyScore) return b.urgencyScore - a.urgencyScore;
        return (a.stock.name || a.stock.symbol).localeCompare(b.stock.name || b.stock.symbol, 'de', { sensitivity: 'base' });
    });

    const counts = {
        allSignals: items.filter(i => i.hasAnySignal).length,
        buyLimit: items.filter(i => i.isBuyLimitReached).length,
        zone1: items.filter(i => i.buyZone === 1).length,
        zone2: items.filter(i => i.buyZone === 2).length,
        zone3: items.filter(i => i.buyZone === 3).length,
        belowSma200: items.filter(i => i.isBelowSma200).length,
        sellApproaching: items.filter(i => i.sellStatus === 'approaching').length,
        sellReached: items.filter(i => i.sellStatus === 'reached').length,
        allAssets: items.length
    };

    return { items, counts };
}

export function resolveRadarInitialSource(params: {
    stock: Pick<Stock, 'id' | 'symbol' | 'name'> | null | undefined;
    stocks: Stock[];
    positions: Position[];
    watchlists: Watchlist[];
    tradeMode?: 'buy' | 'sell';
    fallbackToSearch?: boolean;
}): { sourceFilter: string; searchTerm: string } {
    const { stock, stocks, positions, watchlists, tradeMode = 'buy', fallbackToSearch = false } = params;
    if (tradeMode === 'sell') {
        if (!stock) {
            return { sourceFilter: 'portfolio_all', searchTerm: '' };
        }
        const symLower = (stock.symbol || '').trim().toLowerCase();
        const matchingIds = new Set<string>([String(stock.id)]);
        if (symLower) {
            for (const s of stocks) {
                if ((s.symbol || '').trim().toLowerCase() === symLower) {
                    matchingIds.add(String(s.id));
                }
            }
        }
        const isInPortfolio = positions.some(
            p => p.shares > 0 && matchingIds.has(String(p.stockId))
        );
        if (!isInPortfolio) {
            return { sourceFilter: 'portfolio_all', searchTerm: '' };
        }
        const matchingWatchlists = watchlists.filter(wl =>
            (wl.stockIds || []).some(sid => matchingIds.has(String(sid)))
        );
        let lastActiveTab: string | null = null;
        try {
            lastActiveTab = localStorage.getItem('watchlist_active_tab');
        } catch {
            lastActiveTab = null;
        }
        const lastActiveMatch = lastActiveTab
            ? matchingWatchlists.find(wl => wl.id === lastActiveTab)
            : undefined;
        if (lastActiveMatch) {
            return { sourceFilter: `wl:${lastActiveMatch.id}`, searchTerm: '' };
        }
        return { sourceFilter: 'portfolio_all', searchTerm: '' };
    }
    if (!stock) {
        return { sourceFilter: 'all', searchTerm: '' };
    }

    const symLower = (stock.symbol || '').trim().toLowerCase();
    const matchingIds = new Set<string>([String(stock.id)]);
    if (symLower) {
        for (const s of stocks) {
            if ((s.symbol || '').trim().toLowerCase() === symLower) {
                matchingIds.add(String(s.id));
            }
        }
    }

    const matchingWatchlists = watchlists.filter(wl =>
        (wl.stockIds || []).some(sid => matchingIds.has(String(sid)))
    );
    const isInPortfolio = positions.some(
        p => p.shares > 0 && matchingIds.has(String(p.stockId))
    );

    let lastActiveTab: string | null = null;
    try {
        lastActiveTab = localStorage.getItem('watchlist_active_tab');
    } catch {
        lastActiveTab = null;
    }

    const lastActiveMatch = lastActiveTab
        ? matchingWatchlists.find(wl => wl.id === lastActiveTab)
        : undefined;

    if (lastActiveMatch) {
        return { sourceFilter: `wl:${lastActiveMatch.id}`, searchTerm: '' };
    }
    if (lastActiveTab === 'owned' && isInPortfolio) {
        return { sourceFilter: 'portfolio_all', searchTerm: '' };
    }
    if (matchingWatchlists.length > 0) {
        return { sourceFilter: `wl:${matchingWatchlists[0].id}`, searchTerm: '' };
    }
    if (isInPortfolio) {
        return { sourceFilter: 'portfolio_all', searchTerm: '' };
    }

    return {
        sourceFilter: 'all',
        searchTerm: fallbackToSearch ? (stock.symbol || stock.name || '') : ''
    };
}
