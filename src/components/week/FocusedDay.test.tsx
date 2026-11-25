import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { renderIn } from '@/test/locale';
import { FocusedDay } from './FocusedDay';
import type { DayDue, DayEntry } from '@/core/daySchedule';
import type { Subtask } from '@/core/types';
// `vi` is vitest's here, so the Vietnamese catalog comes in renamed.
import { vi as viCatalog } from '@/i18n/vi';
import { en } from '@/i18n/en';

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
     *     partition on due: empty (no line at all) | one | several
     *     due is INDEPENDENT of items: a task due on this day whose subtask sits
     *         on another one appears in the due line and nowhere in the list
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

    const noDue: DayDue['entries'] = [];
    const weekStart = '2026-07-20';
    const today = '2026-07-22';

    /** The full prop set, so a vi case can vary only what it is about. */
    function props(overrides: Record<string, unknown> = {}) {
        return {
            day: 'wed' as const,
            items: [] as DayEntry[],
            due: noDue,
            isToday: false,
            weekStart,
            today,
            ended: false,
            onToggleSubtask: () => {},
            onEditSubtask: () => {},
            onRequestMove: () => {},
            onClearMissed: () => {},
            ...overrides,
        };
    }

    it('covers items empty: shows "nothing scheduled" and no list', () => {
        render(
            <FocusedDay
                day="wed"
                due={noDue}
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
        expect(screen.getByText(en.focusedDay.nothingScheduled)).toBeInTheDocument();
        expect(screen.getByText(en.focusedDay.empty)).toBeInTheDocument();
        expect(screen.queryByRole('list')).not.toBeInTheDocument();
    });

    it('covers isToday true: head text includes "· today"', () => {
        render(
            <FocusedDay
                day="wed"
                due={noDue}
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

    // The long form, and the one place a day name carries diacritics.
    it('covers vi: the day is named in full', () => {
        renderIn(
            'vi',
            <FocusedDay
                day="wed"
                due={noDue}
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
        expect(screen.getByText(/Thứ Tư/)).toBeInTheDocument();
        expect(screen.queryByText(/Wednesday/)).toBeNull();
    });

    // Both branches of the count are walked: the empty one is a different string
    // rather than a zero.
    it('covers vi, empty: the count and the empty line', () => {
        renderIn('vi', <FocusedDay {...props({ items: [] })} />);

        expect(screen.getByText(viCatalog.focusedDay.nothingScheduled)).toBeInTheDocument();
        expect(screen.getByText(viCatalog.focusedDay.empty)).toBeInTheDocument();
        expect(screen.queryByText(en.focusedDay.nothingScheduled)).toBeNull();
        expect(screen.queryByText(en.focusedDay.empty)).toBeNull();
    });

    it('covers vi, today with work: the tally and the today marker', () => {
        renderIn(
            'vi',
            <FocusedDay
                {...props({
                    isToday: true,
                    items: [
                        makeEntry({ subtask: makeSubtask({ id: 'a', isDone: true }) }),
                        makeEntry({ subtask: makeSubtask({ id: 'b' }) }),
                    ],
                })}
            />,
        );

        expect(screen.getByText(viCatalog.focusedDay.doneOf(1, 2))).toBeInTheDocument();
        expect(screen.queryByText('1 of 2 done')).toBeNull();
        // The marker trails the day name in the same node, so the two are read
        // as the one line they are.
        expect(screen.getByText(`Thứ Tư${viCatalog.focusedDay.today}`)).toBeInTheDocument();
        expect(screen.queryByText(/· today/)).toBeNull();
    });

    it('covers isToday false: head text omits "· today"', () => {
        render(
            <FocusedDay
                day="wed"
                due={noDue}
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
                due={noDue}
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
                due={noDue}
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
    it('covers nothing due: no due line', () => {
        render(
            <FocusedDay
                day="wed"
                due={noDue}
                items={[makeEntry()]}
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
        expect(screen.queryByText(/^Due · /)).not.toBeInTheDocument();
    });

    it('covers several due: one line naming them in order', () => {
        const due: DayDue['entries'] = [
            { name: 'Ôn đề thi', kind: 'task', deadline: '2026-07-22' },
            { name: 'Viết phần phương pháp', kind: 'task', deadline: '2026-07-22' },
        ];
        render(
            <FocusedDay
                day="wed"
                items={[makeEntry()]}
                due={due}
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
        expect(screen.getByText('Due · Ôn đề thi, Viết phần phương pháp')).toBeInTheDocument();
    });

    it('covers a deadline whose work is scheduled elsewhere: named though the day is empty', () => {
        const due: DayDue['entries'] = [
            { name: 'Submit ethics form', kind: 'task', deadline: '2026-07-22' },
        ];
        render(
            <FocusedDay
                day="wed"
                items={[]}
                due={due}
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
        expect(screen.getByText('Due · Submit ethics form')).toBeInTheDocument();
        // the day itself is still empty, and still says so
        expect(screen.getByText(en.focusedDay.empty)).toBeInTheDocument();
    });
});
