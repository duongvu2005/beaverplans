/**
 * One-shot per-user import of the old planner's row into planner_weeks.
 *
 * The conversion itself is importLegacy.ts; this module is only the plumbing
 * around it — read the legacy row, convert, hand the result to the
 * migrate_old_planner RPC, which claims the migrated_at flag and inserts the
 * weeks in one transaction (see the 20260808153000 migration).
 *
 * Deletable, with importLegacy.ts and the RPC, once
 * `select count(*) from old_planner_state where migrated_at is null` stops
 * moving.
 */

import { weekStartOf } from '../core/dates';
import { importLegacy, type LegacyArchive, type LegacyTask } from './importLegacy';

/**
 * The slice of the Supabase client this needs. Narrow on purpose: a test
 * supplies its own object rather than a whole client (see cloudBackend's
 * CloudClient for the same trade).
 */
export interface LegacyClient {
    from(table: string): {
        select(columns: string): {
            eq(
                column: string,
                value: string,
            ): {
                maybeSingle(): PromiseLike<{ data: LegacyStateRow | null; error: unknown }>;
            };
        };
    };
    rpc(name: string, args: Record<string, unknown>): PromiseLike<{ error: unknown }>;
}

/** One row of old_planner_state, as read back. Every field is untrusted. */
export type LegacyStateRow = {
    readonly tasks: LegacyTask[] | null;
    readonly archives: LegacyArchive[] | null;
    readonly week_start: string | null;
    readonly migrated_at: string | null;
};

/**
 * Import one user's legacy data, if they have any that has not been imported.
 *
 * Reads the clock: a legacy row whose week_start is null (the old app's "not
 * anchored, use the current week") lands on the week this runs in, which is
 * what the old app would have shown that user anyway.
 *
 * @param client reaches old_planner_state and the migrate_old_planner RPC
 * @param userId the signed-in user, trusted from the caller's session. Only
 *        narrows the read; RLS is what actually scopes it.
 * @returns true iff weeks were imported on this call, i.e. the caller should
 *          re-read the server. False for every other outcome — no legacy row,
 *          already migrated, or a failure. Never throws: a failure leaves
 *          migrated_at null, so the next sign-in simply tries again.
 */
export async function importLegacyForUser(client: LegacyClient, userId: string): Promise<boolean> {
    try {
        const { data, error } = await client
            .from('old_planner_state')
            .select('tasks, archives, week_start, migrated_at')
            .eq('user_id', userId)
            .maybeSingle();
        if (error !== null) {
            warn('reading the legacy row failed', error);
            return false;
        }
        if (data === null || data.migrated_at !== null) {
            return false; // nothing to do, and not worth reporting
        }

        const weeks = importLegacy({
            tasks: data.tasks ?? [],
            archives: data.archives ?? [],
            week_start: data.week_start ?? weekStartOf(new Date()),
        });

        // Not skipped when weeks is empty: the RPC is also what marks the user
        // migrated, and an empty legacy row is still a row that should stop
        // being read on every future sign-in.
        const { error: rpcError } = await client.rpc('migrate_old_planner', { weeks });
        if (rpcError !== null) {
            warn('the import rpc failed', rpcError);
            return false;
        }
        return true;
    } catch (thrown) {
        // Most likely the converter meeting a legacy shape it does not expect.
        warn('converting the legacy row threw', thrown);
        return false;
    }
}

/**
 * Reports a failure without making it the user's problem. The import is
 * designed to fail quietly and retry on the next load, but failing quietly
 * AND invisibly leaves a once-per-user event with no way to find out why it
 * did not happen.
 */
function warn(what: string, detail: unknown): void {
    console.warn(`[legacy import] ${what}:`, detail);
}
