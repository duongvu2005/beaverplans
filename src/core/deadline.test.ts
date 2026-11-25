/**
 * Timezone note: these tests assume the runner's local timezone is pinned to
 * America/New_York (set via test.env.TZ in vite.config.ts). The postcondition
 * tests below assert a resolved Date's LOCAL fields (e.g. 23:59 for a date-only
 * input); without the pin those cases could read UTC fields and pass for the
 * wrong reason.
 */

import { describe, it, expect } from 'vitest';
import { deadlineTone, parseDeadline } from './deadline';

describe('parseDeadline', () => {
    /**
     * Testing strategy:
     *      - partition on emptiness: null | empty string | non-empty
     *      - partition on shape: date-only | datetime | unparseable garbage
     *      - partition on calendar validity: real date | impossible
     *        (month > 12 | day > days-in-month | Feb 29 non-leap) | Feb 29 leap (valid)
     *      - partition on time validity: valid (00:00 | AM | PM | 23:59)
     *        | invalid (hour 24 | hour/min both out of range)
     *      - partition on year range: 1000 (lower bound, in) | middle | 9999
     *        (upper bound, in) | 0999 (just below, out) | 10000 (just above, out)
     *      - boundary crossings: year bound + min/max time
     */

    it('covers null -> empty', () => {
        expect(parseDeadline(null)).toEqual({ ok: false, reason: 'empty' });
    });

    it('covers empty string -> empty', () => {
        expect(parseDeadline('')).toEqual({ ok: false, reason: 'empty' });
    });

    it('covers unparseable garbage -> invalid', () => {
        expect(parseDeadline('garbage')).toEqual({ ok: false, reason: 'invalid' });
    });

    it('covers month > 12 -> invalid', () => {
        expect(parseDeadline('2026-13-01')).toEqual({ ok: false, reason: 'invalid' });
    });

    it('covers day > days-in-month (Feb) -> invalid', () => {
        expect(parseDeadline('2026-02-30')).toEqual({ ok: false, reason: 'invalid' });
    });

    it('covers day > 30 in April -> invalid', () => {
        expect(parseDeadline('2026-04-31')).toEqual({ ok: false, reason: 'invalid' });
    });

    it('covers Feb 29 in a non-leap year (2025) -> invalid', () => {
        expect(parseDeadline('2025-02-29')).toEqual({ ok: false, reason: 'invalid' });
    });

    it('covers hour 24 (just over max) -> invalid', () => {
        expect(parseDeadline('2026-07-15T24:00')).toEqual({ ok: false, reason: 'invalid' });
    });

    it('covers hour and minute both out of range -> invalid', () => {
        expect(parseDeadline('2026-07-15T25:99')).toEqual({ ok: false, reason: 'invalid' });
    });

    it('covers year just below bound (0999) -> invalid', () => {
        expect(parseDeadline('0999-12-31')).toEqual({ ok: false, reason: 'invalid' });
    });

    it('covers year just above bound (10000, 5-digit) -> invalid', () => {
        expect(parseDeadline('10000-01-01')).toEqual({ ok: false, reason: 'invalid' });
    });

    it('covers year just below bound + max time -> invalid', () => {
        expect(parseDeadline('0999-12-31T23:59')).toEqual({ ok: false, reason: 'invalid' });
    });

    it('covers year just above bound + min time -> invalid', () => {
        expect(parseDeadline('10000-01-01T00:00')).toEqual({ ok: false, reason: 'invalid' });
    });

    // Expected Dates use the LOCAL constructor new Date(y, monthIndex, d, h, min)
    // (monthIndex is 0-based) so 23:59 / 00:00 mean local wall-clock, not UTC.

    it('covers Feb 29 in a leap year (2024) -> ok, date-only', () => {
        expect(parseDeadline('2024-02-29')).toEqual({
            ok: true,
            hasTime: false,
            date: new Date(2024, 1, 29, 23, 59, 0, 0),
        });
    });

    it('covers date-only, normal -> ok', () => {
        expect(parseDeadline('2026-07-15')).toEqual({
            ok: true,
            hasTime: false,
            date: new Date(2026, 6, 15, 23, 59, 0, 0),
        });
    });

    it('covers datetime, AM time -> ok', () => {
        expect(parseDeadline('2026-07-15T09:30')).toEqual({
            ok: true,
            hasTime: true,
            date: new Date(2026, 6, 15, 9, 30, 0, 0),
        });
    });

    it('covers datetime, PM time -> ok', () => {
        expect(parseDeadline('2026-07-15T14:30')).toEqual({
            ok: true,
            hasTime: true,
            date: new Date(2026, 6, 15, 14, 30, 0, 0),
        });
    });

    it('covers datetime, max valid time 23:59 -> ok', () => {
        expect(parseDeadline('2026-07-15T23:59')).toEqual({
            ok: true,
            hasTime: true,
            date: new Date(2026, 6, 15, 23, 59, 0, 0),
        });
    });

    it('covers year lower bound (1000), date-only -> ok', () => {
        expect(parseDeadline('1000-01-01')).toEqual({
            ok: true,
            hasTime: false,
            date: new Date(1000, 0, 1, 23, 59, 0, 0),
        });
    });

    it('covers year upper bound (9999), date-only -> ok', () => {
        expect(parseDeadline('9999-12-31')).toEqual({
            ok: true,
            hasTime: false,
            date: new Date(9999, 11, 31, 23, 59, 0, 0),
        });
    });

    it('covers year upper bound (9999) + time -> ok', () => {
        expect(parseDeadline('9999-12-31T23:59')).toEqual({
            ok: true,
            hasTime: true,
            date: new Date(9999, 11, 31, 23, 59, 0, 0),
        });
    });

    it('covers year lower bound (1000) + min time 00:00 -> ok', () => {
        // 00:00 is a specified time, not date-only
        expect(parseDeadline('1000-01-01T00:00')).toEqual({
            ok: true,
            hasTime: true,
            date: new Date(1000, 0, 1, 0, 0, 0, 0),
        });
    });
});

