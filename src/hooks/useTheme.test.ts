import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTheme } from './useTheme';

// A controllable prefers-color-scheme. jsdom's own matchMedia always reports
// false and has no way to flip, which is exactly the case these tests are about.
let listeners: Array<(e: MediaQueryListEvent) => void>;
let systemIsDark: boolean;

function installMatchMedia() {
    listeners = [];
    systemIsDark = false;
    Object.defineProperty(window, 'matchMedia', {
        configurable: true,
        writable: true,
        value: (query: string) => ({
            matches: query.includes('dark') && systemIsDark,
            media: query,
            addEventListener: (_: string, cb: (e: MediaQueryListEvent) => void) => {
                listeners.push(cb);
            },
            removeEventListener: (_: string, cb: (e: MediaQueryListEvent) => void) => {
                listeners = listeners.filter((l) => l !== cb);
            },
        }),
    });
}

/** Flips the OS setting and notifies whoever is listening, as a browser would. */
function setSystemDark(dark: boolean) {
    systemIsDark = dark;
    act(() => {
        for (const l of listeners) l({ matches: dark } as MediaQueryListEvent);
    });
}

const attr = () => document.documentElement.dataset.theme;

describe('useTheme', () => {
    beforeEach(() => {
        localStorage.clear();
        delete document.documentElement.dataset.theme;
        installMatchMedia();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    /*
     * Testing strategy
     *   partition on stored pref: none (defaults to system) | light | dark | system
     *   partition on the OS while pref is 'system': light | dark, and a change
     *     arriving after mount
     *   the resolved theme is what reaches data-theme; the PREFERENCE is what is
     *     stored, so 'system' never freezes into whatever the OS was at the time
     *   a fixed pref ignores the OS entirely
     */

    it('no stored choice: follows the system, which here is light', () => {
        const { result } = renderHook(() => useTheme());
        expect(result.current.pref).toBe('system');
        expect(result.current.theme).toBe('light');
        expect(attr()).toBe('light');
    });

    it('no stored choice with a dark OS: resolves dark', () => {
        systemIsDark = true;
        const { result } = renderHook(() => useTheme());
        expect(result.current.pref).toBe('system');
        expect(result.current.theme).toBe('dark');
        expect(attr()).toBe('dark');
    });

    // The whole reason 'system' is resolved in the hook rather than in CSS.
    it('on system, an OS change repaints without a reload', () => {
        const { result } = renderHook(() => useTheme());
        expect(attr()).toBe('light');

        setSystemDark(true);

        expect(result.current.theme).toBe('dark');
        expect(attr()).toBe('dark');
    });

    it('a fixed choice ignores the OS', () => {
        const { result } = renderHook(() => useTheme());
        act(() => result.current.setPref('light'));

        setSystemDark(true);

        expect(result.current.pref).toBe('light');
        expect(result.current.theme).toBe('light');
        expect(attr()).toBe('light');
    });

    it('stores the preference, not the resolved theme', () => {
        const { result } = renderHook(() => useTheme());
        act(() => result.current.setPref('system'));
        setSystemDark(true);
        expect(localStorage.getItem('beaverplans:theme')).toBe('system');
    });

    it('a stored preference survives a remount', () => {
        const first = renderHook(() => useTheme());
        act(() => first.result.current.setPref('dark'));
        first.unmount();

        const { result } = renderHook(() => useTheme());
        expect(result.current.pref).toBe('dark');
        expect(attr()).toBe('dark');
    });

    // Values the two-state version of this hook wrote are still valid prefs, so
    // nobody's existing choice is dropped on upgrade.
    it('reads a pre-existing light/dark value as the preference it already was', () => {
        localStorage.setItem('beaverplans:theme', 'dark');
        const { result } = renderHook(() => useTheme());
        expect(result.current.pref).toBe('dark');
        expect(result.current.theme).toBe('dark');
    });

    it('ignores a junk stored value', () => {
        localStorage.setItem('beaverplans:theme', 'chartreuse');
        const { result } = renderHook(() => useTheme());
        expect(result.current.pref).toBe('system');
    });

    // Safari in private mode throws on any localStorage access; losing the
    // choice is acceptable, refusing to render is not.
    it('survives storage that throws', () => {
        vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
            throw new Error('denied');
        });
        vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
            throw new Error('denied');
        });
        const { result } = renderHook(() => useTheme());
        expect(result.current.pref).toBe('system');
        act(() => result.current.setPref('dark'));
        expect(attr()).toBe('dark');
    });

    // Not every runner implements matchMedia; the hook must not assume it.
    it('survives a missing matchMedia', () => {
        Object.defineProperty(window, 'matchMedia', {
            configurable: true,
            writable: true,
            value: undefined,
        });
        const { result } = renderHook(() => useTheme());
        expect(result.current.theme).toBe('light');
        expect(attr()).toBe('light');
    });
});
