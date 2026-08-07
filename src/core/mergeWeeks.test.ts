import { describe, it, expect } from 'vitest';
import { mergeWeeks } from './mergeWeeks';
import { isValidWeeks, moveWeek, weekAt } from './weeks';
import type { DateKey, Project, Subtask, Task, WeekPlan, Weeks } from './types';

const JUL06 = '2026-07-06';
const JUL13 = '2026-07-13';
const JUL20 = '2026-07-20';

// --- fixtures ---
// missedDays must fall strictly before assignedDay (isValidSubtask), so the
// default sits on wednesday to leave room for a miss on either side of it.
function subtask(id: string, overrides: Partial<Subtask> = {}): Subtask {
    return { id, isDone: false, assignedDay: 'wed', missedDays: [], weight: 1, ...overrides };
}

function task(id: string, subtasks: ReadonlyArray<Subtask>): Task {
    return subtasks.length === 0
        ? { id, name: id, isDone: false, subtasks: [] }
        : { id, name: id, subtasks };
}

function project(id: string, tasks: ReadonlyArray<Task>): Project {
    return { id, name: id, tasks };
}

function week(weekStart: DateKey, projects: ReadonlyArray<Project>, ended = false): WeekPlan {
    return { weekStart, ended, projects };
}

// Two projects so that deleting one still leaves a non-empty week; one task
// with subtasks and one leaf task, so both sides of the isDone rule are live.
const BASE: Weeks = [
    week(JUL13, [
        project('pA', [task('tA', [subtask('sA1'), subtask('sA2')])]),
        project('pB', [task('tB', [])]),
    ]),
];

// --- small readers, so assertions say what they mean ---
function projectIds(weeks: Weeks, weekStart: DateKey): ReadonlyArray<string> {
    return weekAt(weeks, weekStart).projects.map((p) => p.id);
}

function taskAt(weeks: Weeks, weekStart: DateKey, projectId: string, taskId: string) {
    return weekAt(weeks, weekStart)
        .projects.find((p) => p.id === projectId)
        ?.tasks.find((t) => t.id === taskId);
}

