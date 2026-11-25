/** A random unique id. crypto.randomUUID exists only in secure contexts (HTTPS
 *  or localhost), so off one — the dev server reached over http from a phone —
 *  it falls back to 128 bits from getRandomValues. */
export function newId(): string {
    if (typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}
