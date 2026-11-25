/**
 * The first-week guide's state, derived from what is on the board rather than
 * stored.
 *
 * Nothing here decides how the guide LOOKS, or which week deserves one — the
 * step alone is derived here, and the view pairs it with the week on screen.
 */
import type { Project } from './types';

/** The three levels of the model, in the order they have to be built. */
export type StepName = 'project' | 'task' | 'days';

/**
 * The step the board is on, and the node the step's one action acts on.
 *
 * `unnamed` is the row this step's action already made and nobody has named yet.
 * Its presence turns the action from "make one" into "go back to the one
 * waiting".
 */
export type Welcome =
    | { readonly step: 'project'; readonly unnamed: string | undefined }
    | {
          readonly step: 'task';
          readonly projectId: string;
          readonly projectName: string;
          readonly unnamed: string | undefined;
      }
    | { readonly step: 'days'; readonly taskId: string };

/**
 * The control the guide is pointing at — the user's next real interaction.
 *
 * Every one of these is a control the board already has; the guide owns none of
 * them.
 */
export type WelcomeCue =
    | { readonly kind: 'addProject' }
    | { readonly kind: 'projectName'; readonly projectId: string }
    | { readonly kind: 'addTask'; readonly projectId: string }
    | { readonly kind: 'taskName'; readonly taskId: string }
    | { readonly kind: 'editTask'; readonly taskId: string };

/**
 * Which control the given step wants pressed or typed into next.
 *
 * @param welcome any step
 * @returns the row's own name field when that step has made a row and is waiting
 *     for it to be named, and otherwise the control that makes one. The 'days'
 *     step points at the editor button of the task it names.
 */
export function welcomeCue(welcome: Welcome): WelcomeCue {
    if (welcome.step === 'days') return { kind: 'editTask', taskId: welcome.taskId };
    if (welcome.step === 'project') {
        return welcome.unnamed === undefined
            ? { kind: 'addProject' }
            : { kind: 'projectName', projectId: welcome.unnamed };
    }
    return welcome.unnamed === undefined
        ? { kind: 'addTask', projectId: welcome.projectId }
        : { kind: 'taskName', taskId: welcome.unnamed };
}

function named(name: string): boolean {
    return name.trim() !== '';
}

/**
 * Which step of the guide the board is still on.
 *
 * Advancing is gated on a NAME, not on a row existing, so a blank row that was
 * just added — or one whose title is half typed — does not move the guide on.
 * The two gates are independent: a named task under an unnamed project still
 * leaves the board on 'project'.
 *
 * @param projects any valid list of projects
 * @param editingId  any id, or undefined for none. A row whose name field is
 *     still being typed in: its name does not count until editing ends, so the
 *     guide holds its step instead of advancing on the first character and
 *     moving the cue off the field the user is in.
 * @returns undefined if any subtask exists anywhere in `projects` — the week has
 *     something scheduled and the guide is over. Otherwise the step still to do:
 *     'project' if no project is named; 'task' if one is, carrying the first
 *     named project (the one a task would be added to); 'days' if a named task
 *     exists too, carrying the first named task (the one to slice). The first
 *     two also carry `unnamed`: the id of a row of that kind already made and
 *     still blank — for 'task', blank only counts inside the project the step
 *     names, since that is the only project its button would add to.
 */
export function welcomeStep(
    projects: ReadonlyArray<Project>,
    editingId?: string,
): Welcome | undefined {
    const settled = (node: { id: string; name: string }) =>
        node.id !== editingId && named(node.name);
    const tasks = projects.flatMap((project) => project.tasks);
    if (tasks.some((task) => task.subtasks.length > 0)) return undefined;
    const project = projects.find(settled);
    if (project === undefined) {
        return { step: 'project', unnamed: projects.find((p) => !settled(p))?.id };
    }
    const task = tasks.find(settled);
    if (task === undefined) {
        return {
            step: 'task',
            projectId: project.id,
            projectName: project.name,
            unnamed: project.tasks.find((t) => !settled(t))?.id,
        };
    }
    return { step: 'days', taskId: task.id };
}
