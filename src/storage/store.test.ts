import { describe, it, expect } from 'vitest';
import { Store, type BackendName } from './store';
import { LocalBackend, type KeyValueStore } from './localBackend';
import type { Backend } from './backend';
import type { Weeks } from '../core/types';

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

// A Backend that is observable: getters return recognizable values, setters/load
// record that they were called (and with what). Injected as the cloud slot so a
// call reaching cloud is visible without a real CloudBackend.
class SpyBackend implements Backend {
    public loadCalls = 0;
    public setWeeksCalls: Weeks[] = [];
    public resetCalls = 0;
    public loadGate: Promise<void> = Promise.resolve();
    private readonly weeks: Weeks;

    public constructor(weeks: Weeks) {
        this.weeks = weeks;
    }

    public async load(): Promise<void> {
        this.loadCalls++;
        await this.loadGate;
    }
    public getWeeks(): Weeks {
        return this.weeks;
    }
    public setWeeks(weeks: Weeks): void {
        this.setWeeksCalls.push(weeks);
    }
    public reset(): void {
        this.resetCalls++;
    }
    public subscribe(listener: () => void): () => void {
        this.listeners.add(listener);
        return () => {
            this.listeners.delete(listener);
        };
    }
    /** Stand in for a remote change arriving on this backend. */
    public emitChange(): void {
        for (const listener of [...this.listeners]) listener();
    }
    public readonly listeners = new Set<() => void>();
}

// --- fixtures ---
const localWeeks: Weeks = [
    {
        weekStart: '2026-07-13',
        ended: false,
        projects: [{ id: 'local-p', name: 'Local', tasks: [] }],
    },
];
const cloudWeeks: Weeks = [
    {
        weekStart: '2026-07-20',
        ended: false,
        projects: [{ id: 'cloud-p', name: 'Cloud', tasks: [] }],
    },
];
const newWeeks: Weeks = [
    { weekStart: '2026-07-13', ended: false, projects: [{ id: 'new-p', name: 'New', tasks: [] }] },
];

// A store wired with a real, seeded LocalBackend and an observable spy cloud.
function makeStore(): { store: Store; local: LocalBackend; cloud: SpyBackend } {
    const local = new LocalBackend(new FakeStorage());
    local.setWeeks(localWeeks); // seed so local is distinguishable from cloud
    const cloud = new SpyBackend(cloudWeeks);
    const store = new Store(local, cloud);
    return { store, local, cloud };
}

describe('Store', () => {
    /*
     * Testing strategy
     *   partition on active backend: local (default) | cloud (after switch) | local again (after switch back)
     *   partition on method: getWeeks | setWeeks (argument passes through) | load (async, check propagation)
     *     | reset (delegates) | useBackend (valid name | invalid name, throws)
     * Routing is observed by making the two backends return / record distinguishable values.
     */

    it('covers default active is local: getWeeks routes to local', () => {
        const { store } = makeStore();
        expect(store.getWeeks()).toEqual(localWeeks);
    });

    it('covers default active is local: setWeeks lands on local with the given weeks', () => {
        const { store, local, cloud } = makeStore();
        store.setWeeks(newWeeks);
        expect(local.getWeeks()).toEqual(newWeeks); // landed on local, same weeks
        expect(cloud.setWeeksCalls).toEqual([]); // did not go to cloud
    });

    it('covers switch to cloud: getWeeks routes to cloud', () => {
        const { store } = makeStore();
        store.useBackend('cloud');
        expect(store.getWeeks()).toEqual(cloudWeeks);
    });

    it('covers switch to cloud: setWeeks lands on cloud with the given weeks', () => {
        const { store, local, cloud } = makeStore();
        store.useBackend('cloud');
        store.setWeeks(newWeeks);
        expect(cloud.setWeeksCalls).toEqual([newWeeks]); // landed on cloud, same weeks
        expect(local.getWeeks()).toEqual(localWeeks); // local untouched
    });

    it('covers reset: delegates to the active backend', () => {
        const { store, cloud } = makeStore();
        store.useBackend('cloud');
        store.reset();
        expect(cloud.resetCalls).toBe(1);
    });

    it('covers useBackend with an invalid name: throws', () => {
        const { store } = makeStore();
        expect(() => store.useBackend('bogus' as BackendName)).toThrow('unknown backend: bogus');
    });

    it('covers switch back to local: getWeeks routes to local again', () => {
        const { store } = makeStore();
        store.useBackend('cloud');
        store.useBackend('local');
        expect(store.getWeeks()).toEqual(localWeeks);
    });

    it('covers load: delegates to the active backend and awaits its promise', async () => {
        const { store, cloud } = makeStore();
        store.useBackend('cloud');

        // Hold cloud.load() open so we can see whether store.load() waits for it.
        let release!: () => void;
        cloud.loadGate = new Promise<void>((resolve) => {
            release = resolve;
        });

        let settled = false;
        const loading = store.load().then(() => {
            settled = true;
        });

        await new Promise((r) => setTimeout(r, 0)); // drain microtasks
        expect(cloud.loadCalls).toBe(1); // delegated to cloud
        expect(settled).toBe(false); // still waiting on cloud.load — fails if the promise was dropped

        release();
        await loading;
        expect(settled).toBe(true);
    });
});

