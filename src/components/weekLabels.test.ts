import { describe, it, expect } from 'vitest';
import { relativeWeekName } from './weekLabels';

// 2026-07-27 is a Monday; today falls inside its week.
const THIS_WEEK = '2026-07-27';
const TODAY = '2026-07-30';

describe('relativeWeekName', () => {
    /*
     * Testing strategy
     *     partition on weeks between weekStart and today:
     *         0 | -1 | +1 | < -1 | > +1
     */

    it('covers 0: the current week', () => {
        expect(relativeWeekName(THIS_WEEK, TODAY)).toBe('This week');
    });

    it('covers -1 and +1: the named neighbours', () => {
        expect(relativeWeekName('2026-07-20', TODAY)).toBe('Last week');
        expect(relativeWeekName('2026-08-03', TODAY)).toBe('Next week');
    });

    it('covers < -1 and > +1: counted weeks', () => {
        expect(relativeWeekName('2026-07-06', TODAY)).toBe('3 weeks ago');
        expect(relativeWeekName('2026-08-17', TODAY)).toBe('In 3 weeks');
    });
});
