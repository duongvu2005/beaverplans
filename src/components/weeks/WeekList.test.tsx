import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WeekList } from './WeekList';
import type { Weeks, WeekPlan } from '@/core/types';
import { printProjects } from '@/storage/weekClipboard';
import { renderIn } from '@/test/locale';
import { weekRangeLabel } from '@/i18n/dateCopy';
// `vi` is vitest's here, so the Vietnamese catalog comes in renamed.
import { vi as viCatalog } from '@/i18n/vi';
import { en } from '@/i18n/en';

/*
 * Testing strategy
 *     partition on list size: empty | one | many
 *     partition on standing present: ended only | with the live week | with
 *       upcoming weeks (one, so shown as itself | several, so collapsed)
 *     partition on year span: single year | crossing a year boundary
 *     partition on destructive action: delete one | clear all
 *     partition on dialog outcome: confirmed | dismissed (nothing changes)
 *     property: rows render newest-first. archive is a Weeks value, whose rep
 *     invariant guarantees ascending order, so fixtures are built in that
 *     order rather than shuffled.
 */

function week(weekStart: string): WeekPlan {
    return {
        weekStart,
        ended: true,
        projects: [
            {
                id: `p-${weekStart}`,
                name: 'Project',
                tasks: [
                    {
                        id: `t-${weekStart}`,
                        name: 'Task',
                        subtasks: [
                            {
                                id: `s-${weekStart}`,
                                isDone: true,
                                assignedDay: 'mon',
                                missedDays: [],
                                weight: 1,
                            },
                        ],
                    },
                ],
            },
        ],
    };
}

// An active (never ended) week, for the standings the archive never had.
function activeWeek(weekStart: string): WeekPlan {
    return { ...week(weekStart), ended: false };
}

// Long after every fixture week, so an unqualified board reads as all-past.
const LATE = '2027-06-09';

// The weeks state App owns, updated the way React applies an updater.
function renderBoard(weeks: Weeks, today: string = LATE) {
    const onChange = vi.fn();
    const onOpenWeek = vi.fn();
    const result = render(
        <WeekList weeks={weeks} today={today} onChange={onChange} onOpenWeek={onOpenWeek} />,
    );
    const applied = () => {
        const updater = onChange.mock.calls.at(-1)?.[0] as (c: Weeks) => Weeks;
        return updater(weeks);
    };
    return { ...result, onChange, onOpenWeek, applied };
}

function rowLabels() {
    return screen
        .queryAllByRole('button', { name: /^Open week/ })
        .map((el) => el.getAttribute('aria-label')?.replace('Open week ', ''));
}

// The clear-all gate wants the count typed back before it will fire.
async function clearAll(count: number) {
    await userEvent.click(screen.getByRole('button', { name: en.weekList.clearAll }));
    await userEvent.type(screen.getByRole('textbox'), String(count));
    await userEvent.click(screen.getByRole('button', { name: en.weekList.clearAllConfirm }));
}

