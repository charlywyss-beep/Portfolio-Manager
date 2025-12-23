import { useState, useEffect } from 'react';
import type { ChangeEvent, FocusEvent } from 'react';
import { cn } from '../utils';

interface DecimalInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
    value: string | number;
    onChange: (value: string) => void;
    maxDecimals?: number;
}

export const DecimalInput = ({
    value,
    onChange,
    maxDecimals = 2,
    className,
    ...props
}: DecimalInputProps) => {
    // Internal string state to manage user input (allowing "10." or "10,5")
    const [localValue, setLocalValue] = useState(value === null || value === undefined ? '' : value.toString());

    // Sync local state with prop value when it changes externally
    useEffect(() => {
        const propValStr = value === null || value === undefined ? '' : value.toString();

        // Helper to parse safely
        const pProp = parseFloat(propValStr);
        const pLocal = parseFloat(localValue.replace(',', '.'));

        // If prop is exactly the same string representation, return (e.g. "10.0" vs "10.0")
        if (propValStr === localValue) return;

        // If numeric values match, don't interfere (preserves "10." vs "10")
        if (!isNaN(pProp) && !isNaN(pLocal) && Math.abs(pProp - pLocal) < 1e-9) {
            return;
        }

        // Handle explicit empty vs 0 difference
        // If prop is empty string, and local is not, clear it
        if (propValStr === '' && localValue !== '') {
            setLocalValue('');
            return;
        }

        // If numeric mismatch or other cases, sync to prop
        if (!isNaN(pProp) || propValStr === '') {
            setLocalValue(propValStr);
        }
    }, [value]);

    const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
        let input = e.target.value;

        // Allow ONLY digits, dot, comma, and minus
        if (!/^[0-9.,-]*$/.test(input)) return;

        // Verify only one split char
        const dots = (input.match(/[.,]/g) || []).length;
        if (dots > 1) return;

        // Check max decimals
        if (maxDecimals !== undefined) {
            const parts = input.replace(',', '.').split('.');
            if (parts[1] && parts[1].length > maxDecimals) return;
        }

        setLocalValue(input);

        // Normalize to dot
        const normalized = input.replace(',', '.');

        // Pass raw string to parent (parent handles parsing)
        onChange(normalized);
    };

    const handleBlur = (e: FocusEvent<HTMLInputElement>) => {
        if (props.onBlur) props.onBlur(e);
    };

    return (
        <input
            {...props}
            type="text"
            inputMode="decimal"
            value={localValue}
            onChange={handleChange}
            onBlur={handleBlur}
            className={cn(className)}
        />
    );
};
