import { useEffect, useRef } from 'react';

interface UseAutoRefreshOptions {
    onRefresh: () => void;
    intervalMs?: number; // Default: 5 minutes
    enabled?: boolean; // Default: true
    lastRefreshAt?: Date | null;
}

/**
 * Auto-refresh hook that triggers a callback every X minutes during weekday trading hours (Mon-Fri 09:00-22:00)
 * Pauses when tab is not visible for performance and syncs cleanly with lastRefreshAt so it doesn't drift.
 */
export function useAutoRefresh({
    onRefresh,
    intervalMs = 5 * 60 * 1000, // 5 minutes
    enabled = true,
    lastRefreshAt = null
}: UseAutoRefreshOptions) {
    const intervalRef = useRef<number | null>(null);
    const onRefreshRef = useRef(onRefresh);
    const lastRefreshTimeRef = useRef<number>(lastRefreshAt ? lastRefreshAt.getTime() : Date.now());

    // Update ref when onRefresh changes
    useEffect(() => {
        onRefreshRef.current = onRefresh;
    }, [onRefresh]);

    // Sync internal timer when a manual/external refresh succeeds
    useEffect(() => {
        if (lastRefreshAt) {
            const ts = lastRefreshAt.getTime();
            if (ts > lastRefreshTimeRef.current) {
                lastRefreshTimeRef.current = ts;
            }
        }
    }, [lastRefreshAt]);

    useEffect(() => {
        if (!enabled) return;

        const isTradingHours = () => {
            const now = new Date();
            const day = now.getDay();
            // Skip Saturday (6) & Sunday (0)
            if (day === 0 || day === 6) return false;
            const hours = now.getHours();
            // Trading hours: 09:00-22:00 (covers SIX, LSE, NYSE, NASDAQ)
            return hours >= 9 && hours < 22;
        };

        const checkAndRefresh = () => {
            if (document.hidden || !isTradingHours()) return;
            const elapsed = Date.now() - lastRefreshTimeRef.current;
            if (elapsed >= intervalMs) {
                lastRefreshTimeRef.current = Date.now();
                onRefreshRef.current();
            }
        };

        const handleVisibilityChange = () => {
            if (!document.hidden) {
                checkAndRefresh();
            }
        };

        // Check every 30s so background throttling or manual refreshes never cause 6-8 min drift
        intervalRef.current = window.setInterval(checkAndRefresh, 30 * 1000);

        // Listen for visibility changes
        document.addEventListener('visibilitychange', handleVisibilityChange);

        // Cleanup
        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
        // Removed `onRefresh` from dependency array to prevent interval reset on callback change
        // We handle callback updates via the separate useEffect above
    }, [intervalMs, enabled]);
}
