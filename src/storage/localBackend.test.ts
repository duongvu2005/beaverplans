import { describe, it, expect } from 'vitest';
import { LocalBackend, STORAGE_KEY, type KeyValueStore } from './localBackend';
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
class ThrowingStorage extends FakeStorage {
    public setItem(): void {
        throw new Error('quota exceeded');
    }
}

// --- fixtures ---
const samplePlan: WeekPlan = {
    weekStart: '2026-07-13',
    projects: [
        {
            id: 'p1',
            name: 'Essays',
            tasks: [{ id: 't1', name: 'Draft', isDone: false, subtasks: [] }],
        },
    ],
};
const sampleArchive: Archive = [{ weekStart: '2026-07-06', projects: [] }];

describe('LocalBackend', () => {
    /*
     * Testing strategy
     *   partition on store contents at load: empty | corrupt (bad JSON) |
     *     invalid shape (valid JSON, invalid plan or archive) | good
     *   partition on operation: load | getters | setWeekPlan | setArchive | reset
     *   partition on effect checked: through memory (same backend) | through the store (fresh reload)
     *   partition on write outcome: succeeds | throws (quota)
     *   partition on state before reset: populated | already empty
     */

    it('covers fresh backend, no load: getters return empty defaults', () => {
        const backend = new LocalBackend(new FakeStorage());
        expect(backend.getWeekPlan().projects).toEqual([]);
        expect(backend.getArchive()).toEqual([]);
    });

    it('covers load with empty store: getters return empty defaults', async () => {
        const backend = new LocalBackend(new FakeStorage());
        await backend.load();
        expect(backend.getWeekPlan().projects).toEqual([]);
        expect(backend.getArchive()).toEqual([]);
    });

    it('covers load with good data: getters return the saved plan and archive', async () => {
        const storage = new FakeStorage();
        const writer = new LocalBackend(storage);
        writer.setWeekPlan(samplePlan);
        writer.setArchive(sampleArchive);

        const reader = new LocalBackend(storage); // fresh backend, same store
        await reader.load();
        expect(reader.getWeekPlan()).toEqual(samplePlan);
        expect(reader.getArchive()).toEqual(sampleArchive);
    });

    it('covers load with corrupt JSON: getters return empty defaults, no throw', async () => {
        const storage = new FakeStorage();
        storage.setItem(STORAGE_KEY, 'not valid json{{');
        const backend = new LocalBackend(storage);
        await expect(backend.load()).resolves.toBeUndefined();
        expect(backend.getWeekPlan().projects).toEqual([]);
        expect(backend.getArchive()).toEqual([]);
    });

    it('covers load with an invalid plan (valid JSON): getters return empty defaults', async () => {
        const storage = new FakeStorage();
        const badPlan = { weekStart: 'not-a-date', projects: [] };
        storage.setItem(STORAGE_KEY, JSON.stringify({ plan: badPlan, archive: sampleArchive }));
        const backend = new LocalBackend(storage);
        await backend.load();
        expect(backend.getWeekPlan().projects).toEqual([]);
        expect(backend.getArchive()).toEqual([]);
    });

    it('covers load with a valid plan but archive is not an array: getters return empty defaults', async () => {
        const storage = new FakeStorage();
        storage.setItem(STORAGE_KEY, JSON.stringify({ plan: samplePlan, archive: 'not-an-array' }));
        const backend = new LocalBackend(storage);
        await backend.load();
        expect(backend.getWeekPlan().projects).toEqual([]);
        expect(backend.getArchive()).toEqual([]);
    });

    it('covers load with a valid plan but an invalid entry in the archive: getters return empty defaults', async () => {
        const storage = new FakeStorage();
        const badArchive = [{ weekStart: 'not-a-date', projects: [] }];
        storage.setItem(STORAGE_KEY, JSON.stringify({ plan: samplePlan, archive: badArchive }));
        const backend = new LocalBackend(storage);
        await backend.load();
        expect(backend.getWeekPlan().projects).toEqual([]);
        expect(backend.getArchive()).toEqual([]);
    });

    it('covers setWeekPlan then getWeekPlan returns it (through memory)', () => {
        const backend = new LocalBackend(new FakeStorage());
        backend.setWeekPlan(samplePlan);
        expect(backend.getWeekPlan()).toEqual(samplePlan);
    });

    it('covers setArchive then getArchive returns it (through memory)', () => {
        const backend = new LocalBackend(new FakeStorage());
        backend.setArchive(sampleArchive);
        expect(backend.getArchive()).toEqual(sampleArchive);
    });

    it('covers setWeekPlan when the store write throws: does not throw', () => {
        const backend = new LocalBackend(new ThrowingStorage());
        expect(() => backend.setWeekPlan(samplePlan)).not.toThrow();
    });

    it('covers reset after data was set: getters empty and store cleared', async () => {
        const storage = new FakeStorage();
        const backend = new LocalBackend(storage);
        backend.setWeekPlan(samplePlan);
        backend.setArchive(sampleArchive);
        backend.reset();
        expect(backend.getWeekPlan().projects).toEqual([]);
        expect(backend.getArchive()).toEqual([]);

        const fresh = new LocalBackend(storage); // store really cleared, not just cache
        await fresh.load();
        expect(fresh.getWeekPlan().projects).toEqual([]);
        expect(fresh.getArchive()).toEqual([]);
    });

    it('covers reset on an already-empty backend: getters still return empty', () => {
        const backend = new LocalBackend(new FakeStorage());
        backend.reset();
        expect(backend.getWeekPlan().projects).toEqual([]);
        expect(backend.getArchive()).toEqual([]);
    });
});
