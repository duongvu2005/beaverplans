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
    isTaskDone,
    isValidProject,
    isValidSubtask,
    isValidTask,
    isValidPlan
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
        expect(isValidPlan(result)).toBe(true);

        expect(result.projects).toHaveLength(1);
        expect(result.projects[result.projects.length - 1]).toEqual({ id: 'p1', name: '', tasks: [] });
        expect(result.weekStart).toBe('2026-07-06');
    });

    it('covers non-empty plan: new project appended last, existing unchanged', () => {
        const a = makeProject('a');
        const b = makeProject('b');
        const plan: WeekPlan = { weekStart: '2026-07-06', projects: [a, b] };
        const result = addProject(plan, 'pNew');
        expect(isValidPlan(result)).toBe(true);

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
        const result = addProject(plan, 'pNew');
        expect(isValidPlan(result)).toBe(true);

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
        expect(isValidPlan(result)).toBe(true);

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
        expect(isValidPlan(result)).toBe(true);

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
        expect(isValidPlan(result)).toBe(true);

        // same project instance, nothing added
        expect(result.projects[0]).toBe(a);
        expect(result.projects[0]?.tasks).toHaveLength(0);
    });

    it('covers found: does not mutate the input plan', () => {
        const a = makeProject('a');
        const plan: WeekPlan = { weekStart: '2026-07-06', projects: [a] };
        const result = addTask(plan, 'a', 't1');
        expect(isValidPlan(result)).toBe(true);

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
        expect(isValidPlan(result)).toBe(true);

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
        expect(isValidPlan(result)).toBe(true);

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
        expect(isValidPlan(result)).toBe(true);

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
        expect(isValidPlan(result)).toBe(true);

        expect(result.projects[0]).toBe(a);
        expect(result.projects[0]?.tasks[0]).toBe(leaf);
    });

    it('covers found: does not mutate the input plan', () => {
        const leaf = makeTask('t0');
        const a: Project = { id: 'a', name: 'a', tasks: [leaf] };
        const plan: WeekPlan = { weekStart: '2026-07-06', projects: [a] };
        const result = addSubtask(plan, 't0', 's1', 'mon');
        expect(isValidPlan(result)).toBe(true);

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
        expect(isValidPlan(result)).toBe(true);

        expect(result.projects).toEqual([]);
        expect(result.weekStart).toBe('2026-07-06');
    });

    it('covers >1, remove first: others remain, same instances and order', () => {
        const a = makeProject('a');
        const b = makeProject('b');
        const c = makeProject('c');
        const plan: WeekPlan = { weekStart: '2026-07-06', projects: [a, b, c] };
        const result = removeProject(plan, 'a');
        expect(isValidPlan(result)).toBe(true);

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
        expect(isValidPlan(result)).toBe(true);

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
        expect(isValidPlan(result)).toBe(true);

        expect(result.projects).toHaveLength(2);
        expect(result.projects[0]).toBe(a);
        expect(result.projects[1]).toBe(b);
    });

    it('covers not found on non-empty plan: projects unchanged (same instances)', () => {
        const a = makeProject('a');
        const b = makeProject('b');
        const plan: WeekPlan = { weekStart: '2026-07-06', projects: [a, b] };
        const result = removeProject(plan, 'nope');
        expect(isValidPlan(result)).toBe(true);

        expect(result.projects).toHaveLength(2);
        expect(result.projects[0]).toBe(a);
        expect(result.projects[1]).toBe(b);
    });

    it('covers not found on empty plan: still no projects', () => {
        const plan: WeekPlan = { weekStart: '2026-07-06', projects: [] };
        const result = removeProject(plan, 'nope');
        expect(isValidPlan(result)).toBe(true);

        expect(result.projects).toEqual([]);
    });

    it('covers remove: does not mutate the input plan', () => {
        const a = makeProject('a');
        const b = makeProject('b');
        const plan: WeekPlan = { weekStart: '2026-07-06', projects: [a, b] };
        const result = removeProject(plan, 'a');
        expect(isValidPlan(result)).toBe(true);

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
        expect(isValidPlan(result)).toBe(true);

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
        expect(isValidPlan(result)).toBe(true);

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
        expect(isValidPlan(result)).toBe(true);

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
        expect(isValidPlan(result)).toBe(true);

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
        expect(isValidPlan(result)).toBe(true);

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
        expect(isValidPlan(result)).toBe(true);

        expect(result.projects[0]).toBe(a);
        expect(result.projects[1]).toBe(b);
    });

    it('covers not found on empty plan: still no projects', () => {
        const plan: WeekPlan = { weekStart: '2026-07-06', projects: [] };
        const result = removeTask(plan, 'nope');
        expect(isValidPlan(result)).toBe(true);

        expect(result.projects).toEqual([]);
    });

    it('covers remove: does not mutate the input plan', () => {
        const t0 = makeTask('t0');
        const t1 = makeTask('t1');
        const a: Project = { id: 'a', name: 'a', tasks: [t0, t1] };
        const plan: WeekPlan = { weekStart: '2026-07-06', projects: [a] };
        const result = removeTask(plan, 't0');
        expect(isValidPlan(result)).toBe(true);

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
        expect(isValidPlan(result)).toBe(true);

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
        expect(isValidPlan(result)).toBe(true);

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
        expect(isValidPlan(result)).toBe(true);

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
        expect(isValidPlan(result)).toBe(true);

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
        expect(isValidPlan(result)).toBe(true);

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
        expect(isValidPlan(result)).toBe(true);

        expect(result.projects[0]).toBe(a);
        expect(result.projects[1]).toBe(b);
    });

    it('covers not found on empty plan: still no projects', () => {
        const plan: WeekPlan = { weekStart: '2026-07-06', projects: [] };
        const result = removeSubtask(plan, 'nope');
        expect(isValidPlan(result)).toBe(true);

        expect(result.projects).toEqual([]);
    });

    it('covers restore: does not mutate the input plan', () => {
        const s0 = makeSubtask('s0', 'mon');
        const parent: Task = { id: 't0', name: 't0', subtasks: [s0] };
        const a: Project = { id: 'a', name: 'a', tasks: [parent] };
        const plan: WeekPlan = { weekStart: '2026-07-06', projects: [a] };
        const result = removeSubtask(plan, 's0');
        expect(isValidPlan(result)).toBe(true);

        // input task still has its subtask and still no isDone (restore happened on a copy)
        expect(plan.projects[0]?.tasks[0]?.subtasks[0]).toBe(s0);
        expect(plan.projects[0]?.tasks[0]).not.toHaveProperty('isDone');
    });
});

