
import yahooFinance from 'yahoo-finance2';

async function checkStock() {
    try {
        const symbol = 'VWRA.L';
        console.log(`Fetching data for ${symbol}...`);

        // Suppress validation errors if possible or handle them
        // yahooFinance.suppressNotices(['yahooSurvey']); 

        // Fetch with validation warnings potentially being part of the issue?
        // Let's try fetching without validation if the library supports it, or just standard fetch
        // Adding 'fundProfile' module
        const result = await yahooFinance.quoteSummary(symbol, {
            modules: ['price', 'summaryDetail', 'defaultKeyStatistics', 'summaryProfile', 'fundProfile']
        });

        console.log('--- Summary Profile ---');
        console.log('Country:', result.summaryProfile?.country);

        console.log('--- Fund Profile ---');
        console.log('Style items:', JSON.stringify(result.fundProfile, null, 2));

        console.log('--- Price ---');
        console.log('Currency:', result.price?.currency);
        console.log('Exchange:', result.price?.exchangeName);

    } catch (error: any) {
        console.error('Error fetching data:', error.message);
        if (error.errors) {
            console.error('Validation errors:', JSON.stringify(error.errors, null, 2));
        }
        if (error.result) {
            console.log('Partial result:', JSON.stringify(error.result, null, 2));
        }
    }
}

checkStock();
