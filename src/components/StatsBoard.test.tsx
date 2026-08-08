import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatsBoard } from './StatsBoard';
import type { DayOfWeek, Subtask, Weeks } from '@/core/types';

describe('StatsBoard', () => {
    /*
     * Testing strategy — every figure here is derived, and the interesting
     * cases are the ones a NEW user sees: little or no history, nothing
     * finished, one of something rather than several. Those are exactly the
     * states the app is hardest to try out in by hand and easiest to ship
     * broken, since the developer's own archive is never empty.
     *
     *   partition on the archive: empty | one week | several
     *   partition on total planned weight: zero (projects but nothing
     *       schedulable) | non-zero
     *   partition on completion: nothing done | some | enough for a streak
     *   partition on the streak: live (>0) | broken but with a past run |
     *       never any
     *   partition on plurals: exactly 1 task unit | 0 or many
     *
     * Rendering is checked through the text a reader actually gets, not through
     * the chart internals — WeekSpark/WeekTrend/Heatmap have their own units,
     * and the columns handed to them are built by heatColumns/sparkColumns,
     * which are tested separately.
     */

    // useContainerWidth measures a real box; jsdom reports 0 for everything, so
    // `wide` is always false here and the trend renders its narrow slot count.
    // That is a faithful narrow-viewport render, not a broken one.
    beforeEach(() => {
        vi.useFakeTimers({ toFake: ['Date'] });
        vi.setSystemTime(new Date('2026-07-29T12:00:00'));
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    let nextId = 0;
    function sub(day: DayOfWeek, done: boolean, weight = 1): Subtask {
        nextId += 1;
        return {
            id: `s${nextId}`,
            isDone: done,
            assignedDay: day,
            missedDays: [],
            weight,
        };
    }

    /** One ended week holding a single task with the given subtasks. */
    function week(weekStart: string, subtasks: Subtask[]): Weeks[number] {
        nextId += 1;
        return {
            weekStart,
            ended: true,
            projects: [
                {
                    id: `p${nextId}`,
                    name: 'English',
                    tasks:
                        subtasks.length === 0
                            ? []
                            : [{ id: `t${nextId}`, name: 'Essay', subtasks }],
                },
            ],
        };
    }

    function show(archive: Weeks) {
        render(<StatsBoard archive={archive} onOpenWeek={vi.fn()} />);
    }

    /* ---- nothing to measure ---- */

    // The first thing anyone sees on this tab, and the only state that is not
    // reachable once the app has been used — so the easiest to break unnoticed.
    it('an empty archive explains itself instead of rendering empty charts', () => {
        show([]);

        expect(screen.getByText('Nothing to measure yet')).toBeInTheDocument();
        // no summary numbers, no charts
        expect(screen.queryByText('Avg completion')).not.toBeInTheDocument();
        expect(screen.queryByText('Week by week')).not.toBeInTheDocument();
    });

    // The live week is not measured — stats are built from ended weeks only. An
    // archive of active weeks is, for this pane, the same as no archive.
    it('the summary appears as soon as there is one ended week', () => {
        show([week('2026-07-20', [sub('mon', true)])]);

        expect(screen.queryByText('Nothing to measure yet')).not.toBeInTheDocument();
        expect(screen.getByText('Avg completion')).toBeInTheDocument();
        expect(screen.getByText('Weeks tracked')).toBeInTheDocument();
    });

    /* ---- a week with nothing schedulable in it ---- */

    // A project with no tasks is a legal week (isEmptyWeek only looks at
    // projects), so every total here can be zero while history is NOT empty —
    // the case that divides by zero if percentOf is ever "simplified".
    it('a week with nothing planned reports zeroes, not NaN', () => {
        show([week('2026-07-20', [])]);

        // both Avg completion and Best week read 0% here
        expect(screen.getAllByText('0%').length).toBeGreaterThan(0);
        expect(screen.getByText('0 of 0 task units')).toBeInTheDocument();
        expect(document.body.textContent).not.toMatch(/NaN|Infinity/);
    });

    // With nothing assigned on any weekday there is no strongest day and no
    // busiest one, so both captions fall back to describing the chart instead
    // of naming a winner.
    it('with nothing assigned, the weekday captions stay generic', () => {
        show([week('2026-07-20', [])]);

        expect(screen.getByText('How much of each weekday you finish.')).toBeInTheDocument();
        expect(screen.getByText("Where each weekday's finished work lands.")).toBeInTheDocument();
    });

    // Assigned but nothing finished: a strongest day exists (0% of something is
    // still a rate) but no day owns any completed work, so only the
    // distribution caption falls back.
    it('with work assigned but none done, only the distribution caption falls back', () => {
        show([week('2026-07-20', [sub('wed', false)])]);

        expect(screen.getByText(/Wednesday is your strongest day/)).toBeInTheDocument();
        expect(screen.getByText("Where each weekday's finished work lands.")).toBeInTheDocument();
    });

    /* ---- plurals ---- */

    it('one task unit reads as singular', () => {
        show([week('2026-07-20', [sub('mon', true)])]);

        expect(screen.getByText('1 of 1 task unit')).toBeInTheDocument();
        expect(screen.getByText(/^1 task unit completed/)).toBeInTheDocument();
    });

    it('more than one reads as plural', () => {
        show([week('2026-07-20', [sub('mon', true), sub('tue', true)])]);

        expect(screen.getByText('2 of 2 task units')).toBeInTheDocument();
        expect(screen.getByText(/^2 task units completed/)).toBeInTheDocument();
    });

    /* ---- the streak's three states ---- */

    it('a live streak says how the run is counted', () => {
        show([week('2026-07-13', [sub('mon', true)]), week('2026-07-20', [sub('mon', true)])]);

        expect(screen.getByText('in a row at 50%+')).toBeInTheDocument();
    });

    // Broken streak, but there was one: the card reports the best past run
    // rather than a bare zero, so the number has some context.
    it('a broken streak reports the best past run', () => {
        show([
            week('2026-07-06', [sub('mon', true)]), // 100%
            week('2026-07-13', [sub('mon', true)]), // 100%
            week('2026-07-20', [sub('mon', false)]), // 0% — breaks it
        ]);

        expect(screen.getByText('best run was 2')).toBeInTheDocument();
    });

    it('never having had a streak says so plainly', () => {
        show([week('2026-07-20', [sub('mon', false)])]);

        expect(screen.getByText('no streak yet')).toBeInTheDocument();
    });

    /* ---- the one figure that names a week ---- */

    // Best week is the only stat pointing at a particular week, so it is the
    // only one that is a link. A tie keeps the LATER week (a tie reads as a new
    // record), which is why both weeks here are 100%.
    it('the best week is a link, and a tie names the more recent one', () => {
        show([week('2026-07-13', [sub('mon', true)]), week('2026-07-20', [sub('mon', true)])]);

        expect(screen.getByRole('button', { name: /^Go to Jul 20/ })).toBeInTheDocument();
    });
});
