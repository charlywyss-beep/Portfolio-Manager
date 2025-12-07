// Transaction Success Dialog with Export Options
import { FileSpreadsheet, FileText, CheckCircle, X } from 'lucide-react';
import { exportToExcel, exportToPDF } from '../utils/exportTransaction';
import type { Stock } from '../types';

interface TransactionSuccessDialogProps {
    isOpen: boolean;
    onClose: () => void;
    transaction: {
        type: 'buy' | 'sell';
        stock: Stock;
        shares: number;
        pricePerShare: number;
        totalValue: number;
        avgBuyPrice?: number;
        profitLoss?: number;
        newAvgPrice?: number;
        chfEquivalent?: number;
    };
}

export function TransactionSuccessDialog({ isOpen, onClose, transaction }: TransactionSuccessDialogProps) {
    if (!isOpen) return null;

    const handleExcelExport = () => {
        exportToExcel({
            type: transaction.type,
            stockName: transaction.stock.name,
            stockSymbol: transaction.stock.symbol,
            valor: transaction.stock.valor,
            isin: transaction.stock.isin,
            shares: transaction.shares,
            pricePerShare: transaction.pricePerShare,
            totalValue: transaction.totalValue,
            currency: transaction.stock.currency,
            chfEquivalent: transaction.chfEquivalent,
            date: new Date(),
            avgBuyPrice: transaction.avgBuyPrice,
            profitLoss: transaction.profitLoss,
            newAvgPrice: transaction.newAvgPrice,
        });
    };

    const handlePDFExport = () => {
        exportToPDF({
            type: transaction.type,
            stockName: transaction.stock.name,
            stockSymbol: transaction.stock.symbol,
            valor: transaction.stock.valor,
            isin: transaction.stock.isin,
            shares: transaction.shares,
            pricePerShare: transaction.pricePerShare,
            totalValue: transaction.totalValue,
            currency: transaction.stock.currency,
            chfEquivalent: transaction.chfEquivalent,
            date: new Date(),
            avgBuyPrice: transaction.avgBuyPrice,
            profitLoss: transaction.profitLoss,
            newAvgPrice: transaction.newAvgPrice,
        });
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-md animate-in zoom-in-95 duration-200">
                <div className="p-6">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-lg ${transaction.type === 'buy' ? 'bg-green-100 dark:bg-green-950' : 'bg-red-100 dark:bg-red-950'}`}>
                                <CheckCircle className={`size-6 ${transaction.type === 'buy' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`} />
                            </div>
                            <div>
                                <h3 className="font-bold text-lg">Transaktion erfolgreich!</h3>
                                <p className="text-sm text-muted-foreground">
                                    {transaction.type === 'buy' ? 'Kauf abgeschlossen' : 'Verkauf abgeschlossen'}
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-muted rounded-lg transition-colors"
                        >
                            <X className="size-5" />
                        </button>
                    </div>

                    <div className="mb-6 p-4 bg-muted rounded-lg">
                        <div className="text-sm space-y-1">
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Aktie:</span>
                                <span className="font-medium">{transaction.stock.name}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Anzahl:</span>
                                <span className="font-medium">{transaction.shares} Stk</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Wert:</span>
                                <span className="font-medium">
                                    {transaction.totalValue.toFixed(2)} {transaction.stock.currency}
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-3">
                        <p className="text-sm text-muted-foreground mb-3">
                            Möchten Sie einen Beleg exportieren?
                        </p>

                        <button
                            onClick={handleExcelExport}
                            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
                        >
                            <FileSpreadsheet className="size-5" />
                            <span>Als Excel exportieren</span>
                        </button>

                        <button
                            onClick={handlePDFExport}
                            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
                        >
                            <FileText className="size-5" />
                            <span>Als PDF exportieren</span>
                        </button>

                        <button
                            onClick={onClose}
                            className="w-full px-4 py-3 border border-border hover:bg-muted rounded-lg transition-colors"
                        >
                            Schließen
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
