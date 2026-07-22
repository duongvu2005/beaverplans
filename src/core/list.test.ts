import { describe, it, expect } from 'vitest';
import { moveBefore } from './list';

type Item = { readonly id: string };

// A list of single-character-id items, in the order given: 'abc' -> a, b, c.
function list(ids: string): ReadonlyArray<Item> {
    return [...ids].map((id) => ({ id }));
}

// The ids of a list joined back into a string, so order is compared as one value.
function ids(items: ReadonlyArray<Item>): string {
    return items.map((item) => item.id).join('');
}

describe('moveBefore', () => {
    /*
     * Testing strategy
     *     partition on items length: 0 | 1 | 2 | > 2
     *     partition on id: in items | not in items
     *     partition on beforeId: null | same as id | in items | not in items
     *     partition on direction, when beforeId is in items:
     *         destination ahead of the element (moves forward)
     *         destination behind the element (moves backward)
     *         element already immediately before the destination
     *
     *     Some combinations are unreachable: length 0 admits neither id nor
     *     beforeId in items, and at length 1 "beforeId in items" collapses into
     *     "beforeId same as id" whenever id is in items.
     */

    it.each([
        { covers: 'length 0, beforeId null', items: '', id: 'x', beforeId: null, want: '' },
        { covers: 'length 0, beforeId not in', items: '', id: 'x', beforeId: 'z', want: '' },

        {
            covers: 'length 1, id in, beforeId null',
            items: 'a',
            id: 'a',
            beforeId: null,
            want: 'a',
        },
        { covers: 'length 1, beforeId same as id', items: 'a', id: 'a', beforeId: 'a', want: 'a' },
        {
            covers: 'length 1, id not in, beforeId in',
            items: 'a',
            id: 'x',
            beforeId: 'a',
            want: 'a',
        },
        {
            covers: 'length 1, id not in, beforeId not in',
            items: 'a',
            id: 'x',
            beforeId: 'z',
            want: 'a',
        },

        { covers: 'length 2, moves to the end', items: 'ab', id: 'a', beforeId: null, want: 'ba' },
        { covers: 'length 2, moves backward', items: 'ab', id: 'b', beforeId: 'a', want: 'ba' },
        { covers: 'length 2, already in place', items: 'ab', id: 'a', beforeId: 'b', want: 'ab' },
        { covers: 'length 2, already last', items: 'ab', id: 'b', beforeId: null, want: 'ab' },
        { covers: 'length 2, id not in', items: 'ab', id: 'x', beforeId: 'b', want: 'ab' },
        { covers: 'length 2, beforeId not in', items: 'ab', id: 'a', beforeId: 'z', want: 'ab' },
        {
            covers: 'length 2, beforeId same as id',
            items: 'ab',
            id: 'a',
            beforeId: 'a',
            want: 'ab',
        },

        {
            covers: 'length > 2, moves forward',
            items: 'abcd',
            id: 'b',
            beforeId: 'd',
            want: 'acbd',
        },
        {
            covers: 'length > 2, moves backward',
            items: 'abcd',
            id: 'd',
            beforeId: 'b',
            want: 'adbc',
        },
        {
            covers: 'length > 2, first to the end',
            items: 'abcd',
            id: 'a',
            beforeId: null,
            want: 'bcda',
        },
        {
            covers: 'length > 2, last to the front',
            items: 'abcd',
            id: 'd',
            beforeId: 'a',
            want: 'dabc',
        },
        {
            covers: 'length > 2, already in place',
            items: 'abcd',
            id: 'b',
            beforeId: 'c',
            want: 'abcd',
        },
        {
            covers: 'length > 2, beforeId same as id',
            items: 'abcd',
            id: 'b',
            beforeId: 'b',
            want: 'abcd',
        },
        { covers: 'length > 2, id not in', items: 'abcd', id: 'x', beforeId: 'c', want: 'abcd' },
        {
            covers: 'length > 2, beforeId not in',
            items: 'abcd',
            id: 'b',
            beforeId: 'z',
            want: 'abcd',
        },
    ])('covers $covers', ({ items, id, beforeId, want }) => {
        expect(ids(moveBefore(list(items), id, beforeId))).toBe(want);
    });

    // The three below assert something other than resulting order, so they stay
    // outside the table.

    it('covers elements are carried over by reference, not copied', () => {
        const a = { id: 'a' };
        const b = { id: 'b' };
        const c = { id: 'c' };
        const result = moveBefore([a, b, c], 'a', null);
        expect(result[0]).toBe(b);
        expect(result[1]).toBe(c);
        expect(result[2]).toBe(a);
    });

    it('covers the argument list is not mutated', () => {
        const items = list('abcd');
        moveBefore(items, 'b', 'd');
        expect(ids(items)).toBe('abcd');
    });

    it('covers a new array is returned even when the order is unchanged', () => {
        const items = list('abc');
        expect(moveBefore(items, 'b', 'c')).not.toBe(items);
    });
});
