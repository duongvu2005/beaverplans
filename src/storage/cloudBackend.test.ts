import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CloudBackend, type CloudClient, type RemoteWatcher } from './cloudBackend';
import { LocalBackend, type KeyValueStore } from './localBackend';
import { reportOffline } from '@/test/offline';
import { addWeeks } from '@/core/dates';
import type { WeekPlan, Weeks } from '@/core/types';

const DEBOUNCE_MS = 500;
const FEED_DEBOUNCE_MS = 300;
const NETWORK_DEADLINE_MS = 10_000;
const RETRY_BASE_MS = 1000;
const MAX_PUSH_RETRIES = 5;
const CURRENT_KEY = 'beaverplans.cloudCache.current.v1';
const SYNCED_KEY = 'beaverplans.cloudCache.synced.v1';

// --- fakes ---
class FakeStorage implements KeyValueStore {
    private readonly data: Record<string, string> = {};
    /** Keys whose writes throw, which is what a full quota looks like. */
    public readonly failKeys = new Set<string>();
    public getItem(key: string): string | null {
        const value = this.data[key];
        return value === undefined ? null : value;
    }
    public setItem(key: string, value: string): void {
        if (this.failKeys.has(key)) throw new DOMException('quota', 'QuotaExceededError');
        this.data[key] = value;
    }
    public removeItem(key: string): void {
        delete this.data[key];
    }
}

type Row = { user_id: string; week_start: string; ended: boolean; projects: unknown };

class FakeClient implements CloudClient {
    public session: { user: { id: string } } | null = { user: { id: 'u1' } };
    public rows: ReadonlyArray<Row> = [];
    public selectError: unknown = null;
    public upsertError: unknown = null;
    public deleteError: unknown = null;
    public upsertCalls: Array<ReadonlyArray<Row>> = [];
    public deleteCalls: Array<ReadonlyArray<string>> = [];
    /** What each read asked postgrest-js about retrying, in order. */
    public retryFlags: boolean[] = [];
    public holdUpserts = false;
    private pendingUpsertResolvers: Array<() => void> = [];
    /** A backend that never answers, which is what a slow Supabase looks like. */
    public holdSelects = false;
    private pendingSelectResolvers: Array<() => void> = [];

    /** A session read that never answers, which is what a token refresh on a
     *  dying connection looks like. */
    public holdSessions = false;
    private pendingSessionResolvers: Array<() => void> = [];

    public auth = {
        getSession: async () => {
            if (this.holdSessions) {
                await new Promise<void>((resolve) => {
                    this.pendingSessionResolvers.push(resolve);
                });
            }
            return { data: { session: this.session } };
        },
    };

    /** Answers the session reads parked so far, leaving later ones unaffected. */
    public releaseHeldSessions(): void {
        const waiting = this.pendingSessionResolvers;
        this.pendingSessionResolvers = [];
        for (const resolve of waiting) resolve();
    }

    public from(_table: string) {
        return {
            select: (_columns: string) => {
                // Captured when the query runs, not when it answers: that is
                // what makes two reads able to disagree, which is the whole
                // point of holding them.
                const rowsWhenAsked = this.rows;
                const read = async () => {
                    if (this.holdSelects) {
                        await new Promise<void>((resolve) => {
                            this.pendingSelectResolvers.push(resolve);
                        });
                    }
                    if (this.selectError) return { data: null, error: this.selectError };
                    return { data: rowsWhenAsked, error: null };
                };
                return {
                    retry: (enabled: boolean) => {
                        this.retryFlags.push(enabled);
                        return read();
                    },
                };
            },
            upsert: (rows: ReadonlyArray<unknown>) => {
                this.upsertCalls.push(rows as ReadonlyArray<Row>);
                return {
                    abortSignal: (signal: AbortSignal) => {
                        if (!this.holdUpserts) {
                            return Promise.resolve({ error: this.upsertError });
                        }
                        return new Promise<{ error: unknown }>((resolve) => {
                            this.pendingUpsertResolvers.push(() =>
                                resolve({ error: this.upsertError }),
                            );
                            // What postgrest-js does with an aborted fetch: the
                            // request settles as an error rather than hanging on.
                            signal.addEventListener('abort', () =>
                                resolve({ error: { message: 'aborted' } }),
                            );
                        });
                    },
                };
            },
            delete: () => ({
                in: (_column: string, values: ReadonlyArray<string>) => {
                    this.deleteCalls.push(values);
                    return {
                        abortSignal: (_signal: AbortSignal) =>
                            Promise.resolve({ error: this.deleteError }),
                    };
                },
            }),
        };
    }

    public resolveNextUpsert(): void {
        this.pendingUpsertResolvers.shift()?.();
    }

    /** Answers ONE held read, by the order the queries were made. Lets a test
     *  land an older response after a newer one. */
    public resolveSelect(index: number): void {
        this.pendingSelectResolvers[index]?.();
    }

    /** Lets a held read finally answer, the way a slow backend recovering does. */
    public releaseSelects(): void {
        this.holdSelects = false;
        const waiting = this.pendingSelectResolvers;
        this.pendingSelectResolvers = [];
        for (const resolve of waiting) resolve();
    }
}

// --- fixtures ---
// Non-empty projects are load-bearing: an empty entry is invalid per Weeks' "no
// entry is empty" rule, so anything round-tripping through LocalBackend or
// putWeek would silently drop an empty fixture.
const week1: WeekPlan = {
    weekStart: '2026-07-06',
    ended: false,
    projects: [{ id: 'p1', name: 'A', tasks: [] }],
};
const week2: WeekPlan = {
    weekStart: '2026-07-13',
    ended: false,
    projects: [{ id: 'p2', name: 'B', tasks: [] }],
};
const week3: WeekPlan = {
    weekStart: '2026-07-20',
    ended: false,
    projects: [{ id: 'p3', name: 'C', tasks: [] }],
};

function rowOf(plan: WeekPlan, userId = 'u1'): Row {
    return {
        user_id: userId,
        week_start: plan.weekStart,
        ended: plan.ended ?? false,
        projects: plan.projects,
    };
}

// A RemoteWatcher standing in for the Supabase channel: records how many
// feeds were opened and closed, and lets a test fire one by hand.
function fakeFeed() {
    const state = {
        userId: undefined as string | undefined,
        opens: 0,
        closes: 0,
        fire: () => {},
    };
    const watcher: RemoteWatcher = (userId, onChange) => {
        state.userId = userId;
        state.opens += 1;
        state.fire = onChange;
        return () => {
            state.closes += 1;
        };
    };
    return { watcher, state };
}

// Fires an event and lets the debounce window close, so the pull has been asked.
async function fireFeed(state: { fire: () => void }) {
    state.fire();
    await vi.advanceTimersByTimeAsync(FEED_DEBOUNCE_MS);
}