describe('setProjectName', () => {
    /**
     * Testing strategy:
     *      - partition on projectId: exists (among other projects) | not found (miss)
     *
     *      properties checked when found:
     *      - the target project's name is set to the given value
     *      - the target project is a new object; all other projects are same instances
     *      - weekStart is unchanged; input not mutated
     */

    it('covers found among siblings: sets name, other projects shared', () => {
        const a = makeProject('a');
        const b = makeProject('b');
        const plan: WeekPlan = { weekStart: '2026-07-06', projects: [a, b] };
        const result = setProjectName(plan, 'a', 'Renamed');
        expect(isValidPlan(result)).toBe(true);

        expect(result.projects[0]?.name).toBe('Renamed');
        expect(result.projects[0]).not.toBe(a);
        expect(result.projects[1]).toBe(b); // sibling shared
        expect(result.weekStart).toBe('2026-07-06');
    });

    it('covers not found: projects unchanged (same instances)', () => {
        const a = makeProject('a');
        const plan: WeekPlan = { weekStart: '2026-07-06', projects: [a] };
        const result = setProjectName(plan, 'nope', 'Renamed');
        expect(isValidPlan(result)).toBe(true);

        expect(result.projects[0]).toBe(a);
    });

    it('covers found: does not mutate the input plan', () => {
        const a = makeProject('a'); // makeProject sets name = id = 'a'
        const plan: WeekPlan = { weekStart: '2026-07-06', projects: [a] };
        const result = setProjectName(plan, 'a', 'Renamed');
        expect(isValidPlan(result)).toBe(true);

        expect(plan.projects[0]?.name).toBe('a');
    });
});