describe('WeekList', () => {
    it('covers empty: shows the empty state and no rows', () => {
        renderBoard([]);
        expect(screen.getByText(en.weekList.emptyTitle)).toBeInTheDocument();
        expect(
            screen.queryByRole('button', { name: en.weekList.clearAll }),
        ).not.toBeInTheDocument();
        expect(screen.queryAllByRole('button', { name: /^Open week/ })).toHaveLength(0);
    });

    it('covers one entry: singular count, one row, one year heading', () => {
        renderBoard([week('2026-07-13')]);
        expect(screen.getByText('1 week')).toBeInTheDocument();
        expect(rowLabels()).toEqual(['Jul 13 – Jul 19']);
        expect(screen.getByRole('heading', { name: '2026' })).toBeInTheDocument();
    });

    it('covers many in one year: plural count, rows rendered newest-first', () => {
        renderBoard([week('2026-06-29'), week('2026-07-06'), week('2026-07-13')]);
        expect(screen.getByText('3 weeks')).toBeInTheDocument();
        expect(rowLabels()).toEqual(['Jul 13 – Jul 19', 'Jul 06 – Jul 12', 'Jun 29 – Jul 05']);
        expect(screen.getAllByRole('heading')).toHaveLength(1);
    });

    it('covers crossing a year boundary: one heading per year, newest year first', () => {
        // Mon Dec 28 2026 straddles New Year but files under 2026, its Monday's year.
        renderBoard([week('2026-12-21'), week('2026-12-28'), week('2027-01-04')]);
        expect(screen.getAllByRole('heading').map((h) => h.textContent)).toEqual(['2027', '2026']);
        expect(rowLabels()).toEqual(['Jan 04 – Jan 10', 'Dec 28 – Jan 03', 'Dec 21 – Dec 27']);
    });

    it('covers delete one, confirmed: removes only that week', async () => {
        const { applied } = renderBoard([week('2026-07-06'), week('2026-07-13')]);

        const row = screen.getByRole('button', { name: 'Open week Jul 06 – Jul 12' });
        await userEvent.click(within(row).getByRole('button', { name: /^Delete week/ }));
        await userEvent.click(screen.getByRole('button', { name: en.common.delete }));

        expect(applied().map((e) => e.weekStart)).toEqual(['2026-07-13']);
    });

    it('covers delete one, dismissed: the list is untouched', async () => {
        const { onChange } = renderBoard([week('2026-07-06'), week('2026-07-13')]);

        const row = screen.getByRole('button', { name: 'Open week Jul 06 – Jul 12' });
        await userEvent.click(within(row).getByRole('button', { name: /^Delete week/ }));
        await userEvent.click(screen.getByRole('button', { name: en.common.cancel }));

        expect(onChange).not.toHaveBeenCalled();
    });

    it('covers clear all, confirmed: empties the list', async () => {
        const { applied } = renderBoard([week('2026-07-06'), week('2026-07-13')]);
        await clearAll(2);
        expect(applied()).toEqual([]);
    });

    it('covers clear all: it takes the live and upcoming weeks too', async () => {
        const when = '2026-07-08';
        const { applied } = renderBoard(
            [week('2026-06-29'), activeWeek('2026-07-06'), activeWeek('2026-07-13')],
            when,
        );
        await clearAll(3);
        expect(applied()).toEqual([]);
    });

    it('covers the gate: the confirm does nothing until the count is typed', async () => {
        const { onChange } = renderBoard([week('2026-07-06'), week('2026-07-13')]);

        await userEvent.click(screen.getByRole('button', { name: en.weekList.clearAll }));
        await userEvent.click(screen.getByRole('button', { name: en.weekList.clearAllConfirm }));

        expect(onChange).not.toHaveBeenCalled();
    });

    it('covers the gate: a wrong count does not open it either', async () => {
        const { onChange } = renderBoard([week('2026-07-06'), week('2026-07-13')]);

        await userEvent.click(screen.getByRole('button', { name: en.weekList.clearAll }));
        await userEvent.type(screen.getByRole('textbox'), '3');
        await userEvent.click(screen.getByRole('button', { name: en.weekList.clearAllConfirm }));

        expect(onChange).not.toHaveBeenCalled();
    });

    it('covers clear all, dismissed: the list is untouched', async () => {
        const { onChange } = renderBoard([week('2026-07-06'), week('2026-07-13')]);

        await userEvent.click(screen.getByRole('button', { name: en.weekList.clearAll }));
        await userEvent.click(screen.getByRole('button', { name: en.common.cancel }));

        expect(onChange).not.toHaveBeenCalled();
    });

    /*
     * Testing strategy, copy
     *     partition on the clipboard: accepts the write | refuses it
     */
    function stubClipboard(writeText: (() => Promise<void>) | undefined) {
        Object.defineProperty(navigator, 'clipboard', {
            configurable: true,
            value: writeText === undefined ? undefined : { writeText },
        });
    }

    it('covers the clipboard accepting: writes the copied week as JSON', async () => {
        const writeText = vi.fn(() => Promise.resolve());
        stubClipboard(writeText);
        const entry = week('2026-07-06');
        renderBoard([entry]);

        await userEvent.click(screen.getByRole('button', { name: /Copy week .* to clipboard/ }));
        await userEvent.click(screen.getByRole('button', { name: en.copyPlanDialog.copy }));

        expect(writeText).toHaveBeenCalledWith(printProjects('2026-07-06', entry.projects));
    });

    it('covers the clipboard refusing: shows the text to copy by hand', async () => {
        stubClipboard(() => Promise.reject(new Error('blocked')));
        const entry = week('2026-07-06');
        renderBoard([entry]);

        await userEvent.click(screen.getByRole('button', { name: /Copy week .* to clipboard/ }));
        await userEvent.click(screen.getByRole('button', { name: en.copyPlanDialog.copy }));

        expect(screen.getByLabelText(en.copyTextDialog.boxLabel)).toHaveValue(
            printProjects('2026-07-06', entry.projects),
        );
    });

    /*
     * The board and the rows it draws, in one render: a row names everything but
     * its label itself, so one still reading English would survive a test of the
     * board alone.
     */
    it('covers vi: the board and its rows are named from the catalog', () => {
        renderIn(
            'vi',
            <WeekList
                weeks={[week('2026-07-06')]}
                today={LATE}
                onChange={vi.fn()}
                onOpenWeek={vi.fn()}
            />,
        );

        expect(screen.getByText(viCatalog.weekList.weekCount(1))).toBeInTheDocument();
        expect(
            screen.getByRole('button', { name: viCatalog.weekList.clearAll }),
        ).toBeInTheDocument();

        const label = weekRangeLabel('2026-07-06', 'vi');
        expect(
            screen.getByRole('button', { name: viCatalog.weekRow.open(label) }),
        ).toBeInTheDocument();
        expect(screen.getByText(viCatalog.common.doneOf(1, 1))).toBeInTheDocument();
        expect(screen.getByText(viCatalog.weekRow.complete)).toBeInTheDocument();

        expect(screen.queryByText('1 week')).toBeNull();
    });

    it('covers vi: the clear-all confirm is Vietnamese too', async () => {
        renderIn(
            'vi',
            <WeekList
                weeks={[week('2026-07-06')]}
                today={LATE}
                onChange={vi.fn()}
                onOpenWeek={vi.fn()}
            />,
        );

        await userEvent.click(screen.getByRole('button', { name: viCatalog.weekList.clearAll }));

        const dialog = screen.getByRole('dialog');
        expect(within(dialog).getByText(viCatalog.weekList.clearAllTitle)).toBeInTheDocument();
        expect(within(dialog).getByText(viCatalog.weekList.clearAllBody(1))).toBeInTheDocument();
        expect(
            within(dialog).getByRole('button', { name: viCatalog.weekList.clearAllConfirm }),
        ).toBeInTheDocument();
        expect(
            within(dialog).getByRole('button', { name: viCatalog.common.cancel }),
        ).toBeInTheDocument();
    });
});

