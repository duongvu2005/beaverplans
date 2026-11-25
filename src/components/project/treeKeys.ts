import type { Project } from '@/core/types';

/** Keyboard editing for the project tree's name fields: the decision half only. The wiring lives in useTreeKeys. */

/** One name field in the tree, in the order the fields appear on screen. */
export type TreeRow =
    | { readonly kind: 'project'; readonly id: string }
    | { readonly kind: 'task'; readonly id: string; readonly projectId: string };

export type TreeKeyAction =
    /** afterTaskId null means append to the end of the project's tasks */
    | {
          readonly kind: 'insertTask';
          readonly projectId: string;
          readonly afterTaskId: string | null;
      }
    | { readonly kind: 'addProject' }
    | { readonly kind: 'removeRow'; readonly row: TreeRow }
    | { readonly kind: 'focus'; readonly id: string; readonly caret: 'start' | 'end' }
    | { readonly kind: 'blur' };

export type TreeKeyContext = {
    /** KeyboardEvent.key */
    readonly key: string;
    /** Cmd on a Mac, Ctrl elsewhere — resolved by the caller */
    readonly mod: boolean;
    readonly shift: boolean;
    /** caret at position 0 with nothing selected */
    readonly atStart: boolean;
    /** caret at the end of the value with nothing selected */
    readonly atEnd: boolean;
    readonly row: TreeRow;
    readonly sequence: ReadonlyArray<TreeRow>;
};

/**
 * The name fields of a project tree, flattened into the order they are rendered.
 *
 * @param projects any projects
 * @returns one row per project followed by one row per task of that project, in
 *     the projects' and tasks' own order.
 */
export function rowSequence(projects: ReadonlyArray<Project>): ReadonlyArray<TreeRow> {
    return projects.flatMap((project) => [
        { kind: 'project', id: project.id } as const,
        ...project.tasks.map(
            (task) => ({ kind: 'task', id: task.id, projectId: project.id }) as const,
        ),
    ]);
}

/**
 * What a keystroke in a name field should do.
 *
 * @param context the keystroke, the row it landed in, and where that row sits in
 *     the tree. `sequence` should contain `row`; if it does not, the arrow keys
 *     find no neighbour and answer undefined.
 * @returns the action to take, or undefined to let the browser handle the key
 *     normally — which is what every unbound key, and an arrow pressed away from
 *     the text boundary, must do.
 */
export function keyAction(context: TreeKeyContext): TreeKeyAction | undefined {
    const { key, mod, shift, atStart, atEnd, row, sequence } = context;

    if (key === 'Escape') return { kind: 'blur' };

    // Three keys deep: it removes a row whatever is typed in it.
    if (mod && shift && key === 'Backspace') return { kind: 'removeRow', row };

    if (mod && key === 'Enter') return { kind: 'addProject' };

    if (key === 'Enter') {
        return row.kind === 'project'
            ? { kind: 'insertTask', projectId: row.id, afterTaskId: null }
            : { kind: 'insertTask', projectId: row.projectId, afterTaskId: row.id };
    }

    // Only at the boundary, so arrows still move within a long title.
    if (key === 'ArrowUp' && atStart) {
        const previous = sequence[sequence.findIndex((r) => r.id === row.id) - 1];
        return previous === undefined
            ? undefined
            : { kind: 'focus', id: previous.id, caret: 'start' };
    }
    if (key === 'ArrowDown' && atEnd) {
        const index = sequence.findIndex((r) => r.id === row.id);
        const next = index === -1 ? undefined : sequence[index + 1];
        return next === undefined ? undefined : { kind: 'focus', id: next.id, caret: 'end' };
    }

    return undefined;
}
