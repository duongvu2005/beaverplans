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
    private readonly storageKey: string;
    private cache: { weeks: Weeks };

    public constructor(storage: KeyValueStore, storageKey: string = STORAGE_KEY) {
        this.storage = storage;
        this.storageKey = storageKey;
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

    /**
     * @inheritdoc
     * Never reports anything, and the no-op is truthful rather than a stub:
     * this backend's cache only changes through its own methods. Another tab
     * writing the same key does change the underlying store, but nothing here
     * listens for the browser's `storage` event, so there is no such change to
     * report until something does.
     */
    public subscribe(listener: () => void): () => void {
        void listener;
        return () => {};
    }

    private emptyState(): { weeks: Weeks } {
        return { weeks: [] };
    }

    private read(): { weeks: Weeks } {
        try {
            const storageJSON = this.storage.getItem(this.storageKey);
            if (!storageJSON) {
                return this.emptyState();
            }
            const parsed = JSON.parse(storageJSON) as { weeks: Weeks };
            if (!isValidWeeks(parsed.weeks)) return this.emptyState();
            return { weeks: parsed.weeks };
        } catch {
            return this.emptyState();
        }
    }

    private write(): void {
        try {
            this.storage.setItem(this.storageKey, JSON.stringify(this.cache));
        } catch {
            // failed write, nothing for now
        }
    }
}