describe('setTaskName', () => {
    /**
     * Testing strategy:
     *      - partition on taskId: exists (among sibling tasks and other projects) | not found
     *
     *      properties checked when found:
     *      - the target task's name is set to the given value
     *      - the task's OTHER fields (subtasks, isDone, deadline) are preserved (spread, not rebuilt)
     *      - target task/project are new objects; sibling tasks and other projects are same instances
     *      - weekStart unchanged; input not mutated
     */

    it('covers found among siblings: sets name, preserves other fields, shares the rest', () => {
        const target: Task = { id: 't0', name: 't0', subtasks: [], isDone: false, deadline: '2026-07-10' };
        const siblingTask = makeTask('t1');
        const a: Project = { id: 'a', name: 'a', tasks: [target, siblingTask] };
        const b = makeProject('b');
        const plan: WeekPlan = { weekStart: '2026-07-06', projects: [a, b] };
        const result = setTaskName(plan, 't0', 'Renamed');
        expect(isValidPlan(result)).toBe(true);

        const task = result.projects[0]?.tasks[0];
        expect(task?.name).toBe('Renamed');
        // other fields preserved
        expect(task?.isDone).toBe(false);
        expect(task?.deadline).toBe('2026-07-10');
        expect(task?.subtasks).toEqual([]);
        // sharing
        expect(result.projects[0]?.tasks[1]).toBe(siblingTask);
        expect(result.projects[1]).toBe(b);
        expect(result.projects[0]?.tasks[0]).not.toBe(target);
    });

    it('covers not found: projects unchanged (same instances)', () => {
        const target = makeTask('t0');
        const a: Project = { id: 'a', name: 'a', tasks: [target] };
        const plan: WeekPlan = { weekStart: '2026-07-06', projects: [a] };
        const result = setTaskName(plan, 'nope', 'Renamed');
        expect(isValidPlan(result)).toBe(true);

        expect(result.projects[0]?.tasks[0]).toBe(target);
    });

    it('covers found: does not mutate the input plan', () => {
        const target = makeTask('t0'); // name = 't0'
        const a: Project = { id: 'a', name: 'a', tasks: [target] };
        const plan: WeekPlan = { weekStart: '2026-07-06', projects: [a] };
        const result = setTaskName(plan, 't0', 'Renamed');
        expect(isValidPlan(result)).toBe(true);

        expect(plan.projects[0]?.tasks[0]?.name).toBe('t0');
    });
});

describe('setTaskDescription', () => {
    /**
     * Testing strategy:
     *      - partition on taskId: exists (among siblings) | not found
     *
     *      properties checked when found:
     *      - the target task's description is set to the given value
     *      - target task/project new objects; sibling tasks and other projects shared
     *      - weekStart unchanged; input not mutated
     */

    it('covers found among siblings: sets description, shares the rest', () => {
        const target = makeTask('t0');
        const siblingTask = makeTask('t1');
        const a: Project = { id: 'a', name: 'a', tasks: [target, siblingTask] };
        const plan: WeekPlan = { weekStart: '2026-07-06', projects: [a] };
        const result = setTaskDescription(plan, 't0', 'some notes');
        expect(isValidPlan(result)).toBe(true);

        expect(result.projects[0]?.tasks[0]?.description).toBe('some notes');
        expect(result.projects[0]?.tasks[1]).toBe(siblingTask);
        expect(result.projects[0]?.tasks[0]).not.toBe(target);
    });

    it('covers not found: projects unchanged (same instances)', () => {
        const target = makeTask('t0');
        const a: Project = { id: 'a', name: 'a', tasks: [target] };
        const plan: WeekPlan = { weekStart: '2026-07-06', projects: [a] };
        const result = setTaskDescription(plan, 'nope', 'some notes');
        expect(isValidPlan(result)).toBe(true);

        expect(result.projects[0]?.tasks[0]).toBe(target);
    });

    it('covers found: does not mutate the input plan', () => {
        const target = makeTask('t0'); // no description
        const a: Project = { id: 'a', name: 'a', tasks: [target] };
        const plan: WeekPlan = { weekStart: '2026-07-06', projects: [a] };
        const result = setTaskDescription(plan, 't0', 'some notes');
        expect(isValidPlan(result)).toBe(true);

        expect(plan.projects[0]?.tasks[0]?.description).toBeUndefined();
    });
});