function makeBackend(client: FakeClient = new FakeClient(), openFeed?: RemoteWatcher) {
    const storage = new FakeStorage();
    const backend = new CloudBackend(client, storage, openFeed);
    return { backend, storage, client };
}

async function readDurable(storage: FakeStorage, key: string): Promise<Weeks> {
    const reader = new LocalBackend(storage, key);
    await reader.load();
    return reader.getWeeks();
}

beforeEach(() => {
    vi.useFakeTimers();
});
afterEach(() => {
    vi.useRealTimers();
});

describe('CloudBackend', () => {
    /*
     * Testing strategy
     *   partition on load() reachability: server reachable, no pending local
     *     changes | server reachable, pending local changes with the server
     *     untouched | server reachable, pending local changes where the
     *     server ALSO changed the same week (a real conflict; mergeWeeks.test.ts
     *     owns the merge rules, this file only proves load() applies them) |
     *     server unreachable | no session
     *   partition on load()'s merge granularity: a single call covering one
     *     pending-untouched week, one conflicting week, and one week new on
     *     the server but absent locally, all at once (proves the merge is
     *     per-week, not per-array) | after a load() with pending changes,
     *     assert a push is actually scheduled rather than inferring it |
     *     after a CONFLICTING load, assert the merge itself is pushed back,
     *     since the server has never seen it
     *   partition on setWeeks: effect on cache | effect on the durable
     *     local copy | does NOT touch lastSynced or its durable copy | two
     *     rapid calls before the timer fires — the eventual push reflects
     *     the FINAL cache value, not the intermediate one
     *   partition on push (the debounce firing): nothing changed since
     *     lastSynced (no network call at all) | upserts only | deletes only
     *     | both | session guard fails: no session | session guard fails:
     *     different user | partial failure, upsert succeeds delete fails |
     *     partial failure, delete succeeds upsert fails | two overlapping
     *     push() calls — the second defers instead of running concurrently
     *   partition on the write-time race specifically: setWeeks is called,
     *     then the session changes (or clears) before the debounce fires
     *   partition on a write that failed: retried on its own without another
     *     edit | retried a bounded number of times, not without end
     *   partition on two pulls overlapping: the older response landing last
     *     must not regress what the newer one already merged
     *   partition on a session read that never answers: the same, since it is
     *     awaited under the same mutex and cannot be aborted the way a write can
     *   partition on a write that never answers: the push gives up rather than
     *     holding the in-flight mutex for the rest of the session
     *   partition on what lands while a push is parked mid-flight: a reset
     *     (nothing may be written) | a reset AND a second account signing in
     *     (their rows are not the previous account's to touch) | a pull that
     *     advances lastSynced (the diff must not span two states that never
     *     coexisted)
     *   partition on reset: with pending changes | already empty | a timer
     *     armed before reset does not fire after it | userId forgotten
     *   partition on flushing before a sign-out: nothing owed | owed and the
     *     write succeeds | owed and the write fails (the work stays owed)
     *   partition on cancelScheduledPush: pending timer exists | no timer to cancel
     */

    describe('load', () => {
        it('covers server reachable, no pending local changes: getWeeks reflects the server', async () => {
            const { backend, client } = makeBackend();
            client.rows = [rowOf(week1)];
            await backend.load();
            expect(backend.getWeeks()).toEqual([week1]);
        });

        it('covers server reachable, pending local changes with the server untouched: local copy wins', async () => {
            const { backend, storage, client } = makeBackend();
            new LocalBackend(storage, CURRENT_KEY).setWeeks([week1]); // pending, never synced
            client.rows = []; // server has nothing for week1

            await backend.load();
            expect(backend.getWeeks()).toEqual([week1]);
        });

        it('covers server reachable, pending local changes where the server also changed the same week: both edits survive the merge', async () => {
            const { backend, storage, client } = makeBackend();
            const origWeek1: WeekPlan = {
                weekStart: '2026-07-06',
                ended: false,
                projects: [{ id: 'p0', name: 'Original', tasks: [] }],
            };
            const editedWeek1: WeekPlan = {
                weekStart: '2026-07-06',
                ended: false,
                projects: [{ id: 'p1', name: 'Local edit', tasks: [] }],
            };
            const serverWeek1: WeekPlan = {
                weekStart: '2026-07-06',
                ended: false,
                projects: [{ id: 'p2', name: 'Server edit', tasks: [] }],
            };

            new LocalBackend(storage, SYNCED_KEY).setWeeks([origWeek1]);
            new LocalBackend(storage, CURRENT_KEY).setWeeks([editedWeek1]);
            client.rows = [rowOf(serverWeek1)];

            await backend.load();
            // Both sides replaced p0, so p0 is gone and each side's own
            // project is an addition.
            expect(backend.getWeeks()).toEqual([
                {
                    weekStart: '2026-07-06',
                    ended: false,
                    projects: [
                        { id: 'p1', name: 'Local edit', tasks: [] },
                        { id: 'p2', name: 'Server edit', tasks: [] },
                    ],
                },
            ]);
        });

        it('covers the merged result being owed to the server: the push carries it back', async () => {
            const { backend, storage, client } = makeBackend();
            const orig: WeekPlan = {
                weekStart: '2026-07-06',
                ended: false,
                projects: [{ id: 'p0', name: 'Original', tasks: [] }],
            };
            const localEdit: WeekPlan = {
                weekStart: '2026-07-06',
                ended: false,
                projects: [
                    { id: 'p0', name: 'Original', tasks: [] },
                    { id: 'p1', name: 'Local', tasks: [] },
                ],
            };
            const serverEdit: WeekPlan = {
                weekStart: '2026-07-06',
                ended: false,
                projects: [
                    { id: 'p0', name: 'Original', tasks: [] },
                    { id: 'p2', name: 'Server', tasks: [] },
                ],
            };

            new LocalBackend(storage, SYNCED_KEY).setWeeks([orig]);
            new LocalBackend(storage, CURRENT_KEY).setWeeks([localEdit]);
            client.rows = [rowOf(serverEdit)];

            await backend.load();
            await vi.advanceTimersByTimeAsync(DEBOUNCE_MS);

            // lastSynced is what the server actually holds, so the diff is
            // exactly the merge the server has not seen yet.
            expect(client.upsertCalls).toEqual([
                [
                    rowOf({
                        weekStart: '2026-07-06',
                        ended: false,
                        projects: [
                            { id: 'p0', name: 'Original', tasks: [] },
                            { id: 'p1', name: 'Local', tasks: [] },
                            { id: 'p2', name: 'Server', tasks: [] },
                        ],
                    }),
                ],
            ]);
        });

        it('covers server unreachable: falls back to the durable local copy unchanged', async () => {
            const { backend, storage, client } = makeBackend();
            new LocalBackend(storage, CURRENT_KEY).setWeeks([week1]);
            new LocalBackend(storage, SYNCED_KEY).setWeeks([week1]);
            client.selectError = 'network error';

            await backend.load();
            expect(backend.getWeeks()).toEqual([week1]);
        });

        it('lets postgrest-js retry the pull when the browser reports a connection', async () => {
            const { backend, client } = makeBackend();

            await backend.load();

            expect(client.retryFlags).toEqual([true]);
        });

        it('turns off the retries when the browser reports no connection', async () => {
            // postgrest-js retries a failed GET three times, sleeping 1s, 2s
            // and 4s in between — seven seconds the board spends unrendered,
            // since nothing shows until load() resolves.
            const { backend, storage, client } = makeBackend();
            new LocalBackend(storage, CURRENT_KEY).setWeeks([week1]);
            new LocalBackend(storage, SYNCED_KEY).setWeeks([week1]);
            client.selectError = 'network error';
            reportOffline();

            await backend.load();

            expect(client.retryFlags).toEqual([false]);
            // Still the durable copy: turning the retries off changes when the
            // pull gives up, never what the failure falls back to.
            expect(backend.getWeeks()).toEqual([week1]);
        });

        it('covers no session: falls back to the durable local copy unchanged', async () => {
            const { backend, storage, client } = makeBackend();
            new LocalBackend(storage, CURRENT_KEY).setWeeks([week1]);
            new LocalBackend(storage, SYNCED_KEY).setWeeks([week1]);
            client.session = null;

            await backend.load();
            expect(backend.getWeeks()).toEqual([week1]);
        });

        it('covers reset while a pull is in flight: the signed-out weeks do not come back', async () => {
            const { backend, storage, client } = makeBackend();
            client.rows = [rowOf(week1)];
            client.holdSelects = true;

            const loading = backend.load();
            await vi.advanceTimersByTimeAsync(0);

            backend.reset();
            client.releaseSelects();
            await loading;

            expect(backend.getWeeks()).toEqual([]);
            expect(await readDurable(storage, CURRENT_KEY)).toEqual([]);
            expect(await readDurable(storage, SYNCED_KEY)).toEqual([]);
        });

        it('covers a mixed call: pending-untouched, conflicting, and server-only weeks merged per-week', async () => {
            const { backend, storage, client } = makeBackend();
            const localOnlyA: WeekPlan = {
                weekStart: '2026-07-06',
                ended: false,
                projects: [{ id: 'p0', name: 'LocalOnly', tasks: [] }],
            };
            const origB: WeekPlan = {
                weekStart: '2026-07-13',
                ended: false,
                projects: [{ id: 'p0', name: 'Orig', tasks: [] }],
            };
            const localEditedB: WeekPlan = {
                weekStart: '2026-07-13',
                ended: false,
                projects: [{ id: 'p1', name: 'Local', tasks: [] }],
            };
            const serverEditedB: WeekPlan = {
                weekStart: '2026-07-13',
                ended: false,
                projects: [{ id: 'p2', name: 'Server', tasks: [] }],
            };
            const serverOnlyC: WeekPlan = {
                weekStart: '2026-07-20',
                ended: false,
                projects: [{ id: 'p3', name: 'ServerOnly', tasks: [] }],
            };

            new LocalBackend(storage, SYNCED_KEY).setWeeks([origB]);
            new LocalBackend(storage, CURRENT_KEY).setWeeks([localOnlyA, localEditedB]);
            client.rows = [rowOf(serverEditedB), rowOf(serverOnlyC)];

            await backend.load();
            expect(backend.getWeeks()).toEqual([
                localOnlyA, // ours alone: kept
                {
                    // both changed it: descends to the projects and keeps each
                    weekStart: '2026-07-13',
                    ended: false,
                    projects: [
                        { id: 'p1', name: 'Local', tasks: [] },
                        { id: 'p2', name: 'Server', tasks: [] },
                    ],
                },
                serverOnlyC, // theirs alone: kept
            ]);
        });

        it('covers pending changes after load: a push is actually scheduled, not just inferred from state', async () => {
            const { backend, storage, client } = makeBackend();
            new LocalBackend(storage, CURRENT_KEY).setWeeks([week1]);
            client.rows = [];

            await backend.load();
            await vi.advanceTimersByTimeAsync(DEBOUNCE_MS);

            expect(client.upsertCalls).toEqual([[rowOf(week1)]]);
        });
    });

    describe('the remote feed', () => {
        /*
         * Testing strategy
         *   partition on what the feed reports: a change that alters the
         *     merged result | one that does not (this client's own write
         *     echoing back)
         *   partition on feed lifecycle: opened on load | not reopened for
         *     the same user | replaced when the user changes | closed by
         *     reset | never opened when no watcher was injected
         *   partition on subscribers: one listening | after unsubscribing
         */

        it('covers a remote change: pulls, merges, and wakes subscribers', async () => {
            const feed = fakeFeed();
            const { backend, client } = makeBackend(new FakeClient(), feed.watcher);
            client.rows = [rowOf(week1)];
            await backend.load();

            const seen: Weeks[] = [];
            backend.subscribe(() => seen.push(backend.getWeeks()));

            client.rows = [rowOf(week1), rowOf(week2)]; // another device added week2
            await fireFeed(feed.state);

            expect(backend.getWeeks()).toEqual([week1, week2]);
            // The listener sees the NEW value, per subscribe's postcondition
            expect(seen).toEqual([[week1, week2]]);
        });

        // One upsert of two rows is two row events, so two pulls in flight is
        // ordinary rather than exotic. Nothing orders the responses.
        it('covers an older response landing after a newer one: it is discarded, not applied', async () => {
            const { watcher, state } = fakeFeed();
            const { backend, client } = makeBackend(new FakeClient(), watcher);
            client.rows = [rowOf(week1)];
            await backend.load();

            client.holdSelects = true;
            await fireFeed(state); // pull #1 asks, and sees only week1
            client.rows = [rowOf(week1), rowOf(week3)]; // another device adds week3
            await fireFeed(state); // pull #2 asks, and sees both

            client.resolveSelect(1); // the newer response lands first
            await vi.advanceTimersByTimeAsync(0);
            expect(backend.getWeeks()).toEqual([week1, week3]);

            client.resolveSelect(0); // the older one lands after it
            await vi.advanceTimersByTimeAsync(0);

            expect(backend.getWeeks()).toEqual([week1, week3]);
        });

        it('covers a report that changes nothing: subscribers are not woken', async () => {
            const feed = fakeFeed();
            const { backend, client } = makeBackend(new FakeClient(), feed.watcher);
            client.rows = [rowOf(week1)];
            await backend.load();

            let woken = 0;
            backend.subscribe(() => {
                woken += 1;
            });

            await fireFeed(feed.state); // e.g. this client's own push echoing back

            expect(woken).toBe(0);
        });

        it('covers unsubscribing: the listener stops being called', async () => {
            const feed = fakeFeed();
            const { backend, client } = makeBackend(new FakeClient(), feed.watcher);
            client.rows = [rowOf(week1)];
            await backend.load();

            let woken = 0;
            const off = backend.subscribe(() => {
                woken += 1;
            });

            client.rows = [rowOf(week1), rowOf(week2)];
            await fireFeed(feed.state);
            expect(woken).toBe(1);

            off();
            client.rows = [rowOf(week1), rowOf(week2), rowOf(week3)];
            await fireFeed(feed.state);
            expect(woken).toBe(1);
        });

        it('covers the feed lifecycle: opened once per user, replaced when the user changes', async () => {
            const feed = fakeFeed();
            const { backend, client } = makeBackend(new FakeClient(), feed.watcher);

            await backend.load();
            expect(feed.state.opens).toBe(1);
            expect(feed.state.userId).toBe('u1');

            await backend.load(); // same user: nothing to redo
            expect(feed.state.opens).toBe(1);
            expect(feed.state.closes).toBe(0);

            client.session = { user: { id: 'u2' } };
            await backend.load();
            expect(feed.state.closes).toBe(1); // u1's feed must not keep running
            expect(feed.state.opens).toBe(2);
            expect(feed.state.userId).toBe('u2');
        });

        it('covers signing out and reset: the feed is closed', async () => {
            const feed = fakeFeed();
            const { backend, client } = makeBackend(new FakeClient(), feed.watcher);
            await backend.load();
            expect(feed.state.opens).toBe(1);

            backend.reset();
            expect(feed.state.closes).toBe(1);

            client.session = null;
            await backend.load();
            expect(feed.state.opens).toBe(1); // no session, nothing to watch
        });

        it('covers no watcher injected: subscribing is harmless and nothing is reported', async () => {
            const { backend, client } = makeBackend();
            client.rows = [rowOf(week1)];
            await backend.load();

            let woken = 0;
            const off = backend.subscribe(() => {
                woken += 1;
            });
            await vi.advanceTimersByTimeAsync(DEBOUNCE_MS);

            expect(woken).toBe(0);
            expect(() => {
                off();
                off();
            }).not.toThrow();
        });
    });

    describe('setWeeks', () => {
        it('covers the effect on cache', () => {
            const { backend } = makeBackend();
            backend.setWeeks([week1]);
            expect(backend.getWeeks()).toEqual([week1]);
        });

        it('covers the effect on the durable local copy', async () => {
            const { backend, storage } = makeBackend();
            backend.setWeeks([week1]);
            expect(await readDurable(storage, CURRENT_KEY)).toEqual([week1]);
        });

        it('covers that it does not touch lastSynced or its durable copy', async () => {
            const { backend, storage } = makeBackend();
            backend.setWeeks([week1]);
            expect(await readDurable(storage, SYNCED_KEY)).toEqual([]);
        });

        it('covers two rapid calls: the eventual push reflects the final cache value, not the intermediate one', async () => {
            const { backend, client } = makeBackend();
            await backend.load();
            backend.setWeeks([week1]);
            backend.setWeeks([week1, week2]);
            await vi.advanceTimersByTimeAsync(DEBOUNCE_MS);

            expect(client.upsertCalls).toEqual([[rowOf(week1), rowOf(week2)]]);
        });
    });

    describe('push', () => {
        it('covers nothing changed since lastSynced: no network call at all', async () => {
            const { backend, client } = makeBackend();
            await backend.load();
            backend.setWeeks([]);
            await vi.advanceTimersByTimeAsync(DEBOUNCE_MS);
            expect(client.upsertCalls).toEqual([]);
            expect(client.deleteCalls).toEqual([]);
        });

        it('covers upserts only', async () => {
            const { backend, client } = makeBackend();
            await backend.load();
            backend.setWeeks([week1]);
            await vi.advanceTimersByTimeAsync(DEBOUNCE_MS);
            expect(client.upsertCalls).toEqual([[rowOf(week1)]]);
            expect(client.deleteCalls).toEqual([]);
        });

        it('covers deletes only', async () => {
            const { backend, client } = makeBackend();
            client.rows = [rowOf(week1)];
            await backend.load();
            backend.setWeeks([]);
            await vi.advanceTimersByTimeAsync(DEBOUNCE_MS);
            expect(client.deleteCalls).toEqual([['2026-07-06']]);
            expect(client.upsertCalls).toEqual([]);
        });

        it('covers both upserts and deletes in one push', async () => {
            const { backend, client } = makeBackend();
            client.rows = [rowOf(week1)];
            await backend.load();
            backend.setWeeks([week2]);
            await vi.advanceTimersByTimeAsync(DEBOUNCE_MS);
            expect(client.upsertCalls).toEqual([[rowOf(week2)]]);
            expect(client.deleteCalls).toEqual([['2026-07-06']]);
        });

        it('covers the session guard failing due to no session: no network call', async () => {
            const { backend, client } = makeBackend();
            await backend.load();
            client.session = null;
            backend.setWeeks([week1]);
            await vi.advanceTimersByTimeAsync(DEBOUNCE_MS);
            expect(client.upsertCalls).toEqual([]);
        });

        it('covers the session guard failing due to a different user: no network call', async () => {
            const { backend, client } = makeBackend();
            await backend.load();
            client.session = { user: { id: 'someone-else' } };
            backend.setWeeks([week1]);
            await vi.advanceTimersByTimeAsync(DEBOUNCE_MS);
            expect(client.upsertCalls).toEqual([]);
        });

        it('covers a partial failure (upsert succeeds, delete fails): lastSynced does not advance', async () => {
            const { backend, storage, client } = makeBackend();
            client.rows = [rowOf(week1), rowOf(week2)];
            await backend.load();
            client.deleteError = 'boom';
            backend.setWeeks([week3]);
            await vi.advanceTimersByTimeAsync(DEBOUNCE_MS);

            expect(client.upsertCalls).toEqual([[rowOf(week3)]]);
            expect(await readDurable(storage, SYNCED_KEY)).toEqual([week1, week2]);
        });

        it('covers a partial failure (delete succeeds, upsert fails): lastSynced does not advance', async () => {
            const { backend, storage, client } = makeBackend();
            client.rows = [rowOf(week1), rowOf(week2)];
            await backend.load();
            client.upsertError = 'boom';
            backend.setWeeks([week3]);
            await vi.advanceTimersByTimeAsync(DEBOUNCE_MS);

            expect(client.deleteCalls).toEqual([['2026-07-06', '2026-07-13']]);
            expect(await readDurable(storage, SYNCED_KEY)).toEqual([week1, week2]);
        });

        it('covers two overlapping push calls: the second defers instead of running concurrently, then catches up', async () => {
            const { backend, client } = makeBackend();
            await backend.load();
            client.holdUpserts = true;

            backend.setWeeks([week1]);
            await vi.advanceTimersByTimeAsync(DEBOUNCE_MS); // push #1 starts, upsert in flight
            expect(client.upsertCalls.length).toBe(1);

            backend.setWeeks([week1, week2]); // arms a second timer while push #1 is in flight
            await vi.advanceTimersByTimeAsync(DEBOUNCE_MS); // second timer fires
            expect(client.upsertCalls.length).toBe(1); // deferred, not a second concurrent call

            client.resolveNextUpsert(); // push #1 completes
            await vi.advanceTimersByTimeAsync(0); // let the deferred push run

            expect(client.upsertCalls.length).toBe(2);
            expect(client.upsertCalls[1]).toEqual([rowOf(week2)]); // diffed against the now-advanced lastSynced
        });

        // reset() is what signOut() calls. It cancels the debounce timer, but a
        // push already awaiting the network is past that -- and its write-back
        // lands after the reset, repopulating a durable copy that was cleared.
        it('covers reset while a push is in flight: the signed-out weeks do not come back', async () => {
            const { backend, storage, client } = makeBackend();
            await backend.load();
            client.holdUpserts = true;

            backend.setWeeks([week1]);
            await vi.advanceTimersByTimeAsync(DEBOUNCE_MS);
            expect(client.upsertCalls.length).toBe(1); // in flight

            backend.reset();
            client.resolveNextUpsert();
            await vi.advanceTimersByTimeAsync(0);

            expect(backend.getWeeks()).toEqual([]);
            expect(await readDurable(storage, CURRENT_KEY)).toEqual([]);
            expect(await readDurable(storage, SYNCED_KEY)).toEqual([]);
        });

        // The session read is a network call of its own -- supabase-js refreshes
        // an expired token inside it -- and auth-js exposes no signal to abort,
        // so the only bound available is to stop waiting.
        it('covers a session read that never answers: gives up rather than holding the mutex', async () => {
            const { backend, client } = makeBackend();
            await backend.load();

            client.holdSessions = true;
            backend.setWeeks([week1]);
            await vi.advanceTimersByTimeAsync(DEBOUNCE_MS);
            expect(client.upsertCalls).toEqual([]); // parked before the write

            await vi.advanceTimersByTimeAsync(NETWORK_DEADLINE_MS);
            client.holdSessions = false; // the connection comes back
            await vi.advanceTimersByTimeAsync(RETRY_BASE_MS);

            // Retried on its own, and the whole diff is still owed.
            expect(client.upsertCalls).toEqual([[rowOf(week1)]]);
        });

        // schedulePush is called by an edit and by a pull, so a failure with
        // neither following it -- a server error while the socket stays up, so
        // no rejoin event either -- would sit until the next keystroke.
        it('covers a failed write: retries on its own, without waiting for another edit', async () => {
            const { backend, client } = makeBackend();
            await backend.load();
            client.upsertError = { message: 'boom' };

            backend.setWeeks([week1]);
            await vi.advanceTimersByTimeAsync(DEBOUNCE_MS);
            expect(client.upsertCalls.length).toBe(1);

            client.upsertError = null; // the outage clears, and nothing else happens
            await vi.advanceTimersByTimeAsync(RETRY_BASE_MS);

            expect(client.upsertCalls.length).toBe(2);
            expect(client.upsertCalls[1]).toEqual([rowOf(week1)]);
        });

        it('covers a write that keeps failing: gives up rather than retrying without end', async () => {
            const { backend, client } = makeBackend();
            await backend.load();
            client.upsertError = { message: 'boom' };

            backend.setWeeks([week1]);
            await vi.advanceTimersByTimeAsync(DEBOUNCE_MS);
            await vi.advanceTimersByTimeAsync(60 * 60 * 1000);

            expect(client.upsertCalls.length).toBe(1 + MAX_PUSH_RETRIES);
        });

        // pushInFlight is a mutex, and a request that never settles never
        // releases it -- so every later push takes the defer branch and returns
        // against a call that will not finish. Nothing is lost and nothing
        // reaches the server again until reload.
        it('covers a write that never answers: the push gives up and a later one still runs', async () => {
            const { backend, client } = makeBackend();
            await backend.load();
            client.holdUpserts = true;

            backend.setWeeks([week1]);
            await vi.advanceTimersByTimeAsync(DEBOUNCE_MS);
            expect(client.upsertCalls.length).toBe(1); // in flight, and it never answers

            await vi.advanceTimersByTimeAsync(NETWORK_DEADLINE_MS);

            backend.setWeeks([week1, week2]);
            await vi.advanceTimersByTimeAsync(DEBOUNCE_MS);

            expect(client.upsertCalls.length).toBe(2);
            // The whole diff, not just week2: a timed-out write is a failed one,
            // so lastSynced never advanced past the load's empty state.
            expect(client.upsertCalls[1]).toEqual([rowOf(week1), rowOf(week2)]);
        });

        // The session read is itself a network call -- supabase-js refreshes an
        // expiring token inside it -- so a push can be parked there across a
        // whole sign-out. The write-time guard has already been passed by then
        // for a push parked later; this one has not reached it yet.
        it('covers reset while a push is still resolving its session: nothing is written', async () => {
            const { backend, client } = makeBackend();
            await backend.load();

            client.holdSessions = true;
            backend.setWeeks([week1]);
            await vi.advanceTimersByTimeAsync(DEBOUNCE_MS); // parked in getSession

            backend.reset();
            client.releaseHeldSessions();
            await vi.advanceTimersByTimeAsync(0);

            expect(client.upsertCalls).toEqual([]);
            expect(client.deleteCalls).toEqual([]);
        });

        // The session guard compares the live session to userId, and by now BOTH
        // name the second account -- so it passes, on a diff computed entirely
        // from the first account's weeks. Only the generation says otherwise.
        it('covers a second account signing in while a push is parked: their rows are untouched', async () => {
            const { backend, client } = makeBackend();
            client.rows = [rowOf(week1)];
            await backend.load();

            client.holdSessions = true;
            backend.setWeeks([week1, week2]);
            await vi.advanceTimersByTimeAsync(DEBOUNCE_MS); // parked in getSession

            backend.reset(); // the first account signs out
            client.holdSessions = false; // the second account's own load is not parked
            client.session = { user: { id: 'u2' } };
            client.rows = [rowOf(week3, 'u2')];
            await backend.load();
            await vi.advanceTimersByTimeAsync(DEBOUNCE_MS);
            expect(backend.getWeeks()).toEqual([week3]);

            client.releaseHeldSessions(); // the first account's push finally answers
            await vi.advanceTimersByTimeAsync(0);

            expect(client.upsertCalls).toEqual([]);
            expect(client.deleteCalls).toEqual([]); // week3 is not the other account's to delete
        });

        // diffWeeks(lastSynced, snapshot) is only meaningful if both sides are
        // read at the same instant. A pull landing between them makes the diff
        // describe a state neither copy was ever in -- and every week the pull
        // learned about reads as a deletion.
        it('covers a pull landing while a push is parked: the pulled week is not deleted', async () => {
            const { watcher, state } = fakeFeed();
            const { backend, client } = makeBackend(new FakeClient(), watcher);
            client.rows = [rowOf(week1)];
            await backend.load();

            client.holdSessions = true;
            backend.setWeeks([week1, week2]);
            await vi.advanceTimersByTimeAsync(DEBOUNCE_MS); // parked in getSession

            client.rows = [rowOf(week1), rowOf(week3)]; // another device adds week3
            await fireFeed(state);
            expect(backend.getWeeks()).toEqual([week1, week2, week3]);

            client.releaseHeldSessions();
            await vi.advanceTimersByTimeAsync(0);

            expect(client.deleteCalls).toEqual([]);
        });
    });

    describe('the write-time race', () => {
        it('covers arming a save, then the session changing before the debounce fires: no write happens', async () => {
            const { backend, client } = makeBackend();
            await backend.load();

            backend.setWeeks([week1]);
            client.session = { user: { id: 'u2' } };
            await vi.advanceTimersByTimeAsync(DEBOUNCE_MS);

            expect(client.upsertCalls).toEqual([]);
            expect(client.deleteCalls).toEqual([]);
        });

        it('covers arming a save, then signing out entirely before the debounce fires: no write happens', async () => {
            const { backend, client } = makeBackend();
            await backend.load();

            backend.setWeeks([week1]);
            client.session = null;
            await vi.advanceTimersByTimeAsync(DEBOUNCE_MS);

            expect(client.upsertCalls).toEqual([]);
        });
    });

    describe('reset', () => {
        it('covers reset with pending changes: cache/lastSynced/durable copies all clear, timer cancelled', async () => {
            const { backend, storage, client } = makeBackend();
            await backend.load();
            backend.setWeeks([week1]);

            backend.reset();

            expect(backend.getWeeks()).toEqual([]);
            expect(await readDurable(storage, CURRENT_KEY)).toEqual([]);
            expect(await readDurable(storage, SYNCED_KEY)).toEqual([]);

            await vi.advanceTimersByTimeAsync(DEBOUNCE_MS);
            expect(client.upsertCalls).toEqual([]);
        });

        it('covers reset on an already-empty backend: still empty afterward', () => {
            const { backend } = makeBackend();
            backend.reset();
            expect(backend.getWeeks()).toEqual([]);
        });

        it('covers userId being forgotten: a subsequent push no-ops on the guard even with a valid session', async () => {
            const { backend, client } = makeBackend();
            await backend.load();
            backend.reset();

            client.session = { user: { id: 'u1' } };
            backend.setWeeks([week1]);
            await vi.advanceTimersByTimeAsync(DEBOUNCE_MS);

            expect(client.upsertCalls).toEqual([]);
        });
    });

    describe('hasUnpushedWork and flushNow', () => {
        it('covers nothing owed: reported as such, and flushing is a no-op', async () => {
            const { backend, client } = makeBackend();
            client.rows = [rowOf(week1)];
            await backend.load();

            expect(backend.hasUnpushedWork()).toBe(false);
            await expect(backend.flushNow()).resolves.toBe(true);
            expect(client.upsertCalls).toEqual([]);
        });

        it('covers owed work: sent at once rather than on the debounce', async () => {
            const { backend, client } = makeBackend();
            await backend.load();
            backend.setWeeks([week1]);

            expect(backend.hasUnpushedWork()).toBe(true);
            await expect(backend.flushNow()).resolves.toBe(true);

            expect(client.upsertCalls).toEqual([[rowOf(week1)]]);
            expect(backend.hasUnpushedWork()).toBe(false);
        });

        it('covers a failed write: reported as still owed, and the work is kept', async () => {
            const { backend, storage, client } = makeBackend();
            await backend.load();
            client.upsertError = { message: 'offline' };
            backend.setWeeks([week1]);

            await expect(backend.flushNow()).resolves.toBe(false);

            expect(backend.hasUnpushedWork()).toBe(true);
            expect(await readDurable(storage, CURRENT_KEY)).toEqual([week1]);
        });
    });

    describe('cancelScheduledPush', () => {
        it('covers a pending timer: cancels it, leaves cache/lastSynced/both durable copies unchanged', async () => {
            const { backend, storage, client } = makeBackend();
            await backend.load();
            backend.setWeeks([week1]);

            backend.cancelScheduledPush();

            expect(backend.getWeeks()).toEqual([week1]);
            expect(await readDurable(storage, CURRENT_KEY)).toEqual([week1]);
            expect(await readDurable(storage, SYNCED_KEY)).toEqual([]);

            await vi.advanceTimersByTimeAsync(DEBOUNCE_MS);
            expect(client.upsertCalls).toEqual([]);
        });

        it('covers no timer to cancel: no-op, does not throw', () => {
            const { backend } = makeBackend();
            expect(() => backend.cancelScheduledPush()).not.toThrow();
        });
    });

    describe('load pulls once', () => {
        it('covers a signed-in load: one read of planner_weeks', async () => {
            const client = new FakeClient();
            client.rows = [rowOf(week1)];
            const { backend } = makeBackend(client);

            await backend.load();

            expect(client.retryFlags).toHaveLength(1);
            expect(backend.getWeeks()).toEqual([week1]);
        });
    });
});

