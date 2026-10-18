// Shared Fair Value calculation and Smart Auto-Parameter helpers

export const FUNDAMENTAL_FALLBACKS: Record<string, { eps: number; growth: number; pe: number; div?: number; mos?: number; label: string }> = {
    'AMZN': { eps: 7.17, growth: 12.0, pe: 20.0, div: 0, mos: 15, label: 'TTM' },
    'MSFT': { eps: 17.95, growth: 13.0, pe: 20.0, div: 0.79, mos: 15, label: 'TTM Bereinigt (Analysten)' },
    'KHC': { eps: 2.60, growth: 2.0, pe: 11.5, div: 6.8, mos: 20, label: 'Operativ / Bereinigt' },
    'BATS.L': { eps: 3.62, growth: 3.0, pe: 11.5, mos: 20, label: 'Bereinigt (Adj. EPS)' },
    'BTI': { eps: 4.65, growth: 3.0, pe: 11.5, mos: 20, label: 'Bereinigt (Adj. EPS)' },
    'NESN.SW': { eps: 4.60, growth: 5.0, pe: 17.0, mos: 15, label: 'Bereinigt (Underlying)' },
    'NESN': { eps: 4.60, growth: 5.0, pe: 17.0, mos: 15, label: 'Bereinigt (Underlying)' },
    'ROG.SW': { eps: 18.80, growth: 5.5, pe: 16.5, mos: 15, label: 'Core EPS (Bereinigt)' },
    'NOVN.SW': { eps: 6.80, growth: 5.5, pe: 16.0, mos: 15, label: 'Core EPS (Bereinigt)' },
    'O': { eps: 4.20, growth: 3.5, pe: 15.0, mos: 15, label: 'AFFO (Cashflow)' },
    'SREN.SW': { eps: 16.42, growth: 2.5, pe: 9.5, div: 4.82, mos: 20, label: 'Konsens EPS' },
    'SREN': { eps: 16.42, growth: 2.5, pe: 9.5, div: 4.82, mos: 20, label: 'Konsens EPS' },
    'ZURN.SW': { eps: 35.0, growth: 4.0, pe: 11.5, div: 5.2, mos: 15, label: 'Konsens EPS' },
    'ZURN': { eps: 35.0, growth: 4.0, pe: 11.5, div: 5.2, mos: 15, label: 'Konsens EPS' },
    'BRK-B': { eps: 21.0, growth: 8.5, pe: 18.0, div: 0, mos: 15, label: 'Operativer Gewinn' },
    'BRK.B': { eps: 21.0, growth: 8.5, pe: 18.0, div: 0, mos: 15, label: 'Operativer Gewinn' },
    'TSLA': { eps: 3.50, growth: 22.0, pe: 38.0, div: 0, mos: 20, label: 'Konsens EPS (Forward 2025/26)' },
};

export const WIDE_MOAT_QUALITY = new Set([
    'AAPL', 'MSFT', 'GOOGL', 'GOOG', 'AMZN', 'NVDA', 'META', 'TSLA', 'V', 'MA',
    'PG', 'KO', 'PEP', 'JNJ', 'MCD', 'COST', 'WMT', 'ABBV', 'LLY', 'UNH', 'HD',
    'ASML.AS', 'ASML', 'SAP.DE', 'SAP', 'NESN.SW', 'ROG.SW', 'NOVN.SW', 'LIN', 'OR.PA',
    'SREN.SW', 'SREN', 'ZURN.SW', 'ZURN',
    'BRK-B', 'BRK.B', 'BRK-A', 'BRK.A'
]);

