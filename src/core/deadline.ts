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
    // check for empty string
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
    // allow for 4-digit years only
    if (year < 1000 || year > 9999) {
        return { ok: false, reason: 'invalid' };
    }

    const hasTime = match[4] !== undefined && match[5] !== undefined && match[6] !== undefined;
    // match[5] and match[6] cannot be undefined if hasTime is true
    const hour = hasTime ? parseInt(match[5]!, 10) : 23;
    const minute = hasTime ? parseInt(match[6]!, 10) : 59;

    const localDate = new Date(year, month - 1, day, hour, minute, 0, 0);

    // check for valid month/day/hour/minute
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
