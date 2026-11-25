import { describe, it, expect } from 'vitest';
import { LIMITS, fitsName, fitsNote, projectRoom, subtaskRoom, taskRoom } from './limits';
import type { Project, Subtask, Task } from './types';

function makeSubtask(id: string): Subtask {
    return { id, isDone: false, assignedDay: 'mon', missedDays: [], weight: 1 };
}

function makeTask(id: string): Task {
    return { id, name: id, isDone: false, subtasks: [] };
}

function makeProject(id: string, tasks: ReadonlyArray<Task> = []): Project {
    return { id, name: id, tasks };
}

function projects(n: number): ReadonlyArray<Project> {
    return Array.from({ length: n }, (_, i) => makeProject(`p${i}`));
}

function tasks(n: number): ReadonlyArray<Task> {
    return Array.from({ length: n }, (_, i) => makeTask(`t${i}`));
}

function subtasks(n: number): ReadonlyArray<Subtask> {
    return Array.from({ length: n }, (_, i) => makeSubtask(`s${i}`));
}

function repeat(n: number): string {
    return 'x'.repeat(n);
}

describe('projectRoom', () => {
    /*
     * Testing strategy
     *     partition on count: 0 | in between | one below cap | at cap | above cap
     */
    it('covers empty', () => {
        expect(projectRoom([])).toBe(LIMITS.projectsPerWeek);
    });

    it('covers in between', () => {
        expect(projectRoom(projects(3))).toBe(LIMITS.projectsPerWeek - 3);
    });

    it('covers one below cap', () => {
        expect(projectRoom(projects(LIMITS.projectsPerWeek - 1))).toBe(1);
    });

    it('covers at cap', () => {
        expect(projectRoom(projects(LIMITS.projectsPerWeek))).toBe(0);
    });

    it('covers above cap', () => {
        expect(projectRoom(projects(LIMITS.projectsPerWeek + 5))).toBe(0);
    });
});

describe('taskRoom', () => {
    /*
     * Testing strategy
     *     partition on count: 0 | one below cap | at cap | above cap
     */
    it('covers empty', () => {
        expect(taskRoom(makeProject('p'))).toBe(LIMITS.tasksPerProject);
    });

    it('covers one below cap', () => {
        expect(taskRoom(makeProject('p', tasks(LIMITS.tasksPerProject - 1)))).toBe(1);
    });

    it('covers at cap', () => {
        expect(taskRoom(makeProject('p', tasks(LIMITS.tasksPerProject)))).toBe(0);
    });

    it('covers above cap', () => {
        expect(taskRoom(makeProject('p', tasks(LIMITS.tasksPerProject + 5)))).toBe(0);
    });
});

describe('subtaskRoom', () => {
    /*
     * Testing strategy
     *     partition on count: 0 | one below cap | at cap | above cap
     */
    it('covers empty', () => {
        expect(subtaskRoom([])).toBe(LIMITS.subtasksPerTask);
    });

    it('covers one below cap', () => {
        expect(subtaskRoom(subtasks(LIMITS.subtasksPerTask - 1))).toBe(1);
    });

    it('covers at cap', () => {
        expect(subtaskRoom(subtasks(LIMITS.subtasksPerTask))).toBe(0);
    });

    it('covers above cap', () => {
        expect(subtaskRoom(subtasks(LIMITS.subtasksPerTask + 5))).toBe(0);
    });
});

describe('fitsName', () => {
    /*
     * Testing strategy
     *     partition on length: 0 | 1 | one below cap | at cap | above cap
     *     partition on content: plain | astral (surrogate pair)
     */
    it('covers empty', () => {
        expect(fitsName('')).toBe(true);
    });

    it('covers one character', () => {
        expect(fitsName('x')).toBe(true);
    });

    it('covers one below cap', () => {
        expect(fitsName(repeat(LIMITS.nameLength - 1))).toBe(true);
    });

    it('covers at cap', () => {
        expect(fitsName(repeat(LIMITS.nameLength))).toBe(true);
    });

    it('covers above cap', () => {
        expect(fitsName(repeat(LIMITS.nameLength + 1))).toBe(false);
    });

    // Counting code points instead would let a field accept a name this rejects.
    it('covers astral characters, counted as the DOM counts them', () => {
        const cap = LIMITS.nameLength;
        expect(fitsName('👍'.repeat(cap / 2))).toBe(true);
        expect(fitsName('👍'.repeat(cap / 2) + 'x')).toBe(false);
    });
});

describe('fitsNote', () => {
    /*
     * Testing strategy
     *     partition on length: 0 | at cap | above cap
     *     partition on content: single line | multi-line
     */
    it('covers empty', () => {
        expect(fitsNote('')).toBe(true);
    });

    it('covers at cap', () => {
        expect(fitsNote(repeat(LIMITS.descriptionLength))).toBe(true);
    });

    it('covers above cap', () => {
        expect(fitsNote(repeat(LIMITS.descriptionLength + 1))).toBe(false);
    });

    it('covers multi-line', () => {
        expect(fitsNote('a\nb\nc')).toBe(true);
        expect(fitsNote('\n'.repeat(LIMITS.descriptionLength + 1))).toBe(false);
    });
});

describe('the caps themselves', () => {
    // The CHECK constraints these shadow are in supabase/migrations.
    it('leaves headroom under the database ceiling', () => {
        expect(LIMITS.projectsPerWeek).toBeLessThan(LIMITS.dbProjectsPerWeek);
    });
});
