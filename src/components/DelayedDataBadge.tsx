import React from 'react';
import { cn } from '../utils';
import { InfoHelp, type InfoHelpItem } from './InfoHelp';

export interface DelayedDataBadgeProps {
    quoteDate?: Date | null;
    lastDataDate?: Date | null;
    isMarketOpen?: boolean;
    className?: string;
}

export const DELAYED_DATA_SPICKZETTEL_ITEMS: InfoHelpItem[] = [
    {
        term: "1. Ab 00:00 Uhr • US-Futures, Rohstoffe, Währungen & Asien",
        text: "Nasdaq 100 & S&P 500 Futures, Gold, Öl, Devisen sowie die asiatischen Börsen (Tokio, Hongkong, Shanghai) liefern ab Mitternacht sofort laufende Kurse."
    },
    {
        term: "2. Ab 08:15 Uhr • Erste Früh-Indikation aus Frankfurt (*.F)",
        text: "Deutsche Parkett- und Tradegate-Börsen handeln US- und Europa-Aktien ab 08:00 Uhr MEZ. Durch die 15-minütige Börsenverzögerung treffen die ersten Morgenkurse ab 08:15 Uhr ein."
    },
    {
        term: "3. Ab 09:15 / 09:16 Uhr • Schweiz (SIX), Xetra (*.DE), London (*.L) & Paris (*.PA)",
        text: "Die europäischen Hauptbörsen öffnen um 09:00 Uhr MEZ. Da kostenlose Datenanbieter europäische Kurse gesetzlich mit 15 Minuten Verzögerung ausliefern, schaltet die Anzeige um 09:15 / 09:16 Uhr auf die neuen Tageskurse um."
    },
    {
        term: "4. Ab 10:00 Uhr • Offizielle US Vorbörse (Pre-Market)",
        text: "Die US-Vorbörse an der Nasdaq und NYSE startet um 10:00 Uhr MEZ und wird ohne Verzögerung in Echtzeit übertragen."
    },
    {
        term: "5. Ab 15:30 Uhr • Wall Street (New York)",
        text: "Der reguläre US-Börsenhandel läuft von 15:30 bis 22:00 Uhr MEZ komplett ohne Zeitverzögerung in Echtzeit."
    }
];

export const DelayedDataBadge: React.FC<DelayedDataBadgeProps> = ({
    quoteDate,
    lastDataDate,
    isMarketOpen = true,
    className
}) => {
    const validQuoteDate = quoteDate && !isNaN(quoteDate.getTime()) ? quoteDate : null;
    const validLastDataDate = lastDataDate && !isNaN(lastDataDate.getTime()) ? lastDataDate : null;
    const displayDate = (validQuoteDate && validLastDataDate)
        ? (validQuoteDate.getTime() >= validLastDataDate.getTime() ? validQuoteDate : validLastDataDate)
        : (validQuoteDate || validLastDataDate);

    if (!displayDate) return null;

    const today = new Date();
    const isToday = displayDate.toDateString() === today.toDateString();
    const isDelayed = isToday && isMarketOpen && (today.getTime() - displayDate.getTime() > 15 * 60 * 1000);

    let label = 'Schlusskurs';
    if (isToday && isMarketOpen) {
        label = isDelayed ? 'Verzögerte Daten' : 'Live-Kurs';
    } else {
        label = 'Schlusskurs';
    }

    return (
        <div className={cn("inline-flex items-center gap-1.5 shrink-0", className)}>
            <div className={cn(
                "h-7 inline-flex items-center gap-1.5 px-2.5 rounded-lg border text-xs font-semibold leading-none py-0 shadow-sm shrink-0",
                isToday && isMarketOpen
                    ? (isDelayed
                        ? "bg-yellow-100 text-yellow-950 border-yellow-300 dark:bg-yellow-500/20 dark:text-yellow-200 dark:border-yellow-500/30"
                        : "bg-green-100 text-green-700 border-green-300 dark:bg-green-900/30 dark:text-green-400 dark:border-green-500/30")
                    : "bg-red-100 text-red-700 border-red-300 dark:bg-red-900/30 dark:text-red-400 dark:border-red-500/30"
            )}>
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="shrink-0"
                >
                    {(isToday && isMarketOpen && !isDelayed) ? (
                        <polyline points="20 6 9 17 4 12" />
                    ) : (
                        <circle cx="12" cy="12" r="10" />
                    )}
                    {(isToday && isMarketOpen && isDelayed) && <path d="M12 6v6l4 2" />}
                </svg>
                <span className="whitespace-nowrap">
                    {label} {displayDate.toLocaleDateString('de-DE', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                    })} Uhr
                </span>
            </div>
            <InfoHelp
                title="Dein Spickzettel • Wann kommen welche Live-Daten rein?"
                items={DELAYED_DATA_SPICKZETTEL_ITEMS}
            />
        </div>
    );
};
