import { describe, it, expect } from 'vitest';
import type { Project, Task, Subtask, DayOfWeek } from './types';
import { WEEK } from './types';
import type { DayEntry } from './daySchedule';
import { scheduleByDay } from './daySchedule';

// Minimal valid fixtures; pass overrides to set specific fields.
function makeSubtask(id: string, overrides: Partial<Subtask> = {}): Subtask {
    return { id, isDone: false, assignedDay: 'mon', missedDays: [], weight: 1, ...overrides };
}
function makeTask(id: string, overrides: Partial<Task> = {}): Task {
    return { id, name: id, subtasks: [], isDone: false, ...overrides };
}
function makeProject(id: string, overrides: Partial<Project> = {}): Project {
    return { id, name: id, tasks: [], ...overrides };
}

// Expected-value builders.
function entry(subtask: Subtask, taskName: string, projectName: string): DayEntry {
    return { subtask, taskName, projectName };
}
// A week of DaySchedules, every day empty unless overridden.
function makeSchedule(overrides: Partial<Record<DayOfWeek, DayEntry[]>> = {}) {
    return WEEK.map((day) => ({ day, items: overrides[day] ?? [] }));
}

describe('scheduleByDay', () => {
    /*
     * Testing strategy
     *     partition on projects: empty | nonempty
     *     partition on task shape: leaf (unscheduled) | has subtasks
     *     partition on a subtask's days: assignedDay only | with missedDays
     *     partition on entries per day: none (empty day) | one | many (ordering)
     */

    it('covers empty projects -> seven empty days', () => {
        expect(scheduleByDay([])).toEqual(makeSchedule());
    });

    it('covers a subtask lands on its assignedDay', () => {
        const s = makeSubtask('s', { assignedDay: 'wed' });
        const project = makeProject('p', { tasks: [makeTask('t', { subtasks: [s] })] });
        expect(scheduleByDay([project])).toEqual(makeSchedule({ wed: [entry(s, 't', 'p')] }));
    });

    it('covers a leaf task is not scheduled', () => {
        const project = makeProject('p', { tasks: [makeTask('t', { isDone: true })] });
        expect(scheduleByDay([project])).toEqual(makeSchedule());
    });

    it('covers a missed subtask appears on its assignedDay and each missedDay', () => {
        const s = makeSubtask('s', { assignedDay: 'thu', missedDays: ['tue', 'wed'] });
        const project = makeProject('p', { tasks: [makeTask('t', { subtasks: [s] })] });
        expect(scheduleByDay([project])).toEqual(
            makeSchedule({
                tue: [entry(s, 't', 'p')],
                wed: [entry(s, 't', 'p')],
                thu: [entry(s, 't', 'p')],
            }),
        );
    });

    it('covers days with no placements stay empty', () => {
        const s1 = makeSubtask('s1', { assignedDay: 'mon' });
        const s2 = makeSubtask('s2', { assignedDay: 'fri' });
        const project = makeProject('p', { tasks: [makeTask('t', { subtasks: [s1, s2] })] });
        expect(scheduleByDay([project])).toEqual(
            makeSchedule({ mon: [entry(s1, 't', 'p')], fri: [entry(s2, 't', 'p')] }),
        );
    });

    it('covers entries on a day are ordered by project, then task, then subtask', () => {
        const a = makeSubtask('a', { assignedDay: 'mon' });
        const b = makeSubtask('b', { assignedDay: 'mon' });
        const c = makeSubtask('c', { assignedDay: 'mon' });
        const d = makeSubtask('d', { assignedDay: 'mon' });
        const p1 = makeProject('p1', {
            tasks: [makeTask('t1', { subtasks: [a, b] }), makeTask('t2', { subtasks: [c] })],
        });
        const p2 = makeProject('p2', { tasks: [makeTask('t3', { subtasks: [d] })] });
        expect(scheduleByDay([p1, p2])).toEqual(
            makeSchedule({
                mon: [
                    entry(a, 't1', 'p1'),
                    entry(b, 't1', 'p1'),
                    entry(c, 't2', 'p1'),
                    entry(d, 't3', 'p2'),
                ],
            }),
        );
    });
});