describe('a second account on the same browser', () => {
    /*
     * Testing strategy
     *   partition on what the first account left behind: a push that landed
     *     after its reset (the durable copies are the merge base for whoever
     *     signs in next, so a stale one reads as their deletion)
     */

    // Same weekStart as week1, different content: two people planning the same
    // calendar week is the ordinary case, since weeks are keyed by weekStart.
    const week1OtherAccount: WeekPlan = {
        weekStart: '2026-07-06',
        ended: false,
        projects: [{ id: 'pB', name: 'B', tasks: [] }],
    };

    it('covers signing in after someone signed out mid-push: their weeks are not deleted', async () => {
        const storage = new FakeStorage();

        const clientA = new FakeClient();
        const backendA = new CloudBackend(clientA, storage);
        await backendA.load();
        clientA.holdUpserts = true;
        backendA.setWeeks([week1]);
        await vi.advanceTimersByTimeAsync(DEBOUNCE_MS);
        backendA.reset();
        clientA.resolveNextUpsert(); // lands after the reset
        await vi.advanceTimersByTimeAsync(0);

        // useAuth does NOT reset here: lastUserId is undefined after a sign-out,
        // so switchedAccount is false and only the epoch bumps.
        const clientB = new FakeClient();
        clientB.session = { user: { id: 'u2' } };
        clientB.rows = [rowOf(week1OtherAccount, 'u2')];
        const backendB = new CloudBackend(clientB, storage);
        await backendB.load();
        await vi.advanceTimersByTimeAsync(DEBOUNCE_MS);

        expect(backendB.getWeeks()).toEqual([week1OtherAccount]);
        expect(clientB.deleteCalls).toEqual([]);
    });
});

