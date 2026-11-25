import { describe, it, expect } from 'vitest';
import { weekdayColumns, withDayStatus } from './sparkColumns';
import type { DayProgress } from '@/core/progress';

/*
 * Testing strategy
 *     partition on the week's position: past | containing today | future
 *     partition on the column within a current week: before today | today |
 *       after today
 *     property: withDayStatus changes only the two flags, never assigned/done,
 *       and keeps column order
 */

const WEEK = '2026-07-06'; // Monday
const DAYS: ReadonlyArray<DayProgress['day']> = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

function progress(): ReadonlyArray<DayProgress> {
    return DAYS.map((day, i) => ({ day, assigned: i + 1, done: 0 }));
}

function flags(weekStart: string, today: string) {
    return withDayStatus(weekdayColumns(progress(), 'en'), weekStart, today).map((c) => ({
        unlived: c.unlived === true,
        isToday: c.isToday === true,
    }));
}

describe('withDayStatus', () => {
    it('covers a week containing today: Wednesday', () => {
        expect(flags(WEEK, '2026-07-08')).toEqual([
            { unlived: false, isToday: false },
            { unlived: false, isToday: false },
            { unlived: false, isToday: true },
            { unlived: true, isToday: false },
            { unlived: true, isToday: false },
            { unlived: true, isToday: false },
            { unlived: true, isToday: false },
        ]);
    });

    it('covers a past week: nothing unlived, no today', () => {
        expect(flags(WEEK, '2026-07-20').every((f) => !f.unlived && !f.isToday)).toBe(true);
    });

    it('covers a future week: every day unlived, no today', () => {
        expect(flags(WEEK, '2026-06-29').every((f) => f.unlived && !f.isToday)).toBe(true);
    });

    it('covers the last day of the week as today', () => {
        const f = flags(WEEK, '2026-07-12');
        expect(f[6]).toEqual({ unlived: false, isToday: true });
        expect(f.filter((x) => x.unlived)).toHaveLength(0);
    });

    it('leaves assigned, done and order untouched', () => {
        const before = weekdayColumns(progress(), 'en');
        const after = withDayStatus(before, WEEK, '2026-07-08');
        expect(after.map((c) => [c.key, c.label, c.assigned, c.done])).toEqual(
            before.map((c) => [c.key, c.label, c.assigned, c.done]),
        );
    });
});
