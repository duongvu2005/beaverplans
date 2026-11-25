import { addWeeks, dateKeyForDay } from '@/core/dates';
import { WEEK } from '@/core/types';
import type { DateKey } from '@/core/types';

/** How many week-columns the heatmap draws, its most recent week last. */
export const HEAT_WEEKS = 52;

/** A tracked day carries a completion level; the other two states are absences ("no record", not "nothing done"). */
export type HeatCell = {
    readonly key: DateKey;
    readonly state: 'tracked' | 'untracked' | 'future';
    readonly count: number;
    readonly level: number;
};

export type HeatColumn = {
    readonly key: DateKey;
    /** Whether this column is the first of its month, and so carries the strip's label. */
    readonly opensMonth: boolean;
    readonly cells: ReadonlyArray<HeatCell>;
};

/** Buckets a day's completed weight into one of five shades. */
function levelOf(count: number, max: number): number {
    if (count <= 0) return 0;
    if (max <= 4) return Math.min(count, 4);
    return Math.min(4, Math.ceil((count / max) * 4));
}

/**
 * The heatmap's grid: HEAT_WEEKS columns of seven days each, oldest first,
 * ending at the week of endWeekStart.
 *
 * @param completions completed weight per date (dailyCompletions)
 * @param tracked the weekStart of every archived week
 * @param endWeekStart the Monday of the rightmost column
 * @param today used only to mark days that have not happened yet
 */
export function heatColumns(
    completions: ReadonlyMap<DateKey, number>,
    tracked: ReadonlySet<DateKey>,
    endWeekStart: DateKey,
    today: DateKey,
): ReadonlyArray<HeatColumn> {
    const max = Math.max(0, ...completions.values());
    let previousMonth = '';

    return Array.from({ length: HEAT_WEEKS }, (_unused, column) => {
        const weekStart = addWeeks(endWeekStart, column - (HEAT_WEEKS - 1));
        // A DateKey is already local YYYY-MM-DD, and a Date round-trip is
        // where timezone bugs get in.
        const month = weekStart.slice(5, 7);
        const opensMonth = month !== previousMonth;
        previousMonth = month;

        const cells = WEEK.map((day): HeatCell => {
            const key = dateKeyForDay(weekStart, day);
            const count = completions.get(key) ?? 0;
            if (key > today) return { key, state: 'future', count: 0, level: 0 };
            if (!tracked.has(weekStart)) return { key, state: 'untracked', count: 0, level: 0 };
            return { key, state: 'tracked', count, level: levelOf(count, max) };
        });

        return { key: weekStart, opensMonth, cells };
    });
}