describe('setSubtaskDescription', () => {
    /**
     * Testing strategy:
     *      - partition on subtaskId: exists (among siblings) | not found
     *      - partition on value: non-empty | empty string (stored as given, not stripped)
     *
     *      properties checked when found:
     *      - the target subtask's description is set to the given value
     *      - target subtask/task/project new objects; sibling subtasks, tasks, projects shared
     *      - weekStart unchanged; input not mutated
     */

    it('covers found among siblings: sets description, shares the rest', () => {
        const s0 = makeSubtask('s0', 'mon');
        const s1 = makeSubtask('s1', 'tue');
        const parent: Task = { id: 't0', name: 't0', subtasks: [s0, s1] };
        const a: Project = { id: 'a', name: 'a', tasks: [parent] };
        const plan: WeekPlan = { weekStart: '2026-07-06', projects: [a] };
        const result = setSubtaskDescription(plan, 's0', 'notes');
        expect(isValidPlan(result)).toBe(true);

        const task = result.projects[0]?.tasks[0];
        expect(task?.subtasks[0]?.description).toBe('notes');
        expect(task?.subtasks[1]).toBe(s1); // sibling subtask shared
        expect(task?.subtasks[0]).not.toBe(s0);
    });

    it('covers empty string: stored as given (not removed)', () => {
        const s0 = makeSubtask('s0', 'mon');
        const parent: Task = { id: 't0', name: 't0', subtasks: [s0] };
        const a: Project = { id: 'a', name: 'a', tasks: [parent] };
        const plan: WeekPlan = { weekStart: '2026-07-06', projects: [a] };
        const result = setSubtaskDescription(plan, 's0', '');
        expect(isValidPlan(result)).toBe(true);

        expect(result.projects[0]?.tasks[0]?.subtasks[0]?.description).toBe('');
    });

    it('covers not found: projects unchanged (same instances)', () => {
        const s0 = makeSubtask('s0', 'mon');
        const parent: Task = { id: 't0', name: 't0', subtasks: [s0] };
        const a: Project = { id: 'a', name: 'a', tasks: [parent] };
        const plan: WeekPlan = { weekStart: '2026-07-06', projects: [a] };
        const result = setSubtaskDescription(plan, 'nope', 'notes');
        expect(isValidPlan(result)).toBe(true);

        expect(result.projects[0]?.tasks[0]?.subtasks[0]).toBe(s0);
    });

    it('covers found: does not mutate the input plan', () => {
        const s0 = makeSubtask('s0', 'mon'); // no description
        const parent: Task = { id: 't0', name: 't0', subtasks: [s0] };
        const a: Project = { id: 'a', name: 'a', tasks: [parent] };
        const plan: WeekPlan = { weekStart: '2026-07-06', projects: [a] };
        const result = setSubtaskDescription(plan, 's0', 'notes');
        expect(isValidPlan(result)).toBe(true);

        expect(plan.projects[0]?.tasks[0]?.subtasks[0]?.description).toBeUndefined();
    });
});

