import { describe, it, expect } from 'vitest';
import { exportJson, exportFilename, EXPORT_FORMAT, type ExportEnvelope } from './exportData';
import type { Weeks } from '@/core/types';

const week = (weekStart: string, ended: boolean): Weeks[number] => ({
    weekStart,
    ended,
    projects: [
        {
            id: `p-${weekStart}`,
            name: 'Thesis',
            tasks: [
                {
                    id: `t-${weekStart}`,
                    name: 'Read',
                    subtasks: [
                        {
                            id: `s-${weekStart}`,
                            isDone: true,
                            assignedDay: 'wed',
                            missedDays: ['mon'],
                            weight: 2,
                        },
                    ],
                },
            ],
        },
    ],
});

describe('exportJson', () => {
    /*
     * Testing strategy
     *   partition on weeks: empty | one | several (order preserved)
     *   partition on week content: no projects | a full project/task/subtask tree
     *   the envelope: carries the format tag and `now` as an instant
     *   round trip: JSON.parse(exportJson(w, now)).weeks deep-equals w
     */

    const now = new Date('2026-08-08T21:30:00Z');

    it('empty collection: still a well-formed, tagged envelope', () => {
        const parsed = JSON.parse(exportJson([], now)) as ExportEnvelope;
        expect(parsed.format).toBe(EXPORT_FORMAT);
        expect(parsed.weeks).toEqual([]);
    });

    it('stamps the instant it was given, not the wall clock', () => {
        const parsed = JSON.parse(exportJson([], now)) as ExportEnvelope;
        expect(parsed.exportedAt).toBe('2026-08-08T21:30:00.000Z');
    });

    it('a week with no projects survives the trip', () => {
        const weeks: Weeks = [{ weekStart: '2026-08-03', ended: false, projects: [] }];
        const parsed = JSON.parse(exportJson(weeks, now)) as ExportEnvelope;
        expect(parsed.weeks).toEqual(weeks);
    });

    it('round trip: a full tree deep-equals the input', () => {
        const weeks: Weeks = [week('2026-08-03', false)];
        const parsed = JSON.parse(exportJson(weeks, now)) as ExportEnvelope;
        expect(parsed.weeks).toEqual(weeks);
    });

    it('several weeks keep their order', () => {
        const weeks: Weeks = [
            week('2026-08-03', false),
            week('2026-07-27', true),
            week('2026-07-20', true),
        ];
        const parsed = JSON.parse(exportJson(weeks, now)) as ExportEnvelope;
        expect(parsed.weeks.map((w) => w.weekStart)).toEqual([
            '2026-08-03',
            '2026-07-27',
            '2026-07-20',
        ]);
    });

    it('does not mutate the collection it was handed', () => {
        const weeks: Weeks = [week('2026-08-03', false)];
        const before = JSON.parse(JSON.stringify(weeks)) as Weeks;
        exportJson(weeks, now);
        expect(weeks).toEqual(before);
    });
});

describe('exportFilename', () => {
    /*
     * Testing strategy
     *   partition on month/day: needs zero-padding | does not
     *   local, not UTC: an instant that is already the next day in UTC still
     *     names the local day (tests run in America/New_York, see vite.config)
     */

    it('pads single-digit months and days', () => {
        expect(exportFilename(new Date(2026, 0, 5, 12))).toBe('beaverplans-2026-01-05.json');
    });

    it('leaves two-digit months and days alone', () => {
        expect(exportFilename(new Date(2026, 10, 23, 12))).toBe('beaverplans-2026-11-23.json');
    });

    it('names the local day, not the UTC one', () => {
        // 20:00 in New York on the 8th is already the 9th in UTC.
        expect(exportFilename(new Date('2026-08-09T00:00:00Z'))).toBe(
            'beaverplans-2026-08-08.json',
        );
    });
});