describe('WeekList, the weeks still to come', () => {
    /*
     * Testing strategy
     *     partition on how many are upcoming, against COLLAPSE_FROM: none | under
     *       it | at it | over it
     *     partition on the collapsed row: shut | opened
     *     property: the live week is reachable without opening anything, which
     *       is the whole reason the collapse exists
     */

    // Wednesday of the Jul 06 week.
    const NOW = '2026-07-08';

    const AGG = { name: en.weekList.expand };

    it('covers none: no collapsed row at all', () => {
        renderBoard([week('2026-06-29'), activeWeek('2026-07-06')], NOW);
        expect(screen.queryByRole('button', AGG)).not.toBeInTheDocument();
    });

    // Collapsing one row into one row buys nothing, so it is shown as itself.
    it('covers under the threshold: one week stays an ordinary row', () => {
        renderBoard([activeWeek('2026-07-06'), activeWeek('2026-07-13')], NOW);
        expect(screen.queryByRole('button', AGG)).not.toBeInTheDocument();
        expect(rowLabels()).toEqual(['Jul 13 – Jul 19', 'Jul 06 – Jul 12']);
    });

    it('covers at the threshold: one row stands for them, and they are not listed', () => {
        renderBoard(
            [activeWeek('2026-07-06'), activeWeek('2026-07-13'), activeWeek('2026-07-20')],
            NOW,
        );
        expect(screen.getByRole('button', AGG)).toBeInTheDocument();
        expect(screen.getByText(en.weekList.upcomingWeeks(2))).toBeInTheDocument();
        // The live week, and only it.
        expect(rowLabels()).toEqual(['Jul 06 – Jul 12']);
    });

    it('spans from the first upcoming Monday to the last upcoming Sunday', () => {
        renderBoard(
            [activeWeek('2026-07-13'), activeWeek('2026-07-20'), activeWeek('2026-08-03')],
            NOW,
        );
        expect(screen.getByText('Jul 13 – Aug 09')).toBeInTheDocument();
    });

    it('covers over the threshold: still one row', () => {
        renderBoard(
            [
                activeWeek('2026-07-13'),
                activeWeek('2026-07-20'),
                activeWeek('2026-07-27'),
                activeWeek('2026-08-03'),
                activeWeek('2026-08-10'),
            ],
            NOW,
        );
        expect(screen.getByText(en.weekList.upcomingWeeks(5))).toBeInTheDocument();
        expect(rowLabels()).toEqual([]);
    });

    // An untouched week is stored as nothing, so a gap in the future is ordinary.
    it('covers a gap: counts the weeks stored, not the weeks spanned', () => {
        renderBoard(
            [activeWeek('2026-07-13'), activeWeek('2026-07-20'), activeWeek('2026-09-07')],
            NOW,
        );
        expect(screen.getByText(en.weekList.upcomingWeeks(3))).toBeInTheDocument();
    });

    // The count says three, but the bar chart draws all nine weeks of the span:
    // the six empty ones are the gap, and dropping them would let the span claim
    // a density it does not have.
    it('covers a gap: the spark draws every week of the span, empties included', () => {
        renderBoard(
            [activeWeek('2026-07-13'), activeWeek('2026-07-20'), activeWeek('2026-09-07')],
            NOW,
        );
        const collapsed = screen.getByRole('button', { name: en.weekList.expand });
        const labels = [...collapsed.querySelectorAll('span')]
            // leaf spans only: a column wraps its own label, so matching on text
            // alone would count every label twice.
            .filter((el) => el.children.length === 0 && /^\d{2}$/.test(el.textContent ?? ''))
            .map((el) => el.textContent);
        expect(labels).toEqual(['13', '20', '27', '03', '10', '17', '24', '31', '07']);
    });

    /*
     * Testing strategy, the spark's unit
     *     partition on span: short enough for days | long enough for weeks
     *     property: the row never draws fewer columns than a week row's seven
     */
    function columnCount() {
        return screen
            .getByRole('button', { name: en.weekList.expand })
            .querySelectorAll('span[class*="barTrack"]').length;
    }

    it('covers a short span: a column is a day, so three weeks draw 21', () => {
        renderBoard(
            [activeWeek('2026-07-13'), activeWeek('2026-07-20'), activeWeek('2026-07-27')],
            NOW,
        );
        expect(columnCount()).toBe(21);
    });

    it('covers a long span: a column is a week, so seven weeks draw 7', () => {
        renderBoard(
            [activeWeek('2026-07-13'), activeWeek('2026-08-24')].map((w) => w),
            NOW,
        );
        // Jul 13 to Aug 24 inclusive is seven weeks, five of them empty.
        expect(columnCount()).toBe(7);
    });

    it('covers a span past the cap: the chart stops at 20 bars', () => {
        // Jul 13 2026 to Jun 07 2027 is termly rather than weekly planning.
        renderBoard([activeWeek('2026-07-13'), activeWeek('2026-12-28')], NOW);
        expect(columnCount()).toBe(20);
    });

    // The chart is a window onto the near end; the figures are not.
    it('covers a span past the cap: the total still counts the weeks not drawn', () => {
        renderBoard([activeWeek('2026-07-13'), activeWeek('2026-12-28')], NOW);
        // Each fixture week carries one subtask of weight 1.
        expect(screen.getByText('2')).toBeInTheDocument();
        expect(screen.getByText(en.weekList.upcomingWeeks(2))).toBeInTheDocument();
    });

    // The UI cannot end a week it has not reached, but importData and a cloud
    // merge can both deliver one, and isValidWeeks does not forbid it. The rows
    // inside the group derive their standing like every other row, so such a
    // week reads the same whether or not it is collapsed.
    it('covers an ended week dated in the future: read as ended, not as upcoming', async () => {
        const endedAhead: WeekPlan = { ...week('2026-07-20'), ended: true };
        renderBoard([activeWeek('2026-07-13'), endedAhead], '2026-07-08');

        await userEvent.click(screen.getByRole('button', { name: en.weekList.expand }));

        expect(screen.getByText(en.weekRow.complete)).toBeInTheDocument();
        expect(screen.getAllByText(en.weekRow.upcoming)).toHaveLength(1);
    });

    it('covers opened: the weeks appear, newest first, and can be shut again', async () => {
        renderBoard(
            [
                activeWeek('2026-07-06'),
                activeWeek('2026-07-13'),
                activeWeek('2026-07-20'),
                activeWeek('2026-07-27'),
            ],
            NOW,
        );

        await userEvent.click(screen.getByRole('button', AGG));
        expect(rowLabels()).toEqual([
            'Jul 27 – Aug 02',
            'Jul 20 – Jul 26',
            'Jul 13 – Jul 19',
            'Jul 06 – Jul 12',
        ]);

        await userEvent.click(screen.getByRole('button', { name: en.weekList.collapse }));
        expect(rowLabels()).toEqual(['Jul 06 – Jul 12']);
    });

    it('marks the standings apart: this week, not ended, upcoming', () => {
        renderBoard(
            [activeWeek('2026-06-29'), activeWeek('2026-07-06'), activeWeek('2026-07-13')],
            NOW,
        );
        expect(screen.getByText(en.weekRow.thisWeek)).toBeInTheDocument();
        expect(screen.getByText(en.weekRow.notEnded)).toBeInTheDocument();
        expect(screen.getByText(en.weekRow.upcoming)).toBeInTheDocument();
    });
});

