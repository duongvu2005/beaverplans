import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { withDeadline } from './withDeadline';

beforeEach(() => {
    vi.useFakeTimers();
});
afterEach(() => {
    vi.useRealTimers();
});

/**
 * Collects unhandled rejections raised while `run` is awaited. Runs on real
 * timers: node reports an unhandled rejection a macrotask after it is raised,
 * and a faked setImmediate never gets there.
 */
async function unhandledDuring(run: () => Promise<unknown>): Promise<unknown[]> {
    const seen: unknown[] = [];
    const onUnhandled = (reason: unknown) => seen.push(reason);
    vi.useRealTimers();
    process.on('unhandledRejection', onUnhandled);
    try {
        await run();
        await new Promise((resolve) => setImmediate(resolve));
    } finally {
        process.off('unhandledRejection', onUnhandled);
        vi.useFakeTimers();
    }
    return seen;
}

describe('withDeadline', () => {
    /*
     * Testing strategy
     *   partition on which settles first: promise resolves before the deadline |
     *     promise rejects before the deadline | the deadline fires first
     *   partition on what happens after the deadline fires: the promise later
     *     resolves | the promise later rejects (must not surface as an unhandled
     *     rejection, since nobody is waiting on it any more)
     *   partition on the timer: cleared when the promise wins, so a settled call
     *     leaves nothing armed
     */

    it('covers the promise resolving before the deadline: resolves with its value', async () => {
        const result = await withDeadline(Promise.resolve('value'), 10_000, 'fallback');
        expect(result).toBe('value');
    });

    it('covers the promise rejecting before the deadline: rejects with its error', async () => {
        const error = new Error('boom');
        await expect(withDeadline(Promise.reject(error), 10_000, 'fallback')).rejects.toBe(error);
    });

    it('covers the deadline firing first: resolves with the fallback', async () => {
        const never = new Promise<string>(() => {});
        const raced = withDeadline(never, 10_000, 'fallback');
        await vi.advanceTimersByTimeAsync(10_000);
        expect(await raced).toBe('fallback');
    });

    it('covers the deadline firing first: does not resolve one tick early', async () => {
        const never = new Promise<string>(() => {});
        let settled = false;
        void withDeadline(never, 10_000, 'fallback').then(() => (settled = true));
        await vi.advanceTimersByTimeAsync(9_999);
        expect(settled).toBe(false);
    });

    it('covers the promise resolving after the deadline: the fallback stands', async () => {
        let resolveLate = (_: string) => {};
        const late = new Promise<string>((resolve) => (resolveLate = resolve));
        const raced = withDeadline(late, 10_000, 'fallback');
        await vi.advanceTimersByTimeAsync(10_000);
        resolveLate('too late');
        expect(await raced).toBe('fallback');
    });

    it('covers the promise rejecting after the deadline: no unhandled rejection', async () => {
        const seen = await unhandledDuring(async () => {
            let rejectLate = (_: unknown) => {};
            const late = new Promise<string>((_, reject) => (rejectLate = reject));
            // A real 5ms deadline, since this one runs on real timers.
            const raced = withDeadline(late, 5, 'fallback');
            expect(await raced).toBe('fallback');
            rejectLate(new Error('late boom'));
        });
        expect(seen).toEqual([]);
    });

    it('covers the timer being cleared when the promise wins', async () => {
        await withDeadline(Promise.resolve('value'), 10_000, 'fallback');
        expect(vi.getTimerCount()).toBe(0);
    });
});
