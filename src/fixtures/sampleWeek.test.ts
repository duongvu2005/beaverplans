import { describe, it, expect } from 'vitest';
import { isValidPlan } from '../core/projects';
import { sampleWeek } from './sampleWeek';

describe('sampleWeek fixture', () => {
    it('is a well-formed WeekPlan (satisfies the rep invariant)', () => {
        expect(isValidPlan(sampleWeek)).toBe(true);
    });
});
