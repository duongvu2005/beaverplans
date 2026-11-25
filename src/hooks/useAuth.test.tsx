import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import type { AuthChangeEvent, Session } from '@supabase/supabase-js';
import { useAuth } from './useAuth';
import { AuthError } from './authError';
import { supabase } from '@/storage/supabaseClient';
import { store, cloudBackend } from '@/storage/instance';
import { reportOffline } from '@/test/offline';

// The supabase-js surface this hook touches. signIn/resetPassword/updatePassword
// are not exercised below: each is a pass-through whose only behaviour is "throw
// error.message on error". What is tested is what decides something on top of
// the call — signUp's return, verifyPassword's error triage, signOut's ordering,
// cancelRecovery's refusal to clear the gate on failure.
vi.mock('@/storage/supabaseClient', () => ({
    supabase: {
        auth: {
            getSession: vi.fn(),
            onAuthStateChange: vi.fn(),
            signUp: vi.fn(),
            signInWithPassword: vi.fn(),
            updateUser: vi.fn(),
            signOut: vi.fn(),
            resend: vi.fn(),
        },
        rpc: vi.fn(),
    },
}));

vi.mock('@/storage/instance', () => ({
    store: { useBackend: vi.fn(), useSession: vi.fn() },
    cloudBackend: {
        reset: vi.fn(),
        disconnect: vi.fn(),
        hasUnpushedWork: vi.fn(() => false),
        flushNow: vi.fn(async () => true),
    },
}));

function sessionFor(userId: string): Session {
    return { user: { id: userId, email: `${userId}@example.com` } } as unknown as Session;
}

