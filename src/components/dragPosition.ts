import type { DragEvent } from 'react';

export type Pos = 'before' | 'after';

// Which half of the row the cursor is in, recomputed at drop time so a stale
// hover hint can never place the item.
export function halfPos(e: DragEvent): Pos {
    const rect = e.currentTarget.getBoundingClientRect();
    return e.clientY - rect.top < rect.height / 2 ? 'before' : 'after';
}

// The id following targetId, or null when targetId is last or absent.
export function idAfter(ids: readonly string[], targetId: string): string | null {
    const index = ids.indexOf(targetId);
    if (index === -1 || index === ids.length - 1) {
        return null;
    }
    return ids[index + 1] ?? null;
}

// A drop before or after targetId, expressed the way moveBefore wants it: the id
// to land in front of, or null for the end of the list.
export function toBeforeId(ids: readonly string[], targetId: string, pos: Pos): string | null {
    return pos === 'before' ? targetId : idAfter(ids, targetId);
}

// Drag the whole row, not the grip that started the drag.
export function setRowDragImage(e: DragEvent) {
    const row = e.currentTarget.closest('[data-drag-row]');
    if (row instanceof HTMLElement) {
        try {
            e.dataTransfer.setDragImage(row, 16, 16);
        } catch {
            // some browsers refuse; the default preview is acceptable
        }
    }
}
