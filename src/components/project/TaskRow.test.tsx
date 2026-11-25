import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TaskRow, TaskRowPreview } from './TaskRow';
import { inertTreeKeys } from '@/test/treeKeys';
import type { Task } from '@/core/types';
import styles from './TaskRow.module.css';
import { en } from '@/i18n/en';

describe('TaskRow', () => {
    /*
     * Testing strategy
     *     partition on task shape: undated (no subtasks: checkbox reflects
     *         task.isDone directly, "assign days" hint shown, no PointsStat)
     *         | dated (has subtasks: checkbox reflects isTaskDone = every
     *         subtask done, PointsStat shown)
     *     partition on isTaskDone (dated case): true (all subtasks done)
     *         | false (some undone)
     *     partition on task.deadline: absent (no caption line) | a valid
     *         date-only value | a valid date-time | a stored value that no
     *         longer parses (imported or synced from elsewhere)
     *     partition on the tone the caption is given: quiet | live | urgent.
     *         deadlineTone decides it and is tested in core; what is tested here
     *         is that the row hands it the right arguments.
     *     interaction: typing the name field -> onRenameTask(id, value);
     *         toggling the checkbox -> onToggleTask(id); Edit button ->
     *         onEditTask(id); delete (×) button -> onRemoveTask(id)
     */

    function makeTask(overrides: Partial<Task> = {}): Task {
        return {
            id: 't1',
            name: 'Draft essay',
            subtasks: [],
            ...overrides,
        };
    }

    // Viewed week Mon 2026-08-10 .. Sun 2026-08-16, today the Wednesday.
    const WEEK = '2026-08-10';
    const TODAY = '2026-08-12';
    const noop = () => {};

    it('covers an undated task: shows "assign days", no PointsStat, checkbox reflects task.isDone', () => {
        render(
            <TaskRow
                task={makeTask({ isDone: true })}
                projectId="p1"
                weekStart={WEEK}
                today={TODAY}
                frozen={false}
                onEditTask={noop}
                onToggleTask={noop}
                onRenameTask={noop}
                onRemoveTask={noop}
                treeKeys={inertTreeKeys()}
            />,
        );
        expect(screen.getByText(en.taskRow.assignDays)).toBeInTheDocument();
        expect(screen.queryByText(/\//)).not.toBeInTheDocument();
        expect(screen.getByRole('checkbox')).toBeChecked();
    });

    it('covers the checkbox name: named by the task it ticks off', () => {
        render(
            <TaskRow
                task={makeTask()}
                projectId="p1"
                weekStart={WEEK}
                today={TODAY}
                frozen={false}
                onEditTask={noop}
                onToggleTask={noop}
                onRenameTask={noop}
                onRemoveTask={noop}
                treeKeys={inertTreeKeys()}
            />,
        );
        // The name lives in a sibling input, not a label, so nothing named this.
        expect(screen.getByRole('checkbox', { name: 'Draft essay' })).toBeInTheDocument();
    });

    it('covers the assign-days hint: a readout, not a control', () => {
        render(
            <TaskRow
                task={makeTask()}
                projectId="p1"
                weekStart={WEEK}
                today={TODAY}
                frozen={false}
                onEditTask={noop}
                onToggleTask={noop}
                onRenameTask={noop}
                onRemoveTask={noop}
                treeKeys={inertTreeKeys()}
            />,
        );
        // A signpost, not a control: the → points at the Edit button beside it,
        // which is the real way in.
        expect(screen.getByText(en.taskRow.assignDays).closest('button')).toBeNull();
        // The grip is a span dnd-kit gives role="button"; the hint is not among them.
        expect(screen.getAllByRole('button').map((b) => b.getAttribute('aria-label'))).toEqual([
            'Drag to reorder task',
            'Edit task',
            'Delete task',
        ]);
    });

    it('covers a dated task with every subtask done: checkbox checked, PointsStat shown', () => {
        const task = makeTask({
            subtasks: [
                { id: 's1', isDone: true, assignedDay: 'mon', missedDays: [], weight: 1 },
                { id: 's2', isDone: true, assignedDay: 'tue', missedDays: [], weight: 2 },
            ],
        });
        render(
            <TaskRow
                task={task}
                projectId="p1"
                weekStart={WEEK}
                today={TODAY}
                frozen={false}
                onEditTask={noop}
                onToggleTask={noop}
                onRenameTask={noop}
                onRemoveTask={noop}
                treeKeys={inertTreeKeys()}
            />,
        );
        expect(screen.getByRole('checkbox')).toBeChecked();
        expect(screen.getByText('3/3')).toBeInTheDocument();
    });

    it('covers a dated task with some subtasks undone: checkbox unchecked', () => {
        const task = makeTask({
            subtasks: [
                { id: 's1', isDone: true, assignedDay: 'mon', missedDays: [], weight: 1 },
                { id: 's2', isDone: false, assignedDay: 'tue', missedDays: [], weight: 2 },
            ],
        });
        render(
            <TaskRow
                task={task}
                projectId="p1"
                weekStart={WEEK}
                today={TODAY}
                frozen={false}
                onEditTask={noop}
                onToggleTask={noop}
                onRenameTask={noop}
                onRemoveTask={noop}
                treeKeys={inertTreeKeys()}
            />,
        );
        expect(screen.getByRole('checkbox')).not.toBeChecked();
        expect(screen.getByText('1/3')).toBeInTheDocument();
    });

    it('covers typing a new name: calls onRenameTask(id, value)', async () => {
        const user = userEvent.setup();
        const onRenameTask = vi.fn();
        render(
            <TaskRow
                task={makeTask()}
                projectId="p1"
                weekStart={WEEK}
                today={TODAY}
                frozen={false}
                onEditTask={noop}
                onToggleTask={noop}
                onRenameTask={onRenameTask}
                onRemoveTask={noop}
                treeKeys={inertTreeKeys()}
            />,
        );

        await user.type(screen.getByPlaceholderText(en.taskRow.namePlaceholder), 'X');

        expect(onRenameTask).toHaveBeenCalledWith('t1', 'Draft essayX');
    });

    it('covers clicking the checkbox: calls onToggleTask(id)', async () => {
        const user = userEvent.setup();
        const onToggleTask = vi.fn();
        render(
            <TaskRow
                task={makeTask()}
                projectId="p1"
                weekStart={WEEK}
                today={TODAY}
                frozen={false}
                onEditTask={noop}
                onToggleTask={onToggleTask}
                onRenameTask={noop}
                onRemoveTask={noop}
                treeKeys={inertTreeKeys()}
            />,
        );

        await user.click(screen.getByRole('checkbox'));

        expect(onToggleTask).toHaveBeenCalledWith('t1');
    });

    it('covers clicking Edit: calls onEditTask(id)', async () => {
        const user = userEvent.setup();
        const onEditTask = vi.fn();
        render(
            <TaskRow
                task={makeTask()}
                projectId="p1"
                weekStart={WEEK}
                today={TODAY}
                frozen={false}
                onEditTask={onEditTask}
                onToggleTask={noop}
                onRenameTask={noop}
                onRemoveTask={noop}
                treeKeys={inertTreeKeys()}
            />,
        );

        await user.click(screen.getByRole('button', { name: en.taskRow.editTask }));

        expect(onEditTask).toHaveBeenCalledWith('t1');
    });

    it('covers clicking delete: calls onRemoveTask(id)', async () => {
        const user = userEvent.setup();
        const onRemoveTask = vi.fn();
        render(
            <TaskRow
                task={makeTask()}
                projectId="p1"
                weekStart={WEEK}
                today={TODAY}
                frozen={false}
                onEditTask={noop}
                onToggleTask={noop}
                onRenameTask={noop}
                onRemoveTask={onRemoveTask}
                treeKeys={inertTreeKeys()}
            />,
        );

        await user.click(screen.getByRole('button', { name: en.taskRow.deleteTask }));

        expect(onRemoveTask).toHaveBeenCalledWith('t1');
    });

    it('covers no deadline: no caption line under the name', () => {
        render(
            <TaskRow
                task={makeTask()}
                projectId="p1"
                weekStart={WEEK}
                today={TODAY}
                frozen={false}
                onEditTask={noop}
                onToggleTask={noop}
                onRenameTask={noop}
                onRemoveTask={noop}
                treeKeys={inertTreeKeys()}
            />,
        );
        expect(screen.queryByText(/Aug/)).not.toBeInTheDocument();
    });

    it('covers a date-only deadline: caption shows the day, not the 23:59 it resolves to', () => {
        render(
            <TaskRow
                task={makeTask({ deadline: '2026-08-20' })}
                projectId="p1"
                weekStart={WEEK}
                today={TODAY}
                frozen={false}
                onEditTask={noop}
                onToggleTask={noop}
                onRenameTask={noop}
                onRemoveTask={noop}
                treeKeys={inertTreeKeys()}
            />,
        );
        expect(screen.getByText('Thu Aug 20')).toBeInTheDocument();
    });

    it('covers a date-time deadline: caption shows the time too', () => {
        render(
            <TaskRow
                task={makeTask({ deadline: '2026-08-20T14:30' })}
                projectId="p1"
                weekStart={WEEK}
                today={TODAY}
                frozen={false}
                onEditTask={noop}
                onToggleTask={noop}
                onRenameTask={noop}
                onRemoveTask={noop}
                treeKeys={inertTreeKeys()}
            />,
        );
        expect(screen.getByText('Thu Aug 20 · 14:30')).toBeInTheDocument();
    });

    it('covers a stored deadline that no longer parses: nothing rendered, no crash', () => {
        render(
            <TaskRow
                task={makeTask({ deadline: 'whenever' })}
                projectId="p1"
                weekStart={WEEK}
                today={TODAY}
                frozen={false}
                onEditTask={noop}
                onToggleTask={noop}
                onRenameTask={noop}
                onRemoveTask={noop}
                treeKeys={inertTreeKeys()}
            />,
        );
        expect(screen.queryByText(/whenever/)).not.toBeInTheDocument();
        expect(screen.getByDisplayValue('Draft essay')).toBeInTheDocument();
    });
    // A CSS-module key is typed string | undefined, so asserting on one directly
    // would quietly pass against undefined once the class was renamed.
    function rung(name: 'quiet' | 'live' | 'urgent'): string {
        const value = styles[name];
        if (value === undefined) throw new Error(`TaskRow.module.css has no .${name}`);
        return value;
    }

    function renderWith(task: Task, over: Record<string, unknown> = {}) {
        render(
            <TaskRow
                task={task}
                projectId="p1"
                weekStart={WEEK}
                today={TODAY}
                frozen={false}
                onEditTask={noop}
                onToggleTask={noop}
                onRenameTask={noop}
                onRemoveTask={noop}
                treeKeys={inertTreeKeys()}
                {...over}
            />,
        );
        return screen.getByText(/AUG|SEP/i);
    }

    it('covers a deadline already past: urgent', () => {
        expect(renderWith(makeTask({ deadline: '2026-08-11' }))).toHaveClass(rung('urgent'));
    });

    it('covers a deadline later in the viewed week: live', () => {
        expect(renderWith(makeTask({ deadline: '2026-08-14' }))).toHaveClass(rung('live'));
    });

    it('covers a deadline past the viewed week: quiet', () => {
        expect(renderWith(makeTask({ deadline: '2026-09-14' }))).toHaveClass(rung('quiet'));
    });

    it('covers isDone reaching the tone: a finished overdue task is quiet', () => {
        const done = makeTask({ deadline: '2026-08-11', isDone: true });
        expect(renderWith(done)).toHaveClass(rung('quiet'));
    });

    it('covers frozen reaching the tone: an overdue task in an ended week is quiet', () => {
        const task = makeTask({ deadline: '2026-08-11' });
        expect(renderWith(task, { frozen: true })).toHaveClass(rung('quiet'));
    });
});

describe('TaskRowPreview', () => {
    /*
     * Testing strategy
     *
     * The preview is the floating clone shown while a row is dragged, and is
     * only ever in the DOM mid-drag, which no test can reach. What is pinned
     * here is that the clone and the row it stands in for render the SAME
     * markup, by rendering both and diffing them.
     *
     * partition on what is compared: rendered shape | readouts the shape cannot
     *     see (a controlled input's value is a property, not an attribute) |
     *     inertness
     * partition on task shape: undated (assign-days hint, no PointsStat)
     *     | dated (PointsStat)
     * partition on task.deadline: absent (one line) | present (two lines, toned)
     */

    // The only attributes the live row may have and the clone may not: dnd-kit's
    // handle wiring, the transform it animates, and the readOnly standing in for
    // the callbacks. Anything else differing means the two have drifted.
    const DRAG_ONLY = [
        'style',
        'readonly',
        'role',
        'tabindex',
        'aria-disabled',
        'aria-roledescription',
        'aria-describedby',
    ];

    /** The clone's one sanctioned difference: the class turning hover state on. */
    function grabbedClass(): string {
        const value = styles.grabbed;
        if (value === undefined) throw new Error('TaskRow.module.css has no .grabbed');
        return value;
    }

    function shapeOf(root: HTMLElement): string {
        const clone = root.cloneNode(true);
        if (!(clone instanceof HTMLElement)) throw new Error('not an element');
        for (const node of [clone, ...clone.querySelectorAll('*')]) {
            for (const attribute of DRAG_ONLY) node.removeAttribute(attribute);
            node.classList.remove(grabbedClass());
        }
        return clone.outerHTML;
    }

    function rendered(container: HTMLElement): HTMLElement {
        const node = container.firstElementChild;
        if (!(node instanceof HTMLElement)) throw new Error('nothing rendered');
        return node;
    }

    function makeTask(overrides: Partial<Task> = {}): Task {
        return { id: 't1', name: 'Draft essay', subtasks: [], ...overrides };
    }

    const WEEK = '2026-08-10';
    const TODAY = '2026-08-12';
    const noop = () => {};

    /** The same task through both components, as comparable markup. */
    function shapes(task: Task): { row: string; preview: string } {
        const live = render(
            <TaskRow
                task={task}
                projectId="p1"
                weekStart={WEEK}
                today={TODAY}
                frozen={false}
                onEditTask={noop}
                onToggleTask={noop}
                onRenameTask={noop}
                onRemoveTask={noop}
                treeKeys={inertTreeKeys()}
            />,
        );
        const row = shapeOf(rendered(live.container));
        live.unmount();

        const clone = render(
            <TaskRowPreview task={task} weekStart={WEEK} today={TODAY} frozen={false} grabbed />,
        );
        return { row, preview: shapeOf(rendered(clone.container)) };
    }

    it('covers a dated task with a deadline: the clone renders the row it stands in for', () => {
        const task = makeTask({
            deadline: '2026-08-14',
            subtasks: [
                { id: 's1', isDone: true, assignedDay: 'mon', missedDays: [], weight: 1 },
                { id: 's2', isDone: false, assignedDay: 'tue', missedDays: [], weight: 2 },
            ],
        });
        const { row, preview } = shapes(task);
        expect(preview).toBe(row);
    });

    it('covers an undated task with no deadline: same shape, assign-days hint and all', () => {
        const { row, preview } = shapes(makeTask());
        expect(preview).toBe(row);
    });

    it('covers the readouts a shape comparison cannot see: name and caption', () => {
        render(
            <TaskRowPreview
                task={makeTask({ deadline: '2026-08-14' })}
                weekStart={WEEK}
                today={TODAY}
                frozen={false}
                grabbed
            />,
        );
        expect(screen.getByDisplayValue('Draft essay')).toBeInTheDocument();
        expect(screen.getByText(/AUG/i)).toBeInTheDocument();
    });

    // shapeOf strips the grabbed class, so without this the class could vanish
    // and every comparison above would still pass.
    it('covers grabbed: the row the pointer picked up is marked hovered', () => {
        const { container } = render(
            <TaskRowPreview
                task={makeTask()}
                weekStart={WEEK}
                today={TODAY}
                frozen={false}
                grabbed
            />,
        );
        expect(rendered(container)).toHaveClass(grabbedClass());
    });

    it('covers carried: a row inside a dragged card is not marked hovered', () => {
        const { container } = render(
            <TaskRowPreview
                task={makeTask()}
                weekStart={WEEK}
                today={TODAY}
                frozen={false}
                grabbed={false}
            />,
        );
        expect(rendered(container)).not.toHaveClass(grabbedClass());
    });

    it('covers inertness: the clone carries no drag handle and takes no typing', () => {
        const { container } = render(
            <TaskRowPreview
                task={makeTask()}
                weekStart={WEEK}
                today={TODAY}
                frozen={false}
                grabbed
            />,
        );
        expect(container.querySelector('[aria-roledescription="sortable"]')).toBeNull();
        expect(screen.getByDisplayValue('Draft essay')).toHaveAttribute('readonly');
    });
});
