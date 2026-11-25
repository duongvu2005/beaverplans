import { describe, it, expect } from 'vitest';
import {
    CLIPBOARD_FORMAT,
    parseProjects,
    printProjects,
    withFreshIds,
    withoutProgress,
} from './weekClipboard';
import { isValidProject } from '@/core/projects';
import { LIMITS } from '@/core/limits';
import type { Project, Subtask, Task } from '@/core/types';

function sub(id: string, extra: Partial<Subtask> = {}): Subtask {
    return { id, isDone: false, assignedDay: 'wed', missedDays: [], weight: 1, ...extra };
}

function leaf(id: string, name: string, isDone: boolean): Task {
    return { id, name, isDone, subtasks: [] };
}

function task(id: string, name: string, subtasks: Subtask[]): Task {
    return { id, name, subtasks };
}

const SAMPLE: ReadonlyArray<Project> = [
    {
        id: 'p1',
        name: 'Thesis',
        deadline: '2026-08-21',
        tasks: [
            task('t1', 'Read Chapter 4', [
                sub('s1', { isDone: true, assignedDay: 'wed', missedDays: ['mon', 'tue'] }),
                sub('s2', { weight: 3, description: 'the long half' }),
            ]),
            leaf('t2', 'Email supervisor', true),
        ],
    },
    { id: 'p2', name: 'Gym', tasks: [] },
];

