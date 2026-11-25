import { useEffect, useRef, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { DateKey, Weeks } from '@/core/types';
import { store } from '@/storage/instance';
import { decideMigration } from '@/storage/mergeGuest';

type UseGuestMigrationResult = {
    /** true while the "unsaved guest work found" dialog should be shown */
    pendingMerge: boolean;
    /** fold the guest work into the account (the "prompt" path's confirm) */
    confirmMerge: () => void;
    /** drop the guest work instead (the "prompt" path's other choice) */
    discardGuestWork: () => void;
    /** close the prompt without deciding — guest data is untouched, so this
     *  session's dedup (checkedFor) keeps it from reopening on its own, but
     *  it will ask again on the next fresh sign-in load */
    decideLater: () => void;

    /** the weeks the merge cannot land on without reopening them; non-empty
     *  exactly while the second dialog should be shown */
    pendingReopen: ReadonlyArray<DateKey>;
    /** reopen those weeks and merge (the second dialog's confirm) */
    confirmReopen: () => void;
    /** back out — nothing merges and the guest copy stays, so the whole
     *  question can be asked again on the next sign-in */
    cancelReopen: () => void;
};

/**
 * Checks, once per freshly-loaded signed-in session, whether this browser
 * holds leftover guest data to fold into the account. A brand-new account
 * (cloudEmpty) adopts it silently; an account that already has data of its
 * own surfaces `pendingMerge` instead, for the caller to render as a
 * confirm/discard dialog. See decideMigration for the underlying rule and
 * mergeGuest.ts for why the merge itself is a dumb append.
 *
 * @param userId the signed-in user's id, or undefined when signed out/guest
 * @param weeksLoaded whether the active backend's weeks have finished
 *        loading for the current userId — gates the check so it reads the
 *        real, reconciled cloud state rather than a stale/empty cache
 * @param setWeeks the setter from useWeeks, called with the merged result
 *        so the board reflects it immediately (mergeLocalIntoCloud mutates
 *        the store directly; nothing else would tell React about it)
 */
export function useGuestMigration(
    userId: string | undefined,
    weeksLoaded: boolean,
    setWeeks: Dispatch<SetStateAction<Weeks>>,
): UseGuestMigrationResult {
    // Which userId (if any) the prompt is up for. pendingMerge is derived from
    // it, so a sign-out clears the prompt just by no longer matching.
    const [promptedFor, setPromptedFor] = useState<string | undefined>(undefined);
    const pendingMerge = promptedFor !== undefined && promptedFor === userId;
    // The second question, asked only when the first was answered with Merge and
    // the account has ended weeks the guest also worked on. Empty the rest of
    // the time, which is what keeps the dialog off screen.
    const [pendingReopen, setPendingReopen] = useState<ReadonlyArray<DateKey>>([]);
    // The userId this hook has already checked (or is checking) for, so a
    // re-render doesn't re-open the prompt or re-run the auto-merge for a
    // session it already resolved.
    const checkedFor = useRef<string | undefined>(undefined);

    useEffect(() => {
        if (userId === undefined) {
            checkedFor.current = undefined;
            return;
        }
        if (!weeksLoaded || checkedFor.current === userId) return;
        checkedFor.current = userId;

        let cancelled = false;
        void store
            .hasLocalData()
            .then((hasLocal) => {
                if (cancelled || !hasLocal) return; // nothing to do — don't even read cloud
                const decision = decideMigration(store.cloudSnapshot().length === 0, hasLocal);
                if (decision === 'auto') {
                    return store.mergeLocalIntoCloud().then(() => {
                        if (!cancelled) setWeeks(store.getWeeks());
                    });
                }
                if (decision === 'prompt') setPromptedFor(userId);
            })
            // Reading local storage can throw outright (a browser with storage
            // disabled), and that must not surface as an unhandled rejection.
            // Guest work is left where it is, so giving up here costs only that
            // this device asks again on the next sign-in.
            .catch(() => {
                checkedFor.current = undefined; // let a later attempt retry
            });
        return () => {
            cancelled = true;
        };
    }, [userId, weeksLoaded, setWeeks]);

    /**
     * Fold the guest work in. On failure the guest copy is NOT cleared (see
     * mergeLocalIntoCloud), so the next sign-in's prompt is the recovery path
     * and there is no error state to show here.
     */
    function merge(reopenEnded: boolean) {
        void store
            .mergeLocalIntoCloud(undefined, reopenEnded)
            .then(() => setWeeks(store.getWeeks()))
            .catch(() => {
                checkedFor.current = undefined;
            });
    }

    function confirmMerge() {
        setPromptedFor(undefined);
        // Asked BEFORE merging, because merging clears the guest copy: a week
        // the merge cannot land on would take its work down with it.
        void store
            .endedMergeCollisions()
            .then((collisions) => {
                if (collisions.length === 0) {
                    merge(false);
                    return;
                }
                setPendingReopen(collisions);
            })
            .catch(() => {
                checkedFor.current = undefined;
            });
    }

    function confirmReopen() {
        setPendingReopen([]);
        merge(true);
    }

    function cancelReopen() {
        setPendingReopen([]);
    }

    function discardGuestWork() {
        store.clearLocal();
        setPromptedFor(undefined);
    }

    function decideLater() {
        setPromptedFor(undefined);
    }

    return {
        pendingMerge,
        confirmMerge,
        discardGuestWork,
        decideLater,
        pendingReopen,
        confirmReopen,
        cancelReopen,
    };
}
