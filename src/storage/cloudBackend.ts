import type { WeekPlan, Weeks } from '../core/types';
import type { Backend } from './backend';
import { isEmptyWeek } from '../core/weeks';
import { mergeWeeks } from '../core/mergeWeeks';
import { diffWeeks } from './diffWeeks';
import { LocalBackend, type KeyValueStore } from './localBackend';
import { rowToWeekPlan, type PlannerWeekRow } from './plannerWeekRow';

/**
 * Opens a feed of remote changes to one user's rows.
 *
 * Injected rather than reached through CloudClient because the real client's
 * channel API is broadly overloaded, and a structural interface narrow enough
 * to be useful here would not match it — so the binding to that API lives in
 * one adapter at the composition root, and a test supplies its own function.
 *
 * @param userId whose rows to watch
 * @param onChange called when any of them change. Given no payload on
 *        purpose: see pullAndMerge for why the event is a signal, not data.
 * @returns a function that closes the feed
 */
export type RemoteWatcher = (userId: string, onChange: () => void) => () => void;

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

/**
 * Reads the rows of a `planner_weeks` select into a Weeks.
 *
 * Empty entries are dropped rather than carried: rowToWeekPlan falls back to
 * no projects for a row whose stored JSON does not satisfy isValidPlan, and
 * Weeks holds no empty entry — so keeping one would make the whole collection
 * fail isValidWeeks, and LocalBackend discards an invalid collection wholesale
 * on the next read. One unreadable row must not cost the entire baseline.
 *
 * @param rows the rows returned by the select, in any order
 * @returns a valid Weeks: the readable rows, sorted ascending by weekStart
 */
function toWeeks(rows: ReadonlyArray<unknown>): Weeks {
    return rows
        .map((row) => rowToWeekPlan(row as PlannerWeekRow))
        .filter((plan) => !isEmptyWeek(plan))
        .sort((a, b) => (a.weekStart < b.weekStart ? -1 : a.weekStart > b.weekStart ? 1 : 0));
}

/**
 * Whether two collections hold the same content, so that a pull which changed
 * nothing does not wake every listener.
 *
 * @param a any Weeks
 * @param b any Weeks
 * @returns true iff they have the same entries in the same order, comparing
 *          by reference first and by content only when that fails
 */
