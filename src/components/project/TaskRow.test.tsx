import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TaskRow } from './TaskRow';
import type { Task } from '@/core/types';

describe('TaskRow', () => {
    /*
     * Testing strategy
     *     partition on task shape: undated (no subtasks: checkbox reflects
     *         task.isDone directly, "assign days" hint shown, no PointsStat)
     *         | dated (has subtasks: checkbox reflects isTaskDone = every
     *         subtask done, PointsStat shown)
     *     partition on isTaskDone (dated case): true (all subtasks done)
     *         | false (some undone)
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

    const noop = () => {};

    it('covers an undated task: shows "assign days", no PointsStat, checkbox reflects task.isDone', () => {
        render(
            <TaskRow
                task={makeTask({ isDone: true })}
                projectId="p1"
                onEditTask={noop}
                onToggleTask={noop}
                onRenameTask={noop}
                onRemoveTask={noop}
            />,
        );
        expect(screen.getByText('assign days')).toBeInTheDocument();
        expect(screen.queryByText(/\//)).not.toBeInTheDocument();
        expect(screen.getByRole('checkbox')).toBeChecked();
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
                onEditTask={noop}
                onToggleTask={noop}
                onRenameTask={noop}
                onRemoveTask={noop}
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
                onEditTask={noop}
                onToggleTask={noop}
                onRenameTask={noop}
                onRemoveTask={noop}
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
                onEditTask={noop}
                onToggleTask={noop}
                onRenameTask={onRenameTask}
                onRemoveTask={noop}
            />,
        );

        await user.type(screen.getByPlaceholderText('Task…'), 'X');

        expect(onRenameTask).toHaveBeenCalledWith('t1', 'Draft essayX');
    });

    it('covers clicking the checkbox: calls onToggleTask(id)', async () => {
        const user = userEvent.setup();
        const onToggleTask = vi.fn();
        render(
            <TaskRow
                task={makeTask()}
                projectId="p1"
                onEditTask={noop}
                onToggleTask={onToggleTask}
                onRenameTask={noop}
                onRemoveTask={noop}
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
                onEditTask={onEditTask}
                onToggleTask={noop}
                onRenameTask={noop}
                onRemoveTask={noop}
            />,
        );

        await user.click(screen.getByRole('button', { name: 'Edit task' }));

        expect(onEditTask).toHaveBeenCalledWith('t1');
    });

    it('covers clicking delete: calls onRemoveTask(id)', async () => {
        const user = userEvent.setup();
        const onRemoveTask = vi.fn();
        render(
            <TaskRow
                task={makeTask()}
                projectId="p1"
                onEditTask={noop}
                onToggleTask={noop}
                onRenameTask={noop}
                onRemoveTask={onRemoveTask}
            />,
        );

        await user.click(screen.getByRole('button', { name: 'Delete task' }));

        expect(onRemoveTask).toHaveBeenCalledWith('t1');
    });
});
