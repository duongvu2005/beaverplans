import type { Weeks } from '@/core/types';
import type { Backend } from './backend';
import { isValidWeeks } from '@/core/weeks';

export const STORAGE_KEY = 'beaverplans.state.v1';

/**
 * The slice of `window.localStorage` this package needs, and the seam every
 * storage test injects a fake through. `window.localStorage` satisfies it
 * structurally; a fake only has to honour the three contracts below.
 */
export interface KeyValueStore {
    /**
     * @param key any string
     * @returns the string last written under key, or **null if no value is
     *          stored under it**. Load-bearing: null is the only signal for
     *          "absent", and callers here treat a falsy result as an empty
     *          store rather than as corruption. A fake returning undefined for
     *          a missing key satisfies TypeScript and breaks that reading.
     */
    getItem(key: string): string | null;
    /**
     * @param key any string
     * @param value the string to store under key, replacing any previous one
     * @throws whatever the underlying store throws when it cannot accept the
     *         write — quota exhausted, or private browsing refusing outright.
     *         Callers here swallow it.
     */
    setItem(key: string, value: string): void;
    /**
     * @param key any string; removing an absent key is not an error
     */
    removeItem(key: string): void;
}

/**
 * The plan as it is persisted on this device.
 *
 * Abstraction function:
 *   AF(storage, storageKey, cache) = the weeks collection cache.weeks, which is
 *   what every reader of this backend sees.
 *
 * Rep invariant:
 *   - cache.weeks satisfies isValidWeeks
 *   - cache.weeks equals the weeks parsed from storage.getItem(storageKey),
 *     EXCEPT after a write that threw — the interesting exception, and the whole
 *     reason the two are named separately. setWeeks updates cache first and then
 *     writes, so a failed write leaves memory ahead of the store and every
 *     surface keeps answering from memory as though it had persisted.
 *   - a stored value that is absent, unparseable, or fails isValidWeeks reads as
 *     the empty state rather than throwing, so a corrupt store costs the data,
 *     not the session.
 *
 * Safety from rep exposure:
 *   storage and storageKey are readonly. cache is never handed out directly —
 *   getWeeks returns cache.weeks, a ReadonlyArray of frozen-by-convention plain
 *   objects that the core producers only ever replace, never mutate.
 */
export class LocalBackend implements Backend {
    private readonly storage: KeyValueStore;
    private readonly storageKey: string;
    private cache: { weeks: Weeks };
    private unreadableStore: boolean;
    private staleStore: boolean;

    public constructor(storage: KeyValueStore, storageKey: string = STORAGE_KEY) {
        this.storage = storage;
        this.storageKey = storageKey;
        this.cache = this.emptyState();
        this.unreadableStore = false;
        this.staleStore = false;
    }

    /**
     * @inheritdoc
     * An unusable stored value leaves the cache empty, the same as an absent
     * one — ask unreadable() to tell the two apart before trusting it.
     */
    public async load(): Promise<void> {
        this.cache = this.read();
        this.staleStore = false;
    }

    /**
     * Whether the last load found stored text it could not use — storage that
     * would not answer, text that would not parse, or a shape isValidWeeks
     * rejects.
     *
     * Empty and unusable both leave getWeeks() returning no weeks, and a caller
     * that treats the second as the first says "you have nothing" where it means
     * "I could not read this". Downstream, a three-way merge turns that into a
     * deletion of everything.
     *
     * @returns false before any load, and after one that read a usable value or
     *          found no stored value at all.
     */
    public unreadable(): boolean {
        return this.unreadableStore;
    }

    /**
     * Whether the stored copy is behind this backend's weeks because the last
     * write could not be persisted.
     *
     * A caller holding two of these has to know: quota can land one write and
     * drop the other, and a pair that disagrees on disk is read on the next cold
     * start as though the difference were something the user did.
     *
     * @returns false before any write, and after one that persisted.
     */
    public stale(): boolean {
        return this.staleStore;
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
     * Never reports anything: this backend's cache only changes through its own
     * methods. Another tab writing the same key does change the underlying
     * store, but nothing here listens for the browser's `storage` event.
     */
    public subscribe(listener: () => void): () => void {
        void listener;
        return () => {};
    }

    private emptyState(): { weeks: Weeks } {
        return { weeks: [] };
    }

    private read(): { weeks: Weeks } {
        this.unreadableStore = false;
        try {
            const storageJSON = this.storage.getItem(this.storageKey);
            // Absent is not unreadable: nothing was ever stored here.
            if (!storageJSON) {
                return this.emptyState();
            }
            const parsed = JSON.parse(storageJSON) as { weeks: Weeks };
            if (!isValidWeeks(parsed.weeks)) {
                this.unreadableStore = true;
                return this.emptyState();
            }
            return { weeks: parsed.weeks };
        } catch {
            // Storage that would not answer, or text that would not parse.
            this.unreadableStore = true;
            return this.emptyState();
        }
    }

    private write(): void {
        try {
            this.storage.setItem(this.storageKey, JSON.stringify(this.cache));
            this.staleStore = false;
        } catch {
            this.staleStore = true;
            // A failed write (quota, private browsing) is swallowed: setWeeks
            // has already updated the cache, so the session carries on off
            // memory. Accepted: a guest whose write fails loses the work on reload.
        }
    }
}
