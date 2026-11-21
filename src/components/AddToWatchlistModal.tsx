import { useRef, useEffect } from 'react';
import { X, Check, Star } from 'lucide-react';
import { usePortfolio } from '../context/PortfolioContext';
import { cn } from '../utils';

interface AddToWatchlistModalProps {
    isOpen: boolean;
    onClose: () => void;
    stockId: string;
}

export function AddToWatchlistModal({ isOpen, onClose, stockId }: AddToWatchlistModalProps) {
    const { stocks, watchlists, addToWatchlist, removeFromWatchlist, createWatchlist } = usePortfolio();
    const modalRef = useRef<HTMLDivElement>(null);
    const targetStock = stocks.find(s => String(s.id) === String(stockId));

    // Close on click outside or Escape
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
                onClose();
            }
        };
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') onClose();
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
            document.addEventListener('keydown', handleKeyDown);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs z-[2100] flex items-center justify-center p-4 animate-in fade-in duration-150"
            onClick={(e) => e.stopPropagation()}
        >
            <div
                ref={modalRef}
                className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col animate-in zoom-in-95 duration-150"
            >
                <div className="flex items-start justify-between gap-2 p-4 border-b border-border">
                    <div className="min-w-0">
                        <h2 className="text-base font-bold flex items-center gap-2 text-foreground">
                            <Star className="size-4 text-amber-400 fill-amber-400 shrink-0" />
                            <span>Watchlists zuordnen</span>
                        </h2>
                        {targetStock && (
                            <p className="text-xs text-muted-foreground truncate mt-0.5">
                                {targetStock.name.replace(/\r?\n/g, ' ')} · <span className="font-mono">{targetStock.symbol}</span>
                            </p>
                        )}
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1 hover:bg-muted rounded-lg transition-colors text-muted-foreground hover:text-foreground cursor-pointer shrink-0"
                        aria-label="Schliessen"
                    >
                        <X className="size-5" />
                    </button>
                </div>

                <div className="p-2 space-y-1 max-h-[60vh] overflow-y-auto">
                    {watchlists.map(wl => {
                        const isInList = wl.stockIds.includes(stockId);
                        return (
                            <button
                                key={wl.id}
                                type="button"
                                onClick={() => {
                                    if (isInList) {
                                        removeFromWatchlist(stockId, wl.id);
                                    } else {
                                        addToWatchlist(stockId, wl.id);
                                    }
                                }}
                                className={cn(
                                    "w-full flex items-center justify-between p-3 rounded-lg transition-colors text-left cursor-pointer border",
                                    isInList
                                        ? "bg-primary/10 hover:bg-primary/20 border-primary/30"
                                        : "hover:bg-muted border-transparent"
                                )}
                            >
                                <div className="flex items-center gap-2 min-w-0">
                                    <span className={cn("font-medium truncate", isInList ? "text-primary font-semibold" : "text-foreground")}>
                                        {wl.name}
                                    </span>
                                    <span className="text-[10px] font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full shrink-0">
                                        {wl.stockIds.length}
                                    </span>
                                </div>
                                {isInList && <Check className="size-4 text-primary shrink-0" />}
                            </button>
                        );
                    })}
                </div>

                <div className="p-3.5 border-t border-border bg-muted/20 flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => {
                            const name = window.prompt("Name der neuen Watchlist:");
                            if (name && name.trim()) {
                                createWatchlist(name.trim());
                            }
                        }}
                        className="flex-1 h-8 inline-flex items-center justify-center px-3 rounded-lg border border-dashed border-border text-muted-foreground hover:text-foreground hover:bg-muted hover:border-muted-foreground/50 transition-all text-xs font-medium cursor-pointer"
                    >
                        + Neue Liste erstellen
                    </button>
                    <button
                        type="button"
                        onClick={onClose}
                        className="h-8 inline-flex items-center justify-center px-4 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors text-xs font-semibold cursor-pointer"
                    >
                        Fertig
                    </button>
                </div>
            </div>
        </div>
    );
}
