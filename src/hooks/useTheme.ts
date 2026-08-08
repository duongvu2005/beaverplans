import { useEffect, useState } from 'react';

/** What the person picked. 'system' defers to the OS, and can change under us. */
export type ThemePref = 'light' | 'dark' | 'system';

/** What is actually on screen. Always one of the two real palettes. */
export type Theme = 'light' | 'dark';

const KEY = 'beaverplans:theme';

const DARK_QUERY = '(prefers-color-scheme: dark)';

// Kept as the PREFERENCE, not the resolved theme: storing 'dark' for someone on
// 'system' would freeze whatever their OS happened to be set to at the time.
// Values written by the earlier two-state version of this hook were 'light' or
// 'dark', which are still valid preferences, so no migration is needed.
function stored(): ThemePref | null {
    try {
        const value = localStorage.getItem(KEY);
        return value === 'light' || value === 'dark' || value === 'system' ? value : null;
    } catch {
        // Safari in private mode throws on any localStorage access.
        return null;
    }
}

function systemTheme(): Theme {
    // matchMedia is missing in some test environments (jsdom implements it, but
    // not every runner does) — defaulting to light matches index.css's own
    // default rather than guessing.
    if (typeof window.matchMedia !== 'function') return 'light';
    return window.matchMedia(DARK_QUERY).matches ? 'dark' : 'light';
}

/**
 * The chosen theme preference, the palette it currently resolves to, and a
 * setter.
 *
 * 'system' is resolved HERE rather than in CSS, which is why index.css needs no
 * prefers-color-scheme block: `data-theme` on <html> is always the resolved
 * palette ('light' or 'dark'), so the stylesheet keeps its single, simple
 * contract and only this hook knows that a third option exists.
 *
 * @returns pref (what was picked, including 'system'), theme (what is on screen
 *     right now), and setPref. While pref is 'system' the OS is watched, so a
 *     change to it repaints without a reload.
 */
export function useTheme() {
    const [pref, setPref] = useState<ThemePref>(() => stored() ?? 'system');
    // Only meaningful while pref is 'system', but tracked unconditionally so
    // switching to 'system' resolves off a current value rather than a stale one.
    const [osTheme, setOsTheme] = useState<Theme>(systemTheme);

    const theme: Theme = pref === 'system' ? osTheme : pref;

    useEffect(() => {
        if (typeof window.matchMedia !== 'function') return;
        const query = window.matchMedia(DARK_QUERY);
        const onChange = (e: MediaQueryListEvent) => setOsTheme(e.matches ? 'dark' : 'light');
        query.addEventListener('change', onChange);
        return () => query.removeEventListener('change', onChange);
    }, []);

    useEffect(() => {
        document.documentElement.dataset.theme = theme;
    }, [theme]);

    useEffect(() => {
        try {
            localStorage.setItem(KEY, pref);
        } catch {
            // Not being able to remember the choice is not a reason to refuse it.
        }
    }, [pref]);

    return { pref, theme, setPref };
}
