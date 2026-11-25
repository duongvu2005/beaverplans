/**
 * The account's copy of the guide preference, kept in Supabase's
 * `user_metadata` beside the username and the language. Stored as a boolean;
 * the app speaks `GuidePref`, and this file is the only place the two spellings
 * meet.
 *
 * The auth client is injected, so tests here run against a fake. The structural
 * types below repeat `accountLocale`'s rather than sharing them.
 */

import type { GuidePref } from './useGuidePref';

/** snake_case: a database value, spelled like `planner_weeks.week_start`. */
const KEY = 'guide_enabled';

/** What a signed-in account says about the guide. */
export type Account = {
    readonly userId: string;
    /** null when the account has never had a preference stored on it. */
    readonly pref: GuidePref | null;
};

/** The account side of the guide preference, as useGuidePref needs it. */
export type AccountGuide = {
    /**
     * Reports the signed-in account, now and on every later change of session —
     * null while signed out.
     *
     * @param onAccount called with each account seen. Called at least once,
     *     once the current session is known.
     * @returns a function that stops the reporting.
     */
    watch: (onAccount: (account: Account | null) => void) => () => void;
    /**
     * Stores a preference on the signed-in account.
     *
     * @param pref the preference to store
     * @throws if the write does not land — offline, or no session.
     */
    save: (pref: GuidePref) => Promise<void>;
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

function accountOf(session: SessionLike | null): Account | null {
    if (session === null) return null;
    const stored: unknown = session.user.user_metadata?.[KEY];
    // Anything but a boolean counts as never answered.
    if (typeof stored !== 'boolean') return { userId: session.user.id, pref: null };
    return { userId: session.user.id, pref: stored ? 'yes' : 'no' };
}

/**
 * The account's guide preference, over a supabase-js auth client.
 *
 * @param auth an auth client for the project the app signs into
 * @returns a watcher and a writer for the signed-in account's preference.
 *     Non-deterministic: both talk to the network.
 */
export function accountGuide(auth: AuthClient): AccountGuide {
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

        async save(pref) {
            // `data` merges into user_metadata, leaving username and locale alone.
            const { error } = await auth.updateUser({ data: { [KEY]: pref === 'yes' } });
            if (error) throw new Error(error.message);
        },
    };
}
