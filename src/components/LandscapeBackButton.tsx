import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '../utils';

interface LandscapeBackButtonProps {
    onClick?: () => void;
    className?: string;
}

/**
 * Einheitlicher Zurück-Button (nur Pfeil) für den Seiten-Header.
 */
export function LandscapeBackButton({ onClick, className }: LandscapeBackButtonProps = {}) {
    const navigate = useNavigate();

    return (
        <button
            type="button"
            onClick={onClick || (() => (window.history.length > 1 ? navigate(-1) : navigate('/')))}
            className={cn(
                "flex items-center justify-center p-2 rounded-xl border border-border bg-card text-foreground hover:bg-accent transition-all shadow-sm shrink-0 active:scale-95 group",
                className
            )}
            title="Zurück"
            aria-label="Zurück"
        >
            <ArrowLeft className="size-5 transition-transform group-hover:-translate-x-0.5" />
        </button>
    );
}
