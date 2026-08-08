/**
 * Guest -> cloud migration: folding a guest's locally-stored Weeks into a
 * signed-in account's cloud Weeks, the first time the two might have
 * diverged (worked as a guest on this device, then signed in to an account
 * that already has its own cloud data).
 *
 * The merge is deliberately dumb, by design: no field is reconciled and
 * nothing is matched by name or content. A guest week lands wholesale on a
 * weekStart the cloud doesn't have; on one it does, the guest's projects are
 * appended below the cloud's own, as a fresh set of projects sitting side by
 * side with whatever was already there. Untangling an accidental duplicate
 * (the same project worked on from two places) is left to the app's own
 * drag-and-drop, which can already move tasks between projects — nothing
 * here tries to guess which tasks "are" the same one.
 */

import type { Project, Subtask, Task, WeekPlan, Weeks } from '@/core/types';
import { putWeek } from '@/core/weeks';

function reIdSubtask(subtask: Subtask, newId: () => string): Subtask {
    return { ...subtask, id: newId() };
}

function reIdTask(task: Task, newId: () => string): Task {
    return { ...task, id: newId(), subtasks: task.subtasks.map((s) => reIdSubtask(s, newId)) };
}

function reIdProject(project: Project, newId: () => string): Project {
    return { ...project, id: newId(), tasks: project.tasks.map((t) => reIdTask(t, newId)) };
}

function reIdWeek(plan: WeekPlan, newId: () => string): WeekPlan {
    return { ...plan, projects: plan.projects.map((p) => reIdProject(p, newId)) };
}

/**
 * Fold one already re-identified guest week into the cloud collection.
 *
 * @param cloudWeeks any valid Weeks (isValidWeeks(cloudWeeks))
 * @param guestWeek one guest week, every id already unique from cloudWeeks
 * @returns cloudWeeks unchanged except at guestWeek.weekStart: if cloudWeeks
 *          has no entry there, guestWeek is stored as-is (own ended flag and
 *          all); if it does, the stored entry keeps every field of the
 *          existing one except projects, which becomes the existing
 *          projects followed by guestWeek's. When the existing entry is
 *          already ended, putWeek's own guard leaves it untouched — an
 *          ended week is frozen, so the guest's projects for that week are
 *          silently dropped rather than reopening it.
 */
function foldWeek(cloudWeeks: Weeks, guestWeek: WeekPlan): Weeks {
    const existing = cloudWeeks.find((week) => week.weekStart === guestWeek.weekStart);
    const toStore =
        existing === undefined
            ? guestWeek
            : { ...existing, projects: [...existing.projects, ...guestWeek.projects] };
    return putWeek(cloudWeeks, toStore);
}

/**
 * Fold a guest's whole Weeks collection into a signed-in account's cloud
 * Weeks.
 *
 * @param cloudWeeks any valid Weeks (isValidWeeks(cloudWeeks))
 * @param guestWeeks any valid Weeks (isValidWeeks(guestWeeks))
 * @param newId supplies a fresh id for every project, task, and subtask
 *        carried over from guestWeeks, so the result's ids stay globally
 *        unique even where guestWeeks and cloudWeeks happened to share one.
 *        Not deterministic unless a fake is passed.
 * @returns cloudWeeks with every entry of guestWeeks folded in in order (see
 *          foldWeek for the per-week rule)
 */
export function mergeGuestWeeks(cloudWeeks: Weeks, guestWeeks: Weeks, newId: () => string): Weeks {
    return guestWeeks.reduce(
        (weeks, guestWeek) => foldWeek(weeks, reIdWeek(guestWeek, newId)),
        cloudWeeks,
    );
}

/** Which of the two migration paths applies, or none. */
export type MigrationPath = 'auto' | 'prompt' | 'none';

/**
 * Which migration path applies, given what's known about a signed-in
 * account's cloud data and this browser's guest data.
 *
 * @param cloudEmpty whether the signed-in account's cloud Weeks holds no data
 * @param hasLocalData whether this browser holds guest data
 * @returns 'auto' when the account is brand new (cloudEmpty) and there is
 *          guest work to carry in — nothing to conflict with, so no prompt
 *          is needed; 'prompt' when the account already has data of its own,
 *          so the user should decide before guest work is folded in;
 *          'none' when there is no guest data to do anything with
 */
export function decideMigration(cloudEmpty: boolean, hasLocalData: boolean): MigrationPath {
    if (!hasLocalData) return 'none';
    return cloudEmpty ? 'auto' : 'prompt';
}
