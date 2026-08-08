import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useWeeks } from './useWeeks';
import { store } from '@/storage/instance';
import type { Weeks } from '@/core/types';

// useWeeks talks to the real store singleton, which in turn talks to real
// localStorage/Supabase — mocked here down to just the Backend methods this
// hook actually calls, so `load()` can be held open and resolved by hand to
// observe the state in between. A method missing from this factory is
// undefined at the call site, so it has to keep up with the hook.
vi.mock('@/storage/instance', () => ({
    store: {
        load: vi.fn(),
        getWeeks: vi.fn(),
        setWeeks: vi.fn(),
        subscribe: vi.fn(() => () => {}),
    },
}));

// Deferred promise: lets a test control exactly when store.load() resolves,
// so it can assert on the state that exists while a load is still pending.
function deferred(): { promise: Promise<void>; resolve: () => void } {
    let resolve!: () => void;
    const promise = new Promise<void>((r) => {
        resolve = r;
    });
    return { promise, resolve };
}

describe('useWeeks', () => {
    beforeEach(() => {
        vi.mocked(store.load).mockReset();
        vi.mocked(store.getWeeks).mockReset();
        vi.mocked(store.setWeeks).mockReset();
        vi.mocked(store.subscribe)
            .mockReset()
            .mockImplementation(() => () => {});
    });

    /*
     * Testing strategy
     *     partition on load state: pending | resolved
     *     partition on epoch: unchanged (same backend) | changed (backend switch)
     *     the case this hook exists to fix: on an epoch change, `loaded`
     *     must go false in the SAME render as the epoch change (not one
     *     render later, once the new load resolves) — that's what stops
     *     App from ever rendering the outgoing backend's weeks.
     */

    it('starts not loaded, then reports the loaded weeks once load() resolves', async () => {
        const first = deferred();
        vi.mocked(store.load).mockReturnValueOnce(first.promise);
        const fixture: Weeks = [];
        vi.mocked(store.getWeeks).mockReturnValueOnce(fixture);

        const { result } = renderHook(({ epoch }) => useWeeks(epoch), {
            initialProps: { epoch: 0 },
        });

        expect(result.current[2]).toBe(false);

        await act(async () => {
            first.resolve();
            await first.promise;
        });

        expect(result.current[2]).toBe(true);
        expect(result.current[0]).toBe(fixture);
    });

    it('drops back to not-loaded in the same render as an epoch change, before the new load resolves', async () => {
        const first = deferred();
        vi.mocked(store.load).mockReturnValueOnce(first.promise);
        const firstWeeks: Weeks = [];
        vi.mocked(store.getWeeks).mockReturnValueOnce(firstWeeks);

        const { result, rerender } = renderHook(({ epoch }) => useWeeks(epoch), {
            initialProps: { epoch: 0 },
        });
        await act(async () => {
            first.resolve();
            await first.promise;
        });
        expect(result.current[2]).toBe(true);
        expect(result.current[0]).toBe(firstWeeks);

        // The second backend's load never resolves for the rest of this
        // test — the point is what `loaded` reports while it's hanging.
        const second = deferred();
        vi.mocked(store.load).mockReturnValueOnce(second.promise);
        rerender({ epoch: 1 });

        expect(result.current[2]).toBe(false);
        // Old weeks are still sitting in state — callers MUST gate on
        // `loaded` (App does, via the weeksLoaded return value) rather
        // than assume an unloaded hook reports empty/absent data.
        expect(result.current[0]).toBe(firstWeeks);
    });

    it('does not persist back to the backend before its own load has resolved', () => {
        const pending = deferred();
        vi.mocked(store.load).mockReturnValueOnce(pending.promise);

        renderHook(({ epoch }) => useWeeks(epoch), { initialProps: { epoch: 0 } });

        expect(store.setWeeks).not.toHaveBeenCalled();
    });

    it('adopts weeks the store reports from another device', async () => {
        const loaded: Weeks = [
            {
                weekStart: '2026-07-06',
                ended: false,
                projects: [{ id: 'p1', name: 'A', tasks: [] }],
            },
        ];
        const remote: Weeks = [
            ...loaded,
            {
                weekStart: '2026-07-13',
                ended: false,
                projects: [{ id: 'p2', name: 'B', tasks: [] }],
            },
        ];
        let report = () => {};
        vi.mocked(store.subscribe).mockImplementation((listener) => {
            report = listener;
            return () => {};
        });
        vi.mocked(store.load).mockResolvedValue(undefined);
        vi.mocked(store.getWeeks).mockReturnValue(loaded);

        const { result } = renderHook(({ epoch }) => useWeeks(epoch), {
            initialProps: { epoch: 0 },
        });
        await act(async () => {});
        expect(result.current[0]).toBe(loaded);

        // The store has already merged the remote change into its own weeks
        // by the time it reports, so the hook adopts whatever it now holds.
        vi.mocked(store.getWeeks).mockReturnValue(remote);
        act(() => report());

        expect(result.current[0]).toBe(remote);
    });

    it('stops listening when unmounted', () => {
        let detached = 0;
        vi.mocked(store.subscribe).mockImplementation(() => () => {
            detached += 1;
        });
        vi.mocked(store.load).mockResolvedValue(undefined);
        vi.mocked(store.getWeeks).mockReturnValue([]);

        const { unmount } = renderHook(({ epoch }) => useWeeks(epoch), {
            initialProps: { epoch: 0 },
        });
        unmount();

        expect(detached).toBe(1);
    });
});
