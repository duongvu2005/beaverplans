import { describe, it, expect } from 'vitest';
import { welcomeCue, welcomeStep } from './welcome';
import type { Project, Subtask, Task } from './types';

function subtask(id: string): Subtask {
    return { id, isDone: false, assignedDay: 'wed', missedDays: [], weight: 1 };
}

function task(id: string, name: string, subtasks: Subtask[] = []): Task {
    return { id, name, subtasks, ...(subtasks.length === 0 ? { isDone: false } : {}) };
}

function project(id: string, name: string, tasks: Task[] = []): Project {
    return { id, name, tasks };
}

describe('welcomeStep', () => {
    /*
     * Testing strategy
     *
     * partition on whether any subtask exists:
     *   none anywhere (the guide runs); one somewhere (the guide is over)
     * partition on named projects:
     *   no project at all; a project whose name is empty; a project whose name
     *       is whitespace only; a named project
     * partition on named tasks (given a named project):
     *   no task at all; a task whose name is empty; a task whose name is
     *       whitespace only; a named task
     * partition on the two gates disagreeing:
     *   a named task sitting under an UNNAMED project (still 'project')
     * partition on the target carried back:
     *   'task' names the FIRST named project, skipping an unnamed one before it;
     *   'days' names the FIRST named task, skipping an unnamed one before it
     * partition on a row already made but not yet named (`unnamed`):
     *   none | one waiting | one waiting under a DIFFERENT project than the step
     *       is about
     * boundary: the empty project list
     */

    it('covers the empty project list', () => {
        expect(welcomeStep([])).toEqual({ step: 'project' });
    });

    it('covers a project that exists but is unnamed', () => {
        expect(welcomeStep([project('p1', '')])).toEqual({ step: 'project', unnamed: 'p1' });
    });

    it('covers a project named with whitespace only', () => {
        expect(welcomeStep([project('p1', '   ')])).toEqual({ step: 'project', unnamed: 'p1' });
    });

    it('covers a named task under an unnamed project: still the project step', () => {
        expect(welcomeStep([project('p1', '', [task('t1', 'read chapter 3')])])).toEqual({
            step: 'project',
            unnamed: 'p1',
        });
    });

    it('covers a named project with no task at all', () => {
        expect(welcomeStep([project('p1', 'Linear Algebra')])).toEqual({
            step: 'task',
            projectId: 'p1',
            projectName: 'Linear Algebra',
        });
    });

    it('covers a named project whose only task is unnamed', () => {
        expect(welcomeStep([project('p1', 'Linear Algebra', [task('t1', '')])])).toEqual({
            step: 'task',
            projectId: 'p1',
            projectName: 'Linear Algebra',
            unnamed: 't1',
        });
    });

    it('covers a task named with whitespace only', () => {
        expect(welcomeStep([project('p1', 'Linear Algebra', [task('t1', ' ')])])).toEqual({
            step: 'task',
            projectId: 'p1',
            projectName: 'Linear Algebra',
            unnamed: 't1',
        });
    });

    it('covers the task step naming the first NAMED project, not the first', () => {
        expect(welcomeStep([project('p1', ' '), project('p2', 'Linear Algebra')])).toEqual({
            step: 'task',
            projectId: 'p2',
            projectName: 'Linear Algebra',
        });
    });

    it('covers a named project and a named task with nothing scheduled', () => {
        expect(welcomeStep([project('p1', 'Linear Algebra', [task('t1', 'read ch 3')])])).toEqual({
            step: 'days',
            taskId: 't1',
        });
    });

    it('covers the days step naming the first NAMED task, not the first', () => {
        const projects = [
            project('p1', 'Linear Algebra', [task('t1', ''), task('t2', 'read ch 3')]),
        ];
        expect(welcomeStep(projects)).toEqual({ step: 'days', taskId: 't2' });
    });

    it('covers one subtask anywhere ending the guide', () => {
        const projects = [
            project('p1', 'Linear Algebra', [task('t1', 'read ch 3', [subtask('s1')])]),
        ];
        expect(welcomeStep(projects)).toBeUndefined();
    });

    it('covers a scheduled subtask under an unnamed project still ending the guide', () => {
        const projects = [project('p1', '', [task('t1', '', [subtask('s1')])])];
        expect(welcomeStep(projects)).toBeUndefined();
    });

    it('covers nothing made yet: no row is waiting', () => {
        expect(welcomeStep([])).toEqual({ step: 'project', unnamed: undefined });
    });

    it('covers a blank task under a different project than the step is about', () => {
        const projects = [
            project('p1', 'Linear Algebra', []),
            project('p2', 'English', [task('t1', '')]),
        ];
        expect(welcomeStep(projects)).toEqual({
            step: 'task',
            projectId: 'p1',
            projectName: 'Linear Algebra',
            unnamed: undefined,
        });
    });

    it('covers two blank projects: the first is the one waiting', () => {
        expect(welcomeStep([project('p1', ''), project('p2', '')])).toEqual({
            step: 'project',
            unnamed: 'p1',
        });
    });
});

