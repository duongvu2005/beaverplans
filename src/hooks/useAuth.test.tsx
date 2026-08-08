import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import type { AuthChangeEvent, Session } from '@supabase/supabase-js';
import { useAuth } from './useAuth';
import { supabase } from '../storage/supabaseClient';
import { store, cloudBackend } from '../storage/instance';

// Mocked down to the two auth calls the hook's boot path makes. The rest of
// the surface (signIn, signUp, ...) is a thin pass-through to supabase-js and
// is not what these tests are about.
vi.mock('../storage/supabaseClient', () => ({
    supabase: {
        auth: {
            getSession: vi.fn(),
            onAuthStateChange: vi.fn(),
        },
    },
}));

vi.mock('../storage/instance', () => ({
    store: { useBackend: vi.fn() },
    cloudBackend: { reset: vi.fn() },
}));

function sessionFor(userId: string): Session {
    return { user: { id: userId, email: `${userId}@example.com` } } as unknown as Session;
}

/** Fires an auth event at the hook's listener, as supabase-js would. */
let emit: (event: AuthChangeEvent, session: Session | null) => void;

/** Resolves the initial getSession() with `session`, then mounts the hook. */
async function mountWith(session: Session | null) {
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session },
        error: null,
    } as Awaited<ReturnType<typeof supabase.auth.getSession>>);
    const hook = renderHook(() => useAuth());
    await waitFor(() => expect(hook.result.current.loading).toBe(false));
    return hook;
}

describe('useAuth', () => {
    beforeEach(() => {
        localStorage.clear();
        vi.mocked(store.useBackend).mockReset();
        vi.mocked(cloudBackend.reset).mockReset();
        vi.mocked(supabase.auth.getSession).mockReset();
        vi.mocked(supabase.auth.onAuthStateChange)
            .mockReset()
            .mockImplementation((cb) => {
                emit = cb;
                return {
                    data: { subscription: { id: 's', callback: cb, unsubscribe: vi.fn() } },
                } as unknown as ReturnType<typeof supabase.auth.onAuthStateChange>;
            });
    });

    /*
     * Testing strategy — epoch, whose documented contract is that it bumps
     * "each time the active backend actually switches", and which useWeeks
     * treats as "throw away the loaded weeks and reload".
     *
     *   partition on the seeding session: none (guest) | present (signed in)
     *   partition on a post-seed event's user id vs the one already seen:
     *     same id (token refresh, repeat SIGNED_IN) — no switch, must NOT bump
     *     undefined -> id (guest signs in)          — switch, must bump
     *     id -> undefined (sign out)                — switch, must bump
     *     id -> different id (account swap)         — switch, must bump + reset
     */

    it('guest seed: stays on local, and does not bump (nothing switched)', async () => {
        const { result } = await mountWith(null);
        expect(result.current.user).toBeNull();
        expect(store.useBackend).toHaveBeenCalledWith('local');
        expect(result.current.epoch).toBe(0);
    });

    it('signed-in seed: switches to cloud and bumps once', async () => {
        const { result } = await mountWith(sessionFor('u1'));
        expect(result.current.user).toEqual({
            id: 'u1',
            email: 'u1@example.com',
            // no stored metadata on this fixture, so the email's local part
            // stands in — see usernameOf
            username: 'u1',
        });
        expect(store.useBackend).toHaveBeenCalledWith('cloud');
        expect(result.current.epoch).toBe(1);
    });

    /*
     * usernameOf's fallback chain, which every signed-in surface depends on
     * never being blank:
     *   stored metadata | blank/absent metadata -> email local part | neither -> 'you'
     */

    it('a stored username wins, trimmed', async () => {
        const session = sessionFor('u1');
        Object.assign(session.user, { user_metadata: { username: '  duong  ' } });
        const { result } = await mountWith(session);
        expect(result.current.user?.username).toBe('duong');
    });

    it('a blank stored username falls back to the email local part', async () => {
        const session = sessionFor('u1');
        Object.assign(session.user, { user_metadata: { username: '   ' } });
        const { result } = await mountWith(session);
        expect(result.current.user?.username).toBe('u1');
    });

    it('no username and no email: still not blank', async () => {
        const session = sessionFor('u1');
        Object.assign(session.user, { email: undefined, user_metadata: {} });
        const { result } = await mountWith(session);
        expect(result.current.user?.username).toBe('you');
    });

    // The refocus bug: supabase-js refreshes the token when a tab regains
    // focus, and the resulting event carries the SAME user and the SAME
    // backend. Bumping on it drops useWeeks back to unloaded, which blanks
    // the app and unmounts every child — losing editor drafts and scroll
    // position every time the window is switched back to.
    it('token refresh for the same user: does not bump', async () => {
        const { result } = await mountWith(sessionFor('u1'));
        const seeded = result.current.epoch;

        act(() => emit('TOKEN_REFRESHED', sessionFor('u1')));

        expect(result.current.epoch).toBe(seeded);
    });

    it('repeat SIGNED_IN for the same user: does not bump', async () => {
        const { result } = await mountWith(sessionFor('u1'));
        const seeded = result.current.epoch;

        act(() => emit('SIGNED_IN', sessionFor('u1')));

        expect(result.current.epoch).toBe(seeded);
    });

    it('guest signs in: bumps', async () => {
        const { result } = await mountWith(null);
        const seeded = result.current.epoch;

        act(() => emit('SIGNED_IN', sessionFor('u1')));

        expect(result.current.epoch).toBe(seeded + 1);
        expect(store.useBackend).toHaveBeenLastCalledWith('cloud');
    });

    it('sign out: bumps and goes back to local', async () => {
        const { result } = await mountWith(sessionFor('u1'));
        const seeded = result.current.epoch;

        act(() => emit('SIGNED_OUT', null));

        expect(result.current.epoch).toBe(seeded + 1);
        expect(store.useBackend).toHaveBeenLastCalledWith('local');
    });

    it('a different account signs in without a sign-out between: bumps and resets the cloud cache', async () => {
        const { result } = await mountWith(sessionFor('u1'));
        const seeded = result.current.epoch;

        act(() => emit('SIGNED_IN', sessionFor('u2')));

        expect(result.current.epoch).toBe(seeded + 1);
        expect(cloudBackend.reset).toHaveBeenCalled();
    });
});
