/**
 * The two type looks the app is drawn in, and nothing else — no storage, no DOM.
 *
 * A look is a set of families and weights, not one font: Classic pairs a display
 * serif with a reading serif where Modern uses one family for both roles. Which
 * tokens each look sets is index.css's business; this only names them.
 */

/** A type look the app has a complete set of faces for. */
export type FontPref = 'modern' | 'classic';

/** Every look, in the order a picker should offer them. */
export const FONTS: readonly FontPref[] = ['modern', 'classic'];

/** What someone who has never chosen sees. */
export const DEFAULT_FONT: FontPref = 'modern';

/**
 * Narrows an unknown value to a supported look.
 *
 * @param value any value, including one read back out of storage or off a session
 * @returns true iff value is one of FONTS
 */
export function isFontPref(value: unknown): value is FontPref {
    return typeof value === 'string' && (FONTS as readonly string[]).includes(value);
}
