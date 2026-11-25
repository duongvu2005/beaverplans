import { afterEach, describe, expect, it, vi } from 'vitest';
import { prefCache } from './prefCache';

// Duplicated rather than derived from the factory, on purpose: these keys are a
// persistence contract. Renaming one strands every device that already wrote it
// — the choice it remembered is one the next boot cannot find — so the rename
// should have to change a test.
const CHOICE_KEY = 'beaverplans:demo';
const UNPUSHED_KEY = 'beaverplans:demo:unpushed';

type Demo = 'one' | 'two';

function isDemo(value: unknown): value is Demo {
    return value === 'one' || value === 'two';
}

const cache = prefCache<Demo>('demo', isDemo);

afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
});

describe('prefCache', () => {
    /*
     * Testing strategy
     *
     * partition on the stored choice:
     *   absent; one the guard accepts; one no version of this app ever wrote
     * partition on the stored mark:
     *   absent; well-formed; not JSON; JSON of the wrong shape; JSON whose
     *   userId is not a string; JSON whose value the guard rejects
     * partition on the write:
     *   a mark; clearing the mark
     * partition on localStorage:
     *   working; throwing on read; throwing on write
     */

    it('covers the keys it builds from the name', () => {
        cache.write('one');
        cache.mark({ userId: 'u1', value: 'two' });

        expect(localStorage.getItem(CHOICE_KEY)).toBe('one');
        expect(localStorage.getItem(UNPUSHED_KEY)).not.toBeNull();
    });

    it('covers no choice stored', () => {
        expect(cache.read()).toBeNull();
    });

    it('covers a choice the guard accepts', () => {
        localStorage.setItem(CHOICE_KEY, 'two');

        expect(cache.read()).toBe('two');
    });

    it('covers a choice no version of this app ever wrote', () => {
        localStorage.setItem(CHOICE_KEY, 'three');

        expect(cache.read()).toBeNull();
    });

    it('covers a round trip through the choice', () => {
        cache.write('two');

        expect(cache.read()).toBe('two');
    });

    it('covers no mark stored', () => {
        expect(cache.unpushed()).toBeNull();
    });

    it('covers a round trip through the mark', () => {
        cache.mark({ userId: 'u1', value: 'two' });

        expect(cache.unpushed()).toEqual({ userId: 'u1', value: 'two' });
    });

    it('covers clearing the mark', () => {
        cache.mark({ userId: 'u1', value: 'two' });
        cache.mark(null);

        expect(cache.unpushed()).toBeNull();
        expect(localStorage.getItem(UNPUSHED_KEY)).toBeNull();
    });

    it('covers a mark that is not JSON', () => {
        localStorage.setItem(UNPUSHED_KEY, 'not json');

        expect(cache.unpushed()).toBeNull();
    });

    it('covers a mark that is JSON but not an object', () => {
        localStorage.setItem(UNPUSHED_KEY, '42');

        expect(cache.unpushed()).toBeNull();
    });

    it('covers a mark whose userId is missing', () => {
        localStorage.setItem(UNPUSHED_KEY, JSON.stringify({ value: 'two' }));

        expect(cache.unpushed()).toBeNull();
    });

    it('covers a mark whose value the guard rejects', () => {
        localStorage.setItem(UNPUSHED_KEY, JSON.stringify({ userId: 'u1', value: 'three' }));

        expect(cache.unpushed()).toBeNull();
    });

    it('covers localStorage throwing on read', () => {
        vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
            throw new Error('denied');
        });

        expect(cache.read()).toBeNull();
        expect(cache.unpushed()).toBeNull();
    });

    it('covers localStorage throwing on write', () => {
        vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
            throw new Error('denied');
        });

        expect(() => cache.write('one')).not.toThrow();
        expect(() => cache.mark({ userId: 'u1', value: 'two' })).not.toThrow();
    });
});
