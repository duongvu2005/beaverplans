import { describe, it, expect } from 'vitest';
import fixture from './importLegacy.fixture.json';
import {
    toSubtask,
    toTask,
    toProject,
    weekStartFromIso,
    activeToWeekPlan,
    archiveToWeekPlan,
    importLegacy,
    type LegacyRow,
} from './importLegacy';
import type { Task, Project, WeekPlan } from '../core/types';
import { overallProgress, progressByDay } from '../core/progress';
import { isValidWeeks } from '../core/weeks';

describe('toSubtask', () => {
    /*
     * Testing strategy
     *   partition on desc:   non-empty | empty '' | absent   (empty/absent -> omitted)
     *   partition on done:   true | false
     *   partition on missed: non-empty | empty
     *   day is varied across cases to catch a mis-mapping.
     *   weight is always 1 and id always comes from newId(): checked every case.
     */

    const newId = (): string => 'sub-id';

    it('covers non-empty desc, done, non-empty missed', () => {
        const slot = { day: 'tue', done: true, missed: ['wed'], desc: 'read ch. 3' };
        expect(toSubtask(slot, newId)).toEqual({
            id: 'sub-id',
            assignedDay: 'tue',
            isDone: true,
            weight: 1,
            missedDays: ['wed'],
            description: 'read ch. 3',
        });
    });

    it('covers empty desc -> omitted, not done, empty missed', () => {
        const slot = { day: 'fri', done: false, missed: [], desc: '' };
        expect(toSubtask(slot, newId)).toEqual({
            id: 'sub-id',
            assignedDay: 'fri',
            isDone: false,
            weight: 1,
            missedDays: [],
        });
    });

    it('covers absent desc -> omitted, done, multiple missed', () => {
        const slot = { day: 'sun', done: true, missed: ['mon', 'thu'] };
        expect(toSubtask(slot, newId)).toEqual({
            id: 'sub-id',
            assignedDay: 'sun',
            isDone: true,
            weight: 1,
            missedDays: ['mon', 'thu'],
        });
    });
});

describe('toTask', () => {
    /*
     * Testing strategy
     *   partition on sub.slots length: 0 (leaf) | >=1 (parent)
     *   partition on sub.done: true | false      (only meaningful for a leaf)
     *   partition on sub.desc: non-empty | empty/absent
     *   partition on sub.deadline: non-null | null
     *   ids: task id + one per subtask, all distinct
     * Structure is asserted with ids stripped (exact ids depend on newId call
     * order); id uniqueness is asserted separately.
     */

    const counter = () => {
        let n = 0;
        return () => `id-${n++}`;
    };
    const stripIds = (t: Task) => ({
        ...t,
        id: undefined,
        subtasks: t.subtasks.map((s) => ({ ...s, id: undefined })),
    });

    it('covers parent (>=1 slots): isDone omitted, deadline + description kept, ids unique', () => {
        const sub = {
            id: 'old',
            title: 'Essays',
            desc: 'the writing project',
            done: false,
            deadline: '2026-07-20',
            slots: [
                { day: 'mon', done: true, missed: [] },
                { day: 'wed', done: false, missed: ['tue'] },
            ],
        };
        const task = toTask(sub, counter());

        expect(stripIds(task)).toEqual({
            id: undefined,
            name: 'Essays',
            deadline: '2026-07-20',
            description: 'the writing project',
            subtasks: [
                { id: undefined, assignedDay: 'mon', isDone: true, weight: 1, missedDays: [] },
                {
                    id: undefined,
                    assignedDay: 'wed',
                    isDone: false,
                    weight: 1,
                    missedDays: ['tue'],
                },
            ],
        });

        const ids = [task.id, ...task.subtasks.map((s) => s.id)];
        expect(new Set(ids).size).toBe(ids.length); // no reused ids
    });

    it('covers parent, null deadline + empty desc: both omitted', () => {
        const sub = {
            id: 'old',
            title: 'Reading',
            desc: '',
            done: true,
            deadline: null,
            slots: [{ day: 'fri', done: false, missed: [] }],
        };
        expect(stripIds(toTask(sub, counter()))).toEqual({
            id: undefined,
            name: 'Reading',
            subtasks: [
                { id: undefined, assignedDay: 'fri', isDone: false, weight: 1, missedDays: [] },
            ],
        });
    });

    it('covers leaf (no slots), done true: isDone set, empty subtasks', () => {
        const sub = { id: 'old', title: 'Errand', desc: '', done: true, deadline: null, slots: [] };
        expect(stripIds(toTask(sub, counter()))).toEqual({
            id: undefined,
            name: 'Errand',
            isDone: true,
            subtasks: [],
        });
    });

    it('covers leaf (no slots), done false: isDone false', () => {
        const sub = {
            id: 'old',
            title: 'Errand',
            desc: '',
            done: false,
            deadline: null,
            slots: [],
        };
        expect(stripIds(toTask(sub, counter()))).toEqual({
            id: undefined,
            name: 'Errand',
            isDone: false,
            subtasks: [],
        });
    });
});