describe('the durable copies remember whose they are', () => {
    /*
     * Testing strategy
     *   partition on who the stored durables belong to: the signing-in user
     *     (kept, so their unsent work is still owed) | somebody else (dropped,
     *     so it is neither shown nor pushed into the new account)
     *
     * The second case is not reachable through useAuth's switchedAccount guard:
     * that reads lastUserId, which a sign-out sets back to undefined and a
     * reload never had. Only the durables themselves can answer it.
     */

    const weekOfBob: WeekPlan = {
        weekStart: '2026-08-03',
        ended: false,
        projects: [{ id: 'pB', name: 'Bob', tasks: [] }],
    };

    /** Signs u1 in, leaves week2 unsent, and hands back the storage they share. */
    async function leaveUnsentWork(): Promise<FakeStorage> {
        const storage = new FakeStorage();
        const client = new FakeClient();
        client.rows = [rowOf(week1)];
        client.upsertError = { message: 'offline' };
        const backend = new CloudBackend(client, storage);
        await backend.load();
        backend.setWeeks([week1, week2]);
        await vi.advanceTimersByTimeAsync(DEBOUNCE_MS);
        return storage;
    }

    it('covers a different account signing in: the previous one is dropped, not merged or pushed', async () => {
        const storage = await leaveUnsentWork();

        const client = new FakeClient();
        client.session = { user: { id: 'u2' } };
        client.rows = [rowOf(weekOfBob, 'u2')];
        const backend = new CloudBackend(client, storage);
        await backend.load();
        await vi.advanceTimersByTimeAsync(DEBOUNCE_MS);

        expect(backend.getWeeks()).toEqual([weekOfBob]);
        expect(client.upsertCalls).toEqual([]);
        expect(client.deleteCalls).toEqual([]);
    });

    it('covers the same account signing back in: the unsent work is still owed', async () => {
        const storage = await leaveUnsentWork();

        const client = new FakeClient();
        client.rows = [rowOf(week1)];
        const backend = new CloudBackend(client, storage);
        await backend.load();
        await vi.advanceTimersByTimeAsync(DEBOUNCE_MS);

        expect(backend.getWeeks()).toEqual([week1, week2]);
        expect(client.upsertCalls).toEqual([[rowOf(week2)]]);
    });
});

