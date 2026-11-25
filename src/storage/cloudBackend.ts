import type { WeekPlan, Weeks } from '@/core/types';
import type { Backend } from './backend';
import { isEmptyWeek } from '@/core/weeks';
import { mergeWeeks } from '@/core/mergeWeeks';
import { diffWeeks, sameWeek } from './diffWeeks';
import { LocalBackend, type KeyValueStore } from './localBackend';
import { rowToWeekPlan, type PlannerWeekRow } from './plannerWeekRow';
import { isOffline } from './online';
import { withDeadline } from './withDeadline';

/**
 * Opens a feed of remote changes to one user's rows.
 *
 * @param userId whose rows to watch
 * @param onChange called when any of them change. Given no payload on purpose:
 *        the event is a signal, not data — see watchRemote.
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
        select(columns: string): {
            // postgrest-js retries a failed GET on a ladder of 1s, 2s and 4s
            // sleeps — seven seconds of dead time when it cannot succeed.
            retry(enabled: boolean): PromiseLike<{
                data: ReadonlyArray<unknown> | null;
                error: unknown;
            }>;
        };
        // Both writes take a signal rather than being raced against a timer:
        // a deadline that only stops WAITING leaves the request alive, and one
        // that lands after a newer push has succeeded puts the older content
        // back on the server. Aborting is what makes a retry safe.
        upsert(rows: ReadonlyArray<unknown>): {
            abortSignal(signal: AbortSignal): PromiseLike<{ error: unknown }>;
        };
        delete(): {
            in(
                column: string,
                values: ReadonlyArray<string>,
            ): { abortSignal(signal: AbortSignal): PromiseLike<{ error: unknown }> };
        };
    };
}

/** Exported for the crash-recovery path, which reads it without this class. */
export const CURRENT_STORAGE_KEY = 'beaverplans.cloudCache.current.v1';
const SYNCED_STORAGE_KEY = 'beaverplans.cloudCache.synced.v1';
const OWNER_STORAGE_KEY = 'beaverplans.cloudCache.owner.v1';
const DEBOUNCE_MS = 500;
const FEED_DEBOUNCE_MS = 300;
// Long enough not to cut off a slow phone: postgrest-js retries a failed write on
// a ladder that spends seven seconds. Applied to each network step, not to a push
// as a whole — a push makes up to three.
const NETWORK_DEADLINE_MS = 10_000;

// What a session read resolves to when it overran. Distinguishable from a real
// answer BY REFERENCE, which is the point: `{ session: null }` already means
// signed out, and that is the one case a push must not retry.
const SESSION_UNREACHABLE = { data: { session: null } };
// A failed push re-arms itself on a widening delay, up to this many times.
const RETRY_BASE_MS = 1000;
const MAX_PUSH_RETRIES = 5;

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
        restored.push(current[j]!); // j is in range — the loop condition
        j++;
    }
    return restored;
}

/**
 * Reads the rows of a `planner_weeks` select into a Weeks.
 *
 * An unreadable row arrives here as an empty plan (rowToWeekPlan's fallback) and
 * is dropped: Weeks holds no empty entry, so keeping one would fail isValidWeeks
 * and cost the whole collection on LocalBackend's next read.
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
    return a.length === b.length && a.every((week, i) => sameWeek(week, b[i]!));
}

/**
 * The plan as the server holds it, with two local copies behind it so the app
 * still works offline.
 *
 * Abstraction function:
 *   AF(...) = the weeks collection `cache` — the app's view of this user's plan,
 *   which is the server's rows merged with whatever was done locally.
 *
 * Rep invariant:
 *   - cache and lastSynced both satisfy isValidWeeks
 *   - lastSynced is the last state believed to be on the server; cache is that
 *     plus unpushed local edits. The two are the three-way merge's base and
 *     mine, so they must not be aliased to each other.
 *   - currentDurable persists cache and syncedDurable persists lastSynced, each
 *     under its own key, so a cold offline start recovers both sides of the
 *     merge rather than just what was on screen
 *   - pushTimer is defined only while a push is pending; pushAgainNeeded is only
 *     ever true while pushInFlight is, and means another edit landed mid-flight
 *   - pushRetries counts CONSECUTIVE failed pushes, and is zero whenever the
 *     last one succeeded — so an outage widens the delay and a recovery
 *     forgets it
 *   - closeFeed is defined iff a feed is open, and feedUserId then names the
 *     user it filters on — so signing in as somebody else replaces the feed
 *     instead of leaving the previous user's running
 *   - the stored owner names the user both durable copies hold, and is absent
 *     when they are empty. It is the only durable record of whose data this is:
 *     every in-memory guard dies with the page, and the copies do not
 *   - userId is undefined until the first load resolves a session
 *   - pullSeq numbers the pulls in the order they ASK, and lastAppliedPull is
 *     the highest that has answered. A pull whose number is lower has been
 *     overtaken and its rows predate what is already merged
 *   - pushesDone counts the pushes that advanced lastSynced. A pull that asked
 *     before one finished holds rows older than lastSynced and is asked again
 *   - generation counts the resets. A network step that began under an older
 *     one has been disowned, and must not write anything back
 *
 * Safety from rep exposure:
 *   client, the two durable copies, openFeed and listeners are all readonly. cache
 *   and lastSynced are only ever replaced with freshly produced collections, never
 *   mutated in place, and getWeeks hands back a ReadonlyArray the core producers
 *   copy rather than edit.
 */
