import { describe, it, expect } from 'vitest';
import {
    archiveWeek,
    archiveNewestFirst,
    carryUnfinished,
    removeArchived,
} from './archive';
import { isValidPlan } from './projects';
import type { WeekPlan, Project, Task, Subtask, DayOfWeek, Archive } from './types';

function sorted(archive: Archive): Archive {
    return [...archive].sort((a, b) => a.weekStart.localeCompare(b.weekStart));
}

// A leaf task (no subtasks), done-ness stored directly.
function leafTask(id: string, isDone: boolean): Task {
    return { id, name: id, subtasks: [], isDone };
}

// A task carried out through its subtasks (done-ness derived, not stored).
function taskWithSubtasks(id: string, subtasks: Subtask[]): Task {
    return { id, name: id, subtasks };
}

function subtask(
    id: string,
    day: DayOfWeek,
    isDone: boolean,
    missedDays: DayOfWeek[] = [],
): Subtask {
    return { id, isDone, assignedDay: day, missedDays, weight: 1 };
}

function project(id: string, tasks: Task[]): Project {
    return { id, name: id, tasks };
}

describe('archiveWeek', () => {
    it('archives into an empty archive', () => {
        const plan: WeekPlan = { weekStart: '2026-07-06', projects: [] };
        expect(archiveWeek([], plan)).toEqual([plan]);
    });

    it('adds to existing entries, leaving them unchanged, order unspecified', () => {
        const first: WeekPlan = { weekStart: '2026-06-22', projects: [] };
        const second: WeekPlan = { weekStart: '2026-06-29', projects: [] };
        const archive: Archive = [first, second];
        const plan: WeekPlan = { weekStart: '2026-07-06', projects: [] };

        const result = archiveWeek(archive, plan);

        expect(sorted(result)).toEqual([first, second, plan]);
        expect(archive).toEqual([first, second]); // input untouched
    });
});

describe('carryUnfinished', () => {
    /**
     * Testing strategy:
     *      - partition on a project's tasks: already empty | all done | all undone | mix
     *      - partition on a kept task-with-subtasks: no subtasks done | some done, some not
     *      - partition on task shape: leaf task | task with subtasks
     *      - partition on a kept subtask: missedDays empty | missedDays non-empty
     *      properties checked: weekStart -> newWeekStart, ids preserved, result is valid
     */
    const WEEK_START = '2026-06-22';
    const NEXT_WEEK_START = '2026-06-29';

    it('drops a project that already has no tasks', () => {
        const plan: WeekPlan = { weekStart: WEEK_START, projects: [project('p1', [])] };
        const result = carryUnfinished(plan, NEXT_WEEK_START);

        expect(result.weekStart).toBe(NEXT_WEEK_START);
        expect(result.projects).toEqual([]);
        expect(isValidPlan(result)).toBe(true);
    });

    it('drops a project whose tasks are all done', () => {
        const plan: WeekPlan = {
            weekStart: WEEK_START,
            projects: [project('p1', [leafTask('t1', true), leafTask('t2', true)])],
        };
        expect(carryUnfinished(plan, NEXT_WEEK_START).projects).toEqual([]);
    });

    it('keeps a project in full when none of its tasks are done', () => {
        const t1 = leafTask('t1', false);
        const t2 = leafTask('t2', false);
        const plan: WeekPlan = { weekStart: WEEK_START, projects: [project('p1', [t1, t2])] };
        const planCopy = structuredClone(plan);

        const result = carryUnfinished(plan, NEXT_WEEK_START);

        expect(result.projects).toEqual([project('p1', [t1, t2])]);
        expect(plan).toEqual(planCopy); // input untouched
    });

    it('keeps only the undone tasks of a project, dropping the done ones', () => {
        const t1 = leafTask('t1', true);
        const t2 = leafTask('t2', false);
        const t3 = leafTask('t3', true);
        const t4 = leafTask('t4', false);
        const plan: WeekPlan = {
            weekStart: WEEK_START,
            projects: [project('p1', [t1, t2, t3, t4])],
        };
        expect(carryUnfinished(plan, NEXT_WEEK_START).projects).toEqual([
            project('p1', [t2, t4]),
        ]);
    });

    it('keeps a task-with-subtasks in full when none of its subtasks are done', () => {
        const t1 = taskWithSubtasks('t1', [subtask('s1', 'mon', false), subtask('s2', 'tue', false)]);
        const plan: WeekPlan = { weekStart: WEEK_START, projects: [project('p1', [t1])] };

        expect(carryUnfinished(plan, NEXT_WEEK_START).projects).toEqual([project('p1', [t1])]);
    });

    it('keeps only the undone subtasks of a partly-done task, resetting missedDays', () => {
        const s1 = subtask('s1', 'wed', true); // done, dropped
        const s2 = subtask('s2', 'thu', false, ['mon', 'tue']); // undone, kept, missed reset
        const s3 = subtask('s3', 'fri', true); // done, dropped
        const t1 = taskWithSubtasks('t1', [s1, s2, s3]);
        const plan: WeekPlan = { weekStart: WEEK_START, projects: [project('p1', [t1])] };

        const result = carryUnfinished(plan, NEXT_WEEK_START);

        expect(result.projects).toEqual([
            project('p1', [taskWithSubtasks('t1', [subtask('s2', 'thu', false, [])])]),
        ]);
        expect(isValidPlan(result)).toBe(true);
    });
});

