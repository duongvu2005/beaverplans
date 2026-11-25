import { useEffect, useMemo, type ReactNode } from 'react';
import { useAccountPref } from '@/prefs/useAccountPref';
import { LocaleContext } from './localeContext';
import { pickLocale, type Locale } from './locale';
import { localeCache } from './localeCache';
import type { AccountLocale } from './accountLocale';

function detected(): Locale {
    return pickLocale(navigator.languages);
}

type LocaleProviderProps = {
    /**
     * Where the language lives for a signed-in person. Omitted, the choice is
     * this device's alone — a guest, or a test wanting a fixed language.
     */
    account?: AccountLocale;
    children: ReactNode;
};

/**
 * Owns the chosen language for everything below it.
 *
 * The context and its hooks live in `localeContext.ts`, so this file exports a
 * component and nothing else and Fast Refresh keeps working.
 *
 * Language follows the ACCOUNT, unlike the theme, which is this device's.
 * Ordering the account against the device cache is `useAccountPref`'s
 * job, shared with the font; what is left here is the language-only part: where a
 * first-time value comes from, and the `lang` attribute.
 *
 * Non-deterministic on first render: reads localStorage, then the browser's
 * language list.
 */
export function LocaleProvider({ account, children }: LocaleProviderProps) {
    const { value: locale, choose } = useAccountPref<Locale>({
        account,
        cache: localeCache,
        initial: detected,
    });

    useEffect(() => {
        // Screen readers pick a voice off this, and it drives the CSS :lang()
        // selector, so it has to track the choice rather than be set once.
        document.documentElement.lang = locale;
    }, [locale]);

    const value = useMemo(() => ({ locale, setLocale: choose }), [locale, choose]);

    return <LocaleContext value={value}>{children}</LocaleContext>;
}
