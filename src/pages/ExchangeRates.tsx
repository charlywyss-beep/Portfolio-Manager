import { CurrencyChart } from '../components/CurrencyChart';
import { CurrencyGainCalculator } from '../components/CurrencyGainCalculator';
import { ShareCalculator } from '../components/ShareCalculator';
import { InterestRateCalculator } from '../components/InterestRateCalculator';
import { CompoundInterestProjection } from '../components/CompoundInterestProjection';
import { ArrowLeftRight } from 'lucide-react';

export function ExchangeRates() {
    return (
        <div className="p-4 md:p-6 space-y-6 bg-gradient-to-br from-background via-background to-muted/20 animate-in fade-in duration-500">
            {/* Sticky Header - Consistent Design */}
            <div className="sticky top-0 z-50 bg-background pb-4 -mt-4 -mx-4 px-4 md:-mt-6 md:-mx-6 md:px-6">
                <div className="border-b bg-card rounded-t-xl -mx-4 md:-mx-6">
                    <div className="w-full pl-14 pr-4 py-4 md:px-6 md:pl-14 lg:pl-6">
                        <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3">
                                <div className="p-3 rounded-xl bg-gradient-to-br from-violet-500/20 to-purple-500/20 text-violet-600 dark:text-violet-400">
                                    <ArrowLeftRight className="size-6" />
                                </div>
                                <div>
                                    <h1 className="text-3xl font-bold tracking-tight">Finanz Rechner</h1>
                                    <p className="text-muted-foreground hidden md:block">Wechselkurse, Gewinn-Rechner und Zinseszins</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Full Width for Interest Projection */}
                <div className="lg:col-span-2">
                    <CompoundInterestProjection />
                </div>

                <CurrencyChart inverse={false} />
                <CurrencyChart inverse={true} />

                <CurrencyGainCalculator />
                <ShareCalculator />
                <InterestRateCalculator />
            </div>
        </div>
    );
}
