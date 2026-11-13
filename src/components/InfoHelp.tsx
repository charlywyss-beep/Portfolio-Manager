import { useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Info } from 'lucide-react';

export interface InfoHelpItem {
    term: string;
    text: string;
}

interface InfoHelpProps {
    /** Titel im Erklärungsfenster, z. B. "Kursverlauf" */
    title: string;
    /** Begriffe mit Erklärung */
    items: InfoHelpItem[];
    /** Optionaler Zusatzbereich am Ende (z. B. Hinweise) */
    footer?: ReactNode;
}

/**
 * Kleines Info-Symbol (ⓘ), das ein Erklärungsfenster öffnet.
 * Die Klicks werden gestoppt, damit umliegende klickbare Kacheln nicht ausgelöst werden.
 */
export function InfoHelp({ title, items, footer }: InfoHelpProps) {
    const [open, setOpen] = useState(false);

    return (
        <>
            <button
                type="button"
                onClick={(ev) => { ev.stopPropagation(); setOpen(true); }}
                className="p-0.5 rounded-full text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors shrink-0"
                title={`Erklärung: ${title}`}
                aria-label={`Erklärung: ${title}`}
            >
                <Info className="size-4 md:size-[18px]" />
            </button>
            {open && createPortal(
                <div
                    className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4"
                    onClick={(ev) => { ev.stopPropagation(); setOpen(false); }}
                >
                    <div
                        className="bg-card text-foreground border border-border rounded-xl shadow-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto p-5 cursor-default"
                        onClick={(ev) => ev.stopPropagation()}
                    >
                        <div className="flex items-center justify-between mb-3">
                            <h4 className="font-bold text-lg flex items-center gap-2">
                                <Info className="size-5 text-blue-500" /> Erklärung: {title}
                            </h4>
                            <button
                                type="button"
                                onClick={() => setOpen(false)}
                                className="px-2.5 py-1 rounded-lg text-sm font-semibold bg-muted hover:bg-muted/70"
                            >
                                Schliessen
                            </button>
                        </div>
                        <dl className="space-y-2.5 text-sm">
                            {items.map((it) => (
                                <div key={it.term}>
                                    <dt className="font-semibold text-foreground">{it.term}</dt>
                                    <dd className="text-muted-foreground">{it.text}</dd>
                                </div>
                            ))}
                        </dl>
                        {footer && <div className="mt-4 pt-3 border-t border-border text-sm text-muted-foreground">{footer}</div>}
                    </div>
                </div>,
                document.body
            )}
        </>
    );
}
