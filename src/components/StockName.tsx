import { cn } from '../utils';

interface StockNameProps {
    name?: string;
    className?: string;
    lineClassName?: string;
    title?: string;
}

/**
 * Renders a stock or ETF name with strict priority to manual line breaks (\n).
 * - If manual line breaks exist (user pressed Enter), each line is rendered as an explicit block.
 * - Otherwise falls back to a clean 2-line auto-wrap (line-clamp-2) with word-break.
 */
export function StockName({ name, className, lineClassName, title }: StockNameProps) {
    if (!name) return null;

    if (name.includes('\n')) {
        const lines = name.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
        return (
            <span className={cn("block leading-snug", className)} title={title || name}>
                {lines.map((line, idx) => (
                    <span key={idx} className={cn("block leading-snug break-words", lineClassName)}>
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
