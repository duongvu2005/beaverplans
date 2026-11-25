import { describe, expect, it } from 'vitest';
import { toDateKey } from '@/core/dates';
import {
    dayName,
    deadlineLabel,
    monthAndDay,
    monthLabel,
    weekRangeLabel,
    weekSpanLabel,
} from './dateCopy';

describe('monthAndDay', () => {
    /*
     * Testing strategy
     *
     * partition on locale:
     *   en (named month); vi (numeric dd/mm)
     * partition on month:
     *   January (first); a middle month; December (last)
     * partition on day of month:
     *   1 (needs padding); a two-digit day; 31 (last possible)
     */

    it('covers en, January, day 1', () => {
        expect(monthAndDay('2026-01-01', 'en')).toBe('Jan 01');
    });

    it('covers en, a middle month, a two-digit day', () => {
        expect(monthAndDay('2026-08-09', 'en')).toBe('Aug 09');
    });

    it('covers en, December, day 31', () => {
        expect(monthAndDay('2026-12-31', 'en')).toBe('Dec 31');
    });

    it('covers vi, January, day 1: both halves padded', () => {
        expect(monthAndDay('2026-01-01', 'vi')).toBe('01/01');
    });

    it('covers vi, a middle month, a two-digit day: day leads', () => {
        expect(monthAndDay('2026-08-09', 'vi')).toBe('09/08');
    });

    it('covers vi, December, day 31', () => {
        expect(monthAndDay('2026-12-31', 'vi')).toBe('31/12');
    });

    it('covers vi being the same width for every date in the year', () => {
        for (let month = 1; month <= 12; month++) {
            const key = `2026-${String(month).padStart(2, '0')}-01` as const;
            expect(monthAndDay(key, 'vi')).toHaveLength(5);
        }
    });
});

describe('weekRangeLabel', () => {
    /*
     * Testing strategy
     *
     * partition on the span:
     *   both ends in the same month; crossing a month boundary; crossing a
     *   year boundary
     * partition on the start month's length:
     *   31 days; 30 days; February in a non-leap year; February in a leap year
     * partition on day-number width:
     *   both ends two digits; the end padded; both padded
     * partition on DST:
     *   the span contains a transition; it does not
     * partition on locale:
     *   en; vi
     */

    it('covers en, both ends in the same month, 31 days, both two digits', () => {
        expect(weekRangeLabel('2026-08-03', 'en')).toBe('Aug 03 – Aug 09');
    });

    it('covers en, crossing a month boundary', () => {
        expect(weekRangeLabel('2026-08-31', 'en')).toBe('Aug 31 – Sep 06');
    });

    it('covers en, crossing a year boundary, the end padded', () => {
        expect(weekRangeLabel('2026-12-28', 'en')).toBe('Dec 28 – Jan 03');
    });

    it('covers en, a 30-day month, the end padded', () => {
        // Mon Jun 29 2026 -> Sun Jul 05 2026
        expect(weekRangeLabel('2026-06-29', 'en')).toBe('Jun 29 – Jul 05');
    });

    it('covers en, out of a non-leap February', () => {
        // Mon Feb 23 2026 -> Sun Mar 01 2026; Feb 2026 has 28 days
        expect(weekRangeLabel('2026-02-23', 'en')).toBe('Feb 23 – Mar 01');
    });

    it('covers en, out of a leap February', () => {
        // Mon Feb 26 2024 -> Sun Mar 03 2024, spanning Feb 29
        expect(weekRangeLabel('2024-02-26', 'en')).toBe('Feb 26 – Mar 03');
    });

    it('covers en, both ends padded', () => {
        expect(weekRangeLabel('2025-09-01', 'en')).toBe('Sep 01 – Sep 07');
    });

    it('covers a span containing a DST transition', () => {
        // Mon Mar 02 2026 -> Sun Mar 08 2026. ET springs forward at 02:00 on
        // Mar 08, i.e. after the local midnight each end is read at, so both
        // ends resolve under the same offset.
        expect(weekRangeLabel('2026-03-02', 'en')).toBe('Mar 02 – Mar 08');
        expect(weekRangeLabel('2026-03-02', 'vi')).toBe('02/03 – 08/03');
    });

    it('covers vi, both ends in the same month', () => {
        expect(weekRangeLabel('2026-08-03', 'vi')).toBe('03/08 – 09/08');
    });

    it('covers vi, crossing a month boundary', () => {
        expect(weekRangeLabel('2026-08-31', 'vi')).toBe('31/08 – 06/09');
    });

    it('covers vi, crossing a year boundary', () => {
        expect(weekRangeLabel('2026-12-28', 'vi')).toBe('28/12 – 03/01');
    });

    it('covers vi, out of a leap February', () => {
        expect(weekRangeLabel('2024-02-26', 'vi')).toBe('26/02 – 03/03');
    });

    it('property: every Monday from 2024 to 2027 is well formed in both locales', () => {
        const shapes = {
            en: /^[A-Z][a-z]{2} \d{2} – [A-Z][a-z]{2} \d{2}$/,
            vi: /^\d{2}\/\d{2} – \d{2}\/\d{2}$/,
        };
        const day = new Date(2024, 0, 1); // Mon Jan 01 2024
        const end = new Date(2027, 0, 4);
        while (day <= end) {
            const key = toDateKey(day);
            for (const locale of ['en', 'vi'] as const) {
                expect(
                    weekRangeLabel(key, locale),
                    `weekRangeLabel(${key}, ${locale}) is malformed`,
                ).toMatch(shapes[locale]);
            }
            day.setDate(day.getDate() + 7);
        }
    });
});