describe('printProjects / parseProjects', () => {
    /*
     * Testing strategy
     *     partition on projects: empty | one | several
     *     partition on the tree: leaf task (carries isDone) | task with subtasks
     *         (carries none) | subtask with missedDays | with a description |
     *         project with a deadline
     *     partition on parse input: printed output (the round trip) | not JSON |
     *         JSON that is not an envelope | right format tag but bad projects
     *
     * The round trip is the property that matters: parse(print(p)) equals p,
     * including for the adversarial names below.
     */
    it('covers the round trip on a full tree', () => {
        const parsed = parseProjects(printProjects('2026-08-03', SAMPLE));
        expect(parsed.ok).toBe(true);
        if (!parsed.ok) return;
        expect(parsed.projects).toEqual(SAMPLE);
        expect(parsed.weekStart).toBe('2026-08-03');
    });

    it('covers empty projects', () => {
        const parsed = parseProjects(printProjects('2026-08-03', []));
        expect(parsed.ok).toBe(true);
        if (!parsed.ok) return;
        expect(parsed.projects).toEqual([]);
    });

    it('covers names that would be syntax in a text format', () => {
        const awkward: ReadonlyArray<Project> = [
            {
                id: 'p1',
                name: '# 2026 goals\n  - nested?',
                tasks: [leaf('t1', '[x] already done', false)],
            },
        ];
        const parsed = parseProjects(printProjects('2026-08-03', awkward));
        expect(parsed.ok).toBe(true);
        if (!parsed.ok) return;
        expect(parsed.projects).toEqual(awkward);
    });

    it('tags what it writes, so a later version can refuse it', () => {
        expect(JSON.parse(printProjects('2026-08-03', SAMPLE)).format).toBe(CLIPBOARD_FORMAT);
    });

    it('covers input that is not JSON', () => {
        expect(parseProjects('just some words')).toEqual({ ok: false, reason: 'not-json' });
    });

    it('covers JSON that is not one of ours', () => {
        expect(parseProjects('{"hello":"world"}')).toEqual({
            ok: false,
            reason: 'not-beaverplans',
        });
    });

    it('covers our own export envelope, which is a different shape', () => {
        expect(parseProjects('{"format":"beaverplans.export.v1","weeks":[]}')).toEqual({
            ok: false,
            reason: 'not-beaverplans',
        });
    });

    it('covers the right tag with projects that do not validate', () => {
        const text = JSON.stringify({
            format: CLIPBOARD_FORMAT,
            weekStart: '2026-08-03',
            projects: [{ id: 'p1', name: 'Thesis', tasks: [{ id: 't1' }] }],
        });
        expect(parseProjects(text)).toEqual({ ok: false, reason: 'malformed' });
    });

    it('covers the right tag with a weekStart that is not a Monday', () => {
        const text = JSON.stringify({
            format: CLIPBOARD_FORMAT,
            weekStart: '2026-08-04',
            projects: [],
        });
        expect(parseProjects(text)).toEqual({ ok: false, reason: 'malformed' });
    });

    /*
     * Testing strategy, the size caps
     *     partition on which cap: projectsPerWeek | tasksPerProject |
     *         subtasksPerTask | nameLength (project and task alike) |
     *         descriptionLength
     *     partition on the count: at the cap (fine) | one over
     *     partition on the reason: 'too-big' (a count, and it carries the shape)
     *         | 'too-long' (a name or a note)
     *
     * projectsPerWeek is checked here as an ABSOLUTE cap — a plan holding more
     * than one week can ever take. PastePlanDialog separately refuses a plan
     * that fits the cap but not the room left on the week being pasted onto.
     */
    function envelope(projects: unknown): string {
        return JSON.stringify({ format: CLIPBOARD_FORMAT, weekStart: '2026-08-03', projects });
    }

    function tasks(n: number): Task[] {
        return Array.from({ length: n }, (_, i) => leaf(`t${i}`, `Task ${i}`, false));
    }

    function subs(n: number): Subtask[] {
        return Array.from({ length: n }, (_, i) => sub(`s${i}`));
    }

    it('covers a project at the task cap: fine', () => {
        const at = [{ id: 'p1', name: 'Thesis', tasks: tasks(LIMITS.tasksPerProject) }];
        expect(parseProjects(envelope(at)).ok).toBe(true);
    });

    it('covers one project over the absolute project cap', () => {
        const over = Array.from({ length: LIMITS.projectsPerWeek + 1 }, (_, i) => ({
            id: `p${i}`,
            name: `Project ${i}`,
            tasks: [],
        }));
        expect(parseProjects(envelope(over))).toEqual({
            ok: false,
            reason: 'too-big',
            shape: { projects: LIMITS.projectsPerWeek + 1, maxTasks: 0, maxSubtasks: 0 },
        });
    });

    it('covers a project one task over the cap, reporting the shape it found', () => {
        const over = [{ id: 'p1', name: 'Thesis', tasks: tasks(LIMITS.tasksPerProject + 1) }];
        expect(parseProjects(envelope(over))).toEqual({
            ok: false,
            reason: 'too-big',
            shape: { projects: 1, maxTasks: LIMITS.tasksPerProject + 1, maxSubtasks: 0 },
        });
    });

    it('covers a task one subtask over the cap', () => {
        const over = [
            {
                id: 'p1',
                name: 'Thesis',
                tasks: [task('t1', 'Read', subs(LIMITS.subtasksPerTask + 1))],
            },
        ];
        expect(parseProjects(envelope(over))).toEqual({
            ok: false,
            reason: 'too-big',
            shape: { projects: 1, maxTasks: 1, maxSubtasks: LIMITS.subtasksPerTask + 1 },
        });
    });

    // The maximum, not the total: two projects of 3 tasks report 3, not 6.
    it('covers the shape reporting the largest container rather than a sum', () => {
        const over = [
            { id: 'p1', name: 'A', tasks: tasks(3) },
            { id: 'p2', name: 'B', tasks: tasks(LIMITS.tasksPerProject + 1) },
        ];
        const result = parseProjects(envelope(over));
        expect(result).toEqual({
            ok: false,
            reason: 'too-big',
            shape: { projects: 2, maxTasks: LIMITS.tasksPerProject + 1, maxSubtasks: 0 },
        });
    });

    it('covers a project name one character over the cap', () => {
        const over = [{ id: 'p1', name: 'x'.repeat(LIMITS.nameLength + 1), tasks: [] }];
        expect(parseProjects(envelope(over))).toEqual({ ok: false, reason: 'too-long' });
    });

    it('covers a task name one character over the cap', () => {
        const over = [
            {
                id: 'p1',
                name: 'Thesis',
                tasks: [leaf('t1', 'x'.repeat(LIMITS.nameLength + 1), false)],
            },
        ];
        expect(parseProjects(envelope(over))).toEqual({ ok: false, reason: 'too-long' });
    });

    it('covers a subtask note one character over the cap', () => {
        const over = [
            {
                id: 'p1',
                name: 'Thesis',
                tasks: [
                    task('t1', 'Read', [
                        sub('s1', { description: 'x'.repeat(LIMITS.descriptionLength + 1) }),
                    ]),
                ],
            },
        ];
        expect(parseProjects(envelope(over))).toEqual({ ok: false, reason: 'too-long' });
    });

    // Counts are checked first, so a plan breaking both is named by its shape.
    it('covers a plan over both a count and a length: the count wins', () => {
        const over = [
            {
                id: 'p1',
                name: 'x'.repeat(LIMITS.nameLength + 1),
                tasks: tasks(LIMITS.tasksPerProject + 1),
            },
        ];
        const result = parseProjects(envelope(over));
        expect(result.ok).toBe(false);
        if (result.ok) return;
        expect(result.reason).toBe('too-big');
    });

    it('covers a note exactly at the cap: fine', () => {
        const at = [
            {
                id: 'p1',
                name: 'Thesis',
                tasks: [
                    task('t1', 'Read', [
                        sub('s1', { description: 'x'.repeat(LIMITS.descriptionLength) }),
                    ]),
                ],
            },
        ];
        expect(parseProjects(envelope(at)).ok).toBe(true);
    });

    /*
     * Paste is the widest door for decomposed text: it arrives from whatever
     * produced it, and macOS hands out NFD freely. Composing before the caps
     * are measured also stops NFD's extra code units counting against a name.
     */
    it('covers decomposed text: composed before it reaches the plan', () => {
        const decomposed = [
            {
                id: 'p1',
                name: 'Học kỳ'.normalize('NFD'),
                tasks: [
                    task('t1', 'Đọc sách'.normalize('NFD'), [
                        sub('s1', { description: 'trang đầu'.normalize('NFD') }),
                    ]),
                ],
            },
        ];
        const result = parseProjects(envelope(decomposed));
        if (!result.ok) throw new Error('expected a well-formed paste');

        const project = result.projects[0];
        expect(project?.name).toBe('Học kỳ');
        expect(project?.tasks[0]?.name).toBe('Đọc sách');
        expect(project?.tasks[0]?.subtasks[0]?.description).toBe('trang đầu');
    });

    it('covers a name only over the cap once decomposed: measured composed', () => {
        const atCap = [
            { id: 'p1', name: 'ầ'.repeat(LIMITS.nameLength).normalize('NFD'), tasks: [] },
        ];
        expect(parseProjects(envelope(atCap)).ok).toBe(true);
    });
});

