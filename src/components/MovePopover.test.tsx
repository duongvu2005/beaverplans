import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MovePopover } from './MovePopover';
import type { Subtask } from '@/core/types';

describe('MovePopover', () => {
    /*
     * Testing strategy
     *     partition on fromPast (status of subtask.assignedDay): true (shows
     *         the "mark missed" checkbox, checked by default) | false (checkbox
     *         absent, willMark always false regardless of markMissed's default)
     *     partition on a day pill's disabled reason: the current day (isCurrent,
     *         also carries the "Currently on this day" title) | blocked by the
     *         missed-day rule (canMoveSubtaskTo false) but otherwise not past
     *         and not current | a plain past day in the current week, not
     *         otherwise blocked | none of the above (enabled, pickable)
     *     partition on Move: no day picked (button stays disabled) | a day
     *         picked, forward of assignedDay, fromPast and markMissed checked
     *         -> onMove(day, true) | fromPast but markMissed unchecked ->
     *         onMove(day, false) | not fromPast -> onMove(day, false) regardless
     *     Cancel -> onClose, not onMove
     */

    function makeSubtask(overrides: Partial<Subtask> = {}): Subtask {
        return {
            id: 's1',
            isDone: false,
            assignedDay: 'mon',
            missedDays: [],
            weight: 1,
            ...overrides,
        };
    }

    const noop = () => {};

    // weekStart is a Monday; today=Fri makes mon..thu past and mon the assigned
    // (current) day, so fromPast is true and there is no missed-day history.
    const weekStart = '2026-07-20';
    const fromPastProps = {
        subtask: makeSubtask({ assignedDay: 'mon', missedDays: [] }),
        taskName: 'Draft essay',
        projectName: 'English',
        weekStart,
        today: '2026-07-24', // Friday
        onMove: noop,
        onClose: noop,
    };

    it('covers fromPast true: "mark missed" checkbox shown, checked by default', () => {
        render(<MovePopover {...fromPastProps} />);
        expect(screen.getByRole('checkbox', { name: /Mark Mon as missed/ })).toBeChecked();
    });

    it('covers fromPast false: no "mark missed" checkbox', () => {
        render(
            <MovePopover
                {...fromPastProps}
                subtask={makeSubtask({ assignedDay: 'thu', missedDays: ['mon'] })}
                today="2026-07-20" // Monday: "thu" is still in the future
            />,
        );
        expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    });

    it('covers the current day: disabled, titled "Currently on this day"', () => {
        render(<MovePopover {...fromPastProps} />);
        const monPill = screen.getByRole('button', { name: 'Mon' });
        expect(monPill).toBeDisabled();
        expect(monPill).toHaveAttribute('title', 'Currently on this day');
    });

    it('covers a plain past day, not current: disabled, no title', () => {
        render(<MovePopover {...fromPastProps} />);
        const tuePill = screen.getByRole('button', { name: 'Tue' });
        expect(tuePill).toBeDisabled();
        expect(tuePill).not.toHaveAttribute('title');
    });

    it('covers a day blocked by the missed-day rule, not itself past or current: disabled', () => {
        // assignedDay thu, missed mon; today=mon, so "mon" reads as status
        // "today" (not past) and is not the current assigned day -- isolating
        // the canMoveSubtaskTo-false reason from the past/current reasons.
        render(
            <MovePopover
                {...fromPastProps}
                subtask={makeSubtask({ assignedDay: 'thu', missedDays: ['mon'] })}
                today="2026-07-20"
            />,
        );
        expect(screen.getByRole('button', { name: 'Mon' })).toBeDisabled();
    });

    it('covers an enabled day: clicking it picks it (aria-pressed true) and enables Move', async () => {
        const user = userEvent.setup();
        render(<MovePopover {...fromPastProps} />);
        const moveBtn = screen.getByRole('button', { name: 'Move' });
        expect(moveBtn).toBeDisabled();

        const friPill = screen.getByRole('button', { name: 'Fri' });
        expect(friPill).not.toBeDisabled();
        await user.click(friPill);

        expect(friPill).toHaveAttribute('aria-pressed', 'true');
        expect(moveBtn).not.toBeDisabled();
    });

    it('covers Move: fromPast true, markMissed checked, forward move -> onMove(day, true)', async () => {
        const user = userEvent.setup();
        const onMove = vi.fn();
        render(<MovePopover {...fromPastProps} onMove={onMove} />);

        await user.click(screen.getByRole('button', { name: 'Fri' }));
        await user.click(screen.getByRole('button', { name: 'Move' }));

        expect(onMove).toHaveBeenCalledWith('fri', true);
    });

    it('covers Move: fromPast true, markMissed unchecked -> onMove(day, false)', async () => {
        const user = userEvent.setup();
        const onMove = vi.fn();
        render(<MovePopover {...fromPastProps} onMove={onMove} />);

        await user.click(screen.getByRole('checkbox', { name: /Mark Mon as missed/ }));
        await user.click(screen.getByRole('button', { name: 'Fri' }));
        await user.click(screen.getByRole('button', { name: 'Move' }));

        expect(onMove).toHaveBeenCalledWith('fri', false);
    });

    it('covers Move: fromPast false -> onMove(day, false) regardless of markMissed', async () => {
        const user = userEvent.setup();
        const onMove = vi.fn();
        render(
            <MovePopover
                {...fromPastProps}
                subtask={makeSubtask({ assignedDay: 'thu', missedDays: ['mon'] })}
                today="2026-07-20"
                onMove={onMove}
            />,
        );

        await user.click(screen.getByRole('button', { name: 'Fri' }));
        await user.click(screen.getByRole('button', { name: 'Move' }));

        expect(onMove).toHaveBeenCalledWith('fri', false);
    });

    it('covers Cancel: calls onClose, not onMove', async () => {
        const user = userEvent.setup();
        const onClose = vi.fn();
        const onMove = vi.fn();
        render(<MovePopover {...fromPastProps} onClose={onClose} onMove={onMove} />);

        await user.click(screen.getByRole('button', { name: 'Cancel' }));

        expect(onClose).toHaveBeenCalledTimes(1);
        expect(onMove).not.toHaveBeenCalled();
    });
});
