/**
 * Guest -> cloud migration: folding a guest's locally-stored Weeks into a
 * signed-in account's cloud Weeks, the first time the two might have
 * diverged (worked as a guest on this device, then signed in to an account
 * that already has its own cloud data).
 *
 * Nothing is matched by name or content and no field is reconciled: a guest week
 * lands wholesale on a weekStart the cloud does not have, and on one it does the
 * guest's projects are appended below the cloud's own. A project worked on from
 * both places ends up twice, for the user to untangle.
 */

import type { DateKey, Project, Subtask, Task, WeekPlan, Weeks } from '@/core/types';
import { putWeek, reopenWeek, weekAt } from '@/core/weeks';

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
 * @param reopenEnded whether an ended week at this weekStart may be reopened
 *          to receive the work.
 * @returns cloudWeeks unchanged except at guestWeek.weekStart: if cloudWeeks
 *          has no entry there, guestWeek is stored as-is (own ended flag and
 *          all); if it does, the stored entry keeps every field of the
 *          existing one except projects, which becomes the existing
 *          projects followed by guestWeek's. When the existing entry is ended,
 *          reopenEnded decides: true clears its ended flag so the work lands,
 *          false leaves it frozen and putWeek's own guard drops the guest's
 *          projects for that week (see endedCollisions, which is how a caller
 *          finds that out BEFORE calling this).
 */
function foldWeek(cloudWeeks: Weeks, guestWeek: WeekPlan, reopenEnded: boolean): Weeks {
    const existing = cloudWeeks.find((week) => week.weekStart === guestWeek.weekStart);
    if (existing === undefined) return putWeek(cloudWeeks, guestWeek);

    // Through reopenWeek, not by writing ended: false here — putWeek's guard
    // reads the STORED entry, so clearing the flag on the way in changes nothing.
    const weeks =
        existing.ended && reopenEnded ? reopenWeek(cloudWeeks, existing.weekStart) : cloudWeeks;
    // Re-read rather than spreading `existing`, which still carries the flag
    // reopenWeek has just cleared in the collection.
    const target = weekAt(weeks, guestWeek.weekStart);
    return putWeek(weeks, { ...target, projects: [...target.projects, ...guestWeek.projects] });
}

/**
 * The weeks a merge cannot land on without reopening them.
 *
 * @param cloudWeeks any valid Weeks (isValidWeeks(cloudWeeks))
 * @param guestWeeks any valid Weeks (isValidWeeks(guestWeeks))
 * @returns the weekStarts, in guestWeeks' own order, where the guest holds at
 *          least one project and cloudWeeks already has an ENDED week. Merging
 *          without reopening these drops exactly this work; merging with
 *          reopenEnded true keeps it.
 */
export function endedCollisions(cloudWeeks: Weeks, guestWeeks: Weeks): ReadonlyArray<DateKey> {
    return guestWeeks
        .filter((guestWeek) => {
            if (guestWeek.projects.length === 0) return false;
            const existing = cloudWeeks.find((week) => week.weekStart === guestWeek.weekStart);
            return existing !== undefined && existing.ended;
        })
        .map((guestWeek) => guestWeek.weekStart);
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
 * @param reopenEnded whether an ended cloud week may be reopened to receive
 *        guest work landing on it. False drops that work (the frozen archive
 *        wins); true keeps it and un-ends the week. Defaults to false, so a
 *        caller has to say out loud that it has asked.
 * @returns cloudWeeks with every entry of guestWeeks folded in in order (see
 *          foldWeek for the per-week rule)
 */
export function mergeGuestWeeks(
    cloudWeeks: Weeks,
    guestWeeks: Weeks,
    newId: () => string,
    reopenEnded = false,
): Weeks {
    return guestWeeks.reduce(
        (weeks, guestWeek) => foldWeek(weeks, reIdWeek(guestWeek, newId), reopenEnded),
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
