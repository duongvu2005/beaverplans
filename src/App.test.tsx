import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';
import { overallProgress } from './core/progress';
import { earliestActiveWeek, endedWeeks, isValidWeeks, putWeek } from './core/weeks';
import { sampleWeek } from './fixtures/sampleWeek';
import { sampleArchive } from './fixtures/sampleArchive';
import type { Weeks } from './core/types';

// The app's state is one collection of weeks (see plan/week-model.md). These
// cover the seeding and the derivations App does on it, plus a render smoke
// check; the operations themselves are tested in core/weeks.test.ts.
describe('App under the weeks model', () => {
    const seed: Weeks = [sampleWeek, ...sampleArchive].reduce<Weeks>(putWeek, []);

    it('seeding the fixtures through putWeek sorts them and satisfies the rep invariant', () => {
        expect(isValidWeeks(seed)).toBe(true);
        expect(seed.map((week) => week.weekStart)).toEqual([
            '2025-12-15',
            '2025-12-22',
            '2026-06-22',
            '2026-06-29',
            '2026-07-06',
            '2026-07-13',
            '2026-07-20',
        ]);
    });

    it('the archive is exactly the ended weeks — the active week is not in it', () => {
        expect(endedWeeks(seed).map((week) => week.weekStart)).toEqual([
            '2025-12-15',
            '2025-12-22',
            '2026-06-22',
            '2026-06-29',
            '2026-07-06',
            '2026-07-13',
        ]);
        expect(endedWeeks(seed)).not.toContain(sampleWeek);
    });

    it('the landing week is the oldest week still waiting to be ended', () => {
        // Every fixture week but sampleWeek is ended, so once its week is not in
        // the future it is the one the app opens on, whatever the date.
        expect(earliestActiveWeek(seed, '2026-08-31')).toBe('2026-07-20');
        expect(earliestActiveWeek(seed, '2026-07-20')).toBe('2026-07-20');
        // Before that week exists to be worked on, the app opens on the current week.
        expect(earliestActiveWeek(seed, '2026-07-13')).toBe('2026-07-13');
    });

    it('renders the plan pane', () => {
        render(<App />);
        expect(screen.getByLabelText('Previous week')).toBeTruthy();
        expect(screen.getByRole('button', { name: 'plan' })).toBeTruthy();
    });

    // The landing week (2026-07-20) is active and has work, so both actions are
    // live on it: it is the head of the end-week queue, and being past does not
    // stop its plan being pushed forward. Both stay true however long after that
    // date the suite runs, so neither depends on the clock beyond "not before
    // July 2026".
    it('End week and Move are both live on the landing week', () => {
        render(<App />);
        expect(screen.getByRole('button', { name: /^End week/ }).hasAttribute('disabled')).toBe(
            false,
        );
        const move = screen.getByRole('button', { name: /Move this week's work/ });
        expect(move.hasAttribute('disabled')).toBe(false);
    });

    it('an ended week offers no editing controls, but the day picker still works', async () => {
        const user = userEvent.setup();
        render(<App />);
        await user.click(screen.getByRole('button', { name: /^End week/ }));
        await user.click(screen.getByRole('button', { name: 'Clear all' }));
        await user.click(screen.getByLabelText('Previous week')); // back onto it

        const projects = document.querySelector('.projectView');
        expect(projects?.hasAttribute('inert')).toBe(true);
        // the affordances are still IN the DOM (reading the week is the point);
        // inert is what stops any of them being offered
        expect(projects?.querySelectorAll('button').length).toBeGreaterThan(0);

        // picking which day to look at is navigation, not an edit, and it is
        // not inside that inert region — it must keep working on a frozen week
        await user.click(screen.getAllByTitle('Focus this day')[0]!);
        expect(screen.getByText(/Focusing/)).toBeTruthy();
    });

    // The fixtures leave a six-month hole between 2025-12-22 and 2026-06-22, and
    // weekAt hands back a blank un-ended plan for every week in it. Those weeks
    // used to render a fully live board, and one edit there stored an ACTIVE
    // entry before an ended one — a collection isValidWeeks rejects, and it is
    // also the validator for stored JSON. The guard is UI-side and temporary;
    // see the note on isValidWeeks.
    it('a free week inside the archive is readable but not plannable', async () => {
        const user = userEvent.setup();
        render(<App />);

        // 2026-07-20 is the landing week; step back past the whole archive into
        // the hole. Eight steps lands on 2026-05-25, which has no entry and sits
        // before the last ended week (2026-07-13).
        for (let i = 0; i < 8; i++) {
            await user.click(screen.getByLabelText('Previous week'));
        }
        expect(screen.getByText('May 25 – May 31')).toBeTruthy();

        const projects = document.querySelector('.projectView');
        expect(projects?.hasAttribute('inert')).toBe(true);
        expect(screen.getByText(/sits behind your archive/)).toBeTruthy();
    });

    // A week named on another tab is a link to it. Setting the week without also
    // switching tabs would leave the click looking like it did nothing.
    it('opening the best week from Stats switches tab and week together', async () => {
        const user = userEvent.setup();
        render(<App />);

        await user.click(screen.getByRole('button', { name: 'stats' }));
        const ref = screen.getByRole('button', { name: /^Go to / });
        const week = ref.textContent;
        await user.click(ref);

        expect(screen.getByRole('button', { name: 'plan' })).toHaveAttribute(
            'aria-current',
            'page',
        );
        expect(screen.getByText(week ?? '')).toBeTruthy();
    });

    it('ending a week with carry-forward archives it whole and moves the view on', async () => {
        const user = userEvent.setup();
        render(<App />);

        await user.click(screen.getByRole('button', { name: /^End week/ }));
        await user.click(screen.getByRole('button', { name: 'Carry forward' }));

        // The view followed the carry onto the following week, which now holds the
        // work that was left over — and is itself the earliest active week, so it
        // is the next one up to be ended.
        expect(screen.getByRole('button', { name: /^End week/ }).hasAttribute('disabled')).toBe(
            false,
        );

        // The ended week is archived WHOLE: its row reports the week's real
        // done/total, unfinished work included. A partition-style end, which keeps
        // only the finished half behind, would have recorded it as n/n.
        await user.click(screen.getByRole('button', { name: 'archive' }));
        const { done, total } = overallProgress(sampleWeek.projects);
        expect(done).toBeLessThan(total); // the fixture has to be partial for this to bite
        expect(screen.getByText(`${done}/${total} done`)).toBeTruthy();
    });
});
