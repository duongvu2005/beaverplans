import { useCallback, useMemo, useSyncExternalStore } from 'react';

/**
 * Whether a CSS media query currently matches, re-rendering when that changes.
 *
 * For layout decisions a stylesheet cannot express — chiefly "how many items
 * should this chart be given", where CSS could only hide the extras and the
 * component needs to not receive them in the first place.
 *
 * @param query any CSS media query string
 * @returns true while the query matches
 */
export function useMediaQuery(query: string): boolean {
    const list = useMemo(() => window.matchMedia(query), [query]);

    const subscribe = useCallback(
        (onChange: () => void) => {
            list.addEventListener('change', onChange);
            return () => list.removeEventListener('change', onChange);
        },
        [list],
    );

    return useSyncExternalStore(subscribe, () => list.matches);
}