// Duplicated from useAuth.ts rather than exported from it: this key is a
// persistence contract. Renaming it strands anyone mid-recovery when they
// refresh, so the rename should have to change a test.
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
        vi.mocked(cloudBackend.disconnect).mockReset();
        vi.mocked(cloudBackend.hasUnpushedWork).mockReset().mockReturnValue(false);
        vi.mocked(cloudBackend.flushNow).mockReset().mockResolvedValue(true);
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
     * Testing strategy — epoch, which bumps "each time the active backend
     * actually switches" and which useWeeks treats as "throw away the loaded
     * weeks and reload".
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

    // supabase-js refreshes the token when a tab regains focus, and the event
    // carries the SAME user and the SAME backend. Bumping on it would drop
    // useWeeks back to unloaded, blanking the app and unmounting every child.
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

    // The sign-out this hook did not perform: an expired refresh token, or a
    // sign-out in another tab. signOut() is what calls reset(), so nothing here
    // runs it -- and without disconnect() the previous user's feed stays open
    // and keeps rewriting their durable copy after they are signed out.
    it('a sign-out the app did not perform: disconnects the cloud backend, keeps its data', async () => {
        await mountWith(sessionFor('u1'));

        act(() => emit('SIGNED_OUT', null));

        expect(cloudBackend.disconnect).toHaveBeenCalled();
        // reset() would clear the durable copy, taking any unsent work with it.
        expect(cloudBackend.reset).not.toHaveBeenCalled();
    });

    describe('signOutWhenSynced', () => {
        /*
         * Testing strategy
         *   partition on what the account is missing: nothing (signs out at once) |
         *     something, and the flush lands | something, and the flush fails |
         *     something, and the browser reports no connection (never even tries) |
         *     something, and more arrives between the flush and the sign-out
         *
         * signOut() clears the durable copy, so this is what stands between an
         * unsent week and losing it.
         */

        it('covers nothing owed: signs out without a flush', async () => {
            const { result } = await mountWith(sessionFor('u1'));

            await act(async () => {
                await expect(result.current.signOutWhenSynced()).resolves.toBe(true);
            });

            expect(cloudBackend.flushNow).not.toHaveBeenCalled();
            expect(cloudBackend.reset).toHaveBeenCalled();
        });

        it('covers owed work that lands: flushes first, then signs out', async () => {
            // Owed, then not: what a backend that flushed successfully reports.
            vi.mocked(cloudBackend.hasUnpushedWork)
                .mockReturnValueOnce(true)
                .mockReturnValue(false);
            const { result } = await mountWith(sessionFor('u1'));

            await act(async () => {
                await expect(result.current.signOutWhenSynced()).resolves.toBe(true);
            });

            expect(cloudBackend.flushNow).toHaveBeenCalled();
            expect(cloudBackend.reset).toHaveBeenCalled();
        });

        it('covers owed work that will not land: refuses, and nothing is cleared', async () => {
            vi.mocked(cloudBackend.hasUnpushedWork).mockReturnValue(true);
            vi.mocked(cloudBackend.flushNow).mockResolvedValue(false);
            const { result } = await mountWith(sessionFor('u1'));

            await act(async () => {
                await expect(result.current.signOutWhenSynced()).resolves.toBe(false);
            });

            expect(cloudBackend.reset).not.toHaveBeenCalled();
        });

        // Ten seconds of a Sign out that looks broken, for an answer already known.
        it('covers no connection: does not even attempt the flush', async () => {
            vi.mocked(cloudBackend.hasUnpushedWork).mockReturnValue(true);
            reportOffline();
            const { result } = await mountWith(sessionFor('u1'));

            await act(async () => {
                await expect(result.current.signOutWhenSynced()).resolves.toBe(false);
            });

            expect(cloudBackend.flushNow).not.toHaveBeenCalled();
            expect(cloudBackend.reset).not.toHaveBeenCalled();
        });

        // The flush answers for the instant it finished, and reset() runs after
        // an await. A pull landing in between can leave work owed that the
        // flush's answer no longer covers.
        it('covers work arriving after the flush answered: refuses rather than clearing', async () => {
            vi.mocked(cloudBackend.hasUnpushedWork).mockReturnValue(true);
            vi.mocked(cloudBackend.flushNow).mockResolvedValue(true);
            const { result } = await mountWith(sessionFor('u1'));

            await act(async () => {
                await expect(result.current.signOutWhenSynced()).resolves.toBe(false);
            });

            expect(cloudBackend.reset).not.toHaveBeenCalled();
        });
    });

    it('a different account signs in without a sign-out between: bumps and resets the cloud cache', async () => {
        const { result } = await mountWith(sessionFor('u1'));
        const seeded = result.current.epoch;

        act(() => emit('SIGNED_IN', sessionFor('u2')));

        expect(result.current.epoch).toBe(seeded + 1);
        expect(cloudBackend.reset).toHaveBeenCalled();
    });

    // The race the `seeded` flag exists for. Here the listener wins and
    // getSession lands late reporting no session: applying it would sign the
    // user straight back out and swap the cloud backend for the local one under
    // a signed-in account.
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
     * The recovery gate. App gates on `recovering` before anything else, so a
     * false negative drops someone into their real account with the old password
     * still live, and a false positive strands a device on a password screen it
     * cannot leave. Both directions are pinned.
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

    // Supabase fires PASSWORD_RECOVERY once per session; after a refresh
    // getSession() reports an ordinary signed-in session. Without the stored
    // marker this boot lets the user into the app, password unchanged.
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

    // Without the TTL the marker outlives the emailed link that justified it,
    // and every later boot as that user lands on a password screen with no way
    // past.
    it('an expired marker is ignored and dropped', async () => {
        markRecovering('u1', Date.now() - 1);

        const { result } = await mountWith(sessionFor('u1'));

        expect(result.current.recovering).toBe(false);
        expect(markedUser()).toBeNull();
    });

    // A value that cannot be parsed is read on EVERY auth event, so throwing
    // here would fail forever: the boot path could never get past it to
    // overwrite the bad value.
    it('an unparseable marker is discarded, not thrown on', async () => {
        localStorage.setItem(RECOVERY_KEY, '{not json');

        const { result } = await mountWith(sessionFor('u1'));

        expect(result.current.recovering).toBe(false);
        expect(localStorage.getItem(RECOVERY_KEY)).toBeNull();
    });

    // Safari's private mode throws on localStorage rather than returning null.
    // The marker is a convenience; the app is not.
    it('storage that throws costs the marker, not the boot', async () => {
        const getItem = vi.spyOn(Storage.prototype, 'getItem').mockImplementation((key: string) => {
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
     * cancelRecovery vs signOut — the two have OPPOSITE failure behaviour, and
     * getting either backwards is a real bug, so both directions are pinned.
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

    // A cancel that did not actually sign out must leave the gate UP: clearing
    // it lands the user in their real account on the session recovery was in
    // the middle of, with the old password never replaced.
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

    // The cache reset must already have happened before the network is asked for
    // anything, so a failed call cannot leave the previous user's weeks cached
    // for the next one.
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
     * the session's presence is all that distinguishes them.
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
    // sent — only the write decides what other readers of user_metadata see.
    it('signUp stores the username trimmed', async () => {
        vi.mocked(supabase.auth.signUp).mockResolvedValue(
            reply({ data: { session: null }, error: null }),
        );
        const { result } = await mountWith(null);

        await result.current.signUp('a@b.c', 'pw', '  duong  ', 'tok');

        expect(supabase.auth.signUp).toHaveBeenCalledWith(
            expect.objectContaining({
                options: expect.objectContaining({ data: { username: 'duong' } }),
            }),
        );
    });

    /*
     * verifyPassword's three-way triage. Only a REJECTED password may answer
     * `false`; everything else is a failure to ask the question at all.
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

    // Asserts the identity, not the sentence: this hook cannot read the copy
    // catalog, so what it owes its caller is which refusal happened.
    // authError.test.ts covers the naming.
    it('verifyPassword refuses to run with no signed-in account to confirm', async () => {
        const { result } = await mountWith(null);

        await expect(result.current.verifyPassword('pw', 'tok')).rejects.toThrow(
            new AuthError('no-account'),
        );
        expect(supabase.auth.signInWithPassword).not.toHaveBeenCalled();
    });

    /*
     * resendConfirmation's triage: which errors to hide. The "check your email"
     * screen is shown both to a real new signup and to an address that already
     * has an account, so an error naming the difference would hand back the
     * account enumeration signUp's shaping exists to prevent.
     *
     *   partition on the reply: no error | an error about the request (reported)
     *       | an error about the address (swallowed) | an unrecognized code
     */

    it('resendConfirmation asks for another signup mail for the address given', async () => {
        vi.mocked(supabase.auth.resend).mockResolvedValue(reply({ error: null }));
        const { result } = await mountWith(null);

        await expect(result.current.resendConfirmation('a@b.com', 'tok')).resolves.toBeUndefined();
        expect(supabase.auth.resend).toHaveBeenCalledWith(
            expect.objectContaining({ type: 'signup', email: 'a@b.com' }),
        );
    });

    it('resendConfirmation reports a rate limit, which says nothing about the address', async () => {
        vi.mocked(supabase.auth.resend).mockResolvedValue(
            reply({ error: { code: 'over_email_send_rate_limit', message: 'wait a minute' } }),
        );
        const { result } = await mountWith(null);

        await expect(result.current.resendConfirmation('a@b.com', 'tok')).rejects.toThrow(
            'wait a minute',
        );
    });

    it('resendConfirmation reports a failed captcha', async () => {
        vi.mocked(supabase.auth.resend).mockResolvedValue(
            reply({ error: { code: 'captcha_failed', message: 'captcha protection: failed' } }),
        );
        const { result } = await mountWith(null);

        await expect(result.current.resendConfirmation('a@b.com', 'tok')).rejects.toThrow(
            'captcha protection: failed',
        );
    });

    it('resendConfirmation stays silent about an address that already has an account', async () => {
        vi.mocked(supabase.auth.resend).mockResolvedValue(
            reply({ error: { code: 'user_already_exists', message: 'User already registered' } }),
        );
        const { result } = await mountWith(null);

        await expect(result.current.resendConfirmation('a@b.com', 'tok')).resolves.toBeUndefined();
    });

    it('resendConfirmation stays silent about a code it does not recognize', async () => {
        vi.mocked(supabase.auth.resend).mockResolvedValue(
            reply({ error: { code: 'some_future_code', message: 'no such user' } }),
        );
        const { result } = await mountWith(null);

        await expect(result.current.resendConfirmation('a@b.com', 'tok')).resolves.toBeUndefined();
    });

    /*
     * deleteAccount, whose ordering is the point: the rpc is what erases
     * anything, and the local teardown must not run ahead of it. A
     * reset-then-fail would sign someone out of an account that still exists.
     *
     *   partition on the rpc: succeeds | fails
     */

    it('deleteAccount erases server-side first, then clears this browser', async () => {
        vi.mocked(supabase.rpc).mockResolvedValue(reply({ error: null }));
        vi.mocked(supabase.auth.signOut).mockResolvedValue(reply({ error: null }));
        const { result } = await mountWith(sessionFor('u1'));
        vi.mocked(cloudBackend.reset).mockClear();

        await act(async () => {
            await result.current.deleteAccount();
        });

        expect(supabase.rpc).toHaveBeenCalledWith('delete_own_account');
        expect(cloudBackend.reset).toHaveBeenCalled();
        // local, not the default: the account the token names is gone, so asking
        // the server to revoke it is a call that can only fail
        expect(supabase.auth.signOut).toHaveBeenCalledWith({ scope: 'local' });
    });

    it('deleteAccount leaves the session alone when the delete is refused', async () => {
        vi.mocked(supabase.rpc).mockResolvedValue(
            reply({ error: { message: 'no account to delete' } }),
        );
        const { result } = await mountWith(sessionFor('u1'));
        vi.mocked(cloudBackend.reset).mockClear();
        vi.mocked(supabase.auth.signOut).mockClear();

        await expect(result.current.deleteAccount()).rejects.toThrow('no account to delete');
        expect(cloudBackend.reset).not.toHaveBeenCalled();
        expect(supabase.auth.signOut).not.toHaveBeenCalled();
    });

    /*
     * updateEmail, which is not a change that has happened: supabase only mails
     * a link, and the address moves when that link is opened.
     */

    it('updateEmail asks for the change with a redirect back to this app', async () => {
        vi.mocked(supabase.auth.updateUser).mockResolvedValue(reply({ error: null }));
        const { result } = await mountWith(sessionFor('u1'));

        await act(async () => {
            await result.current.updateEmail('  new@example.com  ');
        });

        expect(supabase.auth.updateUser).toHaveBeenCalledWith(
            { email: 'new@example.com' },
            { emailRedirectTo: window.location.origin },
        );
    });

    it('updateEmail does not rename the local user — nothing has changed yet', async () => {
        vi.mocked(supabase.auth.updateUser).mockResolvedValue(reply({ error: null }));
        const { result } = await mountWith(sessionFor('u1'));

        await act(async () => {
            await result.current.updateEmail('new@example.com');
        });

        expect(result.current.user?.email).toBe('u1@example.com');
    });

    /*
     * updateUsername, whose local write is the point: supabase-js does emit
     * USER_UPDATED, but the chip changes without waiting a round trip.
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

    // usernameOf guarantees the chip is never blank; a blank one saved would
    // push that guarantee onto the fallback chain forever.
    it('updateUsername refuses a blank name without calling out', async () => {
        const { result } = await mountWith(sessionFor('u1'));

        await expect(result.current.updateUsername('   ')).rejects.toThrow(
            new AuthError('blank-username'),
        );
        expect(supabase.auth.updateUser).not.toHaveBeenCalled();
    });
});
