import type { DateKey } from '../core/types';
import { weeksBetween } from '../core/dates';

/**
 * Names a week relative to the week containing today.
 *
 * @param weekStart the week being named, a Monday
 * @param today the DateKey of today
 * @returns "This week" | "Last week" | "Next week" | "N weeks ago" | "In N weeks"
 */
export function relativeWeekName(weekStart: DateKey, today: DateKey): string {
    const n = weeksBetween(weekStart, today);
    if (n === 0) return 'This week';
    if (n === -1) return 'Last week';
    if (n === 1) return 'Next week';
    return n < 0 ? `${-n} weeks ago` : `In ${n} weeks`;
}
