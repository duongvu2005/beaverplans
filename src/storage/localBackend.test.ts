import { describe, it, expect } from 'vitest';
import { LocalBackend, STORAGE_KEY, type KeyValueStore } from './localBackend';
import type { Weeks, WeekPlan } from '../core/types';

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
const activeWeek: WeekPlan = {
    weekStart: '2026-07-13',
    projects: [
        {
            id: 'p1',
            name: 'Essays',
            tasks: [{ id: 't1', name: 'Draft', isDone: false, subtasks: [] }],
        },
    ],
};
const endedWeek: WeekPlan = {
    weekStart: '2026-07-06',
    ended: true,
    projects: [
        {
            id: 'p2',
            name: 'Errands',
            tasks: [{ id: 't2', name: 'Groceries', isDone: true, subtasks: [] }],
        },
    ],
};
const sampleWeeks: Weeks = [endedWeek, activeWeek]; // ascending by weekStart

describe('LocalBackend', () => {
    /*
     * Testing strategy
     *   partition on store contents at load: empty | corrupt (bad JSON) |
     *     weeks not an array | an entry fails isValidPlan (isValidWeeks itself
     *     is weeks.test.ts's job — this file only proves LocalBackend calls
     *     it) | good
     *   partition on operation: load | getters | setWeeks | reset
     *   partition on effect checked: through memory (same backend) | through
     *     the store (fresh reload)
     *   partition on write outcome: succeeds | throws (quota)
     *   partition on state before reset: populated | already empty
     */

    it('covers fresh backend, no load: getter returns empty default', () => {
        const backend = new LocalBackend(new FakeStorage());
        expect(backend.getWeeks()).toEqual([]);
    });

    it('covers load with empty store: getter returns empty default', async () => {
        const backend = new LocalBackend(new FakeStorage());
        await backend.load();
        expect(backend.getWeeks()).toEqual([]);
    });

    it('covers load with good data: getter returns the saved weeks (through a fresh reload)', async () => {
        const storage = new FakeStorage();
        const writer = new LocalBackend(storage);
        writer.setWeeks(sampleWeeks);

        const reader = new LocalBackend(storage); // fresh backend, same store
        await reader.load();
        expect(reader.getWeeks()).toEqual(sampleWeeks);
    });

    it('covers load with corrupt JSON: getter returns empty default, no throw', async () => {
        const storage = new FakeStorage();
        storage.setItem(STORAGE_KEY, 'not valid json{{');
        const backend = new LocalBackend(storage);
        await expect(backend.load()).resolves.toBeUndefined();
        expect(backend.getWeeks()).toEqual([]);
    });

    it('covers load with weeks not an array (valid JSON): getter returns empty default', async () => {
        const storage = new FakeStorage();
        storage.setItem(STORAGE_KEY, JSON.stringify({ weeks: 'not-an-array' }));
        const backend = new LocalBackend(storage);
        await backend.load();
        expect(backend.getWeeks()).toEqual([]);
    });

    it('covers load with two individually-valid entries sharing an id: getter returns empty default', async () => {
        const storage = new FakeStorage();
        // Each entry alone passes isValidPlan (valid weekStart, unique within itself) —
        // only isValidWeeks' cross-entry id check catches the collision.
        const first: WeekPlan = {
            weekStart: '2026-07-06',
            projects: [{ id: 'dup', name: 'A', tasks: [] }],
        };
        const second: WeekPlan = {
            weekStart: '2026-07-13',
            projects: [{ id: 'dup', name: 'B', tasks: [] }],
        };
        storage.setItem(STORAGE_KEY, JSON.stringify({ weeks: [first, second] }));
        const backend = new LocalBackend(storage);
        await backend.load();
        expect(backend.getWeeks()).toEqual([]);
    });

    it('covers load with an individually-valid but empty entry: getter returns empty default', async () => {
        const storage = new FakeStorage();
        // Valid weekStart, unique id, zero projects — isValidPlan doesn't check
        // emptiness at all, only isValidWeeks' isEmptyWeek does.
        const emptyEntry: WeekPlan = { weekStart: '2026-07-06', projects: [] };
        storage.setItem(STORAGE_KEY, JSON.stringify({ weeks: [emptyEntry, activeWeek] }));
        const backend = new LocalBackend(storage);
        await backend.load();
        expect(backend.getWeeks()).toEqual([]);
    });

    it('covers setWeeks then getWeeks returns it (through memory)', () => {
        const backend = new LocalBackend(new FakeStorage());
        backend.setWeeks(sampleWeeks);
        expect(backend.getWeeks()).toEqual(sampleWeeks);
    });

    it('covers setWeeks when the store write throws: does not throw', () => {
        const backend = new LocalBackend(new ThrowingStorage());
        expect(() => backend.setWeeks(sampleWeeks)).not.toThrow();
    });

    it('covers reset after data was set: getter empty and store cleared', async () => {
        const storage = new FakeStorage();
        const backend = new LocalBackend(storage);
        backend.setWeeks(sampleWeeks);
        backend.reset();
        expect(backend.getWeeks()).toEqual([]);

        const fresh = new LocalBackend(storage); // store really cleared, not just cache
        await fresh.load();
        expect(fresh.getWeeks()).toEqual([]);
    });

    it('covers reset on an already-empty backend: getter still returns empty', () => {
        const backend = new LocalBackend(new FakeStorage());
        backend.reset();
        expect(backend.getWeeks()).toEqual([]);
    });
});
