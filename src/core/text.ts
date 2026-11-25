import type { Project, Subtask, Task } from './types';

/**
 * Put text into Unicode's composed normal form.
 *
 * Unicode writes `ắ` either as one code point or as `a` plus two combining
 * marks. The two render alike but are different strings, so the decomposed form
 * breaks equality, sorting and search — and the font's Vietnamese subset carries
 * the tone marks but not the base-letter ones (breve, circumflex, horn), so it
 * also renders in the fallback face.
 *
 * @param text any string.
 * @returns text in NFC: canonically equivalent, never longer.
 */
export function toNFC(text: string): string {
    return text.normalize('NFC');
}

function normalizeSubtask(subtask: Subtask): Subtask {
    return subtask.description === undefined
        ? subtask
        : { ...subtask, description: toNFC(subtask.description) };
}

function normalizeTask(task: Task): Task {
    return {
        ...task,
        name: toNFC(task.name),
        subtasks: task.subtasks.map(normalizeSubtask),
        ...(task.description === undefined ? {} : { description: toNFC(task.description) }),
    };
}

/**
 * Compose every piece of text a plan's projects carry.
 *
 * For text arriving in bulk from outside, where the per-field setters never ran.
 *
 * @param projects any projects.
 * @returns the same projects with each name and description in NFC, and every
 *          other field — ids, days, weights, flags, order — unchanged.
 */
export function normalizeProjects(projects: ReadonlyArray<Project>): ReadonlyArray<Project> {
    return projects.map((project) => ({
        ...project,
        name: toNFC(project.name),
        tasks: project.tasks.map(normalizeTask),
    }));
}
