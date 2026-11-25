/**
 * The account's copy of a chosen preference.
 *
 * Stored the way the username is: in Supabase's `user_metadata`, so there is no
 * table behind it, and it rides along in the session — reading it is free, and a
 * change made elsewhere arrives whenever the session is next refreshed.
 *
 * The auth client is injected, so this folder keeps no dependency on `storage/`
 * and tests here run against a fake. `main.tsx` hands in the real one.
 */

/** What a signed-in account says about one preference. */
export type Account<T> = {
    readonly userId: string;
    /** null when the account has never had this preference stored on it. */
    readonly value: T | null;
};

/** The account side of one preference, as useAccountPref needs it. */
export type AccountPref<T> = {
    /**
     * Reports the signed-in account, now and on every later change of session —
     * null while signed out.
     *
     * @param onAccount called with each account seen. Called at least once, once
     *     the current session is known.
     * @returns a function that stops the reporting.
     */
    watch: (onAccount: (account: Account<T> | null) => void) => () => void;
    /**
     * Stores a value on the signed-in account.
     *
     * @param value the value to store
     * @throws if the write does not land — offline, or no session.
     */
    save: (value: T) => Promise<void>;
};

/** The part of a supabase-js session this reads. */
export type SessionLike = {
    readonly user: {
        readonly id: string;
        readonly user_metadata?: Record<string, unknown>;
    };
};

/** The slice of supabase-js's auth client this drives. */
export type AuthClient = {
    getSession: () => Promise<{ data: { session: SessionLike | null } }>;
    onAuthStateChange: (callback: (event: string, session: SessionLike | null) => void) => {
        data: { subscription: { unsubscribe: () => void } };
    };
    updateUser: (attributes: {
        data: Record<string, unknown>;
    }) => Promise<{ error: { message: string } | null }>;
};

/**
 * One preference, over a supabase-js auth client.
 *
 * @param auth an auth client for the project the app signs into
 * @param key the `user_metadata` field to keep it in. Writes merge into that
 *     object, so the fields beside it are left alone.
 * @param isValue narrows what comes back off the session. Anything it rejects
 *     reads as "never stored", so a field written by an older app or by hand
 *     cannot reach the screen.
 * @returns a watcher and a writer. Non-deterministic: both talk to the network.
 */
export function accountPref<T>(
    auth: AuthClient,
    key: string,
    isValue: (value: unknown) => value is T,
): AccountPref<T> {
    function accountOf(session: SessionLike | null): Account<T> | null {
        if (session === null) return null;
        const stored: unknown = session.user.user_metadata?.[key];
        return { userId: session.user.id, value: isValue(stored) ? stored : null };
    }

    return {
        watch(onAccount) {
            // Both are asked, since neither is documented to answer first. Once
            // an auth event is heard the session read is stale, so it is dropped
            // rather than allowed to report an older session over a newer one.
            let heard = false;
            let stopped = false;

            void auth.getSession().then(({ data: { session } }) => {
                if (stopped || heard) return;
                onAccount(accountOf(session));
            });

            const {
                data: { subscription },
            } = auth.onAuthStateChange((_event, session) => {
                heard = true;
                if (stopped) return;
                onAccount(accountOf(session));
            });

            return () => {
                stopped = true;
                subscription.unsubscribe();
            };
        },

        async save(value) {
            // `data` merges into user_metadata, leaving the username and every
            // other preference beside it alone.
            const { error } = await auth.updateUser({ data: { [key]: value } });
            if (error) throw new Error(error.message);
        },
    };
}