describe('Store subscribe', () => {
    /*
     * Testing strategy
     *   partition on which backend reports: the active one | the inactive one
     *     (must not be heard)
     *   partition on useBackend: a listener registered BEFORE the switch must
     *     follow it, and the outgoing backend must stop being relayed
     *   partition on unsubscribing: stops delivery; the last unsubscribe also
     *     releases the underlying subscription
     *   partition on how many listeners remain after one unsubscribes: none
     *     (release the backend) | some (keep it, keep delivering)
     */

    it('relays the active backend, and ignores the inactive one', () => {
        const { store, cloud } = makeStore();
        let woken = 0;
        store.subscribe(() => {
            woken += 1;
        });

        cloud.emitChange(); // local is active, so cloud is not being listened to
        expect(woken).toBe(0);

        store.useBackend('cloud');
        cloud.emitChange();
        expect(woken).toBe(1);
    });

    it('a listener registered before a switch follows it, without re-subscribing', () => {
        const { store, cloud } = makeStore();
        const seen: string[] = [];
        store.subscribe(() => seen.push('heard'));

        store.useBackend('cloud');
        cloud.emitChange();
        store.useBackend('local');
        cloud.emitChange(); // cloud is no longer active: silence

        expect(seen).toEqual(['heard']);
    });

    it('unsubscribing stops delivery and releases the backend subscription', () => {
        const { store, cloud } = makeStore();
        store.useBackend('cloud');
        let woken = 0;
        const off = store.subscribe(() => {
            woken += 1;
        });
        cloud.emitChange();
        expect(cloud.listeners.size).toBe(1);

        off();
        cloud.emitChange();

        expect(woken).toBe(1);
        expect(cloud.listeners.size).toBe(0); // not merely ignored — detached
    });

    // The release is gated on the LAST listener leaving. Dropping that guard —
    // detaching whenever anyone unsubscribes — would silence every remaining
    // listener the moment one component unmounted, and the symptom would be a
    // board that quietly stops seeing another device's edits rather than
    // anything that looks like an error.
    it('one listener leaving does not cut off the others', () => {
        const { store, cloud } = makeStore();
        store.useBackend('cloud');
        let stillHere = 0;
        const off = store.subscribe(() => {});
        store.subscribe(() => {
            stillHere += 1;
        });

        off();
        cloud.emitChange();

        expect(stillHere).toBe(1);
        expect(cloud.listeners.size).toBe(1); // still attached, for the survivor
    });
});

describe('Store guest migration helpers', () => {
    /*
     * Testing strategy
     *   hasLocalData: local empty | local has data | local has data but this
     *     LocalBackend instance's own cache hasn't loaded it yet (proves the
     *     reload — the case of a device that was signed in from the start)
     *   localSnapshot: returns local's Weeks; does not touch cloud
     *   clearLocal: empties local; cloud untouched
     *   mergeLocalIntoCloud: cloud.setWeeks receives cloud folded with local
     *     (via mergeGuestWeeks), then local is cleared
     *   cloudSnapshot: returns cloud's Weeks; does not touch local; unaffected by
     *     which backend is active
     */

    it('hasLocalData: false when the local backend holds nothing', async () => {
        const store = new Store(new LocalBackend(new FakeStorage()), new SpyBackend(cloudWeeks));
        expect(await store.hasLocalData()).toBe(false);
    });

    it('hasLocalData: true when the local backend holds data', async () => {
        const { store } = makeStore();
        expect(await store.hasLocalData()).toBe(true);
    });

    it('hasLocalData: true even when this LocalBackend instance has not loaded yet, as long as the shared storage already has guest data', async () => {
        const storage = new FakeStorage();
        new LocalBackend(storage).setWeeks(localWeeks); // written in an "earlier session"
        const freshLocal = new LocalBackend(storage); // cache starts empty; load() never called
        const store = new Store(freshLocal, new SpyBackend(cloudWeeks));
        expect(await store.hasLocalData()).toBe(true);
    });

    it('localSnapshot: returns the local backend’s Weeks without touching cloud', async () => {
        const { store, cloud } = makeStore();
        expect(await store.localSnapshot()).toEqual(localWeeks);
        expect(cloud.setWeeksCalls).toEqual([]);
    });

    it('clearLocal: empties the local backend, leaves cloud untouched', () => {
        const { store, local, cloud } = makeStore();
        store.clearLocal();
        expect(local.getWeeks()).toEqual([]);
        expect(cloud.resetCalls).toBe(0);
    });

    it('mergeLocalIntoCloud: folds local into cloud via mergeGuestWeeks, then clears local', async () => {
        const { store, local, cloud } = makeStore();
        let n = 0;
        await store.mergeLocalIntoCloud(() => `new-${++n}`);

        expect(cloud.setWeeksCalls).toHaveLength(1);
        const merged = cloud.setWeeksCalls[0]!;
        // cloud's own week (no collision with local's) is untouched...
        expect(merged.find((w) => w.weekStart === '2026-07-20')?.projects).toEqual(
            cloudWeeks[0]!.projects,
        );
        // ...and local's week lands wholesale, re-identified.
        expect(merged.find((w) => w.weekStart === '2026-07-13')?.projects[0]?.id).toBe('new-1');
        expect(local.getWeeks()).toEqual([]);
    });

    it('cloudSnapshot: returns the cloud backend’s Weeks without touching local', () => {
        const { store, local, cloud } = makeStore();
        expect(store.cloudSnapshot()).toEqual(cloudWeeks);
        expect(local.getWeeks()).toEqual(localWeeks); // untouched
        expect(cloud.setWeeksCalls).toEqual([]);
    });

    it('cloudSnapshot: reads cloud even while local is the active backend', () => {
        const { store } = makeStore(); // active defaults to local
        expect(store.getWeeks()).toEqual(localWeeks); // active says local...
        expect(store.cloudSnapshot()).toEqual(cloudWeeks); // ...cloudSnapshot does not
    });

    it('cloudSnapshot: does not load, so it reflects whatever cloud already holds', () => {
        const { store, cloud } = makeStore();
        store.cloudSnapshot();
        expect(cloud.loadCalls).toBe(0);
    });
});
