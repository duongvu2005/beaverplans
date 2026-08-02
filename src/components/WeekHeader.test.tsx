import { describe, it, expect, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WeekHeader } from './WeekHeader';

// 2026-07-27 is a Monday; today falls inside its week.
const THIS_WEEK = '2026-07-27';
const TODAY = '2026-07-30';

// The sheet is portalled to document.body, so the render container holds the
// header and only the header. Every helper below is scoped to one or the other
// on purpose: "End week" names a button in both places, and a screen-wide query
// would keep finding the header's while the sheet is open.
let root: HTMLElement;

function setup(overrides: Partial<Parameters<typeof WeekHeader>[0]> = {}) {
    const onView = vi.fn();
    const onMoveWork = vi.fn();
    const onEndWeek = vi.fn();
    const view = render(
        <WeekHeader
            weekStart={THIS_WEEK}
            today={TODAY}
            progress={{ done: 5, total: 13 }}
            canMove
            canEnd
            minWeekStart="2026-06-01"
            maxWeekStart="2026-10-19"
            destinationBlockedReason={() => undefined}
            onView={onView}
            onMoveWork={onMoveWork}
            onEndWeek={onEndWeek}
            {...overrides}
        />,
    );
    root = view.container;
    return { ...view, onView, onMoveWork, onEndWeek, user: userEvent.setup() };
}

const back = () => within(root).getByRole('button', { name: /previous week|earlier destination/i });
const forward = () => within(root).getByRole('button', { name: /next week|later destination/i });
const today = () => within(root).getByRole('button', { name: /today|cancel/i });
// the accessible name spells the action out and changes with state ("…cannot be
// moved", "Pick a week to move this work onto"), so match on the verb alone
const move = () => within(root).getByRole('button', { name: /move/i });
const end = () => within(root).getByRole('button', { name: /^end week$/i });
const manage = () => within(root).getByRole('button', { name: /^manage$/i });

const sheet = () => screen.getByRole('dialog');
const sheetMove = () => within(sheet()).getByRole('button', { name: /move this week/i });
const sheetEnd = () => within(sheet()).getByRole('button', { name: /^end week/i });
const sheetCancel = () => within(sheet()).getByRole('button', { name: /^cancel$/i });

