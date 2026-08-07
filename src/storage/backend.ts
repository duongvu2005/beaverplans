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

    /**
     * Registers a listener for changes this client did not make.
     *
     * getWeeks' postcondition — the value most recently set or loaded — holds
     * only while this client is the sole writer. A backend shared with another
     * device or tab can change underneath it, and this is how a caller hears
     * about that; without it, such a change is invisible until the next load.
     *
     * Not called for a change this client made through setWeeks, nor for
     * load(), since the caller of those already knows.
     *
     * @param listener called after getWeeks has begun returning the new value,
     *        so a listener that reads getWeeks sees the change rather than the
     *        one it replaced
     * @returns a function removing this listener. Safe to call more than once,
     *          and safe to call on a backend that never reports anything.
     */
    subscribe(listener: () => void): () => void;
}
