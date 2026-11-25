import { describe, it, expect, afterEach } from 'vitest';
import { readStoredText, recoveryFilename } from './recovery';
import { STORAGE_KEY } from './localBackend';
import { CURRENT_STORAGE_KEY } from './cloudBackend';

describe('readStoredText', () => {
    /*
     * Testing strategy
     *     partition on what is stored: nothing | valid JSON | text that is not
     *         JSON at all
     *     partition on localStorage itself: available | throwing (private mode,
     *         or storage blocked)
     *     partition on which copy holds the work: the signed-in one | the guest
     *         one | neither
     *
     * The two copies are read because a signed-in user's work is NOT under the
     * guest key, and a crash screen offering an empty file is worse than one
     * offering no file.
     *
     * The not-JSON case is the point of the module rather than an edge: nothing
     * here parses.
     */
    const realStorage = globalThis.localStorage;

    afterEach(() => {
        Object.defineProperty(globalThis, 'localStorage', {
            configurable: true,
            value: realStorage,
        });
    });

    function stubStorage(getItem: () => string | null) {
        Object.defineProperty(globalThis, 'localStorage', {
            configurable: true,
            value: { getItem },
        });
    }

    it('covers nothing stored', () => {
        stubStorage(() => null);
        expect(readStoredText()).toBeNull();
    });

    it('covers valid JSON: handed back byte for byte', () => {
        const stored = '{"weeks":[]}';
        stubStorage(() => stored);
        expect(readStoredText()).toBe(stored);
    });

    it('covers text that is not JSON: still handed back, not rejected', () => {
        stubStorage(() => 'this is not json {{{');
        expect(readStoredText()).toBe('this is not json {{{');
    });

    it('covers localStorage throwing: null rather than a second crash', () => {
        stubStorage(() => {
            throw new Error('storage disabled');
        });
        expect(readStoredText()).toBeNull();
    });

    it('reads both keys a plan can be stored under', () => {
        const seen: string[] = [];
        stubStorage(((key: string) => {
            seen.push(key);
            return null;
        }) as unknown as () => string | null);

        readStoredText();

        expect(seen).toEqual([CURRENT_STORAGE_KEY, STORAGE_KEY]);
    });

    /** A store holding `contents` under each key named, and nothing elsewhere. */
    function stubKeys(contents: Record<string, string>) {
        stubStorage(((key: string) => contents[key] ?? null) as unknown as () => string | null);
    }

    it('covers a signed-in crash: hands back the cloud copy, not the empty guest one', () => {
        const cloud = '{"weeks":[{"weekStart":"2026-07-06","ended":false,"projects":[]}]}';
        stubKeys({ [CURRENT_STORAGE_KEY]: cloud, [STORAGE_KEY]: '{"weeks":[]}' });
        expect(readStoredText()).toBe(cloud);
    });

    it('covers a guest crash: hands back the guest copy when the cloud one holds nothing', () => {
        const guest = '{"weeks":[{"weekStart":"2026-07-06","ended":false,"projects":[]}]}';
        stubKeys({ [CURRENT_STORAGE_KEY]: '{"weeks":[]}', [STORAGE_KEY]: guest });
        expect(readStoredText()).toBe(guest);
    });
});

describe('recoveryFilename', () => {
    /*
     * Testing strategy
     *     partition on the date: needs zero-padding | does not
     *
     * Local time, like exportFilename.
     */
    it('covers a padded date', () => {
        expect(recoveryFilename(new Date(2026, 7, 9, 23, 30))).toBe(
            'beaverplans-recovery-2026-08-09.json',
        );
    });

    it('covers an unpadded date', () => {
        expect(recoveryFilename(new Date(2026, 10, 23, 0, 5))).toBe(
            'beaverplans-recovery-2026-11-23.json',
        );
    });
});
