import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DayColumn } from './DayColumn';
import type { DaySchedule, DayEntry } from '../core/daySchedule';
import type { Subtask } from '../core/types';

describe('DayColumn', () => {
    /*
     * Testing strategy
     *     partition on progress: undefined (PointsStat renders nothing) | defined
     *         with a nonzero total (PointsStat shows it)
     *     partition on daySchedule.items: empty | nonempty
     *     partition per entry: assignedDay === column day (passed to DayCell as
     *         isMissed=false) | assignedDay !== column day (isMissed=true, a
     *         missed ghost placed on this column)
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
            weekStart: '2026-07-20',
            today: '2026-07-22',
            onFocusDay: noop,
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
        expect(screen.getByText('2/4 pts')).toBeInTheDocument();
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

        await user.click(screen.getByRole('button', { name: 'wed' }));

        expect(onFocusDay).toHaveBeenCalledWith('wed');
    });
});
