import { useState, useEffect } from 'react';
import { X, Search, PlusCircle, BarChart3, PieChart } from 'lucide-react';
import type { Stock } from '../types';
import { cn } from '../utils';
import { usePortfolio } from '../context/PortfolioContext';
import { useCurrencyFormatter } from '../utils/currency';
import { DecimalInput } from './DecimalInput';

interface AddPositionModalProps {
    isOpen: boolean;
    onClose: () => void;
    stocks: Stock[];
    onAdd: (position: { stockId: string; shares: number; buyPriceAvg: number; averageEntryFxRate?: number }) => void;
    preSelectedStock?: Stock | null; // New prop
}

export function AddPositionModal({ isOpen, onClose, stocks, onAdd, preSelectedStock }: AddPositionModalProps) {
    const { addStock } = usePortfolio();
    const { formatCurrency, rates } = useCurrencyFormatter(); // Get rates
    const [activeTab, setActiveTab] = useState<'search' | 'manual'>('search');
    const [searchTerm, setSearchTerm] = useState('');

    // Initialize with preSelectedStock if available
    const [selectedStock, setSelectedStock] = useState<Stock | null>(preSelectedStock || null);
    const [shares, setShares] = useState('');
    const [buyPrice, setBuyPrice] = useState(preSelectedStock ? preSelectedStock.currentPrice.toString() : '');
    const [fxRate, setFxRate] = useState(''); // New State for FX Rate

    // Manual entry state
    const [newStock, setNewStock] = useState<{
        name: string;
        symbol: string;
        type: 'stock' | 'etf';
        sector: string;
        isin: string;
        valor: string;
        currency: string;
        currentPrice: string;
        dividendYield: string;
    }>({
        name: '',
        symbol: '',
        type: 'stock',
        sector: '',
        isin: '',
        valor: '',
        currency: 'USD',
        currentPrice: '',
        dividendYield: '',
    });

    // Determine current currency to auto-fetch FX
    const currentCurrency = activeTab === 'manual' ? newStock.currency : (selectedStock?.currency || '');

    // Effect to update local state when prop changes or modal opens
    useEffect(() => {
        if (isOpen && preSelectedStock) {
            setSelectedStock(preSelectedStock);
            setBuyPrice(preSelectedStock.currentPrice.toString());
            setActiveTab('search');
        } else if (isOpen && !preSelectedStock) {
            // Reset if opening without pre-selection
            setSelectedStock(null);
            setBuyPrice('');
            setShares('');
            setSearchTerm('');
            setFxRate('');
        }
    }, [isOpen, preSelectedStock]);

    // Auto-Fetch FX Rate Logic
    useEffect(() => {
        if (!isOpen) return;

        if (currentCurrency === 'CHF') {
            setFxRate('1.0');
            return;
        }

        if (currentCurrency && rates && rates[currentCurrency]) {
            // 1 Unit of Foreign = X CHF
            // rates[currency] usually gives CHF per Unit or Unit per CHF?
            // Checking currency.ts: convertToCHF = amount / rate. So rate is "Foreign per CHF" (indirect quote) OR "CHF per Foreign"?
            // fallback: USD: 1.12. 1 CHF = 1.12 USD.
            // So convertToCHF(1 USD) = 1 / 1.12 = 0.89 CHF.
            // Wait, usually users think "1 USD = 0.90 CHF" (Direct Quote in CHF).
            // If rate is 1.12 (USD per CHF), then Direct Quote is 1 / 1.12.
            // Let's display the DIRECT quote (CHF per 1 Unit) because that's what "Wechselkurs" usually means in this context.
            // "Einstiegs-Wechselkurs" = How much CHF did I pay for 1 USD?
            // calculatedRate = 1 / rates[currentCurrency]

            const rate = rates[currentCurrency];
            if (rate) {
                const directRate = 1 / rate;
                setFxRate(directRate.toFixed(4));
            }
        }
    }, [currentCurrency, isOpen, rates]);


    if (!isOpen) return null;

    const filteredStocks = stocks.filter(
        (stock) =>
            stock.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            stock.symbol.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        const entryFxRate = parseFloat(fxRate) || 1.0;

        if (activeTab === 'search') {
            if (!selectedStock || !shares || !buyPrice) return;

            const isGBX = selectedStock.currency === 'GBp';
            const finalBuyPrice = isGBX ? parseFloat(buyPrice) * 100 : parseFloat(buyPrice);

            onAdd({
                stockId: selectedStock.id,
                shares: parseFloat(shares),
                buyPriceAvg: finalBuyPrice,
                averageEntryFxRate: entryFxRate,
            });
        } else {
            // Manual entry
            if (!shares || !buyPrice || !newStock.name || !newStock.symbol || !newStock.currentPrice) return;

            // Create stock first
            const stockId = addStock({
                name: newStock.name,
                symbol: newStock.symbol.toUpperCase(),
                type: newStock.type,
                sector: newStock.sector || 'Unbekannt',
                currency: newStock.currency as any,
                currentPrice: parseFloat(newStock.currentPrice),
                previousClose: parseFloat(newStock.currentPrice), // Fallback
                isin: newStock.isin || undefined,
                valor: newStock.valor || undefined,
                dividendYield: newStock.dividendYield ? parseFloat(newStock.dividendYield) : undefined,
            });

            const isGBX = newStock.currency === 'GBp';
            const finalBuyPrice = isGBX ? parseFloat(buyPrice) * 100 : parseFloat(buyPrice);

            // Create position
            onAdd({
                stockId: stockId,
                shares: parseFloat(shares),
                buyPriceAvg: finalBuyPrice,
                averageEntryFxRate: entryFxRate,
            });
        }

        // Reset and close
        setSelectedStock(null);
        setShares('');
        setBuyPrice('');
        setSearchTerm('');
        setFxRate('');
        setNewStock({
            name: '',
            symbol: '',
            type: 'stock',
            sector: '',
            isin: '',
            valor: '',
            currency: 'USD',
            currentPrice: '',
            dividendYield: '',
        });
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-border shrink-0">
                    <h2 className="text-xl font-bold">Position hinzufügen</h2>
                    <button onClick={onClose} className="p-2 hover:bg-muted rounded-lg transition-colors">
                        <X className="size-5" />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-border">
                    <button
                        onClick={() => setActiveTab('search')}
                        className={cn(
                            "flex-1 py-3 text-sm font-medium border-b-2 transition-colors flex items-center justify-center gap-2",
                            activeTab === 'search'
                                ? "border-primary text-primary"
                                : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30"
                        )}
                    >
                        <Search className="size-4" /> Suchliste
                    </button>
                    <button
                        onClick={() => setActiveTab('manual')}
                        className={cn(
                            "flex-1 py-3 text-sm font-medium border-b-2 transition-colors flex items-center justify-center gap-2",
                            activeTab === 'manual'
                                ? "border-primary text-primary"
                                : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30"
                        )}
                    >
                        <PlusCircle className="size-4" /> Manuell hinzufügen
                    </button>
                </div>

                {/* Content */}
                <form onSubmit={handleSubmit} className="p-6 space-y-6 overflow-y-auto">

                    {activeTab === 'search' ? (
                        /* Search Mode */
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Aktie auswählen</label>
                                {!selectedStock ? (
                                    <>
                                        <div className="relative">
                                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                                            <input
                                                type="text"
                                                placeholder="Aktienname oder Symbol suchen..."
                                                value={searchTerm}
                                                onChange={(e) => setSearchTerm(e.target.value)}
                                                className="w-full pl-9 pr-4 py-2 border border-border rounded-lg bg-background focus:ring-2 focus:ring-primary/20"
                                            />
                                        </div>
                                        <div className="max-h-60 overflow-y-auto border border-border rounded-lg divide-y divide-border">
                                            {filteredStocks.map((stock) => (
                                                <button
                                                    key={stock.id}
                                                    type="button"
                                                    onClick={() => {
                                                        setSelectedStock(stock);
                                                        setBuyPrice(stock.currentPrice.toString());
                                                    }}
                                                    className="w-full p-3 hover:bg-muted transition-colors text-left flex items-center gap-3"
                                                >
                                                    <div className="size-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold border border-primary/20">
                                                        {stock.symbol.slice(0, 2)}
                                                    </div>
                                                    <div className="flex-1">
                                                        <div className="font-semibold flex items-center gap-2">
                                                            {stock.name}
                                                            {stock.type === 'etf' && <span className="text-[10px] bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 px-1.5 py-0.5 rounded">ETF</span>}
                                                        </div>
                                                        <div className="text-sm text-muted-foreground">
                                                            {stock.symbol} • {stock.sector}
                                                        </div>
                                                    </div>
                                                    <div className="text-right">
                                                        <div className="font-medium">
                                                            {stock.currentPrice.toLocaleString('de-DE', { style: 'currency', currency: stock.currency === 'GBp' ? 'GBP' : stock.currency })}
                                                        </div>
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    </>
                                ) : (
                                    <div className="p-4 border border-border rounded-lg bg-muted/30 flex items-center gap-3">
                                        <div className="size-12 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold border border-primary/20">
                                            {selectedStock.symbol.slice(0, 2)}
                                        </div>
                                        <div className="flex-1">
                                            <div className="font-semibold">{selectedStock.name}</div>
                                            <div className="text-sm text-muted-foreground">
                                                {selectedStock.symbol} • {selectedStock.currentPrice.toLocaleString('de-DE', { style: 'currency', currency: selectedStock.currency === 'GBp' ? 'GBP' : selectedStock.currency })}
                                            </div>
                                        </div>
                                        <button type="button" onClick={() => setSelectedStock(null)} className="text-muted-foreground hover:text-foreground">
                                            <X className="size-5" />
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                        /* Manual Mode */
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="col-span-2">
                                    <label className="text-sm font-medium mb-2 block">Typ</label>
                                    <div className="flex gap-4">
                                        <label className={cn(
                                            "flex-1 flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors",
                                            newStock.type === 'stock' ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border hover:bg-muted/50"
                                        )}>
                                            <input type="radio" name="type" className="sr-only" checked={newStock.type === 'stock'} onChange={() => setNewStock({ ...newStock, type: 'stock' })} />
                                            <BarChart3 className={cn("size-5", newStock.type === 'stock' ? "text-primary" : "text-muted-foreground")} />
                                            <span className="font-medium">Aktie</span>
                                        </label>
                                        <label className={cn(
                                            "flex-1 flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors",
                                            newStock.type === 'etf' ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border hover:bg-muted/50"
                                        )}>
                                            <input type="radio" name="type" className="sr-only" checked={newStock.type === 'etf'} onChange={() => setNewStock({ ...newStock, type: 'etf' })} />
                                            <PieChart className={cn("size-5", newStock.type === 'etf' ? "text-primary" : "text-muted-foreground")} />
                                            <span className="font-medium">ETF</span>
                                        </label>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Name</label>
                                    <input required placeholder="z.B. Nestlé S.A." className="w-full px-3 py-2 border rounded-md bg-background text-foreground"
                                        value={newStock.name} onChange={e => setNewStock({ ...newStock, name: e.target.value })} />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Symbol</label>
                                    <input required placeholder="z.B. NESN" className="w-full px-3 py-2 border rounded-md uppercase bg-background text-foreground"
                                        value={newStock.symbol} onChange={e => setNewStock({ ...newStock, symbol: e.target.value.toUpperCase() })} />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Sektor (Optional)</label>
                                    <input placeholder="z.B. Konsumgüter" className="w-full px-3 py-2 border rounded-md bg-background text-foreground"
                                        value={newStock.sector} onChange={e => setNewStock({ ...newStock, sector: e.target.value })} />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Währung</label>
                                    <select className="w-full px-3 py-2 border rounded-md bg-background text-foreground"
                                        value={newStock.currency} onChange={e => setNewStock({ ...newStock, currency: e.target.value })}>
                                        <option value="GBP">GBP (Pfund)</option>
                                        <option value="USD">USD</option>
                                        <option value="CHF">CHF</option>
                                        <option value="EUR">EUR</option>
                                        <option value="GBp">GBp (System-Intern: Pfund)</option>
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Valor (Optional)</label>
                                    <input placeholder="z.B. 3886335" className="w-full px-3 py-2 border rounded-md bg-background text-foreground"
                                        value={newStock.valor} onChange={e => setNewStock({ ...newStock, valor: e.target.value })} />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">ISIN (Optional)</label>
                                    <input placeholder="z.B. CH0038863350" className="w-full px-3 py-2 border rounded-md bg-background text-foreground"
                                        value={newStock.isin} onChange={e => setNewStock({ ...newStock, isin: e.target.value })} />
                                </div>
                                <div className="space-y-2 col-span-2">
                                    <label className="text-sm font-medium">Aktueller Marktpreis</label>
                                    <DecimalInput required placeholder="z.B. 98.50" className="w-full px-3 py-2 border rounded-md bg-background text-foreground"
                                        value={newStock.currentPrice}
                                        onChange={val => {
                                            setNewStock({ ...newStock, currentPrice: val });
                                            if (!buyPrice) setBuyPrice(val);
                                        }} />
                                    <p className="text-xs text-muted-foreground">Dieser Preis wird als aktueller Kurs für die Simulation verwendet.</p>
                                </div>
                                <div className="space-y-2 col-span-2">
                                    <label className="text-sm font-medium">Dividendenrendite % (Optional)</label>
                                    <DecimalInput placeholder="z.B. 3.5" className="w-full px-3 py-2 border rounded-md bg-background text-foreground"
                                        value={newStock.dividendYield}
                                        onChange={val => setNewStock({ ...newStock, dividendYield: val })} />
                                    <p className="text-xs text-muted-foreground">Jährliche Dividendenrendite in Prozent.</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Shared Inputs */}
                    <div className="pt-4 border-t border-border space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Anzahl Anteile</label>
                                <DecimalInput required placeholder="z.B. 10" className="w-full px-3 py-2 border rounded-md bg-background text-foreground" value={shares} onChange={val => setShares(val)} />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Kaufpreis {activeTab === 'manual' ? (newStock.currency !== 'CHF' ? `(${newStock.currency})` : '') : (selectedStock?.currency && selectedStock.currency !== 'CHF' ? `(${selectedStock.currency})` : '')}</label>
                                <DecimalInput required placeholder="z.B. 150.00" className="w-full px-3 py-2 border rounded-md bg-background text-foreground" value={buyPrice} onChange={val => setBuyPrice(val)} />
                            </div>
                            {/* FX Rate Input - Only if not CHF */}
                            {((activeTab === 'manual' && newStock.currency !== 'CHF') || (activeTab === 'search' && selectedStock?.currency && selectedStock.currency !== 'CHF')) && (
                                <div className="space-y-2 col-span-2">
                                    <label className="text-sm font-medium flex justify-between">
                                        <span>Wechselkurs (CHF)</span>
                                        <span className="text-xs text-muted-foreground font-normal">
                                            1 {activeTab === 'manual' ? newStock.currency : selectedStock?.currency} = {fxRate} CHF
                                        </span>
                                    </label>
                                    <div className="relative">
                                        <DecimalInput
                                            required
                                            placeholder="z.B. 0.95"
                                            className="w-full px-3 py-2 border rounded-md bg-background text-foreground"
                                            value={fxRate}
                                            onChange={val => setFxRate(val)}
                                        />
                                        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm pointer-events-none">
                                            CHF
                                        </div>
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                        Wechselkurs zum Zeitpunkt des Kaufs. (Automatisch vorausgefüllt mit aktuellem Kurs)
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* Summary */}
                        {shares && buyPrice && (
                            <div className="p-4 bg-muted/50 rounded-lg border border-border space-y-2">
                                <div className="flex justify-between text-sm">
                                    <span>Gesamtinvestition:</span>
                                    <span className="font-medium">
                                        {formatCurrency(parseFloat(shares) * parseFloat(buyPrice), activeTab === 'manual' ? newStock.currency : (selectedStock?.currency || 'USD'), true)}
                                    </span>
                                </div>
                                {(() => {
                                    const numShares = parseFloat(shares);
                                    let annualDividend = 0;
                                    let currency = activeTab === 'manual' ? newStock.currency : (selectedStock?.currency || 'USD');

                                    if (activeTab === 'search' && selectedStock) {
                                        if (selectedStock.dividendAmount) {
                                            const factor = selectedStock.dividendFrequency === 'quarterly' ? 4 :
                                                selectedStock.dividendFrequency === 'semi-annually' ? 2 :
                                                    selectedStock.dividendFrequency === 'monthly' ? 12 : 1;
                                            annualDividend = numShares * selectedStock.dividendAmount * factor;
                                        } else if (selectedStock.dividendYield) {
                                            annualDividend = numShares * selectedStock.currentPrice * (selectedStock.dividendYield / 100);
                                        }
                                    } else if (activeTab === 'manual' && newStock.dividendYield && newStock.currentPrice) {
                                        annualDividend = numShares * parseFloat(newStock.currentPrice) * (parseFloat(newStock.dividendYield) / 100);
                                    }

                                    if (annualDividend > 0) {
                                        const totalInvest = parseFloat(shares) * parseFloat(buyPrice);
                                        const yieldOnCost = (annualDividend / totalInvest) * 100;
                                        return (
                                            <div className="flex justify-between text-sm items-center pt-2 border-t border-border/50">
                                                <span>Erw. Dividende (Jahr):</span>
                                                <div className="text-right">
                                                    <span className="font-medium block text-green-600 dark:text-green-400">
                                                        {formatCurrency(annualDividend, currency, true)}
                                                    </span>
                                                    <span className="text-xs text-muted-foreground block">
                                                        {yieldOnCost.toFixed(2)}% vom Kaufpreis
                                                    </span>
                                                </div>
                                            </div>
                                        );
                                    }
                                    return null;
                                })()}
                            </div>
                        )}

                        <div className="flex gap-3 pt-2">
                            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 border rounded-lg hover:bg-muted font-medium">Abbrechen</button>
                            <button type="submit"
                                disabled={activeTab === 'search' ? !selectedStock || !shares || !buyPrice : !shares || !buyPrice || !newStock.name || !newStock.currentPrice}
                                className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 font-medium disabled:opacity-50 disabled:cursor-not-allowed">
                                Position hinzufügen
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
}
