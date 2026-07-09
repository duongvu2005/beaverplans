/**
 * Timezone note: these tests assume the runner's local timezone is pinned to
 * America/New_York (set via test.env.TZ in vite.config.ts). Several cases below
 * construct a Date whose LOCAL day differs from its UTC day (e.g. 23:00 ET rolls
 * to the next UTC day) to prove toDateKey and friends read local fields, not UTC.
 * Without the pin, those "local/UTC differ" cases silently stop differing and
 * pass for the wrong reason.
 */

import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  weekStartOf,
  toDateKey,
  todayKey,
  addWeeks,
  weeksBetween,
  isWeekPast,
  nextWeekStart,
  dayStatusOf,
} from './dates';

describe('weekStartOf', () => {
    /**
     * Testing strategy:
     *      - partition on date's position in week: Monday | mid-week | Sunday
     *      - partition on calendar's boundary: normal | month | year | leap-Feb | DST
     */

    it('covers date is Monday and normal in calendar', () => {
        // Mon Jul 06 2026
        expect(weekStartOf(new Date(2026, 6, 6))).toBe('2026-07-06');
    });

    it('covers date is mid-week and near end of month', () => {
        // Wed Oct 01 2025 -> Mon Sep 29 2025
        expect(weekStartOf(new Date(2025, 9, 1))).toBe('2025-09-29');
    });

    it('covers date is Sunday and near end of year', () => {
        // Sun Jan 04 2026 -> Mon Dec 29 2025
        expect(weekStartOf(new Date(2026, 0, 4))).toBe('2025-12-29');
    });

    it('covers date is mid-week and leap-Feb', () => {
        // Thu Feb 29 2024 -> Mon Feb 26 2024
        expect(weekStartOf(new Date(2024, 1, 29))).toBe('2024-02-26');
    });

    it('covers date is Sunday and DST', () => {
        // Sun Mar 08 2026 -> Mon Mar 02 2026
        expect(weekStartOf(new Date(2026, 2, 8))).toBe('2026-03-02');
    });

    it('property: weekStartOf always returns a Monday', () => {
        const d = new Date(2024, 0, 1);
        const end = new Date(2025, 3, 8);
        while (d <= end) {
            const result = weekStartOf(d);
            const asDate = new Date(result + 'T00:00:00');
            const dstr = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
            expect(asDate.getDay(), `weekStartOf(${dstr}) = ${result} is not a Monday`).toBe(1);
            d.setDate(d.getDate() + 1);
        }
    });
});

describe('toDateKey', () => {
    /**
     * Testing strategy:
     *      - partition on zero-padding: single-digit month/day | two-digit month/day
     *      - partition on local vs UTC day: same | differ (uses a pinned TZ)
     *      - partition on calendar's boundary: normal | month | year | leap-Feb
     */

    it('covers 2-digit month, 1-digit day, local/UTC differ, normal', () => {
        // local Tue Oct 07 2025 23:00; UTC is Oct 08 -> must use local day
        expect(toDateKey(new Date(2025, 9, 7, 23, 0))).toBe('2025-10-07');
    });

    it('covers 1-digit month, 2-digit day, local/UTC same, month boundary', () => {
        // Tue Sep 30 2025
        expect(toDateKey(new Date(2025, 8, 30, 12, 0))).toBe('2025-09-30');
    });

    it('covers 1-digit month, 2-digit day, local/UTC differ, leap-Feb', () => {
        // local Thu Feb 29 2024 23:30; UTC is Mar 01 -> must use local day
        expect(toDateKey(new Date(2024, 1, 29, 23, 30))).toBe('2024-02-29');
    });

    it('covers 2-digit month, 2-digit day, local/UTC same, year boundary', () => {
        // Wed Dec 31 2025
        expect(toDateKey(new Date(2025, 11, 31, 12, 0))).toBe('2025-12-31');
    });

    it('covers 1-digit month, 1-digit day, local/UTC same, normal', () => {
        // Thu Mar 05 2026
        expect(toDateKey(new Date(2026, 2, 5, 12, 0))).toBe('2026-03-05');
    });
});


