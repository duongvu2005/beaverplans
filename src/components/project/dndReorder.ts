import { arrayMove } from '@dnd-kit/sortable';

// UI glue between a dnd-kit drop and the pure reorder producers in core/. The
// producers take a `beforeId`: the id the moved item should end up immediately
// in front of, or null for the end of the list. dnd-kit instead reports which
// item the pointer was over, so this translates one into the other. It is
// presentation plumbing, not domain logic — the actual move stays in core/.

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
        // Same container. Mirror dnd-kit's own arrayMove(from, over) so the
        // committed order matches the live preview the other rows animated to.
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
