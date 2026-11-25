import type { DateKey, Weeks } from '@/core/types';
import type { Backend } from './backend';
import type { LocalBackend } from './localBackend';
import { endedCollisions, mergeGuestWeeks } from './mergeGuest';
// Not crypto.randomUUID directly: that is undefined outside a secure context,
// and newId carries the fallback for it.
import { newId as defaultNewId } from '@/utils/newId';

export type BackendName = 'local' | 'cloud';

/**
 * The one backend the app talks to, standing in front of two real ones.
 *
 * Abstraction function:
 *   AF(local, cloud, active) = the backend currently answering — `active`, which
 *   is `local` for a guest and `cloud` once signed in. Every Backend method is
 *   that backend's, so to a caller a Store simply IS whichever one is live.
 *
 * Rep invariant:
 *   - active === local || active === cloud
 *   - unsubscribeActive is defined iff listeners is non-empty, and when defined
 *     it closes a subscription on `active` and no other backend
 *   - sessionUserId names whoever useSession last reported, and sessionKnown is
 *     false only before the first such call. The two travel with `active`:
 *     useBackend('local') accompanies an undefined id and useBackend('cloud') a
 *     defined one, so a caller may read either as the same question
 *   - local is held at its concrete type because guest migration reads the guest
 *     copy directly, which the Backend interface does not expose
 *
 * Safety from rep exposure:
 *   local, cloud and listeners are readonly, and listeners is never handed out —
 *   subscribe returns a closure that removes one entry. `active` is a reference
 *   to a backend the caller already supplied, so aliasing it costs nothing that
 *   was not already shared.
 */
export class Store implements Backend {
    private readonly local: LocalBackend;
    private readonly cloud: Backend;
    private active: Backend;
    private sessions: number;
    private sessionUserId: string | undefined;
    private sessionKnown: boolean;
    private readonly listeners: Set<() => void>;
    private unsubscribeActive: (() => void) | undefined;

    public constructor(local: LocalBackend, cloud: Backend) {
        this.local = local;
        this.cloud = cloud;
        this.active = local;
        this.sessions = 0;
        this.sessionUserId = undefined;
        this.sessionKnown = false;
        this.listeners = new Set();
        this.unsubscribeActive = undefined;
    }

    /**
     * @inheritdoc
     */
    public async load(): Promise<void> {
        await this.active.load();
    }

    /**
     * Whether a guest's stored plan could not be read.
     *
     * A guest copy is the only copy there is, so the caller puts its error boundary
     * in front of the raw bytes. Silent for a signed-in user: the cloud backend
     * handles its own unreadable copies against the server.
     *
     * @returns false until useSession has reported a session, and false whenever
     *          that session names a user.
     */
    public guestCopyUnreadable(): boolean {
        if (!this.sessionKnown || this.sessionUserId !== undefined) return false;
        return this.local.unreadable();
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
     * useBackend switch — one subscription survives every sign-in and sign-out.
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
     * Make one of the two backends the active one.
     *
     * @param name the backend to be made active
     */
    public useBackend(name: BackendName): void {
        const next = this.backendNamed(name);
        // A token refresh re-applies the same session, so skip the teardown when nothing moved.
        if (next === this.active) {
            return;
        }
        this.active = next;
        // The outgoing backend must stop reporting, or a signed-out session
        // would still relay the cloud's changes.
        this.unwatchActive();
        this.watchActive();
    }

    /**
     * Note whose data this Store now answers with.
     *
     * Separate from useBackend: signing in as somebody else keeps the CLOUD backend
     * active, and a value read for the previous account is no less stale for that.
     *
     * @param userId the signed-in user, or undefined for a guest. Reporting the
     *        same one again — every token refresh does — moves nothing.
     */
    public useSession(userId: string | undefined): void {
        this.sessionKnown = true;
        if (userId === this.sessionUserId) {
            return;
        }
        this.sessionUserId = userId;
        this.sessions += 1;
    }

    /**
     * How many times the data this Store answers with has changed hands.
     *
     * A caller that reads from this Store and later writes back can capture this
     * first and compare before writing: a different count means the value it is
     * holding belongs to a session that is no longer the current one.
     *
     * @returns a count that only ever increases. 0 before any change, including
     *          for the guest a Store starts out serving.
     */
    public sessionCount(): number {
        return this.sessions;
    }

    private backendNamed(name: BackendName): Backend {
        if (name === 'local') return this.local;
        if (name === 'cloud') return this.cloud;
        const exhaustive: never = name; // compile error if a BackendName is unhandled
        throw new Error(`unknown backend: ${String(exhaustive)}`);
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
     * active. Reloads the local backend first: nothing calls its load() on a
     * device that started signed in, so its cache can be empty while real guest
     * data sits in localStorage.
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
     * Unlike localSnapshot this does NOT load first: cloud is the active backend
     * exactly when there is an account to read, so the normal load path has
     * reconciled it. A caller that needs it reconciled must await that load
     * itself — see useGuestMigration's weeksLoaded gate.
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
     * Clearing must stay the LAST step: a failure before it leaves the guest
     * copy where it was and the next sign-in offers the merge again. Clearing
     * behind the cloud write is safe because CloudBackend.setWeeks records to
     * its durable copy synchronously, before scheduling the network push.
     *
     * @param newId supplies a fresh id for every project, task, and subtask
     *        carried over from the guest data (see mergeGuestWeeks).
     *        Defaults to the app's own newId; pass a fake to test.
     * @param reopenEnded whether guest work landing on a week this account has
     *        already ended may reopen it. False drops that work — so a caller
     *        should ask endedCollisions first and only pass false once it knows
     *        there is nothing to drop, or has been told to drop it.
     * @returns having merged, or having done nothing at all because the session
     *        changed hands while it read the guest copy. Nothing is partly done
     *        either way, and a declined merge leaves the guest copy to be
     *        offered again on the next sign-in.
     */
    public async mergeLocalIntoCloud(
        newId: () => string = defaultNewId,
        reopenEnded = false,
    ): Promise<void> {
        const session = this.sessions;
        const guestWeeks = await this.localSnapshot();
        // The caller settled every prerequisite — signed in, as this user, with
        // the account's own weeks reconciled — before that await, and none of
        // them is rechecked by the three lines below. A session that changed
        // hands meanwhile would take the guest copy with it: clearLocal()
        // destroys the only copy there is, into an account the merge was never
        // decided for.
        if (session !== this.sessions) return;
        const cloudWeeks = this.cloudSnapshot();
        this.cloud.setWeeks(mergeGuestWeeks(cloudWeeks, guestWeeks, newId, reopenEnded));
        this.clearLocal();
    }

    /**
     * Which weeks a merge would land on that this account has already ended.
     *
     * @returns the weekStarts where guest work exists and the cloud holds an
     *     ended week, in the guest collection's order; empty when a merge would
     *     lose nothing. Ask this BEFORE mergeLocalIntoCloud, which otherwise
     *     drops that work silently.
     */
    public async endedMergeCollisions(): Promise<ReadonlyArray<DateKey>> {
        return endedCollisions(this.cloudSnapshot(), await this.localSnapshot());
    }
}
