/** A random unique id. Uses crypto.randomUUID in secure contexts (HTTPS or
 *  localhost); elsewhere — e.g. the dev server reached over http from a phone —
 *  randomUUID is unavailable, so it falls back to getRandomValues (128 random
 *  bits, still collision-safe). */
export function newId(): string {
    if (typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}
