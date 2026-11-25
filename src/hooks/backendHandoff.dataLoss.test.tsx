import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useLayoutEffect } from 'react';
import { renderHook, act, waitFor } from '@testing-library/react';
import type { Session } from '@supabase/supabase-js';
import type { WeekPlan, Weeks } from '@/core/types';
import { useAuth } from './useAuth';
import { useWeeks } from './useWeeks';
import { supabase } from '@/storage/supabaseClient';
import { store, cloudBackend } from '@/storage/instance';

/*
 * Reproduces a wipe: five weeks deleted from the server with no destructive
 * action by the user.
 *
 * Only the Supabase client is faked. Store, LocalBackend, CloudBackend, useAuth
 * and useWeeks are the real ones, wired by the real src/storage/instance.ts over
 * the real window.localStorage — the suspect is the hand-off between two
 * backends, which no single-backend fake can express.
 *
 * The defect: useWeeks' persist effect reads `store` TWICE — once when the load
 * resolves and once when the effect flushes — and an auth callback can change
 * whose data the store answers with between the two. The guard it relied on
 * compares references across two different caches, so it can never hold.
 *
 * Two ways the session moves under it, and a fix has to cover both: the backend
 * switching (guest -> account), and the ACCOUNT switching while the backend
 * stays put (one user signing in over another).
 */

const DEBOUNCE_MS = 500;
const CURRENT_KEY = 'beaverplans.cloudCache.current.v1';
const SYNCED_KEY = 'beaverplans.cloudCache.synced.v1';
const OWNER_KEY = 'beaverplans.cloudCache.owner.v1';
const USER_ID = 'u1';
const OTHER_USER_ID = 'u2';

type Row = { user_id: string; week_start: string; ended: boolean; projects: unknown };
type AuthListener = (event: string, session: Session | null) => void;

type FakeSupabase = {
    session: { user: { id: string } } | null;
    rows: ReadonlyArray<Row>;
    upsertCalls: Array<ReadonlyArray<Row>>;
    deleteCalls: Array<ReadonlyArray<string>>;
    /** Every table the app asked for, in order. */
    fromCalls: string[];
    listeners: Set<AuthListener>;
    /** Parks the NEXT session read only; see the fake's getSession. */
    sessionGate: Promise<void> | null;
};

// Built inside the factory: vi.mock is hoisted above every binding in this file.
vi.mock('@/storage/supabaseClient', () => {
    const fake = {
        session: { user: { id: 'u1' } } as { user: { id: string } } | null,
        rows: [] as ReadonlyArray<Row>,
        upsertCalls: [] as Array<ReadonlyArray<Row>>,
        deleteCalls: [] as Array<ReadonlyArray<string>>,
        fromCalls: [] as string[],
        listeners: new Set<AuthListener>(),
        sessionGate: null as Promise<void> | null,

        auth: {
            // The gate models auth-js holding every session read behind
            // initializePromise while _recoverAndRefresh does its token refresh.
            // Taken by the first read and cleared, so CloudBackend's later reads
            // answer at once.
            getSession: async () => {
                const gate = fake.sessionGate;
                fake.sessionGate = null;
                if (gate !== null) await gate;
                return { data: { session: fake.session } };
            },
            onAuthStateChange: (listener: AuthListener) => {
                fake.listeners.add(listener);
                return {
                    data: {
                        subscription: {
                            unsubscribe: () => {
                                fake.listeners.delete(listener);
                            },
                        },
                    },
                };
            },
        },

        // Serves planner_weeks (select/retry, upsert, delete) and records the
        // table asked for, so a read of anything else is visible.
        from: (table: string) => {
            fake.fromCalls.push(table);
            return {
                select: (_columns: string) => ({
                    retry: async (_enabled: boolean) => ({ data: fake.rows, error: null }),
                }),
                upsert: (rows: ReadonlyArray<unknown>) => {
                    fake.upsertCalls.push(rows as ReadonlyArray<Row>);
                    return { abortSignal: async (_signal: AbortSignal) => ({ error: null }) };
                },
                delete: () => ({
                    in: (_column: string, values: ReadonlyArray<string>) => {
                        fake.deleteCalls.push(values);
                        return { abortSignal: async (_signal: AbortSignal) => ({ error: null }) };
                    },
                }),
            };
        },

        // A silent feed: this reproduction needs no remote events, and calling
        // back on SUBSCRIBED would add pulls that confuse what is being shown.
        channel: (_name: string) => {
            const chan = {
                on: (..._args: unknown[]) => chan,
                subscribe: (_cb: (status: string) => void) => chan,
            };
            return chan;
        },
        removeChannel: async (_channel: unknown) => undefined,
    };
    return { supabase: fake };
});

