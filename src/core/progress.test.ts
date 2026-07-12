import { describe, it, expect } from 'vitest';
import type { Project, Task, Subtask } from "./types";
import { taskProgress, projectProgress, overallProgress } from './progress';

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
