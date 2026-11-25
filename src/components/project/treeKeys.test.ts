import { describe, it, expect } from 'vitest';
import type { Project } from '@/core/types';
import { keyAction, rowSequence, type TreeKeyAction, type TreeKeyContext } from './treeKeys';

describe('rowSequence', () => {
    /*
     * Testing strategy
     *     partition on projects: empty | one | several
     *     partition on a project's tasks: none | some
     *     ordering: a project's tasks follow it and precede the next project
     */

    function project(id: string, taskIds: string[]): Project {
        return {
            id,
            name: id,
            tasks: taskIds.map((taskId) => ({ id: taskId, name: taskId, subtasks: [] })),
        };
    }

    it('covers projects empty: no rows', () => {
        expect(rowSequence([])).toEqual([]);
    });

    it('covers one project, no tasks: just the project row', () => {
        expect(rowSequence([project('p1', [])])).toEqual([{ kind: 'project', id: 'p1' }]);
    });

    it('covers several projects with and without tasks: tasks follow their own project', () => {
        expect(
            rowSequence([project('p1', ['t1', 't2']), project('p2', []), project('p3', ['t3'])]),
        ).toEqual([
            { kind: 'project', id: 'p1' },
            { kind: 'task', id: 't1', projectId: 'p1' },
            { kind: 'task', id: 't2', projectId: 'p1' },
            { kind: 'project', id: 'p2' },
            { kind: 'project', id: 'p3' },
            { kind: 'task', id: 't3', projectId: 'p3' },
        ]);
    });
});

describe('keyAction', () => {
    /*
     * Testing strategy
     *     partition on key: Escape | Enter | Backspace | ArrowUp | ArrowDown |
     *         an unbound key
     *     partition on modifiers: none | mod | mod+shift | shift alone
     *     partition on row kind: project | task
     *     partition on the caret, for the arrows: at the boundary in the pressed
     *         direction | away from it | a selection covering the boundary
     *     partition on the neighbour, for the arrows: exists | the row is first
     *         (ArrowUp) or last (ArrowDown) | the row is absent from the sequence
     *
     *     Backspace unmodified and Cmd+Backspace are both deliberately unbound —
     *     they are native text editing inside an input — so they answer undefined
     *     like any other key the tree does not claim.
     */

    const SEQUENCE = [
        { kind: 'project', id: 'p1' },
        { kind: 'task', id: 't1', projectId: 'p1' },
        { kind: 'task', id: 't2', projectId: 'p1' },
        { kind: 'project', id: 'p2' },
    ] as const;

    const PROJECT_ROW = SEQUENCE[0];
    const FIRST_TASK = SEQUENCE[1];
    const LAST_TASK = SEQUENCE[2];
    const LAST_ROW = SEQUENCE[3];

    // Named, mid-caret, no modifiers — every case below overrides only what it
    // is about, so the thing under test is the difference from this.
    function context(overrides: Partial<TreeKeyContext> = {}): TreeKeyContext {
        return {
            key: 'a',
            mod: false,
            shift: false,
            atStart: false,
            atEnd: false,
            row: FIRST_TASK,
            sequence: SEQUENCE,
            ...overrides,
        };
    }

    it.each<{ covers: string; ctx: Partial<TreeKeyContext>; want: TreeKeyAction | undefined }>([
        {
            covers: 'Escape: blur, whatever else is true',
            ctx: { key: 'Escape', atStart: true },
            want: { kind: 'blur' },
        },
        {
            covers: 'Escape with mod: still blur',
            ctx: { key: 'Escape', mod: true },
            want: { kind: 'blur' },
        },

        {
            covers: 'mod+shift+Backspace on a task: remove that row, named or not',
            ctx: { key: 'Backspace', mod: true, shift: true },
            want: { kind: 'removeRow', row: FIRST_TASK },
        },
        {
            covers: 'mod+shift+Backspace on a project with tasks: removes it anyway',
            ctx: { key: 'Backspace', mod: true, shift: true, row: PROJECT_ROW },
            want: { kind: 'removeRow', row: PROJECT_ROW },
        },
        {
            covers: 'Backspace alone: unbound, so the browser deletes a character',
            ctx: { key: 'Backspace' },
            want: undefined,
        },
        {
            covers: 'mod+Backspace: unbound, so macOS still deletes to line start',
            ctx: { key: 'Backspace', mod: true },
            want: undefined,
        },
        {
            covers: 'shift+Backspace: unbound',
            ctx: { key: 'Backspace', shift: true },
            want: undefined,
        },

        {
            covers: 'mod+Enter: a new project, from a task row',
            ctx: { key: 'Enter', mod: true },
            want: { kind: 'addProject' },
        },
        {
            covers: 'mod+Enter: a new project, from a project row',
            ctx: { key: 'Enter', mod: true, row: PROJECT_ROW },
            want: { kind: 'addProject' },
        },

        {
            covers: 'Enter on a task: a sibling directly after it',
            ctx: { key: 'Enter' },
            want: { kind: 'insertTask', projectId: 'p1', afterTaskId: 't1' },
        },
        {
            covers: 'Enter on a project: appended to the end of its tasks',
            ctx: { key: 'Enter', row: PROJECT_ROW },
            want: { kind: 'insertTask', projectId: 'p1', afterTaskId: null },
        },

        {
            covers: 'ArrowUp at the start: the previous row, caret at its start',
            ctx: { key: 'ArrowUp', atStart: true },
            want: { kind: 'focus', id: 'p1', caret: 'start' },
        },
        {
            covers: 'ArrowUp from a project: crosses into the project above it',
            ctx: { key: 'ArrowUp', atStart: true, row: LAST_ROW },
            want: { kind: 'focus', id: 't2', caret: 'start' },
        },
        {
            covers: 'ArrowUp away from the start: unbound, so the caret moves in the text',
            ctx: { key: 'ArrowUp', atStart: false },
            want: undefined,
        },
        {
            covers: 'ArrowUp on the first row: nothing above it',
            ctx: { key: 'ArrowUp', atStart: true, row: PROJECT_ROW },
            want: undefined,
        },
        {
            covers: 'ArrowDown at the end: the next row, caret at its end',
            ctx: { key: 'ArrowDown', atEnd: true },
            want: { kind: 'focus', id: 't2', caret: 'end' },
        },
        {
            covers: 'ArrowDown from a task: crosses into the next project',
            ctx: { key: 'ArrowDown', atEnd: true, row: LAST_TASK },
            want: { kind: 'focus', id: 'p2', caret: 'end' },
        },
        {
            covers: 'ArrowDown away from the end: unbound',
            ctx: { key: 'ArrowDown', atEnd: false },
            want: undefined,
        },
        {
            covers: 'ArrowDown on the last row: nothing below it',
            ctx: { key: 'ArrowDown', atEnd: true, row: LAST_ROW },
            want: undefined,
        },
        {
            covers: 'ArrowDown for a row missing from the sequence: no neighbour to find',
            ctx: {
                key: 'ArrowDown',
                atEnd: true,
                row: { kind: 'task', id: 'gone', projectId: 'p1' },
            },
            want: undefined,
        },

        {
            covers: 'an ordinary character: unbound',
            ctx: { key: 'x' },
            want: undefined,
        },
        {
            covers: 'Tab: unbound, so the browser keeps its own focus order',
            ctx: { key: 'Tab' },
            want: undefined,
        },
    ])('covers $covers', ({ ctx, want }) => {
        expect(keyAction(context(ctx))).toEqual(want);
    });
});
