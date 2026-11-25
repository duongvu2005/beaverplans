/**
 * Ordered-list operations that address elements by id rather than by index.
 * Generic and domain-free: nothing here knows about projects, tasks or subtasks.
 */

/**
 * Move one element of a list to a different position, addressing both the element
 * and its destination by id.
 *
 * @param items  a list whose elements have ids, unique within the list
 * @param id  the id of the element to move; any string
 * @param beforeId  the id of the element that the moved element should end up
 *        immediately in front of, or null to move it to the end of the list
 * @returns  a new list holding exactly the elements of `items`, each the same
 *           object, in which the element with id `id` sits immediately before the
 *           element with id `beforeId` (or last, when `beforeId` is null), and
 *           every other element keeps its original relative order. When the move
 *           is not defined, the new list has the same order as `items`: that is
 *           when no element of `items` has id `id`, when `beforeId` is neither
 *           null nor the id of an element of `items`, and when `beforeId` equals
 *           `id`.
 */
export function moveBefore<T extends { readonly id: string }>(
    items: ReadonlyArray<T>,
    id: string,
    beforeId: string | null,
): ReadonlyArray<T> {
    const item = items.find((candidate) => candidate.id === id);
    const destinationMissing =
        beforeId !== null && !items.some((candidate) => candidate.id === beforeId);
    if (item === undefined || destinationMissing || id === beforeId) {
        return [...items];
    }

    const withoutItem = items.filter((candidate) => candidate.id !== id);
    const insertAt =
        beforeId === null
            ? withoutItem.length
            : withoutItem.findIndex((candidate) => candidate.id === beforeId);
    return [...withoutItem.slice(0, insertAt), item, ...withoutItem.slice(insertAt)];
}
