import { describe, it, expect } from 'vitest';
import {
    addProject,
    addTask,
    addSubtask,
    removeProject,
    removeTask,
    removeSubtask,
    setProjectName,
    setTaskName,
    setTaskDescription,
    setSubtaskDescription,
    toggleTask,
    toggleSubtask,
    isValidProject,
    isValidSubtask,
    isValidTask
} from './projects';
import type { WeekPlan, Project, Task, Subtask, DayOfWeek } from "./types";

// A minimal valid project.
function makeProject(id: string): Project {
    return { id, name: id, tasks: [] };
}

// A minimal valid task.
function makeTask(id: string): Task {
    return { id, name: id, subtasks: [], isDone: false };
}

// A minimal valid subtask.
function makeSubtask(id: string, day: DayOfWeek): Subtask {
    return { id, isDone: false, assignedDay: day, missedDays: [], weight: 1 };
}

describe('addProject', () => {
    /**
     * Testing strategy:
     *      - partition on plan.projects: empty | non-empty
     *      properties checked in each case:
     *      - a project is appended (length grows by 1)
     *      - the new project has id === projectId, name === '', no tasks
     *      - the new project is last
     *      - weekStart is unchanged
     *      - the input plan is not mutated
     */

    it('covers empty plan: new blank project is the only project', () => {
        const plan: WeekPlan = { weekStart: '2026-07-06', projects: [] };
        const result = addProject(plan, 'p1');

        expect(result.projects).toHaveLength(1);
        expect(result.projects[result.projects.length - 1]).toEqual({ id: 'p1', name: '', tasks: [] });
        expect(result.weekStart).toBe('2026-07-06');
    });

    it('covers non-empty plan: new project appended last, existing unchanged', () => {
        const a = makeProject('a');
        const b = makeProject('b');
        const plan: WeekPlan = { weekStart: '2026-07-06', projects: [a, b] };
        const result = addProject(plan, 'pNew');

        expect(result.projects).toHaveLength(3);
        // existing projects come first, same instances (structural sharing)
        expect(result.projects[0]).toBe(a);
        expect(result.projects[1]).toBe(b);
        expect(result.projects[2]).toEqual({ id: 'pNew', name: '', tasks: [] });
        expect(result.weekStart).toBe('2026-07-06');
    });

    it('covers non-empty plan: input plan is not mutated', () => {
        const a = makeProject('a');
        const plan: WeekPlan = { weekStart: '2026-07-06', projects: [a] };
        addProject(plan, 'pNew');

        // original array length and instance are untouched
        expect(plan.projects).toHaveLength(1);
        expect(plan.projects[0]).toBe(a);
    });
});

describe('addTask', () => {
    /**
     * Testing strategy:
     *      - partition on target project's tasks: empty | non-empty
     *      - partition on number of projects: 1 | >1 (checks it hits the right one)
     *      - partition on projectId: exists | not found (miss)
     *
     *      properties checked when the project is found:
     *      - a blank task is appended (id === taskId, name = '', no subtasks, isDone = false)
     *      - the new task is last in that project's tasks
     *      - the target project is a new object; other projects are same instances
     *      - weekStart is unchanged
     *      - the input plan is not mutated
     */

    it('covers found, target empty, >1 project: adds first task to the right project only', () => {
        const a = makeProject('a'); // target
        const b = makeProject('b'); // sibling, must stay the same instance
        const plan: WeekPlan = { weekStart: '2026-07-06', projects: [a, b] };
        const result = addTask(plan, 'a', 't1');

        // sibling untouched (same instance)
        expect(result.projects[1]).toBe(b);
        // target is a new object with exactly the one new task
        const target = result.projects[0];
        expect(target).not.toBe(a);
        expect(target?.tasks).toEqual([{ id: 't1', name: '', subtasks: [], isDone: false }]);
        expect(result.weekStart).toBe('2026-07-06');
    });

    it('covers found, target non-empty: appends the new task after existing ones', () => {
        const existing = makeTask('t0');
        const a: Project = { id: 'a', name: 'a', tasks: [existing] };
        const plan: WeekPlan = { weekStart: '2026-07-06', projects: [a] };
        const result = addTask(plan, 'a', 't1');

        const target = result.projects[0];
        expect(target?.tasks).toHaveLength(2);
        // existing task kept (same instance) and still first; new task last and blank
        expect(target?.tasks[0]).toBe(existing);
        expect(target?.tasks[1]).toEqual({ id: 't1', name: '', subtasks: [], isDone: false });
    });

    it('covers not found: projects unchanged, no task added', () => {
        const a = makeProject('a');
        const plan: WeekPlan = { weekStart: '2026-07-06', projects: [a] };
        const result = addTask(plan, 'nope', 't1');

        // same project instance, nothing added
        expect(result.projects[0]).toBe(a);
        expect(result.projects[0]?.tasks).toHaveLength(0);
    });

    it('covers found: does not mutate the input plan', () => {
        const a = makeProject('a');
        const plan: WeekPlan = { weekStart: '2026-07-06', projects: [a] };
        addTask(plan, 'a', 't1');

        // original project instance and its empty tasks untouched
        expect(plan.projects[0]).toBe(a);
        expect(plan.projects[0]?.tasks).toHaveLength(0);
    });
});

