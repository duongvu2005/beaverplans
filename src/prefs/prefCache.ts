/**
 * This device's copy of a chosen preference. While someone is signed in the
 * account is the source of truth; this copy lets the first paint happen without
 * waiting for it. For a guest it is the only copy.
 */

/**
 * The localStorage key a named preference's choice is stored under.
 *
 * Exported because the build reads one of these before any of this code runs —
 * see the font preload plugin in vite.config.ts — and a second spelling of the
 * key would drift silently.
 *
 * @param name the preference's key segment, e.g. 'locale'
 * @returns the full key. Storage format: changing it forgets every device.
 */
export function prefKey(name: string): string {
    return `beaverplans:${name}`;
}

/** A preference change picked on this device that the account has not been told about. */
export type Unpushed<T> = {
    readonly userId: string;
    readonly value: T;
};

/** The device-side half of one preference. */
export type PrefCache<T> = {
    /**
     * The value this device last showed.
     *
     * @returns the cached value, or null when nothing readable is cached.
     *     Non-deterministic: reads localStorage.
     */
    read: () => T | null;
    /**
     * Remembers the value this device is showing.
     *
     * @param value the value now on screen. Nothing is remembered if storage
     *     refuses the write.
     */
    write: (value: T) => void;
    /**
     * The change still owed to an account.
     *
     * @returns the marked change, or null when none is marked or what is stored
     *     is not one this app wrote. Non-deterministic: reads localStorage.
     */
    unpushed: () => Unpushed<T> | null;
    /**
     * Marks a change as owed to an account, or clears the mark.
     *
     * @param unpushed the change still owed, or null once it has landed. Nothing
     *     is marked if storage refuses the write.
     */
    mark: (unpushed: Unpushed<T> | null) => void;
};

/**
 * A device cache for one preference.
 *
 * @param name the preference's key segment, e.g. 'locale'. Keys are
 *     `beaverplans:<name>` and `beaverplans:<name>:unpushed`; they are storage
 *     format, so changing one forgets every device's choice.
 * @param isValue narrows a value read back out of storage. Anything it rejects
 *     is treated as absent, so a value written by an older app, another tab, or
 *     a person editing storage by hand can never reach the screen.
 * @returns the four operations, over those two keys.
 */
export function prefCache<T extends string>(
    name: string,
    isValue: (value: unknown) => value is T,
): PrefCache<T> {
    const CHOICE_KEY = prefKey(name);
    const UNPUSHED_KEY = `${CHOICE_KEY}:unpushed`;

    return {
        read() {
            try {
                const value: unknown = localStorage.getItem(CHOICE_KEY);
                return isValue(value) ? value : null;
            } catch {
                // Safari in private mode throws on any localStorage access.
                return null;
            }
        },

        write(value) {
            try {
                localStorage.setItem(CHOICE_KEY, value);
            } catch {
                // Not being able to remember the choice is not a reason to refuse it.
            }
        },

        unpushed() {
            let raw: string | null;
            try {
                raw = localStorage.getItem(UNPUSHED_KEY);
            } catch {
                return null;
            }
            if (raw === null) return null;

            let parsed: unknown;
            try {
                parsed = JSON.parse(raw);
            } catch {
                return null;
            }
            if (typeof parsed !== 'object' || parsed === null) return null;
            const { userId, value } = parsed as Partial<Unpushed<T>>;
            if (typeof userId !== 'string' || !isValue(value)) return null;
            return { userId, value };
        },

        mark(unpushed) {
            try {
                if (unpushed === null) {
                    localStorage.removeItem(UNPUSHED_KEY);
                } else {
                    localStorage.setItem(UNPUSHED_KEY, JSON.stringify(unpushed));
                }
            } catch {
                // A lost mark costs a retry, not the choice itself — that is
                // already cached and already on screen.
            }
        },
    };
}
