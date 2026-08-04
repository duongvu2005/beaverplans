import { describe, it, expect } from 'vitest';
import { diffWeeks } from './diffWeeks';
import type { WeekPlan, Weeks } from '../core/types';

describe('diffWeeks', () => {
    /*
     * Testing strategy
     *   partition on previous: empty | non-empty
     *   partition on next: empty | non-empty
     *   partition on a shared weekStart: same reference (untouched) |
     *     different reference (edited)
     *   partition on weekStart membership: only in previous (removed) |
     *     only in next (added) | in both
     *   partition on call shape: single-change | mixed (several changes at once)
     */

    const week1: WeekPlan = { weekStart: '2026-07-06', projects: [] };
    const week2: WeekPlan = { weekStart: '2026-07-13', projects: [] };
    const week3: WeekPlan = { weekStart: '2026-07-20', projects: [] };

    it('covers previous empty, next empty: no upserts, no deletes', () => {
        expect(diffWeeks([], [])).toEqual({ upserts: [], deletes: [] });
    });

    it('covers previous empty, next non-empty: every entry is an upsert, no deletes', () => {
        const next: Weeks = [week1, week2];
        expect(diffWeeks([], next)).toEqual({ upserts: [week1, week2], deletes: [] });
    });

    it('covers previous non-empty, next empty: every weekStart is a delete, no upserts', () => {
        const previous: Weeks = [week1, week2];
        expect(diffWeeks(previous, [])).toEqual({
            upserts: [],
            deletes: ['2026-07-06', '2026-07-13'],
        });
    });

    it('covers a shared weekStart with the same reference: not in upserts', () => {
        const previous: Weeks = [week1];
        const next: Weeks = [week1];
        expect(diffWeeks(previous, next)).toEqual({ upserts: [], deletes: [] });
    });

    it('covers a shared weekStart with a different reference: in upserts', () => {
        const previous: Weeks = [week1];
        const editedWeek1: WeekPlan = { weekStart: '2026-07-06', projects: [] };
        const next: Weeks = [editedWeek1];
        expect(diffWeeks(previous, next)).toEqual({ upserts: [editedWeek1], deletes: [] });
    });

    it('covers a weekStart only in previous: in deletes', () => {
        const previous: Weeks = [week1, week2];
        const next: Weeks = [week1];
        expect(diffWeeks(previous, next)).toEqual({ upserts: [], deletes: ['2026-07-13'] });
    });

    it('covers a weekStart only in next: in upserts', () => {
        const previous: Weeks = [week1];
        const next: Weeks = [week1, week2];
        expect(diffWeeks(previous, next)).toEqual({ upserts: [week2], deletes: [] });
    });

    it('covers a mixed call: one untouched, one edited, one added, one removed', () => {
        const editedWeek2: WeekPlan = { weekStart: '2026-07-13', projects: [] };
        const addedWeek: WeekPlan = { weekStart: '2026-07-27', projects: [] };
        const previous: Weeks = [week1, week2, week3];
        const next: Weeks = [week1, editedWeek2, addedWeek];
        expect(diffWeeks(previous, next)).toEqual({
            upserts: [editedWeek2, addedWeek],
            deletes: ['2026-07-20'],
        });
    });
});
