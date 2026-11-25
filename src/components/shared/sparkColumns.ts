import type { DayProgress } from '@/core/progress';
import { dayStatusOf } from '@/core/dates';
import type { DateKey, DayOfWeek } from '@/core/types';
import { dayName } from '@/i18n/dateCopy';
import type { Locale } from '@/i18n/locale';

/** One bar's worth of a WeekSpark. `key` is separate from `label` because labels repeat. */
export type SparkColumn = {
    readonly key: string;
    readonly label: string;
    readonly assigned: number;
    readonly done: number;
    /** the day has not happened yet, so an unfilled bar is "not yet", not "missed" */
    readonly unlived?: boolean;
    readonly isToday?: boolean;
};

/**
 * Adapts day progress to spark columns, labelled by weekday initial.
 *
 * @param days any day progress list (progressByDay for one week,
 *        weekdayHistory for the same weekday across many)
 * @param locale the language to name the days in. Its narrowest form is one
 *        character in English and two in Vietnamese, so a caller sizing a column
 *        for the label must fit two.
 * @returns one column per entry, in the same order
 */
export function weekdayColumns(
    days: ReadonlyArray<DayProgress>,
    locale: Locale,
): ReadonlyArray<SparkColumn> {
    return days.map(({ day, assigned, done }) => ({
        key: day,
        label: dayName(day, locale, 'letter'),
        assigned,
        done,
    }));
}

const WEEK_ORDER: ReadonlyArray<DayOfWeek> = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

/**
 * Flags each column of one week by where its day sits relative to today.
 *
 * Only meaningful for columns that are the seven days of a single week; a
 * caller charting one weekday across many weeks has no such day to place.
 *
 * @param columns one week's columns, in weekday order from Monday. Columns past
 *     the seventh are returned unflagged.
 * @param weekStart the Monday those columns belong to
 * @param today the DateKey of today
 * @returns the same columns in the same order, carrying the same assigned and
 *          done, with unlived true on days after today and isToday true on the
 *          one day that is today. Both are absent on every other column, so a
 *          past or future week simply has no today.
 */
export function withDayStatus(
    columns: ReadonlyArray<SparkColumn>,
    weekStart: DateKey,
    today: DateKey,
): ReadonlyArray<SparkColumn> {
    return columns.map((column, index) => {
        const day = WEEK_ORDER[index];
        if (day === undefined) return column;
        const status = dayStatusOf(day, weekStart, today);
        return { ...column, unlived: status === 'future', isToday: status === 'today' };
    });
}
