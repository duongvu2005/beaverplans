import type { Weeks } from '../core/types';
import type { Backend } from './backend';
import type { LocalBackend } from './localBackend';

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
    public getWeeks(): Weeks {
        return this.active.getWeeks();
    }

    /**
     * @inheritdoc
     */
    public setWeeks(weeks: Weeks): void {
        this.active.setWeeks(weeks);
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
            const _exhaustive: never = name; // compile error if a BackendName is unhandled
            throw new Error(`unknown backend: ${String(_exhaustive)}`);
        }
    }
}