describe('toggleSubtask', () => {
    /**
     * Testing strategy:
     *      - partition on subtask's current isDone: false (-> true) | true (-> false)
     *      - partition on subtaskId: exists (among siblings) | not found
     *
     *      properties checked when found:
     *      - the target subtask's isDone is flipped
     *      - target subtask/task/project new objects; sibling subtasks, tasks, projects shared
     *      - weekStart unchanged; input not mutated
     */

    it('covers found, currently undone: flips isDone to true, shares the rest', () => {
        const s0 = makeSubtask('s0', 'mon'); // isDone: false
        const s1 = makeSubtask('s1', 'tue');
        const parent: Task = { id: 't0', name: 't0', subtasks: [s0, s1] };
        const a: Project = { id: 'a', name: 'a', tasks: [parent] };
        const plan: WeekPlan = { weekStart: '2026-07-06', projects: [a] };
        const result = toggleSubtask(plan, 's0');
        expect(isValidPlan(result)).toBe(true);

        const task = result.projects[0]?.tasks[0];
        expect(task?.subtasks[0]?.isDone).toBe(true);
        expect(task?.subtasks[1]).toBe(s1); // sibling subtask shared
        expect(task?.subtasks[0]).not.toBe(s0);
        expect(result.weekStart).toBe('2026-07-06');
    });

    it('covers found, currently done: flips isDone to false', () => {
        const s0: Subtask = { id: 's0', isDone: true, assignedDay: 'mon', missedDays: [], weight: 1 };
        const parent: Task = { id: 't0', name: 't0', subtasks: [s0] };
        const a: Project = { id: 'a', name: 'a', tasks: [parent] };
        const plan: WeekPlan = { weekStart: '2026-07-06', projects: [a] };
        const result = toggleSubtask(plan, 's0');
        expect(isValidPlan(result)).toBe(true);

        expect(result.projects[0]?.tasks[0]?.subtasks[0]?.isDone).toBe(false);
    });

    it('covers found among >1 projects: only the target is rebuilt', () => {
        const s0 = makeSubtask('s0', 'mon');
        const target: Task = { id: 't0', name: 't0', subtasks: [s0] };
        const siblingTask = makeTask('t1');
        const a: Project = { id: 'a', name: 'a', tasks: [target, siblingTask] };
        const b = makeProject('b');
        const plan: WeekPlan = { weekStart: '2026-07-06', projects: [b, a] };
        const result = toggleSubtask(plan, 's0');
        expect(isValidPlan(result)).toBe(true);

        expect(result.projects[0]).toBe(b); // other project shared
        expect(result.projects[1]?.tasks[1]).toBe(siblingTask); // sibling task shared
        expect(result.projects[1]?.tasks[0]).not.toBe(target);
    });

    it('covers not found: projects unchanged (same instances)', () => {
        const s0 = makeSubtask('s0', 'mon');
        const parent: Task = { id: 't0', name: 't0', subtasks: [s0] };
        const a: Project = { id: 'a', name: 'a', tasks: [parent] };
        const plan: WeekPlan = { weekStart: '2026-07-06', projects: [a] };
        const result = toggleSubtask(plan, 'nope');
        expect(isValidPlan(result)).toBe(true);

        expect(result.projects[0]).toBe(a);
    });

    it('covers found: does not mutate the input plan', () => {
        const s0 = makeSubtask('s0', 'mon'); // isDone: false
        const parent: Task = { id: 't0', name: 't0', subtasks: [s0] };
        const a: Project = { id: 'a', name: 'a', tasks: [parent] };
        const plan: WeekPlan = { weekStart: '2026-07-06', projects: [a] };
        const result = toggleSubtask(plan, 's0');
        expect(isValidPlan(result)).toBe(true);

        expect(plan.projects[0]?.tasks[0]?.subtasks[0]?.isDone).toBe(false);
    });
});