describe('addSubtask', () => {
    /**
     * Testing strategy:
     *      - partition on target task's subtasks: empty (first -> strip isDone) | non-empty (no strip)
     *      - partition on structure: hits the right task, leaving sibling tasks and other projects shared
     *      - partition on taskId: exists | not found (miss)
     *
     *      properties checked when the task is found:
     *      - a new subtask is appended (id === subtaskId, assignedDay, no missed days, isDone = false, weight = 1)
     *      - the new subtask is last in that task's subtasks
     *      - the task ends with no isDone field (doneness derived from subtasks)
     *      - the target task/project are new objects; sibling tasks and other projects are same instances
     *      - weekStart is unchanged
     *      - the input plan is not mutated
     */

    it('covers found, target task is a leaf: adds first subtask and strips isDone', () => {
        const leaf = makeTask('t0'); // has isDone, no subtasks
        const a: Project = { id: 'a', name: 'a', tasks: [leaf] };
        const plan: WeekPlan = { weekStart: '2026-07-06', projects: [a] };
        const result = addSubtask(plan, 't0', 's1', 'mon');

        const task = result.projects[0]?.tasks[0];
        expect(task?.subtasks).toEqual([
            { id: 's1', isDone: false, assignedDay: 'mon', missedDays: [], weight: 1 },
        ]);
        // isDone dropped now that the task has a subtask
        expect(task).not.toHaveProperty('isDone');
        expect(result.weekStart).toBe('2026-07-06');
    });

    it('covers found, target task already has subtasks: appends and leaves isDone absent', () => {
        const existing = makeSubtask('s0', 'mon');
        // a task with a subtask carries no isDone (A-careful invariant)
        const parent: Task = { id: 't0', name: 't0', subtasks: [existing] };
        const a: Project = { id: 'a', name: 'a', tasks: [parent] };
        const plan: WeekPlan = { weekStart: '2026-07-06', projects: [a] };
        const result = addSubtask(plan, 't0', 's1', 'tue');

        const task = result.projects[0]?.tasks[0];
        expect(task?.subtasks).toHaveLength(2);
        // existing subtask kept (same instance) and still first
        expect(task?.subtasks[0]).toBe(existing);
        expect(task?.subtasks[1]).toEqual({ id: 's1', isDone: false, assignedDay: 'tue', missedDays: [], weight: 1 });
        expect(task).not.toHaveProperty('isDone');
    });

    it('covers found, >1 project and sibling task: only the target task is rebuilt', () => {
        const target = makeTask('t0');
        const siblingTask = makeTask('t1');
        const a: Project = { id: 'a', name: 'a', tasks: [target, siblingTask] };
        const b = makeProject('b');
        const plan: WeekPlan = { weekStart: '2026-07-06', projects: [a, b] };
        const result = addSubtask(plan, 't0', 's1', 'wed');

        // other project shared
        expect(result.projects[1]).toBe(b);
        // sibling task shared (same instance)
        expect(result.projects[0]?.tasks[1]).toBe(siblingTask);
        // parent project and target task are new objects
        expect(result.projects[0]).not.toBe(a);
        expect(result.projects[0]?.tasks[0]).not.toBe(target);
        expect(result.projects[0]?.tasks[0]?.subtasks).toHaveLength(1);
    });

    it('covers not found: projects unchanged, no subtask added', () => {
        const leaf = makeTask('t0');
        const a: Project = { id: 'a', name: 'a', tasks: [leaf] };
        const plan: WeekPlan = { weekStart: '2026-07-06', projects: [a] };
        const result = addSubtask(plan, 'nope', 's1', 'mon');

        expect(result.projects[0]).toBe(a);
        expect(result.projects[0]?.tasks[0]).toBe(leaf);
    });

    it('covers found: does not mutate the input plan', () => {
        const leaf = makeTask('t0');
        const a: Project = { id: 'a', name: 'a', tasks: [leaf] };
        const plan: WeekPlan = { weekStart: '2026-07-06', projects: [a] };
        addSubtask(plan, 't0', 's1', 'mon');

        // original task instance untouched: still a leaf with isDone and no subtasks
        expect(plan.projects[0]?.tasks[0]).toBe(leaf);
        expect(leaf.subtasks).toHaveLength(0);
        expect(leaf.isDone).toBe(false);
    });
});

