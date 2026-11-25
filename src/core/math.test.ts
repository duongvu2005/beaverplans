import { describe, it, expect } from 'vitest';
import { clamp, percentOf } from './math';

describe('clamp', () => {
    /*
     * Testing strategy
     *     partition on x vs [lo, hi]: x < lo; x = lo; lo < x < hi; x = hi; x > hi
     *     partition on interval: lo < hi; lo = hi
     *     x is NaN
     */

    it('covers x < lo and lo < hi', () => {
        const x = -1;
        const lo = 5;
        const hi = 10;
        expect(clamp(x, lo, hi)).toBe(lo);
    });

    it('covers x < lo and lo = hi', () => {
        const x = -42;
        const lo = 20;
        const hi = 20;
        expect(clamp(x, lo, hi)).toBe(lo);
    });

    it('covers x = lo and lo < hi', () => {
        const x = 3;
        const lo = 3;
        const hi = 26;
        expect(clamp(x, lo, hi)).toBe(lo);
    });

    it('covers x = lo and lo = hi', () => {
        const x = 61;
        const lo = 61;
        const hi = 61;
        expect(clamp(x, lo, hi)).toBe(lo);
    });

    it('covers lo < x < hi and lo < hi', () => {
        const x = 6;
        const lo = -1;
        const hi = 43;
        expect(clamp(x, lo, hi)).toBe(x);
    });

    it('covers x = hi and lo < hi', () => {
        const x = 232;
        const lo = 100;
        const hi = 232;
        expect(clamp(x, lo, hi)).toBe(hi);
    });

    it('covers x > hi and lo < hi', () => {
        const x = 12341;
        const lo = -100;
        const hi = 143;
        expect(clamp(x, lo, hi)).toBe(hi);
    });

    it('covers x > hi and lo = hi', () => {
        const x = 420;
        const lo = 100;
        const hi = 100;
        expect(clamp(x, lo, hi)).toBe(hi);
    });

    it('covers x is NaN and lo = hi', () => {
        const x = NaN;
        const lo = 42;
        const hi = 42;
        expect(clamp(x, lo, hi)).toBeNaN();
    });

    it('covers x is NaN and lo < hi', () => {
        const x = NaN;
        const lo = 10;
        const hi = 172;
        expect(clamp(x, lo, hi)).toBeNaN();
    });
});

describe('percentOf', () => {
    /*
     * Testing strategy
     *     partition on whole: zero; nonzero
     *     partition on part vs whole (nonzero, same sign): part < whole; part = whole; part > whole
     *     partition on sign: mixed (one positive, one negative)
     *     boundary: result is a non-terminating fraction (not rounded)
     */

    it('covers whole = 0', () => {
        const part = 7;
        const whole = 0;
        expect(percentOf(part, whole)).toBe(0);
    });

    it('covers part < whole, both positive', () => {
        const part = 5;
        const whole = 20;
        expect(percentOf(part, whole)).toBe(25);
    });

    it('covers part = whole, both positive', () => {
        const part = 7;
        const whole = 7;
        expect(percentOf(part, whole)).toBe(100);
    });

    it('covers part > whole, both positive', () => {
        const part = 30;
        const whole = 10;
        expect(percentOf(part, whole)).toBe(300);
    });

    it('covers mixed sign', () => {
        const part = -10;
        const whole = 20;
        expect(percentOf(part, whole)).toBe(-50);
    });

    it('covers non-terminating fraction is not rounded', () => {
        const part = 1;
        const whole = 3;
        expect(percentOf(part, whole)).toBeCloseTo(100 / 3);
    });
});
