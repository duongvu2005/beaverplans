import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DayCell } from './DayCell';
import type { DayEntry } from '@/core/daySchedule';
import type { Subtask } from '@/core/types';

describe('DayCell', () => {
    /*
     * Testing strategy
     *     partition on isMissed: true (ghost: checkbox disabled + unchecked,
     *         "missed" tag + Clear button -> onClearMissed) | false
     *     partition on ended, only reachable when isMissed is false: true and
     *         not done (reads as missed, but with nothing recorded: no "now on
     *         <Day>" note, no Clear button, checkbox disabled) | true and done
     *         | false
     *     partition on isOverdue, only reachable when isMissed and ended are
     *         false: true (past assigned day, current week, not done) | false
     *         because done | false because the assigned day isn't past | false
     *         because the week isn't the current one
     *     partition on subtask.isDone, only reachable when isMissed is false:
     *         true | false -- drives the checkbox's checked state
     *     partition on compact: true (short labels, icon-only action buttons)
     *         | false (full "now on <Day>" / "reschedule?" text + labeled buttons)
     *     partition on description: present | absent
     *     interaction: checkbox click -> onToggleSubtask; clicking the body ->
     *         onEditSubtask; Clear/Move clicks -> onClearMissed/onRequestMove
     *         and stop propagation (do not also fire onEditSubtask)
     */

    function makeSubtask(overrides: Partial<Subtask> = {}): Subtask {
        return {
            id: 's1',
            isDone: false,
            assignedDay: 'mon',
            missedDays: [],
            weight: 2,
            ...overrides,
        };
    }

    function makeEntry(overrides: Partial<DayEntry> = {}): DayEntry {
        return {
            subtask: makeSubtask(),
            taskName: 'Write essay',
            projectName: 'English',
            ...overrides,
        };
    }

    const weekStart = '2026-07-20'; // Monday
    const today = '2026-07-22'; // Wednesday, same week -> current

    const noop = () => {};
    function baseProps(overrides: Record<string, unknown> = {}) {
        return {
            entry: makeEntry(),
            day: 'mon' as const,
            isMissed: false,
            weekStart,
            today,
            ended: false,
            onToggleSubtask: noop,
            onEditSubtask: noop,
            onRequestMove: noop,
            onClearMissed: noop,
            ...overrides,
        };
    }

    it('covers ended true, not done: reads as missed, the same one concept', () => {
        render(<DayCell {...baseProps({ ended: true })} />);
        expect(screen.getByText('missed')).toBeInTheDocument();
        expect(screen.getByRole('checkbox')).toBeDisabled();
        expect(screen.getByRole('checkbox')).not.toBeChecked();
    });

    it('covers ended true, not done, not compact: no "now on" note and no Clear', () => {
        // nothing was RECORDED as missed, so there is nowhere for it to have moved
        // to and nothing to clear — the parts of a real miss that would not be true
        render(<DayCell {...baseProps({ ended: true, compact: false })} />);
        expect(screen.getByText('missed')).toBeInTheDocument();
        expect(screen.queryByText(/now on/)).toBeNull();
        expect(screen.queryByRole('button', { name: 'Clear this missed mark' })).toBeNull();
    });

    it('covers ended true, not done: no overdue tag — a closed week is settled', () => {
        // the assigned day is past within the current week, which is exactly the
        // case that would be overdue on an open week
        render(<DayCell {...baseProps({ ended: true })} />);
        expect(screen.queryByText(/overdue/)).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Move to another day' })).toBeNull();
    });

    it('covers ended true, done: stays done, reads as done, and cannot be un-ticked', () => {
        render(
            <DayCell
                {...baseProps({
                    ended: true,
                    entry: makeEntry({ subtask: makeSubtask({ isDone: true }) }),
                })}
            />,
        );
        expect(screen.queryByText('missed')).toBeNull();
        expect(screen.getByRole('checkbox')).toBeChecked();
        expect(screen.getByRole('checkbox')).toBeDisabled();
    });

    it('covers isOverdue true: past assigned day, current week, not done -> overdue tag + Move button', () => {
        render(
            <DayCell
                {...baseProps({
                    entry: makeEntry({ subtask: makeSubtask({ assignedDay: 'mon' }) }),
                })}
            />,
        );
        expect(screen.getByText(/overdue/)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Move to another day' })).toBeInTheDocument();
    });

    it('covers isOverdue false because done: no overdue tag', () => {
        render(
            <DayCell
                {...baseProps({
                    entry: makeEntry({
                        subtask: makeSubtask({ assignedDay: 'mon', isDone: true }),
                    }),
                })}
            />,
        );
        expect(screen.queryByText(/overdue/)).not.toBeInTheDocument();
        expect(screen.getByRole('checkbox')).toBeChecked();
    });

    it('covers isOverdue false because the assigned day is not past (today): no overdue tag', () => {
        render(
            <DayCell
                {...baseProps({
                    day: 'wed',
                    entry: makeEntry({ subtask: makeSubtask({ assignedDay: 'wed' }) }),
                })}
            />,
        );
        expect(screen.queryByText(/overdue/)).not.toBeInTheDocument();
    });

    it('covers isOverdue false because the week is not current: no overdue tag even for a past-looking day', () => {
        render(
            <DayCell
                {...baseProps({
                    weekStart: '2026-07-27', // next week, so this week is "future" relative to today
                    entry: makeEntry({ subtask: makeSubtask({ assignedDay: 'mon' }) }),
                })}
            />,
        );
        expect(screen.queryByText(/overdue/)).not.toBeInTheDocument();
    });

    it('covers isMissed true: checkbox disabled and unchecked, missed tag shown, Clear button present', () => {
        render(
            <DayCell
                {...baseProps({
                    isMissed: true,
                    entry: makeEntry({
                        subtask: makeSubtask({ assignedDay: 'wed', isDone: true }),
                    }),
                })}
            />,
        );
        const checkbox = screen.getByRole('checkbox');
        expect(checkbox).toBeDisabled();
        expect(checkbox).not.toBeChecked();
        expect(screen.getByText(/missed/)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Clear this missed mark' })).toBeInTheDocument();
    });

    it('covers compact true: short "missed" label, no "Clear" text on the button', () => {
        render(<DayCell {...baseProps({ isMissed: true, compact: true })} />);
        expect(screen.getByText('missed')).toBeInTheDocument();
        expect(
            screen.getByRole('button', { name: 'Clear this missed mark' }),
        ).not.toHaveTextContent('Clear');
    });

    it('covers compact false: full "missed · now on <Day>" text, "Clear" label on the button', () => {
        render(<DayCell {...baseProps({ isMissed: true, day: 'mon', compact: false })} />);
        expect(screen.getByText('missed · now on Mon')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Clear this missed mark' })).toHaveTextContent(
            'Clear',
        );
    });

    it('covers description present: rendered as a separate line', () => {
        render(
            <DayCell
                {...baseProps({
                    entry: makeEntry({ subtask: makeSubtask({ description: 'bring markers' }) }),
                })}
            />,
        );
        expect(screen.getByText('bring markers')).toBeInTheDocument();
    });

    it('covers description absent: no extra description text rendered', () => {
        render(<DayCell {...baseProps()} />);
        expect(screen.queryByText('bring markers')).not.toBeInTheDocument();
    });

    it('covers clicking the checkbox: calls onToggleSubtask(subtask.id)', async () => {
        const user = userEvent.setup();
        const onToggleSubtask = vi.fn();
        render(
            <DayCell
                {...baseProps({
                    day: 'wed',
                    entry: makeEntry({ subtask: makeSubtask({ assignedDay: 'wed' }) }),
                    onToggleSubtask,
                })}
            />,
        );

        await user.click(screen.getByRole('checkbox'));

        expect(onToggleSubtask).toHaveBeenCalledWith('s1');
    });

    it('covers clicking the body: calls onEditSubtask(subtask.id)', async () => {
        const user = userEvent.setup();
        const onEditSubtask = vi.fn();
        render(
            <DayCell
                {...baseProps({
                    day: 'wed',
                    entry: makeEntry({ subtask: makeSubtask({ assignedDay: 'wed' }) }),
                    onEditSubtask,
                })}
            />,
        );

        await user.click(screen.getByText('Write essay'));

        expect(onEditSubtask).toHaveBeenCalledWith('s1');
    });

    it('covers clicking Clear: calls onClearMissed(id, day) and does not also fire onEditSubtask', async () => {
        const user = userEvent.setup();
        const onClearMissed = vi.fn();
        const onEditSubtask = vi.fn();
        render(
            <DayCell
                {...baseProps({ isMissed: true, day: 'tue', onClearMissed, onEditSubtask })}
            />,
        );

        await user.click(screen.getByRole('button', { name: 'Clear this missed mark' }));

        expect(onClearMissed).toHaveBeenCalledWith('s1', 'tue');
        expect(onEditSubtask).not.toHaveBeenCalled();
    });

    it('covers clicking Move: calls onRequestMove(id) and does not also fire onEditSubtask', async () => {
        const user = userEvent.setup();
        const onRequestMove = vi.fn();
        const onEditSubtask = vi.fn();
        render(
            <DayCell
                {...baseProps({
                    entry: makeEntry({ subtask: makeSubtask({ assignedDay: 'mon' }) }),
                    onRequestMove,
                    onEditSubtask,
                })}
            />,
        );

        await user.click(screen.getByRole('button', { name: 'Move to another day' }));

        expect(onRequestMove).toHaveBeenCalledWith('s1');
        expect(onEditSubtask).not.toHaveBeenCalled();
    });
});
