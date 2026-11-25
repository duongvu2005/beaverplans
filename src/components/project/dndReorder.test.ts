import { describe, it, expect } from 'vitest';
import {
    beforeIdForDrop,
    subtaskDragOver,
    subtaskDropCommit,
    taskDragOver,
    taskDropCommit,
} from './dndReorder';
import type { DayOfWeek, Project, Subtask, Task } from '@/core/types';

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

describe('subtaskDragOver', () => {
    /*
     * Testing strategy
     *     partition on the dragged id: found in base | absent (a stale drag)
     *     partition on canMoveSubtaskTo(dragged, day): allowed | blocked by a
     *         missed day at or after the target
     *     partition on the target day vs the dragged subtask's own day:
     *         same (dnd-kit opens the gap, state must not be touched) | different
     *     partition on overId: a sibling subtask id | null (dropped on the day)
     */

    const s = (id: string, day: DayOfWeek, missed: DayOfWeek[] = []): Subtask => ({
        id,
        isDone: false,
        assignedDay: day,
        missedDays: missed,
        weight: 1,
    });

    it('covers a stale drag: nothing to do', () => {
        expect(subtaskDragOver([s('a', 'mon')], 'gone', 'tue', null)).toEqual({ kind: 'ignore' });
    });

    it('covers the missed-day rule: a day at or before a miss is blocked', () => {
        // 'a' missed wednesday, so it can only ever move to thu/fri/sat/sun.
        const base = [s('a', 'thu', ['wed'])];
        expect(subtaskDragOver(base, 'a', 'tue', null)).toEqual({ kind: 'blocked' });
    });

    it('covers a legal day beyond every miss', () => {
        const base = [s('a', 'thu', ['wed'])];
        const result = subtaskDragOver(base, 'a', 'fri', null);
        expect(result.kind).toBe('moved');
    });

    it('covers the same day: highlight only, no preview', () => {
        const base = [s('a', 'mon'), s('b', 'mon')];
        expect(subtaskDragOver(base, 'a', 'mon', 'b')).toEqual({ kind: 'sameDay', day: 'mon' });
    });

    it('covers a cross-day move: previews the subtask on its new day', () => {
        const base = [s('a', 'mon'), s('x', 'wed')];
        const result = subtaskDragOver(base, 'a', 'wed', 'x');
        expect(result).toMatchObject({ kind: 'moved', day: 'wed' });
        if (result.kind !== 'moved') throw new Error('unreachable');
        expect(result.preview.find((sub) => sub.id === 'a')?.assignedDay).toBe('wed');
        // in front of the row it was dropped onto, not appended
        expect(
            result.preview.filter((sub) => sub.assignedDay === 'wed').map((sub) => sub.id),
        ).toEqual(['a', 'x']);
    });

    it('covers dropping on the day itself: lands at the end', () => {
        const base = [s('a', 'mon'), s('x', 'wed'), s('y', 'wed')];
        const result = subtaskDragOver(base, 'a', 'wed', null);
        if (result.kind !== 'moved') throw new Error('unreachable');
        expect(
            result.preview.filter((sub) => sub.assignedDay === 'wed').map((sub) => sub.id),
        ).toEqual(['x', 'y', 'a']);
    });

    it('does not mutate the list it is given', () => {
        const base = [s('a', 'mon'), s('x', 'wed')];
        subtaskDragOver(base, 'a', 'wed', 'x');
        expect(base.map((sub) => sub.assignedDay)).toEqual(['mon', 'wed']);
    });
});

