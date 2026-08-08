import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FocusedDay } from './FocusedDay';
import type { DayEntry } from '@/core/daySchedule';
import type { Subtask } from '@/core/types';

describe('FocusedDay', () => {
    /*
     * Testing strategy
     *     partition on items: empty (shows "nothing scheduled" + empty message,
     *         no list) | nonempty
     *     partition on items membership (nonempty case): all assigned to day
     *         | some ghosts (assignedDay !== day, present via missedDays)
     *     partition on isToday: true | false
     *     count text: "doneCount of assigned.length done" counts only entries
     *         assigned to this day, excluding ghosts from both numerator and
     *         denominator
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

    const weekStart = '2026-07-20';
    const today = '2026-07-22';

    it('covers items empty: shows "nothing scheduled" and no list', () => {
        render(
            <FocusedDay
                day="wed"
                items={[]}
                isToday={false}
                weekStart={weekStart}
                today={today}
                ended={false}
                onToggleSubtask={() => {}}
                onEditSubtask={() => {}}
                onRequestMove={() => {}}
                onClearMissed={() => {}}
            />,
        );
        expect(screen.getByText('nothing scheduled')).toBeInTheDocument();
        expect(screen.getByText('No tasks on this day.')).toBeInTheDocument();
        expect(screen.queryByRole('list')).not.toBeInTheDocument();
    });

    it('covers isToday true: head text includes "· today"', () => {
        render(
            <FocusedDay
                day="wed"
                items={[]}
                isToday={true}
                weekStart={weekStart}
                today={today}
                ended={false}
                onToggleSubtask={() => {}}
                onEditSubtask={() => {}}
                onRequestMove={() => {}}
                onClearMissed={() => {}}
            />,
        );
        expect(screen.getByText('Wednesday · today')).toBeInTheDocument();
    });

    it('covers isToday false: head text omits "· today"', () => {
        render(
            <FocusedDay
                day="wed"
                items={[]}
                isToday={false}
                weekStart={weekStart}
                today={today}
                ended={false}
                onToggleSubtask={() => {}}
                onEditSubtask={() => {}}
                onRequestMove={() => {}}
                onClearMissed={() => {}}
            />,
        );
        expect(screen.getByText('Wednesday')).toBeInTheDocument();
    });

    it('covers a ghost mixed in: count excludes it from both done and total', () => {
        const items: DayEntry[] = [
            makeEntry({ subtask: makeSubtask({ id: 'a', assignedDay: 'wed', isDone: true }) }),
            makeEntry({ subtask: makeSubtask({ id: 'b', assignedDay: 'wed', isDone: false }) }),
            // a ghost: missed from mon, now assigned wed, appears in FocusedDay's
            // items for "mon" via missedDays, but assignedDay is wed, not mon
            makeEntry({
                subtask: makeSubtask({ id: 'c', assignedDay: 'wed', missedDays: ['mon'] }),
            }),
        ];

        render(
            <FocusedDay
                day="mon"
                items={items}
                isToday={false}
                weekStart={weekStart}
                today={today}
                ended={false}
                onToggleSubtask={() => {}}
                onEditSubtask={() => {}}
                onRequestMove={() => {}}
                onClearMissed={() => {}}
            />,
        );

        // none of the three are assigned to "mon" itself (all assignedDay: wed),
        // so assigned.length is 0 even though 3 DayCells render
        expect(screen.getByText('0 of 0 done')).toBeInTheDocument();
        expect(screen.getAllByRole('listitem')).toHaveLength(3);
    });

    it('covers all items assigned to day: count reflects done/total directly', () => {
        const items: DayEntry[] = [
            makeEntry({ subtask: makeSubtask({ id: 'a', assignedDay: 'wed', isDone: true }) }),
            makeEntry({ subtask: makeSubtask({ id: 'b', assignedDay: 'wed', isDone: false }) }),
        ];

        render(
            <FocusedDay
                day="wed"
                items={items}
                isToday={false}
                weekStart={weekStart}
                today={today}
                ended={false}
                onToggleSubtask={() => {}}
                onEditSubtask={() => {}}
                onRequestMove={() => {}}
                onClearMissed={() => {}}
            />,
        );

        expect(screen.getByText('1 of 2 done')).toBeInTheDocument();
    });
});
