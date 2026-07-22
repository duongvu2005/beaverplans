import { useRef, useState, type DragEvent } from 'react';
import type { Project } from '../core/types';

type Pos = 'before' | 'after';
type DragItem = { kind: 'project' | 'task'; id: string };

export type DropHint =
    | { kind: 'project'; id: string; pos: Pos }
    | { kind: 'task'; id: string; pos: Pos }
    | { kind: 'taskEnd'; projectId: string };

// Which half of the row the cursor is in, recomputed at drop time so a stale
// hover hint can never place the item.
function halfPos(e: DragEvent): Pos {
    const rect = e.currentTarget.getBoundingClientRect();
    return e.clientY - rect.top < rect.height / 2 ? 'before' : 'after';
}

// The id following targetId, or null when targetId is last or absent.
function idAfter(ids: readonly string[], targetId: string): string | null {
    const index = ids.indexOf(targetId);
    if (index === -1 || index === ids.length - 1) {
        return null;
    }
    return ids[index + 1] ?? null;
}

// A drop before or after targetId, expressed the way the core producers want it:
// the id to land in front of, or null for the end of the list.
function toBeforeId(ids: readonly string[], targetId: string, pos: Pos): string | null {
    return pos === 'before' ? targetId : idAfter(ids, targetId);
}

// Drag the whole row, not the grip that started the drag.
function setRowDragImage(e: DragEvent) {
    const row = e.currentTarget.closest('[data-drag-row]');
    if (row instanceof HTMLElement) {
        try {
            e.dataTransfer.setDragImage(row, 16, 16);
        } catch {
            // some browsers refuse; the default preview is acceptable
        }
    }
}

export function useTreeDnd(
    projects: ReadonlyArray<Project>,
    onReorderProject: (projectId: string, beforeProjectId: string | null) => void,
    onReorderTask: (taskId: string, destProjectId: string, beforeTaskId: string | null) => void,
) {
    const dragItem = useRef<DragItem | null>(null);
    const [draggingId, setDraggingId] = useState<string | null>(null);
    const [hint, setHint] = useState<DropHint | null>(null);

    const projectIds = projects.map((project) => project.id);
    const taskIdsIn = (projectId: string): string[] =>
        projects.find((project) => project.id === projectId)?.tasks.map((task) => task.id) ?? [];

    function end() {
        dragItem.current = null;
        setDraggingId(null);
        setHint(null);
    }

    function start(e: DragEvent, item: DragItem) {
        dragItem.current = item;
        setDraggingId(item.id);
        e.dataTransfer.effectAllowed = 'move';
        try {
            e.dataTransfer.setData('text/plain', item.id);
        } catch {
            // blocked in some browsers; the ref is the source of truth
        }
        setRowDragImage(e);
    }

    return {
        hint,
        draggingId,

        startProject: (e: DragEvent, projectId: string) =>
            start(e, { kind: 'project', id: projectId }),
        startTask: (e: DragEvent, taskId: string) => start(e, { kind: 'task', id: taskId }),
        end,

        // A whole project card. Reorders when dragging a project; when dragging a
        // task over the card but not over a row, drops it at the end of this project.
        overProject(e: DragEvent, projectId: string) {
            const item = dragItem.current;
            if (item === null) return;
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            setHint(
                item.kind === 'project'
                    ? { kind: 'project', id: projectId, pos: halfPos(e) }
                    : { kind: 'taskEnd', projectId },
            );
        },
        dropProject(e: DragEvent, projectId: string) {
            const item = dragItem.current;
            if (item === null) return;
            e.preventDefault();
            if (item.kind === 'project') {
                onReorderProject(item.id, toBeforeId(projectIds, projectId, halfPos(e)));
            } else {
                onReorderTask(item.id, projectId, null);
            }
            end();
        },

        // A specific task row. Lands before or after it, across projects too.
        // Stops propagation so the card handler cannot overwrite the precise spot.
        overTask(e: DragEvent, taskId: string) {
            const item = dragItem.current;
            if (item?.kind !== 'task') return;
            e.preventDefault();
            e.stopPropagation();
            e.dataTransfer.dropEffect = 'move';
            setHint({ kind: 'task', id: taskId, pos: halfPos(e) });
        },
        dropTask(e: DragEvent, projectId: string, taskId: string) {
            const item = dragItem.current;
            if (item?.kind !== 'task') return;
            e.preventDefault();
            e.stopPropagation();
            onReorderTask(item.id, projectId, toBeforeId(taskIdsIn(projectId), taskId, halfPos(e)));
            end();
        },

        // The task list area: empty space and the add-task button. Drops at the end.
        overTaskList(e: DragEvent, projectId: string) {
            const item = dragItem.current;
            if (item?.kind !== 'task') return;
            e.preventDefault();
            e.stopPropagation();
            setHint({ kind: 'taskEnd', projectId });
        },
        dropTaskList(e: DragEvent, projectId: string) {
            const item = dragItem.current;
            if (item?.kind !== 'task') return;
            e.preventDefault();
            e.stopPropagation();
            onReorderTask(item.id, projectId, null);
            end();
        },
    };
}

export type TreeDnd = ReturnType<typeof useTreeDnd>;