describe('disconnect', () => {
    /*
     * Testing strategy
     *   partition on what it must stop: the row feed | a scheduled push |
     *     the userId a later push guards on
     *   partition on what it must NOT touch: cache, lastSynced, both durables
     *
     * The session is over but the data is still this user's — an involuntary
     * sign-out (an expired refresh token) must not cost them the offline copy.
     */

    it('covers the feed, the pending push and userId: all stopped', async () => {
        const { watcher, state } = fakeFeed();
        const { backend, client } = makeBackend(new FakeClient(), watcher);
        await backend.load();
        expect(state.opens).toBe(1);

        backend.setWeeks([week1, week2]);
        backend.disconnect();
        await vi.advanceTimersByTimeAsync(DEBOUNCE_MS);

        expect(state.closes).toBe(1);
        expect(client.upsertCalls).toEqual([]);
    });

    it('covers cache, lastSynced and both durable copies: all kept', async () => {
        const { backend, storage, client } = makeBackend();
        client.rows = [rowOf(week1)];
        await backend.load();
        backend.setWeeks([week1, week2]);

        backend.disconnect();

        expect(backend.getWeeks()).toEqual([week1, week2]);
        expect(await readDurable(storage, CURRENT_KEY)).toEqual([week1, week2]);
        expect(await readDurable(storage, SYNCED_KEY)).toEqual([week1]);
    });
});

