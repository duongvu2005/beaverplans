import type { Weeks } from '../core/types';

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
     * @returns the current Weeks: the one most recently passed to setWeeks,
     *          or an empty collection if none has been set or loaded. An
     *          untouched week has no entry (see isEmptyWeek in weeks.ts) —
     *          this never synthesizes one to fill the gap.
     */
    getWeeks(): Weeks;

    /**
     * Makes weeks the current Weeks and persists it, so that a later getWeeks
     * returns weeks.
     *
     * @param weeks any valid Weeks (isValidWeeks(weeks)) — trusted as a
     *        precondition, not defended; validation happens on the read path
     *        instead (untrusted JSON, not an in-memory typed value).
     */
    setWeeks(weeks: Weeks): void;

    /**
     * Returns all of the backend's stored state to its empty default, so that
     * afterward every getter returns its empty value.
     */
    reset(): void;
}
