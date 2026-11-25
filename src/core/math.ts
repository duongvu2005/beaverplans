/**
 * Clamps x to the interval [lo, hi]
 *
 * @param x the number to clamp
 * @param lo the lower bound of the range
 * @param hi the upper bound of the range, requires lo <= hi
 * @returns the point in [lo, hi] closest to x, or NaN if x is NaN
 */
export function clamp(x: number, lo: number, hi: number): number {
    return Math.min(Math.max(x, lo), hi);
}

/**
 * Expresses part as a percentage of whole.
 *
 * @param part the quantity being expressed as a percentage
 * @param whole the reference quantity part is measured against
 * @returns 100 * (part / whole) if whole is nonzero; 0 if whole is 0
 */
export function percentOf(part: number, whole: number): number {
    if (whole === 0) {
        return 0;
    }
    return (100 * part) / whole;
}
