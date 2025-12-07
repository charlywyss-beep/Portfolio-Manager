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

// Export transaction to Excel
// Export transaction to Excel
export function exportToExcel(transaction: TransactionData) {
    const data: (string | null)[][] = [
        ['Portfolio Manager - Transaktionsbeleg', null, null],
        [null, null, null],
        ['Datum', null, transaction.date.toLocaleString('de-DE')],
        ['Typ', null, transaction.type === 'buy' ? 'KAUF' : 'VERKAUF'],
        [null, null, null],
        ['Aktie', null, transaction.stockName],
        ['Symbol', null, transaction.stockSymbol],
    ];

    if (transaction.valor) data.push(['Valor', null, transaction.valor]);
    if (transaction.isin) data.push(['ISIN', null, transaction.isin]);

    data.push(
        [null, null, null],
        ['Anzahl', null, `${transaction.shares} Stk`],
        ['Preis pro Stück', null, `${transaction.pricePerShare.toFixed(2)} ${transaction.currency}`],
        [null, null, null],
        ['Transaktionswert', null, `${transaction.totalValue.toFixed(2)} ${transaction.currency}`]
    );

    if (transaction.chfEquivalent) {
        data.push(['Wert in CHF', null, `${transaction.chfEquivalent.toFixed(2)} CHF`]);
    }

    if (transaction.type === 'sell' && transaction.avgBuyPrice && transaction.profitLoss !== undefined) {
        data.push(
            [null, null, null],
            ['Ø Kaufpreis', null, `${transaction.avgBuyPrice.toFixed(2)} ${transaction.currency}`],
            ['Gewinn/Verlust', null, `${transaction.profitLoss.toFixed(2)} ${transaction.currency}`]
        );
    }

    // "Neue Position" section removed

    const ws = XLSX.utils.aoa_to_sheet(data);

    // Set column widths
    ws['!cols'] = [
        { wch: 20 }, // Column A (Labels)
        { wch: 5 },  // Column B (Spacer)
        { wch: 30 }, // Column C (Values)
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Transaktion');

    const filename = `${transaction.type}_${transaction.stockSymbol}_${transaction.date.toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(wb, filename);
}

// Export transaction to PDF
export function exportToPDF(transaction: TransactionData) {
    const doc = new jsPDF();

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
        ['Preis pro Stück', `${transaction.pricePerShare.toFixed(2)} ${transaction.currency}`],
        ['Transaktionswert', `${transaction.totalValue.toFixed(2)} ${transaction.currency}`]
    );

    if (transaction.chfEquivalent) {
        detailsData.push(['Wert in CHF', `${transaction.chfEquivalent.toFixed(2)} CHF`]);
    }

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
            ['Ø Kaufpreis', `${transaction.avgBuyPrice.toFixed(2)} ${transaction.currency}`],
            ['Gewinn/Verlust', `${transaction.profitLoss.toFixed(2)} ${transaction.currency}`],
        ];

        autoTable(doc, {
            startY: (doc as any).lastAutoTable.finalY + 10,
            head: [['Gewinn/Verlust Analyse', '']],
            body: profitLossData,
            theme: 'grid',
            headStyles: { fillColor: [100, 100, 100] },
        });
    }

    const filename = `${transaction.type}_${transaction.stockSymbol}_${transaction.date.toISOString().split('T')[0]}.pdf`;
    doc.save(filename);
}
