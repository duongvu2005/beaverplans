import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TaskEditor } from './TaskEditor';
import type { Task, Subtask, DayOfWeek } from '../core/types';

describe('TaskEditor', () => {
    /*
     * Testing strategy — the editor is a DRAFT over a task: it seeds local state
     * from the task on open, edits that draft, and only on Save hands a rebuilt
     * task back. Nothing is committed until then, so the failures worth catching
     * are (a) the draft not matching what was opened, (b) an edit changing the
     * wrong part of the draft, and (c) Save producing a task that does not match
     * what is on screen.
     *
     *   partition on deadline at open: absent | date-only | datetime | corrupt
     *   partition on the task's shape at open: leaf (no subtasks, has isDone)
     *       | parent (has subtasks)
     *   partition on the edit: none | day toggled on | day toggled off (with one
     *       subtask | with several) | subtask added to an existing day | subtask
     *       removed (one of several | the last on its day | the last overall)
     *       | note edited | weight changed | description edited | deadline set
     *       or cleared
     *   partition on the resulting shape at Save: still a leaf | leaf -> parent
     *       | parent -> leaf | parent -> parent
     *   exit: Save (onSave, one task) | Cancel (onClose, never onSave)
     *
     * NOT covered here, deliberately: the drag handlers (handleDragOver,
     * handleDragEnd). They are a thin shell over moveSubtaskInDraft and
     * beforeIdForDrop, both of which are unit-tested in core/subtaskDraft.test.ts
     * and dndReorder.test.ts against the cases that actually matter. What is left
     * in the component is dnd-kit event plumbing, and dnd-kit in jsdom has no
     * layout to hit-test against — a "drag test" here would fire synthetic events
     * at a collision detector that always sees zero-sized rects, which asserts
     * nothing about a real drag while breaking on every dnd-kit upgrade. The one
     * rule the component adds on top of the pure functions, canMoveSubtaskTo
     * gating an illegal day, is covered in projects.test.ts.
     */

    function makeSubtask(id: string, day: DayOfWeek, extra: Partial<Subtask> = {}): Subtask {
        return { id, isDone: false, assignedDay: day, missedDays: [], weight: 1, ...extra };
    }

    function makeTask(overrides: Partial<Task> = {}): Task {
        return { id: 't1', name: 'Essay', subtasks: [], isDone: false, ...overrides };
    }

    function open(task: Task, onSave = vi.fn(), onClose = vi.fn()) {
        render(<TaskEditor task={task} projectName="English" onClose={onClose} onSave={onSave} />);
        return { onSave, onClose, user: userEvent.setup() };
    }

    /**
     * The day list, which is the only thing in here using the real `hidden`
     * attribute (the per-day hiding is a CSS class, and jsdom applies no
     * stylesheet). Verified to match this element and nothing else.
     */
    function dayListIsHidden(): boolean {
        return document.querySelector('[hidden]') !== null;
    }

    /** The day chip for `name`, e.g. dayChip('Monday'). */
    function dayChip(name: string) {
        return within(screen.getByRole('group', { name: 'Days to work on this task' })).getByRole(
            'button',
            { name },
        );
    }

    /** The single task handed to onSave. */
    function saved(onSave: ReturnType<typeof vi.fn>): Task {
        expect(onSave).toHaveBeenCalledTimes(1);
        // The assertion above guarantees the call exists; the compiler can't see that.
        const [call] = onSave.mock.calls;
        if (call === undefined) throw new Error('onSave was not called');
        return call[0] as Task;
    }

    async function save(user: ReturnType<typeof userEvent.setup>) {
        await user.click(screen.getByRole('button', { name: 'Save' }));
    }

    /* ---- opening: the draft must match the task it was opened on ---- */

    it('names the task and the project it belongs to', () => {
        open(makeTask({ name: 'Essay' }));
        expect(screen.getByRole('heading', { name: 'Essay' })).toBeInTheDocument();
        expect(screen.getByText('English')).toBeInTheDocument();
    });

    // A task can exist before it is named — the tree creates one on Enter — and
    // the dialog still has to be labelled, or it has no accessible name at all.
    it('an unnamed task still gives the dialog something to be called', () => {
        open(makeTask({ name: '' }));
        expect(screen.getByRole('heading', { name: 'Task' })).toBeInTheDocument();
    });

    it('seeds a date-only deadline into the date field, leaving time empty', () => {
        open(makeTask({ deadline: '2026-08-01' }));
        expect(screen.getByLabelText('Deadline')).toHaveValue('2026-08-01');
        expect(document.querySelector('input[type="time"]')).toHaveValue('');
    });

    it('seeds a datetime deadline into both fields', () => {
        open(makeTask({ deadline: '2026-08-01T14:30' }));
        expect(screen.getByLabelText('Deadline')).toHaveValue('2026-08-01');
        expect(document.querySelector('input[type="time"]')).toHaveValue('14:30');
    });

    // Feb 30 parses as a date string but is not a date. Seeding it would put an
    // impossible value in the field and, worse, save it back unchanged on an
    // open-then-Cancel-less round trip that touched nothing else.
    it('ignores a stored deadline that is not a real date', () => {
        open(makeTask({ deadline: '2026-02-30' }));
        expect(screen.getByLabelText('Deadline')).toHaveValue('');
    });

    // The time field is meaningless without a day to attach it to, and buildTask
    // drops a bare time anyway — so the UI must not offer one.
    it('offers a time only once there is a date to attach it to', async () => {
        const { user } = open(makeTask());
        const time = document.querySelector('input[type="time"]') as HTMLInputElement;
        expect(time).toBeDisabled();

        await user.type(screen.getByLabelText('Deadline'), '2026-08-01');

        expect(time).not.toBeDisabled();
    });

    it('shows the day chips pressed for exactly the days that have subtasks', () => {
        open(makeTask({ subtasks: [makeSubtask('s1', 'mon'), makeSubtask('s2', 'thu')] }));
        expect(dayChip('Monday')).toHaveAttribute('aria-pressed', 'true');
        expect(dayChip('Thursday')).toHaveAttribute('aria-pressed', 'true');
        expect(dayChip('Tuesday')).toHaveAttribute('aria-pressed', 'false');
    });

    // A task with no days shows no day list at all, rather than seven empty rows
    // of nothing — and the moment it has one, the list appears.
    it('a task with no days shows no day list', () => {
        open(makeTask());
        expect(dayListIsHidden()).toBe(true);
    });

    it('the day list appears as soon as a day is turned on', async () => {
        const { user } = open(makeTask());

        await user.click(dayChip('Friday'));

        expect(dayListIsHidden()).toBe(false);
    });

    // Every weekday stays MOUNTED even with nothing on it — unused days are
    // hidden in CSS, not unrendered — because a drag has to be able to land on a
    // day the task does not occupy yet. Render only the active days and dnd-kit
    // has no droppable to find, so moving a subtask to a new day stops working
    // while the editor still looks correct.
    it('keeps every weekday mounted, so a drag can reach a day not in use yet', () => {
        open(makeTask({ subtasks: [makeSubtask('s1', 'wed')] }));
        for (const short of ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']) {
            expect(
                screen.getByRole('button', { name: `+ add subtask on ${short}` }),
            ).toBeInTheDocument();
        }
    });

    /* ---- day toggling: the "N days -> N subtasks" rule ---- */

    it('turning a day on gives it exactly one subtask', async () => {
        const { onSave, user } = open(makeTask());

        await user.click(dayChip('Tuesday'));
        await save(user);

        const task = saved(onSave);
        expect(task.subtasks).toHaveLength(1);
        expect(task.subtasks[0]?.assignedDay).toBe('tue');
    });

    // Every subtask on the day goes, not just one. Reaching for the single-remove
    // producer here would leave the day holding subtasks while its chip reads
    // off — the draft and the chips would disagree about the same day.
    it('turning a day off removes every subtask on it, not just the first', async () => {
        const { onSave, user } = open(
            makeTask({
                subtasks: [
                    makeSubtask('s1', 'mon'),
                    makeSubtask('s2', 'mon'),
                    makeSubtask('s3', 'fri'),
                ],
            }),
        );

        await user.click(dayChip('Monday'));
        await save(user);

        expect(saved(onSave).subtasks.map((s) => s.id)).toEqual(['s3']);
    });

    it('a new subtask starts unfinished, unmissed and weight 1', async () => {
        const { onSave, user } = open(makeTask());

        await user.click(dayChip('Saturday'));
        await save(user);

        expect(saved(onSave).subtasks[0]).toMatchObject({
            isDone: false,
            missedDays: [],
            weight: 1,
            assignedDay: 'sat',
        });
    });

    /* ---- adding and removing individual subtasks ---- */

    it('a day can hold more than one subtask', async () => {
        const { onSave, user } = open(makeTask({ subtasks: [makeSubtask('s1', 'wed')] }));

        await user.click(screen.getByRole('button', { name: '+ add subtask on Wed' }));
        await save(user);

        const task = saved(onSave);
        expect(task.subtasks).toHaveLength(2);
        expect(task.subtasks.every((s) => s.assignedDay === 'wed')).toBe(true);
    });

    it('removing the last subtask on a day releases the day chip', async () => {
        const { user } = open(makeTask({ subtasks: [makeSubtask('s1', 'mon')] }));
        expect(dayChip('Monday')).toHaveAttribute('aria-pressed', 'true');

        await user.click(screen.getByRole('button', { name: 'Remove subtask' }));

        expect(dayChip('Monday')).toHaveAttribute('aria-pressed', 'false');
    });

    it('removing one of several leaves the rest alone', async () => {
        const { onSave, user } = open(
            makeTask({
                subtasks: [
                    makeSubtask('s1', 'mon', { description: 'first' }),
                    makeSubtask('s2', 'mon', { description: 'second' }),
                ],
            }),
        );

        const rows = screen.getAllByRole('button', { name: 'Remove subtask' });
        await user.click(rows[0]!);
        await save(user);

        expect(saved(onSave).subtasks.map((s) => s.description)).toEqual(['second']);
    });

    /* ---- notes and weights ---- */

    it('a subtask note reaches the saved task', async () => {
        const { onSave, user } = open(makeTask({ subtasks: [makeSubtask('s1', 'mon')] }));

        await user.type(screen.getByPlaceholderText('add a note (optional)'), 'read ch. 4');
        await save(user);

        expect(saved(onSave).subtasks[0]?.description).toBe('read ch. 4');
    });

    it('a subtask weight reaches the saved task', async () => {
        const { onSave, user } = open(makeTask({ subtasks: [makeSubtask('s1', 'mon')] }));

        await user.click(screen.getAllByRole('radio', { name: 'Hard' })[0]!);
        await save(user);

        expect(saved(onSave).subtasks[0]?.weight).toBe(3);
    });

    // The whole-task note is a different field from the per-subtask one, and both
    // are on screen at once — a wire-up that crossed them would still "work".
    it('the task note is stored on the task, not on a subtask', async () => {
        const { onSave, user } = open(makeTask({ subtasks: [makeSubtask('s1', 'mon')] }));

        await user.type(screen.getByLabelText('Note'), 'due after the exam');
        await save(user);

        const task = saved(onSave);
        expect(task.description).toBe('due after the exam');
        expect(task.subtasks[0]?.description).toBeUndefined();
    });

    it('seeds an existing task note into the field', () => {
        open(makeTask({ description: 'from the syllabus' }));
        expect(screen.getByLabelText('Note')).toHaveValue('from the syllabus');
    });

    /* ---- the saved shape ---- */

    it('a note of only whitespace is dropped rather than stored', async () => {
        const { onSave, user } = open(makeTask());

        await user.type(screen.getByLabelText('Note'), '   ');
        await save(user);

        expect(saved(onSave).description).toBeUndefined();
    });

    it('saving carries the deadline through as date and time', async () => {
        const { onSave, user } = open(makeTask());

        await user.type(screen.getByLabelText('Deadline'), '2026-08-01');
        fireEvent.change(document.querySelector('input[type="time"]') as HTMLInputElement, {
            target: { value: '09:15' },
        });
        await save(user);

        expect(saved(onSave).deadline).toBe('2026-08-01T09:15');
    });

    it('clearing the deadline drops it, and the time with it', async () => {
        const { onSave, user } = open(makeTask({ deadline: '2026-08-01T14:30' }));

        await user.click(screen.getByRole('button', { name: 'Clear' }));
        await save(user);

        expect(saved(onSave).deadline).toBeUndefined();
    });

    // The leaf/parent transition. A task with no subtasks carries isDone; one
    // with subtasks derives doneness from them and must not carry a stale flag,
    // or the two representations can disagree about the same task.
    it('a finished leaf that gains a day loses its own done flag', async () => {
        const { onSave, user } = open(makeTask({ subtasks: [], isDone: true }));

        await user.click(dayChip('Monday'));
        await save(user);

        const task = saved(onSave);
        expect(task.subtasks).toHaveLength(1);
        expect(task.isDone).toBeUndefined();
    });

    it('a task emptied of every subtask becomes an unfinished leaf again', async () => {
        const { onSave, user } = open(
            makeTask({ subtasks: [makeSubtask('s1', 'mon', { isDone: true })], isDone: undefined }),
        );

        await user.click(screen.getByRole('button', { name: 'Remove subtask' }));
        await save(user);

        const task = saved(onSave);
        expect(task.subtasks).toHaveLength(0);
        expect(task.isDone).toBe(false);
    });

    it('saving keeps the task it was opened on, id and name intact', async () => {
        const { onSave, user } = open(makeTask({ id: 't9', name: 'Essay' }));

        await save(user);

        expect(saved(onSave)).toMatchObject({ id: 't9', name: 'Essay' });
    });

    /* ---- exits ---- */

    it('Cancel closes without saving, however much was edited', async () => {
        const { onSave, onClose, user } = open(makeTask());

        await user.click(dayChip('Monday'));
        await user.type(screen.getByLabelText('Note'), 'discarded');
        await user.click(screen.getByRole('button', { name: 'Cancel' }));

        expect(onClose).toHaveBeenCalledTimes(1);
        expect(onSave).not.toHaveBeenCalled();
    });

    // Save hands the task back but does NOT close — App owns that, and a second
    // onSave from one click would apply the same edit twice.
    it('Save reports the edit exactly once', async () => {
        const { onSave, user } = open(makeTask());

        await save(user);

        expect(onSave).toHaveBeenCalledTimes(1);
    });
});
