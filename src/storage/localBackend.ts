import type { Archive, WeekPlan } from "../core/types";
import type { Backend } from "./backend";
import { weekStartOf } from "../core/dates";
import { isValidPlan } from "../core/projects"

export const STORAGE_KEY = 'beaverplans.state.v1';

export interface KeyValueStore {
    getItem(key: string): string | null;
    setItem(key: string, value: string): void;
    removeItem(key: string): void;
}

export class LocalBackend implements Backend {
    private readonly storage: KeyValueStore;
    private cache: { plan: WeekPlan; archive: Archive };

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
    public getWeekPlan(): WeekPlan {
        return this.cache.plan;
    }

    /**
     * @inheritdoc
     */
    public getArchive(): Archive {
        return this.cache.archive;
    }

    /**
     * @inheritdoc
     */
    public setWeekPlan(plan: WeekPlan): void {
        this.cache.plan = plan;
        this.write();
    }

    /**
     * @inheritdoc
     */
    public setArchive(archive: Archive): void {
        this.cache.archive = archive;
        this.write();
    }

    /**
     * @inheritdoc
     */
    public reset(): void {
        this.cache = this.emptyState();
        this.write();
    }

    private emptyState(): { plan: WeekPlan; archive: Archive } {
        return { plan: { weekStart: weekStartOf(new Date()), projects: [] }, archive: [] };
    }

    private read(): { plan: WeekPlan; archive: Archive } {
        const storageJSON = this.storage.getItem(STORAGE_KEY);
        if (!storageJSON) {
            return this.emptyState();
        }
       try {
            const parsed = JSON.parse(storageJSON) as { plan: WeekPlan; archive: Archive };
            if (!isValidPlan(parsed.plan)) return this.emptyState();
            if (!Array.isArray(parsed.archive) || !parsed.archive.every(isValidPlan)) return this.emptyState();
            return { plan: parsed.plan, archive: parsed.archive };
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
