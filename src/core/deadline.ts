import { dateKeyForDay } from './dates';
import type { DateKey } from './types';

export type ParsedDeadline =
    | { readonly ok: true; readonly date: Date; readonly hasTime: boolean }
    | { readonly ok: false; readonly reason: 'empty' | 'invalid' };

/**
 * Interprets a deadline string as a local deadline, or reports why it
 * cannot be interpreted.
 *
 * @param s any string, or null
 * @returns
 *   - { ok: false, reason: 'empty' } if s is null or the empty string.
 *   - { ok: false, reason: 'invalid' } if s is non-empty but does not
 *     represent a valid calendar date or date-time with a four-digit year.
 *   - { ok: true, date, hasTime } otherwise, where:
 *       - date is a valid local Date representing the deadline.
 *       - date-only inputs resolve to 23:59 local time on that date.
 *       - hasTime is true iff the input explicitly specifies a time,
 *         and false for date-only inputs.
 */
export function parseDeadline(s: string | null): ParsedDeadline {
    if (!s || s.trim() === '') {
        return { ok: false, reason: 'empty' };
    }
    // match YYYY-MM-DD or YYYY-MM-DDThh:mm
    const regex = /^(\d{4})-(\d{2})-(\d{2})(T(\d{2}):(\d{2}))?$/;
    const match = s.match(regex);

    if (!match || !match[1] || !match[2] || !match[3]) {
        return { ok: false, reason: 'invalid' };
    }

    const year = parseInt(match[1], 10);
    const month = parseInt(match[2], 10);
    const day = parseInt(match[3], 10);
    if (year < 1000 || year > 9999) {
        return { ok: false, reason: 'invalid' };
    }

    const hasTime = match[4] !== undefined && match[5] !== undefined && match[6] !== undefined;
    // match[5] and match[6] cannot be undefined if hasTime is true
    const hour = hasTime ? parseInt(match[5]!, 10) : 23;
    const minute = hasTime ? parseInt(match[6]!, 10) : 59;

    const localDate = new Date(year, month - 1, day, hour, minute, 0, 0);

    // Date rolls impossible values over, so read the fields back to catch them.
    if (
        localDate.getFullYear() !== year ||
        localDate.getMonth() !== month - 1 ||
        localDate.getDate() !== day ||
        localDate.getHours() !== hour ||
        localDate.getMinutes() !== minute
    ) {
        return { ok: false, reason: 'invalid' };
    }

    return { ok: true, date: localDate, hasTime: hasTime };
}

/** How loudly a deadline should read. See deadlineTone. */
export type DeadlineTone = 'quiet' | 'live' | 'urgent';

/**
 * How much attention a deadline is asking for, given when it is and what the
 * board is showing.
 *
 * The two loud rungs are measured against different clocks: 'urgent' against
 * TODAY, so an overdue thing stays loud on whatever week is paged to, and
 * 'live' against the week ON SCREEN.
 *
 * @param deadline the value stored on a Project or Task; any string. One that
 *     does not parse is 'quiet', matching a caller that renders nothing for it.
 * @param weekStart the Monday of the week the board is showing
 * @param today the DateKey of today
 * @param isDone whether the work this deadline belongs to is finished
 * @param frozen whether the week on screen has ended, and so is a record
 * @returns 'quiet' when isDone, when frozen, or when the deadline neither has
 *     passed nor falls inside weekStart's week; 'urgent' when its date is on or
 *     before today; 'live' otherwise. Time of day never decides.
 */
export function deadlineTone({
    deadline,
    weekStart,
    today,
    isDone,
    frozen,
}: {
    readonly deadline: string;
    readonly weekStart: DateKey;
    readonly today: DateKey;
    readonly isDone: boolean;
    readonly frozen: boolean;
}): DeadlineTone {
    if (isDone || frozen || !parseDeadline(deadline).ok) {
        return 'quiet';
    }
    const dueDay = deadline.slice(0, 10);
    if (dueDay <= today) {
        return 'urgent';
    }
    // DateKey is fixed-width, so string order is chronological order.
    const inViewedWeek = dueDay >= weekStart && dueDay <= dateKeyForDay(weekStart, 'sun');
    return inViewedWeek ? 'live' : 'quiet';
}