describe('mergeWeeks', () => {
    /*
     * Testing strategy
     *   partition on how a key stands across the three sides: only theirs
     *     changed | only ours changed | both changed the same way | both
     *     changed differently | added by one side | deleted by one side with
     *     the other untouched | deleted by one side with the other edited
     *   partition on the level the disagreement reaches: week | project |
     *     task | subtask (where the descent stops)
     *   partition on invariant pressure: a merge that flips a task between
     *     leaf and parent (isDone) | a subtask whose assignedDay and
     *     missedDays would contradict if merged field-wise | a week left with
     *     no projects | ordering of the result
     *   partition on the ended flag: each row of the boolean table, and an
     *     ended week gaining content from the other side
     */

    // ---- the keyed rules, exercised at week level where they are easiest to read

    it('only they changed it: takes theirs', () => {
        const theirs: Weeks = [week(JUL13, [project('pA', [task('tA', [subtask('sA1')])])])];
        expect(mergeWeeks(BASE, BASE, theirs)).toEqual(theirs);
    });

    it('only we changed it: takes ours', () => {
        const ours: Weeks = [week(JUL13, [project('pA', [task('tA', [subtask('sA1')])])])];
        expect(mergeWeeks(BASE, ours, BASE)).toEqual(ours);
    });

    it('both made the same change: keeps it once', () => {
        const same: Weeks = [week(JUL13, [project('pZ', [task('tZ', [])])])];
        expect(mergeWeeks(BASE, same, same)).toEqual(same);
    });

    it('an addition on one side only is kept, from either side', () => {
        const oursAdds: Weeks = [...BASE, week(JUL20, [project('pNew', [task('tNew', [])])])];
        const theirsAdds: Weeks = [week(JUL06, [project('pOld', [task('tOld', [])])]), ...BASE];

        expect(mergeWeeks(BASE, oursAdds, BASE).map((w) => w.weekStart)).toEqual([JUL13, JUL20]);
        expect(mergeWeeks(BASE, BASE, theirsAdds).map((w) => w.weekStart)).toEqual([JUL06, JUL13]);
    });

    it('additions from both sides both survive', () => {
        const ours: Weeks = [...BASE, week(JUL20, [project('pOurs', [task('tOurs', [])])])];
        const theirs: Weeks = [week(JUL06, [project('pTheirs', [task('tTheirs', [])])]), ...BASE];
        expect(mergeWeeks(BASE, ours, theirs).map((w) => w.weekStart)).toEqual([
            JUL06,
            JUL13,
            JUL20,
        ]);
    });

    it('deleted by us, untouched by them: stays deleted', () => {
        expect(mergeWeeks(BASE, [], BASE)).toEqual([]);
    });

    it('deleted by them, untouched by us: stays deleted', () => {
        expect(mergeWeeks(BASE, BASE, [])).toEqual([]);
    });

    it('deleted by us while they edited it: our delete wins', () => {
        const theirs: Weeks = [week(JUL13, [project('pA', [task('tA', [subtask('sA1')])])])];
        expect(mergeWeeks(BASE, [], theirs)).toEqual([]);
    });

    it('deleted by them while we edited it: our edit survives', () => {
        const ours: Weeks = [week(JUL13, [project('pA', [task('tA', [subtask('sA1')])])])];
        expect(mergeWeeks(BASE, ours, [])).toEqual(ours);
    });

    // ---- descent

    it('descends into a week both sides changed, keeping each side’s project edit', () => {
        const ours: Weeks = [
            week(JUL13, [
                { ...project('pA', [task('tA', [subtask('sA1'), subtask('sA2')])]), name: 'ours' },
                project('pB', [task('tB', [])]),
            ]),
        ];
        const theirs: Weeks = [
            week(JUL13, [
                project('pA', [task('tA', [subtask('sA1'), subtask('sA2')])]),
                { ...project('pB', [task('tB', [])]), name: 'theirs' },
            ]),
        ];
        const merged = mergeWeeks(BASE, ours, theirs);
        const names = weekAt(merged, JUL13).projects.map((p) => p.name);
        expect(names).toEqual(['ours', 'theirs']);
    });

    it('descends all the way to a task, keeping a rename from one side and a new subtask from the other', () => {
        const ours: Weeks = [
            week(JUL13, [
                project('pA', [
                    { ...task('tA', [subtask('sA1'), subtask('sA2')]), name: 'renamed' },
                ]),
                project('pB', [task('tB', [])]),
            ]),
        ];
        const theirs: Weeks = [
            week(JUL13, [
                project('pA', [task('tA', [subtask('sA1'), subtask('sA2'), subtask('sA3')])]),
                project('pB', [task('tB', [])]),
            ]),
        ];
        const merged = taskAt(mergeWeeks(BASE, ours, theirs), JUL13, 'pA', 'tA');
        expect(merged?.name).toBe('renamed');
        expect(merged?.subtasks.map((s) => s.id)).toEqual(['sA1', 'sA2', 'sA3']);
    });

    // ---- the descent stops at subtask

    it('a subtask both sides changed differently resolves to ours, whole', () => {
        const ourSubtask = subtask('sA1', { assignedDay: 'fri', weight: 3 });
        const theirSubtask = subtask('sA1', { assignedDay: 'tue', isDone: true });
        const ours: Weeks = [
            week(JUL13, [
                project('pA', [task('tA', [ourSubtask, subtask('sA2')])]),
                project('pB', [task('tB', [])]),
            ]),
        ];
        const theirs: Weeks = [
            week(JUL13, [
                project('pA', [task('tA', [theirSubtask, subtask('sA2')])]),
                project('pB', [task('tB', [])]),
            ]),
        ];
        const merged = taskAt(mergeWeeks(BASE, ours, theirs), JUL13, 'pA', 'tA');
        expect(merged?.subtasks[0]).toEqual(ourSubtask);
    });

    it('assignedDay and missedDays move together — a field-wise merge here would be invalid', () => {
        // Ours pulls the subtask back to tuesday; theirs pushes it to friday
        // and records misses on wed/thu. Taking ours' day with theirs' misses
        // would leave misses at or after the assigned day, which
        // isValidSubtask rejects.
        const ours: Weeks = [
            week(JUL13, [
                project('pA', [
                    task('tA', [subtask('sA1', { assignedDay: 'tue' }), subtask('sA2')]),
                ]),
                project('pB', [task('tB', [])]),
            ]),
        ];
        const theirs: Weeks = [
            week(JUL13, [
                project('pA', [
                    task('tA', [
                        subtask('sA1', { assignedDay: 'fri', missedDays: ['wed', 'thu'] }),
                        subtask('sA2'),
                    ]),
                ]),
                project('pB', [task('tB', [])]),
            ]),
        ];
        const merged = mergeWeeks(BASE, ours, theirs);
        const subtaskOut = taskAt(merged, JUL13, 'pA', 'tA')?.subtasks[0];
        expect(subtaskOut?.assignedDay).toBe('tue');
        expect(subtaskOut?.missedDays).toEqual([]);
        expect(isValidWeeks(merged)).toBe(true);
    });

    // ---- the leaf/isDone coupling

    it('a task that gains subtasks in the merge drops isDone', () => {
        const ours: Weeks = [
            week(JUL13, [
                project('pA', [task('tA', [subtask('sA1'), subtask('sA2')])]),
                project('pB', [task('tB', [subtask('sB1')])]), // tB stops being a leaf
            ]),
        ];
        const theirs: Weeks = [
            week(JUL13, [
                project('pA', [task('tA', [subtask('sA1'), subtask('sA2')])]),
                project('pB', [{ ...task('tB', []), name: 'renamed' }]),
            ]),
        ];
        const merged = mergeWeeks(BASE, ours, theirs);
        const tB = taskAt(merged, JUL13, 'pB', 'tB');
        expect(tB?.subtasks).toHaveLength(1);
        expect(tB?.isDone).toBeUndefined();
        expect(isValidWeeks(merged)).toBe(true);
    });

    it('a task that loses its last subtask in the merge gains isDone', () => {
        // Ours drops sA1, theirs drops sA2 — between them the task is emptied,
        // which no single side did.
        const ours: Weeks = [
            week(JUL13, [
                project('pA', [task('tA', [subtask('sA2')])]),
                project('pB', [task('tB', [])]),
            ]),
        ];
        const theirs: Weeks = [
            week(JUL13, [
                project('pA', [task('tA', [subtask('sA1')])]),
                project('pB', [task('tB', [])]),
            ]),
        ];
        const merged = mergeWeeks(BASE, ours, theirs);
        const tA = taskAt(merged, JUL13, 'pA', 'tA');
        expect(tA?.subtasks).toEqual([]);
        expect(typeof tA?.isDone).toBe('boolean');
        expect(isValidWeeks(merged)).toBe(true);
    });

    // ---- the ended flag

    it('ended follows the boolean table and never conflicts', () => {
        const open = BASE;
        const closed: Weeks = [{ ...weekAt(BASE, JUL13), ended: true }];

        // base open: either side ending it ends it
        expect(weekAt(mergeWeeks(open, open, closed), JUL13).ended).toBe(true);
        expect(weekAt(mergeWeeks(open, closed, open), JUL13).ended).toBe(true);
        expect(weekAt(mergeWeeks(open, closed, closed), JUL13).ended).toBe(true);
        // base ended: either side reopening it reopens it
        expect(weekAt(mergeWeeks(closed, closed, open), JUL13).ended).toBe(false);
        expect(weekAt(mergeWeeks(closed, open, closed), JUL13).ended).toBe(false);
        expect(weekAt(mergeWeeks(closed, open, open), JUL13).ended).toBe(false);
    });

    it('a week ended on one device still takes the work the other recorded before it knew', () => {
        // Device A added a project and never ended the week; device B ended it.
        const ours: Weeks = [
            week(JUL13, [
                project('pA', [task('tA', [subtask('sA1'), subtask('sA2')])]),
                project('pB', [task('tB', [])]),
                project('pLate', [task('tLate', [])]),
            ]),
        ];
        const theirs: Weeks = [{ ...weekAt(BASE, JUL13), ended: true }];

        const merged = mergeWeeks(BASE, ours, theirs);
        expect(weekAt(merged, JUL13).ended).toBe(true);
        expect(projectIds(merged, JUL13)).toEqual(['pA', 'pB', 'pLate']);
        expect(isValidWeeks(merged)).toBe(true);
    });

    // ---- collection-level invariants

    it('a week emptied by the merge is dropped, not kept empty', () => {
        // Each side deletes one of the two projects; together nothing is left.
        const ours: Weeks = [week(JUL13, [project('pB', [task('tB', [])])])];
        const theirs: Weeks = [week(JUL13, [project('pA', [task('tA', [subtask('sA1')])])])];
        const merged = mergeWeeks(BASE, ours, theirs);
        expect(merged).toEqual([]);
        expect(isValidWeeks(merged)).toBe(true);
    });

    it('the result is sorted by weekStart even though theirs is appended', () => {
        const ours: Weeks = [...BASE, week(JUL20, [project('pOurs', [task('tOurs', [])])])];
        const theirs: Weeks = [week(JUL06, [project('pTheirs', [task('tTheirs', [])])]), ...BASE];
        const merged = mergeWeeks(BASE, ours, theirs);
        expect(merged.map((w) => w.weekStart)).toEqual([JUL06, JUL13, JUL20]);
        expect(isValidWeeks(merged)).toBe(true);
    });

    it('keeps our order and appends nodes only they have', () => {
        const ours: Weeks = [
            week(JUL13, [
                project('pB', [task('tB', [])]), // reordered on this device
                project('pA', [task('tA', [subtask('sA1'), subtask('sA2')])]),
            ]),
        ];
        const theirs: Weeks = [
            week(JUL13, [
                project('pA', [task('tA', [subtask('sA1'), subtask('sA2')])]),
                project('pB', [task('tB', [])]),
                project('pTheirs', [task('tTheirs', [])]),
            ]),
        ];
        expect(projectIds(mergeWeeks(BASE, ours, theirs), JUL13)).toEqual(['pB', 'pA', 'pTheirs']);
    });

    // ---- algebraic properties

    it('merging against an unchanged side returns the other side', () => {
        const changed: Weeks = [week(JUL13, [project('pOnly', [task('tOnly', [])])])];
        expect(mergeWeeks(BASE, changed, BASE)).toEqual(changed);
        expect(mergeWeeks(BASE, BASE, changed)).toEqual(changed);
        expect(mergeWeeks(BASE, BASE, BASE)).toEqual(BASE);
    });

    // ---- documented limitations, pinned so a change to them is deliberate

    it('LIMITATION: a week moved here loses edits the other device made at its old start', () => {
        const ours = moveWeek(BASE, JUL13, JUL20);
        const theirs: Weeks = [
            week(JUL13, [
                project('pA', [task('tA', [subtask('sA1'), subtask('sA2')])]),
                project('pB', [task('tB', [])]),
                project('pTheirs', [task('tTheirs', [])]),
            ]),
        ];
        const merged = mergeWeeks(BASE, ours, theirs);

        expect(merged.map((w) => w.weekStart)).toEqual([JUL20]);
        expect(projectIds(merged, JUL20)).toEqual(['pA', 'pB']); // pTheirs is gone
        // The point of accepting the loss: ids stay unique, so the result is
        // still a legal collection rather than one holding pA twice.
        expect(isValidWeeks(merged)).toBe(true);
    });

    it('LIMITATION: a week moved on the OTHER device loses the move when we edited it', () => {
        // The mirror of the case above, and the one that can duplicate ids:
        // keeping our edit at JUL13 while their move arrives as JUL20 would
        // put pA and pB in two weeks at once.
        const ours: Weeks = [
            week(JUL13, [
                {
                    ...project('pA', [task('tA', [subtask('sA1'), subtask('sA2')])]),
                    name: 'edited',
                },
                project('pB', [task('tB', [])]),
            ]),
        ];
        const theirs = moveWeek(BASE, JUL13, JUL20);
        const merged = mergeWeeks(BASE, ours, theirs);

        expect(merged.map((w) => w.weekStart)).toEqual([JUL13]);
        expect(weekAt(merged, JUL13).projects[0]?.name).toBe('edited');
        expect(isValidWeeks(merged)).toBe(true);
    });

    it('LIMITATION: both devices carrying work forward duplicates it, with distinct ids', () => {
        const ours: Weeks = [
            ...BASE,
            week(JUL20, [project('pCarryOurs', [task('tCarryOurs', [])])]),
        ];
        const theirs: Weeks = [
            ...BASE,
            week(JUL20, [project('pCarryTheirs', [task('tCarryTheirs', [])])]),
        ];
        const merged = mergeWeeks(BASE, ours, theirs);

        expect(projectIds(merged, JUL20)).toEqual(['pCarryOurs', 'pCarryTheirs']);
        // No invariant catches this: fresh ids make the copies genuine additions.
        expect(isValidWeeks(merged)).toBe(true);
    });
});

