import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ProjectCard, ProjectCardPreview } from './ProjectCard';
import { inertTreeKeys } from '@/test/treeKeys';
import { LIMITS } from '@/core/limits';
import type { Project } from '@/core/types';
import styles from './ProjectCard.module.css';
import taskStyles from './TaskRow.module.css';
import { en } from '@/i18n/en';

describe('ProjectCard', () => {
    /*
     * Testing strategy
     *     partition on project.tasks: empty (no TaskRow, ProgressBar renders
     *         nothing) | nonempty (one TaskRow per task)
     *     ProgressBar wiring: reflects projectProgress(project) -- the math
     *         itself belongs to core/progress, already tested there
     *     partition on project.deadline: absent (no caption line) | a valid
     *         date-only value | a valid date-time | a stored value that no
     *         longer parses (imported or synced from elsewhere)
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
            weekStart: '2026-08-10',
            today: '2026-08-12',
            frozen: false,
            onEditTask: noop,
            onEditDeadline: noop,
            onToggleTask: noop,
            onAddTask: noop,
            onRenameProject: noop,
            onRenameTask: noop,
            onRemoveProject: noop,
            onRemoveTask: noop,
            treeKeys: inertTreeKeys(),
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

        await user.type(screen.getByPlaceholderText(en.projectCard.namePlaceholder), 'X');

        expect(onRenameProject).toHaveBeenCalledWith('p1', 'EnglishX');
    });

    it('covers clicking the deadline button: calls onEditDeadline(id)', async () => {
        const user = userEvent.setup();
        const onEditDeadline = vi.fn();
        render(<ProjectCard {...baseProps({ onEditDeadline })} />);

        await user.click(screen.getByRole('button', { name: en.projectCard.setDeadline }));

        expect(onEditDeadline).toHaveBeenCalledWith('p1');
    });

    it('covers clicking delete: calls onRemoveProject(id)', async () => {
        const user = userEvent.setup();
        const onRemoveProject = vi.fn();
        render(<ProjectCard {...baseProps({ onRemoveProject })} />);

        await user.click(screen.getByRole('button', { name: en.projectCard.deleteProject }));

        expect(onRemoveProject).toHaveBeenCalledWith('p1');
    });

    it('covers clicking "add task": calls onAddTask(id)', async () => {
        const user = userEvent.setup();
        const onAddTask = vi.fn();
        render(<ProjectCard {...baseProps({ onAddTask })} />);

        await user.click(screen.getByText(en.projectCard.addTask));

        expect(onAddTask).toHaveBeenCalledWith('p1');
    });

    /*
     * Testing strategy, task cap
     *     partition on taskRoom(project): > 0 (covered above) | 0
     *     at 0 the control has to SAY the limit, not just stop working: there is
     *     no notice layer anywhere, so the button is the only place a refusal
     *     can be seen.
     */
    function fullProject(): Project {
        return makeProject({
            tasks: Array.from({ length: LIMITS.tasksPerProject }, (_, i) => ({
                id: `t${i}`,
                name: `task ${i}`,
                isDone: false,
                subtasks: [],
            })),
        });
    }

    it('covers taskRoom 0: the add-task control states the limit and is disabled', () => {
        render(<ProjectCard {...baseProps({ project: fullProject() })} />);

        expect(screen.queryByText(en.projectCard.addTask)).toBeNull();
        const button = screen.getByRole('button', {
            name: `${LIMITS.tasksPerProject} tasks per project`,
        });
        expect(button).toBeDisabled();
    });

    it('covers taskRoom 0: clicking the control adds nothing', async () => {
        const user = userEvent.setup();
        const onAddTask = vi.fn();
        render(<ProjectCard {...baseProps({ project: fullProject(), onAddTask })} />);

        await user.click(
            screen.getByRole('button', {
                name: `${LIMITS.tasksPerProject} tasks per project`,
            }),
        );

        expect(onAddTask).not.toHaveBeenCalled();
    });
    it('covers no deadline: no caption line under the project name', () => {
        render(<ProjectCard {...baseProps()} />);
        expect(screen.queryByText(/Aug/)).not.toBeInTheDocument();
    });

    it('covers a date-only deadline: caption shows the day, not the 23:59 it resolves to', () => {
        render(
            <ProjectCard {...baseProps({ project: makeProject({ deadline: '2026-08-20' }) })} />,
        );
        expect(screen.getByText('Thu Aug 20')).toBeInTheDocument();
    });

    it('covers a date-time deadline: caption shows the time too', () => {
        render(
            <ProjectCard
                {...baseProps({ project: makeProject({ deadline: '2026-08-20T14:30' }) })}
            />,
        );
        expect(screen.getByText('Thu Aug 20 · 14:30')).toBeInTheDocument();
    });

    it('covers a stored deadline that no longer parses: nothing rendered, no crash', () => {
        render(<ProjectCard {...baseProps({ project: makeProject({ deadline: 'whenever' }) })} />);
        expect(screen.queryByText(/whenever/)).not.toBeInTheDocument();
        expect(screen.getByDisplayValue('English')).toBeInTheDocument();
    });
    function rung(name: 'quiet' | 'live' | 'urgent'): string {
        const value = styles[name];
        if (value === undefined) throw new Error(`ProjectCard.module.css has no .${name}`);
        return value;
    }

    it('covers a project deadline already past: urgent', () => {
        render(
            <ProjectCard {...baseProps({ project: makeProject({ deadline: '2026-08-11' }) })} />,
        );
        expect(screen.getByText(/AUG/i)).toHaveClass(rung('urgent'));
    });

    it('covers isProjectDone reaching the tone: every task done makes it quiet', () => {
        const project = makeProject({
            deadline: '2026-08-11',
            tasks: [{ id: 't1', name: 'Draft', isDone: true, subtasks: [] }],
        });
        render(<ProjectCard {...baseProps({ project })} />);
        expect(screen.getByText(/AUG/i)).toHaveClass(rung('quiet'));
    });
});

