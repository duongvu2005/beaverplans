import { useEffect, useRef, useState } from 'react';
import type { AuthChangeEvent, Session } from '@supabase/supabase-js';
import { supabase } from '@/storage/supabaseClient';
import { store } from '@/storage/instance';
import { cloudBackend } from '@/storage/instance';
import { isOffline } from '@/storage/online';
import { AuthError } from './authError';

export type AuthUser = {
    id: string;
    email: string | undefined;
    /** A display label, never undefined — usernameOf always has a fallback. */
    username: string;
};

/**
 * A display name for a session's user.
 *
 * Lives in account-writable `user_metadata`, which makes it a LABEL and not an
 * identity: not unique, not verified, not safe to key anything off.
 *
 * @param session any session, or null
 * @returns the stored username when it is a non-blank string; otherwise the
 *     local part of the email; otherwise 'you'. Never blank, so the chip always
 *     has something to render.
 */
function usernameOf(session: Session): string {
    const stored: unknown = session.user.user_metadata?.username;
    if (typeof stored === 'string' && stored.trim() !== '') return stored.trim();
    const local = session.user.email?.split('@')[0];
    if (local !== undefined && local !== '') return local;
    return 'you';
}

// Which user id (if any) is mid password-recovery. In localStorage rather than
// only React state because PASSWORD_RECOVERY fires once per session: after a
// refresh getSession() reports an ordinary signed-in session, and only this
// marker says it is still the one recovery was in progress for.
const RECOVERY_KEY = 'beaverplans.recoveringUserId';

const RECOVERY_TTL_MS = 60 * 60 * 1000; // 1 hour, roughly the emailed link's own life

type RecoveryMarker = {
    userId: string;
    expiresAt: number;
};

function readRecoveryMarker(): string | null {
    let raw: string | null;
    try {
        raw = localStorage.getItem(RECOVERY_KEY);
    } catch {
        return null;
    }
    if (raw === null) return null;

    let marker: RecoveryMarker;
    try {
        marker = JSON.parse(raw) as RecoveryMarker;
    } catch {
        writeRecoveryMarker(undefined); // corrupt value — drop it rather than loop on it
        return null;
    }
    if (Date.now() >= marker.expiresAt) {
        writeRecoveryMarker(undefined);
        return null;
    }
    return marker.userId;
}

function writeRecoveryMarker(userId: string | undefined): void {
    try {
        if (userId === undefined) {
            localStorage.removeItem(RECOVERY_KEY);
        } else {
            const marker: RecoveryMarker = { userId, expiresAt: Date.now() + RECOVERY_TTL_MS };
            localStorage.setItem(RECOVERY_KEY, JSON.stringify(marker));
        }
    } catch {
        // A lost marker means a refresh mid-recovery lands in the normal app
        // instead of the new-password screen.
    }
}

// The only resend failures that say something about the REQUEST rather than
// about the address. Everything else is swallowed — see resendConfirmation.
const REPORTABLE_RESEND_ERRORS = new Set([
    'over_email_send_rate_limit',
    'over_request_rate_limit',
    'captcha_failed',
]);

type UseAuthResult = {
    user: AuthUser | null;
    // True until the initial session check resolves. Gate the first render on
    // it, or a signed-in user's local guest data paints first.
    loading: boolean;
    // True while a password-recovery session is active — the reset-password
    // link was followed. App gates on it ahead of everything else.
    recovering: boolean;
    // Bumps each time the active backend actually switches; useWeeks reloads on it.
    epoch: number;
    signIn: (email: string, password: string, captchaToken: string) => Promise<void>;
    // Resolves true when sign-up left a live session (no confirmation needed),
    // false when it did not — which is also, indistinguishably, what an address
    // that already has a confirmed account returns.
    signUp: (
        email: string,
        password: string,
        username: string,
        captchaToken: string,
    ) => Promise<boolean>;
    /** display label only — no re-auth, no confirmation mail */
    updateUsername: (username: string) => Promise<void>;
    // Resolves whether or not anything was actually sent.
    resendConfirmation: (email: string, captchaToken: string) => Promise<void>;
    // Resolves when the confirmation mail is away, NOT when the address has
    // changed — that waits on the link being opened.
    updateEmail: (email: string) => Promise<void>;
    resetPassword: (email: string, captchaToken: string) => Promise<void>;
    updatePassword: (password: string) => Promise<void>;
    verifyPassword: (password: string, captchaToken: string) => Promise<boolean>;
    // Deletes the account and everything filed under it, then signs this
    // browser out. Nothing survives it.
    deleteAccount: () => Promise<void>;
    signOut: () => Promise<void>;
    // Signs out only once the account has everything this device did. False
    // means it did not: ask, then call signOut() to go ahead and lose it.
    signOutWhenSynced: () => Promise<boolean>;
    clearRecovering: () => void;
    cancelRecovery: () => Promise<void>;
};