describe('monthLabel', () => {
    /*
     * Testing strategy
     *
     * partition on locale:
     *   en; vi
     * partition on month:
     *   January (first); a month vi spells in three characters; the first vi
     *   spells in four; December (last)
     */

    it('covers en, January and December', () => {
        expect(monthLabel('2026-01-15', 'en')).toBe('Jan');
        expect(monthLabel('2026-12-15', 'en')).toBe('Dec');
    });

    it('covers vi, January', () => {
        expect(monthLabel('2026-01-15', 'vi')).toBe('Th1');
    });

    it('covers vi either side of the width change', () => {
        expect(monthLabel('2026-09-15', 'vi')).toBe('Th9');
        expect(monthLabel('2026-10-15', 'vi')).toBe('Th10');
    });

    it('covers vi, December', () => {
        expect(monthLabel('2026-12-15', 'vi')).toBe('Th12');
    });

    it('covers every month in both locales being non-empty and distinct', () => {
        for (const locale of ['en', 'vi'] as const) {
            const labels = Array.from({ length: 12 }, (_unused, month) =>
                monthLabel(`2026-${String(month + 1).padStart(2, '0')}-01`, locale),
            );
            expect(labels.every((label) => label.length > 0)).toBe(true);
            expect(new Set(labels).size).toBe(12);
        }
    });
});

describe('dayName', () => {
    /*
     * Testing strategy
     *
     * partition on form:
     *   long; short; letter
     * partition on day:
     *   mon (first of the week); a middle day; sun (last of the week)
     * partition on locale:
     *   en; vi
     */

    it('covers en, long, each end of the week', () => {
        expect(dayName('mon', 'en', 'long')).toBe('Monday');
        expect(dayName('sun', 'en', 'long')).toBe('Sunday');
    });

    it('covers en, short, a middle day', () => {
        expect(dayName('thu', 'en', 'short')).toBe('Thu');
    });

    it('covers en, letter', () => {
        expect(dayName('mon', 'en', 'letter')).toBe('M');
        expect(dayName('sun', 'en', 'letter')).toBe('S');
    });

    it('covers vi, long, each end of the week', () => {
        expect(dayName('mon', 'vi', 'long')).toBe('Thứ Hai');
        expect(dayName('sun', 'vi', 'long')).toBe('Chủ Nhật');
    });

    it('covers vi, short, a middle day', () => {
        expect(dayName('thu', 'vi', 'short')).toBe('T5');
    });

    it('covers vi, letter: no narrower than short, so Sunday keeps both letters', () => {
        expect(dayName('mon', 'vi', 'letter')).toBe('T2');
        expect(dayName('sat', 'vi', 'letter')).toBe('T7');
        expect(dayName('sun', 'vi', 'letter')).toBe('CN');
    });

    it('covers vi having no form narrower than short', () => {
        const days = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
        for (const day of days) {
            expect(dayName(day, 'vi', 'letter')).toBe(dayName(day, 'vi', 'short'));
        }
    });

    it('covers every day in every form being non-empty and distinct within its form', () => {
        const forms = ['long', 'short'] as const;
        const days = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
        for (const locale of ['en', 'vi'] as const) {
            for (const form of forms) {
                const names = days.map((day) => dayName(day, locale, form));
                expect(names.every((name) => name.length > 0)).toBe(true);
                expect(new Set(names).size).toBe(days.length);
            }
        }
    });
});

