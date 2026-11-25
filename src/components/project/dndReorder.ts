import { arrayMove } from '@dnd-kit/sortable';
import { canMoveSubtaskTo, reorderTaskIn } from '@/core/projects';
import { moveSubtaskInDraft } from '@/core/subtaskDraft';
import type { DayOfWeek, Project, Subtask } from '@/core/types';

// Translates dnd-kit's "the pointer was over this item" into core/'s `beforeId`:
// the id the moved item should end up immediately in front of, null for the end.

// destIds  the current id order of the destination container.
//          Same-container move: destIds includes activeId.
//          Cross-container move: destIds does not include activeId.
// overId   the id under the pointer: an item id in destIds, or null when the
//          drop landed on the container itself (its empty area / the end).
export function beforeIdForDrop(
    destIds: readonly string[],
    activeId: string,
    overId: string | null,
): string | null {
    if (overId === null) {
        return null; // dropped on the container: append to the end
    }
    if (destIds.includes(activeId)) {
        // Same container: mirror dnd-kit's own arrayMove(from, over), so the
        // committed order matches the preview the other rows animated to.
        const from = destIds.indexOf(activeId);
        const to = destIds.indexOf(overId);
        if (from === -1 || to === -1) {
            return null;
        }
        const moved = arrayMove([...destIds], from, to);
        const next = moved[moved.indexOf(activeId) + 1];
        return next ?? null;
    }
    // Cross container: land immediately in front of the item dropped onto.
    return overId;
}

// --- drop decisions ---

/** What a drag-over should do to the editor's state. */
export type SubtaskDragOver =
    /** Stale drag: leave every piece of state alone. */
    | { readonly kind: 'ignore' }
    /** The target day is at or before a day this subtask already missed. */
    | { readonly kind: 'blocked' }
    /** Already on that day — highlight it, but let dnd-kit open the gap. */
    | { readonly kind: 'sameDay'; readonly day: DayOfWeek }
    /** Crossed into another day: highlight it and show the subtask there. */
    | {
          readonly kind: 'moved';
          readonly day: DayOfWeek;
          readonly preview: readonly Subtask[];
      };

/**
 * Decide what dragging a subtask over a day should show.
 *
 * @param base the draft as it currently reads — the live preview while one is up,
 *        otherwise the committed subtasks
 * @param activeId the id of the subtask under the cursor
 * @param day the day being dragged over
 * @param overId the id of the subtask the pointer is over, or null when the
 *        pointer is over the day itself rather than a row in it
 * @returns the state change to apply; see SubtaskDragOver. Never mutates base.
 */
export function subtaskDragOver(
    base: readonly Subtask[],
    activeId: string,
    day: DayOfWeek,
    overId: string | null,
): SubtaskDragOver {
    const dragged = base.find((s) => s.id === activeId);
    if (dragged === undefined) {
        return { kind: 'ignore' };
    }
    if (!canMoveSubtaskTo(dragged, day)) {
        return { kind: 'blocked' };
    }
    if (dragged.assignedDay === day) {
        return { kind: 'sameDay', day };
    }
    const destIds = base.filter((s) => s.assignedDay === day).map((s) => s.id);
    return {
        kind: 'moved',
        day,
        preview: moveSubtaskInDraft(
            base,
            activeId,
            day,
            beforeIdForDrop(destIds, activeId, overId),
        ),
    };
}

/**
 * Decide the draft to commit when a subtask is dropped.
 *
 * @param base the draft the user is looking at — the preview if there is one, in
 *        which the subtask already sits on its destination day
 * @param activeId the id of the subtask being dropped
 * @param day the day it was dropped on
 * @param overId the id of the subtask it was dropped onto, or null for the day
 * @returns the next draft, or null when nothing should be committed — a stale
 *          drag, or a day the missed-day rule forbids. Never mutates base.
 */
export function subtaskDropCommit(
    base: readonly Subtask[],
    activeId: string,
    day: DayOfWeek,
    overId: string | null,
): readonly Subtask[] | null {
    const dragged = base.find((s) => s.id === activeId);
    if (dragged === undefined || !canMoveSubtaskTo(dragged, day)) {
        return null;
    }
    const destIds = base.filter((s) => s.assignedDay === day).map((s) => s.id);
    return moveSubtaskInDraft(base, activeId, day, beforeIdForDrop(destIds, activeId, overId));
}

/**
 * Decide the project list to preview while a task is dragged over a project.
 *
 * Only a crossing produces one; a task moving inside its own project is left to
 * dnd-kit.
 *
 * @param base the tree as it currently reads — the live preview if there is one
 * @param activeId the id of the task under the cursor
 * @param destProjectId the id of the project being dragged over
 * @param overId the id of the task the pointer is over, or null for the list
 * @returns the previewed project list, or null when nothing should change.
 *          Never mutates base.
 */
export function taskDragOver(
    base: ReadonlyArray<Project>,
    activeId: string,
    destProjectId: string,
    overId: string | null,
): ReadonlyArray<Project> | null {
    const fromProjectId = base.find((project) =>
        project.tasks.some((task) => task.id === activeId),
    )?.id;
    if (fromProjectId === undefined || fromProjectId === destProjectId) {
        return null;
    }
    const destIds = base.find((p) => p.id === destProjectId)?.tasks.map((t) => t.id) ?? [];
    return reorderTaskIn(base, activeId, destProjectId, beforeIdForDrop(destIds, activeId, overId));
}

/**
 * Decide where a dropped task lands.
 *
 * @param tree the tree the user is looking at — the preview if there is one, in
 *        which the task already sits in its destination project
 * @param activeId the id of the task being dropped
 * @param overId the id of the task it was dropped onto, or null for the list
 * @returns the destination project and the id to land in front of (null for the
 *          end), or null when the task is not in the tree at all
 */
export function taskDropCommit(
    tree: ReadonlyArray<Project>,
    activeId: string,
    overId: string | null,
): { readonly destProjectId: string; readonly beforeId: string | null } | null {
    const home = tree.find((project) => project.tasks.some((task) => task.id === activeId));
    if (home === undefined) {
        return null;
    }
    const destIds = home.tasks.map((task) => task.id);
    return {
        destProjectId: home.id,
        beforeId: beforeIdForDrop(destIds, activeId, overId),
    };
}
