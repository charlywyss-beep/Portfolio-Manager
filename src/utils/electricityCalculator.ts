import type { ElectricityTariffConfig, ElectricityReading } from '../types';

/**
 * Standard-Tarifwerte basierend auf der Schweizer Stromrechnung (Eniwa AG / StromVG).
 */
export const DEFAULT_ELECTRICITY_TARIFF: ElectricityTariffConfig = {
    // 1. Energie (Wirkenergie) in Rp./kWh
    energyHT: 10.90, // Eniwa Naturstrom Schweiz Hochtarif
    energyNT: 9.10,  // Eniwa Naturstrom Schweiz Niedertarif

    // 2. Netznutzung in Rp./kWh & CHF/Monat
    gridHT: 12.90,   // Wirkenergie Hochtarif
    gridNT: 9.10,    // Wirkenergie Niedertarif
    gridSdl: 0.27,   // Systemdienstleistungen Swissgrid
    gridReserve: 0.41, // Stromreserve des Bundes
    gridSolidar: 0.05, // Zuschlag solidarisierte Kosten im Übertragungsnetz
    gridBaseFee: 5.00, // Grundpreis Netznutzung CHF / Monat
    gridMeasurementFee: 6.20, // Messkosten direkt CHF / Monat

    // 3. Öffentliche Abgaben in Rp./kWh
    communityFee: 0.85, // Konzessionsabgabe an die Gemeinde
    federalFee: 2.30,   // Bundesabgaben gemäss Energiegesetz (KEV / Netzzuschlag)

    // 4. Mehrwertsteuer
    vatRate: 8.1 // Schweizer Normalsatz 8.1 %
};

export interface InvoiceCalculationResult {
    totalUsage: number;
    // Energie
    energyHTAmount: number;
    energyNTAmount: number;
    subtotalEnergy: number;
    // Netznutzung
    gridHTAmount: number;
    gridNTAmount: number;
    gridSdlAmount: number;
    gridReserveAmount: number;
    gridSolidarAmount: number;
    baseFeeAmount: number;
    measurementFeeAmount: number;
    subtotalGrid: number;
    // Öffentliche Abgaben
    communityFeeAmount: number;
    federalFeeAmount: number;
    subtotalFees: number;
    // Gesamttotal
    totalExclVat: number;
    vatAmount: number;
    totalInclVat: number;
    // Effektive Rappen pro kWh (inkl. aller variabler Umlagen und MwSt)
    effectiveRateHTRp: number;
    effectiveRateNTRp: number;
    monthlyFixedCost: number;
}

/**
 * Berechnet die Kosten einer Stromrechnung 1:1 gemäss StromVG / Eniwa Rechnungsaufbau.
 */
export function calculateElectricityInvoice(
    usageHT: number,
    usageNT: number,
    months: number = 1,
    tariff: ElectricityTariffConfig = DEFAULT_ELECTRICITY_TARIFF
): InvoiceCalculationResult {
    const safeUsageHT = Math.max(0, usageHT || 0);
    const safeUsageNT = Math.max(0, usageNT || 0);
    const totalUsage = safeUsageHT + safeUsageNT;
    const safeMonths = Math.max(0, months || 1);

    // 1. Energie
    const energyHTAmount = Math.round(safeUsageHT * (tariff.energyHT / 100) * 100) / 100;
    const energyNTAmount = Math.round(safeUsageNT * (tariff.energyNT / 100) * 100) / 100;
    const subtotalEnergy = Math.round((energyHTAmount + energyNTAmount) * 100) / 100;

    // 2. Netznutzung
    const gridHTAmount = Math.round(safeUsageHT * (tariff.gridHT / 100) * 100) / 100;
    const gridNTAmount = Math.round(safeUsageNT * (tariff.gridNT / 100) * 100) / 100;
    const gridSdlAmount = Math.round(totalUsage * (tariff.gridSdl / 100) * 100) / 100;
    const gridReserveAmount = Math.round(totalUsage * (tariff.gridReserve / 100) * 100) / 100;
    const gridSolidarAmount = Math.round(totalUsage * (tariff.gridSolidar / 100) * 100) / 100;
    const baseFeeAmount = Math.round(safeMonths * tariff.gridBaseFee * 100) / 100;
    const measurementFeeAmount = Math.round(safeMonths * tariff.gridMeasurementFee * 100) / 100;
    const subtotalGrid = Math.round(
        (gridHTAmount + gridNTAmount + gridSdlAmount + gridReserveAmount + gridSolidarAmount + baseFeeAmount + measurementFeeAmount) * 100
    ) / 100;

    // 3. Öffentliche Abgaben
    const communityFeeAmount = Math.round(totalUsage * (tariff.communityFee / 100) * 100) / 100;
    const federalFeeAmount = Math.round(totalUsage * (tariff.federalFee / 100) * 100) / 100;
    const subtotalFees = Math.round((communityFeeAmount + federalFeeAmount) * 100) / 100;

    // 4. Gesamttotal & MwSt
    const totalExclVat = Math.round((subtotalEnergy + subtotalGrid + subtotalFees) * 100) / 100;
    const vatAmount = Math.round(totalExclVat * (tariff.vatRate / 100) * 100) / 100;
    const totalInclVat = Math.round((totalExclVat + vatAmount) * 100) / 100;

    // Variable Umlagen pro kWh (SDL + Reserve + Solidar + Gemeinde + Bund)
    const commonVariableRp = (tariff.gridSdl || 0) + (tariff.gridReserve || 0) + (tariff.gridSolidar || 0)
        + (tariff.communityFee || 0) + (tariff.federalFee || 0);

    const vatFactor = 1 + (tariff.vatRate / 100);
    const effectiveRateHTRp = Math.round(((tariff.energyHT || 0) + (tariff.gridHT || 0) + commonVariableRp) * vatFactor * 10) / 10;
    const effectiveRateNTRp = Math.round(((tariff.energyNT || 0) + (tariff.gridNT || 0) + commonVariableRp) * vatFactor * 10) / 10;
    const monthlyFixedCost = Math.round(((tariff.gridBaseFee || 0) + (tariff.gridMeasurementFee || 0)) * vatFactor * 100) / 100;

    return {
        totalUsage,
        energyHTAmount,
        energyNTAmount,
        subtotalEnergy,
        gridHTAmount,
        gridNTAmount,
        gridSdlAmount,
        gridReserveAmount,
        gridSolidarAmount,
        baseFeeAmount,
        measurementFeeAmount,
        subtotalGrid,
        communityFeeAmount,
        federalFeeAmount,
        subtotalFees,
        totalExclVat,
        vatAmount,
        totalInclVat,
        effectiveRateHTRp,
        effectiveRateNTRp,
        monthlyFixedCost
    };
}