describe('ProjectCardPreview', () => {
    /*
     * Testing strategy
     *
     * Same guard as TaskRowPreview's, one level up: the dragged card is only in
     * the DOM mid-drag, so the test renders both the card and its clone and
     * diffs them rather than trying to drag anything.
     *
     * partition on project.tasks: empty (no rows, add-task button alone)
     *     | nonempty (a clone of every row, which is TaskRowPreview's job)
     * partition on project.deadline: absent (one line) | present (two lines)
     */

    const DRAG_ONLY = [
        'style',
        'readonly',
        'role',
        'tabindex',
        'aria-disabled',
        'aria-roledescription',
        'aria-describedby',
    ];

    /**
     * The clone's one sanctioned difference: the class turning hover state on.
     * Only the card's own — a carried row must not be marked, so TaskRow's stays
     * in the comparison and a stray one fails it.
     */
    function grabbedClass(): string {
        const value = styles.grabbed;
        if (value === undefined) throw new Error('ProjectCard.module.css has no .grabbed');
        return value;
    }

    function carriedRowClass(): string {
        const value = taskStyles.grabbed;
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

    function makeProject(overrides: Partial<Project> = {}): Project {
        return { id: 'p1', name: 'English', tasks: [], ...overrides };
    }

    const WEEK = '2026-08-10';
    const TODAY = '2026-08-12';
    const noop = () => {};

    function shapes(project: Project): { card: string; preview: string } {
        const live = render(
            <ProjectCard
                project={project}
                weekStart={WEEK}
                today={TODAY}
                frozen={false}
                onEditTask={noop}
                onEditDeadline={noop}
                onToggleTask={noop}
                onAddTask={noop}
                onRenameProject={noop}
                onRenameTask={noop}
                onRemoveProject={noop}
                onRemoveTask={noop}
                treeKeys={inertTreeKeys()}
            />,
        );
        const card = shapeOf(rendered(live.container));
        live.unmount();

        const clone = render(
            <ProjectCardPreview project={project} weekStart={WEEK} today={TODAY} frozen={false} />,
        );
        return { card, preview: shapeOf(rendered(clone.container)) };
    }

    it('covers a project with tasks and a deadline: the clone renders the card', () => {
        const project = makeProject({
            deadline: '2026-08-14',
            tasks: [
                {
                    id: 't1',
                    name: 'Read chapter 4',
                    subtasks: [
                        { id: 's1', isDone: false, assignedDay: 'mon', missedDays: [], weight: 1 },
                    ],
                },
                { id: 't2', name: 'Draft outline', isDone: true, subtasks: [] },
            ],
        });
        const { card, preview } = shapes(project);
        expect(preview).toBe(card);
    });

    it('covers an empty project with no deadline: same shape, add-task button and all', () => {
        const { card, preview } = shapes(makeProject());
        expect(preview).toBe(card);
    });

    // shapeOf strips the card's grabbed class, so without this it could vanish and
    // every comparison above would still pass. The row half is the opposite check:
    // a card is what the pointer grabbed, the rows inside it are only carried, and
    // marking those lights up every affordance in the card at once.
    it('covers grabbed: the card is marked hovered, the rows it carries are not', () => {
        const project = makeProject({ tasks: [{ id: 't1', name: 'Draft', subtasks: [] }] });
        const { container } = render(
            <ProjectCardPreview project={project} weekStart={WEEK} today={TODAY} frozen={false} />,
        );
        expect(rendered(container)).toHaveClass(grabbedClass());
        expect(screen.getByRole('listitem')).not.toHaveClass(carriedRowClass());
    });

    it('covers the readouts a shape comparison cannot see: names and caption', () => {
        render(
            <ProjectCardPreview
                project={makeProject({
                    deadline: '2026-08-14',
                    tasks: [{ id: 't1', name: 'Read chapter 4', subtasks: [] }],
                })}
                weekStart={WEEK}
                today={TODAY}
                frozen={false}
            />,
        );
        expect(screen.getByDisplayValue('English')).toBeInTheDocument();
        expect(screen.getByDisplayValue('Read chapter 4')).toBeInTheDocument();
        expect(screen.getByText(/AUG/i)).toBeInTheDocument();
    });
});
