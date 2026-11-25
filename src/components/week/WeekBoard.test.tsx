import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderIn } from '@/test/locale';
import { en } from '@/i18n/en';
// `vi` is vitest's here, so the Vietnamese catalog comes in renamed.
import { vi as viCatalog } from '@/i18n/vi';
import { WeekBoard } from './WeekBoard';
import { LIMITS } from '@/core/limits';
import { printProjects } from '@/storage/weekClipboard';
import type { Project, Subtask, Task, WeekPlan, DayOfWeek } from '@/core/types';

describe('WeekBoard', () => {
    /*
     * Testing strategy — WeekBoard owns no data of its own. It holds the "what is
     * open" states and turns a child's callback into a core producer applied
     * through onChange, so what is worth catching is a destructive action that
     * does NOT ask first, a confirm that asks about the wrong thing, an action
     * wired to the wrong producer, and a frozen week still offering edits.
     *
     * onChange takes an UPDATER, so a test asserts by applying the updater it was
     * handed to the plan and inspecting the result.
     *
     *   partition on delete target: project (no tasks | some) | task (no subtasks
     *       | some) — the empty cases must NOT prompt, the non-empty ones must
     *   partition on the confirm: confirmed | dismissed
     *   partition on count in the confirm's copy: 1 (singular) | >1 (plural)
     *   partition on the week: live | ended (read-only)
     *   partition on a move: marked missed | not
     *
     * NOT covered here: drag reordering (handleReorderProject/Task), for the
     * dnd-kit-in-jsdom reason set out in TaskEditor.test.tsx. The producers they
     * call are tested in projects.test.ts.
     */

    // A fixed Wednesday, so "past day" and "current week" are facts rather than
    // whatever day the suite happens to run on. 2026-08-10 is the Monday.
    const WEEK_START = '2026-08-10';

    beforeEach(() => {
        vi.useFakeTimers({ shouldAdvanceTime: true });
        vi.setSystemTime(new Date('2026-08-12T12:00:00'));
    });

    afterEach(() => {
        vi.useRealTimers();
        // Testing Library's cleanup unmounts the tree inside narrowBoard's
        // hand-made container but leaves the element, which the next test would
        // then measure and quietly run in a width it never asked for.
        document.querySelectorAll('[data-app-container]').forEach((el) => el.remove());
    });

    function sub(id: string, day: DayOfWeek, extra: Partial<Subtask> = {}): Subtask {
        return { id, isDone: false, assignedDay: day, missedDays: [], weight: 1, ...extra };
    }

    function task(id: string, name: string, subtasks: Subtask[] = []): Task {
        return subtasks.length === 0
            ? { id, name, subtasks: [], isDone: false }
            : { id, name, subtasks };
    }

    function project(id: string, name: string, tasks: Task[] = []): Project {
        return { id, name, tasks };
    }

    function plan(projects: Project[], ended = false): WeekPlan {
        return { weekStart: WEEK_START, ended, projects };
    }

    function board(p: WeekPlan) {
        const onChange = vi.fn();
        const onSkipGuide = vi.fn();
        render(<WeekBoard plan={p} onChange={onChange} onSkipGuide={onSkipGuide} />);
        return {
            onChange,
            onSkipGuide,
            user: userEvent.setup(),
            /** the plan that results from the updater onChange was last handed */
            result: () => {
                expect(onChange).toHaveBeenCalled();
                const updater = onChange.mock.calls.at(-1)![0] as (c: WeekPlan) => WeekPlan;
                return updater(p);
            },
        };
    }

    // WeekView renders the grid pane and the focus pane at once and lets a
    // container query hide one. jsdom applies no CSS, so both are present and
    // every subtask control appears twice.
    function grid() {
        return within(document.querySelector('.weekGridPane') as HTMLElement);
    }

    function tree() {
        return within(document.querySelector('.projectView') as HTMLElement);
    }

    /** Whether `inert` reaches this element — from itself or any ancestor. */
    function inertlyReachable(node: Element): boolean {
        for (let el: Element | null = node; el !== null; el = el.parentElement) {
            if (el.hasAttribute('inert')) return true;
        }
        return false;
    }

    /* ---- deleting: only ask when there is something to lose ---- */

    it('deletes an empty project outright, without a confirm', async () => {
        const { onChange, user, result } = board(plan([project('p1', 'English')]));

        await user.click(tree().getByRole('button', { name: en.projectCard.deleteProject }));

        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        expect(result().projects).toHaveLength(0);
        expect(onChange).toHaveBeenCalledTimes(1);
    });

    it('asks before deleting a project that has tasks', async () => {
        const { onChange, user } = board(plan([project('p1', 'English', [task('t1', 'Essay')])]));

        await user.click(tree().getByRole('button', { name: en.projectCard.deleteProject }));

        expect(screen.getByRole('dialog')).toBeInTheDocument();
        expect(onChange).not.toHaveBeenCalled(); // nothing happens until confirmed
    });

    it('deletes an empty task outright, without a confirm', async () => {
        const { user, result } = board(plan([project('p1', 'English', [task('t1', 'Essay')])]));

        await user.click(tree().getByRole('button', { name: en.taskRow.deleteTask }));

        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        expect(result().projects[0]?.tasks).toHaveLength(0);
    });

    it('asks before deleting a task that has subtasks', async () => {
        const { onChange, user } = board(
            plan([project('p1', 'English', [task('t1', 'Essay', [sub('s1', 'mon')])])]),
        );

        await user.click(tree().getByRole('button', { name: en.taskRow.deleteTask }));

        expect(screen.getByRole('dialog')).toBeInTheDocument();
        expect(onChange).not.toHaveBeenCalled();
    });

    it('the project confirm names the project and counts its tasks', async () => {
        const { user } = board(
            plan([project('p1', 'English', [task('t1', 'Essay'), task('t2', 'Notes')])]),
        );

        await user.click(tree().getByRole('button', { name: en.projectCard.deleteProject }));

        const dialog = screen.getByRole('dialog');
        expect(within(dialog).getByText(/Delete project "English"\?/)).toBeInTheDocument();
        expect(within(dialog).getByText(/its 2 tasks/)).toBeInTheDocument();
    });

    it('the task confirm names the task, its project, and counts its subtasks', async () => {
        const { user } = board(
            plan([
                project('p1', 'English', [
                    task('t1', 'Essay', [sub('s1', 'mon'), sub('s2', 'tue'), sub('s3', 'wed')]),
                ]),
            ]),
        );

        await user.click(tree().getByRole('button', { name: en.taskRow.deleteTask }));

        const dialog = screen.getByRole('dialog');
        expect(within(dialog).getByText(/Delete task "Essay"\?/)).toBeInTheDocument();
        expect(within(dialog).getByText(en.languagePicker.english)).toBeInTheDocument();
        expect(within(dialog).getByText(/its 3 subtasks/)).toBeInTheDocument();
    });

    it('counts of one read as singular', async () => {
        const { user } = board(plan([project('p1', 'English', [task('t1', 'Essay')])]));

        await user.click(tree().getByRole('button', { name: en.projectCard.deleteProject }));

        expect(screen.getByText(/its 1 task/)).toBeInTheDocument();
    });

    it('an unnamed project is called Untitled in the confirm', async () => {
        const { user } = board(plan([project('p1', '', [task('t1', 'Essay')])]));

        await user.click(tree().getByRole('button', { name: en.projectCard.deleteProject }));

        expect(screen.getByText(/Delete project "Untitled"\?/)).toBeInTheDocument();
    });

    // The stand-in is the app's own word, not the user's, so it is translated.
    it('covers vi: the unnamed-project stand-in inside its translated title', async () => {
        const p = plan([project('p1', '', [task('t1', 'Essay')])]);
        renderIn('vi', <WeekBoard plan={p} onChange={vi.fn()} onSkipGuide={vi.fn()} />);
        const user = userEvent.setup();

        await user.click(tree().getByRole('button', { name: viCatalog.projectCard.deleteProject }));

        expect(
            screen.getByText(viCatalog.weekBoard.deleteProjectTitle(viCatalog.common.untitled)),
        ).toBeInTheDocument();
        expect(screen.queryByText(/^Delete project/)).not.toBeInTheDocument();
    });

    // The delete title is one catalog entry per kind, so both kinds are walked.
    it('covers vi: the delete confirm names the kind and counts what goes with it', async () => {
        const p = plan([
            project('p1', 'English', [task('t1', 'Essay', [sub('s1', 'mon'), sub('s2', 'tue')])]),
        ]);
        renderIn('vi', <WeekBoard plan={p} onChange={vi.fn()} onSkipGuide={vi.fn()} />);
        const user = userEvent.setup();

        await user.click(tree().getByRole('button', { name: viCatalog.projectCard.deleteProject }));
        expect(
            screen.getByText(viCatalog.weekBoard.deleteProjectTitle('English')),
        ).toBeInTheDocument();
        expect(screen.getByText(viCatalog.weekBoard.deleteProjectBody(1))).toBeInTheDocument();
        await user.click(screen.getByRole('button', { name: viCatalog.common.cancel }));

        await user.click(tree().getByRole('button', { name: viCatalog.taskRow.deleteTask }));
        expect(screen.getByText(viCatalog.weekBoard.deleteTaskTitle('Essay'))).toBeInTheDocument();
        expect(screen.getByText(viCatalog.weekBoard.deleteTaskBody(2))).toBeInTheDocument();
    });

    // WeekView has no test file of its own, so its strings are covered here.
    it('covers vi: the clear-missed confirm names the day it is dropping', async () => {
        const p = plan([
            project('p1', 'English', [
                task('t1', 'Essay', [sub('s1', 'wed', { missedDays: ['mon'] })]),
            ]),
        ]);
        renderIn('vi', <WeekBoard plan={p} onChange={vi.fn()} onSkipGuide={vi.fn()} />);
        const user = userEvent.setup();

        await user.click(grid().getByRole('button', { name: viCatalog.dayCell.clearMissedLabel }));

        expect(screen.getByText(viCatalog.weekBoard.clearMissedTitle)).toBeInTheDocument();
        expect(screen.getByText(viCatalog.weekBoard.clearMissedBody('T2'))).toBeInTheDocument();
        expect(screen.queryByText(en.weekBoard.clearMissedTitle)).not.toBeInTheDocument();
    });

    it('covers vi, grid mode: the eyebrow and the invitation to pick a day', () => {
        // A week today cannot fall inside: WeekView's head reads the real clock
        // rather than its `today` prop.
        const p: WeekPlan = {
            weekStart: '2020-01-06',
            ended: false,
            projects: [project('p1', 'English', [task('t1', 'Essay', [sub('s1', 'mon')])])],
        };
        renderIn('vi', <WeekBoard plan={p} onChange={vi.fn()} onSkipGuide={vi.fn()} />);

        expect(screen.getByText(viCatalog.weekView.eyebrow)).toBeInTheDocument();
        expect(screen.queryByText('This week')).not.toBeInTheDocument();
        expect(screen.getByText(viCatalog.weekView.clickAnyDay)).toBeInTheDocument();
    });

    it('covers vi, focus mode: the line names the day and offers the way back', async () => {
        renderIn(
            'vi',
            <WeekBoard
                plan={plan([project('p1', 'English', [task('t1', 'Essay', [sub('s1', 'mon')])])])}

                onChange={vi.fn()}
                onSkipGuide={vi.fn()}
            />,
        );
        const user = userEvent.setup();

        await user.click(grid().getAllByTitle(viCatalog.dayColumn.focusDay)[0]!);

        const back = screen.getByRole('button', { name: viCatalog.weekView.showAllDays });
        expect(back).toBeInTheDocument();
        expect(back.parentElement?.textContent).toContain(viCatalog.weekView.focusing.trim());
        expect(screen.queryByRole('button', { name: en.weekView.showAllDays })).toBeNull();
    });

    it('confirming the delete removes the project and its tasks', async () => {
        const { user, result } = board(
            plan([project('p1', 'English', [task('t1', 'Essay')]), project('p2', 'Maths')]),
        );

        await user.click(tree().getAllByRole('button', { name: en.projectCard.deleteProject })[0]!);
        await user.click(screen.getByRole('button', { name: en.common.delete }));

        expect(result().projects.map((p) => p.id)).toEqual(['p2']);
    });

    it('dismissing the delete changes nothing', async () => {
        const { onChange, user } = board(plan([project('p1', 'English', [task('t1', 'Essay')])]));

        await user.click(tree().getByRole('button', { name: en.projectCard.deleteProject }));
        await user.click(screen.getByRole('button', { name: en.common.cancel }));

        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        expect(onChange).not.toHaveBeenCalled();
    });

    /* ---- missed days: the day-15 rule ---- */

    it('a move marked missed records the miss on the day left behind', async () => {
        const { user, result } = board(
            plan([project('p1', 'English', [task('t1', 'Essay', [sub('s1', 'mon')])])]),
        );

        await user.click(grid().getByRole('button', { name: en.dayCell.move }));
        // Pick then confirm: choosing a day only stages it. Scoped to the
        // dialog, because the board's column headings carry the same day names.
        const move = within(screen.getByRole('dialog'));
        await user.click(move.getByRole('button', { name: 'Thu' }));
        await user.click(move.getByRole('button', { name: 'Move' }));

        const moved = result().projects[0]?.tasks[0]?.subtasks[0];
        expect(moved?.assignedDay).toBe('thu');
        expect(moved?.missedDays).toContain('mon');
    });

    it('clearing a missed mark drops that day, leaving the subtask where it is', async () => {
        const { user, result } = board(
            plan([
                project('p1', 'English', [
                    task('t1', 'Essay', [sub('s1', 'wed', { missedDays: ['mon'] })]),
                ]),
            ]),
        );

        await user.click(grid().getByRole('button', { name: en.dayCell.clearMissedLabel }));
        await user.click(screen.getByRole('button', { name: 'Clear' }));

        const cleared = result().projects[0]?.tasks[0]?.subtasks[0];
        expect(cleared?.missedDays).toEqual([]);
        expect(cleared?.assignedDay).toBe('wed');
    });

    it('dismissing the clear leaves the miss recorded', async () => {
        const { onChange, user } = board(
            plan([
                project('p1', 'English', [
                    task('t1', 'Essay', [sub('s1', 'wed', { missedDays: ['mon'] })]),
                ]),
            ]),
        );

        await user.click(grid().getByRole('button', { name: en.dayCell.clearMissedLabel }));
        await user.click(screen.getByRole('button', { name: en.common.cancel }));

        expect(onChange).not.toHaveBeenCalled();
    });

    /* ---- opening the right editor ---- */

    // A subtask has no editor of its own; clicking one opens its parent task's.
    it('clicking a subtask opens its parent task, not another', async () => {
        const { user } = board(
            plan([
                project('p1', 'English', [
                    task('t1', 'Essay', [sub('s1', 'mon')]),
                    task('t2', 'Notes', [sub('s2', 'tue')]),
                ]),
            ]),
        );

        await user.click(grid().getByText('Notes'));

        expect(screen.getByRole('heading', { name: 'Notes' })).toBeInTheDocument();
    });

    it('saving from the task editor replaces that task and closes', async () => {
        const { user, result } = board(
            plan([project('p1', 'English', [task('t1', 'Essay', [sub('s1', 'mon')])])]),
        );

        await user.click(tree().getByRole('button', { name: en.taskRow.editTask }));
        await user.type(screen.getByLabelText(en.taskEditor.note), 'from the syllabus');
        await user.click(screen.getByRole('button', { name: en.common.save }));

        expect(result().projects[0]?.tasks[0]?.description).toBe('from the syllabus');
        expect(screen.queryByRole('heading', { name: 'Essay' })).not.toBeInTheDocument();
    });

    it('the deadline editor writes to the project it was opened from', async () => {
        const { user, result } = board(plan([project('p1', 'English'), project('p2', 'Maths')]));

        await user.click(tree().getAllByRole('button', { name: en.projectCard.setDeadline })[1]!);
        await user.type(screen.getByLabelText('Deadline'), '2026-09-01');
        await user.click(screen.getByRole('button', { name: en.common.save }));

        const after = result().projects;
        expect(after[1]?.deadline).toBe('2026-09-01');
        expect(after[0]?.deadline).toBeUndefined();
    });

    /* ---- adding ---- */

    it('adds a project to the board', async () => {
        const { user, result } = board(plan([]));

        await user.click(screen.getByRole('button', { name: en.projectList.addProject }));

        expect(result().projects).toHaveLength(1);
    });

    it('copy plan is muted while the week has nothing in it', () => {
        board(plan([]));

        expect(screen.getByRole('button', { name: en.projectView.copyPlan })).toBeDisabled();
        expect(screen.getByRole('button', { name: en.projectView.pastePlan })).toBeEnabled();
    });

    /*
     * Testing strategy, paste
     *     partition on the checkbox: off (progress cleared) | on (kept)
     *     property in both: every id is fresh, and existing projects survive
     *
     * Weeks' rep invariant says an id names one node across ALL weeks, so a
     * paste that kept its source ids would put one node in two weeks at once.
     */
    it('paste mints fresh ids and clears progress by default', async () => {
        const source: Project = {
            id: 'src-p',
            name: 'Thesis',
            tasks: [
                {
                    id: 'src-t',
                    name: 'Read Chapter 4',
                    subtasks: [
                        {
                            id: 'src-s',
                            isDone: true,
                            assignedDay: 'wed',
                            missedDays: ['mon'],
                            weight: 2,
                        },
                    ],
                },
            ],
        };
        const { user, result } = board(plan([project('keep', 'Existing')]));

        await user.click(screen.getByRole('button', { name: en.projectView.pastePlan }));
        await user.click(screen.getByLabelText(en.pastePlanDialog.boxLabel));
        await user.paste(printProjects('2026-08-03', [source]));
        await user.click(screen.getByRole('button', { name: en.pastePlanDialog.add }));

        const after = result().projects;
        expect(after.map((p) => p.name)).toEqual(['Existing', 'Thesis']);
        const pasted = after[1]!;
        expect(pasted.id).not.toBe('src-p');
        expect(pasted.tasks[0]?.id).not.toBe('src-t');
        const subtask = pasted.tasks[0]?.subtasks[0];
        expect(subtask?.id).not.toBe('src-s');
        expect(subtask?.isDone).toBe(false);
        expect(subtask?.missedDays).toEqual([]);
        // not progress, so it survives
        expect(subtask?.weight).toBe(2);
        expect(subtask?.assignedDay).toBe('wed');
    });

    it('paste keeps progress when the box is ticked', async () => {
        const source: Project = {
            id: 'src-p',
            name: 'Thesis',
            tasks: [
                {
                    id: 'src-t',
                    name: 'Read Chapter 4',
                    subtasks: [
                        {
                            id: 'src-s',
                            isDone: true,
                            assignedDay: 'wed',
                            missedDays: ['mon'],
                            weight: 2,
                        },
                    ],
                },
            ],
        };
        const { user, result } = board(plan([]));

        await user.click(screen.getByRole('button', { name: en.projectView.pastePlan }));
        await user.click(screen.getByLabelText(en.pastePlanDialog.boxLabel));
        await user.paste(printProjects('2026-08-03', [source]));
        await user.click(screen.getByRole('checkbox', { name: /Keep completion progression/ }));
        await user.click(screen.getByRole('button', { name: en.pastePlanDialog.add }));

        const subtask = result().projects[0]?.tasks[0]?.subtasks[0];
        expect(subtask?.isDone).toBe(true);
        expect(subtask?.missedDays).toEqual(['mon']);
        expect(subtask?.id).not.toBe('src-s');
    });

    /*
     * Testing strategy, copy
     *     partition on the clipboard: accepts the write | refuses it
     *     partition on the selection: every project | some left out
     *
     * A refused write is not swallowed: the text still has to reach the screen
     * to be copied by hand.
     */
    function stubClipboard(writeText: () => Promise<void>) {
        Object.defineProperty(navigator, 'clipboard', {
            configurable: true,
            value: { writeText },
        });
    }

    it('copy writes the live plan to the clipboard as JSON', async () => {
        const projects = [project('p1', 'Thesis'), project('p2', 'English')];
        const { user } = board(plan(projects));
        const writeText = vi.fn(() => Promise.resolve());
        stubClipboard(writeText);

        await user.click(screen.getByRole('button', { name: en.projectView.copyPlan }));
        await user.click(screen.getByRole('button', { name: en.copyPlanDialog.copy }));

        expect(writeText).toHaveBeenCalledWith(printProjects(WEEK_START, projects));
    });

    it('copy leaves out a project that was unchecked', async () => {
        const projects = [project('p1', 'Thesis'), project('p2', 'English')];
        const { user } = board(plan(projects));
        const writeText = vi.fn(() => Promise.resolve());
        stubClipboard(writeText);

        await user.click(screen.getByRole('button', { name: en.projectView.copyPlan }));
        await user.click(screen.getByRole('checkbox', { name: /^Thesis,/ }));
        await user.click(screen.getByRole('button', { name: en.copyPlanDialog.copy }));

        expect(writeText).toHaveBeenCalledWith(printProjects(WEEK_START, [projects[1]!]));
    });

    it('copy shows the text to copy by hand when the clipboard refuses', async () => {
        const projects = [project('p1', 'Thesis')];
        const { user } = board(plan(projects));
        stubClipboard(() => Promise.reject(new Error('blocked')));

        await user.click(screen.getByRole('button', { name: en.projectView.copyPlan }));
        await user.click(screen.getByRole('button', { name: en.copyPlanDialog.copy }));

        expect(screen.getByLabelText(en.copyTextDialog.boxLabel)).toHaveValue(
            printProjects(WEEK_START, projects),
        );
    });

    it('an ended week offers neither copy nor paste', () => {
        board(plan([project('p1', 'English')], true));
        expect(screen.queryByRole('button', { name: en.projectView.pastePlan })).toBeNull();
        expect(screen.queryByRole('button', { name: en.projectView.copyPlan })).toBeNull();
    });

    /*
     * Both drive the KEYBOARD deliberately: Cmd+Enter and Enter reach WeekBoard's
     * handlers without touching a control that could be disabled, so a test that
     * clicked would pass on the disabled button while the bypass stayed open.
     */
    it('refuses a keyboard add-project once the week is at its cap', async () => {
        const full = Array.from({ length: LIMITS.projectsPerWeek }, (_, i) =>
            project(`p${i}`, `project ${i}`),
        );
        const { onChange, user } = board(plan(full));

        await user.click(tree().getAllByPlaceholderText('Project name…')[0]!);
        await user.keyboard('{Meta>}{Enter}{/Meta}');

        expect(onChange).not.toHaveBeenCalled();
    });

    it('refuses a keyboard insert-task once the project is at its cap', async () => {
        const tasks = Array.from({ length: LIMITS.tasksPerProject }, (_, i) =>
            task(`t${i}`, `task ${i}`),
        );
        const { onChange, user } = board(plan([project('p1', 'English', tasks)]));

        await user.click(tree().getAllByPlaceholderText('Task…')[0]!);
        await user.keyboard('{Enter}');

        expect(onChange).not.toHaveBeenCalled();
    });

    it('adds a task to the project it was asked for', async () => {
        const { user, result } = board(plan([project('p1', 'English'), project('p2', 'Maths')]));

        await user.click(tree().getAllByRole('button', { name: /add task/ })[1]!);

        const after = result().projects;
        expect(after[1]?.tasks).toHaveLength(1);
        expect(after[0]?.tasks).toHaveLength(0);
    });

    /* ---- an ended week is a record, not a board ---- */

    // `inert` is the mechanism, and unlike the CSS-only hiding elsewhere it is a
    // real attribute jsdom reflects.
    it('an ended week freezes the project tree', () => {
        board(plan([project('p1', 'English', [task('t1', 'Essay')])], true));

        expect(document.querySelector('.projectView')).toHaveAttribute('inert');
    });

    it('a live week does not', () => {
        board(plan([project('p1', 'English', [task('t1', 'Essay')])]));

        expect(document.querySelector('.projectView')).not.toHaveAttribute('inert');
    });

    // The gate is applied per-region, NOT as one wrapper around the board:
    // collapsing the three `inert`s into one would freeze the day picker too and
    // leave an ended week you cannot page through.
    it('an ended week freezes the day lists but not the day picker', () => {
        board(plan([project('p1', 'English', [task('t1', 'Essay', [sub('s1', 'mon')])])], true));

        expect(document.querySelector('.weekGridPane ul[inert]')).toBeInTheDocument();
        expect(inertlyReachable(grid().getAllByTitle('Focus this day')[0]!)).toBe(false);
    });

    /* ---- the guide belongs to the week you are in ---- */

    // Which week is on screen, not how long the user has been here: the guide
    // runs every time the current week is empty.
    it('an empty current week gets the whole guide', () => {
        board(plan([]));

        expect(screen.getByRole('button', { name: en.weekWelcome.ctaProject })).toBeInTheDocument();
        expect(screen.queryByText(en.weekWelcome.quietTitle)).not.toBeInTheDocument();
    });

    it('an empty week that is not the current one gets the quiet line', () => {
        render(
            <WeekBoard
                plan={{ weekStart: '2026-08-17', ended: false, projects: [] }}
                onChange={vi.fn()}
                onSkipGuide={vi.fn()}
            />,
        );

        expect(screen.getByText(en.weekWelcome.quietTitle)).toBeInTheDocument();
        expect(
            screen.queryByRole('button', { name: en.weekWelcome.ctaProject }),
        ).not.toBeInTheDocument();
    });

    // The guide's button does not advance the guide — naming the row does — so a
    // second press must return to the blank row rather than make another.
    it('the guide adds a project when there is none', async () => {
        const { onChange, user, result } = board(plan([]));

        await user.click(screen.getByRole('button', { name: en.weekWelcome.ctaProject }));

        expect(onChange).toHaveBeenCalledTimes(1);
        expect(result().projects).toHaveLength(1);
    });

    it('the guide does not add a second project while one sits unnamed', async () => {
        const { onChange, user } = board(plan([project('p1', '')]));

        await user.click(screen.getByRole('button', { name: en.weekWelcome.ctaProject }));

        expect(onChange).not.toHaveBeenCalled();
        expect(tree().getByPlaceholderText(en.projectCard.namePlaceholder)).toHaveFocus();
    });

    it('the guide does not add a second task while one sits unnamed', async () => {
        const { onChange, user } = board(plan([project('p1', 'English', [task('t1', '')])]));

        await user.click(screen.getByRole('button', { name: en.weekWelcome.ctaTask }));

        expect(onChange).not.toHaveBeenCalled();
        expect(tree().getByPlaceholderText(en.taskRow.namePlaceholder)).toHaveFocus();
    });

    // WeekWelcome covers its own button; what is covered here is the wiring
    // between them, which can become a no-op while the button still takes clicks.
    it('the wide guide hands its skip to the caller', async () => {
        const { onSkipGuide, user } = board(plan([]));

        await user.click(screen.getByRole('button', { name: en.weekWelcome.skip }));

        expect(onSkipGuide).toHaveBeenCalledTimes(1);
    });

    // The current week loses its guide the moment it is ended: three of the
    // guide's actions are ones the frozen board cannot perform.
    it('an ended current week gets neither', () => {
        board(plan([], true));

        expect(
            screen.queryByRole('button', { name: en.weekWelcome.ctaProject }),
        ).not.toBeInTheDocument();
        expect(screen.queryByText(en.weekWelcome.quietTitle)).not.toBeInTheDocument();
    });

    /* ---- the single-column walkthrough ---- */

    /*
     * Testing strategy — the walkthrough is the same derived guide with two
     * additions: a latch (Get started) and a cue that names one real control.
     * Every case below asserts WHICH control carries the mark.
     *
     *   partition on width: measured under 1000 (walkthrough) | unmeasurable
     *       (the board keeps the wide behaviour — the safe fallback)
     *   partition on the latch: before Get started (no Projects section at all)
     *       | after (the tree is back and cued)
     *   partition on the cue: add-project | project name | add-task | task name
     *       | the editor button
     *   partition on settling: a name being typed holds its step; the same name
     *       once blurred advances it
     */

    /** Mount the board inside an app container of a given measured width. */
    function narrowBoard(p: WeekPlan, width = 400, guideEnabled = true) {
        const container = document.createElement('div');
        container.setAttribute('data-app-container', '');
        container.getBoundingClientRect = () => ({ width }) as unknown as DOMRect;
        document.body.appendChild(container);
        const onChange = vi.fn();
        const onSkipGuide = vi.fn();
        render(
            <WeekBoard
                plan={p}
                onChange={onChange}
                guideEnabled={guideEnabled}
                onSkipGuide={onSkipGuide}
            />,
            { container },
        );
        return { onChange, onSkipGuide, user: userEvent.setup(), container };
    }

    /** The one control the guide is marking, or null. */
    function cued(): Element | null {
        return document.querySelector('[class*="_target_"], [class*="_field_"]');
    }

    it('the narrow explainer hands its skip to the caller', async () => {
        const { onSkipGuide, user } = narrowBoard(plan([]));

        await user.click(screen.getByRole('button', { name: en.weekWelcome.skip }));

        expect(onSkipGuide).toHaveBeenCalledTimes(1);
    });

    it('a narrow empty week explains itself before it guides', () => {
        narrowBoard(plan([]));

        expect(screen.getByText(en.weekWelcome.stepProject)).toBeInTheDocument();
        expect(screen.getByText(en.weekWelcome.stepDays)).toBeInTheDocument();
        // the Projects section is what the explainer holds back
        expect(document.querySelector('.projectView')).toBeNull();
        expect(screen.getByRole('button', { name: en.weekWelcome.getStarted })).toBeInTheDocument();
        expect(cued()).toBeNull();
    });

    // The explainer withholds the Projects section, which must never happen to a
    // week that already has something in it.
    it('a week that already has a project is past the explainer', () => {
        narrowBoard(plan([project('p1', 'Linear Algebra')]));

        expect(
            screen.queryByRole('button', { name: en.weekWelcome.getStarted }),
        ).not.toBeInTheDocument();
        expect(document.querySelector('.projectView')).not.toBeNull();
        expect(cued()).toBe(tree().getByRole('button', { name: /add task/i }));
    });

    it('Get started reveals the tree and marks add-project', async () => {
        const { user } = narrowBoard(plan([]));

        await user.click(screen.getByRole('button', { name: en.weekWelcome.getStarted }));

        expect(document.querySelector('.projectView')).not.toBeNull();
        expect(
            screen.queryByRole('button', { name: en.weekWelcome.getStarted }),
        ).not.toBeInTheDocument();
        // the step's own instruction is on screen, next to the control it names
        expect(screen.getByText(en.weekWelcome.stepProjectBody)).toBeInTheDocument();
        expect(cued()).toBe(tree().getByRole('button', { name: en.projectList.addProject }));
    });

    it('the mark moves to the blank project s name field', () => {
        narrowBoard(plan([project('p1', '')]));

        expect(cued()).toBe(tree().getByPlaceholderText(en.projectCard.namePlaceholder));
    });

    // Names store per keystroke, so only a blur settles one.
    it('a project name being typed holds step one, and blurring advances it', async () => {
        const { user } = narrowBoard(plan([project('p1', 'Linear Algebra')]));
        const name = tree().getByDisplayValue('Linear Algebra');

        await user.click(name);
        expect(cued()).toBe(name);
        expect(screen.getByText(en.weekWelcome.stepProjectBody)).toBeInTheDocument();

        await user.tab();
        expect(screen.getByText(en.weekWelcome.stepTaskBody)).toBeInTheDocument();
        expect(cued()).toBe(tree().getByRole('button', { name: /add task/i }));
    });

    it('a named task settles onto the editor button, the control step three wants', () => {
        narrowBoard(plan([project('p1', 'Linear Algebra', [task('t1', 'read chapter 3')])]));

        expect(screen.getByText(en.weekWelcome.stepDaysBody)).toBeInTheDocument();
        expect(cued()).toBe(tree().getByRole('button', { name: en.taskRow.editTask }));
    });

    it('the assign-days nudge waits its turn while an earlier step is running', () => {
        narrowBoard(plan([project('p1', 'Linear Algebra', [task('t1', '')])]));

        expect(cued()).toBe(tree().getByPlaceholderText(en.taskRow.namePlaceholder));
        expect(tree().queryByText(en.taskRow.assignDays)).not.toBeInTheDocument();
    });

    /* ---- the guide being switched off ---- */

    /*
     * Testing strategy — the board is told whether the guide is wanted; App
     * decides. What these cover is what "off" must NOT mean.
     *
     *   partition on the week: current (no lesson, and the same quiet line any
     *       other empty week gets — not an empty grid) | not current (unchanged:
     *       the quiet line is an empty state, not a lesson, and never depended
     *       on this)
     */

    it('the guide switched off leaves the ordinary empty week', () => {
        narrowBoard(plan([]), 400, false);

        expect(screen.queryByText(en.weekWelcome.stepProject)).not.toBeInTheDocument();
        expect(
            screen.queryByRole('button', { name: en.weekWelcome.getStarted }),
        ).not.toBeInTheDocument();
        expect(screen.getByText(en.weekWelcome.quietTitle)).toBeInTheDocument();
        // the tree is there without asking
        expect(document.querySelector('.projectView')).not.toBeNull();
    });

    it('the guide switched off keeps another week s quiet line', () => {
        render(
            <WeekBoard
                plan={{ weekStart: '2026-08-17', ended: false, projects: [] }}
                onChange={vi.fn()}
                guideEnabled={false}
                onSkipGuide={vi.fn()}
            />,
        );

        expect(screen.getByText(en.weekWelcome.quietTitle)).toBeInTheDocument();
    });

    it('an unmeasurable container keeps the wide board rather than guessing narrow', () => {
        board(plan([]));

        expect(document.querySelector('.projectView')).not.toBeNull();
        expect(
            screen.queryByRole('button', { name: en.weekWelcome.getStarted }),
        ).not.toBeInTheDocument();
    });

    // A container that lays out at 0 is detached, display:none, or an engine
    // that does not lay out at all — never a very narrow phone.
    it('a container measuring zero is treated as no answer, not as narrow', () => {
        narrowBoard(plan([]), 0);

        expect(document.querySelector('.projectView')).not.toBeNull();
        expect(
            screen.queryByRole('button', { name: en.weekWelcome.getStarted }),
        ).not.toBeInTheDocument();
    });
});
