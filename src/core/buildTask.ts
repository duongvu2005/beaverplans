import type { Task, Subtask } from './types';
import { parseDeadline } from './deadline';

export type TaskEdits = {
    readonly description: string;
    readonly subtasks: readonly Subtask[];
    readonly deadline: string | undefined; // 'YYYY-MM-DD' or '…THH:MM', undefined = none
};

/**
 * Assemble an edited task from base identity plus edited fields.
 *
 * @param base supplies the task's id and name, and — when the result is a leaf —
 *             its previous isDone
 * @param edits the edited fields: description (trimmed, omitted when blank), subtasks
 *              (in order), and deadline (stored as given, omitted when undefined/empty/invalid)
 * @returns a task with base's id and name; deadline set to edits.deadline when it is a
 *          non-empty string, else absent; description set to the trimmed value, else
 *          absent. If subtasks is non-empty the task holds them and has no isDone; if
 *          empty the task is a leaf whose isDone is base's previous isDone when base was
 *          already a leaf, else false.
 */
export function buildTask(base: Task, edits: TaskEdits): Task {
    const description = edits.description.trim();
    const isLeaf = edits.subtasks.length === 0;
    const wasLeaf = base.isDone !== undefined;
    const isDoneLeaf = isLeaf && wasLeaf ? base.isDone : false;
    const deadlineIsValid = edits.deadline && parseDeadline(edits.deadline).ok;

    return {
        id: base.id,
        name: base.name,
        subtasks: edits.subtasks,
        ...(isLeaf ? { isDone: isDoneLeaf } : {}),
        ...(deadlineIsValid ? { deadline: edits.deadline } : {}),
        ...(description ? { description } : {}),
    };
}
