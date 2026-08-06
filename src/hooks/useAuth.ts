import { useEffect, useRef, useState } from 'react';
import type { AuthChangeEvent, Session } from '@supabase/supabase-js';
import { supabase } from '../storage/supabaseClient';
import { store } from '../storage/instance';
import { cloudBackend } from '../storage/instance';

export type AuthUser = {
    id: string;
    email: string | undefined;
};

// Which user id (if any) is mid password-recovery, kept in localStorage
// rather than only React state: a page refresh during recovery re-runs this
// hook from scratch, and by then Supabase's PASSWORD_RECOVERY event has
// already fired and won't fire again for the same session — getSession()
// on the refreshed page just reports "there's a session", indistinguishable
// from an ordinary signed-in one. This marker is what lets a later run
// recognize the SAME session is still the one recovery was in progress for.
const RECOVERY_KEY = 'beaverplans.recoveringUserId';

// A little generous rather than exact — device clocks aren't perfectly
// trustworthy either — but roughly matches how long the emailed link itself
// stays valid, so someone who abandons the tab mid-recovery isn't stuck
// seeing the recovery screen on this device indefinitely.
const RECOVERY_TTL_MS = 60 * 60 * 1000; // 1 hour

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
        // Best-effort — a lost marker just means a refresh mid-recovery drops
        // back into the normal app instead of the new-password screen.
    }
}

type UseAuthResult = {
    user: AuthUser | null;
    // True until the initial session check resolves — gates the app's first
    // render so it never flashes local/guest data before a signed-in user's
    // real backend is known.
    loading: boolean;
    // True while a password-recovery session is active (the user followed a
    // reset-password email link) — App hard-gates on this ahead of everything
    // else, same as the old app did.
    recovering: boolean;
    // Bumps each time the active backend actually switches; useWeeks watches
    // this to know when to reload.
    epoch: number;
    signIn: (email: string, password: string, captchaToken: string) => Promise<void>;
    signUp: (email: string, password: string, captchaToken: string) => Promise<void>;
    resetPassword: (email: string, captchaToken: string) => Promise<void>;
    updatePassword: (password: string) => Promise<void>;
    verifyPassword: (password: string, captchaToken: string) => Promise<boolean>;
    signOut: () => Promise<void>;
    clearRecovering: () => void;
    cancelRecovery: () => Promise<void>;
};

export function useAuth(): UseAuthResult {
    const [user, setUser] = useState<AuthUser | null>(null);
    const [loading, setLoading] = useState(true);
    const [recovering, setRecovering] = useState(false);
    const [epoch, setEpoch] = useState(0);
    // Tracks the last user id seen, so the listener can tell "signed out"
    // apart from "a DIFFERENT account signed in without an explicit sign-out
    // in between" — the second case needs cloudBackend.reset() too, since
    // otherwise the new account could see the previous one's cached weeks.
    const lastUserId = useRef<string | undefined>(undefined);

    useEffect(() => {
        // getSession() and onAuthStateChange's own initial event are BOTH
        // async and neither is documented to reliably beat the other, so
        // don't let each apply the session independently — that's exactly
        // how "loading flips false" and "backend actually switches to cloud"
        // could land on different ticks, briefly rendering a signed-in
        // user's LOCAL guest data. Instead: whichever resolves first does
        // the one real seed; the other is a no-op.
        let seeded = false;
        let cancelled = false;

        function applySession(session: Session | null, event: AuthChangeEvent | undefined) {
            const nextUserId = session?.user.id;
            const switchedAccount =
                lastUserId.current !== undefined &&
                nextUserId !== undefined &&
                nextUserId !== lastUserId.current;
            if (switchedAccount) {
                cloudBackend.reset();
            }
            lastUserId.current = nextUserId;
            setUser(session === null ? null : { id: session.user.id, email: session.user.email });

            const marker = readRecoveryMarker();
            if (event === 'PASSWORD_RECOVERY' && nextUserId !== undefined) {
                writeRecoveryMarker(nextUserId);
                setRecovering(true);
            } else if (marker !== null && marker === nextUserId) {
                // Surviving a refresh mid-recovery: this event isn't
                // PASSWORD_RECOVERY again (it won't be), but the session is
                // still the one the marker was written for.
                setRecovering(true);
            } else if (marker !== null) {
                // The marker belongs to a session that's no longer current
                // (signed out, or a different account) — stale, drop it.
                writeRecoveryMarker(undefined);
                setRecovering(false);
            }

            store.useBackend(session === null ? 'local' : 'cloud');
            setEpoch((n) => n + 1);
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

    async function signUp(email: string, password: string, captchaToken: string): Promise<void> {
        const { error } = await supabase.auth.signUp({
            email,
            password,
            options: { captchaToken },
        });
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

    // Re-auth, for gating a change of password on the CURRENT one: knowing the
    // session is live only proves the browser was left signed in, which is the
    // thing an attacker at someone's open laptop already has.
    //
    // Signing in again is how that gets proven, and it is deliberately not
    // destructive either way. A correct password re-issues a session for the
    // SAME user, so applySession sees no account switch and resets nothing;
    // the reload its epoch bump triggers goes through CloudBackend.load, which
    // keeps unpushed local edits. A wrong password fails the request outright
    // and leaves the existing session untouched.
    //
    // Takes a captcha token because this project enforces captcha on the
    // password grant — checked against the live endpoint, which rejects a
    // token-less call with captcha_failed, rather than assumed from the fact
    // that signIn passes one.
    async function verifyPassword(password: string, captchaToken: string): Promise<boolean> {
        const email = user?.email;
        if (email === undefined) throw new Error('No signed-in account to confirm.');
        const { error } = await supabase.auth.signInWithPassword({
            email,
            password,
            options: { captchaToken },
        });
        if (error === null) return true;
        // Only a rejected password answers the question with `false`. Anything
        // else — offline, captcha, rate limit — is a failure to ASK it, and
        // reporting that as "wrong password" would send someone off changing a
        // password that was never the problem.
        if (error.code === 'invalid_credentials') return false;
        throw new Error(error.message);
    }

    async function signOut(): Promise<void> {
        cloudBackend.reset(); // also cancels any scheduled push — see reset()
        // Best-effort, deliberately not thrown: the safety-critical step
        // (the cache reset above) already happened regardless of whether
        // this network call succeeds.
        try {
            await supabase.auth.signOut();
        } catch {
            // ignored — see above
        }
    }

    function clearRecovering(): void {
        writeRecoveryMarker(undefined);
        setRecovering(false);
    }

    // Cancel, specifically — distinct from signOut() because the two need
    // opposite failure behavior. signOut() must never block on the network
    // (there's no state left to protect once you're leaving anyway), but
    // clearing the recovery marker on a signOut that DIDN'T actually happen
    // would be wrong: the recovery session could still be live, and dropping
    // the gate would land the user in their real account having never set a
    // new password — the exact thing RecoveryScreen exists to prevent.
    // scope: 'local' clears the session on this device/browser only, without
    // calling out to revoke it server-side, so this doesn't need network
    // access to succeed — Cancel should work offline.
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
        resetPassword,
        updatePassword,
        verifyPassword,
        signOut,
        clearRecovering,
        cancelRecovery,
    };
}
