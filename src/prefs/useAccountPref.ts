import { useCallback, useEffect, useRef, useState } from 'react';
import type { AccountPref } from './accountPref';
import type { PrefCache } from './prefCache';

type UseAccountPrefOptions<T extends string> = {
    /**
     * Where the preference lives for a signed-in person. Omitted, the choice is
     * this device's alone — a guest, or a test wanting a fixed value.
     */
    account?: AccountPref<T>;
    /** This device's copy. Must be stable across renders. */
    cache: PrefCache<T>;
    /** What to show when this device has nothing cached. */
    initial: () => T;
};

/**
 * One preference that follows the ACCOUNT, cached on the device.
 *
 * Two places can say what the value is, and the order between them is the whole
 * of this hook's job:
 *
 * - the device's cache decides the first paint, because waiting on the network
 *   to know what to render would mean rendering nothing;
 * - the account overrules it as soon as it answers, and the cache is rewritten
 *   to match, so this device agrees with every other one the next time it starts;
 * - a change that could not reach the account is marked, and wins over the
 *   account until it does — otherwise a choice made offline would be walked back
 *   by the next token refresh, silently.
 *
 * @param options the account link (optional), the device cache, and a fallback
 *     for when nothing is cached
 * @returns the value to show, and a setter that applies it here and pushes it to
 *     the account when there is one. Non-deterministic on first render: reads
 *     the cache.
 */
export function useAccountPref<T extends string>({
    account,
    cache,
    initial,
}: UseAccountPrefOptions<T>): { value: T; choose: (next: T) => void } {
    const [value, setValue] = useState<T>(() => cache.read() ?? initial());
    // The account is watched by a callback registered once, which would otherwise
    // close over the value as it was at mount.
    const showing = useRef(value);
    const signedInAs = useRef<string | undefined>(undefined);

    useEffect(() => {
        showing.current = value;
    }, [value]);

    useEffect(() => {
        cache.write(value);
    }, [cache, value]);

    const push = useCallback(
        async (userId: string, next: T): Promise<void> => {
            if (account === undefined) return;
            cache.mark({ userId, value: next });
            try {
                await account.save(next);
                cache.mark(null);
            } catch {
                // Left marked, and retried on the next auth event — a token
                // refresh, a tab regaining focus, or the next start.
            }
        },
        [account, cache],
    );

    useEffect(() => {
        if (account === undefined) return;

        return account.watch((current) => {
            if (current === null) {
                signedInAs.current = undefined;
                return; // a guest has no account to consult; the cache is the truth
            }
            signedInAs.current = current.userId;

            const owed = cache.unpushed();
            if (owed !== null && owed.userId !== current.userId) {
                // Owed to an account nobody is signed into here: it can never be
                // pushed, and pushing it at whoever IS signed in would change a
                // preference its owner never touched.
                cache.mark(null);
            } else if (owed !== null && owed.value !== current.value) {
                setValue(owed.value);
                void push(current.userId, owed.value);
                return;
            } else if (owed !== null) {
                cache.mark(null); // the account already agrees: the write landed
            }

            if (current.value === null) {
                // An account that has never had one is seeded from what its
                // owner is already looking at, rather than left for the next
                // device to guess again.
                void push(current.userId, showing.current);
            } else {
                setValue(current.value);
            }
        });
    }, [account, cache, push]);

    const choose = useCallback(
        (next: T) => {
            setValue(next);
            const userId = signedInAs.current;
            if (userId !== undefined) void push(userId, next);
        },
        [push],
    );

    return { value, choose };
}
