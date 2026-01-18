import { useRef, useEffect } from 'react'; // Removed unused React import
import { X, Check } from 'lucide-react';
import { usePortfolio } from '../context/PortfolioContext';
import { cn } from '../utils';

interface AddToWatchlistModalProps {
    isOpen: boolean;
    onClose: () => void;
    stockId: string;
}

export function AddToWatchlistModal({ isOpen, onClose, stockId }: AddToWatchlistModalProps) {
    const { watchlists, addToWatchlist, removeFromWatchlist, createWatchlist } = usePortfolio();
    const modalRef = useRef<HTMLDivElement>(null);

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
                onClose();
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div
                ref={modalRef}
                className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col animate-in zoom-in-95 duration-200"
            >
                <div className="flex items-center justify-between p-4 border-b border-border">
                    <h2 className="text-lg font-bold">Zu Watchlist hinzufügen</h2>
                    <button onClick={onClose} className="p-1 hover:bg-muted rounded-lg transition-colors">
                        <X className="size-5" />
                    </button>
                </div>

                <div className="p-2 space-y-1 max-h-[60vh] overflow-y-auto">
                    {watchlists.map(wl => {
                        const isInList = wl.stockIds.includes(stockId);
                        return (
                            <button
                                key={wl.id}
                                onClick={() => {
                                    if (isInList) {
                                        removeFromWatchlist(stockId, wl.id);
                                    } else {
                                        addToWatchlist(stockId, wl.id);
                                    }
                                }}
                                className={cn(
                                    "w-full flex items-center justify-between p-3 rounded-lg transition-colors text-left",
                                    isInList ? "bg-primary/10 hover:bg-primary/20" : "hover:bg-muted"
                                )}
                            >
                                <span className={cn("font-medium", isInList ? "text-primary" : "text-foreground")}>
                                    {wl.name}
                                </span>
                                {isInList && <Check className="size-4 text-primary" />}
                            </button>
                        );
                    })}
                </div>

                <div className="p-4 border-t border-border bg-muted/20">
                    <button
                        onClick={() => {
                            const name = window.prompt("Name der neuen Liste:");
                            if (name) createWatchlist(name);
                        }}
                        className="w-full py-2 px-4 rounded-lg border border-dashed border-border text-muted-foreground hover:text-foreground hover:bg-muted hover:border-muted-foreground/50 transition-all text-sm font-medium"
                    >
                        + Neue Liste erstellen
                    </button>
                </div>
            </div>
        </div>
    );
}