describe('welcomeStep, editingId', () => {
    /*
     * Testing strategy
     *
     * partition on whether editingId names a row that exists:
     *   no such row; the project the step is about; the task the step is about
     * partition on that row's name:
     *   blank (no change — it was not counting anyway); named (held back)
     * partition on which gate is held:
     *   a named project being typed in holds 'project'; a named task being typed
     *       in holds 'task'
     * partition on reach: editing one row must not blank a sibling
     */

    it('covers an id matching nothing: the same answer as no id at all', () => {
        const projects = [project('p1', 'Linear Algebra')];
        expect(welcomeStep(projects, 'nope')).toEqual(welcomeStep(projects));
    });

    it('covers a named project still being typed in: still the project step', () => {
        expect(welcomeStep([project('p1', 'Linear Algebra')], 'p1')).toEqual({
            step: 'project',
            unnamed: 'p1',
        });
    });

    it('covers a named task still being typed in: still the task step', () => {
        const projects = [project('p1', 'Linear Algebra', [task('t1', 'read chapter 3')])];
        expect(welcomeStep(projects, 't1')).toEqual({
            step: 'task',
            projectId: 'p1',
            projectName: 'Linear Algebra',
            unnamed: 't1',
        });
    });

    it('covers editing a blank row changing nothing', () => {
        const projects = [project('p1', '')];
        expect(welcomeStep(projects, 'p1')).toEqual(welcomeStep(projects));
    });

    it('covers a second named project still counting while the first is edited', () => {
        expect(
            welcomeStep([project('p1', 'Linear Algebra'), project('p2', 'English')], 'p1'),
        ).toEqual({
            step: 'task',
            projectId: 'p2',
            projectName: 'English',
            unnamed: undefined,
        });
    });

    it('covers a scheduled subtask still ending the guide while a name is edited', () => {
        const projects = [project('p1', 'Linear Algebra', [task('t1', 'read', [subtask('s1')])])];
        expect(welcomeStep(projects, 'p1')).toBeUndefined();
    });
});

describe('welcomeCue', () => {
    /*
     * Testing strategy
     *
     * partition on step: project | task | days
     * partition on `unnamed` (project and task steps only):
     *   absent (point at the control that MAKES a row)
     *   present (point at that row's own name field instead)
     */

    it('covers the project step with nothing made: the add-project button', () => {
        expect(welcomeCue({ step: 'project', unnamed: undefined })).toEqual({ kind: 'addProject' });
    });

    it('covers the project step with a blank row waiting: that row s name', () => {
        expect(welcomeCue({ step: 'project', unnamed: 'p1' })).toEqual({
            kind: 'projectName',
            projectId: 'p1',
        });
    });

    it('covers the task step with nothing made: the add-task button of that project', () => {
        expect(
            welcomeCue({
                step: 'task',
                projectId: 'p1',
                projectName: 'Linear Algebra',
                unnamed: undefined,
            }),
        ).toEqual({ kind: 'addTask', projectId: 'p1' });
    });

    it('covers the task step with a blank row waiting: that row s name', () => {
        expect(
            welcomeCue({
                step: 'task',
                projectId: 'p1',
                projectName: 'Linear Algebra',
                unnamed: 't1',
            }),
        ).toEqual({ kind: 'taskName', taskId: 't1' });
    });

    it('covers the days step: the editor button of the task it names', () => {
        expect(welcomeCue({ step: 'days', taskId: 't1' })).toEqual({
            kind: 'editTask',
            taskId: 't1',
        });
    });
});
