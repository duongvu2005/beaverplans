import { afterEach, describe, expect, it, vi } from 'vitest';
import { ensureFaces } from './faces';

type FakeFonts = { load: (face: string) => Promise<unknown> };

const original = Object.getOwnPropertyDescriptor(document, 'fonts');

function withFonts(fonts: FakeFonts | undefined): void {
    Object.defineProperty(document, 'fonts', { value: fonts, configurable: true });
}

afterEach(() => {
    if (original === undefined) {
        Reflect.deleteProperty(document, 'fonts');
    } else {
        Object.defineProperty(document, 'fonts', original);
    }
    vi.restoreAllMocks();
});

describe('ensureFaces', () => {
    /*
     * Testing strategy
     *
     * partition on the look: each one
     * partition on the Font Loading API: present; missing, as in older runtimes
     * partition on the loads: all resolve; one rejects
     */

    it('covers asking for every face a look needs', async () => {
        const load = vi.fn((_face: string) => Promise.resolve());
        withFonts({ load });

        await ensureFaces('classic');

        const asked = load.mock.calls.map(([face]) => face);
        expect(asked.length).toBeGreaterThan(0);
        expect(asked.every((face) => /Fraunces|Newsreader/.test(face))).toBe(true);
    });

    it('covers the looks asking for different faces', async () => {
        const load = vi.fn((_face: string) => Promise.resolve());
        withFonts({ load });

        await ensureFaces('modern');

        const asked = load.mock.calls.map(([face]) => face);
        expect(asked.every((face) => face.includes('Be Vietnam Pro'))).toBe(true);
    });

    // Mono is shared, so it is loaded once by the page and never by a switch.
    it('covers no look asking for the mono face', async () => {
        const load = vi.fn((_face: string) => Promise.resolve());
        withFonts({ load });

        await ensureFaces('modern');
        await ensureFaces('classic');

        const asked = load.mock.calls.map(([face]) => face);
        expect(asked.some((face) => face.includes('JetBrains'))).toBe(false);
    });

    // A face that will not load is a reason to show the fallback, not to refuse
    // the switch — so this settles rather than rejecting.
    it('covers a face that fails to load', async () => {
        withFonts({ load: () => Promise.reject(new Error('offline')) });

        await expect(ensureFaces('classic')).resolves.toBeUndefined();
    });

    it('covers a runtime with no Font Loading API', async () => {
        withFonts(undefined);

        await expect(ensureFaces('classic')).resolves.toBeUndefined();
    });
});
