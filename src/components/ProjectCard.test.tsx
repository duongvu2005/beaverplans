import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ProjectCard } from './ProjectCard';
import type { Project } from '@/core/types';

describe('ProjectCard', () => {
    /*
     * Testing strategy
     *     partition on project.tasks: empty (no TaskRow, ProgressBar renders
     *         nothing) | nonempty (one TaskRow per task)
     *     ProgressBar wiring: reflects projectProgress(project) -- the math
     *         itself belongs to core/progress, already tested there
     *     interaction: typing the name field -> onRenameProject(id, value);
     *         deadline button -> onEditDeadline(id); delete button ->
     *         onRemoveProject(id); "add task" button -> onAddTask(id)
     */

    function makeProject(overrides: Partial<Project> = {}): Project {
        return {
            id: 'p1',
            name: 'English',
            tasks: [],
            ...overrides,
        };
    }

    const noop = () => {};
    function baseProps(overrides: Record<string, unknown> = {}) {
        return {
            project: makeProject(),
            onEditTask: noop,
            onEditDeadline: noop,
            onToggleTask: noop,
            onAddTask: noop,
            onRenameProject: noop,
            onRenameTask: noop,
            onRemoveProject: noop,
            onRemoveTask: noop,
            ...overrides,
        };
    }

    it('covers tasks empty: no TaskRow rendered, ProgressBar renders nothing', () => {
        const { container } = render(<ProjectCard {...baseProps()} />);
        expect(screen.queryAllByRole('listitem')).toHaveLength(0);
        // the header's ProgressBar has no total, so it renders no bar element
        expect(container.querySelectorAll('span > span[style]')).toHaveLength(0);
    });

    it('covers tasks nonempty: one TaskRow rendered per task', () => {
        const project = makeProject({
            tasks: [
                { id: 't1', name: 'Draft', subtasks: [] },
                { id: 't2', name: 'Revise', subtasks: [] },
            ],
        });
        render(<ProjectCard {...baseProps({ project })} />);
        expect(screen.getAllByRole('listitem')).toHaveLength(2);
        expect(screen.getByDisplayValue('Draft')).toBeInTheDocument();
        expect(screen.getByDisplayValue('Revise')).toBeInTheDocument();
    });

    it('covers ProgressBar reflects projectProgress(project)', () => {
        const project = makeProject({
            tasks: [
                {
                    id: 't1',
                    name: 'Draft',
                    subtasks: [
                        { id: 's1', isDone: true, assignedDay: 'mon', missedDays: [], weight: 1 },
                        { id: 's2', isDone: false, assignedDay: 'tue', missedDays: [], weight: 1 },
                    ],
                },
            ],
        });
        const { container } = render(<ProjectCard {...baseProps({ project })} />);
        const fill = container.querySelector('span > span[style]') as HTMLElement;
        expect(fill.style.width).toBe('50%');
    });

    it('covers typing the name field: calls onRenameProject(id, value)', async () => {
        const user = userEvent.setup();
        const onRenameProject = vi.fn();
        render(<ProjectCard {...baseProps({ onRenameProject })} />);

        await user.type(screen.getByPlaceholderText('Project name…'), 'X');

        expect(onRenameProject).toHaveBeenCalledWith('p1', 'EnglishX');
    });

    it('covers clicking the deadline button: calls onEditDeadline(id)', async () => {
        const user = userEvent.setup();
        const onEditDeadline = vi.fn();
        render(<ProjectCard {...baseProps({ onEditDeadline })} />);

        await user.click(screen.getByRole('button', { name: 'Set deadline' }));

        expect(onEditDeadline).toHaveBeenCalledWith('p1');
    });

    it('covers clicking delete: calls onRemoveProject(id)', async () => {
        const user = userEvent.setup();
        const onRemoveProject = vi.fn();
        render(<ProjectCard {...baseProps({ onRemoveProject })} />);

        await user.click(screen.getByRole('button', { name: 'Delete project' }));

        expect(onRemoveProject).toHaveBeenCalledWith('p1');
    });

    it('covers clicking "add task": calls onAddTask(id)', async () => {
        const user = userEvent.setup();
        const onAddTask = vi.fn();
        render(<ProjectCard {...baseProps({ onAddTask })} />);

        await user.click(screen.getByText('add task'));

        expect(onAddTask).toHaveBeenCalledWith('p1');
    });
});
