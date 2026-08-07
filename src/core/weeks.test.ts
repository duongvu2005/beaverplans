import { describe, it, expect } from 'vitest';
import {
    canEndWeek,
    carryForward,
    earliestActiveWeek,
    endWeek,
    endedWeeks,
    isEmptyWeek,
    isEnded,
    isValidWeeks,
    moveWeek,
    putWeek,
    removeWeek,
    reopenWeek,
    weekAt,
} from './weeks';
import type { DateKey, Project, Subtask, Task, WeekPlan, Weeks } from './types';

// Real Mondays, one week apart, so string order is chronological order.
const JUN22 = '2026-06-22';
const JUN29 = '2026-06-29';
const JUL06 = '2026-07-06';
const JUL13 = '2026-07-13';
const JUL20 = '2026-07-20';
const JUL27 = '2026-07-27';

function leafTask(id: string, isDone: boolean): Task {
    return { id, name: id, subtasks: [], isDone };
}

function subtask(id: string, isDone: boolean, missedDays: Subtask['missedDays'] = []): Subtask {
    return { id, isDone, assignedDay: 'wed', missedDays, weight: 1 };
}

function project(id: string, tasks: Task[]): Project {
    return { id, name: id, tasks };
}

// A one-project week whose every id is prefixed, so two weeks built with
// different prefixes satisfy collection-wide id uniqueness.
function week(weekStart: DateKey, prefix: string, ended: boolean = false): WeekPlan {
    return {
        weekStart,
        ended,
        projects: [project(`${prefix}-p`, [leafTask(`${prefix}-t`, false)])],
    };
}

function emptyWeek(weekStart: DateKey): WeekPlan {
    return { weekStart, ended: false, projects: [] };
}

// One project holding a half-finished task (one subtask done, one missed and
// undone) and a finished one — enough to tell "keep everything" from "keep only
// what is left to do".
function detailedWeek(weekStart: DateKey): WeekPlan {
    return {
        weekStart,
        ended: false,
        projects: [
            {
                id: 'd-p',
                name: 'proj',
                tasks: [
                    {
                        id: 'd-half',
                        name: 'half',
                        subtasks: [subtask('d-s1', true), subtask('d-s2', false, ['mon'])],
                    },
                    { id: 'd-done', name: 'done', subtasks: [subtask('d-s3', true)] },
                ],
            },
        ],
    };
}

function starts(weeks: Weeks): ReadonlyArray<DateKey> {
    return weeks.map((w) => w.weekStart);
}

describe('isEmptyWeek', () => {
    it('no projects: empty', () => {
        expect(isEmptyWeek(emptyWeek(JUL06))).toBe(true);
    });

    it('a project with no tasks: NOT empty (you made a thing, it stays)', () => {
        expect(isEmptyWeek({ weekStart: JUL06, ended: false, projects: [project('p', [])] })).toBe(
            false,
        );
    });

    it('a project with work: not empty', () => {
        expect(isEmptyWeek(week(JUL06, 'a'))).toBe(false);
    });
});

describe('isEnded', () => {
    it('absent: not ended', () => {
        expect(isEnded(week(JUL06, 'a'))).toBe(false);
    });

    it('false: not ended', () => {
        expect(isEnded(week(JUL06, 'a', false))).toBe(false);
    });

    it('true: ended', () => {
        expect(isEnded(week(JUL06, 'a', true))).toBe(true);
    });
});

describe('weekAt', () => {
    it('present: that entry, ended flag included', () => {
        const ended = week(JUL06, 'a', true);
        expect(weekAt([ended, week(JUL13, 'b')], JUL06)).toBe(ended);
    });

    it('absent: an empty, un-ended plan for that week', () => {
        expect(weekAt([week(JUL13, 'b')], JUL06)).toEqual({
            weekStart: JUL06,
            ended: false,
            projects: [],
        });
        expect(isEnded(weekAt([week(JUL13, 'b')], JUL06))).toBe(false);
    });

    it('empty collection: an empty plan', () => {
        expect(weekAt([], JUL06)).toEqual({ weekStart: JUL06, ended: false, projects: [] });
    });
});

