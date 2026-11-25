import type { Locale } from './locale';
import { en, type Catalog } from './en';
import { vi } from './vi';

const CATALOGS: Record<Locale, Catalog> = { en, vi };

/**
 * The catalog a locale reads its copy from.
 *
 * @param locale any supported locale
 * @returns that locale's catalog; the same object every call, so it is safe to
 *     depend on by identity
 */
export function catalogFor(locale: Locale): Catalog {
    return CATALOGS[locale];
}

export type { Catalog };
