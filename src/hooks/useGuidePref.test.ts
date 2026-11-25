import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useGuidePref } from './useGuidePref';
import type { Account, AccountGuide } from './accountGuide';
import type { GuidePref } from './useGuidePref';

/**
 * An account whose session the test drives by hand, recording every write.
 * `watch` reports nothing until `fire` is called, which is the real thing's
 * behaviour before the session is known.
 */
function fakeAccount(saveError?: string) {
    const saved: GuidePref[] = [];
    let listener: ((account: Account | null) => void) | null = null;

    const account: AccountGuide = {
        watch: (onAccount) => {
            listener = onAccount;
            return () => {
                listener = null;
            };
        },
        save: (pref) => {
            saved.push(pref);
            return saveError === undefined
                ? Promise.resolve()
                : Promise.reject(new Error(saveError));
        },
    };

    return {
        account,
        saved,
        fire: (current: Account | null) => act(() => listener?.(current)),
    };
}

/** An account that never reports and never accepts a write — a guest's. */
const noAccount: AccountGuide = {
    watch: () => () => {},
    save: () => Promise.reject(new Error('no session')),
};

describe('useGuidePref', () => {
    /*
     * Testing strategy
     *     partition on what is cached: nothing (a first visit) | 'yes' | 'no' |
     *         a value this app never wrote
     *     partition on the account: none reported (a guest) | one holding a
     *         preference | one holding none
     *     partition on the choice: made signed out | made signed in
     *     partition on the write: it lands | it fails
     *
     * The default is the case worth being sure of: it decides whether someone
     * who has never touched the setting is offered the guide at all.
     */

    beforeEach(() => {
        localStorage.clear();
    });

    it('offers the guide when nothing has been chosen', () => {
        const { result } = renderHook(() => useGuidePref(noAccount));

        expect(result.current.pref).toBe('yes');
    });

    it.each(['yes', 'no'] as const)('reads back a cached %s', (pref) => {
        localStorage.setItem('beaverplans:guide', pref);

        const { result } = renderHook(() => useGuidePref(noAccount));

        expect(result.current.pref).toBe(pref);
    });

    // Anything else is another app's key, a hand-edited value or a future
    // version's — none of which is a reason to hide the guide.
    it('falls back to yes on a value it does not recognise', () => {
        localStorage.setItem('beaverplans:guide', 'maybe');

        const { result } = renderHook(() => useGuidePref(noAccount));

        expect(result.current.pref).toBe('yes');
    });

    it('remembers a choice past a remount', () => {
        const first = renderHook(() => useGuidePref(noAccount));

        act(() => first.result.current.setPref('no'));
        first.unmount();
        const second = renderHook(() => useGuidePref(noAccount));

        expect(second.result.current.pref).toBe('no');
        expect(localStorage.getItem('beaverplans:guide')).toBe('no');
    });

    // The cache decides the first paint, because waiting on the network to know
    // whether to draw the guide would mean drawing nothing.
    it('shows the cached preference before the account has answered', () => {
        localStorage.setItem('beaverplans:guide', 'no');
        const fake = fakeAccount();

        const { result } = renderHook(() => useGuidePref(fake.account));

        expect(result.current.pref).toBe('no');
        expect(fake.saved).toEqual([]);
    });

    it('adopts the account preference over the cached one', async () => {
        localStorage.setItem('beaverplans:guide', 'yes');
        const fake = fakeAccount();
        const { result } = renderHook(() => useGuidePref(fake.account));

        fake.fire({ userId: 'u1', pref: 'no' });

        expect(result.current.pref).toBe('no');
        // rewritten so this device agrees with every other one at next start
        await waitFor(() => expect(localStorage.getItem('beaverplans:guide')).toBe('no'));
        expect(fake.saved).toEqual([]);
    });

    /*
     * An account that has never had one — made before the preference was kept,
     * or by a guest who has just signed up. It is offered the guide rather than
     * seeded from the device: whether someone needs teaching is a fact about
     * them, and the cache is a fact about the browser. Nothing is written, so
     * the account stays unanswered until its owner says otherwise.
     */
    it('offers the guide to an account holding no preference', () => {
        localStorage.setItem('beaverplans:guide', 'no');
        const fake = fakeAccount();
        const { result } = renderHook(() => useGuidePref(fake.account));

        fake.fire({ userId: 'u1', pref: null });

        expect(result.current.pref).toBe('yes');
        expect(fake.saved).toEqual([]);
    });

    /*
     * Two accounts, one browser. The second must not inherit the first's
     * answer — and must not have it written onto them, which would follow them
     * to every device they ever sign in on.
     */
    it('does not carry one account preference onto the next', () => {
        const fake = fakeAccount();
        const { result } = renderHook(() => useGuidePref(fake.account));

        fake.fire({ userId: 'u1', pref: 'no' });
        fake.fire(null);
        fake.fire({ userId: 'u2', pref: null });

        expect(result.current.pref).toBe('yes');
        expect(fake.saved).toEqual([]);
    });

    it('pushes a choice made while signed in', () => {
        const fake = fakeAccount();
        const { result } = renderHook(() => useGuidePref(fake.account));
        fake.fire({ userId: 'u1', pref: 'yes' });

        act(() => result.current.setPref('no'));

        expect(result.current.pref).toBe('no');
        expect(fake.saved).toEqual(['no']);
    });

    // A guest has no account to tell. The choice still sticks on the device.
    it('keeps a choice made signed out to itself', () => {
        const fake = fakeAccount();
        const { result } = renderHook(() => useGuidePref(fake.account));
        fake.fire(null);

        act(() => result.current.setPref('no'));

        expect(result.current.pref).toBe('no');
        expect(fake.saved).toEqual([]);
        expect(localStorage.getItem('beaverplans:guide')).toBe('no');
    });

    /*
     * A write that cannot land is dropped rather than marked for retry, unlike
     * the language's. The cost is that this device is skipped and another is
     * not, which one more press fixes; the cost of getting it wrong the other
     * way is a language reverting under someone, which is why that one is
     * marked and this one is not.
     */
    it('keeps a choice whose write fails, and does not report it', async () => {
        const fake = fakeAccount('offline');
        const { result } = renderHook(() => useGuidePref(fake.account));
        fake.fire({ userId: 'u1', pref: 'yes' });
        const onError = vi.fn();
        window.addEventListener('unhandledrejection', onError);

        act(() => result.current.setPref('no'));
        await act(() => Promise.resolve());

        expect(result.current.pref).toBe('no');
        expect(localStorage.getItem('beaverplans:guide')).toBe('no');
        expect(onError).not.toHaveBeenCalled();
        window.removeEventListener('unhandledrejection', onError);
    });

    it('stops watching the account when it unmounts', () => {
        const fake = fakeAccount();
        const { result, unmount } = renderHook(() => useGuidePref(fake.account));

        unmount();
        fake.fire({ userId: 'u1', pref: 'no' });

        expect(result.current.pref).toBe('yes');
    });
});