describe('a step already in flight when the session ends', () => {
    // disconnect() and reset() both mean "stop talking to the server". Only one
    // of them can be seen by work that is already past its own guard, and these
    // pin the other one down.
    it('cannot land a pull that was on the wire when disconnect ran', async () => {
        const client = new FakeClient();
        const { backend, storage } = makeBackend(client);
        client.rows = [rowOf(week1), rowOf(week2)];
        client.holdSelects = true;

        const loading = backend.load();
        await Promise.resolve();
        backend.disconnect();
        client.releaseSelects();
        await loading;

        expect(backend.getWeeks()).toEqual([]);
        expect(storage.getItem(CURRENT_KEY)).toBeNull();
        expect(storage.getItem(SYNCED_KEY)).toBeNull();
    });

    it('does not reopen the feed for a session that ended during the session read', async () => {
        const client = new FakeClient();
        const { watcher, state } = fakeFeed();
        const { backend } = makeBackend(client, watcher);
        client.holdSessions = true;

        const loading = backend.load();
        await Promise.resolve();
        backend.disconnect();
        client.releaseHeldSessions();
        await loading;

        expect(state.opens).toBe(0);
    });
});

describe('the synced durable copy never gets ahead of the current one', () => {
    // Both are written through the same swallow-on-failure policy, so quota can
    // land one and drop the other. Ahead in this direction is the dangerous one:
    // the next cold start reads the gap between them as weeks to delete.
    it('holds the synced copy back when the current copy could not be written', async () => {
        const client = new FakeClient();
        const { backend, storage } = makeBackend(client);
        client.rows = [rowOf(week1), rowOf(week2)];
        await backend.load();
        await vi.advanceTimersByTimeAsync(DEBOUNCE_MS + 10);

        storage.failKeys.add(CURRENT_KEY);
        backend.setWeeks([week1, week2, week3]);
        await vi.advanceTimersByTimeAsync(DEBOUNCE_MS + 10);
        expect(client.upsertCalls.at(-1)).toContainEqual(rowOf(week3));

        // Same device, next cold start: it reads what actually reached disk.
        client.rows = [rowOf(week1), rowOf(week2), rowOf(week3)];
        client.deleteCalls = [];
        const revived = new CloudBackend(client, storage);
        await revived.load();
        await vi.advanceTimersByTimeAsync(DEBOUNCE_MS + 10);

        expect(client.deleteCalls).toEqual([]);
        expect(revived.getWeeks()).toEqual([week1, week2, week3]);
    });

    it('holds it back on a pull too, not only on a push', async () => {
        const client = new FakeClient();
        const { backend, storage } = makeBackend(client);
        client.rows = [rowOf(week1), rowOf(week2)];
        await backend.load();
        await vi.advanceTimersByTimeAsync(DEBOUNCE_MS + 10);

        storage.failKeys.add(CURRENT_KEY);
        client.rows = [rowOf(week1), rowOf(week2), rowOf(week3)];
        await backend.load();
        await vi.advanceTimersByTimeAsync(DEBOUNCE_MS + 10);

        expect(await readDurable(storage, SYNCED_KEY)).toEqual([week1, week2]);
    });
});

