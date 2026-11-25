import { describe, it, expect } from 'vitest';
import { en } from '@/i18n/en';
import { vi } from '@/i18n/vi';
import { relativeWeekName } from './weekLabels';

// 2026-07-27 is a Monday; today falls inside its week.
const THIS_WEEK = '2026-07-27';
const TODAY = '2026-07-30';

describe('relativeWeekName', () => {
    /*
     * Testing strategy
     *     partition on weeks between weekStart and today:
     *         0 | -1 | +1 | < -1 | > +1
     *     partition on the catalog handed in: en | vi
     *
     * The Vietnamese cases cover the one thing the arithmetic cannot: that a
     * count reaches the catalog and comes back placed as that language places it.
     */

    it('covers 0: the current week', () => {
        expect(relativeWeekName(THIS_WEEK, TODAY, en.weekLabels)).toBe('This week');
    });

    it('covers -1 and +1: the named neighbours', () => {
        expect(relativeWeekName('2026-07-20', TODAY, en.weekLabels)).toBe('Last week');
        expect(relativeWeekName('2026-08-03', TODAY, en.weekLabels)).toBe('Next week');
    });

    it('covers < -1 and > +1: counted weeks', () => {
        expect(relativeWeekName('2026-07-06', TODAY, en.weekLabels)).toBe('3 weeks ago');
        expect(relativeWeekName('2026-08-17', TODAY, en.weekLabels)).toBe('In 3 weeks');
    });

    it('covers vi: the three neighbours', () => {
        expect(relativeWeekName(THIS_WEEK, TODAY, vi.weekLabels)).toBe('Tuần này');
        expect(relativeWeekName('2026-07-20', TODAY, vi.weekLabels)).toBe('Tuần trước');
        expect(relativeWeekName('2026-08-03', TODAY, vi.weekLabels)).toBe('Tuần sau');
    });

    // The count leads and the direction word closes, which is the opposite of
    // where English puts "In".
    it('covers vi: counted weeks, with no plural to make', () => {
        expect(relativeWeekName('2026-07-06', TODAY, vi.weekLabels)).toBe('3 tuần trước');
        expect(relativeWeekName('2026-08-17', TODAY, vi.weekLabels)).toBe('3 tuần nữa');
        expect(relativeWeekName('2026-07-13', TODAY, vi.weekLabels)).toBe('2 tuần trước');
    });
});