export class CloudBackend implements Backend {
    private readonly client: CloudClient;
    private readonly storage: KeyValueStore;
    private readonly currentDurable: LocalBackend;
    private readonly syncedDurable: LocalBackend;
    private cache: Weeks;
    private lastSynced: Weeks;
    private userId: string | undefined;
    private pushTimer: ReturnType<typeof setTimeout> | undefined;
    private pushInFlight: boolean;
    private pushAgainNeeded: boolean;
    private pushRetries: number;
    private generation: number;
    private pullSeq: number;
    private lastAppliedPull: number;
    private pushesDone: number;
    private readonly openFeed: RemoteWatcher | undefined;
    private closeFeed: (() => void) | undefined;
    private feedUserId: string | undefined;
    private feedTimer: ReturnType<typeof setTimeout> | undefined;
    private readonly listeners: Set<() => void>;

    /**
     * @param client used to talk to the remote service (auth + planner_weeks)
     * @param storage the underlying key-value store the durable local copies
     *        are persisted to (e.g. window.localStorage)
     * @param openFeed opens the live feed of remote changes; omit it and this
     *        backend simply never reports any
     */
    public constructor(client: CloudClient, storage: KeyValueStore, openFeed?: RemoteWatcher) {
        this.client = client;
        this.storage = storage;
        this.openFeed = openFeed;
        this.currentDurable = new LocalBackend(storage, CURRENT_STORAGE_KEY);
        this.syncedDurable = new LocalBackend(storage, SYNCED_STORAGE_KEY);
        this.cache = [];
        this.lastSynced = [];
        this.userId = undefined;
        this.pushTimer = undefined;
        this.pushInFlight = false;
        this.pushAgainNeeded = false;
        this.pushRetries = 0;
        this.generation = 0;
        this.pullSeq = 0;
        this.lastAppliedPull = 0;
        this.pushesDone = 0;
        this.closeFeed = undefined;
        this.feedUserId = undefined;
        this.feedTimer = undefined;
        this.listeners = new Set();
    }

    /**
     * Whether a reset has happened since a network step began, which disowns
     * whatever that step was about to write.
     *
     * The write-time session guard cannot cover this: it runs BEFORE the
     * request, and the damage is done by what lands after it. reset() clears
     * both durable copies, so a late write repopulates one that was emptied on
     * purpose — and the synced copy is the merge base, so the next account to
     * sign in on this browser reads the previous one's weeks as its own
     * deletions.
     *
     * @param since the generation read when the step began
     * @returns true iff reset() has run since then. Reads live state, so it is
     *          not deterministic.
     */
    private disowned(since: number): boolean {
        return this.generation !== since;
    }

