import { describe, it, expect } from 'vitest';
import { archiveWeek, archiveNewestFirst, removeArchived } from './archive';
import type { WeekPlan, Archive } from './types';

function sorted(archive: Archive): Archive {
    return [...archive].sort((a, b) => a.weekStart.localeCompare(b.weekStart));
}

describe('archiveWeek', () => {
    it('archives into an empty archive', () => {
        const plan: WeekPlan = { weekStart: '2026-07-06', projects: [] };
        expect(archiveWeek([], plan)).toEqual([plan]);
    });

    it('adds to existing entries, leaving them unchanged, order unspecified', () => {
        const first: WeekPlan = { weekStart: '2026-06-22', projects: [] };
        const second: WeekPlan = { weekStart: '2026-06-29', projects: [] };
        const archive: Archive = [first, second];
        const plan: WeekPlan = { weekStart: '2026-07-06', projects: [] };

        const result = archiveWeek(archive, plan);

        expect(sorted(result)).toEqual([first, second, plan]);
        expect(archive).toEqual([first, second]); // input untouched
    });
});

describe('archiveNewestFirst', () => {
    /**
     * Testing strategy:
     *      - partition on size: empty | one | many
     *      - partition on incoming order: already newest-first | oldest-first | shuffled
     *      - partition on span: within a month | across a year boundary
     *      - property: the argument is not mutated
     */

    const w = (weekStart: string): WeekPlan => ({ weekStart, projects: [] });

    it('covers empty', () => {
        expect(archiveNewestFirst([])).toEqual([]);
    });

    it('covers one entry', () => {
        expect(archiveNewestFirst([w('2026-07-06')])).toEqual([w('2026-07-06')]);
    });

    it('covers many, already newest-first: order preserved', () => {
        const archive = [w('2026-07-13'), w('2026-07-06'), w('2026-06-29')];
        expect(archiveNewestFirst(archive)).toEqual(archive);
    });

    it('covers many, oldest-first: order reversed', () => {
        const archive = [w('2026-06-29'), w('2026-07-06'), w('2026-07-13')];
        expect(archiveNewestFirst(archive).map((e) => e.weekStart)).toEqual([
            '2026-07-13',
            '2026-07-06',
            '2026-06-29',
        ]);
    });

    it('covers shuffled, across a year boundary', () => {
        // Dec 2026 and Jan 2027 weeks interleaved: string order must still
        // put 2027 ahead of 2026.
        const archive = [w('2026-12-21'), w('2027-01-04'), w('2026-12-28')];
        expect(archiveNewestFirst(archive).map((e) => e.weekStart)).toEqual([
            '2027-01-04',
            '2026-12-28',
            '2026-12-21',
        ]);
    });

    it('does not mutate its argument', () => {
        const archive = [w('2026-06-29'), w('2026-07-13'), w('2026-07-06')];
        const before = archive.map((e) => e.weekStart);
        archiveNewestFirst(archive);
        expect(archive.map((e) => e.weekStart)).toEqual(before);
    });
});

describe('removeArchived', () => {
    /**
     * Testing strategy:
     *      - partition on position of the removed entry: only | first | middle | last
     *      - partition on presence: weekStart present | absent | archive empty
     *      - property: surviving entries keep their relative order and identity
     */

    const w = (weekStart: string): WeekPlan => ({ weekStart, projects: [] });

    it('covers the only entry', () => {
        expect(removeArchived([w('2026-07-06')], '2026-07-06')).toEqual([]);
    });

    it('covers the first of many', () => {
        const archive = [w('2026-06-29'), w('2026-07-06'), w('2026-07-13')];
        expect(removeArchived(archive, '2026-06-29').map((e) => e.weekStart)).toEqual([
            '2026-07-06',
            '2026-07-13',
        ]);
    });

    it('covers a middle entry, surviving order preserved', () => {
        const archive = [w('2026-06-29'), w('2026-07-06'), w('2026-07-13')];
        expect(removeArchived(archive, '2026-07-06').map((e) => e.weekStart)).toEqual([
            '2026-06-29',
            '2026-07-13',
        ]);
    });

    it('covers the last of many', () => {
        const archive = [w('2026-06-29'), w('2026-07-06'), w('2026-07-13')];
        expect(removeArchived(archive, '2026-07-13').map((e) => e.weekStart)).toEqual([
            '2026-06-29',
            '2026-07-06',
        ]);
    });

    it('covers an absent weekStart: contents unchanged', () => {
        const archive = [w('2026-06-29'), w('2026-07-06')];
        expect(removeArchived(archive, '2026-08-03')).toEqual(archive);
    });

    it('covers an empty archive', () => {
        expect(removeArchived([], '2026-07-06')).toEqual([]);
    });

    it('keeps surviving entries identical, not copies', () => {
        const keep = w('2026-07-13');
        const result = removeArchived([w('2026-07-06'), keep], '2026-07-06');
        expect(result[0]).toBe(keep);
    });
});
