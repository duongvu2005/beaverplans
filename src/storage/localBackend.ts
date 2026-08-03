import type { Weeks } from '../core/types';
import type { Backend } from './backend';
import { isValidWeeks } from '../core/weeks';

export const STORAGE_KEY = 'beaverplans.state.v1';

export interface KeyValueStore {
    getItem(key: string): string | null;
    setItem(key: string, value: string): void;
    removeItem(key: string): void;
}

export class LocalBackend implements Backend {
    private readonly storage: KeyValueStore;
    private cache: { weeks: Weeks };

    public constructor(storage: KeyValueStore) {
        this.storage = storage;
        this.cache = this.emptyState();
    }

    /**
     * @inheritdoc
     */
    public async load(): Promise<void> {
        this.cache = this.read();
    }

    /**
     * @inheritdoc
     */
    public getWeeks(): Weeks {
        return this.cache.weeks;
    }

    /**
     * @inheritdoc
     */
    public setWeeks(weeks: Weeks): void {
        this.cache.weeks = weeks;
        this.write();
    }

    /**
     * @inheritdoc
     */
    public reset(): void {
        this.cache = this.emptyState();
        this.write();
    }

    private emptyState(): { weeks: Weeks } {
        return { weeks: [] };
    }

    private read(): { weeks: Weeks } {
        const storageJSON = this.storage.getItem(STORAGE_KEY);
        if (!storageJSON) {
            return this.emptyState();
        }
        try {
            const parsed = JSON.parse(storageJSON) as { weeks: Weeks };
            if (!isValidWeeks(parsed.weeks)) return this.emptyState();
            return { weeks: parsed.weeks };
        } catch {
            return this.emptyState();
        }
    }

    private write(): void {
        try {
            this.storage.setItem(STORAGE_KEY, JSON.stringify(this.cache));
        } catch {
            // failed write, nothing for now
        }
    }
}