describe('mergeWeeks maintains the rep invariant (oracle)', () => {
    /*
     * Testing strategy
     *   every pair of single-device edits drawn from the list below is merged
     *   against the shared base and checked with isValidWeeks. The edits are
     *   chosen to reach each invariant: emptying a task (leaf/isDone),
     *   emptying a week (no empty entries), adding a week out of order
     *   (sorted weekStarts), and moving a subtask's day (missed-before-assigned).
     */

    const edits: ReadonlyArray<{ name: string; apply: (weeks: Weeks) => Weeks }> = [
        { name: 'unchanged', apply: (w) => w },
        {
            name: 'rename a project',
            apply: () => [
                week(JUL13, [
                    {
                        ...project('pA', [task('tA', [subtask('sA1'), subtask('sA2')])]),
                        name: 'renamed',
                    },
                    project('pB', [task('tB', [])]),
                ]),
            ],
        },
        {
            name: 'delete a project',
            apply: () => [week(JUL13, [project('pB', [task('tB', [])])])],
        },
        {
            name: 'delete the other project',
            apply: () => [
                week(JUL13, [project('pA', [task('tA', [subtask('sA1'), subtask('sA2')])])]),
            ],
        },
        {
            name: 'add a project',
            apply: () => [
                week(JUL13, [
                    project('pA', [task('tA', [subtask('sA1'), subtask('sA2')])]),
                    project('pB', [task('tB', [])]),
                    project('pNew', [task('tNew', [])]),
                ]),
            ],
        },
        {
            name: 'give the leaf task a subtask',
            apply: () => [
                week(JUL13, [
                    project('pA', [task('tA', [subtask('sA1'), subtask('sA2')])]),
                    project('pB', [task('tB', [subtask('sB1')])]),
                ]),
            ],
        },
        {
            name: 'drop one subtask',
            apply: () => [
                week(JUL13, [
                    project('pA', [task('tA', [subtask('sA2')])]),
                    project('pB', [task('tB', [])]),
                ]),
            ],
        },
        {
            name: 'drop the other subtask',
            apply: () => [
                week(JUL13, [
                    project('pA', [task('tA', [subtask('sA1')])]),
                    project('pB', [task('tB', [])]),
                ]),
            ],
        },
        {
            name: 'move a subtask later and record a miss',
            apply: () => [
                week(JUL13, [
                    project('pA', [
                        task('tA', [
                            subtask('sA1', { assignedDay: 'fri', missedDays: ['wed'] }),
                            subtask('sA2'),
                        ]),
                    ]),
                    project('pB', [task('tB', [])]),
                ]),
            ],
        },
        {
            name: 'move a subtask earlier',
            apply: () => [
                week(JUL13, [
                    project('pA', [
                        task('tA', [subtask('sA1', { assignedDay: 'mon' }), subtask('sA2')]),
                    ]),
                    project('pB', [task('tB', [])]),
                ]),
            ],
        },
        { name: 'end the week', apply: (w) => [{ ...weekAt(w, JUL13), ended: true }] },
        { name: 'delete the week', apply: () => [] },
        {
            name: 'add an earlier week',
            apply: (w) => [week(JUL06, [project('pEarly', [task('tEarly', [])])]), ...w],
        },
        { name: 'move the week later', apply: (w) => moveWeek(w, JUL13, JUL20) },
    ];

    it('every input in the matrix is itself valid, so the merge is the only thing under test', () => {
        for (const edit of edits) {
            expect(isValidWeeks(edit.apply(BASE)), edit.name).toBe(true);
        }
    });

    it('every pair of edits merges to a valid Weeks', () => {
        for (const ours of edits) {
            for (const theirs of edits) {
                const merged = mergeWeeks(BASE, ours.apply(BASE), theirs.apply(BASE));
                expect(isValidWeeks(merged), `ours=${ours.name} theirs=${theirs.name}`).toBe(true);
            }
        }
    });

    it('a side that made no change never overrides the side that did', () => {
        for (const edit of edits) {
            const changed = edit.apply(BASE);
            expect(mergeWeeks(BASE, changed, BASE), edit.name).toEqual(changed);
            expect(mergeWeeks(BASE, BASE, changed), edit.name).toEqual(changed);
        }
    });
});
