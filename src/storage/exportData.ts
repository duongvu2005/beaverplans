import type { Weeks } from '@/core/types';

/**
 * Tags what an export file is, so a future importer can refuse a file it does
 * not understand rather than guessing at a bare array. Same role the old app's
 * clipboard marker played. Bump the suffix if the payload shape ever changes
 * incompatibly.
 */
export const EXPORT_FORMAT = 'beaverplans.export.v1';

export type ExportEnvelope = {
    readonly format: typeof EXPORT_FORMAT;
    readonly exportedAt: string;
    readonly weeks: Weeks;
};

/**
 * Everything the app holds, as a self-describing JSON document.
 *
 * @param weeks the collection to export; not mutated.
 * @param now the instant to stamp the file with.
 * @returns pretty-printed JSON: an object carrying the format tag, `now` as an
 *     ISO 8601 instant, and `weeks` unchanged and in order. Parsing the result
 *     yields an ExportEnvelope whose `weeks` deep-equals the argument.
 */
export function exportJson(weeks: Weeks, now: Date): string {
    const envelope: ExportEnvelope = {
        format: EXPORT_FORMAT,
        // UTC is right here, unlike everywhere else in this codebase: this is a
        // genuine instant, not a DateKey. The local-midnight rule in dates.ts
        // governs which *calendar day* something belongs to, which is not a
        // question a file's timestamp is answering.
        exportedAt: now.toISOString(),
        weeks,
    };
    return JSON.stringify(envelope, null, 2);
}

/**
 * A filename for an export taken at `now`.
 *
 * @param now the instant the export was taken.
 * @returns `beaverplans-YYYY-MM-DD.json`, dated by `now` in LOCAL time — the
 *     day the person pressing the button is living in, which is the one they
 *     will look for the file under.
 */
export function exportFilename(now: Date): string {
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `beaverplans-${year}-${month}-${day}.json`;
}