describe('toProject', () => {
    /*
     * Testing strategy
     *   partition on task.deadline: non-null | null
     *   partition on task.subs length: 0 (no tasks) | >=1
     *   ids: project + every task + every subtask, all distinct
     * subs/slots conversion is covered by toTask/toSubtask; here we check the
     * project fields, delegation to toTask, and tree-wide id uniqueness.
     * Structure asserted with ids stripped (exact ids depend on newId order).
     */

    const counter = () => {
        let n = 0;
        return () => `id-${n++}`;
    };
    const stripIds = (p: Project) => ({
        ...p,
        id: undefined,
        tasks: p.tasks.map((t) => ({
            ...t,
            id: undefined,
            subtasks: t.subtasks.map((s) => ({ ...s, id: undefined })),
        })),
    });

    it('covers non-null deadline, >=1 subs: deadline kept, subs delegated, ids unique', () => {
        const task = {
            id: 'old',
            title: 'Coursework',
            deadline: '2026-07-20',
            subs: [
                {
                    id: 'old-a',
                    title: 'Essay',
                    desc: '',
                    done: false,
                    deadline: null,
                    slots: [{ day: 'mon', done: true, missed: [] }],
                },
                { id: 'old-b', title: 'Errand', desc: '', done: true, deadline: null, slots: [] },
            ],
        };
        const project = toProject(task, counter());

        expect(stripIds(project)).toEqual({
            id: undefined,
            name: 'Coursework',
            deadline: '2026-07-20',
            tasks: [
                {
                    id: undefined,
                    name: 'Essay',
                    subtasks: [
                        {
                            id: undefined,
                            assignedDay: 'mon',
                            isDone: true,
                            weight: 1,
                            missedDays: [],
                        },
                    ],
                },
                { id: undefined, name: 'Errand', isDone: true, subtasks: [] },
            ],
        });

        const ids = [
            project.id,
            ...project.tasks.map((t) => t.id),
            ...project.tasks.flatMap((t) => t.subtasks.map((s) => s.id)),
        ];
        expect(new Set(ids).size).toBe(ids.length); // no reused ids anywhere in the tree
    });

    it('covers null deadline: omitted', () => {
        const task = {
            id: 'old',
            title: 'Misc',
            deadline: null,
            subs: [
                { id: 'old-a', title: 'Errand', desc: '', done: false, deadline: null, slots: [] },
            ],
        };
        expect(stripIds(toProject(task, counter()))).toEqual({
            id: undefined,
            name: 'Misc',
            tasks: [{ id: undefined, name: 'Errand', isDone: false, subtasks: [] }],
        });
    });

    it('covers empty subs: no tasks', () => {
        const task = { id: 'old', title: 'Empty', deadline: null, subs: [] };
        expect(stripIds(toProject(task, counter()))).toEqual({
            id: undefined,
            name: 'Empty',
            tasks: [],
        });
    });
});

describe('weekStartFromIso', () => {
    /*
     * Testing strategy
     *   partition on the weekday the instant falls on in local time:
     *     Monday -> that Monday's date
     *     Sunday -> the next day's (Monday's) date
     * Runner TZ is pinned to America/New_York, so these instants read
     * deterministically — a real archive.start (serialized from UTC+7) reads
     * as Sunday here, which is exactly the drift being corrected.
     */

    it('covers instant that is Monday locally -> that Monday', () => {
        // 2026-07-06T13:00Z = Mon Jul 6, 09:00 in New_York
        expect(weekStartFromIso('2026-07-06T13:00:00.000Z')).toBe('2026-07-06');
    });

    it('covers instant that is Sunday locally -> next Monday (real archive.start)', () => {
        // 2026-07-05T17:00Z = Sun Jul 5, 13:00 in New_York
        expect(weekStartFromIso('2026-07-05T17:00:00.000Z')).toBe('2026-07-06');
    });

    it('covers a second week, Sunday locally -> next Monday', () => {
        // 2025-09-07T17:00Z = Sun Sep 7, 13:00 in New_York (week Sep 8–14)
        expect(weekStartFromIso('2025-09-07T17:00:00.000Z')).toBe('2025-09-08');
    });

    it('covers a second week, Monday locally -> that Monday', () => {
        // 2025-09-08T12:00Z = Mon Sep 8, 08:00 in New_York
        expect(weekStartFromIso('2025-09-08T12:00:00.000Z')).toBe('2025-09-08');
    });
});

