import { describe, it, expect } from 'vitest';
import { Store } from './store';
import { LocalBackend, type KeyValueStore } from './localBackend';
import type { Backend } from './backend';
import type { WeekPlan, Archive } from '../core/types';

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
    public setPlanCalls: WeekPlan[] = [];
    public setArchiveCalls: Archive[] = [];
    public resetCalls = 0;
    public loadGate: Promise<void> = Promise.resolve();
    private readonly plan: WeekPlan;
    private readonly archive: Archive;

    public constructor(plan: WeekPlan, archive: Archive) {
        this.plan = plan;
        this.archive = archive;
    }

    public async load(): Promise<void> {
        this.loadCalls++;
        await this.loadGate;
    }
    public getWeekPlan(): WeekPlan {
        return this.plan;
    }
    public getArchive(): Archive {
        return this.archive;
    }
    public setWeekPlan(plan: WeekPlan): void {
        this.setPlanCalls.push(plan);
    }
    public setArchive(archive: Archive): void {
        this.setArchiveCalls.push(archive);
    }
    public reset(): void {
        this.resetCalls++;
    }
}

// --- fixtures ---
const localPlan: WeekPlan = {
    weekStart: '2026-07-13',
    projects: [{ id: 'local-p', name: 'Local', tasks: [] }],
};
const cloudPlan: WeekPlan = {
    weekStart: '2026-07-20',
    projects: [{ id: 'cloud-p', name: 'Cloud', tasks: [] }],
};
const newPlan: WeekPlan = {
    weekStart: '2026-07-13',
    projects: [{ id: 'new-p', name: 'New', tasks: [] }],
};
const cloudArchive: Archive = [];

// A store wired with a real, seeded LocalBackend and an observable spy cloud.
function makeStore(): { store: Store; local: LocalBackend; cloud: SpyBackend } {
    const local = new LocalBackend(new FakeStorage());
    local.setWeekPlan(localPlan); // seed so local is distinguishable from cloud
    const cloud = new SpyBackend(cloudPlan, cloudArchive);
    const store = new Store(local, cloud);
    return { store, local, cloud };
}

describe('Store', () => {
    /*
     * Testing strategy
     *   partition on active backend: local (default) | cloud (after switch) | local again (after switch back)
     *   partition on method: getter | setter (also check the argument passes through) | load (async, check propagation)
     * Routing is observed by making the two backends return / record distinguishable values.
     */

    it('covers default active is local: getWeekPlan routes to local', () => {
        const { store } = makeStore();
        expect(store.getWeekPlan()).toEqual(localPlan);
    });

    it('covers default active is local: setWeekPlan lands on local with the given plan', () => {
        const { store, local, cloud } = makeStore();
        store.setWeekPlan(newPlan);
        expect(local.getWeekPlan()).toEqual(newPlan); // landed on local, same plan
        expect(cloud.setPlanCalls).toEqual([]); // did not go to cloud
    });

    it('covers switch to cloud: getWeekPlan routes to cloud', () => {
        const { store } = makeStore();
        store.useBackend('cloud');
        expect(store.getWeekPlan()).toEqual(cloudPlan);
    });

    it('covers switch to cloud: setWeekPlan lands on cloud with the given plan', () => {
        const { store, local, cloud } = makeStore();
        store.useBackend('cloud');
        store.setWeekPlan(newPlan);
        expect(cloud.setPlanCalls).toEqual([newPlan]); // landed on cloud, same plan
        expect(local.getWeekPlan()).toEqual(localPlan); // local untouched
    });

    it('covers switch back to local: getWeekPlan routes to local again', () => {
        const { store } = makeStore();
        store.useBackend('cloud');
        store.useBackend('local');
        expect(store.getWeekPlan()).toEqual(localPlan);
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
