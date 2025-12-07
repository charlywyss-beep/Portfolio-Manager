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
export function exportToExcel(transaction: TransactionData) {
    const data = [
        ['Portfolio Manager - Transaktionsbeleg'],
        [''],
        ['Datum', transaction.date.toLocaleString('de-DE')],
        ['Typ', transaction.type === 'buy' ? 'KAUF' : 'VERKAUF'],
        [''],
        ['Aktie', transaction.stockName],
        ['Symbol', transaction.stockSymbol],
        ['Anzahl', `${transaction.shares} Stk`],
        ['Preis pro Stück', `${transaction.pricePerShare.toFixed(2)} ${transaction.currency}`],
        [''],
        ['Transaktionswert', `${transaction.totalValue.toFixed(2)} ${transaction.currency}`],
    ];

    if (transaction.chfEquivalent) {
        data.push(['Wert in CHF', `${transaction.chfEquivalent.toFixed(2)} CHF`]);
    }

    if (transaction.type === 'sell' && transaction.avgBuyPrice && transaction.profitLoss !== undefined) {
        data.push(
            [''],
            ['Ø Kaufpreis', `${transaction.avgBuyPrice.toFixed(2)} ${transaction.currency}`],
            ['Gewinn/Verlust', `${transaction.profitLoss.toFixed(2)} ${transaction.currency}`]
        );
    }

    if (transaction.type === 'buy' && transaction.newAvgPrice) {
        data.push(
            [''],
            ['Neuer Ø Kaufpreis', `${transaction.newAvgPrice.toFixed(2)} ${transaction.currency}`]
        );
    }

    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Transaktion');

    // Auto-size columns
    const colWidths = data.map(row => Math.max(...row.map(cell => String(cell).length)));
    ws['!cols'] = colWidths.map(w => ({ wch: w + 2 }));

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
        ['Anzahl', `${transaction.shares} Stk`],
        ['Preis pro Stück', `${transaction.pricePerShare.toFixed(2)} ${transaction.currency}`],
        ['Transaktionswert', `${transaction.totalValue.toFixed(2)} ${transaction.currency}`],
    ];

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

    // Additional info for buy
    if (transaction.type === 'buy' && transaction.newAvgPrice) {
        const buyData = [
            ['Neuer Ø Kaufpreis', `${transaction.newAvgPrice.toFixed(2)} ${transaction.currency}`],
        ];

        autoTable(doc, {
            startY: (doc as any).lastAutoTable.finalY + 10,
            head: [['Neue Position', '']],
            body: buyData,
            theme: 'grid',
            headStyles: { fillColor: [100, 100, 100] },
        });
    }

    const filename = `${transaction.type}_${transaction.stockSymbol}_${transaction.date.toISOString().split('T')[0]}.pdf`;
    doc.save(filename);
}
