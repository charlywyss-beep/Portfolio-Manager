import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { usePortfolio } from '../context/PortfolioContext';
import type { FixedDeposit, Currency, BankAccountType } from '../types';

interface AddFixedDepositModalProps {
    isOpen: boolean;
    onClose: () => void;
    editingDeposit?: FixedDeposit | null;
}

export function AddFixedDepositModal({ isOpen, onClose, editingDeposit }: AddFixedDepositModalProps) {
    const { addFixedDeposit, updateFixedDeposit } = usePortfolio();

    const [bankName, setBankName] = useState('');
    const [amount, setAmount] = useState<number | ''>('');
    const [interestRate, setInterestRate] = useState<number | ''>('');
    const [currency, setCurrency] = useState<Currency>('CHF');
    const [notes, setNotes] = useState('');
    const [accountType, setAccountType] = useState<BankAccountType>('sparkonto');
    const [logoUrl, setLogoUrl] = useState(''); // NEW
    const [domain, setDomain] = useState(''); // NEW: For generator

    useEffect(() => {
        if (editingDeposit) {
            setBankName(editingDeposit.bankName);
            setAmount(editingDeposit.amount);
            setInterestRate(editingDeposit.interestRate);
            setCurrency(editingDeposit.currency);
            setNotes(editingDeposit.notes || '');
            setNotes(editingDeposit.notes || '');
            setAccountType(editingDeposit.accountType || 'sparkonto');
            setLogoUrl(editingDeposit.logoUrl || '');
        } else {
            // Reset form for new entry
            setBankName('');
            setAmount('');
            setInterestRate('');
            setCurrency('CHF');
            setNotes('');
            setAccountType('sparkonto');
            setLogoUrl('');
            setDomain('');
        }
    }, [editingDeposit, isOpen]);

    if (!isOpen) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        const depositData: any = {
            bankName,
            amount: Number(amount),
            interestRate: interestRate === '' ? 0 : Number(interestRate),
            currency,
            notes,
            accountType,
            logoUrl,
            startDate: new Date().toISOString(), // Internal timestamp
            maturityDate: new Date().toISOString() // Internal timestamp (irrelevant for open end)
        };

        if (editingDeposit) {
            updateFixedDeposit(editingDeposit.id, depositData);
        } else {
            addFixedDeposit(depositData);
        }
        onClose();
    };

    const generateLogo = () => {
        if (!domain) return;
        // Clean domain
        let cleanDomain = domain.toLowerCase().replace('https://', '').replace('http://', '').replace('www.', '');
        if (cleanDomain.includes('/')) cleanDomain = cleanDomain.split('/')[0];

        const generatedUrl = `https://logo.clearbit.com/${cleanDomain}`;
        setLogoUrl(generatedUrl);
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-card border border-border rounded-xl shadow-xl w-full max-w-md animate-in fade-in zoom-in-95 duration-200">
                <div className="flex items-center justify-between p-6 border-b border-border">
                    <h2 className="text-xl font-bold">
                        {editingDeposit ? 'Konto bearbeiten' : 'Neues Bankkonto'}
                    </h2>
                    <button
                        onClick={onClose}
                        className="p-1 hover:bg-muted rounded-md transition-colors"
                        title="Schließen"
                        aria-label="Schließen"
                    >
                        <X className="size-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Konto-Typ</label>
                        <div className="flex gap-4">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="radio"
                                    name="accountType"
                                    value="sparkonto"
                                    checked={accountType === 'sparkonto'}
                                    onChange={() => setAccountType('sparkonto')}
                                    className="w-4 h-4 text-primary focus:ring-primary"
                                />
                                <span>Sparkonto</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="radio"
                                    name="accountType"
                                    value="privatkonto"
                                    checked={accountType === 'privatkonto'}
                                    onChange={() => setAccountType('privatkonto')}
                                    className="w-4 h-4 text-primary focus:ring-primary"
                                />
                                <span>Privatkonto</span>
                            </label>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium">Bank / Institut</label>
                        <input
                            type="text"
                            required
                            className="w-full h-10 px-3 rounded-md border border-input bg-background/50 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                            value={bankName}
                            onChange={(e) => setBankName(e.target.value)}
                            placeholder="z.B. UBS, Credit Suisse..."
                            title="Bank Name"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium">Logo URL</label>
                        <div className="flex gap-2">
                            <input
                                type="url"
                                placeholder="https://example.com/logo.png"
                                value={logoUrl}
                                onChange={(e) => setLogoUrl(e.target.value)}
                                className="flex-1 h-9 px-3 rounded-md border border-input bg-background/50 text-xs focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                            />
                            {logoUrl && (
                                <img
                                    src={logoUrl}
                                    alt="Preview"
                                    className="size-9 rounded-md border border-border bg-white object-contain p-1"
                                    onError={(e) => (e.currentTarget.style.display = 'none')}
                                />
                            )}
                        </div>

                        {/* Logo Generator */}
                        <div className="pt-1 flex gap-2 items-end">
                            <div className="flex-1 space-y-1">
                                <label className="text-[10px] text-muted-foreground uppercase font-semibold">Oder generieren via Website</label>
                                <input
                                    type="text"
                                    placeholder="z.B. postfinance.ch"
                                    value={domain}
                                    onChange={(e) => setDomain(e.target.value)}
                                    className="w-full h-9 px-3 rounded-md border border-input bg-background/50 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                                />
                            </div>
                            <button
                                type="button"
                                onClick={generateLogo}
                                disabled={!domain}
                                className="px-3 h-9 bg-secondary text-secondary-foreground text-sm font-medium rounded-md hover:bg-secondary/80 disabled:opacity-50 border border-border"
                            >
                                Generieren
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Betrag</label>
                            <input
                                type="number"
                                required
                                min="0"
                                step="0.01"
                                className="w-full h-10 px-3 rounded-md border border-input bg-background/50 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                                value={amount}
                                onChange={(e) => setAmount(Number(e.target.value))}
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Währung</label>
                            <select
                                className="w-full h-10 px-3 rounded-md border border-input bg-background/50 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                                value={currency}
                                onChange={(e) => setCurrency(e.target.value as Currency)}
                            >
                                <option value="CHF">CHF</option>
                                <option value="USD">USD</option>
                                <option value="EUR">EUR</option>
                                <option value="GBp">GBp</option>
                            </select>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Zins (% p.a.)</label>
                            <input
                                type="number"
                                min="0"
                                step="0.01"
                                placeholder="Optional (0%)"
                                className="w-full h-10 px-3 rounded-md border border-input bg-background/50 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                                value={interestRate}
                                onChange={(e) => setInterestRate(e.target.value === '' ? '' : Number(e.target.value))}
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium">Notizen (Optional)</label>
                        <textarea
                            className="w-full p-3 rounded-md border border-input bg-background/50 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all min-h-[80px]"
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="z.B. Sonderkonditionen"
                        />
                    </div>

                    <div className="flex justify-end gap-3 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary rounded-md transition-colors"
                        >
                            Abbrechen
                        </button>
                        <button
                            type="submit"
                            className="px-6 py-2 text-sm font-bold text-primary-foreground bg-primary hover:bg-primary/90 rounded-md shadow-sm transition-all"
                        >
                            {editingDeposit ? 'Speichern' : 'Hinzufügen'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
