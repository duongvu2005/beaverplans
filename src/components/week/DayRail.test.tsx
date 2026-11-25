import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderIn } from '@/test/locale';
import { DayRail } from './DayRail';
import { WEEK } from '@/core/types';
import type { DayProgress } from '@/core/progress';
import type { DayDue } from '@/core/daySchedule';
import { en } from '@/i18n/en';
// `vi` is vitest's here, so the Vietnamese catalog comes in renamed.
import { vi as viCatalog } from '@/i18n/vi';

describe('DayRail', () => {
    /*
     * Testing strategy
     *     partition on a pill's relationship to selectedDay/todayDay: neither
     *         | today only | selected only | both today and selected
     *     partition on click target: the selected pill (-> onBackToGrid, not
     *         onSelectDay) | a non-selected pill (-> onSelectDay(day), not
     *         onBackToGrid), regardless of whether it is today
     *     partition on a pill's due list: empty (no flag) | nonempty (a flag,
     *         labelled with the count it does not have room to print)
     *     the flag must stay legible in all four pill states — a selected pill
     *         is filled with the accent the flag would otherwise use
     */

    const byDay: ReadonlyArray<DayProgress> = WEEK.map((day) => ({
        day,
        assigned: 4,
        done: 2,
    }));

    // Nothing due anywhere unless a case says otherwise.
    const noDue: ReadonlyArray<DayDue> = WEEK.map((day) => ({ day, entries: [] }));

    function dueOn(day: string, howMany: number): ReadonlyArray<DayDue> {
        return WEEK.map((d) => ({
            d,
            entries:
                d === day
                    ? Array.from({ length: howMany }, (_unused, i) => ({
                          name: `item ${i}`,
                          kind: 'task' as const,
                          deadline: '2026-07-22',
                      }))
                    : [],
        })).map(({ d, entries }) => ({ day: d, entries }));
    }

    it('covers a pill that is neither today nor selected: aria-pressed is false', () => {
        render(
            <DayRail
                byDay={byDay}
                due={noDue}
                selectedDay="wed"
                todayDay="thu"
                mode="progress"
                onSelectDay={() => {}}
                onBackToGrid={() => {}}
            />,
        );
        const monPill = screen.getAllByRole('button')[WEEK.indexOf('mon')]!;
        expect(monPill).toHaveAttribute('aria-pressed', 'false');
    });

    it('covers the selected pill: aria-pressed is true, and clicking it calls onBackToGrid, not onSelectDay', async () => {
        const user = userEvent.setup();
        const onSelectDay = vi.fn();
        const onBackToGrid = vi.fn();
        render(
            <DayRail
                byDay={byDay}
                due={noDue}
                selectedDay="wed"
                todayDay="thu"
                mode="progress"
                onSelectDay={onSelectDay}
                onBackToGrid={onBackToGrid}
            />,
        );
        const wedPill = screen.getAllByRole('button')[WEEK.indexOf('wed')]!;
        expect(wedPill).toHaveAttribute('aria-pressed', 'true');

        await user.click(wedPill);

        expect(onBackToGrid).toHaveBeenCalledTimes(1);
        expect(onSelectDay).not.toHaveBeenCalled();
    });

    it('covers the today pill, not selected: clicking it calls onSelectDay(day), not onBackToGrid', async () => {
        const user = userEvent.setup();
        const onSelectDay = vi.fn();
        const onBackToGrid = vi.fn();
        render(
            <DayRail
                byDay={byDay}
                due={noDue}
                selectedDay="wed"
                todayDay="thu"
                mode="progress"
                onSelectDay={onSelectDay}
                onBackToGrid={onBackToGrid}
            />,
        );
        const thuPill = screen.getAllByRole('button')[WEEK.indexOf('thu')]!;

        await user.click(thuPill);

        expect(onSelectDay).toHaveBeenCalledTimes(1);
        expect(onSelectDay).toHaveBeenCalledWith('thu');
        expect(onBackToGrid).not.toHaveBeenCalled();
    });

    it('covers a pill that is both today and selected: clicking it calls onBackToGrid', async () => {
        const user = userEvent.setup();
        const onSelectDay = vi.fn();
        const onBackToGrid = vi.fn();
        render(
            <DayRail
                byDay={byDay}
                due={noDue}
                selectedDay="thu"
                todayDay="thu"
                mode="progress"
                onSelectDay={onSelectDay}
                onBackToGrid={onBackToGrid}
            />,
        );
        const thuPill = screen.getAllByRole('button')[WEEK.indexOf('thu')]!;

        await user.click(thuPill);

        expect(onBackToGrid).toHaveBeenCalledTimes(1);
        expect(onSelectDay).not.toHaveBeenCalled();
    });

    // The narrowest name form: English drops to one character and Vietnamese
    // cannot — `CN` does not shorten to `N`, so a one-character rail clips.
    it('covers vi: two-character day names, and Sunday is CN', () => {
        renderIn(
            'vi',
            <DayRail
                byDay={byDay}
                due={noDue}
                selectedDay="thu"
                todayDay="thu"
                mode="progress"
                onSelectDay={() => {}}
                onBackToGrid={() => {}}
            />,
        );

        expect(screen.getByText('T2')).toBeInTheDocument();
        expect(screen.getByText('CN')).toBeInTheDocument();
        expect(screen.queryByText('M')).toBeNull();
    });
    it('covers no day having anything due: no flag anywhere', () => {
        render(
            <DayRail
                byDay={byDay}
                due={noDue}
                selectedDay="wed"
                todayDay="thu"
                mode="progress"
                onSelectDay={() => {}}
                onBackToGrid={() => {}}
            />,
        );
        expect(screen.queryByLabelText(/due/i)).not.toBeInTheDocument();
    });

    it('covers a day with deadlines: one flag, on that pill, carrying the count for a reader', () => {
        render(
            <DayRail
                byDay={byDay}
                due={dueOn('fri', 3)}
                selectedDay="wed"
                todayDay="thu"
                mode="progress"
                onSelectDay={() => {}}
                onBackToGrid={() => {}}
            />,
        );
        const flags = screen.getAllByLabelText(/due/i);
        expect(flags).toHaveLength(1);
        expect(flags[0]).toHaveAccessibleName('3 due');
        const friPill = screen.getAllByRole('button')[WEEK.indexOf('fri')]!;
        expect(friPill).toContainElement(flags[0]!);
    });

    it('covers the flag surviving every pill state, selected included', () => {
        render(
            <DayRail
                byDay={byDay}
                due={WEEK.map((day) => ({
                    day,
                    entries: [{ name: 'x', kind: 'task' as const, deadline: '2026-07-22' }],
                }))}
                selectedDay="wed"
                todayDay="thu"
                mode="progress"
                onSelectDay={() => {}}
                onBackToGrid={() => {}}
            />,
        );
        expect(screen.getAllByLabelText(/due/i)).toHaveLength(WEEK.length);
    });

    it('covers vi: the flag is labelled from the catalog', () => {
        renderIn(
            'vi',
            <DayRail
                byDay={byDay}
                due={dueOn('fri', 2)}
                selectedDay="wed"
                todayDay="thu"
                mode="progress"
                onSelectDay={() => {}}
                onBackToGrid={() => {}}
            />,
        );
        expect(screen.getByLabelText(viCatalog.common.dueCount(2))).toBeInTheDocument();
    });

    /*
     * Testing strategy — mode
     *     partition on mode: 'progress' (a bar, no number) | 'count' (a number,
     *         no bar)
     *     partition on a day's assigned count in 'count' mode: 0 (prints
     *         nothing — the rail never shows a bare zero) | nonzero (prints it)
     *     the count is the day's LOAD, so it does not move as work is ticked off
     */

    // Mixed loads, including an empty day, so one render covers both partitions.
    const mixedLoads: ReadonlyArray<DayProgress> = WEEK.map((day, i) => ({
        day,
        assigned: i === 0 ? 0 : i,
        done: 0,
    }));

    function renderMode(mode: 'progress' | 'count') {
        render(
            <DayRail
                byDay={mixedLoads}
                due={noDue}
                selectedDay="wed"
                todayDay="thu"
                mode={mode}
                onSelectDay={() => {}}
                onBackToGrid={() => {}}
            />,
        );
    }

    it('covers count mode: each day prints how much is on it', () => {
        renderMode('count');
        // tue..sun carry 1..6; mon carries 0 and is covered below.
        for (const n of [1, 2, 3, 4, 5, 6]) {
            expect(screen.getByText(String(n))).toBeInTheDocument();
        }
    });

    it('covers count mode with an empty day: no zero is printed', () => {
        renderMode('count');
        expect(screen.queryByText('0')).toBeNull();
    });

    it('covers progress mode: no count is printed', () => {
        renderMode('progress');
        for (const n of [1, 2, 3, 4, 5, 6]) {
            expect(screen.queryByText(String(n))).toBeNull();
        }
    });

    // The number alone reads as "M 3"; the label is what makes it a quantity.
    it('covers count mode: the number carries a labelled quantity', () => {
        renderMode('count');
        expect(screen.getByLabelText(en.weekView.taskCount(3))).toBeInTheDocument();
    });

    it('covers vi: the count label comes from the catalog', () => {
        renderIn(
            'vi',
            <DayRail
                byDay={mixedLoads}
                due={noDue}
                selectedDay="wed"
                todayDay="thu"
                mode="count"
                onSelectDay={() => {}}
                onBackToGrid={() => {}}
            />,
        );
        expect(screen.getByLabelText(viCatalog.weekView.taskCount(3))).toBeInTheDocument();
    });

    // The count is the day's load: ticking work off must not change it.
    it('covers count mode: the number is the load, not what is left', () => {
        render(
            <DayRail
                byDay={WEEK.map((day) => ({ day, assigned: 5, done: 5 }))}
                due={noDue}
                selectedDay="wed"
                todayDay="thu"
                mode="count"
                onSelectDay={() => {}}
                onBackToGrid={() => {}}
            />,
        );
        expect(screen.getAllByText('5')).toHaveLength(WEEK.length);
    });
});
