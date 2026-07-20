import { describe, it, expect } from 'vitest';
import { buildTask } from './buildTask';
import type { TaskEdits } from './buildTask';
import { isValidTask } from './projects';
import type { Task, Subtask, DayOfWeek } from './types';

function makeSubtask(id: string, day: DayOfWeek): Subtask {
    return { id, isDone: false, assignedDay: day, missedDays: [], weight: 1 };
}
function edits(over: Partial<TaskEdits> = {}): TaskEdits {
    return { description: '', subtasks: [], deadline: undefined, ...over };
}

describe('buildTask', () => {
    /*
     * Testing strategy:
     *   partition on edits.subtasks: empty | non-empty
     *   partition on base when subtasks empty: base was a leaf | base had subtasks
     *   partition on base.isDone (leaf-preserve case): true | false
     *   partition on edits.description: non-empty (trimmed) | blank (omitted)
     *   partition on edits.deadline: valid string (stored) | invalid string (omitted) | undefined (omitted)
     *   always: result satisfies isValidTask; base is not mutated
     */

    it('covers non-empty subtasks: parent task, no isDone, keeps id/name', () => {
        const base: Task = { id: 't0', name: 'Write', subtasks: [], isDone: true };
        const result = buildTask(
            base,
            edits({ subtasks: [makeSubtask('s0', 'mon'), makeSubtask('s1', 'wed')] }),
        );
        expect(isValidTask(result)).toBe(true);
        expect(result.id).toBe('t0');
        expect(result.name).toBe('Write');
        expect(result.subtasks).toHaveLength(2);
        expect('isDone' in result).toBe(false);
    });

    it('covers empty subtasks, base was a leaf: preserves isDone (true)', () => {
        const base: Task = { id: 't0', name: 'Write', subtasks: [], isDone: true };
        const result = buildTask(base, edits());
        expect(isValidTask(result)).toBe(true);
        expect(result.subtasks).toHaveLength(0);
        expect(result.isDone).toBe(true);
    });

    it('covers empty subtasks, base was a leaf: preserves isDone (false)', () => {
        const base: Task = { id: 't0', name: 'Write', subtasks: [], isDone: false };
        expect(buildTask(base, edits()).isDone).toBe(false);
    });

    it('covers empty subtasks, base had subtasks (all removed): isDone false', () => {
        const base: Task = { id: 't0', name: 'Write', subtasks: [makeSubtask('s0', 'mon')] };
        const result = buildTask(base, edits());
        expect(isValidTask(result)).toBe(true);
        expect(result.subtasks).toHaveLength(0);
        expect(result.isDone).toBe(false);
    });

    it('covers non-empty description: trimmed and set', () => {
        const base: Task = { id: 't0', name: 'Write', subtasks: [], isDone: false };
        expect(
            buildTask(
                base,
                edits({ description: '  a note  ', subtasks: [makeSubtask('s0', 'mon')] }),
            ).description,
        ).toBe('a note');
    });

    it('covers blank description: omitted', () => {
        const base: Task = { id: 't0', name: 'Write', subtasks: [], isDone: false };
        expect(
            'description' in
                buildTask(
                    base,
                    edits({ description: '   ', subtasks: [makeSubtask('s0', 'mon')] }),
                ),
        ).toBe(false);
    });

    it('covers deadline non-empty string: stored', () => {
        const base: Task = { id: 't0', name: 'W', subtasks: [], isDone: false };
        expect(
            buildTask(base, edits({ deadline: '2026-07-24', subtasks: [makeSubtask('s0', 'mon')] }))
                .deadline,
        ).toBe('2026-07-24');
    });

    it('covers deadline undefined: omitted', () => {
        const base: Task = { id: 't0', name: 'W', subtasks: [], isDone: false };
        expect('deadline' in buildTask(base, edits({ subtasks: [makeSubtask('s0', 'mon')] }))).toBe(
            false,
        );
    });

    it('covers does not mutate base', () => {
        const base: Task = { id: 't0', name: 'W', subtasks: [], isDone: true };
        buildTask(base, edits({ description: 'x', subtasks: [makeSubtask('s0', 'mon')] }));
        expect(base.subtasks).toHaveLength(0);
        expect(base.isDone).toBe(true);
    });

    it('covers deadline invalid string: omitted', () => {
        const base: Task = { id: 't0', name: 'W', subtasks: [], isDone: false };
        expect(
            'deadline' in
                buildTask(
                    base,
                    edits({ deadline: '2026-02-30', subtasks: [makeSubtask('s0', 'mon')] }),
                ),
        ).toBe(false);
    });
});