describe('an edit to one week of many', () => {
    const ended = (i: number): WeekPlan => ({
        weekStart: addWeeks('2026-06-01', i),
        ended: true,
        projects: [
            {
                id: `p${i}`,
                name: 'cs50w',
                tasks: [{ id: `t${i}`, name: 'x', isDone: true, subtasks: [] }],
            },
        ],
    });
    const history: Weeks = Array.from({ length: 18 }, (_, i) => ended(i));
    const current: WeekPlan = {
        weekStart: '2026-10-05',
        ended: false,
        projects: [{ id: 'pc', name: 'now', tasks: [] }],
    };
    const all: Weeks = [...history, current];
    const editedCurrent: WeekPlan = {
        ...current,
        projects: [{ id: 'pc', name: 'now!', tasks: [] }],
    };
    const swapCurrent = (weeks: Weeks): Weeks =>
        weeks.map((w) => (w.weekStart === current.weekStart ? editedCurrent : w));

    it('upserts only that week after a warm load', async () => {
        const { backend, client } = makeBackend();
        client.rows = all.map((w) => rowOf(w));
        await backend.load();

        backend.setWeeks(swapCurrent(backend.getWeeks()));
        await vi.advanceTimersByTimeAsync(DEBOUNCE_MS + 10);

        expect(client.upsertCalls.map((rows) => rows.length)).toEqual([1]);
    });

    it('upserts only that week after the feed echoes a save back', async () => {
        const feed = fakeFeed();
        const { backend, client } = makeBackend(new FakeClient(), feed.watcher);
        client.rows = all.map((w) => rowOf(w));
        await backend.load();

        backend.setWeeks(swapCurrent(backend.getWeeks()));
        await vi.advanceTimersByTimeAsync(DEBOUNCE_MS + 10);
        client.rows = swapCurrent(all).map((w) => rowOf(w));
        feed.state.fire();
        await vi.advanceTimersByTimeAsync(DEBOUNCE_MS + 10);

        expect(client.upsertCalls.map((rows) => rows.length)).toEqual([1]);
    });

    it('upserts only that week after a cold start from the stored copies', async () => {
        const client = new FakeClient();
        const first = makeBackend(client);
        client.rows = all.map((w) => rowOf(w));
        await first.backend.load();
        await vi.advanceTimersByTimeAsync(DEBOUNCE_MS + 10);

        const revived = new CloudBackend(client, first.storage);
        await revived.load();
        revived.setWeeks(swapCurrent(revived.getWeeks()));
        await vi.advanceTimersByTimeAsync(DEBOUNCE_MS + 10);

        expect(client.upsertCalls.map((rows) => rows.length)).toEqual([1]);
    });

    it('upserts only that week when the server returns keys in another order', async () => {
        const reorder = (value: unknown): unknown => {
            if (Array.isArray(value)) return value.map(reorder);
            if (typeof value === 'object' && value !== null) {
                return Object.fromEntries(
                    Object.entries(value)
                        .reverse()
                        .map(([k, v]) => [k, reorder(v)]),
                );
            }
            return value;
        };
        const { backend, client } = makeBackend();
        client.rows = all.map((w) => ({ ...rowOf(w), projects: reorder(w.projects) }));
        await backend.load();

        backend.setWeeks(swapCurrent(backend.getWeeks()));
        await vi.advanceTimersByTimeAsync(DEBOUNCE_MS + 10);

        expect(client.upsertCalls.map((rows) => rows.length)).toEqual([1]);
    });

    it('upserts only that week when the edit is built from weeks read before an unchanged pull', async () => {
        const feed = fakeFeed();
        const { backend, client } = makeBackend(new FakeClient(), feed.watcher);
        client.rows = all.map((w) => rowOf(w));
        await backend.load();
        const stale = backend.getWeeks();

        feed.state.fire();
        await vi.advanceTimersByTimeAsync(DEBOUNCE_MS + 10);

        backend.setWeeks(swapCurrent(stale));
        await vi.advanceTimersByTimeAsync(DEBOUNCE_MS + 10);

        expect(client.upsertCalls.map((rows) => rows.length)).toEqual([1]);
    });
});

