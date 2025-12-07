// Transaction export utilities for Excel and PDF
import XLSX from 'xlsx-js-style';
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

    // Header Style (Best effort for SheetJS Community)
    const headerStyle = {
        font: { bold: true },
        alignment: { horizontal: 'center', vertical: 'center' },
        fill: { fgColor: { rgb: "DDEBF7" } }
    };

    const headerCell = {
        v: 'Portfolio Manager - Transaktionsbeleg',
        s: headerStyle
    };

    // Layout matches user request:
    // Row 1: Empty
    // Row 2: Header (B2) merged B2:F2

    const data: any[][] = [
        [null, null, null, null, null, null], // Row 1: Empty
        [null, headerCell, null, null, null, null], // Row 2: Header (B2)
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

    // Merge B2:F2 (0-indexed: r1 c1 to r1 c5)
    ws['!merges'] = [
        { s: { r: 1, c: 1 }, e: { r: 1, c: 5 } }
    ];

    // Set column widths
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

    // Helpers
    const fmt = (val: number, curr: string) => `${val.toFixed(2)} ${curr}`;
    const fmtCHF = (val: number) => conversionRate ? `${(val * conversionRate).toFixed(2)} CHF` : '';

    // Title
    doc.setFontSize(18);
    doc.text('Portfolio Manager', 105, 20, { align: 'center' });

    doc.setFontSize(14);
    const typeText = transaction.type === 'buy' ? 'KAUFBELEG' : 'VERKAUFSBELEG';
    doc.text(typeText, 105, 30, { align: 'center' });

    // Date
    doc.setFontSize(10);
    doc.text(`Datum: ${transaction.date.toLocaleString('de-DE')}`, 20, 45);

    // Strict Styles to ensure alignment
    // We use a fixed table width of 170mm centered-ish or with standard margins.
    // Cols: 0: 70mm, 1: 50mm, 2: 50mm = 170mm
    const columnStyles = {
        0: { cellWidth: 70 },
        1: { cellWidth: 50 },
        2: { cellWidth: 50 },
    };
    const tableWidth = 170;

    // Transaction details table
    const detailsData: string[][] = [
        ['Aktie', transaction.stockName, ''],
        ['Symbol', transaction.stockSymbol, ''],
    ];

    if (transaction.valor) detailsData.push(['Valor', transaction.valor, '']);
    if (transaction.isin) detailsData.push(['ISIN', transaction.isin, '']);

    detailsData.push(
        ['Anzahl', `${transaction.shares} Stk`, ''],
        ['Preis pro Stück', fmt(transaction.pricePerShare, transaction.currency), fmtCHF(transaction.pricePerShare)],
        ['Transaktionswert', fmt(transaction.totalValue, transaction.currency), fmtCHF(transaction.totalValue)]
    );

    autoTable(doc, {
        startY: 55,
        head: [['Beschreibung', 'Wert', 'in CHF']],
        body: detailsData,
        theme: 'grid',
        tableWidth: tableWidth,
        columnStyles: columnStyles,
        headStyles: { fillColor: transaction.type === 'buy' ? [34, 139, 34] : [220, 38, 38] },
    });

    // Additional info for sell
    if (transaction.type === 'sell' && transaction.avgBuyPrice && transaction.profitLoss !== undefined) {
        const profitLossData = [
            ['Ø Kaufpreis', fmt(transaction.avgBuyPrice, transaction.currency), fmtCHF(transaction.avgBuyPrice)],
            ['Gewinn/Verlust', fmt(transaction.profitLoss, transaction.currency), fmtCHF(transaction.profitLoss)],
        ];

        autoTable(doc, {
            startY: (doc as any).lastAutoTable.finalY + 10,
            head: [['Gewinn/Verlust Analyse', 'Wert', 'in CHF']],
            body: profitLossData,
            theme: 'grid',
            tableWidth: tableWidth,
            columnStyles: columnStyles,
            headStyles: { fillColor: [100, 100, 100] },
        });
    }

    doc.save(getSafeFilename(transaction, 'pdf'));
}
