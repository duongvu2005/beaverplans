import { describe, it, expect } from 'vitest';
import {
    addSubtaskOn,
    moveSubtaskInDraft,
    removeSubtask,
    removeSubtasksOnDay,
    setSubtaskNote,
    setSubtaskWeight,
} from './subtaskDraft';
import type { Subtask } from './types';

function makeSubtask(id: string, overrides: Partial<Subtask> = {}): Subtask {
    return {
        id,
        isDone: false,
        assignedDay: 'mon',
        missedDays: [],
        weight: 1,
        ...overrides,
    };
}

describe('addSubtaskOn', () => {
    /*
     * Testing strategy
     *     partition on subtasks: empty | non-empty
     */
    it('covers empty draft', () => {
        expect(addSubtaskOn([], 'mon', 'x')).toEqual([
            { id: 'x', isDone: false, assignedDay: 'mon', missedDays: [], weight: 1 },
        ]);
    });

    it('covers non-empty draft: appended at the end, existing subtasks unchanged', () => {
        const existing = makeSubtask('a', { assignedDay: 'tue' });
        expect(addSubtaskOn([existing], 'wed', 'x')).toEqual([
            existing,
            { id: 'x', isDone: false, assignedDay: 'wed', missedDays: [], weight: 1 },
        ]);
    });
});

describe('removeSubtask', () => {
    /*
     * Testing strategy
     *     partition on id: present | absent
     */
    it('covers id present: removed, others kept in order', () => {
        const a = makeSubtask('a');
        const b = makeSubtask('b');
        expect(removeSubtask([a, b], 'a')).toEqual([b]);
    });

    it('covers id absent: unchanged', () => {
        const a = makeSubtask('a');
        expect(removeSubtask([a], 'z')).toEqual([a]);
    });
});

describe('removeSubtasksOnDay', () => {
    /*
     * Testing strategy
     *     partition on subtasks assigned to day: none | more than one
     */
    it('covers none assigned to day: unchanged', () => {
        const a = makeSubtask('a', { assignedDay: 'mon' });
        expect(removeSubtasksOnDay([a], 'tue')).toEqual([a]);
    });

    it('covers multiple assigned to day: all removed, others kept', () => {
        const a = makeSubtask('a', { assignedDay: 'mon' });
        const b = makeSubtask('b', { assignedDay: 'tue' });
        const c = makeSubtask('c', { assignedDay: 'mon' });
        expect(removeSubtasksOnDay([a, b, c], 'mon')).toEqual([b]);
    });
});

describe('setSubtaskWeight', () => {
    /*
     * Testing strategy
     *     partition on id: present | absent
     */
    it('covers id present: weight replaced, rest unchanged', () => {
        const a = makeSubtask('a', { weight: 1 });
        expect(setSubtaskWeight([a], 'a', 3)).toEqual([{ ...a, weight: 3 }]);
    });

    it('covers id absent: unchanged', () => {
        const a = makeSubtask('a');
        expect(setSubtaskWeight([a], 'z', 3)).toEqual([a]);
    });
});

describe('setSubtaskNote', () => {
    /*
     * Testing strategy
     *     partition on id: present | absent
     *     partition on note, when id present: non-empty | empty string
     */
    it('covers id present, non-empty note', () => {
        const a = makeSubtask('a');
        expect(setSubtaskNote([a], 'a', 'hi')).toEqual([{ ...a, description: 'hi' }]);
    });

    it('covers id present, empty note: stored as given', () => {
        const a = makeSubtask('a', { description: 'old' });
        expect(setSubtaskNote([a], 'a', '')).toEqual([{ ...a, description: '' }]);
    });

    it('covers id absent: unchanged', () => {
        const a = makeSubtask('a');
        expect(setSubtaskNote([a], 'z', 'hi')).toEqual([a]);
    });
});

describe('moveSubtaskInDraft', () => {
    /*
     * Testing strategy
     *     partition on id: present | absent
     *     partition on day, when id present: same as current assignedDay | different
     *     partition on beforeId, when id present: null | id of another subtask in the draft
     */
    it('covers id absent: unchanged', () => {
        const a = makeSubtask('a', { assignedDay: 'mon' });
        expect(moveSubtaskInDraft([a], 'z', 'tue', null)).toEqual([a]);
    });

    it('covers same day, reordered before another', () => {
        const a = makeSubtask('a', { assignedDay: 'mon' });
        const b = makeSubtask('b', { assignedDay: 'mon' });
        expect(moveSubtaskInDraft([a, b], 'b', 'mon', 'a')).toEqual([b, a]);
    });

    it('covers different day, moved to the end', () => {
        const a = makeSubtask('a', { assignedDay: 'mon' });
        const b = makeSubtask('b', { assignedDay: 'tue' });
        expect(moveSubtaskInDraft([a, b], 'a', 'wed', null)).toEqual([
            b,
            { ...a, assignedDay: 'wed' },
        ]);
    });

    it('covers different day, landed immediately before an existing id', () => {
        const a = makeSubtask('a', { assignedDay: 'mon' });
        const b = makeSubtask('b', { assignedDay: 'wed' });
        expect(moveSubtaskInDraft([a, b], 'a', 'wed', 'b')).toEqual([
            { ...a, assignedDay: 'wed' },
            b,
        ]);
    });
});
