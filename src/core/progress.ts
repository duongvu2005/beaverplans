/**
 * Progress of the project tree, measured in WEIGHTED EFFORT rather than raw counts.
 *
 * Each subtask carries a weight (1..3); it contributes that weight to the effort
 * total, and the same weight to the done amount when it is complete. So a done
 * weight-3 subtask counts as 3 units done out of 3; an undone one as 0 out of 3.
 * A task with no subtasks (a leaf) counts as a single unit of weight 1 — done iff
 * its isDone — so an undated task is still measurable and tickable.
 *
 * Progress composes by SUMMING {done, total} pairs up the tree: a project's progress
 * is the sum of its tasks', and the overall is the sum of all projects'. Percentages
 * are never stored or summed (you cannot average percentages — 1/2 and 1/100 average
 * to neither their combined 2/102); pct is derived only at the edge from a final
 * done/total pair via math.percent.
 */
import type { Project, Task, DayOfWeek } from "./types";

// progress types
export type Progress = { 
    readonly done: number;
    readonly total: number;
};
export type DayProgress = {
    readonly day: DayOfWeek;
    readonly assigned: number;  // include misses
    readonly done: number;
};

/**
 * Calculates the progress of a task.
 * 
 * @param task any valid task
 * @returns the task's weighted progress as a Progress, where `total` is the task's
 *          total weighted effort and `done` is the weighted effort that is complete
 */
export function taskProgress(task: Task) : Progress {
    if (task.subtasks.length === 0) {
        return { done: task.isDone ? 1 : 0, total: 1 };
    }
    const { done, total } = task.subtasks.reduce(
        (acc, s) => ({
            done: acc.done + (s.isDone ? s.weight : 0),
            total: acc.total + s.weight
        }),
        { done: 0, total: 0 }
    );
    return { done, total };
}

/**
 * Calculates the progress of a project
 * 
 * @param project any valid project
 * @returns the project's weighted progress as a Progress, where `total` is the project's
 *          total weighted effort and `done` is the weighted effort that is complete
 */
export function projectProgress(project: Project) : Progress {
    const { done, total } = project.tasks.reduce(
        (acc, task) => {
            const progress = taskProgress(task);
            return ({
                done: acc.done + progress.done,
                total: acc.total + progress.total
            });
        },
        { done: 0, total: 0 }
    );
    return { done, total };
}

/**
 * Calculate the overall progress of a list of projects.
 * 
 * @param projects any valid list of projects
 * @returns the overall weighted progress as a Progress, where `total` is the overall
 *          total weighted effort and `done` is the weighted effort that is complete
 */
export function overallProgress(projects: ReadonlyArray<Project>): Progress {
    const { done, total } = projects.reduce(
        (acc, project ) => {
            const progress = projectProgress(project);
            return ({
                done: acc.done + progress.done,
                total: acc.total + progress.total
            })
        },
        { done: 0, total: 0 }
    );
    return { done, total };
}

/**
 * Calculate the per day (mon-sun) progress of a list of projects.
 *
 * @param projects any valid list of projects
 * @returns a list of weighted day progress, each a DayProgress, one for each day
 *          of the week. For each, `day` is the weekday it describes, `assigned` is
 *          the weighted effort assigned to that day (including subtasks that recorded
 *          a miss on that day), and `done` is the weighted effort assigned to that day
 *          AND completed (a recorded miss adds to `assigned` but never to `done`).
 *          The list is ordered Monday first through Sunday last (length 7).
 */
export function progressByDay(projects: ReadonlyArray<Project>): ReadonlyArray<DayProgress> {
    const weekDays: Array<DayOfWeek> = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
    const weekProgress: Record<DayOfWeek, { assigned: number; done: number }> = {
        mon: { assigned: 0, done: 0 },
        tue: { assigned: 0, done: 0 },
        wed: { assigned: 0, done: 0 },
        thu: { assigned: 0, done: 0 },
        fri: { assigned: 0, done: 0 },
        sat: { assigned: 0, done: 0 },
        sun: { assigned: 0, done: 0 },
    };
    const allSubtasks = projects.flatMap(p => p.tasks.flatMap(t => t.subtasks));
    for (const subtask of allSubtasks) {
        // assigned (missed + currently assigned)
        for (const day of subtask.missedDays) {
            weekProgress[day].assigned += subtask.weight;
        }
        weekProgress[subtask.assignedDay].assigned += subtask.weight;
        // done
        if (subtask.isDone) {
            weekProgress[subtask.assignedDay].done += subtask.weight;
        }
    }
    return weekDays.map(day => ({day, ...weekProgress[day]}));
}
