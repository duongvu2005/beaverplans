import { describe, expect, it } from 'vitest';
import { accountLocale, type Account, type AuthClient, type SessionLike } from './accountLocale';

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

/** Waits for the microtasks a settled session read has queued. */
function flush(): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, 0));
}

describe('accountLocale', () => {
    /*
     * Testing strategy
     *
     * partition on the session:
     *   none; one whose metadata names a supported locale; one whose metadata
     *   names an unsupported value; one with no locale in its metadata
     * partition on what reports first:
     *   the session read; an auth event
     * partition on the watcher's life:
     *   still subscribed; stopped
     * partition on the write:
     *   accepted; refused
     */

    it('covers no session', async () => {
        const fake = fakeAuth();
        const seen: (Account | null)[] = [];
        accountLocale(fake.auth).watch((account) => seen.push(account));

        fake.settleSession(null);
        await flush();

        expect(seen).toEqual([null]);
    });

    it('covers a session naming a supported locale', async () => {
        const fake = fakeAuth();
        const seen: (Account | null)[] = [];
        accountLocale(fake.auth).watch((account) => seen.push(account));

        fake.settleSession(sessionFor('u1', { username: 'ada', locale: 'vi' }));
        await flush();

        expect(seen).toEqual([{ userId: 'u1', value: 'vi' }]);
    });

    it('covers a session with no locale in its metadata', async () => {
        const fake = fakeAuth();
        const seen: (Account | null)[] = [];
        accountLocale(fake.auth).watch((account) => seen.push(account));

        fake.settleSession(sessionFor('u1', { username: 'ada' }));
        await flush();

        expect(seen).toEqual([{ userId: 'u1', value: null }]);
    });

    it('covers a session naming an unsupported value', async () => {
        const fake = fakeAuth();
        const seen: (Account | null)[] = [];
        accountLocale(fake.auth).watch((account) => seen.push(account));

        fake.settleSession(sessionFor('u1', { locale: 'klingon' }));
        await flush();

        expect(seen).toEqual([{ userId: 'u1', value: null }]);
    });

    it('covers an auth event arriving before the session read', async () => {
        const fake = fakeAuth();
        const seen: (Account | null)[] = [];
        accountLocale(fake.auth).watch((account) => seen.push(account));

        fake.fire(sessionFor('u1', { locale: 'vi' }));
        // The read resolves late, reporting a session that has been superseded;
        // passing it on would walk the locale back.
        fake.settleSession(sessionFor('u1', { locale: 'en' }));
        await flush();

        expect(seen).toEqual([{ userId: 'u1', value: 'vi' }]);
    });

    it('covers an auth event after the session read', async () => {
        const fake = fakeAuth();
        const seen: (Account | null)[] = [];
        accountLocale(fake.auth).watch((account) => seen.push(account));

        fake.settleSession(sessionFor('u1', { locale: 'en' }));
        await flush();
        fake.fire(sessionFor('u1', { locale: 'vi' }));

        expect(seen).toEqual([
            { userId: 'u1', value: 'en' },
            { userId: 'u1', value: 'vi' },
        ]);
    });

    it('covers a stopped watcher', async () => {
        const fake = fakeAuth();
        const seen: (Account | null)[] = [];
        const stop = accountLocale(fake.auth).watch((account) => seen.push(account));

        stop();
        fake.settleSession(sessionFor('u1', { locale: 'vi' }));
        await flush();

        expect(fake.isUnsubscribed()).toBe(true);
        expect(seen).toEqual([]);
    });

    it('covers an accepted write', async () => {
        const fake = fakeAuth();

        await accountLocale(fake.auth).save('vi');

        expect(fake.written).toEqual([{ locale: 'vi' }]);
    });

    it('covers a refused write', async () => {
        const fake = fakeAuth('offline');

        await expect(accountLocale(fake.auth).save('vi')).rejects.toThrow('offline');
    });
});
