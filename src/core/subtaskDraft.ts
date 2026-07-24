/**
 * Pure operations on a task's subtasks while they are being edited in the task
 * editor, before the edit is committed with buildTask. These mirror the
 * WeekPlan-level producers in projects.ts, but operate directly on a bare
 * Subtask[] draft instead of locating a task inside a whole WeekPlan.
 */

import { moveBefore } from './list';
import type { DayOfWeek, Subtask } from './types';

/**
 * Add a new subtask to a draft, assigned to a given day.
 *
 * @param subtasks the current draft
 * @param day the day to assign the new subtask to
 * @param id the id of the new subtask, must be a new unique id
 * @returns a new draft with the same subtasks, plus a new subtask (assigned to
 *          day, no missed days, isDone = false, weight = 1) appended to the end
 */
export function addSubtaskOn(
    subtasks: readonly Subtask[],
    day: DayOfWeek,
    id: string,
): readonly Subtask[] {
    return [...subtasks, { id, isDone: false, assignedDay: day, missedDays: [], weight: 1 }];
}

/**
 * Remove one subtask from a draft.
 *
 * @param subtasks the current draft
 * @param id the id of the subtask to remove
 * @returns a new draft with the same subtasks, minus the one with id id, in the
 *          same order. If no subtask has that id, the draft is unchanged.
 */
export function removeSubtask(subtasks: readonly Subtask[], id: string): readonly Subtask[] {
    return subtasks.filter((s) => s.id !== id);
}

/**
 * Remove every subtask assigned to a given day from a draft.
 *
 * @param subtasks the current draft
 * @param day the day whose subtasks should be removed
 * @returns a new draft with every subtask whose assignedDay is day removed, the
 *          rest kept in the same order. If no subtask is assigned to day, the
 *          draft is unchanged.
 */
export function removeSubtasksOnDay(
    subtasks: readonly Subtask[],
    day: DayOfWeek,
): readonly Subtask[] {
    return subtasks.filter((s) => s.assignedDay !== day);
}

/**
 * Change the weight of one subtask in a draft.
 *
 * @param subtasks the current draft
 * @param id the id of the subtask to change
 * @param weight the new weight; must be 1, 2, or 3
 * @returns a new draft with the same subtasks, except the one with id id has
 *          its weight set to weight. If no subtask has that id, the draft is
 *          unchanged.
 */
export function setSubtaskWeight(
    subtasks: readonly Subtask[],
    id: string,
    weight: number,
): readonly Subtask[] {
    return subtasks.map((s) => (s.id === id ? { ...s, weight } : s));
}

/**
 * Change the note (description) of one subtask in a draft.
 *
 * @param subtasks the current draft
 * @param id the id of the subtask to change
 * @param note the new description, stored as given (including an empty string)
 * @returns a new draft with the same subtasks, except the one with id id has
 *          its description set to note. If no subtask has that id, the draft
 *          is unchanged.
 */
export function setSubtaskNote(
    subtasks: readonly Subtask[],
    id: string,
    note: string,
): readonly Subtask[] {
    return subtasks.map((s) => (s.id === id ? { ...s, description: note } : s));
}

/**
 * Reassign one subtask's day and reposition it within a draft.
 *
 * Retargets the subtask's day, then positions it in the flat draft. Each day
 * group in the editor renders subtasks.filter(assignedDay === day), and
 * filtering keeps relative order, so placing the subtask in the flat array
 * places it inside its group.
 *
 * @param subtasks the current draft
 * @param id the id of the subtask to move
 * @param day the day to reassign the subtask to
 * @param beforeId the id of the subtask that the moved subtask should end up
 *        immediately in front of, or null to move it to the end of the draft
 * @returns a new draft holding the same subtasks, each the same object except
 *          the one with id id (which has assignedDay set to day), positioned
 *          immediately before the subtask with id beforeId (or last, when
 *          beforeId is null). If no subtask has id id, the draft is unchanged.
 */
export function moveSubtaskInDraft(
    subtasks: readonly Subtask[],
    id: string,
    day: DayOfWeek,
    beforeId: string | null,
): readonly Subtask[] {
    return moveBefore(
        subtasks.map((s) => (s.id === id ? { ...s, assignedDay: day } : s)),
        id,
        beforeId,
    );
}