export function computeSmartAutoParams(
    qData: any,
    aData: any,
    stockObj: any,
    symbolStr: string,
    valuationMode: 'conservative' | 'quality' = 'conservative'
) {
    const symUpper = (symbolStr || '').toUpperCase();
    const isWideMoat = WIDE_MOAT_QUALITY.has(symUpper);
    const isQualityMode = valuationMode === 'quality';
    const price = qData?.price || stockObj?.currentPrice || 0;
    const preset = FUNDAMENTAL_FALLBACKS[symUpper];

    // 1. Dividend Yield (%)
    let autoDiv = 0;
    if (qData?.dividendYield !== null && qData?.dividendYield !== undefined && qData.dividendYield >= 0) {
        autoDiv = Number(qData.dividendYield);
    } else if (stockObj?.dividendYield !== undefined && stockObj.dividendYield >= 0) {
        autoDiv = Number(stockObj.dividendYield);
    } else if (preset?.div !== undefined) {
        autoDiv = preset.div;
    }
    autoDiv = parseFloat(Math.min(Math.max(autoDiv, 0), 25).toFixed(2));

    // 2. Smart EPS (protect against negative/zero or restructuring-depressed GAAP/IFRS TTM EPS)
    let trailingPE = qData?.trailingPE || stockObj?.trailingPE || null;
    let forwardPE = qData?.forwardPE || aData?.forwardPE || stockObj?.forwardPE || null;
    const kcv = qData?.kcv || aData?.kcv || stockObj?.kcv || null;

    const rawEps = qData?.eps ?? aData?.eps ?? stockObj?.eps ?? null;
    // Fix London Stock Exchange (GBp / Pence) 100x P/E distortion (e.g. 1276.71 -> 12.77)
    if (trailingPE && trailingPE > 150 && (symUpper.endsWith('.L') || (price > 0 && rawEps && rawEps > 0 && (price / rawEps) < 60))) {
        trailingPE = trailingPE / 100;
    }
    if (forwardPE && forwardPE > 150 && (symUpper.endsWith('.L') || (price > 0 && rawEps && rawEps > 0 && (price / rawEps) < 60))) {
        forwardPE = forwardPE / 100;
    }

    const forwardEps = qData?.forwardEps ?? stockObj?.forwardEps ?? (price > 0 && forwardPE && forwardPE > 0 ? price / forwardPE : null);

    let autoEps = 0;
    let epsLabel = qData?.epsSource || 'TTM';

    if (symUpper.startsWith('BRK-') || symUpper.startsWith('BRK.') || symUpper === 'BRK') {
        autoEps = preset?.eps || 21.0;
        epsLabel = 'Operativer Gewinn (Buffett)';
    } else if (preset && (!rawEps || rawEps <= 0 || rawEps < preset.eps * 0.85)) {
        autoEps = preset.eps;
        epsLabel = preset.label;
    } else if (rawEps && rawEps > 0 && (!forwardEps || rawEps >= forwardEps * 0.88)) {
        autoEps = rawEps;
        epsLabel = qData?.epsSource || 'TTM';
    } else if (forwardEps && forwardEps > 0) {
        autoEps = forwardEps;
        epsLabel = 'Forward / Bereinigt';
    } else if (price > 0 && trailingPE && trailingPE > 0) {
        autoEps = price / trailingPE;
        epsLabel = 'Aus KGV berechnet';
    } else if (price > 0 && kcv && kcv > 0) {
        autoEps = (price / kcv) * 0.75;
        epsLabel = 'Cashflow-Schätzung';
    } else if (preset?.eps) {
        autoEps = preset.eps;
        epsLabel = preset.label;
    } else if (price > 0) {
        const estMultiple = autoDiv >= 4.5 ? 11 : autoDiv >= 2.5 ? 16 : 18;
        autoEps = price / estMultiple;
        epsLabel = 'Markt-Schätzung';
    }

    autoEps = parseFloat(Number(autoEps).toFixed(2));

    // Effective P/E for classification
    const effectivePe = (forwardPE && forwardPE > 0)
        ? forwardPE
        : (trailingPE && trailingPE > 0 && trailingPE < 60)
            ? trailingPE
            : (price > 0 && autoEps > 0 ? price / autoEps : 15);

    // 3. Smart 5Y Growth Rate (%)
    const rawApiGrowth = qData?.growthRate ?? aData?.growthRate ?? null;
    let autoGrowth = 6.0;
    let growthLabel = 'Fundamental-Profil';

    if (symUpper === 'TSLA') {
        autoGrowth = isQualityMode ? 26.0 : 22.0;
        growthLabel = isQualityMode ? 'KI / Robotaxi Wachstums-Szenario' : 'Konsens-Prognose (Sicherheit)';
    } else if (preset) {
        autoGrowth = isQualityMode
            ? parseFloat((preset.growth + (preset.growth <= 3.5 ? 1.0 : preset.growth <= 7.0 ? 0.5 : preset.growth >= 18.0 ? 2.0 : 1.0)).toFixed(1))
            : preset.growth;
        growthLabel = isQualityMode ? 'Qualitäts-/Marktprofil' : 'Qualitäts-/Branchenprofil';
    } else if (rawApiGrowth !== null && rawApiGrowth !== undefined && isFinite(rawApiGrowth) && rawApiGrowth !== 0) {
        let apiPct = rawApiGrowth * 100;
        if (autoDiv >= 4.5 && effectivePe < 14) {
            apiPct = Math.min(Math.max(apiPct, 2.5), isQualityMode ? 5.0 : 4.0);
            growthLabel = isQualityMode ? 'Prognose (Markt)' : 'Prognose (Konservativ)';
        } else if (autoDiv >= 3.0 && effectivePe < 18) {
            apiPct = Math.min(Math.max(apiPct, 3.0), isQualityMode ? 8.5 : 7.0);
            growthLabel = isQualityMode ? 'Analysten-Prognose (Markt)' : 'Analysten-Prognose (5J)';
        } else {
            apiPct = Math.min(Math.max(apiPct, 2.5), isQualityMode ? 16.0 : 14.0);
            growthLabel = isQualityMode ? 'Analysten-Prognose (Markt)' : 'Analysten-Prognose (5J)';
        }
        autoGrowth = parseFloat((Math.round(apiPct * 2) / 2).toFixed(1));
    } else {
        if ((autoDiv >= 4.8 && effectivePe <= 14) || effectivePe <= 11.5) {
            autoGrowth = isQualityMode ? 3.5 : 2.5;
            growthLabel = 'Reifer Dividendenwert';
        } else if (autoDiv >= 3.0 && effectivePe <= 17.5) {
            autoGrowth = isQualityMode ? 6.0 : 5.0;
            growthLabel = 'Klassischer Dividendenwert';
        } else if (autoDiv >= 1.5 && effectivePe <= 23) {
            autoGrowth = isQualityMode ? 7.5 : 6.0;
            growthLabel = 'Qualitäts-/Standardwert';
        } else if (effectivePe > 24 && autoDiv < 1.5) {
            autoGrowth = isWideMoat ? (isQualityMode ? 14.5 : 12.5) : (isQualityMode ? 11.5 : 9.5);
            growthLabel = isWideMoat ? 'Wachstumswert (Wide Moat)' : 'Wachstumswert';
        } else {
            autoGrowth = isQualityMode ? 7.0 : 5.5;
            growthLabel = 'Standard-Profil';
        }
    }

    // 4. Smart Exit P/E (Verkaufs-KGV in 5J)
    let rawExitPe = 15;
    if (preset) {
        rawExitPe = preset.pe;
    } else if (trailingPE && trailingPE > 0 && forwardPE && forwardPE > 0) {
        if (trailingPE > forwardPE * 1.4) {
            rawExitPe = forwardPE;
        } else {
            rawExitPe = (trailingPE + forwardPE) / 2;
        }
    } else if (forwardPE && forwardPE > 0) {
        rawExitPe = forwardPE;
    } else if (trailingPE && trailingPE > 0) {
        rawExitPe = trailingPE;
    } else if (price > 0 && autoEps > 0) {
        rawExitPe = price / autoEps;
    }

    // Determine sector characteristics
    const currencyStr = (qData?.currency || stockObj?.currency || '').toUpperCase();
    const sectorStr = (qData?.sector || stockObj?.sector || '').toLowerCase();
    const isDefensiveSector = sectorStr.includes('konsum') || sectorStr.includes('consumer') || sectorStr.includes('nahrung') || sectorStr.includes('pharma') || sectorStr.includes('gesundheit') || sectorStr.includes('health') || sectorStr.includes('versicherung') || sectorStr.includes('insurance') || sectorStr.includes('rückversicherung') || sectorStr.includes('reinsurance');
    const isCyclicalSector = sectorStr.includes('semi') || sectorStr.includes('halbleiter') || sectorStr.includes('auto') || sectorStr.includes('chemie') || sectorStr.includes('basic materials') || sectorStr.includes('rohstoff') || sectorStr.includes('cyclical') || sectorStr.includes('zyklisch');
    const isSwissBlueChip = symUpper.endsWith('.SW') || currencyStr === 'CHF';

    // Caps
    // Mode A (conservative / safety): capped at 20.0 so Terminal Growth strictly <= 2.0%
    // Mode B (quality / market): allows historical quality multiple premium (e.g. 25 for Big Tech compounders, 18.5 for Nestlé)
    let maxSensibleExitPe = isQualityMode ? 25.0 : 20.0;
    if (symUpper === 'TSLA') {
        maxSensibleExitPe = isQualityMode ? 50.0 : 38.0;
    } else if (autoDiv >= 4.8) {
        // High dividend / mature value (e.g. Tobacco, Utilities, Kraft Heinz, Swiss Re)
        maxSensibleExitPe = isQualityMode ? 13.5 : Math.min(13.0, Math.max(10.0, effectivePe < 14 ? effectivePe : 12.0));
    } else if (autoDiv >= 3.0) {
        // Classic mature defensive dividend stock (e.g. Nestlé, Roche, Novartis, Coca-Cola)
        maxSensibleExitPe = isQualityMode ? 18.5 : Math.min(17.0, Math.max(14.0, effectivePe < 18 ? effectivePe : 16.5));
    } else if (autoDiv >= 1.5) {
        // Quality dividend compounder (e.g. Pepsi, P&G, McD)
        maxSensibleExitPe = isQualityMode ? 20.0 : Math.min(18.5, Math.max(15.0, effectivePe < 20 ? effectivePe : 18.0));
    } else if (isWideMoat || (effectivePe > 24 && autoDiv < 1.5)) {
        // Quality Tech / Growth (e.g. Microsoft, Amazon, Google, Apple)
        maxSensibleExitPe = isQualityMode ? 25.0 : 20.0;
    } else {
        // Standard profile
        maxSensibleExitPe = isQualityMode ? 20.0 : Math.min(18.0, Math.max(14.0, effectivePe));
    }

    if (isQualityMode) {
        if (preset) {
            if (symUpper === 'AMZN' || symUpper === 'MSFT') {
                rawExitPe = 25.0;
            } else if (symUpper === 'TSLA') {
                rawExitPe = 48.0;
            } else if (symUpper.startsWith('BRK-') || symUpper.startsWith('BRK.') || symUpper === 'BRK') {
                rawExitPe = 21.0;
            } else if (symUpper === 'NESN.SW' || symUpper === 'NESN') {
                rawExitPe = 18.5;
            } else if (symUpper === 'ROG.SW') {
                rawExitPe = 18.0;
            } else if (symUpper.startsWith('SREN')) {
                rawExitPe = 11.5;
            } else if (symUpper.startsWith('ZURN')) {
                rawExitPe = 13.0;
            } else {
                rawExitPe = Math.min(preset.pe + 2.0, maxSensibleExitPe);
            }
        } else {
            // General stocks without preset:
            // Mode B allows a fair normalized quality multiple (+1.5 to 2.5 PE points)
            const qualityBoost = autoDiv >= 4.5 ? 2.0 : isWideMoat ? 3.0 : 2.0;
            const floorMultiple = (isSwissBlueChip || isDefensiveSector) ? 11.5 : 10.0;
            rawExitPe = Math.min(Math.max(rawExitPe + qualityBoost, floorMultiple), maxSensibleExitPe);
        }
    } else {
        if (preset) {
            rawExitPe = preset.pe;
        }
    }

    const autoPe = parseFloat((Math.round(Math.min(Math.max(rawExitPe, 8), maxSensibleExitPe) * 2) / 2).toFixed(1));

    // 5. Smart Margin of Safety (15% for Swiss / defensive / wide-moat quality blue-chips, 20% standard, 25% cyclicals)
    let autoMos = 20;
    if (preset?.mos !== undefined) {
        autoMos = isQualityMode
            ? (isSwissBlueChip || isWideMoat ? 15 : preset.mos)
            : (preset.mos <= 15 ? 15 : 20);
    } else if (isQualityMode && (isSwissBlueChip || isWideMoat || isDefensiveSector)) {
        // In Quality Mode: Top-tier Swiss bluechips, Wide Moats and defensive leaders have 15% Margin of Safety!
        autoMos = 15;
    } else if (isWideMoat || ((isSwissBlueChip || isDefensiveSector) && autoPe >= 14 && autoDiv >= 1.5 && autoDiv <= 4.8)) {
        autoMos = 15;
    } else if (isCyclicalSector) {
        autoMos = 25;
    } else {
        autoMos = 20;
    }

    return {
        eps: autoEps,
        growthRate: autoGrowth,
        pe: autoPe,
        dividendYield: autoDiv,
        discountRate: 8,
        mos: autoMos,
        epsLabel,
        growthLabel: isQualityMode ? `${growthLabel} (Markt)` : `${growthLabel} (Sicherheit)`,
        valuationMode
    };
}

