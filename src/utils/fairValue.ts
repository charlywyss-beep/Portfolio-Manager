// Shared Fair Value calculation and Smart Auto-Parameter helpers

export const FUNDAMENTAL_FALLBACKS: Record<string, { eps: number; growth: number; pe: number; div?: number; mos?: number; label: string }> = {
    'AMZN': { eps: 12.50, growth: 12.0, pe: 22.0, div: 0, mos: 15, label: 'TTM Bereinigt (Analysten)' },
    'KHC': { eps: 2.60, growth: 2.0, pe: 11.5, div: 6.8, mos: 20, label: 'Operativ / Bereinigt' },
    'BATS.L': { eps: 3.62, growth: 3.0, pe: 11.5, mos: 20, label: 'Bereinigt (Adj. EPS)' },
    'BTI': { eps: 4.65, growth: 3.0, pe: 11.5, mos: 20, label: 'Bereinigt (Adj. EPS)' },
    'NESN.SW': { eps: 4.60, growth: 5.0, pe: 20.0, mos: 15, label: 'Bereinigt (Underlying)' },
    'NESN': { eps: 4.60, growth: 5.0, pe: 20.0, mos: 15, label: 'Bereinigt (Underlying)' },
    'ROG.SW': { eps: 18.80, growth: 5.5, pe: 16.5, mos: 15, label: 'Core EPS (Bereinigt)' },
    'NOVN.SW': { eps: 6.80, growth: 5.5, pe: 16.0, mos: 15, label: 'Core EPS (Bereinigt)' },
    'O': { eps: 4.20, growth: 3.5, pe: 15.0, mos: 15, label: 'AFFO (Cashflow)' },
    'BRK-B': { eps: 21.0, growth: 8.5, pe: 18.0, div: 0, mos: 15, label: 'Operativer Gewinn' },
    'BRK.B': { eps: 21.0, growth: 8.5, pe: 18.0, div: 0, mos: 15, label: 'Operativer Gewinn' },
};

export const WIDE_MOAT_QUALITY = new Set([
    'AAPL', 'MSFT', 'GOOGL', 'GOOG', 'AMZN', 'NVDA', 'META', 'V', 'MA',
    'PG', 'KO', 'PEP', 'JNJ', 'MCD', 'COST', 'WMT', 'ABBV', 'LLY', 'UNH', 'HD',
    'ASML.AS', 'ASML', 'SAP.DE', 'SAP', 'NESN.SW', 'ROG.SW', 'NOVN.SW', 'LIN', 'OR.PA'
]);

export function computeSmartAutoParams(qData: any, aData: any, stockObj: any, symbolStr: string) {
    const symUpper = (symbolStr || '').toUpperCase();
    const isWideMoat = WIDE_MOAT_QUALITY.has(symUpper);
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

    if (preset && (!rawEps || rawEps <= 0 || rawEps < preset.eps * 0.85)) {
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

    if (preset) {
        autoGrowth = preset.growth;
        growthLabel = 'Qualitäts-/Branchenprofil';
    } else if (rawApiGrowth !== null && rawApiGrowth !== undefined && isFinite(rawApiGrowth) && rawApiGrowth !== 0) {
        let apiPct = rawApiGrowth * 100;
        if (autoDiv >= 4.5 && effectivePe < 14) {
            apiPct = Math.min(Math.max(apiPct, 2.5), 4.5);
            growthLabel = 'Prognose (Konservativ)';
        } else if (autoDiv >= 3.0 && effectivePe < 18) {
            apiPct = Math.min(Math.max(apiPct, 3.0), 7.5);
            growthLabel = 'Analysten-Prognose (5J)';
        } else {
            apiPct = Math.min(Math.max(apiPct, 2.5), 15.0);
            growthLabel = 'Analysten-Prognose (5J)';
        }
        autoGrowth = parseFloat((Math.round(apiPct * 2) / 2).toFixed(1));
    } else {
        if ((autoDiv >= 4.8 && effectivePe <= 14) || effectivePe <= 11.5) {
            autoGrowth = autoDiv >= 5.0 && autoDiv < 6.0 ? 3.0 : 2.5;
            growthLabel = 'Reifer Dividendenwert';
        } else if (autoDiv >= 3.0 && effectivePe <= 17.5) {
            autoGrowth = 5.0;
            growthLabel = 'Klassischer Dividendenwert';
        } else if (autoDiv >= 1.5 && effectivePe <= 23) {
            autoGrowth = 6.5;
            growthLabel = 'Qualitäts-/Standardwert';
        } else if (effectivePe > 24 && autoDiv < 1.5) {
            autoGrowth = isWideMoat ? 13.0 : 10.0;
            growthLabel = isWideMoat ? 'Wachstumswert (Wide Moat)' : 'Wachstumswert';
        } else {
            autoGrowth = 6.0;
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

    const ruleOneMax = Math.max(isWideMoat ? 28 : 20, autoGrowth * 2);
    const maxSensibleExitPe = (autoDiv >= 5.0 && effectivePe < 14)
        ? Math.min(13.0, effectivePe)
        : Math.min(isWideMoat ? 30 : (autoGrowth >= 9 ? 25 : 22), isWideMoat ? Math.max(30, ruleOneMax) : ruleOneMax);
    const autoPe = parseFloat((Math.round(Math.min(Math.max(rawExitPe, 8), maxSensibleExitPe) * 2) / 2).toFixed(1));

    // 5. Smart Margin of Safety (15% for Swiss / defensive / wide-moat quality blue-chips, 20% standard)
    const currencyStr = (qData?.currency || stockObj?.currency || '').toUpperCase();
    const sectorStr = (stockObj?.sector || '').toLowerCase();
    const isDefensiveSector = sectorStr.includes('konsum') || sectorStr.includes('consumer') || sectorStr.includes('nahrung') || sectorStr.includes('pharma') || sectorStr.includes('gesundheit') || sectorStr.includes('health');
    const isSwissBlueChip = symUpper.endsWith('.SW') || currencyStr === 'CHF';

    let autoMos = 20;
    if (preset?.mos !== undefined) {
        autoMos = preset.mos;
    } else if (isWideMoat || ((isSwissBlueChip || isDefensiveSector) && autoPe >= 15 && autoDiv >= 1.5 && autoDiv <= 4.8)) {
        autoMos = 15;
    }

    return {
        eps: autoEps,
        growthRate: autoGrowth,
        pe: autoPe,
        dividendYield: autoDiv,
        discountRate: 8,
        mos: autoMos,
        epsLabel,
        growthLabel
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
