# Portfolio Manager UI Rules

To ensure a high-quality and accessible user experience, follow these rules for all UI developments:

## Typography & Contrast
1. **Proper White**: Never use muted colors (`text-muted-foreground`) or low opacity (`opacity-60/70/80`) for critical data labels against dark or colored backgrounds (e.g., blue banners, dark mode cards). Always use full-brightness white (`text-white` or `text-foreground`).
2. **High Contrast on Blue Banners**: Never use gray, muted colors (`text-muted-foreground`) or low opacity on blue cards/banners (poor readability). Labels and values on blue background must always be solid black (`text-slate-950` / `text-black`), clear and high-contrast.
3. **Mobile Readability**: Ensure font sizes for secondary data (dates, times) are at least `11px` (`text-[11px]`) to remain legible on mobile devices like iPhone.

## Formatting
1. **No Parentheses**: Avoid using parentheses `(...)` around dates and times in the UI. Use spacing or dividers instead.
2. **Date Format**: Use `DD.MM.YY` or `DD.MM.` as per user preference (German/Swiss style).

## Components
1. **Measurement Tool**: Vertical lines should be `2px` wide and pure blue `#3b82f6`.

## Header & Layout Integrity (STRIKT VERBINDLICH)
1. **Header-Höhen sind absolut tabu**: Es ist strikt verboten, an den Höhen, Paddings (py-4, etc.) oder der Grundstruktur der Seiten-Header (sticky top-0, iphone-landscape-portfolio-header-wrap, order-b bg-card rounded-t-xl, etc.) etwas zu verändern. Alle Header aller Seiten (Kauf / Verkauf, Übersicht, Saisonalität, Fairer Wert, Portfolio, Watchlist etc.) müssen exakt einheitlich und unverändert in ihrer Höhe und Struktur bestehen bleiben.

## Responsive & Viewport Ausnutzung (STRIKT VERBINDLICH)
1. **Desktop & iPad (Quer- und Hochformat)**:
   - **Volle Ausnutzung des Bildschirms**: Das Display soll voll ausgenutzt werden – am unteren Rand darf kein ungenutzter Platz verschenkt werden.
   - **Alles auf einmal sichtbar (No-Scroll)**: Bei 100% Zoom müssen sämtliche Kacheln, Eingabefelder und Auswertungen vollständig auf einen Blick sichtbar sein, ohne dass der Nutzer scrollen muss oder Kanten abgeschnitten werden.
2. **iPhone & Smartphones**:
   - Da auf kleinen Smartphone-Displays nicht alles auf einmal sichtbar sein kann, müssen stets **ganze Kacheln** auf dem Display stehen (keine unvollständig abgeschnittenen Felder).
   - Beim Scrollen geht es sauber und blockweise mit den nächsten Feldern bzw. Kacheln weiter.
