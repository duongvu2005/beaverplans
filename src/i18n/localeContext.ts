import { createContext, useContext } from 'react';
import { catalogFor, type Catalog } from './catalog';
import type { Locale } from './locale';

/** What LocaleProvider hands down: the current language, and a way to change it. */
export type LocaleValue = {
    readonly locale: Locale;
    readonly setLocale: (locale: Locale) => void;
};

// Defaulting to English rather than throwing on a missing provider is what lets
// a component be rendered, and tested, without one.
export const LocaleContext = createContext<LocaleValue>({
    locale: 'en',
    setLocale: () => {},
});

/**
 * The current language and a setter for it.
 *
 * @returns locale, and setLocale, which re-renders every consumer and remembers
 *     the choice — on the account when there is one, on this device otherwise.
 *     Outside a LocaleProvider the locale is 'en' and setLocale does nothing.
 */
export function useLocale(): LocaleValue {
    return useContext(LocaleContext);
}

/**
 * The copy catalog for the current language.
 *
 * @returns the catalog, whose entries are either strings or functions taking the
 *     values they interpolate. Outside a LocaleProvider this is the English one.
 */
export function useCopy(): Catalog {
    return catalogFor(useContext(LocaleContext).locale);
}
