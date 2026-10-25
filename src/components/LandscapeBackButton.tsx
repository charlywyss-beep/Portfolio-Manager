import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

/**
 * Kompakter Zurück-Button (nur Pfeil) für den Seiten-Header.
 */
export function LandscapeBackButton() {
    const navigate = useNavigate();

    return (
        <button
            type="button"
            onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/'))}
            className="flex items-center justify-center p-2 rounded-xl border border-border bg-card text-foreground hover:bg-accent transition-all shadow-sm shrink-0 active:scale-95 group"
            title="Zurück"
            aria-label="Zurück"
        >
            <ArrowLeft className="size-5 transition-transform group-hover:-translate-x-0.5" />
        </button>
    );
}