export function calculateDcfFairValue(
    params: { eps: number; growthRate: number; pe: number; dividendYield?: number; discountRate?: number; mos?: number },
    currentPrice: number
) {
    const valEps = Number(params.eps) || 0;
    const valGrowth = Number(params.growthRate) || 0;
    const valPe = Number(params.pe) || 0;
    const valDiv = Number(params.dividendYield) || 0;
    const valDisc = Number(params.discountRate) || 8;
    const valMos = Number(params.mos) || 20;

    const futureEps = valEps * Math.pow(1 + valGrowth / 100, 5);
    const futurePrice = futureEps * valPe;

    let totalDiscountedDividends = 0;
    if (valDiv > 0 && currentPrice > 0) {
        const initialAnnualDiv = (valDiv / 100) * currentPrice;
        for (let i = 1; i <= 5; i++) {
            const divInYear = initialAnnualDiv * Math.pow(1 + valGrowth / 100, i);
            totalDiscountedDividends += divInYear / Math.pow(1 + valDisc / 100, i);
        }
    }

    const discountedFuturePrice = futurePrice / Math.pow(1 + valDisc / 100, 5);
    const fairValue = discountedFuturePrice + totalDiscountedDividends;
    const buyPrice = fairValue * (1 - valMos / 100);

    return {
        fairValue,
        buyPrice,
        mos: valMos
    };
}
