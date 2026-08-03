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
}

// --- fixtures ---
const localWeeks: Weeks = [
    { weekStart: '2026-07-13', projects: [{ id: 'local-p', name: 'Local', tasks: [] }] },
];
const cloudWeeks: Weeks = [
    { weekStart: '2026-07-20', projects: [{ id: 'cloud-p', name: 'Cloud', tasks: [] }] },
];
const newWeeks: Weeks = [
    { weekStart: '2026-07-13', projects: [{ id: 'new-p', name: 'New', tasks: [] }] },
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
