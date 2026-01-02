import type { FixedDeposit } from '../types';

/**
 * Verarbeitet automatische monatliche Säule 3a Einzahlungen
 * Prüft für jedes Konto ob seit der letzten Einzahlung ein neuer Monat begonnen hat
 * Falls ja, fügt den monatlichen Beitrag zum Vermögen hinzu
 */
export function processMonthlyContributions(deposits: FixedDeposit[]): FixedDeposit[] {
    const today = new Date();
    const currentYearMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`; // Format: "2026-01"

    return deposits.map(fd => {
        // Nur Vorsorge-Konten mit Auto-Contribution verarbeiten
        if (fd.accountType !== 'vorsorge' || !fd.autoContribution || !fd.monthlyContribution) {
            return fd;
        }

        // Prüfen ob wir bereits in diesem Monat eingezahlt haben
        if (fd.lastContributionDate === currentYearMonth) {
            return fd; // Bereits eingezahlt diesen Monat
        }

        // Prüfen ob wir im ersten Monat des Jahres sind und noch nie eingezahlt haben
        if (!fd.lastContributionDate && today.getMonth() === 0) {
            return fd; // Januar, noch keine Einzahlung nötig
        }

        // Wenn lastContributionDate nicht gesetzt ist, auf vorherigen Monat setzen
        if (!fd.lastContributionDate) {
            const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
            fd.lastContributionDate = `${lastMonth.getFullYear()}-${String(lastMonth.getMonth() + 1).padStart(2, '0')}`;
        }

        // Berechne wie viele Monate seit letzter Einzahlung vergangen sind
        const [lastYear, lastMonth] = fd.lastContributionDate.split('-').map(Number);
        const lastDate = new Date(lastYear, lastMonth - 1, 1); // Monat ist 0-indexed
        const currentDate = new Date(today.getFullYear(), today.getMonth(), 1);

        // Berechne Monats-Differenz
        const monthsDiff = (currentDate.getFullYear() - lastDate.getFullYear()) * 12 + (currentDate.getMonth() - lastDate.getMonth());

        if (monthsDiff <= 0) {
            return fd; // Kein neuer Monat
        }

        // Füge die Beiträge für alle vergangenen Monate hinzu
        const totalContribution = fd.monthlyContribution * monthsDiff;

        return {
            ...fd,
            amount: fd.amount + totalContribution,
            lastContributionDate: currentYearMonth
        };
    });
}
