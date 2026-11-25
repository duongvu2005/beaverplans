/**
 * The set of languages the app is written in, and how a starting one is chosen.
 * Nothing here touches storage or the DOM.
 */

/** A language the app has a complete catalog for. */
export type Locale = 'en' | 'vi';

/** Every supported locale, in the order a picker should offer them. */
export const LOCALES: readonly Locale[] = ['en', 'vi'];

/**
 * Narrows an unknown value to a supported locale.
 *
 * @param value any value, including one read back out of storage
 * @returns true iff value is one of LOCALES
 */
export function isLocale(value: unknown): value is Locale {
    return typeof value === 'string' && (LOCALES as readonly string[]).includes(value);
}

/**
 * Chooses a starting locale from the languages a browser reports.
 *
 * @param languages BCP-47 tags in descending order of preference, as
 *     navigator.languages gives them; may be empty
 * @returns the first supported locale named in languages, or 'en' if none is
 *     named. A tag matches on its primary subtag alone, so 'vi-VN' picks 'vi',
 *     and matching ignores case.
 */
export function pickLocale(languages: readonly string[]): Locale {
    for (const tag of languages) {
        // Only the primary subtag decides, so a region or script ('vi-VN',
        // 'zh-Hant') matches its language, and a three-letter code ('vie') is a
        // different subtag rather than a longer spelling of one.
        const primary = tag.split('-')[0]?.toLowerCase();
        if (isLocale(primary)) {
            return primary;
        }
    }
    return 'en';
}
