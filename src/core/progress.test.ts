import { describe, it, expect } from 'vitest';
import type { Project, Task, Subtask, DayOfWeek } from "./types";
import type { DayProgress } from './progress';
import { taskProgress, projectProgress, overallProgress, progressByDay } from './progress';

const WEEK: DayOfWeek[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
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
// A week of DayProgress, zero unless a day is overridden.
function makeProgressByDay(
    overrides: Partial<Record<DayOfWeek, { assigned: number; done: number }>> = {},
): DayProgress[] {
    return WEEK.map(day => ({ day, assigned: 0, done: 0, ...overrides[day] }));
}

describe('taskProgress', () => {
    /*
     * Testing strategy
     *     partition on shape: leaf (no subtasks) | has subtasks
     *     partition on doneness: all done | none done | some done
     *     partition on weight: all weight 1 | mixed weights
     */

    it('covers leaf, done', () => {
        expect(taskProgress(makeTask('t', { isDone: true }))).toEqual({ done: 1, total: 1 });
    });

    it('covers leaf, undone', () => {
        expect(taskProgress(makeTask('t'))).toEqual({ done: 0, total: 1 });
    });

    it('covers has subtasks, all done, weight 1', () => {
        const t = makeTask('t', {
            subtasks: [makeSubtask('a', { isDone: true }), makeSubtask('b', { isDone: true })],
        });
        expect(taskProgress(t)).toEqual({ done: 2, total: 2 });
    });

    it('covers has subtasks, none done, weight 1', () => {
        const t = makeTask('t', { subtasks: [makeSubtask('a'), makeSubtask('b')] });
        expect(taskProgress(t)).toEqual({ done: 0, total: 2 });
    });

    it('covers has subtasks, some done, weight 1', () => {
        const t = makeTask('t', { subtasks: [makeSubtask('a', { isDone: true }), makeSubtask('b')] });
        expect(taskProgress(t)).toEqual({ done: 1, total: 2 });
    });

    it('covers has subtasks, mixed weight, mixed done', () => {
        const t = makeTask('t', {
            subtasks: [makeSubtask('a', { isDone: true, weight: 3 }), makeSubtask('b', { weight: 2 })],
        });
        expect(taskProgress(t)).toEqual({ done: 3, total: 5 });
    });

    it('covers has subtasks, mixed weight, done on both sides', () => {
        const t = makeTask('t', {
            subtasks: [
                makeSubtask('a', { isDone: true, weight: 1 }),
                makeSubtask('b', { weight: 3 }),
                makeSubtask('c', { isDone: true, weight: 2 }),
            ],
        });
        expect(taskProgress(t)).toEqual({ done: 3, total: 6 });
    });
});

describe('projectProgress', () => {
    /*
     * Testing strategy
     *     partition on number of tasks: none | one | many
     *     partition on task shape: leaf | parent | mix
     */

    it('covers no tasks', () => {
        expect(projectProgress(makeProject('p'))).toEqual({ done: 0, total: 0 });
    });

    it('covers one leaf task, done', () => {
        const p = makeProject('p', { tasks: [makeTask('t', { isDone: true })] });
        expect(projectProgress(p)).toEqual({ done: 1, total: 1 });
    });

    it('covers many leaf tasks, mixed done', () => {
        const p = makeProject('p', {
            tasks: [makeTask('a', { isDone: true }), makeTask('b')],
        });
        expect(projectProgress(p)).toEqual({ done: 1, total: 2 });
    });

    it('covers mixed shapes, leaf + parent', () => {
        const p = makeProject('p', {
            tasks: [
                makeTask('a', { isDone: true }),
                makeTask('b', {
                    subtasks: [
                        makeSubtask('b1', { isDone: true, weight: 3 }),
                        makeSubtask('b2', { weight: 2 }),
                    ],
                }),
            ],
        });
        expect(projectProgress(p)).toEqual({ done: 4, total: 6 });
    });
});

describe('overallProgress', () => {
    /*
     * Testing strategy
     *     partition on number of projects: none | one | many (incl. an empty project)
     */

    it('covers no projects', () => {
        expect(overallProgress([])).toEqual({ done: 0, total: 0 });
    });

    it('covers one project, mixed shapes', () => {
        const p = makeProject('p', {
            tasks: [
                makeTask('a', { isDone: true }),
                makeTask('b', {
                    subtasks: [
                        makeSubtask('b1', { isDone: true, weight: 3 }),
                        makeSubtask('b2', { weight: 2 }),
                    ],
                }),
            ],
        });
        expect(overallProgress([p])).toEqual({ done: 4, total: 6 });
    });

    it('covers many projects, including an empty one', () => {
        const a = makeProject('a', {
            tasks: [makeTask('a1', { isDone: true }), makeTask('a2')],
        });
        const b = makeProject('b', {
            tasks: [
                makeTask('b1', {
                    subtasks: [
                        makeSubtask('s1', { isDone: true, weight: 3 }),
                        makeSubtask('s2', { weight: 2 }),
                    ],
                }),
            ],
        });
        const c = makeProject('c'); // no tasks -> contributes {0, 0}
        expect(overallProgress([a, b, c])).toEqual({ done: 4, total: 7 });
    });
});

describe('progressByDay', () => {
    /*
     * Testing strategy
     *     partition on projects: none | one | many
     *     partition on misses: no miss | single miss | multiple misses | same-day collision
     *     partition on doneness: done | undone (crossed with misses)
     *     partition on weight: 1 | >1
     *     partition on task shape: leaf (unscheduled) | has subtasks
     */

    it('covers no projects -> all days zero', () => {
        expect(progressByDay([])).toEqual(makeProgressByDay());
    });

    it('covers no misses, subtasks across days, mixed done', () => {
        const p = makeProject('p', {
            tasks: [makeTask('t', {
                subtasks: [
                    makeSubtask('s1', { assignedDay: 'mon', isDone: true }),
                    makeSubtask('s2', { assignedDay: 'tue' }),
                    makeSubtask('s3', { assignedDay: 'mon', isDone: true }),
                ],
            })],
        });
        expect(progressByDay([p])).toEqual(
            makeProgressByDay({ mon: { assigned: 2, done: 2 }, tue: { assigned: 1, done: 0 } }),
        );
    });

    it('covers a single miss, weight 2, done on its live day', () => {
        const p = makeProject('p', {
            tasks: [makeTask('t', {
                subtasks: [
                    makeSubtask('s', { assignedDay: 'wed', isDone: true, weight: 2, missedDays: ['mon'] }),
                ],
            })],
        });
        expect(progressByDay([p])).toEqual(
            makeProgressByDay({ mon: { assigned: 2, done: 0 }, wed: { assigned: 2, done: 2 } }),
        );
    });

    it('covers multiple misses on one subtask, undone', () => {
        const p = makeProject('p', {
            tasks: [makeTask('t', {
                subtasks: [
                    makeSubtask('s', { assignedDay: 'fri', missedDays: ['mon', 'tue', 'wed'] }),
                ],
            })],
        });
        expect(progressByDay([p])).toEqual(
            makeProgressByDay({
                mon: { assigned: 1, done: 0 },
                tue: { assigned: 1, done: 0 },
                wed: { assigned: 1, done: 0 },
                fri: { assigned: 1, done: 0 },
            }),
        );
    });

    it('covers misses from different subtasks colliding on one day', () => {
        const a = makeProject('a', {
            tasks: [makeTask('ta', {
                subtasks: [makeSubtask('sa', { assignedDay: 'tue', missedDays: ['mon'] })],
            })],
        });
        const b = makeProject('b', {
            tasks: [makeTask('tb', {
                subtasks: [
                    makeSubtask('sb', { assignedDay: 'wed', weight: 2, missedDays: ['mon'] }),
                    makeSubtask('sc', { assignedDay: 'mon', isDone: true }),
                ],
            })],
        });
        expect(progressByDay([a, b])).toEqual(
            makeProgressByDay({
                mon: { assigned: 4, done: 1 },
                tue: { assigned: 1, done: 0 },
                wed: { assigned: 2, done: 0 },
            }),
        );
    });

    it('covers leaf tasks contributing nothing (not day-scheduled)', () => {
        const p = makeProject('p', {
            tasks: [makeTask('t1', { isDone: true }), makeTask('t2')],
        });
        expect(progressByDay([p])).toEqual(makeProgressByDay());
    });
});
