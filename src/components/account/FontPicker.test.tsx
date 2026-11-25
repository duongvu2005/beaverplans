import type { ReactElement } from 'react';
import { afterEach, describe, expect, it, vi as vitest } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderIn } from '@/test/locale';
import { en } from '@/i18n/en';
import { vi } from '@/i18n/vi';
import { FontProvider } from '@/font/FontProvider';
import { FontPicker } from './FontPicker';

// The real one fetches; here only the fact that it is ASKED matters, since the
// segments preview themselves in faces the browser may never have loaded.
const asked: string[] = [];
vitest.mock('@/font/faces', () => ({
    ensureFaces: (pref: string) => {
        asked.push(pref);
        return Promise.resolve();
    },
}));

const KEY = 'beaverplans:font';

/** renderIn gives the language; the look needs its own provider above the picker. */
function renderPicker(locale: 'en' | 'vi', ui: ReactElement) {
    return renderIn(locale, <FontProvider>{ui}</FontProvider>);
}

describe('FontPicker', () => {
    /*
     * Testing strategy
     *
     * partition on the look showing: modern | classic
     * partition on the button pressed: the current one | the other one
     * partition on the caption: drawn | left to the host
     * partition on the language: en | vi
     *
     * The words are asserted through the catalogs rather than as literals: what
     * is pinned here is that the control reads the catalog at all.
     */

    afterEach(() => {
        localStorage.clear();
        document.documentElement.removeAttribute('data-font');
        asked.length = 0;
    });

    it('covers the default look being lit, and both looks named', () => {
        renderPicker('en', <FontPicker />);

        expect(screen.getByRole('button', { name: en.fontPicker.options.modern })).toHaveAttribute(
            'aria-pressed',
            'true',
        );
        expect(screen.getByRole('button', { name: en.fontPicker.options.classic })).toHaveAttribute(
            'aria-pressed',
            'false',
        );
    });

    it('covers the stored look being lit instead', () => {
        localStorage.setItem(KEY, 'classic');

        renderPicker('en', <FontPicker />);

        expect(screen.getByRole('button', { name: en.fontPicker.options.classic })).toHaveAttribute(
            'aria-pressed',
            'true',
        );
    });

    it('covers vi: the looks are named in Vietnamese', () => {
        renderPicker('vi', <FontPicker />);

        expect(screen.getByRole('button', { name: vi.fontPicker.options.modern })).toBeVisible();
        expect(screen.getByRole('button', { name: vi.fontPicker.options.classic })).toBeVisible();
    });

    it('covers picking the other look', async () => {
        renderPicker('en', <FontPicker />);

        await userEvent.click(screen.getByRole('button', { name: en.fontPicker.options.classic }));

        expect(screen.getByRole('button', { name: en.fontPicker.options.classic })).toHaveAttribute(
            'aria-pressed',
            'true',
        );
        expect(localStorage.getItem(KEY)).toBe('classic');
    });

    // The provider caches the current look on mount, so "wrote nothing" cannot be
    // read off storage; what the guard prevents is the switch running at all.
    it('covers re-picking the current look doing nothing', async () => {
        renderPicker('en', <FontPicker />);

        await userEvent.click(screen.getByRole('button', { name: en.fontPicker.options.modern }));

        expect(asked).toEqual([]);
        expect(localStorage.getItem(KEY)).toBe('modern');
    });

    // The segments preview themselves off the static preloads, so mounting the
    // control must not fetch anything of its own.
    it('covers mounting fetching nothing', () => {
        renderPicker('en', <FontPicker />);

        expect(asked).toEqual([]);
    });

    it('covers each segment carrying its own face', () => {
        renderPicker('en', <FontPicker />);

        const modern = screen.getByRole('button', { name: en.fontPicker.options.modern });
        const classic = screen.getByRole('button', { name: en.fontPicker.options.classic });

        expect(modern.className).not.toBe(classic.className);
    });

    it('covers the caption naming the group', () => {
        renderPicker('en', <FontPicker />);

        expect(screen.getByRole('group', { name: en.fontPicker.label })).toBeVisible();
    });

    it('covers the host naming it instead', () => {
        renderPicker('en', <FontPicker caption={false} />);

        expect(screen.getByRole('group', { name: en.fontPicker.label })).toBeVisible();
        expect(screen.queryByText(en.fontPicker.label)).toBeNull();
    });
});
