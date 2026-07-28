import type { DayOfWeek } from '../core/types';
import type { DayProgress } from '../core/progress';

/**
 * One bar's worth of a WeekSpark. `key` is separate from `label` because
 * labels repeat and React needs identity — a week's letters run M T W T F S S.
 */
export type SparkColumn = {
    readonly key: string;
    readonly label: string;
    readonly assigned: number;
    readonly done: number;
};

const LETTER: Record<DayOfWeek, string> = {
    mon: 'M',
    tue: 'T',
    wed: 'W',
    thu: 'T',
    fri: 'F',
    sat: 'S',
    sun: 'S',
};

/**
 * Adapts day progress to spark columns, labelled by weekday initial.
 *
 * @param days any day progress list (progressByDay for one week,
 *        weekdayHistory for the same weekday across many)
 * @returns one column per entry, in the same order
 */
export function weekdayColumns(days: ReadonlyArray<DayProgress>): ReadonlyArray<SparkColumn> {
    return days.map(({ day, assigned, done }) => ({
        key: day,
        label: LETTER[day],
        assigned,
        done,
    }));
}
