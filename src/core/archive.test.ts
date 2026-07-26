import { describe, it, expect } from 'vitest';
import { archiveWeek } from './archive';
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
