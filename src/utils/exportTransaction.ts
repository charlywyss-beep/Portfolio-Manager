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

    // We use cell objects for numbers to ensure proper formatting and right alignment in Excel
    const numCell = (val: number, curr: string) => ({
        t: 'n',
        v: val,
        z: `#,##0.00 "${curr}"`
    });

    const chfCell = (val: number) => {
        if (!conversionRate) return null;
        return {
            t: 'n',
            v: val * conversionRate,
            z: '#,##0.00 "CHF"'
        };
    };

    // Layout matches user request:
    // Row 1: Empty
    // Row 2: Header (B2)
    // Cols: A(Spacer), B(Label), C(Spacer), D(Value), E(Spacer), F(CHF)

    const data: any[][] = [
        [null, null, null, null, null, null], // Row 1: Empty
        [null, 'Portfolio Manager - Transaktionsbeleg', null, null, null, null], // Row 2: Title (Plain)
        [null, null, null, null, null, null], // Row 3: Empty
        [null, 'Datum', null, transaction.date.toLocaleString('de-DE'), null, null], // Row 4
        [null, 'Typ', null, transaction.type === 'buy' ? 'KAUF' : 'VERKAUF', null, null], // Row 5
        [null, null, null, null, null, null], // Row 6: Spacer
        [null, 'Aktie', null, transaction.stockName, null, null], // Row 7
        [null, 'Symbol', null, transaction.stockSymbol, null, null], // Row 8
    ];

    if (transaction.valor) data.push([null, 'Valor', null, transaction.valor, null, null]);
    if (transaction.isin) data.push([null, 'ISIN', null, transaction.isin, null, null]);

    // Spacer
    data.push([null, null, null, null, null, null]);

    // Anzahl
    // "5 Stk" - Formatting as number with "Stk" unit
    data.push([
        null,
        'Anzahl',
        null,
        { t: 'n', v: transaction.shares, z: '0 "Stk"' },
        null,
        null
    ]);

    // Preis pro Stück
    data.push([
        null,
        'Preis pro Stück',
        null,
        numCell(transaction.pricePerShare, transaction.currency),
        null,
        chfCell(transaction.pricePerShare)
    ]);

    // Spacer
    data.push([null, null, null, null, null, null]);

    // Transaktionswert
    data.push([
        null,
        'Transaktionswert',
        null,
        numCell(transaction.totalValue, transaction.currency),
        null,
        chfCell(transaction.totalValue)
    ]);

    // Spacer
    data.push([null, null, null, null, null, null]);

    if (transaction.type === 'sell' && transaction.avgBuyPrice && transaction.profitLoss !== undefined) {
        data.push([
            null,
            'Ø Kaufpreis',
            null,
            numCell(transaction.avgBuyPrice, transaction.currency),
            null,
            chfCell(transaction.avgBuyPrice)
        ]);

        data.push([
            null,
            'Gewinn/Verlust',
            null,
            numCell(transaction.profitLoss, transaction.currency),
            null,
            chfCell(transaction.profitLoss)
        ]);
    }

    const ws = XLSX.utils.aoa_to_sheet(data);

    // Set column widths
    // A=2, B=25, C=2, D=15 (Right aligned numbers), E=2, F=15 (Right aligned CHF)
    ws['!cols'] = [
        { wch: 2 },  // A
        { wch: 25 }, // B
        { wch: 2 },  // C
        { wch: 15 }, // D
        { wch: 2 },  // E
        { wch: 15 }, // F
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
