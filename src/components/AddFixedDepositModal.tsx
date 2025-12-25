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
    const [logoUrl, setLogoUrl] = useState('');
    const [currentYearContribution, setCurrentYearContribution] = useState<number | ''>('');
    const [domain, setDomain] = useState('');
    const [isAutoContribution, setIsAutoContribution] = useState(false); // NEW
    const [monthlyContribution, setMonthlyContribution] = useState<number | ''>(''); // NEW
    const [monthlyFee, setMonthlyFee] = useState<number | ''>(''); // NEW
    const [feeFrequency, setFeeFrequency] = useState<'monthly' | 'quarterly' | 'annually'>('monthly'); // NEW
    const [iban, setIban] = useState(''); // NEW

    useEffect(() => {
        if (editingDeposit) {
            setBankName(editingDeposit.bankName);
            setAmount(editingDeposit.amount);
            setInterestRate(editingDeposit.interestRate);
            setCurrency(editingDeposit.currency);
            setNotes(editingDeposit.notes || '');
            setAccountType(editingDeposit.accountType || 'sparkonto');
            setLogoUrl(editingDeposit.logoUrl || '');
            setCurrentYearContribution(editingDeposit.currentYearContribution || '');
            setIsAutoContribution(!!editingDeposit.autoContribution);
            setMonthlyContribution(editingDeposit.monthlyContribution || '');
            setMonthlyFee(editingDeposit.monthlyFee || '');
            setFeeFrequency(editingDeposit.feeFrequency || 'monthly');
            setIban(editingDeposit.iban || '');
        } else {
            // Reset form for new entry
            setBankName('');
            setAmount('');
            setInterestRate('');
            setCurrency('CHF');
            setNotes('');
            setAccountType('sparkonto');
            setLogoUrl('');
            setCurrentYearContribution('');
            setDomain('');
            setIsAutoContribution(false);
            setMonthlyContribution('');
            setMonthlyFee('');
            setFeeFrequency('monthly');
            setIban('');
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
            iban,
            accountType,
            logoUrl,
            currentYearContribution: accountType === 'vorsorge' && !isAutoContribution ? (currentYearContribution === '' ? 0 : Number(currentYearContribution)) : undefined,
            autoContribution: accountType === 'vorsorge' ? isAutoContribution : undefined,
            monthlyContribution: accountType === 'vorsorge' && isAutoContribution ? (monthlyContribution === '' ? 0 : Number(monthlyContribution)) : undefined,
            monthlyFee: monthlyFee === '' ? undefined : Number(monthlyFee),
            feeFrequency,
            startDate: new Date().toISOString(),
            maturityDate: new Date().toISOString()
        };

        if (editingDeposit) {
            updateFixedDeposit(editingDeposit.id, depositData);
        } else {
            addFixedDeposit(depositData);
        }
        onClose();
    };



    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-card border border-border rounded-xl shadow-xl w-full max-w-md animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between p-5 border-b border-border sticky top-0 bg-card z-10">
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

                <form onSubmit={handleSubmit} className="p-5 space-y-4">
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
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="radio"
                                    name="accountType"
                                    value="vorsorge"
                                    checked={accountType === 'vorsorge'}
                                    onChange={() => setAccountType('vorsorge')}
                                    className="w-4 h-4 text-primary focus:ring-primary"
                                />
                                <span>Vorsorge 3a</span>
                            </label>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium">Bank / Institut</label>
                        <textarea
                            required
                            rows={2}
                            className="w-full px-3 py-2 rounded-md border border-input bg-background/50 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all resize-none font-sans"
                            value={bankName}
                            onChange={(e) => setBankName(e.target.value)}
                            placeholder="z.B. UBS, Credit Suisse..."
                            title="Bank Name"
                            aria-label="Bank Name"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium">IBAN / Konto-Nr.</label>
                        <input
                            type="text"
                            className="w-full h-10 px-3 rounded-md border border-input bg-background/50 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all font-mono text-sm"
                            value={iban}
                            onChange={(e) => setIban(e.target.value)}
                            placeholder="z.B. CH..."
                            title="IBAN oder Kontonummer"
                            aria-label="IBAN"
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
                                aria-label="Logo URL"
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
                        <div className="pt-1 flex flex-col gap-2">
                            <div className="flex gap-2 items-end">
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
                            </div>
                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    onClick={() => {
                                        if (!domain) return;
                                        let clean = domain.toLowerCase().replace('https://', '').replace('http://', '').replace('www.', '');
                                        if (clean.includes('/')) clean = clean.split('/')[0];
                                        setLogoUrl(`https://logo.clearbit.com/${clean}`);
                                    }}
                                    disabled={!domain}
                                    className="flex-1 h-8 bg-secondary text-secondary-foreground text-xs font-medium rounded-md hover:bg-secondary/80 disabled:opacity-50 border border-border"
                                >
                                    Clearbit Logo
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        if (!domain) return;
                                        let clean = domain.toLowerCase().replace('https://', '').replace('http://', '').replace('www.', '');
                                        if (clean.includes('/')) clean = clean.split('/')[0];
                                        setLogoUrl(`https://www.google.com/s2/favicons?domain=${clean}&sz=128`);
                                    }}
                                    disabled={!domain}
                                    className="flex-1 h-8 bg-secondary text-secondary-foreground text-xs font-medium rounded-md hover:bg-secondary/80 disabled:opacity-50 border border-border"
                                >
                                    Google Icon
                                </button>
                            </div>
                        </div>
                    </div>

                    {accountType === 'vorsorge' && (
                        <div className="space-y-3">
                            <h3 className="text-sm font-semibold flex items-center gap-2">
                                <span>Beitrags-Modus</span>
                            </h3>

                            <div className="flex gap-4">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="radio"
                                        name="contribMode"
                                        checked={!isAutoContribution}
                                        onChange={() => setIsAutoContribution(false)}
                                        className="w-4 h-4 text-primary focus:ring-primary"
                                    />
                                    <span className="text-sm">Manuell</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="radio"
                                        name="contribMode"
                                        checked={isAutoContribution}
                                        onChange={() => setIsAutoContribution(true)}
                                        className="w-4 h-4 text-primary focus:ring-primary"
                                    />
                                    <span className="text-sm">Monatlich (Automatisch)</span>
                                </label>
                            </div>

                            {isAutoContribution ? (
                                <div className="space-y-2 animate-in slide-in-from-top-2 duration-200">
                                    <label className="text-sm font-medium">Monatlicher Beitrag</label>
                                    <div className="relative">
                                        <input
                                            type="number"
                                            min="0"
                                            step="1"
                                            placeholder="z.B. 588"
                                            className="w-full h-10 px-3 rounded-md border border-input bg-background focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                                            value={monthlyContribution}
                                            onChange={(e) => setMonthlyContribution(e.target.value === '' ? '' : Number(e.target.value))}
                                            onFocus={(e) => e.target.select()}
                                            aria-label="Monatlicher Beitrag"
                                        />
                                        <div className="absolute right-10 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">
                                            × {new Date().getMonth() + 1} Monate
                                        </div>
                                    </div>
                                    <p className="text-[10px] text-muted-foreground">
                                        Total {new Date().getFullYear()}: <strong>{(Number(monthlyContribution) * (new Date().getMonth() + 1)).toLocaleString('de-CH', { minimumFractionDigits: 2 })}</strong> (wird automatisch jeden Monat angepasst)
                                    </p>
                                </div>
                            ) : (
                                <div className="space-y-2 animate-in slide-in-from-top-2 duration-200">
                                    <label className="text-sm font-medium">Bereits eingezahlt ({new Date().getFullYear()})</label>
                                    <input
                                        type="number"
                                        min="0"
                                        step="1"
                                        placeholder="0"
                                        className="w-full h-10 px-3 rounded-md border border-input bg-background focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                                        value={currentYearContribution}
                                        onChange={(e) => setCurrentYearContribution(e.target.value === '' ? '' : Number(e.target.value))}
                                        onFocus={(e) => e.target.select()}
                                        aria-label="Bereits eingezahlt"
                                    />
                                </div>
                            )}
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Betrag</label>
                            <input
                                type="number"
                                required
                                min="0"
                                step="1"
                                className="w-full h-10 px-3 rounded-md border border-input bg-background/50 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                                value={amount}
                                onChange={(e) => setAmount(Number(e.target.value))}
                                onFocus={(e) => e.target.select()}
                                aria-label="Betrag"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Währung</label>
                            <select
                                className="w-full h-10 px-3 rounded-md border border-input bg-background/50 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                                value={currency}
                                onChange={(e) => setCurrency(e.target.value as Currency)}
                                aria-label="Währung"
                            >
                                <option value="CHF">CHF</option>
                                <option value="USD">USD</option>
                                <option value="EUR">EUR</option>
                                <option value="GBp">GBp</option>
                            </select>
                        </div>
                    </div>

                    <div className="grid grid-cols-12 gap-4">
                        <div className="col-span-4 space-y-2">
                            <label className="text-sm font-medium">Zins (% p.a.)</label>
                            <input
                                type="number"
                                min="0"
                                step="0.01"
                                placeholder="Optional (0%)"
                                className="w-full h-10 px-3 rounded-md border border-input bg-background/50 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                                value={interestRate}
                                onChange={(e) => setInterestRate(e.target.value === '' ? '' : Number(e.target.value))}
                                onFocus={(e) => e.target.select()}
                                aria-label="Zins"
                            />
                        </div>
                        <div className="col-span-8 space-y-2">
                            <label className="text-sm font-medium">Gebühr</label>
                            <div className="flex gap-2">
                                <div className="relative flex-1">
                                    <input
                                        type="number"
                                        min="0"
                                        step="0.05"
                                        placeholder="Optional"
                                        className="w-full h-10 px-3 pr-10 rounded-md border border-input bg-background/50 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                                        value={monthlyFee}
                                        onChange={(e) => setMonthlyFee(e.target.value === '' ? '' : Number(e.target.value))}
                                        onFocus={(e) => e.target.select()}
                                        aria-label="Gebühr Betrag"
                                    />
                                    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">
                                        CHF
                                    </div>
                                </div>
                                <select
                                    className="w-32 h-10 px-3 rounded-md border border-input bg-background/50 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all cursor-pointer"
                                    value={feeFrequency}
                                    onChange={(e) => setFeeFrequency(e.target.value as any)}
                                    aria-label="Gebühr Intervall"
                                >
                                    <option value="monthly">Monatlich</option>
                                    <option value="quarterly">Quartalsweise</option>
                                    <option value="annually">Jährlich</option>
                                </select>
                            </div>
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
            </div >
        </div >
    );
}