describe('subtaskDropCommit', () => {
    /*
     * Testing strategy
     *     partition on the dragged id: found | absent
     *     partition on canMoveSubtaskTo: allowed | blocked
     *     partition on base: the live preview (already moved, so destIds
     *         includes the dragged id) | the untouched draft, for a same-day drop
     */

    const s = (id: string, day: DayOfWeek, missed: DayOfWeek[] = []): Subtask => ({
        id,
        isDone: false,
        assignedDay: day,
        missedDays: missed,
        weight: 1,
    });

    it('covers a stale drag: no commit', () => {
        expect(subtaskDropCommit([s('a', 'mon')], 'gone', 'tue', null)).toBeNull();
    });

    it('covers a blocked day: no commit', () => {
        expect(subtaskDropCommit([s('a', 'thu', ['wed'])], 'a', 'tue', null)).toBeNull();
    });

    it('covers committing from a preview: the order matches the gap dnd-kit animated', () => {
        // base is the preview: 'a' has already been placed on wed, ahead of x.
        const base = [s('a', 'wed'), s('x', 'wed')];
        const next = subtaskDropCommit(base, 'a', 'wed', 'x');
        expect(next?.filter((sub) => sub.assignedDay === 'wed').map((sub) => sub.id)).toEqual([
            'x',
            'a',
        ]);
    });
});

describe('taskDragOver', () => {
    /*
     * Testing strategy
     *     partition on the destination project vs the task's own project:
     *         same (dnd-kit opens the gap; state must not be touched) | different
     *     partition on the dragged id: found in a project | absent
     *     partition on overId: a sibling task id | null (dropped on the list)
     */

    const t = (id: string): Task => ({ id, name: id, subtasks: [], isDone: false });
    const p = (id: string, tasks: Task[]): Project => ({ id, name: id, tasks });
    const idsOf = (list: ReadonlyArray<Project>, id: string): string =>
        (list.find((x) => x.id === id)?.tasks ?? []).map((x) => x.id).join('');

    const base = (): ReadonlyArray<Project> => [p('p', [t('a'), t('b')]), p('p2', [t('x')])];

    it('covers the same project: left to dnd-kit, no preview', () => {
        expect(taskDragOver(base(), 'a', 'p', 'b')).toBeNull();
    });

    it('covers a stale drag: no preview', () => {
        expect(taskDragOver(base(), 'gone', 'p2', null)).toBeNull();
    });

    it('covers crossing into another project, in front of the row dropped onto', () => {
        const result = taskDragOver(base(), 'a', 'p2', 'x');
        expect(result).not.toBeNull();
        if (result === null) throw new Error('unreachable');
        expect(idsOf(result, 'p')).toBe('b');
        expect(idsOf(result, 'p2')).toBe('ax');
    });

    it('covers crossing onto the list itself: lands at the end', () => {
        const result = taskDragOver(base(), 'a', 'p2', null);
        if (result === null) throw new Error('unreachable');
        expect(idsOf(result, 'p2')).toBe('xa');
    });
});

describe('taskDropCommit', () => {
    /*
     * Testing strategy
     *     partition on the dragged id: found in the tree | absent
     *     partition on overId: a sibling task id | null
     *     the tree given is the live preview, so the task is already in its
     *     destination project and destIds includes it — a same-container move.
     */

    const t = (id: string): Task => ({ id, name: id, subtasks: [], isDone: false });
    const p = (id: string, tasks: Task[]): Project => ({ id, name: id, tasks });

    it('covers a stale drag: no commit', () => {
        expect(taskDropCommit([p('p', [t('a')])], 'gone', null)).toBeNull();
    });

    it('covers reading the landing spot from the preview, not the real tree', () => {
        // the preview has already moved 'a' into p2, ahead of x
        const preview = [p('p', [t('b')]), p('p2', [t('a'), t('x')])];
        expect(taskDropCommit(preview, 'a', 'x')).toEqual({
            destProjectId: 'p2',
            beforeId: null,
        });
    });

    it('covers dropping on the list: appended', () => {
        const preview = [p('p', [t('b')]), p('p2', [t('x'), t('a')])];
        expect(taskDropCommit(preview, 'a', null)).toEqual({
            destProjectId: 'p2',
            beforeId: null,
        });
    });
});
