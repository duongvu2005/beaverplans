import type { Weeks } from '@/core/types';
import type { Backend } from './backend';
import type { LocalBackend } from './localBackend';
import { mergeGuestWeeks } from './mergeGuest';
// Not crypto.randomUUID directly: that is undefined outside a secure context
// (the dev server reached over http from a phone is the real case), and newId
// already carries the fallback for it.
import { newId as defaultNewId } from '@/utils/newId';

export type BackendName = 'local' | 'cloud';

export class Store implements Backend {
    private readonly local: LocalBackend;
    private readonly cloud: Backend;
    private active: Backend;
    // Held here rather than passed straight through, so that a listener
    // registered once keeps working across a useBackend switch: the
    // subscription to the backend follows `active`, the listeners do not.
    private readonly listeners: Set<() => void>;
    private unsubscribeActive: (() => void) | undefined;

    public constructor(local: LocalBackend, cloud: Backend) {
        this.local = local;
        this.cloud = cloud;
        // default: local
        this.active = local;
        this.listeners = new Set();
        this.unsubscribeActive = undefined;
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
     * @inheritdoc
     * Reports whatever the ACTIVE backend reports, and follows it across a
     * useBackend switch — so a caller subscribes once, at startup, rather than
     * having to re-subscribe every time the user signs in or out.
     */
    public subscribe(listener: () => void): () => void {
        this.listeners.add(listener);
        this.watchActive();
        return () => {
            this.listeners.delete(listener);
            if (this.listeners.size === 0) {
                this.unwatchActive();
            }
        };
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
        // Move the single subscription onto whichever backend is now active;
        // the outgoing one must stop reporting, or a signed-out session would
        // still be relaying the cloud's changes.
        this.unwatchActive();
        this.watchActive();
    }

    /** Subscribe to the active backend, if anyone is listening and we are not already. */
    private watchActive(): void {
        if (this.unsubscribeActive !== undefined || this.listeners.size === 0) {
            return;
        }
        this.unsubscribeActive = this.active.subscribe(() => {
            // Copied first: a listener is free to unsubscribe itself when called.
            for (const listener of [...this.listeners]) {
                listener();
            }
        });
    }

    private unwatchActive(): void {
        this.unsubscribeActive?.();
        this.unsubscribeActive = undefined;
    }

    // ---- guest -> cloud migration ----

    /**
     * Whether this browser holds guest data, independent of which backend is
     * active. Reloads the local backend from storage first: its in-memory
     * cache is only populated by an earlier load() call, which never
     * happens on this device if the session was already signed in at
     * startup — even though real guest data may still sit in localStorage
     * from before.
     *
     * @returns true iff the local backend's Weeks is non-empty
     */
    public async hasLocalData(): Promise<boolean> {
        await this.local.load();
        return this.local.getWeeks().length > 0;
    }

    /**
     * Read the guest data without mutating anything (used to inspect it, or
     * to fold it into a signed-in account, ahead of clearing it). See
     * hasLocalData for why this reloads first.
     *
     * @returns the local backend's current Weeks
     */
    public async localSnapshot(): Promise<Weeks> {
        await this.local.load();
        return this.local.getWeeks();
    }

    /**
     * Read the account's data without mutating anything — the counterpart to
     * localSnapshot, reading the cloud backend directly regardless of which
     * backend is active.
     *
     * Unlike localSnapshot this does NOT load first, and the asymmetry is
     * deliberate: local may hold a cache no one ever populated (it is not the
     * active backend once signed in), whereas cloud is the active backend
     * exactly when there is an account to read, so the app's normal load path
     * has already reconciled it. A caller that needs it reconciled must await
     * that load itself — see useGuestMigration's weeksLoaded gate.
     *
     * @returns the cloud backend's current Weeks
     */
    public cloudSnapshot(): Weeks {
        return this.cloud.getWeeks();
    }

    /**
     * Drop the guest copy — e.g. once it has been migrated or merged, or
     * when the user explicitly discards it.
     */
    public clearLocal(): void {
        this.local.reset();
    }

    /**
     * Fold this browser's guest data into the cloud backend, then clear the
     * guest copy. Operates on the cloud backend directly, regardless of
     * which backend is currently active.
     *
     * Clearing is deliberately the LAST step, so that a failure anywhere
     * before it leaves the guest copy exactly where it was and the next
     * sign-in can offer the merge again. The cloud write itself is safe to
     * clear behind: CloudBackend.setWeeks records to its own durable local
     * copy synchronously and only then schedules the network push, so guest
     * work is never in flight and nowhere else at the same time.
     *
     * @param newId supplies a fresh id for every project, task, and subtask
     *        carried over from the guest data (see mergeGuestWeeks).
     *        Defaults to the app's own newId; pass a fake to test.
     */
    public async mergeLocalIntoCloud(newId: () => string = defaultNewId): Promise<void> {
        const guestWeeks = await this.localSnapshot();
        const cloudWeeks = this.cloudSnapshot();
        this.cloud.setWeeks(mergeGuestWeeks(cloudWeeks, guestWeeks, newId));
        this.clearLocal();
    }
}
