/**
 * Getting a look's faces into the font cache before it goes on screen.
 *
 * fonts.css declares every face at `font-display: optional`, which is what keeps
 * a cold load from reflowing halfway through: a face that is not already cached
 * is passed over for the whole page load. That is right for a first paint and
 * wrong for a switch — flipping [data-font] on faces the browser has never
 * fetched would change nothing visible, and then change everything on the next
 * reload.
 *
 * So a switch waits: ask for the faces, and only re-point the tokens once they
 * are in the cache, where `optional` will take them.
 */

import type { FontPref } from './font';

/**
 * The families each look needs, at the weights index.css asks for. Mono is in
 * neither: both looks share it and it is already loaded.
 */
const FACES: Record<FontPref, readonly string[]> = {
    modern: ['400 1em "Be Vietnam Pro"', '500 1em "Be Vietnam Pro"', '600 1em "Be Vietnam Pro"'],
    classic: ['400 1em "Newsreader"', '500 1em "Fraunces"', '600 1em "Fraunces"'],
};

/**
 * Loads the faces a look needs.
 *
 * @param pref the look about to be shown
 * @returns a promise that settles once every face is in the cache, or once the
 *     browser has given up on one. Never rejects: a face that will not load is a
 *     reason to show the fallback, not to refuse the switch. Resolves
 *     immediately where the Font Loading API is missing, as in jsdom.
 *     Non-deterministic: touches the network and the font cache.
 */
export async function ensureFaces(pref: FontPref): Promise<void> {
    if (typeof document === 'undefined' || document.fonts === undefined) return;
    await Promise.allSettled(FACES[pref].map((face) => document.fonts.load(face)));
}
