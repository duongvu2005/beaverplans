import { afterEach } from 'vitest';

/**
 * Makes `navigator.onLine` report no connection for the rest of the test.
 *
 * jsdom hardcodes onLine to true and offers no setter, hence defineProperty.
 *
 * @returns nothing. Restores itself after the test that called it.
 */
export function reportOffline(): void {
    Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => false });
}

afterEach(() => {
    Reflect.deleteProperty(navigator, 'onLine');
});
