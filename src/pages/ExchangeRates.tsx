import { CurrencyChart } from '../components/CurrencyChart';
import { CurrencyGainCalculator } from '../components/CurrencyGainCalculator';
import { ShareCalculator } from '../components/ShareCalculator';
import { InterestRateCalculator } from '../components/InterestRateCalculator';
import { ArrowLeftRight } from 'lucide-react';

export function ExchangeRates() {
    return (
        <div className="p-6 md:p-8 space-y-6 animate-in fade-in duration-500">
            <div className="flex items-center gap-3 mb-2">
                <div className="p-2 rounded-lg bg-primary/10 text-primary">
                    <ArrowLeftRight className="size-6" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Wechselkurse</h1>
                    <p className="text-muted-foreground text-sm">Aktuelle Devisenkurse und historische Entwicklung</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <CurrencyChart inverse={false} />
                <CurrencyChart inverse={true} />

                <CurrencyGainCalculator />
                <ShareCalculator />
                <InterestRateCalculator />
            </div>
        </div>
    );
}
