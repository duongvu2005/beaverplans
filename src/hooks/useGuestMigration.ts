import { useEffect, useRef, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { Weeks } from '@/core/types';
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
};

/**
 * Checks, once per freshly-loaded signed-in session, whether this browser
 * holds leftover guest data to fold into the account. A brand-new account
 * (cloudEmpty) adopts it silently; an account that already has data of its
 * own surfaces `pendingMerge` instead, for the caller to render as a
 * confirm/discard dialog. See decideMigration for the underlying rule and
 * mergeGuest.ts (plan/fast-track-log.md entry 10) for why the merge itself
 * is a dumb append.
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
    // Which userId (if any) the prompt is currently up for. pendingMerge is
    // derived from this, rather than being its own state reset by the
    // effect on sign-out — so a sign-out clears the prompt for free, just by
    // userId no longer matching, with no setState needed in the effect body.
    const [promptedFor, setPromptedFor] = useState<string | undefined>(undefined);
    const pendingMerge = promptedFor !== undefined && promptedFor === userId;
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
            // Guest work is left exactly where it is, so the cost of giving up
            // here is that this device keeps asking on later sign-ins — which
            // is the right way to fail: nothing is lost, and a browser that
            // starts cooperating gets the prompt it should have had.
            .catch(() => {
                checkedFor.current = undefined; // let a later attempt retry
            });
        return () => {
            cancelled = true;
        };
    }, [userId, weeksLoaded, setWeeks]);

    function confirmMerge() {
        setPromptedFor(undefined);
        // On failure the guest copy is deliberately NOT cleared (see
        // mergeLocalIntoCloud), so re-prompting on the next sign-in is exactly
        // the recovery path — hence no error state to show here.
        void store
            .mergeLocalIntoCloud()
            .then(() => setWeeks(store.getWeeks()))
            .catch(() => {
                checkedFor.current = undefined;
            });
    }

    function discardGuestWork() {
        store.clearLocal();
        setPromptedFor(undefined);
    }

    function decideLater() {
        setPromptedFor(undefined);
    }

    return { pendingMerge, confirmMerge, discardGuestWork, decideLater };
}
