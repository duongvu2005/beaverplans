import { describe, expect, it } from 'vitest';
import { isLocale, pickLocale } from './locale';

describe('isLocale', () => {
    /*
     * Testing strategy
     *
     * partition on value:
     *   a supported tag ('en'); a supported tag ('vi'); an unsupported
     *   language tag; a string that is not a tag; a non-string
     */

    it('covers a supported tag: en', () => {
        expect(isLocale('en')).toBe(true);
    });

    it('covers a supported tag: vi', () => {
        expect(isLocale('vi')).toBe(true);
    });

    it('covers an unsupported language tag', () => {
        expect(isLocale('fr')).toBe(false);
    });

    it('covers a string that is not a tag', () => {
        expect(isLocale('')).toBe(false);
        expect(isLocale('en-US')).toBe(false);
    });

    it('covers a non-string', () => {
        expect(isLocale(null)).toBe(false);
        expect(isLocale(undefined)).toBe(false);
        expect(isLocale(2)).toBe(false);
    });
});

describe('pickLocale', () => {
    /*
     * Testing strategy
     *
     * partition on the list:
     *   empty; one entry; several entries
     * partition on where the first supported tag sits:
     *   first; after unsupported ones; nowhere
     * partition on the matching tag's shape:
     *   bare primary subtag ('vi'); with a region ('vi-VN'); mixed case
     *   ('VI-vn'); a longer subtag that merely starts with a supported one
     *   ('vie')
     * partition on the language picked:
     *   en; vi
     */

    it('covers an empty list', () => {
        expect(pickLocale([])).toBe('en');
    });

    it('covers one entry, supported, bare primary subtag', () => {
        expect(pickLocale(['vi'])).toBe('vi');
    });

    it('covers one entry, supported, with a region', () => {
        expect(pickLocale(['vi-VN'])).toBe('vi');
    });

    it('covers one entry picking en', () => {
        expect(pickLocale(['en-US'])).toBe('en');
    });

    it('covers the first supported tag sitting after unsupported ones', () => {
        expect(pickLocale(['fr-FR', 'de', 'vi-VN'])).toBe('vi');
    });

    it('covers several entries with the supported one first', () => {
        expect(pickLocale(['en-GB', 'vi'])).toBe('en');
    });

    it('covers no supported tag anywhere', () => {
        expect(pickLocale(['fr-FR', 'de', 'ja'])).toBe('en');
    });

    it('covers mixed case', () => {
        expect(pickLocale(['VI-vn'])).toBe('vi');
    });

    it('covers a longer subtag that merely starts with a supported one', () => {
        expect(pickLocale(['vie'])).toBe('en');
        expect(pickLocale(['eng'])).toBe('en');
    });
});
