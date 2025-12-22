
/**
 * Smartly wraps text based on length.
 * If the text is shorter than the threshold, it replaces spaces with non-breaking spaces
 * to prevent wrapping. If it's longer, it allows normal wrapping.
 * 
 * @param text The text to process
 * @param threshold The character count threshold (default: 15)
 * @returns The processed text
 */
export const smartWrap = (text: string, threshold: number = 15): string => {
    if (!text) return '';
    return text.length < threshold ? text.replace(/\s+/g, '\u00A0') : text;
};
