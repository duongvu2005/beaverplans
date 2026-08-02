import { useEffect, useState } from 'react';

export type Theme = 'light' | 'dark';

const KEY = 'beaverplans:theme';

// Two states, not three: index.css makes light the default regardless of the OS
// setting, so there is no "system" to fall back to yet. A third option would be
// a change to the palette's contract, not to this hook.
function stored(): Theme | null {
    try {
        const value = localStorage.getItem(KEY);
        return value === 'light' || value === 'dark' ? value : null;
    } catch {
        // Safari in private mode throws on any localStorage access.
        return null;
    }
}

/**
 * The chosen theme, mirrored onto the document element and remembered.
 *
 * @returns the current theme and a toggle between the two. The attribute
 *     `data-theme` on `<html>` is kept equal to the returned theme, which is
 *     what the dark palette in index.css keys off.
 */
export function useTheme() {
    const [theme, setTheme] = useState<Theme>(() => stored() ?? 'light');

    useEffect(() => {
        document.documentElement.dataset.theme = theme;
        try {
            localStorage.setItem(KEY, theme);
        } catch {
            // Not being able to remember the choice is not a reason to refuse it.
        }
    }, [theme]);

    return {
        theme,
        toggleTheme: () => setTheme((current) => (current === 'dark' ? 'light' : 'dark')),
    };
}
