import type { DateKey, WeekPlan, Weeks } from '@/core/types';

/**
 * The changes needed to bring persisted storage from previous to next.
 *
 * @param previous any valid Weeks (isValidWeeks(previous))
 * @param next any valid Weeks (isValidWeeks(next))
 * @returns { upserts, deletes } where:
 *          - upserts is every WeekPlan in next whose weekStart is either
 *            absent from previous, or present with a !== reference
 *          - deletes is every weekStart present in previous but absent
 *            from next
 */
export function diffWeeks(
    previous: Weeks,
    next: Weeks,
): { upserts: ReadonlyArray<WeekPlan>; deletes: ReadonlyArray<DateKey> } {
    const upserts: WeekPlan[] = [];
    const deletes: DateKey[] = [];

    // two pointer alg
    let i = 0;
    let j = 0;

    // invariant: index steps when its entry is resolved (upsert/delete/nothing)
    while (i < previous.length && j < next.length) {
        const prevWeek = previous[i]!;
        const nextWeek = next[j]!;
        // same weekStart -> upsert if not same object
        if (prevWeek.weekStart === nextWeek.weekStart) {
            if (prevWeek !== nextWeek) {
                upserts.push(nextWeek);
            } else {
                // no changes
            }
            // either way, both resolved
            i++;
            j++;
        }
        // diff weekStart:
        //      if prevWeekStart < nextWeekStart -> prev entry was deleted
        //      if prevWeekStart > nextWeekStart -> next entry was inserted
        else if (prevWeek.weekStart < nextWeek.weekStart) {
            deletes.push(prevWeek.weekStart);
            // prev is resolved
            i++;
        } else {
            upserts.push(nextWeek);
            // next is resolved
            j++;
        }
    }

    // remaining prev entry -> all deleted
    while (i < previous.length) {
        deletes.push(previous[i]!.weekStart);
        i++;
    }

    // remaining next entry -> all inserted
    while (j < next.length) {
        upserts.push(next[j]!);
        j++;
    }

    return { upserts, deletes };
}
