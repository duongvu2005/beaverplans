/**
 * Registers the app-shell service worker (public/sw.js) and reloads the page
 * when a new one takes over.
 *
 * @param container navigator.serviceWorker, or undefined where the browser has
 *        no service workers. The caller owns the decision to register at all.
 * @param reload  what to do when a new worker claims the page.
 * @returns nothing, and never throws or rejects: a failed registration costs
 *          the offline cold start and nothing else.
 */
export function registerServiceWorker(
    container: ServiceWorkerContainer | undefined,
    reload: () => void = () => window.location.reload(),
): void {
    if (container === undefined) return;

    // Read now, not in the listener: by then the new worker has claimed the
    // page and this is set either way. Uncontrolled here means a first install,
    // not an update.
    const updating = container.controller !== null;
    let reloading = false;

    // Before register(), so an activation cannot land ahead of the listener.
    container.addEventListener('controllerchange', () => {
        if (!updating || reloading) return;
        // The worker reloads windows from its own activate too, so this guards
        // against two triggers, not against this one firing twice.
        reloading = true;
        reload();
    });

    // The path doubles as the scope: at the root it controls every page.
    container.register('/sw.js').catch(() => {});
}
