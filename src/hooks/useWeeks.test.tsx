import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Component, type ReactNode } from 'react';
import { renderHook, act } from '@testing-library/react';
import { useWeeks } from './useWeeks';
import { store } from '@/storage/instance';
import type { Weeks } from '@/core/types';

// The store singleton, mocked down to the Backend methods this hook calls, so
// `load()` can be held open and resolved by hand to observe the state in
// between. A method missing from this factory is undefined at the call site, so
// it has to keep up with the hook.
vi.mock('@/storage/instance', () => ({
    store: {
        load: vi.fn(),
        getWeeks: vi.fn(),
        setWeeks: vi.fn(),
        subscribe: vi.fn(() => () => {}),
        sessionCount: vi.fn(() => 0),
        guestCopyUnreadable: vi.fn(() => false),
    },
}));

// Deferred promise: lets a test control exactly when store.load() settles,
// so it can assert on the state that exists while a load is still pending.
function deferred(): {
    promise: Promise<void>;
    resolve: () => void;
    reject: (error: unknown) => void;
} {
    let resolve!: () => void;
    let reject!: (error: unknown) => void;
    const promise = new Promise<void>((res, rej) => {
        resolve = res;
        reject = rej;
    });
    return { promise, resolve, reject };
}

// Catches what a render throws, so a test can assert the failure escaped the
// hook rather than being swallowed into a permanent loading state.
function boundary(onError: (error: unknown) => void) {
    return class extends Component<{ children?: ReactNode }, { failed: boolean }> {
        public override state = { failed: false };
        public static getDerivedStateFromError() {
            return { failed: true };
        }
        public override componentDidCatch(error: unknown) {
            onError(error);
        }
        public override render() {
            return this.state.failed ? null : this.props.children;
        }
    };
}

describe('useWeeks', () => {
    beforeEach(() => {
        vi.mocked(store.load).mockReset();
        vi.mocked(store.getWeeks).mockReset();
        vi.mocked(store.setWeeks).mockReset();
        vi.mocked(store.subscribe)
            .mockReset()
            .mockImplementation(() => () => {});
        vi.mocked(store.sessionCount).mockReset().mockReturnValue(0);
        vi.mocked(store.guestCopyUnreadable).mockReset().mockReturnValue(false);
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

    // The persist effect runs when `loaded` flips, and the value it would write
    // is the one load() just produced. Writing it back costs a durable write and
    // a whole push -- session read included -- to send a diff that is empty.
    it('covers a settled load: what it just read is not written straight back out', async () => {
        const gate = deferred();
        vi.mocked(store.load).mockReturnValueOnce(gate.promise);
        const fixture: Weeks = [];
        vi.mocked(store.getWeeks).mockReturnValue(fixture);

        renderHook(({ epoch }) => useWeeks(epoch), { initialProps: { epoch: 0 } });
        await act(async () => {
            gate.resolve();
            await gate.promise;
        });

        expect(store.setWeeks).not.toHaveBeenCalled();
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
        // Old weeks are still sitting in state — callers MUST gate on `loaded`
        // rather than assume an unloaded hook reports empty data.
        expect(result.current[0]).toBe(firstWeeks);
    });

    it('does not persist back to the backend before its own load has resolved', () => {
        const pending = deferred();
        vi.mocked(store.load).mockReturnValueOnce(pending.promise);

        renderHook(({ epoch }) => useWeeks(epoch), { initialProps: { epoch: 0 } });

        expect(store.setWeeks).not.toHaveBeenCalled();
    });

    it('never persists empty weeks over real data when the load fails', async () => {
        // Flipping `loaded` after a rejection runs the persist effect while
        // `weeks` is still the initial [], and CloudBackend turns setWeeks([])
        // into a delete of every row.
        const failed = deferred();
        vi.mocked(store.load).mockReturnValueOnce(failed.promise);
        vi.mocked(store.getWeeks).mockReturnValue([]);

        let caught: unknown;
        renderHook(({ epoch }) => useWeeks(epoch), {
            initialProps: { epoch: 0 },
            wrapper: boundary((error) => {
                caught = error;
            }),
        });
        await act(async () => {
            failed.reject(new Error('network down'));
            await failed.promise.catch(() => {});
        });

        expect(caught).toBeInstanceOf(Error);
        expect(store.setWeeks).not.toHaveBeenCalled();
    });

    it('surfaces a failed load instead of gating on it forever', async () => {
        // App returns null while `loaded` is false, so a load that rejected is
        // indistinguishable from one still in flight: a blank page, permanently.
        // The rejection has to reach the error boundary.
        const failed = deferred();
        vi.mocked(store.load).mockReturnValueOnce(failed.promise);
        vi.mocked(store.getWeeks).mockReturnValue([]);

        let caught: unknown;
        const { result } = renderHook(({ epoch }) => useWeeks(epoch), {
            initialProps: { epoch: 0 },
            wrapper: boundary((error) => {
                caught = error;
            }),
        });
        await act(async () => {
            failed.reject(new Error('network down'));
            await failed.promise.catch(() => {});
        });

        expect(caught).toBeInstanceOf(Error);
        expect(result.current[2]).toBe(false);
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

/*
 * A guest's stored plan is the only copy there is, so bytes that will not read
 * have to reach an error boundary rather than be shown as an empty plan. Store
 * decides whether that is the situation — see Store.guestCopyUnreadable, which
 * stays silent until it knows there is no account behind the guest copy.
 *
 * Testing strategy
 *     partition on what Store reports: unreadable | fine
 *     partition on when it is asked: before the load resolves | after
 */
describe('useWeeks: a guest copy that will not read', () => {
    beforeEach(() => {
        vi.mocked(store.load).mockReset();
        vi.mocked(store.getWeeks).mockReset().mockReturnValue([]);
        vi.mocked(store.setWeeks).mockReset();
        vi.mocked(store.subscribe)
            .mockReset()
            .mockImplementation(() => () => {});
        vi.mocked(store.sessionCount).mockReset().mockReturnValue(0);
        vi.mocked(store.guestCopyUnreadable).mockReset().mockReturnValue(false);
    });

    it('throws out to the boundary once Store reports it', async () => {
        const gate = deferred();
        vi.mocked(store.load).mockReturnValueOnce(gate.promise);
        vi.mocked(store.guestCopyUnreadable).mockReturnValue(true);
        let caught: unknown = null;
        const Boundary = boundary((error) => {
            caught = error;
        });

        renderHook(({ epoch }) => useWeeks(epoch), {
            initialProps: { epoch: 0 },
            wrapper: Boundary,
        });
        await act(async () => {
            gate.resolve();
            await gate.promise;
        });

        expect(String(caught)).toContain('could not be read');
    });

    it('says nothing while Store is still silent', async () => {
        const gate = deferred();
        vi.mocked(store.load).mockReturnValueOnce(gate.promise);
        let caught: unknown = null;
        const Boundary = boundary((error) => {
            caught = error;
        });

        const { result } = renderHook(({ epoch }) => useWeeks(epoch), {
            initialProps: { epoch: 0 },
            wrapper: Boundary,
        });
        await act(async () => {
            gate.resolve();
            await gate.promise;
        });

        expect({ caught, loaded: result.current[2] }).toEqual({ caught: null, loaded: true });
    });
});