describe('WeekList, year headings over the weeks to come', () => {
    /*
     * Testing strategy
     *     partition on the years the upcoming weeks span: one | two
     *     property: a heading sits above everything filed under it, so a
     *       collapsed row can never straddle two years
     */

    const NOW = '2026-12-23';

    it('covers one year: the heading sits above the collapsed row, not below it', () => {
        renderBoard(
            [
                activeWeek('2026-12-07'),
                activeWeek('2026-12-14'),
                activeWeek('2026-12-21'),
                activeWeek('2026-12-28'),
            ],
            '2026-12-09',
        );
        expect(screen.getAllByRole('heading').map((h) => h.textContent)).toEqual(['2026']);

        const heading = screen.getByRole('heading', { name: '2026' });
        const collapsed = screen.getByRole('button', { name: en.weekList.expand });
        // DOCUMENT_POSITION_FOLLOWING: the collapsed row comes after the heading.
        expect(
            heading.compareDocumentPosition(collapsed) & Node.DOCUMENT_POSITION_FOLLOWING,
        ).toBeTruthy();
    });

    // Mon Dec 28 2026 files under 2026 even though its week runs into January.
    it('covers two years: only the year over the threshold collapses', () => {
        renderBoard(
            [
                activeWeek('2026-12-21'),
                activeWeek('2026-12-28'),
                activeWeek('2027-01-04'),
                activeWeek('2027-01-11'),
                activeWeek('2027-01-18'),
            ],
            NOW,
        );

        expect(screen.getAllByRole('heading').map((h) => h.textContent)).toEqual(['2027', '2026']);
        // 2027 holds three upcoming weeks, so it collapses; 2026 holds one after
        // the live week, which stays a row.
        expect(screen.getByText(en.weekList.upcomingWeeks(3))).toBeInTheDocument();
        expect(rowLabels()).toEqual(['Dec 28 – Jan 03', 'Dec 21 – Dec 27']);
    });

    it('covers two years, both collapsing: two rows, neither straddling', () => {
        renderBoard(
            [
                activeWeek('2026-12-14'),
                activeWeek('2026-12-21'),
                activeWeek('2026-12-28'),
                activeWeek('2027-01-04'),
                activeWeek('2027-01-11'),
                activeWeek('2027-01-18'),
            ],
            '2026-12-09',
        );

        expect(screen.getAllByRole('heading').map((h) => h.textContent)).toEqual(['2027', '2026']);
        expect(screen.getAllByText(en.weekList.upcomingWeeks(3))).toHaveLength(2);
        // Each collapsed row spans only its own year.
        expect(screen.getByText('Jan 04 – Jan 24')).toBeInTheDocument();
        expect(screen.getByText('Dec 14 – Jan 03')).toBeInTheDocument();
    });
});