describe('archiveNewestFirst', () => {
    /**
     * Testing strategy:
     *      - partition on size: empty | one | many
     *      - partition on incoming order: already newest-first | oldest-first | shuffled
     *      - partition on span: within a month | across a year boundary
     *      - property: the argument is not mutated
     */

    const w = (weekStart: string): WeekPlan => ({ weekStart, projects: [] });

    it('covers empty', () => {
        expect(archiveNewestFirst([])).toEqual([]);
    });

    it('covers one entry', () => {
        expect(archiveNewestFirst([w('2026-07-06')])).toEqual([w('2026-07-06')]);
    });

    it('covers many, already newest-first: order preserved', () => {
        const archive = [w('2026-07-13'), w('2026-07-06'), w('2026-06-29')];
        expect(archiveNewestFirst(archive)).toEqual(archive);
    });

    it('covers many, oldest-first: order reversed', () => {
        const archive = [w('2026-06-29'), w('2026-07-06'), w('2026-07-13')];
        expect(archiveNewestFirst(archive).map((e) => e.weekStart)).toEqual([
            '2026-07-13',
            '2026-07-06',
            '2026-06-29',
        ]);
    });

    it('covers shuffled, across a year boundary', () => {
        // Dec 2026 and Jan 2027 weeks interleaved: string order must still
        // put 2027 ahead of 2026.
        const archive = [w('2026-12-21'), w('2027-01-04'), w('2026-12-28')];
        expect(archiveNewestFirst(archive).map((e) => e.weekStart)).toEqual([
            '2027-01-04',
            '2026-12-28',
            '2026-12-21',
        ]);
    });

    it('does not mutate its argument', () => {
        const archive = [w('2026-06-29'), w('2026-07-13'), w('2026-07-06')];
        const before = archive.map((e) => e.weekStart);
        archiveNewestFirst(archive);
        expect(archive.map((e) => e.weekStart)).toEqual(before);
    });
});

describe('removeArchived', () => {
    /**
     * Testing strategy:
     *      - partition on position of the removed entry: only | first | middle | last
     *      - partition on presence: weekStart present | absent | archive empty
     *      - property: surviving entries keep their relative order and identity
     */

    const w = (weekStart: string): WeekPlan => ({ weekStart, projects: [] });

    it('covers the only entry', () => {
        expect(removeArchived([w('2026-07-06')], '2026-07-06')).toEqual([]);
    });

    it('covers the first of many', () => {
        const archive = [w('2026-06-29'), w('2026-07-06'), w('2026-07-13')];
        expect(removeArchived(archive, '2026-06-29').map((e) => e.weekStart)).toEqual([
            '2026-07-06',
            '2026-07-13',
        ]);
    });

    it('covers a middle entry, surviving order preserved', () => {
        const archive = [w('2026-06-29'), w('2026-07-06'), w('2026-07-13')];
        expect(removeArchived(archive, '2026-07-06').map((e) => e.weekStart)).toEqual([
            '2026-06-29',
            '2026-07-13',
        ]);
    });

    it('covers the last of many', () => {
        const archive = [w('2026-06-29'), w('2026-07-06'), w('2026-07-13')];
        expect(removeArchived(archive, '2026-07-13').map((e) => e.weekStart)).toEqual([
            '2026-06-29',
            '2026-07-06',
        ]);
    });

    it('covers an absent weekStart: contents unchanged', () => {
        const archive = [w('2026-06-29'), w('2026-07-06')];
        expect(removeArchived(archive, '2026-08-03')).toEqual(archive);
    });

    it('covers an empty archive', () => {
        expect(removeArchived([], '2026-07-06')).toEqual([]);
    });

    it('keeps surviving entries identical, not copies', () => {
        const keep = w('2026-07-13');
        const result = removeArchived([w('2026-07-06'), keep], '2026-07-06');
        expect(result[0]).toBe(keep);
    });
});
