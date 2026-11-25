/**
 * What the build needs to know about the two looks.
 *
 * Lives here rather than in vite.config.ts because "Classic means Fraunces and
 * Newsreader" is a fact about the looks, not about the bundler — and because
 * nothing under vite.config.ts is reachable from a test.
 */

import { DEFAULT_FONT, FONTS, type FontPref } from './font.js';
import { prefKey } from '../prefs/prefCache.js';

/**
 * Faces belonging to each look, and the ones both share.
 *
 * Matched against filenames rather than listed by hand, because a build content-
 * hashes them. Mono is shared by both looks and is unconditional. latin and
 * vietnamese ship at every weight; latin-ext ships only at the weights
 * user-authored text can reach.
 *
 * font-display stays optional for these, so they are preloaded rather than
 * fetched on demand — a face that arrives late is one optional refuses.
 */
export const LOOK_FACES: Record<FontPref, RegExp> = {
    modern: /be-vietnam-pro-(?:(?:latin|vietnamese)-(?:400|500|600)|latin-ext-(?:400|600))-normal-[^.]*\.woff2$/,
    classic:
        /(?:fraunces-(?:(?:latin|vietnamese)-(?:400|500|600)|latin-ext-(?:500|600))|newsreader-(?:(?:latin|vietnamese)-(?:400|500|600)|latin-ext-400))-normal-[^.]*\.woff2$/,
};

// JetBrains Mono's vietnamese and cyrillic-ext subsets sit under Vite's inline
// limit and ship as data URIs in the CSS, so they arrive with the stylesheet and
// never race. latin is over it at both weights; latin-ext only at 400.
export const SHARED_FACES =
    /jetbrains-mono-(?:latin-(?:400|500)|latin-ext-400)-normal-[^.]*\.woff2$/;

/**
 * Whether a face pattern claims a file, under either naming scheme.
 *
 * @param pattern one of the patterns above, which expect a BUILT name
 * @param file a filename or URL, built (content-hashed) or straight out of
 *     fonts.css (not hashed, as the dev server serves them)
 * @returns true iff the pattern claims that face
 */
export function claimsFace(pattern: RegExp, file: string): boolean {
    return pattern.test(file) || pattern.test(file.replace(/\.woff2$/, '-00000000.woff2'));
}

/**
 * The inline head script: applies the chosen look before the first paint.
 *
 * Only the attribute — every face of every look is preloaded by a static tag,
 * so there is nothing for this to fetch. It exists because `data-font` has to be
 * on <html> before the first paint or a Classic visitor sees a frame of Modern,
 * and no <link> or attribute written into the bundle can read a preference.
 */
export function pickLookScript(): string {
    // Hand-minified rather than run through a bundler: it is inlined into every
    // page's <head>, so its own bytes are the thing being paid for.
    return [
        '(function(){var L=' + JSON.stringify(FONTS) + ',p;',
        'try{p=localStorage.getItem(' + JSON.stringify(prefKey('font')) + ')}catch(e){}',
        'if(L.indexOf(p)<0)p=' + JSON.stringify(DEFAULT_FONT) + ';',
        'document.documentElement.dataset.font=p})();',
    ].join('');
}
