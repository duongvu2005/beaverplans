import { describe, it, expect } from 'vitest';
import { 
    toSubtask,
    toTask,
    toProject,
    weekStartFromIso,
    activeToWeekPlan,
    archiveToWeekPlan,
    importLegacy,
    type LegacyRow
} from './importLegacy';
import type { Task, Project, WeekPlan } from '../core/types';
import { isValidPlan } from '../core/projects';

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
            id: 'old', title: 'Essays', desc: 'the writing project', done: false,
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
                { id: undefined, assignedDay: 'wed', isDone: false, weight: 1, missedDays: ['tue'] },
            ],
        });

        const ids = [task.id, ...task.subtasks.map((s) => s.id)];
        expect(new Set(ids).size).toBe(ids.length); // no reused ids
    });

    it('covers parent, null deadline + empty desc: both omitted', () => {
        const sub = {
            id: 'old', title: 'Reading', desc: '', done: true, deadline: null,
            slots: [{ day: 'fri', done: false, missed: [] }],
        };
        expect(stripIds(toTask(sub, counter()))).toEqual({
            id: undefined,
            name: 'Reading',
            subtasks: [{ id: undefined, assignedDay: 'fri', isDone: false, weight: 1, missedDays: [] }],
        });
    });

    it('covers leaf (no slots), done true: isDone set, empty subtasks', () => {
        const sub = { id: 'old', title: 'Errand', desc: '', done: true, deadline: null, slots: [] };
        expect(stripIds(toTask(sub, counter()))).toEqual({
            id: undefined, name: 'Errand', isDone: true, subtasks: [],
        });
    });

    it('covers leaf (no slots), done false: isDone false', () => {
        const sub = { id: 'old', title: 'Errand', desc: '', done: false, deadline: null, slots: [] };
        expect(stripIds(toTask(sub, counter()))).toEqual({
            id: undefined, name: 'Errand', isDone: false, subtasks: [],
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
            id: 'old', title: 'Coursework', deadline: '2026-07-20',
            subs: [
                {
                    id: 'old-a', title: 'Essay', desc: '', done: false, deadline: null,
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
                        { id: undefined, assignedDay: 'mon', isDone: true, weight: 1, missedDays: [] },
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
            id: 'old', title: 'Misc', deadline: null,
            subs: [{ id: 'old-a', title: 'Errand', desc: '', done: false, deadline: null, slots: [] }],
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
                id: 'old', title: 'Coursework', deadline: null,
                subs: [{ id: 'old-a', title: 'Errand', desc: '', done: true, deadline: null, slots: [] }],
            },
        ];
        const plan = activeToWeekPlan(tasks, '2026-07-13', counter());

        expect(stripIds(plan)).toEqual({
            weekStart: '2026-07-13',
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
            ...p, id: undefined,
            tasks: p.tasks.map((t) => ({
                ...t, id: undefined,
                subtasks: t.subtasks.map((s) => ({ ...s, id: undefined })),
            })),
        })),
    });

    const snapshot = [
        { id: 'old', title: 'Real Analysis', deadline: null,
          subs: [{ id: 'old-a', title: 'ch 0', desc: '', done: true, deadline: null, slots: [] }] },
    ];
    const expected = {
        weekStart: '2026-07-06',
        projects: [
            { id: undefined, name: 'Real Analysis',
              tasks: [{ id: undefined, name: 'ch 0', isDone: true, subtasks: [] }] },
        ],
    };

    it('covers Sunday-reading start (real archive) -> correct Monday', () => {
        // 2026-07-05T17:00Z reads as Sunday in the NY-pinned runner
        expect(stripIds(archiveToWeekPlan({ start: '2026-07-05T17:00:00.000Z', snapshot }, counter()))).toEqual(expected);
    });

    it('covers Monday-reading start -> that Monday', () => {
        // 2026-07-06T13:00Z reads as Monday in the NY-pinned runner
        expect(stripIds(archiveToWeekPlan({ start: '2026-07-06T13:00:00.000Z', snapshot }, counter()))).toEqual(expected);
    });
});

describe('importLegacy', () => {
    /*
     * Testing strategy
     *   wiring: plan <- tasks + week_start; archive <- archives (in order)
     *   newId: injected (deterministic wiring check) | default (produces valid plans)
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
            ...p, id: undefined,
            tasks: p.tasks.map((t) => ({
                ...t, id: undefined,
                subtasks: t.subtasks.map((s) => ({ ...s, id: undefined })),
            })),
        })),
    });

    const row: LegacyRow = {
        week_start: '2026-07-13',
        tasks: [
            { id: 'p1', title: 'Coursework', deadline: null,
              subs: [{ id: 's1', title: 'Errand', desc: '', done: false, deadline: null,
                       slots: [{ day: 'mon', done: true, missed: [] }] }] },
        ],
        archives: [
            { start: '2026-07-05T17:00:00.000Z', snapshot: [
                { id: 'ap1', title: 'Past', deadline: null,
                  subs: [{ id: 'as1', title: 'done thing', desc: '', done: true, deadline: null, slots: [] }] },
            ] },
            { start: '2025-09-07T17:00:00.000Z', snapshot: [] },
        ],
    };

    it('covers wiring: plan from tasks/week_start, archive from archives in order', () => {
        const result = importLegacy(row, counter());

        expect(stripIds(result.plan)).toEqual({
            weekStart: '2026-07-13',
            projects: [
                { id: undefined, name: 'Coursework', tasks: [
                    { id: undefined, name: 'Errand', subtasks: [
                        { id: undefined, assignedDay: 'mon', isDone: true, weight: 1, missedDays: [] },
                    ] },
                ] },
            ],
        });

        expect(result.archive.map(stripIds)).toEqual([
            { weekStart: '2026-07-06', projects: [
                { id: undefined, name: 'Past', tasks: [
                    { id: undefined, name: 'done thing', isDone: true, subtasks: [] },
                ] },
            ] },
            { weekStart: '2025-09-08', projects: [] },
        ]);
    });

    it('covers default newId: every produced WeekPlan is valid (imports clean)', () => {
        const { plan, archive } = importLegacy(row); // real crypto.randomUUID
        expect(isValidPlan(plan)).toBe(true);
        for (const weekPlan of archive) {
            expect(isValidPlan(weekPlan)).toBe(true);
        }
    });
});
