import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DayRail } from './DayRail';
import { WEEK } from '../core/types';
import type { DayProgress } from '../core/progress';

describe('DayRail', () => {
    /*
     * Testing strategy
     *     partition on a pill's relationship to selectedDay/todayDay: neither
     *         | today only | selected only | both today and selected
     *     partition on click target: the selected pill (-> onBackToGrid, not
     *         onSelectDay) | a non-selected pill (-> onSelectDay(day), not
     *         onBackToGrid), regardless of whether it is today
     */

    const byDay: ReadonlyArray<DayProgress> = WEEK.map((day) => ({
        day,
        assigned: 4,
        done: 2,
    }));

    it('covers a pill that is neither today nor selected: aria-pressed is false', () => {
        render(
            <DayRail
                byDay={byDay}
                selectedDay="wed"
                todayDay="thu"
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
                selectedDay="wed"
                todayDay="thu"
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
                selectedDay="wed"
                todayDay="thu"
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
                selectedDay="thu"
                todayDay="thu"
                onSelectDay={onSelectDay}
                onBackToGrid={onBackToGrid}
            />,
        );
        const thuPill = screen.getAllByRole('button')[WEEK.indexOf('thu')]!;

        await user.click(thuPill);

        expect(onBackToGrid).toHaveBeenCalledTimes(1);
        expect(onSelectDay).not.toHaveBeenCalled();
    });
});
