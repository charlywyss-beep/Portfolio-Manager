import { cn } from '../utils';

interface StockNameProps {
    name?: string;
    className?: string;
    lineClassName?: string;
    title?: string;
}

/**
 * Splits stock / ETF name into lines:
 * 1. Manual user line breaks (\n, \r\n, \n) - ABSOLUTE HIGHEST PRIORITY.
 * 2. Smart split before 'UCITS ETF' or 'UCITS' for names > 30 characters
 *    (e.g. 'Vanguard FTSE All-World High Dividend Yield' / 'UCITS ETF USD Distributing').
 * 3. Smart split before 'ETF' for names > 35 characters.
 * 4. Fallback: single string (rendered with line-clamp-2).
 */
export function getStockNameLines(name?: string): string[] {
    if (!name) return [];

    // 1. VORRANGIG: Manuelle Vorgabe des Users (Enter-Taste / \n im Textfeld)
    if (name.includes('\n') || name.includes('\\n')) {
        const lines = name.replace(/\\n/g, '\n').split(/\r?\n/).map(l => l.trim()).filter(Boolean);
        if (lines.length > 0) return lines;
    }

    // 2. SMART-SPLIT für typische lange ETF-Namen vor 'UCITS ETF' oder 'UCITS'
    if (name.length > 30 && /\b(UCITS\s+ETF|UCITS)\b/i.test(name)) {
        const match = name.match(/^(.*?\S)\s+((?:UCITS\s+ETF|UCITS).*)$/i);
        if (match) {
            return [match[1].trim(), match[2].trim()];
        }
    }

    // 3. SMART-SPLIT vor eigenständigem 'ETF' bei langen Namen
    if (name.length > 35 && /\bETF\b/i.test(name)) {
        const match = name.match(/^(.*?\S)\s+(ETF.*)$/i);
        if (match) {
            return [match[1].trim(), match[2].trim()];
        }
    }

    return [name];
}

/**
 * Renders a stock or ETF name with strict priority to manual line breaks (\n).
 * - If manual line breaks exist (or smart split applies), each line is rendered as an explicit block.
 * - Otherwise falls back to a clean 2-line auto-wrap (line-clamp-2) with word-break.
 */
export function StockName({ name, className, lineClassName, title }: StockNameProps) {
    if (!name) return null;

    const lines = getStockNameLines(name);

    if (lines.length > 1) {
        return (
            <span className={cn("block leading-snug", className)} title={title || name.replace(/\r?\n/g, ' ')}>
                {lines.map((line, idx) => (
                    <span key={idx} className={cn("block leading-snug md:whitespace-nowrap break-words md:break-normal", lineClassName)}>
                        {line}
                    </span>
                ))}
            </span>
        );
    }

    return (
        <span
            className={cn("block line-clamp-2 leading-snug break-words", className)}
            title={title || name}
        >
            {name}
        </span>
    );
}
