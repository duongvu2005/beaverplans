import { isValidPlan } from '@/core/projects';
import type { WeekPlan } from '@/core/types';

/**
 * One row of the `planner_weeks` table, as read back from Supabase.
 * `projects` is untrusted (arbitrary JSON from an external source), not
 * assumed to already satisfy WeekPlan's rep invariant.
 */
export type PlannerWeekRow = {
    readonly week_start: string;
    readonly ended: boolean;
    readonly projects: unknown;
};

/**
 * Converts one persisted row into the WeekPlan it represents.
 *
 * @param row a row read from `planner_weeks`
 * @returns a WeekPlan with weekStart = row.week_start, ended = row.ended,
 *          and projects = row.projects, if that combination satisfies
 *          isValidPlan; otherwise the same weekStart/ended with
 *          projects = [] (a structurally invalid persisted shape falls
 *          back to empty for that week rather than propagating).
 */
export function rowToWeekPlan(row: PlannerWeekRow): WeekPlan {
    const candidate = {
        weekStart: row.week_start,
        projects: row.projects,
        ended: row.ended,
    } as WeekPlan;

    try {
        if (isValidPlan(candidate)) {
            return candidate;
        }
    } catch {
        // invalid
    }
    return {
        weekStart: row.week_start,
        projects: [],
        ended: row.ended,
    };
}

/**
 * Converts a WeekPlan into the row to upsert into `planner_weeks` for the
 * given user.
 *
 * @param userId the owning user's id, trusted from the caller's session
 * @param plan any valid WeekPlan (isValidPlan(plan))
 * @returns {user_id: userId, week_start: plan.weekStart,
 *           ended: plan.ended, projects: plan.projects}.
 *          Does not set updated_at — the database trigger overwrites it on
 *          every insert/update regardless of what's sent.
 */
export function weekPlanToRow(
    userId: string,
    plan: WeekPlan,
): { user_id: string; week_start: string; ended: boolean; projects: unknown } {
    return {
        user_id: userId,
        week_start: plan.weekStart,
        ended: plan.ended,
        projects: plan.projects,
    };
}