const fake = supabase as unknown as FakeSupabase;

const weekOf = (weekStart: string, id: string): WeekPlan => ({
    weekStart,
    ended: false,
    projects: [{ id, name: id, tasks: [] }],
});

const FIVE: Weeks = [
    weekOf('2026-07-20', 'p1'),
    weekOf('2026-07-27', 'p2'),
    weekOf('2026-08-03', 'p3'),
    weekOf('2026-08-10', 'p4'),
    weekOf('2026-08-17', 'p5'),
];

const rowOf = (plan: WeekPlan): Row => ({
    user_id: USER_ID,
    week_start: plan.weekStart,
    ended: false,
    projects: plan.projects,
});

const SESSION = { user: { id: USER_ID } } as unknown as Session;
const OTHER_SESSION = { user: { id: OTHER_USER_ID } } as unknown as Session;

/** How many weeks a durable copy holds on disk, or -1 when the key is absent. */
function storedCount(key: string): number {
    const raw = localStorage.getItem(key);
    return raw === null ? -1 : (JSON.parse(raw) as { weeks: Weeks }).weeks.length;
}

function emit(event: string, session: Session | null): void {
    for (const listener of [...fake.listeners]) listener(event, session);
}

/** A healthy device: five weeks, synced, signed in as u1. */
function primeHealthyDevice(): void {
    localStorage.clear();
    localStorage.setItem(CURRENT_KEY, JSON.stringify({ weeks: FIVE }));
    localStorage.setItem(SYNCED_KEY, JSON.stringify({ weeks: FIVE }));
    localStorage.setItem(OWNER_KEY, USER_ID);
    fake.rows = FIVE.map(rowOf);
    fake.session = { user: { id: USER_ID } };
    fake.upsertCalls = [];
    fake.deleteCalls = [];
    fake.fromCalls = [];
    fake.sessionGate = null;
}

/**
 * Mounts the two hooks App composes, plus a hook the driver can use to run code
 * in the commit phase.
 *
 * @param onCommit called during every commit — after React has rendered and
 *        BEFORE it flushes that render's passive effects. That slot is not a
 *        mechanism, only a clock: it names the instant an auth callback has to
 *        land on to do the damage, which is otherwise reached only by luck.
 *        Outside act() React really does leave that window open — a promise
 *        continuation runs in it, though a setTimeout(0) loses the race to the
 *        flush — but under act() the flush is synchronous, so a test that waited
 *        for the window to occur on its own would never see it. This writes
 *        nothing itself.
 */
function mount(onCommit: (weeks: Weeks, loaded: boolean, epoch: number) => void) {
    return renderHook(() => {
        const auth = useAuth();
        const [weeks, , loaded] = useWeeks(auth.epoch);
        useLayoutEffect(() => {
            onCommit(weeks, loaded, auth.epoch);
        });
        return { weeks, loaded, epoch: auth.epoch };
    });
}

/*
 * The main route. A cold page load on a device that is signed in and has five
 * weeks in both durable copies.
 *
 * Store starts on the guest backend (store.ts:41), so useWeeks' first load
 * resolves against LocalBackend and puts its empty collection into React state
 * with `loaded` true. useAuth's seed then makes the cloud backend active
 * synchronously (useAuth.ts:199) while its epoch bump is only queued. The two
 * are genuinely concurrent on a cold load: auth-js starts its token refresh at
 * module evaluation and holds every session read and auth event behind it, while
 * React mounts, loads and paints in the same window.
 */
