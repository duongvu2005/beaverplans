import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ArchiveBoard } from './ArchiveBoard';
import type { Weeks, WeekPlan } from '../core/types';

/*
 * Testing strategy
 *     partition on archive size: empty | one | many
 *     partition on year span: single year | crossing a year boundary
 *     partition on destructive action: delete one | clear all
 *     partition on dialog outcome: confirmed | dismissed (nothing changes)
 *     property: rows render newest-first. archive is a Weeks value, so its rep
 *     invariant already guarantees ascending order (e.g. via endedWeeks) —
 *     fixtures below are built in that order, not shuffled.
 */

function week(weekStart: string): WeekPlan {
    return {
        weekStart,
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

// The archive state App owns, updated the same way React would apply the updater.
function renderBoard(archive: Weeks) {
    const onChange = vi.fn();
    const result = render(<ArchiveBoard archive={archive} onChange={onChange} />);
    const applied = () => {
        const updater = onChange.mock.calls.at(-1)?.[0] as (c: Weeks) => Weeks;
        return updater(archive);
    };
    return { ...result, onChange, applied };
}

function rowLabels() {
    return screen
        .getAllByRole('button', { name: /^Open archived week/ })
        .map((el) => el.getAttribute('aria-label')?.replace('Open archived week ', ''));
}

describe('ArchiveBoard', () => {
    it('covers empty: shows the empty state and no rows or Clear all', () => {
        renderBoard([]);
        expect(screen.getByText('No archived weeks yet')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Clear all' })).not.toBeInTheDocument();
        expect(screen.queryAllByRole('button', { name: /^Open archived week/ })).toHaveLength(0);
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

        const row = screen.getByRole('button', { name: 'Open archived week Jul 06 – Jul 12' });
        await userEvent.click(within(row).getByRole('button', { name: /^Delete week/ }));
        await userEvent.click(screen.getByRole('button', { name: 'Delete' }));

        expect(applied().map((e) => e.weekStart)).toEqual(['2026-07-13']);
    });

    it('covers delete one, dismissed: archive untouched', async () => {
        const { onChange } = renderBoard([week('2026-07-06'), week('2026-07-13')]);

        const row = screen.getByRole('button', { name: 'Open archived week Jul 06 – Jul 12' });
        await userEvent.click(within(row).getByRole('button', { name: /^Delete week/ }));
        await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

        expect(onChange).not.toHaveBeenCalled();
    });

    it('covers clear all, confirmed: empties the archive', async () => {
        const { applied } = renderBoard([week('2026-07-06'), week('2026-07-13')]);

        await userEvent.click(screen.getByRole('button', { name: 'Clear all' }));
        await userEvent.click(screen.getByRole('button', { name: 'Delete all' }));

        expect(applied()).toEqual([]);
    });

    it('covers clear all, dismissed: archive untouched', async () => {
        const { onChange } = renderBoard([week('2026-07-06'), week('2026-07-13')]);

        await userEvent.click(screen.getByRole('button', { name: 'Clear all' }));
        await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

        expect(onChange).not.toHaveBeenCalled();
    });
});
