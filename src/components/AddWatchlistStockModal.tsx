import React, { useState } from 'react';
import { usePortfolio } from '../context/PortfolioContext';
import { X, Plus } from 'lucide-react';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    onAdd: (id: string) => void;
}

export function AddWatchlistStockModal({ isOpen, onClose, onAdd }: Props) {
    const { stocks, addStock } = usePortfolio();
    const [searchTerm, setSearchTerm] = useState('');
    const [isCreating, setIsCreating] = useState(false);

    // New Stock Form State
    const [newSymbol, setNewSymbol] = useState('');
    const [newName, setNewName] = useState('');
    const [newPrice, setNewPrice] = useState('');
    const [newCurrency, setNewCurrency] = useState('USD');

    if (!isOpen) return null;

    const filteredStocks = stocks.filter(s =>
        s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.symbol.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleCreate = (e: React.FormEvent) => {
        e.preventDefault();
        // Create new stock
        const id = addStock({
            symbol: newSymbol,
            name: newName,
            currentPrice: parseFloat(newPrice),
            previousClose: parseFloat(newPrice),
            currency: newCurrency as any,
            sector: 'Unknown'
        });
        onAdd(id);
        // Reset
        setNewSymbol('');
        setNewName('');
        setNewPrice('');
        setIsCreating(false);
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-md animate-in zoom-in-95 duration-200">
                <div className="flex items-center justify-between p-6 border-b border-border">
                    <h2 className="text-xl font-bold">Aktie zur Watchlist hinzufügen</h2>
                    <button onClick={onClose}><X className="size-5" /></button>
                </div>

                <div className="p-6 space-y-4">
                    {!isCreating ? (
                        <>
                            <input
                                type="text"
                                placeholder="Suchen..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full px-3 py-2 border rounded-md"
                            />

                            <div className="max-h-[200px] overflow-y-auto space-y-2 border rounded-md p-2">
                                {filteredStocks.map(stock => (
                                    <button
                                        key={stock.id}
                                        onClick={() => onAdd(stock.id)}
                                        className="w-full text-left p-2 hover:bg-muted rounded flex justify-between items-center"
                                    >
                                        <span>{stock.name} ({stock.symbol})</span>
                                        <Plus className="size-4" />
                                    </button>
                                ))}
                                {filteredStocks.length === 0 && (
                                    <p className="text-center text-sm text-muted-foreground py-2">Keine Aktie gefunden.</p>
                                )}
                            </div>

                            <div className="pt-2 border-t text-center">
                                <button onClick={() => setIsCreating(true)} className="text-primary text-sm font-medium hover:underline">
                                    Neue Aktie erstellen
                                </button>
                            </div>
                        </>
                    ) : (
                        <form onSubmit={handleCreate} className="space-y-3">
                            <div>
                                <label className="text-xs font-medium">Name</label>
                                <input required value={newName} onChange={e => setNewName(e.target.value)} className="w-full border rounded px-2 py-1" />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs font-medium">Symbol</label>
                                    <input required value={newSymbol} onChange={e => setNewSymbol(e.target.value)} className="w-full border rounded px-2 py-1" />
                                </div>
                                <div>
                                    <label className="text-xs font-medium">Währung</label>
                                    <select value={newCurrency} onChange={e => setNewCurrency(e.target.value)} className="w-full border rounded px-2 py-1">
                                        <option value="USD">USD</option>
                                        <option value="EUR">EUR</option>
                                        <option value="CHF">CHF</option>
                                        <option value="GBp">GBp</option>
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="text-xs font-medium">Aktueller Preis</label>
                                <input required type="number" step="0.01" value={newPrice} onChange={e => setNewPrice(e.target.value)} className="w-full border rounded px-2 py-1" />
                            </div>

                            <div className="flex gap-2 pt-2">
                                <button type="button" onClick={() => setIsCreating(false)} className="flex-1 border rounded py-1">Zurück</button>
                                <button type="submit" className="flex-1 bg-primary text-primary-foreground rounded py-1">Erstellen</button>
                            </div>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
}
