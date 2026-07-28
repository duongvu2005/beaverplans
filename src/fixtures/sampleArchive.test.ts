import { describe, it, expect } from 'vitest';
import { isValidPlan } from '../core/projects';
import { isValidWeekStart } from '../core/dates';
import { sampleArchive } from './sampleArchive';

describe('sampleArchive fixture', () => {
    it('every entry is a well-formed WeekPlan (satisfies the rep invariant)', () => {
        for (const entry of sampleArchive) {
            expect(isValidPlan(entry), `${entry.weekStart} is not a valid plan`).toBe(true);
        }
    });

    it('every entry is anchored to a Monday', () => {
        for (const entry of sampleArchive) {
            expect(isValidWeekStart(entry.weekStart), `${entry.weekStart} is not a Monday`).toBe(
                true,
            );
        }
    });

    it('no weekStart appears twice (archiveWeek requires it, and it is the identity)', () => {
        const weekStarts = sampleArchive.map((entry) => entry.weekStart);
        expect(new Set(weekStarts).size).toBe(weekStarts.length);
    });

    it('ids are unique across the whole archive, not just within an entry', () => {
        const ids = sampleArchive.flatMap((entry) =>
            entry.projects.flatMap((project) => [
                project.id,
                ...project.tasks.flatMap((task) => [task.id, ...task.subtasks.map((s) => s.id)]),
            ]),
        );
        expect(new Set(ids).size).toBe(ids.length);
    });
});
