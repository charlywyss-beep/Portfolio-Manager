import { useState, useEffect } from 'react';
import type { ChangeEvent, FocusEvent } from 'react';
import { cn } from '../utils';

interface DecimalInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
    value: number;
    onChange: (value: number) => void;
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
    const [localValue, setLocalValue] = useState(value.toString());

    // Sync local state with prop value when it changes externally
    // We strictly compare to avoid resetting valid user inputs like "1.00" -> 1
    useEffect(() => {
        // If the parsed local value is different from the prop, update local.
        // This handles external updates (e.g. valid data loaded).
        // But we must be careful not to kill "1." type inputs if this runs during typing.
        // Usually, we only want to sync if the *numeric* value changed significantly.
        const parsedLocal = parseFloat(localValue.replace(',', '.'));
        if (parsedLocal !== value && !isNaN(value)) {
            setLocalValue(value.toString());
        } else if (value === 0 && localValue === '') {
            // Optional: allow empty for 0? No, let's stick to string
        }
    }, [value]);

    const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
        let input = e.target.value;

        // Allow ONLY digits, dot, comma, and minus
        if (!/^[0-9.,-]*$/.test(input)) return;

        // Verify only one split char
        const dots = (input.match(/[.,]/g) || []).length;
        if (dots > 1) return;

        setLocalValue(input);

        // Normalize to dot
        const normalized = input.replace(',', '.');

        // Handle "minus only" or empty
        if (input === '' || input === '-') {
            onChange(0); // Or handle as special case? For now 0
            return;
        }

        // Parse
        const num = parseFloat(normalized);
        if (!isNaN(num)) {
            onChange(num);
        }
    };

    const handleBlur = (e: FocusEvent<HTMLInputElement>) => {
        // On blur, we can format it nicely if we want, OR just leave it.
        // Let's ensure it matches the numeric value cleanly, but don't force formatting style 
        // to avoid annoying the user. Just strictly ensure it represents the number.
        // Actually, if we just leave it, it's fine.
        // If the user typed "10,500" (semantic nonsense if they meant 10.5), we already parsed it.
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
