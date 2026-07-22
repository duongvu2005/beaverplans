import { useRef, useState, type DragEvent } from 'react';
import { WEEK } from '../core/types';
import type { DayOfWeek, Subtask } from '../core/types';
import { halfPos, setRowDragImage, toBeforeId, type Pos } from './dragPosition';

export type SubtaskDropHint =
    | { kind: 'row'; id: string; pos: Pos }
    | { kind: 'day'; day: DayOfWeek };

export function useSubtaskDnd(
    subtasks: readonly Subtask[],
    onMove: (subtaskId: string, day: DayOfWeek, beforeId: string | null) => void,
) {
    const dragId = useRef<string | null>(null);
    const startFrame = useRef(0);
    const [draggingId, setDraggingId] = useState<string | null>(null);
    const [hint, setHint] = useState<SubtaskDropHint | null>(null);

    // Read the dragged subtask through the ref rather than the draggingId state.
    // At dragstart the handlers already attached to the DOM were built in the
    // previous render, where the state was still null, so a state-derived lookup
    // refuses the first dragover until React catches up. Refs are current at once.
    function canDropOn(day: DayOfWeek): boolean {
        const dragged = subtasks.find((subtask) => subtask.id === dragId.current);
        if (dragged === undefined) {
            return false;
        }
        const target = WEEK.indexOf(day);
        return dragged.missedDays.every((missed) => WEEK.indexOf(missed) < target);
    }

    // The ids assigned to one day, in draft order.
    function idsOn(day: DayOfWeek): string[] {
        return subtasks
            .filter((subtask) => subtask.assignedDay === day)
            .map((subtask) => subtask.id);
    }

    function end() {
        cancelAnimationFrame(startFrame.current);
        startFrame.current = 0;
        dragId.current = null;
        setDraggingId(null);
        setHint(null);
    }

    return {
        hint,
        draggingId,
        canDropOn,
        end,

        start(e: DragEvent, subtaskId: string) {
            dragId.current = subtaskId;
            e.dataTransfer.effectAllowed = 'move';
            try {
                e.dataTransfer.setData('text/plain', subtaskId);
            } catch {
                // blocked in some browsers; the ref is the source of truth
            }
            setRowDragImage(e);
            // Defer the state that drives rendering by one frame. Setting it here
            // makes React flush a re-render inside the dragstart handler, while
            // the browser is still initiating the drag, and altering the source's
            // surroundings at that moment makes it cancel: dragstart is followed
            // straight by dragend with no dragover in between. dragId above is
            // already set, and it is what the handlers read.
            startFrame.current = requestAnimationFrame(() => setDraggingId(subtaskId));
        },

        // A specific row. Lands before or after it, in that row's own day.
        // Stops propagation so the day handler cannot overwrite the precise spot.
        overRow(e: DragEvent, day: DayOfWeek, subtaskId: string) {
            if (dragId.current === null || !canDropOn(day)) {
                return;
            }
            e.preventDefault();
            e.stopPropagation();
            e.dataTransfer.dropEffect = 'move';
            setHint({ kind: 'row', id: subtaskId, pos: halfPos(e) });
        },
        dropRow(e: DragEvent, day: DayOfWeek, subtaskId: string) {
            const id = dragId.current;
            if (id === null || !canDropOn(day)) {
                return;
            }
            e.preventDefault();
            e.stopPropagation();
            onMove(id, day, toBeforeId(idsOn(day), subtaskId, halfPos(e)));
            end();
        },

        // A day group's own space: the label, the padding, the add button.
        // Drops at the end of that day.
        overDay(e: DragEvent, day: DayOfWeek) {
            if (dragId.current === null || !canDropOn(day)) {
                return;
            }
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            setHint({ kind: 'day', day });
        },
        dropDay(e: DragEvent, day: DayOfWeek) {
            const id = dragId.current;
            if (id === null || !canDropOn(day)) {
                return;
            }
            e.preventDefault();
            onMove(id, day, null);
            end();
        },
    };
}

export type SubtaskDnd = ReturnType<typeof useSubtaskDnd>;
