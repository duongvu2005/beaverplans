import type { WeekPlan, Weeks } from '../core/types';
import type { Backend } from './backend';
import { putWeek } from '../core/weeks';
import { diffWeeks } from './diffWeeks';
import { LocalBackend, type KeyValueStore } from './localBackend';
import { rowToWeekPlan, type PlannerWeekRow } from './plannerWeekRow';

export interface CloudClient {
    auth: {
        getSession(): Promise<{
            data: {
                session: {
                    user: {
                        id: string;
                    };
                } | null;
            };
        }>;
    };
    from(table: string): {
        select(columns: string): PromiseLike<{
            data: ReadonlyArray<unknown> | null;
            error: unknown;
        }>;
        upsert(rows: ReadonlyArray<unknown>): PromiseLike<{
            error: unknown;
        }>;
        delete(): {
            in(column: string, values: ReadonlyArray<string>): PromiseLike<{ error: unknown }>;
        };
    };
}

const CURRENT_STORAGE_KEY = 'beaverplans.cloudCache.current.v1';
const SYNCED_STORAGE_KEY = 'beaverplans.cloudCache.synced.v1';
const DEBOUNCE_MS = 500;

/**
 * Restores shared object references between synced and current.
 *
 * Any WeekPlan in `current` that is identical in content to a WeekPlan in
 * `synced` is replaced with the corresponding object from `synced`.
 *
 * @param synced any valid Weeks (isValidWeeks(synced))
 * @param current any valid Weeks (isValidWeeks(current))
 * @returns A Weeks value equivalent in content to `current`, but reusing
 *          WeekPlan objects from `synced` wherever possible.
 */
function restoreReferences(synced: Weeks, current: Weeks): Weeks {
    const restored: WeekPlan[] = [];
    // two pointer alg
    let i = 0;
    let j = 0;
    while (i < synced.length && j < current.length) {
        const syncedWeek = synced[i]!;
        const currentWeek = current[j]!;
        if (syncedWeek.weekStart === currentWeek.weekStart) {
            if (JSON.stringify(syncedWeek) === JSON.stringify(currentWeek)) {
                restored.push(syncedWeek);
            } else {
                restored.push(currentWeek);
            }
            i++;
            j++;
        } else if (syncedWeek.weekStart > currentWeek.weekStart) {
            // synced has moved past currentPlan; it cannot match
            restored.push(currentWeek);
            j++;
        } else {
            i++;
        }
    }

    while (j < current.length) {
        restored.push(current[j]!);
        j++;
    }
    return restored;
}

export class CloudBackend implements Backend {
    private readonly client: CloudClient;
    private readonly currentDurable: LocalBackend;
    private readonly syncedDurable: LocalBackend;
    private cache: Weeks;
    private lastSynced: Weeks;
    private userId: string | undefined;
    private pushTimer: ReturnType<typeof setTimeout> | undefined;
    private pushInFlight: boolean;
    private pushAgainNeeded: boolean;

    /**
     * @param client used to talk to the remote service (auth + planner_weeks)
     * @param storage the underlying key-value store the durable local copies
     *        are persisted to (e.g. window.localStorage)
     */
    public constructor(client: CloudClient, storage: KeyValueStore) {
        this.client = client;
        this.currentDurable = new LocalBackend(storage, CURRENT_STORAGE_KEY);
        this.syncedDurable = new LocalBackend(storage, SYNCED_STORAGE_KEY);
        this.cache = [];
        this.lastSynced = [];
        this.userId = undefined;
        this.pushTimer = undefined;
        this.pushInFlight = false;
        this.pushAgainNeeded = false;
    }

