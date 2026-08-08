import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ArchiveQuickLook } from './ArchiveQuickLook';
import { sampleArchive } from '@/fixtures/sampleArchive';
import type { WeekPlan } from '@/core/types';

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

describe('ArchiveQuickLook', () => {
    it('covers many projects: renders the total and every project with its stat', () => {
        render(
            <ArchiveQuickLook
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
            <ArchiveQuickLook
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
            <ArchiveQuickLook
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
            <ArchiveQuickLook
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
            <ArchiveQuickLook
                entry={{ weekStart: '2026-05-04', ended: true, projects: [] }}
                label="May 04 – May 10"
                onClose={() => {}}
                onView={() => {}}
            />,
        );

        expect(screen.getByText('This week was archived with nothing on it.')).toBeInTheDocument();
        expect(screen.getByText('0%')).toBeInTheDocument();
    });

    it('calls onClose from the Close button, not onView', async () => {
        const onClose = vi.fn();
        const onView = vi.fn();
        render(
            <ArchiveQuickLook
                entry={PERFECT}
                label="Jun 22 – Jun 28"
                onClose={onClose}
                onView={onView}
            />,
        );

        await userEvent.click(screen.getByRole('button', { name: 'Close' }));

        expect(onClose).toHaveBeenCalledTimes(1);
        expect(onView).not.toHaveBeenCalled();
    });

    it('calls onView from the View button, not onClose', async () => {
        const onClose = vi.fn();
        const onView = vi.fn();
        render(
            <ArchiveQuickLook
                entry={PERFECT}
                label="Jun 22 – Jun 28"
                onClose={onClose}
                onView={onView}
            />,
        );

        await userEvent.click(screen.getByRole('button', { name: 'View' }));

        expect(onView).toHaveBeenCalledTimes(1);
        expect(onClose).not.toHaveBeenCalled();
    });

    it('labels the dialog by its title', () => {
        render(
            <ArchiveQuickLook
                entry={PERFECT}
                label="Jun 22 – Jun 28"
                onClose={() => {}}
                onView={() => {}}
            />,
        );

        expect(screen.getByRole('dialog')).toHaveAccessibleName('Jun 22 – Jun 28');
    });
});
