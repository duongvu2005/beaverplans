/**
 * How big a plan is allowed to get.
 *
 * These caps are the friendly layer. The hard guarantee is a pair of CHECK
 * constraints in Postgres, whose ceilings are mirrored below.
 *
 * They are NOT part of isValidPlan / isValidWeeks: a cap in the rep invariant
 * would make an already-stored over-cap week fail to load. They are enforced
 * where nodes are created, while the bulk paths (carryForward, mergeGuest) may
 * exceed them — so every function here copes with a collection already over
 * its cap.
 *
 * Name and note lengths are enforced by maxLength on the inputs and by the
 * predicates below, which is what the paste path uses; not by the producers in
 * projects.ts.
 */
import type { Project, Subtask } from './types';

export const LIMITS = {
    projectsPerWeek: 50,
    tasksPerProject: 100,
    subtasksPerTask: 50,
    /** UTF-16 code units, matching how a maxLength attribute counts */
    nameLength: 200,
    descriptionLength: 10_000,

    /** the Postgres CHECK on jsonb_array_length(projects) */
    dbProjectsPerWeek: 200,
    /** the Postgres CHECK on pg_column_size(projects), in bytes */
    dbProjectsBytes: 1_048_576,
} as const;

/**
 * How many more projects fit in a week.
 *
 * @param projects a week's projects, possibly already over the cap.
 * @returns the number of projects that may still be added before
 *          LIMITS.projectsPerWeek is reached, never below 0.
 */
export function projectRoom(projects: ReadonlyArray<Project>): number {
    return Math.max(0, LIMITS.projectsPerWeek - projects.length);
}

/**
 * How many more tasks fit in a project.
 *
 * @param project any project, including one already over the cap.
 * @returns the number of tasks that may still be added before
 *          LIMITS.tasksPerProject is reached, never below 0.
 */
export function taskRoom(project: Project): number {
    return Math.max(0, LIMITS.tasksPerProject - project.tasks.length);
}

/**
 * How many more subtasks fit in a task.
 *
 * @param subtasks the editor's draft, which is where subtasks are added.
 * @returns the number of subtasks that may still be added before
 *          LIMITS.subtasksPerTask is reached, never below 0.
 */
export function subtaskRoom(subtasks: ReadonlyArray<Subtask>): number {
    return Math.max(0, LIMITS.subtasksPerTask - subtasks.length);
}

/**
 * Whether a project or task name is within the cap.
 *
 * @param name any string.
 * @returns whether name is at most LIMITS.nameLength UTF-16 code units long.
 */
export function fitsName(name: string): boolean {
    return name.length <= LIMITS.nameLength;
}

/**
 * Whether a task or subtask note is within the cap.
 *
 * @param note any string; newlines count like any other character.
 * @returns whether note is at most LIMITS.descriptionLength UTF-16 code units long.
 */
export function fitsNote(note: string): boolean {
    return note.length <= LIMITS.descriptionLength;
}