describe('removeProject', () => {
    /**
     * Testing strategy:
     *      - partition on number of projects: 1 | >1
     *      - partition on removed project's position (when >1): first | middle | last
     *      - partition on projectId: exists | not found (miss, incl. empty plan)
     *
     *      properties checked when a project is removed:
     *      - the target is gone (length shrinks by 1, no project with that id)
     *      - surviving projects are the same instances, in the same order
     *      - weekStart is unchanged
     *      - the input plan is not mutated
     */

    it('covers 1 project: removing it leaves no projects', () => {
        const a = makeProject('a');
        const plan: WeekPlan = { weekStart: '2026-07-06', projects: [a] };
        const result = removeProject(plan, 'a');

        expect(result.projects).toEqual([]);
        expect(result.weekStart).toBe('2026-07-06');
    });

    it('covers >1, remove first: others remain, same instances and order', () => {
        const a = makeProject('a');
        const b = makeProject('b');
        const c = makeProject('c');
        const plan: WeekPlan = { weekStart: '2026-07-06', projects: [a, b, c] };
        const result = removeProject(plan, 'a');

        expect(result.projects).toHaveLength(2);
        expect(result.projects[0]).toBe(b);
        expect(result.projects[1]).toBe(c);
    });

    it('covers >1, remove middle: neighbours remain, same instances and order', () => {
        const a = makeProject('a');
        const b = makeProject('b');
        const c = makeProject('c');
        const plan: WeekPlan = { weekStart: '2026-07-06', projects: [a, b, c] };
        const result = removeProject(plan, 'b');

        expect(result.projects).toHaveLength(2);
        expect(result.projects[0]).toBe(a);
        expect(result.projects[1]).toBe(c);
    });

    it('covers >1, remove last: others remain, same instances and order', () => {
        const a = makeProject('a');
        const b = makeProject('b');
        const c = makeProject('c');
        const plan: WeekPlan = { weekStart: '2026-07-06', projects: [a, b, c] };
        const result = removeProject(plan, 'c');

        expect(result.projects).toHaveLength(2);
        expect(result.projects[0]).toBe(a);
        expect(result.projects[1]).toBe(b);
    });

    it('covers not found on non-empty plan: projects unchanged (same instances)', () => {
        const a = makeProject('a');
        const b = makeProject('b');
        const plan: WeekPlan = { weekStart: '2026-07-06', projects: [a, b] };
        const result = removeProject(plan, 'nope');

        expect(result.projects).toHaveLength(2);
        expect(result.projects[0]).toBe(a);
        expect(result.projects[1]).toBe(b);
    });

    it('covers not found on empty plan: still no projects', () => {
        const plan: WeekPlan = { weekStart: '2026-07-06', projects: [] };
        const result = removeProject(plan, 'nope');

        expect(result.projects).toEqual([]);
    });

    it('covers remove: does not mutate the input plan', () => {
        const a = makeProject('a');
        const b = makeProject('b');
        const plan: WeekPlan = { weekStart: '2026-07-06', projects: [a, b] };
        removeProject(plan, 'a');

        expect(plan.projects).toHaveLength(2);
        expect(plan.projects[0]).toBe(a);
        expect(plan.projects[1]).toBe(b);
    });
});