describe('activeToWeekPlan', () => {
    /*
     * Testing strategy
     *   partition on tasks length: 0 (no projects) | >=1 (mapped via toProject)
     *   weekStart: passed through unchanged
     *   ids: unique across the whole plan
     * Deep project/task/subtask conversion is covered by toProject/toTask/toSubtask.
     */

    const counter = () => {
        let n = 0;
        return () => `id-${n++}`;
    };
    const stripIds = (plan: WeekPlan) => ({
        ...plan,
        projects: plan.projects.map((p) => ({
            ...p,
            id: undefined,
            tasks: p.tasks.map((t) => ({
                ...t,
                id: undefined,
                subtasks: t.subtasks.map((s) => ({ ...s, id: undefined })),
            })),
        })),
    });

    it('covers weekStart passthrough + projects mapped, ids unique', () => {
        const tasks = [
            {
                id: 'old',
                title: 'Coursework',
                deadline: null,
                subs: [
                    {
                        id: 'old-a',
                        title: 'Errand',
                        desc: '',
                        done: true,
                        deadline: null,
                        slots: [],
                    },
                ],
            },
        ];
        const plan = activeToWeekPlan(tasks, '2026-07-13', counter());

        expect(stripIds(plan)).toEqual({
            weekStart: '2026-07-13',
            ended: false,
            projects: [
                {
                    id: undefined,
                    name: 'Coursework',
                    tasks: [{ id: undefined, name: 'Errand', isDone: true, subtasks: [] }],
                },
            ],
        });

        const ids = [
            ...plan.projects.map((p) => p.id),
            ...plan.projects.flatMap((p) => p.tasks.map((t) => t.id)),
            ...plan.projects.flatMap((p) => p.tasks.flatMap((t) => t.subtasks.map((s) => s.id))),
        ];
        expect(new Set(ids).size).toBe(ids.length);
    });

    it('covers empty tasks: no projects', () => {
        expect(activeToWeekPlan([], '2026-07-13', counter())).toEqual({
            weekStart: '2026-07-13',
            ended: false,
            projects: [],
        });
    });
});

describe('archiveToWeekPlan', () => {
    /*
     * Testing strategy
     *   partition on archive.start's local weekday: Monday | Sunday
     *     (both must yield the correct Monday DateKey via weekStartFromIso)
     *   projects: snapshot mapped via toProject
     *   ended: true is always set (every archive entry is a past, ended week)
     * Deep conversion + the full weekday range are covered by
     * toProject/toSubtask/weekStartFromIso; here we check start -> weekStart and delegation.
     */

    const counter = () => {
        let n = 0;
        return () => `id-${n++}`;
    };
    const stripIds = (plan: WeekPlan) => ({
        ...plan,
        projects: plan.projects.map((p) => ({
            ...p,
            id: undefined,
            tasks: p.tasks.map((t) => ({
                ...t,
                id: undefined,
                subtasks: t.subtasks.map((s) => ({ ...s, id: undefined })),
            })),
        })),
    });

    const snapshot = [
        {
            id: 'old',
            title: 'Real Analysis',
            deadline: null,
            subs: [{ id: 'old-a', title: 'ch 0', desc: '', done: true, deadline: null, slots: [] }],
        },
    ];
    const expected = {
        weekStart: '2026-07-06',
        ended: true,
        projects: [
            {
                id: undefined,
                name: 'Real Analysis',
                tasks: [{ id: undefined, name: 'ch 0', isDone: true, subtasks: [] }],
            },
        ],
    };

    it('covers Sunday-reading start (real archive) -> correct Monday', () => {
        expect(
            stripIds(archiveToWeekPlan({ start: '2026-07-05T17:00:00.000Z', snapshot }, counter())),
        ).toEqual(expected);
    });

    it('covers Monday-reading start -> that Monday', () => {
        expect(
            stripIds(archiveToWeekPlan({ start: '2026-07-06T13:00:00.000Z', snapshot }, counter())),
        ).toEqual(expected);
    });
});

