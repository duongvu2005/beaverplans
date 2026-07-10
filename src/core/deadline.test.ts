/**
 * Timezone note: these tests assume the runner's local timezone is pinned to
 * America/New_York (set via test.env.TZ in vite.config.ts). The postcondition
 * tests below assert a resolved Date's LOCAL fields (e.g. 23:59 for a date-only
 * input); without the pin those cases could read UTC fields and pass for the
 * wrong reason.
 */

import { describe, it, expect } from 'vitest';
import { parseDeadline } from './deadline';

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
     *
     * Failure cases assert the full { ok:false, reason } object. Valid cases
     * assert the full success object including the resolved LOCAL Date, so each
     * covers both classification (ok/hasTime) and resolution (23:59 local for
     * date-only, the given wall-clock time for datetime) in one assertion.
     */

    // --- emptiness: reason 'empty' ---

    it('covers null -> empty', () => {
        expect(parseDeadline(null)).toEqual({ ok: false, reason: 'empty' });
    });

    it('covers empty string -> empty', () => {
        expect(parseDeadline('')).toEqual({ ok: false, reason: 'empty' });
    });

    // --- non-empty but unparseable / invalid: reason 'invalid' ---

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

    // --- valid: ok true, asserting the full resolved local instant ---
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
