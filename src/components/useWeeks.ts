import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import type { Weeks } from '../core/types';
import { store } from '../storage/instance';

/**
 * @param epoch bumped by useAuth whenever the active backend actually
 *        switches (local <-> cloud); reloads from the (now-active) backend
 *        each time it changes. Callers with no such switching just pass a
 *        constant.
 */
export function useWeeks(epoch: number): [Weeks, Dispatch<SetStateAction<Weeks>>] {
    const [weeks, setWeeks] = useState<Weeks>([]);
    const loaded = useRef(false);

    useEffect(() => {
        let cancelled = false;
        // Re-entering a load: guards the persist effect below from writing
        // the outgoing backend's weeks over the incoming one before its own
        // load() has resolved and replaced them.
        loaded.current = false;
        store.load().then(() => {
            if (cancelled) return;
            setWeeks(store.getWeeks());
            loaded.current = true;
        });
        return () => {
            cancelled = true;
        };
    }, [epoch]);

    useEffect(() => {
        if (!loaded.current) return; // don't persist the pre-load [] over real data
        store.setWeeks(weeks);
    }, [weeks]);

    return [weeks, setWeeks];
}
