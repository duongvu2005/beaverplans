import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PointsStat } from './PointsStat';

describe('PointsStat', () => {
    /*
     * Testing strategy
     *     partition on total: zero (renders nothing) | nonzero
     *     partition on showPoint: true | false (only observable when total is nonzero)
     */

    it('covers total zero: renders nothing', () => {
        const { container } = render(<PointsStat done={0} total={0} />);
        expect(container).toBeEmptyDOMElement();
    });

    it('covers total nonzero, showPoint defaulted false: renders "done/total" without "pts"', () => {
        render(<PointsStat done={3} total={5} />);
        expect(screen.getByText('3/5')).toBeInTheDocument();
    });

    it('covers total nonzero, showPoint true: renders "done/total pts"', () => {
        render(<PointsStat done={3} total={5} showPoint />);
        expect(screen.getByText('3/5 pts')).toBeInTheDocument();
    });
});
