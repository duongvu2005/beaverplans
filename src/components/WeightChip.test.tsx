import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WeightChip } from './WeightChip';
import styles from './WeightChip.module.css';

describe('WeightChip', () => {
    /*
     * Testing strategy
     *     partition on weight: drives the chip's accessible label
     *         ("Weight: Easy/Medium/Hard") and which sheet option carries the
     *         selected marker
     *     partition on label: present (sheet heading "Weight — <label>")
     *         | absent (plain "Weight")
     *     partition on sheet open state: closed (initial) | opened via clicking
     *         the chip
     *     interaction: clicking the chip opens the sheet; clicking a sheet
     *         option calls onChange(level) and closes the sheet; clicking the
     *         fine-pointer control (WeightDots) calls onChange(level) directly
     *         and never opens the sheet
     */

    it('covers weight drives the chip\'s accessible label', () => {
        render(<WeightChip weight={2} onChange={() => {}} />);
        expect(screen.getByRole('button', { name: 'Weight: Medium' })).toBeInTheDocument();
    });

    it('covers label present: sheet heading is "Weight — <label>"', async () => {
        const user = userEvent.setup();
        render(<WeightChip weight={1} onChange={() => {}} label="bring markers" />);

        await user.click(screen.getByRole('button', { name: 'Weight: Easy' }));

        expect(screen.getByRole('heading', { name: 'Weight — bring markers' })).toBeInTheDocument();
    });

    it('covers label absent: sheet heading is plain "Weight"', async () => {
        const user = userEvent.setup();
        render(<WeightChip weight={1} onChange={() => {}} />);

        await user.click(screen.getByRole('button', { name: 'Weight: Easy' }));

        expect(screen.getByRole('heading', { name: 'Weight' })).toBeInTheDocument();
    });

    it('covers initial state: sheet closed, chip not expanded', () => {
        render(<WeightChip weight={1} onChange={() => {}} />);
        expect(screen.getByRole('button', { name: 'Weight: Easy' })).toHaveAttribute(
            'aria-expanded',
            'false',
        );
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('covers clicking the chip: opens the sheet with all three options', async () => {
        const user = userEvent.setup();
        render(<WeightChip weight={1} onChange={() => {}} />);

        await user.click(screen.getByRole('button', { name: 'Weight: Easy' }));

        expect(screen.getByRole('button', { name: 'Weight: Easy' })).toHaveAttribute(
            'aria-expanded',
            'true',
        );
        expect(screen.getByRole('dialog')).toBeInTheDocument();
        // note: the option's accessible name concatenates as "Easycounts ×1"
        // with no space -- there's no whitespace between the two <span>s in
        // WeightChip.tsx's JSX, a small a11y wart worth a one-line fix
        // separately. Matching loosely here rather than asserting that
        // concatenation as if it were intended.
        expect(screen.getByRole('button', { name: /^Easy.*×1$/ })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /^Medium.*×2$/ })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /^Hard.*×3$/ })).toBeInTheDocument();
    });

    it("covers the currently selected weight's option: carries the selected marker, others don't", async () => {
        const user = userEvent.setup();
        render(<WeightChip weight={2} onChange={() => {}} />);

        await user.click(screen.getByRole('button', { name: 'Weight: Medium' }));

        expect(screen.getByRole('button', { name: /^Medium.*×2$/ }).classList).toContain(
            styles.optSel,
        );
        expect(screen.getByRole('button', { name: /^Easy.*×1$/ }).classList).not.toContain(
            styles.optSel,
        );
        expect(screen.getByRole('button', { name: /^Hard.*×3$/ }).classList).not.toContain(
            styles.optSel,
        );
    });

    it('covers clicking a sheet option: calls onChange(level) and closes the sheet', async () => {
        const user = userEvent.setup();
        const onChange = vi.fn();
        render(<WeightChip weight={1} onChange={onChange} />);

        await user.click(screen.getByRole('button', { name: 'Weight: Easy' }));
        await user.click(screen.getByRole('button', { name: /^Hard.*×3$/ }));

        expect(onChange).toHaveBeenCalledWith(3);
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('covers clicking the fine-pointer control: calls onChange(level) directly, sheet stays closed', async () => {
        const user = userEvent.setup();
        const onChange = vi.fn();
        render(<WeightChip weight={1} onChange={onChange} />);

        await user.click(screen.getByRole('radio', { name: 'Hard' }));

        expect(onChange).toHaveBeenCalledWith(3);
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
});
