import { addWeeks, dateKeyForDay, MONTHS } from '@/core/dates';
import { WEEK } from '@/core/types';
import type { DateKey } from '@/core/types';

/** How many week-columns the heatmap draws, its most recent week last. */
export const HEAT_WEEKS = 52;

/**
 * A tracked day carries a completion level; the other two states are absences
 * with different meanings, and the heatmap draws them differently — a week
 * that was never archived is "no record", not "nothing done".
 */
export type HeatCell = {
    readonly key: DateKey;
    readonly state: 'tracked' | 'untracked' | 'future';
    readonly count: number;
    readonly level: number;
};

export type HeatColumn = {
    readonly key: DateKey;
    /** Set only on the column that opens a month, otherwise empty. */
    readonly month: string;
    readonly cells: ReadonlyArray<HeatCell>;
};

/**
 * Buckets a day's completed weight into one of five shades.
 *
 * Below five units the count IS the level: scaling against the year's busiest
 * day would paint a one-unit day at the same shade whether the busiest day was
 * 2 units or 20, which for a young archive means everything reads as full.
 */
function levelOf(count: number, max: number): number {
    if (count <= 0) return 0;
    if (max <= 4) return Math.min(count, 4);
    return Math.min(4, Math.ceil((count / max) * 4));
}

/**
 * The heatmap's grid: HEAT_WEEKS columns of seven days each, oldest first,
 * ending at the week of endWeekStart.
 *
 * Presentation only — the window, the column count and the shading buckets all
 * describe the picture rather than the archive, so this is deliberately not in
 * core. Every date it derives comes from tested core helpers.
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
        // Slicing the key beats parsing it: a DateKey is already local
        // YYYY-MM-DD, and a Date round-trip is where timezone bugs get in.
        const month = MONTHS[Number(weekStart.slice(5, 7)) - 1] ?? '';
        const opensMonth = month !== previousMonth;
        previousMonth = month;

        const cells = WEEK.map((day): HeatCell => {
            const key = dateKeyForDay(weekStart, day);
            const count = completions.get(key) ?? 0;
            if (key > today) return { key, state: 'future', count: 0, level: 0 };
            if (!tracked.has(weekStart)) return { key, state: 'untracked', count: 0, level: 0 };
            return { key, state: 'tracked', count, level: levelOf(count, max) };
        });

        return { key: weekStart, month: opensMonth ? month : '', cells };
    });
}