export function useAuth(): UseAuthResult {
    const [user, setUser] = useState<AuthUser | null>(null);
    const [loading, setLoading] = useState(true);
    const [recovering, setRecovering] = useState(false);
    const [epoch, setEpoch] = useState(0);
    // The last user id seen, so the listener can tell "signed out" apart from
    // "a DIFFERENT account signed in with no sign-out in between" — the second
    // needs cloudBackend.reset(), or the new account sees the old one's weeks.
    const lastUserId = useRef<string | undefined>(undefined);

    useEffect(() => {
        // getSession() and onAuthStateChange's own initial event are both async
        // and neither is documented to beat the other, so whichever resolves
        // first does the one real seed and the other is a no-op.
        let seeded = false;
        let cancelled = false;

        function applySession(session: Session | null, event: AuthChangeEvent | undefined) {
            const nextUserId = session?.user.id;
            const switchedAccount =
                lastUserId.current !== undefined &&
                nextUserId !== undefined &&
                nextUserId !== lastUserId.current;
            // Signing out is not switchedAccount's business (nextUserId is
            // undefined), but it is the ONLY moment the previous user's feed and
            // pending push can be stopped when signOut() was not what caused it.
            const signedOut = lastUserId.current !== undefined && nextUserId === undefined;
            if (switchedAccount) {
                cloudBackend.reset();
            } else if (signedOut) {
                cloudBackend.disconnect();
            }
            // Whether the app is showing a different person's data than it was.
            // Gates the epoch bump, and only that. Weaker than switchedAccount
            // above: it also counts signing in and out (undefined <-> an id),
            // because the backend is a function of the id — none -> local, any
            // id -> cloud. A token refresh, which supabase-js does whenever a
            // tab regains focus, carries the same user and is not a switch.
            const switchedUser = nextUserId !== lastUserId.current;
            lastUserId.current = nextUserId;
            setUser(
                session === null
                    ? null
                    : {
                          id: session.user.id,
                          email: session.user.email,
                          username: usernameOf(session),
                      },
            );

            const marker = readRecoveryMarker();
            if (event === 'PASSWORD_RECOVERY' && nextUserId !== undefined) {
                writeRecoveryMarker(nextUserId);
                setRecovering(true);
            } else if (marker !== null && marker === nextUserId) {
                // A refresh mid-recovery: the event is not PASSWORD_RECOVERY
                // again, but the session is the one the marker was written for.
                setRecovering(true);
            } else if (marker !== null) {
                // The marker belongs to a session that is no longer current —
                // signed out, or a different account.
                writeRecoveryMarker(undefined);
                setRecovering(false);
            }

            store.useBackend(session === null ? 'local' : 'cloud');
            // Which account, not just which backend: signing in as somebody else
            // moves neither the backend nor, on its own, anything useWeeks could
            // notice. Same predicate as switchedUser below, on purpose.
            store.useSession(nextUserId);
            // Nothing needs reloading while the user is unchanged; remote edits
            // arrive through store.subscribe instead.
            if (switchedUser) setEpoch((n) => n + 1);
        }

        function seed(session: Session | null, event: AuthChangeEvent | undefined) {
            if (seeded) return;
            seeded = true;
            applySession(session, event);
            setLoading(false);
        }

        supabase.auth.getSession().then(({ data: { session } }) => {
            if (cancelled) return;
            seed(session, undefined);
        });

        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((event, session) => {
            if (!seeded) {
                seed(session, event);
                return;
            }
            applySession(session, event);
        });

        return () => {
            cancelled = true;
            subscription.unsubscribe();
        };
    }, []);

    async function signIn(email: string, password: string, captchaToken: string): Promise<void> {
        const { error } = await supabase.auth.signInWithPassword({
            email,
            password,
            options: { captchaToken },
        });
        if (error) throw new Error(error.message);
    }

    async function signUp(
        email: string,
        password: string,
        username: string,
        captchaToken: string,
    ): Promise<boolean> {
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            // `data` lands in user_metadata, where usernameOf reads it back.
            // Trimmed here so the stored value is canonical whatever was sent.
            options: { captchaToken, data: { username: username.trim() } },
        });
        if (error) throw new Error(error.message);
        return data.session !== null;
    }

    // The local write is optimistic: supabase-js does emit USER_UPDATED, this
    // just lands without waiting a round trip.
    async function updateUsername(username: string): Promise<void> {
        const next = username.trim();
        if (next === '') throw new AuthError('blank-username');
        const { error } = await supabase.auth.updateUser({ data: { username: next } });
        if (error) throw new Error(error.message);
        setUser((current) => (current === null ? null : { ...current, username: next }));
    }

    // Send the confirmation email again, for the signup whose link never arrived.
    //
    // Silent about whether there was anything to send: the "check your email"
    // screen is reached by a genuine new signup AND by an address that already
    // has a confirmed account, which supabase.auth.signUp shapes identically so
    // the form cannot enumerate accounts. Hence an allowlist rather than an
    // exclusion list — a code this app has never seen resolves quietly.
    async function resendConfirmation(email: string, captchaToken: string): Promise<void> {
        const { error } = await supabase.auth.resend({
            type: 'signup',
            email,
            options: { captchaToken, emailRedirectTo: window.location.origin },
        });
        if (error === null) return;
        if (error.code !== undefined && REPORTABLE_RESEND_ERRORS.has(error.code)) {
            throw new Error(error.message);
        }
    }

    // Ask to move the account to a different address.
    //
    // Nothing changes here: Supabase mails a confirmation link, and the account
    // keeps its old address until that link is opened. So this resolving means
    // "the mail is on its way", never "the address changed", and the screen
    // that calls it has to say so. A pending change is invisible to the client.
    async function updateEmail(email: string): Promise<void> {
        const next = email.trim();
        const { error } = await supabase.auth.updateUser(
            { email: next },
            { emailRedirectTo: window.location.origin },
        );
        if (error) throw new Error(error.message);
    }

    async function resetPassword(email: string, captchaToken: string): Promise<void> {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
            captchaToken,
            redirectTo: window.location.origin,
        });
        if (error) throw new Error(error.message);
    }

    async function updatePassword(password: string): Promise<void> {
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw new Error(error.message);
    }

    // Re-auth, for gating a change of password on the CURRENT one: a live
    // session only proves the browser was left signed in.
    //
    // Not destructive either way. A correct password re-issues a session for
    // the SAME user, so applySession sees no switch: nothing resets, nothing
    // bumps, no reload happens. A wrong one fails the request outright and
    // leaves the existing session untouched.
    //
    // The captcha token is required: this project enforces captcha on the
    // password grant, and a token-less call comes back captcha_failed.
    async function verifyPassword(password: string, captchaToken: string): Promise<boolean> {
        const email = user?.email;
        if (email === undefined) throw new AuthError('no-account');
        const { error } = await supabase.auth.signInWithPassword({
            email,
            password,
            options: { captchaToken },
        });
        if (error === null) return true;
        // Only a rejected password answers the question with `false`. Anything
        // else — offline, captcha, rate limit — is a failure to ASK it.
        if (error.code === 'invalid_credentials') return false;
        throw new Error(error.message);
    }

    // Erase the account itself, not just its weeks.
    //
    // The delete runs in a `security definer` Postgres function because Supabase
    // gives a browser no way to delete a user: the admin API needs the service
    // key. planner_weeks cascades off auth.users, so that one statement takes the
    // data with it — do NOT delete the weeks first, or a failure halfway leaves an
    // emptied account rather than an untouched one.
    //
    // scope: 'local' because the account the session names no longer exists, so
    // asking the server to revoke its token is a call that can only fail.
    async function deleteAccount(): Promise<void> {
        const { error } = await supabase.rpc('delete_own_account');
        if (error) throw new Error(error.message);
        cloudBackend.reset(); // also cancels any scheduled push — see reset()
        await supabase.auth.signOut({ scope: 'local' });
    }

    async function signOut(): Promise<void> {
        cloudBackend.reset(); // also cancels any scheduled push — see reset()
        // Not thrown: the safety-critical step (the cache reset above) already
        // happened, whether or not this call succeeds.
        try {
            await supabase.auth.signOut();
        } catch {
            // ignored — see above
        }
    }

    /**
     * Sign out, but not at the cost of work the account has not got.
     *
     * reset() clears this device's copy, so anything not yet sent dies with it.
     * Sending it first makes that safe in the ordinary case and detectable in
     * the rest.
     *
     * @returns true iff signed out. False means work is still owed and the
     *     caller has to ask — signOut() then goes ahead and loses it. Biased to
     *     false: it is asked twice, and either answer is enough to refuse.
     */
    async function signOutWhenSynced(): Promise<boolean> {
        if (!cloudBackend.hasUnpushedWork()) {
            await signOut();
            return true;
        }
        // Offline the write cannot succeed, and waiting for it to fail is ten
        // seconds of a Sign out that appears to do nothing at all.
        if (isOffline()) return false;
        if (!(await cloudBackend.flushNow())) return false;
        // Asked again, in the same unbroken stretch as the sign-out below —
        // signOut() calls reset() before its own first await. flushNow answered
        // for the instant it finished, and a pull landing between there and here
        // can leave work owed that its answer no longer covers.
        if (cloudBackend.hasUnpushedWork()) return false;
        await signOut();
        return true;
    }

    function clearRecovering(): void {
        writeRecoveryMarker(undefined);
        setRecovering(false);
    }

    // Opposite failure behaviour to signOut(), on purpose: clearing the recovery
    // marker on a sign-out that did NOT happen would land the user in their real
    // account on a live recovery session, password never replaced. scope:
    // 'local' clears this browser without a server round trip, so Cancel works
    // offline.
    async function cancelRecovery(): Promise<void> {
        cloudBackend.reset(); // also cancels any scheduled push — see reset()
        const { error } = await supabase.auth.signOut({ scope: 'local' });
        if (error) throw new Error(error.message);
        clearRecovering();
    }

    return {
        user,
        loading,
        recovering,
        epoch,
        signIn,
        signUp,
        updateUsername,
        resendConfirmation,
        updateEmail,
        resetPassword,
        updatePassword,
        verifyPassword,
        deleteAccount,
        signOut,
        signOutWhenSynced,
        clearRecovering,
        cancelRecovery,
    };
}