describe('WeekHeader', () => {
    /*
     * Testing strategy
     *     partition on mode: idle | armed
     *     partition on viewed week: current | not current
     *     partition on canMove: true | false
     *     partition on canEnd: true | false
     *     partition on bounds: at min | at max | interior
     *     partition on the armed destination: the source itself (commit dead)
     *         | earlier than the source | later than the source
     *     partition on note: absent | present | overridden by move mode
     *     partition on the sheet: closed | open | dismissed by each of its items
     *     cross-cutting: every control is in the DOM in every state (the
     *         layout-stability rule — state may only change disabled/text)
     */

    it('covers idle, current week: names the week, disables Today, offers both actions', () => {
        setup();
        expect(screen.getByText('This week')).toHaveAttribute('data-now', 'true');
        expect(screen.getByText('Jul 27 – Aug 02')).toBeInTheDocument();
        expect(today()).toBeDisabled();
        expect(move()).toBeEnabled();
        expect(end()).toBeEnabled();
        expect(move()).toHaveTextContent('Move work');
    });

    it('covers the gauge: reports done/total and the rounded percentage', () => {
        setup({ progress: { done: 5, total: 13 } });
        expect(screen.getByText(/5\/13/)).toBeInTheDocument();
        expect(screen.getByText(/38%/)).toBeInTheDocument();
    });

    it('covers idle, not the current week: Today enabled and returns to it', async () => {
        const { user, onView } = setup({ weekStart: '2026-07-13' });
        expect(screen.getByText('2 weeks ago')).not.toHaveAttribute('data-now', 'true');
        expect(today()).toBeEnabled();
        await user.click(today());
        expect(onView).toHaveBeenCalledWith(THIS_WEEK);
    });

    it('covers idle: arrows step the view, not the destination', async () => {
        const { user, onView } = setup();
        await user.click(forward());
        expect(onView).toHaveBeenCalledWith('2026-08-03');
        await user.click(back());
        expect(onView).toHaveBeenCalledWith('2026-07-20');
    });

    it('covers bounds: an arrow at its limit is disabled, never absent', () => {
        setup({ weekStart: '2026-06-01', minWeekStart: '2026-06-01' });
        expect(back()).toBeDisabled();
        expect(forward()).toBeEnabled();
    });

    it('covers canMove false: Move disabled, everything else untouched', () => {
        setup({ canMove: false });
        expect(move()).toBeDisabled();
        expect(back()).toBeEnabled();
        expect(forward()).toBeEnabled();
    });

    it('covers canEnd false: End week disabled and never fires', async () => {
        const { user, onEndWeek } = setup({ canEnd: false });
        expect(end()).toBeDisabled();
        await user.click(end());
        expect(onEndWeek).not.toHaveBeenCalled();
    });

    it('covers canEnd true: End week hands off to the caller', async () => {
        const { user, onEndWeek } = setup();
        await user.click(end());
        expect(onEndWeek).toHaveBeenCalledOnce();
    });

    it('covers arming: aims at the source itself, Today becomes Cancel, no mutation yet', async () => {
        const { user, onMoveWork, container } = setup();
        await user.click(move());
        expect(container.querySelector('[data-mode="armed"]')).toBeInTheDocument();
        expect(screen.getByText('Move to')).toBeInTheDocument();
        expect(today()).toHaveAccessibleName(/cancel/i);
        // the readout and the confirm button both name the destination, which
        // starts as the week being moved
        expect(screen.getByText('Jul 27 – Aug 02')).toBeInTheDocument();
        expect(move()).toHaveTextContent('Jul 27');
        // and committing is dead until a different week is picked
        expect(move()).toBeDisabled();
        expect(onMoveWork).not.toHaveBeenCalled();
    });

    it('covers armed: arrows retarget the destination, backward as freely as forward', async () => {
        const { user, onView } = setup();
        await user.click(move());
        await user.click(back());
        // a move may aim EARLIER than its source, so stepping back off the source
        // is a legal first choice, not a blocked one
        expect(move()).toHaveTextContent('Jul 20');
        expect(move()).toBeEnabled();
        await user.click(forward());
        await user.click(forward());
        expect(move()).toHaveTextContent('Aug 03');
        expect(onView).not.toHaveBeenCalled();
    });

    it('covers armed: End week goes dead, so one decision cannot land during another', async () => {
        const { user, onEndWeek } = setup();
        expect(end()).toBeEnabled();
        await user.click(move());
        expect(end()).toBeDisabled();
        await user.click(end());
        expect(onEndWeek).not.toHaveBeenCalled();
        await user.click(today()); // cancel
        expect(end()).toBeEnabled();
    });

    it('covers armed, aimed back at the source: commit is disabled again', async () => {
        const { user } = setup();
        await user.click(move());
        await user.click(forward());
        expect(move()).toBeEnabled();
        await user.click(back()); // back onto the source
        expect(move()).toBeDisabled();
    });

    it('covers armed, aimed at a blocked destination: commit disabled, reason shown, no mutation', async () => {
        const blocked = '2026-08-03';
        const { user, onMoveWork } = setup({
            destinationBlockedReason: (weekStart) =>
                weekStart === blocked ? 'This week already has work in it.' : undefined,
        });
        await user.click(move());
        await user.click(forward());
        expect(move()).toBeDisabled();
        expect(screen.getByText('This week already has work in it.')).toBeInTheDocument();
        await user.click(move());
        expect(onMoveWork).not.toHaveBeenCalled();
        // stepping off the blocked destination clears the reason and re-enables commit
        await user.click(forward());
        expect(move()).toBeEnabled();
    });

    it('covers armed: a second click commits the move', async () => {
        const { user, onMoveWork } = setup();
        await user.click(move());
        await user.click(forward());
        await user.click(move());
        expect(onMoveWork).toHaveBeenCalledWith(THIS_WEEK, '2026-08-03');
        expect(screen.getByText('This week')).toBeInTheDocument();
    });

    it('covers armed: Cancel leaves move mode and changes nothing', async () => {
        const { user, onMoveWork, onView, container } = setup();
        await user.click(move());
        await user.click(today());
        expect(container.querySelector('[data-mode="armed"]')).not.toBeInTheDocument();
        expect(screen.getByText('This week')).toBeInTheDocument();
        expect(onMoveWork).not.toHaveBeenCalled();
        expect(onView).not.toHaveBeenCalled();
    });

    it('covers the note: shown when given, replaced by move mode, gone on cancel', async () => {
        const { user } = setup({ note: 'End Jul 20 – Jul 26 first.' });
        expect(screen.getByText('End Jul 20 – Jul 26 first.')).toBeInTheDocument();
        await user.click(move());
        expect(screen.queryByText('End Jul 20 – Jul 26 first.')).not.toBeInTheDocument();
        expect(screen.getByText(/arrows now pick/i)).toBeInTheDocument();
        await user.click(today());
        expect(screen.getByText('End Jul 20 – Jul 26 first.')).toBeInTheDocument();
    });

    it('covers no note: nothing is rendered in its place', () => {
        setup();
        expect(screen.queryByText(/archive|nothing planned|arrows now pick/i)).toBeNull();
    });

    it('covers ended: the block is marked frozen', () => {
        const { container } = setup({ ended: true, canMove: false, canEnd: false });
        expect(container.querySelector('[data-mode="ended"]')).toBeInTheDocument();
    });

    it('covers the sheet: opens from Manage and closes on Cancel', async () => {
        const { user } = setup();
        expect(screen.queryByRole('dialog')).toBeNull();
        await user.click(manage());
        expect(sheet()).toBeInTheDocument();
        await user.click(sheetCancel());
        expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('covers the sheet: picking Move closes it and arms, never stacking a second layer', async () => {
        const { user, container } = setup();
        await user.click(manage());
        await user.click(sheetMove());
        expect(screen.queryByRole('dialog')).toBeNull();
        expect(container.querySelector('[data-mode="armed"]')).toBeInTheDocument();
    });

    it('covers the sheet: picking End week closes it before the caller opens anything', async () => {
        const { user, onEndWeek } = setup();
        await user.click(manage());
        await user.click(sheetEnd());
        expect(screen.queryByRole('dialog')).toBeNull();
        expect(onEndWeek).toHaveBeenCalledOnce();
    });

    it('covers the sheet: its items mirror what the week allows', async () => {
        const { user } = setup({ canMove: false });
        await user.click(manage());
        expect(sheetMove()).toBeDisabled();
        expect(sheetEnd()).toBeEnabled();
    });

    it('covers Manage: dead only when neither action is available', () => {
        setup({ canMove: false, canEnd: false });
        expect(manage()).toBeDisabled();
        cleanup();
        setup({ canMove: false });
        expect(manage()).toBeEnabled();
    });

    it('covers the layout-stability rule: the same six controls exist in every state', async () => {
        // idle on the current week, then armed
        const { user, container } = setup();
        expect(container.querySelectorAll('button')).toHaveLength(6);
        await user.click(move());
        expect(container.querySelectorAll('button')).toHaveLength(6);
        await user.click(today()); // back to idle
        expect(container.querySelectorAll('button')).toHaveLength(6);

        // an ended week pinned at the back bound — every control disabled that
        // can be, none of them gone
        cleanup();
        const { container: bounded } = setup({
            canMove: false,
            canEnd: false,
            ended: true,
            weekStart: '2026-06-01',
            minWeekStart: '2026-06-01',
        });
        expect(bounded.querySelectorAll('button')).toHaveLength(6);
    });
});