describe('todayKey', () => {
    /**
     * Testing strategy:
     *      - freeze the clock (vi.setSystemTime) so "today" is deterministic
     *      - partition on local vs UTC day: same | differ (late-evening pinned time)
     *      (formatting/padding is delegated to toDateKey, tested there)
     */

    afterEach(() => {
        vi.useRealTimers();
    });

    it('covers local/UTC same: returns the frozen local day', () => {
        // freeze to Thu Jul 09 2026 12:00 local
        vi.setSystemTime(new Date(2026, 6, 9, 12, 0));
        expect(todayKey()).toBe('2026-07-09');
    });

    it('covers local/UTC differ: returns local day, not UTC', () => {
        // freeze to Tue Oct 07 2025 23:00 local; UTC is Oct 08 -> must return local
        vi.setSystemTime(new Date(2025, 9, 7, 23, 0));
        expect(todayKey()).toBe('2025-10-07');
    });
});

describe('addWeeks', () => {
    /**
     * Testing strategy:
     *      - partition on n: negative | zero | positive
     *      - partition on calendar boundary crossed between input and result:
     *        normal | month | year | leap-Feb | DST week
     *      (input is always a Monday per precondition; result must also be a Monday)
     */

    it('covers n=0, normal: returns the input week-start unchanged', () => {
        // Mon Jul 06 2026, +0
        expect(addWeeks('2026-07-06', 0)).toBe('2026-07-06');
    });

    it('covers n=+3, crossing a month boundary', () => {
        // Mon Jun 15 2026 +3 -> Mon Jul 06 2026
        expect(addWeeks('2026-06-15', 3)).toBe('2026-07-06');
    });

    it('covers n=+2, crossing a year boundary', () => {
        // Mon Dec 21 2026 +2 -> Mon Jan 04 2027
        expect(addWeeks('2026-12-21', 2)).toBe('2027-01-04');
    });

    it('covers n=-2, stepping back over leap-Feb', () => {
        // Mon Mar 11 2024 -2 -> Mon Feb 26 2024 (crosses Feb 29)
        expect(addWeeks('2024-03-11', -2)).toBe('2024-02-26');
    });

    it('covers n=-3, stepping back across a DST week', () => {
        // Mon Mar 23 2026 -3 -> Mon Mar 02 2026 (crosses DST Sun Mar 08)
        expect(addWeeks('2026-03-23', -3)).toBe('2026-03-02');
    });
});

describe('weeksBetween', () => {
    /**
     * Testing strategy:
     *      - partition on sign: date before reference | same week | after
     *      - partition on how inputs sit vs week boundaries (normalization):
     *        same week raw-far apart -> 0 | adjacent weeks raw-close -> ±1 |
     *        both mid-week, several weeks apart -> ±n
     *      (arithmetic on Monday inputs is additionally checked by the
     *       round-trip property test below)
     */

    it('covers same week, Sun and Mon (6 raw days) -> 0', () => {
        // both in week of Mon Jul 06 2026
        expect(weeksBetween('2026-07-12', '2026-07-06')).toBe(0);
    });

    it('covers next-week Sun vs Mon (13 raw days) -> 1, not 2', () => {
        // Sun Jul 19 (wk Jul 13) vs Mon Jul 06 (wk Jul 06)
        expect(weeksBetween('2026-07-19', '2026-07-06')).toBe(1);
    });

    it('covers next-week Mon vs Sun (1 raw day) -> 1, not 0', () => {
        // Mon Jul 13 (wk Jul 13) vs Sun Jul 12 (wk Jul 06)
        expect(weeksBetween('2026-07-13', '2026-07-12')).toBe(1);
    });

    it('covers mid-week to mid-week, several weeks apart, positive', () => {
        // Wed Jul 22 (wk Jul 20) vs Fri Jul 03 (wk Jun 29) -> 3
        expect(weeksBetween('2026-07-22', '2026-07-03')).toBe(3);
    });

    it('covers mid-week to mid-week, several weeks apart, negative', () => {
        // Wed Jul 01 (wk Jun 29) vs Fri Jul 24 (wk Jul 20) -> -3
        expect(weeksBetween('2026-07-01', '2026-07-24')).toBe(-3);
    });
});

