# Portfolio Manager UI Rules

To ensure a high-quality and accessible user experience, follow these rules for all UI developments:

## Typography & Contrast
1. **Proper White**: Never use muted colors (`text-muted-foreground`) or low opacity (`opacity-60/70/80`) for critical data labels against dark or colored backgrounds (e.g., blue banners, dark mode cards). Always use full-brightness white (`text-white` or `text-foreground`).
2. **Mobile Readability**: Ensure font sizes for secondary data (dates, times) are at least `11px` (`text-[11px]`) to remain legible on mobile devices like iPhone.

## Formatting
1. **No Parentheses**: Avoid using parentheses `(...)` around dates and times in the UI. Use spacing or dividers instead.
2. **Date Format**: Use `DD.MM.YY` or `DD.MM.` as per user preference (German/Swiss style).

## Components
1. **Measurement Tool**: Vertical lines should be `2px` wide and pure blue `#3b82f6`.
