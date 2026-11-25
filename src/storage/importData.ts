/**
 * Reading back a file the app wrote out.
 *
 * Two of them qualify. exportData.ts writes a tagged envelope; the crash screen
 * (recovery.ts) writes the stored bytes untouched. Both carry a top-level
 * `weeks`, so one reader serves both — which matters because the untagged one
 * is the file people get at their worst moment.
 */

import type { Weeks } from '@/core/types';
import { isValidWeeks } from '@/core/weeks';
import { LIMITS } from '@/core/limits';
import { EXPORT_FORMAT } from './exportData';
import { fitsText, planShape, type PlanShape } from './weekClipboard';

/**
 * Why an import could not be read. 'not-beaverplans' means the file holds
 * something else entirely; 'malformed' means it IS one of ours, damaged or from
 * a version this one does not understand.
 */
export type ImportFailure = 'not-json' | 'not-beaverplans' | 'malformed' | 'too-big' | 'too-long';

export type ImportResult =
    | { readonly ok: true; readonly weeks: Weeks }
    | { readonly ok: false; readonly reason: 'too-big'; readonly shape: PlanShape }
    | { readonly ok: false; readonly reason: Exclude<ImportFailure, 'too-big'> };

/**
 * Read a whole collection back out of a file.
 *
 * @param text anything at all — this is a file the user chose, including one
 *     this app never wrote.
 * @returns ok with the weeks when text parses to an object whose `weeks` is an
 *     array satisfying isValidWeeks, and whose format tag, if it carries one, is
 *     this version's; otherwise ok: false with the reason.
 *
 * The caps in limits.ts DO apply, as they do to a paste: this is an entry
 * point, and entry points are where they are enforced. isValidWeeks omits them
 * only so that an already-stored week can still load.
 */
export function parseWeeks(text: string): ImportResult {
    let value: unknown;
    try {
        value = JSON.parse(text);
    } catch {
        return { ok: false, reason: 'not-json' };
    }

    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        return { ok: false, reason: 'not-beaverplans' };
    }

    const { format, weeks } = value as { format?: unknown; weeks?: unknown };
    const tagged = format !== undefined;
    if (tagged && format !== EXPORT_FORMAT) {
        return { ok: false, reason: 'malformed' };
    }
    if (!Array.isArray(weeks)) {
        // An untagged object with no weeks is some other file; a tagged one is
        // ours and broken.
        return { ok: false, reason: tagged ? 'malformed' : 'not-beaverplans' };
    }

    try {
        if (!isValidWeeks(weeks as Weeks)) {
            return { ok: false, reason: 'malformed' };
        }
    } catch {
        // isValidWeeks reaches into the shape it was handed; anything far
        // enough from a WeekPlan throws rather than answering false.
        return { ok: false, reason: 'malformed' };
    }

    const parsed = weeks as Weeks;

    // Worst counts anywhere in the collection, so one report covers a file whose
    // offending week is not the first.
    const shape = parsed.map((week) => planShape(week.projects)).reduce(worstOf, EMPTY_SHAPE);
    if (
        shape.projects > LIMITS.projectsPerWeek ||
        shape.maxTasks > LIMITS.tasksPerProject ||
        shape.maxSubtasks > LIMITS.subtasksPerTask
    ) {
        return { ok: false, reason: 'too-big', shape };
    }
    if (!parsed.every((week) => week.projects.every(fitsText))) {
        return { ok: false, reason: 'too-long' };
    }

    return { ok: true, weeks: parsed };
}

const EMPTY_SHAPE: PlanShape = { projects: 0, maxTasks: 0, maxSubtasks: 0 };

/** The larger of each count, taken independently. */
function worstOf(a: PlanShape, b: PlanShape): PlanShape {
    return {
        projects: Math.max(a.projects, b.projects),
        maxTasks: Math.max(a.maxTasks, b.maxTasks),
        maxSubtasks: Math.max(a.maxSubtasks, b.maxSubtasks),
    };
}