describe('deadlineLabel', () => {
    /*
     * Testing strategy
     *
     * partition on locale:
     *   en (named month, weekday abbreviated); vi (numeric dd/mm, T-form weekday)
     * partition on the time half:
     *   date-only (no time shown); a time set (shown, 24-hour, as stored)
     * partition on the time's digits:
     *   both padded; midnight (00:00, which must not be mistaken for absent)
     * partition on weekday:
     *   a mid-week day; Sunday (where the weekday lookup has to wrap)
     * partition on parseability:
     *   valid; malformed; empty
     */

    it('covers en, date-only: weekday then the named month', () => {
        expect(deadlineLabel('2026-08-20', 'en')).toBe('Thu Aug 20');
    });

    it('covers en, a time set: appended after a separator', () => {
        expect(deadlineLabel('2026-08-20T14:30', 'en')).toBe('Thu Aug 20 · 14:30');
    });

    it('covers vi, date-only: dd/mm, and the weekday in T-form', () => {
        expect(deadlineLabel('2026-08-20', 'vi')).toBe('T5 20/08');
    });

    it('covers vi, a time set', () => {
        expect(deadlineLabel('2026-08-20T14:30', 'vi')).toBe('T5 20/08 · 14:30');
    });

    it('covers Sunday, where the weekday lookup wraps', () => {
        expect(deadlineLabel('2026-08-23', 'en')).toBe('Sun Aug 23');
        expect(deadlineLabel('2026-08-23', 'vi')).toBe('CN 23/08');
    });

    it('covers midnight: a real time, not an absent one', () => {
        expect(deadlineLabel('2026-08-20T00:00', 'en')).toBe('Thu Aug 20 · 00:00');
    });

    it('covers date-only NOT showing the 23:59 it resolves to', () => {
        expect(deadlineLabel('2026-08-20', 'en')).not.toContain('23:59');
    });

    it('covers malformed and empty: nothing to label', () => {
        expect(deadlineLabel('not-a-date', 'en')).toBeUndefined();
        expect(deadlineLabel('2026-13-40', 'en')).toBeUndefined();
        expect(deadlineLabel('', 'en')).toBeUndefined();
    });
});

describe('weekSpanLabel', () => {
    /*
     * Testing strategy
     *     partition on span: one week | several | crossing a month | crossing a year
     *     partition on locale: en | vi
     *     property: a one-week span equals weekRangeLabel for that week
     */

    it('covers one week: equals weekRangeLabel', () => {
        expect(weekSpanLabel('2026-08-31', '2026-08-31', 'en')).toBe(
            weekRangeLabel('2026-08-31', 'en'),
        );
    });

    it('covers several weeks, crossing a month, in en', () => {
        expect(weekSpanLabel('2026-08-31', '2026-09-28', 'en')).toBe('Aug 31 – Oct 04');
    });

    it('covers several weeks, crossing a month, in vi', () => {
        expect(weekSpanLabel('2026-08-31', '2026-09-28', 'vi')).toBe('31/08 – 04/10');
    });

    it('covers crossing a year', () => {
        expect(weekSpanLabel('2025-12-29', '2026-01-05', 'en')).toBe('Dec 29 – Jan 11');
    });
});
