import { describe, expect, it } from 'vitest';
import { accountGuide, type Account, type AuthClient, type SessionLike } from './accountGuide';

/** Lets every queued microtask and timer run before a test asserts. */
function flush(): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, 0));
}

/** A promise a test resolves when it chooses. */
function defer<T>() {
    let settle: (value: T) => void = () => {};
    const promise = new Promise<T>((resolve) => {
        settle = resolve;
    });
    return { promise, settle: (value: T) => settle(value) };
}

function sessionFor(userId: string, metadata?: Record<string, unknown>): SessionLike {
    return { user: { id: userId, user_metadata: metadata } };
}

/**
 * A stand-in for supabase-js's auth client: the session read is a promise the
 * test settles, so a test can put an auth event before or after it, and every
 * write is recorded rather than sent.
 */
function fakeAuth(saveError?: string) {
    const read = defer<SessionLike | null>();
    const written: Record<string, unknown>[] = [];
    let listener: ((event: string, session: SessionLike | null) => void) | null = null;
    let unsubscribed = false;

    const auth: AuthClient = {
        getSession: () => read.promise.then((session) => ({ data: { session } })),
        onAuthStateChange: (callback) => {
            listener = callback;
            return {
                data: {
                    subscription: {
                        unsubscribe: () => {
                            unsubscribed = true;
                        },
                    },
                },
            };
        },
        updateUser: (attributes) => {
            written.push(attributes.data);
            return Promise.resolve({
                error: saveError === undefined ? null : { message: saveError },
            });
        },
    };

    return {
        auth,
        written,
        settleSession: read.settle,
        fire: (session: SessionLike | null) => listener?.('TOKEN_REFRESHED', session),
        isUnsubscribed: () => unsubscribed,
    };
}

describe('accountGuide', () => {
    /*
     * Testing strategy
     *     partition on the session: none (signed out) | one carrying a stored
     *         preference | one carrying none | one carrying a value this app
     *         never wrote
     *     partition on the stored value: true | false, since the account speaks
     *         boolean and the app speaks 'yes' | 'no'
     *     partition on which source answers first: the session read | an auth
     *         event, the second of which makes the first stale
     *     partition on the write: it lands | it fails
     */

    it('reports no account when signed out', async () => {
        const seen: (Account | null)[] = [];
        const fake = fakeAuth();

        accountGuide(fake.auth).watch((account) => seen.push(account));
        fake.settleSession(null);
        await flush();

        expect(seen).toEqual([null]);
    });

    it.each([
        [true, 'yes'],
        [false, 'no'],
    ] as const)('reads a stored %s back as %s', async (stored, pref) => {
        const seen: (Account | null)[] = [];
        const fake = fakeAuth();

        accountGuide(fake.auth).watch((account) => seen.push(account));
        fake.settleSession(sessionFor('u1', { guide_enabled: stored }));
        await flush();

        expect(seen).toEqual([{ userId: 'u1', pref }]);
    });

    // Null is what tells useGuidePref to seed the account rather than adopt
    // from it, so an account made before the preference existed and one holding
    // a value this app never wrote have to look the same.
    it.each([
        ['nothing stored', undefined],
        ['a value it does not recognise', { guide_enabled: 'sometimes' }],
    ] as const)('reports %s as no preference', async (_case, metadata) => {
        const seen: (Account | null)[] = [];
        const fake = fakeAuth();

        accountGuide(fake.auth).watch((account) => seen.push(account));
        fake.settleSession(sessionFor('u1', metadata));
        await flush();

        expect(seen).toEqual([{ userId: 'u1', pref: null }]);
    });

    // The session read is stale the moment an auth event has been heard, so it
    // must not report an older session over the newer one.
    it('drops a session read that an auth event has already overtaken', async () => {
        const seen: (Account | null)[] = [];
        const fake = fakeAuth();

        accountGuide(fake.auth).watch((account) => seen.push(account));
        fake.fire(sessionFor('u2', { guide_enabled: false }));
        fake.settleSession(sessionFor('u1', { guide_enabled: true }));
        await flush();

        expect(seen).toEqual([{ userId: 'u2', pref: 'no' }]);
    });

    it('reports every later change of session', async () => {
        const seen: (Account | null)[] = [];
        const fake = fakeAuth();

        accountGuide(fake.auth).watch((account) => seen.push(account));
        fake.settleSession(sessionFor('u1', { guide_enabled: true }));
        await flush();
        fake.fire(null);
        fake.fire(sessionFor('u1', { guide_enabled: false }));

        expect(seen).toEqual([{ userId: 'u1', pref: 'yes' }, null, { userId: 'u1', pref: 'no' }]);
    });

    it('stops reporting once the watch is dropped', async () => {
        const seen: (Account | null)[] = [];
        const fake = fakeAuth();

        const stop = accountGuide(fake.auth).watch((account) => seen.push(account));
        stop();
        fake.settleSession(sessionFor('u1', { guide_enabled: true }));
        await flush();
        fake.fire(sessionFor('u1', { guide_enabled: false }));

        expect(seen).toEqual([]);
        expect(fake.isUnsubscribed()).toBe(true);
    });

    // Merged into user_metadata rather than replacing it, which is what makes
    // writing this alone safe for the username and the locale beside it.
    it.each([
        ['yes', true],
        ['no', false],
    ] as const)('writes %s as %s, and nothing else', async (pref, stored) => {
        const fake = fakeAuth();

        await accountGuide(fake.auth).save(pref);

        expect(fake.written).toEqual([{ guide_enabled: stored }]);
    });

    it('throws when the write does not land', async () => {
        const fake = fakeAuth('offline');

        await expect(accountGuide(fake.auth).save('no')).rejects.toThrow('offline');
    });
});
