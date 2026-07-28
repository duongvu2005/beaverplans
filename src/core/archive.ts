import { isTaskDone } from "./projects";
import type { Archive, WeekPlan, DateKey } from "./types";

/**
 * Records plan as a newly-archived week.
 *
 * @param archive the current archive
 * @param plan the week being ended; requires plan.weekStart is not already
 *        the weekStart of any entry in archive
 * @returns a new archive containing every entry of archive plus plan, in
 *          unspecified order
 */
export function archiveWeek(archive: Archive, plan: WeekPlan): Archive {
    return [...archive, plan];
}

/**
 * Orders an archive for display, newest week first.
 *
 * @param archive the archive to order
 * @returns a new array holding every entry of archive, sorted by weekStart
 *          descending. DateKey's fixed-width YYYY-MM-DD shape makes string
 *          order agree with chronological order, so no date parsing is needed.
 */
export function archiveNewestFirst(archive: Archive): Archive {
    return [...archive].sort((a, b) => b.weekStart.localeCompare(a.weekStart));
}

/**
 * Removes an archived week.
 *
 * @param archive the current archive
 * @param weekStart the weekStart identifying the entry to remove
 * @returns a new archive holding every entry of archive except one whose
 *          weekStart is weekStart, in the same relative order; equal in
 *          contents to archive if no entry has that weekStart
 */
export function removeArchived(archive: Archive, weekStart: DateKey): Archive {
    return archive.filter((entry) => entry.weekStart !== weekStart);
}

/**
 * Carries a plan's unfinished work forward into a new week, dropping
 * everything that was finished.
 *
 * @param plan the plan being ended, in its full, unstripped form — any
 *        recording of finished work (e.g. via archiveWeek) is expected to
 *        have already happened before this is called
 * @param newWeekStart the week-start the carried-forward plan is anchored to
 * @returns a new plan, weekStart set to newWeekStart, keeping only the
 *          undone tasks of each project (a task-with-subtasks keeps just
 *          its undone subtasks, missedDays reset to []) and only the
 *          projects that still have a task left. Ids are preserved.
 */
export function carryUnfinished(plan: WeekPlan, newWeekStart: DateKey): WeekPlan {
    return {
        weekStart: newWeekStart,
        projects: plan.projects
            .map(project => ({
                ...project,
                tasks: project.tasks
                    .filter(task => !isTaskDone(task))
                    .map(task => ({
                        ...task,
                        subtasks: task.subtasks
                            .filter(s => !s.isDone)
                            .map(s => ({
                                ...s,
                                missedDays: []
                            }))
                    }))
            }))
            .filter(project => project.tasks.length !== 0)
    };
}
