import { afterEach, describe, expect, it, vi } from 'vitest';
import { LOOK_FACES, SHARED_FACES, pickLookScript } from './preloadScript';

// The key the built page reads. Spelled out rather than imported, on purpose:
// it is a persistence contract shared with every device that already wrote it.
const KEY = 'beaverplans:font';

/** Runs the generated boot script against this document, as a page load would. */
function boot(): void {
    new Function(pickLookScript())();
}

afterEach(() => {
    localStorage.clear();
    document.head.innerHTML = '';
    document.documentElement.removeAttribute('data-font');
    vi.restoreAllMocks();
});

describe('pickLookScript', () => {
    /*
     * Testing strategy
     *
     * The script is generated as text and runs before any of this app's code,
     * so it is executed here rather than string-matched.
     *
     * partition on the stored look:
     *   nothing stored; each supported look; one no version of this app wrote
     * partition on localStorage:
     *   working; throwing on read
     */

    it('covers nothing stored: the default look', () => {
        boot();

        expect(document.documentElement.dataset.font).toBe('modern');
    });

    it('covers the non-default look stored', () => {
        localStorage.setItem(KEY, 'classic');

        boot();

        expect(document.documentElement.dataset.font).toBe('classic');
    });

    it('covers the default look stored explicitly', () => {
        localStorage.setItem(KEY, 'modern');

        boot();

        expect(document.documentElement.dataset.font).toBe('modern');
    });

    it('covers a look no version of this app ever wrote', () => {
        localStorage.setItem(KEY, 'gothic');

        boot();

        expect(document.documentElement.dataset.font).toBe('modern');
    });

    it('covers localStorage throwing on read', () => {
        vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
            throw new Error('denied');
        });

        expect(() => boot()).not.toThrow();
        expect(document.documentElement.dataset.font).toBe('modern');
    });

    // Every face of every look is preloaded by a static tag in the head, so the
    // script has nothing to fetch. If it starts injecting again, the reason for
    // preloading both looks has been lost somewhere.
    it('covers the script injecting nothing', () => {
        localStorage.setItem(KEY, 'classic');

        boot();

        expect(document.head.querySelectorAll('link')).toHaveLength(0);
    });
});

describe('the face patterns', () => {
    /*
     * Testing strategy
     *
     * partition on the file: each look's families; the shared family; a subset
     * neither look preloads
     */

    const hashed = (stem: string) => `assets/${stem}-normal-Ab3dEf12.woff2`;

    it('covers each look claiming its own families', () => {
        expect(LOOK_FACES.modern.test(hashed('be-vietnam-pro-latin-400'))).toBe(true);
        expect(LOOK_FACES.modern.test(hashed('be-vietnam-pro-vietnamese-600'))).toBe(true);
        expect(LOOK_FACES.classic.test(hashed('fraunces-latin-500'))).toBe(true);
        expect(LOOK_FACES.classic.test(hashed('newsreader-vietnamese-400'))).toBe(true);
    });

    it('covers no look claiming a weight nothing ships', () => {
        expect(LOOK_FACES.modern.test(hashed('be-vietnam-pro-latin-700'))).toBe(false);
        expect(LOOK_FACES.classic.test(hashed('newsreader-latin-700'))).toBe(false);
    });

    it('covers the looks not claiming each other', () => {
        expect(LOOK_FACES.modern.test(hashed('fraunces-latin-500'))).toBe(false);
        expect(LOOK_FACES.classic.test(hashed('be-vietnam-pro-latin-400'))).toBe(false);
    });

    it('covers mono being shared, for the cuts that are not inlined', () => {
        expect(SHARED_FACES.test(hashed('jetbrains-mono-latin-400'))).toBe(true);
        // These ship as data URIs in the CSS, so a preload would be a second copy.
        expect(SHARED_FACES.test(hashed('jetbrains-mono-vietnamese-400'))).toBe(false);
        expect(SHARED_FACES.test(hashed('jetbrains-mono-cyrillic-400'))).toBe(false);
    });

    // latin-ext is carried at only the weights user-authored text can reach:
    // display at --w-title (600 Modern / 500 Classic) and the literal 600 of a
    // dialog heading, sans at --w-row (400), mono at 400. Any other weight is
    // bytes nobody can see, so a widened pattern should fail here.
    it('covers latin-ext being claimed only at the weights user text reaches', () => {
        expect(LOOK_FACES.modern.test(hashed('be-vietnam-pro-latin-ext-400'))).toBe(true);
        expect(LOOK_FACES.modern.test(hashed('be-vietnam-pro-latin-ext-600'))).toBe(true);
        expect(LOOK_FACES.modern.test(hashed('be-vietnam-pro-latin-ext-500'))).toBe(false);

        expect(LOOK_FACES.classic.test(hashed('fraunces-latin-ext-500'))).toBe(true);
        expect(LOOK_FACES.classic.test(hashed('fraunces-latin-ext-600'))).toBe(true);
        expect(LOOK_FACES.classic.test(hashed('fraunces-latin-ext-400'))).toBe(false);

        expect(LOOK_FACES.classic.test(hashed('newsreader-latin-ext-400'))).toBe(true);
        expect(LOOK_FACES.classic.test(hashed('newsreader-latin-ext-600'))).toBe(false);

        expect(SHARED_FACES.test(hashed('jetbrains-mono-latin-ext-400'))).toBe(true);
        expect(SHARED_FACES.test(hashed('jetbrains-mono-latin-ext-500'))).toBe(false);
    });
});