function sameWeeks(a: Weeks, b: Weeks): boolean {
    return (
        a.length === b.length &&
        a.every((week, i) => week === b[i] || JSON.stringify(week) === JSON.stringify(b[i]))
    );
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
    private readonly openFeed: RemoteWatcher | undefined;
    private closeFeed: (() => void) | undefined;
    // Which user the open feed filters on, so a sign-in as somebody else
    // replaces it rather than quietly leaving the previous user's feed running.
    private feedUserId: string | undefined;
    private readonly listeners: Set<() => void>;

    /**
     * @param client used to talk to the remote service (auth + planner_weeks)
     * @param storage the underlying key-value store the durable local copies
     *        are persisted to (e.g. window.localStorage)
     * @param openFeed opens the live feed of remote changes; omit it and this
     *        backend simply never reports any, which is the behaviour every
     *        caller had before the feed existed
     */
    public constructor(client: CloudClient, storage: KeyValueStore, openFeed?: RemoteWatcher) {
        this.client = client;
        this.openFeed = openFeed;
        this.currentDurable = new LocalBackend(storage, CURRENT_STORAGE_KEY);
        this.syncedDurable = new LocalBackend(storage, SYNCED_STORAGE_KEY);
        this.cache = [];
        this.lastSynced = [];
        this.userId = undefined;
        this.pushTimer = undefined;
        this.pushInFlight = false;
        this.pushAgainNeeded = false;
        this.closeFeed = undefined;
        this.feedUserId = undefined;
        this.listeners = new Set();
    }

    /**
     * @inheritdoc
     * Also discovers the current user from the client's session, and
     * reconciles the durable local copy against the server by three-way
     * merging them against the last-known-synced baseline (see mergeWeeks):
     * a change made on only one side is kept whatever the other side holds,
     * and a genuine disagreement resolves in this device's favour. If the
     * server is unreachable, or there is no session, falls back to the
     * durable local copy unchanged. Whatever the merge produces that the
     * server has not got — which includes the merge itself, after a conflict
     * — is scheduled as a push before this promise resolves.
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
            this.unwatchRemote();
            return;
        }
        this.userId = session.data.session.user.id;
        this.watchRemote();

        // Not notifying: load()'s own caller is about to read getWeeks anyway.
        await this.pullAndMerge(false);
    }

    /**
     * Reads the server's weeks and folds them into the local copy.
     *
     * The one path that reconciles with the server, shared by load() and by a
     * remote change arriving on the channel — so a Realtime event runs exactly
     * the code a fresh load would, and an event that is dropped or arrives out
     * of order costs latency rather than correctness.
     *
     * @param notify whether to wake subscribers if the merge changed anything.
     *        False from load(), whose caller reads getWeeks itself.
     */
    private async pullAndMerge(notify: boolean): Promise<void> {
        const { data, error } = await this.client
            .from('planner_weeks')
            .select('week_start, projects, ended');
        if (error || data === null) {
            return;
        }

        const serverWeeks = toWeeks(data);
        const before = this.cache;

        // Three-way merge, not a per-week choice of one side: lastSynced is the
        // state both copies last agreed on, so it can tell an edit from a
        // non-edit and keep changes made on either device.
        this.cache = restoreReferences(
            serverWeeks,
            mergeWeeks(this.lastSynced, this.cache, serverWeeks),
        );
        // The server holds serverWeeks, NOT the merge — nothing has been pushed
        // yet. Recording what the server actually has is what makes the diff
        // below exactly the work still owed to it.
        this.lastSynced = serverWeeks;
        this.currentDurable.setWeeks(this.cache);
        this.syncedDurable.setWeeks(this.lastSynced);

        const { upserts, deletes } = diffWeeks(this.lastSynced, this.cache);
        if (upserts.length > 0 || deletes.length > 0) {
            this.schedulePush();
        }

        if (notify && !sameWeeks(before, this.cache)) {
            // Copied: a listener may unsubscribe itself when called.
            for (const listener of [...this.listeners]) {
                listener();
            }
        }
    }

    /**
     * Opens the row feed for the current user, if it is not already open for
     * exactly that user.
     *
     * The event's payload is deliberately ignored. Realtime can drop events and
     * deliver them out of order, so applying a payload directly would let a
     * late one regress state; treating it purely as "something moved, go look"
     * makes a lost event cost nothing but time.
     */
    private watchRemote(): void {
        if (this.openFeed === undefined || this.userId === undefined) {
            return;
        }
        if (this.feedUserId === this.userId) {
            return; // already watching exactly this user
        }
        this.unwatchRemote();
        this.feedUserId = this.userId;
        this.closeFeed = this.openFeed(this.userId, () => {
            void this.pullAndMerge(true);
        });
    }

    private unwatchRemote(): void {
        this.closeFeed?.();
        this.closeFeed = undefined;
        this.feedUserId = undefined;
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
     * Also cancels any pending push, closes the row feed, clears the durable
     * local copies, and forgets the current user. Subscribers are kept: they
     * belong to the caller, not to the session, and a later load() as some
     * other user will report to them again.
     */
    public reset(): void {
        this.cancelScheduledPush();
        this.unwatchRemote();

        this.cache = [];
        this.lastSynced = [];

        this.currentDurable.reset();
        this.syncedDurable.reset();

        this.userId = undefined;
    }

    /**
     * @inheritdoc
     * Fires when another device or tab writes this user's rows, which the
     * server reports over a Realtime channel opened by load().
     */
    public subscribe(listener: () => void): () => void {
        this.listeners.add(listener);
        return () => {
            this.listeners.delete(listener);
        };
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
