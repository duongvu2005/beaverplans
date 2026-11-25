import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { renderIn } from '@/test/locale';
// `vi` is already vitest's here, so the Vietnamese catalog comes in renamed.
import { vi as viCatalog } from '@/i18n/vi';
import { StatsBoard } from './StatsBoard';
import type { DayOfWeek, Subtask, Weeks } from '@/core/types';
import { en } from '@/i18n/en';

describe('StatsBoard', () => {
    /*
     * Testing strategy — every figure here is derived, and the interesting
     * cases are the ones a NEW user sees: little or no history, nothing
     * finished, one of something rather than several.
     *
     *   partition on the archive: empty | one week | several
     *   partition on total planned weight: zero (projects but nothing
     *       schedulable) | non-zero
     *   partition on completion: nothing done | some | enough for a streak
     *   partition on the streak: live (>0) | broken but with a past run |
     *       never any
     *   partition on plurals: exactly 1 task unit | 0 or many
     *
     * Rendering is checked through the text a reader gets, not through the
     * chart internals, which have their own units.
     */

    // useContainerWidth measures a real box; jsdom reports 0 for everything, so
    // `wide` is always false here and the trend renders its narrow slot count.
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

    // The only state that is not reachable once the app has been used.
    it('an empty archive explains itself instead of rendering empty charts', () => {
        show([]);

        expect(screen.getByText(en.statsBoard.emptyTitle)).toBeInTheDocument();
        // no summary numbers, no charts
        expect(screen.queryByText(en.statsBoard.avgCompletion)).not.toBeInTheDocument();
        expect(screen.queryByText(en.statsBoard.weekByWeek)).not.toBeInTheDocument();
    });

    // Stats are built from ended weeks only, so an archive of active weeks is
    // the same as no archive here.
    it('the summary appears as soon as there is one ended week', () => {
        show([week('2026-07-20', [sub('mon', true)])]);

        expect(screen.queryByText(en.statsBoard.emptyTitle)).not.toBeInTheDocument();
        expect(screen.getByText(en.statsBoard.avgCompletion)).toBeInTheDocument();
        expect(screen.getByText(en.statsBoard.weeksTracked)).toBeInTheDocument();
    });

    /* ---- a week with nothing schedulable in it ---- */

    // A project with no tasks is a legal week (isEmptyWeek only looks at
    // projects), so every total here can be zero while history is NOT empty.
    it('a week with nothing planned reports zeroes, not NaN', () => {
        show([week('2026-07-20', [])]);

        // both Avg completion and Best week read 0% here
        expect(screen.getAllByText('0%').length).toBeGreaterThan(0);
        expect(screen.getByText('0 of 0 task units')).toBeInTheDocument();
        expect(document.body.textContent).not.toMatch(/NaN|Infinity/);
    });

    // With nothing assigned on any weekday there is no strongest day and no
    // busiest one, so both captions fall back to describing the chart.
    it('with nothing assigned, the weekday captions stay generic', () => {
        show([week('2026-07-20', [])]);

        expect(screen.getByText(en.statsBoard.followThroughNote)).toBeInTheDocument();
        expect(screen.getByText(en.statsBoard.distributionNote)).toBeInTheDocument();
    });

    // Assigned but nothing finished: a strongest day exists (0% of something is
    // still a rate), but no day owns completed work, so only the distribution
    // caption falls back.
    it('with work assigned but none done, only the distribution caption falls back', () => {
        show([week('2026-07-20', [sub('wed', false)])]);

        expect(screen.getByText(/Wednesday is your strongest day/)).toBeInTheDocument();
        expect(screen.getByText(en.statsBoard.distributionNote)).toBeInTheDocument();
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

    // Broken streak, but there was one: the card reports the best past run.
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

        expect(screen.getByText(en.statsBoard.noStreak)).toBeInTheDocument();
    });

    /* ---- the one figure that names a week ---- */

    // Best week is the only stat that is a link. A tie keeps the LATER week,
    // which is why both weeks here are 100%.
    it('the best week is a link, and a tie names the more recent one', () => {
        show([week('2026-07-13', [sub('mon', true)]), week('2026-07-20', [sub('mon', true)])]);

        expect(screen.getByRole('button', { name: /^Go to Jul 20/ })).toBeInTheDocument();
    });

    /* ---- the language the pane is read in ---- */

    /*
     * Both states, because they share no strings. Each asserts the English is
     * gone as well — a Vietnamese-only assertion passes just as happily against
     * a component that never reads the catalog.
     */
    it('renders the empty state in Vietnamese under a vi provider', () => {
        const copy = viCatalog.statsBoard;
        renderIn('vi', <StatsBoard archive={[]} onOpenWeek={vi.fn()} />);

        expect(screen.getByText(copy.emptyTitle)).toBeInTheDocument();
        // Names the Plan tab by reading topBar's word for it, so this covers
        // the cross-block read too.
        expect(screen.getByText(copy.emptyText)).toBeInTheDocument();
        expect(screen.queryByText(en.statsBoard.emptyTitle)).not.toBeInTheDocument();
    });

    it('renders the populated pane in Vietnamese under a vi provider', () => {
        const copy = viCatalog.statsBoard;
        renderIn(
            'vi',
            <StatsBoard
                archive={[
                    week('2026-07-13', [sub('wed', true)]),
                    week('2026-07-20', [sub('wed', true)]),
                ]}
                onOpenWeek={vi.fn()}
            />,
        );

        expect(screen.getByText(copy.avgCompletion)).toBeInTheDocument();
        expect(screen.getByText(copy.weeksTracked)).toBeInTheDocument();
        expect(screen.getByText(copy.allTime)).toBeInTheDocument();
        expect(screen.getByText(copy.ofTaskUnits(2, 2))).toBeInTheDocument();
        // The threshold comes from the component, not from a 50 written into
        // the sentence.
        expect(screen.getByText(copy.inARowAt(50))).toBeInTheDocument();
        expect(screen.getByText(copy.weekByWeekNote)).toBeInTheDocument();
        expect(screen.getByText(copy.activityNote(2))).toBeInTheDocument();
        expect(screen.getByText(copy.distribution)).toBeInTheDocument();
        // Named by dateCopy rather than by the catalog.
        expect(screen.getByText(/^Thứ Tư là ngày bạn làm tốt nhất/)).toBeInTheDocument();
        // The heatmap legend and the best-week link are children with their
        // own blocks, so their language is worth pinning from here too.
        expect(screen.getByText(viCatalog.heatmap.less)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /^Đi tới 20\/07/ })).toBeInTheDocument();

        expect(screen.queryByText(en.statsBoard.avgCompletion)).not.toBeInTheDocument();
        expect(screen.queryByText(en.statsBoard.allTime)).not.toBeInTheDocument();
        expect(screen.queryByText('in a row at 50%+')).not.toBeInTheDocument();
        expect(document.body.textContent).not.toMatch(/strongest day|Less/);
    });
});
