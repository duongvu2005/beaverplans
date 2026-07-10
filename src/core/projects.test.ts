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
