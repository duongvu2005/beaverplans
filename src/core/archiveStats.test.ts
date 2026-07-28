import { describe, it, expect } from 'vitest';
import {
    dailyCompletions,
    weekHistory,
    weekdayHistory,
    bestWeek,
    currentStreak,
    longestStreak,
    weekTrend,
} from './archiveStats';
import type { WeekProgress } from './archiveStats';
import { WEEK } from './types';
import type { WeekPlan, Project, Task, Subtask, DayOfWeek, Archive } from './types';
import { sampleArchive } from '../fixtures/sampleArchive';

function wp(weekStart: string, done: number, total: number): WeekProgress {
    return { weekStart, progress: { done, total } };
}

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
                project('p1', [taskWithSubtasks('t1', [subtask('s1', 'thu', false, 1, ['wed'])])]),
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
        const archive: Archive = [plan('2026-07-06', [project('p1', [leafTask('t1', true)])])];
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

function zeroWeek() {
    return WEEK.map((day) => ({ day, assigned: 0, done: 0 }));
}

describe('weekdayHistory', () => {
    /**
     * Testing strategy:
     *      - partition on archives: empty | one entry | multiple entries
     *      - partition on same weekday across entries: only one entry has it |
     *        more than one entry has it (sums across entries, not just within one)
     *      - partition on a recorded miss: present (adds to assigned, not done,
     *        same as progressByDay) | absent
     */

    it('covers an empty archive: all-zero, mon-sun order', () => {
        expect(weekdayHistory([])).toEqual(zeroWeek());
    });

    it('covers one entry with a recorded miss', () => {
        const archive: Archive = [
            plan('2026-07-06', [
                project('p1', [taskWithSubtasks('t1', [subtask('s1', 'thu', false, 2, ['wed'])])]),
            ]),
        ];
        const expected = zeroWeek();
        expected[2] = { day: 'wed', assigned: 2, done: 0 }; // missed wed
        expected[3] = { day: 'thu', assigned: 2, done: 0 }; // still assigned thu
        expect(weekdayHistory(archive)).toEqual(expected);
    });

    it('covers multiple entries summing the SAME weekday', () => {
        const archive: Archive = [
            plan('2026-07-06', [
                project('p1', [taskWithSubtasks('t1', [subtask('s1', 'mon', true, 1)])]),
            ]),
            plan('2026-07-13', [
                project('p1', [taskWithSubtasks('t1', [subtask('s1', 'mon', true, 3)])]),
            ]),
        ];
        const expected = zeroWeek();
        expected[0] = { day: 'mon', assigned: 4, done: 4 };
        expect(weekdayHistory(archive)).toEqual(expected);
    });
});

describe('bestWeek', () => {
    /**
     * Testing strategy:
     *      - partition on history: empty | one entry | multiple, no tie |
     *        multiple, tied for best
     *      - partition on a 0/0 week (percent 0) mixed in with real progress
     */

    it('covers an empty history', () => {
        expect(bestWeek([])).toBeUndefined();
    });

    it('covers a single entry', () => {
        const only = wp('2026-07-06', 1, 2);
        expect(bestWeek([only])).toEqual(only);
    });

    it('covers multiple entries with a clear winner', () => {
        const low = wp('2026-07-06', 1, 4); // 25%
        const high = wp('2026-07-13', 3, 4); // 75%
        expect(bestWeek([low, high])).toEqual(high);
        expect(bestWeek([high, low])).toEqual(high);
    });

    it('covers a tie: the later week wins', () => {
        const earlier = wp('2026-07-06', 1, 2); // 50%
        const later = wp('2026-07-13', 2, 4); // 50%
        expect(bestWeek([earlier, later])).toEqual(later);
    });

    it('covers a 0/0 week not beating a week with real progress', () => {
        const empty = wp('2026-07-06', 0, 0); // percentOf treats this as 0%
        const some = wp('2026-07-13', 1, 4); // 25%
        expect(bestWeek([empty, some])).toEqual(some);
    });
});