describe('deadlineTone', () => {
    /**
     * Testing strategy:
     *      - partition on parseability: valid | unparseable
     *      - partition on isDone: true | false
     *      - partition on frozen: true | false
     *      - partition on deadline vs today: strictly before | equal | after
     *      - partition on deadline vs the viewed week: before it | on weekStart |
     *        inside it | on its Sunday | after it
     *      - partition on which clock decides: the viewed week IS the current
     *        week | the viewed week is later than today's (the two frames
     *        disagree)
     *      - precedence: done or frozen beats everything; overdue beats in-week
     */

    // Viewed week Mon 2026-08-10 .. Sun 2026-08-16, with today the Wednesday.
    const WEEK = '2026-08-10';
    const TODAY = '2026-08-12';
    const tone = (deadline: string, over: Record<string, unknown> = {}) =>
        deadlineTone({
            deadline,
            weekStart: WEEK,
            today: TODAY,
            isDone: false,
            frozen: false,
            ...over,
        });

    it('covers done: quiet even when overdue', () => {
        expect(tone('2026-08-05', { isDone: true })).toBe('quiet');
    });

    it('covers frozen: quiet even when overdue, because an ended week asks nothing', () => {
        expect(tone('2026-08-05', { frozen: true })).toBe('quiet');
    });

    it('covers unparseable: quiet, matching the caller that renders nothing', () => {
        expect(tone('whenever')).toBe('quiet');
        expect(tone('')).toBe('quiet');
    });

    it('covers strictly before today: urgent', () => {
        expect(tone('2026-08-11')).toBe('urgent');
    });

    it('covers equal to today: urgent, same rung as overdue', () => {
        expect(tone('2026-08-12')).toBe('urgent');
    });

    it('covers after today, inside the viewed week: live', () => {
        expect(tone('2026-08-14')).toBe('live');
    });

    it("covers the viewed week's Sunday, which is still inside it", () => {
        expect(tone('2026-08-16')).toBe('live');
    });

    it('covers weekStart when it is already past: urgent wins over in-week', () => {
        expect(tone('2026-08-10')).toBe('urgent');
    });

    it('covers after the viewed week: quiet', () => {
        expect(tone('2026-08-17')).toBe('quiet');
        expect(tone('2036-08-14')).toBe('quiet');
    });

    it('covers before the viewed week and before today: urgent, not quiet', () => {
        expect(tone('2026-08-05')).toBe('urgent');
    });

    // Viewing a LATER week than today's, so the two frames disagree.
    const LATER = '2026-08-17'; // Mon .. Sun 2026-08-23

    it('covers a later week: a date inside it is live though it is days away', () => {
        expect(tone('2026-08-19', { weekStart: LATER })).toBe('live');
    });

    it('covers a later week: something already overdue stays urgent, not quiet', () => {
        expect(tone('2026-08-11', { weekStart: LATER })).toBe('urgent');
    });

    it('covers a later week: a date past it is quiet again', () => {
        expect(tone('2026-09-01', { weekStart: LATER })).toBe('quiet');
    });
});
