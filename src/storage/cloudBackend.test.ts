import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
    CloudBackend,
    type CloudClient,
    type LegacyImporter,
    type RemoteWatcher,
} from './cloudBackend';
import { LocalBackend, type KeyValueStore } from './localBackend';
import type { WeekPlan, Weeks } from '@/core/types';

const DEBOUNCE_MS = 500;
const CURRENT_KEY = 'beaverplans.cloudCache.current.v1';
const SYNCED_KEY = 'beaverplans.cloudCache.synced.v1';

// --- fakes ---
class FakeStorage implements KeyValueStore {
    private readonly data: Record<string, string> = {};
    public getItem(key: string): string | null {
        const value = this.data[key];
        return value === undefined ? null : value;
    }
    public setItem(key: string, value: string): void {
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
    public holdUpserts = false;
    private pendingUpsertResolvers: Array<() => void> = [];

    public auth = {
        getSession: async () => ({ data: { session: this.session } }),
    };

    public from(_table: string) {
        return {
            select: async (_columns: string) => {
                if (this.selectError) return { data: null, error: this.selectError };
                return { data: this.rows, error: null };
            },
            upsert: (rows: ReadonlyArray<unknown>) => {
                this.upsertCalls.push(rows as ReadonlyArray<Row>);
                if (this.holdUpserts) {
                    return new Promise<{ error: unknown }>((resolve) => {
                        this.pendingUpsertResolvers.push(() =>
                            resolve({ error: this.upsertError }),
                        );
                    });
                }
                return Promise.resolve({ error: this.upsertError });
            },
            delete: () => ({
                in: async (_column: string, values: ReadonlyArray<string>) => {
                    this.deleteCalls.push(values);
                    return { error: this.deleteError };
                },
            }),
        };
    }

    public resolveNextUpsert(): void {
        this.pendingUpsertResolvers.shift()?.();
    }
}

// --- fixtures ---
// Non-empty projects are load-bearing here, not decoration: an empty-projects
// entry is invalid per Weeks' "no entry is empty" rule (isValidWeeks/putWeek),
// so anything that round-trips through LocalBackend or putWeek would silently
// drop an empty fixture.
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

function makeBackend(
    client: FakeClient = new FakeClient(),
    openFeed?: RemoteWatcher,
    importLegacy?: LegacyImporter,
) {
    const storage = new FakeStorage();
    const backend = new CloudBackend(client, storage, openFeed, importLegacy);
    return { backend, storage, client };
}

// A LegacyImporter that reports whether it imported, and records the calls.
// `onImport` runs at call time, so a test can have the "server" gain the
// imported rows exactly when the real RPC would have written them.
function fakeImporter(imported: boolean, onImport: () => void = () => {}) {
    const calls: string[] = [];
    const importer: LegacyImporter = async (userId) => {
        calls.push(userId);
        onImport();
        return imported;
    };
    return { importer, calls };
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
     *     server ALSO changed the same week (a real conflict — three-way
     *     merged, so both sides survive; mergeWeeks.test.ts owns the merge
     *     rules themselves, this file only proves load() applies them) |
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
     *   partition on reset: with pending changes | already empty | a timer
     *     armed before reset does not fire after it | userId forgotten
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
            // project is an addition. Under the old last-write-wins the
            // server's edit was simply discarded here.
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

        it('covers no session: falls back to the durable local copy unchanged', async () => {
            const { backend, storage, client } = makeBackend();
            new LocalBackend(storage, CURRENT_KEY).setWeeks([week1]);
            new LocalBackend(storage, SYNCED_KEY).setWeeks([week1]);
            client.session = null;

            await backend.load();
            expect(backend.getWeeks()).toEqual([week1]);
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
            feed.state.fire();
            await vi.advanceTimersByTimeAsync(0);

            expect(backend.getWeeks()).toEqual([week1, week2]);
            // The listener sees the NEW value, per subscribe's postcondition
            expect(seen).toEqual([[week1, week2]]);
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

            feed.state.fire(); // e.g. this client's own push echoing back
            await vi.advanceTimersByTimeAsync(0);

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
            feed.state.fire();
            await vi.advanceTimersByTimeAsync(0);
            expect(woken).toBe(1);

            off();
            client.rows = [rowOf(week1), rowOf(week2), rowOf(week3)];
            feed.state.fire();
            await vi.advanceTimersByTimeAsync(0);
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

    describe('legacy import on load', () => {
        /*
         * Testing strategy
         *   partition on importer: absent | present, imported nothing |
         *     present, imported rows
         *   partition on session: signed in | signed out
         *   partition on the result of importing: the imported weeks are
         *     visible when load() resolves (the property useGuestMigration
         *     depends on) | they are not left to a later Realtime event
         */

        it('covers absent importer: loads exactly as before', async () => {
            const client = new FakeClient();
            client.rows = [rowOf(week1)];
            const { backend } = makeBackend(client);

            await backend.load();

            expect(backend.getWeeks()).toEqual([week1]);
        });

        it('covers signed out: never attempts an import', async () => {
            const client = new FakeClient();
            client.session = null;
            const { importer, calls } = fakeImporter(false);
            const { backend } = makeBackend(client, undefined, importer);

            await backend.load();

            expect(calls).toEqual([]);
        });

        it('covers nothing imported: passes the signed-in user, pulls once', async () => {
            const client = new FakeClient();
            client.rows = [rowOf(week1)];
            const { importer, calls } = fakeImporter(false);
            const { backend } = makeBackend(client, undefined, importer);

            await backend.load();

            expect(calls).toEqual(['u1']);
            expect(backend.getWeeks()).toEqual([week1]);
        });

        it('covers rows imported: re-reads, so load() resolves with them present', async () => {
            const client = new FakeClient();
            client.rows = [];
            // The import writes server-side, so the rows appear only once it
            // runs — exactly as the RPC's insert would.
            const { importer } = fakeImporter(true, () => {
                client.rows = [rowOf(week1), rowOf(week2)];
            });
            const { backend } = makeBackend(client, undefined, importer);

            await backend.load();

            // Not [] — an import that only showed up on the next Realtime
            // event would leave the cloud looking empty here, and
            // useGuestMigration would silently adopt guest work into it.
            expect(backend.getWeeks()).toEqual([week1, week2]);
        });

        it('covers a throwing importer: load still resolves, weeks still load', async () => {
            const client = new FakeClient();
            client.rows = [rowOf(week1)];
            const { importer } = fakeImporter(true, () => {
                throw new Error('importer blew up');
            });
            const { backend } = makeBackend(client, undefined, importer);

            // A rejection here would reject load(), leaving the caller's
            // `loaded` flag false forever — the app would never render.
            await expect(backend.load()).resolves.toBeUndefined();
            expect(backend.getWeeks()).toEqual([week1]);
        });
    });
});