describe('putWeek', () => {
    it('into an empty collection', () => {
        const a = week(JUL06, 'a');
        expect(putWeek([], a)).toEqual([a]);
    });

    it('inserts before every entry', () => {
        const weeks = putWeek([week(JUL13, 'b'), week(JUL20, 'c')], week(JUL06, 'a'));
        expect(starts(weeks)).toEqual([JUL06, JUL13, JUL20]);
    });

    it('inserts between entries', () => {
        const weeks = putWeek([week(JUL06, 'a'), week(JUL20, 'c')], week(JUL13, 'b'));
        expect(starts(weeks)).toEqual([JUL06, JUL13, JUL20]);
    });

    it('inserts after every entry', () => {
        const weeks = putWeek([week(JUL06, 'a'), week(JUL13, 'b')], week(JUL20, 'c'));
        expect(starts(weeks)).toEqual([JUL06, JUL13, JUL20]);
    });

    it('replaces an existing entry in place, without duplicating it', () => {
        const replacement = week(JUL13, 'b2');
        const weeks = putWeek([week(JUL06, 'a'), week(JUL13, 'b'), week(JUL20, 'c')], replacement);
        expect(starts(weeks)).toEqual([JUL06, JUL13, JUL20]);
        expect(weeks[1]).toBe(replacement);
    });

    it('an empty plan deletes the existing entry', () => {
        const weeks = putWeek([week(JUL06, 'a'), week(JUL13, 'b')], emptyWeek(JUL06));
        expect(starts(weeks)).toEqual([JUL13]);
    });

    it('an empty plan for an absent week changes nothing', () => {
        const before: Weeks = [week(JUL06, 'a')];
        expect(putWeek(before, emptyWeek(JUL13))).toEqual(before);
    });

    it('refuses to write over an ended entry', () => {
        const before: Weeks = [week(JUL06, 'a', true)];
        expect(putWeek(before, week(JUL06, 'a2'))).toEqual(before);
    });

    it('an empty plan does NOT prune an ended entry (frozen outranks prune)', () => {
        const before: Weeks = [week(JUL06, 'a', true)];
        expect(putWeek(before, emptyWeek(JUL06))).toEqual(before);
    });

    it('shares untouched entries by reference and does not mutate its input', () => {
        const a = week(JUL06, 'a');
        const before: Weeks = [a];
        const after = putWeek(before, week(JUL13, 'b'));
        expect(after[0]).toBe(a);
        expect(before).toEqual([a]);
    });

    it('maintains the rep invariant (oracle)', () => {
        const weeks = [week(JUL20, 'c'), week(JUL06, 'a')].reduce<Weeks>(putWeek, [
            week(JUL13, 'b'),
        ]);
        expect(isValidWeeks(weeks)).toBe(true);
    });
});

describe('removeWeek', () => {
    it('removes the entry with that weekStart', () => {
        const weeks = removeWeek([week(JUL06, 'a'), week(JUL13, 'b')], JUL06);
        expect(starts(weeks)).toEqual([JUL13]);
    });

    it('no entry with that weekStart: unchanged', () => {
        const before: Weeks = [week(JUL06, 'a')];
        expect(removeWeek(before, JUL13)).toEqual(before);
    });
});

describe('endedWeeks', () => {
    it('keeps only the ended entries, in order', () => {
        const weeks: Weeks = [
            week(JUN29, 'a', true),
            week(JUL06, 'b'),
            week(JUL13, 'c', true),
            week(JUL20, 'd', false),
        ];
        expect(starts(endedWeeks(weeks))).toEqual([JUN29, JUL13]);
    });

    it('none ended: empty', () => {
        expect(endedWeeks([week(JUL06, 'a')])).toEqual([]);
    });

    it('empty collection: empty', () => {
        expect(endedWeeks([])).toEqual([]);
    });
});

