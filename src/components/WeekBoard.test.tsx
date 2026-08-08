import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WeekBoard } from './WeekBoard';
import type { Project, Subtask, Task, WeekPlan, DayOfWeek } from '@/core/types';

describe('WeekBoard', () => {
    /*
     * Testing strategy — WeekBoard owns no data of its own. It holds the four
     * "what is open" states (task editor, deadline editor, move popover, the two
     * confirms) and turns a child's callback into a core producer applied through
     * onChange. So the failures worth catching are: a destructive action that
     * does NOT ask first, a confirm that asks about the wrong thing, an action
     * wired to the wrong producer, and a frozen week still offering edits.
     *
     * onChange takes an UPDATER, so a test asserts by applying the updater it was
     * handed to the plan and inspecting the result — that checks which producer
     * ran and with what, without reaching into the component.
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
        render(<WeekBoard plan={p} onChange={onChange} />);
        return {
            onChange,
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
    // every subtask control appears twice — scope to the grid to pick one.
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

        await user.click(tree().getByRole('button', { name: 'Delete project' }));

        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        expect(result().projects).toHaveLength(0);
        expect(onChange).toHaveBeenCalledTimes(1);
    });

    it('asks before deleting a project that has tasks', async () => {
        const { onChange, user } = board(plan([project('p1', 'English', [task('t1', 'Essay')])]));

        await user.click(tree().getByRole('button', { name: 'Delete project' }));

        expect(screen.getByRole('dialog')).toBeInTheDocument();
        expect(onChange).not.toHaveBeenCalled(); // nothing happens until confirmed
    });

    it('deletes an empty task outright, without a confirm', async () => {
        const { user, result } = board(plan([project('p1', 'English', [task('t1', 'Essay')])]));

        await user.click(tree().getByRole('button', { name: 'Delete task' }));

        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        expect(result().projects[0]?.tasks).toHaveLength(0);
    });

    it('asks before deleting a task that has subtasks', async () => {
        const { onChange, user } = board(
            plan([project('p1', 'English', [task('t1', 'Essay', [sub('s1', 'mon')])])]),
        );

        await user.click(tree().getByRole('button', { name: 'Delete task' }));

        expect(screen.getByRole('dialog')).toBeInTheDocument();
        expect(onChange).not.toHaveBeenCalled();
    });

    // The confirm has to name what is about to go. A dialog that says "project"
    // while deleting a task, or reports the wrong count, is worse than none —
    // it buys consent for something other than what happens.
    it('the project confirm names the project and counts its tasks', async () => {
        const { user } = board(
            plan([project('p1', 'English', [task('t1', 'Essay'), task('t2', 'Notes')])]),
        );

        await user.click(tree().getByRole('button', { name: 'Delete project' }));

        const dialog = screen.getByRole('dialog');
        expect(within(dialog).getByText(/Delete project "English"\?/)).toBeInTheDocument();
        expect(within(dialog).getByText(/its 2 tasks\./)).toBeInTheDocument();
    });

    it('the task confirm names the task, its project, and counts its subtasks', async () => {
        const { user } = board(
            plan([
                project('p1', 'English', [
                    task('t1', 'Essay', [sub('s1', 'mon'), sub('s2', 'tue'), sub('s3', 'wed')]),
                ]),
            ]),
        );

        await user.click(tree().getByRole('button', { name: 'Delete task' }));

        const dialog = screen.getByRole('dialog');
        expect(within(dialog).getByText(/Delete task "Essay"\?/)).toBeInTheDocument();
        expect(within(dialog).getByText('English')).toBeInTheDocument();
        expect(within(dialog).getByText(/its 3 subtasks\./)).toBeInTheDocument();
    });

    // One task, not "1 tasks". The singular is a branch, so it is a test.
    it('counts of one read as singular', async () => {
        const { user } = board(plan([project('p1', 'English', [task('t1', 'Essay')])]));

        await user.click(tree().getByRole('button', { name: 'Delete project' }));

        expect(screen.getByText(/its 1 task\./)).toBeInTheDocument();
    });

    // A project can be deleted before it is named, and "Delete project ""?" is
    // not a question anyone can answer.
    it('an unnamed project is called Untitled in the confirm', async () => {
        const { user } = board(plan([project('p1', '', [task('t1', 'Essay')])]));

        await user.click(tree().getByRole('button', { name: 'Delete project' }));

        expect(screen.getByText(/Delete project "Untitled"\?/)).toBeInTheDocument();
    });

    it('confirming the delete removes the project and its tasks', async () => {
        const { user, result } = board(
            plan([project('p1', 'English', [task('t1', 'Essay')]), project('p2', 'Maths')]),
        );

        await user.click(tree().getAllByRole('button', { name: 'Delete project' })[0]!);
        await user.click(screen.getByRole('button', { name: 'Delete' }));

        expect(result().projects.map((p) => p.id)).toEqual(['p2']);
    });

    it('dismissing the delete changes nothing', async () => {
        const { onChange, user } = board(plan([project('p1', 'English', [task('t1', 'Essay')])]));

        await user.click(tree().getByRole('button', { name: 'Delete project' }));
        await user.click(screen.getByRole('button', { name: 'Cancel' }));

        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        expect(onChange).not.toHaveBeenCalled();
    });

    /* ---- missed days: the day-15 rule ---- */

    // Moving a subtask off a past day parks a miss on the day it left, so the
    // week still records that the work did not happen then. Dropping the miss
    // would let a slipped subtask look like it was never scheduled.
    it('a move marked missed records the miss on the day left behind', async () => {
        const { user, result } = board(
            plan([project('p1', 'English', [task('t1', 'Essay', [sub('s1', 'mon')])])]),
        );

        await user.click(grid().getByRole('button', { name: 'Move to another day' }));
        // pick-then-confirm: choosing a day only stages it
        await user.click(screen.getByRole('button', { name: 'Thu' }));
        await user.click(screen.getByRole('button', { name: 'Move' }));

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

        await user.click(grid().getByRole('button', { name: 'Clear this missed mark' }));
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

        await user.click(grid().getByRole('button', { name: 'Clear this missed mark' }));
        await user.click(screen.getByRole('button', { name: 'Cancel' }));

        expect(onChange).not.toHaveBeenCalled();
    });

    /* ---- opening the right editor ---- */

    // A subtask has no editor of its own — clicking one opens the editor for the
    // TASK that owns it. Resolving that parent is real indirection, and getting
    // it wrong opens someone else's task.
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

        await user.click(tree().getByRole('button', { name: 'Edit task' }));
        await user.type(screen.getByLabelText('Note'), 'from the syllabus');
        await user.click(screen.getByRole('button', { name: 'Save' }));

        expect(result().projects[0]?.tasks[0]?.description).toBe('from the syllabus');
        expect(screen.queryByRole('heading', { name: 'Essay' })).not.toBeInTheDocument();
    });

    it('the deadline editor writes to the project it was opened from', async () => {
        const { user, result } = board(plan([project('p1', 'English'), project('p2', 'Maths')]));

        await user.click(tree().getAllByRole('button', { name: 'Set deadline' })[1]!);
        await user.type(screen.getByLabelText('Deadline'), '2026-09-01');
        await user.click(screen.getByRole('button', { name: 'Save' }));

        const after = result().projects;
        expect(after[1]?.deadline).toBe('2026-09-01');
        expect(after[0]?.deadline).toBeUndefined();
    });

    /* ---- adding ---- */

    it('adds a project to the board', async () => {
        const { user, result } = board(plan([]));

        await user.click(screen.getByRole('button', { name: '+ add project' }));

        expect(result().projects).toHaveLength(1);
    });

    it('adds a task to the project it was asked for', async () => {
        const { user, result } = board(plan([project('p1', 'English'), project('p2', 'Maths')]));

        await user.click(tree().getAllByRole('button', { name: /add task/ })[1]!);

        const after = result().projects;
        expect(after[1]?.tasks).toHaveLength(1);
        expect(after[0]?.tasks).toHaveLength(0);
    });

    /* ---- an ended week is a record, not a board ---- */

    // The edits were already no-ops for an ended plan (putWeek refuses one); the
    // gate is about not OFFERING them. `inert` is the mechanism, and unlike the
    // CSS-only hiding elsewhere it is a real attribute jsdom reflects.
    it('an ended week freezes the project tree', () => {
        board(plan([project('p1', 'English', [task('t1', 'Essay')])], true));

        expect(document.querySelector('.projectView')).toHaveAttribute('inert');
    });

    it('a live week does not', () => {
        board(plan([project('p1', 'English', [task('t1', 'Essay')])]));

        expect(document.querySelector('.projectView')).not.toHaveAttribute('inert');
    });

    // The gate is applied per-region, NOT as one wrapper around the board, and
    // the difference is load-bearing: choosing which day to LOOK at changes
    // nothing about the plan, so it must survive the freeze. Collapsing the
    // three `inert`s into a single blanket wrapper — the obvious simplification,
    // and the one WeekBoard's own comment warns against — would freeze the day
    // picker too and leave an ended week you cannot page through. Walking
    // ancestors, because that is how inert actually reaches a control.
    it('an ended week freezes the day lists but not the day picker', () => {
        board(plan([project('p1', 'English', [task('t1', 'Essay', [sub('s1', 'mon')])])], true));

        expect(document.querySelector('.weekGridPane ul[inert]')).toBeInTheDocument();
        expect(inertlyReachable(grid().getAllByTitle('Focus this day')[0]!)).toBe(false);
    });
});
