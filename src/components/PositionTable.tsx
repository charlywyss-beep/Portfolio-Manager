import { useNavigate } from 'react-router-dom';
import { usePortfolio } from '../context/PortfolioContext';
import { cn } from '../utils';
import { useCurrencyFormatter } from '../utils/currency';
import { Logo } from './Logo';
import { estimateMarketState } from '../utils/market';
import { Edit, Trash2, ArrowUpRight, ArrowDownRight } from 'lucide-react';

interface PositionTableProps {
    title: string;
    icon: React.ElementType;
    data: any[];
    emptyMessage: string;
    setSelectedPosition: (pos: any) => void;
    setIsEditModalOpen: (open: boolean) => void;
    headerAction?: React.ReactNode;
}

export function PositionTable({ title, icon: Icon, data, emptyMessage, setSelectedPosition, setIsEditModalOpen, headerAction }: PositionTableProps) {
    const { deletePosition } = usePortfolio();
    const navigate = useNavigate();
    const { formatCurrency, convertToCHF } = useCurrencyFormatter();

    return (
        <div className="space-y-3">
            <div className="flex items-center gap-2">
                <Icon className="size-6 text-primary" />
                <h2 className="text-xl font-bold tracking-tight">{title}</h2>
                <span className="text-sm font-mono bg-muted px-2 py-0.5 rounded-full text-muted-foreground">{data.length} Positionen</span>
                {headerAction && <div className="ml-auto">{headerAction}</div>}
            </div>
            <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden overflow-clip">
                <div className="overflow-x-auto overscroll-x-none">

                    <table className="w-full text-sm text-left">
                        <thead className="sticky top-0 z-50 bg-card">
                            <tr className="border-b border-border">
                                <th className="text-left py-3 px-4 font-semibold min-w-[160px] md:w-[100px] md:max-w-[100px] sticky -left-px z-50 bg-card shadow-[5px_0_5px_-5px_rgba(0,0,0,0.1)]">Aktie</th>
                                <th className="text-right py-3 px-4 font-semibold whitespace-nowrap bg-card">ISIN</th>
                                <th className="text-right py-3 px-4 font-semibold whitespace-nowrap bg-card">Anzahl</th>
                                <th className="text-right py-3 px-4 font-semibold whitespace-nowrap bg-card">Ø Kauf</th>
                                <th className="text-right py-3 px-4 font-semibold whitespace-nowrap bg-card">Invest</th>
                                <th className="text-right py-3 px-4 font-semibold whitespace-nowrap bg-card">Kurs</th>
                                <th className="text-right py-3 px-4 font-semibold whitespace-nowrap bg-card">Wert</th>
                                <th className="text-right py-3 px-4 font-semibold whitespace-nowrap bg-card">+/-</th>
                                <th className="text-right py-3 px-4 font-semibold whitespace-nowrap bg-card">%</th>
                                <th className="text-right py-3 px-2 w-[80px] sticky -right-px bg-card z-50 shadow-[-5px_0_5px_-5px_rgba(0,0,0,0.1)]">Aktion</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {data.map((pos) => {
                                return (
                                    <tr key={pos.id} className="group hover:bg-muted/30 transition-colors border-b border-border/50 last:border-0 border-l border-r border-transparent hover:border-border/50">
                                        <td className="px-4 py-3 min-w-[160px] md:w-[100px] md:max-w-[100px] sticky -left-px z-10 group-hover:bg-muted/30 transition-colors shadow-[5px_0_5px_-5px_rgba(0,0,0,0.1)]">
                                            <div className="absolute inset-0 bg-card -z-10" />
                                            <div className="relative flex items-center gap-3">
                                                <Logo
                                                    url={pos.stock.logoUrl}
                                                    alt={pos.stock.name}
                                                    fallback={pos.stock.symbol.slice(0, 2)}
                                                />
                                                <div className="min-w-0 flex-1 flex flex-col items-start gap-0.5">
                                                    <div
                                                        className="font-semibold text-foreground cursor-pointer hover:text-primary transition-colors text-sm whitespace-pre-line"
                                                        onClick={() => navigate(`/stock/${pos.stock.id}`)}
                                                    >
                                                        {pos.stock.name}
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <div className="text-xs font-mono text-muted-foreground">{pos.stock.symbol}</div>
                                                        {(() => {
                                                            // STRICT Time-Based Logic (Synced with StockDetail v3.11.481)
                                                            // We trust the Clock (estimateMarketState). 
                                                            // If it's trading hours -> Green. Else -> Red.
                                                            // We ignore 'apiState' for the dot color to avoid "Green at Night" or "Red at Day" due to API delays.
                                                            const calculatedState = estimateMarketState(pos.stock.symbol, pos.stock.currency);
                                                            const isMarketOpen = calculatedState === 'REGULAR';

                                                            return isMarketOpen ? (
                                                                <div className="size-2.5 rounded-full bg-green-500 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.5)] border border-background" title={`Markt geöffnet (${calculatedState})`} />
                                                            ) : (
                                                                <div className="size-2.5 rounded-full bg-red-500 border border-background" title={`Markt geschlossen (${calculatedState})`} />
                                                            );
                                                        })()}
                                                    </div>
                                                    <div className="text-[10px] text-muted-foreground/80">{pos.stock.sector}</div>
                                                </div>
                                            </div>
                                        </td>

                                        {/* Valor / ISIN */}
                                        <td className="px-4 py-3 text-right">
                                            <div className="text-xs space-y-0.5 flex flex-col items-end">
                                                {pos.stock.valor && (
                                                    <div className="font-mono">
                                                        <span className="text-muted-foreground">Valor: </span>
                                                        <span className="font-medium">{pos.stock.valor}</span>
                                                    </div>
                                                )}
                                                {pos.stock.isin && (
                                                    <div className="font-mono text-muted-foreground truncate" title={pos.stock.isin}>
                                                        {pos.stock.isin}
                                                    </div>
                                                )}
                                            </div>
                                        </td>

                                        {/* Anzahl */}
                                        <td className="px-4 py-3 text-right font-medium">{pos.shares}</td>

                                        {/* Kauf Kurs */}
                                        <td className="px-4 py-3 text-right">
                                            <div className="flex flex-col items-end">
                                                <span className="font-medium whitespace-nowrap">{formatCurrency(pos.buyPriceAvg, pos.stock.currency, false)}</span>
                                                {pos.stock.currency !== 'CHF' && (
                                                    <span className="font-medium whitespace-nowrap">
                                                        {formatCurrency(pos.buyValueCHF / pos.shares, 'CHF', false)}
                                                    </span>
                                                )}
                                            </div>
                                        </td>

                                        {/* Kauf Wert */}
                                        <td className="px-4 py-3 text-right font-medium">
                                            <div className="flex flex-col items-end">
                                                <span className="font-medium whitespace-nowrap">{formatCurrency(pos.buyValue, pos.stock.currency, false)}</span>
                                                {pos.stock.currency !== 'CHF' && (
                                                    <span className="font-medium whitespace-nowrap">
                                                        {formatCurrency(pos.buyValueCHF, 'CHF', false)}
                                                    </span>
                                                )}
                                            </div>
                                        </td>

                                        {/* Aktueller Kurs */}
                                        <td className="px-4 py-3 text-right">
                                            <div className="flex flex-col items-end">
                                                <span className="font-medium whitespace-nowrap">{formatCurrency(pos.stock.currentPrice, pos.stock.currency, false)}</span>
                                                {pos.stock.currency !== 'CHF' && (
                                                    <span className="font-medium whitespace-nowrap">
                                                        {formatCurrency(convertToCHF(pos.stock.currentPrice, pos.stock.currency), 'CHF', false)}
                                                    </span>
                                                )}
                                            </div>
                                        </td>

                                        {/* Aktueller Wert */}
                                        <td className="px-4 py-3 text-right font-bold">
                                            <div className="flex flex-col items-end">
                                                <span className="font-medium whitespace-nowrap">{formatCurrency(pos.currentValue, pos.stock.currency, false)}</span>
                                                {pos.stock.currency !== 'CHF' && (
                                                    <span className="font-medium whitespace-nowrap">
                                                        {formatCurrency(convertToCHF(pos.currentValue, pos.stock.currency), 'CHF', false)}
                                                    </span>
                                                )}
                                            </div>
                                        </td>

                                        {/* Gesamt +/- */}
                                        <td className="px-4 py-3 text-right">
                                            <div className="flex flex-col items-end gap-0.5">
                                                {/* Native Gain/Loss */}
                                                {(() => {
                                                    const nativeGain = pos.gainLossTotal;
                                                    const chfGain = pos.gainLossTotalCHF;
                                                    const isNativeCHF = pos.stock.currency === 'CHF';

                                                    return (
                                                        <>
                                                            <div className={cn(
                                                                "flex items-center justify-end gap-1.5 font-medium tabular-nums",
                                                                nativeGain >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
                                                            )} title="Gewinn/Verlust (Native)">
                                                                <span>
                                                                    {nativeGain >= 0 ? '+' : ''}{nativeGain.toLocaleString('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                                </span>
                                                                <span className="w-8 text-left text-[11px] uppercase text-current/80 sm:text-sm sm:w-8 translate-y-[0.5px]">
                                                                    {pos.stock.currency === 'GBp' ? 'GBP' : pos.stock.currency}
                                                                </span>
                                                            </div>

                                                            {!isNativeCHF && (
                                                                <div className={cn(
                                                                    "flex items-center justify-end gap-1.5 font-medium tabular-nums",
                                                                    chfGain >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
                                                                )} title="Gewinn/Verlust in CHF">
                                                                    <span>
                                                                        {chfGain >= 0 ? '+' : ''}{chfGain.toLocaleString('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                                    </span>
                                                                    <span className="w-8 text-left text-[11px] uppercase text-current/80 sm:text-sm sm:w-8 translate-y-[0.5px]">
                                                                        CHF
                                                                    </span>
                                                                </div>
                                                            )}

                                                            {/* Forex Impact (Optional, keep if needed or tabularize it too?) 
                                                            Original: (Währung: +5'704.93 CHF)
                                                            This is usually small text below. Standardizing it might make it too prominent?
                                                            The user explicitly asked for tabular alignment for "+/-". 
                                                            To be safe, I will keep Forex Impact as is but ensure it doesn't break flow.
                                                            Or should I align it too? 
                                                            The screenshot shows separate lines. I will keep it simple for now, focusing on the main numbers.
                                                        */}
                                                            {!isNativeCHF && (
                                                                <div className={cn(
                                                                    "text-xs whitespace-nowrap mt-0.5 text-right",
                                                                    pos.forexImpactCHF >= 0 ? "text-emerald-600/80 dark:text-emerald-400/80" : "text-rose-600/80 dark:text-rose-400/80"
                                                                )} title="Anteil Währungsgewinn/-verlust">
                                                                    (Währung: {pos.forexImpactCHF >= 0 ? '+' : ''}{pos.forexImpactCHF.toLocaleString('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} CHF)
                                                                </div>
                                                            )}
                                                        </>
                                                    );
                                                })()}
                                            </div>
                                        </td>

                                        <td className="px-4 py-3 text-right">
                                            <div className={cn(
                                                "flex items-center justify-end gap-1 font-medium",
                                                pos.gainLossTotal >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
                                            )}>
                                                {pos.gainLossTotal >= 0 ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
                                                {pos.gainLossTotal >= 0 ? '+' : ''}{pos.gainLossTotalPercent.toFixed(2)}%
                                            </div>
                                        </td>

                                        <td className="text-center py-3 px-1 w-[60px] min-w-[60px] max-w-[60px] sticky -right-px z-40 group-hover:bg-muted transition-colors">
                                            <div className="absolute inset-0 bg-card -z-10" />
                                            <div className="relative flex items-center justify-center gap-1">
                                                <button
                                                    onClick={() => {
                                                        setSelectedPosition(pos);
                                                        setIsEditModalOpen(true);
                                                    }}
                                                    className="p-1 hover:bg-muted rounded text-primary transition-colors"
                                                    title="Position bearbeiten (Kauf/Verkauf/Korrektur)"
                                                >
                                                    <Edit className="size-3.5" />
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        if (confirm(`Position "${pos.stock.name}" wirklich löschen?`)) {
                                                            deletePosition(pos.id);
                                                        }
                                                    }}
                                                    className="p-1.5 sm:p-2 hover:bg-red-500/10 text-red-600 dark:text-red-400 rounded-lg transition-colors"
                                                    title="Position löschen"
                                                >
                                                    <Trash2 className="size-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                            {data.length === 0 && (
                                <tr>
                                    <td colSpan={10} className="px-4 py-12 text-center text-muted-foreground">
                                        {emptyMessage}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
