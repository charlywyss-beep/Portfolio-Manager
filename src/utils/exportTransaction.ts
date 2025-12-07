// Transaction export utilities for Excel and PDF
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

interface TransactionData {
    type: 'buy' | 'sell';
    stockName: string;
    stockSymbol: string;
    valor?: string;
    isin?: string;
    shares: number;
    pricePerShare: number;
    totalValue: number;
    currency: string;
    chfEquivalent?: number;
    date: Date;
    // For sell transactions
    avgBuyPrice?: number;
    profitLoss?: number;
    // For buy transactions
    newAvgPrice?: number;
}

// Helper to format currency with dual display if needed
// e.g. "175.50 USD (154.44 CHF)"
function formatDualCurrency(amount: number, currency: string, chfRate?: number): string {
    const mainStr = `${amount.toFixed(2)} ${currency}`;

    if (currency === 'CHF' || !chfRate) {
        return mainStr;
    }

    const chfAmount = amount * chfRate;
    return `${mainStr} (${chfAmount.toFixed(2)} CHF)`;
}

function getSafeFilename(transaction: TransactionData, extension: string): string {
    // Sanitize stock name for filename (replace spaces and special chars with underscores)
    const safeName = transaction.stockName.replace(/[^a-zA-Z0-9]/g, '_');
    const dateStr = transaction.date.toISOString().split('T')[0];
    return `${transaction.type}_${safeName}_${dateStr}.${extension}`;
}

// Export transaction to Excel
export function exportToExcel(transaction: TransactionData) {
    // Calculate implied exchange rate if CHF equivalent is present
    const conversionRate = (transaction.chfEquivalent && transaction.totalValue)
        ? transaction.chfEquivalent / transaction.totalValue
        : undefined;

    // Helper to format currency
    const fmt = (val: number, curr: string) => `${val.toFixed(2)} ${curr}`;
    // Helper to calc and format CHF
    const fmtCHF = (val: number) => conversionRate ? `${(val * conversionRate).toFixed(2)} CHF` : '';

    const data: (string | null)[][] = [
        [null, 'Portfolio Manager - Transaktionsbeleg', null, null, null],
        [null, null, null, null, null], // Spacer row
        [null, 'Datum', null, transaction.date.toLocaleString('de-DE'), null],
        [null, 'Typ', null, transaction.type === 'buy' ? 'KAUF' : 'VERKAUF', null],
        [null, null, null, null, null], // Spacer
        [null, 'Aktie', null, transaction.stockName, null],
        [null, 'Symbol', null, transaction.stockSymbol, null],
    ];

    if (transaction.valor) data.push([null, 'Valor', null, transaction.valor, null]);
    if (transaction.isin) data.push([null, 'ISIN', null, transaction.isin, null]);

    data.push(
        [null, null, null, null, null], // Spacer
        [null, 'Anzahl', null, `${transaction.shares} Stk`, null],
        [null, 'Preis pro Stück', null, fmt(transaction.pricePerShare, transaction.currency), fmtCHF(transaction.pricePerShare)],
        [null, null, null, null, null], // Spacer
        [null, 'Transaktionswert', null, fmt(transaction.totalValue, transaction.currency), fmtCHF(transaction.totalValue)]
    );

    // Removed separate CHF row as requested

    if (transaction.type === 'sell' && transaction.avgBuyPrice && transaction.profitLoss !== undefined) {
        data.push(
            [null, null, null, null, null], // Spacer
            [null, 'Ø Kaufpreis', null, fmt(transaction.avgBuyPrice, transaction.currency), fmtCHF(transaction.avgBuyPrice)],
            [null, 'Gewinn/Verlust', null, fmt(transaction.profitLoss, transaction.currency), fmtCHF(transaction.profitLoss)]
        );
    }

    // Removed "Neue Position" section

    const ws = XLSX.utils.aoa_to_sheet(data);

    // Set column widths to match the look
    ws['!cols'] = [
        { wch: 2 },  // A: Margin
        { wch: 20 }, // B: Labels
        { wch: 2 },  // C: Spacer
        { wch: 20 }, // D: Value Original
        { wch: 20 }, // E: Value CHF
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Transaktion');

    XLSX.writeFile(wb, getSafeFilename(transaction, 'xlsx'));
}

// Export transaction to PDF
export function exportToPDF(transaction: TransactionData) {
    const doc = new jsPDF();

    // Calculate implied exchange rate if CHF equivalent is present
    const conversionRate = (transaction.chfEquivalent && transaction.totalValue)
        ? transaction.chfEquivalent / transaction.totalValue
        : undefined;

    // Title
    doc.setFontSize(18);
    doc.text('Portfolio Manager', 105, 20, { align: 'center' });

    doc.setFontSize(14);
    const typeText = transaction.type === 'buy' ? 'KAUFBELEG' : 'VERKAUFSBELEG';
    doc.text(typeText, 105, 30, { align: 'center' });

    // Date
    doc.setFontSize(10);
    doc.text(`Datum: ${transaction.date.toLocaleString('de-DE')}`, 20, 45);

    // Transaction details table
    const detailsData = [
        ['Aktie', transaction.stockName],
        ['Symbol', transaction.stockSymbol],
    ];

    if (transaction.valor) {
        detailsData.push(['Valor', transaction.valor]);
    }
    if (transaction.isin) {
        detailsData.push(['ISIN', transaction.isin]);
    }

    detailsData.push(
        ['Anzahl', `${transaction.shares} Stk`],
        ['Preis pro Stück', formatDualCurrency(transaction.pricePerShare, transaction.currency, conversionRate)],
        ['Transaktionswert', formatDualCurrency(transaction.totalValue, transaction.currency, conversionRate)]
    );

    // Removed separate CHF row

    autoTable(doc, {
        startY: 55,
        head: [['Beschreibung', 'Wert']],
        body: detailsData,
        theme: 'grid',
        headStyles: { fillColor: transaction.type === 'buy' ? [34, 139, 34] : [220, 38, 38] },
    });

    // Additional info for sell
    if (transaction.type === 'sell' && transaction.avgBuyPrice && transaction.profitLoss !== undefined) {
        const profitLossData = [
            ['Ø Kaufpreis', formatDualCurrency(transaction.avgBuyPrice, transaction.currency, conversionRate)],
            ['Gewinn/Verlust', formatDualCurrency(transaction.profitLoss, transaction.currency, conversionRate)],
        ];

        autoTable(doc, {
            startY: (doc as any).lastAutoTable.finalY + 10,
            head: [['Gewinn/Verlust Analyse', '']],
            body: profitLossData,
            theme: 'grid',
            headStyles: { fillColor: [100, 100, 100] },
        });
    }

    doc.save(getSafeFilename(transaction, 'pdf'));
}
