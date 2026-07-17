import type { WeekPlan, Archive } from '../core/types';

export interface Backend {
    /**
     * Loads the persisted state into effect, so that subsequent getters
     * reflect what was previously saved — or empty defaults if nothing
     * was saved. Call once before relying on the getters.
     * Not deterministic: reads the underlying persistent store.
     *
     * @returns a promise that resolves once loading is complete.
     */
    load(): Promise<void>;

    /**
     * @returns the current WeekPlan: the one most recently passed to setWeekPlan,
     *          or an empty plan for the current week if none has been set or loaded.
     */
    getWeekPlan(): WeekPlan;

    /**
     * @returns the current Archive: the one most recently passed to setArchive,
     *          or an empty archive if none has been set or loaded.
     */
    getArchive(): Archive;

    /**
     * Makes plan the current WeekPlan and persists it, so that a later getWeekPlan
     * returns plan.
     *
     * @param plan any valid WeekPlan.
     */
    setWeekPlan(plan: WeekPlan): void;

    /**
     * Makes archive the current Archive and persists it, so that a later getArchive
     * returns archive.
     *
     * @param archive any valid WeekPlan.
     */
    setArchive(archive: Archive): void;

    /**
     * Returns all of the backend's stored state to its empty default, so that
     * afterward every getter returns its empty value.
     */
    reset(): void;
}
