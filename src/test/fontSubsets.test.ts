/// <reference types="node" />
// Checks that every character the app can render arrives in the face it is meant
// to be drawn in, by reading fonts.css off disk and importing the real preload
// patterns rather than restating either here.
//
// The bug this exists to catch is quiet: a face can be declared, downloadable
// and correct, and still never reach the screen, because a LATER @font-face in
// the same family also claims the character and that one is the one nothing
// preloads. Nothing type-checks the interaction between subset declaration
// order, the preload patterns and Vite's inline limit, and the symptom is a few
// glyphs in the system fallback that only a Vietnamese reader would notice.

import { readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { FONTS, type FontPref } from '@/font/font';
import { LOOK_FACES, SHARED_FACES, claimsFace } from '@/font/preloadScript';

// Vite inlines an asset below this as a data URI, so it ships inside the
// stylesheet and cannot lose the font-display: optional race. Vite's default;
// vite.config.ts does not override it.
const INLINE_LIMIT = 4096;

const fontsCss = readFileSync(resolve('src/fonts.css'), 'utf8');

type Face = {
    readonly family: string;
    readonly weight: string;
    /** The woff2 path as fonts.css names it, which is what the patterns match. */
    readonly file: string;
    readonly covers: (codePoint: number) => boolean;
};

function parseRanges(spec: string): (cp: number) => boolean {
    const ranges = spec.split(',').map((part) => {
        const [lo, hi] = part.trim().replace(/^U\+/i, '').split('-');
        const low = parseInt(lo ?? '', 16);
        return { low, high: hi === undefined ? low : parseInt(hi, 16) };
    });
    return (cp) => ranges.some(({ low, high }) => cp >= low && cp <= high);
}

/** Every @font-face in fonts.css, in declaration order — which is what decides ties. */
const FACES: readonly Face[] = [...fontsCss.matchAll(/@font-face\s*\{([^}]*)\}/g)].map((block) => {
    const body = block[1] ?? '';
    return {
        family: /font-family:\s*'([^']+)'/.exec(body)?.[1] ?? '',
        weight: /font-weight:\s*(\d+)/.exec(body)?.[1] ?? '',
        file: /url\(([^)]*\.woff2)\)/.exec(body)?.[1] ?? '',
        covers: parseRanges(
            (/unicode-range:\s*([^;]+);/.exec(body)?.[1] ?? '').replace(/\s+/g, ' '),
        ),
    };
});

function isInlined(file: string): boolean {
    try {
        return statSync(resolve('node_modules', file)).size < INLINE_LIMIT;
    } catch {
        return false;
    }
}

/** Whether a face actually reaches the browser before first paint, in this look. */
function arrives(look: FontPref, file: string): boolean {
    return claimsFace(LOOK_FACES[look], file) || claimsFace(SHARED_FACES, file) || isInlined(file);
}

/** The families a look draws in — derived, so adding a look needs no edit here. */
function familiesOf(look: FontPref): readonly string[] {
    return [
        ...new Set(
            FACES.filter(
                (f) => claimsFace(LOOK_FACES[look], f.file) || claimsFace(SHARED_FACES, f.file),
            ).map((f) => f.family),
        ),
    ];
}

/**
 * The face that actually paints a character, per CSS Fonts: among the faces of
 * one family and weight whose unicode-range covers it, the LAST declared wins.
 */
function winnerFor(codePoint: number, family: string, weight: string): Face | undefined {
    return FACES.filter((f) => f.family === family && f.weight === weight)
        .filter((f) => f.covers(codePoint))
        .at(-1);
}

/** Every character either catalog can put on screen. */
function catalogChars(): ReadonlySet<string> {
    const chars = new Set<string>();
    for (const name of ['en', 'vi']) {
        const source = readFileSync(resolve(`src/i18n/${name}.ts`), 'utf8');
        // String literals only: identifiers and comments are not rendered.
        for (const literal of source.matchAll(/'([^'\\]*)'|`([^`\\]*)`/g)) {
            for (const ch of literal[1] ?? literal[2] ?? '') chars.add(ch);
        }
    }
    return chars;
}

describe('font subsets', () => {
    /*
     * Testing strategy
     *
     * partition on the character: plain ASCII; covered by one subset only;
     *   covered by two subsets of the same family
     * partition on the look: each one
     * partition on the winning face: preloaded for that look; shared; inlined
     *   under Vite's limit; none of those — the failure this file exists for
     */

    it.each(FONTS)('covers every catalog character arriving in the %s look', (look) => {
        const unreachable: string[] = [];

        for (const ch of catalogChars()) {
            const cp = ch.codePointAt(0);
            if (cp === undefined || cp < 0x20) continue;
            for (const family of familiesOf(look)) {
                const weights = new Set(
                    FACES.filter((f) => f.family === family).map((f) => f.weight),
                );
                for (const weight of weights) {
                    const face = winnerFor(cp, family, weight);
                    if (face === undefined) continue; // no cut claims it; a fallback is honest
                    if (arrives(look, face.file)) continue;
                    unreachable.push(
                        `U+${cp.toString(16).toUpperCase().padStart(4, '0')} ${JSON.stringify(ch)} → ${face.family} ${face.weight} → ${face.file.split('/').pop() ?? ''}`,
                    );
                }
            }
        }

        expect([...new Set(unreachable)].sort()).toEqual([]);
    });

    it('covers the faces being parsed at all', () => {
        // A shape change in fonts.css that this file cannot read would make the
        // assertions above vacuously pass.
        expect(FACES.length).toBeGreaterThan(0);
        expect(FACES.every((f) => f.file !== '' && f.family !== '' && f.weight !== '')).toBe(true);
        for (const look of FONTS) expect(familiesOf(look).length).toBeGreaterThan(1);
    });
});