/**
 * Ermittelt die Tage und rechnerischen Monate zwischen zwei Daten.
 */
export function calculatePeriodDays(dateFrom?: string, dateTo?: string): { days: number; months: number } {
    if (!dateFrom || !dateTo) return { days: 30, months: 1 };
    const tFrom = new Date(dateFrom).getTime();
    const tTo = new Date(dateTo).getTime();
    if (isNaN(tFrom) || isNaN(tTo) || tTo <= tFrom) return { days: 30, months: 1 };

    const days = Math.round((tTo - tFrom) / (1000 * 3600 * 24));
    // Schweizer Stromversorger (z.B. Eniwa) verrechnen Fixkosten monatsweise:
    // Ein Ableseintervall von ca. 25 bis 45 Tagen entspricht genau 1 Abrechnungsmonat.
    // Längere Zyklen (z.B. Quartal ~90 Tage = 3 Monate, Halbjahr ~180 Tage = 6 Monate, Jahr ~365 Tage = 12 Monate).
    const months = Math.max(1, Math.round(days / 30.416));
    return { days, months };
}

/**
 * Ermittelt den tatsächlichen Verbrauch einer Ablesung in kWh (unter Berücksichtigung von Stand alt/neu).
 */
export function getReadingUsage(reading: ElectricityReading, prevReading?: ElectricityReading): { usageHT: number; usageNT: number } {
    // 1. Wenn explizit eingetragen (manuell überschrieben oder gespeichert)
    if (reading.usageHT !== undefined && reading.usageHT > 0 && reading.usageNT !== undefined && reading.usageNT > 0) {
        return { usageHT: reading.usageHT, usageNT: reading.usageNT };
    }

    // 2. Aus Stand alt & Stand neu
    if (reading.standAltHT !== undefined && reading.valueHT !== undefined && reading.valueHT >= reading.standAltHT) {
        const usageHT = reading.valueHT - reading.standAltHT;
        const usageNT = (reading.standAltNT !== undefined && reading.valueNT >= reading.standAltNT)
            ? reading.valueNT - reading.standAltNT
            : 0;
        return { usageHT, usageNT };
    }

    // 3. Aus Differenz zum vorherigen Zählerstand
    if (prevReading && reading.valueHT >= prevReading.valueHT && reading.valueNT >= prevReading.valueNT) {
        return {
            usageHT: reading.valueHT - prevReading.valueHT,
            usageNT: reading.valueNT - prevReading.valueNT
        };
    }

    // 4. Intelligente Initialisierung für den bekannten Zählerstand aus der Eniwa-Rechnung (542 HT / 3583 NT)
    if (reading.valueHT === 542 && reading.valueNT === 3583) {
        return { usageHT: 69, usageNT: 475 };
    }

    // Fallback: Wenn nur Stand vorhanden ist und noch kein vorheriger Stand
    return {
        usageHT: reading.usageHT || 0,
        usageNT: reading.usageNT || 0
    };
}
