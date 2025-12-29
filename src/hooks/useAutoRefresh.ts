import { useEffect, useRef } from 'react';

interface UseAutoRefreshOptions {
    onRefresh: () => void;
    intervalMs?: number; // Default: 5 minutes
    enabled?: boolean; // Default: true
}

/**
 * Auto-refresh hook that triggers a callback every X minutes during trading hours (09:00-22:00)
 * Pauses when tab is not visible for performance
 */
export function useAutoRefresh({
    onRefresh,
    intervalMs = 5 * 60 * 1000, // 5 minutes
    enabled = true
}: UseAutoRefreshOptions) {
    const intervalRef = useRef<number | null>(null);
    const onRefreshRef = useRef(onRefresh);

    // Update ref when onRefresh changes
    useEffect(() => {
        onRefreshRef.current = onRefresh;
    }, [onRefresh]);

    useEffect(() => {
        if (!enabled) return;

        const isTradingHours = () => {
            const now = new Date();
            const hours = now.getHours();
            // Trading hours: 09:00-22:00 (covers SIX, LSE, NYSE, NASDAQ)
            return hours >= 9 && hours < 22;
        };

        const handleVisibilityChange = () => {
            if (document.hidden) {
                // Pause when tab is hidden
                if (intervalRef.current) {
                    clearInterval(intervalRef.current);
                    intervalRef.current = null;
                }
            } else {
                // Resume when tab becomes visible
                // Trigger immediate refresh to prevent stale data
                onRefresh();
                startInterval();
            }
        };

        const startInterval = () => {
            // Clear existing interval if any
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }

            // Only start if in trading hours and tab is visible
            if (isTradingHours() && !document.hidden) {
                intervalRef.current = setInterval(() => {
                    if (isTradingHours()) {
                        // Use ref to avoid dependency loop or resetting interval when callback changes
                        if (onRefreshRef.current) {
                            onRefreshRef.current();
                        }
                    } else {
                        // Stop interval if outside trading hours
                        if (intervalRef.current) {
                            clearInterval(intervalRef.current);
                            intervalRef.current = null;
                        }
                    }
                }, intervalMs);
            }
        };

        // Start interval
        startInterval();

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
