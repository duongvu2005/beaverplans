import { render, type RenderResult } from '@testing-library/react';
import type { ReactElement } from 'react';
import { LocaleProvider } from '@/i18n/LocaleProvider';
import type { Locale } from '@/i18n/locale';

/**
 * Renders something inside a LocaleProvider already set to a language.
 *
 * The provider takes no initial value — it reads storage, then the browser — so
 * this seeds storage first and clears it after, which `setup.ts` does not.
 *
 * Use the provider directly when the test is ABOUT the provider — how it detects,
 * what it persists, what a consumer outside one sees.
 *
 * @param locale the language to render in
 * @param ui any element
 * @returns whatever `render` returns
 */
export function renderIn(locale: Locale, ui: ReactElement): RenderResult {
    localStorage.setItem('beaverplans:locale', locale);
    try {
        return render(<LocaleProvider>{ui}</LocaleProvider>);
    } finally {
        // The provider has already read it by now, so this is safe here and
        // does not depend on the caller remembering an afterEach.
        localStorage.removeItem('beaverplans:locale');
    }
}