describe('toggleTask', () => {
    /**
     * Testing strategy:
     *      - partition on taskId: exists | not found
     *      - partition on whether the task has subtasks:
     *          - no subtasks (leaf): partition on isDone: false (-> true) | true (-> false)
     *          - has subtasks: partition on aggregate state:
     *              all done (-> all undone) | all undone (-> all done) | mixed (-> all done)
     *
     *      properties checked when found:
     *      - leaf: its isDone is flipped
     *      - parent: every subtask's isDone is set to one target
     *        (false if all were done, true otherwise)
     *      - target task/project new objects; sibling tasks and other projects shared
     *      - weekStart unchanged; input not mutated
     */

    it('covers leaf, currently undone: flips isDone to true', () => {
        const leaf: Task = { id: 't0', name: 't0', subtasks: [], isDone: false };
        const a: Project = { id: 'a', name: 'a', tasks: [leaf] };
        const plan: WeekPlan = { weekStart: '2026-07-06', projects: [a] };
        const result = toggleTask(plan, 't0');
        expect(isValidPlan(result)).toBe(true);

        expect(result.projects[0]?.tasks[0]?.isDone).toBe(true);
        expect(result.weekStart).toBe('2026-07-06');
    });

    it('covers leaf, currently done: flips isDone to false', () => {
        const leaf: Task = { id: 't0', name: 't0', subtasks: [], isDone: true };
        const a: Project = { id: 'a', name: 'a', tasks: [leaf] };
        const plan: WeekPlan = { weekStart: '2026-07-06', projects: [a] };
        const result = toggleTask(plan, 't0');
        expect(isValidPlan(result)).toBe(true);

        expect(result.projects[0]?.tasks[0]?.isDone).toBe(false);
    });

    it('covers parent, all subtasks done: sets all undone', () => {
        const s0: Subtask = { id: 's0', isDone: true, assignedDay: 'mon', missedDays: [], weight: 1 };
        const s1: Subtask = { id: 's1', isDone: true, assignedDay: 'tue', missedDays: [], weight: 1 };
        const parent: Task = { id: 't0', name: 't0', subtasks: [s0, s1] };
        const a: Project = { id: 'a', name: 'a', tasks: [parent] };
        const plan: WeekPlan = { weekStart: '2026-07-06', projects: [a] };
        const result = toggleTask(plan, 't0');
        expect(isValidPlan(result)).toBe(true);

        const subs = result.projects[0]?.tasks[0]?.subtasks;
        expect(subs?.map(s => s.isDone)).toEqual([false, false]);
    });

    it('covers parent, all subtasks undone: sets all done', () => {
        const s0 = makeSubtask('s0', 'mon'); // isDone: false
        const s1 = makeSubtask('s1', 'tue');
        const parent: Task = { id: 't0', name: 't0', subtasks: [s0, s1] };
        const a: Project = { id: 'a', name: 'a', tasks: [parent] };
        const plan: WeekPlan = { weekStart: '2026-07-06', projects: [a] };
        const result = toggleTask(plan, 't0');
        expect(isValidPlan(result)).toBe(true);

        const subs = result.projects[0]?.tasks[0]?.subtasks;
        expect(subs?.map(s => s.isDone)).toEqual([true, true]);
    });

    it('covers parent, mixed: sets all done (target, not per-subtask flip)', () => {
        const s0: Subtask = { id: 's0', isDone: true, assignedDay: 'mon', missedDays: [], weight: 1 };
        const s1 = makeSubtask('s1', 'tue'); // isDone: false
        const parent: Task = { id: 't0', name: 't0', subtasks: [s0, s1] };
        const a: Project = { id: 'a', name: 'a', tasks: [parent] };
        const plan: WeekPlan = { weekStart: '2026-07-06', projects: [a] };
        const result = toggleTask(plan, 't0');
        expect(isValidPlan(result)).toBe(true);

        const subs = result.projects[0]?.tasks[0]?.subtasks;
        // both true: a per-subtask flip would have given [false, true]
        expect(subs?.map(s => s.isDone)).toEqual([true, true]);
    });

    it('covers found among >1 projects and sibling task: only the target is rebuilt', () => {
        const leaf: Task = { id: 't0', name: 't0', subtasks: [], isDone: false };
        const siblingTask = makeTask('t1');
        const a: Project = { id: 'a', name: 'a', tasks: [leaf, siblingTask] };
        const b = makeProject('b');
        const plan: WeekPlan = { weekStart: '2026-07-06', projects: [b, a] };
        const result = toggleTask(plan, 't0');
        expect(isValidPlan(result)).toBe(true);

        expect(result.projects[0]).toBe(b); // other project shared
        expect(result.projects[1]?.tasks[1]).toBe(siblingTask); // sibling task shared
        expect(result.projects[1]?.tasks[0]).not.toBe(leaf);
    });

    it('covers not found: projects unchanged (same instances)', () => {
        const leaf: Task = { id: 't0', name: 't0', subtasks: [], isDone: false };
        const a: Project = { id: 'a', name: 'a', tasks: [leaf] };
        const plan: WeekPlan = { weekStart: '2026-07-06', projects: [a] };
        const result = toggleTask(plan, 'nope');
        expect(isValidPlan(result)).toBe(true);

        expect(result.projects[0]).toBe(a);
    });

    it('covers leaf: does not mutate the input plan', () => {
        const leaf: Task = { id: 't0', name: 't0', subtasks: [], isDone: false };
        const a: Project = { id: 'a', name: 'a', tasks: [leaf] };
        const plan: WeekPlan = { weekStart: '2026-07-06', projects: [a] };
        const result = toggleTask(plan, 't0');
        expect(isValidPlan(result)).toBe(true);

        expect(plan.projects[0]?.tasks[0]?.isDone).toBe(false);
    });
});

describe('isTaskDone', () => {
    /**
     * Testing strategy (precondition: a valid task):
     *   - leaf (no subtasks): isDone true | false
     *   - parent (has subtasks), done-set: all done | some done | none done
     *   ('some done' is the case that separates every(...) from a buggy some(...))
     */

    it('leaf with isDone true is done', () => {
        expect(isTaskDone({ ...makeTask('t'), isDone: true })).toBe(true);
    });
    it('leaf with isDone false is not done', () => {
        expect(isTaskDone(makeTask('t'))).toBe(false); // makeTask -> isDone: false
    });
    it('parent with all subtasks done is done', () => {
        const task: Task = {
            id: 't', name: 't',
            subtasks: [
                { ...makeSubtask('s0', 'mon'), isDone: true },
                { ...makeSubtask('s1', 'tue'), isDone: true },
            ],
        };
        expect(isTaskDone(task)).toBe(true);
    });
    it('parent with some subtasks done is not done', () => {
        const task: Task = {
            id: 't', name: 't',
            subtasks: [
                { ...makeSubtask('s0', 'mon'), isDone: true },
                makeSubtask('s1', 'tue'), // isDone: false
            ],
        };
        expect(isTaskDone(task)).toBe(false);
    });
    it('parent with no subtasks done is not done', () => {
        const task: Task = {
            id: 't', name: 't',
            subtasks: [makeSubtask('s0', 'mon'), makeSubtask('s1', 'tue')], // both false
        };
        expect(isTaskDone(task)).toBe(false);
    });
});