describe('removeTask', () => {
    /**
     * Testing strategy:
     *      - partition on target project's tasks: 1 | >1
     *      - partition on removed task's position (when >1): first | middle | last
     *      - partition on number of projects: 1 | >1 (finds the task's project among many)
     *      - partition on taskId: exists | not found (miss, incl. empty plan)
     *
     *      properties checked when a task is removed:
     *      - the task is gone from its project (that project's tasks shrink by 1)
     *      - surviving tasks are the same instances, in the same order
     *      - the parent project is a new object; all other projects are same instances
     *      - weekStart is unchanged
     *      - the input plan is not mutated
     */

    it('covers 1 project, 1 task: removing it leaves that project with no tasks', () => {
        const t = makeTask('t0');
        const a: Project = { id: 'a', name: 'a', tasks: [t] };
        const plan: WeekPlan = { weekStart: '2026-07-06', projects: [a] };
        const result = removeTask(plan, 't0');

        expect(result.projects[0]?.tasks).toEqual([]);
        expect(result.weekStart).toBe('2026-07-06');
    });

    it('covers >1 tasks, remove first: others remain, same instances and order', () => {
        const t0 = makeTask('t0');
        const t1 = makeTask('t1');
        const t2 = makeTask('t2');
        const a: Project = { id: 'a', name: 'a', tasks: [t0, t1, t2] };
        const plan: WeekPlan = { weekStart: '2026-07-06', projects: [a] };
        const result = removeTask(plan, 't0');

        expect(result.projects[0]?.tasks).toHaveLength(2);
        expect(result.projects[0]?.tasks[0]).toBe(t1);
        expect(result.projects[0]?.tasks[1]).toBe(t2);
    });

    it('covers >1 tasks, remove middle: neighbours remain, same instances and order', () => {
        const t0 = makeTask('t0');
        const t1 = makeTask('t1');
        const t2 = makeTask('t2');
        const a: Project = { id: 'a', name: 'a', tasks: [t0, t1, t2] };
        const plan: WeekPlan = { weekStart: '2026-07-06', projects: [a] };
        const result = removeTask(plan, 't1');

        expect(result.projects[0]?.tasks).toHaveLength(2);
        expect(result.projects[0]?.tasks[0]).toBe(t0);
        expect(result.projects[0]?.tasks[1]).toBe(t2);
    });

    it('covers >1 tasks, remove last: others remain, same instances and order', () => {
        const t0 = makeTask('t0');
        const t1 = makeTask('t1');
        const t2 = makeTask('t2');
        const a: Project = { id: 'a', name: 'a', tasks: [t0, t1, t2] };
        const plan: WeekPlan = { weekStart: '2026-07-06', projects: [a] };
        const result = removeTask(plan, 't2');

        expect(result.projects[0]?.tasks).toHaveLength(2);
        expect(result.projects[0]?.tasks[0]).toBe(t0);
        expect(result.projects[0]?.tasks[1]).toBe(t1);
    });

    it('covers >1 projects: finds the right project, others stay same instances', () => {
        const t = makeTask('t0');
        const a: Project = { id: 'a', name: 'a', tasks: [t] };
        const b = makeProject('b');
        const c = makeProject('c');
        const plan: WeekPlan = { weekStart: '2026-07-06', projects: [b, a, c] };
        const result = removeTask(plan, 't0');

        // other projects untouched (same instances)
        expect(result.projects[0]).toBe(b);
        expect(result.projects[2]).toBe(c);
        // the target's project is rebuilt with the task gone
        expect(result.projects[1]).not.toBe(a);
        expect(result.projects[1]?.tasks).toEqual([]);
    });

    it('covers not found on non-empty plan: projects unchanged (same instances)', () => {
        const t = makeTask('t0');
        const a: Project = { id: 'a', name: 'a', tasks: [t] };
        const b = makeProject('b');
        const plan: WeekPlan = { weekStart: '2026-07-06', projects: [a, b] };
        const result = removeTask(plan, 'nope');

        expect(result.projects[0]).toBe(a);
        expect(result.projects[1]).toBe(b);
    });

    it('covers not found on empty plan: still no projects', () => {
        const plan: WeekPlan = { weekStart: '2026-07-06', projects: [] };
        const result = removeTask(plan, 'nope');

        expect(result.projects).toEqual([]);
    });

    it('covers remove: does not mutate the input plan', () => {
        const t0 = makeTask('t0');
        const t1 = makeTask('t1');
        const a: Project = { id: 'a', name: 'a', tasks: [t0, t1] };
        const plan: WeekPlan = { weekStart: '2026-07-06', projects: [a] };
        removeTask(plan, 't0');

        expect(plan.projects[0]?.tasks).toHaveLength(2);
        expect(plan.projects[0]?.tasks[0]).toBe(t0);
        expect(plan.projects[0]?.tasks[1]).toBe(t1);
    });
});

