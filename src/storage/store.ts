import type { Archive, WeekPlan } from "../core/types";
import type { Backend } from "./backend";
import type { LocalBackend } from "./localBackend";

export type BackendName = 'local' | 'cloud';

export class Store implements Backend {
    private readonly local: LocalBackend;
    private readonly cloud: Backend;
    private active: Backend;

    public constructor(local: LocalBackend, cloud: Backend) {
        this.local = local;
        this.cloud = cloud;
        // default: local
        this.active = local;
    }

    /**
     * @inheritdoc
     */
    public async load(): Promise<void> {
        return this.active.load();
    }

    /**
     * @inheritdoc
     */
    public getWeekPlan(): WeekPlan {
        return this.active.getWeekPlan();
    }

    /**
     * @inheritdoc
     */
    public getArchive(): Archive {
        return this.active.getArchive();
    }

    /**
     * @inheritdoc
     */
    public setWeekPlan(plan: WeekPlan): void {
        this.active.setWeekPlan(plan);
    }

    /**
     * @inheritdoc
     */
    public setArchive(archive: Archive): void {
        this.active.setArchive(archive);
    }

    /**
     * @inheritdoc
     */
    public reset(): void {
        return this.active.reset();
    }

    /**
     * Set the active backend to name ('local' | 'cloud')
     * 
     * @param name the backend to be made active
     */
    public useBackend(name: BackendName): void {
        if (name === 'local') {
            this.active = this.local;
        } else if (name === 'cloud') {
            this.active = this.cloud;
        } else {
            const _exhaustive: never = name;  // compile error if a BackendName is unhandled
            throw new Error(`unknown backend: ${String(_exhaustive)}`);
        }
    }
}
