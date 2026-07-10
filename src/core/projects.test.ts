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