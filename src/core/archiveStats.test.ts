import { describe, it, expect } from 'vitest';
import { dailyCompletions, weekHistory } from './archiveStats';
import type { WeekPlan, Project, Task, Subtask, DayOfWeek, Archive } from './types';

function leafTask(id: string, isDone: boolean): Task {
    return { id, name: id, subtasks: [], isDone };
}

function taskWithSubtasks(id: string, subtasks: Subtask[]): Task {
    return { id, name: id, subtasks };
}

function subtask(
    id: string,
    day: DayOfWeek,
    isDone: boolean,
    weight = 1,
    missedDays: DayOfWeek[] = [],
): Subtask {
    return { id, isDone, assignedDay: day, missedDays, weight };
}

function project(id: string, tasks: Task[]): Project {
    return { id, name: id, tasks };
}

function plan(weekStart: string, projects: Project[]): WeekPlan {
    return { weekStart, projects };
}

describe('dailyCompletions', () => {
    /**
     * Testing strategy:
     *      - partition on archives: empty | one entry | multiple entries
     *      - partition on a subtask's isDone: done (counts) | undone (excluded,
     *        even with recorded missedDays)
     *      - partition on how many done subtasks land on the SAME resolved date:
     *        one | more than one (weights sum)
     *      - partition on weight: 1 (default) | >1
     *      - partition on task shape: has subtasks | leaf (no subtasks, no date
     *        to be credited to — contributes nothing, trap case)
     */

    it('covers an empty archive', () => {
        expect(dailyCompletions([])).toEqual(new Map());
    });

    it('covers one entry with no done subtasks', () => {
        const archive: Archive = [
            plan('2026-07-06', [
                project('p1', [taskWithSubtasks('t1', [subtask('s1', 'wed', false)])]),
            ]),
        ];
        expect(dailyCompletions(archive)).toEqual(new Map());
    });

    it('covers one done subtask, default weight', () => {
        const archive: Archive = [
            plan('2026-07-06', [
                project('p1', [taskWithSubtasks('t1', [subtask('s1', 'wed', true)])]),
            ]),
        ];
        // wed of week 2026-07-06 -> 2026-07-08
        expect(dailyCompletions(archive)).toEqual(new Map([['2026-07-08', 1]]));
    });

    it('covers a done subtask with weight > 1', () => {
        const archive: Archive = [
            plan('2026-07-06', [
                project('p1', [taskWithSubtasks('t1', [subtask('s1', 'wed', true, 3)])]),
            ]),
        ];
        expect(dailyCompletions(archive)).toEqual(new Map([['2026-07-08', 3]]));
    });

    it('covers an undone subtask with a recorded miss (excluded entirely)', () => {
        const archive: Archive = [
            plan('2026-07-06', [
                project('p1', [
                    taskWithSubtasks('t1', [subtask('s1', 'thu', false, 1, ['wed'])]),
                ]),
            ]),
        ];
        expect(dailyCompletions(archive)).toEqual(new Map());
    });

    it('covers multiple done subtasks resolving to the same date (weights sum)', () => {
        const archive: Archive = [
            plan('2026-07-06', [
                project('p1', [
                    taskWithSubtasks('t1', [subtask('s1', 'wed', true, 2)]),
                    taskWithSubtasks('t2', [subtask('s2', 'wed', true, 1)]),
                ]),
                project('p2', [taskWithSubtasks('t3', [subtask('s3', 'wed', true, 1)])]),
            ]),
        ];
        expect(dailyCompletions(archive)).toEqual(new Map([['2026-07-08', 4]]));
    });

    it('covers a leaf task (no subtasks): contributes nothing even if done', () => {
        const archive: Archive = [
            plan('2026-07-06', [project('p1', [leafTask('t1', true)])]),
        ];
        expect(dailyCompletions(archive)).toEqual(new Map());
    });

    it('covers multiple archive entries, each keyed off its own weekStart', () => {
        const archive: Archive = [
            plan('2026-07-06', [
                project('p1', [taskWithSubtasks('t1', [subtask('s1', 'mon', true)])]),
            ]),
            plan('2026-07-13', [
                project('p1', [taskWithSubtasks('t1', [subtask('s1', 'mon', true, 2)])]),
            ]),
        ];
        expect(dailyCompletions(archive)).toEqual(
            new Map([
                ['2026-07-06', 1],
                ['2026-07-13', 2],
            ]),
        );
    });
});

describe('weekHistory', () => {
    /**
     * Testing strategy:
     *      - partition on archives: empty | one entry | multiple entries
     *      - partition on stored order vs chronological order: same | reversed
     *        (sort must not just trust input order)
     *      - partition on a week's progress: no projects (0/0) | partially done |
     *        fully done
     */

    it('covers an empty archive', () => {
        expect(weekHistory([])).toEqual([]);
    });

    it('covers one entry with no projects', () => {
        const archive: Archive = [plan('2026-07-06', [])];
        expect(weekHistory(archive)).toEqual([
            { weekStart: '2026-07-06', progress: { done: 0, total: 0 } },
        ]);
    });

    it('covers one entry, partially done', () => {
        const archive: Archive = [
            plan('2026-07-06', [
                project('p1', [
                    taskWithSubtasks('t1', [
                        subtask('s1', 'mon', true, 2),
                        subtask('s2', 'tue', false, 1),
                    ]),
                ]),
            ]),
        ];
        expect(weekHistory(archive)).toEqual([
            { weekStart: '2026-07-06', progress: { done: 2, total: 3 } },
        ]);
    });

    it('covers multiple entries stored out of chronological order', () => {
        const later = plan('2026-07-13', [
            project('p1', [taskWithSubtasks('t1', [subtask('s1', 'mon', true)])]),
        ]);
        const earlier = plan('2026-07-06', [project('p1', [leafTask('t1', true)])]);
        const archive: Archive = [later, earlier];

        expect(weekHistory(archive)).toEqual([
            { weekStart: '2026-07-06', progress: { done: 1, total: 1 } },
            { weekStart: '2026-07-13', progress: { done: 1, total: 1 } },
        ]);
    });
});
