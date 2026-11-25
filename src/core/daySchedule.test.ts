import { describe, it, expect } from 'vitest';
import type { Project, Task, Subtask, DayOfWeek } from './types';
import { WEEK } from './types';
import type { DayEntry } from './daySchedule';
import { dueByDay, scheduleByDay } from './daySchedule';

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

describe('dueByDay', () => {
    /**
     * Testing strategy:
     *      - partition on where the deadline falls: before the week | its Monday |
     *        mid-week | its Sunday | after the week
     *      - partition on what carries it: a project | a task | both on one day
     *      - partition on the stored value: parses | does not parse | absent
     *      - partition on doneness: unfinished (counted) | a done project |
     *        a done task (both left out — a flag means something is still due)
     *      - partition on days: every one of the seven appears, empty ones included
     *      - ordering within a day: tree order, a project ahead of its own tasks
     */

    const WEEK_START = '2026-08-10'; // Mon .. Sun 2026-08-16

    it('covers a week with nothing dated: seven empty days', () => {
        const result = dueByDay([makeProject('p', { tasks: [makeTask('t')] })], WEEK_START);
        expect(result.map((d) => d.day)).toEqual([...WEEK]);
        expect(result.every((d) => d.entries.length === 0)).toBe(true);
    });

    it('covers a task deadline mid-week: lands on its own weekday', () => {
        const task = makeTask('t', { name: 'Draft', deadline: '2026-08-12' });
        const result = dueByDay([makeProject('p', { tasks: [task] })], WEEK_START);
        expect(result.find((d) => d.day === 'wed')?.entries).toEqual([
            { name: 'Draft', kind: 'task', deadline: '2026-08-12' },
        ]);
        expect(result.filter((d) => d.entries.length > 0)).toHaveLength(1);
    });

    it("covers the week's Monday and Sunday, its two inclusive ends", () => {
        const projects = [
            makeProject('p', {
                tasks: [
                    makeTask('a', { name: 'A', deadline: '2026-08-10' }),
                    makeTask('b', { name: 'B', deadline: '2026-08-16' }),
                ],
            }),
        ];
        const result = dueByDay(projects, WEEK_START);
        expect(result.find((d) => d.day === 'mon')?.entries.map((e) => e.name)).toEqual(['A']);
        expect(result.find((d) => d.day === 'sun')?.entries.map((e) => e.name)).toEqual(['B']);
    });

    it('covers deadlines outside the week: no column to put them on, so dropped', () => {
        const projects = [
            makeProject('p', {
                tasks: [
                    makeTask('a', { name: 'A', deadline: '2026-08-09' }),
                    makeTask('b', { name: 'B', deadline: '2026-08-17' }),
                    makeTask('c', { name: 'C', deadline: '2027-08-12' }),
                ],
            }),
        ];
        const result = dueByDay(projects, WEEK_START);
        expect(result.every((d) => d.entries.length === 0)).toBe(true);
    });

    it('covers a project deadline: counted, and ahead of its own tasks that day', () => {
        const projects = [
            makeProject('p', {
                name: 'Thesis',
                deadline: '2026-08-12',
                tasks: [makeTask('t', { name: 'Draft', deadline: '2026-08-12' })],
            }),
        ];
        const result = dueByDay(projects, WEEK_START);
        expect(result.find((d) => d.day === 'wed')?.entries).toEqual([
            { name: 'Thesis', kind: 'project', deadline: '2026-08-12' },
            { name: 'Draft', kind: 'task', deadline: '2026-08-12' },
        ]);
    });

    it('covers a datetime deadline: the day is read off the date half', () => {
        const task = makeTask('t', { name: 'Draft', deadline: '2026-08-14T23:30' });
        const result = dueByDay([makeProject('p', { tasks: [task] })], WEEK_START);
        expect(result.find((d) => d.day === 'fri')?.entries.map((e) => e.name)).toEqual(['Draft']);
    });

    it('covers an unparseable stored deadline: dropped, not crashed', () => {
        const task = makeTask('t', { name: 'Draft', deadline: 'whenever' });
        const result = dueByDay([makeProject('p', { tasks: [task] })], WEEK_START);
        expect(result.every((d) => d.entries.length === 0)).toBe(true);
    });

    it('covers a done task: left out, because a flag means something is still due', () => {
        const task = makeTask('t', { name: 'Draft', deadline: '2026-08-12', isDone: true });
        const result = dueByDay([makeProject('p', { tasks: [task] })], WEEK_START);
        expect(result.every((d) => d.entries.length === 0)).toBe(true);
    });

    it('covers a done project: left out, its own deadline included', () => {
        const projects = [
            makeProject('p', {
                name: 'Thesis',
                deadline: '2026-08-12',
                tasks: [makeTask('t', { name: 'Draft', isDone: true })],
            }),
        ];
        const result = dueByDay(projects, WEEK_START);
        expect(result.every((d) => d.entries.length === 0)).toBe(true);
    });

    it('covers several projects: tree order across them, one day holding many', () => {
        const projects = [
            makeProject('p1', {
                name: 'One',
                tasks: [makeTask('a', { name: 'A', deadline: '2026-08-12' })],
            }),
            makeProject('p2', {
                name: 'Two',
                deadline: '2026-08-12',
                tasks: [makeTask('b', { name: 'B', deadline: '2026-08-12' })],
            }),
        ];
        const result = dueByDay(projects, WEEK_START);
        expect(result.find((d) => d.day === 'wed')?.entries.map((e) => e.name)).toEqual([
            'A',
            'Two',
            'B',
        ]);
    });

    it('covers the input being left alone', () => {
        const projects = [makeProject('p', { tasks: [makeTask('t', { deadline: '2026-08-12' })] })];
        const snapshot = JSON.stringify(projects);
        dueByDay(projects, WEEK_START);
        expect(JSON.stringify(projects)).toBe(snapshot);
    });
});
