import { describe, it, expect } from 'vitest';
import { rowToWeekPlan, weekPlanToRow, type PlannerWeekRow } from './plannerWeekRow';
import type { WeekPlan } from '../core/types';

describe('rowToWeekPlan', () => {
    /*
     * Testing strategy
     *   partition on ended: true | false
     *   partition on projects: empty | non-empty valid | fails isValidPlan
     *     (domain reason, e.g. duplicate ids) | garbage shape (not array-like,
     *     isValidPlan itself throws)
     */

    it('covers a valid row with ended true: translates straight through', () => {
        const row: PlannerWeekRow = {
            week_start: '2026-07-06',
            ended: true,
            projects: [{ id: 'p1', name: 'Errands', tasks: [] }],
        };
        expect(rowToWeekPlan(row)).toEqual({
            weekStart: '2026-07-06',
            ended: true,
            projects: [{ id: 'p1', name: 'Errands', tasks: [] }],
        });
    });

    it('covers a valid row with ended false: translates straight through', () => {
        const row: PlannerWeekRow = {
            week_start: '2026-07-13',
            ended: false,
            projects: [{ id: 'p1', name: 'Essays', tasks: [] }],
        };
        expect(rowToWeekPlan(row)).toEqual({
            weekStart: '2026-07-13',
            ended: false,
            projects: [{ id: 'p1', name: 'Essays', tasks: [] }],
        });
    });

    it('covers a row with empty projects: translates straight through', () => {
        const row: PlannerWeekRow = { week_start: '2026-07-13', ended: false, projects: [] };
        expect(rowToWeekPlan(row)).toEqual({ weekStart: '2026-07-13', ended: false, projects: [] });
    });

    it('covers a row whose projects fails isValidPlan (duplicate ids): falls back to empty projects', () => {
        const row: PlannerWeekRow = {
            week_start: '2026-07-13',
            ended: false,
            projects: [
                { id: 'dup', name: 'A', tasks: [] },
                { id: 'dup', name: 'B', tasks: [] },
            ],
        };
        expect(rowToWeekPlan(row)).toEqual({ weekStart: '2026-07-13', ended: false, projects: [] });
    });

    it('covers a row whose projects is a garbage shape (not array-like): falls back to empty projects, no throw', () => {
        const row: PlannerWeekRow = {
            week_start: '2026-07-13',
            ended: false,
            projects: 'not-an-array',
        };
        expect(() => rowToWeekPlan(row)).not.toThrow();
        expect(rowToWeekPlan(row)).toEqual({ weekStart: '2026-07-13', ended: false, projects: [] });
    });
});

describe('weekPlanToRow', () => {
    /*
     * Testing strategy
     *   partition on plan.ended: true | false
     *   partition on checked field: user_id | updated_at absence
     */

    const basePlan: WeekPlan = {
        weekStart: '2026-07-13',
        ended: false,
        projects: [{ id: 'p1', name: 'Essays', tasks: [] }],
    };

    it('covers a plan with ended true: row.ended is true', () => {
        const plan: WeekPlan = { ...basePlan, ended: true };
        expect(weekPlanToRow('user-1', plan)).toEqual({
            user_id: 'user-1',
            week_start: '2026-07-13',
            ended: true,
            projects: basePlan.projects,
        });
    });

    it('covers a plan with ended false explicit: row.ended is false', () => {
        const plan: WeekPlan = { ...basePlan, ended: false };
        expect(weekPlanToRow('user-1', plan)).toEqual({
            user_id: 'user-1',
            week_start: '2026-07-13',
            ended: false,
            projects: basePlan.projects,
        });
    });

    it('covers user_id: matches whatever userId was passed in', () => {
        expect(weekPlanToRow('a-different-user', basePlan).user_id).toBe('a-different-user');
    });

    it('covers updated_at: never included in the returned row', () => {
        expect(weekPlanToRow('user-1', basePlan)).not.toHaveProperty('updated_at');
    });
});
