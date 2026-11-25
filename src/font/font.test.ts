import { describe, expect, it } from 'vitest';
import { DEFAULT_FONT, FONTS, isFontPref } from './font';

describe('font', () => {
    /*
     * Testing strategy
     *
     * partition on the value:
     *   each supported look; a string no version of this app ever wrote;
     *   a non-string; null; undefined
     */

    it('covers every supported look', () => {
        for (const pref of FONTS) {
            expect(isFontPref(pref)).toBe(true);
        }
    });

    it('covers a string no version of this app ever wrote', () => {
        expect(isFontPref('serif')).toBe(false);
        expect(isFontPref('')).toBe(false);
    });

    it('covers values that are not strings', () => {
        expect(isFontPref(null)).toBe(false);
        expect(isFontPref(undefined)).toBe(false);
        expect(isFontPref(1)).toBe(false);
        expect(isFontPref({ pref: 'modern' })).toBe(false);
    });

    it('covers the default being one of the offered looks', () => {
        expect(FONTS).toContain(DEFAULT_FONT);
    });

    // The looks are a persistence contract: they are written into localStorage
    // and into user_metadata, so renaming one strands every device and account
    // that already stored it.
    it('covers the stored names', () => {
        expect(FONTS).toEqual(['modern', 'classic']);
    });
});