    /**
     * @inheritdoc
     * Also discovers the current user from the client's session and reconciles
     * the durable local copy against the server, three-way merging both against
     * the last-known-synced baseline (see mergeWeeks): a change made on only one
     * side survives, a genuine disagreement resolves in this device's favour.
     * With no session, or an unreachable server, falls back to the durable copy
     * unchanged. Anything the merge produces that the server has not got is
     * scheduled as a push before this promise resolves.
     */
    public async load(): Promise<void> {
        const generation = this.generation;
        // The durables load whatever the auth status. Reading them first is what
        // makes every deadline below survivable — the fallback is already in hand
        // before anything touches the network.
        await Promise.all([this.currentDurable.load(), this.syncedDurable.load()]);
        // Ahead of the two assignments, not after them: a reset() during the read
        // above already decided this data is not ours, and writing it into the
        // live collections first and checking second only works while reset()
        // happens to leave the durables reading as empty.
        if (this.disowned(generation)) return;
        // An unreadable synced copy leaves the baseline empty, which is the safe
        // direction: a diff against nothing is upserts only, never deletes.
        this.lastSynced = this.syncedDurable.getWeeks();
        // The current copy starts as a copy of the synced one and diverges only
        // through edits, so bytes that will not read are not evidence the user
        // emptied their plan — falling back to the baseline says "no local
        // changes", where an empty cache would say "delete every week".
        this.cache = this.currentDurable.unreadable()
            ? this.lastSynced
            : restoreReferences(this.lastSynced, this.currentDurable.getWeeks());

        const session = await this.client.auth.getSession();
        if (this.disowned(generation) || session.data.session === null) {
            this.userId = undefined;
            this.unwatchRemote();
            return;
        }
        const userId = session.data.session.user.id;
        // The durable copies outlive every in-memory guard, so they are the only
        // thing that can answer "whose are these". reset() rather than a quieter
        // clear: a step in flight for the previous owner must be disowned too.
        //
        // An ABSENT owner is adopted, not rejected: copies written before this key
        // existed carry none.
        const owner = this.storedOwner();
        if (owner !== undefined && owner !== userId) {
            // Bumps generation, so `generation` above is stale from here down.
            // Nothing below reads it; a check added below must re-read it.
            this.reset();
        }
        this.userId = userId;
        this.rememberOwner(userId);
        this.watchRemote();

        await this.pullAndMerge(false);
    }

