import { describe, it, expect, vi } from 'vitest';
import { registerServiceWorker } from './registerServiceWorker';

/*
 * Testing strategy
 *     partition on container: absent (browser has no service workers) | present
 *     partition on register(): resolves | rejects
 *     partition on controller at call time: present (an update) | absent (a
 *         first install, or a hard reload, which loads uncontrolled)
 *     partition on controllerchange: never | once | more than once
 *
 * This covers the seam and nothing beyond it. The worker's own caching policy
 * is tested in sw.test.ts, against its real source.
 */

interface FakeOptions {
    readonly register?: () => Promise<ServiceWorkerRegistration>;
    /** Whether a worker already controls the page, as it does on an update. */
    readonly controlled?: boolean;
}

function fakeContainer({
    register = vi.fn(() => Promise.resolve({} as ServiceWorkerRegistration)),
    controlled = false,
}: FakeOptions = {}) {
    const listeners = new Map<string, () => void>();

    const container = {
        register,
        controller: controlled ? ({} as ServiceWorker) : null,
        addEventListener: (type: string, handler: () => void) => listeners.set(type, handler),
    } as unknown as ServiceWorkerContainer;

    return {
        container,
        register,
        /** What the browser does when a newly activated worker claims the page. */
        takeOver: () => listeners.get('controllerchange')?.(),
    };
}

describe('registerServiceWorker', () => {
    it('registers the worker at the origin root', () => {
        const fake = fakeContainer();

        registerServiceWorker(fake.container);

        // The path is the scope: served from the root, it controls every page.
        expect(fake.register).toHaveBeenCalledWith('/sw.js');
    });

    it('does nothing when the browser has no service workers', () => {
        expect(() => registerServiceWorker(undefined)).not.toThrow();
    });

    it('swallows a failed registration', async () => {
        const register = vi.fn(() => Promise.reject(new Error('insecure context')));
        const fake = fakeContainer({ register });

        expect(() => registerServiceWorker(fake.container)).not.toThrow();

        // Nothing above awaits the rejection, so let it settle inside the test
        // rather than escaping into the next one as an unhandled rejection.
        await Promise.resolve();
        expect(register).toHaveBeenCalledOnce();
    });

    describe('picking up a new version', () => {
        it('reloads when a new worker takes over a controlled page', () => {
            // The reason this exists alongside the worker's own reload: Safari
            // has no Client.navigate, so activate cannot reach it from there,
            // but controllerchange fires here just the same.
            const reload = vi.fn();
            const fake = fakeContainer({ controlled: true });

            registerServiceWorker(fake.container, reload);
            fake.takeOver();

            expect(reload).toHaveBeenCalledOnce();
        });

        it('does not reload on a first install', () => {
            // claim() fires controllerchange on a page that was not controlled
            // before, too. Reloading a page the user has only just opened is a
            // bug, not a fix.
            const reload = vi.fn();
            const fake = fakeContainer({ controlled: false });

            registerServiceWorker(fake.container, reload);
            fake.takeOver();

            expect(reload).not.toHaveBeenCalled();
        });

        it('reloads once however many times the controller changes', () => {
            const reload = vi.fn();
            const fake = fakeContainer({ controlled: true });

            registerServiceWorker(fake.container, reload);
            fake.takeOver();
            fake.takeOver();

            expect(reload).toHaveBeenCalledOnce();
        });

        it('does not reload a page no worker has taken over', () => {
            const reload = vi.fn();
            const fake = fakeContainer({ controlled: true });

            registerServiceWorker(fake.container, reload);

            expect(reload).not.toHaveBeenCalled();
        });

        it('listens before registering, so a fast activation cannot outrun it', () => {
            const order: string[] = [];
            const register = vi.fn(() => {
                order.push('register');
                return Promise.resolve({} as ServiceWorkerRegistration);
            });
            const listeners: string[] = [];
            const container = {
                register,
                controller: {} as ServiceWorker,
                addEventListener: (type: string) => {
                    order.push('listen');
                    listeners.push(type);
                },
            } as unknown as ServiceWorkerContainer;

            registerServiceWorker(container);

            expect(order).toEqual(['listen', 'register']);
            expect(listeners).toEqual(['controllerchange']);
        });
    });
});
