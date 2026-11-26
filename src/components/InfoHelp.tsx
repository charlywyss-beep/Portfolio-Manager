import { useState, useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Info } from 'lucide-react';

export interface InfoHelpItem {
    id?: string;
    term: string;
    text: string | ReactNode;
}

function renderInlineCode(text: string, keyPrefix: string) {
    const codeParts = text.split(/(`[^`]+`)/g);
    if (codeParts.length === 1) return text;
    return codeParts.map((cp, cIdx) => {
        if (cp.startsWith('`') && cp.endsWith('`') && cp.length > 2) {
            return (
                <code
                    key={`${keyPrefix}-c-${cIdx}`}
                    className="px-1 py-0.5 rounded bg-muted/90 border border-border/60 font-mono text-xs font-semibold text-foreground dark:text-slate-100 whitespace-nowrap"
                >
                    {cp.slice(1, -1)}
                </code>
            );
        }
        return cp;
    });
}

function renderFormattedHelpText(rawText: string) {
    if (!rawText) return null;
    const parts = rawText.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, idx) => {
        if (part.startsWith('**') && part.endsWith('**')) {
            return (
                <span key={idx} className="font-bold text-foreground dark:text-white">
                    {renderInlineCode(part.slice(2, -2), `b-${idx}`)}
                </span>
            );
        }

        // Also check if non-bold text contains "• Vorteil 1 ...:" patterns
        const vorteilParts = part.split(/((?:^|\n)\s*•?\s*Vorteil\s*\d+[^:\n]*:?)/gi);
        if (vorteilParts.length > 1) {
            return vorteilParts.map((vp, vIdx) => {
                if (/^\s*•?\s*Vorteil\s*\d+/i.test(vp.trim())) {
                    return (
                        <span key={vIdx} className="font-bold text-foreground dark:text-white">
                            {renderInlineCode(vp, `v-${idx}-${vIdx}`)}
                        </span>
                    );
                }
                return renderInlineCode(vp, `t-${idx}-${vIdx}`);
            });
        }

        return renderInlineCode(part, `p-${idx}`);
    });
}

interface InfoHelpProps {
    /** Titel im Erklärungsfenster, z. B. "Kursverlauf" */
    title: string;
    /** Begriffe mit Erklärung */
    items: InfoHelpItem[];
    /** Optionaler hervorgehobener Kopfbereich ganz oben (z. B. Kurzformel; kann Funktion mit scrollToItem sein) */
    header?: ReactNode | ((scrollToItem: (id: string) => void) => ReactNode);
    /** Optionaler Zusatzbereich am Ende (z. B. Hinweise) */
    footer?: ReactNode;
    /** Optionaler benutzerdefinierter Trigger-Button (z. B. Badge oder Icon) */
    trigger?: ReactNode;
    /** Optionale Klassen für den Button */
    buttonClassName?: string;
}

/**
 * Kleines Info-Symbol (ⓘ), das ein Erklärungsfenster öffnet.
 * Die Klicks werden gestoppt, damit umliegende klickbare Kacheln nicht ausgelöst werden.
 */
export function InfoHelp({ title, items, header, footer, trigger, buttonClassName }: InfoHelpProps) {
    const [open, setOpen] = useState(false);
    const [highlightedId, setHighlightedId] = useState<string | null>(null);
    const modalRef = useRef<HTMLDivElement | null>(null);
    const highlightTimerRef = useRef<number | null>(null);

    const scrollToItem = (id: string) => {
        const container = modalRef.current;
        if (!container) return;
        const target = container.querySelector<HTMLElement>(`[data-help-id="${id}"]`);
        if (!target) return;
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        setHighlightedId(id);
        if (highlightTimerRef.current) {
            window.clearTimeout(highlightTimerRef.current);
        }
        highlightTimerRef.current = window.setTimeout(() => {
            setHighlightedId((prev) => (prev === id ? null : prev));
        }, 2200);
    };

    useEffect(() => {
        return () => {
            if (highlightTimerRef.current) {
                window.clearTimeout(highlightTimerRef.current);
            }
        };
    }, []);

    useEffect(() => {
        if (!open) {
            setHighlightedId(null);
            return;
        }
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                e.stopPropagation();
                setOpen(false);
            }
        };
        window.addEventListener('keydown', handleKeyDown, true);
        return () => window.removeEventListener('keydown', handleKeyDown, true);
    }, [open]);

    const scrollToTop = () => {
        modalRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const resolvedHeader = typeof header === 'function' ? header(scrollToItem) : header;
    const hasJumpNav = typeof header === 'function';

    return (
        <>
            <button
                type="button"
                onClick={(ev) => { ev.stopPropagation(); setOpen(true); }}
                className={buttonClassName || "p-0.5 rounded-full text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors shrink-0"}
                title={`Erklärung: ${title}`}
                aria-label={`Erklärung: ${title}`}
            >
                {trigger || <Info className="size-4 md:size-[18px]" />}
            </button>
            {open && createPortal(
                <div
                    className="fixed inset-0 z-[100000] flex items-center justify-center bg-black/60 p-4"
                    onClick={(ev) => { ev.stopPropagation(); setOpen(false); }}
                >
                    <div
                        ref={modalRef}
                        className="bg-card text-foreground border border-border rounded-xl shadow-2xl w-full max-w-lg sm:max-w-xl md:max-w-2xl max-h-[85vh] overflow-y-auto p-5 cursor-default"
                        onClick={(ev) => ev.stopPropagation()}
                    >
                        <div className="flex items-center justify-between gap-3 mb-4 pb-3 border-b border-border/70">
                            <h4 className="font-bold text-lg flex items-center gap-2 leading-snug">
                                <Info className="size-5 text-blue-500 shrink-0" />
                                <span>Erklärung: {title}</span>
                            </h4>
                            <button
                                type="button"
                                onClick={() => setOpen(false)}
                                className="px-2.5 py-1 rounded-lg text-sm font-semibold bg-muted hover:bg-muted/70 shrink-0 cursor-pointer"
                            >
                                Schliessen
                            </button>
                        </div>
                        {resolvedHeader && <div className="mb-4">{resolvedHeader}</div>}
                        <dl className="space-y-4 text-sm">
                            {items.map((it) => {
                                const isHighlighted = Boolean(it.id && highlightedId === it.id);
                                return (
                                    <div
                                        key={it.term}
                                        data-help-id={it.id}
                                        className={
                                            isHighlighted
                                                ? "scroll-mt-3 pt-3.5 first:pt-2.5 border-t first:border-t-0 border-border/50 rounded-xl bg-sky-500/15 ring-1 ring-sky-500/50 px-3 pb-3 -mx-3 transition-all duration-300"
                                                : "scroll-mt-3 pt-3.5 first:pt-0 border-t first:border-t-0 border-border/50 transition-all duration-300"
                                        }
                                    >
                                        <dt className="font-bold text-foreground mb-1.5 flex items-center justify-between gap-2">
                                            <span>{it.term}</span>
                                            {hasJumpNav && it.id && (
                                                <button
                                                    type="button"
                                                    onClick={scrollToTop}
                                                    className="text-xs font-semibold text-sky-600/80 dark:text-sky-400/80 hover:text-sky-500 shrink-0 cursor-pointer"
                                                    title="Zurück zur Kurzformel oben"
                                                >
                                                    ↑ Oben
                                                </button>
                                            )}
                                        </dt>
                                        <dd className="text-muted-foreground leading-relaxed whitespace-pre-line">
                                            {typeof it.text === 'string' ? renderFormattedHelpText(it.text) : it.text}
                                        </dd>
                                    </div>
                                );
                            })}
                        </dl>
                        {footer && <div className="mt-4 pt-3 border-t border-border text-sm text-muted-foreground">{footer}</div>}
                    </div>
                </div>,
                document.body
            )}
        </>
    );
}