describe('a cold load that starts on the guest backend', () => {
    beforeEach(() => {
        cloudBackend.reset();
        // Both halves of a fresh page's starting state: a Store begins on the
        // guest backend AND knowing no session, and leaving the previous test's
        // user in place would let the next one's sign-in look like a repeat.
        store.useBackend('local');
        store.useSession(undefined);
        fake.listeners.clear();
        primeHealthyDevice();
    });

    it("does not push the guest backend's empty weeks into the account", async () => {
        let releaseSession = (): void => {};
        fake.sessionGate = new Promise<void>((resolve) => {
            releaseSession = resolve;
        });

        let seedPending = true;
        mount((weeks, loaded, epoch) => {
            // The auth seed, landing in the gap between React committing the
            // guest load and flushing that render's effects. INITIAL_SESSION is
            // what auth-js delivers to a new subscriber once initialize()
            // settles, and useAuth seeds from whichever of the two answers first.
            if (seedPending && epoch === 0 && loaded && weeks.length === 0) {
                seedPending = false;
                emit('INITIAL_SESSION', SESSION);
                releaseSession();
            }
        });

        // Settles the guest load and commits it, which is what fires the seed
        // above. Kept separate from the wait below: act defers React's flush to
        // the end of its callback, so a commit and a timer cannot share one.
        await act(async () => {});

        // `current` is the cloud backend's own durable copy, and it now holds
        // the guest backend's empty collection while `synced` still holds five.
        // The cloud load that follows in this same page life reads that as five
        // weeks the user deleted, and pushes them.
        const armed = { current: storedCount(CURRENT_KEY), synced: storedCount(SYNCED_KEY) };

        await act(async () => {
            await new Promise((resolve) => setTimeout(resolve, DEBOUNCE_MS * 3));
        });

        expect({ ...armed, deletes: fake.deleteCalls }).toEqual({
            current: 5,
            synced: 5,
            deletes: [],
        });
    });

    // The control: the same seed, one task later instead of inside the gap.
    // Nothing about the fake changes, so a delete here would mean the harness
    // deletes on its own and the test above proves nothing.
    it('is unharmed when the seed lands after the effects have flushed', async () => {
        let releaseSession = (): void => {};
        fake.sessionGate = new Promise<void>((resolve) => {
            releaseSession = resolve;
        });

        const { result } = mount(() => {});
        await act(async () => {});

        await act(async () => {
            emit('INITIAL_SESSION', SESSION);
            releaseSession();
        });
        await act(async () => {
            await new Promise((resolve) => setTimeout(resolve, DEBOUNCE_MS * 3));
        });

        expect({
            current: storedCount(CURRENT_KEY),
            synced: storedCount(SYNCED_KEY),
            deletes: fake.deleteCalls,
            weeks: result.current.weeks.length,
        }).toEqual({ current: 5, synced: 5, deletes: [], weeks: 5 });
    });

    it('reads only planner_weeks on a signed-in load', async () => {
        const { result } = mount(() => {});
        await act(async () => {});
        await act(async () => {
            emit('INITIAL_SESSION', SESSION);
        });
        await waitFor(() => expect(result.current.weeks).toHaveLength(5));

        expect([...new Set(fake.fromCalls)]).toEqual(['planner_weeks']);
    });
});

/*
 * NOT the main route, kept because it is the same defect reached from a
 * different trigger and a fix has to cover both.
 *
 * auth-js 2.112.0 cannot produce SIGNED_OUT then SIGNED_IN for one user from a
 * token refresh: _recoverAndRefresh returns immediately after _removeSession
 * (GoTrueClient.js:4094), and a successful refresh emits TOKEN_REFRESHED
 * (:4252), which useAuth reads as no switch at all. The pair reaches a live tab
 * only from an explicit signOut() followed by an explicit sign-in, or from the
 * BroadcastChannel relay of another tab doing that (:265).
 */