describe('earliestActiveWeek', () => {
    it('empty collection: nothing waiting', () => {
        expect(earliestActiveWeek([], JUL20)).toBeUndefined();
    });

    it('the earliest active week, when it is in the past', () => {
        const weeks: Weeks = [week(JUL06, 'a'), week(JUL13, 'b')];
        expect(earliestActiveWeek(weeks, JUL20)).toBe(JUL06);
    });

    it('skips ended weeks to the earliest active one', () => {
        const weeks: Weeks = [week(JUN29, 'a', true), week(JUL06, 'b', true), week(JUL13, 'c')];
        expect(earliestActiveWeek(weeks, JUL20)).toBe(JUL13);
    });

    it('every week ended: nothing waiting', () => {
        const weeks: Weeks = [week(JUN29, 'a', true), week(JUL06, 'b', true)];
        expect(earliestActiveWeek(weeks, JUL20)).toBeUndefined();
    });

    it('the only active weeks are in the future: nothing waiting', () => {
        const weeks: Weeks = [week(JUL06, 'a', true), week(JUL27, 'b')];
        expect(earliestActiveWeek(weeks, JUL20)).toBeUndefined();
    });

    it('an active current week is itself the answer', () => {
        expect(earliestActiveWeek([week(JUL20, 'a')], JUL20)).toBe(JUL20);
    });

    it('finds an active week even when it sits before an ended one (interleaved)', () => {
        const weeks: Weeks = [week(JUL06, 'a'), week(JUL13, 'b', true)];
        expect(earliestActiveWeek(weeks, JUL20)).toBe(JUL06);
    });

    it('the current week itself is already ended, nothing earlier: nothing waiting', () => {
        expect(earliestActiveWeek([week(JUL20, 'a', true)], JUL20)).toBeUndefined();
    });
});

describe('moveWeek', () => {
    // A week with done work and a recorded miss, to prove a relabel keeps both.
    const detailed: WeekPlan = {
        weekStart: JUL13,
        ended: false,
        projects: [
            project('d-p', [{ id: 'd-t', name: 'd-t', subtasks: [subtask('d-s', true, ['mon'])] }]),
        ],
    };

    it('relabels the plan onto an absent week and prunes the source', () => {
        const weeks = moveWeek([detailed, week(JUL06, 'a')], JUL13, JUL27);
        expect(starts(weeks)).toEqual([JUL06, JUL27]);
        expect(weekAt(weeks, JUL27).projects).toEqual(detailed.projects);
        expect(isEmptyWeek(weekAt(weeks, JUL13))).toBe(true);
    });

    it('keeps isDone, missedDays and ids verbatim — no progress is lost', () => {
        const moved = weekAt(moveWeek([detailed], JUL13, JUL27), JUL27);
        expect(moved.projects[0]?.tasks[0]?.subtasks[0]).toEqual(subtask('d-s', true, ['mon']));
    });

    it('moves backward as readily as forward', () => {
        expect(starts(moveWeek([week(JUL20, 'a')], JUL20, JUL13))).toEqual([JUL13]);
    });

    it('pushing a stale week forward clears the end-week queue behind it', () => {
        const before: Weeks = [week(JUL06, 'a', true), week(JUL13, 'b')];
        expect(earliestActiveWeek(before, JUL20)).toBe(JUL13);
        const weeks = moveWeek(before, JUL13, JUL27);
        expect(earliestActiveWeek(weeks, JUL20)).toBeUndefined(); // was toBe(JUL20)
        expect(isValidWeeks(weeks)).toBe(true);
    });

    it('a free week before an ended one is now a legal destination (interleaving)', () => {
        const before: Weeks = [week(JUL13, 'a', true), week(JUL27, 'b')];
        const weeks = moveWeek(before, JUL27, JUN29);
        expect(starts(weeks)).toEqual([JUN29, JUL13]);
        expect(isValidWeeks(weeks)).toBe(true);
    });

    it('the ended week itself is still occupied, so still refused', () => {
        const before: Weeks = [week(JUL13, 'a', true), week(JUL27, 'b')];
        expect(moveWeek(before, JUL27, JUL13)).toEqual(before);
    });

    it('destination just after the last ended week: allowed', () => {
        const weeks = moveWeek([week(JUL13, 'a', true), week(JUL27, 'b')], JUL27, JUL20);
        expect(starts(weeks)).toEqual([JUL13, JUL20]);
        expect(isValidWeeks(weeks)).toBe(true);
    });

    it('nothing ended: every free week is a legal destination', () => {
        expect(starts(moveWeek([week(JUL27, 'b')], JUL27, JUN22))).toEqual([JUN22]);
    });

    it('destination already has work: unchanged', () => {
        const before: Weeks = [week(JUL13, 'a'), week(JUL20, 'b')];
        expect(moveWeek(before, JUL13, JUL20)).toEqual(before);
    });

    it('source has no work: unchanged', () => {
        const before: Weeks = [week(JUL20, 'b')];
        expect(moveWeek(before, JUL13, JUL27)).toEqual(before);
    });

    it('source is ended: unchanged', () => {
        const before: Weeks = [week(JUL13, 'a', true)];
        expect(moveWeek(before, JUL13, JUL27)).toEqual(before);
    });

    it('destination is the source: unchanged', () => {
        const before: Weeks = [week(JUL13, 'a')];
        expect(moveWeek(before, JUL13, JUL13)).toEqual(before);
    });

    it('destination is not a Monday: unchanged', () => {
        const before: Weeks = [week(JUL13, 'a')];
        expect(moveWeek(before, JUL13, '2026-07-28')).toEqual(before);
    });

    it('maintains the rep invariant (oracle)', () => {
        const weeks = moveWeek([week(JUL06, 'a'), week(JUL13, 'b')], JUL13, JUN22);
        expect(isValidWeeks(weeks)).toBe(true);
        expect(starts(weeks)).toEqual([JUN22, JUL06]);
    });
});

