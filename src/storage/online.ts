/**
 * Whether the browser is certain it has no connection.
 *
 * Only one direction of `navigator.onLine` is trustworthy: it says true for a
 * device attached to a network that carries nothing, but a false means the OS
 * has no route at all.
 *
 * @returns true only when the browser reports no connection. Reads live
 *          browser state, so it is not deterministic.
 */
export function isOffline(): boolean {
    return navigator.onLine === false;
}
