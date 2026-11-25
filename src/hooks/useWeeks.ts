import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import type { Weeks } from '@/core/types';
import { store } from '@/storage/instance';

/**
 * @param epoch bumped by useAuth whenever the active backend actually
 *        switches (local <-> cloud); reloads from the (now-active) backend
 *        each time it changes. Callers with no such switching just pass a
 *        constant.
 * @returns [weeks, setWeeks, loaded]. `loaded` drops back to false the
 *          instant `epoch` changes and stays false until the new backend's
 *          load() resolves — callers should gate rendering the board on it
 *          so a backend switch (e.g. signing in) never shows the outgoing
 *          backend's weeks while the incoming one is still loading.
 * @throws whatever load() rejected with, on the render after it rejects, so
 *         the nearest error boundary handles it. `loaded` can never flip on a
 *         failed load: the persist effect below would then write the initial
 *         [] through to the backend, and CloudBackend turns that into a delete
 *         of every row. Also throws once a loaded guest's stored plan turns out
 *         to be unreadable — see Store.guestCopyUnreadable.
 */
export function useWeeks(epoch: number): [Weeks, Dispatch<SetStateAction<Weeks>>, boolean] {
    const [weeks, setWeeks] = useState<Weeks>([]);
    const [loadFailure, setLoadFailure] = useState<{ error: unknown } | null>(null);
    // Which epoch the weeks currently in state belong to. It lags epoch until
    // the promise resolves, which is what lets `loaded` be derived at render
    // time rather than flipped by a setState at the top of the effect.
    const [loadedEpoch, setLoadedEpoch] = useState<number | null>(null);
    const loaded = loadedEpoch === epoch;
    // Which session the weeks in state were read for. See the persist effect.
    const loadedSession = useRef<number>(-1);

    useEffect(() => {
        let cancelled = false;
        store.load().then(
            () => {
                if (cancelled) return;
                loadedSession.current = store.sessionCount();
                setWeeks(store.getWeeks());
                setLoadedEpoch(epoch);
            },
            (error: unknown) => {
                if (cancelled) return;
                // Boxed so a rejection value of null or undefined is still
                // distinguishable from "nothing failed".
                setLoadFailure({ error });
            },
        );
        return () => {
            cancelled = true;
        };
    }, [epoch]);

    useEffect(() => {
        if (!loaded) return; // don't persist the pre-load [] over real data
        // `weeks` belongs to the session the load read for, and Store is told of
        // a new one synchronously from an auth callback — which React lets run
        // between the render that set `loaded` and this effect. Writing across
        // that gap hands one session's weeks to another: the guest's empty plan
        // reaches a signed-in account as a deletion of every week it has, and
        // one account's weeks reach the next as an upsert of all of them.
        //
        // Checked here rather than in Store: only this side knows which session
        // the value came from. Safe against a change landing in between, because
        // nothing can interleave with the two synchronous calls below.
        if (loadedSession.current !== store.sessionCount()) return;
        // The load itself flips `loaded`, and what it put in state is the
        // store's own value — writing it back costs a durable write and a whole
        // push, session read included, to send a diff that is empty.
        if (weeks === store.getWeeks()) return;
        store.setWeeks(weeks);
    }, [weeks, loaded]);

    // Changes this client did not make — another device or tab writing the same
    // account. The store has already merged them into its own weeks by the time
    // this runs, so adopting them wholesale is right, and the effect above skips
    // the write-back rather than looping: this state IS the store's value.
    useEffect(() => store.subscribe(() => setWeeks(store.getWeeks())), []);

    // After every hook, so the throw never changes how many run in a render.
    if (loadFailure !== null) {
        throw loadFailure.error;
    }
    // Read at render rather than when the load resolved: on a cold start that
    // read happens before the session is known, and a guest is who this matters
    // for. See Store.guestCopyUnreadable.
    if (loaded && store.guestCopyUnreadable()) {
        throw new Error('the stored plan could not be read');
    }

    return [weeks, setWeeks, loaded];
}
