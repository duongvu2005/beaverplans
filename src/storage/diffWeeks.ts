import type { DateKey, WeekPlan, Weeks } from '@/core/types';

/**
 * Whether two plans hold the same content.
 *
 * @param a any WeekPlan
 * @param b any WeekPlan
 * @returns true iff a === b, or both serialize identically. Sensitive to key
 *          order, so a false "different" is possible and costs a redundant
 *          write, never a lost one.
 */
export function sameWeek(a: WeekPlan, b: WeekPlan): boolean {
    return a === b || JSON.stringify(a) === JSON.stringify(b);
}

/**
 * The changes needed to bring persisted storage from previous to next.
 *
 * @param previous any valid Weeks (isValidWeeks(previous))
 * @param next any valid Weeks (isValidWeeks(next))
 * @returns { upserts, deletes } where:
 *          - upserts is every WeekPlan in next whose weekStart is either
 *            absent from previous, or present with different content
 *          - deletes is every weekStart present in previous but absent
 *            from next
 */
export function diffWeeks(
    previous: Weeks,
    next: Weeks,
): { upserts: ReadonlyArray<WeekPlan>; deletes: ReadonlyArray<DateKey> } {
    const upserts: WeekPlan[] = [];
    const deletes: DateKey[] = [];

    let i = 0;
    let j = 0;

    while (i < previous.length && j < next.length) {
        const prevWeek = previous[i]!;
        const nextWeek = next[j]!;
        if (prevWeek.weekStart === nextWeek.weekStart) {
            if (!sameWeek(prevWeek, nextWeek)) {
                upserts.push(nextWeek);
            }
            i++;
            j++;
        }
        // Both sides are sorted, so a weekStart the other has run past is
        // missing there: prev < next means deleted, prev > next means inserted.
        else if (prevWeek.weekStart < nextWeek.weekStart) {
            deletes.push(prevWeek.weekStart);
            i++;
        } else {
            upserts.push(nextWeek);
            j++;
        }
    }

    for (const week of previous.slice(i)) {
        deletes.push(week.weekStart);
    }

    for (const week of next.slice(j)) {
        upserts.push(week);
    }

    return { upserts, deletes };
}
