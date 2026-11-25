import { describe, it, expect } from 'vitest';
import { isOffline } from './online';
import { reportOffline } from '@/test/offline';

/*
 * Testing strategy
 *     partition on navigator.onLine: true | false
 */

describe('isOffline', () => {
    it('is false when the browser reports a connection', () => {
        expect(isOffline()).toBe(false);
    });

    it('is true when the browser reports none', () => {
        reportOffline();
        expect(isOffline()).toBe(true);
    });
});