describe('isValidSubtask', () => {
    /**
     * Testing strategy:
     *   - partition on weight: 1 | 2 | 3 | outside {below (0), above (4), non-integer (2.5)}
     *   - partition on missedDays vs assignedDay: empty | non-empty valid
     *       | contains a duplicate | contains assignedDay
     *   Each axis is varied while the other is held valid.
     */

    // weight axis (missedDays empty, assignedDay 'mon')
    it('weight 1 is valid', () => {
        expect(isValidSubtask(makeSubtask('s', 'mon'))).toBe(true);
    });
    it('weight 2 is valid', () => {
        expect(isValidSubtask({ ...makeSubtask('s', 'mon'), weight: 2 })).toBe(true);
    });
    it('weight 3 is valid', () => {
        expect(isValidSubtask({ ...makeSubtask('s', 'mon'), weight: 3 })).toBe(true);
    });
    it('weight below range (0) is invalid', () => {
        expect(isValidSubtask({ ...makeSubtask('s', 'mon'), weight: 0 })).toBe(false);
    });
    it('weight above range (4) is invalid', () => {
        expect(isValidSubtask({ ...makeSubtask('s', 'mon'), weight: 4 })).toBe(false);
    });
    it('non-integer weight (2.5) is invalid', () => {
        expect(isValidSubtask({ ...makeSubtask('s', 'mon'), weight: 2.5 })).toBe(false);
    });

    // missedDays / assignedDay axis (weight held at 1)
    it('empty missedDays is valid', () => {
        expect(isValidSubtask({ ...makeSubtask('s', 'mon'), missedDays: [] })).toBe(true);
    });
    it('non-empty missedDays excluding assignedDay, no duplicates, is valid', () => {
        expect(isValidSubtask({ ...makeSubtask('s', 'mon'), missedDays: ['tue', 'wed'] })).toBe(true);
    });
    it('duplicate day in missedDays is invalid', () => {
        expect(isValidSubtask({ ...makeSubtask('s', 'mon'), missedDays: ['tue', 'tue'] })).toBe(false);
    });
    it('assignedDay appearing in missedDays is invalid', () => {
        expect(isValidSubtask({ ...makeSubtask('s', 'mon'), missedDays: ['mon'] })).toBe(false);
    });
});

describe('isValidTask', () => {
    /**
     * Testing strategy: the isDone shape is coupled to subtask presence, so cases
     * are the leaf/parent x isDone-form truth table, plus one delegation case.
     *   1. leaf (no subtasks), isDone boolean      -> valid
     *   2. leaf, isDone undefined                  -> invalid
     *   3. parent (has subtasks), isDone undefined, subtask valid   -> valid
     *   4. parent, isDone boolean, subtask valid   -> invalid
     *   5. parent, isDone undefined, subtask invalid -> invalid (delegates to isValidSubtask)
     */

    it('leaf with boolean isDone is valid', () => {
        expect(isValidTask(makeTask('t'))).toBe(true); // makeTask -> { subtasks: [], isDone: false }
    });
    it('leaf with undefined isDone is invalid', () => {
        const task: Task = { id: 't', name: 't', subtasks: [] };
        expect(isValidTask(task)).toBe(false);
    });
    it('parent with undefined isDone and a valid subtask is valid', () => {
        const task: Task = { id: 't', name: 't', subtasks: [makeSubtask('s', 'mon')] };
        expect(isValidTask(task)).toBe(true);
    });
    it('parent that still stores a boolean isDone is invalid', () => {
        const task: Task = { id: 't', name: 't', subtasks: [makeSubtask('s', 'mon')], isDone: false };
        expect(isValidTask(task)).toBe(false);
    });
    it('parent containing an invalid subtask is invalid', () => {
        const badSub: Subtask = { ...makeSubtask('s', 'mon'), weight: 0 };
        const task: Task = { id: 't', name: 't', subtasks: [badSub] };
        expect(isValidTask(task)).toBe(false);
    });
});

