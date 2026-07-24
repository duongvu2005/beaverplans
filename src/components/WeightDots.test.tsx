import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WeightDots } from './WeightDots';

describe('WeightDots', () => {
    /*
     * Testing strategy
     *     partition on weight: which level's radio ends up aria-checked
     *     partition on interaction: click a level | hover a level | unhover
     *         | focus a level (keyboard) | blur
     */

    it('covers the current weight is the only one marked checked', () => {
        render(<WeightDots weight={2} onChange={() => {}} />);
        expect(screen.getByRole('radio', { name: 'Easy' })).toHaveAttribute(
            'aria-checked',
            'false',
        );
        expect(screen.getByRole('radio', { name: 'Medium' })).toHaveAttribute(
            'aria-checked',
            'true',
        );
        expect(screen.getByRole('radio', { name: 'Hard' })).toHaveAttribute(
            'aria-checked',
            'false',
        );
    });

    it('covers clicking a level calls onChange with that level', async () => {
        const user = userEvent.setup();
        const onChange = vi.fn();
        render(<WeightDots weight={1} onChange={onChange} />);

        await user.click(screen.getByRole('radio', { name: 'Hard' }));

        expect(onChange).toHaveBeenCalledTimes(1);
        expect(onChange).toHaveBeenCalledWith(3);
    });

    it('covers hovering a level sets the hint, unhovering clears it', async () => {
        const user = userEvent.setup();
        render(<WeightDots weight={1} onChange={() => {}} />);
        const group = screen.getByRole('radiogroup');
        expect(group).toHaveAttribute('data-hint', '');

        await user.hover(screen.getByRole('radio', { name: 'Hard' }));
        expect(group).toHaveAttribute('data-hint', 'Hard');

        await user.unhover(screen.getByRole('radio', { name: 'Hard' }));
        expect(group).toHaveAttribute('data-hint', '');
    });

    it('covers tabbing focus onto a level sets the hint, tabbing off blurs it', async () => {
        const user = userEvent.setup();
        render(<WeightDots weight={1} onChange={() => {}} />);
        const group = screen.getByRole('radiogroup');

        await user.tab(); // focuses the first radio, Easy
        expect(group).toHaveAttribute('data-hint', 'Easy');

        await user.tab(); // moves to Medium, blurring Easy on the way
        expect(group).toHaveAttribute('data-hint', 'Medium');
    });
});