describe('currentStreak', () => {
    /**
     * Testing strategy:
     *      - partition on history: empty | non-empty
     *      - partition on the most recent week vs threshold: below (streak 0) |
     *        at exactly threshold (counts) | above
     *      - partition on how far the streak reaches back: whole history |
     *        stops partway (an earlier week breaks it)
     */

    it('covers an empty history', () => {
        expect(currentStreak([], 50)).toBe(0);
    });

    it('covers the most recent week below threshold', () => {
        const history = [wp('2026-07-06', 3, 4), wp('2026-07-13', 1, 4)];
        expect(currentStreak(history, 50)).toBe(0);
    });

    it('covers the most recent week at exactly threshold', () => {
        const history = [wp('2026-07-06', 2, 4)]; // exactly 50%
        expect(currentStreak(history, 50)).toBe(1);
    });

    it('covers a streak broken partway back', () => {
        const history = [
            wp('2026-06-22', 3, 4), // 75%, above threshold but streak stops before here
            wp('2026-06-29', 1, 4), // 25%, breaks the streak
            wp('2026-07-06', 3, 4), // 75%
            wp('2026-07-13', 4, 4), // 100%
        ];
        expect(currentStreak(history, 50)).toBe(2);
    });

    it('covers the whole history meeting threshold', () => {
        const history = [wp('2026-07-06', 4, 4), wp('2026-07-13', 3, 4)];
        expect(currentStreak(history, 50)).toBe(2);
    });
});

describe('longestStreak', () => {
    /**
     * Testing strategy:
     *      - partition on history: empty | none meet threshold | whole
     *        history meets threshold
     *      - partition on streak location: the longest run is NOT the
     *        trailing run (distinguishes this from currentStreak)
     */

    it('covers an empty history', () => {
        expect(longestStreak([], 50)).toBe(0);
    });

    it('covers no week meeting threshold', () => {
        const history = [wp('2026-07-06', 1, 4), wp('2026-07-13', 0, 4)];
        expect(longestStreak(history, 50)).toBe(0);
    });

    it('covers the whole history meeting threshold', () => {
        const history = [wp('2026-07-06', 4, 4), wp('2026-07-13', 3, 4)];
        expect(longestStreak(history, 50)).toBe(2);
    });

    it('covers the longest run sitting earlier than a shorter trailing run', () => {
        const history = [
            wp('2026-06-15', 3, 4), // run of 3 starts
            wp('2026-06-22', 3, 4),
            wp('2026-06-29', 3, 4), // longest run = 3
            wp('2026-07-06', 0, 4), // breaks it
            wp('2026-07-13', 3, 4), // trailing run of 1 (this is currentStreak's answer)
        ];
        expect(longestStreak(history, 50)).toBe(3);
        expect(currentStreak(history, 50)).toBe(1);
    });
});

