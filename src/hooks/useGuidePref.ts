import { useCallback, useEffect, useRef, useState } from 'react';
import type { AccountGuide } from './accountGuide';

/** Whether the onboarding guide is wanted at all. */
export type GuidePref = 'yes' | 'no';

const KEY = 'beaverplans:guide';

function cached(): GuidePref | null {
    try {
        const value = localStorage.getItem(KEY);
        return value === 'yes' || value === 'no' ? value : null;
    } catch {
        // Safari in private mode throws on any localStorage access.
        return null;
    }
}

function cache(pref: GuidePref): void {
    try {
        localStorage.setItem(KEY, pref);
    } catch {
        // The choice still holds for this session; only the memory of it is lost.
    }
}

/**
 * The guide preference and a setter, resolved in three steps: the device cache
 * paints first, the account overrules it and the cache is rewritten to match,
 * and an account holding nothing reads as 'yes' without being written to. A
 * write that cannot land is dropped rather than retried.
 *
 * @param account where the preference lives for a signed-in person. Must be
 *     made once by the caller, or the watch is torn down on every render.
 * @returns the preference to show, and a setter that tells the account too.
 *     Non-deterministic: reads localStorage, then the network.
 */
export function useGuidePref(account: AccountGuide) {
    const [pref, setPref] = useState<GuidePref>(() => cached() ?? 'yes');
    const signedInAs = useRef<string | undefined>(undefined);

    useEffect(() => {
        cache(pref);
    }, [pref]);

    const push = useCallback(
        (next: GuidePref) => {
            account.save(next).catch(() => {
                // Dropped on purpose; caught so it is not also an unhandled rejection.
            });
        },
        [account],
    );

    useEffect(() => {
        return account.watch((current) => {
            if (current === null) {
                signedInAs.current = undefined;
                return; // a guest has no account to consult; the cache is the truth
            }
            signedInAs.current = current.userId;
            // Unanswered reads as 'yes', never as what was already on screen —
            // that is what stops a second account inheriting the first's answer.
            setPref(current.pref ?? 'yes');
        });
    }, [account]);

    const choose = useCallback(
        (next: GuidePref) => {
            setPref(next);
            if (signedInAs.current !== undefined) push(next);
        },
        [push],
    );

    return { pref, setPref: choose };
}
