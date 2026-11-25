import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WeekQuickLook } from './WeekQuickLook';
import { sampleArchive } from '@/fixtures/sampleArchive';
import type { WeekPlan } from '@/core/types';
import { renderIn } from '@/test/locale';
// `vi` is vitest's here, so the Vietnamese catalog comes in renamed.
import { vi as viCatalog } from '@/i18n/vi';
import { en } from '@/i18n/en';

/*
 * Testing strategy
 *     partition on projects: empty | one | many
 *     partition on misses: none anywhere (no chips) | some (chip per affected task)
 *     partition on completeness: project fully done (struck) | partly done
 *     partition on footer action: Close | View
 *     the week cases are read from sampleArchive rather than invented, so the
 *     test and the design mock describe the same weeks
 */

function week(weekStart: string): WeekPlan {
    const found = sampleArchive.find((e) => e.weekStart === weekStart);
    if (!found) throw new Error(`fixture has no week ${weekStart}`);
    return found;
}

// Jul 06 – Jul 12: 33%, misses on two tasks. Jun 22 – Jun 28: 100%, no misses.
const SLIPPED = week('2026-07-06');
const PERFECT = week('2026-06-22');

describe('WeekQuickLook', () => {
    it('covers many projects: renders the total and every project with its stat', () => {
        render(
            <WeekQuickLook
                entry={SLIPPED}
                label="Jul 06 – Jul 12"
                onClose={() => {}}
                onView={() => {}}
            />,
        );

        expect(screen.getByText('33%')).toBeInTheDocument();
        expect(screen.getByText('3/9 done')).toBeInTheDocument();
        expect(screen.getByText('software construction')).toBeInTheDocument();
        expect(screen.getByText('beaverplans')).toBeInTheDocument();
        expect(screen.getByText('korean')).toBeInTheDocument();
        // korean is 1/1, fully done
        expect(screen.getByText('1/1 · 100%')).toBeInTheDocument();
    });

    it('covers misses present: a chip per affected task, counting events', () => {
        render(
            <WeekQuickLook
                entry={SLIPPED}
                label="Jul 06 – Jul 12"
                onClose={() => {}}
                onView={() => {}}
            />,
        );

        // equality: one subtask slipped off tue and wed -> 2 events, one chip
        expect(screen.getByText('2 missed')).toBeInTheDocument();
        // merge trees: one subtask slipped off thu
        expect(screen.getByText('1 missed')).toBeInTheDocument();
        expect(screen.getAllByText(/missed$/)).toHaveLength(2);
    });

    it('covers no misses: renders no chips at all', () => {
        render(
            <WeekQuickLook
                entry={PERFECT}
                label="Jun 22 – Jun 28"
                onClose={() => {}}
                onView={() => {}}
            />,
        );

        expect(screen.queryAllByText(/missed$/)).toHaveLength(0);
        expect(screen.getByText('100%')).toBeInTheDocument();
    });

    it('covers a task with no subtasks: still shows its own points', () => {
        render(
            <WeekQuickLook
                entry={PERFECT}
                label="Jun 22 – Jun 28"
                onClose={() => {}}
                onView={() => {}}
            />,
        );

        // 'static checking' is a done leaf task -> 1/1
        const leaf = screen.getByText('static checking').closest('div');
        expect(leaf).not.toBeNull();
        expect(within(leaf as HTMLElement).getByText('1/1')).toBeInTheDocument();
    });

    it('covers no projects: shows the empty note instead of a rollup', () => {
        render(
            <WeekQuickLook
                entry={{ weekStart: '2026-05-04', ended: true, projects: [] }}
                label="May 04 – May 10"
                onClose={() => {}}
                onView={() => {}}
            />,
        );

        expect(screen.getByText(en.weekQuickLook.empty)).toBeInTheDocument();
        expect(screen.getByText('0%')).toBeInTheDocument();
    });

    it('calls onClose from the Close button, not onView', async () => {
        const onClose = vi.fn();
        const onView = vi.fn();
        render(
            <WeekQuickLook
                entry={PERFECT}
                label="Jun 22 – Jun 28"
                onClose={onClose}
                onView={onView}
            />,
        );

        await userEvent.click(screen.getByRole('button', { name: en.common.close }));

        expect(onClose).toHaveBeenCalledTimes(1);
        expect(onView).not.toHaveBeenCalled();
    });

    it('calls onView from the View button, not onClose', async () => {
        const onClose = vi.fn();
        const onView = vi.fn();
        render(
            <WeekQuickLook
                entry={PERFECT}
                label="Jun 22 – Jun 28"
                onClose={onClose}
                onView={onView}
            />,
        );

        await userEvent.click(screen.getByRole('button', { name: en.weekQuickLook.view }));

        expect(onView).toHaveBeenCalledTimes(1);
        expect(onClose).not.toHaveBeenCalled();
    });

    it('labels the dialog by its title', () => {
        render(
            <WeekQuickLook
                entry={PERFECT}
                label="Jun 22 – Jun 28"
                onClose={() => {}}
                onView={() => {}}
            />,
        );

        expect(screen.getByRole('dialog')).toHaveAccessibleName('Jun 22 – Jun 28');
    });

    // The label is a prop, so the date is the board's to translate and stays
    // English here.
    it('covers vi: the eyebrow, the tally, the chips and the footer', () => {
        renderIn(
            'vi',
            <WeekQuickLook
                entry={SLIPPED}
                label="Jul 06 – Jul 12"
                onClose={() => {}}
                onView={() => {}}
            />,
        );

        expect(screen.getByText(viCatalog.weekQuickLook.eyebrow)).toBeInTheDocument();
        expect(screen.getByText(viCatalog.common.doneOf(3, 9))).toBeInTheDocument();
        expect(screen.getByText(viCatalog.weekQuickLook.missed(2))).toBeInTheDocument();
        expect(screen.getByRole('button', { name: viCatalog.common.close })).toBeInTheDocument();
        expect(
            screen.getByRole('button', { name: viCatalog.weekQuickLook.view }),
        ).toBeInTheDocument();

        expect(screen.queryByText('2 missed')).toBeNull();
    });

    it('covers vi: the empty note', () => {
        renderIn(
            'vi',
            <WeekQuickLook
                entry={{ weekStart: '2026-05-04', ended: true, projects: [] }}
                label="May 04 – May 10"
                onClose={() => {}}
                onView={() => {}}
            />,
        );

        expect(screen.getByText(viCatalog.weekQuickLook.empty)).toBeInTheDocument();
    });
});
