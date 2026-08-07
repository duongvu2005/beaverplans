import { useEffect, useState, type Dispatch, type SetStateAction } from 'react';
import type { Weeks } from '../core/types';
import { store } from '../storage/instance';

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
 */
export function useWeeks(epoch: number): [Weeks, Dispatch<SetStateAction<Weeks>>, boolean] {
    const [weeks, setWeeks] = useState<Weeks>([]);
    // Which epoch the weeks currently in state actually belong to — not a
    // plain "loaded" flag, so that `loaded` below can be derived at render
    // time (loadedEpoch lags behind epoch until the promise resolves)
    // instead of needing its own synchronous setState at the top of the
    // effect just to flip it back to false the instant epoch changes.
    const [loadedEpoch, setLoadedEpoch] = useState<number | null>(null);
    const loaded = loadedEpoch === epoch;

    useEffect(() => {
        let cancelled = false;
        store.load().then(() => {
            if (cancelled) return;
            setWeeks(store.getWeeks());
            setLoadedEpoch(epoch);
        });
        return () => {
            cancelled = true;
        };
    }, [epoch]);

    useEffect(() => {
        if (!loaded) return; // don't persist the pre-load [] over real data
        store.setWeeks(weeks);
    }, [weeks, loaded]);

    // Changes this client did not make — another device or tab writing the
    // same account. The store has already merged them into its own weeks by
    // the time this runs, so adopting them wholesale is right; the effect
    // above then writes the same value straight back, which is a no-op diff
    // against what was just synced rather than a loop.
    useEffect(() => store.subscribe(() => setWeeks(store.getWeeks())), []);

    return [weeks, setWeeks, loaded];
}