describe('removeSubtask', () => {
    /**
     * Testing strategy:
     *      - partition on target task's subtasks: 1 (remove -> empty -> restore isDone) | >1 (no restore)
     *      - partition on removed subtask's position (when >1): first | middle | last
     *      - partition on structure: hits the right task among sibling tasks and other projects
     *      - partition on subtaskId: exists | not found (miss, incl. empty plan)
     *
     *      properties checked when a subtask is removed:
     *      - the subtask is gone from its task (that task's subtasks shrink by 1)
     *      - surviving subtasks are the same instances, in the same order
     *      - if the task is now empty, its isDone is restored to false; otherwise isDone stays absent
     *      - the target task/project are new objects; sibling tasks and other projects are same instances
     *      - weekStart is unchanged
     *      - the input plan is not mutated
     */

    it('covers task with 1 subtask: removing it empties the task and restores isDone=false', () => {
        const s0 = makeSubtask('s0', 'mon');
        const parent: Task = { id: 't0', name: 't0', subtasks: [s0] }; // no isDone (has a subtask)
        const a: Project = { id: 'a', name: 'a', tasks: [parent] };
        const plan: WeekPlan = { weekStart: '2026-07-06', projects: [a] };
        const result = removeSubtask(plan, 's0');

        const task = result.projects[0]?.tasks[0];
        expect(task?.subtasks).toEqual([]);
        expect(task?.isDone).toBe(false);
        expect(result.weekStart).toBe('2026-07-06');
    });

    it('covers >1 subtasks, remove first: others remain, isDone stays absent', () => {
        const s0 = makeSubtask('s0', 'mon');
        const s1 = makeSubtask('s1', 'tue');
        const s2 = makeSubtask('s2', 'wed');
        const parent: Task = { id: 't0', name: 't0', subtasks: [s0, s1, s2] };
        const a: Project = { id: 'a', name: 'a', tasks: [parent] };
        const plan: WeekPlan = { weekStart: '2026-07-06', projects: [a] };
        const result = removeSubtask(plan, 's0');

        const task = result.projects[0]?.tasks[0];
        expect(task?.subtasks).toHaveLength(2);
        expect(task?.subtasks[0]).toBe(s1);
        expect(task?.subtasks[1]).toBe(s2);
        expect(task).not.toHaveProperty('isDone');
    });

    it('covers >1 subtasks, remove middle: neighbours remain, isDone stays absent', () => {
        const s0 = makeSubtask('s0', 'mon');
        const s1 = makeSubtask('s1', 'tue');
        const s2 = makeSubtask('s2', 'wed');
        const parent: Task = { id: 't0', name: 't0', subtasks: [s0, s1, s2] };
        const a: Project = { id: 'a', name: 'a', tasks: [parent] };
        const plan: WeekPlan = { weekStart: '2026-07-06', projects: [a] };
        const result = removeSubtask(plan, 's1');

        const task = result.projects[0]?.tasks[0];
        expect(task?.subtasks).toHaveLength(2);
        expect(task?.subtasks[0]).toBe(s0);
        expect(task?.subtasks[1]).toBe(s2);
        expect(task).not.toHaveProperty('isDone');
    });

    it('covers >1 subtasks, remove last: others remain, isDone stays absent', () => {
        const s0 = makeSubtask('s0', 'mon');
        const s1 = makeSubtask('s1', 'tue');
        const s2 = makeSubtask('s2', 'wed');
        const parent: Task = { id: 't0', name: 't0', subtasks: [s0, s1, s2] };
        const a: Project = { id: 'a', name: 'a', tasks: [parent] };
        const plan: WeekPlan = { weekStart: '2026-07-06', projects: [a] };
        const result = removeSubtask(plan, 's2');

        const task = result.projects[0]?.tasks[0];
        expect(task?.subtasks).toHaveLength(2);
        expect(task?.subtasks[0]).toBe(s0);
        expect(task?.subtasks[1]).toBe(s1);
        expect(task).not.toHaveProperty('isDone');
    });

    it('covers >1 projects and sibling task: only the target task is rebuilt', () => {
        const s0 = makeSubtask('s0', 'mon');
        const target: Task = { id: 't0', name: 't0', subtasks: [s0] };
        const siblingTask = makeTask('t1');
        const a: Project = { id: 'a', name: 'a', tasks: [target, siblingTask] };
        const b = makeProject('b');
        const c = makeProject('c');
        const plan: WeekPlan = { weekStart: '2026-07-06', projects: [b, a, c] };
        const result = removeSubtask(plan, 's0');

        // other projects shared
        expect(result.projects[0]).toBe(b);
        expect(result.projects[2]).toBe(c);
        // sibling task shared, target task rebuilt
        expect(result.projects[1]?.tasks[1]).toBe(siblingTask);
        expect(result.projects[1]?.tasks[0]).not.toBe(target);
        expect(result.projects[1]?.tasks[0]?.subtasks).toEqual([]);
    });

    it('covers not found on non-empty plan: everything unchanged (same instances)', () => {
        const s0 = makeSubtask('s0', 'mon');
        const parent: Task = { id: 't0', name: 't0', subtasks: [s0] };
        const a: Project = { id: 'a', name: 'a', tasks: [parent] };
        const b = makeProject('b');
        const plan: WeekPlan = { weekStart: '2026-07-06', projects: [a, b] };
        const result = removeSubtask(plan, 'nope');

        expect(result.projects[0]).toBe(a);
        expect(result.projects[1]).toBe(b);
    });

    it('covers not found on empty plan: still no projects', () => {
        const plan: WeekPlan = { weekStart: '2026-07-06', projects: [] };
        const result = removeSubtask(plan, 'nope');

        expect(result.projects).toEqual([]);
    });

    it('covers restore: does not mutate the input plan', () => {
        const s0 = makeSubtask('s0', 'mon');
        const parent: Task = { id: 't0', name: 't0', subtasks: [s0] };
        const a: Project = { id: 'a', name: 'a', tasks: [parent] };
        const plan: WeekPlan = { weekStart: '2026-07-06', projects: [a] };
        removeSubtask(plan, 's0');

        // input task still has its subtask and still no isDone (restore happened on a copy)
        expect(plan.projects[0]?.tasks[0]?.subtasks[0]).toBe(s0);
        expect(plan.projects[0]?.tasks[0]).not.toHaveProperty('isDone');
    });
});
