/**
 * The clipboard format for copying part of a week and pasting it onto another.
 *
 * The unit is a bundle of projects, not a week: paste drops them onto whichever
 * week is on screen, and weekStart rides along only so the paste screen can say
 * where they came from.
 */

import { isValidWeekStart } from '@/core/dates';
import { LIMITS, fitsName, fitsNote } from '@/core/limits';
import { isValidProject } from '@/core/projects';
import { normalizeProjects } from '@/core/text';
import type { DateKey, Project, Subtask, Task } from '@/core/types';

/** Bump the suffix if the payload shape ever changes incompatibly. */
export const CLIPBOARD_FORMAT = 'beaverplans.week.v1';

export type ClipboardEnvelope = {
    readonly format: typeof CLIPBOARD_FORMAT;
    readonly weekStart: DateKey;
    readonly projects: ReadonlyArray<Project>;
};

/**
 * Why a paste could not be read. The first two mean the clipboard holds
 * something else entirely; 'malformed' means it IS a beaverplans copy, damaged
 * or from a version this one does not understand; the last two mean it reads
 * perfectly well but carries more than the caps in limits.ts allow.
 */
export type PasteFailure = 'not-json' | 'not-beaverplans' | 'malformed' | 'too-big' | 'too-long';

/**
 * How big a pasted plan is, in the three counts limits.ts caps. Maxima per
 * container, not totals, and no record of which container.
 */
export type PlanShape = {
    readonly projects: number;
    /** the most tasks any one project holds; 0 when there are no projects */
    readonly maxTasks: number;
    /** the most subtasks any one task holds; 0 when there are no tasks */
    readonly maxSubtasks: number;
};

export type PasteResult =
    | { readonly ok: true; readonly weekStart: DateKey; readonly projects: ReadonlyArray<Project> }
    | { readonly ok: false; readonly reason: 'too-big'; readonly shape: PlanShape }
    | { readonly ok: false; readonly reason: Exclude<PasteFailure, 'too-big'> };

/**
 * Serialize projects for the clipboard.
 *
 * @param weekStart the week they were copied from; any DateKey.
 * @param projects the chosen projects, in the order they should paste back.
 * @returns pretty-printed JSON carrying the format tag, weekStart and projects
 *     unchanged. parseProjects of the result returns those same projects.
 */
export function printProjects(weekStart: DateKey, projects: ReadonlyArray<Project>): string {
    const envelope: ClipboardEnvelope = { format: CLIPBOARD_FORMAT, weekStart, projects };
    return JSON.stringify(envelope, null, 2);
}

/**
 * Read projects back off the clipboard.
 *
 * @param text anything at all — this is whatever was pasted, including text that
 *     was never produced by this app.
 * @returns ok with the projects and the week they came from when text is a
 *     well-formed envelope whose weekStart is a Monday and whose every project
 *     satisfies isValidProject, sits within the counts in LIMITS, and carries
 *     names and notes within their caps; otherwise ok: false with the reason,
 *     and with the plan's shape when that reason is 'too-big'. Returned names
 *     and notes are in NFC, and the caps are measured on that form.
 *
 * Ids are NOT checked for uniqueness here: paste remints every id (see
 * withFreshIds), so a duplicate in the payload cannot survive to matter.
 */
