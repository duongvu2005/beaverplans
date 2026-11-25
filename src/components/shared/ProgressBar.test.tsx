import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { ProgressBar } from './ProgressBar';

describe('ProgressBar', () => {
    /*
     * Testing strategy
     *     partition on total: zero (renders nothing) | nonzero
     *     partition on className: given | omitted
     *     wiring check only: the fill's width reflects percentOf(done, total);
     *         percentOf's own math is tested in core/math, not re-derived here
     */

    it('covers total zero: renders nothing', () => {
        const { container } = render(<ProgressBar done={0} total={0} />);
        expect(container).toBeEmptyDOMElement();
    });

    it('covers total nonzero: fill width reflects percentOf(done, total)', () => {
        const { container } = render(<ProgressBar done={2} total={5} />);
        const fill = container.querySelector('span > span') as HTMLElement;
        expect(fill.style.width).toBe('40%');
    });

    it('covers className given: appended alongside the base class', () => {
        const { container } = render(<ProgressBar done={2} total={5} className="custom-mark" />);
        const outer = container.querySelector('span') as HTMLElement;
        expect(outer.className).toContain('custom-mark');
    });

    it('covers className omitted: renders without error', () => {
        const { container } = render(<ProgressBar done={2} total={5} />);
        expect(container.querySelector('span')).toBeInTheDocument();
    });
});
