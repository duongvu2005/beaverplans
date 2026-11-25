import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { renderIn } from '@/test/locale';
import { PointsStat } from './PointsStat';

describe('PointsStat', () => {
    /*
     * Testing strategy
     *     partition on total: zero (renders nothing) | nonzero
     */

    it('covers total zero: renders nothing', () => {
        const { container } = render(<PointsStat done={0} total={0} />);
        expect(container).toBeEmptyDOMElement();
    });

    it('covers total nonzero: renders the tally alone', () => {
        render(<PointsStat done={3} total={5} />);
        expect(screen.getByText('3/5')).toBeInTheDocument();
    });

    it('covers vi: nothing to translate, so the tally reads the same', () => {
        renderIn('vi', <PointsStat done={3} total={5} />);
        expect(screen.getByText('3/5')).toBeInTheDocument();
    });
});
