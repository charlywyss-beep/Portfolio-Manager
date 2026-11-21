import { useState, useRef, useLayoutEffect } from 'react';
import { LandscapeBackButton } from '../components/LandscapeBackButton';
import { CurrencyChart, type CurrencyCode } from '../components/CurrencyChart';
import { CurrencyGainCalculator } from '../components/CurrencyGainCalculator';
import { ShareCalculator } from '../components/ShareCalculator';
import { InterestRateCalculator } from '../components/InterestRateCalculator';
import { CompoundInterestProjection } from '../components/CompoundInterestProjection';
import { ArrowLeftRight } from 'lucide-react';

const SCROLL_STORAGE_KEY = 'finanz_rechner_scroll_top';

export function ExchangeRates() {
    const [transferredBudget, setTransferredBudget] = useState<{
        amount: string;
        currency: CurrencyCode;
        key: number;
    } | null>(null);
    const shareCalcRef = useRef<HTMLDivElement>(null);
    const isRestoringScrollRef = useRef(false);

    // Restore exact <main> scroll position & continuously track scrollTop (cleanup runs synchronously before route swap)
    useLayoutEffect(() => {
        const mainEl = document.querySelector('main');
        if (!mainEl) return;

        let savedTop = 0;
        try {
            const raw = sessionStorage.getItem(SCROLL_STORAGE_KEY);
            const parsed = raw !== null ? Number(raw) : 0;
            if (Number.isFinite(parsed) && parsed > 0) {
                savedTop = parsed;
            }
        } catch {}

        let cancelled = false;
        let rafId: number | null = null;
        let timerId: number | null = null;

        const cancelRestore = () => {
            cancelled = true;
            isRestoringScrollRef.current = false;
        };

        if (savedTop > 0) {
            isRestoringScrollRef.current = true;
            const applyScroll = () => {
                if (cancelled) return;
                mainEl.scrollTop = savedTop;
            };

            applyScroll();
            rafId = window.requestAnimationFrame(applyScroll);
            timerId = window.setTimeout(() => {
                applyScroll();
                isRestoringScrollRef.current = false;
            }, 120);

            mainEl.addEventListener('wheel', cancelRestore, { passive: true, once: true });
            mainEl.addEventListener('touchstart', cancelRestore, { passive: true, once: true });
            mainEl.addEventListener('pointerdown', cancelRestore, { passive: true, once: true });
        }

        const handleScroll = () => {
            if (isRestoringScrollRef.current) return;
            try {
                sessionStorage.setItem(SCROLL_STORAGE_KEY, String(Math.round(mainEl.scrollTop)));
            } catch {}
        };

        mainEl.addEventListener('scroll', handleScroll, { passive: true });

        return () => {
            cancelled = true;
            isRestoringScrollRef.current = false;
            if (rafId !== null) window.cancelAnimationFrame(rafId);
            if (timerId !== null) window.clearTimeout(timerId);
            mainEl.removeEventListener('wheel', cancelRestore);
            mainEl.removeEventListener('touchstart', cancelRestore);
            mainEl.removeEventListener('pointerdown', cancelRestore);
            mainEl.removeEventListener('scroll', handleScroll);
        };
    }, []);

    const handleTransferToShareCalc = (amount: string, currency: CurrencyCode) => {
        setTransferredBudget({ amount, currency, key: Date.now() });
        shareCalcRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    };

    return (
        <div className="p-4 md:p-6 space-y-6 bg-gradient-to-br from-background via-background to-muted/20 animate-in fade-in duration-500 iphone-landscape-page-root">
            {/* Sticky Header - Consistent Design */}
            <div className="sticky top-0 z-50 bg-background pb-4 -mt-4 -mx-4 px-4 md:-mt-6 md:-mx-6 md:px-6 iphone-landscape-portfolio-header-wrap">
                <div className="border-b bg-card rounded-t-xl -mx-4 md:-mx-6">
                    <div className="w-full pl-14 pr-4 py-4 md:px-6 md:pl-14 xl:pl-6 iphone-landscape-portfolio-header-content">
                        <div className="flex items-center justify-between gap-3 iphone-landscape-portfolio-header-row">
                            <div className="flex items-center gap-3 iphone-landscape-portfolio-title-group">
                                <LandscapeBackButton />
                                <div className="p-3 rounded-xl bg-gradient-to-br from-violet-500/20 to-purple-500/20 text-violet-600 dark:text-violet-400 iphone-landscape-portfolio-icon">
                                    <ArrowLeftRight className="size-6" />
                                </div>
                                <div>
                                    <h1 className="text-3xl font-bold tracking-tight iphone-landscape-portfolio-title">Finanz Rechner</h1>
                                    <p className="text-muted-foreground hidden md:block iphone-landscape-portfolio-subtitle">Wechselkurse, Gewinn-Rechner und Zinseszins</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="space-y-6">
                {/* Full Width for Interest Projection */}
                <CompoundInterestProjection />

                {/* Single Full-Width Free-Choice Exchange Rate Card */}
                <CurrencyChart onTransferToShareCalc={handleTransferToShareCalc} />

                {/* 3 Compact Calculators cleanly side-by-side */}
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 items-stretch">
                    <CurrencyGainCalculator className="h-full" />
                    <div ref={shareCalcRef} className="flex flex-col h-full">
                        <ShareCalculator transferredBudget={transferredBudget} className="h-full" />
                    </div>
                    <InterestRateCalculator className="h-full" />
                </div>
            </div>
        </div>
    );
}
