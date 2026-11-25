/**
 * Calendar dates and weekdays as each supported language writes them — which for
 * Vietnamese dates means digits, not words.
 *
 * Kept out of `core/dates.ts`, which stays pure calendar arithmetic: which
 * Monday starts this week is the same answer in every language, what to call it
 * is not.
 *
 * The tables are written out rather than taken from Intl.DateTimeFormat, whose
 * exact output moves with the runtime's ICU data — a test asserting a string
 * would pass in one Node and fail in another.
 */
import { dateKeyForDay, dayOfWeekOf, MONTHS } from '@/core/dates';
import { parseDeadline } from '@/core/deadline';
import type { DateKey, DayOfWeek } from '@/core/types';
import type { Locale } from './locale';

/** How much of a weekday's name to show. */
export type DayNameForm = 'long' | 'short' | 'letter';

const MONTHS_VI: readonly string[] = [
    'Th1',
    'Th2',
    'Th3',
    'Th4',
    'Th5',
    'Th6',
    'Th7',
    'Th8',
    'Th9',
    'Th10',
    'Th11',
    'Th12',
];

const MONTHS_BY_LOCALE: Record<Locale, readonly string[]> = { en: MONTHS, vi: MONTHS_VI };

// Vietnamese has no form narrower than this: 'CN' does not shorten to 'N', so
// where English drops to one character Vietnamese stays at two.
const VI_SHORT: Record<DayOfWeek, string> = {
    mon: 'T2',
    tue: 'T3',
    wed: 'T4',
    thu: 'T5',
    fri: 'T6',
    sat: 'T7',
    sun: 'CN',
};

const DAY_NAMES: Record<Locale, Record<DayNameForm, Record<DayOfWeek, string>>> = {
    en: {
        long: {
            mon: 'Monday',
            tue: 'Tuesday',
            wed: 'Wednesday',
            thu: 'Thursday',
            fri: 'Friday',
            sat: 'Saturday',
            sun: 'Sunday',
        },
        short: {
            mon: 'Mon',
            tue: 'Tue',
            wed: 'Wed',
            thu: 'Thu',
            fri: 'Fri',
            sat: 'Sat',
            sun: 'Sun',
        },
        letter: { mon: 'M', tue: 'T', wed: 'W', thu: 'T', fri: 'F', sat: 'S', sun: 'S' },
    },
    vi: {
        long: {
            mon: 'Thứ Hai',
            tue: 'Thứ Ba',
            wed: 'Thứ Tư',
            thu: 'Thứ Năm',
            fri: 'Thứ Sáu',
            sat: 'Thứ Bảy',
            sun: 'Chủ Nhật',
        },
        short: VI_SHORT,
        letter: VI_SHORT,
    },
};

/**
 * Names the month a date falls in, for a label standing on its own.
 *
 * Only for a month shown without a day beside it. A month inside a date goes
 * through monthAndDay, which in Vietnamese does not name it at all.
 *
 * @param key any valid DateKey
 * @param locale the language to name it in
 * @returns that month's short name, never empty: "Aug" in English, "Th8" in
 *     Vietnamese, which runs to four characters from Th10 on
 */
export function monthLabel(key: DateKey, locale: Locale): string {
    // Read off the key's own digits rather than parsed into a Date: a DateKey is
    // already local, and going through Date invites a timezone shift.
    const monthIndex = Number(key.slice(5, 7)) - 1;
    return MONTHS_BY_LOCALE[locale][monthIndex]!; // a DateKey's month is 01–12
}

/**
 * Renders one date, without its year.
 *
 * The two languages differ in structure, not just in words: English names the
 * month, Vietnamese numbers it. That also makes every Vietnamese date exactly
 * five characters, where English runs six or seven.
 *
 * @param key any valid DateKey
 * @param locale the language to render in
 * @returns "Aug 09" in English — the short month, then the zero-padded day.
 *     "09/08" in Vietnamese — the zero-padded day, then the zero-padded month.
 *     Carries no year in either.
 */
export function monthAndDay(key: DateKey, locale: Locale): string {
    const day = key.slice(8, 10);
    if (locale === 'vi') return `${day}/${key.slice(5, 7)}`;
    return `${monthLabel(key, locale)} ${day}`;
}

/**
 * Renders the calendar span of a week as a display label.
 *
 * @param weekStart a DateKey that is a Monday (satisfies isValidWeekStart)
 * @param locale the language to render in
 * @returns weekStart and the Sunday six days later as monthAndDay renders them,
 *     separated by a spaced en dash — "Aug 31 – Sep 06", "31/08 – 06/09". The
 *     month appears on both ends even when the two dates share one, and the
 *     label carries no year, so the same span in two different years produces
 *     the same string.
 */
export function weekRangeLabel(weekStart: DateKey, locale: Locale): string {
    return weekSpanLabel(weekStart, weekStart, locale);
}

/**
 * Renders a run of consecutive-or-not weeks as one range, from the first week's
 * Monday to the last week's Sunday.
 *
 * The weeks between need not be stored: this dates the span, it does not claim
 * every week inside it has work.
 *
 * @param fromWeekStart the earliest week's Monday
 * @param toWeekStart the latest week's Monday, no earlier than fromWeekStart
 * @param locale the language to render in
 * @returns the two dates joined by an en dash, each written as monthAndDay does
 *     for that language. Equals weekRangeLabel when both arguments are the same
 *     week. Carries no year, so a span crossing New Year needs one beside it.
 */
export function weekSpanLabel(
    fromWeekStart: DateKey,
    toWeekStart: DateKey,
    locale: Locale,
): string {
    const sunday = dateKeyForDay(toWeekStart, 'sun');
    return `${monthAndDay(fromWeekStart, locale)} – ${monthAndDay(sunday, locale)}`;
}

/**
 * Names a weekday.
 *
 * @param day the weekday to name
 * @param locale the language to name it in
 * @param form how much of the name to show: the whole thing, an abbreviation, or
 *     the narrowest the language has for a pill too narrow for more. 'letter' is
 *     one character in English and two in Vietnamese, which does not shorten
 *     further — so a caller sizing for it must fit two.
 * @returns that day's name in that language and form, never empty. Only the
 *     'letter' form may repeat itself across days, and only in English.
 */
export function dayName(day: DayOfWeek, locale: Locale, form: DayNameForm): string {
    return DAY_NAMES[locale][form][day];
}

/**
 * Renders a stored deadline as the line shown beneath the thing it belongs to.
 *
 * The time appears only when one was actually typed: a date-only deadline
 * resolves to 23:59 internally, which is not something to show back as if the
 * user had chosen it.
 *
 * @param deadline the value stored on a Project or Task; any string
 * @param locale the language to render in
 * @returns "Thu Aug 20", "Thu Aug 20 · 14:30", "T5 20/08" — the weekday, then
 *     the date as monthAndDay writes it, then the time as stored (24-hour) when
 *     the deadline carries one. Carries no year. undefined when deadline does
 *     not parse, including when it is empty, so a caller renders nothing rather
 *     than showing a value it cannot read.
 */
export function deadlineLabel(deadline: string, locale: Locale): string | undefined {
    const parsed = parseDeadline(deadline);
    if (!parsed.ok) return undefined;

    const key = deadline.slice(0, 10);
    const date = `${dayName(dayOfWeekOf(key), locale, 'short')} ${monthAndDay(key, locale)}`;
    return parsed.hasTime ? `${date} · ${deadline.slice(11, 16)}` : date;
}
