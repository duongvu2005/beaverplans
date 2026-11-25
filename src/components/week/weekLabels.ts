import type { DateKey } from '@/core/types';
import { weeksBetween } from '@/core/dates';
import type { Catalog } from '@/i18n/catalog';

/**
 * Names a week relative to the week containing today.
 *
 * Takes its wording rather than holding it: a module cannot call useCopy.
 *
 * @param weekStart the week being named, a Monday
 * @param today the DateKey of today
 * @param copy the weekLabels block of the current catalog
 * @returns the week named in the catalog's language — the three adjacent weeks
 *     have their own words, anything further out is counted. Never empty.
 */
export function relativeWeekName(
    weekStart: DateKey,
    today: DateKey,
    copy: Catalog['weekLabels'],
): string {
    const n = weeksBetween(weekStart, today);
    if (n === 0) return copy.thisWeek;
    if (n === -1) return copy.lastWeek;
    if (n === 1) return copy.nextWeek;
    return n < 0 ? copy.weeksAgo(-n) : copy.inWeeks(n);
}
