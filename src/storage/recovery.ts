/**
 * Getting someone's plan back out after the app has crashed.
 *
 * Parses nothing it hands back: the ordinary export path (exportData.ts) builds
 * its envelope from live Weeks, which a crash on a corrupt stored shape would
 * fail a second time. This hands back the stored bytes as they are.
 */

import { STORAGE_KEY } from './localBackend';
import { CURRENT_STORAGE_KEY } from './cloudBackend';

function readKey(key: string): string | null {
    try {
        return localStorage.getItem(key);
    } catch {
        // Private mode, or storage blocked outright.
        return null;
    }
}

/**
 * Whether stored text is worth handing back at all.
 *
 * @param text any stored value, or null when the key is absent
 * @returns false only when text is definitely an empty plan. Unparseable text
 *     counts as content: bytes nothing can read are exactly what this path
 *     exists to rescue, and judging them would be the parse the module refuses.
 */
function holdsWork(text: string | null): boolean {
    if (text === null) return false;
    try {
        const parsed = JSON.parse(text) as { weeks?: unknown };
        return !Array.isArray(parsed.weeks) || parsed.weeks.length > 0;
    } catch {
        return true;
    }
}

/**
 * The stored plan, exactly as written.
 *
 * A signed-in user's work is under the cloud copy's key and a guest's is under
 * the local backend's, and a crash says nothing about which they were — so both
 * are read and whichever holds work wins, the signed-in copy first.
 *
 * @returns the raw text of that copy, or null if neither key holds anything and
 *     storage cannot be read at all. Never throws: it runs on a path that exists
 *     because something else already did.
 */
export function readStoredText(): string | null {
    const signedIn = readKey(CURRENT_STORAGE_KEY);
    const guest = readKey(STORAGE_KEY);
    if (holdsWork(signedIn)) return signedIn;
    if (holdsWork(guest)) return guest;
    return signedIn ?? guest;
}

/**
 * A filename for a copy taken after a crash.
 *
 * @param now the instant the copy was taken.
 * @returns `beaverplans-recovery-YYYY-MM-DD.json`, dated by `now` in LOCAL time.
 *     Named apart from an ordinary export: the contents are whatever was on the
 *     device, not a validated envelope.
 */
export function recoveryFilename(now: Date): string {
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `beaverplans-recovery-${year}-${month}-${day}.json`;
}