describe('canEndWeek', () => {
    it('the only active week, in the past: yes', () => {
        expect(canEndWeek([week(JUL13, 'a')], JUL13, JUL20)).toBe(true);
    });

    it('the current week: yes — you may close out the week you are in', () => {
        expect(canEndWeek([week(JUL20, 'a')], JUL20, JUL20)).toBe(true);
    });

    it('a future week: no', () => {
        expect(canEndWeek([week(JUL27, 'a')], JUL27, JUL20)).toBe(false);
    });

    it('no entry for that week: no', () => {
        expect(canEndWeek([week(JUL13, 'a')], JUL06, JUL20)).toBe(false);
    });

    it('already ended: no', () => {
        expect(canEndWeek([week(JUL13, 'a', true)], JUL13, JUL20)).toBe(false);
    });

    it('an older active week is still open: no longer blocks — each week ends on its own', () => {
        const weeks: Weeks = [week(JUL06, 'a'), week(JUL13, 'b')];
        expect(canEndWeek(weeks, JUL13, JUL20)).toBe(true);
        expect(canEndWeek(weeks, JUL06, JUL20)).toBe(true);
    });

    it('older weeks are all ended: the next one up is allowed', () => {
        const weeks: Weeks = [week(JUL06, 'a', true), week(JUL13, 'b')];
        expect(canEndWeek(weeks, JUL13, JUL20)).toBe(true);
    });

    it('an untouched older week does not block, having no entry', () => {
        expect(canEndWeek([week(JUL13, 'a')], JUL13, JUL20)).toBe(true);
    });
});

describe('endWeek', () => {
    it('sets ended and leaves the work exactly as it stands', () => {
        const weeks = endWeek([detailedWeek(JUL13)], JUL13, JUL20);
        expect(isEnded(weekAt(weeks, JUL13))).toBe(true);
        expect(weekAt(weeks, JUL13).projects).toEqual(detailedWeek(JUL13).projects);
    });

    it('records the unfinished work too — the archive is not only successes', () => {
        const ended = weekAt(endWeek([detailedWeek(JUL13)], JUL13, JUL20), JUL13);
        const subtasks = ended.projects[0]?.tasks[0]?.subtasks;
        expect(subtasks?.map((s) => s.isDone)).toEqual([true, false]);
    });

    it('the gate says no: unchanged', () => {
        const before: Weeks = [week(JUL27, 'a')];
        expect(endWeek(before, JUL27, JUL20)).toEqual(before);
    });

    it('maintains the rep invariant (oracle)', () => {
        const weeks = endWeek([week(JUL06, 'a'), week(JUL13, 'b')], JUL06, JUL20);
        expect(isValidWeeks(weeks)).toBe(true);
        expect(starts(endedWeeks(weeks))).toEqual([JUL06]);
    });

    it('ending the newer of two open weeks leaves an active one behind it (interleaved)', () => {
        const weeks = endWeek([week(JUL06, 'a'), week(JUL13, 'b')], JUL13, JUL20);
        expect(isValidWeeks(weeks)).toBe(true);
        expect(isEnded(weekAt(weeks, JUL13))).toBe(true);
        expect(isEnded(weekAt(weeks, JUL06))).toBe(false);
    });
});