describe('importLegacy', () => {
    /*
     * Testing strategy
     *   wiring: active week <- tasks + week_start (no ended flag); archived
     *     weeks <- archives, each already tagged ended: true by archiveToWeekPlan
     *   result is folded through putWeek, so it comes back SORTED ascending by
     *     weekStart, not in input order — and an archive with no projects is
     *     silently dropped (see caveat above)
     *   newId: injected (deterministic wiring check) | default (produces a
     *     valid Weeks collection)
     * Node conversion + weekStart recovery are covered by the converter tests;
     * here we check composition and that the whole result is valid.
     */

    const counter = () => {
        let n = 0;
        return () => `id-${n++}`;
    };
    const stripIds = (plan: WeekPlan) => ({
        ...plan,
        projects: plan.projects.map((p) => ({
            ...p,
            id: undefined,
            tasks: p.tasks.map((t) => ({
                ...t,
                id: undefined,
                subtasks: t.subtasks.map((s) => ({ ...s, id: undefined })),
            })),
        })),
    });

    const row: LegacyRow = {
        week_start: '2026-07-13',
        tasks: [
            {
                id: 'p1',
                title: 'Coursework',
                deadline: null,
                subs: [
                    {
                        id: 's1',
                        title: 'Errand',
                        desc: '',
                        done: false,
                        deadline: null,
                        slots: [{ day: 'mon', done: true, missed: [] }],
                    },
                ],
            },
        ],
        archives: [
            {
                start: '2026-07-05T17:00:00.000Z', // -> weekStart '2026-07-06'
                snapshot: [
                    {
                        id: 'ap1',
                        title: 'Past',
                        deadline: null,
                        subs: [
                            {
                                id: 'as1',
                                title: 'done thing',
                                desc: '',
                                done: true,
                                deadline: null,
                                slots: [],
                            },
                        ],
                    },
                ],
            },
            { start: '2025-09-07T17:00:00.000Z', snapshot: [] }, // -> '2025-09-08', empty: dropped
        ],
    };

    it('covers wiring: active week unflagged, archive tagged ended, result sorted, empty archive dropped', () => {
        const result = importLegacy(row, counter());

        expect(result.map(stripIds)).toEqual([
            {
                weekStart: '2026-07-06',
                ended: true,
                projects: [
                    {
                        id: undefined,
                        name: 'Past',
                        tasks: [{ id: undefined, name: 'done thing', isDone: true, subtasks: [] }],
                    },
                ],
            },
            {
                weekStart: '2026-07-13',
                ended: false,
                projects: [
                    {
                        id: undefined,
                        name: 'Coursework',
                        tasks: [
                            {
                                id: undefined,
                                name: 'Errand',
                                subtasks: [
                                    {
                                        id: undefined,
                                        assignedDay: 'mon',
                                        isDone: true,
                                        weight: 1,
                                        missedDays: [],
                                    },
                                ],
                            },
                        ],
                    },
                ],
            },
        ]);
    });

    it('covers default newId: the whole result is a valid Weeks collection', () => {
        const weeks = importLegacy(row); // real crypto.randomUUID
        expect(isValidWeeks(weeks)).toBe(true);
    });
});

describe('importLegacy — real export from a fake account', () => {
    // `fixture` keeps the full JSON shape (incl. the old stored stats used as an oracle);
    // importLegacy only reads the LegacyRow subset.
    const weeks = importLegacy(fixture as LegacyRow);
    const activeWeek = weeks.find((w) => w.weekStart === fixture.week_start);
    const archivedWeeks = weeks.filter((w) => w.ended);

    it('the whole result is a valid Weeks collection', () => {
        expect(isValidWeeks(weeks)).toBe(true);
    });

    it('conserves counts: projects / tasks / subtasks for the active week', () => {
        expect(activeWeek).toBeDefined();
        if (!activeWeek) return; // guard for noUncheckedIndexedAccess

        const subs = fixture.tasks.reduce((n, t) => n + t.subs.length, 0);
        const slots = fixture.tasks.reduce(
            (n, t) => n + t.subs.reduce((m, s) => m + s.slots.length, 0),
            0,
        );
        const outTasks = activeWeek.projects.reduce((n, p) => n + p.tasks.length, 0);
        const outSubtasks = activeWeek.projects.reduce(
            (n, p) => n + p.tasks.reduce((m, t) => m + t.subtasks.length, 0),
            0,
        );

        expect(activeWeek.projects.length).toBe(fixture.tasks.length);
        expect(outTasks).toBe(subs);
        expect(outSubtasks).toBe(slots);
    });

    it('archive count: every non-empty old archive survives, empties are dropped', () => {
        const nonEmptyCount = fixture.archives.filter((a) => a.snapshot.length > 0).length;
        expect(archivedWeeks.length).toBe(nonEmptyCount);
    });

    it("reproduces each non-empty archive's old stored stats (oracle), matched by weekStart", () => {
        for (const old of fixture.archives) {
            if (old.snapshot.length === 0) continue; // dropped: Weeks forbids empty entries
            const weekStart = weekStartFromIso(old.start);
            const wp = archivedWeeks.find((w) => w.weekStart === weekStart);
            expect(wp, `no entry for ${weekStart}`).toBeDefined();
            if (!wp) continue; // guard for noUncheckedIndexedAccess

            const { done, total } = overallProgress(wp.projects);
            expect(done).toBe(old.doneCount);
            expect(total).toBe(old.totalCount);

            const byDay = progressByDay(wp.projects);
            for (const oldDay of old.perDay) {
                const newDay = byDay.find((d) => d.day === oldDay.dk);
                expect(newDay?.done).toBe(oldDay.done);
                expect(newDay?.assigned).toBe(oldDay.assigned);
            }
        }
    });
});

