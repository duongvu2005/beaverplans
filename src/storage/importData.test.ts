import { describe, expect, it } from 'vitest';
import { exportJson, EXPORT_FORMAT } from './exportData';
import { parseWeeks } from './importData';
import { LIMITS } from '@/core/limits';
import { sampleArchive } from '@/fixtures/sampleArchive';
import { sampleWeek } from '@/fixtures/sampleWeek';

/**
 * parseWeeks reads back what the app writes out, from either of the two files
 * it produces: the export envelope and the raw stored blob the crash screen
 * hands over. Both carry a top-level `weeks`; only the envelope is tagged.
 *
 * Partition on what the text is:
 *   not JSON; JSON that is not an object; an object holding something else
 *   entirely; a tagged envelope from a version this one does not know; a
 *   tagged envelope this one does know; an untagged stored blob
 * and on the weeks inside a recognised file:
 *   valid and non-empty; valid and empty; invalid
 */
describe('parseWeeks', () => {
    const stored = (weeks: unknown) => JSON.stringify({ weeks });
    // sampleArchive is listed newest-first; a stored collection is ascending,
    // which is what putWeek guarantees and what an export therefore carries.
    const ascending = [...sampleArchive].sort((a, b) => (a.weekStart < b.weekStart ? -1 : 1));

    it('covers text that is not JSON at all', () => {
        expect(parseWeeks('not json{{')).toEqual({ ok: false, reason: 'not-json' });
    });

    it('covers JSON that is not an object', () => {
        expect(parseWeeks('42')).toEqual({ ok: false, reason: 'not-beaverplans' });
        expect(parseWeeks('null')).toEqual({ ok: false, reason: 'not-beaverplans' });
        expect(parseWeeks('[]')).toEqual({ ok: false, reason: 'not-beaverplans' });
    });

    it('covers an object holding something else entirely', () => {
        expect(parseWeeks('{"hello":"world"}')).toEqual({ ok: false, reason: 'not-beaverplans' });
    });

    it('covers an envelope from a format this version does not know', () => {
        const text = JSON.stringify({ format: 'beaverplans.export.v99', weeks: sampleArchive });
        expect(parseWeeks(text)).toEqual({ ok: false, reason: 'malformed' });
    });

    it('covers a well-formed export envelope', () => {
        const text = exportJson(ascending, new Date('2026-08-18T12:00:00Z'));
        expect(parseWeeks(text)).toEqual({ ok: true, weeks: ascending });
    });

    it('covers a collection listed newest-first, which the ordering rule refuses', () => {
        expect(parseWeeks(stored(sampleArchive))).toEqual({ ok: false, reason: 'malformed' });
    });

    it('covers an untagged stored blob, which is what the crash screen writes', () => {
        expect(parseWeeks(stored([sampleWeek]))).toEqual({ ok: true, weeks: [sampleWeek] });
    });

    it('covers an empty but valid collection', () => {
        expect(parseWeeks(stored([]))).toEqual({ ok: true, weeks: [] });
        expect(parseWeeks(exportJson([], new Date()))).toEqual({ ok: true, weeks: [] });
    });

    it('covers a recognised file whose weeks are not an array', () => {
        const text = JSON.stringify({ format: EXPORT_FORMAT, weeks: { nope: true } });
        expect(parseWeeks(text)).toEqual({ ok: false, reason: 'malformed' });
    });

    it('covers weeks that fail isValidWeeks', () => {
        // Two entries at the same weekStart: the collection's ordering rule.
        expect(parseWeeks(stored([sampleWeek, sampleWeek]))).toEqual({
            ok: false,
            reason: 'malformed',
        });
    });

    it('covers entries far enough from a WeekPlan that validation throws', () => {
        expect(parseWeeks(stored([null]))).toEqual({ ok: false, reason: 'malformed' });
        expect(parseWeeks(stored(['a string']))).toEqual({ ok: false, reason: 'malformed' });
    });

    /**
     * The caps in limits.ts apply here as they do to a paste: this is an entry
     * point, not the rep invariant.
     *
     * Partition on which cap is broken:
     *   projects in a week; tasks in a project; subtasks in a task; a name too
     *   long; a note too long; nothing over any of them
     * and on where the offender sits: the only week; a later week.
     */
    const projectOf = (id: string, tasks: unknown[] = []) => ({ id, name: id, tasks });
    const weekOf = (weekStart: string, projects: unknown[]) => ({
        weekStart,
        ended: false,
        projects,
    });

    it('covers a week over the projects cap', () => {
        const projects = Array.from({ length: LIMITS.projectsPerWeek + 1 }, (_, i) =>
            projectOf(`p${i}`),
        );
        expect(parseWeeks(stored([weekOf('2026-07-20', projects)]))).toEqual({
            ok: false,
            reason: 'too-big',
            shape: { projects: LIMITS.projectsPerWeek + 1, maxTasks: 0, maxSubtasks: 0 },
        });
    });

    it('covers a project over the tasks cap', () => {
        const tasks = Array.from({ length: LIMITS.tasksPerProject + 1 }, (_, i) => ({
            id: `t${i}`,
            name: `t${i}`,
            isDone: false,
            subtasks: [],
        }));
        const result = parseWeeks(stored([weekOf('2026-07-20', [projectOf('p0', tasks)])]));
        expect(result).toMatchObject({ ok: false, reason: 'too-big' });
    });

    it('covers a task over the subtasks cap', () => {
        const subtasks = Array.from({ length: LIMITS.subtasksPerTask + 1 }, (_, i) => ({
            id: `s${i}`,
            isDone: false,
            assignedDay: 'mon',
            missedDays: [],
            weight: 1,
        }));
        const task = { id: 't0', name: 't0', subtasks };
        const result = parseWeeks(stored([weekOf('2026-07-20', [projectOf('p0', [task])])]));
        expect(result).toMatchObject({ ok: false, reason: 'too-big' });
    });

    it('covers a name over its cap', () => {
        const project = { id: 'p0', name: 'x'.repeat(LIMITS.nameLength + 1), tasks: [] };
        expect(parseWeeks(stored([weekOf('2026-07-20', [project])]))).toEqual({
            ok: false,
            reason: 'too-long',
        });
    });

    it('covers a note over its cap', () => {
        const task = {
            id: 't0',
            name: 't0',
            isDone: false,
            subtasks: [],
            description: 'x'.repeat(LIMITS.descriptionLength + 1),
        };
        expect(parseWeeks(stored([weekOf('2026-07-20', [projectOf('p0', [task])])]))).toEqual({
            ok: false,
            reason: 'too-long',
        });
    });

    it('covers an offender in a LATER week, not just the first', () => {
        const fine = weekOf('2026-07-13', [projectOf('ok0')]);
        const over = weekOf('2026-07-20', [
            { id: 'bad', name: 'x'.repeat(LIMITS.nameLength + 1), tasks: [] },
        ]);
        expect(parseWeeks(stored([fine, over]))).toEqual({ ok: false, reason: 'too-long' });
    });

    it('covers a collection sitting exactly on the caps', () => {
        const projects = Array.from({ length: LIMITS.projectsPerWeek }, (_, i) =>
            projectOf(`p${i}`),
        );
        const week = weekOf('2026-07-20', projects);
        expect(parseWeeks(stored([week]))).toEqual({ ok: true, weeks: [week] });
    });
});
