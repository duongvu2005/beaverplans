import { useState } from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WeekBoard } from '@/components/week/WeekBoard';
import type { Project, Task, WeekPlan } from '@/core/types';

describe('tree keyboard editing', () => {
    /*
     * Testing strategy — treeKeys.test.ts already covers which key means what.
     * What is left is the wiring the pure function cannot see: that an action
     * reaches the right producer, and that focus lands on the row a creation
     * made. These run against a REAL WeekBoard holding real state, not the
     * mock-onChange harness WeekBoard.test.tsx uses: a mock never re-renders,
     * so the new row never mounts and focus has nowhere to go.
     *
     *   partition on the creating key: Enter from a task | Enter from a project
     *       | mod+Enter | the "+ add task" button (no key at all)
     *   partition on insert position: mid-list (a sibling after the row) | end
     *   partition on the removed row's children: none (goes at once) | some (a
     *       confirm first)
     *   partition on arrow direction: up (lands at the start) | down (at the end)
     *   partition on what the arrow crosses: within a project | across projects
     */

    function task(id: string, name: string): Task {
        return { id, name, subtasks: [], isDone: false };
    }

    function project(id: string, name: string, tasks: Task[] = []): Project {
        return { id, name, tasks };
    }

    // State really applies, so a created row mounts and can be focused.
    function Harness({ initial }: { initial: WeekPlan }) {
        const [plan, setPlan] = useState(initial);
        return <WeekBoard plan={plan} onChange={setPlan} onSkipGuide={() => {}} />;
    }

    function board(projects: Project[]) {
        render(<Harness initial={{ weekStart: '2026-08-10', ended: false, projects }} />);
        return userEvent.setup();
    }

    function tree() {
        return within(document.querySelector('.projectView') as HTMLElement);
    }

    function taskNames(): HTMLInputElement[] {
        return tree().getAllByPlaceholderText('Task…') as HTMLInputElement[];
    }

    function projectNames(): HTMLInputElement[] {
        return tree().getAllByPlaceholderText('Project name…') as HTMLInputElement[];
    }

    /** Focus a field and put the caret where the arrow keys read it from. */
    async function caretIn(
        user: ReturnType<typeof userEvent.setup>,
        field: HTMLInputElement,
        at: number,
    ) {
        await user.click(field);
        field.setSelectionRange(at, at);
    }

    it('Enter on a named task inserts a sibling directly after it and focuses it', async () => {
        const user = board([project('p1', 'English', [task('t1', 'Draft'), task('t2', 'Revise')])]);

        await user.click(taskNames()[0]!);
        await user.keyboard('{Enter}');

        const names = taskNames();
        expect(names.map((el) => el.value)).toEqual(['Draft', '', 'Revise']);
        expect(document.activeElement).toBe(names[1]);
    });

    it('Enter on a named project appends to the end of its tasks and focuses it', async () => {
        const user = board([project('p1', 'English', [task('t1', 'Draft'), task('t2', 'Revise')])]);

        await user.click(projectNames()[0]!);
        await user.keyboard('{Enter}');

        const names = taskNames();
        expect(names.map((el) => el.value)).toEqual(['Draft', 'Revise', '']);
        expect(document.activeElement).toBe(names[2]);
    });

    it('Enter in the empty row it just made adds another below it', async () => {
        const user = board([project('p1', 'English', [task('t1', 'Draft')])]);

        await user.click(taskNames()[0]!);
        await user.keyboard('{Enter}');
        expect(taskNames()).toHaveLength(2);

        await user.keyboard('{Enter}');
        const names = taskNames();
        expect(names.map((el) => el.value)).toEqual(['Draft', '', '']);
        expect(document.activeElement).toBe(names[2]);
    });

    it('mod+Enter adds a project at the bottom and focuses it, from anywhere in the tree', async () => {
        const user = board([project('p1', 'English', [task('t1', 'Draft')])]);

        await user.click(taskNames()[0]!);
        await user.keyboard('{Meta>}{Enter}{/Meta}');

        const names = projectNames();
        expect(names.map((el) => el.value)).toEqual(['English', '']);
        expect(document.activeElement).toBe(names[1]);
    });

    it('the "+ add task" button focuses the row it makes, same as Enter does', async () => {
        const user = board([project('p1', 'English')]);

        await user.click(tree().getByRole('button', { name: /add task/i }));

        const names = taskNames();
        expect(names).toHaveLength(1);
        expect(document.activeElement).toBe(names[0]);
    });

    it('mod+shift+Backspace removes a named task with no subtasks, without asking', async () => {
        const user = board([project('p1', 'English', [task('t1', 'Draft'), task('t2', 'Revise')])]);

        await user.click(taskNames()[0]!);
        await user.keyboard('{Meta>}{Shift>}{Backspace}{/Shift}{/Meta}');

        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        expect(taskNames().map((el) => el.value)).toEqual(['Revise']);
    });

    it('mod+shift+Backspace on a project holding tasks asks first', async () => {
        const user = board([project('p1', 'English', [task('t1', 'Draft')])]);

        await user.click(projectNames()[0]!);
        await user.keyboard('{Meta>}{Shift>}{Backspace}{/Shift}{/Meta}');

        expect(screen.getByRole('dialog')).toBeInTheDocument();
        expect(projectNames()).toHaveLength(1); // nothing gone until confirmed
    });

    it('plain Backspace edits the text and never removes the row', async () => {
        const user = board([project('p1', 'English', [task('t1', 'Draft')])]);

        const field = taskNames()[0]!;
        await caretIn(user, field, 'Draft'.length);
        await user.keyboard('{Backspace}{Backspace}{Backspace}{Backspace}{Backspace}{Backspace}');

        expect(taskNames().map((el) => el.value)).toEqual(['']);
    });

    it('ArrowDown at the end of a task name crosses into the next project', async () => {
        const user = board([
            project('p1', 'English', [task('t1', 'Draft')]),
            project('p2', 'Maths'),
        ]);

        const field = taskNames()[0]!;
        await caretIn(user, field, 'Draft'.length);
        await user.keyboard('{ArrowDown}');

        const target = projectNames()[1]!;
        expect(document.activeElement).toBe(target);
        expect(target.selectionStart).toBe('Maths'.length);
    });

    it('ArrowUp at the start of a project name crosses into the task above', async () => {
        const user = board([
            project('p1', 'English', [task('t1', 'Draft')]),
            project('p2', 'Maths'),
        ]);

        await caretIn(user, projectNames()[1]!, 0);
        await user.keyboard('{ArrowUp}');

        const target = taskNames()[0]!;
        expect(document.activeElement).toBe(target);
        expect(target.selectionStart).toBe(0);
    });

    it('an arrow away from the boundary stays in the field', async () => {
        const user = board([
            project('p1', 'English', [task('t1', 'Draft')]),
            project('p2', 'Maths'),
        ]);

        const field = taskNames()[0]!;
        await caretIn(user, field, 2);
        await user.keyboard('{ArrowDown}');

        expect(document.activeElement).toBe(field);
    });

    it('Escape leaves the field with the text intact', async () => {
        const user = board([project('p1', 'English', [task('t1', 'Draft')])]);

        const field = taskNames()[0]!;
        await user.click(field);
        await user.keyboard('{Escape}');

        expect(document.activeElement).not.toBe(field);
        expect(taskNames()[0]!.value).toBe('Draft');
    });
});
