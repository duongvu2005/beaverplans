import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
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
//
// "Today" is pinned to 2026-07-29 (a Wednesday, week-start 2026-07-27) — one
// week after sampleWeek's own week (2026-07-20). That gap is deliberate: App
// now always lands on the literal current week (see plan/fast-track-log.md),
// so pinning it a week past the fixtures' only active week is what exercises
// the landing-week nudge (queueHead < viewing) instead of landing on that week
// by coincidence.
describe('App under the weeks model', () => {
    const seed: Weeks = [sampleWeek, ...sampleArchive].reduce<Weeks>(putWeek, []);

    beforeEach(() => {
        vi.useFakeTimers({ toFake: ['Date'] });
        vi.setSystemTime(new Date('2026-07-29T12:00:00'));
    });

    afterEach(() => {
        vi.useRealTimers();
    });

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

    // earliestActiveWeek itself is exercised thoroughly in core/weeks.test.ts.
    // This just confirms the fixture keeps producing what the header note
    // below depends on — App no longer uses it to pick the landing week, only
    // to name the week the nudge points at.
    it('earliestActiveWeek finds the earliest open week in the fixtures', () => {
        expect(earliestActiveWeek(seed, '2026-08-31')).toBe('2026-07-20');
        expect(earliestActiveWeek(seed, '2026-07-13')).toBe('2026-07-13');
    });

    it('renders the plan pane', () => {
        render(<App />);
        expect(screen.getByLabelText('Previous week')).toBeTruthy();
        expect(screen.getByRole('button', { name: 'plan' })).toBeTruthy();
    });

    // The landing week is always the current week now (2026-07-27, per the
    // pinned clock), untouched by the fixtures and so empty. End week and Move
    // are dead on an empty week, and the note points at sampleWeek's week,
    // which is still open one week behind it.
    it('lands on the current week; when empty, the note points at the earlier open week', () => {
        render(<App />);
        expect(screen.getByRole('button', { name: /^End week/ }).hasAttribute('disabled')).toBe(
            true,
        );
        const move = screen.getByRole('button', { name: /work/i });
        expect(move.hasAttribute('disabled')).toBe(true);
        expect(screen.getByRole('button', { name: /^Go to Jul 20/ })).toBeTruthy();
        expect(screen.getByText(/is still open/)).toBeTruthy();
    });

    it('stepping back onto the earlier open week makes End week and Move live', async () => {
        const user = userEvent.setup();
        render(<App />);
        await user.click(screen.getByLabelText('Previous week'));

        expect(screen.getByRole('button', { name: /^End week/ }).hasAttribute('disabled')).toBe(
            false,
        );
        const move = screen.getByRole('button', { name: /work/i });
        expect(move.hasAttribute('disabled')).toBe(false);
    });

    it('an ended week offers no editing controls, but the day picker still works', async () => {
        const user = userEvent.setup();
        render(<App />);
        await user.click(screen.getByLabelText('Previous week')); // onto sampleWeek's week
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

    // Weeks may now interleave (plan/fast-track-log.md): a free week that sits
    // before an ended one is no longer frozen. This is the direct opposite of
    // what this test used to assert.
    it('a free week inside the archive is editable, not frozen (weeks interleave)', async () => {
        const user = userEvent.setup();
        render(<App />);

        // Landing is 2026-07-27; step back nine times into the fixtures' hole.
        // 2026-05-25 has no entry and sits before the last ended week
        // (2026-07-13).
        for (let i = 0; i < 9; i++) {
            await user.click(screen.getByLabelText('Previous week'));
        }
        expect(screen.getByText('May 25 – May 31')).toBeTruthy();

        const projects = document.querySelector('.projectView');
        expect(projects?.hasAttribute('inert')).toBe(false);
        expect(screen.queryByText(/sits behind your archive/)).toBeNull();
        expect(screen.getByText(/Nothing planned yet/)).toBeTruthy();

        await user.click(screen.getByRole('button', { name: '+ add project' }));
        expect(screen.getByPlaceholderText('Project name…')).toBeTruthy();
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

        await user.click(screen.getByLabelText('Previous week')); // onto sampleWeek's week
        await user.click(screen.getByRole('button', { name: /^End week/ }));
        await user.click(screen.getByRole('button', { name: 'Carry forward' }));

        // The view followed the carry onto the following week (2026-07-27,
        // which is also the current week), which now holds the work that was
        // left over.
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
