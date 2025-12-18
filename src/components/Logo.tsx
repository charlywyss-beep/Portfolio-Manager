import { useState, useEffect } from 'react';
import { cn } from '../utils';

interface LogoProps {
    url?: string;
    alt: string;
    fallback: React.ReactNode;
    size?: string;
    className?: string;
}

export const Logo = ({ url, alt, fallback, size = "size-8", className }: LogoProps) => {
    const [error, setError] = useState(false);

    // Reset error when url changes
    useEffect(() => {
        setError(false);
    }, [url]);

    if (!url || error) {
        return (
            <div className={cn(
                size,
                "rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold border border-primary/20 text-xs shrink-0 select-none",
                className
            )}>
                {fallback}
            </div>
        );
    }

    return (
        <div className={cn(
            size,
            "rounded-lg bg-white p-1 border border-border shadow-sm flex items-center justify-center shrink-0 overflow-hidden",
            className
        )}>
            <img
                src={url}
                alt={alt}
                className="object-contain w-full h-full"
                onError={() => setError(true)}
            />
        </div>
    );
};