describe('a pull issued before a save, landing after it', () => {
    const typed: WeekPlan = {
        ...week1,
        projects: [{ id: 'p1', name: 'typed', tasks: [] }],
    };

    it('does not undo the saved edit', async () => {
        const { watcher, state } = fakeFeed();
        const { backend, client } = makeBackend(new FakeClient(), watcher);
        client.rows = [rowOf(week1)];
        await backend.load();

        client.holdSelects = true;
        await fireFeed(state); // asks now, and sees week1 as it was before the edit
        client.holdSelects = false;

        backend.setWeeks([typed]);
        await vi.advanceTimersByTimeAsync(DEBOUNCE_MS + 10);
        expect(client.upsertCalls).toEqual([[rowOf(typed)]]);
        client.rows = [rowOf(typed)];

        client.resolveSelect(0); // the old answer finally lands
        await vi.advanceTimersByTimeAsync(0);

        expect(backend.getWeeks()).toEqual([typed]);
    });

    it('does not strand a remote change the dropped pull carried', async () => {
        const { watcher, state } = fakeFeed();
        const { backend, client } = makeBackend(new FakeClient(), watcher);
        client.rows = [rowOf(week1)];
        await backend.load();

        client.rows = [rowOf(week1), rowOf(week2)];
        client.holdSelects = true;
        await fireFeed(state);
        client.holdSelects = false;

        backend.setWeeks([typed]);
        await vi.advanceTimersByTimeAsync(DEBOUNCE_MS + 10);
        client.rows = [rowOf(typed), rowOf(week2)];

        client.resolveSelect(0);
        await vi.advanceTimersByTimeAsync(DEBOUNCE_MS + 10);

        expect(backend.getWeeks()).toEqual([typed, week2]);
    });
});

describe('a burst of feed events', () => {
    async function loaded() {
        const { watcher, state } = fakeFeed();
        const { backend, client } = makeBackend(new FakeClient(), watcher);
        client.rows = [rowOf(week1)];
        await backend.load();
        return { backend, client, state, before: client.retryFlags.length };
    }

    it('becomes one pull', async () => {
        const { client, state, before } = await loaded();

        for (let i = 0; i < 5; i++) {
            state.fire();
            await vi.advanceTimersByTimeAsync(50);
        }
        await vi.advanceTimersByTimeAsync(FEED_DEBOUNCE_MS);

        expect(client.retryFlags.length - before).toBe(1);
    });

    it('is not acted on before the window closes', async () => {
        const { client, state, before } = await loaded();

        state.fire();
        await vi.advanceTimersByTimeAsync(FEED_DEBOUNCE_MS - 10);
        expect(client.retryFlags.length - before).toBe(0);

        await vi.advanceTimersByTimeAsync(20);
        expect(client.retryFlags.length - before).toBe(1);
    });

    it('is dropped by a reset', async () => {
        const { backend, client, state, before } = await loaded();

        state.fire();
        backend.reset();
        await vi.advanceTimersByTimeAsync(FEED_DEBOUNCE_MS + 10);

        expect(client.retryFlags.length - before).toBe(0);
    });
});