describe('withFreshIds', () => {
    /*
     * Testing strategy
     *     partition on depth: project only | project + task | full tree
     *
     * Weeks' rep invariant requires every id to be unique across ALL weeks, so
     * a paste that skipped this would put one node in two weeks.
     */
    function counter() {
        let n = 0;
        return () => `new${n++}`;
    }

    it('replaces every id in the tree and keeps everything else', () => {
        const fresh = withFreshIds(SAMPLE, counter());

        const ids = fresh.flatMap((p) => [
            p.id,
            ...p.tasks.flatMap((t) => [t.id, ...t.subtasks.map((s) => s.id)]),
        ]);
        expect(ids.every((id) => id.startsWith('new'))).toBe(true);
        expect(new Set(ids).size).toBe(ids.length);
        expect(fresh.map((p) => p.name)).toEqual(['Thesis', 'Gym']);
        expect(fresh[0]?.tasks[0]?.subtasks[0]?.missedDays).toEqual(['mon', 'tue']);
        expect(fresh[0]?.deadline).toBe('2026-08-21');
    });

    it('leaves the source untouched', () => {
        withFreshIds(SAMPLE, counter());
        expect(SAMPLE[0]?.id).toBe('p1');
    });

    it('produces valid projects', () => {
        expect(withFreshIds(SAMPLE, counter()).every(isValidProject)).toBe(true);
    });
});

describe('withoutProgress', () => {
    /*
     * Testing strategy
     *     partition on the node: subtask done | not done | with missedDays |
     *         leaf task done | leaf task not done | task with subtasks (has no
     *         isDone of its own to clear)
     */
    it('unticks subtasks and forgets their missed days', () => {
        const cleared = withoutProgress(SAMPLE);
        const subtasks = cleared[0]?.tasks[0]?.subtasks ?? [];
        expect(subtasks.map((s) => s.isDone)).toEqual([false, false]);
        expect(subtasks.map((s) => s.missedDays)).toEqual([[], []]);
    });

    it('unticks a leaf task', () => {
        expect(withoutProgress(SAMPLE)[0]?.tasks[1]?.isDone).toBe(false);
    });

    it('leaves a task with subtasks without an isDone of its own', () => {
        expect(withoutProgress(SAMPLE)[0]?.tasks[0]).not.toHaveProperty('isDone');
    });

    it('keeps everything that is not progress', () => {
        const cleared = withoutProgress(SAMPLE);
        expect(cleared[0]?.name).toBe('Thesis');
        expect(cleared[0]?.deadline).toBe('2026-08-21');
        expect(cleared[0]?.tasks[0]?.subtasks[1]?.weight).toBe(3);
        expect(cleared[0]?.tasks[0]?.subtasks[1]?.description).toBe('the long half');
        expect(cleared[0]?.tasks[0]?.subtasks[0]?.assignedDay).toBe('wed');
    });

    it('produces valid projects', () => {
        expect(withoutProgress(SAMPLE).every(isValidProject)).toBe(true);
    });

    it('leaves the source untouched', () => {
        withoutProgress(SAMPLE);
        expect(SAMPLE[0]?.tasks[0]?.subtasks[0]?.isDone).toBe(true);
    });
});
