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
        { done: 0, total: 0 },
    );
    return { done, total };
}

export function projectProgress(project: Project) : Progress {
    throw new Error('unimplemented');
}

export function overallProgress(projects: ReadonlyArray<Project>): Progress {
    throw new Error('unimplemented');
}

export function progressByDay(projects: ReadonlyArray<Project>): ReadonlyArray<DayProgress> {
    throw new Error('unimplemented');
}