describe('isValidProject', () => {
    /**
     * Testing strategy: partition on tasks:
     *   empty | all tasks valid | contains an invalid task
     */

    it('project with no tasks is valid', () => {
        expect(isValidProject(makeProject('p'))).toBe(true);
    });
    it('project whose tasks are all valid is valid', () => {
        const project: Project = { ...makeProject('p'), tasks: [makeTask('t1'), makeTask('t2')] };
        expect(isValidProject(project)).toBe(true);
    });
    it('project containing an invalid task is invalid', () => {
        const badTask: Task = { id: 't2', name: 't2', subtasks: [] }; // leaf missing boolean isDone
        const project: Project = { ...makeProject('p'), tasks: [makeTask('t1'), badTask] };
        expect(isValidProject(project)).toBe(false);
    });
});

describe('isValidPlan', () => {
    /**
     * Testing strategy:
     *   - partition on projects: empty | all valid | contains an invalid project
     *   - partition on ids: all unique | one duplicate pair, at each collision kind:
     *       project-project, project-task, project-subtask, task-subtask, subtask-subtask
     *   (the cross-level kinds guard against a per-level uniqueness check.)
     */

    // valid plan: ids p1, t1, s1, p2, t2 all distinct; t1 is a parent, t2 a leaf.
    const parentTask = (id: string, subs: Subtask[]): Task => ({ id, name: id, subtasks: subs });
    const validPlan: WeekPlan = {
        weekStart: '2026-07-06',
        projects: [
            { id: 'p1', name: 'p1', tasks: [parentTask('t1', [makeSubtask('s1', 'mon')])] },
            { id: 'p2', name: 'p2', tasks: [makeTask('t2')] },
        ],
    };

    it('empty plan (no projects) is valid', () => {
        expect(isValidPlan({ weekStart: '2026-07-06', projects: [] })).toBe(true);
    });
    it('all projects valid and all ids unique is valid', () => {
        expect(isValidPlan(validPlan)).toBe(true);
    });
    it('a plan containing an invalid project is invalid', () => {
        const badProject: Project = { id: 'p3', name: 'p3', tasks: [{ id: 't3', name: 't3', subtasks: [] }] }; // leaf missing isDone
        expect(isValidPlan({ ...validPlan, projects: [...validPlan.projects, badProject] })).toBe(false);
    });

    it('duplicate id across two projects is invalid', () => {
        const plan: WeekPlan = { weekStart: '2026-07-06', projects: [makeProject('dup'), makeProject('dup')] };
        expect(isValidPlan(plan)).toBe(false);
    });
    it('project id colliding with a task id is invalid', () => {
        const plan: WeekPlan = { weekStart: '2026-07-06', projects: [{ id: 'x', name: 'x', tasks: [makeTask('x')] }] };
        expect(isValidPlan(plan)).toBe(false);
    });
    it('project id colliding with a subtask id is invalid', () => {
        const plan: WeekPlan = {
            weekStart: '2026-07-06',
            projects: [{ id: 'x', name: 'x', tasks: [parentTask('t', [makeSubtask('x', 'mon')])] }],
        };
        expect(isValidPlan(plan)).toBe(false);
    });
    it('task id colliding with a subtask id is invalid', () => {
        const plan: WeekPlan = {
            weekStart: '2026-07-06',
            projects: [{ id: 'p', name: 'p', tasks: [parentTask('t', [makeSubtask('t', 'mon')])] }],
        };
        expect(isValidPlan(plan)).toBe(false);
    });
    it('duplicate id across two subtasks is invalid', () => {
        const plan: WeekPlan = {
            weekStart: '2026-07-06',
            projects: [{ id: 'p', name: 'p', tasks: [parentTask('t', [makeSubtask('s', 'mon'), makeSubtask('s', 'tue')])] }],
        };
        expect(isValidPlan(plan)).toBe(false);
    });
    it('a plan whose weekStart is not a Monday is invalid', () => {
        expect(isValidPlan({ weekStart: '2026-07-07', projects: [] })).toBe(false); // Tuesday
    });
    it('a plan whose weekStart is malformed is invalid', () => {
        expect(isValidPlan({ weekStart: '2026-7-6', projects: [] })).toBe(false); // unpadded
    });
});