describe('reopenWeek', () => {
    /*
     * Testing strategy
     *   partition on the entry at weekStart: ended | active | absent
     *   partition on what survives: only the flag moves — the projects, the
     *     other entries and their order do not
     *   partition on what re-opening unlocks: putWeek takes writes again,
     *     canEndWeek allows the return trip, the week leaves endedWeeks
     */

    it('clears ended and leaves the work exactly as it stands', () => {
        const weeks = reopenWeek(endWeek([detailedWeek(JUL13)], JUL13, JUL20), JUL13);
        expect(isEnded(weekAt(weeks, JUL13))).toBe(false);
        expect(weekAt(weeks, JUL13).projects).toEqual(detailedWeek(JUL13).projects);
    });

    it('an already-active week: unchanged', () => {
        const before: Weeks = [week(JUL13, 'a')];
        expect(reopenWeek(before, JUL13)).toEqual(before);
    });

    it('no entry at that week: unchanged', () => {
        const before: Weeks = [week(JUL13, 'a', true)];
        expect(reopenWeek(before, JUL27)).toEqual(before);
    });

    it('leaves the neighbouring entries and their order alone (oracle)', () => {
        const before: Weeks = [week(JUL06, 'a', true), week(JUL13, 'b', true), week(JUL20, 'c')];
        const weeks = reopenWeek(before, JUL13);
        expect(isValidWeeks(weeks)).toBe(true);
        expect(starts(weeks)).toEqual([JUL06, JUL13, JUL20]);
        expect(starts(endedWeeks(weeks))).toEqual([JUL06]);
    });

    it('undoes endWeek exactly (round trip)', () => {
        const before: Weeks = [detailedWeek(JUL13)];
        expect(reopenWeek(endWeek(before, JUL13, JUL20), JUL13)).toEqual(before);
    });

    it('the re-opened week takes edits again — putWeek no longer refuses it', () => {
        const reopened = reopenWeek([week(JUL13, 'a', true)], JUL13);
        const edited = putWeek(reopened, {
            ...weekAt(reopened, JUL13),
            projects: week(JUL13, 'b').projects,
        });
        expect(weekAt(edited, JUL13).projects).toEqual(week(JUL13, 'b').projects);
    });

    it('the re-opened week can be ended again', () => {
        const reopened = reopenWeek([week(JUL13, 'a', true)], JUL13);
        expect(canEndWeek(reopened, JUL13, JUL20)).toBe(true);
    });
});

