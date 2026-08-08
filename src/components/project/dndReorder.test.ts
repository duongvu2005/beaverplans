import { describe, it, expect } from 'vitest';
import { beforeIdForDrop } from './dndReorder';

describe('beforeIdForDrop', () => {
    /*
     * Testing strategy
     *     partition on overId: null | non-null
     *     partition on destIds vs activeId, when overId is non-null:
     *         same container (destIds includes activeId) | cross container (does not)
     *     partition on overId vs destIds, in the same-container case:
     *         present (a real drop target) | absent (a stale/foreign id)
     *     partition on direction, in the same-container case with overId present:
     *         moves forward | moves backward | dropped on itself (overId === activeId)
     *     partition on result position, in the same-container case:
     *         activeId ends up last (returns null) | not last (returns the next id)
     *
     *     "activeId not in destIds and overId not in destIds either" (from === -1)
     *     is unreachable: entry into the same-container branch already requires
     *     destIds.includes(activeId).
     */

    it.each([
        {
            covers: 'overId null: append to end, regardless of destIds/activeId',
            destIds: ['a', 'b'],
            activeId: 'a',
            overId: null,
            want: null,
        },
        {
            covers: 'overId null, cross-container shape too',
            destIds: ['x', 'y'],
            activeId: 'z',
            overId: null,
            want: null,
        },

        {
            covers: 'cross container: lands immediately before overId',
            destIds: ['x', 'y'],
            activeId: 'z',
            overId: 'y',
            want: 'y',
        },
        {
            covers: 'cross container, single-item destination',
            destIds: ['x'],
            activeId: 'z',
            overId: 'x',
            want: 'x',
        },

        {
            covers: 'same container, overId absent (stale id): treated as a no-op',
            destIds: ['a', 'b'],
            activeId: 'a',
            overId: 'ghost',
            want: null,
        },

        {
            covers: 'same container, moves forward, lands mid-list',
            destIds: ['a', 'b', 'c', 'd'],
            activeId: 'a',
            overId: 'c',
            want: 'd',
        },
        {
            covers: 'same container, moves forward, lands at the end',
            destIds: ['a', 'b', 'c'],
            activeId: 'a',
            overId: 'c',
            want: null,
        },
        {
            covers: 'same container, moves backward',
            destIds: ['a', 'b', 'c'],
            activeId: 'c',
            overId: 'a',
            want: 'a',
        },
        {
            covers: 'same container, dropped on itself: unchanged, returns original next',
            destIds: ['a', 'b', 'c'],
            activeId: 'b',
            overId: 'b',
            want: 'c',
        },
        {
            covers: 'same container, dropped on itself while already last',
            destIds: ['a', 'b', 'c'],
            activeId: 'c',
            overId: 'c',
            want: null,
        },
    ])('covers $covers', ({ destIds, activeId, overId, want }) => {
        expect(beforeIdForDrop(destIds, activeId, overId)).toBe(want);
    });

    it('covers destIds is not mutated', () => {
        const destIds = ['a', 'b', 'c'];
        beforeIdForDrop(destIds, 'a', 'c');
        expect(destIds).toEqual(['a', 'b', 'c']);
    });
});
