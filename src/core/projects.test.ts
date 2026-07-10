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

// A minimal valid project for building starting plans.
function makeProject(id: string): Project {
    return { id, name: id, tasks: [] };
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
