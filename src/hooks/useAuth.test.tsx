import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import type { AuthChangeEvent, Session } from '@supabase/supabase-js';
import { useAuth } from './useAuth';
import { supabase } from '../storage/supabaseClient';
import { store, cloudBackend } from '../storage/instance';

// The supabase-js surface this hook touches. signIn/resetPassword/updatePassword
// are deliberately not exercised below: each is a three-line pass-through whose
// only behaviour is "throw error.message on error", and a test for one would
// assert that a call we can see is a call we make. The methods that ARE tested
// are the ones that decide something on top of the call — signUp's return,
// verifyPassword's error triage, signOut's ordering, cancelRecovery's refusal
// to clear the gate on failure.
vi.mock('../storage/supabaseClient', () => ({
    supabase: {
        auth: {
            getSession: vi.fn(),
            onAuthStateChange: vi.fn(),
            signUp: vi.fn(),
            signInWithPassword: vi.fn(),
            updateUser: vi.fn(),
            signOut: vi.fn(),
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

// Duplicated from useAuth.ts rather than exported from it, on purpose: this key
// is a persistence contract, not an implementation detail. Renaming it strands
// anyone mid-recovery when they refresh — the marker they wrote is the one the
// next boot can no longer find — so the rename should have to change a test.
const RECOVERY_KEY = 'beaverplans.recoveringUserId';

function markRecovering(userId: string, expiresAt = Date.now() + 60_000): void {
    localStorage.setItem(RECOVERY_KEY, JSON.stringify({ userId, expiresAt }));
}

function markedUser(): string | null {
    const raw = localStorage.getItem(RECOVERY_KEY);
    return raw === null ? null : (JSON.parse(raw) as { userId: string }).userId;
}

/** Shapes a supabase-js `{ data, error }` reply without importing its generics. */
function reply(value: unknown) {
    return value as never;
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
        vi.mocked(supabase.auth.signUp).mockReset();
        vi.mocked(supabase.auth.signInWithPassword).mockReset();
        vi.mocked(supabase.auth.updateUser).mockReset();
        vi.mocked(supabase.auth.signOut).mockReset();
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

    // The race the `seeded` flag exists for. getSession() and the listener's own
    // first event are both async and neither is documented to win, so both must
    // not apply a session independently. Here the listener wins and getSession
    // lands late reporting no session: applying it would sign the user straight
    // back out and swap the cloud backend for the local one under a signed-in
    // account — the guest-data flash the flag was written to prevent.
    it('the late half of the seeding race is a no-op, not a second seed', async () => {
        let settle!: (value: never) => void;
        vi.mocked(supabase.auth.getSession).mockReturnValue(
            new Promise<never>((resolve) => {
                settle = resolve;
            }) as ReturnType<typeof supabase.auth.getSession>,
        );
        const { result } = renderHook(() => useAuth());

        act(() => emit('SIGNED_IN', sessionFor('u1')));
        await waitFor(() => expect(result.current.loading).toBe(false));
        const seeded = result.current.epoch;

        await act(async () => {
            settle(reply({ data: { session: null }, error: null }));
        });

        expect(result.current.user?.id).toBe('u1');
        expect(store.useBackend).toHaveBeenLastCalledWith('cloud');
        expect(result.current.epoch).toBe(seeded);
    });

    /*
     * The recovery gate. `recovering` is what App hard-gates on before anything
     * else, so a false negative drops someone into their real account with the
     * old password still live — which is the thing RecoveryScreen exists to
     * prevent — and a false positive strands a device on a password screen it
     * cannot leave. Both directions are failures worth a test.
     *
     *   partition on the event: PASSWORD_RECOVERY | any other
     *   partition on the stored marker: absent | this user | another user
     *     | expired | unparseable | unreadable storage
     */

    it('a recovery link raises the gate and records who it is for', async () => {
        const { result } = await mountWith(null);

        act(() => emit('PASSWORD_RECOVERY', sessionFor('u1')));

        expect(result.current.recovering).toBe(true);
        expect(markedUser()).toBe('u1');
    });

    // The marker's entire reason to exist. Supabase fires PASSWORD_RECOVERY once
    // per session; after a refresh getSession() reports an ordinary signed-in
    // session, indistinguishable from any other. Without the stored marker this
    // boot lets the user straight into the app, password unchanged.
    it('a refresh mid-recovery is still recovery, with no second event to go on', async () => {
        markRecovering('u1');

        const { result } = await mountWith(sessionFor('u1'));

        expect(result.current.recovering).toBe(true);
    });

    it("another account's marker does not gate this one, and is cleared out", async () => {
        markRecovering('u2');

        const { result } = await mountWith(sessionFor('u1'));

        expect(result.current.recovering).toBe(false);
        expect(markedUser()).toBeNull();
    });

    // Abandoning the tab mid-recovery must not brick the device. Without the TTL
    // the marker outlives the emailed link that justified it and every later boot
    // as that user lands on a password screen with no way past.
    it('an expired marker is ignored and dropped', async () => {
        markRecovering('u1', Date.now() - 1);

        const { result } = await mountWith(sessionFor('u1'));

        expect(result.current.recovering).toBe(false);
        expect(markedUser()).toBeNull();
    });

    // A value that cannot be parsed is read on EVERY auth event, so throwing
    // here would not fail once, it would fail forever — the boot path could
    // never get past it to overwrite the bad value.
    it('an unparseable marker is discarded, not thrown on', async () => {
        localStorage.setItem(RECOVERY_KEY, '{not json');

        const { result } = await mountWith(sessionFor('u1'));

        expect(result.current.recovering).toBe(false);
        expect(localStorage.getItem(RECOVERY_KEY)).toBeNull();
    });

    // Safari's private mode throws on localStorage rather than returning null.
    // The marker is a convenience; the app is not.
    it('storage that throws costs the marker, not the boot', async () => {
        const getItem = vi
            .spyOn(Storage.prototype, 'getItem')
            .mockImplementation((key: string) => {
                if (key === RECOVERY_KEY) throw new Error('denied');
                return null;
            });

        const { result } = await mountWith(sessionFor('u1'));

        expect(result.current.recovering).toBe(false);
        expect(result.current.user?.id).toBe('u1');
        getItem.mockRestore();
    });

    it('clearRecovering drops both the gate and the marker', async () => {
        markRecovering('u1');
        const { result } = await mountWith(sessionFor('u1'));
        expect(result.current.recovering).toBe(true);

        act(() => result.current.clearRecovering());

        expect(result.current.recovering).toBe(false);
        expect(markedUser()).toBeNull();
    });

    /*
     * cancelRecovery vs signOut — the two have deliberately OPPOSITE failure
     * behaviour, and getting either backwards is a real bug, so both directions
     * are pinned.
     */

    it('cancelling recovery signs out locally, so it works with no network', async () => {
        markRecovering('u1');
        vi.mocked(supabase.auth.signOut).mockResolvedValue(reply({ error: null }));
        const { result } = await mountWith(sessionFor('u1'));

        await act(async () => {
            await result.current.cancelRecovery();
        });

        // scope: 'local' specifically — a server-side revoke needs the network,
        // and Cancel has to work for someone who has none.
        expect(supabase.auth.signOut).toHaveBeenCalledWith({ scope: 'local' });
        expect(cloudBackend.reset).toHaveBeenCalled();
        expect(result.current.recovering).toBe(false);
        expect(markedUser()).toBeNull();
    });

    // The asymmetry that matters: a cancel that did not actually sign out must
    // leave the gate UP. Clearing it on a failed sign-out lands the user in
    // their real account on a session that recovery was in the middle of, with
    // the old password never replaced.
    it('a cancel that fails to sign out keeps the gate up', async () => {
        markRecovering('u1');
        vi.mocked(supabase.auth.signOut).mockResolvedValue(
            reply({ error: { message: 'network down' } }),
        );
        const { result } = await mountWith(sessionFor('u1'));

        await expect(result.current.cancelRecovery()).rejects.toThrow('network down');

        expect(result.current.recovering).toBe(true);
        expect(markedUser()).toBe('u1');
    });

    // signOut's opposite: the cache reset is the safety-critical half and must
    // already have happened before the network is asked for anything, so a
    // failed call cannot leave the previous user's weeks cached for the next one.
    it('signing out clears the cloud cache even when the network call fails', async () => {
        vi.mocked(supabase.auth.signOut).mockRejectedValue(new Error('offline'));
        const { result } = await mountWith(sessionFor('u1'));

        await act(async () => {
            await result.current.signOut();
        });

        expect(cloudBackend.reset).toHaveBeenCalled();
    });

    /*
     * signUp's boolean, which AuthForm uses to choose between "you're in" and
     * "check your email". Supabase returns the same shape for a fresh signup
     * needing confirmation and for an address that already has an account, so
     * the session's presence is the only thing that distinguishes them.
     */

    it('signUp reports true only when the browser was left with a live session', async () => {
        vi.mocked(supabase.auth.signUp).mockResolvedValue(
            reply({ data: { session: sessionFor('u1') }, error: null }),
        );
        const { result } = await mountWith(null);

        await expect(result.current.signUp('a@b.c', 'pw', 'duong', 'tok')).resolves.toBe(true);
    });

    it('signUp reports false when confirmation is still pending', async () => {
        vi.mocked(supabase.auth.signUp).mockResolvedValue(
            reply({ data: { session: null }, error: null }),
        );
        const { result } = await mountWith(null);

        await expect(result.current.signUp('a@b.c', 'pw', 'duong', 'tok')).resolves.toBe(false);
    });

    // Trimmed on the way in, so the stored value is canonical whatever the form
    // sent — usernameOf trims on the way out too, but only the write decides
    // what every OTHER reader of user_metadata sees.
    it('signUp stores the username trimmed', async () => {
        vi.mocked(supabase.auth.signUp).mockResolvedValue(
            reply({ data: { session: null }, error: null }),
        );
        const { result } = await mountWith(null);

        await result.current.signUp('a@b.c', 'pw', '  duong  ', 'tok');

        expect(supabase.auth.signUp).toHaveBeenCalledWith(
            expect.objectContaining({ options: expect.objectContaining({ data: { username: 'duong' } }) }),
        );
    });

    /*
     * verifyPassword's three-way triage. Only a REJECTED password may answer
     * `false`; everything else is a failure to ask the question at all, and
     * reporting one as "wrong password" sends someone off resetting a password
     * that was never the problem.
     *
     *   partition on the reply: no error | invalid_credentials | any other error
     */

    it('verifyPassword accepts the current password', async () => {
        vi.mocked(supabase.auth.signInWithPassword).mockResolvedValue(reply({ error: null }));
        const { result } = await mountWith(sessionFor('u1'));

        await expect(result.current.verifyPassword('pw', 'tok')).resolves.toBe(true);
    });

    it('verifyPassword rejects a wrong password', async () => {
        vi.mocked(supabase.auth.signInWithPassword).mockResolvedValue(
            reply({ error: { code: 'invalid_credentials', message: 'bad' } }),
        );
        const { result } = await mountWith(sessionFor('u1'));

        await expect(result.current.verifyPassword('nope', 'tok')).resolves.toBe(false);
    });

    it('verifyPassword surfaces a rate limit as an error, never as a wrong password', async () => {
        vi.mocked(supabase.auth.signInWithPassword).mockResolvedValue(
            reply({ error: { code: 'over_request_rate_limit', message: 'slow down' } }),
        );
        const { result } = await mountWith(sessionFor('u1'));

        await expect(result.current.verifyPassword('pw', 'tok')).rejects.toThrow('slow down');
    });

    it('verifyPassword refuses to run with no signed-in account to confirm', async () => {
        const { result } = await mountWith(null);

        await expect(result.current.verifyPassword('pw', 'tok')).rejects.toThrow(
            'No signed-in account to confirm.',
        );
        expect(supabase.auth.signInWithPassword).not.toHaveBeenCalled();
    });

    /*
     * updateUsername, whose local write is the point: supabase-js does emit
     * USER_UPDATED, but waiting a round trip to rename yourself makes a free
     * action feel expensive.
     */

    it('updateUsername shows the new name without waiting for an auth event', async () => {
        vi.mocked(supabase.auth.updateUser).mockResolvedValue(reply({ error: null }));
        const { result } = await mountWith(sessionFor('u1'));

        await act(async () => {
            await result.current.updateUsername('  duong  ');
        });

        expect(result.current.user?.username).toBe('duong');
        expect(supabase.auth.updateUser).toHaveBeenCalledWith({ data: { username: 'duong' } });
    });

    // usernameOf guarantees the chip is never blank; letting a blank one be
    // SAVED would push that guarantee onto the fallback chain forever.
    it('updateUsername refuses a blank name without calling out', async () => {
        const { result } = await mountWith(sessionFor('u1'));

        await expect(result.current.updateUsername('   ')).rejects.toThrow('Pick a username.');
        expect(supabase.auth.updateUser).not.toHaveBeenCalled();
    });
});