describe('isWeekPast', () => {
    /**
     * Testing strategy:
     *      - partition on weekStart's week vs today's week: past | current | future
     *      - partition on today's position in its week: Monday | mid-week | Sunday
     *        (only varied within the "current" week, where the strict boundary lives)
     */

    it('covers a past week -> true', () => {
        // weekStart Mon Jun 22, today Thu Jul 09 (week of Jul 06)
        expect(isWeekPast('2026-06-22', '2026-07-09')).toBe(true);
    });

    it('covers a future week -> false', () => {
        // weekStart Mon Jul 13, today Thu Jul 09
        expect(isWeekPast('2026-07-13', '2026-07-09')).toBe(false);
    });

    it('covers current week, today mid-week (raw past, week not) -> false', () => {
        // weekStart Mon Jul 06, today Thu Jul 09
        expect(isWeekPast('2026-07-06', '2026-07-09')).toBe(false);
    });

    it('covers current week, today is the Monday -> false', () => {
        // weekStart Mon Jul 06, today Mon Jul 06
        expect(isWeekPast('2026-07-06', '2026-07-06')).toBe(false);
    });

    it('covers current week, today is Sunday -> false', () => {
        // weekStart Mon Jul 06, today Sun Jul 12
        expect(isWeekPast('2026-07-06', '2026-07-12')).toBe(false);
    });
});

describe('nextWeekStart', () => {
    /**
     * Testing strategy:
     *      - partition on calendar boundary crossed: normal | month | year | leap-Feb | DST week
     *      (input is a Monday per precondition; result is the following Monday)
     */

    it('covers normal, mid-year', () => {
        // Mon Jul 06 2026 -> Mon Jul 13 2026
        expect(nextWeekStart('2026-07-06')).toBe('2026-07-13');
    });

    it('covers crossing a month boundary', () => {
        // Mon Jun 29 2026 -> Mon Jul 06 2026
        expect(nextWeekStart('2026-06-29')).toBe('2026-07-06');
    });

    it('covers crossing a year boundary', () => {
        // Mon Dec 28 2026 -> Mon Jan 04 2027
        expect(nextWeekStart('2026-12-28')).toBe('2027-01-04');
    });

    it('covers stepping over leap-Feb', () => {
        // Mon Feb 26 2024 -> Mon Mar 04 2024 (crosses Feb 29)
        expect(nextWeekStart('2024-02-26')).toBe('2024-03-04');
    });

    it('covers crossing a DST week', () => {
        // Mon Mar 02 2026 -> Mon Mar 09 2026 (crosses DST Sun Mar 08)
        expect(nextWeekStart('2026-03-02')).toBe('2026-03-09');
    });
});

describe('dayStatusOf', () => {
    /**
     * Testing strategy:
     *      - partition on weekStart's week vs today: past | current | future
     *      - partition on slot vs today's weekday: before | same | after
     *        (only decisive in the current week; in past/future the week dominates)
     *      - trap cases: past week + latest slot must be 'past'; future week +
     *        earliest slot must be 'future' (resolved date wins over weekday index)
     */

    // today = Thu Jul 09 2026 for every case
    const today = '2026-07-09';

    it('covers current week, slot before today -> past', () => {
        // wed of week Jul 06 -> Jul 08
        expect(dayStatusOf('wed', '2026-07-06', today)).toBe('past');
    });

    it('covers current week, slot equals today -> today', () => {
        // thu of week Jul 06 -> Jul 09
        expect(dayStatusOf('thu', '2026-07-06', today)).toBe('today');
    });

    it('covers current week, slot after today -> future', () => {
        // sat of week Jul 06 -> Jul 11
        expect(dayStatusOf('sat', '2026-07-06', today)).toBe('future');
    });

    it('covers past week, latest slot still past (week dominates)', () => {
        // sun of week Jun 29 -> Jul 05, before today despite being a late weekday
        expect(dayStatusOf('sun', '2026-06-29', today)).toBe('past');
    });

    it('covers future week, earliest slot still future (week dominates)', () => {
        // mon of week Jul 13 -> Jul 13, after today despite being an early weekday
        expect(dayStatusOf('mon', '2026-07-13', today)).toBe('future');
    });

    it('covers today on Sunday, earlier weekday slot -> past', () => {
    // today Sun Jul 12; sat of same week (Jul 11) is the day before -> past
    expect(dayStatusOf('sat', '2026-07-06', '2026-07-12')).toBe('past');
});
});