describe('a sign-out and sign-in reaching a live tab', () => {
    beforeEach(() => {
        cloudBackend.reset();
        // Both halves of a fresh page's starting state: a Store begins on the
        // guest backend AND knowing no session, and leaving the previous test's
        // user in place would let the next one's sign-in look like a repeat.
        store.useBackend('local');
        store.useSession(undefined);
        fake.listeners.clear();
        primeHealthyDevice();
    });

    it("does not push the guest backend's empty weeks into the account", async () => {
        let signedOutOnce = false;
        const { result } = mount((weeks, loaded) => {
            if (signedOutOnce && loaded && weeks.length === 0) {
                signedOutOnce = false;
                emit('SIGNED_IN', SESSION);
            }
        });
        await waitFor(() => expect(result.current.weeks).toHaveLength(5));
        fake.deleteCalls = [];

        signedOutOnce = true;
        await act(async () => {
            emit('SIGNED_OUT', null);
        });
        const armed = { current: storedCount(CURRENT_KEY), synced: storedCount(SYNCED_KEY) };

        await act(async () => {
            await new Promise((resolve) => setTimeout(resolve, DEBOUNCE_MS * 3));
        });

        expect({ ...armed, deletes: fake.deleteCalls }).toEqual({
            current: 5,
            synced: 5,
            deletes: [],
        });
    });

    it('is unharmed when the sign-in lands after the effects have flushed', async () => {
        const { result } = mount(() => {});
        await waitFor(() => expect(result.current.weeks).toHaveLength(5));
        fake.deleteCalls = [];

        await act(async () => {
            emit('SIGNED_OUT', null);
        });
        await act(async () => {
            emit('SIGNED_IN', SESSION);
        });
        await act(async () => {
            await new Promise((resolve) => setTimeout(resolve, DEBOUNCE_MS * 3));
        });

        expect({
            current: storedCount(CURRENT_KEY),
            synced: storedCount(SYNCED_KEY),
            deletes: fake.deleteCalls,
            weeks: result.current.weeks.length,
        }).toEqual({ current: 5, synced: 5, deletes: [], weeks: 5 });
    });
});

/*
 * The same defect reached without moving the backend at all.
 *
 * Signing in as somebody else keeps the cloud backend active, so useBackend
 * returns early and its switch counter does not move — but cloudBackend.reset()
 * has already emptied the cache and both durable copies for the incoming
 * account. A guard that watches which BACKEND answers cannot see this; the
 * question is whose data it holds.
 */
describe('a second account signing in over the first', () => {
    beforeEach(() => {
        cloudBackend.reset();
        // Both halves of a fresh page's starting state: a Store begins on the
        // guest backend AND knowing no session, and leaving the previous test's
        // user in place would let the next one's sign-in look like a repeat.
        store.useBackend('local');
        store.useSession(undefined);
        fake.listeners.clear();
        primeHealthyDevice();
    });

    it("does not write the first account's weeks into the second", async () => {
        let armed = true;
        const { result } = mount((weeks, loaded, epoch) => {
            // u1's load resolving is the commit that matters: `weeks` and
            // `loaded` both change there, so the persist effect really runs.
            if (armed && loaded && epoch === 1 && weeks.length === 5) {
                armed = false;
                fake.session = { user: { id: OTHER_USER_ID } };
                fake.rows = [];
                emit('SIGNED_IN', OTHER_SESSION);
            }
        });

        await act(async () => {
            emit('INITIAL_SESSION', SESSION);
        });
        await act(async () => {
            await new Promise((resolve) => setTimeout(resolve, DEBOUNCE_MS * 3));
        });

        expect({
            upserts: fake.upsertCalls.map((rows) => rows.map((row) => row.user_id)),
            weeks: result.current.weeks.length,
        }).toEqual({ upserts: [], weeks: 0 });
    });

    // The control: the same second sign-in, one task later. A leak here would
    // mean the harness carries data across on its own.
    it('is unharmed when the second sign-in lands after the effects have flushed', async () => {
        const { result } = mount(() => {});
        await act(async () => {
            emit('INITIAL_SESSION', SESSION);
        });
        await waitFor(() => expect(result.current.weeks).toHaveLength(5));
        fake.upsertCalls = [];

        fake.session = { user: { id: OTHER_USER_ID } };
        fake.rows = [];
        await act(async () => {
            emit('SIGNED_IN', OTHER_SESSION);
        });
        await act(async () => {
            await new Promise((resolve) => setTimeout(resolve, DEBOUNCE_MS * 3));
        });

        expect({
            upserts: fake.upsertCalls.map((rows) => rows.map((row) => row.user_id)),
            weeks: result.current.weeks.length,
        }).toEqual({ upserts: [], weeks: 0 });
    });
});
