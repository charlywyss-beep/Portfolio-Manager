import { useMemo } from 'react';
import { usePortfolioData } from '../hooks/usePortfolioData';
import { useExchangeRates } from '../context/ExchangeRateContext';
import { analyzePortfolioRisk } from '../utils/risk-analysis';
import { convertToCHF } from '../utils/currency';
import { AlertTriangle, CheckCircle2, ShieldAlert, ShieldCheck } from 'lucide-react';
import { cn } from '../utils';

export function RiskAnalysisCard() {
    const { positions } = usePortfolioData();
    const { rates } = useExchangeRates();

    const analysis = useMemo(() => {
        // Convert all positions to CHF for uniform analysis
        const positionsCHF = positions.map(p => ({
            stock: p.stock,
            currentValue: convertToCHF(p.currentValue, p.stock.currency, rates)
        }));
        return analyzePortfolioRisk(positionsCHF);
    }, [positions, rates]);

    const { score, clusters } = analysis;

    // Determine color based on score
    let scoreColor = 'text-green-500';
    let ScoreIcon = ShieldCheck;
    if (score < 50) {
        scoreColor = 'text-red-500';
        ScoreIcon = ShieldAlert;
    } else if (score < 75) {
        scoreColor = 'text-yellow-500';
        ScoreIcon = AlertTriangle;
    }

    return (
        <div className="p-3 md:p-4 rounded-xl bg-card border border-border shadow-sm h-full flex flex-col">
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                    <ScoreIcon className={cn("size-5", scoreColor)} />
                    <h3 className="text-base font-bold">Risiko Check</h3>
                </div>
                <div className={cn("text-sm font-bold px-2 py-0.5 bg-muted rounded-full", scoreColor)}>
                    {score}/100
                </div>
            </div>

            <div className="flex-1 flex flex-col gap-2">
                {/* Score Description */}
                <div className="text-xs text-muted-foreground">
                    {score >= 80 ? 'Dein Portfolio ist gut diversifiziert.' :
                        score >= 50 ? 'Einige Klumpenrisiken vorhanden.' :
                            'Starke Konzentration in wenigen Bereichen.'}
                </div>

                {/* Cluster Warnings */}
                {clusters.length > 0 ? (
                    <div className="space-y-1.5 mt-1 overflow-y-auto max-h-[300px]">
                        {clusters.map((cluster, idx) => (
                            <div key={idx} className={cn(
                                "p-2 rounded-lg border text-xs",
                                cluster.severity === 'high'
                                    ? "bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-800 text-red-900 dark:text-red-100"
                                    : "bg-yellow-50 dark:bg-yellow-900/30 border-yellow-200 dark:border-yellow-800 text-yellow-900 dark:text-yellow-100"
                            )}>
                                <div className="flex items-start gap-2">
                                    <AlertTriangle className={cn(
                                        "size-3.5 shrink-0 mt-0.5",
                                        cluster.severity === 'high' ? "text-red-600 dark:text-red-400" : "text-yellow-600 dark:text-yellow-400"
                                    )} />
                                    <div>
                                        <p className="font-bold">{cluster.name}</p>
                                        <p className="opacity-90 mt-0.5 leading-snug">{cluster.description}</p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-100 dark:border-green-900 mt-1">
                        <CheckCircle2 className="size-6 text-green-500 mb-1" />
                        <p className="text-xs font-medium text-green-700 dark:text-green-300">Keine auffälligen Risiken.</p>
                    </div>
                )}

                {/* Top Stats */}
                <div className="pt-2 border-t border-border grid grid-cols-2 gap-2 text-[10px] sm:text-xs mt-auto">
                    <div>
                        <p className="text-muted-foreground">Dominanter Sektor</p>
                        <p className="font-semibold truncate" title={analysis.sectorDominance?.sector}>
                            {analysis.sectorDominance?.sector || '-'} ({analysis.sectorDominance?.percent.toFixed(0)}%)
                        </p>
                    </div>
                    <div>
                        <p className="text-muted-foreground">Dominantes Land</p>
                        <p className="font-semibold truncate" title={analysis.countryDominance?.country}>
                            {analysis.countryDominance?.country || '-'} ({analysis.countryDominance?.percent.toFixed(0)}%)
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
