import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WeekRef } from './WeekRef';

describe('WeekRef', () => {
    /*
     * Testing strategy
     *     partition on the gesture: click | keyboard
     *     partition on the accessible name: says where it goes, not just when
     */

    it('names the week it points at, in the same words the header uses', () => {
        render(<WeekRef weekStart="2026-07-20" onView={vi.fn()} />);
        const ref = screen.getByRole('button');
        expect(ref).toHaveTextContent('Jul 20 – Jul 26');
        // read aloud, "Jul 20 – Jul 26" mid-sentence is a date, not a control
        expect(ref).toHaveAccessibleName('Go to Jul 20 – Jul 26');
    });

    it('hands the week back on click', async () => {
        const onView = vi.fn();
        const user = userEvent.setup();
        render(<WeekRef weekStart="2026-07-20" onView={onView} />);
        await user.click(screen.getByRole('button'));
        expect(onView).toHaveBeenCalledWith('2026-07-20');
    });

    it('is reachable and firable from the keyboard, being a real button', async () => {
        const onView = vi.fn();
        const user = userEvent.setup();
        render(<WeekRef weekStart="2026-05-11" onView={onView} />);
        await user.tab();
        expect(screen.getByRole('button')).toHaveFocus();
        await user.keyboard('{Enter}');
        expect(onView).toHaveBeenCalledWith('2026-05-11');
    });
});
