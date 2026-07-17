/**
 * Date helpers for the week model. All dates are interpreted in the
 * user's local timezone; DateKey is a local YYYY-MM-DD string
 * (avoid toISOString, which is UTC and shifts the day).
 */
import type { DateKey, DayOfWeek, DayStatus, WeekStatus } from './types';
import { WEEK } from './types';

// constants
const DAYS_PER_WEEK = 7;
const MS_PER_DAY = 86_400_000;
const MS_PER_WEEK = DAYS_PER_WEEK * MS_PER_DAY; // 604_800_000

/**
 * Finds the Monday that starts the week containing the given date.
 *
 * @param date any datetime
 * @returns the DateKey of that week's Monday
 */
export function weekStartOf(date: Date): DateKey {
    const result = new Date(date);
    const day = result.getDay();
    const MON = 1; // getDay() value for Monday
    const daysSinceMonday = (day - MON + 7) % 7;
    result.setDate(result.getDate() - daysSinceMonday);

    return toDateKey(result);
}

/**
 * Formats a date as a YYYY-MM-DD key.
 *
 * @param date any datetime
 * @returns the YYYY-MM-DD DateKey for that day
 */
export function toDateKey(date: Date): DateKey {
    const year = date.getFullYear().toString().padStart(4, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/**
 * Computes the DateKey of today.
 * Non-deterministic: reads the system clock.
 *
 * @returns the YYYY-MM-DD DateKey for today
 */
export function todayKey(): DateKey {
    return toDateKey(new Date());
}

/**
 * Shifts a week-start by n weeks.
 *
 * @param weekStart a DateKey that is a Monday (week-start)
 * @param n whole number of weeks to move; may be negative (earlier) or zero
 * @returns the week-start n weeks from weekStart; also a Monday
 */
export function addWeeks(weekStart: DateKey, n: number): DateKey {
    const result = parseKey(weekStart);
    result.setDate(result.getDate() + n * DAYS_PER_WEEK);

    return toDateKey(result);
}

/**
 * Counts the whole weeks between two dates. Each argument may be any
 * date and is reduced to its week-start before counting, so dates in the
 * same week count as 0 apart and sub-week gaps do not create a fractional
 * or extra week.
 *
 * @param date any valid DateKey; the week being measured
 * @param reference any valid DateKey; the week measured from
 * @returns signed week count; positive when date's week is after
 *          reference's week, negative when before, 0 in the same week
 */
export function weeksBetween(date: DateKey, reference: DateKey): number {
    return Math.round(
        (weekStartDate(date).getTime() - weekStartDate(reference).getTime()) / MS_PER_WEEK,
    );
}

/**
 * Returns the Monday of key's week as a local Date.
 *
 * @param key any valid DateKey
 * @returns the week-start (Monday) of key's week, as a local Date at midnight
 */
function weekStartDate(key: DateKey): Date {
    return parseKey(weekStartOf(parseKey(key)));
}

/**
 * Parses a DateKey as a local Date at midnight (avoids UTC parsing).
 *
 * @param key any valid DateKey
 * @returns a Date at local midnight on key's day
 */
function parseKey(key: DateKey): Date {
    return new Date(key + 'T00:00:00');
}

/**
 * Reports whether a week has already ended, i.e. its week-start is
 * strictly before the current week.
 *
 * @param weekStart a DateKey that is a Monday (week-start)
 * @param today the DateKey of today
 * @returns true iff weekStart's week is strictly before today's week
 */
export function isWeekPast(weekStart: DateKey, today: DateKey): boolean {
    return weeksBetween(weekStart, today) < 0;
}

/**
 * Gives the week-start of the week immediately after the given one.
 *
 * @param weekStart a DateKey that is a Monday (week-start)
 * @returns the Monday one week after weekStart
 */
export function nextWeekStart(weekStart: DateKey): DateKey {
    return addWeeks(weekStart, 1);
}

/**
 * Classifies a weekday slot as past, today, or future by resolving it
 * to a calendar date within weekStart's week and comparing to today.
 *
 * @param day the weekday slot within the week
 * @param weekStart a DateKey that is a Monday (week-start)
 * @param today the DateKey of today
 * @returns 'past' | 'today' | 'future' for the date that day maps to
 */
export function dayStatusOf(day: DayOfWeek, weekStart: DateKey, today: DateKey): DayStatus {
    const daySlotDate = parseKey(weekStart);
    daySlotDate.setDate(daySlotDate.getDate() + WEEK.indexOf(day));
    const daySlotKey = toDateKey(daySlotDate);
    if (daySlotKey > today) {
        return 'future';
    } else if (daySlotKey < today) {
        return 'past';
    } else {
        return 'today';
    }
}

/**
 * Classifies a weekStart as past, current, or future.
 *
 * @param weekStart any valid weekstart (satisfies isValidWeekStart)
 * @param today the DateKey of today
 * @returns the position of weekStart's week relative to the week containing
 *          today: 'past' if strictly before it, 'current' if the same week,
 *          'future' if strictly after.
 */
export function weekStatusOf(weekStart: DateKey, today: DateKey): WeekStatus {
    const todayWeek = weekStartOf(parseKey(today));
    if (todayWeek < weekStart) {
        return 'future';
    } else if (todayWeek > weekStart) {
        return 'past';
    } else {
        return 'current';
    }
}

/**
 * Check whether the weekStart is valid.
 *
 * @param key any key
 * @returns true iff key represents a valid calendar date in the format
 *          "YYYY-MM-DD" (year must be in the range 1000-9999) and that
 *          date is a Monday.
 */
export function isValidWeekStart(key: DateKey): boolean {
    const regex = /^(\d{4})-(\d{2})-(\d{2})$/;
    const match = key.match(regex);
    if (!match || !match[1] || !match[2] || !match[3]) {
        return false;
    }
    const year = parseInt(match[1], 10);
    const month = parseInt(match[2], 10);
    const day = parseInt(match[3], 10);
    const MON = 1; // getDay() value for Monday

    if (year < 1000 || year > 9999) {
        return false;
    }

    const date = new Date(year, month - 1, day, 0, 0, 0, 0);

    if (
        date.getFullYear() !== year ||
        date.getMonth() !== month - 1 ||
        date.getDate() !== day ||
        date.getDay() !== MON
    ) {
        return false;
    }
    return true;
}