    /**
     * Reads the server's weeks and folds them into the local copy.
     *
     * The one path that reconciles with the server, shared by load() and by a
     * remote change arriving on the channel, so an event that is dropped or
     * arrives out of order costs latency rather than correctness.
     *
     * Calls are not serialized, so overlapping pulls are ordinary: a response that
     * has been overtaken is discarded rather than applied.
     *
     * @param notify whether to wake subscribers if the merge changed anything.
     *        False from load(), whose caller reads getWeeks itself.
     */
    private async pullAndMerge(notify: boolean): Promise<void> {
        const generation = this.generation;
        const seq = ++this.pullSeq;
        const pushesAtAsk = this.pushesDone;
        const { data, error } = await this.client
            .from('planner_weeks')
            .select('week_start, projects, ended')
            // Offline the ladder cannot succeed, and nothing renders until
            // load() resolves. Failing at once lands on the durable copy, where
            // a failed pull lands anyway.
            .retry(!isOffline());
        if (error || data === null || this.disowned(generation)) {
            return;
        }
        // Overtaken: these rows are older than ones already merged, and merging
        // them would read every week learned about since as a remote deletion.
        if (seq < this.lastAppliedPull) {
            return;
        }
        // A save landed since this was asked. The rows predate it, yet
        // lastSynced already includes it, so the merge would read the edit as
        // a remote change and take the old value. Asked again rather than just
        // dropped, so a change only these rows carried is not lost.
        if (this.pushesDone !== pushesAtAsk) {
            return this.pullAndMerge(notify);
        }
        this.lastAppliedPull = seq;

        const serverWeeks = toWeeks(data);
        const before = this.cache;

        this.cache = restoreReferences(
            serverWeeks,
            mergeWeeks(this.lastSynced, this.cache, serverWeeks),
        );
        // The server holds serverWeeks, NOT the merge — nothing has been pushed
        // yet, so the diff below is exactly the work still owed to it.
        this.lastSynced = serverWeeks;
        this.currentDurable.setWeeks(this.cache);
        this.persistSynced();

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
     * The event's payload is deliberately ignored: Realtime can drop events and
     * deliver them out of order, so a payload applied directly could regress
     * state. It means only "something moved, go look".
     */
    private watchRemote(): void {
        if (this.openFeed === undefined || this.userId === undefined) {
            return;
        }
        if (this.feedUserId === this.userId) {
            return;
        }
        this.unwatchRemote();
        this.feedUserId = this.userId;
        this.closeFeed = this.openFeed(this.userId, () => {
            this.scheduleFeedPull();
        });
    }

    /** One pull per burst of events: a save of N rows is N events. */
    private scheduleFeedPull(): void {
        clearTimeout(this.feedTimer);
        this.feedTimer = setTimeout(() => {
            this.feedTimer = undefined;
            void this.pullAndMerge(true);
        }, FEED_DEBOUNCE_MS);
    }

    private unwatchRemote(): void {
        clearTimeout(this.feedTimer);
        this.feedTimer = undefined;
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
     * local copies, and forgets the current user. Subscribers are kept — they
     * belong to the caller, not to the session.
     */
    public reset(): void {
        // First: a network step already in flight reads this to learn it has
        // been disowned.
        this.generation += 1;
        this.cancelScheduledPush();
        this.unwatchRemote();

        this.cache = [];
        this.lastSynced = [];
        this.pushRetries = 0;

        this.currentDurable.reset();
        this.syncedDurable.reset();
        this.rememberOwner(undefined);

        this.userId = undefined;
    }

    /**
     * End the session without touching the data.
     *
     * The counterpart to reset() for a sign-out this app did not perform — an
     * expired refresh token, or another tab signing out. Both stop this client
     * talking to the server; only reset() decides the data is no longer ours,
     * and deciding that here would throw away work the user never sent.
     */
    public disconnect(): void {
        // Same first move as reset(), for the same reason: a network step in
        // flight is past its own session check, and `generation` is the only
        // thing it looks at afterwards. Without this, a pull parked on the wire
        // lands its merge, re-arms the push this just cancelled, and a load
        // still waiting on the session reopens the feed this just closed.
        this.generation += 1;
        this.cancelScheduledPush();
        this.unwatchRemote();
        this.userId = undefined;
    }

    /**
     * Writes the baseline to disk, unless the current copy is not there yet.
     *
     * The two durables are written through the same swallow-on-failure policy,
     * so a full quota can land one and drop the other. Synced ahead of current
     * is the dangerous direction: the next cold start diffs the pair and reads
     * everything the current copy is missing as weeks the user deleted. Leaving
     * the baseline behind instead costs a re-upsert and never a delete.
     */
    private persistSynced(): void {
        if (this.currentDurable.stale()) return;
        this.syncedDurable.setWeeks(this.lastSynced);
    }

    /** Who the durable copies belong to, or undefined if nothing is stored. */
    private storedOwner(): string | undefined {
        try {
            return this.storage.getItem(OWNER_STORAGE_KEY) ?? undefined;
        } catch {
            return undefined;
        }
    }

    private rememberOwner(userId: string | undefined): void {
        try {
            if (userId === undefined) {
                this.storage.removeItem(OWNER_STORAGE_KEY);
            } else {
                this.storage.setItem(OWNER_STORAGE_KEY, userId);
            }
        } catch {
            // Same swallow as LocalBackend.write, and the same cost: an
            // unwritable owner reads as "somebody else's" next load, which
            // drops the offline copy rather than misattributing it.
        }
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
     * Whether anything has been done locally that the server has not got.
     *
     * @returns true iff the diff between lastSynced and cache is non-empty —
     *          so a reset() right now would destroy work no other copy holds.
     */
    public hasUnpushedWork(): boolean {
        const { upserts, deletes } = diffWeeks(this.lastSynced, this.cache);
        return upserts.length > 0 || deletes.length > 0;
    }

    /**
     * Send whatever is owed now, rather than when the debounce fires.
     *
     * For the paths that are about to throw the local copy away — signing out
     * is the one that matters — so the throwing away can be conditional on the
     * server having it.
     *
     * @returns true iff nothing is owed afterwards. Biased to answer false when
     *          it cannot tell: a push deferred behind one already in flight
     *          returns before its rerun does, so this may report work still owed
     *          that is about to land. A false costs a question the user did not
     *          need; a true wrongly given would cost them the work.
     */
    public async flushNow(): Promise<boolean> {
        this.cancelScheduledPush();
        await this.push();
        return !this.hasUnpushedWork();
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
     * (Re)arms the debounced push.
     *
     * @param delayMs how long from now, defaulting to the edit debounce. A
     *        retry passes its own, widening, delay.
     */
    private schedulePush(delayMs: number = DEBOUNCE_MS): void {
        this.cancelScheduledPush();
        this.pushTimer = setTimeout(() => {
            this.pushTimer = undefined;
            void this.push();
        }, delayMs);
    }

    /**
     * Re-arms a push after one that failed, until MAX_PUSH_RETRIES is spent.
     *
     * Nothing else would. schedulePush is reached by an edit and by a pull, so
     * a failure followed by neither — a server error while the socket stays up,
     * so no rejoin either — leaves the whole diff owed until the next keystroke.
     */
    private retryPushLater(): void {
        if (this.pushRetries >= MAX_PUSH_RETRIES) {
            return;
        }
        this.schedulePush(RETRY_BASE_MS * 2 ** this.pushRetries);
        this.pushRetries += 1;
    }

    /**
     * Pushes the diff between lastSynced and cache to the server, both read at
     * the same instant so the diff describes a state the two copies were really
     * in. No-ops if there is nothing to push, if the live session no longer
     * matches userId, or if a reset has disowned this push. Advances lastSynced
     * and its durable copy only if every write succeeded AND nothing moved the
     * baseline meanwhile; otherwise it is left alone and the next push retries
     * the whole diff, which is safe because an upsert and a delete-by-key are
     * both idempotent. Called while a push is in flight, it defers and reruns
     * once that one finishes — at most one push talks to the server at a time.
     */
    private async push(): Promise<void> {
        if (this.pushInFlight) {
            this.pushAgainNeeded = true;
            return;
        }

        this.pushInFlight = true;

        try {
            const generation = this.generation;

            // Not abortable — auth-js takes no signal — so this only stops
            // WAITING. Safe here and not for the writes: a late session read
            // resolves into a call that has already returned, so there is no
            // request left to land out of order.
            const session = await withDeadline(
                this.client.auth.getSession(),
                NETWORK_DEADLINE_MS,
                SESSION_UNREACHABLE,
            );
            // Ahead of the session guard, which cannot see this: after a reset
            // BOTH the live session and userId can name the account that signed
            // in next, so the guard passes on a diff that is not theirs.
            if (this.disowned(generation)) {
                return;
            }
            // Not "signed out", which returns below without retrying: this is
            // "could not tell", and the work is still owed.
            if (session === SESSION_UNREACHABLE) {
                this.retryPushLater();
                return;
            }
            if (session.data.session === null || this.userId === undefined) {
                return;
            }

            if (session.data.session.user.id !== this.userId) {
                return;
            }

            // Read together, with no await between them: a pull landing in the
            // gap advances both, and a diff spanning the two states describes
            // one neither copy was ever in — every week the pull just learned
            // about would read as a deletion.
            const base = this.lastSynced;
            const snapshot = this.cache;
            const { upserts, deletes } = diffWeeks(base, snapshot);
            const table = this.client.from('planner_weeks');
            // One deadline across both writes rather than one each: what is
            // bounded is how long pushInFlight can be held, and that is the
            // whole call. A request that never settles otherwise holds it for
            // the rest of the session, and every later push defers against it.
            const controller = new AbortController();
            const deadline = setTimeout(() => controller.abort(), NETWORK_DEADLINE_MS);
            let hadError = false;
            try {
                if (upserts.length > 0) {
                    const rows = upserts.map((plan) => ({
                        user_id: this.userId,
                        week_start: plan.weekStart,
                        ended: plan.ended ?? false,
                        projects: plan.projects,
                    }));
                    const { error } = await table.upsert(rows).abortSignal(controller.signal);
                    if (error) hadError = true;
                }
                if (deletes.length > 0) {
                    const { error } = await table
                        .delete()
                        .in('week_start', deletes)
                        .abortSignal(controller.signal);
                    if (error) hadError = true;
                }
            } finally {
                clearTimeout(deadline);
            }

            // this.lastSynced === base or a pull moved the baseline while the
            // writes were in flight, and advancing to snapshot would rewind it
            // behind what the server now holds.
            if (!hadError && !this.disowned(generation) && this.lastSynced === base) {
                this.lastSynced = snapshot;
                this.pushesDone += 1;
                this.persistSynced();
            }

            if (hadError) {
                this.retryPushLater();
            } else {
                this.pushRetries = 0;
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
