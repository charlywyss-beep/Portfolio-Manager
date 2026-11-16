import { useState, useEffect } from 'react';
import { X, ArrowUpDown, ChevronUp, ChevronDown, GripVertical, ShoppingBag, Clock, List, RotateCcw, Check } from 'lucide-react';
import { cn } from '../utils';

export interface WatchlistTabItem {
    id: string;
    name: string;
    isSystem?: boolean;
    isDefault?: boolean;
    badgeCount?: number;
}

interface WatchlistReorderModalProps {
    isOpen: boolean;
    onClose: () => void;
    tabs: WatchlistTabItem[];
    onSaveOrder: (newTabs: WatchlistTabItem[]) => void;
    onResetOrder: () => void;
    activeTabId?: string;
    onSelectTab?: (id: string) => void;
}

export function WatchlistReorderModal({
    isOpen,
    onClose,
    tabs,
    onSaveOrder,
    onResetOrder,
    activeTabId,
    onSelectTab
}: WatchlistReorderModalProps) {
    const [localTabs, setLocalTabs] = useState<WatchlistTabItem[]>(tabs);
    const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
    const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

    // Keep in sync when modal opens or parent tabs change
    useEffect(() => {
        setLocalTabs(tabs);
    }, [tabs, isOpen]);

    if (!isOpen) return null;

    const moveItem = (fromIndex: number, toIndex: number) => {
        if (fromIndex === toIndex || toIndex < 0 || toIndex >= localTabs.length) return;
        const next = [...localTabs];
        const [moved] = next.splice(fromIndex, 1);
        next.splice(toIndex, 0, moved);
        setLocalTabs(next);
        onSaveOrder(next);
    };

    const handleMoveUp = (index: number) => {
        moveItem(index, index - 1);
    };

    const handleMoveDown = (index: number) => {
        moveItem(index, index + 1);
    };

    const handleReset = () => {
        onResetOrder();
    };

    const getIcon = (tab: WatchlistTabItem) => {
        if (tab.id === 'owned') {
            return <ShoppingBag className="size-4 text-blue-500 shrink-0" />;
        }
        if (tab.id === 'orders') {
            return <Clock className="size-4 text-amber-500 shrink-0" />;
        }
        return <List className="size-4 text-muted-foreground shrink-0" />;
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
            <div
                className="bg-card w-full max-w-md rounded-2xl border border-border shadow-2xl flex flex-col max-h-[90vh] overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-border/80 bg-muted/20 shrink-0">
                    <div className="flex items-center gap-2.5">
                        <div className="p-2 rounded-xl bg-blue-500/10 text-blue-500 border border-blue-500/20">
                            <ArrowUpDown className="size-5" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-foreground">Listen anordnen</h2>
                            <p className="text-xs text-muted-foreground">Eigene Reihenfolge per Pfeile oder Ziehen festlegen</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                        title="Schließen"
                    >
                        <X className="size-5" />
                    </button>
                </div>

                {/* Instructions banner */}
                <div className="px-5 py-2.5 bg-blue-500/10 border-b border-blue-500/20 text-xs text-blue-400 flex items-center justify-between">
                    <span>Tippen Sie auf die Pfeile oder ziehen Sie Zeilen nach oben/unten.</span>
                </div>

                {/* Tab List */}
                <div className="p-4 overflow-y-auto space-y-2 flex-1 min-h-0">
                    {localTabs.map((tab, index) => {
                        const isFirst = index === 0;
                        const isLast = index === localTabs.length - 1;
                        const isDragging = draggedIndex === index;
                        const isOver = dragOverIndex === index;
                        const isCurrentActive = activeTabId === tab.id;

                        return (
                            <div
                                key={tab.id}
                                draggable
                                onDragStart={(e) => {
                                    e.dataTransfer.setData('text/plain', String(index));
                                    e.dataTransfer.effectAllowed = 'move';
                                    setDraggedIndex(index);
                                }}
                                onDragOver={(e) => {
                                    e.preventDefault();
                                    e.dataTransfer.dropEffect = 'move';
                                    if (dragOverIndex !== index) {
                                        setDragOverIndex(index);
                                    }
                                }}
                                onDragLeave={() => {
                                    if (dragOverIndex === index) {
                                        setDragOverIndex(null);
                                    }
                                }}
                                onDrop={(e) => {
                                    e.preventDefault();
                                    const sourceStr = e.dataTransfer.getData('text/plain');
                                    const sourceIdx = sourceStr ? parseInt(sourceStr, 10) : draggedIndex;
                                    if (sourceIdx !== null && sourceIdx !== undefined && !isNaN(sourceIdx)) {
                                        moveItem(sourceIdx, index);
                                    }
                                    setDraggedIndex(null);
                                    setDragOverIndex(null);
                                }}
                                onDragEnd={() => {
                                    setDraggedIndex(null);
                                    setDragOverIndex(null);
                                }}
                                className={cn(
                                    "flex items-center justify-between p-2.5 sm:p-3 rounded-xl border transition-all select-none",
                                    isCurrentActive
                                        ? "bg-primary/10 border-primary/40 shadow-xs"
                                        : "bg-muted/30 hover:bg-muted/50 border-border/70",
                                    isDragging && "opacity-40 scale-95",
                                    isOver && "ring-2 ring-blue-500 border-blue-500 scale-[1.01]"
                                )}
                            >
                                <div className="flex items-center gap-3 min-w-0 flex-1">
                                    <div
                                        className="cursor-grab active:cursor-grabbing p-1 text-muted-foreground hover:text-foreground touch-none"
                                        title="Ziehen zum Verschieben"
                                    >
                                        <GripVertical className="size-4" />
                                    </div>

                                    <div className="size-6 rounded-full bg-background border border-border flex items-center justify-center text-xs font-mono font-bold text-muted-foreground shrink-0">
                                        {index + 1}
                                    </div>

                                    {getIcon(tab)}

                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                            <span className="font-semibold text-sm text-foreground truncate">
                                                {tab.name}
                                            </span>
                                            {tab.isSystem && (
                                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-muted text-muted-foreground uppercase leading-none">
                                                    System
                                                </span>
                                            )}
                                            {tab.isDefault && (
                                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-muted text-muted-foreground uppercase leading-none">
                                                    Standard
                                                </span>
                                            )}
                                            {typeof tab.badgeCount === 'number' && tab.badgeCount > 0 && (
                                                <span className={cn(
                                                    "text-[11px] font-mono font-semibold px-1.5 py-0.2 rounded-full",
                                                    tab.id === 'orders'
                                                        ? "bg-amber-500/20 text-amber-500"
                                                        : "bg-background/80 text-muted-foreground border border-border"
                                                )}>
                                                    {tab.badgeCount}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Up / Down Reorder Buttons */}
                                <div className="flex items-center gap-1 shrink-0 ml-2">
                                    <button
                                        type="button"
                                        onClick={() => handleMoveUp(index)}
                                        disabled={isFirst}
                                        className={cn(
                                            "size-8 rounded-lg flex items-center justify-center border transition-all cursor-pointer",
                                            isFirst
                                                ? "opacity-20 border-transparent cursor-not-allowed text-muted-foreground"
                                                : "bg-background hover:bg-muted active:scale-95 text-foreground border-border shadow-2xs"
                                        )}
                                        title="Nach oben verschieben"
                                        aria-label="Nach oben verschieben"
                                    >
                                        <ChevronUp className="size-4" />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleMoveDown(index)}
                                        disabled={isLast}
                                        className={cn(
                                            "size-8 rounded-lg flex items-center justify-center border transition-all cursor-pointer",
                                            isLast
                                                ? "opacity-20 border-transparent cursor-not-allowed text-muted-foreground"
                                                : "bg-background hover:bg-muted active:scale-95 text-foreground border-border shadow-2xs"
                                        )}
                                        title="Nach unten verschieben"
                                        aria-label="Nach unten verschieben"
                                    >
                                        <ChevronDown className="size-4" />
                                    </button>
                                    {onSelectTab && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                onSelectTab(tab.id);
                                                onClose();
                                            }}
                                            className={cn(
                                                "ml-1 px-2 py-1 text-xs font-semibold rounded-lg border transition-all cursor-pointer",
                                                isCurrentActive
                                                    ? "bg-primary text-primary-foreground border-primary"
                                                    : "bg-background hover:bg-muted text-muted-foreground border-border"
                                            )}
                                            title="Diese Liste öffnen"
                                        >
                                            {isCurrentActive ? 'Aktiv' : 'Öffnen'}
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between p-4 border-t border-border/80 bg-muted/20 shrink-0 gap-3">
                    <button
                        type="button"
                        onClick={handleReset}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                        title="Standard-Reihenfolge wiederherstellen"
                    >
                        <RotateCcw className="size-3.5" />
                        <span>Zurücksetzen</span>
                    </button>
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 transition-all shadow-sm active:scale-95 cursor-pointer"
                    >
                        <Check className="size-4" />
                        <span>Fertig</span>
                    </button>
                </div>
            </div>
        </div>
    );
}