describe('importLegacy — malformed legacy shapes', () => {
    /*
     * Testing strategy
     *   partition on which collection is missing: subs | slots | snapshot |
     *     missed
     *   partition on the consequence if it were trusted: the node's own
     *     conversion throws | the whole import aborts
     *
     * These are not hypothetical: the old app writes `archive.snapshot || []`
     * in four places, so it defends against exactly these rows. Being strict
     * costs a user their entire history, because one throw aborts the import
     * and the caller reports failure silently.
     */

    const ids = () => {
        let n = 0;
        return () => `id${++n}`;
    };

    it('covers a project with no subs: becomes a project with no tasks', () => {
        const weeks = importLegacy(
            {
                tasks: [{ id: 'a', title: 'Thesis', deadline: null } as unknown as LegacyTask],
                archives: [],
                week_start: '2026-08-03',
            },
            ids(),
        );
        expect(weeks[0]?.projects).toEqual([
            expect.objectContaining({ name: 'Thesis', tasks: [] }),
        ]);
    });

    it('covers a sub with no slots: becomes a leaf task, isDone defaulting to false', () => {
        const weeks = importLegacy(
            {
                tasks: [
                    {
                        id: 'a',
                        title: 'Thesis',
                        deadline: null,
                        subs: [{ id: 'b', title: 'Read', desc: '' } as unknown as LegacySub],
                    },
                ],
                archives: [],
                week_start: '2026-08-03',
            },
            ids(),
        );
        expect(weeks[0]?.projects[0]?.tasks[0]).toEqual(
            expect.objectContaining({ name: 'Read', isDone: false, subtasks: [] }),
        );
    });

    it('covers a slot with no missed: becomes a subtask with no missed days', () => {
        const weeks = importLegacy(
            {
                tasks: [
                    {
                        id: 'a',
                        title: 'Thesis',
                        deadline: null,
                        subs: [
                            {
                                id: 'b',
                                title: 'Read',
                                desc: '',
                                done: false,
                                deadline: null,
                                slots: [{ day: 'mon', done: true } as unknown as LegacySlot],
                            },
                        ],
                    },
                ],
                archives: [],
                week_start: '2026-08-03',
            },
            ids(),
        );
        expect(weeks[0]?.projects[0]?.tasks[0]?.subtasks[0]).toEqual(
            expect.objectContaining({ assignedDay: 'mon', isDone: true, missedDays: [] }),
        );
    });

    it('covers an archive with no snapshot: dropped as an empty week, rest still imported', () => {
        const weeks = importLegacy(
            {
                tasks: [{ id: 'a', title: 'Live', deadline: null, subs: [] }],
                archives: [
                    { start: new Date(2026, 6, 27).toISOString() } as unknown as LegacyArchive,
                ],
                week_start: '2026-08-03',
            },
            ids(),
        );
        // The malformed archive converts to an empty week, which Weeks forbids,
        // so putWeek drops it -- but the live week survives, which is the point.
        expect(weeks.map((w) => w.weekStart)).toEqual(['2026-08-03']);
    });

    it('covers one malformed entry among good ones: does not abort the import', () => {
        const weeks = importLegacy(
            {
                tasks: [
                    { id: 'a', title: 'Good', deadline: null, subs: [] },
                    { id: 'b', title: 'Bad', deadline: null } as unknown as LegacyTask,
                ],
                archives: [],
                week_start: '2026-08-03',
            },
            ids(),
        );
        expect(weeks[0]?.projects.map((p) => p.name)).toEqual(['Good', 'Bad']);
    });
});
