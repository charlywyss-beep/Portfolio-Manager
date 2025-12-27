
import * as YFPkg from 'yahoo-finance2';
import yahooFinanceDefault from 'yahoo-finance2';

console.log('--- Named Exports ---');
console.log(Object.keys(YFPkg));

console.log('--- Default Export Keys ---');
try {
    console.log(Object.keys(yahooFinanceDefault));
} catch (e) {
    console.log('Error inspecting default export:', e.message);
}

console.log('--- Default Export Type ---');
console.log(typeof yahooFinanceDefault);

if (typeof yahooFinanceDefault === 'function') {
    console.log('Default export is a function/class');
    try {
        const instance = new yahooFinanceDefault();
        console.log('Instantiated default export successfully');
    } catch (e) {
        console.log('Failed to instantiate default:', e.message);
    }
}