    /**
     * @inheritdoc
     * Also discovers the current user from the client's session, and
     * reconciles the durable local copy against the server: any week that
     * differs between the durable local copy and its last-known-synced
     * baseline (a locally pending, unconfirmed change) keeps the local copy;
     * every other week adopts the server's copy. If the server is
     * unreachable, or there is no session, falls back to the durable local
     * copy unchanged. If there were pending local changes and the server was
     * reachable, schedules a push for them before this promise resolves.
     */
    public async load(): Promise<void> {
        // load up the durables (this must always be done regardless of the auth status)
        await Promise.all([this.currentDurable.load(), this.syncedDurable.load()]);
        this.lastSynced = this.syncedDurable.getWeeks();
        this.cache = restoreReferences(this.lastSynced, this.currentDurable.getWeeks());

        // auth status
        const session = await this.client.auth.getSession();
        if (session.data.session === null) {
            this.userId = undefined;
            return;
        }
        this.userId = session.data.session.user.id;

        // load data
        const { data, error } = await this.client
            .from('planner_weeks')
            .select('week_start, projects, ended');
        if (error || data === null) {
            return;
        }

        // merge & resolve conflict
        const { upserts, deletes } = diffWeeks(this.cache, this.lastSynced);
        const pendingWeekStarts = new Set([...upserts.map((plan) => plan.weekStart), ...deletes]);

        let mergedCache = this.cache;
        let mergedSynced = this.lastSynced;
        for (const row of data) {
            const serverPlan = rowToWeekPlan(row as PlannerWeekRow);
            if (!pendingWeekStarts.has(serverPlan.weekStart)) {
                mergedCache = putWeek(mergedCache, serverPlan);
                mergedSynced = putWeek(mergedSynced, serverPlan);
            }
        }
        this.cache = mergedCache;
        this.lastSynced = mergedSynced;
        this.currentDurable.setWeeks(this.cache);
        this.syncedDurable.setWeeks(this.lastSynced);

        if (pendingWeekStarts.size > 0) {
            this.schedulePush();
        }
    }

    /**
     * @inheritdoc
     */
    public getWeeks(): Weeks {
        return this.cache;
    }

    /**
     * @inheritdoc
     * Also writes weeks through to the durable local copy immediately, and
     * (re)arms a debounced push to the server.
     */
    public setWeeks(weeks: Weeks): void {
        this.cache = weeks;
        this.currentDurable.setWeeks(weeks);
        this.schedulePush();
    }

    /**
     * @inheritdoc
     * Also cancels any pending push, clears the durable local copies, and
     * forgets the current user.
     */
    public reset(): void {
        this.cancelScheduledPush();

        this.cache = [];
        this.lastSynced = [];

        this.currentDurable.reset();
        this.syncedDurable.reset();

        this.userId = undefined;
    }

    /**
     * Cancels any pending debounced push, without touching cache, lastSynced,
     * or either durable copy. Safe to call when nothing is pending.
     */
    public cancelScheduledPush(): void {
        if (this.pushTimer !== undefined) {
            clearTimeout(this.pushTimer);
            this.pushTimer = undefined;
        }
    }

    /**
     * (Re)arms the debounced push: cancels any existing timer and starts a
     * new one that calls push() after DEBOUNCE_MS.
     */
    private schedulePush(): void {
        this.cancelScheduledPush();
        this.pushTimer = setTimeout(() => {
            this.pushTimer = undefined;
            void this.push();
        }, DEBOUNCE_MS);
    }

    /**
     * Pushes the diff between lastSynced and a snapshot of cache (taken at
     * the start of this call) to the server, guarded by the live session.
     * No-ops if there's nothing to push, or if the session no longer matches
     * userId. Advances lastSynced (and its durable copy) to that snapshot
     * only if every write succeeds; a partial failure leaves it unchanged so
     * the next push retries the whole diff. If called while a previous push
     * is still in flight, defers instead of running concurrently — it
     * records that another push is needed and runs it immediately once the
     * in-flight one finishes, so at most one push talks to the server at a
     * time.
     */
    private async push(): Promise<void> {
        if (this.pushInFlight) {
            this.pushAgainNeeded = true;
            return;
        }

        this.pushInFlight = true;

        try {
            const snapshot = this.cache;

            // session guard
            const session = await this.client.auth.getSession();
            if (session.data.session === null || this.userId === undefined) {
                return;
            }

            if (session.data.session.user.id !== this.userId) {
                return;
            }

            // push updates
            const { upserts, deletes } = diffWeeks(this.lastSynced, snapshot);
            const table = this.client.from('planner_weeks');
            // attempt both; only update lastSync if both succeed
            let hadError = false;
            if (upserts.length > 0) {
                const rows = upserts.map((plan) => ({
                    user_id: this.userId,
                    week_start: plan.weekStart,
                    ended: plan.ended ?? false,
                    projects: plan.projects,
                }));
                const { error } = await table.upsert(rows);
                if (error) hadError = true;
            }
            if (deletes.length > 0) {
                const { error } = await table.delete().in('week_start', deletes);
                if (error) hadError = true;
            }

            if (!hadError) {
                this.lastSynced = snapshot;
                this.syncedDurable.setWeeks(snapshot);
            }
        } finally {
            this.pushInFlight = false;

            if (this.pushAgainNeeded) {
                this.pushAgainNeeded = false;
                void this.push();
            }
        }
    }
}