export function parseProjects(text: string): PasteResult {
    let value: unknown;
    try {
        value = JSON.parse(text);
    } catch {
        return { ok: false, reason: 'not-json' };
    }

    if (
        typeof value !== 'object' ||
        value === null ||
        (value as { format?: unknown }).format !== CLIPBOARD_FORMAT
    ) {
        return { ok: false, reason: 'not-beaverplans' };
    }

    const { weekStart, projects } = value as { weekStart?: unknown; projects?: unknown };
    if (typeof weekStart !== 'string' || !isValidWeekStart(weekStart)) {
        return { ok: false, reason: 'malformed' };
    }
    if (!Array.isArray(projects)) {
        return { ok: false, reason: 'malformed' };
    }

    try {
        if (!projects.every((project: Project) => isValidProject(project))) {
            return { ok: false, reason: 'malformed' };
        }
    } catch {
        // isValidProject reaches into the shape it was handed; anything far
        // enough from a Project throws rather than answering false.
        return { ok: false, reason: 'malformed' };
    }

    // Composed before the caps are measured: NFD spends extra code units on
    // marks that fitsText would otherwise count against the name.
    const parsed = normalizeProjects(projects as ReadonlyArray<Project>);

    // Counts before lengths: a plan that breaks both reports 'too-big'.
    const shape = planShape(parsed);
    if (
        shape.projects > LIMITS.projectsPerWeek ||
        shape.maxTasks > LIMITS.tasksPerProject ||
        shape.maxSubtasks > LIMITS.subtasksPerTask
    ) {
        return { ok: false, reason: 'too-big', shape };
    }
    if (!parsed.every(fitsText)) {
        return { ok: false, reason: 'too-long' };
    }

    return { ok: true, weekStart, projects: parsed };
}

/**
 * The three counts limits.ts caps, measured off a pasted plan.
 *
 * @param projects any valid projects, including a collection over its caps.
 * @returns the number of projects, and the largest tasks-in-one-project and
 *     subtasks-in-one-task found. The two maxima are 0 when there is nothing to
 *     measure them on.
 */
export function planShape(projects: ReadonlyArray<Project>): PlanShape {
    const taskCounts = projects.map((project) => project.tasks.length);
    const subtaskCounts = projects.flatMap((project) =>
        project.tasks.map((task) => task.subtasks.length),
    );
    return {
        projects: projects.length,
        maxTasks: Math.max(0, ...taskCounts),
        maxSubtasks: Math.max(0, ...subtaskCounts),
    };
}

/**
 * Whether every name and note in a pasted project is within its cap.
 *
 * @param project any valid project.
 * @returns whether each project, task and subtask name fits LIMITS.nameLength
 *     and each description fits LIMITS.descriptionLength.
 */
export function fitsText(project: Project): boolean {
    return (
        fitsName(project.name) &&
        project.tasks.every(
            (task) =>
                fitsName(task.name) &&
                fitsNote(task.description ?? '') &&
                task.subtasks.every((subtask) => fitsNote(subtask.description ?? '')),
        )
    );
}

/**
 * The same tree with every id replaced.
 *
 * @param projects any valid projects; not mutated.
 * @param newId mints a fresh unique id on each call.
 * @returns projects identical in every respect except that each project, task
 *     and subtask carries a new id from newId.
 *
 * Weeks' rep invariant says an id identifies one node across the whole
 * collection, so a paste that skipped this would put one node in two weeks.
 */
export function withFreshIds(
    projects: ReadonlyArray<Project>,
    newId: () => string,
): ReadonlyArray<Project> {
    return projects.map((project) => ({
        ...project,
        id: newId(),
        tasks: project.tasks.map((task) => ({
            ...task,
            id: newId(),
            subtasks: task.subtasks.map((subtask) => ({ ...subtask, id: newId() })),
        })),
    }));
}

/**
 * The same tree with nothing ticked off.
 *
 * @param projects any valid projects; not mutated.
 * @returns projects identical except that every subtask has isDone false and no
 *     missed days, and every LEAF task has isDone false. A task with subtasks
 *     carries no isDone of its own and gains none.
 */
export function withoutProgress(projects: ReadonlyArray<Project>): ReadonlyArray<Project> {
    return projects.map((project) => ({
        ...project,
        tasks: project.tasks.map(clearTask),
    }));
}

function clearTask(task: Task): Task {
    const subtasks: ReadonlyArray<Subtask> = task.subtasks.map((subtask) => ({
        ...subtask,
        isDone: false,
        missedDays: [],
    }));
    if (subtasks.length === 0) return { ...task, isDone: false, subtasks };
    // Dropped, not set to undefined: the key would still exist, and a task with
    // subtasks is specified as carrying no isDone at all.
    const { isDone: _isDone, ...withoutDone } = task;
    return { ...withoutDone, subtasks };
}
