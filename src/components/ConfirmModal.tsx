import { X, AlertTriangle } from 'lucide-react';
import { cn } from '../utils';

interface ConfirmModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    variant?: 'danger' | 'warning' | 'info';
}

export function ConfirmModal({
    isOpen,
    onClose,
    onConfirm,
    title,
    message,
    confirmText = 'Löschen',
    cancelText = 'Abbrechen',
    variant = 'danger'
}: ConfirmModalProps) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div
                className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="p-6">
                    <div className="flex items-start gap-4">
                        <div className={cn(
                            "p-3 rounded-full shrink-0",
                            variant === 'danger' ? "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400" :
                                variant === 'warning' ? "bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400" :
                                    "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
                        )}>
                            <AlertTriangle className="size-6" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <h3 className="text-lg font-bold text-foreground mb-1">{title}</h3>
                            <p className="text-sm text-muted-foreground leading-relaxed">
                                {message}
                            </p>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-1 hover:bg-muted rounded-md transition-colors text-muted-foreground"
                        >
                            <X className="size-5" />
                        </button>
                    </div>
                </div>

                <div className="flex items-center justify-end gap-3 px-6 py-4 bg-muted/30 border-t border-border">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium hover:bg-muted rounded-lg transition-colors"
                    >
                        {cancelText}
                    </button>
                    <button
                        onClick={() => {
                            onConfirm();
                            onClose();
                        }}
                        className={cn(
                            "px-4 py-2 text-sm font-medium text-white rounded-lg transition-all shadow-sm active:scale-95",
                            variant === 'danger' ? "bg-red-600 hover:bg-red-700 shadow-red-500/20" :
                                variant === 'warning' ? "bg-amber-600 hover:bg-amber-700 shadow-amber-500/20" :
                                    "bg-primary hover:bg-primary/90 shadow-primary/20"
                        )}
                    >
                        {confirmText}
                    </button>
                </div>
            </div>
        </div>
    );
}
