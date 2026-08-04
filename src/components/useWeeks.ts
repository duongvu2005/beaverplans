import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import type { Weeks } from '../core/types';
import { store } from '../storage/instance';

export function useWeeks(): [Weeks, Dispatch<SetStateAction<Weeks>>] {
    const [weeks, setWeeks] = useState<Weeks>([]);
    const loaded = useRef(false);

    useEffect(() => {
        let cancelled = false;
        store.load().then(() => {
            if (cancelled) return;
            setWeeks(store.getWeeks());
            loaded.current = true;
        });
        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        if (!loaded.current) return; // don't persist the pre-load [] over real data
        store.setWeeks(weeks);
    }, [weeks]);

    return [weeks, setWeeks];
}
