import { describe, it, expect } from 'vitest';
import { clamp } from './math';

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
    })
});