describe('weekTrend', () => {
    /**
     * Testing strategy:
     *      - partition on history length: empty | one week | more than one
     *      - partition on gaps present: none | one | several
     *      - partition on gap length: exactly 1 untracked week | many
     *      - partition on whether n truncates: history exhausted first |
     *        truncated
     *      - partition on what truncation lands on: a week (the following gap
     *        is never taken) | a gap (dropped, n-1 returned)
     *      - partition on item count returned vs n: fewer | exactly n | n-1
     *      - partition on output order: newest week is always the last item
     */

    const w = (start: string) => ({ kind: 'week', week: wp(start, 1, 2) }) as const;
    const gap = (weeks: number) => ({ kind: 'gap', weeks }) as const;

    it('covers an empty history', () => {
        expect(weekTrend([], 8)).toEqual([]);
    });

    it('covers a single week: no gap is possible', () => {
        expect(weekTrend([wp('2026-07-13', 1, 2)], 8)).toEqual([w('2026-07-13')]);
    });

    it('covers consecutive weeks, no gaps, history exhausted before n', () => {
        const history = [wp('2026-06-29', 1, 2), wp('2026-07-06', 1, 2), wp('2026-07-13', 1, 2)];
        expect(weekTrend(history, 8)).toEqual([w('2026-06-29'), w('2026-07-06'), w('2026-07-13')]);
    });

    it('covers a gap of one untracked week', () => {
        const history = [wp('2026-06-29', 1, 2), wp('2026-07-13', 1, 2)];
        expect(weekTrend(history, 8)).toEqual([w('2026-06-29'), gap(1), w('2026-07-13')]);
    });

    it('covers a gap of many untracked weeks', () => {
        // Dec 22 2025 to Jun 22 2026 is 26 weeks apart, so 25 weeks untracked.
        const history = [wp('2025-12-22', 1, 2), wp('2026-06-22', 1, 2)];
        expect(weekTrend(history, 8)).toEqual([w('2025-12-22'), gap(25), w('2026-06-22')]);
    });

    it('covers several gaps of differing length', () => {
        const history = [
            wp('2026-06-01', 1, 2),
            wp('2026-06-15', 1, 2),
            wp('2026-06-22', 1, 2),
            wp('2026-07-13', 1, 2),
        ];
        expect(weekTrend(history, 8)).toEqual([
            w('2026-06-01'),
            gap(1),
            w('2026-06-15'),
            w('2026-06-22'),
            gap(2),
            w('2026-07-13'),
        ]);
    });

    it('covers exactly n items, history exhausted', () => {
        const history = [wp('2026-06-29', 1, 2), wp('2026-07-13', 1, 2)];
        expect(weekTrend(history, 3)).toEqual([w('2026-06-29'), gap(1), w('2026-07-13')]);
    });

    it('covers truncation landing on a week: older weeks dropped, newest kept last', () => {
        const history = [
            wp('2026-06-15', 1, 2),
            wp('2026-06-22', 1, 2),
            wp('2026-06-29', 1, 2),
            wp('2026-07-06', 1, 2),
            wp('2026-07-13', 1, 2),
        ];
        expect(weekTrend(history, 3)).toEqual([w('2026-06-29'), w('2026-07-06'), w('2026-07-13')]);
    });

    it('covers truncation landing on a week that a gap precedes: the gap is not taken', () => {
        const history = [wp('2026-06-15', 1, 2), wp('2026-06-29', 1, 2), wp('2026-07-13', 1, 2)];
        expect(weekTrend(history, 3)).toEqual([w('2026-06-29'), gap(1), w('2026-07-13')]);
    });

    it('covers truncation landing on a gap: dropped, n-1 returned, its older week left off', () => {
        const history = [
            wp('2026-06-01', 1, 2),
            wp('2026-06-15', 1, 2),
            wp('2026-06-29', 1, 2),
            wp('2026-07-13', 1, 2),
        ];
        // Walking back: week, gap, week, gap — the 4th item is a gap, so it goes,
        // and Jun 15 is NOT pulled in to replace it.
        expect(weekTrend(history, 4)).toEqual([w('2026-06-29'), gap(1), w('2026-07-13')]);
    });

    it('covers n = 1: the most recent week alone', () => {
        const history = [wp('2026-06-29', 1, 2), wp('2026-07-13', 1, 2)];
        expect(weekTrend(history, 1)).toEqual([w('2026-07-13')]);
    });

    it('covers the real fixture: 7 items, both amendments idle', () => {
        const items = weekTrend(weekHistory(sampleArchive), 8);
        expect(items.map((i) => (i.kind === 'gap' ? `gap ${i.weeks}` : i.week.weekStart))).toEqual([
            '2025-12-15',
            '2025-12-22',
            'gap 25',
            '2026-06-22',
            '2026-06-29',
            '2026-07-06',
            '2026-07-13',
        ]);
    });
});
