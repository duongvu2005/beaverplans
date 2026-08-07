import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useGuestMigration } from './useGuestMigration';
import { store } from '../storage/instance';
import type { Weeks } from '../core/types';

// Mocked down to just the Store methods this hook actually calls — same
// approach as useWeeks.test.tsx. A method missing here reads as undefined and
// throws on call, which the hook's catch would swallow into "gave up quietly",
// so this list has to keep up with the hook.
vi.mock('../storage/instance', () => ({
    store: {
        hasLocalData: vi.fn(),
        cloudSnapshot: vi.fn(),
        getWeeks: vi.fn(),
        mergeLocalIntoCloud: vi.fn(),
        clearLocal: vi.fn(),
    },
}));

const nonEmptyCloud: Weeks = [
    { weekStart: '2026-07-06', ended: false, projects: [{ id: 'p', name: 'p', tasks: [] }] },
];

describe('useGuestMigration', () => {
    beforeEach(() => {
        vi.mocked(store.hasLocalData).mockReset();
        vi.mocked(store.cloudSnapshot).mockReset();
        vi.mocked(store.getWeeks).mockReset();
        vi.mocked(store.mergeLocalIntoCloud).mockReset().mockResolvedValue(undefined);
        vi.mocked(store.clearLocal).mockReset();
    });

    /*
     * Testing strategy
     *   partition on userId: undefined (never checks) | defined
     *   partition on weeksLoaded: false (waits) | true
     *   partition on hasLocalData: false (nothing happens) | true
     *   partition on decision once hasLocalData is true: cloudEmpty -> auto
     *     (silent merge + weeks sync) | not cloudEmpty -> prompt
     *   confirmMerge / discardGuestWork resolve the prompt path
     *   dedup: same userId across a weeksLoaded toggle checks once; a new
     *     userId rechecks; userId going back to undefined resets the prompt
     */

    it('userId undefined: never checks', async () => {
        renderHook(() => useGuestMigration(undefined, true, vi.fn()));
        await act(async () => {});
        expect(store.hasLocalData).not.toHaveBeenCalled();
    });

    it('weeksLoaded false: waits, does not check yet', async () => {
        renderHook(() => useGuestMigration('u1', false, vi.fn()));
        await act(async () => {});
        expect(store.hasLocalData).not.toHaveBeenCalled();
    });

    it('no local data: neither auto-merges nor prompts', async () => {
        vi.mocked(store.hasLocalData).mockResolvedValue(false);
        const { result } = renderHook(() => useGuestMigration('u1', true, vi.fn()));
        await waitFor(() => expect(store.hasLocalData).toHaveBeenCalledTimes(1));
        expect(result.current.pendingMerge).toBe(false);
        expect(store.mergeLocalIntoCloud).not.toHaveBeenCalled();
    });

    it('local data + empty cloud: auto-merges silently and syncs weeks', async () => {
        vi.mocked(store.hasLocalData).mockResolvedValue(true);
        const merged: Weeks = [{ weekStart: '2026-07-13', ended: false, projects: [] }];
        vi.mocked(store.cloudSnapshot).mockReturnValue([]); // the cloudEmpty check
        vi.mocked(store.getWeeks).mockReturnValue(merged); // the post-merge board read
        const setWeeks = vi.fn();

        const { result } = renderHook(() => useGuestMigration('u1', true, setWeeks));

        await waitFor(() => expect(setWeeks).toHaveBeenCalledWith(merged));
        expect(store.mergeLocalIntoCloud).toHaveBeenCalledTimes(1);
        expect(result.current.pendingMerge).toBe(false);
    });

    it('local data + non-empty cloud: prompts instead of merging', async () => {
        vi.mocked(store.hasLocalData).mockResolvedValue(true);
        vi.mocked(store.cloudSnapshot).mockReturnValue(nonEmptyCloud);

        const { result } = renderHook(() => useGuestMigration('u1', true, vi.fn()));

        await waitFor(() => expect(result.current.pendingMerge).toBe(true));
        expect(store.mergeLocalIntoCloud).not.toHaveBeenCalled();
    });

    it('confirmMerge: merges, syncs weeks, closes the prompt', async () => {
        vi.mocked(store.hasLocalData).mockResolvedValue(true);
        vi.mocked(store.cloudSnapshot).mockReturnValue(nonEmptyCloud);
        const merged: Weeks = [{ weekStart: '2026-07-13', ended: false, projects: [] }];
        vi.mocked(store.getWeeks).mockReturnValue(merged); // the post-merge board read
        const setWeeks = vi.fn();

        const { result } = renderHook(() => useGuestMigration('u1', true, setWeeks));
        await waitFor(() => expect(result.current.pendingMerge).toBe(true));

        await act(async () => {
            result.current.confirmMerge();
            await Promise.resolve();
        });

        expect(store.mergeLocalIntoCloud).toHaveBeenCalledTimes(1);
        expect(setWeeks).toHaveBeenCalledWith(merged);
        expect(result.current.pendingMerge).toBe(false);
    });

    it('discardGuestWork: clears local, closes the prompt, never merges', async () => {
        vi.mocked(store.hasLocalData).mockResolvedValue(true);
        vi.mocked(store.cloudSnapshot).mockReturnValue(nonEmptyCloud);

        const { result } = renderHook(() => useGuestMigration('u1', true, vi.fn()));
        await waitFor(() => expect(result.current.pendingMerge).toBe(true));

        act(() => {
            result.current.discardGuestWork();
        });

        expect(store.clearLocal).toHaveBeenCalledTimes(1);
        expect(store.mergeLocalIntoCloud).not.toHaveBeenCalled();
        expect(result.current.pendingMerge).toBe(false);
    });

    it('does not re-check the same userId once resolved, even if weeksLoaded toggles', async () => {
        vi.mocked(store.hasLocalData).mockResolvedValue(false);
        const { rerender } = renderHook(
            ({ id, loaded }) => useGuestMigration(id, loaded, vi.fn()),
            {
                initialProps: { id: 'u1' as string | undefined, loaded: true },
            },
        );
        await waitFor(() => expect(store.hasLocalData).toHaveBeenCalledTimes(1));

        rerender({ id: 'u1', loaded: false });
        rerender({ id: 'u1', loaded: true });
        await act(async () => {});

        expect(store.hasLocalData).toHaveBeenCalledTimes(1);
    });

    it('rechecks when userId changes to a different account', async () => {
        vi.mocked(store.hasLocalData).mockResolvedValue(false);
        const { rerender } = renderHook(({ id }) => useGuestMigration(id, true, vi.fn()), {
            initialProps: { id: 'u1' as string | undefined },
        });
        await waitFor(() => expect(store.hasLocalData).toHaveBeenCalledTimes(1));

        rerender({ id: 'u2' });
        await waitFor(() => expect(store.hasLocalData).toHaveBeenCalledTimes(2));
    });

    it('decideLater: closes the prompt, touches neither local nor cloud', async () => {
        vi.mocked(store.hasLocalData).mockResolvedValue(true);
        vi.mocked(store.cloudSnapshot).mockReturnValue(nonEmptyCloud);

        const { result } = renderHook(() => useGuestMigration('u1', true, vi.fn()));
        await waitFor(() => expect(result.current.pendingMerge).toBe(true));

        act(() => {
            result.current.decideLater();
        });

        expect(result.current.pendingMerge).toBe(false);
        expect(store.clearLocal).not.toHaveBeenCalled();
        expect(store.mergeLocalIntoCloud).not.toHaveBeenCalled();
    });

    it('hasLocalData rejecting is swallowed, and does not burn the one check for this account', async () => {
        // A browser with storage disabled: reading it throws outright. Nothing
        // should escape as an unhandled rejection, and because guest work is
        // untouched, a later attempt must still be allowed to find it.
        vi.mocked(store.hasLocalData).mockRejectedValueOnce(new Error('storage disabled'));
        const { result, rerender } = renderHook(
            ({ loaded }) => useGuestMigration('u1', loaded, vi.fn()),
            { initialProps: { loaded: true } },
        );
        await waitFor(() => expect(store.hasLocalData).toHaveBeenCalledTimes(1));
        expect(result.current.pendingMerge).toBe(false);

        // The retry: now storage cooperates and there IS guest work to fold in.
        vi.mocked(store.hasLocalData).mockResolvedValue(true);
        vi.mocked(store.cloudSnapshot).mockReturnValue(nonEmptyCloud);
        rerender({ loaded: false });
        rerender({ loaded: true });

        await waitFor(() => expect(result.current.pendingMerge).toBe(true));
    });

    it('userId reverting to undefined (signed out) resets a pending prompt', async () => {
        vi.mocked(store.hasLocalData).mockResolvedValue(true);
        vi.mocked(store.cloudSnapshot).mockReturnValue(nonEmptyCloud);
        const { result, rerender } = renderHook(({ id }) => useGuestMigration(id, true, vi.fn()), {
            initialProps: { id: 'u1' as string | undefined },
        });
        await waitFor(() => expect(result.current.pendingMerge).toBe(true));

        rerender({ id: undefined });
        expect(result.current.pendingMerge).toBe(false);
    });
});
