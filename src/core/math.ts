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