describe('carryForward', () => {
    // Ids are minted in a fixed order so the copy can be asserted exactly.
    function counter(): () => string {
        let n = 0;
        return () => `new-${++n}`;
    }

    it('copies the undone work onto the destination, source untouched', () => {
        const before: Weeks = [detailedWeek(JUL13)];
        const weeks = carryForward(before, JUL13, JUL20, counter());
        expect(weekAt(weeks, JUL13)).toEqual(before[0]);
        expect(weekAt(weeks, JUL20).projects).toHaveLength(1);
    });

    it('keeps only undone tasks and undone subtasks', () => {
        const weeks = carryForward([detailedWeek(JUL13)], JUL13, JUL20, counter());
        const tasks = weekAt(weeks, JUL20).projects[0]?.tasks;
        expect(tasks?.map((t) => t.name)).toEqual(['half']);
        expect(tasks?.[0]?.subtasks.map((s) => s.isDone)).toEqual([false]);
    });

    it('clears missedDays on every carried subtask', () => {
        const weeks = carryForward([detailedWeek(JUL13)], JUL13, JUL20, counter());
        expect(weekAt(weeks, JUL20).projects[0]?.tasks[0]?.subtasks[0]?.missedDays).toEqual([]);
    });

    it('gives every carried node a new id, so both copies can coexist', () => {
        const weeks = carryForward([detailedWeek(JUL13)], JUL13, JUL20, counter());
        const carried = weekAt(weeks, JUL20).projects[0];
        expect(carried?.tasks[0]?.id).toBe('new-1');
        expect(carried?.tasks[0]?.subtasks[0]?.id).toBe('new-2');
        expect(carried?.id).toBe('new-3');
        expect(isValidWeeks(weeks)).toBe(true);
    });

    it('appends after the work already on the destination, never merging by name', () => {
        const weeks = carryForward(
            [detailedWeek(JUL13), week(JUL20, 'b')],
            JUL13,
            JUL20,
            counter(),
        );
        expect(weekAt(weeks, JUL20).projects.map((p) => p.name)).toEqual(['b-p', 'proj']);
    });

    it('copies onto a week with no entry at all', () => {
        const weeks = carryForward([detailedWeek(JUL13)], JUL13, JUL27, counter());
        expect(starts(weeks)).toEqual([JUL13, JUL27]);
    });

    it('a fully finished week carries nothing: unchanged', () => {
        const done: WeekPlan = {
            weekStart: JUL13,
            ended: false,
            projects: [project('p', [leafTask('t', true)])],
        };
        expect(carryForward([done], JUL13, JUL20, counter())).toEqual([done]);
    });

    it('applies to an ended source — the record keeps the whole week', () => {
        const before: Weeks = [{ ...detailedWeek(JUL13), ended: true }];
        const weeks = carryForward(before, JUL13, JUL20, counter());
        expect(weekAt(weeks, JUL13)).toEqual(before[0]);
        expect(weekAt(weeks, JUL20).projects).toHaveLength(1);
    });

    it('destination is ended: unchanged', () => {
        const before: Weeks = [detailedWeek(JUL13), week(JUL20, 'b', true)];
        expect(carryForward(before, JUL13, JUL20, counter())).toEqual(before);
    });

    it('destination is not later than the source: unchanged', () => {
        const before: Weeks = [detailedWeek(JUL13)];
        expect(carryForward(before, JUL13, JUL06, counter())).toEqual(before);
        expect(carryForward(before, JUL13, JUL13, counter())).toEqual(before);
    });

    it('destination is not a Monday: unchanged', () => {
        const before: Weeks = [detailedWeek(JUL13)];
        expect(carryForward(before, JUL13, '2026-07-21', counter())).toEqual(before);
    });
});

describe('isValidWeeks', () => {
    it('an empty collection is valid', () => {
        expect(isValidWeeks([])).toBe(true);
    });

    it('sorted, distinct, non-empty, uniquely identified: valid', () => {
        expect(isValidWeeks([week(JUL06, 'a'), week(JUL13, 'b'), week(JUL20, 'c')])).toBe(true);
    });

    it('ended and active entries interleaved: still valid', () => {
        const weeks: Weeks = [
            week(JUL06, 'a'),
            week(JUL13, 'b', true),
            week(JUL20, 'c'),
            week(JUL27, 'd', true),
        ];
        expect(isValidWeeks(weeks)).toBe(true);
    });

    it('out of order: invalid', () => {
        expect(isValidWeeks([week(JUL13, 'b'), week(JUL06, 'a')])).toBe(false);
    });

    it('duplicate weekStart: invalid', () => {
        expect(isValidWeeks([week(JUL06, 'a'), week(JUL06, 'b')])).toBe(false);
    });

    it('an empty entry: invalid', () => {
        expect(isValidWeeks([emptyWeek(JUL06)])).toBe(false);
    });

    it('an entry that is not a valid plan: invalid', () => {
        // Tuesday, so isValidPlan rejects the entry on its weekStart.
        expect(isValidWeeks([week('2026-07-07', 'a')])).toBe(false);
    });

    it('an id repeated ACROSS two entries: invalid', () => {
        expect(isValidWeeks([week(JUL06, 'same'), week(JUL13, 'same')])).toBe(false);
    });

    it('an id repeated WITHIN one entry: invalid', () => {
        const clash: WeekPlan = {
            weekStart: JUL06,
            ended: false,
            projects: [project('p', [leafTask('x', false)]), project('p2', [leafTask('x', false)])],
        };
        expect(isValidWeeks([clash])).toBe(false);
    });
});
