import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DayColumn } from './DayColumn';
import type { DaySchedule, DayEntry } from '@/core/daySchedule';
import type { Subtask } from '@/core/types';
import { renderIn } from '@/test/locale';
// `vi` is vitest's here, so the Vietnamese catalog comes in renamed.
import { vi as viCatalog } from '@/i18n/vi';

describe('DayColumn', () => {
    /*
     * Testing strategy
     *     partition on progress: undefined (PointsStat renders nothing) | defined
     *         with a nonzero total (PointsStat shows it)
     *     partition on daySchedule.items: empty | nonempty
     *     partition per entry: assignedDay === column day (passed to DayCell as
     *         isMissed=false) | assignedDay !== column day (isMissed=true, a
     *         missed ghost placed on this column)
     *     partition on due: empty (no flag at all) | one entry | several
     *     interaction: clicking the day heading -> onFocusDay(daySchedule.day)
     */

    function makeSubtask(overrides: Partial<Subtask> = {}): Subtask {
        return {
            id: 's1',
            isDone: false,
            assignedDay: 'wed',
            missedDays: [],
            weight: 1,
            ...overrides,
        };
    }

    function makeEntry(overrides: Partial<DayEntry> = {}): DayEntry {
        return {
            subtask: makeSubtask(),
            taskName: 'Write essay',
            projectName: 'English',
            ...overrides,
        };
    }

    const noop = () => {};
    function baseProps(overrides: Record<string, unknown> = {}) {
        return {
            daySchedule: { day: 'wed', items: [] } as DaySchedule,
            progress: undefined,
            due: [],
            weekStart: '2026-07-20',
            today: '2026-07-22',
            onFocusDay: noop,
            ended: false,
            onToggleSubtask: noop,
            onEditSubtask: noop,
            onRequestMove: noop,
            onClearMissed: noop,
            ...overrides,
        };
    }

    it('covers progress undefined: PointsStat renders nothing', () => {
        render(<DayColumn {...baseProps()} />);
        expect(screen.queryByText(/\//)).not.toBeInTheDocument();
    });

    it('covers progress defined with a nonzero total: PointsStat shows it', () => {
        render(<DayColumn {...baseProps({ progress: { day: 'wed', assigned: 4, done: 2 } })} />);
        // the heading carries the count alone, with no unit label
        expect(screen.getByText('2/4')).toBeInTheDocument();
    });

    it('covers items empty: renders no DayCell', () => {
        render(<DayColumn {...baseProps()} />);
        expect(screen.queryByRole('listitem')).not.toBeInTheDocument();
    });

    it('covers an entry assigned to this column: passed to DayCell as not missed', () => {
        const schedule: DaySchedule = {
            day: 'wed',
            items: [makeEntry({ subtask: makeSubtask({ id: 'a', assignedDay: 'wed' }) })],
        };
        render(<DayColumn {...baseProps({ daySchedule: schedule })} />);
        expect(screen.getByRole('checkbox')).not.toBeDisabled();
        expect(screen.queryByText(/missed/)).not.toBeInTheDocument();
    });

    it('covers an entry not assigned to this column (a ghost): passed to DayCell as missed', () => {
        const schedule: DaySchedule = {
            day: 'mon',
            items: [
                makeEntry({
                    subtask: makeSubtask({ id: 'a', assignedDay: 'wed', missedDays: ['mon'] }),
                }),
            ],
        };
        render(<DayColumn {...baseProps({ daySchedule: schedule })} />);
        expect(screen.getByRole('checkbox')).toBeDisabled();
        expect(screen.getByText(/missed/)).toBeInTheDocument();
    });

    it('covers clicking the day heading: calls onFocusDay(daySchedule.day)', async () => {
        const user = userEvent.setup();
        const onFocusDay = vi.fn();
        render(<DayColumn {...baseProps({ onFocusDay })} />);

        await user.click(screen.getByRole('button', { name: 'Wed' }));

        expect(onFocusDay).toHaveBeenCalledWith('wed');
    });

    it('covers vi: the day heading and its title', () => {
        renderIn('vi', <DayColumn {...baseProps()} />);

        const heading = screen.getByRole('button', { name: 'T4' });
        expect(heading).toHaveAttribute('title', viCatalog.dayColumn.focusDay);
        expect(heading).not.toHaveAttribute('title', 'Focus this day');
    });

    it('covers due empty: no flag, and nothing announced', () => {
        render(<DayColumn {...baseProps()} />);
        expect(screen.queryByLabelText(/due/i)).not.toBeInTheDocument();
    });

    it('covers one due: the flag shows the count, and names it in the title', () => {
        const due = [{ name: 'Write essay', kind: 'task' as const, deadline: '2026-07-22' }];
        render(<DayColumn {...baseProps({ due })} />);

        const marker = screen.getByLabelText('1 due');
        expect(marker).toHaveTextContent('1');
        expect(marker).toHaveAttribute('title', 'Due: Write essay');
    });

    it('covers several due: counts them all and lists every name', () => {
        const due = [
            { name: 'Thesis', kind: 'project' as const, deadline: '2026-07-22' },
            { name: 'Write essay', kind: 'task' as const, deadline: '2026-07-22' },
            { name: 'Read ch. 4', kind: 'task' as const, deadline: '2026-07-22T09:00' },
        ];
        render(<DayColumn {...baseProps({ due })} />);

        const marker = screen.getByLabelText('3 due');
        expect(marker).toHaveTextContent('3');
        expect(marker).toHaveAttribute('title', 'Due: Thesis, Write essay, Read ch. 4');
    });

    it('covers vi: the flag is labelled from the catalog', () => {
        const due = [{ name: 'Bài tập', kind: 'task' as const, deadline: '2026-07-22' }];
        renderIn('vi', <DayColumn {...baseProps({ due })} />);
        expect(screen.getByLabelText(viCatalog.common.dueCount(1))).toBeInTheDocument();
    });
});
