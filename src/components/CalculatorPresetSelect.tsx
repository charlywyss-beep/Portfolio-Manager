import { useState, useRef, useEffect, useMemo } from 'react';
import { ChevronDown, Search, Check, X } from 'lucide-react';
import { cn } from '../utils';

export interface PresetSelectOption {
    value: string;
    label: string;
    sublabel?: string;
    meta?: string;
    group?: string;
}

interface CalculatorPresetSelectProps {
    value: string;
    onChange: (value: string) => void;
    options: PresetSelectOption[];
    placeholder: string;
    ariaLabel: string;
    className?: string;
}

export function CalculatorPresetSelect({
    value,
    onChange,
    options,
    placeholder,
    ariaLabel,
    className
}: CalculatorPresetSelectProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [openUpward, setOpenUpward] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);

    const selectedOption = useMemo(
        () => options.find(o => o.value === value) || null,
        [options, value]
    );

    const showSearch = options.length >= 7;

    // Close on click outside or Escape
    useEffect(() => {
        if (!isOpen) return;
        const handleClickOutside = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [isOpen]);

    // Focus search input when opening
    useEffect(() => {
        if (isOpen && showSearch) {
            const timer = window.setTimeout(() => searchInputRef.current?.focus(), 20);
            return () => window.clearTimeout(timer);
        }
        if (!isOpen) {
            setQuery('');
        }
    }, [isOpen, showSearch]);

    const handleToggle = () => {
        if (!isOpen && containerRef.current) {
            const rect = containerRef.current.getBoundingClientRect();
            const spaceBelow = window.innerHeight - rect.bottom;
            const spaceAbove = rect.top;
            setOpenUpward(spaceBelow < 260 && spaceAbove > spaceBelow);
        }
        setIsOpen(prev => !prev);
    };

    const filteredOptions = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return options;
        return options.filter(o =>
            o.label.toLowerCase().includes(q) ||
            (o.sublabel && o.sublabel.toLowerCase().includes(q)) ||
            (o.meta && o.meta.toLowerCase().includes(q)) ||
            (o.group && o.group.toLowerCase().includes(q))
        );
    }, [options, query]);

    // Group options while preserving order
    const groupedOptions = useMemo(() => {
        const groups: { name: string | null; items: PresetSelectOption[] }[] = [];
        filteredOptions.forEach(opt => {
            const groupName = opt.group || null;
            const last = groups[groups.length - 1];
            if (last && last.name === groupName) {
                last.items.push(opt);
            } else {
                groups.push({ name: groupName, items: [opt] });
            }
        });
        return groups;
    }, [filteredOptions]);

    return (
        <div ref={containerRef} className={cn("relative flex-1 min-w-0", className)}>
            <button
                type="button"
                onClick={handleToggle}
                aria-label={ariaLabel}
                aria-expanded={isOpen}
                className={cn(
                    "w-full h-8 px-2.5 text-xs rounded-lg border transition-colors flex items-center justify-between gap-2 cursor-pointer text-left",
                    isOpen
                        ? "bg-background border-primary/60 ring-2 ring-primary/15"
                        : "bg-muted/35 hover:bg-muted/55 border-border/70 hover:border-border",
                    selectedOption ? "text-foreground font-medium" : "text-muted-foreground"
                )}
            >
                <span className="truncate min-w-0 flex-1">
                    {selectedOption ? (
                        <span className="flex items-center gap-1.5 min-w-0">
                            <span className="truncate">{selectedOption.label}</span>
                            {selectedOption.sublabel && (
                                <span className="text-xs font-mono text-muted-foreground shrink-0">
                                    {selectedOption.sublabel}
                                </span>
                            )}
                        </span>
                    ) : (
                        placeholder
                    )}
                </span>
                <span className="flex items-center gap-1 shrink-0">
                    {selectedOption && (
                        <span
                            role="button"
                            tabIndex={-1}
                            onClick={(e) => {
                                e.stopPropagation();
                                onChange('');
                            }}
                            title="Auswahl zurücksetzen"
                            className="p-0.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                        >
                            <X className="size-3" />
                        </span>
                    )}
                    <ChevronDown
                        className={cn(
                            "size-3.5 text-muted-foreground transition-transform duration-150",
                            isOpen && "rotate-180 text-foreground"
                        )}
                    />
                </span>
            </button>

            {isOpen && (
                <div
                    className={cn(
                        "absolute left-0 right-0 z-50 rounded-xl border border-border bg-card text-foreground shadow-2xl overflow-hidden animate-in fade-in duration-150",
                        openUpward
                            ? "bottom-full mb-1.5 slide-in-from-bottom-1"
                            : "top-full mt-1.5 slide-in-from-top-1"
                    )}
                >
                    {showSearch && (
                        <div className="relative border-b border-border/70 bg-muted/25">
                            <Search className="size-3.5 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                            <input
                                ref={searchInputRef}
                                type="text"
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                placeholder="Suchen..."
                                className="w-full h-8 pl-8 pr-7 text-xs bg-transparent text-foreground placeholder:text-muted-foreground focus:outline-none"
                            />
                            {query && (
                                <button
                                    type="button"
                                    onClick={() => setQuery('')}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded text-muted-foreground hover:text-foreground"
                                    aria-label="Suche leeren"
                                >
                                    <X className="size-3" />
                                </button>
                            )}
                        </div>
                    )}

                    <div className="max-h-60 overflow-y-auto py-1">
                        {filteredOptions.length === 0 ? (
                            <div className="px-3 py-4 text-xs text-muted-foreground text-center">
                                Keine Einträge gefunden
                            </div>
                        ) : (
                            groupedOptions.map((grp, grpIdx) => (
                                <div key={grp.name || `group-${grpIdx}`}>
                                    {grp.name && (
                                        <div className="px-2.5 py-1 text-xs font-bold uppercase tracking-wider text-muted-foreground bg-muted/30 border-y border-border/40 first:border-t-0">
                                            {grp.name}
                                        </div>
                                    )}
                                    {grp.items.map(opt => {
                                        const isSelected = opt.value === value;
                                        return (
                                            <button
                                                key={opt.value}
                                                type="button"
                                                onClick={() => {
                                                    onChange(opt.value);
                                                    setIsOpen(false);
                                                }}
                                                title={opt.label}
                                                className={cn(
                                                    "w-full px-2.5 py-1.5 text-left flex items-center justify-between gap-2 text-xs transition-colors cursor-pointer",
                                                    isSelected
                                                        ? "bg-primary/15 text-primary font-semibold"
                                                        : "text-foreground hover:bg-accent/70"
                                                )}
                                            >
                                                <div className="min-w-0 flex-1 flex items-baseline gap-1.5">
                                                    <span className="truncate">{opt.label}</span>
                                                    {opt.sublabel && (
                                                        <span className={cn(
                                                            "text-xs font-mono shrink-0",
                                                            isSelected ? "text-primary/80" : "text-muted-foreground"
                                                        )}>
                                                            {opt.sublabel}
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-1.5 shrink-0">
                                                    {opt.meta && (
                                                        <span className={cn(
                                                            "text-xs font-mono tabular-nums",
                                                            isSelected ? "text-primary" : "text-muted-foreground"
                                                        )}>
                                                            {opt.meta}
                                                        </span>
                                                    )}
                                                    {isSelected && <Check className="size-3.5 text-primary shrink-0" />}
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
